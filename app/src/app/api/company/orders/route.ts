
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

    // 5. Order erstellen
    const order = await prisma.order.create({
      data: {
        caseId: companyToken.caseId,
        type,
        creditor,
        description,
        amountCents: BigInt(parsedAmount),
        invoiceDate: parsedDate,
        notes: notes || null,
        documentName,
        documentMimeType,
        documentSizeBytes,
        documentContent,
        status: "PENDING",
      },
    });

    const typeLabel = type === "BESTELLUNG" ? "Bestellanfrage" : "Zahlungsanfrage";

    return NextResponse.json({
      success: true,
      orderId: order.id,
      message: `${typeLabel} erfolgreich eingereicht`,
    });

  } catch (error) {
    console.error("[Order Submission Error]", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
