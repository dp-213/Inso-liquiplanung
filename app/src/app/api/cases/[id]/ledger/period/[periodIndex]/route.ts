import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  getLedgerEntriesForPeriod,
  calculatePeriodStartDate,
} from '@/lib/ledger/aggregation';
import {
  LedgerEntryResponse,
  deriveFlowType,
  VALUE_TYPES,
  ValueType,
  LegalBucket,
  ReviewStatus,
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
    // Estate Allocation
    estateAllocation: entry.estateAllocation,
    estateRatio: entry.estateRatio?.toString() || null,
    allocationSource: entry.allocationSource,
    allocationNote: entry.allocationNote,
    // Audit
    createdAt: entry.createdAt.toISOString(),
    createdBy: entry.createdBy,
    updatedAt: entry.updatedAt.toISOString(),
    // Derived
    flowType: deriveFlowType(BigInt(entry.amountCents)),
  };
}

// =============================================================================
// GET /api/cases/[id]/ledger/period/[periodIndex] - Get LedgerEntries for a period
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; periodIndex: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId, periodIndex: periodIndexStr } = await params;
    const periodIndex = parseInt(periodIndexStr, 10);

    if (isNaN(periodIndex) || periodIndex < 0) {
      return NextResponse.json(
        { error: 'Ungültiger periodIndex' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');
    const valueType = searchParams.get('valueType') as ValueType | null;

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

    // Calculate period date range
    const periodStart = calculatePeriodStartDate(
      plan.planStartDate,
      periodIndex,
      plan.periodType as 'WEEKLY' | 'MONTHLY'
    );

    const periodEnd = calculatePeriodStartDate(
      plan.planStartDate,
      periodIndex + 1,
      plan.periodType as 'WEEKLY' | 'MONTHLY'
    );

    // Build query
    const where: Record<string, unknown> = {
      caseId,
      transactionDate: {
        gte: periodStart,
        lt: periodEnd,
      },
    };

    if (valueType && Object.values(VALUE_TYPES).includes(valueType)) {
      where.valueType = valueType;
    }

    // Fetch entries
    const entries = await prisma.ledgerEntry.findMany({
      where,
      orderBy: { transactionDate: 'asc' },
    });

    // Calculate totals
    let totalInflows = BigInt(0);
    let totalOutflows = BigInt(0);

    // Transform to response format
    const response: LedgerEntryResponse[] = entries.map((entry) => {
      const amount = BigInt(entry.amountCents);
      if (amount >= BigInt(0)) {
        totalInflows += amount;
      } else {
        totalOutflows += amount;
      }

      return serializeLedgerEntry(entry);
    });

    const periodLabel = plan.periodType === 'WEEKLY'
      ? `KW ${periodStart.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`
      : periodStart.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

    return NextResponse.json({
      entries: response,
      periodInfo: {
        periodIndex,
        periodLabel,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        periodType: plan.periodType,
      },
      totalCount: entries.length,
      totalInflows: totalInflows.toString(),
      totalOutflows: totalOutflows.toString(),
      netAmount: (totalInflows + totalOutflows).toString(),
    });
  } catch (error) {
    console.error('Error fetching ledger entries for period:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Ledger-Einträge für diese Periode' },
      { status: 500 }
    );
  }
}
