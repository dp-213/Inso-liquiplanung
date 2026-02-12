/**
 * API: Sammelüberweisung aufsplitten
 *
 * POST /api/cases/[id]/ledger/[entryId]/split
 *
 * Erstellt Children-Entries für einen Parent (Sammelüberweisung).
 * Parent bleibt unverändert – er wird durch die Existenz seiner Children
 * strukturell als "deaktiviert" erkannt (EXCLUDE_SPLIT_PARENTS Filter).
 *
 * Invarianten:
 * - Σ Children.amountCents === Parent.amountCents (Cent-genau)
 * - Absoluter Test: Σ aktive Entries === Σ Root-Entries (pro Case)
 *
 * Query: ?dryRun=true für Preview ohne Persistierung
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  EXCLUDE_SPLIT_PARENTS,
  AUDIT_ACTIONS,
  REVIEW_STATUS,
} from '@/lib/ledger/types';
import { createAuditLog } from '@/lib/ledger/governance';
import { markAggregationStale } from '@/lib/ledger/aggregation';

interface SplitChildInput {
  description: string;
  amountCents: number; // In Cents (wird zu BigInt konvertiert)
  counterpartyId?: string | null;
  locationId?: string | null;
  categoryTag?: string | null;
  note?: string | null;
}

interface SplitRequest {
  children: SplitChildInput[];
  splitReason: string;
  dataSource?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { id: caseId, entryId } = await params;
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';
    const body: SplitRequest = await request.json();

    // Validierung: children Array muss vorhanden sein
    if (!body.children || !Array.isArray(body.children) || body.children.length === 0) {
      return NextResponse.json(
        { error: 'Mindestens ein Einzelposten erforderlich' },
        { status: 400 }
      );
    }

    if (!body.splitReason || body.splitReason.trim() === '') {
      return NextResponse.json(
        { error: 'Aufspaltungsgrund (splitReason) ist erforderlich' },
        { status: 400 }
      );
    }

    // Validierung: Jedes Child braucht description und amountCents
    for (let i = 0; i < body.children.length; i++) {
      const child = body.children[i];
      if (!child.description || child.description.trim() === '') {
        return NextResponse.json(
          { error: `Einzelposten ${i + 1}: Beschreibung fehlt` },
          { status: 400 }
        );
      }
      if (child.amountCents === undefined || child.amountCents === null) {
        return NextResponse.json(
          { error: `Einzelposten ${i + 1}: Betrag fehlt` },
          { status: 400 }
        );
      }
    }

    // 1. Parent laden
    const parent = await prisma.ledgerEntry.findFirst({
      where: { id: entryId, caseId },
    });

    if (!parent) {
      return NextResponse.json({ error: 'Eintrag nicht gefunden' }, { status: 404 });
    }

    // 2. Hat schon Children?
    const existingChildCount = await prisma.ledgerEntry.count({
      where: { parentEntryId: entryId },
    });

    if (existingChildCount > 0) {
      return NextResponse.json(
        { error: `Eintrag wurde bereits aufgespalten (${existingChildCount} Einzelposten). Erst rückgängig machen.` },
        { status: 400 }
      );
    }

    // 3. Anti-Rekursion: Ist Parent selbst ein Child?
    if (parent.parentEntryId !== null) {
      return NextResponse.json(
        { error: 'Einzelposten können nicht weiter aufgespalten werden (keine rekursiven Splits).' },
        { status: 400 }
      );
    }

    // 4. Cent-genaue Summenvalidierung (BigInt!)
    const parentAmountCents = parent.amountCents;
    let childrenSumCents = BigInt(0);
    for (const child of body.children) {
      childrenSumCents += BigInt(child.amountCents);
    }

    if (childrenSumCents !== parentAmountCents) {
      const diff = childrenSumCents - parentAmountCents;
      return NextResponse.json({
        error: 'Summenprüfung fehlgeschlagen',
        details: {
          parentAmountCents: parentAmountCents.toString(),
          childrenSumCents: childrenSumCents.toString(),
          differenzCents: diff.toString(),
          message: `Summe der Einzelposten (${childrenSumCents.toString()}) ≠ Gesamtbetrag (${parentAmountCents.toString()}). Differenz: ${diff.toString()} Cents.`,
        },
      }, { status: 400 });
    }

    // Dry-Run: Nur Validierung, keine Persistierung
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        valid: true,
        parentId: parent.id,
        parentAmountCents: parentAmountCents.toString(),
        parentDescription: parent.description,
        childrenCount: body.children.length,
        childrenSumCents: childrenSumCents.toString(),
        summenCheck: 'OK',
        children: body.children.map((c, i) => ({
          index: i,
          description: c.description,
          amountCents: c.amountCents.toString(),
          counterpartyId: c.counterpartyId || null,
          locationId: c.locationId || null,
          categoryTag: c.categoryTag || null,
        })),
      });
    }

    // 5. Transaction: Children erstellen + Invarianten-Test
    const result = await prisma.$transaction(async (tx) => {
      // Children erstellen
      const createdChildren = await Promise.all(
        body.children.map((child) =>
          tx.ledgerEntry.create({
            data: {
              caseId,
              parentEntryId: parent.id,
              // Vom Parent geerbt
              transactionDate: parent.transactionDate,
              valueType: parent.valueType,
              legalBucket: parent.legalBucket,
              bankAccountId: parent.bankAccountId,
              estateAllocation: parent.estateAllocation,
              estateRatio: parent.estateRatio,
              allocationSource: parent.allocationSource,
              // Eigene Werte
              description: child.description,
              amountCents: BigInt(child.amountCents),
              counterpartyId: child.counterpartyId || null,
              locationId: child.locationId || null,
              categoryTag: child.categoryTag || null,
              categoryTagSource: child.categoryTag ? 'IMPORT' : null,
              note: child.note || null,
              // Metadata
              bookingSource: 'MANUAL',
              splitReason: body.splitReason,
              importSource: body.dataSource || null,
              reviewStatus: REVIEW_STATUS.UNREVIEWED,
              createdBy: session.username,
            },
          })
        )
      );

      // ABSOLUTER INVARIANTEN-TEST
      const [activeSum, rootSum] = await Promise.all([
        tx.ledgerEntry.aggregate({
          where: { caseId, ...EXCLUDE_SPLIT_PARENTS },
          _sum: { amountCents: true },
        }),
        tx.ledgerEntry.aggregate({
          where: { caseId, parentEntryId: null },
          _sum: { amountCents: true },
        }),
      ]);

      const activeSumCents = activeSum._sum.amountCents ?? BigInt(0);
      const rootSumCents = rootSum._sum.amountCents ?? BigInt(0);

      if (activeSumCents !== rootSumCents) {
        throw new Error(
          `INVARIANTEN-VERLETZUNG: Aktive Summe ${activeSumCents} ≠ Root-Summe ${rootSumCents} ` +
          `(Differenz: ${activeSumCents - rootSumCents} Cents)`
        );
      }

      // Audit-Log für den Parent
      await createAuditLog(tx as unknown as import('@prisma/client').PrismaClient, {
        ledgerEntryId: parent.id,
        caseId,
        action: AUDIT_ACTIONS.SPLIT,
        fieldChanges: {
          split: {
            old: null,
            new: `${createdChildren.length} Einzelposten erstellt`,
          },
        },
        reason: body.splitReason,
        userId: session.username,
      });

      return { createdChildren, activeSumCents, rootSumCents };
    });

    // Cache invalidieren
    await markAggregationStale(prisma, caseId);

    return NextResponse.json({
      success: true,
      parentId: parent.id,
      childrenCreated: result.createdChildren.length,
      childrenIds: result.createdChildren.map(c => c.id),
      invariantenTest: {
        aktiveSumme: result.activeSumCents.toString(),
        rootSumme: result.rootSumCents.toString(),
        differenz: '0',
        status: 'OK',
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error splitting ledger entry:', error);

    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';

    // Invarianten-Verletzung ist ein spezifischer Fehler
    if (message.includes('INVARIANTEN-VERLETZUNG')) {
      return NextResponse.json(
        { error: message, type: 'INVARIANT_VIOLATION' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Fehler beim Aufsplitten des Eintrags', details: message },
      { status: 500 }
    );
  }
}
