import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { markAggregationStale, createAuditLog, AUDIT_ACTIONS } from '@/lib/ledger';

// =============================================================================
// POST /api/cases/[id]/ledger/unpair-transfer - Umbuchungs-Verknüpfung aufheben
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
    const body = await request.json();
    const { entryId } = body;

    if (!entryId) {
      return NextResponse.json(
        { error: 'entryId ist erforderlich' },
        { status: 400 }
      );
    }

    // Entry laden
    const entry = await prisma.ledgerEntry.findFirst({
      where: { id: entryId, caseId },
    });

    if (!entry) {
      return NextResponse.json(
        { error: 'Eintrag nicht gefunden' },
        { status: 404 }
      );
    }

    if (!entry.transferPartnerEntryId) {
      return NextResponse.json(
        { error: 'Eintrag ist nicht als Umbuchung verknüpft' },
        { status: 400 }
      );
    }

    const partnerId = entry.transferPartnerEntryId;

    // Partner laden (könnte bereits gelöscht sein)
    const partner = await prisma.ledgerEntry.findUnique({
      where: { id: partnerId },
    });

    // Symmetrische Aufhebung
    const updates = [
      prisma.ledgerEntry.update({
        where: { id: entryId },
        data: { transferPartnerEntryId: null },
      }),
    ];

    if (partner) {
      updates.push(
        prisma.ledgerEntry.update({
          where: { id: partnerId },
          data: { transferPartnerEntryId: null },
        })
      );
    }

    await prisma.$transaction(updates);

    // Audit-Logs
    const auditPromises = [
      createAuditLog(prisma, {
        ledgerEntryId: entryId,
        caseId,
        action: AUDIT_ACTIONS.UPDATED,
        fieldChanges: {
          transferPartnerEntryId: { old: partnerId, new: null },
        },
        reason: 'Umbuchungs-Verknüpfung aufgehoben',
        userId: session.username,
      }),
    ];

    if (partner) {
      auditPromises.push(
        createAuditLog(prisma, {
          ledgerEntryId: partnerId,
          caseId,
          action: AUDIT_ACTIONS.UPDATED,
          fieldChanges: {
            transferPartnerEntryId: { old: entryId, new: null },
          },
          reason: 'Umbuchungs-Verknüpfung aufgehoben',
          userId: session.username,
        })
      );
    }

    await Promise.all(auditPromises);

    // Aggregation als stale markieren
    await markAggregationStale(prisma, caseId);

    return NextResponse.json({
      success: true,
      message: 'Umbuchungs-Verknüpfung aufgehoben',
    });
  } catch (error) {
    console.error('Error unpairing transfer entries:', error);
    return NextResponse.json(
      { error: 'Fehler beim Aufheben der Umbuchungs-Verknüpfung' },
      { status: 500 }
    );
  }
}
