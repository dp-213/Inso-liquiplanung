import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { syncPeriodValues } from '@/lib/ledger';

// =============================================================================
// POST /api/cases/[id]/ledger/sync - Sync LedgerEntries to PeriodValues
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

    // Verify case exists and get plan
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

    // Sync LedgerEntries to PeriodValues
    const result = await syncPeriodValues(prisma, caseId, plan.id, session.username);

    const message = result.success
      ? `Synchronisation erfolgreich: ${result.created} erstellt, ${result.updated} aktualisiert`
      : 'Synchronisation fehlgeschlagen';

    return NextResponse.json({
      ...result,
      message,
    });
  } catch (error) {
    console.error('Error syncing ledger to period values:', error);
    return NextResponse.json(
      { error: 'Fehler bei der Synchronisation' },
      { status: 500 }
    );
  }
}
