/**
 * Performance-Engine — Haupt-Aggregation
 *
 * Berechnet pro Standort und Monat einen Deckungsbeitrag.
 * IST- und PLAN-fähig. IST/PLAN-Vorrang pro Zeile und Monat.
 *
 * Schritte:
 * 1.  Plan laden → planStartDate, periodCount
 * 2.  Perioden generieren (N Monate ab Start)
 * 3.  Locations laden
 * 4.  LedgerEntries laden (IST + PLAN, EXCLUDE_SPLIT_PARENTS)
 * 5.  Entries nach categoryTag auf P&L-Zeilen mappen
 * 6.  Periodisieren (servicePeriod → Monat)
 * 7.  IST/PLAN-Vorrang pro Zeile und Monat
 * 8.  EmployeeSalaryMonth pro Location und Monat laden
 * 9.  Pro Location + Monat: alle Zeilen + KPIs berechnen
 * 10. Zentrale Kosten (locationId = null) als eigener Block
 * 11. Umlage berechnen (wenn allocationMethod != NONE)
 * 12. Konsolidierung
 * 13. DataQualityReport erstellen
 */

import { PrismaClient } from '@prisma/client';
import { EXCLUDE_SPLIT_PARENTS } from '@/lib/ledger/types';
import type {
  PerformancePeriod,
  PnLLineItem,
  PnLGroup,
  LocationMonthResult,
  LocationSummary,
  LocationSummaryAfterAllocation,
  AllocationMethod,
  PerformanceResult,
} from './types';
import { HVPLUS_PNL_MAPPING, EXCLUDED_FROM_PERFORMANCE, validateConfig, buildTagToRowKeyMap } from './config';
import { periodizeEntry, generateMonthlyPeriods, toMonthKey, type PeriodizationMethod } from './periodize';

// =============================================================================
// MAIN FUNCTION
// =============================================================================

