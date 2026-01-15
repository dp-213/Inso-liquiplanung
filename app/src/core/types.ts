/**
 * Core Liquidity Engine - Type Definitions
 *
 * This module defines all types for the 13-week liquidity planning engine.
 * All monetary values are represented in euro cents as bigint for exact arithmetic.
 *
 * @module core/types
 * @version 1.0.0
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Direction of cash flow
 */
export type FlowType = 'INFLOW' | 'OUTFLOW';

/**
 * Estate classification per German insolvency law
 * - ALTMASSE: Old estate (pre-insolvency opening)
 * - NEUMASSE: New estate (post-insolvency opening)
 */
export type EstateType = 'ALTMASSE' | 'NEUMASSE';

/**
 * Value type classification
 * - IST: Actual/confirmed value (from bank statements)
 * - PLAN: Planned/projected value (estimates)
 */
export type ValueType = 'IST' | 'PLAN';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Fixed number of weeks in the liquidity plan
 */
export const WEEK_COUNT = 13;

/**
 * Valid week offset range (0-12 inclusive)
 */
export const MIN_WEEK_OFFSET = 0;
export const MAX_WEEK_OFFSET = 12;

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Input category definition for the calculation engine
 */
export interface CategoryInput {
  /** Unique identifier for the category */
  readonly id: string;
  /** Display name */
  readonly name: string;
  /** Inflow or outflow */
  readonly flowType: FlowType;
  /** Old or new estate */
  readonly estateType: EstateType;
  /** Sort order for display */
  readonly displayOrder: number;
}

/**
 * Input line definition for the calculation engine
 */
export interface LineInput {
  /** Unique identifier for the line */
  readonly id: string;
  /** Reference to parent category */
  readonly categoryId: string;
  /** Display name */
  readonly name: string;
  /** Sort order within category */
  readonly displayOrder: number;
}

/**
 * Input weekly value for the calculation engine
 */
export interface WeeklyValueInput {
  /** Reference to parent line */
  readonly lineId: string;
  /** Week offset (0-12) */
  readonly weekOffset: number;
  /** IST or PLAN value type */
  readonly valueType: ValueType;
  /** Amount in euro cents */
  readonly amountCents: bigint;
}

/**
 * Complete input payload for the liquidity calculation engine
 */
export interface LiquidityCalculationInput {
  /** Opening balance at start of Week 0 in euro cents */
  readonly openingBalanceCents: bigint;
  /** All cashflow categories */
  readonly categories: readonly CategoryInput[];
  /** All cashflow lines */
  readonly lines: readonly LineInput[];
  /** All weekly values (IST and PLAN) */
  readonly weeklyValues: readonly WeeklyValueInput[];
}

// ============================================================================
// OUTPUT TYPES - WEEKLY CALCULATION
// ============================================================================

/**
 * Calculated values for a single week
 */
export interface WeeklyCalculation {
  /** Week offset (0-12) */
  readonly weekOffset: number;
  /** Balance at start of week in cents */
  readonly openingBalanceCents: bigint;
  /** Total old estate inflows in cents */
  readonly inflowsAltmasseCents: bigint;
  /** Total new estate inflows in cents */
  readonly inflowsNeumasseCents: bigint;
  /** Sum of all inflows in cents */
  readonly totalInflowsCents: bigint;
  /** Total old estate outflows in cents */
  readonly outflowsAltmasseCents: bigint;
  /** Total new estate outflows in cents */
  readonly outflowsNeumasseCents: bigint;
  /** Sum of all outflows in cents */
  readonly totalOutflowsCents: bigint;
  /** Net cashflow (inflows - outflows) in cents */
  readonly netCashflowCents: bigint;
  /** Balance at end of week in cents */
  readonly closingBalanceCents: bigint;
}

/**
 * Effective value for a single line/week combination
 */
export interface EffectiveLineValue {
  /** Line identifier */
  readonly lineId: string;
  /** Week offset (0-12) */
  readonly weekOffset: number;
  /** The effective amount used (IST if present, else PLAN, else 0) */
  readonly effectiveAmountCents: bigint;
  /** Source of the effective value */
  readonly source: 'IST' | 'PLAN' | 'DEFAULT';
  /** Original IST value if present */
  readonly istAmountCents: bigint | null;
  /** Original PLAN value if present */
  readonly planAmountCents: bigint | null;
}

/**
 * Line totals across all 13 weeks
 */
export interface LineTotals {
  /** Line identifier */
  readonly lineId: string;
  /** Category identifier */
  readonly categoryId: string;
  /** Sum of effective values across all weeks */
  readonly totalCents: bigint;
  /** Per-week effective values */
  readonly weeklyEffectiveValues: readonly EffectiveLineValue[];
}

/**
 * Category totals aggregating all lines
 */
export interface CategoryTotals {
  /** Category identifier */
  readonly categoryId: string;
  /** Flow type */
  readonly flowType: FlowType;
  /** Estate type */
  readonly estateType: EstateType;
  /** Sum across all lines and weeks */
  readonly totalCents: bigint;
  /** Per-week totals */
  readonly weeklyTotalsCents: readonly bigint[];
}

// ============================================================================
// OUTPUT TYPES - COMPLETE RESULT
// ============================================================================

/**
 * Complete calculation result from the engine
 */
