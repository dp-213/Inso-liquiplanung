import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

async function analyzeClassification() {
  // 1. Klassifizierungs-Matrix
  const matrix = await prisma.$queryRaw<any[]>`
    SELECT
      CASE
        WHEN counterpartyId IS NULL THEN 'Keine_Counterparty'
        ELSE 'Hat_Counterparty'
      END as cp_status,
      CASE
        WHEN estateAllocation IS NULL THEN 'Keine_Allocation'
        ELSE estateAllocation
      END as allocation_status,
      CASE
        WHEN locationId IS NULL THEN 'Keine_Location'
        ELSE 'Hat_Location'
      END as location_status,
      COUNT(*) as count,
      ROUND(SUM(amountCents) / 100.0, 2) as total_amount
    FROM ledger_entries
    WHERE caseId = ${caseId} AND valueType = 'IST'
    GROUP BY cp_status, allocation_status, location_status
    ORDER BY count DESC;
  `;

  console.log('\n=== Klassifizierungs-Matrix (IST-Entries) ===\n');
  console.log('CP_Status        | Allocation     | Location         | Anzahl | Betrag EUR');
  console.log('-----------------|----------------|------------------|--------|------------');
  for (const row of matrix) {
    console.log(
      `${row.cp_status.padEnd(16)} | ${row.allocation_status.padEnd(14)} | ${row.location_status.padEnd(16)} | ${String(row.count).padStart(6)} | ${String(row.total_amount).padStart(10)}`
    );
  }

  // 2. Unklassifizierte nach Kategorie
  const categories = await prisma.$queryRaw<any[]>`
    SELECT
      CASE
        WHEN description LIKE '%LANR%' OR description LIKE '%BSNR%' THEN 'HZV/KV (LANR/BSNR)'
        WHEN description LIKE '%PVS%' OR description LIKE '%Privat%' THEN 'PVS/Privatpatienten'
        WHEN description LIKE '%Miete%' OR description LIKE '%Betriebs%' OR description LIKE '%Neben%' THEN 'Betriebskosten (Miete/NK)'
        WHEN description LIKE '%Gehalt%' OR description LIKE '%Lohn%' OR description LIKE '%Personal%' THEN 'Personal'
        WHEN description LIKE '%apoBank%' OR description LIKE '%Sparkasse%' OR description LIKE '%Überweisung%' OR description LIKE '%umgebuchtes%' THEN 'Bank-Transfers'
        WHEN description LIKE '%Steuer%' THEN 'Steuern'
        WHEN description LIKE '%Versicherung%' THEN 'Versicherungen'
        ELSE 'Sonstige'
      END as kategorie,
      COUNT(*) as anzahl,
      ROUND(SUM(amountCents) / 100.0, 2) as summe,
      ROUND(AVG(amountCents) / 100.0, 2) as durchschnitt
    FROM ledger_entries
    WHERE caseId = ${caseId}
      AND valueType = 'IST'
      AND (counterpartyId IS NULL OR estateAllocation IS NULL OR locationId IS NULL)
    GROUP BY kategorie
    ORDER BY anzahl DESC;
  `;

  console.log('\n=== Unklassifizierte Entries nach Kategorie ===\n');
  console.log('Kategorie                     | Anzahl | Summe EUR  | Ø EUR');
  console.log('------------------------------|--------|------------|--------');
  for (const row of categories) {
    console.log(
      `${row.kategorie.padEnd(30)} | ${String(row.anzahl).padStart(6)} | ${String(row.summe).padStart(10)} | ${String(row.durchschnitt).padStart(6)}`
    );
  }

  // 3. Privatpatienten-Details
  const privatpatienten = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      OR: [
        { description: { contains: 'PVS' } },
        { description: { contains: 'Privat' } },
      ],
    },
    include: {
      counterparty: {
        select: { name: true, shortName: true }
      }
    },
    take: 20
  });

  console.log('\n=== Privatpatienten-Entries (erste 20) ===\n');
  for (const entry of privatpatienten) {
    const date = new Date(entry.transactionDate).toISOString().split('T')[0];
    const cp = entry.counterparty?.name || 'NULL';
    const ea = entry.estateAllocation || 'NULL';
    const loc = entry.locationId ? 'Ja' : 'Nein';
    const amountEur = (Number(entry.amountCents) / 100).toFixed(2);
    console.log(`${date} | ${String(amountEur).padStart(10)} EUR | CP: ${cp.substring(0, 20).padEnd(20)} | EA: ${ea.padEnd(10)} | Loc: ${loc}`);
    console.log(`   Tag: ${entry.categoryTag || 'NULL'}`);
    console.log(`   ${entry.description.substring(0, 80)}`);
  }

  await prisma.$disconnect();
}

analyzeClassification().catch(console.error);
