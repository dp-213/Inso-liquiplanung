/**
 * Core Liquidity Engine - Calculation Logic
 *
 * This module contains the pure, deterministic calculation functions
 * for the 13-week liquidity planning engine.
 *
 * CRITICAL: All monetary values are in euro cents as bigint.
 * CRITICAL: All functions are pure - no side effects, no external dependencies.
 *
 * @module core/calculation
 * @version 1.0.0
 */

import {
  type CategoryInput,
  type LineInput,
  type WeeklyValueInput,
  type LiquidityCalculationInput,
  type WeeklyCalculation,
  type EffectiveLineValue,
  type LineTotals,
  type CategoryTotals,
  type CalculationResult,
  type ValueType,
  WEEK_COUNT,
} from './types';
import { calculateDataHash } from './hash';

// ============================================================================
// EFFECTIVE VALUE CALCULATION
// ============================================================================

/**
 * Determines the effective value for a line/week combination.
 *
 * Rule: IST always overrides PLAN. If IST exists (even if 0), PLAN is ignored.
 * If neither exists, the effective value is 0.
 *
 * This is the core business rule from the specification:
 * EFFECTIVE = IST ?? PLAN ?? 0
 *
 * @param istValue - The IST (actual) value in cents, or null if not present
 * @param planValue - The PLAN (planned) value in cents, or null if not present
 * @returns The effective value to use in calculations
 */
export function getEffectiveValue(
  istValue: bigint | null,
  planValue: bigint | null
): { value: bigint; source: 'IST' | 'PLAN' | 'DEFAULT' } {
  if (istValue !== null) {
    return { value: istValue, source: 'IST' };
  }
  if (planValue !== null) {
    return { value: planValue, source: 'PLAN' };
  }
  return { value: 0n, source: 'DEFAULT' };
}

// ============================================================================
// VALUE LOOKUP HELPERS
// ============================================================================

/**
 * Creates an index for fast lookup of weekly values by (lineId, weekOffset, valueType)
 */
function createValueIndex(
  weeklyValues: readonly WeeklyValueInput[]
): Map<string, bigint> {
  const index = new Map<string, bigint>();

  for (const wv of weeklyValues) {
    const key = `${wv.lineId}|${wv.weekOffset}|${wv.valueType}`;
    index.set(key, wv.amountCents);
  }

  return index;
}

/**
 * Looks up a value from the index
 */
function lookupValue(
  index: Map<string, bigint>,
  lineId: string,
  weekOffset: number,
  valueType: ValueType
): bigint | null {
  const key = `${lineId}|${weekOffset}|${valueType}`;
  const value = index.get(key);
  return value !== undefined ? value : null;
}

// ============================================================================
// CATEGORY LOOKUP HELPERS
// ============================================================================

/**
 * Creates an index for fast lookup of categories by ID
 */
function createCategoryIndex(
  categories: readonly CategoryInput[]
): Map<string, CategoryInput> {
  const index = new Map<string, CategoryInput>();

  for (const cat of categories) {
    index.set(cat.id, cat);
  }

  return index;
}

// ============================================================================
// LINE-LEVEL CALCULATIONS
// ============================================================================

/**
 * Calculates effective values and totals for a single line across all weeks
 */
function calculateLineTotals(
  line: LineInput,
  valueIndex: Map<string, bigint>
): LineTotals {
  const weeklyEffectiveValues: EffectiveLineValue[] = [];
  let totalCents = 0n;

  for (let weekOffset = 0; weekOffset < WEEK_COUNT; weekOffset++) {
    const istValue = lookupValue(valueIndex, line.id, weekOffset, 'IST');
    const planValue = lookupValue(valueIndex, line.id, weekOffset, 'PLAN');
    const { value: effectiveValue, source } = getEffectiveValue(istValue, planValue);

    weeklyEffectiveValues.push({
      lineId: line.id,
      weekOffset,
      effectiveAmountCents: effectiveValue,
      source,
      istAmountCents: istValue,
      planAmountCents: planValue,
    });

    totalCents += effectiveValue;
  }

  return {
    lineId: line.id,
    categoryId: line.categoryId,
    totalCents,
    weeklyEffectiveValues,
  };
}

// ============================================================================
// CATEGORY-LEVEL CALCULATIONS
// ============================================================================

/**
 * Calculates totals for a single category across all weeks
 */
