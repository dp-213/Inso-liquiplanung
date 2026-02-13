/**
 * Update HVPlus Dashboard - Befüllt alle Dashboard-relevanten Daten
 *
 * Basierend auf case-context.json:
 * - LiquidityPlan: Aug 2025 - Aug 2026 (13 Monate)
 * - BankAccounts: ISK Velbert, ISK Uckerath, Sparkasse, apoBank
 * - estateAllocation: Nach dokumentierten Regeln
 * - reviewStatus: IST-Daten auf CONFIRMED
 * - Assumptions: Dokumentierte Prämissen
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CASE_ID = '2982ff26-081a-4811-8e1e-46b39e1ff757';
const PLAN_ID = '753ec26c-c7a6-4394-857f-bf1ebd1eccfd';

// Stichtag für Alt/Neu-Masse: 29.10.2025
const STICHTAG = new Date('2025-10-29');

async function main() {
  console.log('=== UPDATE HVPLUS DASHBOARD ===\n');

  // =====================================================
  // 1. Update LiquidityPlan: Aug 2025 - Aug 2026 (13 Monate)
  // =====================================================
  console.log('1. Update LiquidityPlan...');
  await prisma.liquidityPlan.update({
    where: { id: PLAN_ID },
    data: {
      name: 'Liquiditätsplanung Aug 2025 - Aug 2026',
      planStartDate: new Date('2025-08-01'),
      periodType: 'MONTHLY',
      periodCount: 13,
      description: 'Vollständige Liquiditätsplanung inkl. Pre-Insolvenz-Vergleich',
    }
  });
  console.log('   Plan: Aug 2025 - Aug 2026 (13 Monate, MONTHLY)');

  // =====================================================
  // 2. Update/Create BankAccounts mit echten Daten
  // =====================================================
  console.log('\n2. Update BankAccounts...');

  // Lösche alte placeholder BankAccounts
  await prisma.bankAccount.deleteMany({
    where: { caseId: CASE_ID }
  });

  // ISK Velbert (BW-Bank)
  await prisma.bankAccount.create({
    data: {
      id: 'ba-isk-velbert',
      caseId: CASE_ID,
      bankName: 'BW-Bank (LBBW)',
      accountName: 'ISK Velbert',
      iban: 'DE87600501010400080228',
      openingBalanceCents: BigInt(8977500), // 89.775,00 € (Stand 30.12.2025)
      securityHolder: null, // Keine Sicherungsrechte auf ISK
      status: 'ACTIVE',
      notes: 'Insolvenzsonderkonto Velbert - erhält Sparkasse-Auskehrungen',
      displayOrder: 1,
      createdBy: 'update-hvplus-dashboard',
      updatedBy: 'update-hvplus-dashboard',
    }
  });

  // ISK Uckerath (BW-Bank)
  await prisma.bankAccount.create({
    data: {
      id: 'ba-isk-uckerath',
      caseId: CASE_ID,
      bankName: 'BW-Bank (LBBW)',
      accountName: 'ISK Uckerath',
      iban: 'DE91600501010400080156',
      openingBalanceCents: BigInt(38944400), // 389.444,00 € (Stand 30.12.2025)
      securityHolder: null,
      status: 'ACTIVE',
      notes: 'Insolvenzsonderkonto Uckerath - Hauptkonto für HZV-Zahlungen',
      displayOrder: 2,
      createdBy: 'update-hvplus-dashboard',
      updatedBy: 'update-hvplus-dashboard',
    }
  });

  // Sparkasse Velbert (mit Sicherungsrechten)
  await prisma.bankAccount.create({
    data: {
      id: 'ba-sparkasse-velbert',
      caseId: CASE_ID,
      bankName: 'Sparkasse Hilden-Ratingen-Velbert',
      accountName: 'Geschäftskonto Velbert',
      iban: null, // Konto 34379768
      openingBalanceCents: BigInt(2064474), // 20.644,74 € Saldo
      securityHolder: 'Sparkasse HRV',
      status: 'SECURED',
      notes: JSON.stringify({
        kontonummer: '34379768',
        darlehen: [
          { bezeichnung: 'DL-368 Gründung & Wachstum', betrag: 230000, restschuld: 205135 },
          { bezeichnung: 'DL-376 Universalkredit', betrag: 300000 }
        ],
        sicherheiten: [
          'Abtretung KV-Vergütungsansprüche (nur Velbert)',
          'Abtretung Außenständen',
          'Mietaval Nr. 7020566159'
        ],
        massekreditVertrag: true,
        fortfuehrungsbeitrag: '10% zzgl. USt der eingezogenen Altforderungen'
      }),
      displayOrder: 3,
      createdBy: 'update-hvplus-dashboard',
      updatedBy: 'update-hvplus-dashboard',
    }
  });

  // apoBank (mit Abtretung, KEINE Vereinbarung!)
  await prisma.bankAccount.create({
    data: {
      id: 'ba-apobank-uckerath',
      caseId: CASE_ID,
      bankName: 'Deutsche Apotheker- und Ärztebank',
      accountName: 'Geschäftskonto Uckerath+Eitorf',
      iban: null,
      openingBalanceCents: BigInt(0),
      securityHolder: 'apoBank',
      status: 'DISPUTED',
      notes: JSON.stringify({
        darlehensvertrag: '2021611755-8818923',
        abtretungAnzeige: '2024-07-25',
        klarstellung: '2025-03-21',
        status: 'KEINE Vereinbarung!',
        problem: 'Blockiert KV-Auszahlungen für Uckerath/Eitorf',
        betroffeneStandorte: ['Uckerath', 'Eitorf']
      }),
      displayOrder: 4,
      createdBy: 'update-hvplus-dashboard',
      updatedBy: 'update-hvplus-dashboard',
    }
  });

  console.log('   ISK Velbert: 89.775,00 €');
  console.log('   ISK Uckerath: 389.444,00 €');
  console.log('   Sparkasse (gesichert): 20.644,74 €');
  console.log('   apoBank (DISPUTED): keine Vereinbarung');

  // =====================================================
  // 3. Update estateAllocation basierend auf Regeln
  // =====================================================
  console.log('\n3. Update estateAllocation (Alt/Neu-Masse)...');

  // Hole alle LedgerEntries
  const entries = await prisma.ledgerEntry.findMany({
    where: { caseId: CASE_ID }
  });

  let altCount = 0, neuCount = 0, unklarCount = 0;

  for (const entry of entries) {
    let estateAllocation: string | null = null;
    let estateRatio: number | null = null;
    let allocationSource: string | null = null;
    let allocationNote: string | null = null;

    const desc = entry.description.toLowerCase();
    const transDate = new Date(entry.transactionDate);

    // Regel 1: IST-Daten mit explizitem Leistungszeitraum
    if (entry.valueType === 'IST') {
      // HZV: Zahlung im Monat M = Leistung Monat M-1
      if (desc.includes('hzv') || desc.includes('havg')) {
        // Extrahiere Leistungsmonat aus Beschreibung wenn möglich
        const monthMatch = desc.match(/(oktober|november|dezember|januar|februar|märz|april|mai|juni|juli|august|september)\s*(\d{4})?/i);
        if (monthMatch) {
          const monthMap: Record<string, number> = {
            'januar': 0, 'februar': 1, 'märz': 2, 'april': 3, 'mai': 4, 'juni': 5,
            'juli': 6, 'august': 7, 'september': 8, 'oktober': 9, 'november': 10, 'dezember': 11
          };
          const monthIdx = monthMap[monthMatch[1].toLowerCase()];
          const year = monthMatch[2] ? parseInt(monthMatch[2]) : (monthIdx >= 8 ? 2025 : 2026);
          const leistungsDate = new Date(year, monthIdx, 15);

          if (leistungsDate < STICHTAG) {
            // Oktober 2025: 28/31 Alt, 3/31 Neu (Stichtag 29.10.)
            if (monthIdx === 9 && year === 2025) {
              estateAllocation = 'MIXED';
              estateRatio = 28 / 31; // 90% Alt
              allocationSource = 'MASSEKREDITVERTRAG';
              allocationNote = 'HZV Okt 2025: 28/31 Alt, 3/31 Neu (Stichtag 29.10.)';
            } else {
              estateAllocation = 'ALTMASSE';
              allocationSource = 'LEISTUNGSDATUM';
              allocationNote = `Leistung ${monthMatch[0]} vor Stichtag`;
            }
          } else {
            estateAllocation = 'NEUMASSE';
            allocationSource = 'LEISTUNGSDATUM';
            allocationNote = `Leistung ${monthMatch[0]} nach Stichtag`;
          }
        }
      }

      // KV: Quartals-basiert
      if (desc.includes('kv') || desc.includes('kvno')) {
        const qMatch = desc.match(/q([1-4])[\s\/\-]*(20)?(\d{2})/i);
        if (qMatch) {
          const quarter = parseInt(qMatch[1]);
          const year = 2000 + parseInt(qMatch[3]);
          const quarterEndMonth = quarter * 3;
          const quarterEnd = new Date(year, quarterEndMonth, 0);

          if (quarterEnd < STICHTAG) {
            estateAllocation = 'ALTMASSE';
            allocationSource = 'LEISTUNGSDATUM';
            allocationNote = `KV Q${quarter}/${year} komplett vor Stichtag`;
          } else if (quarter === 4 && year === 2025) {
            // Q4/2025: 1/3 Alt (Okt), 2/3 Neu (Nov+Dez)
            estateAllocation = 'MIXED';
            estateRatio = 1 / 3;
            allocationSource = 'MASSEKREDITVERTRAG';
            allocationNote = 'KV Q4/2025: 1/3 Alt (Okt), 2/3 Neu (Nov+Dez)';
          } else {
            estateAllocation = 'NEUMASSE';
            allocationSource = 'LEISTUNGSDATUM';
            allocationNote = `KV Q${quarter}/${year} nach Stichtag`;
          }
        }
      }

      // PVS: Nach Behandlungsdatum - meist unklar
      if (desc.includes('pvs') || desc.includes('privat')) {
        if (!estateAllocation) {
          estateAllocation = 'UNKLAR';
          allocationSource = 'MANUELL_PRUEFEN';
          allocationNote = 'PVS: Behandlungsdatum nicht aus Kontoauszug ableitbar';
        }
      }
    }

    // Regel 2: PLAN-Daten
    if (entry.valueType === 'PLAN') {
      // Altforderungen explizit ALTMASSE
      if (desc.includes('altforderung')) {
        estateAllocation = 'ALTMASSE';
        allocationSource = 'FACHLICH_KLAR';
        allocationNote = 'Explizit als Altforderung gekennzeichnet';
      }
      // Insolvenz-spezifisch = NEUMASSE
      else if (desc.includes('inso') || desc.includes('insolvenz')) {
        estateAllocation = 'NEUMASSE';
        allocationSource = 'FACHLICH_KLAR';
        allocationNote = 'Insolvenz-spezifische Position (nach Eröffnung)';
      }
      // Reguläre PLAN-Einnahmen: Nach Leistungszeitraum wenn bekannt
      else if (transDate > STICHTAG) {
        estateAllocation = 'NEUMASSE';
        allocationSource = 'LEISTUNGSDATUM';
        allocationNote = 'PLAN für Zeitraum nach Stichtag';
      } else if (transDate < STICHTAG) {
        estateAllocation = 'ALTMASSE';
        allocationSource = 'LEISTUNGSDATUM';
        allocationNote = 'PLAN für Zeitraum vor Stichtag';
      }
    }

    // Fallback: Unbekannt = UNKLAR
    if (!estateAllocation) {
      estateAllocation = 'UNKLAR';
      allocationSource = 'KEINE_REGEL';
      allocationNote = 'Keine automatische Zuordnung möglich';
    }

    // Update entry
    await prisma.ledgerEntry.update({
      where: { id: entry.id },
      data: {
        estateAllocation,
        estateRatio,
        allocationSource,
        allocationNote,
      }
    });

    if (estateAllocation === 'ALTMASSE') altCount++;
    else if (estateAllocation === 'NEUMASSE') neuCount++;
    else unklarCount++;
  }

  console.log(`   ALTMASSE: ${altCount}`);
  console.log(`   NEUMASSE: ${neuCount}`);
  console.log(`   UNKLAR: ${unklarCount}`);

  // =====================================================
  // 4. Update reviewStatus: IST-Daten auf CONFIRMED
  // =====================================================
  console.log('\n4. Update reviewStatus...');

  // IST-Daten bestätigen (aus echten Kontoauszügen)
  const istUpdated = await prisma.ledgerEntry.updateMany({
    where: {
      caseId: CASE_ID,
      valueType: 'IST',
      reviewStatus: 'UNREVIEWED'
    },
    data: {
      reviewStatus: 'CONFIRMED'
    }
  });
  console.log(`   IST-Daten bestätigt: ${istUpdated.count}`);

  // Annahmen bleiben UNREVIEWED (müssen vom IV bestätigt werden)
  const annahmenCount = await prisma.ledgerEntry.count({
    where: {
      caseId: CASE_ID,
      valueType: 'PLAN',
      importSource: { contains: 'Annahme' }
    }
  });
  console.log(`   Annahmen bleiben UNREVIEWED: ${annahmenCount}`);

  // =====================================================
  // 5. Create/Update Assumptions (Prämissen)
  // =====================================================
  console.log('\n5. Update Prämissen...');

  // Lösche alte Assumptions
  await prisma.planningAssumption.deleteMany({
    where: { planId: PLAN_ID }
  });

  const assumptions = [
    {
      categoryName: 'Alt/Neu-Masse',
      source: 'Massekreditvertrag',
      description: 'Stichtag 29.10.2025 - KV Q4/2025: 1/3 Alt, 2/3 Neu | HZV Okt: 28/31 Alt, 3/31 Neu',
      riskLevel: 'CONFIRMED'
    },
    {
      categoryName: 'Sicherungsrechte',
      source: 'Massekreditvertrag Sparkasse',
      description: 'Nur Velbert-Neuforderungen als Sicherheit abgetreten (§4(1)). Uckerath/Eitorf nicht betroffen.',
      riskLevel: 'CONFIRMED'
    },
    {
      categoryName: 'apoBank',
      source: 'IV-Kommunikation',
      description: 'KEINE Vereinbarung mit apoBank! Blockiert KV-Auszahlungen für Uckerath/Eitorf - Risiko für Liquidität.',
      riskLevel: 'HIGH'
    },
    {
      categoryName: 'HZV-Zahlungsfluss',
      source: 'Kontoauszüge BW-Bank',
      description: 'Alle HZV-Zahlungen (auch Velbert) gehen auf ISK Uckerath (400080156). Interne Verrechnung.',
      riskLevel: 'LOW'
    },
    {
      categoryName: 'KV-Zahlungstermine',
      source: 'KVNO Zahlungstermine 2025/2026',
      description: 'Abschläge monatlich (10./15./17.), Restzahlungen Mitte Folgequartal.',
      riskLevel: 'LOW'
    },
    {
      categoryName: 'PVS-Zuordnung',
      source: 'Massekreditvertrag §1(2)c',
      description: 'Alt/Neu nach Behandlungsdatum - aus Kontoauszug NICHT ableitbar. Einzelfallprüfung nötig.',
      riskLevel: 'MEDIUM'
    },
    {
      categoryName: 'Timeline',
      source: 'IV-Gespräch',
      description: 'Ende Q1/2026: Praxen-Übergabe. April 2026: Altforderungen abgeschlossen. Aug 2026: Bankabrechnung.',
      riskLevel: 'LOW'
    },
    {
      categoryName: 'Massekredit',
      source: 'Massekreditvertrag',
      description: 'Max. 137.000 € | Fortführungsbeitrag 10% zzgl. USt der eingezogenen Altforderungen | Laufzeit bis 31.08.2026',
      riskLevel: 'LOW'
    }
  ];

  for (const a of assumptions) {
    await prisma.planningAssumption.create({
      data: {
        caseId: CASE_ID,
        title: a.categoryName,
        source: a.source,
        description: a.description,
        status: a.riskLevel === 'CONFIRMED' ? 'VERIFIZIERT' : 'ANNAHME',
        createdBy: 'update-hvplus-dashboard',
        updatedBy: 'update-hvplus-dashboard',
      }
    });
  }
  console.log(`   ${assumptions.length} Planungsannahmen angelegt`);

  // =====================================================
  // 6. Summary
  // =====================================================
  console.log('\n=== UPDATE ABGESCHLOSSEN ===\n');

  const finalStats = await prisma.ledgerEntry.groupBy({
    by: ['valueType', 'reviewStatus', 'estateAllocation'],
    where: { caseId: CASE_ID },
    _count: { id: true }
  });

  console.log('Finale Statistik:');
  console.log('---');
  finalStats.forEach(s => {
    console.log(`${s.valueType} | ${s.reviewStatus} | ${s.estateAllocation || 'NULL'}: ${s._count.id}`);
  });

  console.log('\nDashboard-URL:');
  console.log(`http://localhost:3000/admin/cases/${CASE_ID}/results`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
