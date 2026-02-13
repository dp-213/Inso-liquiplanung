/**
 * API: IST/PLAN Vergleich für Dashboard
 *
 * Zeigt IST- und PLAN-Werte nebeneinander pro Periode.
 * WICHTIG: Im Gegensatz zur Liquiditätsmatrix wird hier KEIN IST-Vorrang angewandt -
 * beide Werte werden für alle Perioden angezeigt, um den Vergleich zu ermöglichen.
 *
 * GET /api/cases/[id]/dashboard/ist-plan-comparison
 * Query-Parameter:
 * - scope: GLOBAL | LOCATION_VELBERT | LOCATION_UCKERATH_EITORF
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getCustomerSession, checkCaseAccess } from '@/lib/customer-auth';
import { EXCLUDE_SPLIT_PARENTS } from '@/lib/ledger/types';
import {
  filterEntriesByScope,
  type LiquidityScope,
} from '@/lib/cases/haevg-plus/matrix-config';

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
  // Kumulierte Abweichung
  cumulativeDeviationNetCents: string;
  // Status
  hasIst: boolean;
  hasPlan: boolean;
}

export interface IstPlanComparisonData {
  caseId: string;
  caseName: string;
  scope: LiquidityScope;
  periods: ComparisonPeriod[];
  // Totals: NUR über Perioden wo IST UND PLAN vorliegen (Overlap)
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
    deviationInflowsPercent: number | null;
    deviationOutflowsPercent: number | null;
    deviationNetPercent: number | null;
    overlapPeriodCount: number; // Anzahl Perioden mit IST+PLAN
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

/**
 * Prozentuale Abweichung: actual / |baseline| * 100
 * Wir dividieren durch den Absolutwert, damit das Vorzeichen des Prozents
 * immer dem Vorzeichen der Abweichung folgt – auch bei negativen Baselines
 * (Outflows). Ohne abs() wäre z.B. +5k / -35k = -14,3% (falsch negativ).
 */