export async function calculatePerformance(
  prisma: PrismaClient,
  options: {
    caseId: string;
    planId: string;
    allocationMethod?: AllocationMethod;
    includeUnreviewed?: boolean;
  },
): Promise<PerformanceResult> {
  const { caseId, planId, allocationMethod = 'NONE', includeUnreviewed = false } = options;

  // --- Validation ---
  const configErrors = validateConfig(HVPLUS_PNL_MAPPING);
  if (configErrors.length > 0) {
    throw new Error(`Config-Validierung fehlgeschlagen: ${configErrors.join('; ')}`);
  }

  // --- Step 1: Plan laden ---
  const plan = await prisma.liquidityPlan.findUnique({
    where: { id: planId },
  });
  if (!plan) {
    throw new Error(`Plan ${planId} nicht gefunden`);
  }
  if (plan.periodType !== 'MONTHLY') {
    throw new Error(`Performance-Engine unterstützt nur MONTHLY. Plan ist ${plan.periodType}.`);
  }

  // --- Step 2: Perioden generieren ---
  const periodsRaw = generateMonthlyPeriods(plan.planStartDate, plan.periodCount);
  const monthKeyToIndex = new Map<string, number>();
  for (const p of periodsRaw) {
    monthKeyToIndex.set(p.monthKey, p.index);
  }

  // --- Step 3: Locations laden ---
  const locations = await prisma.location.findMany({
    where: { caseId },
    select: { id: true, name: true },
  });

  // --- Step 4: LedgerEntries laden ---
  const reviewFilter = includeUnreviewed
    ? {}
    : { reviewStatus: { in: ['CONFIRMED', 'ADJUSTED'] as string[] } };

  const allEntries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      ...EXCLUDE_SPLIT_PARENTS,
      ...reviewFilter,
    },
    select: {
      id: true,
      transactionDate: true,
      amountCents: true,
      valueType: true,
      categoryTag: true,
      locationId: true,
      estateAllocation: true,
      estateRatio: true,
      serviceDate: true,
      servicePeriodStart: true,
      servicePeriodEnd: true,
      transferPartnerEntryId: true,
      reviewStatus: true,
    },
  });

  // Filter: Transfers und EXCLUDED Tags ausschließen
  const excludedSet = new Set(EXCLUDED_FROM_PERFORMANCE);
  const entries = allEntries.filter((e) => {
    if (e.transferPartnerEntryId) return false;
    if (e.categoryTag && excludedSet.has(e.categoryTag)) return false;
    return true;
  });

  // --- Step 5+6: Entries nach categoryTag mappen + periodisieren ---
  const tagToRowKey = buildTagToRowKeyMap(HVPLUS_PNL_MAPPING);

  // Accumulated data: locationId → monthKey → rowKey → { ist: bigint, plan: bigint, ... }
  interface AccItem {
    istAmount: bigint;
    planAmount: bigint;
    istCount: number;
    planCount: number;
    istAltmasse: bigint;
    istNeumasse: bigint;
    planAltmasse: bigint;
    planNeumasse: bigint;
    periodizationMethod: PeriodizationMethod | null;
  }

  const accumulated = new Map<string, Map<string, Map<string, AccItem>>>();

  // Ensure all locations + ZENTRAL have entries for all months/rows
  const locationIds = [...locations.map((l) => l.id), 'ZENTRAL'];
  for (const locId of locationIds) {
    const monthMap = new Map<string, Map<string, AccItem>>();
    for (const period of periodsRaw) {
      const rowMap = new Map<string, AccItem>();
      for (const row of HVPLUS_PNL_MAPPING) {
        if (row.source === 'SALARY') continue; // Salary handled separately
        rowMap.set(row.key, {
          istAmount: 0n, planAmount: 0n, istCount: 0, planCount: 0,
          istAltmasse: 0n, istNeumasse: 0n, planAltmasse: 0n, planNeumasse: 0n,
          periodizationMethod: null,
        });
      }
      monthMap.set(period.monthKey, rowMap);
    }
    accumulated.set(locId, monthMap);
  }

  // DataQuality tracking
  let entriesWithServicePeriod = 0;
  let entriesWithServiceDate = 0;
  let entriesWithFallbackDate = 0;
  let unclassifiedEntries = 0;
  let approximateSpreadCount = 0;

  // --- Process entries ---
  for (const entry of entries) {
    const tag = entry.categoryTag;
    if (!tag) {
      unclassifiedEntries++;
      continue;
    }

    const rowKey = tagToRowKey.get(tag);
    if (!rowKey) {
      // Tag nicht im P&L-Mapping → überspringen (z.B. unbekannter Tag)
      unclassifiedEntries++;
      continue;
    }

    // Periodisierung
    const periodResult = periodizeEntry({
      amountCents: BigInt(entry.amountCents),
      transactionDate: entry.transactionDate,
      serviceDate: entry.serviceDate,
      servicePeriodStart: entry.servicePeriodStart,
      servicePeriodEnd: entry.servicePeriodEnd,
    });

    if (periodResult.isApproximateSpread) approximateSpreadCount++;
    if (periodResult.method === 'SERVICE_PERIOD') entriesWithServicePeriod++;
    else if (periodResult.method === 'SERVICE_DATE') entriesWithServiceDate++;
    else entriesWithFallbackDate++;

    // Estate Allocation (Alt/Neu)
    const estateRatio = entry.estateRatio !== null ? Number(entry.estateRatio) : null;
    const estateAllocation = entry.estateAllocation || 'NEUMASSE';

    const locId = entry.locationId || 'ZENTRAL';
    const valueType = entry.valueType as 'IST' | 'PLAN';

    // Distribute to months
    for (const [monthKey, monthAmount] of periodResult.amounts) {
      if (!monthKeyToIndex.has(monthKey)) continue; // Outside plan range

      const locMap = accumulated.get(locId);
      if (!locMap) continue;
      const monthMap = locMap.get(monthKey);
      if (!monthMap) continue;
      const acc = monthMap.get(rowKey);
      if (!acc) continue;

      // Calculate Alt/Neu split for this portion
      let altAnteil = 0n;
      let neuAnteil = 0n;
      const absAmount = monthAmount < 0n ? -monthAmount : monthAmount;
      const sign = monthAmount < 0n ? -1n : 1n;

      switch (estateAllocation) {
        case 'ALTMASSE':
          altAnteil = absAmount;
          break;
        case 'NEUMASSE':
          neuAnteil = absAmount;
          break;
        case 'MIXED':
          if (estateRatio !== null) {
            neuAnteil = BigInt(Math.round(Number(absAmount) * estateRatio));
            altAnteil = absAmount - neuAnteil;
          } else {
            neuAnteil = absAmount; // Fallback: treat as Neumasse
          }
          break;
        case 'UNKLAR':
        default:
          neuAnteil = absAmount; // Default: Neumasse
          break;
      }

      if (valueType === 'IST') {
        acc.istAmount += monthAmount;
        acc.istCount++;
        acc.istAltmasse += altAnteil * sign;
        acc.istNeumasse += neuAnteil * sign;
      } else {
        acc.planAmount += monthAmount;
        acc.planCount++;
        acc.planAltmasse += altAnteil * sign;
        acc.planNeumasse += neuAnteil * sign;
      }

      if (!acc.periodizationMethod) {
        acc.periodizationMethod = periodResult.method;
      }
    }
  }

  // --- Step 8: EmployeeSalaryMonth laden ---
  const salaryData = await prisma.employeeSalaryMonth.findMany({
    where: {
      employee: { caseId },
    },
    include: {
      employee: {
        select: { id: true, locationId: true, isActive: true },
      },
    },
  });

  // Salary accumulation: locationId → monthKey → { gross, employer, headcount }
  interface SalaryAcc {
    grossCents: bigint;
    employerCostsCents: bigint;
    headcount: number;
    employeeIds: Set<string>;
  }

  const salaryAccumulated = new Map<string, Map<string, SalaryAcc>>();
  for (const locId of locationIds) {
    const monthMap = new Map<string, SalaryAcc>();
    for (const period of periodsRaw) {
      monthMap.set(period.monthKey, {
        grossCents: 0n, employerCostsCents: 0n, headcount: 0, employeeIds: new Set(),
      });
    }
    salaryAccumulated.set(locId, monthMap);
  }

  const employeesWithSalary = new Set<string>();

  for (const sm of salaryData) {
    const monthKey = toMonthKey(sm.year, sm.month);
    const locId = sm.employee.locationId || 'ZENTRAL';

    const locMap = salaryAccumulated.get(locId);
    if (!locMap) continue;
    const acc = locMap.get(monthKey);
    if (!acc) continue; // Outside plan range

    employeesWithSalary.add(sm.employee.id);
    acc.grossCents += BigInt(sm.grossSalaryCents);
    if (sm.employerCostsCents !== null) {
      acc.employerCostsCents += BigInt(sm.employerCostsCents);
    }
    if (!acc.employeeIds.has(sm.employee.id)) {
      acc.employeeIds.add(sm.employee.id);
      acc.headcount++;
    }
  }

  // Count employees without salary data
  const totalEmployees = await prisma.employee.count({ where: { caseId, isActive: true } });
  const employeesWithoutSalaryData = totalEmployees - employeesWithSalary.size;

  // --- Step 9: Pro Location + Monat → LocationMonthResult ---
  const locationResults = new Map<string, LocationMonthResult[]>();

  for (const locId of locationIds) {
    const monthResults: LocationMonthResult[] = [];
    const locName = locId === 'ZENTRAL'
      ? 'Zentral'
      : locations.find((l) => l.id === locId)?.name || locId;

    for (const period of periodsRaw) {
      const lines: PnLLineItem[] = [];

      const ledgerMonthMap = accumulated.get(locId)?.get(period.monthKey);
      const salaryMonthAcc = salaryAccumulated.get(locId)?.get(period.monthKey);

      let istLineCount = 0;
      let totalLineCount = 0;

      // Ledger-basierte Zeilen
      for (const row of HVPLUS_PNL_MAPPING) {
        if (row.source === 'SALARY') continue;

        const acc = ledgerMonthMap?.get(row.key);
        if (!acc) continue;

        // IST/PLAN-Vorrang pro Zeile: IST bevorzugt
        const hasIst = acc.istCount > 0;
        const hasPlan = acc.planCount > 0;
        const useIst = hasIst;

        const amount = useIst ? acc.istAmount : acc.planAmount;
        const count = useIst ? acc.istCount : acc.planCount;
        const altmasse = useIst ? acc.istAltmasse : acc.planAltmasse;
        const neumasse = useIst ? acc.istNeumasse : acc.planNeumasse;

        // Nur Zeilen zählen die Daten haben
        if (hasIst || hasPlan) {
          totalLineCount++;
          if (hasIst) istLineCount++;
        }

        lines.push({
          key: row.key,
          label: row.label,
          group: row.group,
          amountCents: amount,
          entryCount: count,
          source: 'LEDGER',
          valueSource: useIst ? 'IST' : 'PLAN',
          periodizationMethod: acc.periodizationMethod || 'TRANSACTION_DATE',
          altmasseAnteilCents: altmasse,
          neumasseAnteilCents: neumasse,
        });
      }

      // Salary-basierte Zeilen
      for (const row of HVPLUS_PNL_MAPPING) {
        if (row.source !== 'SALARY') continue;

        const hasSalaryData = salaryMonthAcc && (
          (row.field === 'grossSalaryCents' && salaryMonthAcc.grossCents !== 0n) ||
          (row.field === 'employerCostsCents' && salaryMonthAcc.employerCostsCents !== 0n)
        );

        let amount = 0n;
        if (hasSalaryData && salaryMonthAcc) {
          if (row.field === 'grossSalaryCents') {
            amount = -salaryMonthAcc.grossCents; // Negiert: Kosten sind negativ
          } else if (row.field === 'employerCostsCents') {
            amount = -salaryMonthAcc.employerCostsCents;
          }
        }

        // Salary-Daten sind immer IST wenn vorhanden
        if (hasSalaryData) {
          totalLineCount++;
          istLineCount++;
        }

        lines.push({
          key: row.key,
          label: row.label,
          group: row.group,
          amountCents: amount,
          entryCount: 0,
          source: 'SALARY',
          valueSource: hasSalaryData ? 'IST' : 'PLAN',
          periodizationMethod: 'SALARY_MONTH',
          altmasseAnteilCents: 0n,
          neumasseAnteilCents: 0n,
        });
      }

      // KPIs berechnen
      const revenueCents = sumByGroup(lines, 'REVENUE');
      const revenueAltmasseCents = sumAltmasseByGroup(lines, 'REVENUE');
      const revenueNeumasseCents = sumNeumasseByGroup(lines, 'REVENUE');
      const personnelCostsCents = sumByGroup(lines, 'PERSONNEL_COST');
      const fixedCostsCents = sumByGroup(lines, 'FIXED_COST');
      const otherCostsCents = sumByGroup(lines, 'OTHER_COST');
      const contributionCents = revenueCents + personnelCostsCents + fixedCostsCents + otherCostsCents;
      const marginPercent = revenueCents !== 0n
        ? Number(contributionCents * 10000n / revenueCents) / 100
        : 0;

      const istCoverage = totalLineCount > 0 ? istLineCount / totalLineCount : 0;

      const periodInfo: PerformancePeriod = {
        index: period.index,
        year: period.year,
        month: period.month,
        label: period.label,
        istCoverage,
      };

      monthResults.push({
        locationId: locId,
        locationName: locName,
        period: periodInfo,
        lines,
        revenueCents,
        revenueAltmasseCents,
        revenueNeumasseCents,
        personnelCostsCents,
        fixedCostsCents,
        otherCostsCents,
        contributionCents,
        marginPercent,
        personnelHeadcount: salaryMonthAcc?.headcount || 0,
        istCoverage,
      });
    }

    locationResults.set(locId, monthResults);
  }

  // --- Step 10: Zentrale Kosten extrahieren ---
  const centralMonths = locationResults.get('ZENTRAL') || [];
  const centralTotalCosts = centralMonths.reduce(
    (sum, m) => sum + m.personnelCostsCents + m.fixedCostsCents + m.otherCostsCents,
    0n,
  );

  // --- Build LocationSummary[] (ohne ZENTRAL) ---
  const locationSummaries: LocationSummary[] = [];
  for (const loc of locations) {
    const months = locationResults.get(loc.id) || [];
    const totalRevenue = months.reduce((s, m) => s + m.revenueCents, 0n);
    const totalContribution = months.reduce((s, m) => s + m.contributionCents, 0n);
    const avgMargin = totalRevenue !== 0n
      ? Number(totalContribution * 10000n / totalRevenue) / 100
      : 0;

    locationSummaries.push({
      locationId: loc.id,
      locationName: loc.name,
      months,
      totalRevenueCents: totalRevenue,
      totalContributionCents: totalContribution,
      avgMarginPercent: avgMargin,
    });
  }

  // --- Step 11: Umlage zentraler Kosten ---
  let locationsAfterAllocation: LocationSummaryAfterAllocation[] | undefined;

  if (allocationMethod !== 'NONE' && locationSummaries.length > 0) {
    locationsAfterAllocation = allocateCentralCosts(
      centralMonths,
      locationSummaries,
      allocationMethod,
    );
  }

  // --- Step 12: Konsolidierung ---
  const consolidated = buildConsolidated(locationResults, periodsRaw);

  // --- Step 13: DataQualityReport ---
  const warnings: string[] = [];
  if (approximateSpreadCount > 0) {
    warnings.push(`${approximateSpreadCount} Entries mit Gleichverteilung über mehrere Monate (z.B. KV-Quartalszahlungen).`);
  }
  if (entriesWithFallbackDate > 0) {
    warnings.push(`${entriesWithFallbackDate} Entries ohne servicePeriod/serviceDate — Fallback auf transactionDate.`);
  }
  if (unclassifiedEntries > 0) {
    warnings.push(`${unclassifiedEntries} Entries ohne categoryTag oder mit unbekanntem Tag — nicht in Performance-Berechnung.`);
  }
  if (employeesWithoutSalaryData > 0) {
    warnings.push(`${employeesWithoutSalaryData} aktive Mitarbeiter ohne Gehaltsdaten.`);
  }

  const overallIstCoverage = consolidated.length > 0
    ? consolidated.reduce((s, m) => s + m.istCoverage, 0) / consolidated.length
    : 0;

  const periods: PerformancePeriod[] = periodsRaw.map((p) => {
    const consolMonth = consolidated.find((c) => c.period.index === p.index);
    return {
      index: p.index,
      year: p.year,
      month: p.month,
      label: p.label,
      istCoverage: consolMonth?.istCoverage || 0,
    };
  });

  return {
    caseId,
    calculatedAt: new Date().toISOString(),
    periodCount: plan.periodCount,
    planStartDate: plan.planStartDate.toISOString(),
    periods,
    locations: locationSummaries,
    locationsAfterAllocation,
    overallIstCoverage,
    central: {
      months: centralMonths,
      totalCostsCents: centralTotalCosts,
    },
    consolidated,
    allocationMethod,
    dataQuality: {
      totalEntries: entries.length,
      entriesWithServicePeriod,
      entriesWithServiceDate,
      entriesWithFallbackDate,
      unclassifiedEntries,
      approximateSpreadCount,
      employeesWithSalaryData: employeesWithSalary.size,
      employeesWithoutSalaryData,
      warnings,
    },
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function sumByGroup(lines: PnLLineItem[], group: PnLGroup): bigint {
  return lines
    .filter((l) => l.group === group)
    .reduce((sum, l) => sum + l.amountCents, 0n);
}

function sumAltmasseByGroup(lines: PnLLineItem[], group: PnLGroup): bigint {
  return lines
    .filter((l) => l.group === group)
    .reduce((sum, l) => sum + l.altmasseAnteilCents, 0n);
}

function sumNeumasseByGroup(lines: PnLLineItem[], group: PnLGroup): bigint {
  return lines
    .filter((l) => l.group === group)
    .reduce((sum, l) => sum + l.neumasseAnteilCents, 0n);
}

// =============================================================================
// ALLOCATION
// =============================================================================

function allocateCentralCosts(
  centralMonths: LocationMonthResult[],
  locationSummaries: LocationSummary[],
  method: AllocationMethod,
): LocationSummaryAfterAllocation[] {
  // Gesamtbasis für Verteilung
  const totalRevenueAll = locationSummaries.reduce((s, l) => s + l.totalRevenueCents, 0n);
  const totalHeadcountAll = locationSummaries.reduce((s, l) => {
    return s + l.months.reduce((ms, m) => ms + m.personnelHeadcount, 0);
  }, 0);

  return locationSummaries.map((locSummary) => {
    let shareRatio: number;

    if (method === 'REVENUE_SHARE') {
      shareRatio = totalRevenueAll !== 0n
        ? Number(locSummary.totalRevenueCents) / Number(totalRevenueAll)
        : 0;
    } else {
      // HEADCOUNT_SHARE
      const locHeadcount = locSummary.months.reduce((s, m) => s + m.personnelHeadcount, 0);
      shareRatio = totalHeadcountAll > 0
        ? locHeadcount / totalHeadcountAll
        : 0;
    }

    // Pro Monat: zentraler Kostenanteil × Share-Ratio
    const allocatedMonths = locSummary.months.map((locMonth, i) => {
      const centralMonth = centralMonths[i];
      if (!centralMonth) return locMonth;

      const centralCosts = centralMonth.personnelCostsCents + centralMonth.fixedCostsCents + centralMonth.otherCostsCents;
      const allocatedCents = BigInt(Math.round(Number(centralCosts) * shareRatio));

      return {
        ...locMonth,
        // Umlage wird zu fixedCosts addiert (konzeptionell zentraler Gemeinkostenanteil)
        fixedCostsCents: locMonth.fixedCostsCents + allocatedCents,
        contributionCents: locMonth.contributionCents + allocatedCents,
        marginPercent: locMonth.revenueCents !== 0n
          ? Number((locMonth.contributionCents + allocatedCents) * 10000n / locMonth.revenueCents) / 100
          : 0,
      };
    });

    const totalAllocated = centralMonths.reduce((sum, cm) => {
      const costs = cm.personnelCostsCents + cm.fixedCostsCents + cm.otherCostsCents;
      return sum + BigInt(Math.round(Number(costs) * shareRatio));
    }, 0n);

    const adjustedContribution = locSummary.totalContributionCents + totalAllocated;
    const adjustedMargin = locSummary.totalRevenueCents !== 0n
      ? Number(adjustedContribution * 10000n / locSummary.totalRevenueCents) / 100
      : 0;

    return {
      locationId: locSummary.locationId,
      locationName: locSummary.locationName,
      months: allocatedMonths,
      allocatedCentralCostsCents: totalAllocated,
      adjustedContributionCents: adjustedContribution,
      adjustedMarginPercent: adjustedMargin,
    };
  });
}

// =============================================================================
// CONSOLIDATION
// =============================================================================

function buildConsolidated(
  locationResults: Map<string, LocationMonthResult[]>,
  periodsRaw: { index: number; year: number; month: number; label: string; monthKey: string }[],
): LocationMonthResult[] {
  return periodsRaw.map((period) => {
    let totalHeadcount = 0;
    let totalIstLines = 0;
    let totalLines = 0;

    // Sammle alle Zeilen aus allen Standorten + Zentral für diesen Monat
    // Konsolidierte Zeilen: pro key zusammenfassen
    const linesByKey = new Map<string, PnLLineItem>();

    for (const [, months] of locationResults) {
      const monthResult = months.find((m) => m.period.index === period.index);
      if (!monthResult) continue;

      totalHeadcount += monthResult.personnelHeadcount;

      for (const line of monthResult.lines) {
        const existing = linesByKey.get(line.key);
        if (existing) {
          existing.amountCents += line.amountCents;
          existing.entryCount += line.entryCount;
          existing.altmasseAnteilCents += line.altmasseAnteilCents;
          existing.neumasseAnteilCents += line.neumasseAnteilCents;
          // IST hat Vorrang über PLAN — aber nur wenn die Zeile echte Daten hat
          if (line.valueSource === 'IST' && (line.amountCents !== 0n || line.entryCount > 0)) {
            existing.valueSource = 'IST';
          }
        } else {
          linesByKey.set(line.key, { ...line });
        }
      }
    }

    const lines = Array.from(linesByKey.values());

    // istCoverage berechnen
    for (const line of lines) {
      if (line.amountCents !== 0n || line.entryCount > 0) {
        totalLines++;
        if (line.valueSource === 'IST') totalIstLines++;
      }
    }

    const revenueCents = sumByGroup(lines, 'REVENUE');
    const revenueAltmasseCents = sumAltmasseByGroup(lines, 'REVENUE');
    const revenueNeumasseCents = sumNeumasseByGroup(lines, 'REVENUE');
    const personnelCostsCents = sumByGroup(lines, 'PERSONNEL_COST');
    const fixedCostsCents = sumByGroup(lines, 'FIXED_COST');
    const otherCostsCents = sumByGroup(lines, 'OTHER_COST');
    const contributionCents = revenueCents + personnelCostsCents + fixedCostsCents + otherCostsCents;
    const marginPercent = revenueCents !== 0n
      ? Number(contributionCents * 10000n / revenueCents) / 100
      : 0;
    const istCoverage = totalLines > 0 ? totalIstLines / totalLines : 0;

    return {
      locationId: 'KONSOLIDIERT',
      locationName: 'Gesamt',
      period: {
        index: period.index,
        year: period.year,
        month: period.month,
        label: period.label,
        istCoverage,
      },
      lines,
      revenueCents,
      revenueAltmasseCents,
      revenueNeumasseCents,
      personnelCostsCents,
      fixedCostsCents,
      otherCostsCents,
      contributionCents,
      marginPercent,
      personnelHeadcount: totalHeadcount,
      istCoverage,
    };
  });
}
