/**
 * Case Dashboard Loader
 *
 * This module handles loading and resolving dashboard configurations from:
 * 1. Default configuration
 * 2. Database (CaseConfiguration table)
 * 3. Case-specific code files (optional)
 *
 * Priority: Code config overrides DB config overrides defaults.
 *
 * @module lib/case-dashboard/loader
 * @version 1.0.0
 */

import {
  CaseDashboardConfig,
  CaseCodeConfig,
  DashboardLoaderResult,
  CONFIG_TYPES,
  validateDashboardConfig,
} from './types';
import {
  createDefaultConfig,
  mergeWithDefaults,
  mergeCodeConfig,
  migrateConfig,
  validateCategoryIds,
} from './defaults';
import prisma from '@/lib/db';

// =============================================================================
// CASE CODE REGISTRY
// =============================================================================

/**
 * Registry of case-specific code configurations
 * This is populated at build time by scanning /src/cases/[case-id]/
 */
const caseCodeRegistry: Map<string, CaseCodeConfig> = new Map();

/**
 * Register a case-specific code configuration
 * Called by case config files to register themselves
 */
export function registerCaseConfig(config: CaseCodeConfig): void {
  if (!config.caseId) {
    console.warn('Attempted to register case config without caseId');
    return;
  }
  caseCodeRegistry.set(config.caseId, config);
}

/**
 * Check if a case has custom code configuration
 */
export function hasCaseCodeConfig(caseId: string): boolean {
  return caseCodeRegistry.has(caseId);
}

/**
 * Get case code configuration if it exists
 */
export function getCaseCodeConfig(caseId: string): CaseCodeConfig | undefined {
  return caseCodeRegistry.get(caseId);
}

/**
 * Get all registered case code configurations
 */
export function getAllCaseCodeConfigs(): CaseCodeConfig[] {
  return Array.from(caseCodeRegistry.values());
}

// =============================================================================
// DATABASE LOADING
// =============================================================================

/**
 * Load configuration from database
 */
async function loadConfigFromDatabase(
  caseId: string
): Promise<CaseDashboardConfig | null> {
  try {
    const configRecord = await prisma.caseConfiguration.findUnique({
      where: {
        caseId_configType: {
          caseId,
          configType: CONFIG_TYPES.DASHBOARD_CONFIG,
        },
      },
    });

    if (!configRecord) {
      return null;
    }

    // Parse stored JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(configRecord.configData);
    } catch {
      console.error(`Failed to parse config JSON for case ${caseId}`);
      return null;
    }

    // Validate parsed config
    const validation = validateDashboardConfig(parsed);
    if (!validation.valid) {
      console.error(`Invalid config in database for case ${caseId}:`, validation.errors);
      return null;
    }

    return validation.data;
  } catch (error) {
    console.error(`Error loading config from database for case ${caseId}:`, error);
    return null;
  }
}

/**
 * Save configuration to database
 */
export async function saveConfigToDatabase(
  caseId: string,
  config: CaseDashboardConfig,
  userId: string
): Promise<boolean> {
  try {
    // Update metadata
    const configToSave: CaseDashboardConfig = {
      ...config,
      metadata: {
        ...config.metadata,
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: userId,
      },
    };

    // Validate before saving
    const validation = validateDashboardConfig(configToSave);
    if (!validation.valid) {
      console.error('Attempted to save invalid config:', validation.errors);
      return false;
    }

    // Upsert to database
    await prisma.caseConfiguration.upsert({
      where: {
        caseId_configType: {
          caseId,
          configType: CONFIG_TYPES.DASHBOARD_CONFIG,
        },
      },
      create: {
        caseId,
        configType: CONFIG_TYPES.DASHBOARD_CONFIG,
        configData: JSON.stringify(configToSave),
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        configData: JSON.stringify(configToSave),
        updatedBy: userId,
      },
    });

    return true;
  } catch (error) {
    console.error(`Error saving config to database for case ${caseId}:`, error);
    return false;
  }
}

// =============================================================================
// CONFIGURATION RESOLUTION
// =============================================================================

/**
 * Main loader function - resolves final configuration for a case
 *
 * Resolution order:
 * 1. Start with default configuration
 * 2. Merge in database configuration if exists
 * 3. Apply code configuration overrides if exists
 *
 * @param caseId - The case ID to load configuration for
 * @param userId - User ID for default config creation (optional)
 * @returns Resolved configuration and metadata about its source
 */
