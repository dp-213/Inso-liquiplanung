import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  calculateLiquidityPlan,
  CategoryInput,
  LineInput,
  PeriodValueInput,
  PeriodType,
} from "@/lib/calculation-engine";
import {
  aggregateLedgerEntries,
  convertToLegacyFormat,
} from "@/lib/ledger-aggregation";

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
                assumptions: {
                  orderBy: { categoryName: "asc" },
                },
                insolvencyEffects: {
                  where: { isActive: true },
                  orderBy: [
                    { effectGroup: "asc" },
                    { name: "asc" },
                    { periodIndex: "asc" },
                  ],
                },
              },
            },
            bankAccounts: {
              orderBy: { displayOrder: "asc" },
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
        { error: "Kein Liquiditätsplan verfügbar" },
        { status: 404 }
      );
    }

    // Get opening balance
    const latestVersion = plan.versions[0];
    const openingBalanceCents = latestVersion
      ? BigInt(latestVersion.openingBalanceCents)
      : BigInt(0);

    // Get period type and count from plan
    const periodType = (plan.periodType as PeriodType) || "WEEKLY";
    const periodCount = plan.periodCount || 13;

    // Check if we have LedgerEntries for this case (new data model)
    const ledgerEntryCount = await prisma.ledgerEntry.count({
      where: {
        caseId: caseData.id,
        reviewStatus: { in: ["CONFIRMED", "ADJUSTED"] },
      },
    });

    let result;
    let useLedgerAggregation = false;

    if (ledgerEntryCount > 0) {
      // NEW: Use LedgerEntry aggregation
      useLedgerAggregation = true;
      const aggregation = await aggregateLedgerEntries(
        caseData.id,
        new Date(plan.planStartDate),
        periodType,
        periodCount,
        openingBalanceCents
      );
      const legacyFormat = convertToLegacyFormat(aggregation);

      // Convert to calculation result format
      result = {
        openingBalanceCents: aggregation.openingBalanceCents,
        periodType: aggregation.periodType,
        periodCount: aggregation.periodCount,
        periods: aggregation.periods.map((p) => ({
          periodIndex: p.periodIndex,
          periodLabel: p.periodLabel,
          periodStartDate: p.periodStartDate,
          periodEndDate: p.periodEndDate,
          openingBalanceCents: p.openingBalanceCents,
          totalInflowsCents: p.totalInflowsCents,
          totalOutflowsCents: p.totalOutflowsCents,
          netCashflowCents: p.netCashflowCents,
          closingBalanceCents: p.closingBalanceCents,
        })),
        categories: legacyFormat.categories.map((c) => ({
          categoryName: c.categoryName,
          flowType: c.flowType,
          estateType: c.estateType,
          totalCents: BigInt(c.totalCents),
          periodTotals: c.weeklyTotals.map((t) => BigInt(t)),
          lines: c.lines.map((l) => ({
            lineName: l.lineName,
            totalCents: BigInt(l.totalCents),
            periodValues: l.weeklyValues.map((w) => ({
              periodIndex: w.weekOffset,
              effectiveCents: BigInt(w.effectiveCents),
            })),
          })),
        })),
        totalInflowsCents: aggregation.totalInflowsCents,
        totalOutflowsCents: aggregation.totalOutflowsCents,
        totalNetCashflowCents: aggregation.totalNetCashflowCents,
        finalClosingBalanceCents: aggregation.finalClosingBalanceCents,
        dataHash: aggregation.dataHash,
        calculatedAt: aggregation.calculatedAt,
      };
    } else {
      // LEGACY: Use old CashflowCategory/Line/PeriodValue structure
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

      // Run calculation
      result = calculateLiquidityPlan(
        openingBalanceCents,
        categories,
        lines,
        periodValues,
        new Date(plan.planStartDate),
        periodType,
        periodCount
      );
    }

    // Group insolvency effects by name for easier display
    const insolvencyEffectsByName = plan.insolvencyEffects.reduce((acc, effect) => {
      const key = effect.name;
      if (!acc[key]) {
        acc[key] = {
          name: effect.name,
          description: effect.description,
          effectType: effect.effectType,
          effectGroup: effect.effectGroup,
          periods: [],
        };
      }
      acc[key].periods.push({
        id: effect.id,
        periodIndex: effect.periodIndex,
        amountCents: effect.amountCents.toString(),
      });
      return acc;
    }, {} as Record<string, {
      name: string;
      description: string | null;
      effectType: string;
      effectGroup: string;
      periods: { id: string; periodIndex: number; amountCents: string }[];
    }>);

    // Get LedgerEntry statistics for dashboard display
    let ledgerStats = null;
    if (useLedgerAggregation) {
      const stats = await prisma.ledgerEntry.groupBy({
        by: ["valueType", "reviewStatus", "legalBucket"],
        where: { caseId: caseData.id },
        _count: { id: true },
        _sum: { amountCents: true },
      });

      const istCount = stats.filter((s) => s.valueType === "IST").reduce((sum, s) => sum + s._count.id, 0);
      const planCount = stats.filter((s) => s.valueType === "PLAN").reduce((sum, s) => sum + s._count.id, 0);
      const confirmedCount = stats.filter((s) => s.reviewStatus === "CONFIRMED" || s.reviewStatus === "ADJUSTED").reduce((sum, s) => sum + s._count.id, 0);
      const unreviewedCount = stats.filter((s) => s.reviewStatus === "UNREVIEWED").reduce((sum, s) => sum + s._count.id, 0);
      const masseCount = stats.filter((s) => s.legalBucket === "MASSE").reduce((sum, s) => sum + s._count.id, 0);
      const absonderungCount = stats.filter((s) => s.legalBucket === "ABSONDERUNG").reduce((sum, s) => sum + s._count.id, 0);

      ledgerStats = {
        dataSource: "LEDGER",
        entryCount: istCount + planCount,
        istCount,
        planCount,
        confirmedCount,
        unreviewedCount,
        masseCount,
        absonderungCount,
      };
    } else {
      ledgerStats = {
        dataSource: "LEGACY",
        entryCount: 0,
        istCount: 0,
        planCount: 0,
        confirmedCount: 0,
        unreviewedCount: 0,
        masseCount: 0,
        absonderungCount: 0,
      };
    }

    // Prepare response (limited external view)
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
      // Planungsprämissen und Dokumentation
      assumptions: plan.assumptions.map((a) => ({
        id: a.id,
        categoryName: a.categoryName,
        source: a.source,
        description: a.description,
        riskLevel: a.riskLevel,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
      insolvencyEffects: {
        effects: Object.values(insolvencyEffectsByName),
        rawEffects: plan.insolvencyEffects.map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          effectType: e.effectType,
          effectGroup: e.effectGroup,
          periodIndex: e.periodIndex,
          amountCents: e.amountCents.toString(),
          isActive: e.isActive,
        })),
      },
      bankAccounts: {
        accounts: caseData.bankAccounts.map((acc) => ({
          id: acc.id,
          bankName: acc.bankName,
          accountName: acc.accountName,
          iban: acc.iban,
          balanceCents: acc.balanceCents.toString(),
          availableCents: acc.availableCents.toString(),
          securityHolder: acc.securityHolder,
          status: acc.status,
          notes: acc.notes,
        })),
        summary: {
          totalBalanceCents: caseData.bankAccounts.reduce((sum, acc) => sum + acc.balanceCents, BigInt(0)).toString(),
          totalAvailableCents: caseData.bankAccounts.reduce((sum, acc) => sum + acc.availableCents, BigInt(0)).toString(),
          accountCount: caseData.bankAccounts.length,
        },
      },
      ledgerStats,
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
