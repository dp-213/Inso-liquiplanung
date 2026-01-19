/**
 * Canonical Import Schema for Data Ingestion
 *
 * This module defines the ONE canonical, extensible schema for all data imports.
 * The schema is designed to be:
 * - Forward-compatible: Unknown columns are preserved, not rejected
 * - Minimal requirements: Only truly essential fields are required
 * - Extensible: Optional fields are first-class citizens when present
 *
 * CRITICAL RULE: The importer MUST tolerate additional columns without error.
 * Unknown columns are stored as metadata and can be used by future features
 * without re-importing data.
 */

// =============================================================================
// REQUIRED CORE FIELDS (Non-negotiable)
// =============================================================================

/**
 * The absolute minimum required fields for a valid import record.
 * If these are missing, the record CANNOT be processed.
 */
export interface RequiredCoreFields {
  /**
   * Datum (date of cash relevance)
   * Determines which week the cashflow entry belongs to.
   * Accepts various date formats (configured per import).
   */
  datum: string;

  /**
   * Betrag (amount in currency)
   * Can be provided as:
   * - Single "betrag" field (positive = inflow, negative = outflow)
   * - OR split into "einzahlung" and "auszahlung" fields
   */
  betrag?: string;

  /**
   * Bezeichnung (human-readable description)
   * The name/label for this cashflow position.
   */
  bezeichnung: string;
}

/**
 * Alternative amount representation (Einzahlung/Auszahlung split)
 */
export interface SplitAmountFields {
  /**
   * Einzahlung (inflow amount, always positive or zero)
   */
  einzahlung?: string;

  /**
   * Auszahlung (outflow amount, always positive or zero)
   */
  auszahlung?: string;
}

// =============================================================================
// OPTIONAL STANDARD FIELDS (First-class citizens)
// =============================================================================

/**
 * Standard optional fields that are fully supported when present.
 * These fields receive proper parsing, validation, and storage.
 */
export interface OptionalStandardFields {
  /**
   * Kategorie (liquidity category)
   * Used for grouping cashflow positions.
   */
  kategorie?: string;

  /**
   * Zahlungsart / Typ (payment type)
   * E.g., "Ueberweisung", "Lastschrift", "Bar"
   */
  zahlungsart?: string;
  typ?: string;

  /**
   * Alt-/Neuforderung (old vs new estate flag)
   * German insolvency law distinction.
   * Values: "alt", "neu", "altmasse", "neumasse", or similar
   */
  alt_neu_forderung?: string;
  massetyp?: string;

  /**
   * Konto (account reference)
   * Bank account or ledger account identifier.
   */
  konto?: string;

  /**
   * Gegenpartei (counterparty)
   * The other party in the transaction.
   */
  gegenpartei?: string;

  /**
   * Referenz (reference number)
   * Invoice number, transaction ID, etc.
   */
  referenz?: string;

  /**
   * Kommentar / Notiz (comment or note)
   * Free-text annotation.
   */
  kommentar?: string;
  notiz?: string;

  /**
   * Unsicherheitskennzeichen (uncertainty flag)
   * Indicates if this value is uncertain/estimated.
   */
  unsicherheit?: string;

  /**
   * Quelle (data source)
   * Where this data came from: "GuV", "Kontoauszug", "Planung", etc.
   */
  quelle?: string;

  /**
   * Werttyp (value type)
   * IST (actual) vs PLAN (forecast)
   */
  werttyp?: string;
}

// =============================================================================
// CANONICAL IMPORT RECORD
// =============================================================================

/**
 * A single row from an imported file after initial parsing.
 *
 * Structure:
 * - `coreFields`: The required fields (validated)
 * - `standardFields`: Known optional fields (parsed if present)
 * - `additionalFields`: Any unknown columns (preserved as-is)
 * - `_meta`: Import metadata (row number, source, etc.)
 */
export interface CanonicalImportRecord {
  /**
   * Required core fields - these MUST be present and valid
   */
  coreFields: {
    datum: string;
    betrag: string | null; // null if using split amount
    bezeichnung: string;
  };

  /**
   * Split amount fields (alternative to single betrag)
   */
  splitAmount: {
    einzahlung: string | null;
    auszahlung: string | null;
  } | null;

  /**
   * Standard optional fields that were found in the input
   */
  standardFields: Partial<OptionalStandardFields>;

  /**
   * Unknown columns - preserved exactly as imported
   * Key: lowercase column name, Value: original string value
   */
  additionalFields: Record<string, string>;

