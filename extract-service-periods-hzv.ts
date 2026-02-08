/**
 * Service-Period-Extraktion für HZV-Entries (ERWEITERT)
 *
 * Extrahiert Quartalsinformationen aus der Beschreibung und setzt
 * servicePeriodStart + servicePeriodEnd
 *
 * Pattern:
 * - Q1/25 → 2025-01-01 bis 2025-03-31
 * - Q2/25 → 2025-04-01 bis 2025-06-30
 * - Q3/25 → 2025-07-01 bis 2025-09-30
 * - Q4/25 → 2025-10-01 bis 2025-12-31
 * - REST Q3/25, ABS. Q4/25-1, etc. → gleiche Mapping
 *
 * SONDERFALL: Januar 2026 HZV ABS ohne Quartalsangabe
 * ANNAHME: Q4/2025-Abschläge (abgeleitet aus Zahlungslogik-Analyse)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

// Quartal → Zeitraum Mapping
function getQuarterDates(quarter: number, year: number): { start: Date; end: Date } {
  const fullYear = year < 100 ? 2000 + year : year;

  switch (quarter) {
    case 1:
      return {
        start: new Date(`${fullYear}-01-01T00:00:00.000Z`),
        end: new Date(`${fullYear}-03-31T23:59:59.999Z`)
      };
    case 2:
      return {
        start: new Date(`${fullYear}-04-01T00:00:00.000Z`),
        end: new Date(`${fullYear}-06-30T23:59:59.999Z`)
      };
    case 3:
      return {
        start: new Date(`${fullYear}-07-01T00:00:00.000Z`),
        end: new Date(`${fullYear}-09-30T23:59:59.999Z`)
      };
    case 4:
      return {
        start: new Date(`${fullYear}-10-01T00:00:00.000Z`),
        end: new Date(`${fullYear}-12-31T23:59:59.999Z`)
      };
    default:
      throw new Error(`Ungültiges Quartal: ${quarter}`);
  }
}

// Pattern-Matching für Quartal aus Beschreibung (ERWEITERT)
function extractQuarterFromDescription(
  description: string,
  transactionDate: Date
): { quarter: number; year: number; source: string } | null {
  // Pattern: Q1/25, Q2/25, Q3/25, Q4/25
  // Auch: REST Q3/25, ABS. Q4/25-1, HZV Q3/25, etc.
  const quarterPattern = /Q([1-4])\/(\d{2})/i;
  const match = description.match(quarterPattern);

  if (match) {
    const quarter = parseInt(match[1], 10);
    const year = parseInt(match[2], 10);
    return { quarter, year, source: 'DESCRIPTION_PATTERN' };
  }

  // SONDERFALL: Januar 2026 HZV ABS ohne Quartalsangabe
  // ANNAHME: Q4/2025-Abschläge (Fortsetzung)
  // Begründung: Siehe IV-Notiz + Zahlungslogik-Analyse (08.02.2026)
  if (
    transactionDate.getFullYear() === 2026 &&
    transactionDate.getMonth() === 0 && // Januar = Monat 0
    description.includes('HZV ABS') &&
    !description.match(/Q[1-4]\/\d{2}/i) // Keine Quartalsangabe
  ) {
    return { quarter: 4, year: 25, source: 'PAYMENT_LOGIC_INFERENCE' };
  }

  return null;
}

async function extractServicePeriods(dryRun: boolean = true) {
  console.log('=== SERVICE-PERIOD-EXTRAKTION FÜR HZV (ERWEITERT) ===\n');
  console.log(`Modus: ${dryRun ? '🔍 DRY RUN (Test)' : '💾 LIVE (Datenbank-Update)'}\n`);

  // 1. Alle HZV-Entries laden (ohne Pega-Ausgaben)
  const hzvEntries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      OR: [
        { description: { contains: 'HZV' } },
        { description: { contains: 'HÄVG' } },
        { description: { contains: 'HAEVG' } }
      ],
      amountCents: { gt: 0 }, // Nur Einnahmen (filtert Pega-Ausgaben raus)
      NOT: {
        description: { contains: 'Pega' } // Explizit ausschließen
      }
    },
    orderBy: { transactionDate: 'asc' },
    select: {
      id: true,
      transactionDate: true,
      amountCents: true,
      description: true,
      servicePeriodStart: true,
      servicePeriodEnd: true
    }
  });

  console.log(`📊 Gefundene HZV-Entries: ${hzvEntries.length}\n`);

  // 2. Statistik: Wie viele haben bereits Service-Period?
  const withServicePeriod = hzvEntries.filter(e => e.servicePeriodStart !== null).length;
  const withoutServicePeriod = hzvEntries.length - withServicePeriod;

  console.log(`   Mit Service-Period: ${withServicePeriod}`);
  console.log(`   Ohne Service-Period: ${withoutServicePeriod}\n`);

  // 3. Pattern-Matching & Extraktion
  console.log('## Pattern-Extraktion\n');

  let matched = 0;
  let notMatched = 0;
  let inferredFromPaymentLogic = 0;

  const updates: Array<{
    id: string;
    description: string;
    quarter: number;
    year: number;
    servicePeriodStart: Date;
    servicePeriodEnd: Date;
    source: string;
  }> = [];

  for (const entry of hzvEntries) {
    const quarterInfo = extractQuarterFromDescription(entry.description, entry.transactionDate);

    if (quarterInfo) {
      const dates = getQuarterDates(quarterInfo.quarter, quarterInfo.year);
      updates.push({
        id: entry.id,
        description: entry.description,
        quarter: quarterInfo.quarter,
        year: quarterInfo.year + 2000,
        servicePeriodStart: dates.start,
        servicePeriodEnd: dates.end,
        source: quarterInfo.source
      });
      matched++;

      if (quarterInfo.source === 'PAYMENT_LOGIC_INFERENCE') {
        inferredFromPaymentLogic++;
      }
    } else {
      notMatched++;
      if (notMatched <= 3) {
        console.log(`   ⚠️ Kein Pattern gefunden: ${entry.description.substring(0, 60)}...`);
      }
    }
  }

  console.log(`\n   ✅ Pattern gefunden: ${matched}`);
  console.log(`      ├─ Aus Beschreibung: ${matched - inferredFromPaymentLogic}`);
  console.log(`      └─ Aus Zahlungslogik abgeleitet: ${inferredFromPaymentLogic}`);
  console.log(`   ❌ Kein Pattern: ${notMatched}`);

  // 4. Zeige Beispiele
  console.log('\n## Beispiel-Extraktion (erste 5 + erste 5 Januar)\n');

  const regularExamples = updates.filter(u => u.source === 'DESCRIPTION_PATTERN').slice(0, 5);
  const inferredExamples = updates.filter(u => u.source === 'PAYMENT_LOGIC_INFERENCE').slice(0, 5);

  console.log('   Von Beschreibung extrahiert:\n');
  for (const update of regularExamples) {
    const startStr = update.servicePeriodStart.toISOString().substring(0, 10);
    const endStr = update.servicePeriodEnd.toISOString().substring(0, 10);
    console.log(`      Q${update.quarter}/${update.year} | ${startStr} - ${endStr} | ${update.description.substring(0, 50)}`);
  }

  if (inferredExamples.length > 0) {
    console.log('\n   Aus Zahlungslogik abgeleitet:\n');
    for (const update of inferredExamples) {
      const startStr = update.servicePeriodStart.toISOString().substring(0, 10);
      const endStr = update.servicePeriodEnd.toISOString().substring(0, 10);
      console.log(`      Q${update.quarter}/${update.year} | ${startStr} - ${endStr} | ${update.description.substring(0, 50)}`);
    }
  }

  // 5. Gruppierung nach Quartal + Quelle
  console.log('\n## Verteilung nach Quartal\n');

  const byQuarter = updates.reduce((acc, u) => {
    const key = `Q${u.quarter}/${u.year}`;
    if (!acc[key]) {
      acc[key] = { total: 0, fromDescription: 0, fromPaymentLogic: 0 };
    }
    acc[key].total++;
    if (u.source === 'DESCRIPTION_PATTERN') {
      acc[key].fromDescription++;
    } else {
      acc[key].fromPaymentLogic++;
    }
    return acc;
  }, {} as Record<string, { total: number; fromDescription: number; fromPaymentLogic: number }>);

  for (const [quarter, counts] of Object.entries(byQuarter).sort()) {
    const paymentLogicStr = counts.fromPaymentLogic > 0 ? ` (davon ${counts.fromPaymentLogic} abgeleitet)` : '';
    console.log(`   ${quarter}: ${counts.total} Entries${paymentLogicStr}`);
  }

  // 6. Update ausführen (falls nicht Dry-Run)
  if (!dryRun) {
    console.log('\n## 💾 Datenbank-Update\n');

    let updateCount = 0;
    for (const update of updates) {
      await prisma.ledgerEntry.update({
        where: { id: update.id },
        data: {
          servicePeriodStart: update.servicePeriodStart,
          servicePeriodEnd: update.servicePeriodEnd,
          allocationSource: update.source === 'PAYMENT_LOGIC_INFERENCE'
            ? 'SERVICE_PERIOD_EXTRACTION_PAYMENT_LOGIC'
            : 'SERVICE_PERIOD_EXTRACTION',
          allocationNote: update.source === 'PAYMENT_LOGIC_INFERENCE'
            ? 'Januar 2026 HZV ABS ohne Quartalsangabe → Q4/2025 abgeleitet aus Zahlungslogik-Analyse (08.02.2026)'
            : `Service-Period extrahiert aus Beschreibung: Q${update.quarter}/${update.year}`
        }
      });
      updateCount++;

      if (updateCount % 50 === 0) {
        console.log(`   Fortschritt: ${updateCount}/${updates.length}`);
      }
    }

    console.log(`\n   ✅ ${updateCount} Entries aktualisiert!`);
    console.log(`      ├─ allocationSource gesetzt`);
    console.log(`      └─ allocationNote dokumentiert`);
  } else {
    console.log('\n## 🔍 DRY RUN - Keine Datenbank-Änderungen\n');
    console.log(`   Würde ${updates.length} Entries aktualisieren`);
    console.log(`   Davon ${inferredFromPaymentLogic} mit Zahlungslogik-Ableitung\n`);
    console.log(`   ➡️ Führe Script erneut aus mit: npx tsx extract-service-periods-hzv.ts --live`);
  }

  await prisma.$disconnect();
}

// CLI-Argument prüfen
const isLive = process.argv.includes('--live');

extractServicePeriods(!isLive).catch((error) => {
  console.error('\n❌ FEHLER bei Service-Period-Extraktion:');
  console.error(error);
  process.exit(1);
});
