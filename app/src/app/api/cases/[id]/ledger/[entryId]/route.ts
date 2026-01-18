import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  LedgerEntryResponse,
  deriveFlowType,
  VALUE_TYPES,
  LEGAL_BUCKETS,
  LegalBucket,
  ValueType,
  ReviewStatus,
  markAggregationStale,
  createAuditLog,
  AUDIT_ACTIONS,
} from '@/lib/ledger';
import { LedgerEntry } from '@prisma/client';

/**
 * Serialize a LedgerEntry to LedgerEntryResponse (including governance fields)
 */
function serializeLedgerEntry(entry: LedgerEntry): LedgerEntryResponse {
  return {
    id: entry.id,
    caseId: entry.caseId,
    transactionDate: entry.transactionDate.toISOString(),
    amountCents: entry.amountCents.toString(),
    description: entry.description,
    note: entry.note,
    valueType: entry.valueType as ValueType,
    legalBucket: entry.legalBucket as LegalBucket,
    importSource: entry.importSource,
    importJobId: entry.importJobId,
    importFileHash: entry.importFileHash,
    importRowNumber: entry.importRowNumber,
    bookingSource: entry.bookingSource,
    bookingSourceId: entry.bookingSourceId,
    bookingReference: entry.bookingReference,
    // Governance fields
    reviewStatus: entry.reviewStatus as ReviewStatus,
    reviewedBy: entry.reviewedBy,
    reviewedAt: entry.reviewedAt?.toISOString() || null,
    reviewNote: entry.reviewNote,
    changeReason: entry.changeReason,
    previousAmountCents: entry.previousAmountCents?.toString() || null,
    // Audit
    createdAt: entry.createdAt.toISOString(),
    createdBy: entry.createdBy,
    updatedAt: entry.updatedAt.toISOString(),
    updatedBy: entry.updatedBy,
    // Derived
    flowType: deriveFlowType(BigInt(entry.amountCents)),
  };
}

// =============================================================================
// GET /api/cases/[id]/ledger/[entryId] - Get a single LedgerEntry
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId, entryId } = await params;

    const entry = await prisma.ledgerEntry.findFirst({
      where: { id: entryId, caseId },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Eintrag nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json(serializeLedgerEntry(entry));
  } catch (error) {
    console.error('Error fetching ledger entry:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden des Ledger-Eintrags' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT /api/cases/[id]/ledger/[entryId] - Update a LedgerEntry
// =============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId, entryId } = await params;
    const body = await request.json();

    // Verify entry exists and belongs to case
    const existing = await prisma.ledgerEntry.findFirst({
      where: { id: entryId, caseId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Eintrag nicht gefunden' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedBy: session.username,
    };

    if (body.transactionDate !== undefined) {
      updateData.transactionDate = new Date(body.transactionDate);
    }

    if (body.amountCents !== undefined) {
      updateData.amountCents = BigInt(body.amountCents);
    }

    if (body.description !== undefined) {
      updateData.description = body.description;
    }

    if (body.note !== undefined) {
      updateData.note = body.note;
    }

    if (body.valueType !== undefined) {
      if (!Object.values(VALUE_TYPES).includes(body.valueType)) {
        return NextResponse.json(
          { error: 'Ungültiger valueType. Erlaubt: IST, PLAN' },
          { status: 400 }
        );
      }
      updateData.valueType = body.valueType;
    }

    if (body.legalBucket !== undefined) {
      if (!Object.values(LEGAL_BUCKETS).includes(body.legalBucket)) {
        return NextResponse.json(
          { error: 'Ungültiger legalBucket. Erlaubt: MASSE, ABSONDERUNG, NEUTRAL, UNKNOWN' },
          { status: 400 }
        );
      }
      updateData.legalBucket = body.legalBucket;
    }

    if (body.bookingSource !== undefined) {
      updateData.bookingSource = body.bookingSource;
    }

    if (body.bookingSourceId !== undefined) {
      updateData.bookingSourceId = body.bookingSourceId;
    }

    if (body.bookingReference !== undefined) {
      updateData.bookingReference = body.bookingReference;
    }

    // Build field changes for audit log
    const fieldChanges: Record<string, { old: string | number | null; new: string | number | null }> = {};

    if (body.amountCents !== undefined && existing.amountCents.toString() !== body.amountCents.toString()) {
      fieldChanges.amountCents = { old: existing.amountCents.toString(), new: body.amountCents.toString() };
    }
    if (body.description !== undefined && existing.description !== body.description) {
      fieldChanges.description = { old: existing.description, new: body.description };
    }
    if (body.legalBucket !== undefined && existing.legalBucket !== body.legalBucket) {
      fieldChanges.legalBucket = { old: existing.legalBucket, new: body.legalBucket };
    }
    if (body.transactionDate !== undefined) {
      const newDate = new Date(body.transactionDate).toISOString();
      if (existing.transactionDate.toISOString() !== newDate) {
        fieldChanges.transactionDate = { old: existing.transactionDate.toISOString(), new: newDate };
      }
    }

    // Update entry
    const entry = await prisma.ledgerEntry.update({
      where: { id: entryId },
      data: updateData,
    });

    // Create audit log if there were changes
    if (Object.keys(fieldChanges).length > 0) {
      await createAuditLog(prisma, {
        ledgerEntryId: entryId,
        caseId,
        action: AUDIT_ACTIONS.UPDATED,
        fieldChanges,
        userId: session.username,
      });

      // Mark aggregation as stale
      await markAggregationStale(prisma, caseId);
    }

    return NextResponse.json(serializeLedgerEntry(entry));
  } catch (error) {
    console.error('Error updating ledger entry:', error);
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren des Ledger-Eintrags' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/cases/[id]/ledger/[entryId] - Delete a LedgerEntry
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId, entryId } = await params;

    // Verify entry exists and belongs to case
    const existing = await prisma.ledgerEntry.findFirst({
      where: { id: entryId, caseId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Eintrag nicht gefunden' }, { status: 404 });
    }

    // Delete entry
    await prisma.ledgerEntry.delete({
      where: { id: entryId },
    });

    return NextResponse.json({ success: true, message: 'Eintrag gelöscht' });
  } catch (error) {
    console.error('Error deleting ledger entry:', error);
    return NextResponse.json(
      { error: 'Fehler beim Löschen des Ledger-Eintrags' },
      { status: 500 }
    );
  }
}
