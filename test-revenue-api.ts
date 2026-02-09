import prisma from './app/src/lib/db';
import { summarizeByCounterparty } from './app/src/lib/ledger/aggregation';

async function test() {
  const caseId = "2982ff26-081a-4811-8e1e-46b39e1ff757";
  
  const plan = await prisma.liquidityPlan.findFirst({
    where: { caseId, isActive: true },
    select: { id: true },
  });

  if (!plan) {
    console.log("Kein aktiver Plan!");
    return;
  }

  console.log(`Plan gefunden: ${plan.id}`);

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 6);

  console.log(`Zeitraum: ${startDate.toISOString().split('T')[0]} bis ${endDate.toISOString().split('T')[0]}`);

  const summary = await summarizeByCounterparty(prisma, caseId, plan.id, {
    startDate,
    endDate,
    scope: 'GLOBAL',
  });

  console.log(`\nAnzahl Einnahme-Quellen: ${summary.length}`);
  
  summary.forEach(s => {
    const amt = (Number(s.totalCents) / 100).toLocaleString('de-DE');
    console.log(`${s.counterpartyName}: ${amt} € (${s.entryCount} Buchungen)`);
  });

  const grandTotal = summary.reduce((sum, s) => sum + s.totalCents, BigInt(0));
  console.log(`\nGesamtsumme: ${(Number(grandTotal) / 100).toLocaleString('de-DE')} €`);
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
