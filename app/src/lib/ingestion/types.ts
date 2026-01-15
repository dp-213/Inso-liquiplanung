/**
 * Ingestion System Type Definitions
 *
 * Based on DATA_INGESTION_ARCHITECTURE.md specification.
 * Defines all types for the operator-grade data ingestion system.
 */

// =============================================================================
// ENUMS AND CONSTANTS
// =============================================================================

export const SOURCE_TYPES = {
  CSV_GENERIC: 'CSV_GENERIC',
  CSV_BANK_STATEMENT: 'CSV_BANK_STATEMENT',
  CSV_SUSA: 'CSV_SUSA',
  CSV_PNL: 'CSV_PNL',
  CSV_BALANCE_SHEET: 'CSV_BALANCE_SHEET',
  EXCEL_LIQUIDITY: 'EXCEL_LIQUIDITY',
  EXCEL_GENERIC: 'EXCEL_GENERIC',
} as const;

export type SourceType = typeof SOURCE_TYPES[keyof typeof SOURCE_TYPES];

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  CSV_GENERIC: 'CSV-Datei',
  CSV_BANK_STATEMENT: 'Kontoauszug (CSV)',
  CSV_SUSA: 'Summen- und Saldenliste (CSV)',
  CSV_PNL: 'GuV-Extrakt (CSV)',
  CSV_BALANCE_SHEET: 'Bilanz-Extrakt (CSV)',
  EXCEL_LIQUIDITY: 'Liquiditätsplan (Excel)',
  EXCEL_GENERIC: 'Excel-Datei',
};

export const INGESTION_STATUS = {
  CREATED: 'CREATED',
  UPLOADING: 'UPLOADING',
  VALIDATING: 'VALIDATING',
  PARSING: 'PARSING',
  STAGING: 'STAGING',
  MAPPING: 'MAPPING',
  VALIDATING_BUSINESS: 'VALIDATING_BUSINESS',
  READY: 'READY',
  REVIEW: 'REVIEW',
  QUARANTINED: 'QUARANTINED',
  RESOLVED: 'RESOLVED',
  COMMITTED: 'COMMITTED',
  REJECTED: 'REJECTED',
} as const;

export type IngestionStatus = typeof INGESTION_STATUS[keyof typeof INGESTION_STATUS];

export const INGESTION_STATUS_LABELS: Record<IngestionStatus, string> = {
  CREATED: 'Erstellt',
  UPLOADING: 'Hochladen',
  VALIDATING: 'Validierung',
  PARSING: 'Verarbeitung',
  STAGING: 'Vorbereitung',
  MAPPING: 'Zuordnung',
  VALIDATING_BUSINESS: 'Prüfung',
  READY: 'Bereit',
  REVIEW: 'Prüfung erforderlich',
  QUARANTINED: 'Probleme gefunden',
  RESOLVED: 'Gelöst',
  COMMITTED: 'Übernommen',
  REJECTED: 'Abgelehnt',
};

export const RECORD_STATUS = {
  STAGING: 'STAGING',
  MAPPED: 'MAPPED',
  VALID: 'VALID',
  REVIEW: 'REVIEW',
  QUARANTINED: 'QUARANTINED',
  REJECTED: 'REJECTED',
  READY: 'READY',
} as const;

export type RecordStatus = typeof RECORD_STATUS[keyof typeof RECORD_STATUS];

export const QUALITY_TIERS = {
  TIER_1_VALID: 'TIER_1_VALID',
  TIER_2_REVIEWABLE: 'TIER_2_REVIEWABLE',
  TIER_3_QUARANTINED: 'TIER_3_QUARANTINED',
  TIER_4_REJECTED: 'TIER_4_REJECTED',
} as const;

export type QualityTier = typeof QUALITY_TIERS[keyof typeof QUALITY_TIERS];

export const QUALITY_TIER_LABELS: Record<QualityTier, string> = {
  TIER_1_VALID: 'Gültig',
  TIER_2_REVIEWABLE: 'Prüfbar',
  TIER_3_QUARANTINED: 'Quarantäne',
  TIER_4_REJECTED: 'Abgelehnt',
};