  /**
   * Import metadata
   */
  _meta: {
    rowNumber: number;
    sheetName: string | null;
    originalHeaders: string[];
    importedAt: string;
  };
}

// =============================================================================
// COLUMN NAME MAPPINGS
// =============================================================================

/**
 * Mapping of acceptable column names to canonical field names.
 * Case-insensitive matching is applied during import.
 *
 * Each canonical field can be represented by multiple column name variations.
 */
export const COLUMN_NAME_MAPPINGS: Record<string, string[]> = {
  // Required: Date - viele Varianten für Bankauszüge
  datum: [
    'datum', 'date', 'buchungsdatum', 'valuta', 'wertstellung',
    'faellig', 'fällig', 'faelligkeit', 'fälligkeit', 'termin',
    'buchungstag', 'wertstellungsdatum', 'valutadatum',
    'transaktionsdatum', 'umsatzdatum', 'tag',
  ],

  // Required: Amount (single) - viele Varianten
  betrag: [
    'betrag', 'amount', 'summe', 'wert', 'euro', 'eur', 'value',
    'umsatz', 'transaktion', 'buchung', 'zahlung',
    'betrag eur', 'betrag in eur', 'betrag (eur)', 'betrag €',
  ],

  // Required: Amount (split - inflow)
  einzahlung: [
    'einzahlung', 'einnahme', 'einnahmen', 'zufluss', 'haben', 'credit', 'inflow', 'eingang',
    'gutschrift', 'eingang eur', 'haben eur',
  ],

  // Required: Amount (split - outflow)
  auszahlung: [
    'auszahlung', 'ausgabe', 'ausgaben', 'abfluss', 'soll', 'debit', 'outflow', 'ausgang',
    'belastung', 'lastschrift', 'ausgang eur', 'soll eur',
  ],

  // Required: Description - viele Varianten für Bankauszüge
  bezeichnung: [
    'bezeichnung', 'beschreibung', 'name', 'position', 'text',
    'verwendungszweck', 'buchungstext', 'description', 'label',
    'info', 'details', 'zahlungsgrund', 'grund', 'zweck',
    'empfaenger', 'empfänger', 'auftraggeber', 'partner',
    'zahlungsempfaenger', 'zahlungsempfänger', 'beguenstigter', 'begünstigter',
    'empfänger/auftraggeber', 'name/verwendungszweck',
    'buchungsinformation', 'transaktionstext', 'umsatztext',
    // HVPlus / Banksoftware-Exporte
    'transaktionsinformation', 'transaktion', 'information',
    // Note: 'creditor name', 'debtor name' moved to gegenpartei - they are counterparty info, not description
  ],

  // Optional: Category
  kategorie: ['kategorie', 'category', 'gruppe', 'group', 'art', 'type', 'klasse', 'cashflow kategorie', 'cashflow-kategorie', 'cashflowkategorie'],

  // Optional: Payment type
  zahlungsart: ['zahlungsart', 'typ', 'type', 'payment_type', 'transaction_type'],

  // Optional: Estate type (Alt/Neu)
  alt_neu_forderung: ['alt_neu', 'altneu', 'masse', 'massetyp', 'estate', 'estate_type', 'forderungsart', 'altmasse', 'neumasse'],

  // Optional: Account
  konto: ['konto', 'account', 'kontonummer', 'account_number', 'bank', 'iban'],

  // Optional: Counterparty
  gegenpartei: ['gegenpartei', 'partner', 'counterparty', 'debitor', 'kreditor', 'kunde', 'lieferant',
    'creditor name', 'debtor name', 'kreditorname', 'debitorname'],

  // Optional: Reference
  referenz: ['referenz', 'reference', 'ref', 'rechnungsnummer', 'invoice', 'belegnummer', 'beleg'],

  // Optional: Comment
  kommentar: ['kommentar', 'notiz', 'note', 'comment', 'bemerkung', 'anmerkung', 'hinweis'],

  // Optional: Uncertainty
  unsicherheit: ['unsicherheit', 'uncertainty', 'unsicher', 'geschaetzt', 'estimated', 'flag'],

  // Optional: Source
  quelle: ['quelle', 'source', 'herkunft', 'origin', 'datenquelle'],

  // Optional: Value type
  werttyp: ['werttyp', 'ist_plan', 'value_type', 'ist', 'plan', 'actual_forecast'],
};

/**
 * Reverse mapping: column name -> canonical field name
 * Built dynamically from COLUMN_NAME_MAPPINGS
 */
