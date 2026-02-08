import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getCustomerSession, checkCaseAccess } from '@/lib/customer-auth';
import { aggregateRollingForecast } from '@/lib/ledger/aggregation';

/**
 * GET /api/cases/[id]/ledger/rolling-forecast
 *
 * Rolling Forecast: IST für Vergangenheit, PLAN für Zukunft
 *
 * Logic:
 * - Perioden vor heute: IST-Werte (echte Bankbuchungen)
 * - Perioden nach heute: PLAN-Werte (Prognose)
 * - Sobald IST-Daten für eine Periode existieren, ersetzen sie PLAN
 *
 * Response: {
 *   openingBalanceCents: string;
 *   todayPeriodIndex: number;
 *   totalIstPeriods: number;
 *   totalPlanPeriods: number;
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
 *     source: 'IST' | 'PLAN' | 'MIXED';
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

    // Aggregate rolling forecast with filter option
    const result = await aggregateRollingForecast(prisma, caseId, plan.id, {
      includeUnreviewed,
      scope,
      excludeSteeringTags: ['INTERNE_UMBUCHUNG'],  // Umbuchungen ausblenden
    });

    // Serialize BigInt values
    const serialized = {
      caseId: result.caseId,
      planId: result.planId,
      calculatedAt: result.calculatedAt,
      openingBalanceCents: result.openingBalanceCents.toString(),
      todayPeriodIndex: result.todayPeriodIndex,
      totalIstPeriods: result.totalIstPeriods,
      totalPlanPeriods: result.totalPlanPeriods,
      periodType: plan.periodType,
      periodCount: plan.periodCount,
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
