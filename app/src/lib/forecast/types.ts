/**
 * Forecast Engine – Typdefinitionen
 *
 * Alle Beträge in Cents (BigInt). JSON-Serialisierung → String.
 */

// ============================================================================
// BERECHNUNG
// ============================================================================

export interface ForecastPeriodResult {
  periodIndex: number;
  periodLabel: string;
  periodStartDate: string; // ISO date
  dataSource: 'IST' | 'FORECAST';
  openingBalanceCents: bigint;
  cashInTotalCents: bigint;
  cashOutTotalCents: bigint;
  netCashflowCents: bigint;
  closingBalanceCents: bigint;
  creditLineAvailableCents: bigint;
  headroomCents: bigint;
  headroomAfterReservesCents: bigint;
  lineItems: ForecastLineItem[];
}

export interface ForecastLineItem {
  assumptionId: string;
  categoryKey: string;
  categoryLabel: string;
  flowType: 'INFLOW' | 'OUTFLOW';
  amountCents: bigint;
  formula: string; // z.B. "40.000 × 1,0 × 1,0 = 40.000"
}

export interface ForecastCalculationResult {
  periods: ForecastPeriodResult[];
  summary: {
    totalInflowsCents: bigint;
    totalOutflowsCents: bigint;
    finalClosingBalanceCents: bigint;
    minHeadroomCents: bigint;
    minHeadroomPeriodIndex: number;
  };
  warnings: string[];
}

// ============================================================================
// ENGINE INPUT
// ============================================================================

export interface ForecastAssumptionInput {
  id: string;
  categoryKey: string;
  categoryLabel: string;
  flowType: 'INFLOW' | 'OUTFLOW';
  assumptionType: 'RUN_RATE' | 'FIXED' | 'ONE_TIME' | 'PERCENTAGE_OF_REVENUE';
  baseAmountCents: bigint;
  baseAmountSource: string;
  growthFactorPercent: number | null;
  seasonalProfile: number[] | null; // 12 Monatsfaktoren
  startPeriodIndex: number;
  endPeriodIndex: number;
  isActive: boolean;
}

export interface ForecastScenarioInput {
  periodType: 'WEEKLY' | 'MONTHLY';
  periodCount: number;
  planStartDate: string; // ISO date
  openingBalanceCents: bigint;
  istCutoffOverride: number | null;
}

export interface IstPeriodData {
  periodIndex: number;
  periodLabel: string;
  periodStartDate: string;
  cashInCents: bigint;
  cashOutCents: bigint;
  closingBalanceCents: bigint;
}

export interface ForecastEngineParams {
  scenario: ForecastScenarioInput;
  assumptions: ForecastAssumptionInput[];
  istPeriods: IstPeriodData[];
  creditLineCents: bigint;
  reservesTotalCents: bigint;
}

// ============================================================================
// JSON SERIALIZATION (BigInt → String)
// ============================================================================

export interface ForecastPeriodResultJSON {
  periodIndex: number;
  periodLabel: string;
  periodStartDate: string;
  dataSource: 'IST' | 'FORECAST';
  openingBalanceCents: string;
  cashInTotalCents: string;
  cashOutTotalCents: string;
  netCashflowCents: string;
  closingBalanceCents: string;
  creditLineAvailableCents: string;
  headroomCents: string;
  headroomAfterReservesCents: string;
  lineItems: ForecastLineItemJSON[];
}

export interface ForecastLineItemJSON {
  assumptionId: string;
  categoryKey: string;
  categoryLabel: string;
  flowType: 'INFLOW' | 'OUTFLOW';
  amountCents: string;
  formula: string;
}

export interface ForecastCalculationResultJSON {
  periods: ForecastPeriodResultJSON[];
  summary: {
    totalInflowsCents: string;
    totalOutflowsCents: string;
    finalClosingBalanceCents: string;
    minHeadroomCents: string;
    minHeadroomPeriodIndex: number;
  };
  warnings: string[];
}
