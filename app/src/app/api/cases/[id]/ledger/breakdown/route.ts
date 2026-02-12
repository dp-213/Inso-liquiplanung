/**
 * API: Zahlbeleg-Aufschlüsselung – Upload & Match
 *
 * GET  /api/cases/[id]/ledger/breakdown  → Status aller Sources
 * POST /api/cases/[id]/ledger/breakdown  → Upload & Match neuer Zahlbelege
 *
 * Persistiert PaymentBreakdownSource + Items.
 * Matching: caseId + bankAccountId + amountCents + Datum ±3 Tage + "SAMMEL" in description.
 * Idempotent: Duplikate (gleiche referenceNumber) werden übersprungen.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

// Bank-Konto-Mapping: Zahlbeleg bank_konto → interne bankAccountId
const BANK_ACCOUNT_MAPPING: Record<string, string> = {
  'BW-Bank #400080156 (ISK) Uckerath': 'ba-isk-uckerath',
  'BW-Bank #400080228 (ISK) Velbert': 'ba-isk-velbert',
};

interface ZahlbelegEinzelposten {
  empfänger: string;
  betrag: number;
  verwendungszweck?: string;
  iban: string;
}

interface Zahlbeleg {
  datum: string;
  gesamtbetrag: number;
  auftragsnummer: string;
  typ: string;
  zahlungsart: string;
  bank_konto: string;
  einzelposten: ZahlbelegEinzelposten[];
}

interface UploadRequest {
  zahlbelege: Zahlbeleg[];
  sourceFileName?: string;
}

// =============================================================================
// GET – Status aller PaymentBreakdownSources für diesen Case
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { id: caseId } = await params;

    const sources = await prisma.paymentBreakdownSource.findMany({
      where: { caseId },
      include: {
        items: {
          orderBy: { itemIndex: 'asc' },
        },
      },
      orderBy: { executionDate: 'asc' },
    });

    const summary = {
      total: sources.length,
      uploaded: sources.filter(s => s.status === 'UPLOADED').length,
      matched: sources.filter(s => s.status === 'MATCHED').length,
      split: sources.filter(s => s.status === 'SPLIT').length,
      error: sources.filter(s => s.status === 'ERROR').length,
    };

    return NextResponse.json({
      summary,
      sources: sources.map(s => ({
        id: s.id,
        referenceNumber: s.referenceNumber,
        executionDate: s.executionDate.toISOString(),
        totalAmountCents: s.totalAmountCents.toString(),
        bankAccountId: s.bankAccountId,
        paymentType: s.paymentType,
        status: s.status,
        matchedLedgerEntryId: s.matchedLedgerEntryId,
        matchNote: s.matchNote,
        errorMessage: s.errorMessage,
        sourceFileName: s.sourceFileName,
        splitAt: s.splitAt?.toISOString() || null,
        itemCount: s.items.length,
        items: s.items.map(item => ({
          id: item.id,
          recipientName: item.recipientName,
          recipientIban: item.recipientIban,
          amountCents: item.amountCents.toString(),
          purpose: item.purpose,
          itemIndex: item.itemIndex,
          createdLedgerEntryId: item.createdLedgerEntryId,
        })),
      })),
    });
  } catch (error) {
    console.error('Error fetching breakdown sources:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Zahlbeleg-Aufschlüsselungen' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST – Upload & Match
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { id: caseId } = await params;
    const body: UploadRequest = await request.json();

    if (!body.zahlbelege || !Array.isArray(body.zahlbelege) || body.zahlbelege.length === 0) {
      return NextResponse.json(
        { error: 'Kein zahlbelege-Array im Request gefunden' },
        { status: 400 }
      );
    }

    // Prüfe ob Case existiert
    const caseExists = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseExists) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    // Existierende referenceNumbers laden für Duplikat-Check
    const existingRefs = await prisma.paymentBreakdownSource.findMany({
      where: { caseId },
      select: { referenceNumber: true },
    });
    const existingRefSet = new Set(existingRefs.map(r => r.referenceNumber));

    const results: {
      uploaded: number;
      matched: number;
      skipped: number;
      errors: string[];
      sources: {
        id: string;
        referenceNumber: string;
        totalAmountCents: string;
        matchedLedgerEntryId: string | null;
        status: string;
        itemCount: number;
        matchNote: string | null;
      }[];
    } = {
      uploaded: 0,
      matched: 0,
      skipped: 0,
      errors: [],
      sources: [],
    };

    for (const zahlbeleg of body.zahlbelege) {
      // Duplikat-Check
      if (existingRefSet.has(zahlbeleg.auftragsnummer)) {
        results.skipped++;
        continue;
      }

      // Bank-Mapping auflösen
      const bankAccountId = BANK_ACCOUNT_MAPPING[zahlbeleg.bank_konto];
      if (!bankAccountId) {
        results.errors.push(
          `${zahlbeleg.auftragsnummer}: Unbekanntes Bankkonto "${zahlbeleg.bank_konto}"`
        );
        continue;
      }

      const totalAmountCents = BigInt(Math.round(zahlbeleg.gesamtbetrag * 100));
      const executionDate = new Date(zahlbeleg.datum + 'T00:00:00.000Z');

      // Nur SAMMELÜBERWEISUNGEN mit >1 Einzelposten matchen
      const isSammel = zahlbeleg.typ === 'SAMMELÜBERWEISUNG' && zahlbeleg.einzelposten.length > 1;

      let matchedLedgerEntryId: string | null = null;
      let matchNote: string | null = null;
      let status = 'UPLOADED';

      if (isSammel) {
        // Matching: Suche LedgerEntry
        // amountCents im Ledger ist negativ (Auszahlung), Zahlbeleg ist positiv
        const ledgerAmountCents = -totalAmountCents;

        // Datum ±3 Tage
        const dateFrom = new Date(executionDate);
        dateFrom.setDate(dateFrom.getDate() - 3);
        const dateTo = new Date(executionDate);
        dateTo.setDate(dateTo.getDate() + 3);

        const candidates = await prisma.ledgerEntry.findMany({
          where: {
            caseId,
            bankAccountId,
            amountCents: ledgerAmountCents,
            transactionDate: { gte: dateFrom, lte: dateTo },
            parentEntryId: null, // Kein Child
            splitChildren: { none: {} }, // Hat keine Children
          },
          select: { id: true, description: true, transactionDate: true },
        });

        // Bevorzuge Einträge mit "SAMMEL" in Beschreibung
        const sammelCandidates = candidates.filter(c =>
          c.description.toUpperCase().includes('SAMMEL')
        );

        const match = sammelCandidates.length > 0 ? sammelCandidates[0] : null;

        if (match) {
          matchedLedgerEntryId = match.id;
          matchNote = `Automatisch gematcht: ${match.description} (${match.transactionDate.toISOString().slice(0, 10)})`;
          status = 'MATCHED';
        } else if (candidates.length > 0) {
          // Fallback: Auch ohne "SAMMEL" im Namen, wenn Betrag und Datum passen
          matchedLedgerEntryId = candidates[0].id;
          matchNote = `Gematcht ohne SAMMEL-Keyword: ${candidates[0].description} (${candidates[0].transactionDate.toISOString().slice(0, 10)})`;
          status = 'MATCHED';
        }
      }

      // Persistieren in Transaction
      const source = await prisma.$transaction(async (tx) => {
        const created = await tx.paymentBreakdownSource.create({
          data: {
            caseId,
            referenceNumber: zahlbeleg.auftragsnummer,
            executionDate,
            totalAmountCents,
            bankAccountId,
            paymentType: zahlbeleg.zahlungsart,
            sourceFileName: body.sourceFileName || null,
            matchedLedgerEntryId,
            matchNote,
            status,
            uploadedBy: session.username,
          },
        });

        // Items erstellen
        await Promise.all(
          zahlbeleg.einzelposten.map((item, index) =>
            tx.paymentBreakdownItem.create({
              data: {
                sourceId: created.id,
                recipientName: item.empfänger,
                recipientIban: item.iban,
                amountCents: BigInt(Math.round(item.betrag * 100)),
                purpose: item.verwendungszweck || null,
                itemIndex: index,
              },
            })
          )
        );

        return created;
      });

      results.uploaded++;
      if (status === 'MATCHED') results.matched++;

      results.sources.push({
        id: source.id,
        referenceNumber: source.referenceNumber,
        totalAmountCents: source.totalAmountCents.toString(),
        matchedLedgerEntryId: source.matchedLedgerEntryId,
        status: source.status,
        itemCount: zahlbeleg.einzelposten.length,
        matchNote: source.matchNote,
      });

      // Set für Duplikat-Check aktualisieren
      existingRefSet.add(zahlbeleg.auftragsnummer);
    }

    return NextResponse.json(results, { status: 201 });
  } catch (error) {
    console.error('Error uploading breakdown sources:', error);
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json(
      { error: 'Fehler beim Upload der Zahlbelege', details: message },
      { status: 500 }
    );
  }
}
