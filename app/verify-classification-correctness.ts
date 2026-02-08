import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';
const cutoffDate = new Date('2025-10-29T00:00:00.000Z');

async function verifyClassification() {
  console.log('=== VERIFIKATION: Ist Klassifizierung KORREKT? ===\n');

  // 1. Prüfe HZV-Zahlungen: LANR → Location korrekt?
  console.log('## 1. HZV-Zahlungen: LANR → Location Mapping\n');

  const lanrMappings = {
    '1445587': { arzt: 'Binas', expectedLocation: 'Uckerath' },
    '3243603': { arzt: 'Fischer', expectedLocation: 'Uckerath' },
    '4652451': { arzt: 'Ludwig', expectedLocation: 'Uckerath' },
    '1203618': { arzt: 'Schweitzer', expectedLocation: 'Uckerath' },
    '8898288': { arzt: 'Rösing', expectedLocation: 'Eitorf' },
    '3892462': { arzt: 'van Suntum', expectedLocation: 'Velbert' },
    '8836735': { arzt: 'Beyer', expectedLocation: 'Velbert' },
    '7729639': { arzt: 'Kamler', expectedLocation: 'Velbert' }
  };

  for (const [lanr, expected] of Object.entries(lanrMappings)) {
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        caseId,
        valueType: 'IST',
        description: { contains: `LANR ${lanr}` }
      },
      include: {
        location: { select: { name: true } }
      },
      take: 5
    });

    if (entries.length > 0) {
      const wrongLocation = entries.filter(e =>
        !e.location?.name.includes(expected.expectedLocation)
      );

      const status = wrongLocation.length === 0 ? '✅' : '❌';
      console.log(`${status} LANR ${lanr} (${expected.arzt} → ${expected.expectedLocation})`);
      console.log(`   Gefunden: ${entries.length} Entries`);
      if (entries[0].location) {
        console.log(`   Location: ${entries[0].location.name}`);
      } else {
        console.log(`   Location: NULL`);
      }

      if (wrongLocation.length > 0) {
        console.log(`   ⚠️ ${wrongLocation.length} mit falscher Location!`);
      }
    }
  }

  // 2. Prüfe estateRatio bei MIXED
  console.log('\n## 2. Estate Ratio bei MIXED-Entries\n');

  const mixedEntries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      estateAllocation: 'MIXED',
      estateRatio: { not: null }
    },
    select: {
      description: true,
      transactionDate: true,
      servicePeriodStart: true,
      servicePeriodEnd: true,
      estateRatio: true,
      allocationSource: true,
      amountCents: true
    },
    take: 10
  });

  console.log(`Gefunden: ${mixedEntries.length} MIXED Entries mit estateRatio\n`);

  for (const entry of mixedEntries.slice(0, 5)) {
    const desc = entry.description.substring(0, 50);
    const ratio = entry.estateRatio;
    const source = entry.allocationSource;
    const amount = (Number(entry.amountCents) / 100).toFixed(2);

    // Erwartete Ratio für HZV Oktober: 3/31 = 0.0968
    const expectedHZVOktober = 0.0968;
    const isHZV = entry.description.includes('HZV') || entry.description.includes('HAEVG');
    const isOktober = entry.servicePeriodStart?.getMonth() === 9; // Oktober = Monat 9

    let status = '?';
    const ratioNum = typeof ratio === 'number' ? ratio : Number(ratio);
    if (isHZV && isOktober && Math.abs(ratioNum - expectedHZVOktober) < 0.001) {
      status = '✅';
    } else if (isHZV && isOktober) {
      status = '❌';
    } else {
      status = '⚠️';
    }

    console.log(`${status} Ratio: ${ratio ? Number(ratio).toFixed(4) : 'N/A'} | ${amount} EUR | ${source}`);
    console.log(`   ${desc}`);
    if (entry.servicePeriodStart && entry.servicePeriodEnd) {
      const start = entry.servicePeriodStart.toISOString().split('T')[0];
      const end = entry.servicePeriodEnd.toISOString().split('T')[0];
      console.log(`   Service Period: ${start} → ${end}`);
    }
  }

  // 3. Prüfe KV Q4/2025: 1/3 Alt, 2/3 Neu
  console.log('\n## 3. KV Q4/2025 Regel (1/3 Alt, 2/3 Neu)\n');

  const kvQ4 = await prisma.$queryRaw<any[]>`
    SELECT
      estateAllocation,
      COUNT(*) as count,
      ROUND(SUM(amountCents) / 100.0, 2) as total
    FROM ledger_entries
    WHERE caseId = ${caseId}
      AND valueType = 'IST'
      AND (description LIKE '%KV%' OR description LIKE '%Nordrhein%' OR description LIKE '%KVNO%')
      AND transactionDate >= ${new Date('2025-10-01').getTime()}
      AND transactionDate < ${new Date('2026-01-01').getTime()}
      AND estateAllocation IS NOT NULL
    GROUP BY estateAllocation;
  `;

  if (kvQ4.length > 0) {
    console.log('KV-Zahlungen Q4/2025:\n');
    let altTotal = 0;
    let neuTotal = 0;

    for (const row of kvQ4) {
      console.log(`${row.estateAllocation}: ${row.count} Entries, ${row.total} EUR`);
      if (row.estateAllocation === 'ALTMASSE') altTotal = row.total;
      if (row.estateAllocation === 'NEUMASSE') neuTotal = row.total;
    }

    const totalKV = altTotal + neuTotal;
    if (totalKV > 0) {
      const neuRatio = neuTotal / totalKV;
      const expectedRatio = 2/3;
      const diff = Math.abs(neuRatio - expectedRatio);
      const status = diff < 0.05 ? '✅' : '❌';

      console.log(`\n${status} Neumasse-Anteil: ${(neuRatio * 100).toFixed(1)}% (Soll: 66.7%)`);
      console.log(`   Abweichung: ${(diff * 100).toFixed(1)} Prozentpunkte`);
    }
  } else {
    console.log('Keine KV-Einnahmen in Q4/2025 gefunden.');
  }

  // 4. Prüfe ALTMASSE vs NEUMASSE nach Transaktionsdatum
  console.log('\n## 4. Alt/Neu-Zuordnung nach Transaktionsdatum\n');

  const wrongDateAllocation = await prisma.$queryRaw<any[]>`
    SELECT
      description,
      transactionDate,
      estateAllocation,
      servicePeriodStart,
      servicePeriodEnd
    FROM ledger_entries
    WHERE caseId = ${caseId}
      AND valueType = 'IST'
      AND estateAllocation IS NOT NULL
      AND (
        (transactionDate < ${cutoffDate.getTime()} AND estateAllocation = 'NEUMASSE' AND servicePeriodEnd IS NULL)
        OR
        (transactionDate >= ${cutoffDate.getTime()} AND estateAllocation = 'ALTMASSE' AND servicePeriodStart IS NULL)
      )
    LIMIT 10;
  `;

  if (wrongDateAllocation.length > 0) {
    console.log(`❌ ${wrongDateAllocation.length} Entries mit möglicherweise falscher Alt/Neu-Zuordnung:\n`);

    for (const entry of wrongDateAllocation.slice(0, 5)) {
      const date = new Date(Number(entry.transactionDate)).toISOString().split('T')[0];
      const beforeCutoff = new Date(Number(entry.transactionDate)) < cutoffDate;
      console.log(`${entry.estateAllocation} | ${date} (${beforeCutoff ? 'vor' : 'nach'} Stichtag)`);
      console.log(`   ${entry.description.substring(0, 70)}`);
    }
  } else {
    console.log('✅ Keine offensichtlich falschen Alt/Neu-Zuordnungen gefunden.');
  }

  // 5. Prüfe allocationSource Distribution
  console.log('\n## 5. Allocation Source Distribution\n');

  const sourceDist = await prisma.$queryRaw<any[]>`
    SELECT
      allocationSource,
      COUNT(*) as count,
      ROUND(SUM(amountCents) / 100.0, 2) as total
    FROM ledger_entries
    WHERE caseId = ${caseId}
      AND valueType = 'IST'
      AND estateAllocation IS NOT NULL
    GROUP BY allocationSource
    ORDER BY count DESC;
  `;

  for (const row of sourceDist) {
    const source = row.allocationSource || 'NULL';
    console.log(`${source.padEnd(30)} | ${String(row.count).padStart(6)} | ${String(row.total).padStart(12)} EUR`);
  }

  await prisma.$disconnect();
}

verifyClassification().catch(console.error);
