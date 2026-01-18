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

  // Audit
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;

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
  from?: string; // ISO date
  to?: string; // ISO date
  limit?: number;
  offset?: number;
}

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
