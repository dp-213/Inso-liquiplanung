import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  LedgerEntryResponse,
  LedgerQueryParams,
  deriveFlowType,
  LEGAL_BUCKETS,
  BOOKING_SOURCES,
  VALUE_TYPES,
  REVIEW_STATUS,
  LegalBucket,
  ValueType,
  BookingSource,
  ReviewStatus,
  markAggregationStale,
  createAuditLog,
  AUDIT_ACTIONS,
} from '@/lib/ledger';
import { LedgerEntry } from '@prisma/client';

/**
 * Serialize a LedgerEntry to LedgerEntryResponse (including governance and classification fields)
 */
function serializeLedgerEntry(entry: LedgerEntry): LedgerEntryResponse & {
  suggestedLegalBucket: string | null;
  suggestedCategory: string | null;
  suggestedConfidence: number | null;
  suggestedRuleId: string | null;
  suggestedReason: string | null;
  // Dimensions (final)
  bankAccountId: string | null;
  counterpartyId: string | null;
  locationId: string | null;
  // Dimensions-Vorschläge (von Rule Engine)
  suggestedBankAccountId: string | null;
  suggestedCounterpartyId: string | null;
  suggestedLocationId: string | null;
} {
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
    // Classification suggestion fields
    suggestedLegalBucket: entry.suggestedLegalBucket,
    suggestedCategory: entry.suggestedCategory,
    suggestedConfidence: entry.suggestedConfidence,
    suggestedRuleId: entry.suggestedRuleId,
    suggestedReason: entry.suggestedReason,
    // Dimensions (final)
    bankAccountId: entry.bankAccountId,
    counterpartyId: entry.counterpartyId,
    locationId: entry.locationId,
    // Dimensions-Vorschläge (von Rule Engine)
    suggestedBankAccountId: entry.suggestedBankAccountId,
    suggestedCounterpartyId: entry.suggestedCounterpartyId,
    suggestedLocationId: entry.suggestedLocationId,
    // Audit
    createdAt: entry.createdAt.toISOString(),
    createdBy: entry.createdBy,
    updatedAt: entry.updatedAt.toISOString(),
    // Derived
    flowType: deriveFlowType(BigInt(entry.amountCents)),
  };
}

