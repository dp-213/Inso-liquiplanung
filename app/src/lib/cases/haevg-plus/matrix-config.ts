/**
 * HVPlus Liquiditätsmatrix Konfiguration
 *
 * IDW S11-konforme Struktur mit 4 Blöcken:
 *
 * I.  FINANZMITTELBESTAND PERIODENANFANG
 * II. EINZAHLUNGEN
 *     - Umsatz (Neumasse): HZV, KV, PVS
 *     - Altforderungen: HZV, KV, PVS
 *     - Sonstige: Inso-Einz., Auskehrungen, Sonstige
 * III. AUSZAHLUNGEN
 *     - Personal (mit Sozialabg., Altverb.)
 *     - Betriebskosten (mit Standort-Detail, Altverb.)
 *     - Steuern
 *     - Insolvenzspezifische Auszahlungen
 *     - Summe Auszahlungen
 * IV. LIQUIDITÄTSENTWICKLUNG
 *     - Veränderung, EoP, Kreditlinie, Überdeckung, Rückstellungen
 *
 * STANDORT-LOGIK:
 *   Standort-Detail-Zeilen (parentRowId) werden über parallel-gefetchte
 *   Scope-Daten gefüllt. parentRowId steuert nur die Visibility (Collapse).
 *
 * MATCHING:
 *   Zweistufig: (1) CATEGORY_TAG für PLAN-Daten, (2) andere Kriterien für IST.
 */

// =============================================================================
// TYPES
// =============================================================================

export type LiquidityScope =
  | 'GLOBAL'
  | 'LOCATION_VELBERT'
  | 'LOCATION_UCKERATH_EITORF';

export const LIQUIDITY_SCOPE_LABELS: Record<LiquidityScope, string> = {
  GLOBAL: 'Gesamt',
  LOCATION_VELBERT: 'Velbert',
  LOCATION_UCKERATH_EITORF: 'Uckerath/Eitorf',
};

export type MatrixBlockId =
  | 'OPENING_BALANCE'
  | 'CASH_IN'
  | 'CASH_OUT'
  | 'LIQUIDITY_DEVELOPMENT';

export type MatrixRowMatchType =
  | 'COUNTERPARTY_ID'
  | 'COUNTERPARTY_PATTERN'
  | 'LOCATION_ID'
  | 'DESCRIPTION_PATTERN'
  | 'LEGAL_BUCKET'
  | 'CATEGORY_TAG'
  | 'BANK_ACCOUNT_ID'
  | 'FALLBACK';

export interface MatrixRowMatch {
  type: MatrixRowMatchType;
  value: string;
  description?: string;
}

export interface MatrixRowConfig {
  id: string;
  label: string;
  labelShort?: string;
  block: MatrixBlockId;
  order: number;
  isSubRow: boolean;
  isSummary: boolean;
  isSectionHeader?: boolean;
  isSubtotal?: boolean;       // Zwischensumme (bold, Linie oben)
  parentRowId?: string;        // Collapse-Eltern-Zeile
  defaultExpanded?: boolean;   // Kinder sichtbar? (default: true)
  matches: MatrixRowMatch[];
  matchDescription?: string;
  flowType?: 'INFLOW' | 'OUTFLOW';
  bankAccountId?: string;
  visibleInScopes?: LiquidityScope[];
}

export interface MatrixBlockConfig {
  id: MatrixBlockId;
  label: string;
  order: number;
  summaryRowId: string;
  cssClass?: string;
}

export interface LiquidityMatrixConfig {
  caseId: string;
  caseName: string;
  blocks: MatrixBlockConfig[];
  rows: MatrixRowConfig[];
}

// =============================================================================
// HVPLUS MATRIX KONFIGURATION — 4 Blöcke (IDW S11)
// =============================================================================

export const HVPLUS_MATRIX_BLOCKS: MatrixBlockConfig[] = [
  {
    id: 'OPENING_BALANCE',
    label: 'I. Finanzmittelbestand Periodenanfang',
    order: 1,
    summaryRowId: 'opening_balance_total',
    cssClass: 'bg-gray-50',
  },
  {
    id: 'CASH_IN',
    label: 'II. Einzahlungen',
    order: 2,
    summaryRowId: 'cash_in_total',
    cssClass: 'bg-green-50',
  },
  {
    id: 'CASH_OUT',
    label: 'III. Auszahlungen',
    order: 3,
    summaryRowId: 'cash_out_total',
    cssClass: 'bg-red-50',
  },
  {
    id: 'LIQUIDITY_DEVELOPMENT',
    label: 'IV. Liquiditätsentwicklung',
    order: 4,
    summaryRowId: 'coverage_after_reserves',
    cssClass: 'bg-blue-50',
  },
];

// =============================================================================
// ZEILEN-KONFIGURATION
//
// Anzeige-Reihenfolge = order. Match-Reihenfolge ist unabhängig davon
// (zweistufiges Matching: erst CATEGORY_TAG, dann andere Kriterien).
// =============================================================================

