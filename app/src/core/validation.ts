/**
 * Core Liquidity Engine - Input Validation
 *
 * This module provides comprehensive validation for all calculation inputs.
 * All validations are deterministic and produce consistent error messages.
 *
 * @module core/validation
 * @version 1.0.0
 */

import {
  type CategoryInput,
  type LineInput,
  type WeeklyValueInput,
  type LiquidityCalculationInput,
  type ValidationError,
  type ValidationResult,
  type FlowType,
  type EstateType,
  type ValueType,
  MIN_WEEK_OFFSET,
  MAX_WEEK_OFFSET,
} from './types';

// ============================================================================
// VALIDATION ERROR CODES
// ============================================================================

export const ErrorCodes = {
  // Category errors
  CATEGORY_EMPTY_ID: 'CATEGORY_EMPTY_ID',
  CATEGORY_EMPTY_NAME: 'CATEGORY_EMPTY_NAME',
  CATEGORY_INVALID_FLOW_TYPE: 'CATEGORY_INVALID_FLOW_TYPE',
  CATEGORY_INVALID_ESTATE_TYPE: 'CATEGORY_INVALID_ESTATE_TYPE',
  CATEGORY_INVALID_DISPLAY_ORDER: 'CATEGORY_INVALID_DISPLAY_ORDER',
  CATEGORY_DUPLICATE_ID: 'CATEGORY_DUPLICATE_ID',

  // Line errors
  LINE_EMPTY_ID: 'LINE_EMPTY_ID',
  LINE_EMPTY_NAME: 'LINE_EMPTY_NAME',
  LINE_EMPTY_CATEGORY_ID: 'LINE_EMPTY_CATEGORY_ID',
  LINE_INVALID_CATEGORY_REFERENCE: 'LINE_INVALID_CATEGORY_REFERENCE',
  LINE_INVALID_DISPLAY_ORDER: 'LINE_INVALID_DISPLAY_ORDER',
  LINE_DUPLICATE_ID: 'LINE_DUPLICATE_ID',

  // Weekly value errors
  WEEKLY_VALUE_EMPTY_LINE_ID: 'WEEKLY_VALUE_EMPTY_LINE_ID',
  WEEKLY_VALUE_INVALID_LINE_REFERENCE: 'WEEKLY_VALUE_INVALID_LINE_REFERENCE',
  WEEKLY_VALUE_INVALID_WEEK_OFFSET: 'WEEKLY_VALUE_INVALID_WEEK_OFFSET',
  WEEKLY_VALUE_INVALID_VALUE_TYPE: 'WEEKLY_VALUE_INVALID_VALUE_TYPE',
  WEEKLY_VALUE_INVALID_AMOUNT: 'WEEKLY_VALUE_INVALID_AMOUNT',
  WEEKLY_VALUE_DUPLICATE: 'WEEKLY_VALUE_DUPLICATE',

  // Input structure errors
  INPUT_NULL_OR_UNDEFINED: 'INPUT_NULL_OR_UNDEFINED',
  INPUT_CATEGORIES_NOT_ARRAY: 'INPUT_CATEGORIES_NOT_ARRAY',
  INPUT_LINES_NOT_ARRAY: 'INPUT_LINES_NOT_ARRAY',
  INPUT_WEEKLY_VALUES_NOT_ARRAY: 'INPUT_WEEKLY_VALUES_NOT_ARRAY',
  INPUT_OPENING_BALANCE_INVALID: 'INPUT_OPENING_BALANCE_INVALID',
} as const;

// ============================================================================
// TYPE GUARDS
// ============================================================================

const VALID_FLOW_TYPES: readonly FlowType[] = ['INFLOW', 'OUTFLOW'];
const VALID_ESTATE_TYPES: readonly EstateType[] = ['ALTMASSE', 'NEUMASSE'];
const VALID_VALUE_TYPES: readonly ValueType[] = ['IST', 'PLAN'];

/**
 * Type guard for FlowType
 */
function isValidFlowType(value: unknown): value is FlowType {
  return typeof value === 'string' && VALID_FLOW_TYPES.includes(value as FlowType);
}

/**
 * Type guard for EstateType
 */
function isValidEstateType(value: unknown): value is EstateType {
  return typeof value === 'string' && VALID_ESTATE_TYPES.includes(value as EstateType);
}

/**
 * Type guard for ValueType
 */
function isValidValueType(value: unknown): value is ValueType {
  return typeof value === 'string' && VALID_VALUE_TYPES.includes(value as ValueType);
}

