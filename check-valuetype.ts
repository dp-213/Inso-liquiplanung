import prisma from './app/src/lib/db';

async function check() {
  const caseId = "2982ff26-081a-4811-8e1e-46b39e1ff757";
  
  // Zeitraum wie im API (6 Monate zurück)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 6);
  
  console.log(`Zeitraum: ${startDate.toISOString().split('T')[0]} bis ${endDate.toISOString().split('T')[0]}`);

  const istInflows = await prisma.ledgerEntry.count({
    where: {
      caseId,
      valueType: 'IST',
      amountCents: { gt: 0 },
      transactionDate: { gte: startDate, lte: endDate },
    }
  });

  console.log(`IST-Einnahmen im Zeitraum: ${istInflows}`);

  // Zeige die neuesten IST-Einnahmen
  const examples = await prisma.ledgerEntry.findMany({
    where: { 
      caseId, 
      valueType: 'IST', 
      amountCents: { gt: 0 },
    },
    select: { valueType: true, amountCents: true, transactionDate: true, description: true },
    orderBy: { transactionDate: 'desc' },
    take: 10,
  });

  console.log(`\nNeueste IST-Einnahmen:`);
  examples.forEach(e => {
    const date = e.transactionDate.toISOString().split('T')[0];
    const amt = (Number(e.amountCents) / 100).toLocaleString('de-DE');
    console.log(`${date} | ${amt} € | ${e.description?.substring(0, 50)}`);
  });
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
