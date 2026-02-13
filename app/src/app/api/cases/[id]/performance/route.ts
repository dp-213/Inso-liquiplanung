/**
 * API: Performance-Engine (GuV-light)
 *
 * GET /api/cases/{caseId}/performance
 *   ?allocationMethod=NONE|REVENUE_SHARE|HEADCOUNT_SHARE
 *   &includeUnreviewed=false
 *
 * Berechnet pro Standort und Monat einen Deckungsbeitrag.
 * BigInt-Werte werden als String serialisiert.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { calculatePerformance } from '@/lib/performance-engine';
import type { AllocationMethod } from '@/lib/performance-engine';

// =============================================================================
// BigInt JSON Serialization
// =============================================================================

function serializeBigInts(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInts);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = serializeBigInts(value);
    }
    return result;
  }
  return obj;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: caseId } = await params;
    const { searchParams } = new URL(request.url);

    // Auth: Nur Admin-Session (Performance-Daten sind intern)
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    // Case + aktiven Plan laden
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        debtorName: true,
        plans: {
          where: { isActive: true },
          select: { id: true, periodType: true, periodCount: true },
          take: 1,
        },
      },
    });

    if (!caseData) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    const plan = caseData.plans[0];
    if (!plan) {
      return NextResponse.json({ error: 'Kein aktiver Plan gefunden' }, { status: 404 });
    }

    if (plan.periodType !== 'MONTHLY') {
      return NextResponse.json(
        { error: `Performance-Engine unterstützt nur MONTHLY. Plan ist ${plan.periodType}.` },
        { status: 400 },
      );
    }

    // Query-Parameter
    const allocationMethodParam = searchParams.get('allocationMethod') || 'NONE';
    const validMethods: AllocationMethod[] = ['NONE', 'REVENUE_SHARE', 'HEADCOUNT_SHARE'];
    const allocationMethod = validMethods.includes(allocationMethodParam as AllocationMethod)
      ? (allocationMethodParam as AllocationMethod)
      : 'NONE';

    const includeUnreviewed = searchParams.get('includeUnreviewed') === 'true';

    // Performance berechnen
    const result = await calculatePerformance(prisma, {
      caseId,
      planId: plan.id,
      allocationMethod,
      includeUnreviewed,
    });

    // BigInt → String serialisieren
    const serialized = serializeBigInts(result);

    return NextResponse.json(serialized);
  } catch (error) {
    console.error('[Performance API] Fehler:', error);
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
