/**
 * Migration Script: PeriodValues → LedgerEntries
 *
 * Migrates existing PeriodValues to LedgerEntries for a specific case.
 * Run with: npx ts-node scripts/migrate-to-ledger.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration
const CASE_NUMBER = '423123'; // HVPlus
const DRY_RUN = false; // Set to true to preview without writing

async function calculatePeriodStartDate(
  planStartDate: Date,
  periodIndex: number,
  periodType: string
): Promise<Date> {
  const startDate = new Date(planStartDate);
  startDate.setHours(0, 0, 0, 0);

  if (periodType === 'WEEKLY') {
    startDate.setDate(startDate.getDate() + periodIndex * 7);
  } else {
    // MONTHLY
    startDate.setMonth(startDate.getMonth() + periodIndex);
  }

  return startDate;
}

async function migrate() {
  console.log('='.repeat(60));
  console.log('MIGRATION: PeriodValues → LedgerEntries');
  console.log(`Case: ${CASE_NUMBER}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log('='.repeat(60));

  // 1. Find the case
  const caseEntity = await prisma.case.findFirst({
    where: { caseNumber: CASE_NUMBER },
    include: {
      plans: {
        where: { isActive: true },
        include: {
          categories: {
            include: {
              lines: {
                include: {
                  periodValues: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!caseEntity) {
    console.error(`Case ${CASE_NUMBER} not found!`);
    process.exit(1);
  }

  const plan = caseEntity.plans[0];
  if (!plan) {
    console.error('No active plan found!');
    process.exit(1);
  }

  console.log(`\nCase: ${caseEntity.debtorName} (${caseEntity.id})`);
  console.log(`Plan: ${plan.name} (${plan.periodType}, ${plan.periodCount} periods)`);
  console.log(`Plan Start: ${plan.planStartDate.toISOString()}`);

  // 2. Check if LedgerEntries already exist
  const existingCount = await prisma.ledgerEntry.count({
    where: { caseId: caseEntity.id },
  });

  if (existingCount > 0) {
    console.log(`\n⚠️  Warning: ${existingCount} LedgerEntries already exist for this case.`);
    console.log('Skipping migration to avoid duplicates.');
    console.log('To re-migrate, first delete existing entries.');
    process.exit(0);
  }

  // 3. Collect all PeriodValues with context
  const toMigrate: Array<{
    periodValue: typeof plan.categories[0]['lines'][0]['periodValues'][0];
    line: typeof plan.categories[0]['lines'][0];
    category: typeof plan.categories[0];
    transactionDate: Date;
    amountWithSign: bigint;
    legalBucket: string;
  }> = [];

  for (const category of plan.categories) {
    for (const line of category.lines) {
      for (const pv of line.periodValues) {
        const transactionDate = await calculatePeriodStartDate(
          plan.planStartDate,
          pv.periodIndex,
          plan.periodType
        );

        // Determine amount sign based on flowType
        const amountWithSign =
          category.flowType === 'OUTFLOW'
            ? -BigInt(pv.amountCents)
            : BigInt(pv.amountCents);

        // Map estateType to legalBucket
        // ALTMASSE/NEUMASSE → MASSE (both are part of insolvency estate)
        const legalBucket = 'MASSE';

        toMigrate.push({
          periodValue: pv,
          line,
          category,
          transactionDate,
          amountWithSign,
          legalBucket,
        });
      }
    }
  }

  console.log(`\nFound ${toMigrate.length} PeriodValues to migrate.`);

  // 4. Preview
  console.log('\nPreview (first 10):');
  console.log('-'.repeat(100));
  for (const item of toMigrate.slice(0, 10)) {
    const amount = Number(item.amountWithSign) / 100;
    console.log(
      `${item.transactionDate.toISOString().slice(0, 10)} | ` +
        `${item.line.name.padEnd(30)} | ` +
        `${item.periodValue.valueType.padEnd(4)} | ` +
        `${amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }).padStart(15)}`
    );
  }
  console.log('-'.repeat(100));

  // 5. Verify totals
  const inflowTotal = toMigrate
    .filter((m) => m.category.flowType === 'INFLOW')
    .reduce((sum, m) => sum + BigInt(m.periodValue.amountCents), BigInt(0));

  const outflowTotal = toMigrate
    .filter((m) => m.category.flowType === 'OUTFLOW')
    .reduce((sum, m) => sum + BigInt(m.periodValue.amountCents), BigInt(0));

  console.log(`\nTotals (PeriodValues):`);
  console.log(`  INFLOW:  ${(Number(inflowTotal) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`);
  console.log(`  OUTFLOW: ${(Number(outflowTotal) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`);

  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN - No changes made.');
    process.exit(0);
  }

  // 6. Execute migration
  console.log('\n📝 Creating LedgerEntries...');

  const created = await prisma.$transaction(async (tx) => {
    let count = 0;
    for (const item of toMigrate) {
      await tx.ledgerEntry.create({
        data: {
          caseId: caseEntity.id,
          transactionDate: item.transactionDate,
          amountCents: item.amountWithSign,
          description: item.line.name,
          note: `Migriert aus PeriodValue (${item.category.name})`,
          valueType: item.periodValue.valueType,
          legalBucket: item.legalBucket,
          importSource: 'MIGRATION_FROM_PERIOD_VALUES',
          bookingSource: 'MANUAL',
          createdBy: 'migration-script',
          updatedBy: 'migration-script',
        },
      });
      count++;
    }
    return count;
  });

  console.log(`✅ Created ${created} LedgerEntries.`);

  // 7. Verify
  const ledgerInflowTotal = await prisma.ledgerEntry.aggregate({
    where: {
      caseId: caseEntity.id,
      amountCents: { gte: 0 },
    },
    _sum: { amountCents: true },
  });

  const ledgerOutflowTotal = await prisma.ledgerEntry.aggregate({
    where: {
      caseId: caseEntity.id,
      amountCents: { lt: 0 },
    },
    _sum: { amountCents: true },
  });

  console.log(`\nVerification (LedgerEntries):`);
  console.log(`  INFLOW:  ${((Number(ledgerInflowTotal._sum.amountCents || 0)) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`);
  console.log(`  OUTFLOW: ${((Number(ledgerOutflowTotal._sum.amountCents || 0)) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`);

  const inflowMatch = BigInt(ledgerInflowTotal._sum.amountCents || 0) === inflowTotal;
  const outflowMatch = BigInt(ledgerOutflowTotal._sum.amountCents || 0) === -outflowTotal;

  if (inflowMatch && outflowMatch) {
    console.log('\n✅ VERIFICATION PASSED: Totals match!');
  } else {
    console.log('\n⚠️  VERIFICATION WARNING: Totals do not match!');
    console.log(`  Inflow match: ${inflowMatch}`);
    console.log(`  Outflow match: ${outflowMatch}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Migration complete.');
}

migrate()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
