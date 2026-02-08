/**
 * Split-Engine NEU auf alle HZV-Entries anwenden
 *
 * Mit korrekten Service-Periods:
 * - Q3/2025 → 100% ALTMASSE
 * - Q4/2025 → 1/3 ALTMASSE, 2/3 NEUMASSE (estateRatio = 0.6667)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';
const cutoffDate = new Date('2025-10-29T00:00:00.000Z');

// Q4/2025 Regel: 1/3 Alt, 2/3 Neu
const Q4_NEUMASSE_RATIO = 2/3; // 0.6667

function calculateEstateSplit(servicePeriodStart: Date | null): {
  estateAllocation: 'ALTMASSE' | 'NEUMASSE' | 'MIXED';
  estateRatio: number | null;
  allocationSource: string;
} {
  if (!servicePeriodStart) {
    return {
      estateAllocation: 'NEUMASSE', // Default für Entries ohne Service-Period
      estateRatio: null,
      allocationSource: 'NO_SERVICE_PERIOD_DEFAULT'
    };
  }

  const year = servicePeriodStart.getFullYear();
  const month = servicePeriodStart.getMonth(); // 0 = Januar, 9 = Oktober

  // Q3/2025 (Juli/Aug/Sep) → 100% ALTMASSE
  if (year === 2025 && month >= 6 && month <= 8) {
    return {
      estateAllocation: 'ALTMASSE',
      estateRatio: null,
      allocationSource: 'Q3_2025_BEFORE_CUTOFF'
    };
  }

  // Q4/2025 (Okt/Nov/Dez) → 1/3 Alt, 2/3 Neu
  if (year === 2025 && month >= 9 && month <= 11) {
    return {
      estateAllocation: 'MIXED',
      estateRatio: Q4_NEUMASSE_RATIO,
      allocationSource: 'Q4_2025_RULE_1_3_2_3'
    };
  }

  // Q1/Q2 2025 und früher → 100% ALTMASSE
  if (year < 2025 || (year === 2025 && month < 6)) {
    return {
      estateAllocation: 'ALTMASSE',
      estateRatio: null,
      allocationSource: 'BEFORE_Q3_2025'
    };
  }

  // Q1/2026 und später → 100% NEUMASSE
  if (year >= 2026) {
    return {
      estateAllocation: 'NEUMASSE',
      estateRatio: null,
      allocationSource: 'AFTER_Q4_2025'
    };
  }

  // Fallback
  return {
    estateAllocation: 'NEUMASSE',
    estateRatio: null,
    allocationSource: 'FALLBACK'
  };
}

async function rerunSplitEngine() {
  console.log('=== SPLIT-ENGINE NEU DURCHLAUFEN (HZV-ENTRIES) ===\n');
  console.log(`Cutoff-Date: ${cutoffDate.toISOString().substring(0, 10)}`);
  console.log(`Q4/2025-Regel: 1/3 Alt (${(1/3 * 100).toFixed(1)}%), 2/3 Neu (${(2/3 * 100).toFixed(1)}%)\n`);

  // 1. Alle HZV-Entries laden
  const hzvEntries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      OR: [
        { description: { contains: 'HZV' } },
        { description: { contains: 'HÄVG' } },
        { description: { contains: 'HAEVG' } }
      ],
      amountCents: { gt: 0 },
      NOT: { description: { contains: 'Pega' } }
    },
    select: {
      id: true,
      servicePeriodStart: true,
      servicePeriodEnd: true,
      amountCents: true,
      estateAllocation: true,
      estateRatio: true
    }
  });

  console.log(`📊 Gefundene HZV-Entries: ${hzvEntries.length}\n`);

  // 2. Statistik VORHER
  console.log('## Status VORHER\n');

  const beforeStats = {
    altmasse: 0,
    neumasse: 0,
    mixed: 0,
    unklar: 0
  };

  for (const entry of hzvEntries) {
    if (entry.estateAllocation === 'ALTMASSE') beforeStats.altmasse++;
    else if (entry.estateAllocation === 'NEUMASSE') beforeStats.neumasse++;
    else if (entry.estateAllocation === 'MIXED') beforeStats.mixed++;
    else beforeStats.unklar++;
  }

  console.log(`   ALTMASSE: ${beforeStats.altmasse}`);
  console.log(`   NEUMASSE: ${beforeStats.neumasse}`);
  console.log(`   MIXED: ${beforeStats.mixed}`);
  console.log(`   UNKLAR: ${beforeStats.unklar}`);

  // 3. Split-Engine anwenden
  console.log('\n## Split-Engine anwenden\n');

  let updateCount = 0;
  const changes: Array<{
    before: string;
    after: string;
    count: number;
  }> = [];

  for (const entry of hzvEntries) {
    const split = calculateEstateSplit(entry.servicePeriodStart);

    // Nur updaten wenn sich was ändert
    const changed =
      entry.estateAllocation !== split.estateAllocation ||
      entry.estateRatio !== split.estateRatio;

    if (changed) {
      await prisma.ledgerEntry.update({
        where: { id: entry.id },
        data: {
          estateAllocation: split.estateAllocation,
          estateRatio: split.estateRatio,
          allocationSource: split.allocationSource,
          allocationNote: `Split-Engine neu durchlaufen mit Service-Period-basierten Regeln (08.02.2026)`
        }
      });

      const beforeStr = `${entry.estateAllocation} (${entry.estateRatio || 'NULL'})`;
      const afterStr = `${split.estateAllocation} (${split.estateRatio || 'NULL'})`;

      const existingChange = changes.find(c => c.before === beforeStr && c.after === afterStr);
      if (existingChange) {
        existingChange.count++;
      } else {
        changes.push({ before: beforeStr, after: afterStr, count: 1 });
      }

      updateCount++;
    }

    if (updateCount % 50 === 0 && updateCount > 0) {
      console.log(`   Fortschritt: ${updateCount} Entries aktualisiert`);
    }
  }

  console.log(`\n   ✅ ${updateCount} Entries aktualisiert`);

  // 4. Zeige Änderungen
  if (changes.length > 0) {
    console.log('\n## Änderungen im Detail\n');
    for (const change of changes.sort((a, b) => b.count - a.count)) {
      console.log(`   ${change.count}x: ${change.before} → ${change.after}`);
    }
  }

  // 5. Statistik NACHHER
  console.log('\n## Status NACHHER\n');

  const updatedEntries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      OR: [
        { description: { contains: 'HZV' } },
        { description: { contains: 'HÄVG' } },
        { description: { contains: 'HAEVG' } }
      ],
      amountCents: { gt: 0 },
      NOT: { description: { contains: 'Pega' } }
    },
    select: {
      estateAllocation: true,
      estateRatio: true,
      servicePeriodStart: true,
      amountCents: true
    }
  });

  const afterStats = {
    altmasse: 0,
    neumasse: 0,
    mixed: 0,
    unklar: 0
  };

  let q3Total = 0;
  let q4Total = 0;

  for (const entry of updatedEntries) {
    if (entry.estateAllocation === 'ALTMASSE') afterStats.altmasse++;
    else if (entry.estateAllocation === 'NEUMASSE') afterStats.neumasse++;
    else if (entry.estateAllocation === 'MIXED') afterStats.mixed++;
    else afterStats.unklar++;

    // Gruppiere nach Quartal
    if (entry.servicePeriodStart) {
      const year = entry.servicePeriodStart.getFullYear();
      const month = entry.servicePeriodStart.getMonth();

      if (year === 2025 && month >= 6 && month <= 8) {
        q3Total++; // Q3/2025
      } else if (year === 2025 && month >= 9 && month <= 11) {
        q4Total++; // Q4/2025
      }
    }
  }

  console.log(`   ALTMASSE: ${afterStats.altmasse}`);
  console.log(`   NEUMASSE: ${afterStats.neumasse}`);
  console.log(`   MIXED: ${afterStats.mixed}`);
  console.log(`   UNKLAR: ${afterStats.unklar}`);

  console.log('\n## Verteilung nach Quartal\n');
  console.log(`   Q3/2025 (Juli-September): ${q3Total} Entries → 100% ALTMASSE`);
  console.log(`   Q4/2025 (Oktober-Dezember): ${q4Total} Entries → 1/3 Alt, 2/3 Neu (MIXED)`);

  // 6. Verifikation
  console.log('\n## Verifikation\n');

  const expectedQ3Alt = q3Total;
  const expectedQ4Mixed = q4Total;

  const actualQ3Alt = updatedEntries.filter(e => {
    if (!e.servicePeriodStart) return false;
    const year = e.servicePeriodStart.getFullYear();
    const month = e.servicePeriodStart.getMonth();
    return year === 2025 && month >= 6 && month <= 8 && e.estateAllocation === 'ALTMASSE';
  }).length;

  const actualQ4Mixed = updatedEntries.filter(e => {
    if (!e.servicePeriodStart) return false;
    const year = e.servicePeriodStart.getFullYear();
    const month = e.servicePeriodStart.getMonth();
    // Float-Vergleich mit Tolerance
    const ratioMatches = e.estateRatio !== null && Math.abs(e.estateRatio - Q4_NEUMASSE_RATIO) < 0.0001;
    return year === 2025 && month >= 9 && month <= 11 && e.estateAllocation === 'MIXED' && ratioMatches;
  }).length;

  console.log(`   Q3/2025 als ALTMASSE: ${actualQ3Alt}/${expectedQ3Alt} ${actualQ3Alt === expectedQ3Alt ? '✅' : '❌'}`);
  console.log(`   Q4/2025 als MIXED (2/3 Neu): ${actualQ4Mixed}/${expectedQ4Mixed} ${actualQ4Mixed === expectedQ4Mixed ? '✅' : '❌'}`);

  if (actualQ3Alt === expectedQ3Alt && actualQ4Mixed === expectedQ4Mixed) {
    console.log('\n✅ SPLIT-ENGINE ERFOLGREICH DURCHLAUFEN!\n');
  } else {
    console.log('\n⚠️ WARNUNG: Verifikation fehlgeschlagen!\n');
  }

  await prisma.$disconnect();
}

rerunSplitEngine().catch((error) => {
  console.error('\n❌ FEHLER bei Split-Engine:');
  console.error(error);
  process.exit(1);
});
