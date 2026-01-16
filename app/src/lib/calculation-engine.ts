/**
 * Core Liquidity Calculation Engine
 *
 * CRITICAL: This is the deterministic black-box calculation engine.
 * - Implements period-based insolvency liquidity forecast (weekly or monthly)
 * - All monetary values in euro cents (BigInt)
 * - IST overrides PLAN rule
 * - Altmasse/Neumasse separation
 *
 * This file must NEVER be modified for business logic changes.
 * Only bug fixes to match the canonical specification are permitted.
 */

import { createHash } from "crypto";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type FlowType = "INFLOW" | "OUTFLOW";
export type EstateType = "ALTMASSE" | "NEUMASSE";
export type ValueType = "IST" | "PLAN";
export type PeriodType = "WEEKLY" | "MONTHLY";

export interface CategoryInput {
  id: string;
  name: string;
  flowType: FlowType;
  estateType: EstateType;
  displayOrder: number;
}

export interface LineInput {
  id: string;
  categoryId: string;
  name: string;
  displayOrder: number;
}

export interface PeriodValueInput {
  lineId: string;
  periodIndex: number; // 0-based
  valueType: ValueType;
  amountCents: bigint;
}

// Legacy alias for backwards compatibility
export type WeeklyValueInput = PeriodValueInput;

export interface PeriodCalculation {
  periodIndex: number;
  periodLabel: string; // e.g., "KW 03" or "Nov 25"
  periodStartDate: Date;
  periodEndDate: Date;
  openingBalanceCents: bigint;
  inflowsAltmasseCents: bigint;
  inflowsNeumasseCents: bigint;
  totalInflowsCents: bigint;
  outflowsAltmasseCents: bigint;
  outflowsNeumasseCents: bigint;
  totalOutflowsCents: bigint;
  netCashflowCents: bigint;
  closingBalanceCents: bigint;
}

// Legacy alias
export type WeeklyCalculation = PeriodCalculation;

export interface LineCalculation {
  lineId: string;
  lineName: string;
  categoryId: string;
  categoryName: string;
  flowType: FlowType;
  estateType: EstateType;
  periodValues: {
    periodIndex: number;
    istCents: bigint | null;
    planCents: bigint | null;
    effectiveCents: bigint;
  }[];
  totalCents: bigint;
}

export interface CategoryCalculation {
  categoryId: string;
  categoryName: string;
  flowType: FlowType;
  estateType: EstateType;
  lines: LineCalculation[];
  periodTotals: bigint[];
  totalCents: bigint;
}

export interface CalculationResult {
  openingBalanceCents: bigint;
  periodType: PeriodType;
  periodCount: number;
  periods: PeriodCalculation[];
  categories: CategoryCalculation[];

  // Aggregated totals
  totalInflowsCents: bigint;
  totalOutflowsCents: bigint;
  totalNetCashflowCents: bigint;
  finalClosingBalanceCents: bigint;

  // By estate type
  totalInflowsAltmasseCents: bigint;
  totalInflowsNeumasseCents: bigint;
  totalOutflowsAltmasseCents: bigint;
  totalOutflowsNeumasseCents: bigint;

  // Integrity
  dataHash: string;
  calculatedAt: Date;

  // Legacy alias for backwards compatibility
  weeks: PeriodCalculation[];
}

// =============================================================================
// CORE CALCULATION FUNCTIONS
// =============================================================================

/**
 * Get the effective value for a line/period combination.
 * IST always overrides PLAN. If neither exists, returns 0.
 */
function getEffectiveValue(
  istValue: bigint | null,
  planValue: bigint | null
): bigint {
  if (istValue !== null) {
    return istValue;
  }
  if (planValue !== null) {
    return planValue;
  }
  return BigInt(0);
}

/**
 * Generate period label based on period type.
 */
function generatePeriodLabel(
  periodType: PeriodType,
  periodIndex: number,
  startDate: Date
): string {
  if (periodType === "WEEKLY") {
    const weekDate = new Date(startDate);
    weekDate.setDate(weekDate.getDate() + periodIndex * 7);
    return `KW ${getISOWeek(weekDate).toString().padStart(2, "0")}`;
  } else {
    // MONTHLY
    const monthDate = new Date(startDate);
    monthDate.setMonth(monthDate.getMonth() + periodIndex);
    const monthNames = ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    const year = monthDate.getFullYear().toString().slice(-2);
    return `${monthNames[monthDate.getMonth()]} ${year}`;
  }
}

