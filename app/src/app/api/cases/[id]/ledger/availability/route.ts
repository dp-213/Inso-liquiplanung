import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { aggregateByAvailability } from '@/lib/ledger/aggregation';

/**
 * GET /api/cases/[id]/ledger/availability
 *
 * Aggregiert Liquidität nach Verfügbarkeit (verfügbar vs. gebunden)
 *
 * Query-Parameter:
 * - periods: Anzahl der Perioden (default: aus Plan)
 *
 * Response: {
 *   periods: Array<{
 *     periodIndex: number;
 *     periodLabel: string;
 *     periodStart: string;
 *     available: string;    // Verfügbar (MASSE, NEUTRAL)
 *     encumbered: string;   // Gebunden (ABSONDERUNG)
 *     total: string;
 *   }>
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { id: caseId } = await params;
    const { searchParams } = new URL(request.url);
    const periodsParam = searchParams.get('periods');
    const periodCount = periodsParam ? parseInt(periodsParam, 10) : undefined;

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

    // Aggregate by availability
    const periods = await aggregateByAvailability(
      prisma,
      caseId,
      plan.id,
      periodCount
    );

    // Convert BigInt to string for JSON serialization
    const serializedPeriods = periods.map((p) => ({
      periodIndex: p.periodIndex,
      periodLabel: p.periodLabel,
      periodStart: p.periodStart.toISOString(),
      available: p.available.toString(),
      encumbered: p.encumbered.toString(),
      total: p.total.toString(),
    }));

    return NextResponse.json({
      periods: serializedPeriods,
      periodType: plan.periodType,
      periodCount: periods.length,
    });
  } catch (error) {
    console.error('Fehler bei Availability-Aggregation:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
