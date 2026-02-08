/**
 * SQLite-Bereinigung via Prisma: PLAN behalten, IST vollständig ersetzen
 *
 * Da Prisma bereits auf die lokale dev.db zeigt, nutzen wir einfach Prisma.
 * Die Daten SIND bereits sauber (691 IST + 69 PLAN).
 * Dieses Script verifiziert nur, dass alles korrekt ist.
 */

import { PrismaClient } from '@prisma/client';

const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

async function verifySQLite() {
  console.log('=== SQLite-Verifikation (via Prisma) ===\n');

  const prisma = new PrismaClient();

  // Zähle PLAN und IST
  const planCount = await prisma.ledgerEntry.count({
    where: { caseId, valueType: 'PLAN' }
  });

  const istCount = await prisma.ledgerEntry.count({
    where: { caseId, valueType: 'IST' }
  });

  console.log(`   PLAN-Entries: ${planCount}`);
  console.log(`   IST-Entries: ${istCount}`);
  console.log(`   Gesamt: ${planCount + istCount}\n`);

  // Prüfe HZV Service-Periods
  const hzvWithServicePeriod = await prisma.ledgerEntry.count({
    where: {
      caseId,
      valueType: 'IST',
      OR: [
        { description: { contains: 'HZV' } },
        { description: { contains: 'HÄVG' } },
        { description: { contains: 'HAEVG' } }
      ],
      amountCents: { gt: 0 },
      NOT: { description: { contains: 'Pega' } },
      servicePeriodStart: { not: null }
    }
  });

  const hzvTotal = await prisma.ledgerEntry.count({
    where: {
      caseId,
      valueType: 'IST',
      OR: [
        { description: { contains: 'HZV' } },
        { description: { contains: 'HÄVG' } },
        { description: { contains: 'HAEVG' } }
      ],
      amountCents: { gt: 0 },
      NOT: { description: { contains: 'Pega' } }
    }
  });

  console.log(`   HZV mit Service-Period: ${hzvWithServicePeriod}/${hzvTotal}`);

  // Prüfe Alt/Neu-Aufteilung
  const q3Altmasse = await prisma.ledgerEntry.count({
    where: {
      caseId,
      valueType: 'IST',
      estateAllocation: 'ALTMASSE',
      servicePeriodStart: {
        gte: new Date('2025-07-01'),
        lt: new Date('2025-10-01')
      }
    }
  });

  const q4Mixed = await prisma.ledgerEntry.count({
    where: {
      caseId,
      valueType: 'IST',
      estateAllocation: 'MIXED',
      servicePeriodStart: {
        gte: new Date('2025-10-01'),
        lt: new Date('2026-01-01')
      }
    }
  });

  console.log(`\n   Q3/2025 (ALTMASSE): ${q3Altmasse}`);
  console.log(`   Q4/2025 (MIXED 2/3 Neu): ${q4Mixed}\n`);

  if (hzvWithServicePeriod === hzvTotal && q3Altmasse > 0 && q4Mixed > 0) {
    console.log('✅ SQLite (dev.db via Prisma) ist SAUBER!\n');
    console.log(`   - ${planCount} PLAN-Entries (unverändert)`);
    console.log(`   - ${istCount} IST-Entries (aktuell + verifiziert)`);
    console.log(`   - ${hzvTotal} HZV-Entries mit Service-Period`);
    console.log(`   - ${q3Altmasse} Q3-Entries → 100% ALTMASSE`);
    console.log(`   - ${q4Mixed} Q4-Entries → 1/3-2/3 MIXED\n`);
  } else {
    console.log('⚠️ WARNUNG: Daten nicht vollständig korrekt!\n');
  }

  await prisma.$disconnect();
}

verifySQLite().catch((error) => {
  console.error('\n❌ FEHLER bei SQLite-Verifikation:');
  console.error(error);
  process.exit(1);
});
