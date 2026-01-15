import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  calculateLiquidityPlan,
  calculateDataHash,
  CategoryInput,
  LineInput,
  WeeklyValueInput,
} from "@/lib/calculation-engine";

// GET /api/cases/[id]/calculate - Calculate liquidity plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get the case with active plan and all data
    const caseData = await prisma.case.findUnique({
      where: { id },
      include: {
        plans: {
          where: { isActive: true },
          include: {
            versions: {
              orderBy: { versionNumber: "desc" },
              take: 1,
            },
            categories: {
              include: {
                lines: {
                  include: {
                    weeklyValues: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!caseData) {
      return NextResponse.json(
        { error: "Fall nicht gefunden" },
        { status: 404 }
      );
    }

    const plan = caseData.plans[0];
    if (!plan) {
      return NextResponse.json(
        { error: "Kein aktiver Plan gefunden" },
        { status: 404 }
      );
    }

    // Get opening balance from latest version or default to 0
    const latestVersion = plan.versions[0];
    const openingBalanceCents = latestVersion
      ? BigInt(latestVersion.openingBalanceCents)
      : BigInt(0);

    // Prepare inputs for calculation engine
    const categories: CategoryInput[] = plan.categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      flowType: cat.flowType as "INFLOW" | "OUTFLOW",
      estateType: cat.estateType as "ALTMASSE" | "NEUMASSE",
      displayOrder: cat.displayOrder,
    }));

    const lines: LineInput[] = plan.categories.flatMap((cat) =>
      cat.lines.map((line) => ({
        id: line.id,
        categoryId: cat.id,
        name: line.name,
        displayOrder: line.displayOrder,
      }))
    );

    const weeklyValues: WeeklyValueInput[] = plan.categories.flatMap((cat) =>
      cat.lines.flatMap((line) =>
        line.weeklyValues.map((wv) => ({
          lineId: line.id,
          weekOffset: wv.weekOffset,
          valueType: wv.valueType as "IST" | "PLAN",
          amountCents: BigInt(wv.amountCents),
        }))
      )
    );

    // Run calculation engine
    const result = calculateLiquidityPlan(
      openingBalanceCents,
      categories,
      lines,
      weeklyValues,
      new Date(plan.planStartDate)
    );

    // Convert BigInt to string for JSON serialization
    const serializableResult = {
      ...result,
      openingBalanceCents: result.openingBalanceCents.toString(),
      totalInflowsCents: result.totalInflowsCents.toString(),
      totalOutflowsCents: result.totalOutflowsCents.toString(),
      totalNetCashflowCents: result.totalNetCashflowCents.toString(),
      finalClosingBalanceCents: result.finalClosingBalanceCents.toString(),
      totalInflowsAltmasseCents: result.totalInflowsAltmasseCents.toString(),
      totalInflowsNeumasseCents: result.totalInflowsNeumasseCents.toString(),
      totalOutflowsAltmasseCents: result.totalOutflowsAltmasseCents.toString(),
      totalOutflowsNeumasseCents: result.totalOutflowsNeumasseCents.toString(),
      weeks: result.weeks.map((week) => ({
        ...week,
        openingBalanceCents: week.openingBalanceCents.toString(),
        inflowsAltmasseCents: week.inflowsAltmasseCents.toString(),
        inflowsNeumasseCents: week.inflowsNeumasseCents.toString(),
        totalInflowsCents: week.totalInflowsCents.toString(),
        outflowsAltmasseCents: week.outflowsAltmasseCents.toString(),
        outflowsNeumasseCents: week.outflowsNeumasseCents.toString(),
        totalOutflowsCents: week.totalOutflowsCents.toString(),
        netCashflowCents: week.netCashflowCents.toString(),
        closingBalanceCents: week.closingBalanceCents.toString(),
      })),
      categories: result.categories.map((cat) => ({
        ...cat,
        totalCents: cat.totalCents.toString(),
        weeklyTotals: cat.weeklyTotals.map((t) => t.toString()),
        lines: cat.lines.map((line) => ({
          ...line,
          totalCents: line.totalCents.toString(),
          weeklyValues: line.weeklyValues.map((wv) => ({
            ...wv,
            istCents: wv.istCents?.toString() ?? null,
            planCents: wv.planCents?.toString() ?? null,
            effectiveCents: wv.effectiveCents.toString(),
          })),
        })),
      })),
      planId: plan.id,
      planName: plan.name,
      planStartDate: plan.planStartDate,
      caseNumber: caseData.caseNumber,
      debtorName: caseData.debtorName,
      versionNumber: latestVersion?.versionNumber ?? 0,
    };

    return NextResponse.json(serializableResult);
  } catch (error) {
    console.error("Error calculating plan:", error);
    return NextResponse.json(
      { error: "Fehler bei der Berechnung" },
      { status: 500 }
    );
  }
}

// POST /api/cases/[id]/calculate - Create new version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { openingBalanceCents, snapshotReason } = body;

    // Get the case with active plan
    const caseData = await prisma.case.findUnique({
      where: { id },
      include: {
        plans: {
          where: { isActive: true },
          include: {
            versions: {
              orderBy: { versionNumber: "desc" },
              take: 1,
            },
            categories: {
              include: {
                lines: {
                  include: {
                    weeklyValues: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!caseData || !caseData.plans[0]) {
      return NextResponse.json(
        { error: "Fall oder Plan nicht gefunden" },
        { status: 404 }
      );
    }

    const plan = caseData.plans[0];
    const newVersionNumber = (plan.versions[0]?.versionNumber ?? 0) + 1;

    // Calculate data hash
    const weeklyValues: WeeklyValueInput[] = plan.categories.flatMap((cat) =>
      cat.lines.flatMap((line) =>
        line.weeklyValues.map((wv) => ({
          lineId: line.id,
          weekOffset: wv.weekOffset,
          valueType: wv.valueType as "IST" | "PLAN",
          amountCents: BigInt(wv.amountCents),
        }))
      )
    );

    const dataHash = calculateDataHash(
      BigInt(openingBalanceCents || 0),
      weeklyValues
    );

    // Create new version
    const version = await prisma.liquidityPlanVersion.create({
      data: {
        planId: plan.id,
        versionNumber: newVersionNumber,
        snapshotReason: snapshotReason || "Manuelle Sicherung",
        openingBalanceCents: BigInt(openingBalanceCents || 0),
        dataHash,
        createdBy: session.username,
      },
    });

    return NextResponse.json({
      ...version,
      openingBalanceCents: version.openingBalanceCents.toString(),
    });
  } catch (error) {
    console.error("Error creating version:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Version" },
      { status: 500 }
    );
  }
}