export interface CalculationResult {
  /** Weekly calculations for all 13 weeks */
  readonly weeks: readonly WeeklyCalculation[];
  /** Line-level detail with effective values */
  readonly lineTotals: readonly LineTotals[];
  /** Category-level aggregations */
  readonly categoryTotals: readonly CategoryTotals[];
  /** Sum of all inflows across all weeks */
  readonly grandTotalInflowsCents: bigint;
  /** Sum of all outflows across all weeks */
  readonly grandTotalOutflowsCents: bigint;
  /** Net change over the 13 weeks */
  readonly grandTotalNetCashflowCents: bigint;
  /** Final closing balance at end of Week 12 */
  readonly finalClosingBalanceCents: bigint;
  /** Integrity hash for version storage */
  readonly dataHash: string;
}

// ============================================================================
// OUTPUT TYPES - UI PAYLOAD
// ============================================================================

/**
 * Key Performance Indicators for dashboard display
 */
export interface KPIs {
  /** Opening balance (start of Week 0) formatted */
  readonly openingBalance: FormattedAmount;
  /** Final closing balance (end of Week 12) formatted */
  readonly closingBalance: FormattedAmount;
  /** Total inflows formatted */
  readonly totalInflows: FormattedAmount;
  /** Total outflows formatted */
  readonly totalOutflows: FormattedAmount;
  /** Net change formatted */
  readonly netChange: FormattedAmount;
  /** Minimum weekly closing balance */
  readonly minWeeklyBalance: FormattedAmount;
  /** Week offset with minimum balance */
  readonly minWeeklyBalanceWeek: number;
  /** Indicates if any week has negative closing balance */
  readonly hasNegativeBalance: boolean;
  /** Number of weeks with negative closing balance */
  readonly negativeBalanceWeeks: number;
}

/**
 * Formatted monetary amount for display
 */
export interface FormattedAmount {
  /** Raw value in cents */
  readonly cents: bigint;
  /** Formatted string in German locale (e.g., "1.234,56") */
  readonly formatted: string;
  /** Numeric euro value (for sorting/comparison) */
  readonly euroValue: number;
  /** Sign indicator */
  readonly isNegative: boolean;
}

/**
 * Single row in the table series output
 */
export interface TableRow {
  /** Row type for rendering */
  readonly rowType: 'CATEGORY_HEADER' | 'LINE' | 'CATEGORY_TOTAL' | 'SUBTOTAL' | 'GRAND_TOTAL';
  /** Display label */
  readonly label: string;
  /** Indentation level (0=root, 1=category, 2=line) */
  readonly indent: number;
  /** Category or line ID (null for totals) */
  readonly id: string | null;
  /** Flow type if applicable */
  readonly flowType: FlowType | null;
  /** Estate type if applicable */
  readonly estateType: EstateType | null;
  /** Values for each of the 13 weeks */
  readonly weeklyValues: readonly FormattedAmount[];
  /** Row total */
  readonly rowTotal: FormattedAmount;
}

/**
 * Complete table series for grid display
 */
export interface TableSeries {
  /** All table rows in display order */
  readonly rows: readonly TableRow[];
  /** Balance row showing weekly closing balances */
  readonly balanceRow: {
    readonly label: string;
    readonly weeklyValues: readonly FormattedAmount[];
  };
}

/**
 * Single data point for chart rendering
 */
export interface ChartDataPoint {
  /** Week offset (0-12) */
  readonly weekOffset: number;
  /** Week label (e.g., "KW 3") */
  readonly weekLabel: string;
  /** Opening balance for this week */
  readonly openingBalance: number;
  /** Closing balance for this week */
  readonly closingBalance: number;
  /** Total inflows for this week */
  readonly inflows: number;
  /** Total outflows for this week */
  readonly outflows: number;
  /** Net cashflow for this week */
  readonly netCashflow: number;
  /** Altmasse inflows */
  readonly inflowsAltmasse: number;
  /** Neumasse inflows */
  readonly inflowsNeumasse: number;
  /** Altmasse outflows */
  readonly outflowsAltmasse: number;
  /** Neumasse outflows */
  readonly outflowsNeumasse: number;
}

/**
 * Complete chart series for visualization
 */
export interface ChartSeries {
  /** Data points for all 13 weeks */
  readonly dataPoints: readonly ChartDataPoint[];
  /** Minimum Y value (for axis scaling) */
  readonly minValue: number;
  /** Maximum Y value (for axis scaling) */
  readonly maxValue: number;
}

/**
 * Complete UI output payload
 */
export interface UIPayload {
  /** Key performance indicators */
  readonly kpis: KPIs;
  /** Table data for grid display */
  readonly tableSeries: TableSeries;
  /** Chart data for visualization */
  readonly chartSeries: ChartSeries;
  /** Raw calculation result (for debugging/export) */
  readonly calculationResult: CalculationResult;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Single validation error
 */
export interface ValidationError {
  /** Error code for programmatic handling */
  readonly code: string;
  /** Human-readable error message */
  readonly message: string;
  /** Field or path that caused the error */
  readonly path: string;
  /** The invalid value (if safe to include) */
  readonly value?: unknown;
}

/**
 * Validation result - either success or failure
 */
export type ValidationResult =
  | { readonly valid: true; readonly data: LiquidityCalculationInput }
  | { readonly valid: false; readonly errors: readonly ValidationError[] };

// ============================================================================
// HASH INPUT TYPES
// ============================================================================

/**
 * Value structure for hash calculation
 */
export interface HashableValue {
  readonly lineId: string;
  readonly weekOffset: number;
  readonly valueType: ValueType;
  readonly amountCents: bigint;
}
