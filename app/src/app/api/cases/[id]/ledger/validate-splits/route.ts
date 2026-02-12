/**
 * API: Invarianten-Validierung für Splits
 *
 * GET /api/cases/[id]/ledger/validate-splits
 *
 * Prüft alle Split-Invarianten und gibt einen Report zurück:
 * 1. Per-Parent: Σ Children === Parent.amountCents
 * 2. Absolut Global: Σ aktive Entries === Σ Root-Entries
 * 3. Referentielle Integrität: Alle Children zeigen auf existierende Parents
 * 4. Keine Rekursion: Kein Entry ist gleichzeitig Parent und Child
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { EXCLUDE_SPLIT_PARENTS } from '@/lib/ledger/types';

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

    // Prüfen ob Case existiert
    const caseExists = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true },
    });

    if (!caseExists) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    // =========================================================================
    // Invariante 1: Per-Parent Summen-Check
    // =========================================================================

    // Alle Parents mit Children laden
    const splitParents = await prisma.ledgerEntry.findMany({
      where: {
        caseId,
        splitChildren: { some: {} },
      },
      include: {
        splitChildren: {
          select: {
            id: true,
            amountCents: true,
            description: true,
          },
        },
      },
    });

    const perParentFailed: Array<{
      parentId: string;
      parentDescription: string;
      parentAmountCents: string;
      childrenSumCents: string;
      differenzCents: string;
    }> = [];

    for (const parent of splitParents) {
      let childrenSum = BigInt(0);
      for (const child of parent.splitChildren) {
        childrenSum += child.amountCents;
      }

      if (childrenSum !== parent.amountCents) {
        const diff = childrenSum - parent.amountCents;
        perParentFailed.push({
          parentId: parent.id,
          parentDescription: parent.description,
          parentAmountCents: parent.amountCents.toString(),
          childrenSumCents: childrenSum.toString(),
          differenzCents: diff.toString(),
        });
      }
    }

    const totalChildren = splitParents.reduce(
      (sum, p) => sum + p.splitChildren.length, 0
    );

    // =========================================================================
    // Invariante 2: Absoluter globaler Summen-Check
    // =========================================================================

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
    const globalDelta = activeSumCents - rootSumCents;

    // =========================================================================
    // Invariante 3: Keine verwaisten Children
    // =========================================================================

    // Children deren Parent nicht existiert
    const allChildren = await prisma.ledgerEntry.findMany({
      where: {
        caseId,
        parentEntryId: { not: null },
      },
      select: {
        id: true,
        parentEntryId: true,
      },
    });

    const parentIds = new Set(
      (await prisma.ledgerEntry.findMany({
        where: { caseId },
        select: { id: true },
      })).map(e => e.id)
    );

    const orphanedChildren = allChildren.filter(
      c => c.parentEntryId && !parentIds.has(c.parentEntryId)
    );

    // =========================================================================
    // Invariante 4: Keine Rekursion
    // =========================================================================

    // Entries die sowohl Parent (haben Children) als auch Child (haben parentEntryId) sind
    const parentIdsWithChildren = new Set(splitParents.map(p => p.id));
    const childIdsWithParent = new Set(allChildren.map(c => c.id));

    const recursiveEntries = [...parentIdsWithChildren].filter(
      id => childIdsWithParent.has(id)
    );

    // =========================================================================
    // Report zusammenstellen
    // =========================================================================

    return NextResponse.json({
      caseId,
      validatedAt: new Date().toISOString(),
      totalSplitParents: splitParents.length,
      totalChildren,
      allPassed: perParentFailed.length === 0
        && globalDelta === BigInt(0)
        && orphanedChildren.length === 0
        && recursiveEntries.length === 0,
      invariants: {
        perParentSummenCheck: {
          passed: perParentFailed.length === 0,
          checked: splitParents.length,
          failed: perParentFailed,
          description: 'Σ Children === Parent.amountCents für jeden Split-Parent',
        },
        absoluteGlobalSum: {
          passed: globalDelta === BigInt(0),
          activeSumCents: activeSumCents.toString(),
          rootSumCents: rootSumCents.toString(),
          deltaCents: globalDelta.toString(),
          description: 'Σ aktive Entries === Σ Root-Entries (Bank-Realität)',
        },
        keineVerwaistenChildren: {
          passed: orphanedChildren.length === 0,
          orphanedCount: orphanedChildren.length,
          orphanedIds: orphanedChildren.map(c => c.id),
          description: 'Alle Children verweisen auf existierende Parents',
        },
        keineRekursion: {
          passed: recursiveEntries.length === 0,
          recursiveCount: recursiveEntries.length,
          recursiveIds: recursiveEntries,
          description: 'Kein Entry ist gleichzeitig Parent und Child',
        },
      },
    });
  } catch (error) {
    console.error('Error validating splits:', error);
    return NextResponse.json(
      { error: 'Fehler bei der Invarianten-Validierung' },
      { status: 500 }
    );
  }
}