export const REVIEW_ACTIONS = {
  APPROVE: 'APPROVE',
  MODIFY: 'MODIFY',
  REJECT: 'REJECT',
  NEEDS_CLARIFICATION: 'NEEDS_CLARIFICATION',
} as const;

export type ReviewAction = typeof REVIEW_ACTIONS[keyof typeof REVIEW_ACTIONS];

export const REVIEW_ACTION_LABELS: Record<ReviewAction, string> = {
  APPROVE: 'Genehmigen',
  MODIFY: 'Korrigieren',
  REJECT: 'Ablehnen',
  NEEDS_CLARIFICATION: 'Rückfrage erforderlich',
};

// =============================================================================
// TRANSFORMATION TYPES
// =============================================================================

export const TRANSFORMATION_TYPES = {
  DIRECT: 'DIRECT',
  RENAME: 'RENAME',
  DATE_TO_WEEK_OFFSET: 'DATE_TO_WEEK_OFFSET',
  DECIMAL_TO_CENTS: 'DECIMAL_TO_CENTS',
  STATIC: 'STATIC',
  LOOKUP: 'LOOKUP',
  CONDITIONAL: 'CONDITIONAL',
  REGEX_EXTRACT: 'REGEX_EXTRACT',
  CONCATENATE: 'CONCATENATE',
  SPLIT: 'SPLIT',
} as const;

export type TransformationType = typeof TRANSFORMATION_TYPES[keyof typeof TRANSFORMATION_TYPES];

export const TRANSFORMATION_TYPE_LABELS: Record<TransformationType, string> = {
  DIRECT: 'Direkt übernehmen',
  RENAME: 'Umbenennen',
  DATE_TO_WEEK_OFFSET: 'Datum zu Woche',
  DECIMAL_TO_CENTS: 'Betrag zu Cent',
  STATIC: 'Fester Wert',
  LOOKUP: 'Nachschlagetabelle',
  CONDITIONAL: 'Bedingt',
  REGEX_EXTRACT: 'Muster extrahieren',
  CONCATENATE: 'Zusammenfügen',
  SPLIT: 'Aufteilen',
};

// =============================================================================
// MAPPING CONFIGURATION TYPES
// =============================================================================

export interface FieldMapping {
  id: string;
  sourceField: string;
  targetField: string;
  transformationType: TransformationType;
  transformationParams?: Record<string, unknown>;
  required: boolean;
  defaultValue?: string | null;
}

export interface ValueMapping {
  id: string;
  sourceField: string;
  targetField: string;
  mappingType: 'LOOKUP' | 'CONDITIONAL' | 'STATIC';
  lookupTable?: Record<string, string>;
  conditions?: Array<{ condition: string; result: string }>;
  staticValue?: string;
  caseSensitive?: boolean;
  unmappedAction: 'ERROR' | 'WARNING' | 'DEFAULT' | 'SKIP';
  defaultValue?: string;
}

export interface CategoryMapping {
  id: string;
  matchField: string;
  matchType: 'EQUALS' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'REGEX' | 'CONTAINS_ANY';
  matchValue?: string;
  matchValues?: string[];
  targetCategory: string;
  targetFlowType: 'INFLOW' | 'OUTFLOW';
  targetEstateType: 'ALTMASSE' | 'NEUMASSE';
  priority: number;
}

export interface MappingConfiguration {
  id: string;
  name: string;
  description?: string;
  sourceType: SourceType;
  projectId?: string;
  caseId?: string;
  version: number;
  isActive: boolean;
  fieldMappings: FieldMapping[];
  valueMappings: ValueMapping[];
  categoryMappings: CategoryMapping[];
  dateFormat: string;
  decimalSeparator: string;
  thousandsSeparator: string;
  sheetName?: string;
  headerRow: number;
}

// =============================================================================
// CANONICAL TARGET FIELDS
// =============================================================================

export const TARGET_FIELDS = {
  // Required fields
  WEEK_OFFSET: 'week_offset',
  AMOUNT_CENTS: 'amount_cents',
  LINE_NAME: 'line_name',
  FLOW_TYPE: 'flow_type',
  ESTATE_TYPE: 'estate_type',
  VALUE_TYPE: 'value_type',
  CATEGORY: 'category',

  // Optional fields
  DATE: 'date',
  DESCRIPTION: 'description',
  NOTE: 'note',
  REFERENCE: 'reference',
} as const;

