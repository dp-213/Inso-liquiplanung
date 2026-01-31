/**
 * Quick database check script - fokussiert auf IST-Daten
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const hvCase = await prisma.case.findFirst({ where: { caseNumber: '70d IN 362/25' } });
  if (!hvCase) {
    console.log('Case nicht gefunden!');
    return;
  }

  console.log('=== DATENBANK-CHECK ===');
  console.log('Case:', hvCase.debtorName);

  // Gesamt nach valueType
  console.log('\n--- Gesamt nach ValueType ---');
  const byType = await prisma.ledgerEntry.groupBy({
    by: ['valueType'],
    where: { caseId: hvCase.id },
    _count: true
  });
  byType.forEach(t => console.log(`${t.valueType}: ${t._count} Buchungen`));

  // NUR IST nach Monat
  console.log('\n--- IST-Daten nach Monat ---');
  const months = ['2025-10', '2025-11', '2025-12', '2026-01'];
  for (const m of months) {
    const [year, month] = m.split('-');
    const start = new Date(`${m}-01T00:00:00.000Z`);
    const end = new Date(Number(year), Number(month), 1);

    const entries = await prisma.ledgerEntry.findMany({
      where: {
        caseId: hvCase.id,
        valueType: 'IST',
        transactionDate: { gte: start, lt: end }
      }
    });

    let ein = BigInt(0);
    let aus = BigInt(0);
    entries.forEach(e => {
      if (e.amountCents >= 0) ein += e.amountCents;
      else aus += e.amountCents;
    });

    console.log(`${m}: ${entries.length} IST | Ein: ${(Number(ein) / 100).toLocaleString('de-DE')}€ | Aus: ${(Number(aus) / 100).toLocaleString('de-DE')}€`);
  }

  // IST nach ImportSource für Dez/Jan
  console.log('\n--- IST Dez+Jan nach ImportSource ---');
  const decJanIST = await prisma.ledgerEntry.findMany({
    where: {
      caseId: hvCase.id,
      valueType: 'IST',
      transactionDate: { gte: new Date('2025-12-01'), lt: new Date('2026-02-01') }
    }
  });

  const bySource: Record<string, { count: number; sum: bigint }> = {};
  decJanIST.forEach(e => {
    const src = e.importSource || 'UNBEKANNT';
    const key = src.split(':')[0].substring(0, 30);
    if (bySource[key] === undefined) {
      bySource[key] = { count: 0, sum: BigInt(0) };
    }
    bySource[key].count++;
    bySource[key].sum += e.amountCents;
  });

  for (const [src, data] of Object.entries(bySource)) {
    console.log(`${src}: ${data.count} Buchungen | ${(Number(data.sum) / 100).toLocaleString('de-DE')}€`);
  }

  // IST nach Estate Allocation (nur IST)
  console.log('\n--- IST nach Estate Allocation ---');
  const allocations = await prisma.ledgerEntry.groupBy({
    by: ['estateAllocation'],
    where: { caseId: hvCase.id, valueType: 'IST' },
    _count: true,
    _sum: { amountCents: true }
  });
  allocations.forEach(a => {
    const alloc = a.estateAllocation || 'NULL/UNKLAR';
    const sum = a._sum.amountCents ? Number(a._sum.amountCents) / 100 : 0;
    console.log(`${alloc}: ${a._count} Buchungen | Summe: ${sum.toLocaleString('de-DE')}€`);
  });

  // ISK HZV Stichprobe mit estateAllocation
  console.log('\n--- ISK Dezember HZV (mit Estate Allocation) ---');
  const iskHZV = await prisma.ledgerEntry.findMany({
    where: {
      caseId: hvCase.id,
      valueType: 'IST',
      transactionDate: { gte: new Date('2025-12-01'), lt: new Date('2026-01-01') },
      importSource: { contains: 'ISK' },
      OR: [
        { description: { contains: 'HZV' } },
        { description: { contains: 'hzv' } },
        { description: { contains: 'HAVG' } }
      ]
    },
    take: 10,
    orderBy: { amountCents: 'desc' }
  });

  iskHZV.forEach(e => {
    const amt = (Number(e.amountCents) / 100).toLocaleString('de-DE').padStart(10);
    const alloc = (e.estateAllocation || 'NULL').padEnd(10);
    console.log(`${amt}€ | ${alloc} | ${e.allocationSource || ''} | ${e.description.substring(0, 45)}`);
  });

  // Sammelüberweisungen Januar
  console.log('\n--- ISK Januar Sammelüberweisungen ---');
  const sammelJan = await prisma.ledgerEntry.findMany({
    where: {
      caseId: hvCase.id,
      valueType: 'IST',
      transactionDate: { gte: new Date('2026-01-01'), lt: new Date('2026-02-01') },
      importSource: { contains: 'ISK' },
      description: { contains: 'SAMMEL' }
    },
    orderBy: { amountCents: 'asc' }
  });

  sammelJan.forEach(e => {
    const amt = (Number(e.amountCents) / 100).toLocaleString('de-DE').padStart(12);
    const alloc = (e.estateAllocation || 'NULL').padEnd(10);
    console.log(`${amt}€ | ${alloc} | ${e.description.substring(0, 50)}`);
  });

  // Location-Zuordnung für ISK
  console.log('\n--- ISK-Einträge nach Location ---');
  const locations = await prisma.location.findMany({ where: { caseId: hvCase.id } });
  for (const loc of locations) {
    const count = await prisma.ledgerEntry.count({
      where: {
        caseId: hvCase.id,
        valueType: 'IST',
        locationId: loc.id,
        importSource: { contains: 'ISK' }
      }
    });
    if (count > 0) console.log(`${loc.name}: ${count} ISK-Buchungen`);
  }
  const noLoc = await prisma.ledgerEntry.count({
    where: {
      caseId: hvCase.id,
      valueType: 'IST',
      locationId: null,
      importSource: { contains: 'ISK' }
    }
  });
  console.log(`Ohne Location: ${noLoc} ISK-Buchungen`);
}

check().catch(console.error).finally(() => prisma.$disconnect());
