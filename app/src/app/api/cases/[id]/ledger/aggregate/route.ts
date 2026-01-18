import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { aggregateLedgerEntries } from '@/lib/ledger';

// =============================================================================
// GET /api/cases/[id]/ledger/aggregate - Get aggregated values for a plan
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
    const planId = searchParams.get('planId');

    // Verify case exists
    const caseEntity = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        plans: {
          where: planId ? { id: planId } : { isActive: true },
          take: 1,
        },
      },
    });

    if (!caseEntity) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    if (caseEntity.plans.length === 0) {
      return NextResponse.json(
        { error: planId ? 'Plan nicht gefunden' : 'Kein aktiver Plan gefunden' },
        { status: 404 }
      );
    }

    const plan = caseEntity.plans[0];

    // Get aggregation
    const aggregation = await aggregateLedgerEntries(prisma, caseId, plan.id);

    // Transform BigInt to string for JSON serialization
    const response = {
      ...aggregation,
      totalInflows: aggregation.totalInflows.toString(),
      totalOutflows: aggregation.totalOutflows.toString(),
      periods: aggregation.periods.map((p) => ({
        ...p,
        totalAmountCents: p.totalAmountCents.toString(),
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error aggregating ledger entries:', error);
    return NextResponse.json(
      { error: 'Fehler bei der Aggregation der Ledger-Einträge' },
      { status: 500 }
    );
  }
}
