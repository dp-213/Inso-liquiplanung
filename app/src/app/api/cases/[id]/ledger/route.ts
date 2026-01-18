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
  LegalBucket,
  ValueType,
  BookingSource,
} from '@/lib/ledger';

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
    const response: LedgerEntryResponse[] = entries.map((entry) => ({
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
      createdAt: entry.createdAt.toISOString(),
      createdBy: entry.createdBy,
      updatedAt: entry.updatedAt.toISOString(),
      updatedBy: entry.updatedBy,
      flowType: deriveFlowType(BigInt(entry.amountCents)),
    }));

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
        createdBy: session.username,
        updatedBy: session.username,
      },
    });

    const response: LedgerEntryResponse = {
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
      createdAt: entry.createdAt.toISOString(),
      createdBy: entry.createdBy,
      updatedAt: entry.updatedAt.toISOString(),
      updatedBy: entry.updatedBy,
      flowType: deriveFlowType(BigInt(entry.amountCents)),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating ledger entry:', error);
    return NextResponse.json(
      { error: 'Fehler beim Erstellen des Ledger-Eintrags' },
      { status: 500 }
    );
  }
}
