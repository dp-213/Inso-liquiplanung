import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * GET /api/cases/[id]/finanzierung
 *
 * STUB - Feature noch nicht implementiert
 *
 * TODO: Kreditverträge in Datenbank importieren
 * - Massekredit (aus case-context.json)
 * - Weitere Darlehen (aus Case-Ordner)
 * - Monatliche Zins-/Tilgungsbelastung berechnen
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Auth-Check
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    // Case abrufen
    const caseData = await prisma.case.findUnique({
      where: { id },
      select: {
        id: true,
        caseNumber: true,
        debtorName: true,
      },
    });

    if (!caseData) {
      return NextResponse.json(
        { success: false, error: "Fall nicht gefunden" },
        { status: 404 }
      );
    }

    // STUB: Leere Response
    return NextResponse.json({
      success: true,
      available: false,
      message: "Finanzierungsübersicht wird in einer zukünftigen Version verfügbar sein",
      summary: {
        totalDebt: 0,
        monthlyInterest: 0,
        monthlyPrincipal: 0,
        monthlyTotal: 0,
        creditorCount: 0,
        contractCount: 0,
        byCreditor: {},
      },
      creditLines: [],
    });
  } catch (error) {
    console.error("Fehler beim Laden der Finanzierungsdaten:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Fehler beim Laden der Finanzierungsdaten",
      },
      { status: 500 }
    );
  }
}
