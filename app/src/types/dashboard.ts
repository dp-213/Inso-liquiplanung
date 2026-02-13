// Unified Dashboard Types
// Einheitliche Datenstruktur für alle Dashboard-Ansichten

// =============================================================================
// Core Data Types
// =============================================================================

export interface CaseInfo {
  id?: string;
  caseNumber: string;
  debtorName: string;
  courtName: string;
  status: string;
  filingDate: string;
  openingDate: string | null;
}

export interface PlanInfo {
  name: string;
  planStartDate: string;
  periodType: PeriodType;
  periodCount: number;
  versionNumber: number;
  versionDate: string | null;
}

export type PeriodType = "WEEKLY" | "MONTHLY";

export interface PeriodData {
  periodIndex: number;
  periodLabel: string;
  periodStartDate?: string;
  periodEndDate?: string;
  openingBalanceCents: string;
  totalInflowsCents: string;
  totalOutflowsCents: string;
  netCashflowCents: string;
  closingBalanceCents: string;
  // Legacy aliases
  weekOffset?: number;
  weekLabel?: string;
}

export interface CategoryData {
  categoryName: string;
  flowType: "INFLOW" | "OUTFLOW" | string;
  estateType: "ALTMASSE" | "NEUMASSE" | string;
  totalCents: string;
  periodTotals: string[];
  weeklyTotals: string[]; // Legacy alias - always present for backwards compatibility
  lines: LineData[];
}

export interface LineData {
  lineName: string;
  totalCents: string;
  periodValues: {
    periodIndex: number;
    effectiveCents: string;
  }[];
  weeklyValues: {
    weekOffset: number;
    effectiveCents: string;
  }[]; // Legacy alias - always present for backwards compatibility
}

export interface CalculationResult {
  openingBalanceCents: string;
  totalInflowsCents: string;
  totalOutflowsCents: string;
  totalNetCashflowCents: string;
  finalClosingBalanceCents: string;
  dataHash: string;
  calculatedAt: string;
  periodType: PeriodType;
  periodCount: number;
  periods: PeriodData[];
  weeks: PeriodData[]; // Legacy alias - always present for backwards compatibility
  categories: CategoryData[];
}

export interface BankAccountInfo {
  id: string;
  bankName: string;
  accountName: string;
  iban: string | null;
  openingBalanceCents: string;
  currentBalanceCents: string;
  securityHolder: string | null;
  accountType: string; // "ISK" | "GESCHAEFT" | "DARLEHEN"
  status: string;
  notes: string | null;
}

export interface BankAccountsSummary {
  accounts: BankAccountInfo[];
  summary: {
    totalBalanceCents: string;
    totalAvailableCents: string;
    accountCount: number;
    iskBalanceCents: string;
    iskAccountCount: number;
  };
}

