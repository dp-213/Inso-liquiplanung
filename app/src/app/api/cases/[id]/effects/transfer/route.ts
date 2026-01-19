import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  transferEffectsToLedger,
  removeEffectFromLedger,
  getTransferredEffectIds,
} from '@/lib/effects/transfer-engine';

/**
 * POST /api/cases/[id]/effects/transfer
 * Überführt ausgewählte InsolvencyEffects in PLAN-LedgerEntries
 *
 * Body: { effectIds: string[] }
 *
 * Response: {
 *   success: boolean,
 *   created: number,
 *   deleted: number,
 *   skipped: number,
 *   errors: Array<{ effectId: string, error: string }>
 * }
 */
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

    // Request Body parsen
    const body = await request.json();
    const effectIds = body.effectIds as string[];

    if (!effectIds || !Array.isArray(effectIds) || effectIds.length === 0) {
      return NextResponse.json(
        { error: 'effectIds erforderlich (Array von Effekt-IDs)' },
        { status: 400 }
      );
    }

    // Aktiven Plan für den Case laden
    const plan = await prisma.liquidityPlan.findFirst({
      where: { caseId, isActive: true },
      select: { id: true },
    });

    if (!plan) {
      return NextResponse.json(
        { error: 'Kein aktiver Liquiditätsplan für diesen Fall' },
        { status: 404 }
      );
    }

    // Transfer durchführen
    const result = await transferEffectsToLedger(
      prisma,
      caseId,
      plan.id,
      effectIds,
      session.username
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Fehler beim Transfer von Insolvenzeffekten:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cases/[id]/effects/transfer?effectId=xxx
 * Entfernt alle aus einem Effekt abgeleiteten LedgerEntries
 *
 * Query: effectId - ID des Effekts
 *
 * Response: { deleted: number }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    await params; // Warten auf params (wird für caseId nicht direkt benötigt)

    const { searchParams } = new URL(request.url);
    const effectId = searchParams.get('effectId');

    if (!effectId) {
      return NextResponse.json(
        { error: 'effectId Query-Parameter erforderlich' },
        { status: 400 }
      );
    }

    const deleted = await removeEffectFromLedger(prisma, effectId);

    return NextResponse.json({ deleted });
  } catch (error) {
    console.error('Fehler beim Entfernen von Effekt-Entries:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cases/[id]/effects/transfer?effectIds=id1,id2,id3
 * Prüft welche Effekte bereits ins Ledger überführt wurden
 *
 * Query: effectIds - Komma-separierte Liste von Effekt-IDs
 *
 * Response: { transferredIds: string[] }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    await params; // Warten auf params

    const { searchParams } = new URL(request.url);
    const effectIdsParam = searchParams.get('effectIds');

    if (!effectIdsParam) {
      return NextResponse.json(
        { error: 'effectIds Query-Parameter erforderlich (komma-separiert)' },
        { status: 400 }
      );
    }

    const effectIds = effectIdsParam.split(',').filter((id) => id.trim());

    if (effectIds.length === 0) {
      return NextResponse.json({ transferredIds: [] });
    }

    const transferredSet = await getTransferredEffectIds(prisma, effectIds);

    return NextResponse.json({
      transferredIds: Array.from(transferredSet),
    });
  } catch (error) {
    console.error('Fehler beim Prüfen der Transfer-Status:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
