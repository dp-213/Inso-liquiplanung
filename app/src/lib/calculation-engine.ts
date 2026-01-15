/**
 * Core Liquidity Calculation Engine
 *
 * CRITICAL: This is the deterministic black-box calculation engine.
 * - Implements the canonical 13-week insolvency liquidity forecast
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

export interface WeeklyValueInput {
  lineId: string;
  weekOffset: number; // 0-12
  valueType: ValueType;
  amountCents: bigint;
}

export interface WeeklyCalculation {
  weekOffset: number;
  weekLabel: string; // e.g., "KW 03"
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

export interface LineCalculation {
  lineId: string;
  lineName: string;
  categoryId: string;
  categoryName: string;
  flowType: FlowType;
  estateType: EstateType;
  weeklyValues: {
    weekOffset: number;
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
  weeklyTotals: bigint[];
  totalCents: bigint;
}

export interface CalculationResult {
  openingBalanceCents: bigint;
  weeks: WeeklyCalculation[];
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
}

// =============================================================================
// CORE CALCULATION FUNCTIONS
// =============================================================================

/**
 * Get the effective value for a line/week combination.
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
 * Main calculation function - Deterministic 13-week liquidity forecast.
 */
export function calculateLiquidityPlan(
  openingBalanceCents: bigint,
  categories: CategoryInput[],
  lines: LineInput[],
  weeklyValues: WeeklyValueInput[],
  planStartDate: Date
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

  // Build value lookup: lineId -> weekOffset -> valueType -> amount
  const valueMap = new Map<string, Map<number, Map<ValueType, bigint>>>();
  for (const value of weeklyValues) {
    if (!valueMap.has(value.lineId)) {
      valueMap.set(value.lineId, new Map());
    }
    const weekMap = valueMap.get(value.lineId)!;
    if (!weekMap.has(value.weekOffset)) {
      weekMap.set(value.weekOffset, new Map());
    }
    weekMap.get(value.weekOffset)!.set(value.valueType, value.amountCents);
  }

  // Initialize week calculations
  const weeks: WeeklyCalculation[] = [];
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
  const categoryTotalsMap = new Map<string, { weeklyTotals: bigint[]; totalCents: bigint }>();

  // Initialize category totals
  for (const category of categories) {
    categoryTotalsMap.set(category.id, {
      weeklyTotals: Array(13).fill(BigInt(0)),
      totalCents: BigInt(0)
    });
  }

  // Calculate each line
  for (const line of lines) {
    const category = categoryMap.get(line.categoryId);
    if (!category) continue;

    const lineWeeklyValues: LineCalculation["weeklyValues"] = [];
    let lineTotalCents = BigInt(0);

    for (let weekOffset = 0; weekOffset <= 12; weekOffset++) {
      const weekValues = valueMap.get(line.id)?.get(weekOffset);
      const istCents = weekValues?.get("IST") ?? null;
      const planCents = weekValues?.get("PLAN") ?? null;
      const effectiveCents = getEffectiveValue(istCents, planCents);

      lineWeeklyValues.push({
        weekOffset,
        istCents,
        planCents,
        effectiveCents
      });

      lineTotalCents += effectiveCents;

      // Add to category totals
      const catTotals = categoryTotalsMap.get(category.id)!;
      catTotals.weeklyTotals[weekOffset] += effectiveCents;
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
      weeklyValues: lineWeeklyValues,
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
      weeklyTotals: catTotals.weeklyTotals,
      totalCents: catTotals.totalCents
    });
  }

  // Calculate weekly balances
  for (let weekOffset = 0; weekOffset <= 12; weekOffset++) {
    let inflowsAltmasse = BigInt(0);
    let inflowsNeumasse = BigInt(0);
    let outflowsAltmasse = BigInt(0);
    let outflowsNeumasse = BigInt(0);

    // Sum up by category type
    for (const category of categories) {
      const catTotals = categoryTotalsMap.get(category.id)!;
      const weekAmount = catTotals.weeklyTotals[weekOffset];

      if (category.flowType === "INFLOW") {
        if (category.estateType === "ALTMASSE") {
          inflowsAltmasse += weekAmount;
        } else {
          inflowsNeumasse += weekAmount;
        }
      } else {
        if (category.estateType === "ALTMASSE") {
          outflowsAltmasse += weekAmount;
        } else {
          outflowsNeumasse += weekAmount;
        }
      }
    }

    const totalWeekInflows = inflowsAltmasse + inflowsNeumasse;
    const totalWeekOutflows = outflowsAltmasse + outflowsNeumasse;
    const netCashflow = totalWeekInflows - totalWeekOutflows;
    const closingBalance = currentOpeningBalance + netCashflow;

    // Generate week label (KW format)
    const weekDate = new Date(planStartDate);
    weekDate.setDate(weekDate.getDate() + weekOffset * 7);
    const weekLabel = `KW ${getISOWeek(weekDate).toString().padStart(2, "0")}`;

    weeks.push({
      weekOffset,
      weekLabel,
      openingBalanceCents: currentOpeningBalance,
      inflowsAltmasseCents: inflowsAltmasse,
      inflowsNeumasseCents: inflowsNeumasse,
      totalInflowsCents: totalWeekInflows,
      outflowsAltmasseCents: outflowsAltmasse,
      outflowsNeumasseCents: outflowsNeumasse,
      totalOutflowsCents: totalWeekOutflows,
      netCashflowCents: netCashflow,
      closingBalanceCents: closingBalance
    });

    // Accumulate totals
    totalInflows += totalWeekInflows;
    totalOutflows += totalWeekOutflows;
    totalInflowsAltmasse += inflowsAltmasse;
    totalInflowsNeumasse += inflowsNeumasse;
    totalOutflowsAltmasse += outflowsAltmasse;
    totalOutflowsNeumasse += outflowsNeumasse;

    // Propagate to next week
    currentOpeningBalance = closingBalance;
  }

  // Calculate data hash for integrity verification
  const dataHash = calculateDataHash(openingBalanceCents, weeklyValues);

  return {
    openingBalanceCents,
    weeks,
    categories: categoryCalculations,
    totalInflowsCents: totalInflows,
    totalOutflowsCents: totalOutflows,
    totalNetCashflowCents: totalInflows - totalOutflows,
    finalClosingBalanceCents: weeks[12].closingBalanceCents,
    totalInflowsAltmasseCents: totalInflowsAltmasse,
    totalInflowsNeumasseCents: totalInflowsNeumasse,
    totalOutflowsAltmasseCents: totalOutflowsAltmasse,
    totalOutflowsNeumasseCents: totalOutflowsNeumasse,
    dataHash,
    calculatedAt
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
  values: WeeklyValueInput[]
): string {
  // Sort values for deterministic ordering
  const sortedValues = [...values].sort((a, b) => {
    if (a.lineId !== b.lineId) return a.lineId.localeCompare(b.lineId);
    if (a.weekOffset !== b.weekOffset) return a.weekOffset - b.weekOffset;
    return a.valueType.localeCompare(b.valueType);
  });

  // Build canonical string representation
  const parts: string[] = [`opening:${openingBalanceCents.toString()}`];

  for (const v of sortedValues) {
    parts.push(`${v.lineId}:${v.weekOffset}:${v.valueType}:${v.amountCents.toString()}`);
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
