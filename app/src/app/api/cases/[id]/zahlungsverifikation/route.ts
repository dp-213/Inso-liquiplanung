import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * GET /api/cases/[id]/zahlungsverifikation
 *
 * STUB - Feature noch nicht implementiert
 *
 * TODO: Zahlungsverifikation in Datenbank implementieren
 * - Vergleich SOLL (Annahmen) vs. IST (Kontobewegungen)
 * - Abweichungsanalyse
 * - Automatische Alerts bei großen Abweichungen
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
      message: "Zahlungsverifikation wird in einer zukünftigen Version verfügbar sein",
      data: null,
    });
  } catch (error) {
    console.error("Fehler beim Laden der Zahlungsverifikation:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Fehler beim Laden der Verifikationsdaten",
      },
      { status: 500 }
    );
  }
}
