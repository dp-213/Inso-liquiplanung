/**
 * VOLLSTÄNDIGE KLASSIFIZIERUNGS-PRÜFUNG
 *
 * Prüft ALLE Zuordnungen:
 * 1. Standorte (Location)
 * 2. Matrix-Zuordnung (Estate Allocation: Alt/Neu/Mixed)
 * 3. Ärzte (LANR → Counterparty)
 * 4. Masse-Regeln (KV 1/3-2/3, HZV 28/31-3/31)
 * 5. Gegenpartei (Counterparty-Zuordnung)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';
const cutoffDate = new Date('2025-10-29T00:00:00.000Z');

async function verifyClassificationComplete() {
  console.log('=== VOLLSTÄNDIGE KLASSIFIZIERUNGS-PRÜFUNG ===\n');

  const total = await prisma.ledgerEntry.count({
    where: { caseId, valueType: 'IST' }
  });

  console.log(`Total IST-Entries: ${total}\n`);

  // 1. STANDORTE
  console.log('## 1. STANDORT-ZUORDNUNG\n');

  const byLocation = await prisma.ledgerEntry.groupBy({
    by: ['locationId'],
    where: { caseId, valueType: 'IST' },
    _count: true,
    _sum: { amountCents: true }
  });

  const locations = await prisma.location.findMany({
    where: { caseId }
  });

  console.log('Standort                  | Anzahl | Summe EUR');
  console.log('--------------------------|--------|------------');

  for (const loc of byLocation) {
    const location = locations.find(l => l.id === loc.locationId);
    const name = location?.name || 'NULL';
    const sum = (Number(loc._sum.amountCents || 0) / 100).toFixed(2);
    console.log(`${name.padEnd(26)} | ${String(loc._count).padStart(6)} | ${String(sum).padStart(10)}`);
  }

  const nullLoc = byLocation.find(l => !l.locationId);
  if (nullLoc && nullLoc._count > 0) {
    console.log(`\n   ❌ ${nullLoc._count} Entries ohne Location!`);
  } else {
    console.log(`\n   ✅ Alle Entries haben Location (100%)`);
  }

  // 2. ESTATE ALLOCATION (Alt/Neu/Mixed)
  console.log('\n## 2. ESTATE ALLOCATION (Alt/Neu-Masse)\n');

  const byEstate = await prisma.ledgerEntry.groupBy({
    by: ['estateAllocation'],
    where: { caseId, valueType: 'IST' },
    _count: true,
    _sum: { amountCents: true }
  });

  console.log('Allocation     | Anzahl | Summe EUR    | Prozent');
  console.log('---------------|--------|--------------|--------');

  for (const ea of byEstate) {
    const allocation = ea.estateAllocation || 'NULL';
    const sum = (Number(ea._sum.amountCents || 0) / 100).toFixed(2);
    const percent = ((ea._count / total) * 100).toFixed(1);
    console.log(`${allocation.padEnd(15)} | ${String(ea._count).padStart(6)} | ${String(sum).padStart(12)} | ${percent.padStart(5)}%`);
  }

  const nullEA = byEstate.find(e => !e.estateAllocation);
  if (nullEA && nullEA._count > 0) {
    console.log(`\n   ❌ ${nullEA._count} Entries ohne Estate Allocation!`);
  } else {
    console.log(`\n   ✅ Alle Entries haben Estate Allocation (100%)`);
  }

  // 3. MASSE-REGELN: KV Q4/2025 (1/3 Alt, 2/3 Neu)
  console.log('\n## 3. MASSE-REGEL: KV Q4/2025 (1/3 Alt, 2/3 Neu)\n');

  const kvQ4 = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      description: { contains: 'KV' },
      transactionDate: {
        gte: new Date('2025-10-01'),
        lt: new Date('2026-01-01')
      },
      estateAllocation: { in: ['ALTMASSE', 'NEUMASSE', 'MIXED'] }
    },
    select: {
      estateAllocation: true,
      estateRatio: true,
      amountCents: true,
      description: true
    }
  });

  let kvAlt = 0;
  let kvNeu = 0;

  for (const entry of kvQ4) {
    const amount = Number(entry.amountCents) / 100;
    if (entry.estateAllocation === 'ALTMASSE') {
      kvAlt += amount;
    } else if (entry.estateAllocation === 'NEUMASSE') {
      kvNeu += amount;
    } else if (entry.estateAllocation === 'MIXED' && entry.estateRatio) {
      kvNeu += amount * entry.estateRatio;
      kvAlt += amount * (1 - entry.estateRatio);
    }
  }

  const kvTotal = kvAlt + kvNeu;
  const kvNeuRatio = kvTotal > 0 ? kvNeu / kvTotal : 0;
  const kvExpected = 2/3;
  const kvDiff = Math.abs(kvNeuRatio - kvExpected);

  console.log(`   KV Q4/2025 Entries: ${kvQ4.length}`);
  console.log(`   Altmasse: ${kvAlt.toFixed(2)} EUR`);
  console.log(`   Neumasse: ${kvNeu.toFixed(2)} EUR`);
  console.log(`   Neumasse-Anteil: ${(kvNeuRatio * 100).toFixed(1)}% (Soll: 66.7%)`);
  console.log(`   Abweichung: ${(kvDiff * 100).toFixed(1)} Prozentpunkte ${kvDiff < 0.05 ? '✅' : '⚠️'}`);

  // 4. MASSE-REGEL: HZV Oktober (28/31 Alt, 3/31 Neu)
  console.log('\n## 4. MASSE-REGEL: HZV Oktober (28/31 Alt, 3/31 Neu)\n');

  const hzvOkt = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      OR: [
        { description: { contains: 'HZV' } },
        { description: { contains: 'HÄVG' } },
        { description: { contains: 'HAEVG' } }
      ],
      transactionDate: {
        gte: new Date('2025-11-01'), // November-Zahlungen
        lt: new Date('2025-12-01')
      },
      servicePeriodStart: {
        gte: new Date('2025-10-01'),
        lt: new Date('2025-11-01')
      }
    },
    select: {
      estateAllocation: true,
      estateRatio: true,
      amountCents: true,
      description: true
    }
  });

  let hzvAlt = 0;
  let hzvNeu = 0;

  for (const entry of hzvOkt) {
    const amount = Number(entry.amountCents) / 100;
    if (entry.estateAllocation === 'ALTMASSE') {
      hzvAlt += amount;
    } else if (entry.estateAllocation === 'NEUMASSE') {
      hzvNeu += amount;
    } else if (entry.estateAllocation === 'MIXED' && entry.estateRatio) {
      hzvNeu += amount * entry.estateRatio;
      hzvAlt += amount * (1 - entry.estateRatio);
    }
  }

  const hzvTotal = hzvAlt + hzvNeu;
  const hzvNeuRatio = hzvTotal > 0 ? hzvNeu / hzvTotal : 0;
  const hzvExpected = 3/31;
  const hzvDiff = Math.abs(hzvNeuRatio - hzvExpected);

  console.log(`   HZV Oktober Entries: ${hzvOkt.length}`);
  console.log(`   Altmasse: ${hzvAlt.toFixed(2)} EUR`);
  console.log(`   Neumasse: ${hzvNeu.toFixed(2)} EUR`);
  console.log(`   Neumasse-Anteil: ${(hzvNeuRatio * 100).toFixed(1)}% (Soll: 9.7%)`);
  console.log(`   Abweichung: ${(hzvDiff * 100).toFixed(1)} Prozentpunkte ${hzvDiff < 0.05 ? '✅' : '⚠️'}`);

  // 5. COUNTERPARTY-ZUORDNUNG
  console.log('\n## 5. COUNTERPARTY-ZUORDNUNG\n');

  const withCP = await prisma.ledgerEntry.count({
    where: { caseId, valueType: 'IST', counterpartyId: { not: null } }
  });

  const withoutCP = total - withCP;
  const cpPercent = ((withCP / total) * 100).toFixed(1);

  console.log(`   Mit Counterparty: ${withCP} (${cpPercent}%)`);
  console.log(`   Ohne Counterparty: ${withoutCP} (${((withoutCP / total) * 100).toFixed(1)}%)`);

  if (withoutCP > 0) {
    // Zeige Beispiele
    const examples = await prisma.ledgerEntry.findMany({
      where: { caseId, valueType: 'IST', counterpartyId: null },
      select: { description: true, amountCents: true },
      take: 5
    });

    console.log('\n   Beispiele ohne Counterparty:');
    for (const ex of examples) {
      const amount = (Number(ex.amountCents) / 100).toFixed(2);
      console.log(`     - ${amount.padStart(10)} EUR | ${ex.description.substring(0, 60)}`);
    }
  }

  // 6. ZUSAMMENFASSUNG
  console.log('\n## 6. ZUSAMMENFASSUNG\n');

  const checks = [
    { name: 'Location', pass: nullLoc?._count === 0 || !nullLoc },
    { name: 'Estate Allocation', pass: nullEA?._count === 0 || !nullEA },
    { name: 'KV Q4 Regel (1/3-2/3)', pass: kvDiff < 0.05 },
    { name: 'HZV Oktober Regel (28/31-3/31)', pass: hzvDiff < 0.05 },
    { name: 'Counterparty (>85%)', pass: withCP / total > 0.85 }
  ];

  console.log('Check                            | Status');
  console.log('---------------------------------|--------');
  for (const check of checks) {
    console.log(`${check.name.padEnd(33)} | ${check.pass ? '✅' : '❌'}`);
  }

  const allPass = checks.every(c => c.pass);
  console.log(`\n${allPass ? '✅ ALLE CHECKS BESTANDEN!' : '⚠️ EINIGE CHECKS FEHLGESCHLAGEN'}\n`);

  await prisma.$disconnect();
}

verifyClassificationComplete().catch(console.error);