function calculatePercent(actual: bigint, baseline: bigint): number | null {
  if (baseline === BigInt(0)) return null;
  const absBaseline = baseline < BigInt(0) ? -baseline : baseline;
  return Number((actual * BigInt(10000)) / absBaseline) / 100;
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
    const { searchParams } = new URL(request.url);

    // Auth: Prüfe Admin- ODER Customer-Session
    const adminSession = await getSession();
    const customerSession = await getCustomerSession();

    if (!adminSession && !customerSession) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    if (customerSession && !adminSession) {
      const access = await checkCaseAccess(customerSession.customerId, caseId);
      if (!access.hasAccess) {
        return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 });
      }
    }

    // Scope-Parameter
    const scopeParam = searchParams.get('scope') || 'GLOBAL';
    const scope: LiquidityScope = ['GLOBAL', 'LOCATION_VELBERT', 'LOCATION_UCKERATH_EITORF'].includes(scopeParam)
      ? (scopeParam as LiquidityScope)
      : 'GLOBAL';

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
    const allEntries = await prisma.ledgerEntry.findMany({
      where: {
        caseId,
        ...EXCLUDE_SPLIT_PARENTS,
        reviewStatus: { in: ['CONFIRMED', 'ADJUSTED'] },
      },
      orderBy: { transactionDate: 'asc' },
    });

    // 3. Scope-Filterung anwenden
    const entries = filterEntriesByScope(allEntries, scope);

    // 4. Initialize period aggregations
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

    // 5. Aggregate entries - BEIDE IST und PLAN, ohne Vorrang
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
          data.istOutflows += amount;
        }
      } else {
        totalPlanEntries++;
        data.planCount++;
        if (amount >= 0) {
          data.planInflows += amount;
        } else {
          data.planOutflows += amount;
        }
      }
    }

    // 6. Build response periods mit kumulierter Abweichung
    const periods: ComparisonPeriod[] = [];
    let cumulativeDeviationNet = BigInt(0);

    // Overlap-Totals: nur Perioden wo IST UND PLAN existieren
    let overlapIstInflows = BigInt(0);
    let overlapIstOutflows = BigInt(0);
    let overlapPlanInflows = BigInt(0);
    let overlapPlanOutflows = BigInt(0);
    let overlapPeriodCount = 0;

    for (let i = 0; i < periodCount; i++) {
      const data = periodData.get(i)!;

      const istNet = data.istInflows + data.istOutflows;
      const planNet = data.planInflows + data.planOutflows;
      const deviationInflows = data.istInflows - data.planInflows;
      const deviationOutflows = data.istOutflows - data.planOutflows;
      const deviationNet = istNet - planNet;

      const hasIst = data.istCount > 0;
      const hasPlan = data.planCount > 0;

      // Kumulierte Abweichung nur für Overlap-Perioden
      if (hasIst && hasPlan) {
        cumulativeDeviationNet += deviationNet;
        overlapIstInflows += data.istInflows;
        overlapIstOutflows += data.istOutflows;
        overlapPlanInflows += data.planInflows;
        overlapPlanOutflows += data.planOutflows;
        overlapPeriodCount++;
      }

      periods.push({
        periodIndex: i,
        periodLabel: getPeriodLabel(i, startDate, periodType),
        istInflowsCents: data.istInflows.toString(),
        istOutflowsCents: data.istOutflows.toString(),
        istNetCents: istNet.toString(),
        istEntryCount: data.istCount,
        planInflowsCents: data.planInflows.toString(),
        planOutflowsCents: data.planOutflows.toString(),
        planNetCents: planNet.toString(),
        planEntryCount: data.planCount,
        deviationInflowsCents: deviationInflows.toString(),
        deviationOutflowsCents: deviationOutflows.toString(),
        deviationNetCents: deviationNet.toString(),
        deviationInflowsPercent: (hasIst && hasPlan) ? calculatePercent(deviationInflows, data.planInflows) : null,
        deviationOutflowsPercent: (hasIst && hasPlan) ? calculatePercent(deviationOutflows, data.planOutflows) : null,
        deviationNetPercent: (hasIst && hasPlan) ? calculatePercent(deviationNet, planNet) : null,
        cumulativeDeviationNetCents: cumulativeDeviationNet.toString(),
        hasIst,
        hasPlan,
      });
    }

    // 7. Totals nur über Overlap-Perioden (vergleichbare Basis)
    const overlapIstNet = overlapIstInflows + overlapIstOutflows;
    const overlapPlanNet = overlapPlanInflows + overlapPlanOutflows;
    const overlapDeviationInflows = overlapIstInflows - overlapPlanInflows;
    const overlapDeviationOutflows = overlapIstOutflows - overlapPlanOutflows;
    const overlapDeviationNet = overlapIstNet - overlapPlanNet;

    const response: IstPlanComparisonData = {
      caseId,
      caseName: existingCase.debtorName,
      scope,
      periods,
      totals: {
        istInflowsCents: overlapIstInflows.toString(),
        istOutflowsCents: overlapIstOutflows.toString(),
        istNetCents: overlapIstNet.toString(),
        planInflowsCents: overlapPlanInflows.toString(),
        planOutflowsCents: overlapPlanOutflows.toString(),
        planNetCents: overlapPlanNet.toString(),
        deviationInflowsCents: overlapDeviationInflows.toString(),
        deviationOutflowsCents: overlapDeviationOutflows.toString(),
        deviationNetCents: overlapDeviationNet.toString(),
        deviationInflowsPercent: calculatePercent(overlapDeviationInflows, overlapPlanInflows),
        deviationOutflowsPercent: calculatePercent(overlapDeviationOutflows, overlapPlanOutflows),
        deviationNetPercent: calculatePercent(overlapDeviationNet, overlapPlanNet),
        overlapPeriodCount,
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
