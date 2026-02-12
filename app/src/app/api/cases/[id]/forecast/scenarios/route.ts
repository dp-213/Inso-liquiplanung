import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET: Base-Szenario laden (oder auto-erstellen)
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

    // Bestehende Szenarien laden
    let scenario = await prisma.forecastScenario.findFirst({
      where: { caseId, scenarioType: 'BASE', isActive: true },
      include: { assumptions: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
    });

    if (!scenario) {
      // Auto-Create: Aus LiquidityPlan Perioden-Konfiguration lesen
      const existingCase = await prisma.case.findUnique({
        where: { id: caseId },
        include: {
          plans: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      if (!existingCase) {
        return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
      }

      const plan = existingCase.plans[0];
      const periodType = plan?.periodType || existingCase.defaultPeriodType || 'MONTHLY';
      const periodCount = plan?.periodCount || existingCase.defaultPeriodCount || 11;
      const planStartDate = plan?.planStartDate || existingCase.openingDate || new Date();

      scenario = await prisma.forecastScenario.create({
        data: {
          caseId,
          name: 'Base-Szenario',
          description: 'Automatisch erstelltes Basis-Szenario',
          scenarioType: 'BASE',
          periodType,
          periodCount,
          planStartDate,
          openingBalanceCents: BigInt(0),
          openingBalanceSource: 'Automatisch erstellt – bitte IST-Daten aktualisieren',
        },
        include: { assumptions: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
      });
    }

    return NextResponse.json({
      scenario: {
        id: scenario.id,
        caseId: scenario.caseId,
        name: scenario.name,
        description: scenario.description,
        scenarioType: scenario.scenarioType,
        isActive: scenario.isActive,
        isLocked: scenario.isLocked,
        lockedAt: scenario.lockedAt?.toISOString() || null,
        lockedBy: scenario.lockedBy,
        lockedReason: scenario.lockedReason,
        periodType: scenario.periodType,
        periodCount: scenario.periodCount,
        planStartDate: scenario.planStartDate.toISOString(),
        istCutoffOverride: scenario.istCutoffOverride,
        openingBalanceCents: scenario.openingBalanceCents.toString(),
        openingBalanceSource: scenario.openingBalanceSource,
        reservesTotalCents: scenario.reservesTotalCents.toString(),
        createdAt: scenario.createdAt.toISOString(),
        createdBy: scenario.createdBy,
        updatedAt: scenario.updatedAt.toISOString(),
        assumptions: scenario.assumptions.map(a => ({
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
          createdAt: a.createdAt.toISOString(),
          createdBy: a.createdBy,
          updatedAt: a.updatedAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('Forecast Scenarios API Error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// PUT: Szenario aktualisieren
export async function PUT(
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

    const scenario = await prisma.forecastScenario.findFirst({
      where: { caseId, scenarioType: 'BASE', isActive: true },
    });

    if (!scenario) {
      return NextResponse.json({ error: 'Kein Base-Szenario vorhanden' }, { status: 404 });
    }

    const updated = await prisma.forecastScenario.update({
      where: { id: scenario.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.istCutoffOverride !== undefined && { istCutoffOverride: body.istCutoffOverride }),
        ...(body.openingBalanceCents !== undefined && { openingBalanceCents: BigInt(body.openingBalanceCents) }),
        ...(body.openingBalanceSource !== undefined && { openingBalanceSource: body.openingBalanceSource }),
        ...(body.reservesTotalCents !== undefined && { reservesTotalCents: BigInt(body.reservesTotalCents) }),
        ...(body.periodCount !== undefined && { periodCount: body.periodCount }),
      },
    });

    return NextResponse.json({
      scenario: {
        id: updated.id,
        caseId: updated.caseId,
        name: updated.name,
        description: updated.description,
        scenarioType: updated.scenarioType,
        isActive: updated.isActive,
        isLocked: updated.isLocked,
        lockedAt: updated.lockedAt?.toISOString() || null,
        lockedBy: updated.lockedBy,
        lockedReason: updated.lockedReason,
        periodType: updated.periodType,
        periodCount: updated.periodCount,
        planStartDate: updated.planStartDate.toISOString(),
        istCutoffOverride: updated.istCutoffOverride,
        openingBalanceCents: updated.openingBalanceCents.toString(),
        openingBalanceSource: updated.openingBalanceSource,
        reservesTotalCents: updated.reservesTotalCents.toString(),
        createdAt: updated.createdAt.toISOString(),
        createdBy: updated.createdBy,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Forecast Scenarios PUT Error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