export const HVPLUS_MATRIX_ROWS: MatrixRowConfig[] = [
  // ─── BLOCK I: OPENING BALANCE ──────────────────────────────────────
  {
    id: 'opening_balance_total',
    label: 'Guthaben (+) / Kreditinanspruchnahme (−)',
    block: 'OPENING_BALANCE',
    order: 1,
    isSubRow: false,
    isSummary: true,
    matches: [],
  },

  // ─── BLOCK II: EINZAHLUNGEN ────────────────────────────────────────

  {
    id: 'cash_in_total',
    label: 'Summe Einzahlungen',
    block: 'CASH_IN',
    order: 1,
    isSubRow: false,
    isSummary: true,
    matches: [],
    flowType: 'INFLOW',
  },

  // --- Umsatz / Neumasse ---
  {
    id: 'cash_in_umsatz_header',
    label: 'Umsatz (Neumasse)',
    block: 'CASH_IN',
    order: 5,
    isSubRow: false,
    isSummary: false,
    isSectionHeader: true,
    matches: [],
    flowType: 'INFLOW',
  },
  {
    id: 'cash_in_hzv',
    label: 'HZV',
    labelShort: 'HZV',
    block: 'CASH_IN',
    order: 10,
    isSubRow: true,
    isSummary: false,
    defaultExpanded: false,
    flowType: 'INFLOW',
    matchDescription: 'Einnahmen aus Hausarztzentrierter Versorgung (HZV/HAVG).',
    matches: [
      { type: 'CATEGORY_TAG', value: 'HZV', description: 'Buchungen mit Kategorie-Tag „HZV"' },
      { type: 'COUNTERPARTY_PATTERN', value: '(HZV|HAVG|HAEVG|Hausarzt)', description: 'Gegenpartei enthält „HZV", „HAVG", „HAEVG" oder „Hausarzt"' },
    ],
  },
  {
    id: 'cash_in_hzv_velbert',
    label: 'Velbert',
    block: 'CASH_IN',
    order: 11,
    isSubRow: true,
    isSummary: false,
    parentRowId: 'cash_in_hzv',
    matches: [],
    flowType: 'INFLOW',
  },
  {
    id: 'cash_in_hzv_uckerath',
    label: 'Uckerath/Eitorf',
    block: 'CASH_IN',
    order: 12,
    isSubRow: true,
    isSummary: false,
    parentRowId: 'cash_in_hzv',
    matches: [],
    flowType: 'INFLOW',
  },
  {
    id: 'cash_in_kv',
    label: 'KV',
    labelShort: 'KV',
    block: 'CASH_IN',
    order: 15,
    isSubRow: true,
    isSummary: false,
    defaultExpanded: false,
    flowType: 'INFLOW',
    matchDescription: 'Einnahmen der Kassenärztlichen Vereinigung (KVNO).',
    matches: [
      { type: 'CATEGORY_TAG', value: 'KV', description: 'Buchungen mit Kategorie-Tag „KV"' },
      { type: 'COUNTERPARTY_PATTERN', value: '(KV|KVNO|Kassenärztliche)', description: 'Gegenpartei enthält „KV", „KVNO" oder „Kassenärztliche"' },
    ],
  },
  {
    id: 'cash_in_kv_velbert',
    label: 'Velbert',
    block: 'CASH_IN',
    order: 16,
    isSubRow: true,
    isSummary: false,
    parentRowId: 'cash_in_kv',
    matches: [],
    flowType: 'INFLOW',
  },
  {
    id: 'cash_in_kv_uckerath',
    label: 'Uckerath/Eitorf',
    block: 'CASH_IN',
    order: 17,
    isSubRow: true,
    isSummary: false,
    parentRowId: 'cash_in_kv',
    matches: [],
    flowType: 'INFLOW',
  },
  {
    id: 'cash_in_pvs',
    label: 'PVS',
    labelShort: 'PVS',
    block: 'CASH_IN',
    order: 20,
    isSubRow: true,
    isSummary: false,
    defaultExpanded: false,
    flowType: 'INFLOW',
    matchDescription: 'Einnahmen über Privatärztliche Verrechnungsstelle (PVS).',
    matches: [
      { type: 'CATEGORY_TAG', value: 'PVS', description: 'Buchungen mit Kategorie-Tag „PVS"' },
      { type: 'COUNTERPARTY_PATTERN', value: '(PVS|Privat|Privatpatient)', description: 'Gegenpartei enthält „PVS", „Privat" oder „Privatpatient"' },
    ],
  },
  {
    id: 'cash_in_pvs_velbert',
    label: 'Velbert',
    block: 'CASH_IN',
    order: 21,
    isSubRow: true,
    isSummary: false,
    parentRowId: 'cash_in_pvs',
    matches: [],
    flowType: 'INFLOW',
  },
  {
    id: 'cash_in_pvs_uckerath',
    label: 'Uckerath/Eitorf',
    block: 'CASH_IN',
    order: 22,
    isSubRow: true,
    isSummary: false,
    parentRowId: 'cash_in_pvs',
    matches: [],
    flowType: 'INFLOW',
  },

  // --- Altforderungen (Altmasse) ---
  {
    id: 'cash_in_altforderung_header',
    label: 'Altforderungen (Altmasse)',
    block: 'CASH_IN',
    order: 30,
    isSubRow: false,
    isSummary: false,
    isSectionHeader: true,
    matches: [],
    flowType: 'INFLOW',
  },
  {
    id: 'cash_in_altforderung_hzv',
    label: 'Altforderungen HZV',
    labelShort: 'Alt HZV',
    block: 'CASH_IN',
    order: 31,
    isSubRow: true,
    isSummary: false,
    defaultExpanded: false,
    flowType: 'INFLOW',
    matchDescription: 'HZV-Altforderungen: Vor Insolvenzeröffnung erbrachte Leistungen.',
    matches: [
      { type: 'CATEGORY_TAG', value: 'ALTFORDERUNG_HZV', description: 'Buchungen mit Kategorie-Tag „ALTFORDERUNG_HZV"' },
    ],
  },
  {
    id: 'cash_in_altforderung_hzv_velbert',
    label: 'Velbert',
    block: 'CASH_IN',
    order: 32,
    isSubRow: true,
    isSummary: false,
    parentRowId: 'cash_in_altforderung_hzv',
    matches: [],
    flowType: 'INFLOW',
  },
  {
    id: 'cash_in_altforderung_hzv_uckerath',
    label: 'Uckerath/Eitorf',
    block: 'CASH_IN',
    order: 33,
    isSubRow: true,
    isSummary: false,
    parentRowId: 'cash_in_altforderung_hzv',
    matches: [],
    flowType: 'INFLOW',
  },
  {
    id: 'cash_in_altforderung_kv',
    label: 'Altforderungen KV',
    labelShort: 'Alt KV',
    block: 'CASH_IN',
    order: 35,
    isSubRow: true,
    isSummary: false,
    defaultExpanded: false,
    flowType: 'INFLOW',
    matchDescription: 'KV-Altforderungen: Vor Insolvenzeröffnung erbrachte Leistungen.',
    matches: [
      { type: 'CATEGORY_TAG', value: 'ALTFORDERUNG_KV', description: 'Buchungen mit Kategorie-Tag „ALTFORDERUNG_KV"' },
    ],
  },
  {
    id: 'cash_in_altforderung_kv_velbert',
    label: 'Velbert',
    block: 'CASH_IN',
    order: 36,
    isSubRow: true,
    isSummary: false,
    parentRowId: 'cash_in_altforderung_kv',
    matches: [],
    flowType: 'INFLOW',
  },
  {
    id: 'cash_in_altforderung_kv_uckerath',
    label: 'Uckerath/Eitorf',
    block: 'CASH_IN',
    order: 37,
    isSubRow: true,
    isSummary: false,
    parentRowId: 'cash_in_altforderung_kv',
    matches: [],
    flowType: 'INFLOW',
  },
  {
    id: 'cash_in_altforderung_pvs',
    label: 'Altforderungen PVS',
    labelShort: 'Alt PVS',
    block: 'CASH_IN',
    order: 39,
    isSubRow: true,
    isSummary: false,
    defaultExpanded: false,
    flowType: 'INFLOW',
    matchDescription: 'PVS-Altforderungen: Vor Insolvenzeröffnung erbrachte Leistungen.',
    matches: [
      { type: 'CATEGORY_TAG', value: 'ALTFORDERUNG_PVS', description: 'Buchungen mit Kategorie-Tag „ALTFORDERUNG_PVS"' },
    ],
  },
  {
    id: 'cash_in_altforderung_pvs_velbert',
    label: 'Velbert',
    block: 'CASH_IN',
    order: 40,
    isSubRow: true,
    isSummary: false,
    parentRowId: 'cash_in_altforderung_pvs',
    matches: [],
    flowType: 'INFLOW',
  },
  {
    id: 'cash_in_altforderung_pvs_uckerath',
    label: 'Uckerath/Eitorf',
    block: 'CASH_IN',
    order: 41,
    isSubRow: true,
    isSummary: false,
    parentRowId: 'cash_in_altforderung_pvs',
    matches: [],
    flowType: 'INFLOW',
  },

  // --- Sonstige Einzahlungen ---
  {
    id: 'cash_in_sonstige_header',
    label: 'Sonstige Einzahlungen',
    block: 'CASH_IN',
    order: 50,
    isSubRow: false,
    isSummary: false,
    isSectionHeader: true,
    matches: [],
    flowType: 'INFLOW',
  },
  {
    id: 'cash_in_inso',
    label: 'Insolvenzspezifische Einzahlungen',
    labelShort: 'Inso Ein',
    block: 'CASH_IN',
    order: 51,
    isSubRow: true,
    isSummary: false,
    flowType: 'INFLOW',
    visibleInScopes: ['GLOBAL'],
    matchDescription: 'Insolvenzspezifische Einzahlungen (z.B. Massekredit-Auszahlungen).',
    matches: [
      { type: 'CATEGORY_TAG', value: 'INSO_EINZAHLUNG', description: 'Buchungen mit Kategorie-Tag „INSO_EINZAHLUNG"' },
      { type: 'DESCRIPTION_PATTERN', value: '(insolvenzspezifisch.*Einzahlung)', description: 'Buchungstext enthält „insolvenzspezifisch" und „Einzahlung"' },
    ],
  },
  {
    id: 'cash_in_auskehrungen',
    label: 'Auskehrungen Altkonten',
    labelShort: 'Auskehr.',
    block: 'CASH_IN',
    order: 52,
    isSubRow: true,
    isSummary: false,
    flowType: 'INFLOW',
    matchDescription: 'Auskehrungen von alten Bankkonten auf das Anderkonto/Massekonto.',
    matches: [
      { type: 'CATEGORY_TAG', value: 'AUSKEHRUNG_ALTKONTEN', description: 'Buchungen mit Kategorie-Tag „AUSKEHRUNG_ALTKONTEN"' },
    ],
  },
  {
    id: 'cash_in_einnahmen_sonstige',
    label: 'Sonstige Einnahmen (Gutachten, Privatpatienten)',
    labelShort: 'Sonst. Einnahmen',
    block: 'CASH_IN',
    order: 53,
    isSubRow: true,
    isSummary: false,
    flowType: 'INFLOW',
    matchDescription: 'Sonstige Einnahmen wie Gutachten, Privatpatienten-Direktzahlungen.',
    matches: [
      { type: 'CATEGORY_TAG', value: 'EINNAHME_SONSTIGE', description: 'Buchungen mit Kategorie-Tag „EINNAHME_SONSTIGE"' },
    ],
  },
  {
    id: 'cash_in_sonstige',
    label: 'Sonstige',
    labelShort: 'Sonstige',
    block: 'CASH_IN',
    order: 99,
    isSubRow: true,
    isSummary: false,
    flowType: 'INFLOW',
    matchDescription: 'Auffangzeile für alle Einzahlungen ohne spezifische Zuordnung.',
    matches: [{ type: 'FALLBACK', value: 'INFLOW', description: 'Alle übrigen Einzahlungen' }],
  },

  // ─── BLOCK III: AUSZAHLUNGEN ───────────────────────────────────────

  // --- Betriebliche Auszahlungen ---
  {
    id: 'cash_out_personal',
    label: 'Personalaufwand',
    labelShort: 'Personal',
    block: 'CASH_OUT',
    order: 10,
    isSubRow: true,
    isSummary: false,
    defaultExpanded: false,
    flowType: 'OUTFLOW',
    visibleInScopes: ['GLOBAL'],
    matchDescription: 'Personalaufwand (Löhne, Gehälter).',
    matches: [
      { type: 'CATEGORY_TAG', value: 'PERSONAL', description: 'Buchungen mit Kategorie-Tag „PERSONAL"' },
      { type: 'DESCRIPTION_PATTERN', value: '(Lohn|Gehalt|Personal|SV-Beitrag|Sozialversicherung)', description: 'Buchungstext enthält Lohn, Gehalt, Personal, SV-Beitrag oder Sozialversicherung' },
    ],
  },
  {
    id: 'cash_out_personal_sozial',
    label: 'Sozialabgaben (AG-Anteil)',
    labelShort: 'Sozialabg.',
    block: 'CASH_OUT',
    order: 11,
    isSubRow: true,
    isSummary: false,
    parentRowId: 'cash_out_personal',
    flowType: 'OUTFLOW',
    visibleInScopes: ['GLOBAL'],
    matchDescription: 'Arbeitgeber-Anteile zur Sozialversicherung.',
    matches: [
      { type: 'CATEGORY_TAG', value: 'SOZIALABGABEN', description: 'Buchungen mit Kategorie-Tag „SOZIALABGABEN"' },
    ],
  },
  {
    id: 'cash_out_altverb_personal',
    label: 'Personalaufwand (Altmasse)',
    labelShort: 'Personal (Alt)',
    block: 'CASH_OUT',
    order: 12,
    isSubRow: true,
    isSummary: false,
    parentRowId: 'cash_out_personal',
    flowType: 'OUTFLOW',
    matchDescription: 'Personal-Altverbindlichkeiten: Lohnforderungen von vor Insolvenzeröffnung.',
    matches: [
      { type: 'CATEGORY_TAG', value: 'ALTVERBINDLICHKEIT_PERSONAL', description: 'Buchungen mit Kategorie-Tag „ALTVERBINDLICHKEIT_PERSONAL"' },
    ],
  },

  {
    id: 'cash_out_betriebskosten',
    label: 'Betriebskosten',
    labelShort: 'Betriebsk.',
    block: 'CASH_OUT',
    order: 20,
    isSubRow: true,
    isSummary: false,
    defaultExpanded: false,
    flowType: 'OUTFLOW',
    matchDescription: 'Laufende Betriebskosten (Miete, Strom, IT, Versicherungen, etc.).',
    matches: [
      { type: 'CATEGORY_TAG', value: 'BETRIEBSKOSTEN', description: 'Allgemeine Betriebskosten' },
      { type: 'CATEGORY_TAG', value: 'MIETE', description: 'Mietkosten' },
      { type: 'CATEGORY_TAG', value: 'STROM', description: 'Strom- und Energiekosten' },
      { type: 'CATEGORY_TAG', value: 'KOMMUNIKATION', description: 'Telefon und Internet' },
      { type: 'CATEGORY_TAG', value: 'LEASING', description: 'Leasing-Raten' },
      { type: 'CATEGORY_TAG', value: 'VERSICHERUNG_BETRIEBLICH', description: 'Betriebliche Versicherungen' },
      { type: 'CATEGORY_TAG', value: 'RUNDFUNK', description: 'Rundfunkgebühren' },
      { type: 'CATEGORY_TAG', value: 'BANKGEBUEHREN', description: 'Bankgebühren' },
      { type: 'CATEGORY_TAG', value: 'BUERO_IT', description: 'Büro- und IT-Kosten' },
      { type: 'DESCRIPTION_PATTERN', value: '(Miete|Strom|Gas|Energie|Telefon|Software|Versicherung|Material|Praxisbedarf|EDV|IT|Wartung|Nebenkosten|Raumkosten)', description: 'Buchungstext enthält betriebskostentypische Begriffe' },
    ],
  },
  {
    id: 'cash_out_betriebskosten_velbert',
    label: 'Velbert',
    block: 'CASH_OUT',
    order: 21,
    isSubRow: true,
    isSummary: false,
    parentRowId: 'cash_out_betriebskosten',
    matches: [],
    flowType: 'OUTFLOW',
  },
  {
    id: 'cash_out_betriebskosten_uckerath',
    label: 'Uckerath/Eitorf',
    block: 'CASH_OUT',
    order: 22,
    isSubRow: true,
    isSummary: false,
    parentRowId: 'cash_out_betriebskosten',
    matches: [],
    flowType: 'OUTFLOW',
  },
  {
    id: 'cash_out_altverb_betriebskosten',
    label: 'Betriebskosten (Altmasse)',
    labelShort: 'Betriebsk. (Alt)',
    block: 'CASH_OUT',
    order: 23,
    isSubRow: true,
    isSummary: false,
    parentRowId: 'cash_out_betriebskosten',
    flowType: 'OUTFLOW',
    matchDescription: 'Betriebskosten-Altverbindlichkeiten.',
    matches: [
      { type: 'CATEGORY_TAG', value: 'ALTVERBINDLICHKEIT_BETRIEBSKOSTEN', description: 'Buchungen mit Kategorie-Tag „ALTVERBINDLICHKEIT_BETRIEBSKOSTEN"' },
    ],
  },

  {
    id: 'cash_out_steuern',
    label: 'Steuern',
    labelShort: 'Steuern',
    block: 'CASH_OUT',
    order: 30,
    isSubRow: true,
    isSummary: false,
    flowType: 'OUTFLOW',
    matchDescription: 'Umsatzsteuer und sonstige Steuerzahlungen.',
    matches: [
      { type: 'CATEGORY_TAG', value: 'STEUERN', description: 'Buchungen mit Kategorie-Tag „STEUERN"' },
      { type: 'DESCRIPTION_PATTERN', value: '(Umsatzsteuer|USt|MwSt|Vorsteuer|Finanzamt|Gewerbesteuer|Körperschaftsteuer|Lohnsteuer)', description: 'Buchungstext enthält Steuer-Begriffe' },
    ],
  },
  {
    id: 'cash_out_operative_sonstige',
    label: 'Sonstige Auszahlungen',
    labelShort: 'Sonstige',
    block: 'CASH_OUT',
    order: 35,
    isSubRow: true,
    isSummary: false,
    flowType: 'OUTFLOW',
    matchDescription: 'Auffangzeile für alle Auszahlungen ohne spezifische Zuordnung.',
    matches: [{ type: 'FALLBACK', value: 'OUTFLOW', description: 'Alle übrigen Auszahlungen' }],
  },

  // --- Insolvenzspezifische Auszahlungen ---
  {
    id: 'cash_out_inso_header',
    label: 'Insolvenzspezifische Auszahlungen',
    block: 'CASH_OUT',
    order: 50,
    isSubRow: false,
    isSummary: false,
    isSectionHeader: true,
    matches: [],
    flowType: 'OUTFLOW',
    visibleInScopes: ['GLOBAL'],
  },
  {
    id: 'cash_out_inso_rueckzahlung',
    label: 'Rückzahlung Insolvenzgeld',
    labelShort: 'Rückz. InsoGeld',
    block: 'CASH_OUT',
    order: 51,
    isSubRow: true,
    isSummary: false,
    flowType: 'OUTFLOW',
    visibleInScopes: ['GLOBAL'],
    matchDescription: 'Rückzahlung von Insolvenzgeld an die Agentur für Arbeit.',
    matches: [
      { type: 'CATEGORY_TAG', value: 'INSO_RUECKZAHLUNG', description: 'Buchungen mit Kategorie-Tag „INSO_RUECKZAHLUNG"' },
      { type: 'DESCRIPTION_PATTERN', value: '(Rückzahlung.*Insolvenzgeld|Insolvenzgeld.*Rückzahlung)', description: 'Buchungstext enthält „Rückzahlung Insolvenzgeld"' },
    ],
  },
  {
    id: 'cash_out_inso_vorfinanzierung',
    label: 'Vorfinanzierung Insolvenzgeld',
    labelShort: 'Vorfin. InsoGeld',
    block: 'CASH_OUT',
    order: 52,
    isSubRow: true,
    isSummary: false,
    flowType: 'OUTFLOW',
    visibleInScopes: ['GLOBAL'],
    matchDescription: 'Vorfinanzierung von Insolvenzgeld.',
    matches: [
      { type: 'CATEGORY_TAG', value: 'INSO_VORFINANZIERUNG', description: 'Buchungen mit Kategorie-Tag „INSO_VORFINANZIERUNG"' },
      { type: 'DESCRIPTION_PATTERN', value: '(Vorfinanzierung.*Insolvenzgeld|Insolvenzgeld.*Vorfinanzierung)', description: 'Buchungstext enthält „Vorfinanzierung Insolvenzgeld"' },
    ],
  },
  {
    id: 'cash_out_inso_sachaufnahme',
    label: 'Sachaufnahme',
    labelShort: 'Sachaufn.',
    block: 'CASH_OUT',
    order: 53,
    isSubRow: true,
    isSummary: false,
    flowType: 'OUTFLOW',
    visibleInScopes: ['GLOBAL'],
    matchDescription: 'Kosten für die Sachaufnahme im Insolvenzverfahren.',
    matches: [
      { type: 'CATEGORY_TAG', value: 'INSO_SACHAUFNAHME', description: 'Buchungen mit Kategorie-Tag „INSO_SACHAUFNAHME"' },
      { type: 'DESCRIPTION_PATTERN', value: '(Sachaufnahme)', description: 'Buchungstext enthält „Sachaufnahme"' },
    ],
  },
  {
    id: 'cash_out_inso_darlehen',
    label: 'Darlehens-Tilgung',
    labelShort: 'Darlehen',
    block: 'CASH_OUT',
    order: 54,
    isSubRow: true,
    isSummary: false,
    flowType: 'OUTFLOW',
    visibleInScopes: ['GLOBAL'],
    matchDescription: 'Tilgung des Massekredits.',
    matches: [
      { type: 'CATEGORY_TAG', value: 'DARLEHEN_TILGUNG', description: 'Buchungen mit Kategorie-Tag „DARLEHEN_TILGUNG"' },
    ],
  },
  {
    id: 'cash_out_inso_verfahrenskosten',
    label: 'Verfahrenskosten / Beratung',
    labelShort: 'Verfahren',
    block: 'CASH_OUT',
    order: 55,
    isSubRow: true,
    isSummary: false,
    flowType: 'OUTFLOW',
    visibleInScopes: ['GLOBAL'],
    matchDescription: 'Verfahrenskosten, Gerichtskosten und Beratungskosten.',
    matches: [
      { type: 'CATEGORY_TAG', value: 'VERFAHRENSKOSTEN', description: 'Buchungen mit Kategorie-Tag „VERFAHRENSKOSTEN"' },
      { type: 'LEGAL_BUCKET', value: 'ABSONDERUNG', description: 'Buchungen mit Rechtsstatus „ABSONDERUNG"' },
      { type: 'DESCRIPTION_PATTERN', value: '(Verfahren|Gericht|Insolvenz|Verwalter|Berater|Rechtsanwalt|Steuerberater|Gutachter|Unternehmensberater)', description: 'Buchungstext enthält Verfahrens-/Beratungsbegriffe' },
    ],
  },
  {
    id: 'cash_out_subtotal_insolvency',
    label: 'Zwischensumme insolvenzspezifisch',
    block: 'CASH_OUT',
    order: 59,
    isSubRow: false,
    isSummary: false,
    isSubtotal: true,
    matches: [],
    flowType: 'OUTFLOW',
    visibleInScopes: ['GLOBAL'],
  },
  {
    id: 'cash_out_total',
    label: 'Summe Auszahlungen',
    block: 'CASH_OUT',
    order: 99,
    isSubRow: false,
    isSummary: true,
    matches: [],
    flowType: 'OUTFLOW',
  },

  // ─── BLOCK IV: LIQUIDITÄTSENTWICKLUNG ──────────────────────────────
  // Alle Zeilen sind computed (keine LedgerEntry-Matches)
  {
    id: 'liquidity_change',
    label: 'Veränderung Finanzmittel (Ein − Aus)',
    block: 'LIQUIDITY_DEVELOPMENT',
    order: 1,
    isSubRow: false,
    isSummary: true,
    matches: [],
  },
  {
    id: 'closing_balance_total',
    label: 'Guthaben (+) / Kreditinanspruchnahme (−) EoP',
    block: 'LIQUIDITY_DEVELOPMENT',
    order: 2,
    isSubRow: false,
    isSummary: true,
    matches: [],
  },
  {
    id: 'credit_line_available',
    label: '+ Verfügbare Kreditlinie',
    block: 'LIQUIDITY_DEVELOPMENT',
    order: 3,
    isSubRow: false,
    isSummary: true,
    matches: [],
  },
  {
    id: 'coverage_before_reserves',
    label: '= Überdeckung / Unterdeckung EoP',
    block: 'LIQUIDITY_DEVELOPMENT',
    order: 4,
    isSubRow: false,
    isSummary: true,
    matches: [],
  },
  {
    id: 'reserves_total',
    label: '− Rückstellungen (Worst-Case)',
    block: 'LIQUIDITY_DEVELOPMENT',
    order: 5,
    isSubRow: false,
    isSummary: true,
    matches: [],
  },
  {
    id: 'coverage_after_reserves',
    label: '= Überdeckung / Unterdeckung (inkl. Rückstellungen)',
    block: 'LIQUIDITY_DEVELOPMENT',
    order: 6,
    isSubRow: false,
    isSummary: true,
    matches: [],
  },
];

