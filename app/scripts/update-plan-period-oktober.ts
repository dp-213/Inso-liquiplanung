/**
 * Update Plan Period: Oktober 2025 - August 2026 (11 Monate)
 *
 * Korrektur des Plan-Zeitraums:
 * - ALT: November 2025 - August 2026 (10 Monate)
 * - NEU: Oktober 2025 - August 2026 (11 Monate)
 *
 * Begründung: Oktober-Daten sind jetzt verfügbar und sollten im Plan erscheinen.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CASE_NUMBER = '70d IN 362/25';

async function main() {
  console.log('=== UPDATE: Plan-Zeitraum auf Okt 2025 - Aug 2026 ===\n');

  // Find case
  const hvCase = await prisma.case.findFirst({ where: { caseNumber: CASE_NUMBER } });
  if (!hvCase) {
    console.error('Case nicht gefunden:', CASE_NUMBER);
    return;
  }
  console.log('Case:', hvCase.debtorName);

  // Find active plan
  const plan = await prisma.liquidityPlan.findFirst({
    where: { caseId: hvCase.id, isActive: true }
  });

  if (!plan) {
    console.error('Kein aktiver Plan gefunden!');
    return;
  }

  console.log('\nAktueller Plan:');
  console.log('  Name:', plan.name);
  console.log('  Start:', plan.planStartDate.toISOString().split('T')[0]);
  console.log('  Perioden:', plan.periodCount);

  // Update plan
  const updatedPlan = await prisma.liquidityPlan.update({
    where: { id: plan.id },
    data: {
      name: 'Liquiditätsplanung Okt 2025 - Aug 2026',
      planStartDate: new Date('2025-10-01'),
      periodCount: 11, // Okt, Nov, Dez 2025 + Jan-Aug 2026
      description: 'Liquiditätsplanung ab Oktober 2025 (IST-Daten verfügbar) bis August 2026.',
    }
  });

  console.log('\nAktualisierter Plan:');
  console.log('  Name:', updatedPlan.name);
  console.log('  Start:', updatedPlan.planStartDate.toISOString().split('T')[0]);
  console.log('  Perioden:', updatedPlan.periodCount);

  // Update assumption about data availability
  const existingAssumption = await prisma.planningAssumption.findFirst({
    where: {
      planId: plan.id,
      categoryName: 'Datenbasis'
    }
  });

  if (existingAssumption) {
    await prisma.planningAssumption.update({
      where: { id: existingAssumption.id },
      data: {
        description: 'IST-Daten: Okt-Dez 2025 (Kontoauszüge Sparkasse + apoBank). PLAN-Daten: Okt 2025 - Aug 2026. KEINE Daten für Jan-Sep 2025 (vor Insolvenz).',
      }
    });
    console.log('\nPrämisse "Datenbasis" aktualisiert');
  }

  console.log('\n=== FERTIG ===');
  console.log('Dashboard-URL: http://localhost:3000/admin/cases/' + hvCase.id + '/results');
}

main().catch(console.error).finally(() => prisma.$disconnect());
