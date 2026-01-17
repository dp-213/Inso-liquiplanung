/**
 * Case Dashboard Configuration Types
 *
 * This module defines all TypeScript interfaces for case-specific dashboard configuration.
 * These types govern the presentation layer ONLY - no calculation logic is defined here.
 *
 * Architecture principle: Configuration affects DISPLAY, never calculations.
 *
 * @module lib/case-dashboard/types
 * @version 1.0.0
 */

import { z } from 'zod';

// =============================================================================
// CONFIGURATION TYPE ENUM
// =============================================================================

/**
 * Configuration types stored in CaseConfiguration.configType
 */
export const CONFIG_TYPES = {
  DASHBOARD_CONFIG: 'DASHBOARD_CONFIG',
  // Future: ROW_VISIBILITY, ROW_ORDER, GROUPING, CHART_SETTINGS can be separate
} as const;

export type ConfigType = typeof CONFIG_TYPES[keyof typeof CONFIG_TYPES];

// =============================================================================
// CATEGORY VISIBILITY CONFIGURATION
// =============================================================================

/**
 * Controls which categories are visible in the dashboard
 * Category IDs reference the standard insolvency categories
 */
export interface CategoryVisibilityConfig {
  /** Category IDs to show in inflows section */
  inflows: string[];
  /** Category IDs to show in outflows section */
  outflows: string[];
}

// =============================================================================
// CATEGORY ORDERING CONFIGURATION
// =============================================================================

/**
 * Controls the display order of categories
 * Order is determined by array position (index 0 = first displayed)
 */
export interface CategoryOrderConfig {
  /** Ordered category IDs for inflows section */
  inflows: string[];
  /** Ordered category IDs for outflows section */
  outflows: string[];
}

// =============================================================================
// VIEW VARIANT CONFIGURATION
// =============================================================================

/**
 * Configuration for a specific view variant (internal/external)
 */
export interface ViewVariantConfig {
  /** Whether this view variant is enabled */
  enabled: boolean;
  /** View-specific settings */
  config: {
    /** Show detailed line items under categories */
    showLineItems?: boolean;
    /** Show estate type labels (Alt/Neu) */
    showEstateTypes?: boolean;
    /** Show data source indicators */
    showDataSources?: boolean;
    /** Show uncertainty indicators */
    showUncertaintyIndicators?: boolean;
    /** Custom title override */
    titleOverride?: string;
    /** Custom subtitle override */
    subtitleOverride?: string;
  };
}

/**
 * View variants configuration
 */
export interface ViewVariantsConfig {
  /** Configuration for internal (admin) view */
  internal: ViewVariantConfig;
  /** Configuration for external (share link) view */
  external: ViewVariantConfig;
}

// =============================================================================
// AGGREGATION CONFIGURATION
// =============================================================================

/**
 * Time aggregation granularity
 */
export type AggregationGroupBy = 'week' | 'month';

/**
 * Controls how data is aggregated for display
 */
export interface AggregationConfig {
  /** Time grouping (week is standard, month for summary views) */
  groupBy: AggregationGroupBy;
  /** Show subtotals for each category */
  showSubtotals: boolean;
  /** Show running balance row */
  showRunningBalance: boolean;
  /** Show estate type subtotals (Altmasse/Neumasse) */
  showEstateSubtotals: boolean;
}

// =============================================================================
// STYLING CONFIGURATION
// =============================================================================

/**
 * Custom styling options for the dashboard
 * Affects presentation only, not data
 */
export interface StylingConfig {
  /** Primary accent color (hex format) */
  primaryColor?: string;
  /** Secondary accent color (hex format) */
  accentColor?: string;
  /** Logo URL for external views */
  logoUrl?: string;
  /** Company/firm name display */
  firmName?: string;
  /** Custom footer text */
  footerText?: string;
}

// =============================================================================
// PDF TEXT CONFIGURATION
// =============================================================================

/**
 * Configurable texts for PDF export
 * All texts support placeholders like {{debtorName}}, {{caseNumber}}, {{planStartDate}}
 */
export interface PDFTextConfig {
  /** Legal disclaimers (Vorbemerkungen) - shown on page 2 */
  legalDisclaimers: string[];
  /** Data sources description */
  dataSources: string[];
  /** Context text about liquidity planning (Vorbemerkungen zur Liquiditätsplanung) */
  liquidityPlanningContext: string[];
  /** Declaration text (Vollständigkeitserklärung) */
  declarationText: string[];
  /** Confidentiality notice on title page */
  confidentialityNotice: string;
  /** Footer text for all pages */
  pdfFooterText: string;
}

// =============================================================================
// CHART CONFIGURATION
// =============================================================================

/**
 * Available chart types
 */
export type ChartType = 'balance_line' | 'cashflow_bar' | 'inflow_outflow_stacked' | 'estate_comparison';

/**
 * Chart visibility and configuration
 */
export interface ChartConfig {
  /** Which charts to display */
  visibleCharts: ChartType[];
  /** Default chart to show first */
  defaultChart: ChartType;
  /** Show chart legends */
  showLegend: boolean;
  /** Show data labels on chart */
  showDataLabels: boolean;
}

