import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  calculateLiquidityPlan,
  CategoryInput,
  LineInput,
  PeriodValueInput,
  PeriodType,
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
            owner: {
              select: { id: true, name: true, company: true },
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
                        periodValues: true,
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

    const periodValues: PeriodValueInput[] = plan.categories.flatMap((cat) =>
      cat.lines.flatMap((line) =>
        line.periodValues.map((pv) => ({
          lineId: line.id,
          periodIndex: pv.periodIndex,
          valueType: pv.valueType as "IST" | "PLAN",
          amountCents: BigInt(pv.amountCents),
        }))
      )
    );

    // Get period type and count from plan
    const periodType = (plan.periodType as PeriodType) || "WEEKLY";
    const periodCount = plan.periodCount || 13;

    // Run calculation
    const result = calculateLiquidityPlan(
      openingBalanceCents,
      categories,
      lines,
      periodValues,
      new Date(plan.planStartDate),
      periodType,
      periodCount
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
      administrator: caseData.owner.name + (caseData.owner.company ? ` (${caseData.owner.company})` : ""),
      plan: {
        name: plan.name,
        planStartDate: plan.planStartDate,
        periodType: result.periodType,
        periodCount: result.periodCount,
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
        periodType: result.periodType,
        periodCount: result.periodCount,
        // New period-based structure
        periods: result.periods.map((period) => ({
          periodIndex: period.periodIndex,
          periodLabel: period.periodLabel,
          periodStartDate: period.periodStartDate.toISOString(),
          periodEndDate: period.periodEndDate.toISOString(),
          openingBalanceCents: period.openingBalanceCents.toString(),
          totalInflowsCents: period.totalInflowsCents.toString(),
          totalOutflowsCents: period.totalOutflowsCents.toString(),
          netCashflowCents: period.netCashflowCents.toString(),
          closingBalanceCents: period.closingBalanceCents.toString(),
        })),
        // Legacy alias for backwards compatibility
        weeks: result.periods.map((period) => ({
          weekOffset: period.periodIndex,
          weekLabel: period.periodLabel,
          openingBalanceCents: period.openingBalanceCents.toString(),
          totalInflowsCents: period.totalInflowsCents.toString(),
          totalOutflowsCents: period.totalOutflowsCents.toString(),
          netCashflowCents: period.netCashflowCents.toString(),
          closingBalanceCents: period.closingBalanceCents.toString(),
        })),
        categories: result.categories.map((cat) => ({
          categoryName: cat.categoryName,
          flowType: cat.flowType,
          estateType: cat.estateType,
          totalCents: cat.totalCents.toString(),
          periodTotals: cat.periodTotals.map((t) => t.toString()),
          // Legacy alias
          weeklyTotals: cat.periodTotals.map((t) => t.toString()),
          lines: cat.lines.map((line) => ({
            lineName: line.lineName,
            totalCents: line.totalCents.toString(),
            periodValues: line.periodValues.map((pv) => ({
              periodIndex: pv.periodIndex,
              effectiveCents: pv.effectiveCents.toString(),
            })),
            // Legacy alias
            weeklyValues: line.periodValues.map((pv) => ({
              weekOffset: pv.periodIndex,
              effectiveCents: pv.effectiveCents.toString(),
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
