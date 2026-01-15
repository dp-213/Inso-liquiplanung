/**
 * Canonical Import Parser
 *
 * Parses raw import records against the canonical schema.
 * Validates ONLY required core fields - never rejects due to unknown columns.
 *
 * CRITICAL RULES:
 * 1. Only validate required fields (datum, betrag/einzahlung+auszahlung, bezeichnung)
 * 2. NEVER reject files due to additional/unknown columns
 * 3. Preserve unknown columns in additionalFields
 * 4. German error messages for required field validation
 */

import {
  CanonicalImportRecord,
  RecordValidationResult,
  FileValidationResult,
  FieldValidationError,
  FieldValidationWarning,
  COLUMN_NAME_MAPPINGS,
  buildColumnToCanonicalMap,
  VALIDATION_ERROR_CODES,
  VALIDATION_WARNING_CODES,
  CANONICAL_SCHEMA_VERSION,
  ImportSchemaMetadata,
  OptionalStandardFields,
} from './canonical-schema';

// =============================================================================
// COLUMN DETECTION
// =============================================================================

/**
 * Detects which canonical fields are present in the headers.
 * Returns categorized lists of required, optional, and unknown columns.
 */
export function detectColumns(headers: string[]): {
  required: Map<string, string>; // canonical name -> original header
  optional: Map<string, string>;
  unknown: string[];
  hasValidAmountFields: boolean;
} {
  const columnToCanonical = buildColumnToCanonicalMap();
  const required = new Map<string, string>();
  const optional = new Map<string, string>();
  const unknown: string[] = [];

  const requiredCanonicalFields = ['datum', 'bezeichnung'];
  const amountFields = ['betrag', 'einzahlung', 'auszahlung'];
  const optionalCanonicalFields = [
    'kategorie', 'zahlungsart', 'alt_neu_forderung', 'konto',
    'gegenpartei', 'referenz', 'kommentar', 'unsicherheit', 'quelle', 'werttyp'
  ];

  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    const canonical = columnToCanonical.get(normalized);

    if (canonical) {
      if (requiredCanonicalFields.includes(canonical) || amountFields.includes(canonical)) {
        required.set(canonical, header);
      } else if (optionalCanonicalFields.includes(canonical)) {
        optional.set(canonical, header);
      } else {
        // Known mapping but not in our tracked lists - treat as optional
        optional.set(canonical, header);
      }
    } else {
      // Unknown column - will be preserved
      unknown.push(header);
    }
  }

  // Check if we have valid amount fields
  const hasBetrag = required.has('betrag');
  const hasEinzahlung = required.has('einzahlung');
  const hasAuszahlung = required.has('auszahlung');
  const hasValidAmountFields = hasBetrag || (hasEinzahlung || hasAuszahlung);

  return { required, optional, unknown, hasValidAmountFields };
}

// =============================================================================
// RECORD PARSING
// =============================================================================

/**
 * Parses a single raw record into canonical format.
 * Validates only required fields; preserves all other data.
 */
