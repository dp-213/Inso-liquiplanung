import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

async function analyzeMissingFields() {
  // 1. Gesamt-Übersicht
  const total = await prisma.ledgerEntry.count({
    where: { caseId, valueType: 'IST' }
  });

  const missingCP = await prisma.ledgerEntry.count({
    where: { caseId, valueType: 'IST', counterpartyId: null }
  });

  const missingEA = await prisma.ledgerEntry.count({
    where: { caseId, valueType: 'IST', estateAllocation: null }
  });

  const missingLoc = await prisma.ledgerEntry.count({
    where: { caseId, valueType: 'IST', locationId: null }
  });

  const missingAny = await prisma.ledgerEntry.count({
    where: {
      caseId,
      valueType: 'IST',
      OR: [
        { counterpartyId: null },
        { estateAllocation: null },
        { locationId: null }
      ]
    }
  });

  const fullyClassified = await prisma.ledgerEntry.count({
    where: {
      caseId,
      valueType: 'IST',
      counterpartyId: { not: null },
      estateAllocation: { not: null },
      locationId: { not: null }
    }
  });

  console.log('\n=== Gesamt-Übersicht IST-Entries ===\n');
  console.log(`Gesamt Entries:                ${total}`);
  console.log(`Vollständig klassifiziert:     ${fullyClassified} (${((fullyClassified/total)*100).toFixed(1)}%)`);
  console.log(`Mit fehlendem Feld:            ${missingAny} (${((missingAny/total)*100).toFixed(1)}%)`);
  console.log(`  - Fehlt Counterparty:        ${missingCP}`);
  console.log(`  - Fehlt Estate Allocation:   ${missingEA}`);
  console.log(`  - Fehlt Location:            ${missingLoc}`);

  // 2. Was fehlt genau? (Kombinationen)
  const combinations = await prisma.$queryRaw<any[]>`
    SELECT
      CASE WHEN counterpartyId IS NULL THEN 1 ELSE 0 END as missing_cp,
      CASE WHEN estateAllocation IS NULL THEN 1 ELSE 0 END as missing_ea,
      CASE WHEN locationId IS NULL THEN 1 ELSE 0 END as missing_loc,
      COUNT(*) as count,
      ROUND(SUM(amountCents) / 100.0, 2) as total_amount
    FROM ledger_entries
    WHERE caseId = ${caseId} AND valueType = 'IST'
    GROUP BY missing_cp, missing_ea, missing_loc
    ORDER BY count DESC;
  `;

  console.log('\n=== Fehlende Felder (Kombinationen) ===\n');
  console.log('CP | EA | Loc | Anzahl | Betrag EUR');
  console.log('---|----|----|--------|------------');
  for (const row of combinations) {
    const cp = row.missing_cp ? '✗' : '✓';
    const ea = row.missing_ea ? '✗' : '✓';
    const loc = row.missing_loc ? '✗' : '✓';
    console.log(` ${cp} | ${ea}  | ${loc}  | ${String(row.count).padStart(6)} | ${String(row.total_amount).padStart(10)}`);
  }

  // 3. Nur Entries mit fehlendem CP nach Kategorie
  const missingCPByCategory = await prisma.$queryRaw<any[]>`
    SELECT
      CASE
        WHEN description LIKE '%LANR%' OR description LIKE '%BSNR%' THEN 'HZV/KV (LANR/BSNR)'
        WHEN description LIKE '%PVS%' OR description LIKE '%Privat%' THEN 'PVS/Privatpatienten'
        WHEN description LIKE '%Miete%' OR description LIKE '%Betriebs%' OR description LIKE '%Neben%' THEN 'Betriebskosten'
        WHEN description LIKE '%Gehalt%' OR description LIKE '%Lohn%' OR description LIKE '%Personal%' THEN 'Personal'
        WHEN description LIKE '%Bank%' OR description LIKE '%Überweisung%' OR description LIKE '%umgebuchtes%' THEN 'Bank-Transfers'
        ELSE 'Sonstige'
      END as kategorie,
      COUNT(*) as anzahl,
      ROUND(SUM(amountCents) / 100.0, 2) as summe
    FROM ledger_entries
    WHERE caseId = ${caseId}
      AND valueType = 'IST'
      AND counterpartyId IS NULL
    GROUP BY kategorie
    ORDER BY anzahl DESC;
  `;

  console.log('\n=== Entries ohne Counterparty (nach Kategorie) ===\n');
  console.log('Kategorie                     | Anzahl | Summe EUR');
  console.log('------------------------------|--------|------------');
  for (const row of missingCPByCategory) {
    console.log(`${row.kategorie.padEnd(30)} | ${String(row.anzahl).padStart(6)} | ${String(row.summe).padStart(10)}`);
  }

  // 4. Nur Entries mit fehlendem EA nach Kategorie
  const missingEAByCategory = await prisma.$queryRaw<any[]>`
    SELECT
      CASE
        WHEN description LIKE '%LANR%' OR description LIKE '%BSNR%' THEN 'HZV/KV (LANR/BSNR)'
        WHEN description LIKE '%PVS%' OR description LIKE '%Privat%' THEN 'PVS/Privatpatienten'
        WHEN description LIKE '%Miete%' OR description LIKE '%Betriebs%' OR description LIKE '%Neben%' THEN 'Betriebskosten'
        WHEN description LIKE '%Gehalt%' OR description LIKE '%Lohn%' OR description LIKE '%Personal%' THEN 'Personal'
        WHEN description LIKE '%Bank%' OR description LIKE '%Überweisung%' OR description LIKE '%umgebuchtes%' THEN 'Bank-Transfers'
        ELSE 'Sonstige'
      END as kategorie,
      COUNT(*) as anzahl,
      ROUND(SUM(amountCents) / 100.0, 2) as summe
    FROM ledger_entries
    WHERE caseId = ${caseId}
      AND valueType = 'IST'
      AND estateAllocation IS NULL
    GROUP BY kategorie
    ORDER BY anzahl DESC;
  `;

  console.log('\n=== Entries ohne Estate Allocation (nach Kategorie) ===\n');
  console.log('Kategorie                     | Anzahl | Summe EUR');
  console.log('------------------------------|--------|------------');
  for (const row of missingEAByCategory) {
    console.log(`${row.kategorie.padEnd(30)} | ${String(row.anzahl).padStart(6)} | ${String(row.summe).padStart(10)}`);
  }

  // 5. Beispiele für Entries ohne CP
  const examplesNoCP = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      counterpartyId: null
    },
    orderBy: { transactionDate: 'desc' },
    take: 10
  });

  console.log('\n=== Beispiele: Entries ohne Counterparty (neueste 10) ===\n');
  for (const entry of examplesNoCP) {
    const date = new Date(entry.transactionDate).toISOString().split('T')[0];
    const amountEur = (Number(entry.amountCents) / 100).toFixed(2);
    const ea = entry.estateAllocation || 'NULL';
    const loc = entry.locationId ? 'Ja' : 'Nein';
    console.log(`${date} | ${String(amountEur).padStart(10)} EUR | EA: ${ea.padEnd(10)} | Loc: ${loc}`);
    console.log(`   ${entry.description.substring(0, 90)}`);
  }

  await prisma.$disconnect();
}

analyzeMissingFields().catch(console.error);
