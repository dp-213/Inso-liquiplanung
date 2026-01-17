/**
 * Default Case Dashboard Configuration
 *
 * This module provides default configuration values for case dashboards.
 * These defaults are used when no custom configuration exists.
 *
 * @module lib/case-dashboard/defaults
 * @version 1.0.0
 */

import {
  CaseDashboardConfig,
  CategoryVisibilityConfig,
  CategoryOrderConfig,
  ViewVariantsConfig,
  AggregationConfig,
  StylingConfig,
  ChartConfig,
  TableConfig,
  KPIConfig,
  KPIType,
  ChartType,
  PDFTextConfig,
} from './types';

import {
  INFLOW_CATEGORIES,
  OUTFLOW_CATEGORIES,
  INFLOW_CATEGORY_LABELS,
  OUTFLOW_CATEGORY_LABELS,
} from '@/lib/ai-preprocessing/insolvency-categories';

// =============================================================================
// SCHEMA VERSION
// =============================================================================

/**
 * Current schema version - increment when making breaking changes
 */
export const CURRENT_SCHEMA_VERSION = 1;

// =============================================================================
// DEFAULT CATEGORY LISTS
// =============================================================================

/**
 * All available inflow category IDs
 */
export const ALL_INFLOW_CATEGORIES = Object.keys(INFLOW_CATEGORIES);

/**
 * All available outflow category IDs
 */
export const ALL_OUTFLOW_CATEGORIES = Object.keys(OUTFLOW_CATEGORIES);

/**
 * Default category visibility (all categories visible)
 */
export const DEFAULT_VISIBLE_CATEGORIES: CategoryVisibilityConfig = {
  inflows: [...ALL_INFLOW_CATEGORIES],
  outflows: [...ALL_OUTFLOW_CATEGORIES],
};

/**
 * Default category order (standard order from insolvency-categories)
 */
export const DEFAULT_CATEGORY_ORDER: CategoryOrderConfig = {
  inflows: [...ALL_INFLOW_CATEGORIES],
  outflows: [...ALL_OUTFLOW_CATEGORIES],
};

/**
 * Default category labels (use standard labels from insolvency-categories)
 */
export const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
  ...INFLOW_CATEGORY_LABELS,
  ...OUTFLOW_CATEGORY_LABELS,
};

// =============================================================================
// DEFAULT VIEW VARIANTS
// =============================================================================

/**
 * Default view variant configuration
 */
export const DEFAULT_VIEW_VARIANTS: ViewVariantsConfig = {
  internal: {
    enabled: true,
    config: {
      showLineItems: true,
      showEstateTypes: true,
      showDataSources: true,
      showUncertaintyIndicators: true,
    },
  },
  external: {
    enabled: true,
    config: {
      showLineItems: false,
      showEstateTypes: false,
      showDataSources: false,
      showUncertaintyIndicators: false,
    },
  },
};

// =============================================================================
// DEFAULT AGGREGATION
// =============================================================================

/**
 * Default aggregation settings
 */
export const DEFAULT_AGGREGATIONS: AggregationConfig = {
  groupBy: 'week',
  showSubtotals: true,
  showRunningBalance: true,
  showEstateSubtotals: false,
};

// =============================================================================
// DEFAULT STYLING
// =============================================================================

/**
 * Default styling (no custom styling)
 */
export const DEFAULT_STYLING: StylingConfig = {
  primaryColor: undefined,
  accentColor: undefined,
  logoUrl: undefined,
  firmName: undefined,
  footerText: undefined,
};

// =============================================================================
// DEFAULT CHARTS
// =============================================================================

/**
 * All available chart types
 */
export const ALL_CHART_TYPES: ChartType[] = [
  'balance_line',
  'cashflow_bar',
  'inflow_outflow_stacked',
  'estate_comparison',
];

/**
 * Default chart configuration
 */
export const DEFAULT_CHARTS: ChartConfig = {
  visibleCharts: ['balance_line', 'cashflow_bar'],
  defaultChart: 'balance_line',
  showLegend: true,
  showDataLabels: false,
};