// =============================================================================
// GET /api/cases/[id]/ledger - List all LedgerEntries for a case
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

    // Parse query parameters
    const valueType = searchParams.get('valueType') as ValueType | null;
    const legalBucket = searchParams.get('legalBucket') as LegalBucket | null;
    const bookingSource = searchParams.get('bookingSource') as BookingSource | null;
    const reviewStatus = searchParams.get('reviewStatus') as ReviewStatus | null;
    const suggestedLegalBucket = searchParams.get('suggestedLegalBucket');
    // Dimensions-Filter
    const bankAccountId = searchParams.get('bankAccountId');
    const counterpartyId = searchParams.get('counterpartyId');
    const locationId = searchParams.get('locationId');
    const hasDimensionSuggestions = searchParams.get('hasDimensionSuggestions');
    // Import-Filter
    const importJobId = searchParams.get('importJobId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // Verify case exists
    const caseEntity = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseEntity) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    // Build where clause
    const where: Record<string, unknown> = { caseId };

    if (valueType && Object.values(VALUE_TYPES).includes(valueType)) {
      where.valueType = valueType;
    }

    if (legalBucket && Object.values(LEGAL_BUCKETS).includes(legalBucket)) {
      where.legalBucket = legalBucket;
    }

    if (bookingSource && Object.values(BOOKING_SOURCES).includes(bookingSource)) {
      where.bookingSource = bookingSource;
    }

    if (reviewStatus && Object.values(REVIEW_STATUS).includes(reviewStatus)) {
      where.reviewStatus = reviewStatus;
    }

    if (suggestedLegalBucket !== null) {
      if (suggestedLegalBucket === 'null') {
        where.suggestedLegalBucket = null;
      } else if (suggestedLegalBucket) {
        where.suggestedLegalBucket = suggestedLegalBucket;
      }
    }

    // Dimensions-Filter (finale Werte)
    if (bankAccountId) {
      if (bankAccountId === 'null') {
        where.bankAccountId = null;
      } else {
        where.bankAccountId = bankAccountId;
      }
    }

    if (counterpartyId) {
      if (counterpartyId === 'null') {
        where.counterpartyId = null;
      } else {
        where.counterpartyId = counterpartyId;
      }
    }

    if (locationId) {
      if (locationId === 'null') {
        where.locationId = null;
      } else {
        where.locationId = locationId;
      }
    }

    // Filter: Nur Einträge mit Dimensions-Vorschlägen
    if (hasDimensionSuggestions === 'true') {
      where.OR = [
        { suggestedBankAccountId: { not: null } },
        { suggestedCounterpartyId: { not: null } },
        { suggestedLocationId: { not: null } },
      ];
    }

    // Import-Filter
    if (importJobId) {
      where.importJobId = importJobId;
    }

    if (from || to) {
      where.transactionDate = {};
      if (from) {
        (where.transactionDate as Record<string, Date>).gte = new Date(from);
      }
      if (to) {
        (where.transactionDate as Record<string, Date>).lte = new Date(to);
      }
    }

    // Fetch entries and stats
    const [entries, total, inflowStats, outflowStats] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where,
        orderBy: { transactionDate: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.ledgerEntry.count({ where }),
      prisma.ledgerEntry.aggregate({
        where: { ...where, amountCents: { gte: 0 } },
        _sum: { amountCents: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: { ...where, amountCents: { lt: 0 } },
        _sum: { amountCents: true },
      }),
    ]);

    const totalInflows = inflowStats._sum.amountCents || BigInt(0);
    const totalOutflows = outflowStats._sum.amountCents || BigInt(0);
    const netAmount = totalInflows + totalOutflows;

    // Transform to response format
    const response: LedgerEntryResponse[] = entries.map(serializeLedgerEntry);

    return NextResponse.json({
      entries: response,
      totalCount: total,
      totalInflows: totalInflows.toString(),
      totalOutflows: totalOutflows.toString(),
      netAmount: netAmount.toString(),
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching ledger entries:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Ledger-Einträge' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/cases/[id]/ledger - Create a new LedgerEntry
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

    // Verify case exists
    const caseEntity = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseEntity) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    // Validate required fields
    const { transactionDate, amountCents, description, valueType } = body;

    if (!transactionDate || amountCents === undefined || !description || !valueType) {
      return NextResponse.json(
        { error: 'Pflichtfelder fehlen: transactionDate, amountCents, description, valueType' },
        { status: 400 }
      );
    }

    if (!Object.values(VALUE_TYPES).includes(valueType)) {
      return NextResponse.json(
        { error: 'Ungültiger valueType. Erlaubt: IST, PLAN' },
        { status: 400 }
      );
    }

    // Create entry
    const entry = await prisma.ledgerEntry.create({
      data: {
        caseId,
        transactionDate: new Date(transactionDate),
        amountCents: BigInt(amountCents),
        description,
        note: body.note || null,
        valueType,
        legalBucket: body.legalBucket || 'UNKNOWN',
        importSource: body.importSource || null,
        importJobId: body.importJobId || null,
        importFileHash: body.importFileHash || null,
        importRowNumber: body.importRowNumber || null,
        bookingSource: body.bookingSource || 'MANUAL',
        bookingSourceId: body.bookingSourceId || null,
        bookingReference: body.bookingReference || null,
        reviewStatus: REVIEW_STATUS.UNREVIEWED,
        createdBy: session.username,
      },
    });

    // Create audit log for creation
    await createAuditLog(prisma, {
      ledgerEntryId: entry.id,
      caseId,
      action: AUDIT_ACTIONS.CREATED,
      fieldChanges: {},
      userId: session.username,
    });

    // Mark aggregation as stale
    await markAggregationStale(prisma, caseId);

    return NextResponse.json(serializeLedgerEntry(entry), { status: 201 });
  } catch (error) {
    console.error('Error creating ledger entry:', error);
    return NextResponse.json(
      { error: 'Fehler beim Erstellen des Ledger-Eintrags' },
      { status: 500 }
    );
  }
}
