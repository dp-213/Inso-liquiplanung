import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCustomerSession, checkCaseAccess } from "@/lib/customer-auth";

/**
 * GET /api/cases/[id]/planung
 *
 * Liefert Planungsdaten aus der Datenbank (LedgerEntries mit valueType=PLAN)
 *
 * TODO: Erweitern um strukturierte Planungs-Ansicht
 * Aktuell: Stub-Implementation, gibt leere Planung zurück
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await context.params;

    // Auth: Admin ODER Customer mit Case-Access
    const adminSession = await getSession();
    const customerSession = await getCustomerSession();

    if (!adminSession && !customerSession) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    // Falls Customer: Prüfe Access
    if (customerSession && !adminSession) {
      const hasAccess = await checkCaseAccess(customerSession.customerId, caseId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Kein Zugriff auf diesen Fall" }, { status: 403 });
      }
    }

    // Prüfe ob Case existiert
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, debtorName: true }
    });

    if (!caseData) {
      return NextResponse.json({ error: "Fall nicht gefunden" }, { status: 404 });
    }

    // Lade PLAN-Entries aus LedgerEntries
    const planEntries = await prisma.ledgerEntry.findMany({
      where: {
        caseId,
        valueType: "PLAN"
      },
      orderBy: { transactionDate: "asc" },
      take: 100 // Limit für Performance
    });

    return NextResponse.json({
      success: true,
      caseId,
      caseName: caseData.debtorName,
      planEntries: planEntries.map(e => ({
        id: e.id,
        date: e.transactionDate.toISOString(),
        description: e.description,
        amountCents: e.amountCents.toString(),
        category: e.categoryTag || "Uncategorized",
        legalBucket: e.legalBucket,
        estateAllocation: e.estateAllocation
      })),
      total: planEntries.length,
      note: "Planungs-Daten aus Datenbank - UI folgt in nächster Version"
    });
  } catch (error) {
    console.error("[Planung API] Fehler:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Planung konnte nicht geladen werden",
        details: error instanceof Error ? error.message : "Unbekannter Fehler"
      },
      { status: 500 }
    );
  }
}
