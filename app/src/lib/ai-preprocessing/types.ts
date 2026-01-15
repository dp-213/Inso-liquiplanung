/**
 * AI-Assisted Preprocessing Type Definitions
 *
 * This module defines types for the AI-assisted data preprocessing feature.
 * IMPORTANT: This feature provides SUGGESTIONS only. All results must be
 * reviewed and explicitly approved by a human operator before being used.
 */

// =============================================================================
// DOCUMENT TYPE DETECTION
// =============================================================================

/**
 * Detected document types for insolvency-related financial documents
 */
export const DOCUMENT_TYPES = {
  LIQUIDITAETSPLANUNG: 'LIQUIDITAETSPLANUNG',
  GUV_PL: 'GUV_PL',
  BWA: 'BWA',
  SUSA: 'SUSA',
  ZAHLUNGSTERMINE: 'ZAHLUNGSTERMINE',
  KONTOAUSZUG: 'KONTOAUSZUG',
  GEMISCHTES_FINANZDOKUMENT: 'GEMISCHTES_FINANZDOKUMENT',
  UNBEKANNT: 'UNBEKANNT',
} as const;

export type DocumentType = typeof DOCUMENT_TYPES[keyof typeof DOCUMENT_TYPES];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  LIQUIDITAETSPLANUNG: 'Liquiditaetsplanung',
  GUV_PL: 'GuV / Gewinn- und Verlustrechnung',
  BWA: 'Betriebswirtschaftliche Auswertung (BWA)',
  SUSA: 'Summen- und Saldenliste (SuSa)',
  ZAHLUNGSTERMINE: 'Zahlungsterminuebersicht (KV/HZV)',
  KONTOAUSZUG: 'Kontoauszug / Banktransaktionen',
  GEMISCHTES_FINANZDOKUMENT: 'Gemischtes Finanzdokument',
  UNBEKANNT: 'Dokumenttyp nicht erkannt',
};

export const DOCUMENT_TYPE_DESCRIPTIONS: Record<DocumentType, string> = {
  LIQUIDITAETSPLANUNG: 'Zukunftsorientierte Cashflow-Planung mit Einnahmen und Ausgaben pro Periode',
  GUV_PL: 'Periodengerechte Erfolgsrechnung - wird in Cashflows umgerechnet',
  BWA: 'Kurzfristige Leistungsrechnung - wird in Cashflows umgerechnet',
  SUSA: 'Kontensalden nach Kontonummer - wird nach Kontoart klassifiziert',
  ZAHLUNGSTERMINE: 'Kalenderartige Aufstellung von Zahlungsterminen (KV, HZV, Mieten)',
  KONTOAUSZUG: 'Einzeltransaktionen mit Datum und Betrag - direkte IST-Werte',
  GEMISCHTES_FINANZDOKUMENT: 'Dokument mit verschiedenen Finanzdaten - manuelle Pruefung empfohlen',
  UNBEKANNT: 'Dokumenttyp konnte nicht automatisch erkannt werden',
};

/**
 * Interpretation hints per document type
 */
export const DOCUMENT_TYPE_INTERPRETATION: Record<DocumentType, {
  usesDirectCashflow: boolean;
  requiresConversion: boolean;
  conversionNote: string;
  timeGranularity: 'weekly' | 'monthly' | 'transaction' | 'unknown';
  valueNature: 'IST' | 'PLAN' | 'mixed' | 'unknown';
}> = {
  LIQUIDITAETSPLANUNG: {
    usesDirectCashflow: true,
    requiresConversion: false,
    conversionNote: 'Werte direkt verwendbar',
    timeGranularity: 'weekly',
    valueNature: 'PLAN',
  },
  GUV_PL: {
    usesDirectCashflow: false,
    requiresConversion: true,
    conversionNote: 'Aus GuV abgeleitet - periodengerechte zu zahlungswirksamen Werten umgerechnet',
    timeGranularity: 'monthly',
    valueNature: 'IST',
  },
  BWA: {
    usesDirectCashflow: false,
    requiresConversion: true,
    conversionNote: 'Aus BWA abgeleitet - Zeitverzoegerung beruecksichtigt',
    timeGranularity: 'monthly',
    valueNature: 'IST',
  },
  SUSA: {
    usesDirectCashflow: false,
    requiresConversion: true,
    conversionNote: 'Aus Kontensalden abgeleitet - nach Kontoart klassifiziert',
    timeGranularity: 'monthly',
    valueNature: 'IST',
  },
  ZAHLUNGSTERMINE: {
    usesDirectCashflow: true,
    requiresConversion: false,
    conversionNote: 'Direkte Zahlungstermine verwendet',
    timeGranularity: 'transaction',
    valueNature: 'PLAN',
  },
  KONTOAUSZUG: {
    usesDirectCashflow: true,
    requiresConversion: false,
    conversionNote: 'Direkte Banktransaktionen - IST-Werte',
    timeGranularity: 'transaction',
    valueNature: 'IST',
  },
  GEMISCHTES_FINANZDOKUMENT: {
    usesDirectCashflow: false,
    requiresConversion: true,
    conversionNote: 'Gemischte Daten - individuelle Pruefung jeder Position',
    timeGranularity: 'unknown',
    valueNature: 'mixed',
  },
  UNBEKANNT: {
    usesDirectCashflow: false,
    requiresConversion: true,
    conversionNote: 'Dokumenttyp unbekannt - manuelle Klassifizierung erforderlich',
    timeGranularity: 'unknown',
    valueNature: 'unknown',
  },
};

