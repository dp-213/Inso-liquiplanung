/**
 * Ledger System Type Definitions
 *
 * LedgerEntry is the Single Source of Truth for all cash transactions.
 * Case-bound (not plan-bound) - cash truth persists across plan changes.
 */

// =============================================================================
// ENUMS AND CONSTANTS
// =============================================================================

export const VALUE_TYPES = {
  IST: 'IST',
  PLAN: 'PLAN',
} as const;

export type ValueType = (typeof VALUE_TYPES)[keyof typeof VALUE_TYPES];

export const VALUE_TYPE_LABELS: Record<ValueType, string> = {
  IST: 'Ist-Wert',
  PLAN: 'Plan-Wert',
};

export const LEGAL_BUCKETS = {
  MASSE: 'MASSE',
  ABSONDERUNG: 'ABSONDERUNG',
  NEUTRAL: 'NEUTRAL',
  UNKNOWN: 'UNKNOWN',
} as const;

export type LegalBucket = (typeof LEGAL_BUCKETS)[keyof typeof LEGAL_BUCKETS];

export const LEGAL_BUCKET_LABELS: Record<LegalBucket, string> = {
  MASSE: 'Insolvenzmasse',
  ABSONDERUNG: 'Absonderung',
  NEUTRAL: 'Neutral',
  UNKNOWN: 'Nicht klassifiziert',
};

export const BOOKING_SOURCES = {
  BANK_ACCOUNT: 'BANK_ACCOUNT',
  CASH_REGISTER: 'CASH_REGISTER',
  ERP: 'ERP',
  MANUAL: 'MANUAL',
} as const;

export type BookingSource = (typeof BOOKING_SOURCES)[keyof typeof BOOKING_SOURCES];

export const BOOKING_SOURCE_LABELS: Record<BookingSource, string> = {
  BANK_ACCOUNT: 'Bankkonto',
  CASH_REGISTER: 'Kassenbuch',
  ERP: 'ERP-System',
  MANUAL: 'Manuelle Eingabe',
};

// =============================================================================
// GOVERNANCE TYPES (Review-Status)
// =============================================================================

export const REVIEW_STATUS = {
  UNREVIEWED: 'UNREVIEWED',
  CONFIRMED: 'CONFIRMED',
  ADJUSTED: 'ADJUSTED',
} as const;

export type ReviewStatus = (typeof REVIEW_STATUS)[keyof typeof REVIEW_STATUS];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  UNREVIEWED: 'Ungeprüft',
  CONFIRMED: 'Bestätigt',
  ADJUSTED: 'Korrigiert',
};

export const REVIEW_STATUS_COLORS: Record<ReviewStatus, string> = {
  UNREVIEWED: 'gray',
  CONFIRMED: 'green',
  ADJUSTED: 'amber',
};

// =============================================================================
// AUDIT LOG TYPES
// =============================================================================

export const AUDIT_ACTIONS = {
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  CONFIRMED: 'CONFIRMED',
  ADJUSTED: 'ADJUSTED',
  DELETED: 'DELETED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  CREATED: 'Erstellt',
  UPDATED: 'Aktualisiert',
  CONFIRMED: 'Bestätigt',
  ADJUSTED: 'Korrigiert',
  DELETED: 'Gelöscht',
};

/**
 * Field change record for audit log
 */
export interface FieldChange {
  old: string | number | null;
  new: string | number | null;
}

/**
 * Audit log entry as returned from API
 */
export interface LedgerAuditLogResponse {
  id: string;
  ledgerEntryId: string;
  caseId: string;
  action: AuditAction;
  fieldChanges: Record<string, FieldChange>;
  reason: string | null;
  userId: string;
  timestamp: string; // ISO date string
}

// =============================================================================
// AGGREGATION STATUS TYPES
// =============================================================================

export const AGGREGATION_STATUS = {
  CURRENT: 'CURRENT',
  STALE: 'STALE',
  REBUILDING: 'REBUILDING',
} as const;

export type AggregationStatus =
  (typeof AGGREGATION_STATUS)[keyof typeof AGGREGATION_STATUS];

export const AGGREGATION_STATUS_LABELS: Record<AggregationStatus, string> = {
  CURRENT: 'Aktuell',
  STALE: 'Veraltet',
  REBUILDING: 'Wird neu berechnet',
};

export const AGGREGATION_STATUS_COLORS: Record<AggregationStatus, string> = {
  CURRENT: 'green',
  STALE: 'amber',
  REBUILDING: 'blue',
};