// =============================================================================
// SCOPE-KONFIGURATION
// Tatsächliche Location-IDs aus der Datenbank
// =============================================================================

export const SCOPE_LOCATION_IDS: Record<Exclude<LiquidityScope, 'GLOBAL'>, string[]> = {
  LOCATION_VELBERT: ['loc-haevg-velbert'],
  LOCATION_UCKERATH_EITORF: ['loc-haevg-uckerath', 'loc-haevg-eitorf'],
};

export const CENTRAL_PROCEDURE_COST_PATTERNS = [
  /verfahrenskosten/i,
  /insolvenzverwalter/i,
  /gerichtskosten/i,
  /gutachter/i,
  /rechtsanwalt.*insolvenz/i,
  /steuerberater.*verfahren/i,
  /zentral.*beratung/i,
  /unternehmensberater/i,
  /fortführungsbeitrag/i,
];

// =============================================================================
// FULL CONFIG EXPORT
// =============================================================================

export const HVPLUS_MATRIX_CONFIG: LiquidityMatrixConfig = {
  caseId: 'hvplus',
  caseName: 'Hausärztliche Versorgung PLUS eG',
  blocks: HVPLUS_MATRIX_BLOCKS,
  rows: HVPLUS_MATRIX_ROWS,
};

// =============================================================================
// MATCHING ENGINE
// =============================================================================

