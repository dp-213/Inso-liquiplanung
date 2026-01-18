import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { rebuildAggregation } from '@/lib/ledger';

// =============================================================================
// POST /api/cases/[id]/aggregation/rebuild - Trigger aggregation rebuild
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId } = await params;
    const body = await request.json().catch(() => ({}));
    const planId = body.planId;

    // Verify case exists
    const caseEntity = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        plans: planId
          ? { where: { id: planId } }
          : { where: { isActive: true }, take: 1 },
      },
    });

    if (!caseEntity) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    if (caseEntity.plans.length === 0) {
      return NextResponse.json(
        {
          error: planId
            ? 'Plan nicht gefunden'
            : 'Kein aktiver Plan gefunden. Bitte erstellen Sie zuerst einen Plan.',
        },
        { status: 404 }
      );
    }

    const targetPlan = caseEntity.plans[0];

    // Trigger rebuild
    const result = await rebuildAggregation(
      prisma,
      caseId,
      targetPlan.id,
      session.username
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Fehler bei der Neuberechnung' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      planId: targetPlan.id,
      planName: targetPlan.name,
      entriesProcessed: result.entriesProcessed,
      periodValuesCreated: result.periodValuesCreated,
    });
  } catch (error) {
    console.error('Error rebuilding aggregation:', error);
    return NextResponse.json(
      { error: 'Fehler bei der Neuberechnung der Aggregation' },
      { status: 500 }
    );
  }
}
