/**
 * Normalized Import Context Schema
 *
 * ARCHITEKTUR-PRINZIP:
 * - Excel/CSV Spalten variieren je nach Quelle
 * - Normalisierung mappt variable Spalten auf stabile, fachliche Keys
 * - Regeln arbeiten NUR auf normalized, NIE auf raw oder LedgerEntry
 * - LedgerEntry erhält nur das Ergebnis (IDs), keine Rohdaten
 */

// =============================================================================
// NORMALIZED CONTEXT - Stabile fachliche Keys
// =============================================================================

/**
 * Normalisierte Import-Daten
 * Diese Struktur ist stabil und Excel-unabhängig.
 * Regeln matchen ausschließlich auf diese Felder.
 */
export interface NormalizedImportContext {
  // === CORE (immer vorhanden nach Normalisierung) ===
  datum: string;              // ISO-Datum oder deutsches Format
  betrag: number;             // Betrag als Zahl (positiv = Einzahlung, negativ = Auszahlung)
  bezeichnung: string;        // Verwendungszweck / Beschreibung

  // === DIMENSIONEN (aus variablen Excel-Spalten gemappt) ===
  standort?: string;          // Gemappt von: "Standort", "Praxis", "Filiale", "Niederlassung"
  counterpartyHint?: string;  // Gemappt von: "Debitor", "Auftraggeber", "Kreditor", "Gegenpartei"
  arzt?: string;              // Gemappt von: "Arzt", "Behandler", "Leistungserbringer"
  zeitraum?: string;          // Gemappt von: "Zeitraum", "Abrechnungszeitraum", "Periode"
  kategorie?: string;         // Gemappt von: "Kategorie", "Cashflow Kategorie", "Buchungsart"

  // === BANK-KONTEXT ===
  kontoname?: string;         // Gemappt von: "Kontoname", "Konto", "Bankverbindung"
  iban?: string;              // Gemappt von: "IBAN", "Kontonummer"

  // === ABRECHNUNGS-KONTEXT (Ärzte-spezifisch) ===
  lanr?: string;              // Lebenslange Arztnummer
  krankenkasse?: string;      // Gemappt von: "Krankenkasse", "Kostenträger", "KV"

  // === ZUSATZ-INFORMATIONEN ===
  referenz?: string;          // Gemappt von: "Referenz", "Belegnummer", "Rechnungsnummer"
  valuta?: string;            // Valutadatum falls abweichend
  waehrung?: string;          // Gemappt von: "Währung", "Whg", "Currency" (default: EUR)
}

/**
 * Vollständiger Import-Kontext für eine Zeile
 * Enthält sowohl Raw als auch Normalized
 */
export interface ImportContext {
  // Original Excel/CSV Daten (variabel, Key-Value)
  raw: Record<string, unknown>;

  // Normalisierte Daten (stabile Keys)
  normalized: NormalizedImportContext;

  // Meta-Informationen
  meta: {
    rowNumber: number;
    sheetName?: string;
    originalHeaders: string[];
    importedAt: string;
  };

  // Normalisierungs-Mapping (welche Spalte wurde auf welchen Key gemappt)
  fieldMapping: Record<string, string>;  // z.B. { "Standort": "standort", "Praxis": "standort" }
}

// =============================================================================
// NORMALISIERUNGS-MAPPINGS
// =============================================================================

/**
 * Standard-Mappings von Excel-Spaltennamen auf normalized Keys
 * Case-insensitive matching
 */