// =============================================================================
// TABLE CONFIGURATION
// =============================================================================

/**
 * Table display options
 */
export interface TableConfig {
  /** Show week numbers in headers */
  showWeekNumbers: boolean;
  /** Show date ranges in headers */
  showDateRanges: boolean;
  /** Highlight negative values */
  highlightNegative: boolean;
  /** Compact mode (smaller fonts, tighter spacing) */
  compactMode: boolean;
  /** Freeze first column on horizontal scroll */
  freezeFirstColumn: boolean;
}

// =============================================================================
// KPI CONFIGURATION
// =============================================================================

/**
 * Available KPI types
 */
export type KPIType =
  | 'opening_balance'
  | 'closing_balance'
  | 'total_inflows'
  | 'total_outflows'
  | 'net_change'
  | 'min_balance'
  | 'min_balance_week'
  | 'negative_weeks_count';

/**
 * KPI display configuration
 */
export interface KPIConfig {
  /** Which KPIs to display */
  visibleKPIs: KPIType[];
  /** Order of KPIs (by array position) */
  kpiOrder: KPIType[];
  /** Show trend indicators */
  showTrends: boolean;
}

// =============================================================================
// COMPLETE DASHBOARD CONFIGURATION
// =============================================================================

/**
 * Complete case dashboard configuration
 * This is stored as JSON in CaseConfiguration.configData
 */
export interface CaseDashboardConfig {
  /** Schema version for migration support */
  schemaVersion: number;

  /** Category visibility settings */
  visibleCategories: CategoryVisibilityConfig;

  /** Custom labels for categories (categoryId -> label) */
  categoryLabels: Record<string, string>;

  /** Category display order */
  categoryOrder: CategoryOrderConfig;

  /** Categories to emphasize/highlight */
  emphasizedCategories: string[];

  /** View variant configurations */
  viewVariants: ViewVariantsConfig;

  /** Data aggregation settings */
  aggregations: AggregationConfig;

  /** Custom styling */
  styling: StylingConfig;

  /** Chart configuration */
  charts: ChartConfig;

  /** Table configuration */
  table: TableConfig;

  /** KPI configuration */
  kpis: KPIConfig;

  /** PDF text configuration */
  pdfTexts: PDFTextConfig;

  /** Metadata */
  metadata: {
    /** When this config was last updated */
    lastUpdated: string;
    /** Who last updated this config */
    lastUpdatedBy: string;
    /** Optional notes about this configuration */
    notes?: string;
  };
}

// =============================================================================
// CASE-SPECIFIC CODE CONFIGURATION
// =============================================================================

/**
 * Configuration exported from case-specific code files
 * This can override UI-based configuration
 */
export interface CaseCodeConfig {
  /** Unique identifier for the case (must match case ID) */
  caseId: string;
  /** Display name for admin reference */
  displayName: string;
  /** Version of this code configuration */
  version: string;
  /** Description of customizations */
  description?: string;
  /** Partial config overrides - merged with UI config */
  configOverrides?: Partial<CaseDashboardConfig>;
  /** Whether to completely replace UI config instead of merge */
  replaceUIConfig?: boolean;
}

// =============================================================================
// DASHBOARD COMPONENT PROPS
// =============================================================================

/**
 * Props passed to dashboard components
 */
export interface DashboardProps {
  /** Case ID */
  caseId: string;
  /** Resolved configuration (UI + code merged) */
  config: CaseDashboardConfig;
  /** Calculation data from core engine */
  calculationData: DashboardCalculationData;
  /** View mode */
  viewMode: 'internal' | 'external';
  /** Whether in preview mode */
  isPreview?: boolean;
}

/**
 * Calculation data shaped for dashboard consumption
 * This comes from the core engine, NOT from configuration
 */
export interface DashboardCalculationData {
  /** Case metadata */
  caseInfo: {
    caseId: string;
    caseNumber: string;
    debtorName: string;
    courtName: string;
    planStartDate: string;
  };
  /** KPI values */
  kpis: {
    openingBalanceCents: bigint;
    closingBalanceCents: bigint;
    totalInflowsCents: bigint;
    totalOutflowsCents: bigint;
    netChangeCents: bigint;
    minBalanceCents: bigint;
    minBalanceWeek: number;
    negativeWeeksCount: number;
  };
  /** Weekly calculation results */
  weeks: Array<{
    weekOffset: number;
    weekLabel: string;
    weekStartDate: string;
    weekEndDate: string;
    openingBalanceCents: bigint;
    closingBalanceCents: bigint;
    totalInflowsCents: bigint;
    totalOutflowsCents: bigint;
    netCashflowCents: bigint;
    inflowsAltmasseCents: bigint;
    inflowsNeumasseCents: bigint;
    outflowsAltmasseCents: bigint;
    outflowsNeumasseCents: bigint;
  }>;
  /** Category-level data */
  categories: Array<{
    categoryId: string;
    categoryName: string;
    flowType: 'INFLOW' | 'OUTFLOW';
    estateType: 'ALTMASSE' | 'NEUMASSE';
    totalCents: bigint;
    weeklyTotalsCents: bigint[];
    lines: Array<{
      lineId: string;
      lineName: string;
      totalCents: bigint;
      weeklyValuesCents: bigint[];
    }>;
  }>;
  /** Calculation metadata */
  calculationMeta: {
    calculatedAt: string;
    engineVersion: string;
    dataHash: string;
  };
}

