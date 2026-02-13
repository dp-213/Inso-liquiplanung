/**
 * Performance-Engine (GuV-light)
 *
 * Periodisierte Ergebnisrechnung pro Standort und Monat.
 * Beantwortet: "Trägt sich Velbert alleine?"
 */

export { calculatePerformance } from './aggregate';
export { periodizeEntry, spreadByServicePeriod, generateMonthlyPeriods } from './periodize';
export { HVPLUS_PNL_MAPPING, EXCLUDED_FROM_PERFORMANCE, validateConfig } from './config';
export type {
  PerformancePeriod,
  PnLGroup,
  PnLLineItem,
  LocationMonthResult,
  AllocationMethod,
  PerformanceResult,
  DataQualityReport,
  PnLRowConfig,
  LocationSummary,
  LocationSummaryAfterAllocation,
} from './types';
