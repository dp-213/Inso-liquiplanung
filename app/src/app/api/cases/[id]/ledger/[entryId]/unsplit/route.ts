/**
 * API: Split rückgängig machen (Unsplit)
 *
 * POST /api/cases/[id]/ledger/[entryId]/unsplit
 *
 * Löscht alle Children eines Split-Parents.
 * Parent hat danach keine Children mehr → ist automatisch wieder aktiv.
 *
 * Sicherheitskonzept (5 Schichten):
 * 1. Pre-Check: Prüft ob Children reviewte/klassifizierte Daten haben
 * 2. Audit-Archiv: Speichert vollständige Child-Daten als JSON im Audit-Log
 * 3. Löschung in Transaction
 * 4. Absoluter Invarianten-Test
 * 5. Cache-Invalidierung
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  EXCLUDE_SPLIT_PARENTS,
  AUDIT_ACTIONS,
} from '@/lib/ledger/types';
import { createAuditLog } from '@/lib/ledger/governance';
import { markAggregationStale } from '@/lib/ledger/aggregation';

interface UnsplitRequest {
  reason: string;
  confirmLossOfClassifications?: boolean;
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
    const body: UnsplitRequest = await request.json();

    if (!body.reason || body.reason.trim() === '') {
      return NextResponse.json(
        { error: 'Begründung (reason) ist erforderlich' },
        { status: 400 }
      );
    }

    // 1. Parent laden
    const parent = await prisma.ledgerEntry.findFirst({
      where: { id: entryId, caseId },
    });

    if (!parent) {
      return NextResponse.json({ error: 'Eintrag nicht gefunden' }, { status: 404 });
    }

    // 2. Children laden
    const children = await prisma.ledgerEntry.findMany({
      where: { parentEntryId: entryId },
      include: {
        counterparty: { select: { name: true } },
        location: { select: { name: true } },
      },
    });

    if (children.length === 0) {
      return NextResponse.json(
        { error: 'Eintrag hat keine Einzelposten zum Rückgängigmachen' },
        { status: 400 }
      );
    }

    // 3. Pre-Check: Haben Children reviewte/klassifizierte Daten?
    const classifiedChildren = children.filter(
      c =>
        c.reviewStatus === 'CONFIRMED' ||
        c.reviewStatus === 'ADJUSTED' ||
        c.counterpartyId !== null ||
        c.locationId !== null ||
        c.categoryTag !== null ||
        c.estateAllocation !== null
    );

    if (classifiedChildren.length > 0 && !body.confirmLossOfClassifications) {
      return NextResponse.json({
        error: 'Einzelposten haben klassifizierte Daten. Bestätigung erforderlich.',
        requiresConfirmation: true,
        classifiedChildren: classifiedChildren.map(c => ({
          id: c.id,
          description: c.description,
          amountCents: c.amountCents.toString(),
          reviewStatus: c.reviewStatus,
          counterpartyName: c.counterparty?.name || null,
          locationName: c.location?.name || null,
          categoryTag: c.categoryTag,
          estateAllocation: c.estateAllocation,
        })),
        message: `${classifiedChildren.length} von ${children.length} Einzelposten haben klassifizierte Daten. Mit confirmLossOfClassifications=true bestätigen.`,
      }, { status: 400 });
    }

    // 4. Transaction: Archivieren + Löschen + Invarianten-Test
    const result = await prisma.$transaction(async (tx) => {
      // Audit-Archiv: Vollständige Child-Daten speichern BEVOR gelöscht wird
      const childArchive = children.map(c => ({
        id: c.id,
        description: c.description,
        amountCents: c.amountCents.toString(),
        counterpartyId: c.counterpartyId,
        counterpartyName: c.counterparty?.name || null,
        locationId: c.locationId,
        locationName: c.location?.name || null,
        categoryTag: c.categoryTag,
        estateAllocation: c.estateAllocation,
        estateRatio: c.estateRatio?.toString() || null,
        reviewStatus: c.reviewStatus,
        note: c.note,
      }));

      // Audit-Log mit Archiv erstellen
      await createAuditLog(tx as unknown as import('@prisma/client').PrismaClient, {
        ledgerEntryId: parent.id,
        caseId,
        action: AUDIT_ACTIONS.UNSPLIT,
        fieldChanges: {
          unsplit: {
            old: `${children.length} Einzelposten`,
            new: null,
          },
          archivedChildren: {
            old: JSON.stringify(childArchive),
            new: null,
          },
        },
        reason: body.reason,
        userId: session.username,
      });

      // Children löschen
      await tx.ledgerEntry.deleteMany({
        where: { parentEntryId: entryId },
      });

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

      return { deletedCount: children.length, activeSumCents, rootSumCents };
    });

    // Cache invalidieren
    await markAggregationStale(prisma, caseId);

    return NextResponse.json({
      success: true,
      parentId: parent.id,
      childrenDeleted: result.deletedCount,
      invariantenTest: {
        aktiveSumme: result.activeSumCents.toString(),
        rootSumme: result.rootSumCents.toString(),
        differenz: '0',
        status: 'OK',
      },
    });
  } catch (error) {
    console.error('Error unsplitting ledger entry:', error);

    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';

    if (message.includes('INVARIANTEN-VERLETZUNG')) {
      return NextResponse.json(
        { error: message, type: 'INVARIANT_VIOLATION' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Fehler beim Rückgängigmachen der Aufspaltung', details: message },
      { status: 500 }
    );
  }
}