/**
 * Get period start and end dates.
 */
function getPeriodDates(
  periodType: PeriodType,
  periodIndex: number,
  planStartDate: Date
): { start: Date; end: Date } {
  if (periodType === "WEEKLY") {
    const start = new Date(planStartDate);
    start.setDate(start.getDate() + periodIndex * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end };
  } else {
    // MONTHLY
    const start = new Date(planStartDate);
    start.setMonth(start.getMonth() + periodIndex);
    start.setDate(1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0); // Last day of month
    return { start, end };
  }
}

/**
 * Main calculation function - Deterministic period-based liquidity forecast.
 */
export function calculateLiquidityPlan(
  openingBalanceCents: bigint,
  categories: CategoryInput[],
  lines: LineInput[],
  periodValues: PeriodValueInput[],
  planStartDate: Date,
  periodType: PeriodType = "WEEKLY",
  periodCount: number = 13
): CalculationResult {
  const calculatedAt = new Date();

  // Build lookup maps for efficiency
  const categoryMap = new Map<string, CategoryInput>();
  for (const cat of categories) {
    categoryMap.set(cat.id, cat);
  }

  const lineMap = new Map<string, LineInput>();
  for (const line of lines) {
    lineMap.set(line.id, line);
  }

  // Build value lookup: lineId -> periodIndex -> valueType -> amount
  const valueMap = new Map<string, Map<number, Map<ValueType, bigint>>>();
  for (const value of periodValues) {
    if (!valueMap.has(value.lineId)) {
      valueMap.set(value.lineId, new Map());
    }
    const periodMap = valueMap.get(value.lineId)!;
    if (!periodMap.has(value.periodIndex)) {
      periodMap.set(value.periodIndex, new Map());
    }
    periodMap.get(value.periodIndex)!.set(value.valueType, value.amountCents);
  }

  // Initialize period calculations
  const periods: PeriodCalculation[] = [];
  let currentOpeningBalance = openingBalanceCents;

  // Aggregate totals
  let totalInflows = BigInt(0);
  let totalOutflows = BigInt(0);
  let totalInflowsAltmasse = BigInt(0);
  let totalInflowsNeumasse = BigInt(0);
  let totalOutflowsAltmasse = BigInt(0);
  let totalOutflowsNeumasse = BigInt(0);

  // Build line calculations first
  const lineCalculations: LineCalculation[] = [];
  const categoryTotalsMap = new Map<string, { periodTotals: bigint[]; totalCents: bigint }>();

  // Initialize category totals
  for (const category of categories) {
    categoryTotalsMap.set(category.id, {
      periodTotals: Array(periodCount).fill(BigInt(0)),
      totalCents: BigInt(0)
    });
  }

  // Calculate each line
  for (const line of lines) {
    const category = categoryMap.get(line.categoryId);
    if (!category) continue;

    const linePeriodValues: LineCalculation["periodValues"] = [];
    let lineTotalCents = BigInt(0);

    for (let periodIndex = 0; periodIndex < periodCount; periodIndex++) {
      const pValues = valueMap.get(line.id)?.get(periodIndex);
      const istCents = pValues?.get("IST") ?? null;
      const planCents = pValues?.get("PLAN") ?? null;
      const effectiveCents = getEffectiveValue(istCents, planCents);

      linePeriodValues.push({
        periodIndex,
        istCents,
        planCents,
        effectiveCents
      });

      lineTotalCents += effectiveCents;

      // Add to category totals
      const catTotals = categoryTotalsMap.get(category.id)!;
      catTotals.periodTotals[periodIndex] += effectiveCents;
    }

    // Update category total
    const catTotals = categoryTotalsMap.get(category.id)!;
    catTotals.totalCents += lineTotalCents;

    lineCalculations.push({
      lineId: line.id,
      lineName: line.name,
      categoryId: category.id,
      categoryName: category.name,
      flowType: category.flowType,
      estateType: category.estateType,
      periodValues: linePeriodValues,
      totalCents: lineTotalCents
    });
  }

  // Build category calculations
  const categoryCalculations: CategoryCalculation[] = [];
  for (const category of categories.sort((a, b) => a.displayOrder - b.displayOrder)) {
    const catLines = lineCalculations.filter(l => l.categoryId === category.id);
    const catTotals = categoryTotalsMap.get(category.id)!;

    categoryCalculations.push({
      categoryId: category.id,
      categoryName: category.name,
      flowType: category.flowType,
      estateType: category.estateType,
      lines: catLines.sort((a, b) => {
        const lineA = lineMap.get(a.lineId);
        const lineB = lineMap.get(b.lineId);
        return (lineA?.displayOrder ?? 0) - (lineB?.displayOrder ?? 0);
      }),
      periodTotals: catTotals.periodTotals,
      totalCents: catTotals.totalCents
    });
  }

  // Calculate period balances
  for (let periodIndex = 0; periodIndex < periodCount; periodIndex++) {
    let inflowsAltmasse = BigInt(0);
    let inflowsNeumasse = BigInt(0);
    let outflowsAltmasse = BigInt(0);
    let outflowsNeumasse = BigInt(0);

    // Sum up by category type
    for (const category of categories) {
      const catTotals = categoryTotalsMap.get(category.id)!;
      const periodAmount = catTotals.periodTotals[periodIndex];

      if (category.flowType === "INFLOW") {
        if (category.estateType === "ALTMASSE") {
          inflowsAltmasse += periodAmount;
        } else {
          inflowsNeumasse += periodAmount;
        }
      } else {
        if (category.estateType === "ALTMASSE") {
          outflowsAltmasse += periodAmount;
        } else {
          outflowsNeumasse += periodAmount;
        }
      }
    }

    const totalPeriodInflows = inflowsAltmasse + inflowsNeumasse;
    const totalPeriodOutflows = outflowsAltmasse + outflowsNeumasse;
    const netCashflow = totalPeriodInflows - totalPeriodOutflows;
    const closingBalance = currentOpeningBalance + netCashflow;

    // Generate period label and dates
    const periodLabel = generatePeriodLabel(periodType, periodIndex, planStartDate);
    const { start: periodStartDate, end: periodEndDate } = getPeriodDates(periodType, periodIndex, planStartDate);

    periods.push({
      periodIndex,
      periodLabel,
      periodStartDate,
      periodEndDate,
      openingBalanceCents: currentOpeningBalance,
      inflowsAltmasseCents: inflowsAltmasse,
      inflowsNeumasseCents: inflowsNeumasse,
      totalInflowsCents: totalPeriodInflows,
      outflowsAltmasseCents: outflowsAltmasse,
      outflowsNeumasseCents: outflowsNeumasse,
      totalOutflowsCents: totalPeriodOutflows,
      netCashflowCents: netCashflow,
      closingBalanceCents: closingBalance
    });

    // Accumulate totals
    totalInflows += totalPeriodInflows;
    totalOutflows += totalPeriodOutflows;
    totalInflowsAltmasse += inflowsAltmasse;
    totalInflowsNeumasse += inflowsNeumasse;
    totalOutflowsAltmasse += outflowsAltmasse;
    totalOutflowsNeumasse += outflowsNeumasse;

    // Propagate to next period
    currentOpeningBalance = closingBalance;
  }

  // Calculate data hash for integrity verification
  const dataHash = calculateDataHash(openingBalanceCents, periodValues);

  return {
    openingBalanceCents,
    periodType,
    periodCount,
    periods,
    categories: categoryCalculations,
    totalInflowsCents: totalInflows,
    totalOutflowsCents: totalOutflows,
    totalNetCashflowCents: totalInflows - totalOutflows,
    finalClosingBalanceCents: periods[periodCount - 1]?.closingBalanceCents ?? openingBalanceCents,
    totalInflowsAltmasseCents: totalInflowsAltmasse,
    totalInflowsNeumasseCents: totalInflowsNeumasse,
    totalOutflowsAltmasseCents: totalOutflowsAltmasse,
    totalOutflowsNeumasseCents: totalOutflowsNeumasse,
    dataHash,
    calculatedAt,
    // Legacy alias
    weeks: periods
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get ISO week number from a date.
 */
function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

/**
 * Calculate SHA-256 hash for data integrity verification.
 */
export function calculateDataHash(
  openingBalanceCents: bigint,
  values: PeriodValueInput[]
): string {
  // Sort values for deterministic ordering
  const sortedValues = [...values].sort((a, b) => {
    if (a.lineId !== b.lineId) return a.lineId.localeCompare(b.lineId);
    if (a.periodIndex !== b.periodIndex) return a.periodIndex - b.periodIndex;
    return a.valueType.localeCompare(b.valueType);
  });

  // Build canonical string representation
  const parts: string[] = [`opening:${openingBalanceCents.toString()}`];

  for (const v of sortedValues) {
    parts.push(`${v.lineId}:${v.periodIndex}:${v.valueType}:${v.amountCents.toString()}`);
  }

  const canonical = parts.join("|");

  // Calculate SHA-256 hash
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

// =============================================================================
// FORMATTING UTILITIES
// =============================================================================

/**
 * Convert euro cents to display string (German locale).
 */
export function centsToEuroDisplay(cents: bigint): string {
  const euros = Number(cents) / 100;
  return euros.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Convert euro amount to cents.
 */
export function euroToCents(euroAmount: number): bigint {
  return BigInt(Math.round(euroAmount * 100));
}

/**
 * Parse German-formatted euro string to cents.
 */
export function parseGermanEuroToCents(euroString: string): bigint | null {
  try {
    // Remove thousands separators (.)
    let cleaned = euroString.replace(/\./g, "");
    // Replace decimal separator (,) with .
    cleaned = cleaned.replace(",", ".");
    // Remove currency symbol if present
    cleaned = cleaned.replace(/EUR|€/gi, "").trim();

    const value = parseFloat(cleaned);
    if (isNaN(value)) return null;

    return BigInt(Math.round(value * 100));
  } catch {
    return null;
  }
}

/**
 * Get the Monday of a given week.
 */
export function getMondayOfWeek(year: number, week: number): Date {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dayOfWeek = simple.getDay();
  const isoWeekStart = simple;

  if (dayOfWeek <= 4) {
    isoWeekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    isoWeekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }

  return isoWeekStart;
}

/**
 * Get the current Monday (start of current week).
 */
export function getCurrentMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.setDate(diff));
}

// =============================================================================
// STANDARD CATEGORIES
// =============================================================================

export const STANDARD_CATEGORIES: Omit<CategoryInput, "id">[] = [
  // Inflows - Altmasse
  { name: "Forderungseinzuege", flowType: "INFLOW", estateType: "ALTMASSE", displayOrder: 1 },
  { name: "Anlagenverkaeufe", flowType: "INFLOW", estateType: "ALTMASSE", displayOrder: 2 },
  { name: "Sonstige Einzahlungen Alt", flowType: "INFLOW", estateType: "ALTMASSE", displayOrder: 3 },

  // Inflows - Neumasse
  { name: "Umsatzerloese", flowType: "INFLOW", estateType: "NEUMASSE", displayOrder: 4 },
  { name: "Sonstige Einzahlungen Neu", flowType: "INFLOW", estateType: "NEUMASSE", displayOrder: 5 },

  // Outflows - Neumasse
  { name: "Loehne und Gehaelter", flowType: "OUTFLOW", estateType: "NEUMASSE", displayOrder: 6 },
  { name: "Sozialversicherung", flowType: "OUTFLOW", estateType: "NEUMASSE", displayOrder: 7 },
  { name: "Miete und Nebenkosten", flowType: "OUTFLOW", estateType: "NEUMASSE", displayOrder: 8 },
  { name: "Material und Waren", flowType: "OUTFLOW", estateType: "NEUMASSE", displayOrder: 9 },
  { name: "Sonstige Auszahlungen Neu", flowType: "OUTFLOW", estateType: "NEUMASSE", displayOrder: 10 },

  // Outflows - Altmasse
  { name: "Altmasseverbindlichkeiten", flowType: "OUTFLOW", estateType: "ALTMASSE", displayOrder: 11 },
  { name: "Sonstige Auszahlungen Alt", flowType: "OUTFLOW", estateType: "ALTMASSE", displayOrder: 12 },
];
