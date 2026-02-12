/**
 * API: Zahlbeleg-Split – Idempotentes Splitting
 *
 * POST /api/cases/[id]/ledger/breakdown/split
 *
 * Erstellt Children-Entries für alle gematchten PaymentBreakdownSources.
 * Idempotent: Bereits gesplittete Sources (Status=SPLIT) werden übersprungen.
 *
 * Request: { sourceIds?: string[], dryRun?: boolean }
 * - Ohne sourceIds: alle MATCHED Sources für den Case
 * - Mit sourceIds: nur die angegebenen
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

interface SplitRequest {
  sourceIds?: string[];
  dryRun?: boolean;
}

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
    const body: SplitRequest = await request.json();
    const dryRun = body.dryRun === true;

    // Sources laden
    const whereClause: Record<string, unknown> = {
      caseId,
      status: 'MATCHED',
      matchedLedgerEntryId: { not: null },
    };

    if (body.sourceIds && body.sourceIds.length > 0) {
      whereClause.id = { in: body.sourceIds };
    }

    const sources = await prisma.paymentBreakdownSource.findMany({
      where: whereClause,
      include: {
        items: { orderBy: { itemIndex: 'asc' } },
      },
    });

    if (sources.length === 0) {
      return NextResponse.json({
        dryRun,
        processed: 0,
        childrenCreated: 0,
        skipped: 0,
        errors: [],
        invariantenTest: 'N/A',
        results: [],
        message: 'Keine MATCHED Sources zum Splitten gefunden',
      });
    }

    const results: {
      sourceId: string;
      referenceNumber: string;
      childrenCreated: number;
      status: string;
    }[] = [];
    const errors: string[] = [];
    let totalChildrenCreated = 0;

    if (dryRun) {
      // Dry-Run: Nur Validierung
      for (const source of sources) {
        // Prüfe Parent
        const parent = await prisma.ledgerEntry.findFirst({
          where: {
            id: source.matchedLedgerEntryId!,
            caseId,
          },
          include: { splitChildren: { select: { id: true } } },
        });

        if (!parent) {
          errors.push(`${source.referenceNumber}: Parent-Entry ${source.matchedLedgerEntryId} nicht gefunden`);
          continue;
        }

        if (parent.splitChildren.length > 0) {
          errors.push(`${source.referenceNumber}: Parent hat bereits ${parent.splitChildren.length} Children`);
          continue;
        }

        if (parent.parentEntryId !== null) {
          errors.push(`${source.referenceNumber}: Parent ist selbst ein Child (keine rekursiven Splits)`);
          continue;
        }

        // Summenvalidierung: Items müssen Parent-Betrag ergeben
        let itemSumCents = BigInt(0);
        for (const item of source.items) {
          itemSumCents += item.amountCents;
        }

        // Items sind positiv, Parent ist negativ → Vergleich: -itemSum === parent.amountCents
        const expectedParentAmount = -itemSumCents;
        if (expectedParentAmount !== parent.amountCents) {
          errors.push(
            `${source.referenceNumber}: Summenprüfung fehlgeschlagen. ` +
            `Items: ${itemSumCents.toString()} (positiv), Parent: ${parent.amountCents.toString()}. ` +
            `Erwartet: ${expectedParentAmount.toString()}`
          );
          continue;
        }

        results.push({
          sourceId: source.id,
          referenceNumber: source.referenceNumber,
          childrenCreated: source.items.length,
          status: 'VALID',
        });
        totalChildrenCreated += source.items.length;
      }

      return NextResponse.json({
        dryRun: true,
        processed: results.length,
        childrenCreated: totalChildrenCreated,
        skipped: 0,
        errors,
        invariantenTest: 'N/A (Dry-Run)',
        results,
      });
    }

    // Echte Ausführung
    for (const source of sources) {
      try {
        const splitResult = await prisma.$transaction(async (tx) => {
          // Parent laden und prüfen
          const parent = await tx.ledgerEntry.findFirst({
            where: {
              id: source.matchedLedgerEntryId!,
              caseId,
            },
            include: { splitChildren: { select: { id: true } } },
          });

          if (!parent) {
            throw new Error(`Parent-Entry ${source.matchedLedgerEntryId} nicht gefunden`);
          }

          if (parent.splitChildren.length > 0) {
            throw new Error(`Parent hat bereits ${parent.splitChildren.length} Children`);
          }

          if (parent.parentEntryId !== null) {
            throw new Error('Parent ist selbst ein Child (keine rekursiven Splits)');
          }

          // Summenvalidierung
          let itemSumCents = BigInt(0);
          for (const item of source.items) {
            itemSumCents += item.amountCents;
          }
          const expectedParentAmount = -itemSumCents;
          if (expectedParentAmount !== parent.amountCents) {
            throw new Error(
              `Summenprüfung: Items ${itemSumCents.toString()} ≠ |Parent| ${(-parent.amountCents).toString()}`
            );
          }

          // Children erstellen
          const itemCount = source.items.length;
          const createdChildren = await Promise.all(
            source.items.map((item) =>
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
                  allocationNote: parent.allocationNote,
                  // Eigene Werte
                  description: item.recipientName,
                  amountCents: -item.amountCents, // Zahlbeleg positiv → Ledger negativ
                  note: item.purpose || null,
                  bookingReference: item.recipientIban,
                  // Metadata
                  bookingSource: 'MANUAL',
                  splitReason: `Zahlbeleg ${source.referenceNumber}, Posten ${item.itemIndex + 1}/${itemCount}`,
                  importSource: source.sourceFileName || null,
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
              `(Differenz: ${activeSumCents - rootSumCents})`
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
                new: `${createdChildren.length} Einzelposten aus Zahlbeleg ${source.referenceNumber}`,
              },
              breakdownSourceId: {
                old: null,
                new: source.id,
              },
            },
            reason: `Zahlbeleg-Split: ${source.referenceNumber}`,
            userId: session.username,
          });

          // Source-Status aktualisieren
          await tx.paymentBreakdownSource.update({
            where: { id: source.id },
            data: {
              status: 'SPLIT',
              splitAt: new Date(),
            },
          });

          // Items mit createdLedgerEntryId aktualisieren
          await Promise.all(
            source.items.map((item, index) =>
              tx.paymentBreakdownItem.update({
                where: { id: item.id },
                data: { createdLedgerEntryId: createdChildren[index].id },
              })
            )
          );

          return { childrenCreated: createdChildren.length };
        });

        results.push({
          sourceId: source.id,
          referenceNumber: source.referenceNumber,
          childrenCreated: splitResult.childrenCreated,
          status: 'SPLIT',
        });
        totalChildrenCreated += splitResult.childrenCreated;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
        errors.push(`${source.referenceNumber}: ${message}`);
        results.push({
          sourceId: source.id,
          referenceNumber: source.referenceNumber,
          childrenCreated: 0,
          status: 'ERROR',
        });

        // Fehler-Status auf Source setzen
        await prisma.paymentBreakdownSource.update({
          where: { id: source.id },
          data: { status: 'ERROR', errorMessage: message },
        }).catch(() => {}); // Best-effort
      }
    }

    // Cache invalidieren
    await markAggregationStale(prisma, caseId);

    // Abschließender Invarianten-Test
    const [activeSum, rootSum] = await Promise.all([
      prisma.ledgerEntry.aggregate({
        where: { caseId, ...EXCLUDE_SPLIT_PARENTS },
        _sum: { amountCents: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: { caseId, parentEntryId: null },
        _sum: { amountCents: true },
      }),
    ]);

    const activeSumCents = activeSum._sum.amountCents ?? BigInt(0);
    const rootSumCents = rootSum._sum.amountCents ?? BigInt(0);

    return NextResponse.json({
      dryRun: false,
      processed: results.filter(r => r.status === 'SPLIT').length,
      childrenCreated: totalChildrenCreated,
      skipped: 0,
      errors,
      invariantenTest: activeSumCents === rootSumCents ? 'OK' : `FEHLER: ${activeSumCents} ≠ ${rootSumCents}`,
      results,
    });
  } catch (error) {
    console.error('Error splitting breakdown sources:', error);
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';

    if (message.includes('INVARIANTEN-VERLETZUNG')) {
      return NextResponse.json(
        { error: message, type: 'INVARIANT_VIOLATION' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Fehler beim Splitten der Zahlbelege', details: message },
      { status: 500 }
    );
  }
}
