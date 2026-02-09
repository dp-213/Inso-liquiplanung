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

    const plan = caseData.plans[0];
    if (!plan) {
      return NextResponse.json({ error: "Kein aktiver Plan vorhanden" }, { status: 404 });
    }

    // Mock-Daten für Planungsdarstellung
    // TODO: Echte Daten aus Datenbank oder Case-spezifischer JSON laden
    const planungData = {
      titel: `Liquiditätsplanung ${caseData.debtorName}`,
      version: "1.0",
      datum: new Date().toLocaleDateString("de-DE"),
      basis: "Basierend auf IST-Daten und Planungsannahmen",
      methodik: "11-Monatsplanung mit Alt/Neu-Masse-Trennung",
      annahmen: [
        {
          id: "A01",
          titel: "KV-Abschläge",
          beschreibung: "Monatliche Abschlagszahlungen der KV",
          quelle: "Historische Daten",
          status: "VERIFIZIERT",
        },
        {
          id: "A02",
          titel: "HZV-Zahlungen",
          beschreibung: "Monatliche HZV-Pauschalen",
          quelle: "Verträge",
          status: "ÜBERNOMMEN",
        },
      ],
      offene_fragen: [
        {
          id: "F01",
          frage: "Detaillierte Aufschlüsselung der Personalkosten erforderlich",
          dringlichkeit: "MITTEL",
          zustaendig: "IV",
        },
      ],
      monate: Array.from({ length: 11 }, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() + i);
        const monatName = date.toLocaleDateString("de-DE", { month: "short", year: "numeric" });

        return {
          monat: `M${i + 1}`,
          monat_name: monatName,
          einnahmen: {
            umsatz: {
              gesamt: 100000 + Math.random() * 20000,
              kv_velbert: 40000,
              hzv_velbert: 30000,
              pvs_velbert: 10000,
              kv_uckerath: 15000,
              hzv_uckerath: 5000,
              pvs_uckerath: 0,
            },
            altforderungen: 0,
            insolvenzspezifisch: 0,
            gesamt: 100000 + Math.random() * 20000,
          },
          ausgaben: {
            personal: {
              gesamt: 60000 + Math.random() * 10000,
            },
            betrieblich: 20000 + Math.random() * 5000,
            insolvenzspezifisch: 5000,
            gesamt: 85000 + Math.random() * 15000,
          },
          saldo: 15000 + Math.random() * 10000,
          anmerkungen: i === 0 ? ["Erster Monat nach Insolvenzeröffnung"] : undefined,
        };
      }),
      zusammenfassung: {
        gesamteinnahmen: 1100000,
        gesamtausgaben: 935000,
        nettosaldo: 165000,
        kritische_monate: [],
      },
      abweichungen_zur_iv_planung: [
        {
          position: "KV-Einnahmen",
          iv: 500000,
          korrigiert: 550000,
          differenz: 50000,
          prozent: 10.0,
          begruendung: "Aktualisierte Patientenzahlen",
        },
      ],
    };

    return NextResponse.json({ data: planungData });
  } catch (error) {
    console.error("Fehler beim Laden der Planung:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
