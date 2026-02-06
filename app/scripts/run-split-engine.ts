/**
 * Script: Split-Engine für Alt/Neu-Masse-Zuordnung
 *
 * Wendet die Split-Engine auf alle LedgerEntries mit suggestedServiceDate an.
 * Berechnet estateAllocation (ALTMASSE/NEUMASSE/MIXED) basierend auf Leistungsdatum.
 *
 * Ausführung: npx tsx scripts/run-split-engine.ts
 */

import { PrismaClient } from '@prisma/client';
import { determineEstateAllocation } from '../src/lib/settlement/split-engine';

const prisma = new PrismaClient();

const CASE_NUMBER = '70d IN 362/25';
const CUTOFF_DATE = new Date('2025-10-29T00:00:00Z'); // Insolvenzeröffnung
const DRY_RUN = false;

async function runSplitEngine() {
  console.log('='.repeat(60));
  console.log('SPLIT ENGINE: Alt/Neu-Masse-Zuordnung');
  console.log('='.repeat(60));
  console.log(`Stichtag: ${CUTOFF_DATE.toISOString().slice(0, 10)}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

  // 1. Find Case
  console.log('\n1. Suche Case...');
  const hvplusCase = await prisma.case.findFirst({
    where: { caseNumber: CASE_NUMBER },
  });

  if (!hvplusCase) {
    console.error(`   FEHLER: Case ${CASE_NUMBER} nicht gefunden.`);
    process.exit(1);
  }
  console.log(`   Case: ${hvplusCase.debtorName} (${hvplusCase.id})`);

  // 2. Count entries
  const totalCount = await prisma.ledgerEntry.count({
    where: { caseId: hvplusCase.id },
  });

  const withServiceDateCount = await prisma.ledgerEntry.count({
    where: {
      caseId: hvplusCase.id,
      OR: [
        { suggestedServiceDate: { not: null } },
        { suggestedServicePeriodStart: { not: null } },
      ],
    },
  });

  const unklarCount = await prisma.ledgerEntry.count({
    where: {
      caseId: hvplusCase.id,
      OR: [{ estateAllocation: null }, { estateAllocation: 'UNKLAR' }],
    },
  });

  console.log(`\n2. Status vor Split:`);
  console.log(`   Gesamt Einträge: ${totalCount}`);
  console.log(`   Mit ServiceDate-Vorschlag: ${withServiceDateCount}`);
  console.log(`   Estate UNKLAR/null: ${unklarCount}`);

  // 3. Load entries with suggested service dates
  console.log('\n3. Verarbeite Einträge mit ServiceDate...');

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      caseId: hvplusCase.id,
      OR: [
        { suggestedServiceDate: { not: null } },
        { suggestedServicePeriodStart: { not: null } },
      ],
    },
    select: {
      id: true,
      transactionDate: true,
      suggestedServiceDate: true,
      suggestedServicePeriodStart: true,
      suggestedServicePeriodEnd: true,
      estateAllocation: true,
    },
  });

  console.log(`   Gefunden: ${entries.length} Einträge`);

  // 4. Apply Split Engine
  let updated = 0;
  let skipped = 0;
  const stats = {
    ALTMASSE: 0,
    NEUMASSE: 0,
    MIXED: 0,
    UNKLAR: 0,
  };

  for (const entry of entries) {
    // Skip if already has allocation (nicht UNKLAR/null)
    if (entry.estateAllocation && entry.estateAllocation !== 'UNKLAR') {
      skipped++;
      continue;
    }

    // Apply Split Engine
    const result = determineEstateAllocation(
      {
        transactionDate: entry.transactionDate,
        serviceDate: entry.suggestedServiceDate,
        servicePeriodStart: entry.suggestedServicePeriodStart,
        servicePeriodEnd: entry.suggestedServicePeriodEnd,
      },
      null, // counterpartyConfig - TODO: load from DB if needed
      CUTOFF_DATE
    );

    stats[result.estateAllocation]++;

    if (!DRY_RUN) {
      await prisma.ledgerEntry.update({
        where: { id: entry.id },
        data: {
          estateAllocation: result.estateAllocation,
          estateRatio: result.estateRatio,
          allocationSource: result.allocationSource,
          allocationNote: result.allocationNote,
        },
      });
    }

    updated++;
  }

  // 5. Summary
  console.log('\n' + '='.repeat(60));
  console.log('SPLIT ENGINE ABGESCHLOSSEN');
  console.log('='.repeat(60));
  console.log(`
Verarbeitet:  ${updated}
Übersprungen: ${skipped}

Estate Allocation:
  ALTMASSE:   ${stats.ALTMASSE}
  NEUMASSE:   ${stats.NEUMASSE}
  MIXED:      ${stats.MIXED}
  UNKLAR:     ${stats.UNKLAR}
`);

  // 6. Final status
  if (!DRY_RUN) {
    const finalUnklar = await prisma.ledgerEntry.count({
      where: {
        caseId: hvplusCase.id,
        OR: [{ estateAllocation: null }, { estateAllocation: 'UNKLAR' }],
      },
    });

    console.log(`Verbleibend UNKLAR/null: ${finalUnklar}`);
    console.log(`\nNächster Schritt: Manuelle Review der UNKLAR-Einträge im Ledger`);
  } else {
    console.log('\n⚠️  DRY RUN - No data written');
    console.log('   Set DRY_RUN = false to apply changes');
  }
}

runSplitEngine()
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
