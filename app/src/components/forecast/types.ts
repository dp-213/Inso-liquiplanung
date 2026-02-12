// ============================================================================
// Shared Types für Forecast-Komponenten
// ============================================================================

export interface ForecastLineItemJSON {
  assumptionId: string;
  categoryKey: string;
  categoryLabel: string;
  flowType: "INFLOW" | "OUTFLOW";
  amountCents: string;
  formula: string;
}

export interface ForecastPeriodJSON {
  periodIndex: number;
  periodLabel: string;
  periodStartDate: string;
  dataSource: "IST" | "FORECAST";
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

export interface ForecastMeta {
  scenarioId: string;
  scenarioName: string;
  periodType: string;
  periodCount: number;
  openingBalanceCents: string;
  openingBalanceSource: string;
  creditLineCents: string;
  creditLineSource: string;
  reservesTotalCents: string;
  istPeriodCount: number;
  forecastPeriodCount: number;
  generatedAt: string;
}

export interface ForecastData {
  periods: ForecastPeriodJSON[];
  summary: {
    totalInflowsCents: string;
    totalOutflowsCents: string;
    finalClosingBalanceCents: string;
    minHeadroomCents: string;
    minHeadroomPeriodIndex: number;
  };
  warnings: string[];
  meta: ForecastMeta;
}

export interface AssumptionJSON {
  id: string;
  scenarioId: string;
  caseId: string;
  categoryKey: string;
  categoryLabel: string;
  flowType: string;
  assumptionType: string;
  baseAmountCents: string;
  baseAmountSource: string;
  baseAmountNote: string | null;
  growthFactorPercent: number | null;
  seasonalProfile: string | null;
  startPeriodIndex: number;
  endPeriodIndex: number;
  isActive: boolean;
  sortOrder: number;
}

// ============================================================================
// Helpers
// ============================================================================

export function formatEUR(cents: string | number): string {
  const value = typeof cents === "string" ? Number(cents) : cents;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export function formatEURInput(cents: string | number): string {
  const value = typeof cents === "string" ? Number(cents) : cents;
  return (value / 100).toFixed(2).replace(".", ",");
}

export function parseCentsFromEUR(eurString: string): string {
  const cleaned = eurString.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const value = parseFloat(cleaned);
  if (isNaN(value)) return "0";
  return String(Math.round(value * 100));
}

export function cn(...classes: (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export const ASSUMPTION_TYPE_LABELS: Record<string, string> = {
  RUN_RATE: "Laufend",
  FIXED: "Fixbetrag",
  ONE_TIME: "Einmalig",
  PERCENTAGE_OF_REVENUE: "% der Einnahmen",
};

export const ASSUMPTION_TYPE_COLORS: Record<string, string> = {
  RUN_RATE: "bg-blue-100 text-blue-800 border-blue-300",
  FIXED: "bg-green-100 text-green-800 border-green-300",
  ONE_TIME: "bg-amber-100 text-amber-800 border-amber-300",
  PERCENTAGE_OF_REVENUE: "bg-purple-100 text-purple-800 border-purple-300",
};