/**
 * Ergebnis eines Zeilen-Matchings mit Trace-Information.
 */
export interface MatchResult {
  row: MatrixRowConfig;
  matchType: MatrixRowMatchType;
  matchValue: string;
  matchStage: 'CATEGORY_TAG' | 'OTHER_CRITERIA' | 'FALLBACK';
  matchDescription: string;
}

/**
 * Findet die passende Zeile für einen LedgerEntry MIT Trace-Information.
 *
 * Zweistufiges Matching:
 * 1. Wenn Entry ein categoryTag hat → NUR CATEGORY_TAG-Matches prüfen.
 * 2. Wenn kein categoryTag (IST-Daten) → andere Kriterien.
 * 3. Fallback-Zeilen greifen in beiden Fällen als letzte Option.
 */
export function findMatchingRowWithTrace(
  entry: {
    description: string;
    amountCents: bigint | string;
    counterpartyId?: string | null;
    counterpartyName?: string | null;
    locationId?: string | null;
    bankAccountId?: string | null;
    legalBucket?: string | null;
    categoryTag?: string | null;
  },
  rows: MatrixRowConfig[],
  flowType: 'INFLOW' | 'OUTFLOW'
): MatchResult | null {
  const eligibleRows = rows.filter(row =>
    row.flowType === flowType &&
    !row.isSummary &&
    !row.isSubtotal &&
    !row.parentRowId &&     // Standort-Kinder haben keine eigenen Matches
    row.matches.length > 0
  );

  // --- Stufe 1: CATEGORY_TAG (für PLAN-Daten) ---
  if (entry.categoryTag) {
    for (const row of eligibleRows) {
      const tagMatch = row.matches.find(m => m.type === 'CATEGORY_TAG' && m.value === entry.categoryTag);
      if (tagMatch) {
        return {
          row,
          matchType: 'CATEGORY_TAG',
          matchValue: tagMatch.value,
          matchStage: 'CATEGORY_TAG',
          matchDescription: tagMatch.description ?? `Kategorie-Tag = '${tagMatch.value}'`,
        };
      }
    }
  }

  // --- Stufe 2: Andere Kriterien (für IST-Daten ohne categoryTag) ---
  const sortedRows = [...eligibleRows].sort((a, b) => {
    const aIsFallback = a.matches.some(m => m.type === 'FALLBACK');
    const bIsFallback = b.matches.some(m => m.type === 'FALLBACK');
    if (aIsFallback && !bIsFallback) return 1;
    if (!aIsFallback && bIsFallback) return -1;
    return a.order - b.order;
  });

  for (const row of sortedRows) {
    let matchCount = 0;
    let firstMatchType: MatrixRowMatchType | null = null;
    let firstMatchValue = '';
    let firstMatchDescription = '';

    const otherMatches = row.matches.filter(
      m => m.type !== 'FALLBACK' && m.type !== 'CATEGORY_TAG'
    );
    const requiredMatches = otherMatches.length;

    for (const match of row.matches) {
      let matched = false;
      switch (match.type) {
        case 'CATEGORY_TAG':
          break;
        case 'COUNTERPARTY_ID':
          matched = entry.counterpartyId === match.value;
          break;
        case 'COUNTERPARTY_PATTERN':
          matched = !!(entry.counterpartyName && new RegExp(match.value, 'i').test(entry.counterpartyName));
          break;
        case 'LOCATION_ID':
          matched = entry.locationId === match.value;
          break;
        case 'BANK_ACCOUNT_ID':
          matched = entry.bankAccountId === match.value;
          break;
        case 'DESCRIPTION_PATTERN':
          matched = new RegExp(match.value, 'i').test(entry.description);
          break;
        case 'LEGAL_BUCKET':
          matched = entry.legalBucket === match.value;
          break;
        case 'FALLBACK':
          // FALLBACK matcht sowohl 'OUTFLOW' als auch das alte 'OUTFLOW_OPERATIVE'
          if (match.value === flowType || match.value === `${flowType}_OPERATIVE`) {
            return {
              row,
              matchType: 'FALLBACK',
              matchValue: match.value,
              matchStage: 'FALLBACK',
              matchDescription: match.description ?? 'Auffangzeile für nicht zugeordnete Buchungen',
            };
          }
          break;
      }
      if (matched) {
        matchCount++;
        if (!firstMatchType) {
          firstMatchType = match.type;
          firstMatchValue = match.value;
          firstMatchDescription = match.description ?? `${match.type} = '${match.value}'`;
        }
      }
    }

    if (requiredMatches > 0 && matchCount > 0 && firstMatchType) {
      return {
        row,
        matchType: firstMatchType,
        matchValue: firstMatchValue,
        matchStage: 'OTHER_CRITERIA',
        matchDescription: firstMatchDescription,
      };
    }
  }

  return null;
}

