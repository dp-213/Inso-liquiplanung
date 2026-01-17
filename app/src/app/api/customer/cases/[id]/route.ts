import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  getCustomerSession,
  checkCaseAccess,
} from "@/lib/customer-auth";
import {
  calculateLiquidityPlan,
  CategoryInput,
  LineInput,
  PeriodValueInput,
  PeriodType,
} from "@/lib/calculation-engine";

// GET /api/customer/cases/[id] - Get case details and calculation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCustomerSession();

    if (!session) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const { id: caseId } = await params;

    // Check if customer has access to this case
    const access = await checkCaseAccess(session.customerId, caseId);

    if (!access.hasAccess) {
      return NextResponse.json(
        { error: "Zugriff auf diesen Fall nicht gestattet" },
        { status: 403 }
      );
    }

    // Fetch case data
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        owner: { select: { id: true, name: true, company: true } },
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
        { error: "Kein Liquiditätsplan verfügbar" },
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

    // Log access
    await prisma.customerAuditLog.create({
      data: {
        customerId: session.customerId,
        action: "VIEW_CASE",
        caseId,
        details: JSON.stringify({ accessLevel: access.accessLevel }),
      },
    });

    // Prepare response (clean external view)
    const response = {
      case: {
        id: caseData.id,
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
    console.error("Error fetching customer case:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Daten" },
      { status: 500 }
    );
  }
}
