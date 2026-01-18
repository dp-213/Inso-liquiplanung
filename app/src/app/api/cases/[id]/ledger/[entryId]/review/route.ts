import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  processReview,
  markAggregationStale,
  LedgerEntryResponse,
  deriveFlowType,
  ValueType,
  LegalBucket,
  ReviewStatus,
  REVIEW_STATUS,
  LEGAL_BUCKETS,
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
    reviewStatus: entry.reviewStatus as ReviewStatus,
    reviewedBy: entry.reviewedBy,
    reviewedAt: entry.reviewedAt?.toISOString() || null,
    reviewNote: entry.reviewNote,
    changeReason: entry.changeReason,
    previousAmountCents: entry.previousAmountCents?.toString() || null,
    createdAt: entry.createdAt.toISOString(),
    createdBy: entry.createdBy,
    updatedAt: entry.updatedAt.toISOString(),
    updatedBy: entry.updatedBy,
    flowType: deriveFlowType(BigInt(entry.amountCents)),
  };
}

// =============================================================================
// POST /api/cases/[id]/ledger/[entryId]/review - Review a LedgerEntry
// =============================================================================

export async function POST(
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

    // Validate action
    const { action } = body;
    if (!action || !['CONFIRM', 'ADJUST'].includes(action)) {
      return NextResponse.json(
        { error: 'Ungültige Aktion. Erlaubt: CONFIRM, ADJUST' },
        { status: 400 }
      );
    }

    // Verify entry exists and belongs to case
    const existing = await prisma.ledgerEntry.findFirst({
      where: { id: entryId, caseId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Eintrag nicht gefunden' },
        { status: 404 }
      );
    }

    // Build review input
    if (action === 'CONFIRM') {
      const input = {
        action: 'CONFIRM' as const,
        note: body.note || undefined,
      };

      const updatedEntry = await processReview(
        prisma,
        entryId,
        session.username,
        input
      );

      return NextResponse.json(serializeLedgerEntry(updatedEntry));
    } else {
      // ADJUST
      if (!body.reason || body.reason.trim() === '') {
        return NextResponse.json(
          { error: 'Begründung ist bei Korrekturen erforderlich' },
          { status: 400 }
        );
      }

      const changes: {
        amountCents?: bigint;
        description?: string;
        legalBucket?: LegalBucket;
        transactionDate?: Date;
      } = {};

      if (body.amountCents !== undefined) {
        changes.amountCents = BigInt(body.amountCents);
      }

      if (body.description !== undefined) {
        changes.description = body.description;
      }

      if (body.legalBucket !== undefined) {
        if (!Object.values(LEGAL_BUCKETS).includes(body.legalBucket)) {
          return NextResponse.json(
            {
              error:
                'Ungültiger legalBucket. Erlaubt: MASSE, ABSONDERUNG, NEUTRAL, UNKNOWN',
            },
            { status: 400 }
          );
        }
        changes.legalBucket = body.legalBucket;
      }

      if (body.transactionDate !== undefined) {
        changes.transactionDate = new Date(body.transactionDate);
      }

      // At least one change is required for ADJUST
      if (Object.keys(changes).length === 0) {
        return NextResponse.json(
          { error: 'Bei Korrekturen muss mindestens ein Feld geändert werden' },
          { status: 400 }
        );
      }

      const input = {
        action: 'ADJUST' as const,
        reason: body.reason,
        changes,
      };

      const updatedEntry = await processReview(
        prisma,
        entryId,
        session.username,
        input
      );

      // Mark aggregation as stale after adjustment
      await markAggregationStale(prisma, caseId);

      return NextResponse.json(serializeLedgerEntry(updatedEntry));
    }
  } catch (error) {
    console.error('Error reviewing ledger entry:', error);
    const message =
      error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json(
      { error: `Fehler beim Prüfen des Eintrags: ${message}` },
      { status: 500 }
    );
  }
}