function calculateCategoryTotals(
  category: CategoryInput,
  lines: readonly LineInput[],
  lineTotalsMap: Map<string, LineTotals>
): CategoryTotals {
  // Find all lines belonging to this category
  const categoryLines = lines.filter((line) => line.categoryId === category.id);

  // Initialize weekly totals
  const weeklyTotalsCents: bigint[] = Array(WEEK_COUNT).fill(0n);
  let totalCents = 0n;

  // Sum up line values
  for (const line of categoryLines) {
    const lineTotals = lineTotalsMap.get(line.id);
    if (lineTotals) {
      totalCents += lineTotals.totalCents;

      for (let weekOffset = 0; weekOffset < WEEK_COUNT; weekOffset++) {
        const weekValue = lineTotals.weeklyEffectiveValues[weekOffset];
        if (weekValue) {
          weeklyTotalsCents[weekOffset] += weekValue.effectiveAmountCents;
        }
      }
    }
  }

  return {
    categoryId: category.id,
    flowType: category.flowType,
    estateType: category.estateType,
    totalCents,
    weeklyTotalsCents,
  };
}

// ============================================================================
// WEEKLY CALCULATION
// ============================================================================

/**
 * Calculates a single week's liquidity values
 */
function calculateWeek(
  weekOffset: number,
  openingBalanceCents: bigint,
  categoryTotals: readonly CategoryTotals[]
): WeeklyCalculation {
  // Sum inflows by estate type
  let inflowsAltmasseCents = 0n;
  let inflowsNeumasseCents = 0n;

  // Sum outflows by estate type
  let outflowsAltmasseCents = 0n;
  let outflowsNeumasseCents = 0n;

  for (const catTotal of categoryTotals) {
    const weekValue = catTotal.weeklyTotalsCents[weekOffset] ?? 0n;

    if (catTotal.flowType === 'INFLOW') {
      if (catTotal.estateType === 'ALTMASSE') {
        inflowsAltmasseCents += weekValue;
      } else {
        inflowsNeumasseCents += weekValue;
      }
    } else {
      if (catTotal.estateType === 'ALTMASSE') {
        outflowsAltmasseCents += weekValue;
      } else {
        outflowsNeumasseCents += weekValue;
      }
    }
  }

  // Calculate totals
  const totalInflowsCents = inflowsAltmasseCents + inflowsNeumasseCents;
  const totalOutflowsCents = outflowsAltmasseCents + outflowsNeumasseCents;
  const netCashflowCents = totalInflowsCents - totalOutflowsCents;
  const closingBalanceCents = openingBalanceCents + netCashflowCents;

  return {
    weekOffset,
    openingBalanceCents,
    inflowsAltmasseCents,
    inflowsNeumasseCents,
    totalInflowsCents,
    outflowsAltmasseCents,
    outflowsNeumasseCents,
    totalOutflowsCents,
    netCashflowCents,
    closingBalanceCents,
  };
}

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

/**
 * Calculates the complete 13-week liquidity plan.
 *
 * This is the main entry point for the calculation engine. It takes validated
 * input and produces a complete calculation result including:
 * - Weekly calculations with opening/closing balances
 * - Line-level effective values with source tracking
 * - Category-level aggregations
 * - Grand totals
 * - Integrity hash for version storage
 *
 * CRITICAL: This function is pure and deterministic.
 * Given identical inputs, it will always produce identical outputs.
 *
 * @param input - Validated calculation input (must be validated before calling)
 * @returns Complete calculation result
 *
 * @example
 * ```typescript
 * const validationResult = validateInput(rawData);
 * if (validationResult.valid) {
 *   const result = calculateLiquidity(validationResult.data);
 *   console.log('Final balance:', result.finalClosingBalanceCents);
 * }
 * ```
 */