/**
 * Aggregation status as returned from API
 */
export interface AggregationStatusResponse {
  status: AggregationStatus;
  reason?: string;
  pendingChanges: number;
  lastAggregatedAt: string | null; // ISO date string
  planId?: string;
}

// =============================================================================
// DERIVED TYPES (calculated at runtime)
// =============================================================================

export const FLOW_TYPES = {
  INFLOW: 'INFLOW',
  OUTFLOW: 'OUTFLOW',
} as const;

export type FlowType = (typeof FLOW_TYPES)[keyof typeof FLOW_TYPES];

/**
 * Derive flow type from amount sign
 * Positive = INFLOW, Negative = OUTFLOW
 */
export function deriveFlowType(amountCents: bigint): FlowType {
  return amountCents >= 0n ? FLOW_TYPES.INFLOW : FLOW_TYPES.OUTFLOW;
}

// =============================================================================
// LEDGER ENTRY TYPES
// =============================================================================

/**
 * Input for creating a new LedgerEntry
 */
export interface LedgerEntryInput {
  caseId: string;
  transactionDate: Date;
  amountCents: bigint;
  description: string;
  note?: string;
  valueType: ValueType;
  legalBucket?: LegalBucket;

  // Import origin (audit)
  importSource?: string;
  importJobId?: string;
  importFileHash?: string;
  importRowNumber?: number;

  // Booking source (business)
  bookingSource?: BookingSource;
  bookingSourceId?: string;
  bookingReference?: string;
}

/**
 * LedgerEntry as returned from API
 */
export interface LedgerEntryResponse {
  id: string;
  caseId: string;
  transactionDate: string; // ISO date string
  amountCents: string; // BigInt as string
  description: string;
  note: string | null;
  valueType: ValueType;
  legalBucket: LegalBucket;

  // Import origin
  importSource: string | null;
  importJobId: string | null;
  importFileHash: string | null;
  importRowNumber: number | null;

  // Booking source
  bookingSource: string | null;
  bookingSourceId: string | null;
  bookingReference: string | null;

  // Governance (Review-Status)
  reviewStatus: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null; // ISO date string
  reviewNote: string | null;

  // Governance (Änderungs-Tracking)
  changeReason: string | null;
  previousAmountCents: string | null; // BigInt as string

  // Audit
  createdAt: string;
  createdBy: string;
  updatedAt: string;

  // Derived (calculated at runtime)
  flowType: FlowType;
}

/**
 * Query parameters for fetching LedgerEntries
 */
export interface LedgerQueryParams {
  valueType?: ValueType;
  legalBucket?: LegalBucket;
  bookingSource?: BookingSource;
  reviewStatus?: ReviewStatus;
  from?: string; // ISO date
  to?: string; // ISO date
  limit?: number;
  offset?: number;
}

// =============================================================================
// REVIEW INPUT TYPES
// =============================================================================

/**
 * Input for confirming a LedgerEntry (no changes)
 */
export interface ConfirmReviewInput {
  action: 'CONFIRM';
  note?: string;
}

/**
 * Input for adjusting a LedgerEntry (with changes)
 */
export interface AdjustReviewInput {
  action: 'ADJUST';
  reason: string; // Pflichtfeld bei Korrektur
  changes: {
    amountCents?: bigint;
    description?: string;
    legalBucket?: LegalBucket;
    transactionDate?: Date;
  };
}

export type ReviewInput = ConfirmReviewInput | AdjustReviewInput;

// =============================================================================
// AGGREGATION TYPES
// =============================================================================

/**
 * Aggregated value for a specific period
 * Used for computing PeriodValue from LedgerEntries
 */
export interface AggregatedPeriodValue {
  periodIndex: number;
  valueType: ValueType;
  flowType: FlowType;
  totalAmountCents: bigint;
  entryCount: number;
  entryIds: string[];
}

/**
 * Parameters for period index calculation
 */
export interface PeriodIndexParams {
  transactionDate: Date;
  planStartDate: Date;
  periodType: 'WEEKLY' | 'MONTHLY';
  periodCount: number;
}

/**
 * Result of aggregating LedgerEntries for a plan
 */
export interface LedgerAggregationResult {
  planId: string;
  caseId: string;
  aggregatedAt: string;
  periods: AggregatedPeriodValue[];
  totalEntries: number;
  totalInflows: bigint;
  totalOutflows: bigint;
}

// =============================================================================
// SYNC TYPES
// =============================================================================

/**
 * Result of syncing LedgerEntries to PeriodValues
 */
export interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}