export async function loadDashboardConfig(
  caseId: string,
  userId: string = 'system'
): Promise<DashboardLoaderResult> {
  const warnings: string[] = [];
  let configSource: DashboardLoaderResult['configSource'] = 'default';

  // Step 1: Start with defaults
  let config = createDefaultConfig(userId);

  // Step 2: Try to load from database
  const dbConfig = await loadConfigFromDatabase(caseId);
  if (dbConfig) {
    // Migrate if needed
    const migratedDbConfig = migrateConfig(dbConfig);

    // Validate category IDs
    const categoryErrors = validateCategoryIds(migratedDbConfig);
    if (categoryErrors.length > 0) {
      warnings.push(...categoryErrors);
    }

    // Merge with defaults to fill any missing fields
    config = mergeWithDefaults(migratedDbConfig, userId);
    configSource = 'database';
  }

  // Step 3: Check for case-specific code configuration
  const codeConfig = getCaseCodeConfig(caseId);
  let usesCustomCode = false;
  let customComponentPath: string | undefined;

  if (codeConfig) {
    usesCustomCode = true;
    customComponentPath = `/src/cases/${caseId}/dashboard.view.tsx`;

    if (codeConfig.replaceUIConfig && codeConfig.configOverrides) {
      // Completely replace with code config
      config = mergeWithDefaults(codeConfig.configOverrides, userId);
      configSource = 'code';
    } else if (codeConfig.configOverrides) {
      // Merge code config on top
      config = mergeCodeConfig(config, codeConfig.configOverrides);
      configSource = configSource === 'database' ? 'merged' : 'code';
    }

    // Validate merged config
    const mergedCategoryErrors = validateCategoryIds(config);
    if (mergedCategoryErrors.length > 0) {
      warnings.push(...mergedCategoryErrors.map((e) => `(from code config) ${e}`));
    }
  }

  return {
    config,
    usesCustomCode,
    customComponentPath,
    configSource,
    warnings,
  };
}

/**
 * Synchronous version for when database access is not needed
 * Uses only default config and code config
 */
export function loadDashboardConfigSync(
  caseId: string,
  userId: string = 'system'
): Omit<DashboardLoaderResult, 'warnings'> & { warnings: string[] } {
  const warnings: string[] = [];
  let configSource: DashboardLoaderResult['configSource'] = 'default';

  // Start with defaults
  let config = createDefaultConfig(userId);

  // Check for case-specific code configuration
  const codeConfig = getCaseCodeConfig(caseId);
  let usesCustomCode = false;
  let customComponentPath: string | undefined;

  if (codeConfig) {
    usesCustomCode = true;
    customComponentPath = `/src/cases/${caseId}/dashboard.view.tsx`;

    if (codeConfig.replaceUIConfig && codeConfig.configOverrides) {
      config = mergeWithDefaults(codeConfig.configOverrides, userId);
      configSource = 'code';
    } else if (codeConfig.configOverrides) {
      config = mergeCodeConfig(config, codeConfig.configOverrides);
      configSource = 'code';
    }
  }

  return {
    config,
    usesCustomCode,
    customComponentPath,
    configSource,
    warnings,
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if a configuration has been customized from defaults
 */
export function isConfigCustomized(config: CaseDashboardConfig): boolean {
  const defaults = createDefaultConfig();

  // Check a few key fields that indicate customization
  if (JSON.stringify(config.visibleCategories) !== JSON.stringify(defaults.visibleCategories)) {
    return true;
  }
  if (JSON.stringify(config.categoryOrder) !== JSON.stringify(defaults.categoryOrder)) {
    return true;
  }
  if (Object.keys(config.categoryLabels).some(
    (key) => config.categoryLabels[key] !== defaults.categoryLabels[key]
  )) {
    return true;
  }
  if (config.emphasizedCategories.length > 0) {
    return true;
  }
  if (config.styling.primaryColor || config.styling.logoUrl || config.styling.firmName) {
    return true;
  }

  return false;
}

/**
 * Reset configuration to defaults
 */
export async function resetConfigToDefaults(
  caseId: string,
  userId: string
): Promise<boolean> {
  const defaultConfig = createDefaultConfig(userId);
  return saveConfigToDatabase(caseId, defaultConfig, userId);
}

/**
 * Delete configuration from database (reverts to defaults)
 */
export async function deleteConfigFromDatabase(caseId: string): Promise<boolean> {
  try {
    await prisma.caseConfiguration.delete({
      where: {
        caseId_configType: {
          caseId,
          configType: CONFIG_TYPES.DASHBOARD_CONFIG,
        },
      },
    });
    return true;
  } catch (error) {
    // If record doesn't exist, that's fine
    if ((error as { code?: string }).code === 'P2025') {
      return true;
    }
    console.error(`Error deleting config for case ${caseId}:`, error);
    return false;
  }
}
