/**
 * Intake API - Vereinfachter Import direkt zu LedgerEntry
 *
 * POST /api/cases/[id]/intake
 *
 * Erstellt LedgerEntries mit reviewStatus=UNREVIEWED und
 * wendet automatisch ClassificationRules an.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { classifyBatch } from '@/lib/classification';
import { markAggregationStale } from '@/lib/ledger/aggregation';

// =============================================================================
// TYPES
// =============================================================================

interface IntakeEntry {
  transactionDate: string; // ISO 8601 oder DD.MM.YYYY
  amountCents: number; // Positive = Einzahlung, Negative = Auszahlung
  description: string;
  note?: string;
  valueType?: 'IST' | 'PLAN';
  legalBucket?: 'MASSE' | 'ABSONDERUNG' | 'NEUTRAL' | 'UNKNOWN';
  bookingSource?: string; // BANK_ACCOUNT, CASH_REGISTER, ERP, MANUAL
  bookingSourceId?: string; // z.B. IBAN
  bookingReference?: string; // Rechnungsnummer, etc.
}

interface IntakeRequest {
  source: string; // z.B. "Kontoauszug DE123..."
  entries: IntakeEntry[];
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Parst ein Datum aus verschiedenen Formaten
 */
function parseDate(dateStr: string): Date | null {
  // ISO 8601 Format (2026-01-15)
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;
  }

  // Deutsches Format (15.01.2026)
  const germanMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (germanMatch) {
    const [, day, month, year] = germanMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }

  return null;
}

/**
 * Validiert einen einzelnen Intake-Eintrag
 */
function validateEntry(entry: IntakeEntry, index: number): string[] {
  const errors: string[] = [];

  if (!entry.transactionDate) {
    errors.push(`Eintrag ${index + 1}: transactionDate fehlt`);
  } else if (!parseDate(entry.transactionDate)) {
    errors.push(`Eintrag ${index + 1}: transactionDate ungültig (${entry.transactionDate})`);
  }

  if (entry.amountCents === undefined || entry.amountCents === null) {
    errors.push(`Eintrag ${index + 1}: amountCents fehlt`);
  } else if (typeof entry.amountCents !== 'number' || !Number.isInteger(entry.amountCents)) {
    errors.push(`Eintrag ${index + 1}: amountCents muss eine Ganzzahl sein`);
  }

  if (!entry.description || entry.description.trim() === '') {
    errors.push(`Eintrag ${index + 1}: description fehlt`);
  }

  if (entry.valueType && !['IST', 'PLAN'].includes(entry.valueType)) {
    errors.push(`Eintrag ${index + 1}: valueType muss IST oder PLAN sein`);
  }

  if (entry.legalBucket && !['MASSE', 'ABSONDERUNG', 'NEUTRAL', 'UNKNOWN'].includes(entry.legalBucket)) {
    errors.push(`Eintrag ${index + 1}: legalBucket ungültig`);
  }

  return errors;
}

// =============================================================================
// POST /api/cases/[id]/intake
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
    const body: IntakeRequest = await request.json();

    if (!body.source || body.source.trim() === '') {
      return NextResponse.json({ error: 'source ist erforderlich' }, { status: 400 });
    }

    if (!body.entries || !Array.isArray(body.entries) || body.entries.length === 0) {
      return NextResponse.json({ error: 'entries Array ist erforderlich und darf nicht leer sein' }, { status: 400 });
    }

    // Validiere alle Einträge
    const validationErrors: string[] = [];
    for (let i = 0; i < body.entries.length; i++) {
      const errors = validateEntry(body.entries[i], i);
      validationErrors.push(...errors);
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Validierungsfehler',
          details: validationErrors,
        },
        { status: 400 }
      );
    }

    // Erstelle LedgerEntries in einer Transaktion
    const createdIds: string[] = [];
    const now = new Date();
    const userId = 'intake-api'; // TODO: Aus Session holen

    await prisma.$transaction(async (tx) => {
      for (const entry of body.entries) {
        const transactionDate = parseDate(entry.transactionDate)!;

        const ledgerEntry = await tx.ledgerEntry.create({
          data: {
            caseId,
            transactionDate,
            amountCents: BigInt(entry.amountCents),
            description: entry.description.trim(),
            note: entry.note?.trim() || null,
            valueType: entry.valueType || 'IST',
            legalBucket: entry.legalBucket || 'UNKNOWN',
            bookingSource: entry.bookingSource || null,
            bookingSourceId: entry.bookingSourceId || null,
            bookingReference: entry.bookingReference || null,
            importSource: body.source,
            reviewStatus: 'UNREVIEWED',
            createdAt: now,
            createdBy: userId,
          },
        });

        createdIds.push(ledgerEntry.id);
      }
    });

    // Klassifiziere die neuen Entries
    const classificationResult = await classifyBatch(prisma, caseId, createdIds);

    // Markiere Aggregation als veraltet
    await markAggregationStale(prisma, caseId);

    return NextResponse.json({
      success: true,
      created: createdIds.length,
      classified: classificationResult.classified,
      unchanged: classificationResult.unchanged,
      errors: classificationResult.errors,
      message: `${createdIds.length} Einträge importiert, ${classificationResult.classified} mit Klassifikations-Vorschlägen`,
      entryIds: createdIds,
    });
  } catch (error) {
    console.error('[intake] Error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/cases/[id]/intake - Statistiken abrufen
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: caseId } = await params;

    // Case prüfen
    const existingCase = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!existingCase) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    // Zähle Entries nach Status
    const [total, unreviewed, confirmed, adjusted] = await Promise.all([
      prisma.ledgerEntry.count({ where: { caseId } }),
      prisma.ledgerEntry.count({ where: { caseId, reviewStatus: 'UNREVIEWED' } }),
      prisma.ledgerEntry.count({ where: { caseId, reviewStatus: 'CONFIRMED' } }),
      prisma.ledgerEntry.count({ where: { caseId, reviewStatus: 'ADJUSTED' } }),
    ]);

    // Zähle Entries mit Klassifikations-Vorschlägen
    const [withSuggestion, withoutSuggestion] = await Promise.all([
      prisma.ledgerEntry.count({
        where: { caseId, reviewStatus: 'UNREVIEWED', suggestedLegalBucket: { not: null } },
      }),
      prisma.ledgerEntry.count({
        where: { caseId, reviewStatus: 'UNREVIEWED', suggestedLegalBucket: null },
      }),
    ]);

    // Zähle nach Legal Bucket
    const byLegalBucket = await prisma.ledgerEntry.groupBy({
      by: ['suggestedLegalBucket'],
      where: { caseId, reviewStatus: 'UNREVIEWED' },
      _count: true,
    });

    return NextResponse.json({
      total,
      byReviewStatus: {
        UNREVIEWED: unreviewed,
        CONFIRMED: confirmed,
        ADJUSTED: adjusted,
      },
      classification: {
        withSuggestion,
        withoutSuggestion,
        byLegalBucket: byLegalBucket.reduce(
          (acc, item) => {
            acc[item.suggestedLegalBucket || 'null'] = item._count;
            return acc;
          },
          {} as Record<string, number>
        ),
      },
    });
  } catch (error) {
    console.error('[intake] GET Error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}
