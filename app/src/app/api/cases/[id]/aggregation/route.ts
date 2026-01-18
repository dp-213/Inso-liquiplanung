import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  checkAggregationStatus,
  getAggregationStats,
} from '@/lib/ledger';

// =============================================================================
// GET /api/cases/[id]/aggregation - Get aggregation status for a case
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId } = await params;
    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('stats') === 'true';

    // Verify case exists and get active plan
    const caseEntity = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        plans: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!caseEntity) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    const activePlan = caseEntity.plans[0];

    // Get aggregation status
    const status = await checkAggregationStatus(prisma, caseId);

    // Optionally include stats
    let stats = null;
    if (includeStats && activePlan) {
      stats = await getAggregationStats(prisma, caseId, activePlan.id);
    }

    return NextResponse.json({
      ...status,
      activePlanId: activePlan?.id || null,
      activePlanName: activePlan?.name || null,
      stats,
    });
  } catch (error) {
    console.error('Error checking aggregation status:', error);
    return NextResponse.json(
      { error: 'Fehler beim Prüfen des Aggregations-Status' },
      { status: 500 }
    );
  }
}