/**
 * Findet die passende Zeile für einen LedgerEntry.
 * Wrapper um findMatchingRowWithTrace() für Rückwärtskompatibilität.
 */
export function findMatchingRow(
  entry: {
    description: string;
    amountCents: bigint | string;
    counterpartyId?: string | null;
    counterpartyName?: string | null;
    locationId?: string | null;
    bankAccountId?: string | null;
    legalBucket?: string | null;
    categoryTag?: string | null;
  },
  rows: MatrixRowConfig[],
  flowType: 'INFLOW' | 'OUTFLOW'
): MatrixRowConfig | null {
  return findMatchingRowWithTrace(entry, rows, flowType)?.row ?? null;
}

/**
 * Gibt alle Zeilen für einen Block zurück, sortiert nach order
 */
export function getRowsForBlock(
  blockId: MatrixBlockId,
  rows: MatrixRowConfig[]
): MatrixRowConfig[] {
  return rows
    .filter(row => row.block === blockId)
    .sort((a, b) => a.order - b.order);
}

// =============================================================================
// SCOPE-FILTER-FUNKTIONEN
// =============================================================================

export function isCentralProcedureCost(entry: {
  description: string;
  legalBucket?: string | null;
  locationId?: string | null;
}): boolean {
  if (entry.locationId) return false;
  if (entry.legalBucket === 'ABSONDERUNG') return true;
  return CENTRAL_PROCEDURE_COST_PATTERNS.some(p => p.test(entry.description));
}