// =============================================================================
// JOB STATUS
// =============================================================================

export const AI_JOB_STATUS = {
  CREATED: 'CREATED',
  PROCESSING: 'PROCESSING',
  REVIEW: 'REVIEW',
  CORRECTION: 'CORRECTION',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  COMMITTED: 'COMMITTED',
} as const;

export type AiJobStatus = typeof AI_JOB_STATUS[keyof typeof AI_JOB_STATUS];

export const AI_JOB_STATUS_LABELS: Record<AiJobStatus, string> = {
  CREATED: 'Erstellt',
  PROCESSING: 'KI-Verarbeitung',
  REVIEW: 'Zur Pruefung',
  CORRECTION: 'Korrektur',
  APPROVED: 'Freigegeben',
  REJECTED: 'Abgelehnt',
  COMMITTED: 'Uebernommen',
};

// =============================================================================
// FILE STATUS
// =============================================================================

export const AI_FILE_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR',
} as const;

export type AiFileStatus = typeof AI_FILE_STATUS[keyof typeof AI_FILE_STATUS];

export const AI_FILE_STATUS_LABELS: Record<AiFileStatus, string> = {
  PENDING: 'Wartend',
  PROCESSING: 'Wird verarbeitet',
  COMPLETED: 'Abgeschlossen',
  ERROR: 'Fehler',
};

// =============================================================================
// ROW STATUS
// =============================================================================

export const AI_ROW_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  MODIFIED: 'MODIFIED',
  UNCLEAR: 'UNCLEAR',
} as const;

export type AiRowStatus = typeof AI_ROW_STATUS[keyof typeof AI_ROW_STATUS];

export const AI_ROW_STATUS_LABELS: Record<AiRowStatus, string> = {
  PENDING: 'Zu pruefen',
  APPROVED: 'Genehmigt',
  REJECTED: 'Abgelehnt',
  MODIFIED: 'Korrigiert',
  UNCLEAR: 'Unklar',
};

// =============================================================================
// LOG ACTIONS
// =============================================================================

export const AI_LOG_ACTIONS = {
  UPLOAD: 'UPLOAD',
  AI_PROCESS: 'AI_PROCESS',
  AI_REPROCESS: 'AI_REPROCESS',
  REVIEW: 'REVIEW',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  MODIFY: 'MODIFY',
  MARK_UNCLEAR: 'MARK_UNCLEAR',
  COMMIT: 'COMMIT',
  ERROR: 'ERROR',
} as const;

export type AiLogAction = typeof AI_LOG_ACTIONS[keyof typeof AI_LOG_ACTIONS];

// =============================================================================
// CONFIDENCE LEVELS
// =============================================================================

export const CONFIDENCE_LEVELS = {
  HIGH: { min: 0.8, label: 'Hoch', color: 'green' },
  MEDIUM: { min: 0.5, label: 'Mittel', color: 'yellow' },
  LOW: { min: 0.0, label: 'Niedrig', color: 'red' },
} as const;

export function getConfidenceLevel(score: number): keyof typeof CONFIDENCE_LEVELS {
  if (score >= CONFIDENCE_LEVELS.HIGH.min) return 'HIGH';
  if (score >= CONFIDENCE_LEVELS.MEDIUM.min) return 'MEDIUM';
  return 'LOW';
}

export function getConfidenceColor(score: number): string {
  const level = getConfidenceLevel(score);
  return CONFIDENCE_LEVELS[level].color;
}

// =============================================================================
// AI SUGGESTION STRUCTURE
// =============================================================================

/**
 * Structure of AI's suggestion for a single cashflow row.
 * All fields are suggestions and must be verified by human review.
 */
export interface AiCashflowSuggestion {
  // Date/period information
  date?: string;           // Original date if found
  weekOffset?: number;     // Suggested week (0-12)
  period?: string;         // Period description if found