/**
 * Type guard for bigint
 */
function isBigInt(value: unknown): value is bigint {
  return typeof value === 'bigint';
}

/**
 * Check if value is a non-empty string
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if value is a non-negative integer
 */
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Check if week offset is valid (0-12)
 */
function isValidWeekOffset(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_WEEK_OFFSET &&
    value <= MAX_WEEK_OFFSET
  );
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates a single category input
 */
function validateCategory(
  category: unknown,
  index: number,
  seenIds: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const basePath = `categories[${index}]`;

  if (category === null || category === undefined || typeof category !== 'object') {
    errors.push({
      code: ErrorCodes.INPUT_NULL_OR_UNDEFINED,
      message: `Category at index ${index} is null, undefined, or not an object`,
      path: basePath,
      value: category,
    });
    return errors;
  }

  const cat = category as Record<string, unknown>;

  // Validate id
  if (!isNonEmptyString(cat.id)) {
    errors.push({
      code: ErrorCodes.CATEGORY_EMPTY_ID,
      message: `Category at index ${index} has empty or invalid id`,
      path: `${basePath}.id`,
      value: cat.id,
    });
  } else if (seenIds.has(cat.id)) {
    errors.push({
      code: ErrorCodes.CATEGORY_DUPLICATE_ID,
      message: `Category id "${cat.id}" is duplicated`,
      path: `${basePath}.id`,
      value: cat.id,
    });
  } else {
    seenIds.add(cat.id);
  }

  // Validate name
  if (!isNonEmptyString(cat.name)) {
    errors.push({
      code: ErrorCodes.CATEGORY_EMPTY_NAME,
      message: `Category at index ${index} has empty or invalid name`,
      path: `${basePath}.name`,
      value: cat.name,
    });
  }

  // Validate flowType
  if (!isValidFlowType(cat.flowType)) {
    errors.push({
      code: ErrorCodes.CATEGORY_INVALID_FLOW_TYPE,
      message: `Category at index ${index} has invalid flowType. Expected INFLOW or OUTFLOW`,
      path: `${basePath}.flowType`,
      value: cat.flowType,
    });
  }

  // Validate estateType
  if (!isValidEstateType(cat.estateType)) {
    errors.push({
      code: ErrorCodes.CATEGORY_INVALID_ESTATE_TYPE,
      message: `Category at index ${index} has invalid estateType. Expected ALTMASSE or NEUMASSE`,
      path: `${basePath}.estateType`,
      value: cat.estateType,
    });
  }

  // Validate displayOrder
  if (!isNonNegativeInteger(cat.displayOrder)) {
    errors.push({
      code: ErrorCodes.CATEGORY_INVALID_DISPLAY_ORDER,
      message: `Category at index ${index} has invalid displayOrder. Expected non-negative integer`,
      path: `${basePath}.displayOrder`,
      value: cat.displayOrder,
    });
  }

  return errors;
}

/**
 * Validates a single line input
 */
function validateLine(
  line: unknown,
  index: number,
  categoryIds: Set<string>,
  seenIds: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const basePath = `lines[${index}]`;

  if (line === null || line === undefined || typeof line !== 'object') {
    errors.push({
      code: ErrorCodes.INPUT_NULL_OR_UNDEFINED,
      message: `Line at index ${index} is null, undefined, or not an object`,
      path: basePath,
      value: line,
    });
    return errors;
  }

  const ln = line as Record<string, unknown>;

  // Validate id
  if (!isNonEmptyString(ln.id)) {
    errors.push({
      code: ErrorCodes.LINE_EMPTY_ID,
      message: `Line at index ${index} has empty or invalid id`,
      path: `${basePath}.id`,
      value: ln.id,
    });
  } else if (seenIds.has(ln.id)) {
    errors.push({
      code: ErrorCodes.LINE_DUPLICATE_ID,
      message: `Line id "${ln.id}" is duplicated`,
      path: `${basePath}.id`,
      value: ln.id,
    });
  } else {
    seenIds.add(ln.id);
  }

  // Validate name
  if (!isNonEmptyString(ln.name)) {
    errors.push({
      code: ErrorCodes.LINE_EMPTY_NAME,
      message: `Line at index ${index} has empty or invalid name`,
      path: `${basePath}.name`,
      value: ln.name,
    });
  }

  // Validate categoryId
  if (!isNonEmptyString(ln.categoryId)) {
    errors.push({
      code: ErrorCodes.LINE_EMPTY_CATEGORY_ID,
      message: `Line at index ${index} has empty or invalid categoryId`,
      path: `${basePath}.categoryId`,
      value: ln.categoryId,
    });
  } else if (!categoryIds.has(ln.categoryId)) {
    errors.push({
      code: ErrorCodes.LINE_INVALID_CATEGORY_REFERENCE,
      message: `Line at index ${index} references non-existent category "${ln.categoryId}"`,
      path: `${basePath}.categoryId`,
      value: ln.categoryId,
    });
  }

  // Validate displayOrder
  if (!isNonNegativeInteger(ln.displayOrder)) {
    errors.push({
      code: ErrorCodes.LINE_INVALID_DISPLAY_ORDER,
      message: `Line at index ${index} has invalid displayOrder. Expected non-negative integer`,
      path: `${basePath}.displayOrder`,
      value: ln.displayOrder,
    });
  }

  return errors;
}

