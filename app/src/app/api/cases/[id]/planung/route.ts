import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCustomerSession, checkCaseAccess } from "@/lib/customer-auth";

/**
 * GET /api/cases/[id]/planung
 *
 * Liefert strukturierte Planungsdaten aus der Datenbank (CasePlanning Tabelle)
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

    // Lade Planungsdaten aus DB
    const planning = await prisma.casePlanning.findUnique({
      where: { caseId }
    });

    if (!planning) {
      return NextResponse.json({
        error: "Noch keine Planung vorhanden",
        hint: "Planung muss erst importiert werden"
      }, { status: 404 });
    }

    // Parse JSON
    const planningData = JSON.parse(planning.planningData);

    return NextResponse.json({
      success: true,
      data: planningData
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
