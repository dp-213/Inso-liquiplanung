/**
 * Analyse: KV und HZV Einnahmen im Detail
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

async function analyzeKvHzv() {
  console.log('=== KV & HZV EINNAHMEN ANALYSE ===\n');

  // 1. KV-Einnahmen
  console.log('## 1. KV-EINNAHMEN\n');

  const kvEntries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      description: { contains: 'KV' },
      amountCents: { gt: 0 } // Nur Einnahmen, keine Rückzahlungen
    },
    orderBy: { transactionDate: 'asc' },
    select: {
      transactionDate: true,
      amountCents: true,
      description: true,
      estateAllocation: true,
      estateRatio: true,
      servicePeriodStart: true,
      servicePeriodEnd: true
    }
  });

  console.log(`   Positive KV-Entries: ${kvEntries.length}`);

  if (kvEntries.length > 0) {
    let totalKv = 0;
    for (const entry of kvEntries) {
      totalKv += Number(entry.amountCents);
      const date = entry.transactionDate.toISOString().substring(0, 10);
      const amount = (Number(entry.amountCents) / 100).toFixed(2);
      const allocation = entry.estateAllocation || 'NULL';
      const ratio = entry.estateRatio ? `(${entry.estateRatio})` : '';
      const servicePeriod = entry.servicePeriodStart
        ? `Service: ${entry.servicePeriodStart.toISOString().substring(0, 10)} - ${entry.servicePeriodEnd?.toISOString().substring(0, 10) || '?'}`
        : 'Service: NULL';
      console.log(`   ${date} | ${amount.padStart(10)} EUR | ${allocation.padEnd(10)} ${ratio.padEnd(7)} | ${servicePeriod} | ${entry.description.substring(0, 50)}`);
    }
    console.log(`\n   Gesamt KV: ${(totalKv / 100).toFixed(2)} EUR`);
  } else {
    console.log('   ⚠️ Keine positiven KV-Einnahmen gefunden!');
  }

  // 2. HZV-Einnahmen
  console.log('\n## 2. HZV-EINNAHMEN\n');

  const hzvEntries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      OR: [
        { description: { contains: 'HZV' } },
        { description: { contains: 'HÄVG' } },
        { description: { contains: 'HAEVG' } }
      ],
      amountCents: { gt: 0 } // Nur Einnahmen
    },
    orderBy: { transactionDate: 'asc' },
    select: {
      transactionDate: true,
      amountCents: true,
      description: true,
      estateAllocation: true,
      estateRatio: true,
      servicePeriodStart: true,
      servicePeriodEnd: true
    }
  });

  console.log(`   Positive HZV-Entries: ${hzvEntries.length}`);

  if (hzvEntries.length > 0) {
    let totalHzv = 0;
    for (const entry of hzvEntries) {
      totalHzv += Number(entry.amountCents);
      const date = entry.transactionDate.toISOString().substring(0, 10);
      const amount = (Number(entry.amountCents) / 100).toFixed(2);
      const allocation = entry.estateAllocation || 'NULL';
      const ratio = entry.estateRatio ? `(${entry.estateRatio})` : '';
      const servicePeriod = entry.servicePeriodStart
        ? `Service: ${entry.servicePeriodStart.toISOString().substring(0, 10)} - ${entry.servicePeriodEnd?.toISOString().substring(0, 10) || '?'}`
        : 'Service: NULL';
      console.log(`   ${date} | ${amount.padStart(10)} EUR | ${allocation.padEnd(10)} ${ratio.padEnd(7)} | ${servicePeriod} | ${entry.description.substring(0, 50)}`);
    }
    console.log(`\n   Gesamt HZV: ${(totalHzv / 100).toFixed(2)} EUR`);
  } else {
    console.log('   ⚠️ Keine HZV-Einnahmen gefunden!');
  }

  // 3. November-Zahlungen allgemein
  console.log('\n## 3. ALLE NOVEMBER-ZAHLUNGEN (HZV-Kandidaten)\n');

  const novemberEntries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      transactionDate: {
        gte: new Date('2025-11-01'),
        lt: new Date('2025-12-01')
      },
      amountCents: { gt: 0 },
      OR: [
        { description: { contains: 'HZV' } },
        { description: { contains: 'HÄVG' } },
        { description: { contains: 'HAEVG' } }
      ]
    },
    select: {
      transactionDate: true,
      amountCents: true,
      description: true,
      servicePeriodStart: true
    }
  });

  console.log(`   November HZV-Entries: ${novemberEntries.length}`);

  if (novemberEntries.length === 0) {
    console.log('   ℹ️ Keine HZV-Zahlungen im November gefunden.');
    console.log('   → Mögliche Gründe:');
    console.log('      1. November-Kontoauszug nicht vollständig importiert');
    console.log('      2. HZV-Zahlungen für Oktober kommen erst im Dezember');
  } else {
    for (const entry of novemberEntries) {
      const date = entry.transactionDate.toISOString().substring(0, 10);
      const amount = (Number(entry.amountCents) / 100).toFixed(2);
      const servicePeriod = entry.servicePeriodStart
        ? entry.servicePeriodStart.toISOString().substring(0, 7)
        : 'NULL';
      console.log(`   ${date} | ${amount.padStart(10)} EUR | Service: ${servicePeriod} | ${entry.description.substring(0, 50)}`);
    }
  }

  await prisma.$disconnect();
}

analyzeKvHzv().catch(console.error);