export function parseRecord(
  rawRecord: Record<string, string>,
  headers: string[],
  rowNumber: number,
  sheetName: string | null,
  columnMapping: {
    required: Map<string, string>;
    optional: Map<string, string>;
    unknown: string[];
  }
): RecordValidationResult {
  const errors: FieldValidationError[] = [];
  const warnings: FieldValidationWarning[] = [];

  // Helper to get value by canonical name
  const getValue = (canonical: string, mapping: Map<string, string>): string | undefined => {
    const originalHeader = mapping.get(canonical);
    if (!originalHeader) return undefined;
    // Find the value using case-insensitive header match
    const headerLower = originalHeader.toLowerCase();
    for (const [key, value] of Object.entries(rawRecord)) {
      if (key.toLowerCase() === headerLower) {
        return value?.trim() || undefined;
      }
    }
    return undefined;
  };

  // Extract required fields
  const datum = getValue('datum', columnMapping.required);
  const betrag = getValue('betrag', columnMapping.required);
  const einzahlung = getValue('einzahlung', columnMapping.required);
  const auszahlung = getValue('auszahlung', columnMapping.required);
  const bezeichnung = getValue('bezeichnung', columnMapping.required);

  // Validate required: datum
  if (!datum || datum === '') {
    errors.push({
      field: 'datum',
      code: VALIDATION_ERROR_CODES.MISSING_DATUM.code,
      message: VALIDATION_ERROR_CODES.MISSING_DATUM.message,
    });
  }

  // Validate required: betrag OR (einzahlung/auszahlung)
  const hasBetrag = betrag !== undefined && betrag !== '';
  const hasEinzahlung = einzahlung !== undefined && einzahlung !== '';
  const hasAuszahlung = auszahlung !== undefined && auszahlung !== '';
  const hasSplitAmount = hasEinzahlung || hasAuszahlung;

  if (!hasBetrag && !hasSplitAmount) {
    errors.push({
      field: 'betrag',
      code: VALIDATION_ERROR_CODES.MISSING_BETRAG.code,
      message: VALIDATION_ERROR_CODES.MISSING_BETRAG.message,
    });
  }

  // Validate required: bezeichnung
  if (!bezeichnung || bezeichnung === '') {
    errors.push({
      field: 'bezeichnung',
      code: VALIDATION_ERROR_CODES.MISSING_BEZEICHNUNG.code,
      message: VALIDATION_ERROR_CODES.MISSING_BEZEICHNUNG.message,
    });
  }

  // If there are errors in required fields, return early
  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      warnings,
      record: null,
    };
  }

  // Extract optional standard fields
  const standardFields: Partial<OptionalStandardFields> = {};

  const optionalFieldMappings: Array<{ canonical: keyof OptionalStandardFields; }> = [
    { canonical: 'kategorie' },
    { canonical: 'zahlungsart' },
    { canonical: 'typ' },
    { canonical: 'alt_neu_forderung' },
    { canonical: 'massetyp' },
    { canonical: 'konto' },
    { canonical: 'gegenpartei' },
    { canonical: 'referenz' },
    { canonical: 'kommentar' },
    { canonical: 'notiz' },
    { canonical: 'unsicherheit' },
    { canonical: 'quelle' },
    { canonical: 'werttyp' },
  ];

  for (const { canonical } of optionalFieldMappings) {
    const value = getValue(canonical, columnMapping.optional);
    if (value !== undefined && value !== '') {
      standardFields[canonical] = value;
    }
  }

  // Collect additional (unknown) fields - CRITICAL: preserve everything
  const additionalFields: Record<string, string> = {};
  const knownHeaders = new Set<string>();

  // Add all mapped headers to known set
  for (const [, originalHeader] of columnMapping.required) {
    knownHeaders.add(originalHeader.toLowerCase());
  }
  for (const [, originalHeader] of columnMapping.optional) {
    knownHeaders.add(originalHeader.toLowerCase());
  }

  // Store unknown fields
  for (const [key, value] of Object.entries(rawRecord)) {
    if (!knownHeaders.has(key.toLowerCase())) {
      additionalFields[key.toLowerCase()] = value || '';
    }
  }

  // Add informational warnings for unknown columns (not errors!)
  if (columnMapping.unknown.length > 0 && rowNumber === 1) {
    // Only warn once per file, on first row
    for (const unknownCol of columnMapping.unknown) {
      warnings.push({
        field: unknownCol,
        code: VALIDATION_WARNING_CODES.UNKNOWN_COLUMN_PRESERVED.code,
        message: VALIDATION_WARNING_CODES.UNKNOWN_COLUMN_PRESERVED.message.replace('{column}', unknownCol),
        value: unknownCol,
      });
    }
  }

  // Build canonical record
  const record: CanonicalImportRecord = {
    coreFields: {
      datum: datum!,
      betrag: hasBetrag ? betrag! : null,
      bezeichnung: bezeichnung!,
    },
    splitAmount: hasSplitAmount ? {
      einzahlung: hasEinzahlung ? einzahlung! : null,
      auszahlung: hasAuszahlung ? auszahlung! : null,
    } : null,
    standardFields,
    additionalFields,
    _meta: {
      rowNumber,
      sheetName,
      originalHeaders: headers,
      importedAt: new Date().toISOString(),
    },
  };

  return {
    valid: true,
    errors: [],
    warnings,
    record,
  };
}

// =============================================================================
// FILE PARSING
// =============================================================================

/**
 * Parses an entire file's records into canonical format.
 * Returns validation results and parsed records.
 */
