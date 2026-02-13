/**
 * Ingestion Transformation Utilities
 *
 * Implements all transformation types per DATA_INGESTION_ARCHITECTURE.md.
 * These are pure functions that transform values with explicit rules only.
 * NO inference, NO guessing, NO auto-correction.
 */

import {
  TransformationType,
  FieldMapping,
  ValueMapping,
  CategoryMapping,
} from './types';

// =============================================================================
// TRANSFORMATION RESULT TYPES
// =============================================================================

export interface TransformationResult {
  success: boolean;
  value: unknown;
  error?: string;
  warning?: string;
  confidence?: number;
}

export interface TransformationLog {
  sourceField: string;
  sourceValue: string;
  targetField: string;
  targetValue: string;
  transformationType: TransformationType;
  transformationConfig?: Record<string, unknown>;
}

// =============================================================================
// DATE TRANSFORMATIONS
// =============================================================================

/**
 * Parse a date string according to the specified format.
 * Supported formats: DD.MM.YYYY, YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY
 */
export function parseDate(dateString: string, format: string): Date | null {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  const cleaned = dateString.trim();
  if (!cleaned) {
    return null;
  }

  try {
    let date: Date | null = null;

    switch (format) {
      case 'DD.MM.YYYY': {
        const match = cleaned.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (match) {
          const [, day, month, year] = match;
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
        break;
      }
      case 'YYYY-MM-DD': {
        const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
          date = new Date(cleaned);
        }
        break;
      }
      case 'DD/MM/YYYY': {
        const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (match) {
          const [, day, month, year] = match;
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
        break;
      }
      case 'MM/DD/YYYY': {
        const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (match) {
          const [, month, day, year] = match;
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
        break;
      }
      default:
        return null;
    }

    // Validate the date is real
    if (date && !isNaN(date.getTime())) {
      return date;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Convert a date to week offset relative to plan start date.
 * Returns the week number (0-12) or null if outside range.
 */
export function dateToWeekOffset(
  date: Date,
  planStartDate: Date
): { weekOffset: number; isOutOfRange: boolean } | null {
  if (!date || !planStartDate) {
    return null;
  }

  const diffMs = date.getTime() - planStartDate.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const weekOffset = Math.floor(diffDays / 7);

  return {
    weekOffset: Math.max(0, Math.min(12, weekOffset)),
    isOutOfRange: weekOffset < 0 || weekOffset > 12,
  };
}

// =============================================================================
// NUMERIC TRANSFORMATIONS
// =============================================================================

/**
 * Parse a numeric string to cents (BigInt).
 * Handles German and international number formats.
 */
export function parseDecimalToCents(
  valueString: string,
  decimalSeparator: string = ',',
  thousandsSeparator: string = '.'
): bigint | null {
  if (!valueString || typeof valueString !== 'string') {
    return null;
  }

  try {
    let cleaned = valueString.trim();

    // Remove currency symbols
    cleaned = cleaned.replace(/EUR|€|\$/gi, '').trim();

    // Remove thousands separators
    if (thousandsSeparator) {
      cleaned = cleaned.replace(new RegExp('\\' + thousandsSeparator, 'g'), '');
    }

    // Normalize decimal separator to dot
    if (decimalSeparator && decimalSeparator !== '.') {
      cleaned = cleaned.replace(decimalSeparator, '.');
    }

    // Remove any remaining spaces
    cleaned = cleaned.replace(/\s/g, '');

    // Handle empty or invalid strings
    if (!cleaned || cleaned === '-' || cleaned === '+') {
      return null;
    }

    // Parse as float
    const value = parseFloat(cleaned);
    if (isNaN(value)) {
      return null;
    }

    // Convert to cents (round half-up)
    return BigInt(Math.round(value * 100));
  } catch {
    return null;
  }
}

/**
 * Format cents to display string in German locale.
 */
export function centsToDisplayString(cents: bigint): string {
  const euros = Number(cents) / 100;
  return euros.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// =============================================================================
// LOOKUP TRANSFORMATIONS
// =============================================================================

/**
 * Apply a lookup table transformation.
 */
export function applyLookup(
  value: string,
  lookupTable: Record<string, string>,
  caseSensitive: boolean = false
): { found: boolean; result: string | null } {
  if (!value || !lookupTable) {
    return { found: false, result: null };
  }

  const searchValue = caseSensitive ? value : value.toLowerCase();

  for (const [key, mappedValue] of Object.entries(lookupTable)) {
    const compareKey = caseSensitive ? key : key.toLowerCase();
    if (searchValue === compareKey) {
      return { found: true, result: mappedValue };
    }
  }

  return { found: false, result: null };
}

// =============================================================================
// CATEGORY MATCHING
// =============================================================================

/**
 * Match a value against category rules.
 * Returns the first matching category based on priority.
 */
export function matchCategory(
  fieldValue: string,
  categoryMappings: CategoryMapping[]
): CategoryMapping | null {
  if (!fieldValue || !categoryMappings || categoryMappings.length === 0) {
    return null;
  }

  // Sort by priority (higher first)
  const sortedMappings = [...categoryMappings].sort((a, b) => b.priority - a.priority);
  const normalizedValue = fieldValue.toLowerCase();

  for (const mapping of sortedMappings) {
    let matched = false;

    switch (mapping.matchType) {
      case 'EQUALS':
        matched = normalizedValue === mapping.matchValue?.toLowerCase();
        break;
      case 'CONTAINS':
        matched = mapping.matchValue
          ? normalizedValue.includes(mapping.matchValue.toLowerCase())
          : false;
        break;
      case 'STARTS_WITH':
        matched = mapping.matchValue
          ? normalizedValue.startsWith(mapping.matchValue.toLowerCase())
          : false;
        break;
      case 'ENDS_WITH':
        matched = mapping.matchValue
          ? normalizedValue.endsWith(mapping.matchValue.toLowerCase())
          : false;
        break;
      case 'CONTAINS_ANY':
        matched = mapping.matchValues
          ? mapping.matchValues.some((v) => normalizedValue.includes(v.toLowerCase()))
          : false;
        break;
      case 'REGEX':
        try {
          const regex = new RegExp(mapping.matchValue || '', 'i');
          matched = regex.test(fieldValue);
        } catch {
          matched = false;
        }
        break;
    }

    if (matched) {
      return mapping;
    }
  }

  return null;
}

// =============================================================================
// FIELD TRANSFORMATION EXECUTOR
// =============================================================================

/**
 * Execute a single field transformation.
 */
export function executeFieldTransformation(
  sourceValue: string,
  mapping: FieldMapping,
  context: {
    planStartDate?: Date;
    decimalSeparator?: string;
    thousandsSeparator?: string;
    dateFormat?: string;
  }
): TransformationResult {
  if (sourceValue === undefined || sourceValue === null) {
    if (mapping.required && mapping.defaultValue === undefined) {
      return {
        success: false,
        value: null,
        error: `Pflichtfeld "${mapping.sourceField}" fehlt`,
      };
    }
    return {
      success: true,
      value: mapping.defaultValue ?? null,
    };
  }

  const value = String(sourceValue).trim();

  switch (mapping.transformationType) {
    case 'DIRECT':
      return { success: true, value };

    case 'RENAME':
      return { success: true, value };

    case 'STATIC': {
      const staticValue = mapping.transformationParams?.value;
      return { success: true, value: staticValue ?? null };
    }

    case 'DATE_TO_WEEK_OFFSET': {
      const dateFormat = context.dateFormat || 'DD.MM.YYYY';
      const date = parseDate(value, dateFormat);
      if (!date) {
        return {
          success: false,
          value: null,
          error: `Datum "${value}" konnte nicht verarbeitet werden (erwartetes Format: ${dateFormat})`,
        };
      }

      if (!context.planStartDate) {
        return {
          success: false,
          value: null,
          error: 'Kein Planstartdatum definiert',
        };
      }

      const result = dateToWeekOffset(date, context.planStartDate);
      if (!result) {
        return {
          success: false,
          value: null,
          error: 'Konnte Woche nicht berechnen',
        };
      }

      if (result.isOutOfRange) {
        return {
          success: true,
          value: result.weekOffset,
          warning: `Datum liegt ausserhalb des Planungszeitraums, wurde auf Periode ${result.weekOffset} begrenzt`,
          confidence: 0.7,
        };
      }

      return { success: true, value: result.weekOffset };
    }

    case 'DECIMAL_TO_CENTS': {
      const cents = parseDecimalToCents(
        value,
        context.decimalSeparator || ',',
        context.thousandsSeparator || '.'
      );

      if (cents === null) {
        return {
          success: false,
          value: null,
          error: `Betrag "${value}" konnte nicht verarbeitet werden`,
        };
      }

      return { success: true, value: cents.toString() };
    }

    case 'LOOKUP': {
      const lookupTable = mapping.transformationParams?.lookupTable as Record<string, string> | undefined;
      const caseSensitive = mapping.transformationParams?.caseSensitive as boolean | undefined;

      if (!lookupTable) {
        return {
          success: false,
          value: null,
          error: 'Keine Nachschlagetabelle definiert',
        };
      }

      const lookupResult = applyLookup(value, lookupTable, caseSensitive);
      if (!lookupResult.found) {
        if (mapping.transformationParams?.unmappedAction === 'ERROR') {
          return {
            success: false,
            value: null,
            error: `Wert "${value}" nicht in Nachschlagetabelle gefunden`,
          };
        }
        return {
          success: true,
          value: mapping.defaultValue ?? null,
          warning: `Wert "${value}" nicht in Nachschlagetabelle gefunden, Standardwert verwendet`,
        };
      }

      return { success: true, value: lookupResult.result };
    }

    case 'CONDITIONAL': {
      const conditions = mapping.transformationParams?.conditions as Array<{
        condition: string;
        result: string;
      }> | undefined;

      if (!conditions || conditions.length === 0) {
        return {
          success: false,
          value: null,
          error: 'Keine Bedingungen definiert',
        };
      }

      // Simple condition evaluation (supports basic comparisons)
      for (const cond of conditions) {
        const condValue = cond.condition.replace('value', `"${value}"`);
        try {
          // Parse numeric comparisons
          if (cond.condition.includes('>') || cond.condition.includes('<') || cond.condition.includes('=')) {
            const numValue = parseFloat(value.replace(',', '.'));
            if (!isNaN(numValue)) {
              if (cond.condition.includes('> 0') && numValue > 0) {
                return { success: true, value: cond.result };
              }
              if (cond.condition.includes('< 0') && numValue < 0) {
                return { success: true, value: cond.result };
              }
              if (cond.condition.includes('= 0') && numValue === 0) {
                return { success: true, value: cond.result };
              }
            }
          }
        } catch {
          // Skip this condition if evaluation fails
        }
      }

      return {
        success: true,
        value: mapping.defaultValue ?? null,
        warning: 'Keine Bedingung zutreffend, Standardwert verwendet',
      };
    }

    case 'REGEX_EXTRACT': {
      const pattern = mapping.transformationParams?.pattern as string | undefined;
      const group = (mapping.transformationParams?.group as number) ?? 0;

      if (!pattern) {
        return {
          success: false,
          value: null,
          error: 'Kein Muster definiert',
        };
      }

      try {
        const regex = new RegExp(pattern);
        const match = value.match(regex);
        if (match && match[group] !== undefined) {
          return { success: true, value: match[group] };
        }
        return {
          success: false,
          value: null,
          error: `Muster "${pattern}" nicht gefunden in "${value}"`,
        };
      } catch {
        return {
          success: false,
          value: null,
          error: `Ungueltiges Muster: ${pattern}`,
        };
      }
    }

    case 'CONCATENATE': {
      // This would need multiple source fields - handled at a higher level
      return { success: true, value };
    }

    case 'SPLIT': {
      const separator = mapping.transformationParams?.separator as string | undefined;
      const index = (mapping.transformationParams?.index as number) ?? 0;

      if (!separator) {
        return {
          success: false,
          value: null,
          error: 'Kein Trennzeichen definiert',
        };
      }

      const parts = value.split(separator);
      if (index >= 0 && index < parts.length) {
        return { success: true, value: parts[index].trim() };
      }

      return {
        success: false,
        value: null,
        error: `Index ${index} ausserhalb des Bereichs (${parts.length} Teile)`,
      };
    }

    default:
      return {
        success: false,
        value: null,
        error: `Unbekannter Transformationstyp: ${mapping.transformationType}`,
      };
  }
}

// =============================================================================
// FLOW TYPE INFERENCE
// =============================================================================

/**
 * Determine flow type from amount sign.
 * This is EXPLICIT logic based on amount sign, not inference.
 */
export function determineFlowTypeFromAmount(amountCents: bigint): {
  flowType: 'INFLOW' | 'OUTFLOW';
  isInferred: boolean;
} {
  return {
    flowType: amountCents >= BigInt(0) ? 'INFLOW' : 'OUTFLOW',
    isInferred: true,
  };
}

/**
 * Normalize amount to always be positive.
 * The sign is captured in flowType, amount is always positive.
 */
export function normalizeAmount(amountCents: bigint): bigint {
  return amountCents < BigInt(0) ? -amountCents : amountCents;
}