export const COLUMN_MAPPINGS: Record<string, string[]> = {
  // Core
  datum: ['datum', 'date', 'buchungsdatum', 'valuta', 'wertstellung'],
  betrag: ['betrag', 'amount', 'summe', 'wert', 'euro', 'eur'],
  bezeichnung: ['bezeichnung', 'beschreibung', 'verwendungszweck', 'text', 'buchungstext', 'transaktionsinformation'],

  // Dimensionen
  standort: ['standort', 'praxis', 'filiale', 'niederlassung', 'location', 'site'],
  counterpartyHint: ['debitor', 'kreditor', 'auftraggeber', 'empfänger', 'absender', 'gegenpartei', 'creditor name', 'debtor name', 'name'],
  arzt: ['arzt', 'behandler', 'leistungserbringer', 'doctor', 'physician'],
  zeitraum: ['zeitraum', 'abrechnungszeitraum', 'periode', 'period', 'quartal'],
  kategorie: ['kategorie', 'cashflow kategorie', 'buchungsart', 'category', 'type'],

  // Bank-Kontext
  kontoname: ['kontoname', 'konto', 'account', 'bankverbindung'],
  iban: ['iban', 'kontonummer', 'account number'],

  // Abrechnungs-Kontext
  lanr: ['lanr', 'arztnummer', 'lebenslange arztnummer'],
  krankenkasse: ['krankenkasse', 'kostenträger', 'kv', 'kasse', 'versicherung'],

  // Zusatz
  referenz: ['referenz', 'belegnummer', 'rechnungsnummer', 'reference', 'ref'],
  valuta: ['valuta', 'wertstellung', 'value date'],
  waehrung: ['währung', 'whg', 'currency', 'cur'],
};

/**
 * Findet den normalized Key für einen Excel-Spaltennamen
 */
export function findNormalizedKey(columnName: string): string | null {
  const lowerName = columnName.toLowerCase().trim();

  for (const [normalizedKey, variants] of Object.entries(COLUMN_MAPPINGS)) {
    if (variants.some(v => lowerName === v || lowerName.includes(v))) {
      return normalizedKey;
    }
  }

  return null;
}

/**
 * Normalisiert Raw-Daten zu NormalizedImportContext
 */
export function normalizeImportData(
  raw: Record<string, unknown>,
  customMappings?: Record<string, string>
): { normalized: NormalizedImportContext; fieldMapping: Record<string, string> } {
  const normalized: Partial<NormalizedImportContext> = {};
  const fieldMapping: Record<string, string> = {};

  for (const [columnName, value] of Object.entries(raw)) {
    // Skip meta fields
    if (columnName.startsWith('_')) continue;

    // Check custom mapping first, then fall back to automatic mapping
    const normalizedKey = customMappings?.[columnName] || findNormalizedKey(columnName);

    if (normalizedKey && value !== null && value !== undefined && value !== '') {
      // Type-specific handling
      if (normalizedKey === 'betrag') {
        // Parse amount
        const strValue = String(value).replace(/[€\s]/g, '').replace(',', '.');
        normalized.betrag = parseFloat(strValue) || 0;
      } else {
        // String value
        (normalized as Record<string, unknown>)[normalizedKey] = String(value).trim();
      }

      fieldMapping[columnName] = normalizedKey;
    }
  }

  // Ensure required fields have defaults
  if (!normalized.datum) normalized.datum = '';
  if (normalized.betrag === undefined) normalized.betrag = 0;
  if (!normalized.bezeichnung) normalized.bezeichnung = '';

  return {
    normalized: normalized as NormalizedImportContext,
    fieldMapping,
  };
}

// =============================================================================
// REGEL-MATCHING TYPES
// =============================================================================

/**
 * Felder auf denen Regeln matchen können
 * NUR normalized Fields - NIE raw oder LedgerEntry Fields
 */
export const RULE_MATCH_FIELDS = [
  'bezeichnung',
  'standort',
  'counterpartyHint',
  'arzt',
  'zeitraum',
  'kategorie',
  'kontoname',
  'krankenkasse',
  'lanr',
  'referenz',
] as const;

export type RuleMatchField = typeof RULE_MATCH_FIELDS[number];

/**
 * Labels für UI
 */
export const RULE_MATCH_FIELD_LABELS: Record<RuleMatchField, string> = {
  bezeichnung: 'Bezeichnung/Verwendungszweck',
  standort: 'Standort',
  counterpartyHint: 'Gegenpartei (Hinweis)',
  arzt: 'Arzt',
  zeitraum: 'Zeitraum',
  kategorie: 'Kategorie',
  kontoname: 'Kontoname',
  krankenkasse: 'Krankenkasse',
  lanr: 'LANR',
  referenz: 'Referenz',
};
