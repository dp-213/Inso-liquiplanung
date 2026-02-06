/**
 * Script: Bulk-Accept von Classification-Vorschlägen
 *
 * Übernimmt suggested* Felder in finale Felder und setzt reviewStatus auf CONFIRMED.
 * Nur für Einträge mit hohem Confidence Score (> 0.7).
 *
 * Ausführung: npx tsx scripts/bulk-accept-suggestions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CASE_NUMBER = '70d IN 362/25';
const MIN_CONFIDENCE = 0.7; // Nur Vorschläge >= 70% Confidence akzeptieren
const DRY_RUN = false;

async function bulkAcceptSuggestions() {
  console.log('='.repeat(60));
  console.log('BULK ACCEPT: Classification-Vorschläge übernehmen');
  console.log('='.repeat(60));
  console.log(`Min. Confidence: ${MIN_CONFIDENCE}`);
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

  // 2. Count entries with suggestions
  const withSuggestionsCount = await prisma.ledgerEntry.count({
    where: {
      caseId: hvplusCase.id,
      reviewStatus: 'UNREVIEWED',
      OR: [
        { suggestedCategoryTag: { not: null } },
        { suggestedCounterpartyId: { not: null } },
        { suggestedLocationId: { not: null } },
        { suggestedServiceDate: { not: null } },
      ],
    },
  });

  console.log(`\n2. Status:`);
  console.log(`   UNREVIEWED mit Vorschlägen: ${withSuggestionsCount}`);

  // 3. Load entries
  console.log('\n3. Lade Einträge...');
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      caseId: hvplusCase.id,
      reviewStatus: 'UNREVIEWED',
      OR: [
        { suggestedCategoryTag: { not: null } },
        { suggestedCounterpartyId: { not: null } },
        { suggestedLocationId: { not: null } },
        { suggestedServiceDate: { not: null } },
      ],
    },
    select: {
      id: true,
      suggestedCategoryTag: true,
      suggestedCounterpartyId: true,
      suggestedLocationId: true,
      suggestedServiceDate: true,
      suggestedServicePeriodStart: true,
      suggestedServicePeriodEnd: true,
      suggestedConfidence: true,
    },
  });

  console.log(`   Gefunden: ${entries.length} Einträge`);

  // 4. Accept suggestions
  let accepted = 0;
  let skippedLowConfidence = 0;

  for (const entry of entries) {
    // Skip if confidence too low
    if (entry.suggestedConfidence !== null && entry.suggestedConfidence < MIN_CONFIDENCE) {
      skippedLowConfidence++;
      continue;
    }

    const updateData: any = {
      reviewStatus: 'CONFIRMED',
      reviewedBy: 'bulk-accept-script',
      reviewedAt: new Date(),
    };

    // Copy suggested fields to final fields
    if (entry.suggestedCategoryTag) {
      updateData.categoryTag = entry.suggestedCategoryTag;
      updateData.categoryTagSource = 'AUTO';
    }

    if (entry.suggestedCounterpartyId) {
      updateData.counterpartyId = entry.suggestedCounterpartyId;
    }

    if (entry.suggestedLocationId) {
      updateData.locationId = entry.suggestedLocationId;
    }

    if (entry.suggestedServiceDate) {
      updateData.serviceDate = entry.suggestedServiceDate;
    }

    if (entry.suggestedServicePeriodStart) {
      updateData.servicePeriodStart = entry.suggestedServicePeriodStart;
    }

    if (entry.suggestedServicePeriodEnd) {
      updateData.servicePeriodEnd = entry.suggestedServicePeriodEnd;
    }

    if (!DRY_RUN) {
      await prisma.ledgerEntry.update({
        where: { id: entry.id },
        data: updateData,
      });
    }

    accepted++;
  }

  // 5. Summary
  console.log('\n' + '='.repeat(60));
  console.log('BULK ACCEPT ABGESCHLOSSEN');
  console.log('='.repeat(60));
  console.log(`
Akzeptiert:               ${accepted}
Übersprungen (Confidence): ${skippedLowConfidence}
`);

  // 6. Final status
  if (!DRY_RUN) {
    const confirmedCount = await prisma.ledgerEntry.count({
      where: {
        caseId: hvplusCase.id,
        reviewStatus: 'CONFIRMED',
      },
    });

    const unreviewedCount = await prisma.ledgerEntry.count({
      where: {
        caseId: hvplusCase.id,
        reviewStatus: 'UNREVIEWED',
      },
    });

    console.log(`Status nach Bulk Accept:`);
    console.log(`  CONFIRMED:  ${confirmedCount}`);
    console.log(`  UNREVIEWED: ${unreviewedCount}`);
    console.log(`\nNächster Schritt: Manuelle Review der verbleibenden UNREVIEWED-Einträge`);
  } else {
    console.log('\n⚠️  DRY RUN - No data written');
    console.log('   Set DRY_RUN = false to apply changes');
  }
}

bulkAcceptSuggestions()
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
