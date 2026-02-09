/**
 * HVPlus Liquiditätsmatrix Konfiguration
 *
 * Struktur der IV-Liquiditätstabelle für HVPlus eG:
 *
 * EINZAHLUNGEN:
 *   HZV, KV, PVS (Umsatz/Neumasse)
 *   Altforderungen HZV, KV, PVS (Altmasse)
 *   Insolvenzspezifische Einzahlungen
 *   Sonstige (Fallback)
 *
 * BETRIEBLICHE AUSZAHLUNGEN:
 *   Personalaufwand
 *   Betriebskosten
 *   Sonstige (Fallback)
 *
 * INSOLVENZSPEZIFISCHE AUSZAHLUNGEN:
 *   Rückzahlung Insolvenzgeld, Vorfinanzierung, Sachaufnahme
 *
 * STANDORT-LOGIK:
 *   Keine standortspezifischen Zeilen -- die Standort-Toggles filtern die
 *   Entries VOR dem Matching. In GLOBAL sieht man alle, in Velbert nur
 *   Velbert-Entries. Dieselben Zeilen, unterschiedliche Werte.
 *
 * MATCHING:
 *   Zweistufig: (1) CATEGORY_TAG für PLAN-Daten, (2) andere Kriterien für IST.
 *   Dadurch keine Konflikte zwischen Anzeige-Reihenfolge und Match-Priorität.
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
  | 'CASH_OUT_OPERATIVE'
  | 'CASH_OUT_TAX'
  | 'CASH_OUT_INSOLVENCY'
  | 'CASH_OUT_TOTAL'
  | 'CLOSING_BALANCE';

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
}

export interface MatrixRowConfig {
  id: string;
  label: string;
  labelShort?: string;
  block: MatrixBlockId;
  order: number;
  isSubRow: boolean;
  isSummary: boolean;
  isSectionHeader?: boolean;  // Visuelle Gruppierung ohne Werte (z.B. "Umsatz", "Altforderungen")
  matches: MatrixRowMatch[];
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
// HVPLUS MATRIX KONFIGURATION
// =============================================================================

export const HVPLUS_MATRIX_BLOCKS: MatrixBlockConfig[] = [
  {
    id: 'OPENING_BALANCE',
    label: 'Zahlungsmittelbestand am Anfang der Periode',
    order: 1,
    summaryRowId: 'opening_balance_total',
    cssClass: 'bg-gray-50',
  },
  {
    id: 'CASH_IN',
    label: 'Einzahlungen',
    order: 2,
    summaryRowId: 'cash_in_total',
    cssClass: 'bg-green-50',
  },
  {
    id: 'CASH_OUT_OPERATIVE',
    label: 'Betriebliche Auszahlungen',
    order: 3,
    summaryRowId: 'cash_out_operative_total',
    cssClass: 'bg-red-50',
  },
  {
    id: 'CASH_OUT_TAX',
    label: 'Steuerlicher Cash-Out',
    order: 4,
    summaryRowId: 'cash_out_tax_total',
    cssClass: 'bg-orange-50',
  },
  {
    id: 'CASH_OUT_INSOLVENCY',
    label: 'Insolvenzspezifische Auszahlungen',
    order: 5,
    summaryRowId: 'cash_out_insolvency_total',
    cssClass: 'bg-purple-50',
  },
  {
    id: 'CASH_OUT_TOTAL',
    label: 'Summe Auszahlungen',
    order: 6,
    summaryRowId: 'cash_out_total',
    cssClass: 'bg-red-50',
  },
  {
    id: 'CLOSING_BALANCE',
    label: 'Zahlungsmittelbestand am Ende der Periode',
    order: 7,
    summaryRowId: 'closing_balance_total',
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
  // ─── BLOCK A: OPENING BALANCE ───────────────────────────────────────
  {
    id: 'opening_balance_total',
    label: 'Zahlungsmittelbestand am Anfang der Periode',
    block: 'OPENING_BALANCE',
    order: 1,
    isSubRow: false,
    isSummary: true,
    matches: [],
  },
  // Velbert-Konten (nur in GLOBAL + LOCATION_VELBERT sichtbar)
  {
    id: 'opening_balance_isk_velbert',
    label: 'ISK Velbert (BW-Bank)',
    labelShort: 'ISK Velbert',
    block: 'OPENING_BALANCE',
    order: 2,
    isSubRow: true,
    isSummary: false,
    matches: [{ type: 'BANK_ACCOUNT_ID', value: 'ba-isk-velbert' }],
    bankAccountId: 'ba-isk-velbert',
    visibleInScopes: ['GLOBAL', 'LOCATION_VELBERT'],
  },
  {
    id: 'opening_balance_sparkasse_velbert',
    label: 'Geschäftskonto MVZ Velbert (Sparkasse)',
    labelShort: 'Sparkasse Velbert',
    block: 'OPENING_BALANCE',
    order: 3,
    isSubRow: true,
    isSummary: false,
    matches: [{ type: 'BANK_ACCOUNT_ID', value: 'ba-sparkasse-velbert' }],
    bankAccountId: 'ba-sparkasse-velbert',
    visibleInScopes: ['GLOBAL', 'LOCATION_VELBERT'],
  },
  // Uckerath-Konten (nur in GLOBAL + LOCATION_UCKERATH_EITORF sichtbar)
  {
    id: 'opening_balance_isk_uckerath',
    label: 'ISK Uckerath (BW-Bank)',
    labelShort: 'ISK Uckerath',
    block: 'OPENING_BALANCE',
    order: 4,
    isSubRow: true,
    isSummary: false,
    matches: [{ type: 'BANK_ACCOUNT_ID', value: 'ba-isk-uckerath' }],
    bankAccountId: 'ba-isk-uckerath',
    visibleInScopes: ['GLOBAL', 'LOCATION_UCKERATH_EITORF'],
  },
  {
    id: 'opening_balance_apobank_uckerath',
    label: 'MVZ Uckerath (apoBank)',
    labelShort: 'apoBank Uckerath',
    block: 'OPENING_BALANCE',
    order: 5,
    isSubRow: true,
    isSummary: false,
    matches: [{ type: 'BANK_ACCOUNT_ID', value: 'ba-apobank-uckerath' }],
    bankAccountId: 'ba-apobank-uckerath',
    visibleInScopes: ['GLOBAL', 'LOCATION_UCKERATH_EITORF'],
  },
  // Zentrale Konten (nur in GLOBAL sichtbar)
  {
    id: 'opening_balance_apobank_hvplus',
    label: 'HV PLUS eG (apoBank, zentral)',
    labelShort: 'HV PLUS eG',
    block: 'OPENING_BALANCE',
    order: 6,
    isSubRow: true,
    isSummary: false,
    matches: [{ type: 'BANK_ACCOUNT_ID', value: 'ba-apobank-hvplus' }],
    bankAccountId: 'ba-apobank-hvplus',
    visibleInScopes: ['GLOBAL'],
  },

  // ─── BLOCK B: EINZAHLUNGEN ──────────────────────────────────────────
  // Reihenfolge: Umsatz (HZV/KV/PVS), dann Altforderungen, dann Inso, dann Sonstige
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
    flowType: 'INFLOW',
    matches: [
      { type: 'CATEGORY_TAG', value: 'HZV' },
      { type: 'COUNTERPARTY_PATTERN', value: '(HZV|HAVG|HAEVG|Hausarzt)' },
    ],
  },
  {
    id: 'cash_in_kv',
    label: 'KV',
    labelShort: 'KV',
    block: 'CASH_IN',
    order: 11,
    isSubRow: true,
    isSummary: false,
    flowType: 'INFLOW',
    matches: [
      { type: 'CATEGORY_TAG', value: 'KV' },
      { type: 'COUNTERPARTY_PATTERN', value: '(KV|KVNO|Kassenärztliche)' },
    ],
  },
  {
    id: 'cash_in_pvs',
    label: 'PVS',
    labelShort: 'PVS',
    block: 'CASH_IN',
    order: 12,
    isSubRow: true,
    isSummary: false,
    flowType: 'INFLOW',
    matches: [
      { type: 'CATEGORY_TAG', value: 'PVS' },
      { type: 'COUNTERPARTY_PATTERN', value: '(PVS|Privat|Privatpatient)' },
    ],
  },

  // --- Altforderungen (Altmasse) ---
  {
    id: 'cash_in_altforderung_header',
    label: 'Altforderungen (Altmasse)',
    block: 'CASH_IN',
    order: 15,
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
    order: 20,
    isSubRow: true,
    isSummary: false,
    flowType: 'INFLOW',
    matches: [
      { type: 'CATEGORY_TAG', value: 'ALTFORDERUNG_HZV' },
    ],
  },
  {
    id: 'cash_in_altforderung_kv',
    label: 'Altforderungen KV',
    labelShort: 'Alt KV',
    block: 'CASH_IN',
    order: 21,
    isSubRow: true,
    isSummary: false,
    flowType: 'INFLOW',
    matches: [
      { type: 'CATEGORY_TAG', value: 'ALTFORDERUNG_KV' },
    ],
  },
  {
    id: 'cash_in_altforderung_pvs',
    label: 'Altforderungen PVS',
    labelShort: 'Alt PVS',
    block: 'CASH_IN',
    order: 22,
    isSubRow: true,
    isSummary: false,
    flowType: 'INFLOW',
    matches: [
      { type: 'CATEGORY_TAG', value: 'ALTFORDERUNG_PVS' },
    ],
  },

  // --- Sonstige Einzahlungen ---
  {
    id: 'cash_in_sonstige_header',
    label: 'Sonstige Einzahlungen',
    block: 'CASH_IN',
    order: 25,
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
    order: 30,
    isSubRow: true,
    isSummary: false,
    flowType: 'INFLOW',
    visibleInScopes: ['GLOBAL'],
    matches: [
      { type: 'CATEGORY_TAG', value: 'INSO_EINZAHLUNG' },
      { type: 'DESCRIPTION_PATTERN', value: '(insolvenzspezifisch.*Einzahlung)' },
    ],
  },
  {
    id: 'cash_in_auskehrungen',
    label: 'Auskehrungen Altkonten',
    labelShort: 'Auskehr.',
    block: 'CASH_IN',
    order: 31,
    isSubRow: true,
    isSummary: false,
    flowType: 'INFLOW',
    matches: [
      { type: 'CATEGORY_TAG', value: 'AUSKEHRUNG_ALTKONTEN' },
    ],
  },
  {
    id: 'cash_in_einnahmen_sonstige',
    label: 'Sonstige Einnahmen (Gutachten, Privatpatienten)',
    labelShort: 'Sonst. Einnahmen',
    block: 'CASH_IN',
    order: 32,
    isSubRow: true,
    isSummary: false,
    flowType: 'INFLOW',
    matches: [
      { type: 'CATEGORY_TAG', value: 'EINNAHME_SONSTIGE' },
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
    matches: [{ type: 'FALLBACK', value: 'INFLOW' }],
  },

  // ─── BLOCK C: BETRIEBLICHE AUSZAHLUNGEN ─────────────────────────────
  // Keine Standort-Aufteilung -- die Toggles filtern die Entries.
  {
    id: 'cash_out_operative_total',
    label: 'Betriebliche Auszahlungen',
    block: 'CASH_OUT_OPERATIVE',
    order: 1,
    isSubRow: false,
    isSummary: true,
    matches: [],
    flowType: 'OUTFLOW',
  },
  {
    id: 'cash_out_personal',
    label: 'Personalaufwand',
    labelShort: 'Personal',
    block: 'CASH_OUT_OPERATIVE',
    order: 2,
    isSubRow: true,
    isSummary: false,
    flowType: 'OUTFLOW',
    visibleInScopes: ['GLOBAL'],
    matches: [
      { type: 'CATEGORY_TAG', value: 'PERSONAL' },
      { type: 'DESCRIPTION_PATTERN', value: '(Lohn|Gehalt|Personal|SV-Beitrag|Sozialversicherung)' },
    ],
  },
  {
    id: 'cash_out_betriebskosten',
    label: 'Betriebskosten',
    labelShort: 'Betriebsk.',
    block: 'CASH_OUT_OPERATIVE',
    order: 10,
    isSubRow: true,
    isSummary: false,
    flowType: 'OUTFLOW',
    matches: [
      { type: 'CATEGORY_TAG', value: 'BETRIEBSKOSTEN' },
      { type: 'CATEGORY_TAG', value: 'MIETE' },
      { type: 'CATEGORY_TAG', value: 'STROM' },
      { type: 'CATEGORY_TAG', value: 'KOMMUNIKATION' },
      { type: 'CATEGORY_TAG', value: 'LEASING' },
      { type: 'CATEGORY_TAG', value: 'VERSICHERUNG_BETRIEBLICH' },
      { type: 'CATEGORY_TAG', value: 'RUNDFUNK' },
      { type: 'CATEGORY_TAG', value: 'BANKGEBUEHREN' },
      { type: 'CATEGORY_TAG', value: 'BUERO_IT' },
      { type: 'DESCRIPTION_PATTERN', value: '(Miete|Strom|Gas|Energie|Telefon|Software|Versicherung|Material|Praxisbedarf|EDV|IT|Wartung|Nebenkosten|Raumkosten)' },
    ],
  },
  {
    id: 'cash_out_operative_sonstige',
    label: 'Sonstige Auszahlungen',
    labelShort: 'Sonstige',
    block: 'CASH_OUT_OPERATIVE',
    order: 99,
    isSubRow: true,
    isSummary: false,
    flowType: 'OUTFLOW',
    matches: [{ type: 'FALLBACK', value: 'OUTFLOW_OPERATIVE' }],
  },

  // ─── BLOCK D: STEUERLICHER CASH-OUT ──────────────────────────────────
  {
    id: 'cash_out_tax_total',
    label: 'Steuerlicher Cash-Out',
    block: 'CASH_OUT_TAX',
    order: 1,
    isSubRow: false,
    isSummary: true,
    matches: [],
    flowType: 'OUTFLOW',
  },
  {
    id: 'cash_out_ust',
    label: 'Umsatzsteuer (Zahllast)',
    labelShort: 'USt',
    block: 'CASH_OUT_TAX',
    order: 2,
    isSubRow: true,
    isSummary: false,
    flowType: 'OUTFLOW',
    matches: [
      { type: 'DESCRIPTION_PATTERN', value: '(Umsatzsteuer|USt|MwSt|Vorsteuer|Finanzamt)' },
    ],
  },
  {
    id: 'cash_out_sonstige_steuern',
    label: 'Sonstige Steuern',
    labelShort: 'Sonst. Steuern',
    block: 'CASH_OUT_TAX',
    order: 3,
    isSubRow: true,
    isSummary: false,
    flowType: 'OUTFLOW',
    matches: [
      { type: 'CATEGORY_TAG', value: 'STEUERN' },
      { type: 'DESCRIPTION_PATTERN', value: '(Gewerbesteuer|Körperschaftsteuer|Lohnsteuer)' },
    ],
  },

  // ─── BLOCK E: INSOLVENZSPEZIFISCHE AUSZAHLUNGEN ──────────────────────
  // Zentrale Kosten, nur in GLOBAL sichtbar
  {
    id: 'cash_out_insolvency_total',
    label: 'Insolvenzspezifische Auszahlungen',
    block: 'CASH_OUT_INSOLVENCY',
    order: 1,
    isSubRow: false,
    isSummary: true,
    matches: [],
    flowType: 'OUTFLOW',
    visibleInScopes: ['GLOBAL'],
  },
  {
    id: 'cash_out_inso_rueckzahlung',
    label: 'Rückzahlung Insolvenzgeld',
    labelShort: 'Rückz. InsoGeld',
    block: 'CASH_OUT_INSOLVENCY',
    order: 2,
    isSubRow: true,
    isSummary: false,
    flowType: 'OUTFLOW',
    visibleInScopes: ['GLOBAL'],
    matches: [
      { type: 'CATEGORY_TAG', value: 'INSO_RUECKZAHLUNG' },
      { type: 'DESCRIPTION_PATTERN', value: '(Rückzahlung.*Insolvenzgeld|Insolvenzgeld.*Rückzahlung)' },
    ],
  },
  {
    id: 'cash_out_inso_vorfinanzierung',
    label: 'Vorfinanzierung Insolvenzgeld',
    labelShort: 'Vorfin. InsoGeld',
    block: 'CASH_OUT_INSOLVENCY',
    order: 3,
    isSubRow: true,
    isSummary: false,
    flowType: 'OUTFLOW',
    visibleInScopes: ['GLOBAL'],
    matches: [
      { type: 'CATEGORY_TAG', value: 'INSO_VORFINANZIERUNG' },
      { type: 'DESCRIPTION_PATTERN', value: '(Vorfinanzierung.*Insolvenzgeld|Insolvenzgeld.*Vorfinanzierung)' },
    ],
  },
  {
    id: 'cash_out_inso_sachaufnahme',
    label: 'Sachaufnahme',
    labelShort: 'Sachaufn.',
    block: 'CASH_OUT_INSOLVENCY',
    order: 4,
    isSubRow: true,
    isSummary: false,
    flowType: 'OUTFLOW',
    visibleInScopes: ['GLOBAL'],
    matches: [
      { type: 'CATEGORY_TAG', value: 'INSO_SACHAUFNAHME' },
      { type: 'DESCRIPTION_PATTERN', value: '(Sachaufnahme)' },
    ],
  },
  {
    id: 'cash_out_inso_darlehen',
    label: 'Darlehens-Tilgung',
    labelShort: 'Darlehen',
    block: 'CASH_OUT_INSOLVENCY',
    order: 5,
    isSubRow: true,
    isSummary: false,
    flowType: 'OUTFLOW',
    visibleInScopes: ['GLOBAL'],
    matches: [
      { type: 'CATEGORY_TAG', value: 'DARLEHEN_TILGUNG' },
    ],
  },
  {
    id: 'cash_out_inso_verfahrenskosten',
    label: 'Beratung / Sonstiges Verfahren',
    labelShort: 'Verfahren',
    block: 'CASH_OUT_INSOLVENCY',
    order: 6,
    isSubRow: true,
    isSummary: false,
    flowType: 'OUTFLOW',
    visibleInScopes: ['GLOBAL'],
    matches: [
      { type: 'CATEGORY_TAG', value: 'VERFAHRENSKOSTEN' },
    ],
  },
  {
    id: 'cash_out_verfahrenskosten',
    label: 'Verfahrenskosten',
    labelShort: 'Verf.kosten',
    block: 'CASH_OUT_INSOLVENCY',
    order: 10,
    isSubRow: true,
    isSummary: false,
    flowType: 'OUTFLOW',
    visibleInScopes: ['GLOBAL'],
    matches: [
      { type: 'LEGAL_BUCKET', value: 'ABSONDERUNG' },
      { type: 'DESCRIPTION_PATTERN', value: '(Verfahren|Gericht|Insolvenz|Verwalter)' },
    ],
  },
  {
    id: 'cash_out_beratung',
    label: 'Beratung / Sonstiges Verfahren',
    labelShort: 'Beratung',
    block: 'CASH_OUT_INSOLVENCY',
    order: 11,
    isSubRow: true,
    isSummary: false,
    flowType: 'OUTFLOW',
    visibleInScopes: ['GLOBAL'],
    matches: [
      { type: 'DESCRIPTION_PATTERN', value: '(Berater|Rechtsanwalt|Steuerberater|Gutachter|Unternehmensberater)' },
    ],
  },

  // ─── BLOCK: SUMME AUSZAHLUNGEN ─────────────────────────────────────
  {
    id: 'cash_out_total',
    label: 'Summe Auszahlungen',
    block: 'CASH_OUT_TOTAL',
    order: 1,
    isSubRow: false,
    isSummary: true,
    matches: [],
    flowType: 'OUTFLOW',
  },

  // ─── BLOCK F: CLOSING BALANCE ───────────────────────────────────────
  {
    id: 'closing_balance_total',
    label: 'Zahlungsmittelbestand am Ende der Periode',
    block: 'CLOSING_BALANCE',
    order: 1,
    isSubRow: false,
    isSummary: true,
    matches: [],
  },
  // Velbert-Konten (nur in GLOBAL + LOCATION_VELBERT sichtbar)
  {
    id: 'closing_balance_isk_velbert',
    label: 'ISK Velbert (BW-Bank)',
    labelShort: 'ISK Velbert',
    block: 'CLOSING_BALANCE',
    order: 2,
    isSubRow: true,
    isSummary: false,
    matches: [{ type: 'BANK_ACCOUNT_ID', value: 'ba-isk-velbert' }],
    bankAccountId: 'ba-isk-velbert',
    visibleInScopes: ['GLOBAL', 'LOCATION_VELBERT'],
  },
  {
    id: 'closing_balance_sparkasse_velbert',
    label: 'Geschäftskonto MVZ Velbert (Sparkasse)',
    labelShort: 'Sparkasse Velbert',
    block: 'CLOSING_BALANCE',
    order: 3,
    isSubRow: true,
    isSummary: false,
    matches: [{ type: 'BANK_ACCOUNT_ID', value: 'ba-sparkasse-velbert' }],
    bankAccountId: 'ba-sparkasse-velbert',
    visibleInScopes: ['GLOBAL', 'LOCATION_VELBERT'],
  },
  // Uckerath-Konten (nur in GLOBAL + LOCATION_UCKERATH_EITORF sichtbar)
  {
    id: 'closing_balance_isk_uckerath',
    label: 'ISK Uckerath (BW-Bank)',
    labelShort: 'ISK Uckerath',
    block: 'CLOSING_BALANCE',
    order: 4,
    isSubRow: true,
    isSummary: false,
    matches: [{ type: 'BANK_ACCOUNT_ID', value: 'ba-isk-uckerath' }],
    bankAccountId: 'ba-isk-uckerath',
    visibleInScopes: ['GLOBAL', 'LOCATION_UCKERATH_EITORF'],
  },
  {
    id: 'closing_balance_apobank_uckerath',
    label: 'MVZ Uckerath (apoBank)',
    labelShort: 'apoBank Uckerath',
    block: 'CLOSING_BALANCE',
    order: 5,
    isSubRow: true,
    isSummary: false,
    matches: [{ type: 'BANK_ACCOUNT_ID', value: 'ba-apobank-uckerath' }],
    bankAccountId: 'ba-apobank-uckerath',
    visibleInScopes: ['GLOBAL', 'LOCATION_UCKERATH_EITORF'],
  },
  // Zentrale Konten (nur in GLOBAL sichtbar)
  {
    id: 'closing_balance_apobank_hvplus',
    label: 'HV PLUS eG (apoBank, zentral)',
    labelShort: 'HV PLUS eG',
    block: 'CLOSING_BALANCE',
    order: 6,
    isSubRow: true,
    isSummary: false,
    matches: [{ type: 'BANK_ACCOUNT_ID', value: 'ba-apobank-hvplus' }],
    bankAccountId: 'ba-apobank-hvplus',
    visibleInScopes: ['GLOBAL'],
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
 * Findet die passende Zeile für einen LedgerEntry.
 *
 * Zweistufiges Matching:
 * 1. Wenn Entry ein categoryTag hat → NUR CATEGORY_TAG-Matches prüfen.
 *    Das stellt sicher, dass PLAN-Daten exakt der richtigen Zeile zugeordnet
 *    werden, unabhängig von der Anzeige-Reihenfolge.
 * 2. Wenn kein categoryTag (IST-Daten) → andere Kriterien (COUNTERPARTY_PATTERN,
 *    DESCRIPTION_PATTERN, etc.).
 * 3. Fallback-Zeilen greifen in beiden Fällen als letzte Option.
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
  const eligibleRows = rows.filter(row =>
    row.flowType === flowType &&
    !row.isSummary &&
    row.matches.length > 0
  );

  // --- Stufe 1: CATEGORY_TAG (für PLAN-Daten) ---
  if (entry.categoryTag) {
    for (const row of eligibleRows) {
      const tagMatch = row.matches.find(m => m.type === 'CATEGORY_TAG');
      if (tagMatch && tagMatch.value === entry.categoryTag) {
        return row;
      }
    }
    // categoryTag gesetzt aber keine passende Zeile → weiter zu Stufe 2/Fallback
  }

  // --- Stufe 2: Andere Kriterien (für IST-Daten ohne categoryTag) ---
  // Sortierung: spezifisch zuerst, Fallback zuletzt
  const sortedRows = [...eligibleRows].sort((a, b) => {
    const aIsFallback = a.matches.some(m => m.type === 'FALLBACK');
    const bIsFallback = b.matches.some(m => m.type === 'FALLBACK');
    if (aIsFallback && !bIsFallback) return 1;
    if (!aIsFallback && bIsFallback) return -1;
    return a.order - b.order;
  });

  for (const row of sortedRows) {
    let matchCount = 0;
    // Zähle nur Nicht-CATEGORY_TAG und Nicht-FALLBACK Matches
    const otherMatches = row.matches.filter(
      m => m.type !== 'FALLBACK' && m.type !== 'CATEGORY_TAG'
    );
    const requiredMatches = otherMatches.length;

    for (const match of row.matches) {
      switch (match.type) {
        case 'CATEGORY_TAG':
          break; // Bereits in Stufe 1 geprüft
        case 'COUNTERPARTY_ID':
          if (entry.counterpartyId === match.value) matchCount++;
          break;
        case 'COUNTERPARTY_PATTERN':
          if (entry.counterpartyName && new RegExp(match.value, 'i').test(entry.counterpartyName)) matchCount++;
          break;
        case 'LOCATION_ID':
          if (entry.locationId === match.value) matchCount++;
          break;
        case 'BANK_ACCOUNT_ID':
          if (entry.bankAccountId === match.value) matchCount++;
          break;
        case 'DESCRIPTION_PATTERN':
          if (new RegExp(match.value, 'i').test(entry.description)) matchCount++;
          break;
        case 'LEGAL_BUCKET':
          if (entry.legalBucket === match.value) matchCount++;
          break;
        case 'FALLBACK':
          if (match.value === flowType || match.value === `${flowType}_OPERATIVE`) {
            return row;
          }
          break;
      }
    }

    if (requiredMatches > 0 && matchCount > 0) {
      return row;
    }
  }

  return null;
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
 * Mappt einen Neumasse-categoryTag auf den entsprechenden Altforderungs-categoryTag.
 *
 * Beispiel: 'HZV' → 'ALTFORDERUNG_HZV'
 *
 * Wird verwendet für estateRatio-Splitting:
 * - Neu-Anteil → Original categoryTag
 * - Alt-Anteil → Altforderungs-categoryTag
 */
export function getAltforderungCategoryTag(neumasseTag: string | null): string | null {
  if (!neumasseTag) return null;

  const mapping: Record<string, string> = {
    'HZV': 'ALTFORDERUNG_HZV',
    'KV': 'ALTFORDERUNG_KV',
    'PVS': 'ALTFORDERUNG_PVS',
  };

  return mapping[neumasseTag] || null;
}
