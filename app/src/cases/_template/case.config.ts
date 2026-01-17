/**
 * Case-Specific Configuration Template
 *
 * Copy this file to /src/cases/[your-case-id]/case.config.ts
 * and customize for your specific case requirements.
 *
 * This configuration will be merged with (or replace) the UI-based
 * configuration stored in the database.
 */

import { CaseCodeConfig } from '@/lib/case-dashboard/types';
import { registerCaseConfig } from '@/lib/case-dashboard/loader';

/**
 * Case configuration
 *
 * IMPORTANT: Update caseId to match your actual case ID from the database
 */
const config: CaseCodeConfig = {
  // ==========================================================================
  // REQUIRED: Case identification
  // ==========================================================================

  /**
   * The case ID from the database (UUID format)
   * MUST match exactly - copy from admin panel URL or database
   */
  caseId: 'YOUR-CASE-ID-HERE',

  /**
   * Human-readable name for this configuration
   * Shown in admin panel when custom code is detected
   */
  displayName: 'Custom Dashboard - [Case Name]',

  /**
   * Version of this configuration (for tracking changes)
   */
  version: '1.0.0',

  /**
   * Description of why custom configuration is needed
   */
  description: 'Custom presentation requirements for [reason]',

  // ==========================================================================
  // OPTIONAL: Configuration behavior
  // ==========================================================================

  /**
   * If true, completely replaces UI configuration with code config
   * If false (default), code config is merged on top of UI config
   */
  replaceUIConfig: false,

  // ==========================================================================
  // OPTIONAL: Configuration overrides
  // ==========================================================================

  /**
   * Partial configuration overrides
   * Only specify values you want to change from defaults/UI config
   */
  configOverrides: {
    // ========================================================================
    // Branding and styling
    // ========================================================================
    styling: {
      // Custom primary color (hex format)
      // primaryColor: '#003366',

      // Custom accent color
      // accentColor: '#0066cc',

      // Logo URL for external views
      // logoUrl: 'https://example.com/logo.png',

      // Firm/company name to display
      // firmName: 'Musterkanzlei GmbH',

      // Custom footer text
      // footerText: 'Vertraulich - Nur für internen Gebrauch',
    },

    // ========================================================================
    // Category visibility and ordering
    // ========================================================================

    // Uncomment to override visible categories
    // visibleCategories: {
    //   inflows: [
    //     'ALTFORDERUNGEN',
    //     'NEUFORDERUNGEN',
    //     'SONSTIGE_ERLOESE',
    //   ],
    //   outflows: [
    //     'PERSONALKOSTEN',
    //     'MIETE_LEASING',
    //     'MASSEKOSTEN',
    //   ],
    // },

    // Uncomment to highlight specific categories
    // emphasizedCategories: ['PERSONALKOSTEN', 'MASSEKOSTEN'],

    // Uncomment to provide custom category labels
    // categoryLabels: {
    //   PERSONALKOSTEN: 'Lohn- und Gehaltskosten',
    //   MIETE_LEASING: 'Miet- und Leasingaufwendungen',
    // },

    // ========================================================================
    // View variant settings
    // ========================================================================

    // Uncomment to customize internal view
    // viewVariants: {
    //   internal: {
    //     enabled: true,
    //     config: {
    //       showEstateTypes: true,
    //       showDataSources: true,
    //       titleOverride: 'Liquiditätsplan - Interne Ansicht',
    //     },
    //   },
    //   external: {
    //     enabled: true,
    //     config: {
    //       showEstateTypes: false,
    //       showDataSources: false,
    //       titleOverride: 'Liquiditaetsübersicht',
    //     },
    //   },
    // },

    // ========================================================================
    // Display options
    // ========================================================================

    // Uncomment to customize table display
    // table: {
    //   showWeekNumbers: true,
    //   showDateRanges: true,
    //   highlightNegative: true,
    //   compactMode: false,
    //   freezeFirstColumn: true,
    // },

    // Uncomment to customize chart display
    // charts: {
    //   visibleCharts: ['balance_line', 'cashflow_bar'],
    //   defaultChart: 'balance_line',
    //   showLegend: true,
    //   showDataLabels: false,
    // },

    // Uncomment to customize KPI display
    // kpis: {
    //   visibleKPIs: [
    //     'opening_balance',
    //     'closing_balance',
    //     'total_inflows',
    //     'total_outflows',
    //     'min_balance',
    //   ],
    //   showTrends: true,
    // },
  },
};

// Register this configuration with the dashboard loader
registerCaseConfig(config);

export default config;
