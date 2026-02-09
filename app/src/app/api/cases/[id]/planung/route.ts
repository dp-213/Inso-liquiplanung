import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";

// GET /api/cases/[id]/planung - Planungsdaten für IV-Darstellung
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const { id: caseId } = await params;

    // Prüfe ob Fall existiert
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        plans: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!caseData) {
      return NextResponse.json({ error: "Fall nicht gefunden" }, { status: 404 });
    }

    // Lade echte Planungsdaten aus casePlanning Tabelle
    const casePlanning = await prisma.casePlanning.findFirst({
      where: { caseId: caseId },
    });

    if (!casePlanning) {
      return NextResponse.json({
        error: "Keine Planungsdaten vorhanden",
        hint: "Bitte erstellen Sie zuerst eine Liquiditätsplanung"
      }, { status: 404 });
    }

    // Parse planningData JSON
    let planungData;
    try {
      planungData = JSON.parse(casePlanning.planningData);
    } catch (parseError) {
      console.error("Fehler beim Parsen der Planungsdaten:", parseError);
      return NextResponse.json({
        error: "Ungültige Planungsdaten",
        details: "Die Planungsdaten konnten nicht gelesen werden"
      }, { status: 500 });
    }

    // Transformiere abweichungen_zur_iv_planung in erwartetes Format
    if (planungData.abweichungen_zur_iv_planung) {
      planungData.abweichungen_zur_iv_planung = planungData.abweichungen_zur_iv_planung.map((abw: any) => ({
        position: abw.position,
        iv: abw.iv_wert || abw.iv || 0,
        korrigiert: abw.dashboard_wert || abw.korrigiert || 0,
        differenz: abw.differenz || 0,
        prozent: abw.iv_wert !== 0
          ? ((abw.differenz || 0) / Math.abs(abw.iv_wert || 1)) * 100
          : 0,
        begruendung: abw.begründung || abw.begruendung || "",
      }));
    }

    return NextResponse.json({ data: planungData });
  } catch (error) {
    console.error("Fehler beim Laden der Planung:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
