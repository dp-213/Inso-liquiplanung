import prisma from '../lib/db';

/**
 * Berechnet estateRatio (Alt/Neu-Masse-Split) für alle IST-Einträge
 *
 * Regeln (aus Massekreditvertrag + case-context.json):
 * - Insolvenz-Eröffnung: 29.10.2025
 * - KV Q4/2025: 1/3 Alt, 2/3 Neu
 * - HZV Oktober: 28/31 Alt, 3/31 Neu
 * - HZV November+: 100% Neu
 * - Alles nach 29.10.2025: 100% Neu
 * - Alles vor 29.10.2025: 100% Alt
 */
async function calculateEstateRatio() {
  const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';
  const insolvenzDatum = new Date('2025-10-29T00:00:00Z');

  // Lade alle IST-Einträge mit suggestedCounterpartyId
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      estateAllocation: 'UNKLAR', // Noch nicht zugeordnet
    },
    include: {
      counterparty: { select: { name: true } },
    },
  });

  console.log(`\n=== ESTATE-RATIO-BERECHNUNG für ${entries.length} Einträge ===\n`);

  let updated = 0;
  let errors = 0;

  for (const entry of entries) {
    try {
      const txDate = new Date(entry.transactionDate);
      const cpName = entry.counterparty?.name || '';

      let estateAllocation: 'ALTMASSE' | 'NEUMASSE' | 'MIXED' = 'NEUMASSE';
      let estateRatio = 1.0; // 1.0 = 100% Neu, 0.0 = 100% Alt
      let allocationSource = 'AUTO_CALCULATED';
      let allocationNote = '';

      // REGEL 1: Alles VOR Insolvenz-Eröffnung = 100% ALTMASSE (außer Spezialregeln)
      if (txDate < insolvenzDatum) {
        estateAllocation = 'ALTMASSE';
        estateRatio = 0.0;
        allocationNote = 'Transaktion vor Insolvenz-Eröffnung (29.10.2025)';
      }
      // REGEL 2: Alles NACH Insolvenz-Eröffnung = 100% NEUMASSE
      else {
        estateAllocation = 'NEUMASSE';
        estateRatio = 1.0;
        allocationNote = 'Transaktion nach Insolvenz-Eröffnung (29.10.2025)';
      }

      // SPEZIALREGELN: KV Q4/2025 und HZV Oktober (überschreiben)
      const isKV = cpName.includes('KV') || cpName.includes('Kassenärzt');
      const isHZV = cpName.includes('HZV') || cpName.includes('Hausarzt');

      // KV Q4/2025 (Oktober-Dezember): 1/3 Alt, 2/3 Neu
      if (isKV && txDate >= new Date('2025-10-01') && txDate < new Date('2026-01-01')) {
        estateAllocation = 'MIXED';
        estateRatio = 0.6667; // 2/3 Neu
        allocationSource = 'MASSEKREDITVERTRAG';
        allocationNote = 'KV Q4/2025: 1/3 Alt (Leistung Jul-Sep), 2/3 Neu (Leistung Okt-Dez) gem. Massekreditvertrag §1(2)a';
      }
      // HZV Oktober 2025: 28/31 Alt, 3/31 Neu
      else if (isHZV && txDate >= new Date('2025-10-01') && txDate < new Date('2025-11-01')) {
        estateAllocation = 'MIXED';
        estateRatio = 0.0968; // 3/31 Neu (ca. 9,68%)
        allocationSource = 'MASSEKREDITVERTRAG';
        allocationNote = 'HZV Oktober 2025: 28/31 Alt (Leistung Sep), 3/31 Neu (Leistung 1-3.Okt) gem. Massekreditvertrag §1(2)b';
      }
      // HZV November+ 2025: 100% Neu
      else if (isHZV && txDate >= new Date('2025-11-01')) {
        estateAllocation = 'NEUMASSE';
        estateRatio = 1.0;
        allocationSource = 'MASSEKREDITVERTRAG';
        allocationNote = 'HZV November+: 100% Neu (Leistung Oktober gem. VORMONAT-Regel) gem. Massekreditvertrag §1(2)b';
      }

      // Update Entry
      await prisma.ledgerEntry.update({
        where: { id: entry.id },
        data: {
          estateAllocation,
          estateRatio,
          allocationSource,
          allocationNote,
        },
      });

      updated++;
    } catch (error) {
      console.error(`Fehler bei Entry ${entry.id}:`, error);
      errors++;
    }
  }

  console.log(`\n=== ERGEBNIS ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors:  ${errors}\n`);

  // Statistik
  const stats = await prisma.ledgerEntry.groupBy({
    by: ['estateAllocation'],
    where: { caseId, valueType: 'IST' },
    _count: true,
    _avg: { estateRatio: true },
  });

  console.log('=== STATISTIK: Estate Allocation ===\n');
  for (const group of stats) {
    const avgRatio = group._avg.estateRatio ?? 0;
    const avg = (Number(avgRatio) * 100).toFixed(1);
    console.log(`${group.estateAllocation}: ${group._count} Einträge (Ø Ratio: ${avg}%)`);
  }

  // Zeige MIXED-Einträge im Detail
  const mixedEntries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      estateAllocation: 'MIXED',
    },
    include: {
      counterparty: { select: { name: true } },
    },
    orderBy: { transactionDate: 'asc' },
  });

  console.log(`\n=== MIXED Einträge (${mixedEntries.length}) ===\n`);
  for (const entry of mixedEntries.slice(0, 10)) {
    const txDate = new Date(entry.transactionDate).toISOString().split('T')[0];
    const amount = (Number(entry.amountCents) / 100).toFixed(2);
    const ratio = (Number(entry.estateRatio ?? 0) * 100).toFixed(1);
    console.log(`${txDate} | ${entry.counterparty?.name} | ${amount} EUR | ${ratio}% Neu`);
  }

  await prisma.$disconnect();
}

calculateEstateRatio().catch(console.error);
