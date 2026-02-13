import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeAssumption(a: any) {
  return {
    id: a.id,
    scenarioId: a.scenarioId,
    caseId: a.caseId,
    categoryKey: a.categoryKey,
    categoryLabel: a.categoryLabel,
    flowType: a.flowType,
    assumptionType: a.assumptionType,
    baseAmountCents: a.baseAmountCents.toString(),
    baseAmountSource: a.baseAmountSource,
    baseAmountNote: a.baseAmountNote,
    growthFactorPercent: a.growthFactorPercent !== null ? Number(a.growthFactorPercent) : null,
    seasonalProfile: a.seasonalProfile,
    startPeriodIndex: a.startPeriodIndex,
    endPeriodIndex: a.endPeriodIndex,
    isActive: a.isActive,
    sortOrder: a.sortOrder,
    // Neue Felder: Methodik
    method: a.method ?? null,
    baseReferencePeriod: a.baseReferencePeriod ?? null,
    scenarioSensitivity: a.scenarioSensitivity ?? null,
    // Neue Felder: Risiko
    riskProbability: a.riskProbability ?? null,
    riskImpactCents: a.riskImpactCents !== null && a.riskImpactCents !== undefined ? a.riskImpactCents.toString() : null,
    riskComment: a.riskComment ?? null,
    // Neue Felder: Review
    lastReviewedAt: a.lastReviewedAt ? a.lastReviewedAt.toISOString() : null,
    visibilityScope: a.visibilityScope ?? null,
    createdAt: a.createdAt.toISOString(),
    createdBy: a.createdBy,
    updatedAt: a.updatedAt.toISOString(),
  };
}

// GET: Alle Annahmen des Base-Szenarios
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { id: caseId } = await params;

    const scenario = await prisma.forecastScenario.findFirst({
      where: { caseId, scenarioType: 'BASE', isActive: true },
    });

    if (!scenario) {
      return NextResponse.json({ assumptions: [] });
    }

    const assumptions = await prisma.forecastAssumption.findMany({
      where: { scenarioId: scenario.id },
      orderBy: [{ flowType: 'asc' }, { sortOrder: 'asc' }, { categoryLabel: 'asc' }],
    });

    return NextResponse.json({
      assumptions: assumptions.map(serializeAssumption),
    });
  } catch (error) {
    console.error('Forecast Assumptions GET Error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// POST: Neue Annahme erstellen
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { id: caseId } = await params;
    const body = await request.json();

    // Validierung
    if (!body.categoryKey || !body.categoryLabel || !body.flowType || !body.baseAmountSource) {
      return NextResponse.json(
        { error: 'Pflichtfelder fehlen: categoryKey, categoryLabel, flowType, baseAmountSource' },
        { status: 400 }
      );
    }

    const scenario = await prisma.forecastScenario.findFirst({
      where: { caseId, scenarioType: 'BASE', isActive: true },
    });

    if (!scenario) {
      return NextResponse.json({ error: 'Kein Base-Szenario vorhanden. Bitte zuerst Szenario erstellen.' }, { status: 404 });
    }

    const assumption = await prisma.forecastAssumption.create({
      data: {
        scenarioId: scenario.id,
        caseId,
        categoryKey: body.categoryKey,
        categoryLabel: body.categoryLabel,
        flowType: body.flowType,
        assumptionType: body.assumptionType || 'RUN_RATE',
        baseAmountCents: BigInt(body.baseAmountCents || '0'),
        baseAmountSource: body.baseAmountSource,
        baseAmountNote: body.baseAmountNote || null,
        growthFactorPercent: body.growthFactorPercent !== undefined && body.growthFactorPercent !== null
          ? body.growthFactorPercent
          : null,
        seasonalProfile: body.seasonalProfile ? JSON.stringify(body.seasonalProfile) : null,
        startPeriodIndex: body.startPeriodIndex ?? 0,
        endPeriodIndex: body.endPeriodIndex ?? (scenario.periodCount - 1),
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    });

    return NextResponse.json({ assumption: serializeAssumption(assumption) }, { status: 201 });
  } catch (error) {
    console.error('Forecast Assumptions POST Error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// PUT: Annahme aktualisieren
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    await params; // validate route param
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Annahme-ID fehlt' }, { status: 400 });
    }

    const existing = await prisma.forecastAssumption.findUnique({ where: { id: body.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Annahme nicht gefunden' }, { status: 404 });
    }

    const updated = await prisma.forecastAssumption.update({
      where: { id: body.id },
      data: {
        ...(body.categoryKey !== undefined && { categoryKey: body.categoryKey }),
        ...(body.categoryLabel !== undefined && { categoryLabel: body.categoryLabel }),
        ...(body.flowType !== undefined && { flowType: body.flowType }),
        ...(body.assumptionType !== undefined && { assumptionType: body.assumptionType }),
        ...(body.baseAmountCents !== undefined && { baseAmountCents: BigInt(body.baseAmountCents) }),
        ...(body.baseAmountSource !== undefined && { baseAmountSource: body.baseAmountSource }),
        ...(body.baseAmountNote !== undefined && { baseAmountNote: body.baseAmountNote }),
        ...(body.growthFactorPercent !== undefined && {
          growthFactorPercent: body.growthFactorPercent !== null ? body.growthFactorPercent : null,
        }),
        ...(body.seasonalProfile !== undefined && {
          seasonalProfile: body.seasonalProfile ? JSON.stringify(body.seasonalProfile) : null,
        }),
        ...(body.startPeriodIndex !== undefined && { startPeriodIndex: body.startPeriodIndex }),
        ...(body.endPeriodIndex !== undefined && { endPeriodIndex: body.endPeriodIndex }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
        // Neue Felder: Methodik
        ...(body.method !== undefined && { method: body.method }),
        ...(body.baseReferencePeriod !== undefined && { baseReferencePeriod: body.baseReferencePeriod }),
        ...(body.scenarioSensitivity !== undefined && { scenarioSensitivity: body.scenarioSensitivity }),
        // Neue Felder: Risiko
        ...(body.riskProbability !== undefined && { riskProbability: body.riskProbability }),
        ...(body.riskImpactCents !== undefined && {
          riskImpactCents: body.riskImpactCents !== null ? BigInt(body.riskImpactCents) : null,
        }),
        ...(body.riskComment !== undefined && { riskComment: body.riskComment }),
        // Neue Felder: Review
        ...(body.lastReviewedAt !== undefined && {
          lastReviewedAt: body.lastReviewedAt ? new Date(body.lastReviewedAt) : null,
        }),
        ...(body.visibilityScope !== undefined && { visibilityScope: body.visibilityScope }),
      },
    });

    return NextResponse.json({ assumption: serializeAssumption(updated) });
  } catch (error) {
    console.error('Forecast Assumptions PUT Error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// DELETE: Annahme löschen
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    await params; // validate route param
    const { searchParams } = new URL(request.url);
    const assumptionId = searchParams.get('id');

    if (!assumptionId) {
      return NextResponse.json({ error: 'Annahme-ID fehlt (?id=xxx)' }, { status: 400 });
    }

    await prisma.forecastAssumption.delete({ where: { id: assumptionId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Forecast Assumptions DELETE Error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