// =============================================================================
// DEFAULT TABLE
// =============================================================================

/**
 * Default table configuration
 */
export const DEFAULT_TABLE: TableConfig = {
  showWeekNumbers: true,
  showDateRanges: false,
  highlightNegative: true,
  compactMode: false,
  freezeFirstColumn: true,
};

// =============================================================================
// DEFAULT KPIS
// =============================================================================

/**
 * All available KPI types
 */
export const ALL_KPI_TYPES: KPIType[] = [
  'opening_balance',
  'closing_balance',
  'total_inflows',
  'total_outflows',
  'net_change',
  'min_balance',
  'min_balance_week',
  'negative_weeks_count',
];

/**
 * Default KPI configuration
 */
export const DEFAULT_KPIS: KPIConfig = {
  visibleKPIs: [
    'opening_balance',
    'closing_balance',
    'total_inflows',
    'total_outflows',
    'net_change',
    'min_balance',
  ],
  kpiOrder: [
    'opening_balance',
    'total_inflows',
    'total_outflows',
    'net_change',
    'closing_balance',
    'min_balance',
  ],
  showTrends: true,
};

// =============================================================================
// DEFAULT PDF TEXTS
// =============================================================================

/**
 * Default PDF text configuration
 * Placeholders: {{debtorName}}, {{caseNumber}}, {{planStartDate}}, {{administrator}}
 */
export const DEFAULT_PDF_TEXTS: PDFTextConfig = {
  legalDisclaimers: [
    "Die vorliegende Liquiditätsplanung wurde mit der gebotenen Sorgfalt auf Basis der vom Auftraggeber zur Verfügung gestellten Informationen und Unterlagen erstellt.",
    "",
    "Folgende Punkte sind zu beachten:",
    "",
    "1. Prognosecharakter",
    "   Die Liquiditätsplanung stellt eine in die Zukunft gerichtete Prognose dar. Die tatsächliche Entwicklung kann aufgrund von Unsicherheiten und externen Faktoren von den dargestellten Planwerten abweichen.",
    "",
    "2. Datengrundlage",
    "   Die Planung basiert auf den zum Erstellungszeitpunkt verfügbaren Informationen. Für die Richtigkeit und Vollständigkeit der Ausgangsdaten ist der Auftraggeber verantwortlich.",
    "",
    "3. Keine Prüfung",
    "   Es wurde keine prüferische Durchsicht oder Prüfung im Sinne der IDW-Standards durchgeführt. Die Plausibilisierung der Angaben erfolgte auf Basis der übermittelten Informationen.",
    "",
    "4. Verwendungszweck",
    "   Die Liquiditätsplanung dient ausschließlich der Unterstützung des Insolvenzverfahrens und ist nicht zur Weitergabe an Dritte ohne Zustimmung des Erstellers bestimmt.",
    "",
    "5. Keine Gewährleistung",
    "   Eine Gewährleistung für den Eintritt der dargestellten Planwerte wird nicht übernommen. Die Haftung ist auf Vorsatz und grobe Fahrlässigkeit beschränkt.",
  ],
  dataSources: [
    "Bankstand vom {{planStartDate}} (Buchungsschluss)",
    "Offene-Posten-Listen (Debitoren und Kreditoren)",
    "Unternehmensplanung und betriebswirtschaftliche Auswertungen",
  ],
  liquidityPlanningContext: [
    "Die Liquiditätsplanung ist ein zentrales Instrument zur Steuerung und Überwachung der Zahlungsfähigkeit im Insolvenzverfahren. Sie ermöglicht eine vorausschauende Beurteilung der finanziellen Situation und unterstützt den Insolvenzverwalter bei strategischen Entscheidungen.",
    "",
    "Aufbau der Planung",
    "",
    "Die Liquiditätsplanung unterscheidet zwischen:",
    "",
    "• Operative Zahlungsströme",
    "  Einzahlungen und Auszahlungen aus dem laufenden Geschäftsbetrieb, unabhängig von insolvenzspezifischen Effekten.",
    "",
    "• Insolvenzspezifische Effekte",
    "  Zahlungsströme, die unmittelbar aus dem Insolvenzverfahren resultieren, wie z.B. Anfechtungserlöse, Halteprämien oder Verfahrenskosten.",
    "",
    "Diese Trennung ermöglicht eine differenzierte Betrachtung und erleichtert die Beurteilung der operativen Leistungsfähigkeit des Unternehmens.",
  ],
  declarationText: [
    "Hiermit bestätigen wir, dass die in dieser Liquiditätsplanung verwendeten Daten und Informationen nach bestem Wissen und Gewissen vollständig und zutreffend sind.",
    "",
    "Die Planung basiert auf den folgenden Grundlagen:",
    "",
    "• Bankguthaben zum Stichtag {{planStartDate}}",
    "• Offene-Posten-Listen (Debitoren und Kreditoren) zum Stichtag",
    "• Unternehmensplanung und interne Forecasts",
    "• Insolvenzspezifische Planungsannahmen und Schätzungen",
    "",
    "Die Verantwortung für die Richtigkeit und Vollständigkeit der Ausgangsdaten liegt beim Auftraggeber.",
  ],
  confidentialityNotice: "Dieses Dokument enthält vertrauliche Informationen und ist ausschließlich für den Adressaten bestimmt. Eine Weitergabe an Dritte bedarf der schriftlichen Zustimmung.",
  pdfFooterText: "Gradify",
};