export type TargetField = typeof TARGET_FIELDS[keyof typeof TARGET_FIELDS];

export const TARGET_FIELD_LABELS: Record<TargetField, string> = {
  week_offset: 'Woche',
  amount_cents: 'Betrag',
  line_name: 'Bezeichnung',
  flow_type: 'Art (Ein-/Auszahlung)',
  estate_type: 'Masse (Alt/Neu)',
  value_type: 'Werttyp (IST/PLAN)',
  category: 'Kategorie',
  date: 'Datum',
  description: 'Beschreibung',
  note: 'Notiz',
  reference: 'Referenz',
};

export const TARGET_FIELD_REQUIREMENTS: Record<TargetField, { required: boolean; description: string }> = {
  week_offset: { required: true, description: 'In welche der 13 Wochen fällt dieser Wert (0-12)' },
  amount_cents: { required: true, description: 'Der Betrag in Euro-Cent' },
  line_name: { required: true, description: 'Name der Position' },
  flow_type: { required: true, description: 'INFLOW (Einzahlung) oder OUTFLOW (Auszahlung)' },
  estate_type: { required: true, description: 'ALTMASSE oder NEUMASSE' },
  value_type: { required: true, description: 'IST (Ist-Wert) oder PLAN (Plan-Wert)' },
  category: { required: false, description: 'Zugeordnete Kategorie' },
  date: { required: false, description: 'Ursprüngliches Datum' },
  description: { required: false, description: 'Zusätzliche Beschreibung' },
  note: { required: false, description: 'Interne Notiz' },
  reference: { required: false, description: 'Externe Referenznummer' },
};

// =============================================================================
// REVIEW REASON CODES
// =============================================================================

export const REVIEW_REASON_CODES = {
  DATE_OUTSIDE_RANGE: 'DATE_OUTSIDE_RANGE',
  AMOUNT_UNUSUAL: 'AMOUNT_UNUSUAL',
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
  CATEGORY_AUTO_ASSIGNED: 'CATEGORY_AUTO_ASSIGNED',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  FLOW_TYPE_INFERRED: 'FLOW_TYPE_INFERRED',
  VALUE_CLAMPED: 'VALUE_CLAMPED',
  MISSING_OPTIONAL_FIELD: 'MISSING_OPTIONAL_FIELD',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
} as const;

export type ReviewReasonCode = typeof REVIEW_REASON_CODES[keyof typeof REVIEW_REASON_CODES];

export const REVIEW_REASON_LABELS: Record<ReviewReasonCode, string> = {
  DATE_OUTSIDE_RANGE: 'Datum außerhalb des 13-Wochen-Zeitraums',
  AMOUNT_UNUSUAL: 'Ungewöhnlicher Betrag',
  CATEGORY_NOT_FOUND: 'Kategorie nicht gefunden',
  CATEGORY_AUTO_ASSIGNED: 'Kategorie wurde automatisch zugewiesen',
  DUPLICATE_ENTRY: 'Möglicher Duplikat-Eintrag',
  FLOW_TYPE_INFERRED: 'Ein-/Auszahlung wurde abgeleitet',
  VALUE_CLAMPED: 'Wert wurde auf gültigen Bereich begrenzt',
  MISSING_OPTIONAL_FIELD: 'Optionales Feld fehlt',
  LOW_CONFIDENCE: 'Geringe Zuordnungs-Sicherheit',
};

// =============================================================================
// ERROR CODES
// =============================================================================

