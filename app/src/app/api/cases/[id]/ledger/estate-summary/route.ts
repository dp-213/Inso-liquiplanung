import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { aggregateEstateAllocation, type LiquidityScope } from '@/lib/ledger/aggregation';

/**
 * GET /api/cases/[id]/ledger/estate-summary
 *
 * Aggregiert Alt/Neu-Masse aus IST LedgerEntries (nicht aus PLAN-Kategorien!)
 *
 * Query-Parameter:
 * - scope: 'GLOBAL' | 'LOCATION_VELBERT' | 'LOCATION_UCKERATH_EITORF'
 * - startDate: ISO-Datum (optional)
 * - endDate: ISO-Datum (optional)
 *
 * Response:
 * {
 *   altmasseInflowCents: string;
 *   altmasseOutflowCents: string;
 *   neumasseInflowCents: string;
 *   neumasseOutflowCents: string;
 *   unklarInflowCents: string;
 *   unklarOutflowCents: string;
 *   unklarCount: number;
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
    const scopeParam = searchParams.get('scope');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const scope = (scopeParam as LiquidityScope) || 'GLOBAL';
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    // Aggregate estate allocation
    const summary = await aggregateEstateAllocation(prisma, caseId, {
      scope,
      startDate,
      endDate,
    });

    // Convert BigInt to string for JSON serialization
    return NextResponse.json({
      altmasseInflowCents: summary.altmasseInflowCents.toString(),
      altmasseOutflowCents: summary.altmasseOutflowCents.toString(),
      neumasseInflowCents: summary.neumasseInflowCents.toString(),
      neumasseOutflowCents: summary.neumasseOutflowCents.toString(),
      unklarInflowCents: summary.unklarInflowCents.toString(),
      unklarOutflowCents: summary.unklarOutflowCents.toString(),
      unklarCount: summary.unklarCount,
    });
  } catch (error) {
    console.error('Fehler bei Estate-Aggregation:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