export function buildColumnToCanonicalMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [canonical, variations] of Object.entries(COLUMN_NAME_MAPPINGS)) {
    for (const variation of variations) {
      map.set(variation.toLowerCase(), canonical);
    }
  }
  return map;
}

// =============================================================================
// VALIDATION RESULT TYPES
// =============================================================================

/**
 * Validation error for a specific field
 */
export interface FieldValidationError {
  field: string;
  code: string;
  message: string; // German, user-facing
  value?: string;
}

/**
 * Result of validating a single import record
 */
export interface RecordValidationResult {
  valid: boolean;
  errors: FieldValidationError[];
  warnings: FieldValidationWarning[];
  record: CanonicalImportRecord | null;
}

/**
 * Validation warning (non-blocking)
 */
export interface FieldValidationWarning {
  field: string;
  code: string;
  message: string; // German, user-facing
  value?: string;
}

/**
 * Result of validating an entire file
 */
export interface FileValidationResult {
  valid: boolean;
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  errors: Array<{ rowNumber: number; errors: FieldValidationError[] }>;
  warnings: Array<{ rowNumber: number; warnings: FieldValidationWarning[] }>;
  records: CanonicalImportRecord[];
  detectedColumns: {
    required: string[];
    optional: string[];
    unknown: string[];
  };
}

// =============================================================================
// ERROR CODES (German messages)
// =============================================================================

export const VALIDATION_ERROR_CODES = {
  // Required field errors
  MISSING_DATUM: {
    code: 'ERR_MISSING_DATUM',
    message: 'Pflichtfeld "Datum" fehlt. Bitte stellen Sie sicher, dass eine Spalte mit Datumswerten vorhanden ist.',
  },
  MISSING_BETRAG: {
    code: 'ERR_MISSING_BETRAG',
    message: 'Pflichtfeld "Betrag" fehlt. Es muss entweder eine "Betrag"-Spalte oder "Einzahlung"/"Auszahlung"-Spalten geben.',
  },
  MISSING_BEZEICHNUNG: {
    code: 'ERR_MISSING_BEZEICHNUNG',
    message: 'Pflichtfeld "Bezeichnung" fehlt. Bitte stellen Sie sicher, dass eine Spalte mit Positionsbezeichnungen vorhanden ist.',
  },

  // Format errors
  INVALID_DATE_FORMAT: {
    code: 'ERR_INVALID_DATE',
    message: 'Ungueltiges Datumsformat. Erwartet wird ein Datum im Format TT.MM.JJJJ.',
  },
  INVALID_AMOUNT_FORMAT: {
    code: 'ERR_INVALID_AMOUNT',
    message: 'Ungueltiges Betragsformat. Erwartet wird eine Zahl (z.B. "1.234,56" oder "1234.56").',
  },
  EMPTY_BEZEICHNUNG: {
    code: 'ERR_EMPTY_BEZEICHNUNG',
    message: 'Die Bezeichnung darf nicht leer sein.',
  },

  // Ambiguous amount
  AMBIGUOUS_AMOUNT: {
    code: 'ERR_AMBIGUOUS_AMOUNT',
    message: 'Sowohl "Betrag" als auch "Einzahlung/Auszahlung" vorhanden. Bitte verwenden Sie nur eine Variante.',
  },
} as const;

export const VALIDATION_WARNING_CODES = {
  // Optional field warnings
  UNKNOWN_COLUMN_PRESERVED: {
    code: 'WARN_UNKNOWN_COLUMN',
    message: 'Unbekannte Spalte "{column}" wurde als Zusatzfeld gespeichert.',
  },
  EMPTY_OPTIONAL_FIELD: {
    code: 'WARN_EMPTY_OPTIONAL',
    message: 'Optionales Feld "{field}" ist leer.',
  },
  DATE_OUTSIDE_RANGE: {
    code: 'WARN_DATE_RANGE',
    message: 'Datum liegt ausserhalb des 13-Wochen-Planungszeitraums.',
  },
} as const;

// =============================================================================
// SCHEMA VERSION
// =============================================================================

/**
 * Schema version for forward compatibility tracking.
 * Increment when schema structure changes.
 */
export const CANONICAL_SCHEMA_VERSION = '1.0.0';

/**
 * Schema metadata stored with each import job
 */
export interface ImportSchemaMetadata {
  schemaVersion: string;
  importedAt: string;
  originalHeaders: string[];
  mappedFields: {
    required: Record<string, string>; // canonical -> original column name
    optional: Record<string, string>;
  };
  unmappedColumns: string[];
}
