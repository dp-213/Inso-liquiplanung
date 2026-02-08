import prisma from '../lib/db';
import { aggregateLedgerEntries } from '../lib/ledger-aggregation';

/**
 * Test: IST-Vorrang Logik
 *
 * Vorher (ohne IST-Vorrang):
 * - Dez 2025: IST -3.321 + PLAN +343.003 = +339.682
 * - Jan 2026: IST -47.901 + PLAN +35.397 = -12.504
 * - Total: +327.178 Fehler
 *
 * Nachher (mit IST-Vorrang):
 * - Dez 2025: Nur IST -3.321 (PLAN ignoriert)
 * - Jan 2026: Nur IST -47.901 (PLAN ignoriert)
 * - PLAN nur für Perioden ohne IST
 */
async function testIstVorrang() {
  const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

  // Lade Plan-Info
  const plan = await prisma.liquidityPlan.findFirst({
    where: { caseId, isActive: true },
    include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
  });

  if (!plan) {
    console.error('Kein aktiver Plan gefunden');
    return;
  }

  const planStartDate = new Date(plan.planStartDate);
  const periodType = plan.periodType as 'WEEKLY' | 'MONTHLY';
  const periodCount = plan.periodCount;
  const openingBalance = BigInt(plan.versions[0]?.openingBalanceCents || 0);

  console.log(`\n=== IST-VORRANG TEST ===`);
  console.log(`Plan: ${periodType}, ${periodCount} Perioden`);
  console.log(`Start: ${planStartDate.toISOString().split('T')[0]}`);
  console.log(`Opening: ${Number(openingBalance) / 100} EUR\n`);

  // Aggregiere mit IST-Vorrang
  const result = await aggregateLedgerEntries(
    caseId,
    planStartDate,
    periodType,
    periodCount,
    openingBalance,
    { scope: 'GLOBAL', excludeSteeringTags: ['INTERNE_UMBUCHUNG'] }
  );

  console.log(`\n=== AGGREGATION ERGEBNIS ===`);
  console.log(`Perioden: ${result.periods.length}`);
  console.log(`Kategorien: ${result.categories.length}`);
  console.log(`IST-Einträge: ${result.istCount}`);
  console.log(`PLAN-Einträge: ${result.planCount}`);
  console.log(`Confirmed: ${result.confirmedCount}`);
  console.log(`Unreviewed: ${result.unreviewedCount}\n`);

  console.log(`=== SUMMEN ===`);
  console.log(`Total Inflows:  ${(Number(result.totalInflowsCents) / 100).toFixed(2)} EUR`);
  console.log(`Total Outflows: ${(Number(result.totalOutflowsCents) / 100).toFixed(2)} EUR`);
  console.log(`Net Cashflow:   ${((Number(result.totalInflowsCents) - Number(result.totalOutflowsCents)) / 100).toFixed(2)} EUR\n`);

  console.log(`=== PERIODEN-DETAILS (mit IST/PLAN) ===`);

  // Zeige Dez 2025 + Jan 2026
  const targetPeriods = result.periods.filter((p) =>
    p.periodLabel.includes('Dez 2025') ||
    p.periodLabel.includes('Jan 2026') ||
    p.periodLabel.includes('Nov 2025') ||
    p.periodLabel.includes('Feb 2026')
  );

  for (const period of targetPeriods) {
    const inflow = Number(period.totalInflowsCents) / 100;
    const outflow = Number(period.totalOutflowsCents) / 100;
    const net = Number(period.netCashflowCents) / 100;
    const closing = Number(period.closingBalanceCents) / 100;

    console.log(`\n${period.periodLabel}:`);
    console.log(`  Inflows:  ${inflow.toFixed(2)} EUR`);
    console.log(`  Outflows: ${outflow.toFixed(2)} EUR`);
    console.log(`  Net:      ${net.toFixed(2)} EUR`);
    console.log(`  Closing:  ${closing.toFixed(2)} EUR`);
  }

  console.log(`\n=== ERWARTETE ÄNDERUNG ===`);
  console.log(`Vorher (ohne IST-Vorrang): ~874K EUR Total`);
  console.log(`Nachher (mit IST-Vorrang):  ~547K EUR Total`);
  console.log(`Differenz: -327K EUR (PLAN-Entries verdrängt durch IST)\n`);

  await prisma.$disconnect();
}

testIstVorrang().catch(console.error);
