import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  calculateLiquidityPlan,
  CategoryInput,
  LineInput,
  PeriodValueInput,
  PeriodType,
} from "@/lib/calculation-engine";
import {
  calculateBankAccountBalances,
  calculateOpeningBalanceByScope,
} from "@/lib/bank-accounts/calculate-balances";
import {
  aggregateLedgerEntries,
  convertToLegacyFormat,
} from "@/lib/ledger-aggregation";

type LiquidityScope = "GLOBAL" | "LOCATION_VELBERT" | "LOCATION_UCKERATH_EITORF";

const SCOPE_LABELS: Record<LiquidityScope, string> = {
  GLOBAL: "Gesamt",
  LOCATION_VELBERT: "Velbert",
  LOCATION_UCKERATH_EITORF: "Uckerath/Eitorf",
};

// GET /api/cases/[id]/dashboard - Get case dashboard data for admin
// Query-Parameter:
// - scope: GLOBAL | LOCATION_VELBERT | LOCATION_UCKERATH_EITORF (Default: GLOBAL)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const { id: caseId } = await params;
    const { searchParams } = new URL(request.url);
    const scopeParam = searchParams.get("scope") || "GLOBAL";
    const scope: LiquidityScope = ["GLOBAL", "LOCATION_VELBERT", "LOCATION_UCKERATH_EITORF"].includes(scopeParam)
      ? (scopeParam as LiquidityScope)
      : "GLOBAL";

    // Fetch case data with all related entities
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

    // Get latest version for metadata (versionNumber, snapshotDate)
    const latestVersion = plan.versions[0];

    // Get opening balance BY SCOPE (scope-aware)
    const openingBalanceCents = await calculateOpeningBalanceByScope(
      caseData.id,
      scope
    );

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

    // Variablen für Alt/Neu und Warnungen (nur bei LedgerEntry-Aggregation)
    let estateAllocationData: {
      totalAltmasseInflowsCents: bigint;
      totalAltmasseOutflowsCents: bigint;
      totalNeumasseInflowsCents: bigint;
      totalNeumasseOutflowsCents: bigint;
      totalUnklarInflowsCents: bigint;
      totalUnklarOutflowsCents: bigint;
      unklarCount: number;
      warnings: { type: string; severity: string; message: string; count: number; totalCents: string }[];
    } | null = null;

    if (ledgerEntryCount > 0) {
      // NEW: Use LedgerEntry aggregation
      useLedgerAggregation = true;
      const aggregation = await aggregateLedgerEntries(
        caseData.id,
        new Date(plan.planStartDate),
        periodType,
        periodCount,
        openingBalanceCents,
        {
          scope,
          excludeSteeringTags: ['INTERNE_UMBUCHUNG']  // Umbuchungen ausblenden
        }
      );
      const legacyFormat = convertToLegacyFormat(aggregation);

      // Speichere Alt/Neu-Daten für Response
      estateAllocationData = {
        totalAltmasseInflowsCents: aggregation.totalAltmasseInflowsCents,
        totalAltmasseOutflowsCents: aggregation.totalAltmasseOutflowsCents,
        totalNeumasseInflowsCents: aggregation.totalNeumasseInflowsCents,
        totalNeumasseOutflowsCents: aggregation.totalNeumasseOutflowsCents,
        totalUnklarInflowsCents: aggregation.totalUnklarInflowsCents,
        totalUnklarOutflowsCents: aggregation.totalUnklarOutflowsCents,
        unklarCount: aggregation.unklarCount,
        warnings: legacyFormat.warnings,
      };

      // Convert to calculation result format
      // WICHTIG: Alt/Neu kommt aus estateAllocation (Leistungsdatum), NICHT aus legalBucket!
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
          // Alt/Neu aus estateAllocation (NICHT aus legalBucket!)
          inflowsAltmasseCents: p.altmasseInflowsCents,
          inflowsNeumasseCents: p.neumasseInflowsCents,
          outflowsAltmasseCents: p.altmasseOutflowsCents,
          outflowsNeumasseCents: p.neumasseOutflowsCents,
          // UNKLAR - NICHT in Alt/Neu verteilt!
          inflowsUnklarCents: p.unklarInflowsCents,
          outflowsUnklarCents: p.unklarOutflowsCents,
        })),
        categories: legacyFormat.categories.map((c) => ({
          categoryName: c.categoryName,
          flowType: c.flowType,
          estateType: c.estateType,  // Deprecated - nur Abwärtskompatibilität
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
        // Alt/Neu Gesamtsummen
        totalAltmasseInflowsCents: aggregation.totalAltmasseInflowsCents,
        totalAltmasseOutflowsCents: aggregation.totalAltmasseOutflowsCents,
        totalNeumasseInflowsCents: aggregation.totalNeumasseInflowsCents,
        totalNeumasseOutflowsCents: aggregation.totalNeumasseOutflowsCents,
        totalUnklarInflowsCents: aggregation.totalUnklarInflowsCents,
        totalUnklarOutflowsCents: aggregation.totalUnklarOutflowsCents,
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
        dataSource: "LEDGER" as const,
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
        dataSource: "LEGACY" as const,
        entryCount: 0,
        istCount: 0,
        planCount: 0,
        confirmedCount: 0,
        unreviewedCount: 0,
        masseCount: 0,
        absonderungCount: 0,
      };
    }

    // Prepare response in CaseDashboardData format
    const scopeHint = scope !== "GLOBAL"
      ? "Zentrale Verfahrenskosten und nicht zuordenbare Gemeinkosten sind in dieser Sicht nicht enthalten."
      : null;

    const response = {
      // Scope-Informationen
      scope,
      scopeLabel: SCOPE_LABELS[scope],
      scopeHint,
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
      bankAccounts: await (async () => {
        const { balances, totalBalanceCents, totalAvailableCents } =
          await calculateBankAccountBalances(caseData.id, caseData.bankAccounts);
        return {
          accounts: caseData.bankAccounts.map((acc) => {
            const bal = balances.get(acc.id);
            return {
              id: acc.id,
              bankName: acc.bankName,
              accountName: acc.accountName,
              iban: acc.iban,
              openingBalanceCents: acc.openingBalanceCents.toString(),
              currentBalanceCents: (bal?.currentBalanceCents ?? acc.openingBalanceCents).toString(),
              securityHolder: acc.securityHolder,
              status: acc.status,
              notes: acc.notes,
            };
          }),
          summary: {
            totalBalanceCents: totalBalanceCents.toString(),
            totalAvailableCents: totalAvailableCents.toString(),
            accountCount: caseData.bankAccounts.length,
          },
        };
      })(),
      ledgerStats,
      // Alt/Neu-Massezuordnung (aus estateAllocation, NICHT aus legalBucket!)
      estateAllocation: estateAllocationData ? {
        // Gesamtsummen
        totalAltmasseInflowsCents: estateAllocationData.totalAltmasseInflowsCents.toString(),
        totalAltmasseOutflowsCents: estateAllocationData.totalAltmasseOutflowsCents.toString(),
        totalNeumasseInflowsCents: estateAllocationData.totalNeumasseInflowsCents.toString(),
        totalNeumasseOutflowsCents: estateAllocationData.totalNeumasseOutflowsCents.toString(),
        // UNKLAR - NICHT in Alt/Neu verteilt!
        totalUnklarInflowsCents: estateAllocationData.totalUnklarInflowsCents.toString(),
        totalUnklarOutflowsCents: estateAllocationData.totalUnklarOutflowsCents.toString(),
        unklarCount: estateAllocationData.unklarCount,
        // Warnungen (z.B. UNKLAR-Buchungen)
        warnings: estateAllocationData.warnings,
      } : null,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        periods: result.periods.map((period: any) => ({
          periodIndex: period.periodIndex,
          periodLabel: period.periodLabel,
          periodStartDate: period.periodStartDate.toISOString(),
          periodEndDate: period.periodEndDate.toISOString(),
          openingBalanceCents: period.openingBalanceCents.toString(),
          totalInflowsCents: period.totalInflowsCents.toString(),
          totalOutflowsCents: period.totalOutflowsCents.toString(),
          netCashflowCents: period.netCashflowCents.toString(),
          closingBalanceCents: period.closingBalanceCents.toString(),
          // Alt/Neu aus estateAllocation (nur bei LedgerEntry-Aggregation)
          // WICHTIG: Check auf inflowsUnklarCents, da das Feld NUR bei LedgerEntry-Aggregation existiert
          // (Legacy calculateLiquidityPlan hat KEIN inflowsUnklarCents)
          ...(period.inflowsUnklarCents !== undefined ? {
            inflowsAltmasseCents: period.inflowsAltmasseCents.toString(),
            inflowsNeumasseCents: period.inflowsNeumasseCents.toString(),
            outflowsAltmasseCents: period.outflowsAltmasseCents.toString(),
            outflowsNeumasseCents: period.outflowsNeumasseCents.toString(),
            inflowsUnklarCents: period.inflowsUnklarCents.toString(),
            outflowsUnklarCents: period.outflowsUnklarCents.toString(),
          } : {}),
        })),
        // Legacy alias for backwards compatibility
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        weeks: result.periods.map((period: any) => ({
          weekOffset: period.periodIndex,
          weekLabel: period.periodLabel,
          openingBalanceCents: period.openingBalanceCents.toString(),
          totalInflowsCents: period.totalInflowsCents.toString(),
          totalOutflowsCents: period.totalOutflowsCents.toString(),
          netCashflowCents: period.netCashflowCents.toString(),
          closingBalanceCents: period.closingBalanceCents.toString(),
          // Alt/Neu aus estateAllocation (nur bei LedgerEntry-Aggregation)
          // WICHTIG: Check auf inflowsUnklarCents, da das Feld NUR bei LedgerEntry-Aggregation existiert
          ...(period.inflowsUnklarCents !== undefined ? {
            inflowsAltmasseCents: period.inflowsAltmasseCents.toString(),
            inflowsNeumasseCents: period.inflowsNeumasseCents.toString(),
            outflowsAltmasseCents: period.outflowsAltmasseCents.toString(),
            outflowsNeumasseCents: period.outflowsNeumasseCents.toString(),
            inflowsUnklarCents: period.inflowsUnklarCents.toString(),
            outflowsUnklarCents: period.outflowsUnklarCents.toString(),
          } : {}),
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categories: result.categories.map((cat: any) => ({
          categoryName: cat.categoryName,
          flowType: cat.flowType,
          estateType: cat.estateType,  // Deprecated - nur Abwärtskompatibilität
          totalCents: cat.totalCents.toString(),
          periodTotals: cat.periodTotals.map((t: bigint) => t.toString()),
          weeklyTotals: cat.periodTotals.map((t: bigint) => t.toString()),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          lines: cat.lines.map((line: any) => ({
            lineName: line.lineName,
            totalCents: line.totalCents.toString(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            periodValues: line.periodValues.map((pv: any) => ({
              periodIndex: pv.periodIndex,
              effectiveCents: pv.effectiveCents.toString(),
            })),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            weeklyValues: line.periodValues.map((pv: any) => ({
              weekOffset: pv.periodIndex,
              effectiveCents: pv.effectiveCents.toString(),
            })),
          })),
        })),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching admin dashboard:", error);
    const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler";
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      {
        error: "Fehler beim Laden der Dashboard-Daten",
        details: errorMessage,
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}
