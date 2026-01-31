import prisma from '../src/lib/db';

async function fixPlanReviewStatus() {
  console.log('Prüfe PLAN-Einträge mit CONFIRMED Status...\n');

  // Find PLAN entries that are CONFIRMED but have no reviewedBy (not actually reviewed)
  const confirmedWithoutReview = await prisma.ledgerEntry.findMany({
    where: {
      valueType: 'PLAN',
      reviewStatus: 'CONFIRMED',
      reviewedBy: null
    },
    select: {
      id: true,
      description: true,
      importSource: true,
      createdAt: true
    }
  });

  console.log(`Gefunden: ${confirmedWithoutReview.length} PLAN-Einträge mit CONFIRMED Status aber ohne Prüfer`);

  if (confirmedWithoutReview.length === 0) {
    console.log('\nKeine Einträge zu korrigieren.');
    return;
  }

  console.log('\nBeispiele (erste 5):');
  confirmedWithoutReview.slice(0, 5).forEach(e => {
    console.log(`  - ${e.description?.slice(0, 50)}...`);
    console.log(`    Import: ${e.importSource}`);
  });

  // Update all to UNREVIEWED
  const result = await prisma.ledgerEntry.updateMany({
    where: {
      valueType: 'PLAN',
      reviewStatus: 'CONFIRMED',
      reviewedBy: null
    },
    data: {
      reviewStatus: 'UNREVIEWED'
    }
  });

  console.log(`\n✅ ${result.count} Einträge auf UNREVIEWED gesetzt.`);
}

fixPlanReviewStatus()
  .catch(console.error)
  .finally(() => process.exit());
