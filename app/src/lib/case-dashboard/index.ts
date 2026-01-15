/**
 * Case Dashboard Module
 *
 * Central export point for all case dashboard configuration functionality.
 *
 * @module lib/case-dashboard
 * @version 1.0.0
 */

// Types
export * from './types';

// Defaults
export {
  CURRENT_SCHEMA_VERSION,
  ALL_INFLOW_CATEGORIES,
  ALL_OUTFLOW_CATEGORIES,
  DEFAULT_VISIBLE_CATEGORIES,
  DEFAULT_CATEGORY_ORDER,
  DEFAULT_CATEGORY_LABELS,
  DEFAULT_VIEW_VARIANTS,
  DEFAULT_AGGREGATIONS,
  DEFAULT_STYLING,
  ALL_CHART_TYPES,
  DEFAULT_CHARTS,
  DEFAULT_TABLE,
  ALL_KPI_TYPES,
  DEFAULT_KPIS,
  createDefaultConfig,
  mergeWithDefaults,
  mergeCodeConfig,
  validateCategoryIds,
  migrateConfig,
  getCategoryDisplayLabel,
  getOrderedVisibleCategories,
  KPI_TYPE_LABELS,
  CHART_TYPE_LABELS,
} from './defaults';

// Loader
export {
  registerCaseConfig,
  hasCaseCodeConfig,
  getCaseCodeConfig,
  getAllCaseCodeConfigs,
  loadDashboardConfig,
  loadDashboardConfigSync,
  saveConfigToDatabase,
  isConfigCustomized,
  resetConfigToDefaults,
  deleteConfigFromDatabase,
} from './loader';
