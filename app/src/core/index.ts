/**
 * Core Liquidity Engine
 *
 * A deterministic 13-week liquidity calculation engine for German insolvency proceedings.
 *
 * This module provides:
 * - Input validation with detailed error messages
 * - Deterministic calculation of weekly liquidity positions
 * - Integrity hashing for version verification
 * - UI-ready output transformations
 *
 * CRITICAL: All calculations are deterministic - same inputs always produce same outputs.
 * CRITICAL: All monetary values are in euro cents as bigint for exact arithmetic.
 *
 * @module core
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * import {
 *   validateInput,
 *   calculateLiquidity,
 *   transformToUIPayload
 * } from '@/core';
 *
 * // 1. Validate input
 * const validationResult = validateInput(rawInput);
 * if (!validationResult.valid) {
 *   console.error('Validation errors:', validationResult.errors);
 *   return;
 * }
 *
 * // 2. Calculate liquidity
 * const result = calculateLiquidity(validationResult.data);
 *
 * // 3. Transform for UI
 * const uiPayload = transformToUIPayload(
 *   result,
 *   validationResult.data.categories,
 *   validationResult.data.lines,
 *   validationResult.data.openingBalanceCents
 * );
 *
 * // 4. Use in dashboard
 * renderDashboard(uiPayload);
 * ```
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  // Enums
  FlowType,
  EstateType,
  ValueType,

  // Input types
  CategoryInput,
  LineInput,
  WeeklyValueInput,
  LiquidityCalculationInput,

  // Output types - calculation
  WeeklyCalculation,
  EffectiveLineValue,
  LineTotals,
  CategoryTotals,
  CalculationResult,

  // Output types - UI
  KPIs,
  FormattedAmount,
  TableRow,
  TableSeries,
  ChartDataPoint,
  ChartSeries,
  UIPayload,

  // Validation types
  ValidationError,
  ValidationResult,

  // Hash types
  HashableValue,
} from './types';

// Constants
export { WEEK_COUNT, MIN_WEEK_OFFSET, MAX_WEEK_OFFSET } from './types';

// ============================================================================
// VALIDATION EXPORTS
// ============================================================================

export {
  validateInput,
  formatValidationErrors,
  groupErrorsByPath,
  ErrorCodes,
} from './validation';

// ============================================================================
// CALCULATION EXPORTS
// ============================================================================

export {
  calculateLiquidity,
  getEffectiveValue,
  verifyCalculationIntegrity,
} from './calculation';

// ============================================================================
// HASH EXPORTS
// ============================================================================

export {
  calculateDataHash,
  calculateDataHashAsync,
  verifyDataHash,
  verifyDataHashAsync,
  getCanonicalString,
} from './hash';

// ============================================================================
// OUTPUT EXPORTS
// ============================================================================

export {
  transformToUIPayload,
  formatEuro,
  centsToEuro,
  createFormattedAmount,
} from './output';

// ============================================================================
// CONVENIENCE FUNCTION
// ============================================================================

import { validateInput } from './validation';
import { calculateLiquidity } from './calculation';
import { transformToUIPayload } from './output';
import type { LiquidityCalculationInput, UIPayload, ValidationError } from './types';

/**
 * Convenience function that validates, calculates, and transforms in one call.
 *
 * This is the simplest way to use the liquidity engine. It handles all steps
 * and returns either a UI-ready payload or validation errors.
 *
 * @param input - Raw input data (will be validated)
 * @returns Either success with UI payload, or failure with validation errors
 *
 * @example
 * ```typescript
 * const result = processLiquidityPlan(rawData);
 * if (result.success) {
 *   renderDashboard(result.payload);
 * } else {
 *   showErrors(result.errors);
 * }
 * ```
 */
export function processLiquidityPlan(
  input: unknown
):
  | { success: true; payload: UIPayload }
  | { success: false; errors: readonly ValidationError[] } {
  // Validate
  const validationResult = validateInput(input);
  if (!validationResult.valid) {
    return { success: false, errors: validationResult.errors };
  }

  // Calculate
  const calculationResult = calculateLiquidity(validationResult.data);

  // Transform
  const payload = transformToUIPayload(
    calculationResult,
    validationResult.data.categories,
    validationResult.data.lines,
    validationResult.data.openingBalanceCents
  );

  return { success: true, payload };
}
