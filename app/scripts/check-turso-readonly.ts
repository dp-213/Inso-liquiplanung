// Use the app's db module which handles Turso adapter
import { prisma } from '../src/lib/db';

async function main() {
  console.log('=== TURSO PRODUCTION (READ-ONLY) ===\n');

  // 1. Cases
  console.log('--- CASES ---');
  const cases = await prisma.case.findMany({
    select: { id: true, caseNumber: true, debtorName: true, status: true }
  });
  cases.forEach(c => console.log('  ' + c.caseNumber + ': ' + c.debtorName + ' (' + c.status + ')'));
  console.log('  Total: ' + cases.length);

  // 2. Customer users
  console.log('\n--- CUSTOMER USERS ---');
  const users = await prisma.customerUser.findMany({
    select: { id: true, email: true, name: true, isActive: true }
  });
  users.forEach(u => console.log('  ' + u.email + ': ' + u.name + ' (active: ' + u.isActive + ')'));
  console.log('  Total: ' + users.length);

  // 3. Locations per case
  console.log('\n--- LOCATIONS ---');
  const locations = await prisma.location.findMany({
    include: { case: { select: { caseNumber: true } } }
  });
  locations.forEach(l => console.log('  ' + l.shortName + ': ' + l.name + ' (' + l.case.caseNumber + ')'));
  console.log('  Total: ' + locations.length);

  // 4. Counterparties per case  
  console.log('\n--- COUNTERPARTIES ---');
  const counterparties = await prisma.counterparty.findMany({
    include: { case: { select: { caseNumber: true } } }
  });
  counterparties.forEach(cp => console.log('  ' + cp.name + ' (' + cp.type + ') - ' + cp.case.caseNumber));
  console.log('  Total: ' + counterparties.length);

  // 5. Ledger entries grouped
  console.log('\n--- LEDGER ENTRIES ---');
  const ledgerGroups = await prisma.ledgerEntry.groupBy({
    by: ['valueType', 'estateAllocation'],
    _count: { id: true }
  });
  ledgerGroups.forEach(g => console.log('  ' + g.valueType + ' / ' + g.estateAllocation + ': ' + g._count.id));
  const totalLedger = ledgerGroups.reduce((sum, g) => sum + g._count.id, 0);
  console.log('  Total: ' + totalLedger);

  // 6. Bank accounts
  console.log('\n--- BANK ACCOUNTS ---');
  const banks = await prisma.bankAccount.findMany({
    include: { case: { select: { caseNumber: true } } }
  });
  banks.forEach(b => console.log('  ' + b.accountName + ' (' + b.case.caseNumber + ')'));
  console.log('  Total: ' + banks.length);

  // 7. Liquidity plans
  console.log('\n--- LIQUIDITY PLANS ---');
  const plans = await prisma.liquidityPlan.findMany({
    include: { case: { select: { caseNumber: true } } }
  });
  plans.forEach(p => console.log('  ' + p.name + ' (' + p.case.caseNumber + ') - active: ' + p.isActive));
  console.log('  Total: ' + plans.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