export function calculateLiquidity(input: LiquidityCalculationInput): CalculationResult {
  const { openingBalanceCents, categories, lines, weeklyValues } = input;

  // Create indexes for fast lookup
  const valueIndex = createValueIndex(weeklyValues);
  const categoryIndex = createCategoryIndex(categories);

  // Calculate line totals
  const lineTotalsArray: LineTotals[] = [];
  const lineTotalsMap = new Map<string, LineTotals>();

  for (const line of lines) {
    const lineTotals = calculateLineTotals(line, valueIndex);
    lineTotalsArray.push(lineTotals);
    lineTotalsMap.set(line.id, lineTotals);
  }

  // Calculate category totals
  const categoryTotalsArray: CategoryTotals[] = [];

  for (const category of categories) {
    const catTotals = calculateCategoryTotals(category, lines, lineTotalsMap);
    categoryTotalsArray.push(catTotals);
  }

  // Calculate weekly values with balance propagation
  const weeks: WeeklyCalculation[] = [];
  let currentOpeningBalance = openingBalanceCents;

  for (let weekOffset = 0; weekOffset < WEEK_COUNT; weekOffset++) {
    const weekCalc = calculateWeek(weekOffset, currentOpeningBalance, categoryTotalsArray);
    weeks.push(weekCalc);

    // Propagate closing balance to next week's opening balance
    currentOpeningBalance = weekCalc.closingBalanceCents;
  }

  // Calculate grand totals
  let grandTotalInflowsCents = 0n;
  let grandTotalOutflowsCents = 0n;

  for (const week of weeks) {
    grandTotalInflowsCents += week.totalInflowsCents;
    grandTotalOutflowsCents += week.totalOutflowsCents;
  }

  const grandTotalNetCashflowCents = grandTotalInflowsCents - grandTotalOutflowsCents;
  const finalClosingBalanceCents = weeks[WEEK_COUNT - 1].closingBalanceCents;

  // Calculate data hash for integrity verification
  const hashableValues = weeklyValues.map((wv) => ({
    lineId: wv.lineId,
    weekOffset: wv.weekOffset,
    valueType: wv.valueType,
    amountCents: wv.amountCents,
  }));
  const dataHash = calculateDataHash(openingBalanceCents, hashableValues);

  return {
    weeks,
    lineTotals: lineTotalsArray,
    categoryTotals: categoryTotalsArray,
    grandTotalInflowsCents,
    grandTotalOutflowsCents,
    grandTotalNetCashflowCents,
    finalClosingBalanceCents,
    dataHash,
  };
}

// ============================================================================
// VERIFICATION FUNCTIONS
// ============================================================================

/**
 * Verifies the integrity of a calculation result.
 *
 * This function checks invariants that must hold for any valid calculation:
 * 1. Balance propagation: opening[W+1] == closing[W]
 * 2. Net calculation: net[W] == inflows[W] - outflows[W]
 * 3. Closing calculation: closing[W] == opening[W] + net[W]
 * 4. Total consistency: sum of weekly nets == final closing - initial opening
 *
 * @param result - The calculation result to verify
 * @param initialOpeningBalance - The initial opening balance for verification
 * @returns True if all invariants hold, false otherwise
 */
export function verifyCalculationIntegrity(
  result: CalculationResult,
  initialOpeningBalance: bigint
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check balance propagation
  for (let i = 0; i < WEEK_COUNT - 1; i++) {
    const currentWeek = result.weeks[i];
    const nextWeek = result.weeks[i + 1];

    if (currentWeek.closingBalanceCents !== nextWeek.openingBalanceCents) {
      errors.push(
        `Balance propagation error: Week ${i} closing (${currentWeek.closingBalanceCents}) != Week ${i + 1} opening (${nextWeek.openingBalanceCents})`
      );
    }
  }

  // Check first week's opening balance
  if (result.weeks[0].openingBalanceCents !== initialOpeningBalance) {
    errors.push(
      `Initial balance error: Week 0 opening (${result.weeks[0].openingBalanceCents}) != provided opening balance (${initialOpeningBalance})`
    );
  }

  // Check net calculation and closing balance for each week
  for (const week of result.weeks) {
    const expectedNet = week.totalInflowsCents - week.totalOutflowsCents;
    if (week.netCashflowCents !== expectedNet) {
      errors.push(
        `Net calculation error: Week ${week.weekOffset} net (${week.netCashflowCents}) != inflows - outflows (${expectedNet})`
      );
    }

    const expectedClosing = week.openingBalanceCents + week.netCashflowCents;
    if (week.closingBalanceCents !== expectedClosing) {
      errors.push(
        `Closing balance error: Week ${week.weekOffset} closing (${week.closingBalanceCents}) != opening + net (${expectedClosing})`
      );
    }
  }

  // Check grand total consistency
  const sumOfNets = result.weeks.reduce((sum, week) => sum + week.netCashflowCents, 0n);
  const expectedFinalClosing = initialOpeningBalance + sumOfNets;

  if (result.finalClosingBalanceCents !== expectedFinalClosing) {
    errors.push(
      `Grand total error: final closing (${result.finalClosingBalanceCents}) != initial opening + sum of nets (${expectedFinalClosing})`
    );
  }

  // Check inflow/outflow totals
  const sumOfInflows = result.weeks.reduce((sum, week) => sum + week.totalInflowsCents, 0n);
  const sumOfOutflows = result.weeks.reduce((sum, week) => sum + week.totalOutflowsCents, 0n);

  if (result.grandTotalInflowsCents !== sumOfInflows) {
    errors.push(
      `Inflow total error: grand total (${result.grandTotalInflowsCents}) != sum of weekly inflows (${sumOfInflows})`
    );
  }

  if (result.grandTotalOutflowsCents !== sumOfOutflows) {
    errors.push(
      `Outflow total error: grand total (${result.grandTotalOutflowsCents}) != sum of weekly outflows (${sumOfOutflows})`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