// =============================================================================
// COMPLETE DEFAULT CONFIGURATION
// =============================================================================

/**
 * Creates a complete default configuration
 */
export function createDefaultConfig(userId: string = 'system'): CaseDashboardConfig {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    visibleCategories: { ...DEFAULT_VISIBLE_CATEGORIES },
    categoryLabels: { ...DEFAULT_CATEGORY_LABELS },
    categoryOrder: { ...DEFAULT_CATEGORY_ORDER },
    emphasizedCategories: [],
    viewVariants: JSON.parse(JSON.stringify(DEFAULT_VIEW_VARIANTS)),
    aggregations: { ...DEFAULT_AGGREGATIONS },
    styling: { ...DEFAULT_STYLING },
    charts: { ...DEFAULT_CHARTS },
    table: { ...DEFAULT_TABLE },
    kpis: { ...DEFAULT_KPIS },
    pdfTexts: { ...DEFAULT_PDF_TEXTS },
    metadata: {
      lastUpdated: new Date().toISOString(),
      lastUpdatedBy: userId,
      notes: undefined,
    },
  };
}

// =============================================================================
// CONFIGURATION MERGING UTILITIES
// =============================================================================

/**
 * Deep merge two plain objects, with source taking precedence
 */
function deepMergeObjects(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        sourceValue !== undefined &&
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMergeObjects(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue;
      }
    }
  }

  return result;
}

/**
 * Merge a partial configuration with defaults
 */
export function mergeWithDefaults(
  partial: Partial<CaseDashboardConfig>,
  userId: string = 'system'
): CaseDashboardConfig {
  const defaults = createDefaultConfig(userId);
  const merged = deepMergeObjects(
    defaults as unknown as Record<string, unknown>,
    partial as unknown as Record<string, unknown>
  );
  return merged as unknown as CaseDashboardConfig;
}

/**
 * Merge code configuration overrides with existing configuration
 */
