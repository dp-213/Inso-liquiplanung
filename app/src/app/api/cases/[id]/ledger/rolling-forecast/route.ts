import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getCustomerSession, checkCaseAccess } from '@/lib/customer-auth';
import { aggregateRollingForecast } from '@/lib/ledger/aggregation';
import { loadAndCalculateForecast } from '@/lib/forecast/load-and-calculate';

/**
 * GET /api/cases/[id]/ledger/rolling-forecast
 *
 * Rolling Forecast: IST für Vergangenheit, FORECAST/PLAN für Zukunft
 *
 * Logic:
 * - Perioden mit IST-Daten: IST-Werte (echte Bankbuchungen)
 * - Perioden ohne IST-Daten: FORECAST (aus Annahmen) oder PLAN (Legacy-Fallback)
 * - Wenn ForecastScenario mit aktiven Annahmen existiert: FORECAST ersetzt PLAN
 *
 * Response: {
 *   openingBalanceCents: string;
 *   todayPeriodIndex: number;
 *   totalIstPeriods: number;
 *   totalPlanPeriods: number;
 *   hasForecast: boolean;
 *   forecastMeta: { scenarioName, assumptionCount, creditLineCents, reservesTotalCents } | null;
 *   periods: Array<{
 *     periodIndex: number;
 *     periodLabel: string;
 *     periodStart: string;
 *     periodEnd: string;
 *     openingBalanceCents: string;
 *     inflowsCents: string;
 *     outflowsCents: string;
 *     netCashflowCents: string;
 *     closingBalanceCents: string;
 *     source: 'IST' | 'PLAN' | 'FORECAST' | 'MIXED';
 *     istCount: number;
 *     planCount: number;
 *     isPast: boolean;
 *   }>
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;

    // Auth: Prüfe Admin- ODER Customer-Session
    const adminSession = await getSession();
    const customerSession = await getCustomerSession();

    if (!adminSession && !customerSession) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    // Falls Customer-Session: Prüfe Case-Access
    if (customerSession && !adminSession) {
      const access = await checkCaseAccess(customerSession.customerId, caseId);
      if (!access.hasAccess) {
        return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 });
      }
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const includeUnreviewed = searchParams.get('includeUnreviewed') === 'true';
    const scopeParam = searchParams.get('scope') || 'GLOBAL';
    const scope = ['GLOBAL', 'LOCATION_VELBERT', 'LOCATION_UCKERATH_EITORF'].includes(scopeParam)
      ? scopeParam as 'GLOBAL' | 'LOCATION_VELBERT' | 'LOCATION_UCKERATH_EITORF'
      : 'GLOBAL';

    // Get active plan for case
    const plan = await prisma.liquidityPlan.findFirst({
      where: { caseId, isActive: true },
      select: { id: true, periodType: true, periodCount: true },
    });

    if (!plan) {
      return NextResponse.json(
        { error: 'Kein aktiver Liquiditätsplan für diesen Fall' },
        { status: 404 }
      );
    }

    // Aggregate rolling forecast with filter option (IST + PLAN wie bisher)
    const result = await aggregateRollingForecast(prisma, caseId, plan.id, {
      includeUnreviewed,
      scope,
      excludeSteeringTags: ['INTERNE_UMBUCHUNG'],
    });

    // DESIGN RULE: Planning code must never use BankAccount opening balances
    // Liquiditätsplanung ist cashflow-basiert und startet immer bei 0 EUR.
    result.openingBalanceCents = BigInt(0);

    // ================================================================
    // FORECAST-INTEGRATION: Für PLAN-Perioden Forecast-Daten einspeisen
    // ================================================================

    let hasForecast = false;
    let forecastMeta: {
      scenarioName: string;
      assumptionCount: number;
      creditLineCents: string;
      reservesTotalCents: string;
    } | null = null;

    // Nur für GLOBAL-Scope: Forecast laden (Standort-Scopes nutzen weiterhin PLAN)
    if (scope === 'GLOBAL') {
      try {
        const forecast = await loadAndCalculateForecast(caseId);

        if (forecast) {
          hasForecast = true;
          forecastMeta = {
            scenarioName: forecast.meta.scenarioName,
            assumptionCount: forecast.meta.assumptionCount,
            creditLineCents: forecast.meta.creditLineCents,
            reservesTotalCents: forecast.meta.reservesTotalCents,
          };

          // Forecast-Perioden als Map: periodIndex → { cashIn, cashOut }
          const forecastPeriodMap = new Map<number, { cashIn: bigint; cashOut: bigint }>();
          for (const fp of forecast.result.periods) {
            if (fp.dataSource === 'FORECAST') {
              forecastPeriodMap.set(fp.periodIndex, {
                cashIn: fp.cashInTotalCents,
                cashOut: fp.cashOutTotalCents,  // Bereits negativ
              });
            }
          }

          // PLAN-Perioden durch FORECAST ersetzen
          // Running balance muss neu berechnet werden ab dem ersten ersetzten Punkt
          let needsRebalance = false;

          for (const period of result.periods) {
            // Nur PLAN-Perioden ersetzen (nicht IST oder MIXED)
            if (period.source === 'PLAN' && forecastPeriodMap.has(period.periodIndex)) {
              const fc = forecastPeriodMap.get(period.periodIndex)!;

              period.inflowsCents = fc.cashIn;
              period.outflowsCents = fc.cashOut;
              period.planInflowsCents = BigInt(0);
              period.planOutflowsCents = BigInt(0);
              period.planCount = 0;
              (period as Record<string, unknown>).source = 'FORECAST';

              needsRebalance = true;
            }
          }

          // Running balance neu berechnen wenn FORECAST-Daten eingesetzt wurden
          if (needsRebalance) {
            let runningBalance = result.openingBalanceCents;
            for (const period of result.periods) {
              period.openingBalanceCents = runningBalance;
              period.netCashflowCents = period.inflowsCents + period.outflowsCents;
              period.closingBalanceCents = period.openingBalanceCents + period.netCashflowCents;
              runningBalance = period.closingBalanceCents;
            }
          }
        }
      } catch (err) {
        // Forecast-Fehler sollten nicht die gesamte API blockieren
        console.error('[Rolling Forecast] Forecast-Integration fehlgeschlagen:', err);
      }
    }

    // Recount IST/PLAN/FORECAST totals
    let totalIstPeriods = 0;
    let totalPlanPeriods = 0;
    let totalForecastPeriods = 0;
    for (const p of result.periods) {
      if (p.source === 'IST' || p.source === 'MIXED') totalIstPeriods++;
      else if ((p as Record<string, unknown>).source === 'FORECAST') totalForecastPeriods++;
      else totalPlanPeriods++;
    }

    // Serialize BigInt values
    const serialized = {
      caseId: result.caseId,
      planId: result.planId,
      calculatedAt: result.calculatedAt,
      openingBalanceCents: result.openingBalanceCents.toString(),
      todayPeriodIndex: result.todayPeriodIndex,
      totalIstPeriods,
      totalPlanPeriods,
      totalForecastPeriods,
      periodType: plan.periodType,
      periodCount: plan.periodCount,
      // Forecast info
      hasForecast,
      forecastMeta,
      // Filter info for UI
      includeUnreviewed: result.includeUnreviewed,
      unreviewedCount: result.unreviewedCount,
      totalEntryCount: result.totalEntryCount,
      periods: result.periods.map((p) => ({
        periodIndex: p.periodIndex,
        periodLabel: p.periodLabel,
        periodStart: p.periodStart.toISOString(),
        periodEnd: p.periodEnd.toISOString(),
        openingBalanceCents: p.openingBalanceCents.toString(),
        inflowsCents: p.inflowsCents.toString(),
        outflowsCents: p.outflowsCents.toString(),
        netCashflowCents: p.netCashflowCents.toString(),
        closingBalanceCents: p.closingBalanceCents.toString(),
        source: p.source,
        istCount: p.istCount,
        planCount: p.planCount,
        isPast: p.isPast,
        // Additional transparency
        istInflowsCents: p.istInflowsCents.toString(),
        istOutflowsCents: p.istOutflowsCents.toString(),
        planInflowsCents: p.planInflowsCents.toString(),
        planOutflowsCents: p.planOutflowsCents.toString(),
      })),
    };

    return NextResponse.json(serialized);
  } catch (error) {
    console.error('Fehler bei Rolling Forecast:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
