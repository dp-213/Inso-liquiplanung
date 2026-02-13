/**
 * Performance-Engine (GuV-light) — Type Definitions
 *
 * Periodisierte Ergebnisrechnung pro Standort und Monat.
 * Erlöse nach Leistungsmonat (nicht Zahlungsdatum).
 * Personal aus EmployeeSalaryMonth (nicht aus Bankbuchungen).
 *
 * IST/PLAN-Vorrang pro Zeile und Monat (nicht binär pro Periode).
 */

// =============================================================================
// PERIOD
// =============================================================================

export interface PerformancePeriod {
  /** 0-basierter Index */
  index: number;
  year: number;
  /** 1-12 */
  month: number;
  /** z.B. "Okt 2025" */
  label: string;
  /** 0.0–1.0: Anteil der P&L-Zeilen mit IST-Daten */
  istCoverage: number;
}

// =============================================================================
// P&L GROUPS
// =============================================================================

/** MVP ohne VARIABLE_COST (bei Arztpraxis nicht substanziell) */
export type PnLGroup =
  | 'REVENUE'
  | 'PERSONNEL_COST'
  | 'FIXED_COST'
  | 'OTHER_COST';

// =============================================================================
// P&L LINE ITEM
// =============================================================================

export interface PnLLineItem {
  /** z.B. "revenue_hzv" */
  key: string;
  label: string;
  group: PnLGroup;
  amountCents: bigint;
  /** 0 bei Salary-Daten */
  entryCount: number;
  source: 'LEDGER' | 'SALARY';
  /** Woher kommt DIESE Zeile in DIESEM Monat? */
  valueSource: 'IST' | 'PLAN';
  periodizationMethod: 'SERVICE_PERIOD' | 'SERVICE_DATE' | 'TRANSACTION_DATE' | 'SALARY_MONTH';
  /** Anteil Altmasse (aus estateAllocation) */
  altmasseAnteilCents: bigint;
  /** Anteil Neumasse */
  neumasseAnteilCents: bigint;
}

// =============================================================================
// LOCATION MONTH RESULT
// =============================================================================

export interface LocationMonthResult {
  /** Location-ID oder 'ZENTRAL' */
  locationId: string;
  locationName: string;
  period: PerformancePeriod;
  lines: PnLLineItem[];

  // KPIs
  revenueCents: bigint;
  revenueAltmasseCents: bigint;
  revenueNeumasseCents: bigint;
  /** Aus EmployeeSalaryMonth (negativ) */
  personnelCostsCents: bigint;
  /** Miete, IT etc. (negativ) */
  fixedCostsCents: bigint;
  /** Insolvenzkosten etc. (negativ) */
  otherCostsCents: bigint;

  /** Erlöse + alle Kosten */
  contributionCents: bigint;
  /** DB / Erlöse (0 wenn keine Erlöse) */
  marginPercent: number;

  personnelHeadcount: number;
  /** 0.0–1.0: Anteil der Zeilen mit IST-Daten */
  istCoverage: number;
}

// =============================================================================
// ALLOCATION
// =============================================================================

export type AllocationMethod = 'REVENUE_SHARE' | 'HEADCOUNT_SHARE' | 'NONE';

// =============================================================================
// P&L ROW CONFIG
// =============================================================================

export interface PnLRowConfig {
  key: string;
  label: string;
  group: PnLGroup;
  /** categoryTags zum Matchen (nur für LEDGER-basierte Zeilen) */
  tags?: string[];
  /** 'SALARY' für Zeilen aus EmployeeSalaryMonth */
  source?: 'SALARY';
  /** Feld aus EmployeeSalaryMonth (z.B. 'grossSalaryCents') */
  field?: 'grossSalaryCents' | 'employerCostsCents';
}

// =============================================================================
// LOCATION SUMMARY
// =============================================================================

export interface LocationSummary {
  locationId: string;
  locationName: string;
  months: LocationMonthResult[];
  totalRevenueCents: bigint;
  totalContributionCents: bigint;
  avgMarginPercent: number;
}

export interface LocationSummaryAfterAllocation {
  locationId: string;
  locationName: string;
  months: LocationMonthResult[];
  allocatedCentralCostsCents: bigint;
  adjustedContributionCents: bigint;
  adjustedMarginPercent: number;
}

// =============================================================================
// DATA QUALITY
// =============================================================================

export interface DataQualityReport {
  totalEntries: number;
  entriesWithServicePeriod: number;
  entriesWithServiceDate: number;
  entriesWithFallbackDate: number;
  unclassifiedEntries: number;
  approximateSpreadCount: number;
  employeesWithSalaryData: number;
  employeesWithoutSalaryData: number;
  warnings: string[];
}

// =============================================================================
// PERFORMANCE RESULT
// =============================================================================

export interface PerformanceResult {
  caseId: string;
  calculatedAt: string;
  periodCount: number;
  planStartDate: string;
  periods: PerformancePeriod[];

  /** Pro Standort (roh, ohne Umlage) */
  locations: LocationSummary[];

  /** Pro Standort (nach Umlage, wenn allocationMethod != NONE) */
  locationsAfterAllocation?: LocationSummaryAfterAllocation[];

  overallIstCoverage: number;

  /** Zentraler Block (Kosten ohne Standort-Zuordnung) */
  central: {
    months: LocationMonthResult[];
    totalCostsCents: bigint;
  };

  /** Konsolidiert (alle Standorte + Zentral) */
  consolidated: LocationMonthResult[];

  allocationMethod: AllocationMethod;
  dataQuality: DataQualityReport;
}
