/**
 * Analysiere HZV-Entries ohne Quartals-Pattern
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

function extractQuarterFromDescription(description: string): boolean {
  const quarterPattern = /Q([1-4])\/(\d{2})/i;
  return quarterPattern.test(description);
}

async function analyzeUnmatched() {
  console.log('=== ANALYSE: HZV-ENTRIES OHNE QUARTALS-PATTERN ===\n');

  const hzvEntries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      OR: [
        { description: { contains: 'HZV' } },
        { description: { contains: 'HÄVG' } },
        { description: { contains: 'HAEVG' } }
      ]
    },
    select: {
      id: true,
      transactionDate: true,
      amountCents: true,
      description: true
    }
  });

  const unmatched = hzvEntries.filter(e => !extractQuarterFromDescription(e.description));

  console.log(`Unmatched Entries: ${unmatched.length}\n`);

  // Gruppiere nach Beschreibungs-Pattern
  const patterns = new Map<string, number>();

  for (const entry of unmatched) {
    // Extrahiere ersten Teil der Beschreibung (bis zu 50 Zeichen)
    const pattern = entry.description.substring(0, 50).trim();
    patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
  }

  console.log('## Häufigste Patterns:\n');

  const sortedPatterns = Array.from(patterns.entries()).sort((a, b) => b[1] - a[1]);

  for (const [pattern, count] of sortedPatterns.slice(0, 20)) {
    console.log(`   ${count}x | ${pattern}...`);
  }

  console.log('\n## Alle Unmatched Entries:\n');

  for (const entry of unmatched) {
    const date = entry.transactionDate.toISOString().substring(0, 10);
    const amount = (Number(entry.amountCents) / 100).toFixed(2);
    console.log(`   ${date} | ${amount.padStart(10)} EUR | ${entry.description}`);
  }

  await prisma.$disconnect();
}

analyzeUnmatched().catch(console.error);
