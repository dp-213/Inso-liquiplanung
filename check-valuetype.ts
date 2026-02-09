import prisma from './app/src/lib/db';

async function check() {
  const case1 = await prisma.case.findFirst({
    where: { debtorName: { contains: 'Hausärztliche' } },
  });
  
  if (!case1) {
    console.log("Case nicht gefunden");
    return;
  }

  console.log(`Case: ${case1.debtorName} (${case1.id})`);

  const total = await prisma.ledgerEntry.count({
    where: { caseId: case1.id }
  });

  const ist = await prisma.ledgerEntry.count({
    where: { caseId: case1.id, valueType: 'IST' }
  });

  const plan = await prisma.ledgerEntry.count({
    where: { caseId: case1.id, valueType: 'PLAN' }
  });

  const nullType = await prisma.ledgerEntry.count({
    where: { caseId: case1.id, valueType: null }
  });

  console.log(`\nGesamt: ${total}`);
  console.log(`IST: ${ist}`);
  console.log(`PLAN: ${plan}`);
  console.log(`null: ${nullType}`);

  const examples = await prisma.ledgerEntry.findMany({
    where: { caseId: case1.id, amountCents: { gt: 0 } },
    select: {
      valueType: true,
      amountCents: true,
      transactionDate: true,
      description: true,
    },
    orderBy: { transactionDate: 'desc' },
    take: 5,
  });

  console.log(`\nNeueste Einnahmen:`);
  examples.forEach(e => {
    const date = e.transactionDate.toISOString().split('T')[0];
    const desc = e.description?.substring(0, 40) || 'N/A';
    console.log(`${date} | ${e.valueType || 'NULL'} | ${e.amountCents} | ${desc}`);
  });
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
