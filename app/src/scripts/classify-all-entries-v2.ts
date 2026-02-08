import prisma from '../lib/db';
import { matchCounterpartyPatterns } from '../lib/classification/engine';

async function classifyAll() {
  const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

  // Lade ALLE IST-Einträge ohne counterpartyId (inkl. CONFIRMED)
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      counterpartyId: null,
    },
    select: { id: true },
  });

  console.log(`\n=== CLASSIFICATION: ${entries.length} IST-Einträge ohne counterpartyId ===\n`);

  // Führe Pattern-Matching mit expliziten IDs aus (umgeht reviewStatus-Filter)
  console.log('Führe matchCounterpartyPatterns() aus...\n');

  const result = await matchCounterpartyPatterns(
    prisma,
    caseId,
    entries.map(e => e.id) // Explizite IDs übergeben
  );

  console.log(`\n=== ERGEBNIS ===`);
  console.log(`Matched:  ${result.matched} Einträge haben nun suggestedCounterpartyId`);
  console.log(`Skipped:  ${result.skipped} Einträge ohne Match`);
  console.log(`Errors:   ${result.errors} Fehler`);

  // Zeige Statistik nach Counterparty
  const withSuggestions = await prisma.ledgerEntry.groupBy({
    by: ['suggestedCounterpartyId'],
    where: {
      caseId,
      valueType: 'IST',
      suggestedCounterpartyId: { not: null },
    },
    _count: true,
  });

  console.log(`\n=== VORSCHLÄGE NACH COUNTERPARTY ===`);
  for (const group of withSuggestions) {
    const cp = await prisma.counterparty.findUnique({
      where: { id: group.suggestedCounterpartyId! },
      select: { name: true },
    });
    console.log(`${cp?.name || group.suggestedCounterpartyId}: ${group._count} Einträge`);
  }

  await prisma.$disconnect();
}

classifyAll().catch(console.error);
