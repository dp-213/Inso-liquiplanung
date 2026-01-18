/**
 * Bulk Review API - Filter-basierte Massenaktionen für LedgerEntries
 *
 * POST /api/cases/[id]/ledger/bulk-review
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { bulkConfirmEntries, createAuditLog } from '@/lib/ledger/governance';
import { REVIEW_STATUS, AUDIT_ACTIONS } from '@/lib/ledger/types';
import { markAggregationStale } from '@/lib/ledger/aggregation';

// =============================================================================
// TYPES
// =============================================================================

interface BulkReviewFilter {
  reviewStatus?: 'UNREVIEWED' | 'CONFIRMED' | 'ADJUSTED';
  suggestedLegalBucket?: 'MASSE' | 'ABSONDERUNG' | 'NEUTRAL' | null;
  minConfidence?: number;
  maxConfidence?: number;
  suggestedRuleId?: string;
}

interface BulkReviewRequest {
  action: 'CONFIRM' | 'ADJUST';

  // Entweder Filter oder explizite IDs
  filter?: BulkReviewFilter;
  entryIds?: string[];

  // Für CONFIRM
  note?: string;

  // Für ADJUST
  reason?: string;
  applyClassificationSuggestions?: boolean; // Übernimmt suggestedLegalBucket
}

// =============================================================================
// POST /api/cases/[id]/ledger/bulk-review
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: caseId } = await params;

    // Case prüfen
    const existingCase = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!existingCase) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    // Request Body parsen
    const body: BulkReviewRequest = await request.json();

    if (!body.action || !['CONFIRM', 'ADJUST'].includes(body.action)) {
      return NextResponse.json({ error: 'action muss CONFIRM oder ADJUST sein' }, { status: 400 });
    }

    if (!body.filter && !body.entryIds) {
      return NextResponse.json({ error: 'Entweder filter oder entryIds ist erforderlich' }, { status: 400 });
    }

    if (body.action === 'ADJUST' && !body.reason && !body.applyClassificationSuggestions) {
      return NextResponse.json(
        { error: 'Bei ADJUST ist entweder reason oder applyClassificationSuggestions erforderlich' },
        { status: 400 }
      );
    }

    const userId = 'bulk-review-api'; // TODO: Aus Session holen

    // Finde die betroffenen Entries
    let entryIds: string[] = [];

    if (body.entryIds && body.entryIds.length > 0) {
      // Explizite IDs - validieren dass sie zum Case gehören
      const entries = await prisma.ledgerEntry.findMany({
        where: {
          id: { in: body.entryIds },
          caseId,
        },
        select: { id: true },
      });
      entryIds = entries.map((e) => e.id);
    } else if (body.filter) {
      // Filter-basiert
      const where: Record<string, unknown> = { caseId };

      if (body.filter.reviewStatus) {
        where.reviewStatus = body.filter.reviewStatus;
      }

      if (body.filter.suggestedLegalBucket !== undefined) {
        where.suggestedLegalBucket = body.filter.suggestedLegalBucket;
      }

      if (body.filter.minConfidence !== undefined || body.filter.maxConfidence !== undefined) {
        where.suggestedConfidence = {};
        if (body.filter.minConfidence !== undefined) {
          (where.suggestedConfidence as Record<string, number>).gte = body.filter.minConfidence;
        }
        if (body.filter.maxConfidence !== undefined) {
          (where.suggestedConfidence as Record<string, number>).lte = body.filter.maxConfidence;
        }
      }

      if (body.filter.suggestedRuleId) {
        where.suggestedRuleId = body.filter.suggestedRuleId;
      }

      const entries = await prisma.ledgerEntry.findMany({
        where,
        select: { id: true },
      });
      entryIds = entries.map((e) => e.id);
    }

    if (entryIds.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        errors: [],
        message: 'Keine Einträge gefunden, die den Kriterien entsprechen',
      });
    }

    // Aktion ausführen
    let result: { processed: number; errors: string[] };

    if (body.action === 'CONFIRM') {
      const bulkResult = await bulkConfirmEntries(prisma, entryIds, userId, body.note);
      result = { processed: bulkResult.confirmed, errors: bulkResult.errors };
    } else {
      // ADJUST
      result = await bulkAdjustEntries(prisma, caseId, entryIds, userId, {
        reason: body.reason || 'Klassifikation übernommen',
        applyClassificationSuggestions: body.applyClassificationSuggestions || false,
      });
    }

    // Markiere Aggregation als veraltet (wenn Änderungen vorgenommen wurden)
    if (result.processed > 0) {
      await markAggregationStale(prisma, caseId);
    }

    return NextResponse.json({
      success: true,
      action: body.action,
      processed: result.processed,
      errors: result.errors,
      message: `${result.processed} Einträge ${body.action === 'CONFIRM' ? 'bestätigt' : 'korrigiert'}`,
    });
  } catch (error) {
    console.error('[bulk-review] Error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

// =============================================================================
// BULK ADJUST HELPER
// =============================================================================

async function bulkAdjustEntries(
  prisma: typeof import('@/lib/db').prisma,
  caseId: string,
  entryIds: string[],
  userId: string,
  options: {
    reason: string;
    applyClassificationSuggestions: boolean;
  }
): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;
  const now = new Date();

  for (const entryId of entryIds) {
    try {
      // Hole aktuellen Entry
      const entry = await prisma.ledgerEntry.findUnique({
        where: { id: entryId },
      });

      if (!entry) {
        errors.push(`${entryId}: Eintrag nicht gefunden`);
        continue;
      }

      // Build update data
      const updateData: Record<string, unknown> = {
        reviewStatus: REVIEW_STATUS.ADJUSTED,
        reviewedBy: userId,
        reviewedAt: now,
        reviewNote: options.reason,
        changeReason: options.reason,
        updatedAt: now,
      };

      const fieldChanges: Record<string, { old: string | null; new: string | null }> = {
        reviewStatus: {
          old: entry.reviewStatus,
          new: REVIEW_STATUS.ADJUSTED,
        },
      };

      // Übernehme Klassifikations-Vorschläge wenn gewünscht
      if (options.applyClassificationSuggestions && entry.suggestedLegalBucket) {
        updateData.legalBucket = entry.suggestedLegalBucket;
        fieldChanges.legalBucket = {
          old: entry.legalBucket,
          new: entry.suggestedLegalBucket,
        };
      }

      // Update Entry
      await prisma.ledgerEntry.update({
        where: { id: entryId },
        data: updateData,
      });

      // Create Audit Log
      await createAuditLog(prisma, {
        ledgerEntryId: entryId,
        caseId,
        action: AUDIT_ACTIONS.ADJUSTED,
        fieldChanges,
        reason: options.reason,
        userId,
      });

      processed++;
    } catch (error) {
      errors.push(`${entryId}: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  }

  return { processed, errors };
}

// =============================================================================
// GET /api/cases/[id]/ledger/bulk-review - Preview
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: caseId } = await params;
    const { searchParams } = new URL(request.url);

    // Case prüfen
    const existingCase = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!existingCase) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    // Filter aus Query Params
    const reviewStatus = searchParams.get('reviewStatus');
    const suggestedLegalBucket = searchParams.get('suggestedLegalBucket');
    const minConfidence = searchParams.get('minConfidence');

    const where: Record<string, unknown> = { caseId };

    if (reviewStatus) {
      where.reviewStatus = reviewStatus;
    }

    if (suggestedLegalBucket) {
      where.suggestedLegalBucket = suggestedLegalBucket === 'null' ? null : suggestedLegalBucket;
    }

    if (minConfidence) {
      where.suggestedConfidence = { gte: parseFloat(minConfidence) };
    }

    // Zähle betroffene Entries
    const count = await prisma.ledgerEntry.count({ where });

    // Berechne Summen
    const entries = await prisma.ledgerEntry.findMany({
      where,
      select: { amountCents: true },
    });

    const totalAmountCents = entries.reduce((sum, e) => sum + BigInt(e.amountCents), BigInt(0));
    const inflowCents = entries.reduce(
      (sum, e) => (e.amountCents > BigInt(0) ? sum + BigInt(e.amountCents) : sum),
      BigInt(0)
    );
    const outflowCents = entries.reduce(
      (sum, e) => (e.amountCents < BigInt(0) ? sum + BigInt(e.amountCents) : sum),
      BigInt(0)
    );

    return NextResponse.json({
      count,
      filter: {
        reviewStatus: reviewStatus || 'any',
        suggestedLegalBucket: suggestedLegalBucket || 'any',
        minConfidence: minConfidence ? parseFloat(minConfidence) : null,
      },
      totals: {
        netCents: totalAmountCents.toString(),
        inflowCents: inflowCents.toString(),
        outflowCents: outflowCents.toString(),
      },
    });
  } catch (error) {
    console.error('[bulk-review] GET Error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}