// =============================================================================
// LOADER RESULT TYPES
// =============================================================================

/**
 * Result from dashboard loader
 */
export interface DashboardLoaderResult {
  /** Resolved configuration */
  config: CaseDashboardConfig;
  /** Whether case-specific code was used */
  usesCustomCode: boolean;
  /** Path to custom component if applicable */
  customComponentPath?: string;
  /** Source of configuration */
  configSource: 'default' | 'database' | 'code' | 'merged';
  /** Any warnings during load */
  warnings: string[];
}

// =============================================================================
// ZOD VALIDATION SCHEMAS
// =============================================================================

/**
 * Zod schema for runtime validation of dashboard config
 */
export const CaseDashboardConfigSchema = z.object({
  schemaVersion: z.number().int().positive(),

  visibleCategories: z.object({
    inflows: z.array(z.string()),
    outflows: z.array(z.string()),
  }),

  categoryLabels: z.record(z.string(), z.string()),

  categoryOrder: z.object({
    inflows: z.array(z.string()),
    outflows: z.array(z.string()),
  }),

  emphasizedCategories: z.array(z.string()),

  viewVariants: z.object({
    internal: z.object({
      enabled: z.boolean(),
      config: z.object({
        showLineItems: z.boolean().optional(),
        showEstateTypes: z.boolean().optional(),
        showDataSources: z.boolean().optional(),
        showUncertaintyIndicators: z.boolean().optional(),
        titleOverride: z.string().optional(),
        subtitleOverride: z.string().optional(),
      }),
    }),
    external: z.object({
      enabled: z.boolean(),
      config: z.object({
        showLineItems: z.boolean().optional(),
        showEstateTypes: z.boolean().optional(),
        showDataSources: z.boolean().optional(),
        showUncertaintyIndicators: z.boolean().optional(),
        titleOverride: z.string().optional(),
        subtitleOverride: z.string().optional(),
      }),
    }),
  }),

  aggregations: z.object({
    groupBy: z.enum(['week', 'month']),
    showSubtotals: z.boolean(),
    showRunningBalance: z.boolean(),
    showEstateSubtotals: z.boolean(),
  }),

  styling: z.object({
    primaryColor: z.string().optional(),
    accentColor: z.string().optional(),
    logoUrl: z.string().url().optional().or(z.literal('')),
    firmName: z.string().optional(),
    footerText: z.string().optional(),
  }),

  charts: z.object({
    visibleCharts: z.array(z.enum(['balance_line', 'cashflow_bar', 'inflow_outflow_stacked', 'estate_comparison'])),
    defaultChart: z.enum(['balance_line', 'cashflow_bar', 'inflow_outflow_stacked', 'estate_comparison']),
    showLegend: z.boolean(),
    showDataLabels: z.boolean(),
  }),

  table: z.object({
    showWeekNumbers: z.boolean(),
    showDateRanges: z.boolean(),
    highlightNegative: z.boolean(),
    compactMode: z.boolean(),
    freezeFirstColumn: z.boolean(),
  }),

  kpis: z.object({
    visibleKPIs: z.array(z.enum([
      'opening_balance',
      'closing_balance',
      'total_inflows',
      'total_outflows',
      'net_change',
      'min_balance',
      'min_balance_week',
      'negative_weeks_count',
    ])),
    kpiOrder: z.array(z.enum([
      'opening_balance',
      'closing_balance',
      'total_inflows',
      'total_outflows',
      'net_change',
      'min_balance',
      'min_balance_week',
      'negative_weeks_count',
    ])),
    showTrends: z.boolean(),
  }),

  pdfTexts: z.object({
    legalDisclaimers: z.array(z.string()),
    dataSources: z.array(z.string()),
    liquidityPlanningContext: z.array(z.string()),
    declarationText: z.array(z.string()),
    confidentialityNotice: z.string(),
    pdfFooterText: z.string(),
  }),

  metadata: z.object({
    lastUpdated: z.string(),
    lastUpdatedBy: z.string(),
    notes: z.string().optional(),
  }),
});

/**
 * Type inference from Zod schema
 */
export type ValidatedCaseDashboardConfig = z.infer<typeof CaseDashboardConfigSchema>;

/**
 * Validate a configuration object
 */
export function validateDashboardConfig(config: unknown): { valid: true; data: CaseDashboardConfig } | { valid: false; errors: z.ZodError } {
  const result = CaseDashboardConfigSchema.safeParse(config);
  if (result.success) {
    return { valid: true, data: result.data as CaseDashboardConfig };
  }
  return { valid: false, errors: result.error };
}
