
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createApprovalSteps, hasApprovalChain, getCurrentApprover } from "@/lib/approval-engine";
import { sendEmail } from "@/lib/email";
import { newOrderEmail } from "@/lib/email-templates";

// Maximale Dateigröße: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Erlaubte MIME-Types
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const token = formData.get("token") as string;
    const type = (formData.get("type") as string) || "ZAHLUNG";
    const creditor = formData.get("creditor") as string;
    const creditorId = formData.get("creditorId") as string | null;
    const costCategoryId = formData.get("costCategoryId") as string | null;
    const description = formData.get("description") as string;
    const amountCents = formData.get("amountCents") as string;
    const invoiceDate = formData.get("invoiceDate") as string;
    const notes = formData.get("notes") as string | null;
    const file = formData.get("file") as File | null;

    if (!token || !creditor || !description || !amountCents || !invoiceDate) {
      return NextResponse.json(
        { error: "Fehlende Pflichtfelder" },
        { status: 400 }
      );
    }

    if (type !== "BESTELLUNG" && type !== "ZAHLUNG") {
      return NextResponse.json(
        { error: "Ungültiger Typ. Erlaubt: BESTELLUNG, ZAHLUNG" },
        { status: 400 }
      );
    }

    // 1. Token validieren
    const companyToken = await prisma.companyToken.findUnique({
      where: { token },
      include: { case: true },
    });

    if (!companyToken || !companyToken.isActive) {
      return NextResponse.json(
        { error: "Ungültiger oder abgelaufener Token" },
        { status: 401 }
      );
    }

    // 2. Datei verarbeiten (als Base64 speichern)
    let documentName: string | null = null;
    let documentMimeType: string | null = null;
    let documentSizeBytes: bigint | null = null;
    let documentContent: string | null = null;

    if (file && file.size > 0) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "Datei zu groß (max. 10 MB)" },
          { status: 400 }
        );
      }

      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: "Ungültiger Dateityp. Erlaubt: PDF, JPG, PNG" },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      documentContent = buffer.toString("base64");
      documentName = file.name;
      documentMimeType = file.type;
      documentSizeBytes = BigInt(file.size);
    }

    // 3. Betrag validieren
    const parsedAmount = Number(amountCents);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Ungültiger Betrag" },
        { status: 400 }
      );
    }

    // 4. Datum validieren
    const parsedDate = new Date(invoiceDate + "T00:00:00.000Z");
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Ungültiges Datum" },
        { status: 400 }
      );
    }

    // 5. Auto-Approve prüfen
    const caseData = companyToken.case;
    const amountBigInt = BigInt(parsedAmount);
    const shouldAutoApprove =
      caseData.approvalThresholdCents !== null &&
      amountBigInt <= caseData.approvalThresholdCents;

    // 6. Order erstellen (ggf. mit Auto-Approve + LedgerEntry in einer Transaktion)
    if (shouldAutoApprove) {
      const result = await prisma.$transaction(async (tx) => {
        const typeLabel = type === "BESTELLUNG" ? "Bestellfreigabe" : "Zahlungsfreigabe";

        // categoryTag aus CostCategory lesen
        let categoryTag: string | null = null;
        if (costCategoryId) {
          const costCat = await tx.costCategory.findUnique({
            where: { id: costCategoryId },
            select: { categoryTag: true },
          });
          categoryTag = costCat?.categoryTag || null;
        }

        const ledgerEntry = await tx.ledgerEntry.create({
          data: {
            caseId: companyToken.caseId,
            transactionDate: parsedDate,
            amountCents: -amountBigInt,
            description: `${creditor}: ${description}`,
            valueType: "PLAN",
            legalBucket: "MASSE",
            estateAllocation: "NEUMASSE",
            allocationSource: "MANUELL",
            allocationNote: `Auto-${typeLabel} (unter Schwellwert)`,
            bookingSource: "MANUAL",
            note: `Automatisch freigegebene ${typeLabel}`,
            createdBy: "system",
            ...(categoryTag && { categoryTag }),
          },
        });

        const order = await tx.order.create({
          data: {
            caseId: companyToken.caseId,
            type,
            creditor,
            creditorId: creditorId || null,
            costCategoryId: costCategoryId || null,
            description,
            amountCents: amountBigInt,
            invoiceDate: parsedDate,
            notes: notes || null,
            documentName,
            documentMimeType,
            documentSizeBytes,
            documentContent,
            status: "AUTO_APPROVED",
            approvedAt: new Date(),
            approvedBy: "system",
            ledgerEntryId: ledgerEntry.id,
            companyTokenId: companyToken.id,
          },
        });

        // bookingReference nachträglich setzen (braucht Order-ID)
        await tx.ledgerEntry.update({
          where: { id: ledgerEntry.id },
          data: { bookingReference: `ORDER-${order.id.slice(0, 8)}` },
        });

        return order;
      });

      const typeLabel = type === "BESTELLUNG" ? "Bestellanfrage" : "Zahlungsanfrage";
      return NextResponse.json({
        success: true,
        orderId: result.id,
        autoApproved: true,
        message: `${typeLabel} automatisch freigegeben (unter Schwellwert)`,
      });
    }

    // Kein Auto-Approve: Normal als PENDING erstellen + ggf. ApprovalSteps generieren
    const order = await prisma.order.create({
      data: {
        caseId: companyToken.caseId,
        type,
        creditor,
        creditorId: creditorId || null,
        costCategoryId: costCategoryId || null,
        description,
        amountCents: amountBigInt,
        invoiceDate: parsedDate,
        notes: notes || null,
        documentName,
        documentMimeType,
        documentSizeBytes,
        documentContent,
        status: "PENDING",
        companyTokenId: companyToken.id,
      },
    });

    // ApprovalSteps generieren wenn Chain-Modus aktiv
    const chainActive = await hasApprovalChain(companyToken.caseId);
    let stepsCreated = 0;
    if (chainActive) {
      stepsCreated = await createApprovalSteps(order.id, companyToken.caseId, amountBigInt);
    }

    // Email an Approver senden (nicht-blockierend)
    const caseName = companyToken.case.debtorName;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cases.gradify.de";
    const portalUrl = `${appUrl}/portal/cases/${companyToken.caseId}`;

    if (chainActive) {
      // Chain-Modus: Email an ersten Approver
      const approver = await getCurrentApprover(order.id);
      if (approver?.email) {
        const tpl = newOrderEmail(caseName, { creditor, amountCents: amountBigInt, description, type }, portalUrl);
        sendEmail({ to: approver.email, ...tpl, context: { event: "NEW_ORDER_CHAIN", caseId: companyToken.caseId, orderIds: [order.id] } });
      }
    } else {
      // Legacy: Email an Case-Owner
      const owner = await prisma.customerUser.findUnique({
        where: { id: caseData.ownerId },
        select: { email: true },
      });
      if (owner?.email) {
        const tpl = newOrderEmail(caseName, { creditor, amountCents: amountBigInt, description, type }, portalUrl);
        sendEmail({ to: owner.email, ...tpl, context: { event: "NEW_ORDER_LEGACY", caseId: companyToken.caseId, orderIds: [order.id] } });
      }
    }

    const typeLabel = type === "BESTELLUNG" ? "Bestellanfrage" : "Zahlungsanfrage";

    return NextResponse.json({
      success: true,
      orderId: order.id,
      stepsCreated,
      message: stepsCreated > 0
        ? `${typeLabel} eingereicht (${stepsCreated} Freigabestufen)`
        : `${typeLabel} erfolgreich eingereicht`,
    });

  } catch (error) {
    console.error("[Order Submission Error]", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
