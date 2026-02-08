/**
 * API: IST/PLAN Vergleich für Dashboard
 *
 * Zeigt IST- und PLAN-Werte nebeneinander pro Periode.
 * WICHTIG: Im Gegensatz zur Liquiditätsmatrix wird hier KEIN IST-Vorrang angewandt -
 * beide Werte werden für alle Perioden angezeigt, um den Vergleich zu ermöglichen.
 *
 * GET /api/cases/[id]/dashboard/ist-plan-comparison
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// =============================================================================
// TYPES
// =============================================================================

export interface ComparisonPeriod {
  periodIndex: number;
  periodLabel: string;
  // IST-Werte (reale Bankbewegungen)
  istInflowsCents: string;
  istOutflowsCents: string;
  istNetCents: string;
  istEntryCount: number;
  // PLAN-Werte (ursprüngliche Planung)
  planInflowsCents: string;
  planOutflowsCents: string;
  planNetCents: string;
  planEntryCount: number;
  // Abweichung (IST - PLAN)
  deviationInflowsCents: string;
  deviationOutflowsCents: string;
  deviationNetCents: string;
  // Prozentuale Abweichung
  deviationInflowsPercent: number | null;  // null wenn PLAN = 0
  deviationOutflowsPercent: number | null;
  deviationNetPercent: number | null;
  // Status
  hasIst: boolean;
  hasPlan: boolean;
}

export interface IstPlanComparisonData {
  caseId: string;
  caseName: string;
  periods: ComparisonPeriod[];
  // Kumulative Summen
  totals: {
    istInflowsCents: string;
    istOutflowsCents: string;
    istNetCents: string;
    planInflowsCents: string;
    planOutflowsCents: string;
    planNetCents: string;
    deviationInflowsCents: string;
    deviationOutflowsCents: string;
    deviationNetCents: string;
  };
  meta: {
    periodType: string;
    periodCount: number;
    planStartDate: string;
    istEntryCount: number;
    planEntryCount: number;
    generatedAt: string;
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getPeriodIndex(date: Date, startDate: Date, periodType: string): number {
  if (periodType === 'MONTHLY') {
    const startMonth = startDate.getFullYear() * 12 + startDate.getMonth();
    const dateMonth = date.getFullYear() * 12 + date.getMonth();
    return dateMonth - startMonth;
  } else {
    const diffMs = date.getTime() - startDate.getTime();
    return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  }
}

function getPeriodLabel(periodIndex: number, startDate: Date, periodType: string): string {
  const periodDate = new Date(startDate);
  if (periodType === 'MONTHLY') {
    periodDate.setMonth(periodDate.getMonth() + periodIndex);
    return periodDate.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
  } else {
    periodDate.setDate(periodDate.getDate() + periodIndex * 7);
    const weekNum = Math.ceil((periodDate.getDate() + new Date(periodDate.getFullYear(), periodDate.getMonth(), 1).getDay()) / 7);
    return `KW ${String(weekNum).padStart(2, '0')}`;
  }
}

function calculatePercent(actual: bigint, baseline: bigint): number | null {
  if (baseline === BigInt(0)) return null;
  return Number((actual * BigInt(10000)) / baseline) / 100;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;

    // 1. Load Case with Plan settings
    const existingCase = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        plans: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!existingCase) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    const plan = existingCase.plans[0];
    if (!plan) {
      return NextResponse.json({ error: 'Kein Liquiditätsplan vorhanden' }, { status: 404 });
    }

    const periodType = plan.periodType || 'MONTHLY';
    const periodCount = plan.periodCount || 10;
    const startDate = plan.planStartDate ? new Date(plan.planStartDate) : new Date();

    // 2. Load all LedgerEntries (nur geprüfte: CONFIRMED, ADJUSTED)
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        caseId,
        reviewStatus: { in: ['CONFIRMED', 'ADJUSTED'] },
      },
      orderBy: { transactionDate: 'asc' },
    });

    // 3. Initialize period aggregations
    interface PeriodAggregation {
      istInflows: bigint;
      istOutflows: bigint;
      istCount: number;
      planInflows: bigint;
      planOutflows: bigint;
      planCount: number;
    }

    const periodData = new Map<number, PeriodAggregation>();
    for (let i = 0; i < periodCount; i++) {
      periodData.set(i, {
        istInflows: BigInt(0),
        istOutflows: BigInt(0),
        istCount: 0,
        planInflows: BigInt(0),
        planOutflows: BigInt(0),
        planCount: 0,
      });
    }

    // 4. Aggregate entries - BEIDE IST und PLAN, ohne Vorrang
    let totalIstEntries = 0;
    let totalPlanEntries = 0;

    for (const entry of entries) {
      const periodIdx = getPeriodIndex(entry.transactionDate, startDate, periodType);
      if (periodIdx < 0 || periodIdx >= periodCount) continue;

      const data = periodData.get(periodIdx)!;
      const amount = entry.amountCents;

      if (entry.valueType === 'IST') {
        totalIstEntries++;
        data.istCount++;
        if (amount >= 0) {
          data.istInflows += amount;
        } else {
          data.istOutflows += amount;  // Negativ
        }
      } else {
        totalPlanEntries++;
        data.planCount++;
        if (amount >= 0) {
          data.planInflows += amount;
        } else {
          data.planOutflows += amount;  // Negativ
        }
      }
    }

    // 5. Build response periods
    const periods: ComparisonPeriod[] = [];
    let totalIstInflows = BigInt(0);
    let totalIstOutflows = BigInt(0);
    let totalPlanInflows = BigInt(0);
    let totalPlanOutflows = BigInt(0);

    for (let i = 0; i < periodCount; i++) {
      const data = periodData.get(i)!;

      const istNet = data.istInflows + data.istOutflows;  // outflows ist negativ
      const planNet = data.planInflows + data.planOutflows;
      const deviationInflows = data.istInflows - data.planInflows;
      const deviationOutflows = data.istOutflows - data.planOutflows;
      const deviationNet = istNet - planNet;

      totalIstInflows += data.istInflows;
      totalIstOutflows += data.istOutflows;
      totalPlanInflows += data.planInflows;
      totalPlanOutflows += data.planOutflows;

      periods.push({
        periodIndex: i,
        periodLabel: getPeriodLabel(i, startDate, periodType),
        // IST
        istInflowsCents: data.istInflows.toString(),
        istOutflowsCents: data.istOutflows.toString(),
        istNetCents: istNet.toString(),
        istEntryCount: data.istCount,
        // PLAN
        planInflowsCents: data.planInflows.toString(),
        planOutflowsCents: data.planOutflows.toString(),
        planNetCents: planNet.toString(),
        planEntryCount: data.planCount,
        // Abweichung
        deviationInflowsCents: deviationInflows.toString(),
        deviationOutflowsCents: deviationOutflows.toString(),
        deviationNetCents: deviationNet.toString(),
        // Prozent
        deviationInflowsPercent: calculatePercent(deviationInflows, data.planInflows),
        deviationOutflowsPercent: calculatePercent(deviationOutflows, data.planOutflows),
        deviationNetPercent: calculatePercent(deviationNet, planNet),
        // Status
        hasIst: data.istCount > 0,
        hasPlan: data.planCount > 0,
      });
    }

    // 6. Calculate totals
    const totalIstNet = totalIstInflows + totalIstOutflows;
    const totalPlanNet = totalPlanInflows + totalPlanOutflows;

    const response: IstPlanComparisonData = {
      caseId,
      caseName: existingCase.debtorName,
      periods,
      totals: {
        istInflowsCents: totalIstInflows.toString(),
        istOutflowsCents: totalIstOutflows.toString(),
        istNetCents: totalIstNet.toString(),
        planInflowsCents: totalPlanInflows.toString(),
        planOutflowsCents: totalPlanOutflows.toString(),
        planNetCents: totalPlanNet.toString(),
        deviationInflowsCents: (totalIstInflows - totalPlanInflows).toString(),
        deviationOutflowsCents: (totalIstOutflows - totalPlanOutflows).toString(),
        deviationNetCents: (totalIstNet - totalPlanNet).toString(),
      },
      meta: {
        periodType,
        periodCount,
        planStartDate: startDate.toISOString().split('T')[0],
        istEntryCount: totalIstEntries,
        planEntryCount: totalPlanEntries,
        generatedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[IST/PLAN Comparison API] Error:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden des Vergleichs', details: String(error) },
      { status: 500 }
    );
  }
}
