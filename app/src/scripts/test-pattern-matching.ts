import prisma from '../lib/db';
import { matchCounterpartyPatterns } from '../lib/classification/engine';

async function test() {
  const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

  // Hole 10 IST-Einträge ohne counterpartyId
  const testEntries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      counterpartyId: null,
    },
    take: 10,
    select: { id: true, description: true },
  });

  console.log(`\n=== TEST: Pattern-Matching auf ${testEntries.length} Einträgen ===\n`);

  for (const entry of testEntries) {
    console.log(`${entry.id}: ${entry.description.substring(0, 60)}...`);
  }

  // Führe Pattern-Matching aus
  const result = await matchCounterpartyPatterns(
    prisma,
    caseId,
    testEntries.map(e => e.id)
  );

  console.log(`\n=== ERGEBNIS ===`);
  console.log(`Matched:  ${result.matched}`);
  console.log(`Skipped:  ${result.skipped}`);
  console.log(`Errors:   ${result.errors}`);

  // Zeige Vorschläge
  const withSuggestion = await prisma.ledgerEntry.findMany({
    where: {
      id: { in: testEntries.map(e => e.id) },
      suggestedCounterpartyId: { not: null },
    },
    include: {
      counterparty: { select: { name: true } },
    },
  });

  console.log(`\n=== VORSCHLÄGE (${withSuggestion.length}) ===`);
  for (const entry of withSuggestion) {
    console.log(`✓ ${entry.description.substring(0, 50)}...`);
    console.log(`  → suggestedCounterpartyId: ${entry.suggestedCounterpartyId}`);
    console.log(`  → Reason: ${entry.suggestedReason}`);
  }

  await prisma.$disconnect();
}

test().catch(console.error);