export function filterEntriesByScope<T extends {
  description: string;
  locationId?: string | null;
  legalBucket?: string | null;
}>(entries: T[], scope: LiquidityScope): T[] {
  if (scope === 'GLOBAL') return entries;

  const allowedLocationIds = SCOPE_LOCATION_IDS[scope];

  return entries.filter(entry => {
    if (isCentralProcedureCost(entry)) return false;
    if (!entry.locationId) return false;
    return allowedLocationIds.includes(entry.locationId);
  });
}

export function getRowsForScope(
  rows: MatrixRowConfig[],
  scope: LiquidityScope
): MatrixRowConfig[] {
  return rows.filter(row => {
    if (!row.visibleInScopes) return true;
    return row.visibleInScopes.includes(scope);
  });
}

export function getScopeHintText(scope: LiquidityScope): string | null {
  if (scope === 'GLOBAL') return null;
  return 'Zentrale Verfahrenskosten, Personalaufwand und insolvenzspezifische Kosten sind in dieser Sicht nicht enthalten.';
}

/**
 * Mappt einen Neumasse-categoryTag auf den entsprechenden Alt-categoryTag.
 */
export function getAltforderungCategoryTag(neumasseTag: string | null): string | null {
  if (!neumasseTag) return null;

  const mapping: Record<string, string> = {
    // ─── EINNAHMEN (Altforderungen) ───
    'HZV': 'ALTFORDERUNG_HZV',
    'KV': 'ALTFORDERUNG_KV',
    'PVS': 'ALTFORDERUNG_PVS',

    // ─── AUSGABEN (Altverbindlichkeiten) ───
    'PERSONAL': 'ALTVERBINDLICHKEIT_PERSONAL',
    'SOZIALABGABEN': 'ALTVERBINDLICHKEIT_SOZIALABGABEN',
    'BETRIEBSKOSTEN': 'ALTVERBINDLICHKEIT_BETRIEBSKOSTEN',

    // Detail-Tags Betriebskosten
    'MIETE': 'ALTVERBINDLICHKEIT_BETRIEBSKOSTEN',
    'STROM': 'ALTVERBINDLICHKEIT_BETRIEBSKOSTEN',
    'KOMMUNIKATION': 'ALTVERBINDLICHKEIT_BETRIEBSKOSTEN',
    'LEASING': 'ALTVERBINDLICHKEIT_BETRIEBSKOSTEN',
    'VERSICHERUNG_BETRIEBLICH': 'ALTVERBINDLICHKEIT_BETRIEBSKOSTEN',
    'RUNDFUNK': 'ALTVERBINDLICHKEIT_BETRIEBSKOSTEN',
    'BANKGEBUEHREN': 'ALTVERBINDLICHKEIT_BETRIEBSKOSTEN',
    'BUERO_IT': 'ALTVERBINDLICHKEIT_BETRIEBSKOSTEN',
  };

  return mapping[neumasseTag] || null;
}

/**
 * Gibt alle Zeilen zurück, die eine bestimmte parentRowId haben
 */
export function getChildRows(parentRowId: string, rows: MatrixRowConfig[]): MatrixRowConfig[] {
  return rows.filter(row => row.parentRowId === parentRowId);
}

/**
 * IDs der insolvenzspezifischen Auszahlungszeilen (für Zwischensumme)
 */
export const INSOLVENCY_ROW_IDS = [
  'cash_out_inso_rueckzahlung',
  'cash_out_inso_vorfinanzierung',
  'cash_out_inso_sachaufnahme',
  'cash_out_inso_darlehen',
  'cash_out_inso_verfahrenskosten',
];
