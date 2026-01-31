import { prisma } from '../src/lib/db';

async function main() {
  const caseNumber = '70d IN 362/25';
  
  const hvCase = await prisma.case.findFirst({ where: { caseNumber } });
  if (!hvCase) { console.log('Case nicht gefunden!'); return; }
  
  const locations = await prisma.location.count({ where: { caseId: hvCase.id } });
  const counterparties = await prisma.counterparty.count({ where: { caseId: hvCase.id } });
  const bankAccounts = await prisma.bankAccount.count({ where: { caseId: hvCase.id } });
  const plans = await prisma.liquidityPlan.count({ where: { caseId: hvCase.id } });
  const istEntries = await prisma.ledgerEntry.count({ where: { caseId: hvCase.id, valueType: 'IST' } });
  const planEntries = await prisma.ledgerEntry.count({ where: { caseId: hvCase.id, valueType: 'PLAN' } });
  const nullAlloc = await prisma.ledgerEntry.count({ where: { caseId: hvCase.id, estateAllocation: null } });
  
  console.log('TURSO - Case ' + caseNumber + ':');
  console.log('---');
  console.log('Locations:', locations);
  console.log('Counterparties:', counterparties);
  console.log('BankAccounts:', bankAccounts);
  console.log('LiquidityPlans:', plans);
  console.log('---');
  console.log('LedgerEntries IST:', istEntries);
  console.log('LedgerEntries PLAN:', planEntries);
  console.log('estateAllocation NULL:', nullAlloc);
}

main().catch(console.error).finally(() => prisma.$disconnect());
