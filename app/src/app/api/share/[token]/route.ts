import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  calculateLiquidityPlan,
  CategoryInput,
  LineInput,
  WeeklyValueInput,
} from "@/lib/calculation-engine";

// GET /api/share/[token] - Get case data via share link (no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Find share link
    const shareLink = await prisma.shareLink.findUnique({
      where: { token },
      include: {
        case: {
          include: {
            project: {
              select: { name: true },
            },
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
                      orderBy: { displayOrder: "asc" },
                    },
                  },
                  orderBy: { displayOrder: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (!shareLink) {
      return NextResponse.json(
        { error: "Ungültiger oder abgelaufener Link" },
        { status: 404 }
      );
    }

    if (!shareLink.isActive) {
      return NextResponse.json(
        { error: "Dieser Zugang wurde deaktiviert" },
        { status: 403 }
      );
    }

    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return NextResponse.json(
        { error: "Dieser Zugang ist abgelaufen" },
        { status: 403 }
      );
    }

    // Update access count
    await prisma.shareLink.update({
      where: { id: shareLink.id },
      data: {
        accessCount: { increment: 1 },
        lastAccessAt: new Date(),
      },
    });

    const caseData = shareLink.case;
    const plan = caseData.plans[0];

    if (!plan) {
      return NextResponse.json(
        { error: "Kein Liquiditaetsplan verfuegbar" },
        { status: 404 }
      );
    }

    // Get opening balance
    const latestVersion = plan.versions[0];
    const openingBalanceCents = latestVersion
      ? BigInt(latestVersion.openingBalanceCents)
      : BigInt(0);

    // Prepare calculation inputs
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

    // Run calculation
    const result = calculateLiquidityPlan(
      openingBalanceCents,
      categories,
      lines,
      weeklyValues,
      new Date(plan.planStartDate)
    );

    // Prepare response (limited external view)
    const response = {
      case: {
        caseNumber: caseData.caseNumber,
        debtorName: caseData.debtorName,
        courtName: caseData.courtName,
        status: caseData.status,
        filingDate: caseData.filingDate,
        openingDate: caseData.openingDate,
      },
      administrator: caseData.project.name,
      plan: {
        name: plan.name,
        planStartDate: plan.planStartDate,
        versionNumber: latestVersion?.versionNumber ?? 0,
        versionDate: latestVersion?.snapshotDate ?? null,
      },
      calculation: {
        openingBalanceCents: result.openingBalanceCents.toString(),
        totalInflowsCents: result.totalInflowsCents.toString(),
        totalOutflowsCents: result.totalOutflowsCents.toString(),
        totalNetCashflowCents: result.totalNetCashflowCents.toString(),
        finalClosingBalanceCents: result.finalClosingBalanceCents.toString(),
        dataHash: result.dataHash,
        calculatedAt: result.calculatedAt,
        weeks: result.weeks.map((week) => ({
          weekOffset: week.weekOffset,
          weekLabel: week.weekLabel,
          openingBalanceCents: week.openingBalanceCents.toString(),
          totalInflowsCents: week.totalInflowsCents.toString(),
          totalOutflowsCents: week.totalOutflowsCents.toString(),
          netCashflowCents: week.netCashflowCents.toString(),
          closingBalanceCents: week.closingBalanceCents.toString(),
        })),
        categories: result.categories.map((cat) => ({
          categoryName: cat.categoryName,
          flowType: cat.flowType,
          estateType: cat.estateType,
          totalCents: cat.totalCents.toString(),
          weeklyTotals: cat.weeklyTotals.map((t) => t.toString()),
          lines: cat.lines.map((line) => ({
            lineName: line.lineName,
            totalCents: line.totalCents.toString(),
            weeklyValues: line.weeklyValues.map((wv) => ({
              weekOffset: wv.weekOffset,
              effectiveCents: wv.effectiveCents.toString(),
            })),
          })),
        })),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching share data:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Daten" },
      { status: 500 }
    );
  }
}