  // Amount information
  amount?: number;         // Amount in Euro (not cents)
  amountRaw?: string;      // Original amount string
  isInflow?: boolean;      // true = Einzahlung, false = Auszahlung

  // Classification - now uses insolvency-specific categories
  category?: string;       // Must be from INFLOW_CATEGORIES or OUTFLOW_CATEGORIES
  lineName?: string;       // Suggested line name
  estateType?: 'ALTMASSE' | 'NEUMASSE' | 'NICHT_ZUORDENBAR';  // Suggested estate type
  valueType?: 'IST' | 'PLAN' | 'UNSICHER';  // Suggested value type

  // Additional info
  description?: string;    // Additional description/note
  reference?: string;      // Reference number if found

  // Recurrence detection
  isRecurring?: boolean;   // Whether this appears to be recurring
  recurringPattern?: string; // e.g., "monthly", "weekly"

  // Insolvency-specific reasoning (required for business-level review)
  categoryReasoning?: string;      // Why this category was chosen
  estateTypeReasoning?: string;    // Why Alt/Neu classification

  // Uncertainty markers (required for transparency)
  categoryUncertainty?: 'SICHER' | 'WAHRSCHEINLICH' | 'UNSICHER' | 'UNBEKANNT';
  amountUncertainty?: 'SICHER' | 'WAHRSCHEINLICH' | 'UNSICHER' | 'UNBEKANNT';
  weekUncertainty?: 'SICHER' | 'WAHRSCHEINLICH' | 'UNSICHER' | 'UNBEKANNT';
  uncertaintyExplanation?: string; // Explanation if uncertain
}

/**
 * Per-field confidence breakdown
 */
export interface FieldConfidence {
  field: string;
  confidence: number;
  reason?: string;
}

/**
 * Complete AI suggestion for a row including metadata
 */
export interface AiRowSuggestion {
  suggestion: AiCashflowSuggestion;
  explanation: string;
  overallConfidence: number;
  fieldConfidences: FieldConfidence[];
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface CreateAiJobRequest {
  caseId: string;
  files: File[];
}

export interface AiJobSummary {
  id: string;
  caseId: string;
  caseName: string;
  caseNumber: string;
  status: AiJobStatus;
  totalFiles: number;
  processedFiles: number;
  iterationCount: number;
  totalRows: number;
  pendingRows: number;
  approvedRows: number;
  rejectedRows: number;
  modifiedRows: number;
  unclearRows: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface AiFileSummary {
  id: string;
  jobId: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: string;
  status: AiFileStatus;
  errorMessage?: string;
  rowCount: number;
  createdAt: string;
  documentType?: DocumentType;
  documentTypeExplanation?: string;
}

export interface AiRowDetail {
  id: string;
  jobId: string;
  fileId: string;
  fileName: string;
  sourceLocation: string;
  rawData: Record<string, unknown>;
  aiSuggestion: AiCashflowSuggestion;
  aiExplanation: string;
  confidenceScore: number;
  confidenceDetails: FieldConfidence[];
  status: AiRowStatus;
  humanEdits?: Record<string, unknown>;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface ReviewRowRequest {
  rowId: string;
  action: 'APPROVE' | 'REJECT' | 'MODIFY' | 'UNCLEAR';
  edits?: Partial<AiCashflowSuggestion>;
  reason?: string;
}

export interface CorrectionRequest {
  jobId: string;
  rowIds: string[];
  correctionText: string;
}

// =============================================================================
// SUPPORTED FILE TYPES
// =============================================================================

export const SUPPORTED_FILE_TYPES = {
  CSV: {
    extensions: ['.csv'],
    mimeTypes: ['text/csv', 'application/csv'],
    label: 'CSV-Datei',
  },
  EXCEL: {
    extensions: ['.xlsx', '.xls'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ],
    label: 'Excel-Datei',
  },
  PDF: {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    label: 'PDF-Dokument',
  },
} as const;

export function getFileType(fileName: string, mimeType?: string): keyof typeof SUPPORTED_FILE_TYPES | null {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));

  for (const [type, config] of Object.entries(SUPPORTED_FILE_TYPES)) {
    if ((config.extensions as readonly string[]).includes(ext)) {
      return type as keyof typeof SUPPORTED_FILE_TYPES;
    }
    if (mimeType && (config.mimeTypes as readonly string[]).includes(mimeType)) {
      return type as keyof typeof SUPPORTED_FILE_TYPES;
    }
  }

  return null;
}

export function isFileTypeSupported(fileName: string, mimeType?: string): boolean {
  return getFileType(fileName, mimeType) !== null;
}