export const ERROR_CODES = {
  // Upload errors
  ING_001: { code: 'ING-001', message: 'Datei zu groß' },
  ING_002: { code: 'ING-002', message: 'Nicht unterstützter Dateityp' },
  ING_003: { code: 'ING-003', message: 'Datei beschädigt oder unlesbar' },
  ING_004: { code: 'ING-004', message: 'Ungültige Zeichenkodierung' },
  ING_005: { code: 'ING-005', message: 'Erforderliche Spalten fehlen' },

  // Validation errors
  VAL_001: { code: 'VAL-001', message: 'Pflichtfeld fehlt' },
  VAL_002: { code: 'VAL-002', message: 'Wert außerhalb des gültigen Bereichs' },
  VAL_003: { code: 'VAL-003', message: 'Ungültiger Wert' },
  VAL_004: { code: 'VAL-004', message: 'Doppelter Eintrag' },
  VAL_005: { code: 'VAL-005', message: 'Datum konnte nicht verarbeitet werden' },
  VAL_006: { code: 'VAL-006', message: 'Betrag konnte nicht verarbeitet werden' },
  VAL_007: { code: 'VAL-007', message: 'Woche außerhalb 0-12' },
} as const;

// =============================================================================
// INGESTION JOB TYPES
// =============================================================================

export interface IngestionJobSummary {
  id: string;
  caseId: string;
  caseName: string;
  caseNumber: string;
  sourceType: SourceType;
  fileName: string;
  fileHashSha256: string;
  fileSizeBytes: string;
  status: IngestionStatus;
  errorCount: number;
  warningCount: number;
  quarantinedCount: number;
  recordCountRaw: number | null;
  recordCountValid: number | null;
  recordCountNormalized: number | null;
  qualityScore: number | null;
  startedAt: string;
  completedAt: string | null;
  createdBy: string;
}

export interface IngestionRecordDetail {
  id: string;
  jobId: string;
  rowNumber: number;
  sheetName: string | null;
  rawData: Record<string, string>;
  mappedData: Record<string, unknown> | null;
  normalizedData: Record<string, unknown> | null;
  status: RecordStatus;
  qualityTier: QualityTier | null;
  validationErrors: string[] | null;
  validationWarnings: string[] | null;
}

export interface StagedEntryDetail {
  id: string;
  jobId: string;
  sourceRecordId: string;
  rowNumber: number;
  rawData: Record<string, string>;
  targetCategoryName: string;
  targetCategoryFlowType: 'INFLOW' | 'OUTFLOW';
  targetCategoryEstateType: 'ALTMASSE' | 'NEUMASSE';
  lineName: string;
  lineDescription: string | null;
  weekOffset: number;
  valueType: 'IST' | 'PLAN';
  amountCents: string;
  originalAmountRaw: string | null;
  note: string | null;
  confidenceScore: number | null;
  requiresReview: boolean;
  reviewReason: string | null;
  reviewReasonCode: ReviewReasonCode | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewAction: ReviewAction | null;
  reviewNote: string | null;
  status: string;
}

// =============================================================================
// LINEAGE TYPES
// =============================================================================

export interface LineageEntry {
  stage: 'RAW_FILE' | 'PARSED_RECORD' | 'TRANSFORMATION' | 'STAGED_ENTRY' | 'REVIEW' | 'COMMITTED';
  timestamp: string;
  data: Record<string, unknown>;
  actor?: string;
  action?: string;
}

export interface ValueLineage {
  weeklyValueId: string;
  amountCents: string;
  weekOffset: number;
  valueType: 'IST' | 'PLAN';
  lineage: LineageEntry[];
}

// =============================================================================
// QUALITY BREAKDOWN
// =============================================================================

export interface QualityBreakdown {
  total: number;
  valid: number;
  reviewable: number;
  quarantined: number;
  rejected: number;
  percentageValid: number;
  percentageReviewable: number;
  percentageQuarantined: number;
  percentageRejected: number;
}

export function calculateQualityBreakdown(
  valid: number,
  reviewable: number,
  quarantined: number,
  rejected: number
): QualityBreakdown {
  const total = valid + reviewable + quarantined + rejected;
  if (total === 0) {
    return {
      total: 0,
      valid: 0,
      reviewable: 0,
      quarantined: 0,
      rejected: 0,
      percentageValid: 0,
      percentageReviewable: 0,
      percentageQuarantined: 0,
      percentageRejected: 0,
    };
  }

  return {
    total,
    valid,
    reviewable,
    quarantined,
    rejected,
    percentageValid: Math.round((valid / total) * 100),
    percentageReviewable: Math.round((reviewable / total) * 100),
    percentageQuarantined: Math.round((quarantined / total) * 100),
    percentageRejected: Math.round((rejected / total) * 100),
  };
}
