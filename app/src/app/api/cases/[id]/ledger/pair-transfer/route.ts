import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { markAggregationStale, createAuditLog, AUDIT_ACTIONS } from '@/lib/ledger';

// =============================================================================
// POST /api/cases/[id]/ledger/pair-transfer - Zwei Entries als Umbuchung verknüpfen
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
    const { entryIdA, entryIdB } = body;

    if (!entryIdA || !entryIdB) {
      return NextResponse.json(
        { error: 'entryIdA und entryIdB sind erforderlich' },
        { status: 400 }
      );
    }

    if (entryIdA === entryIdB) {
      return NextResponse.json(
        { error: 'Ein Eintrag kann nicht mit sich selbst verknüpft werden' },
        { status: 400 }
      );
    }

    // Beide Entries laden und prüfen
    const [entryA, entryB] = await Promise.all([
      prisma.ledgerEntry.findFirst({ where: { id: entryIdA, caseId } }),
      prisma.ledgerEntry.findFirst({ where: { id: entryIdB, caseId } }),
    ]);

    if (!entryA || !entryB) {
      return NextResponse.json(
        { error: 'Einer oder beide Einträge wurden nicht gefunden' },
        { status: 404 }
      );
    }

    // Prüfen: Keiner darf bereits gepairt sein
    if (entryA.transferPartnerEntryId) {
      return NextResponse.json(
        { error: `Eintrag "${entryA.description}" ist bereits als Umbuchung verknüpft` },
        { status: 400 }
      );
    }
    if (entryB.transferPartnerEntryId) {
      return NextResponse.json(
        { error: `Eintrag "${entryB.description}" ist bereits als Umbuchung verknüpft` },
        { status: 400 }
      );
    }

    // Prüfen: Beträge müssen betragsmäßig gleich und gegenläufig sein
    const amountA = BigInt(entryA.amountCents);
    const amountB = BigInt(entryB.amountCents);

    if (amountA + amountB !== BigInt(0)) {
      return NextResponse.json(
        {
          error: `Beträge sind nicht gegenläufig. Summe: ${((Number(amountA) + Number(amountB)) / 100).toFixed(2)} EUR (muss 0 sein)`,
        },
        { status: 400 }
      );
    }

    // Warnung wenn gleiches Bankkonto (aber trotzdem erlauben)
    const sameAccount = entryA.bankAccountId && entryA.bankAccountId === entryB.bankAccountId;

    // Symmetrische Verknüpfung + legalBucket = NEUTRAL setzen
    await prisma.$transaction([
      prisma.ledgerEntry.update({
        where: { id: entryIdA },
        data: {
          transferPartnerEntryId: entryIdB,
          legalBucket: 'NEUTRAL',
        },
      }),
      prisma.ledgerEntry.update({
        where: { id: entryIdB },
        data: {
          transferPartnerEntryId: entryIdA,
          legalBucket: 'NEUTRAL',
        },
      }),
    ]);

    // Audit-Logs
    await Promise.all([
      createAuditLog(prisma, {
        ledgerEntryId: entryIdA,
        caseId,
        action: AUDIT_ACTIONS.UPDATED,
        fieldChanges: {
          transferPartnerEntryId: { old: null, new: entryIdB },
          legalBucket: { old: entryA.legalBucket, new: 'NEUTRAL' },
        },
        reason: 'Als Umbuchung verknüpft',
        userId: session.username,
      }),
      createAuditLog(prisma, {
        ledgerEntryId: entryIdB,
        caseId,
        action: AUDIT_ACTIONS.UPDATED,
        fieldChanges: {
          transferPartnerEntryId: { old: null, new: entryIdA },
          legalBucket: { old: entryB.legalBucket, new: 'NEUTRAL' },
        },
        reason: 'Als Umbuchung verknüpft',
        userId: session.username,
      }),
    ]);

    // Aggregation als stale markieren
    await markAggregationStale(prisma, caseId);

    return NextResponse.json({
      success: true,
      message: 'Umbuchung verknüpft',
      ...(sameAccount ? { warning: 'Beide Einträge haben dasselbe Bankkonto' } : {}),
    });
  } catch (error) {
    console.error('Error pairing transfer entries:', error);
    return NextResponse.json(
      { error: 'Fehler beim Verknüpfen der Umbuchung' },
      { status: 500 }
    );
  }
}
