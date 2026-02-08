import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

async function completeVerification() {
  console.log('=== VOLLSTÄNDIGE VERIFIKATION ===\n');

  const total = await prisma.ledgerEntry.count({
    where: { caseId, valueType: 'IST' }
  });

  const nullCP = await prisma.ledgerEntry.count({
    where: { caseId, valueType: 'IST', counterpartyId: null }
  });

  const nullEA = await prisma.ledgerEntry.count({
    where: { caseId, valueType: 'IST', estateAllocation: null }
  });

  const nullLoc = await prisma.ledgerEntry.count({
    where: { caseId, valueType: 'IST', locationId: null }
  });

  const hasCP = total - nullCP;
  const hasEA = total - nullEA;
  const hasLoc = total - nullLoc;

  console.log(`Total IST-Entries: ${total}\n`);
  console.log('Feld                  | Mit Wert | NULL | % Klassifiziert');
  console.log('----------------------|----------|------|----------------');
  console.log(`Counterparty          | ${String(hasCP).padStart(8)} | ${String(nullCP).padStart(4)} | ${((hasCP/total)*100).toFixed(1).padStart(5)}%`);
  console.log(`Estate Allocation     | ${String(hasEA).padStart(8)} | ${String(nullEA).padStart(4)} | ${((hasEA/total)*100).toFixed(1).padStart(5)}%`);
  console.log(`Location              | ${String(hasLoc).padStart(8)} | ${String(nullLoc).padStart(4)} | ${((hasLoc/total)*100).toFixed(1).padStart(5)}%`);

  // Vollständig klassifiziert (alle 3 Felder)
  const fullyClassified = await prisma.ledgerEntry.count({
    where: {
      caseId,
      valueType: 'IST',
      counterpartyId: { not: null },
      estateAllocation: { not: null },
      locationId: { not: null }
    }
  });

  console.log(`\nVollständig klassifiziert (alle 3): ${fullyClassified} (${((fullyClassified/total)*100).toFixed(1)}%)`);

  // Estate Allocation Verteilung (nur für nicht-NULL)
  console.log('\n## Estate Allocation Verteilung (ohne NULL)\n');

  const eaDist = await prisma.$queryRaw<any[]>`
    SELECT
      estateAllocation,
      COUNT(*) as count,
      ROUND(SUM(amountCents) / 100.0, 2) as total
    FROM ledger_entries
    WHERE caseId = ${caseId}
      AND valueType = 'IST'
      AND estateAllocation IS NOT NULL
    GROUP BY estateAllocation
    ORDER BY count DESC;
  `;

  for (const row of eaDist) {
    console.log(`${row.estateAllocation.padEnd(15)} | ${String(row.count).padStart(6)} | ${String(row.total).padStart(12)} EUR`);
  }

  // Beispiele für NULL estateAllocation
  console.log('\n## Beispiele: Entries mit NULL estateAllocation\n');

  const nullExamples = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      estateAllocation: null
    },
    orderBy: { transactionDate: 'desc' },
    take: 10,
    include: {
      counterparty: { select: { name: true } },
      location: { select: { name: true } }
    }
  });

  for (const entry of nullExamples) {
    const date = new Date(entry.transactionDate).toISOString().split('T')[0];
    const amount = (Number(entry.amountCents) / 100).toFixed(2);
    const cp = entry.counterparty?.name || 'NULL';
    const loc = entry.location?.name || 'NULL';
    console.log(`${date} | ${String(amount).padStart(10)} EUR | CP: ${cp.substring(0, 25).padEnd(25)} | Loc: ${loc.substring(0, 15)}`);
    console.log(`   ${entry.description.substring(0, 80)}`);
  }

  // Locations-Fehler prüfen
  console.log('\n## LANR-Locations: Sind sie KORREKT zugeordnet?\n');

  const lanrChecks = [
    { lanr: '3892462', arzt: 'van Suntum', soll: 'Velbert' },
    { lanr: '8836735', arzt: 'Beyer', soll: 'Velbert' },
    { lanr: '7729639', arzt: 'Kamler', soll: 'Velbert' },
    { lanr: '8898288', arzt: 'Rösing', soll: 'Eitorf' },
  ];

  for (const check of lanrChecks) {
    const entry = await prisma.ledgerEntry.findFirst({
      where: {
        caseId,
        description: { contains: `LANR ${check.lanr}` }
      },
      include: {
        location: { select: { name: true } }
      }
    });

    if (entry?.location) {
      const isCorrect = entry.location.name.includes(check.soll);
      const status = isCorrect ? '✅' : '❌';
      console.log(`${status} LANR ${check.lanr} (${check.arzt}) → Soll: ${check.soll}, Ist: ${entry.location.name}`);
    }
  }

  await prisma.$disconnect();
}

completeVerification().catch(console.error);
