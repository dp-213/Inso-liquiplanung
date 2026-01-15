/**
 * Core Liquidity Engine - Output Transformation
 *
 * This module transforms raw calculation results into UI-ready payloads.
 * It produces KPIs, table series, and chart series for dashboard display.
 *
 * CRITICAL: All transformations are pure and deterministic.
 *
 * @module core/output
 * @version 1.0.0
 */

import {
  type CalculationResult,
  type CategoryInput,
  type LineInput,
  type UIPayload,
  type KPIs,
  type FormattedAmount,
  type TableSeries,
  type TableRow,
  type ChartSeries,
  type ChartDataPoint,
  type LineTotals,
  type CategoryTotals,
  WEEK_COUNT,
} from './types';

// ============================================================================
// MONETARY FORMATTING
// ============================================================================

/**
 * Converts cents to euros as a number.
 * Used for numeric operations and chart rendering.
 */
export function centsToEuro(cents: bigint): number {
  return Number(cents) / 100;
}

/**
 * Formats a cent amount for display in German locale.
 *
 * @param cents - Amount in euro cents
 * @returns Formatted string (e.g., "1.234,56" or "-1.234,56")
 */
export function formatEuro(cents: bigint): string {
  const euros = centsToEuro(cents);
  return euros.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Creates a FormattedAmount object from cents.
 */
export function createFormattedAmount(cents: bigint): FormattedAmount {
  return {
    cents,
    formatted: formatEuro(cents),
    euroValue: centsToEuro(cents),
    isNegative: cents < 0n,
  };
}

// ============================================================================
// KPI CALCULATION
// ============================================================================

/**
 * Extracts Key Performance Indicators from calculation result.
 */
function calculateKPIs(
  result: CalculationResult,
  openingBalanceCents: bigint
): KPIs {
  // Find minimum weekly closing balance
  let minClosingBalance = result.weeks[0].closingBalanceCents;
  let minBalanceWeek = 0;
  let negativeBalanceCount = 0;

  for (const week of result.weeks) {
    if (week.closingBalanceCents < minClosingBalance) {
      minClosingBalance = week.closingBalanceCents;
      minBalanceWeek = week.weekOffset;
    }
    if (week.closingBalanceCents < 0n) {
      negativeBalanceCount++;
    }
  }

  return {
    openingBalance: createFormattedAmount(openingBalanceCents),
    closingBalance: createFormattedAmount(result.finalClosingBalanceCents),
    totalInflows: createFormattedAmount(result.grandTotalInflowsCents),
    totalOutflows: createFormattedAmount(result.grandTotalOutflowsCents),
    netChange: createFormattedAmount(result.grandTotalNetCashflowCents),
    minWeeklyBalance: createFormattedAmount(minClosingBalance),
    minWeeklyBalanceWeek: minBalanceWeek,
    hasNegativeBalance: negativeBalanceCount > 0,
    negativeBalanceWeeks: negativeBalanceCount,
  };
}

// ============================================================================
// TABLE SERIES GENERATION
// ============================================================================

/**
 * Generates table rows for display in a grid.
 *
 * Structure:
 * - INFLOW categories (Altmasse, then Neumasse)
 *   - Category header
 *   - Lines within category
 *   - Category total
 * - Subtotal: Total Inflows
 * - OUTFLOW categories (Altmasse, then Neumasse)
 *   - Category header
 *   - Lines within category
 *   - Category total
 * - Subtotal: Total Outflows
 * - Grand Total: Net Cashflow
 */
function generateTableSeries(
  result: CalculationResult,
  categories: readonly CategoryInput[],
  lines: readonly LineInput[]
): TableSeries {
  const rows: TableRow[] = [];

  // Create lookup maps
  const categoryMap = new Map<string, CategoryInput>();
  for (const cat of categories) {
    categoryMap.set(cat.id, cat);
  }

  const lineTotalsMap = new Map<string, LineTotals>();
  for (const lt of result.lineTotals) {
    lineTotalsMap.set(lt.lineId, lt);
  }

  const categoryTotalsMap = new Map<string, CategoryTotals>();
  for (const ct of result.categoryTotals) {
    categoryTotalsMap.set(ct.categoryId, ct);
  }

  // Sort categories by display order, grouped by flow type and estate type
  const sortedCategories = [...categories].sort((a, b) => {
    // Primary: INFLOW before OUTFLOW
    if (a.flowType !== b.flowType) {
      return a.flowType === 'INFLOW' ? -1 : 1;
    }
    // Secondary: ALTMASSE before NEUMASSE
    if (a.estateType !== b.estateType) {
      return a.estateType === 'ALTMASSE' ? -1 : 1;
    }
    // Tertiary: by display order
    return a.displayOrder - b.displayOrder;
  });

  // Helper to create weekly values array
  const createWeeklyValues = (getValue: (weekOffset: number) => bigint): FormattedAmount[] => {
    const values: FormattedAmount[] = [];
    for (let i = 0; i < WEEK_COUNT; i++) {
      values.push(createFormattedAmount(getValue(i)));
    }
    return values;
  };

  // Track running totals for subtotals
  let currentFlowType: 'INFLOW' | 'OUTFLOW' | null = null;

  // Process categories
  for (const category of sortedCategories) {
    // Add subtotal row when switching from INFLOW to OUTFLOW
    if (currentFlowType === 'INFLOW' && category.flowType === 'OUTFLOW') {
      // Add Total Inflows subtotal
      rows.push({
        rowType: 'SUBTOTAL',
        label: 'Summe Einzahlungen',
        indent: 0,
        id: null,
        flowType: 'INFLOW',
        estateType: null,
        weeklyValues: createWeeklyValues((w) => result.weeks[w].totalInflowsCents),
        rowTotal: createFormattedAmount(result.grandTotalInflowsCents),
      });
    }
    currentFlowType = category.flowType;

    // Get category's lines sorted by display order
    const categoryLines = lines
      .filter((l) => l.categoryId === category.id)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    // Skip empty categories
    if (categoryLines.length === 0) {
      continue;
    }

    // Add category header
    rows.push({
      rowType: 'CATEGORY_HEADER',
      label: category.name,
      indent: 0,
      id: category.id,
      flowType: category.flowType,
      estateType: category.estateType,
      weeklyValues: [], // Headers don't have values
      rowTotal: createFormattedAmount(0n),
    });

    // Add lines
    for (const line of categoryLines) {
      const lineTotals = lineTotalsMap.get(line.id);
      if (!lineTotals) continue;

      rows.push({
        rowType: 'LINE',
        label: line.name,
        indent: 1,
        id: line.id,
        flowType: category.flowType,
        estateType: category.estateType,
        weeklyValues: createWeeklyValues(
          (w) => lineTotals.weeklyEffectiveValues[w]?.effectiveAmountCents ?? 0n
        ),
        rowTotal: createFormattedAmount(lineTotals.totalCents),
      });
    }

    // Add category total
    const categoryTotals = categoryTotalsMap.get(category.id);
    if (categoryTotals) {
      rows.push({
        rowType: 'CATEGORY_TOTAL',
        label: `Summe ${category.name}`,
        indent: 0,
        id: category.id,
        flowType: category.flowType,
        estateType: category.estateType,
        weeklyValues: createWeeklyValues((w) => categoryTotals.weeklyTotalsCents[w] ?? 0n),
        rowTotal: createFormattedAmount(categoryTotals.totalCents),
      });
    }
  }

  // Add Total Outflows subtotal
  if (currentFlowType === 'OUTFLOW') {
    rows.push({
      rowType: 'SUBTOTAL',
      label: 'Summe Auszahlungen',
      indent: 0,
      id: null,
      flowType: 'OUTFLOW',
      estateType: null,
      weeklyValues: createWeeklyValues((w) => result.weeks[w].totalOutflowsCents),
      rowTotal: createFormattedAmount(result.grandTotalOutflowsCents),
    });
  }

  // Add Net Cashflow grand total
  rows.push({
    rowType: 'GRAND_TOTAL',
    label: 'Netto-Cashflow',
    indent: 0,
    id: null,
    flowType: null,
    estateType: null,
    weeklyValues: createWeeklyValues((w) => result.weeks[w].netCashflowCents),
    rowTotal: createFormattedAmount(result.grandTotalNetCashflowCents),
  });

  // Create balance row
  const balanceRow = {
    label: 'Kontostand (Ende)',
    weeklyValues: createWeeklyValues((w) => result.weeks[w].closingBalanceCents),
  };

  return { rows, balanceRow };
}

// ============================================================================
// CHART SERIES GENERATION
// ============================================================================

/**
 * Generates chart data points for visualization.
 */
function generateChartSeries(result: CalculationResult): ChartSeries {
  const dataPoints: ChartDataPoint[] = [];
  let minValue = Number.MAX_VALUE;
  let maxValue = Number.MIN_VALUE;

  for (const week of result.weeks) {
    const openingBalance = centsToEuro(week.openingBalanceCents);
    const closingBalance = centsToEuro(week.closingBalanceCents);
    const inflows = centsToEuro(week.totalInflowsCents);
    const outflows = centsToEuro(week.totalOutflowsCents);

    // Track min/max for axis scaling
    minValue = Math.min(minValue, openingBalance, closingBalance, -outflows);
    maxValue = Math.max(maxValue, openingBalance, closingBalance, inflows);

    dataPoints.push({
      weekOffset: week.weekOffset,
      weekLabel: `KW ${week.weekOffset + 1}`,
      openingBalance,
      closingBalance,
      inflows,
      outflows,
      netCashflow: centsToEuro(week.netCashflowCents),
      inflowsAltmasse: centsToEuro(week.inflowsAltmasseCents),
      inflowsNeumasse: centsToEuro(week.inflowsNeumasseCents),
      outflowsAltmasse: centsToEuro(week.outflowsAltmasseCents),
      outflowsNeumasse: centsToEuro(week.outflowsNeumasseCents),
    });
  }

  // Add some padding to min/max
  const range = maxValue - minValue;
  const padding = range * 0.1;

  return {
    dataPoints,
    minValue: minValue - padding,
    maxValue: maxValue + padding,
  };
}

// ============================================================================
// MAIN TRANSFORMATION FUNCTION
// ============================================================================

/**
 * Transforms a calculation result into a complete UI payload.
 *
 * This function takes the raw calculation result and produces a structured
 * payload ready for rendering in the dashboard, including:
 * - KPIs for summary cards
 * - Table series for grid display
 * - Chart series for visualization
 *
 * @param result - The calculation result to transform
 * @param categories - Original category inputs (for ordering and labels)
 * @param lines - Original line inputs (for ordering and labels)
 * @param openingBalanceCents - Original opening balance (for KPIs)
 * @returns Complete UI payload
 *
 * @example
 * ```typescript
 * const calculationResult = calculateLiquidity(validatedInput);
 * const uiPayload = transformToUIPayload(
 *   calculationResult,
 *   validatedInput.categories,
 *   validatedInput.lines,
 *   validatedInput.openingBalanceCents
 * );
 *
 * // Use in dashboard
 * renderKPICards(uiPayload.kpis);
 * renderTable(uiPayload.tableSeries);
 * renderChart(uiPayload.chartSeries);
 * ```
 */
export function transformToUIPayload(
  result: CalculationResult,
  categories: readonly CategoryInput[],
  lines: readonly LineInput[],
  openingBalanceCents: bigint
): UIPayload {
  return {
    kpis: calculateKPIs(result, openingBalanceCents),
    tableSeries: generateTableSeries(result, categories, lines),
    chartSeries: generateChartSeries(result),
    calculationResult: result,
  };
}

// Formatting utilities are already exported above via 'export function' declarations
