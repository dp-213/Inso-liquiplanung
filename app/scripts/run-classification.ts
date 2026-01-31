/**
 * Script: Klassifikation auf bestehende Einträge anwenden
 *
 * Wendet alle aktiven ClassificationRules auf UNREVIEWED Einträge an.
 * Setzt suggestedServiceDate/Period basierend auf den Regeln.
 *
 * Ausführung: npx tsx scripts/run-classification.ts
 */

import { PrismaClient } from '@prisma/client';
import { classifyBatch } from '../src/lib/classification/engine';

const prisma = new PrismaClient();

const CASE_NUMBER = '70d IN 362/25';

async function runClassification() {
  console.log('='.repeat(60));
  console.log('KLASSIFIKATION: Regeln auf Einträge anwenden');
  console.log('='.repeat(60));

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
  const unreviewedCount = await prisma.ledgerEntry.count({
    where: {
      caseId: hvplusCase.id,
      reviewStatus: 'UNREVIEWED',
    },
  });

  const withoutServiceDateCount = await prisma.ledgerEntry.count({
    where: {
      caseId: hvplusCase.id,
      reviewStatus: 'UNREVIEWED',
      suggestedServiceDate: null,
      suggestedServicePeriodStart: null,
    },
  });

  console.log(`\n2. Status vor Klassifikation:`);
  console.log(`   UNREVIEWED Einträge gesamt: ${unreviewedCount}`);
  console.log(`   Davon ohne ServiceDate-Vorschlag: ${withoutServiceDateCount}`);

  // 3. Run classification
  console.log('\n3. Führe Klassifikation aus...');

  // Lade alle UNREVIEWED entries ohne existierenden Vorschlag
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      caseId: hvplusCase.id,
      reviewStatus: 'UNREVIEWED',
    },
    select: { id: true },
  });

  const entryIds = entries.map(e => e.id);
  console.log(`   Verarbeite ${entryIds.length} Einträge...`);

  const result = await classifyBatch(prisma, hvplusCase.id, entryIds);

  // 4. Summary
  console.log('\n' + '='.repeat(60));
  console.log('KLASSIFIKATION ABGESCHLOSSEN');
  console.log('='.repeat(60));
  console.log(`
Klassifiziert:      ${result.classified}
Unverändert:        ${result.unchanged}
Fehler:             ${result.errors}
`);

  // 5. Check new service date suggestions
  const withServiceDateAfter = await prisma.ledgerEntry.count({
    where: {
      caseId: hvplusCase.id,
      reviewStatus: 'UNREVIEWED',
      OR: [
        { suggestedServiceDate: { not: null } },
        { suggestedServicePeriodStart: { not: null } },
      ],
    },
  });

  console.log(`Einträge mit ServiceDate-Vorschlag: ${withServiceDateAfter}`);
  console.log(`\nNächster Schritt: Im Ledger "ServiceDate-Vorschläge" Button klicken`);
}

runClassification()
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