export function mergeCodeConfig(
  baseConfig: CaseDashboardConfig,
  codeOverrides: Partial<CaseDashboardConfig>
): CaseDashboardConfig {
  const overridesWithMeta = {
    ...codeOverrides,
    metadata: {
      ...baseConfig.metadata,
      lastUpdated: new Date().toISOString(),
      notes: baseConfig.metadata.notes
        ? `${baseConfig.metadata.notes} (with code overrides)`
        : '(with code overrides)',
    },
  };
  const merged = deepMergeObjects(
    baseConfig as unknown as Record<string, unknown>,
    overridesWithMeta as unknown as Record<string, unknown>
  );
  return merged as unknown as CaseDashboardConfig;
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Ensure all category IDs in config are valid
 */
export function validateCategoryIds(config: CaseDashboardConfig): string[] {
  const errors: string[] = [];
  const allCategories = new Set([...ALL_INFLOW_CATEGORIES, ...ALL_OUTFLOW_CATEGORIES]);

  // Check visible categories
  for (const catId of config.visibleCategories.inflows) {
    if (!allCategories.has(catId)) {
      errors.push(`Invalid inflow category ID in visibleCategories: ${catId}`);
    }
  }
  for (const catId of config.visibleCategories.outflows) {
    if (!allCategories.has(catId)) {
      errors.push(`Invalid outflow category ID in visibleCategories: ${catId}`);
    }
  }

  // Check category order
  for (const catId of config.categoryOrder.inflows) {
    if (!allCategories.has(catId)) {
      errors.push(`Invalid inflow category ID in categoryOrder: ${catId}`);
    }
  }
  for (const catId of config.categoryOrder.outflows) {
    if (!allCategories.has(catId)) {
      errors.push(`Invalid outflow category ID in categoryOrder: ${catId}`);
    }
  }

  // Check emphasized categories
  for (const catId of config.emphasizedCategories) {
    if (!allCategories.has(catId)) {
      errors.push(`Invalid category ID in emphasizedCategories: ${catId}`);
    }
  }

  return errors;
}

/**
 * Migrate config from older schema version if needed
 */
export function migrateConfig(config: CaseDashboardConfig): CaseDashboardConfig {
  // Currently at version 1, no migrations needed yet
  // When schema changes, add migration logic here
  if (config.schemaVersion < CURRENT_SCHEMA_VERSION) {
    // Future: Add migration steps for each version
    config = {
      ...config,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
  }
  return config;
}

// =============================================================================
// DISPLAY HELPERS
// =============================================================================

/**
 * Get display label for a category
 */
export function getCategoryDisplayLabel(
  categoryId: string,
  config: CaseDashboardConfig
): string {
  // First check custom labels
  if (config.categoryLabels[categoryId]) {
    return config.categoryLabels[categoryId];
  }
  // Fall back to default labels
  if (DEFAULT_CATEGORY_LABELS[categoryId]) {
    return DEFAULT_CATEGORY_LABELS[categoryId];
  }
  // Last resort: return the ID
  return categoryId;
}

/**
 * Get ordered, visible categories for a flow type
 */
export function getOrderedVisibleCategories(
  flowType: 'INFLOW' | 'OUTFLOW',
  config: CaseDashboardConfig
): string[] {
  const visible = flowType === 'INFLOW'
    ? config.visibleCategories.inflows
    : config.visibleCategories.outflows;

  const order = flowType === 'INFLOW'
    ? config.categoryOrder.inflows
    : config.categoryOrder.outflows;

  // Return categories in order, filtered to only visible ones
  const visibleSet = new Set(visible);
  return order.filter((catId) => visibleSet.has(catId));
}

/**
 * KPI type labels in German
 */
export const KPI_TYPE_LABELS: Record<KPIType, string> = {
  opening_balance: 'Anfangssaldo',
  closing_balance: 'Endsaldo',
  total_inflows: 'Gesamteinnahmen',
  total_outflows: 'Gesamtausgaben',
  net_change: 'Nettoveränderung',
  min_balance: 'Minimalsaldo',
  min_balance_week: 'Woche mit Minimalsaldo',
  negative_weeks_count: 'Wochen mit negativem Saldo',
};

/**
 * Chart type labels in German
 */
export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  balance_line: 'Saldenentwicklung (Linie)',
  cashflow_bar: 'Netto-Cashflow (Balken)',
  inflow_outflow_stacked: 'Ein-/Auszahlungen (gestapelt)',
  estate_comparison: 'Alt- vs. Neumasse',
};