/**
 * Validates a single weekly value input
 */
function validateWeeklyValue(
  value: unknown,
  index: number,
  lineIds: Set<string>,
  seenValueKeys: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const basePath = `weeklyValues[${index}]`;

  if (value === null || value === undefined || typeof value !== 'object') {
    errors.push({
      code: ErrorCodes.INPUT_NULL_OR_UNDEFINED,
      message: `Weekly value at index ${index} is null, undefined, or not an object`,
      path: basePath,
      value: value,
    });
    return errors;
  }

  const wv = value as Record<string, unknown>;

  // Validate lineId
  if (!isNonEmptyString(wv.lineId)) {
    errors.push({
      code: ErrorCodes.WEEKLY_VALUE_EMPTY_LINE_ID,
      message: `Weekly value at index ${index} has empty or invalid lineId`,
      path: `${basePath}.lineId`,
      value: wv.lineId,
    });
  } else if (!lineIds.has(wv.lineId)) {
    errors.push({
      code: ErrorCodes.WEEKLY_VALUE_INVALID_LINE_REFERENCE,
      message: `Weekly value at index ${index} references non-existent line "${wv.lineId}"`,
      path: `${basePath}.lineId`,
      value: wv.lineId,
    });
  }

  // Validate weekOffset
  if (!isValidWeekOffset(wv.weekOffset)) {
    errors.push({
      code: ErrorCodes.WEEKLY_VALUE_INVALID_WEEK_OFFSET,
      message: `Weekly value at index ${index} has invalid weekOffset. Expected integer 0-12`,
      path: `${basePath}.weekOffset`,
      value: wv.weekOffset,
    });
  }

  // Validate valueType
  if (!isValidValueType(wv.valueType)) {
    errors.push({
      code: ErrorCodes.WEEKLY_VALUE_INVALID_VALUE_TYPE,
      message: `Weekly value at index ${index} has invalid valueType. Expected IST or PLAN`,
      path: `${basePath}.valueType`,
      value: wv.valueType,
    });
  }

  // Validate amountCents
  if (!isBigInt(wv.amountCents)) {
    errors.push({
      code: ErrorCodes.WEEKLY_VALUE_INVALID_AMOUNT,
      message: `Weekly value at index ${index} has invalid amountCents. Expected bigint`,
      path: `${basePath}.amountCents`,
      value: typeof wv.amountCents,
    });
  }

  // Check for duplicate (lineId, weekOffset, valueType) combination
  if (isNonEmptyString(wv.lineId) && isValidWeekOffset(wv.weekOffset) && isValidValueType(wv.valueType)) {
    const key = `${wv.lineId}|${wv.weekOffset}|${wv.valueType}`;
    if (seenValueKeys.has(key)) {
      errors.push({
        code: ErrorCodes.WEEKLY_VALUE_DUPLICATE,
        message: `Duplicate weekly value for line "${wv.lineId}", week ${wv.weekOffset}, type ${wv.valueType}`,
        path: basePath,
        value: key,
      });
    } else {
      seenValueKeys.add(key);
    }
  }

  return errors;
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validates the complete input payload for the liquidity calculation engine.
 *
 * This function performs comprehensive validation including:
 * - Structural validation (correct types, required fields)
 * - Referential integrity (lines reference valid categories, values reference valid lines)
 * - Uniqueness constraints (no duplicate IDs or value combinations)
 * - Range validation (week offsets within 0-12)
 *
 * @param input - The raw input to validate
 * @returns ValidationResult - Either success with typed data, or failure with error list
 *
 * @example
 * ```typescript
 * const result = validateInput(rawData);
 * if (result.valid) {
 *   const calculationResult = calculateLiquidity(result.data);
 * } else {
 *   console.error('Validation failed:', result.errors);
 * }
 * ```
 */
export function validateInput(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  // Check if input exists
  if (input === null || input === undefined) {
    return {
      valid: false,
      errors: [
        {
          code: ErrorCodes.INPUT_NULL_OR_UNDEFINED,
          message: 'Input is null or undefined',
          path: '',
          value: input,
        },
      ],
    };
  }

  if (typeof input !== 'object') {
    return {
      valid: false,
      errors: [
        {
          code: ErrorCodes.INPUT_NULL_OR_UNDEFINED,
          message: 'Input must be an object',
          path: '',
          value: typeof input,
        },
      ],
    };
  }

  const inp = input as Record<string, unknown>;

  // Validate openingBalanceCents
  if (!isBigInt(inp.openingBalanceCents)) {
    errors.push({
      code: ErrorCodes.INPUT_OPENING_BALANCE_INVALID,
      message: 'openingBalanceCents must be a bigint',
      path: 'openingBalanceCents',
      value: typeof inp.openingBalanceCents,
    });
  }

  // Validate categories array
  if (!Array.isArray(inp.categories)) {
    errors.push({
      code: ErrorCodes.INPUT_CATEGORIES_NOT_ARRAY,
      message: 'categories must be an array',
      path: 'categories',
      value: typeof inp.categories,
    });
  }

  // Validate lines array
  if (!Array.isArray(inp.lines)) {
    errors.push({
      code: ErrorCodes.INPUT_LINES_NOT_ARRAY,
      message: 'lines must be an array',
      path: 'lines',
      value: typeof inp.lines,
    });
  }

  // Validate weeklyValues array
  if (!Array.isArray(inp.weeklyValues)) {
    errors.push({
      code: ErrorCodes.INPUT_WEEKLY_VALUES_NOT_ARRAY,
      message: 'weeklyValues must be an array',
      path: 'weeklyValues',
      value: typeof inp.weeklyValues,
    });
  }

  // If basic structure is invalid, return early
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const categories = inp.categories as unknown[];
  const lines = inp.lines as unknown[];
  const weeklyValues = inp.weeklyValues as unknown[];

  // Validate categories
  const categoryIds = new Set<string>();
  const seenCategoryIds = new Set<string>();

  for (let i = 0; i < categories.length; i++) {
    const categoryErrors = validateCategory(categories[i], i, seenCategoryIds);
    errors.push(...categoryErrors);

    // Collect valid category IDs for reference validation
    const cat = categories[i] as Record<string, unknown> | null | undefined;
    if (cat && isNonEmptyString(cat.id) && !seenCategoryIds.has(cat.id)) {
      // ID was already added in validateCategory
    }
    if (cat && isNonEmptyString(cat.id)) {
      categoryIds.add(cat.id);
    }
  }

  // Validate lines
  const lineIds = new Set<string>();
  const seenLineIds = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const lineErrors = validateLine(lines[i], i, categoryIds, seenLineIds);
    errors.push(...lineErrors);

    // Collect valid line IDs for reference validation
    const ln = lines[i] as Record<string, unknown> | null | undefined;
    if (ln && isNonEmptyString(ln.id)) {
      lineIds.add(ln.id);
    }
  }

  // Validate weekly values
  const seenValueKeys = new Set<string>();

  for (let i = 0; i < weeklyValues.length; i++) {
    const valueErrors = validateWeeklyValue(weeklyValues[i], i, lineIds, seenValueKeys);
    errors.push(...valueErrors);
  }

  // Return result
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Type assertion is safe here because we've validated all fields
  return {
    valid: true,
    data: input as LiquidityCalculationInput,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a formatted error summary string for display
 */
export function formatValidationErrors(errors: readonly ValidationError[]): string {
  if (errors.length === 0) {
    return 'No validation errors';
  }

  const lines = errors.map((err, idx) => `${idx + 1}. [${err.code}] ${err.path}: ${err.message}`);

  return `Validation failed with ${errors.length} error(s):\n${lines.join('\n')}`;
}

/**
 * Groups validation errors by their path prefix
 */
export function groupErrorsByPath(
  errors: readonly ValidationError[]
): Map<string, ValidationError[]> {
  const grouped = new Map<string, ValidationError[]>();

  for (const error of errors) {
    const prefix = error.path.split('[')[0] || 'root';
    const existing = grouped.get(prefix) || [];
    existing.push(error);
    grouped.set(prefix, existing);
  }

  return grouped;
}
