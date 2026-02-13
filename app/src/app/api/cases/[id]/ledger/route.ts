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
  CATEGORY_TAG_LABELS,
  LegalBucket,
  ValueType,
  BookingSource,
  ReviewStatus,
  markAggregationStale,
  createAuditLog,
  AUDIT_ACTIONS,
  EXCLUDE_SPLIT_PARENTS,
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
  steeringTag: string | null;
  // Dimensions-Vorschläge (von Rule Engine)
  suggestedBankAccountId: string | null;
  suggestedCounterpartyId: string | null;
  suggestedLocationId: string | null;
  // Estate Allocation (Alt-/Neumasse)
  estateAllocation: string | null;
  estateRatio: string | null;
  allocationSource: string | null;
  allocationNote: string | null;
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
    steeringTag: entry.steeringTag,
    // Dimensions-Vorschläge (von Rule Engine)
    suggestedBankAccountId: entry.suggestedBankAccountId,
    suggestedCounterpartyId: entry.suggestedCounterpartyId,
    suggestedLocationId: entry.suggestedLocationId,
    // Audit
    createdAt: entry.createdAt.toISOString(),
    createdBy: entry.createdBy,
    updatedAt: entry.updatedAt.toISOString(),
    // Estate Allocation (Alt-/Neumasse)
    estateAllocation: entry.estateAllocation,
    estateRatio: entry.estateRatio?.toString() || null,
    allocationSource: entry.allocationSource,
    allocationNote: entry.allocationNote,
    // Service Date / Period (für Alt/Neu-Zuordnung)
    serviceDate: entry.serviceDate?.toISOString() || null,
    servicePeriodStart: entry.servicePeriodStart?.toISOString() || null,
    servicePeriodEnd: entry.servicePeriodEnd?.toISOString() || null,
    // Service Date Vorschläge (Phase C)
    suggestedServiceDate: entry.suggestedServiceDate?.toISOString() || null,
    suggestedServicePeriodStart: entry.suggestedServicePeriodStart?.toISOString() || null,
    suggestedServicePeriodEnd: entry.suggestedServicePeriodEnd?.toISOString() || null,
    suggestedServiceDateRule: entry.suggestedServiceDateRule,
    // Category Tag (Matrix-Zuordnung)
    categoryTag: entry.categoryTag,
    categoryTagSource: entry.categoryTagSource,
    categoryTagNote: entry.categoryTagNote,
    suggestedCategoryTag: entry.suggestedCategoryTag,
    suggestedCategoryTagReason: entry.suggestedCategoryTagReason,
    // Transfer Pairing (Umbuchungen)
    transferPartnerEntryId: entry.transferPartnerEntryId,
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

    // Helper: Parse comma-separated multi-value parameter
    const parseMulti = (key: string): string[] => {
      const val = searchParams.get(key);
      if (!val) return [];
      return val.split(',').filter(Boolean);
    };

    // Parse query parameters (support comma-separated multi-values)
    const valueTypes = parseMulti('valueType');
    const legalBuckets = parseMulti('legalBucket');
    const bookingSource = searchParams.get('bookingSource') as BookingSource | null;
    const reviewStatuses = parseMulti('reviewStatus');
    const suggestedLegalBucket = searchParams.get('suggestedLegalBucket');
    // Dimensions-Filter (multi-value)
    const bankAccountIds = parseMulti('bankAccountId');
    const counterpartyIds = parseMulti('counterpartyId');
    const locationIds = parseMulti('locationId');
    const hasDimensionSuggestions = searchParams.get('hasDimensionSuggestions');
    const hasServiceDateSuggestion = searchParams.get('hasServiceDateSuggestion');
    // Import-Filter (multi-value)
    const importJobIds = parseMulti('importJobId');
    // Estate Allocation Filter (multi-value)
    const estateAllocations = parseMulti('estateAllocation');
    // Category Tag Filter (multi-value)
    const categoryTags = parseMulti('categoryTag');
    const hasCategoryTagSuggestion = searchParams.get('hasCategoryTagSuggestion');
    // Transfer-Filter (Umbuchungen)
    const isTransfer = searchParams.get('isTransfer');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 1000;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // Verify case exists
    const caseEntity = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseEntity) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    // Helper: Build multi-value filter with null support
    // Returns Prisma condition for single value, { in: [...] }, or OR with null
    const buildMultiFilter = (values: string[]): unknown => {
      if (values.length === 0) return undefined;
      const hasNull = values.includes('null');
      const realValues = values.filter(v => v !== 'null');

      if (hasNull && realValues.length === 0) return null; // Only null selected
      if (!hasNull && realValues.length === 1) return realValues[0]; // Single value
      if (!hasNull) return { in: realValues }; // Multiple values, no null

      // Null + real values: need OR
      return undefined; // Handled specially below
    };

    const buildMultiFilterWithOr = (field: string, values: string[]): Record<string, unknown>[] | null => {
      if (values.length === 0) return null;
      const hasNull = values.includes('null');
      const realValues = values.filter(v => v !== 'null');

      if (hasNull && realValues.length > 0) {
        return [
          { [field]: null },
          { [field]: realValues.length === 1 ? realValues[0] : { in: realValues } },
        ];
      }
      return null; // No OR needed
    };

    // Build where clause
    const where: Record<string, unknown> = { caseId };
    const andConditions: Record<string, unknown>[] = [];

    if (valueTypes.length > 0) {
      const filter = buildMultiFilter(valueTypes);
      if (filter !== undefined) where.valueType = filter;
    }

    if (legalBuckets.length > 0) {
      const filter = buildMultiFilter(legalBuckets);
      if (filter !== undefined) where.legalBucket = filter;
    }

    if (bookingSource && Object.values(BOOKING_SOURCES).includes(bookingSource)) {
      where.bookingSource = bookingSource;
    }

    if (reviewStatuses.length > 0) {
      const filter = buildMultiFilter(reviewStatuses);
      if (filter !== undefined) where.reviewStatus = filter;
    }

    if (suggestedLegalBucket !== null) {
      if (suggestedLegalBucket === 'null') {
        where.suggestedLegalBucket = null;
      } else if (suggestedLegalBucket) {
        where.suggestedLegalBucket = suggestedLegalBucket;
      }
    }

    // Dimensions-Filter (multi-value with null support)
    if (bankAccountIds.length > 0) {
      const orCond = buildMultiFilterWithOr('bankAccountId', bankAccountIds);
      if (orCond) {
        andConditions.push({ OR: orCond });
      } else {
        const filter = buildMultiFilter(bankAccountIds);
        if (filter !== undefined) where.bankAccountId = filter;
      }
    }

    if (counterpartyIds.length > 0) {
      const orCond = buildMultiFilterWithOr('counterpartyId', counterpartyIds);
      if (orCond) {
        andConditions.push({ OR: orCond });
      } else {
        const filter = buildMultiFilter(counterpartyIds);
        if (filter !== undefined) where.counterpartyId = filter;
      }
    }

    if (locationIds.length > 0) {
      const orCond = buildMultiFilterWithOr('locationId', locationIds);
      if (orCond) {
        andConditions.push({ OR: orCond });
      } else {
        const filter = buildMultiFilter(locationIds);
        if (filter !== undefined) where.locationId = filter;
      }
    }

    // Filter: Nur Einträge mit Dimensions-Vorschlägen
    if (hasDimensionSuggestions === 'true') {
      andConditions.push({
        OR: [
          { suggestedBankAccountId: { not: null } },
          { suggestedCounterpartyId: { not: null } },
          { suggestedLocationId: { not: null } },
        ],
      });
    }

    // Filter: Nur Einträge mit ServiceDate-Vorschlägen (für Bulk-Accept Preview)
    if (hasServiceDateSuggestion === 'true') {
      andConditions.push({
        OR: [
          { suggestedServiceDate: { not: null } },
          { suggestedServicePeriodStart: { not: null } },
        ],
      });
    }

    // Import-Filter (multi-value)
    if (importJobIds.length > 0) {
      const filter = buildMultiFilter(importJobIds);
      if (filter !== undefined) where.importJobId = filter;
    }

    // Estate Allocation Filter (multi-value with null support)
    if (estateAllocations.length > 0) {
      const orCond = buildMultiFilterWithOr('estateAllocation', estateAllocations);
      if (orCond) {
        andConditions.push({ OR: orCond });
      } else {
        const filter = buildMultiFilter(estateAllocations);
        if (filter !== undefined) where.estateAllocation = filter;
      }
    }

    // Category Tag Filter (multi-value with null support)
    if (categoryTags.length > 0) {
      const orCond = buildMultiFilterWithOr('categoryTag', categoryTags);
      if (orCond) {
        andConditions.push({ OR: orCond });
      } else {
        const filter = buildMultiFilter(categoryTags);
        if (filter !== undefined) where.categoryTag = filter;
      }
    }

    // Filter: Nur Einträge mit CategoryTag-Vorschlägen
    if (hasCategoryTagSuggestion === 'true') {
      where.suggestedCategoryTag = { not: null };
    }

    // Transfer-Filter (Umbuchungen)
    if (isTransfer === 'true') {
      where.transferPartnerEntryId = { not: null };
    } else if (isTransfer === 'false') {
      where.transferPartnerEntryId = null;
    }

    // Combine AND conditions
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // NOTE: Date filter is applied in JS, NOT in Prisma query.
    // Prisma's @prisma/adapter-libsql has a bug where Date comparisons
    // fail on Turso (dates stored as INT ms, adapter compares as strings).
    const dateFrom = from ? new Date(from) : undefined;
    const dateTo = to ? new Date(to) : undefined;
    const hasDateFilter = !!(dateFrom || dateTo);

    let entries: (LedgerEntry & { splitChildren: { id: string; description: string; amountCents: bigint; counterpartyId: string | null; locationId: string | null; categoryTag: string | null; reviewStatus: string; note: string | null }[] })[];
    let total: number;
    let totalInflows = BigInt(0);
    let totalOutflows = BigInt(0);
    let transferVolume = BigInt(0);

    if (hasDateFilter) {
      // FALLBACK: Date filter → load all, filter + paginate in JS (Turso adapter bug)
      const allEntries = await prisma.ledgerEntry.findMany({
        where,
        include: {
          splitChildren: {
            select: { id: true, description: true, amountCents: true, counterpartyId: true, locationId: true, categoryTag: true, reviewStatus: true, note: true },
          },
        },
        orderBy: { transactionDate: 'asc' },
      });

      const dateFiltered = allEntries.filter((e) => {
        if (dateFrom && e.transactionDate < dateFrom) return false;
        if (dateTo && e.transactionDate > dateTo) return false;
        return true;
      });

      total = dateFiltered.length;
      entries = dateFiltered.slice(offset, offset + limit);

      // Stats from filtered entries
      for (const e of dateFiltered) {
        const isTransferEntry = e.transferPartnerEntryId !== null;
        const isSplitParent = e.splitChildren && e.splitChildren.length > 0;
        if (isTransferEntry) {
          if (e.amountCents >= BigInt(0)) transferVolume += e.amountCents;
        } else if (!isSplitParent) {
          if (e.amountCents >= BigInt(0)) totalInflows += e.amountCents;
          else totalOutflows += e.amountCents;
        }
      }
    } else {
      // FAST PATH: No date filter → DB pagination + 3 aggregate stats queries
      // Statt alle 3378 Entries zu laden: 1 paginierte Query + 3 leichte Aggregationen
      const nonTransferNonSplit = { ...where, transferPartnerEntryId: null, splitChildren: { none: {} } };

      const [paginatedEntries, countResult, inflowStats, outflowStats, transferStats] = await Promise.all([
        // 1. Paginated entries with splitChildren
        prisma.ledgerEntry.findMany({
          where,
          include: {
            splitChildren: {
              select: { id: true, description: true, amountCents: true, counterpartyId: true, locationId: true, categoryTag: true, reviewStatus: true, note: true },
            },
          },
          orderBy: { transactionDate: 'asc' },
          skip: offset,
          take: limit,
        }),
        // 2. Total count (returns 1 number)
        prisma.ledgerEntry.count({ where }),
        // 3. Inflows: non-transfer, non-split-parent, amount >= 0
        prisma.ledgerEntry.aggregate({
          where: { ...nonTransferNonSplit, amountCents: { gte: 0 } },
          _sum: { amountCents: true },
        }),
        // 4. Outflows: non-transfer, non-split-parent, amount < 0
        prisma.ledgerEntry.aggregate({
          where: { ...nonTransferNonSplit, amountCents: { lt: 0 } },
          _sum: { amountCents: true },
        }),
        // 5. Transfers: transfer entries, amount >= 0
        prisma.ledgerEntry.aggregate({
          where: { ...where, transferPartnerEntryId: { not: null }, amountCents: { gte: 0 } },
          _sum: { amountCents: true },
        }),
      ]);

      entries = paginatedEntries;
      total = countResult;
      totalInflows = inflowStats._sum.amountCents || BigInt(0);
      totalOutflows = outflowStats._sum.amountCents || BigInt(0);
      transferVolume = transferStats._sum.amountCents || BigInt(0);
    }

    const netAmount = totalInflows + totalOutflows;

    // Transform to response format (inkl. splitChildren + isBatchParent)
    const response = entries.map((entry) => ({
      ...serializeLedgerEntry(entry),
      parentEntryId: entry.parentEntryId,
      isBatchParent: entry.splitChildren.length > 0,
      splitChildren: entry.splitChildren.map(c => ({
        id: c.id,
        description: c.description,
        amountCents: c.amountCents.toString(),
        counterpartyId: c.counterpartyId,
        locationId: c.locationId,
        categoryTag: c.categoryTag,
        reviewStatus: c.reviewStatus,
        note: c.note,
      })),
    }));

    // Dimensions-Lookup für Frontend einbetten (spart 3 separate API-Calls)
    const [bankAccounts, counterparties, locations] = await Promise.all([
      prisma.bankAccount.findMany({
        where: { caseId },
        select: { id: true, bankName: true, accountName: true },
        orderBy: { displayOrder: 'asc' },
      }),
      prisma.counterparty.findMany({
        where: { caseId },
        select: { id: true, name: true },
        orderBy: { displayOrder: 'asc' },
      }),
      prisma.location.findMany({
        where: { caseId },
        select: { id: true, name: true },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);

    return NextResponse.json({
      entries: response,
      totalCount: total,
      totalInflows: totalInflows.toString(),
      totalOutflows: totalOutflows.toString(),
      netAmount: netAmount.toString(),
      transferVolume: transferVolume.toString(),
      dimensions: {
        bankAccounts,
        counterparties,
        locations,
      },
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
        // Category Tag (Matrix-Zuordnung)
        categoryTag: body.categoryTag || null,
        categoryTagSource: body.categoryTag ? 'IMPORT' : null,
        categoryTagNote: body.categoryTag ? 'Bei Import gesetzt' : null,
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