export function parseFile(
  records: Array<Record<string, string>>,
  headers: string[],
  sheetName: string | null = null
): FileValidationResult {
  const columnMapping = detectColumns(headers);

  // Check if we have the minimum required column structure
  const hasDatum = columnMapping.required.has('datum');
  const hasBezeichnung = columnMapping.required.has('bezeichnung');
  const hasAmountField = columnMapping.hasValidAmountFields;

  // File-level validation: required column structure
  const fileErrors: Array<{ rowNumber: number; errors: FieldValidationError[] }> = [];
  const fileWarnings: Array<{ rowNumber: number; warnings: FieldValidationWarning[] }> = [];

  if (!hasDatum) {
    fileErrors.push({
      rowNumber: 0,
      errors: [{
        field: 'datum',
        code: VALIDATION_ERROR_CODES.MISSING_DATUM.code,
        message: 'Keine Datums-Spalte gefunden. ' + VALIDATION_ERROR_CODES.MISSING_DATUM.message,
      }],
    });
  }

  if (!hasBezeichnung) {
    fileErrors.push({
      rowNumber: 0,
      errors: [{
        field: 'bezeichnung',
        code: VALIDATION_ERROR_CODES.MISSING_BEZEICHNUNG.code,
        message: 'Keine Bezeichnungs-Spalte gefunden. ' + VALIDATION_ERROR_CODES.MISSING_BEZEICHNUNG.message,
      }],
    });
  }

  if (!hasAmountField) {
    fileErrors.push({
      rowNumber: 0,
      errors: [{
        field: 'betrag',
        code: VALIDATION_ERROR_CODES.MISSING_BETRAG.code,
        message: 'Keine Betrags-Spalte gefunden. ' + VALIDATION_ERROR_CODES.MISSING_BETRAG.message,
      }],
    });
  }

  // If file structure is invalid, return early
  if (fileErrors.length > 0) {
    return {
      valid: false,
      totalRows: records.length,
      validRows: 0,
      errorRows: records.length,
      warningRows: 0,
      errors: fileErrors,
      warnings: [],
      records: [],
      detectedColumns: {
        required: Array.from(columnMapping.required.keys()),
        optional: Array.from(columnMapping.optional.keys()),
        unknown: columnMapping.unknown,
      },
    };
  }

  // Parse individual records
  const parsedRecords: CanonicalImportRecord[] = [];
  let validRows = 0;
  let errorRows = 0;
  let warningRows = 0;

  for (let i = 0; i < records.length; i++) {
    const result = parseRecord(
      records[i],
      headers,
      i + 1, // 1-indexed row number
      sheetName,
      columnMapping
    );

    if (result.valid && result.record) {
      parsedRecords.push(result.record);
      validRows++;
      if (result.warnings.length > 0) {
        warningRows++;
        fileWarnings.push({ rowNumber: i + 1, warnings: result.warnings });
      }
    } else {
      errorRows++;
      fileErrors.push({ rowNumber: i + 1, errors: result.errors });
    }
  }

  return {
    valid: errorRows === 0,
    totalRows: records.length,
    validRows,
    errorRows,
    warningRows,
    errors: fileErrors,
    warnings: fileWarnings,
    records: parsedRecords,
    detectedColumns: {
      required: Array.from(columnMapping.required.keys()),
      optional: Array.from(columnMapping.optional.keys()),
      unknown: columnMapping.unknown,
    },
  };
}

// =============================================================================
// METADATA GENERATION
// =============================================================================

/**
 * Generates import schema metadata for storage with the job.
 */
export function generateSchemaMetadata(
  headers: string[],
  columnMapping: {
    required: Map<string, string>;
    optional: Map<string, string>;
    unknown: string[];
  }
): ImportSchemaMetadata {
  const requiredMapping: Record<string, string> = {};
  const optionalMapping: Record<string, string> = {};

  for (const [canonical, original] of columnMapping.required) {
    requiredMapping[canonical] = original;
  }
  for (const [canonical, original] of columnMapping.optional) {
    optionalMapping[canonical] = original;
  }

  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    importedAt: new Date().toISOString(),
    originalHeaders: headers,
    mappedFields: {
      required: requiredMapping,
      optional: optionalMapping,
    },
    unmappedColumns: columnMapping.unknown,
  };
}

// =============================================================================
// RECORD SERIALIZATION
// =============================================================================

/**
 * Serializes a canonical record for storage in the database.
 * Combines all fields into a single JSON structure.
 */
export function serializeRecord(record: CanonicalImportRecord): string {
  return JSON.stringify({
    core: record.coreFields,
    splitAmount: record.splitAmount,
    standard: record.standardFields,
    additional: record.additionalFields,
    _meta: record._meta,
    _schemaVersion: CANONICAL_SCHEMA_VERSION,
  });
}

/**
 * Deserializes a stored record back to canonical format.
 */
export function deserializeRecord(json: string): CanonicalImportRecord | null {
  try {
    const parsed = JSON.parse(json);

    // Handle legacy format (flat structure)
    if (!parsed.core && !parsed._schemaVersion) {
      // Legacy record - return as-is wrapped in a compatible structure
      return {
        coreFields: {
          datum: parsed.datum || '',
          betrag: parsed.betrag || null,
          bezeichnung: parsed.bezeichnung || parsed.beschreibung || '',
        },
        splitAmount: null,
        standardFields: {},
        additionalFields: parsed,
        _meta: {
          rowNumber: 0,
          sheetName: null,
          originalHeaders: [],
          importedAt: '',
        },
      };
    }

    // New canonical format
    return {
      coreFields: parsed.core,
      splitAmount: parsed.splitAmount,
      standardFields: parsed.standard || {},
      additionalFields: parsed.additional || {},
      _meta: parsed._meta,
    };
  } catch {
    return null;
  }
}