export interface AssumptionInfo {
  id: string;
  title: string;
  source: string;
  description: string;
  status: string;
  linkedModule: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InsolvencyEffectPeriod {
  id: string;
  periodIndex: number;
  amountCents: string;
}

export interface InsolvencyEffectInfo {
  name: string;
  description: string | null;
  effectType: "INFLOW" | "OUTFLOW";
  effectGroup: string;
  periods: InsolvencyEffectPeriod[];
}

export interface InsolvencyEffectsData {
  effects: InsolvencyEffectInfo[];
  rawEffects?: {
    id: string;
    name: string;
    description: string | null;
    effectType: string;
    effectGroup: string;
    periodIndex: number;
    amountCents: string;
    isActive: boolean;
  }[];
}

export interface LedgerStats {
  dataSource: "LEDGER" | "LEGACY";
  entryCount: number;
  istCount: number;
  planCount: number;
  confirmedCount: number;
  unreviewedCount: number;
  masseCount: number;
  absonderungCount: number;
}

export interface EstateAllocationData {
  totalAltmasseInflowsCents: string;
  totalAltmasseOutflowsCents: string;
  totalNeumasseInflowsCents: string;
  totalNeumasseOutflowsCents: string;
  totalUnklarInflowsCents: string;
  totalUnklarOutflowsCents: string;
  unklarCount: number;
  warnings: {
    type: string;
    severity: string;
    message: string;
    count: number;
    totalCents: string;
  }[];
}

// =============================================================================
// Massekredit Summary (für bereinigte Liquidität)
// =============================================================================

export interface MassekreditSummaryData {
  hasBankAgreements: boolean;
  altforderungenBruttoCents: string;
  fortfuehrungsbeitragCents: string;
  fortfuehrungsbeitragUstCents: string;
  /** Was die Banken zurückbekommen = brutto - beitrag - ust */
  massekreditAltforderungenCents: string;
  hasUncertainBanks: boolean;
  /** End-Liquidität MINUS Bankforderungen */
  bereinigteEndLiquiditaetCents: string;
}

// =============================================================================
// Dashboard Data Structure
// =============================================================================

export interface CaseDashboardData {
  case: CaseInfo;
  administrator: string;
  plan: PlanInfo;
  calculation: CalculationResult;
  bankAccounts?: BankAccountsSummary;
  assumptions?: AssumptionInfo[];
  insolvencyEffects?: InsolvencyEffectsData;
  ledgerStats?: LedgerStats;
  estateAllocation?: EstateAllocationData;
  massekreditSummary?: MassekreditSummaryData;
}

// =============================================================================
// Access Control
// =============================================================================

export type AccessMode = "admin" | "customer" | "external";

export interface DashboardCapabilities {
  canEdit: boolean;
  canExport: boolean;
  canShare: boolean;
  canViewLedgerDetails: boolean;
  canManageAssumptions: boolean;
  canManageEffects: boolean;
}

export function getCapabilitiesForAccessMode(mode: AccessMode): DashboardCapabilities {
  switch (mode) {
    case "admin":
      return {
        canEdit: true,
        canExport: true,
        canShare: true,
        canViewLedgerDetails: true,
        canManageAssumptions: true,
        canManageEffects: true,
      };
    case "customer":
      return {
        canEdit: false,
        canExport: true,
        canShare: false,
        canViewLedgerDetails: false,
        canManageAssumptions: false,
        canManageEffects: false,
      };
    case "external":
      return {
        canEdit: false,
        canExport: true,
        canShare: false,
        canViewLedgerDetails: false,
        canManageAssumptions: false,
        canManageEffects: false,
      };
  }
}

// =============================================================================
// Panel Configuration
// =============================================================================

export type PanelType =
  | "kpi"
  | "data-source"
  | "balance-chart"
  | "liquidity-table"
  | "revenue-sources"
  | "revenue-categories"
  | "revenue-chart"
  | "bank-accounts"
  | "security-rights"
  | "settlement-progress"
  | "estate-summary"
  | "estate-comparison"
  | "estate-details"
  | "waterfall"
  | "insolvency-effects"
  | "assumptions"
  | "ist-plan-compare"
  | "version-info"
  | "massekredit-overview"
  | "massekredit-per-bank";

export interface PanelConfig {
  type: PanelType;
  visible: boolean;
  order: number;
}

export interface TabConfig {
  id: string;
  label: string;
  icon: string;
  panels: PanelConfig[];
}

export interface DashboardConfig {
  tabs: TabConfig[];
}

// Default Dashboard Configuration
export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  tabs: [
    {
      id: "overview",
      label: "Übersicht",
      icon: "chart",
      panels: [
        { type: "kpi", visible: true, order: 1 },
        { type: "data-source", visible: true, order: 2 },
        { type: "balance-chart", visible: true, order: 3 },
        { type: "liquidity-table", visible: true, order: 4 },
      ],
    },
    {
      id: "liquidity-matrix",
      label: "Liquiditätstabelle",
      icon: "table",
      panels: [],
    },
    {
      id: "banks-security",
      label: "Finanzierung & Banken",
      icon: "bank",
      panels: [
        { type: "bank-accounts", visible: true, order: 1 },
        { type: "security-rights", visible: true, order: 2 },
        { type: "massekredit-overview", visible: true, order: 3 },
        { type: "massekredit-per-bank", visible: true, order: 4 },
      ],
    },
    {
      id: "revenue",
      label: "Einnahmen",
      icon: "money",
      panels: [
        { type: "revenue-sources", visible: true, order: 1 },
        { type: "revenue-categories", visible: true, order: 2 },
        { type: "revenue-chart", visible: true, order: 3 },
      ],
    },
    {
      id: "estate",
      label: "Masseübersicht",
      icon: "folder",
      panels: [
        { type: "estate-summary", visible: true, order: 1 },
        { type: "estate-comparison", visible: true, order: 2 },
        { type: "estate-details", visible: true, order: 3 },
      ],
    },
    {
      id: "locations",
      label: "Standorte",
      icon: "location",
      panels: [],
    },
    {
      id: "insolvency",
      label: "Insolvenzeffekte",
      icon: "alert",
      panels: [
        { type: "insolvency-effects", visible: true, order: 1 },
      ],
    },
    {
      id: "assumptions",
      label: "Berechnungsannahmen",
      icon: "document",
      panels: [
        { type: "assumptions", visible: true, order: 1 },
      ],
    },
    {
      id: "compare",
      label: "Vergleich",
      icon: "compare",
      panels: [
        { type: "ist-plan-compare", visible: true, order: 1 },
        { type: "version-info", visible: true, order: 2 },
      ],
    },
    {
      id: "business-logik",
      label: "Business-Logik",
      icon: "lightbulb",
      panels: [],
    },
  ],
};

// =============================================================================
// Utility Types and Functions
// =============================================================================

export interface DashboardProps {
  data: CaseDashboardData;
  accessMode: AccessMode;
  capabilities?: DashboardCapabilities;
  config?: DashboardConfig;
}

// Helper to get periods (handles legacy 'weeks' field)
export function getPeriods(data: CaseDashboardData): PeriodData[] {
  return data.calculation.periods || data.calculation.weeks || [];
}

// Helper to format currency
export function formatCurrency(cents: bigint | string): string {
  const value = typeof cents === "string" ? BigInt(cents) : cents;
  const euros = Number(value) / 100;
  return euros.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// Helper to get status label
export function getStatusLabel(status: string): string {
  switch (status) {
    case "PRELIMINARY":
      return "Vorläufiges Verfahren";
    case "OPENED":
      return "Eröffnetes Verfahren";
    case "CLOSED":
      return "Geschlossen";
    default:
      return status;
  }
}

// Helper to get plan title
export function getPlanTitle(data: CaseDashboardData): string {
  const periodType = data.calculation.periodType || data.plan.periodType || "WEEKLY";
  const periodCount = data.calculation.periodCount || data.plan.periodCount || 13;
  return periodType === "MONTHLY"
    ? `${periodCount}-Monats-Planung`
    : `${periodCount}-Wochen-Planung`;
}

// Helper to get period label range
export function getPeriodLabelRange(data: CaseDashboardData): string {
  const periods = getPeriods(data);
  if (periods.length === 0) return "";
  const firstLabel = periods[0].periodLabel || periods[0].weekLabel || "";
  const lastLabel = periods[periods.length - 1].periodLabel || periods[periods.length - 1].weekLabel || "";
  return `${firstLabel} - ${lastLabel}`;
}
