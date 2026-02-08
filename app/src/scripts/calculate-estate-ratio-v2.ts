import prisma from '../lib/db';

/**
 * Berechnet estateRatio (Alt/Neu-Masse-Split) für alle IST-Einträge
 * NUTZT suggestedCounterpartyId falls counterpartyId noch nicht gesetzt
 */
async function calculateEstateRatio() {
  const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';
  const insolvenzDatum = new Date('2025-10-29T00:00:00Z');

  // Lade alle IST-Einträge
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
    },
    include: {
      counterparty: { select: { id: true, name: true } },
    },
  });

  console.log(`\n=== ESTATE-RATIO-BERECHNUNG für ${entries.length} Einträge ===\n`);

  let updated = 0;
  let errors = 0;

  for (const entry of entries) {
    try {
      const txDate = new Date(entry.transactionDate);
      
      // Nutze counterpartyId ODER suggestedCounterpartyId
      const cpId = entry.counterpartyId || entry.suggestedCounterpartyId;
      let cpName = entry.counterparty?.name || '';
      
      // Falls suggestedCounterpartyId, lade Namen
      if (!cpName && cpId) {
        const cp = await prisma.counterparty.findUnique({
          where: { id: cpId },
          select: { name: true },
        });
        cpName = cp?.name || '';
      }

      let estateAllocation: 'ALTMASSE' | 'NEUMASSE' | 'MIXED' = 'NEUMASSE';
      let estateRatio = 1.0;
      let allocationSource = 'AUTO_CALCULATED';
      let allocationNote = '';

      // REGEL 1: Alles VOR Insolvenz = ALTMASSE
      if (txDate < insolvenzDatum) {
        estateAllocation = 'ALTMASSE';
        estateRatio = 0.0;
        allocationNote = 'Vor Insolvenz-Eröffnung (29.10.2025)';
      }
      // REGEL 2: Alles NACH Insolvenz = NEUMASSE
      else {
        estateAllocation = 'NEUMASSE';
        estateRatio = 1.0;
        allocationNote = 'Nach Insolvenz-Eröffnung (29.10.2025)';
      }

      // SPEZIALREGELN: KV Q4/2025 und HZV Oktober
      const isKV = cpName.includes('KV') || cpName.includes('Kassenärzt');
      const isHZV = cpName.includes('HZV') || cpName.includes('Hausarzt');

      // KV Q4/2025: 1/3 Alt, 2/3 Neu
      if (isKV && txDate >= new Date('2025-10-01') && txDate < new Date('2026-01-01')) {
        estateAllocation = 'MIXED';
        estateRatio = 0.6667; // 2/3 Neu
        allocationSource = 'MASSEKREDITVERTRAG';
        allocationNote = 'KV Q4/2025: 1/3 Alt, 2/3 Neu gem. §1(2)a';
      }
      // HZV Oktober 2025: 28/31 Alt, 3/31 Neu
      else if (isHZV && txDate >= new Date('2025-10-01') && txDate < new Date('2025-11-01')) {
        estateAllocation = 'MIXED';
        estateRatio = 0.0968; // 3/31 Neu
        allocationSource = 'MASSEKREDITVERTRAG';
        allocationNote = 'HZV Okt 2025: 28/31 Alt, 3/31 Neu gem. §1(2)b';
      }
      // HZV November+: 100% Neu
      else if (isHZV && txDate >= new Date('2025-11-01')) {
        estateAllocation = 'NEUMASSE';
        estateRatio = 1.0;
        allocationSource = 'MASSEKREDITVERTRAG';
        allocationNote = 'HZV Nov+: 100% Neu (Leistung Okt) gem. §1(2)b';
      }

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
      console.error(`Fehler bei ${entry.id}:`, error);
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

  console.log('=== STATISTIK ===\n');
  for (const group of stats) {
    const avgRatio = group._avg.estateRatio ?? 0;
    const avg = (Number(avgRatio) * 100).toFixed(1);
    console.log(`${group.estateAllocation}: ${group._count} (Ø ${avg}% Neu)`);
  }

  // MIXED Details
  const mixed = await prisma.ledgerEntry.findMany({
    where: { caseId, valueType: 'IST', estateAllocation: 'MIXED' },
    include: { counterparty: true },
    orderBy: { transactionDate: 'asc' },
  });

  console.log(`\n=== MIXED (${mixed.length}) ===\n`);
  for (const e of mixed.slice(0, 10)) {
    const date = new Date(e.transactionDate).toISOString().split('T')[0];
    const amt = (Number(e.amountCents) / 100).toFixed(2);
    const ratio = (Number(e.estateRatio ?? 0) * 100).toFixed(1);
    
    // Hole CP-Name aus suggestedCounterpartyId falls nötig
    let cpName = e.counterparty?.name;
    if (!cpName && e.suggestedCounterpartyId) {
      const cp = await prisma.counterparty.findUnique({
        where: { id: e.suggestedCounterpartyId },
        select: { name: true },
      });
      cpName = cp?.name;
    }
    
    console.log(`${date} | ${cpName} | ${amt} EUR | ${ratio}% Neu`);
  }

  await prisma.$disconnect();
}

calculateEstateRatio().catch(console.error);
