/**
 * Insolvency-Specific Cashflow Categories
 *
 * This module defines the mandatory insolvency categories for liquidity planning.
 * All AI-derived cashflows must be classified into one of these categories.
 */

// =============================================================================
// INFLOW CATEGORIES (Einzahlungen)
// =============================================================================

export const INFLOW_CATEGORIES = {
  ALTFORDERUNGEN: 'ALTFORDERUNGEN',
  NEUFORDERUNGEN: 'NEUFORDERUNGEN',
  KV_ZAHLUNGEN: 'KV_ZAHLUNGEN',
  HZV_ZAHLUNGEN: 'HZV_ZAHLUNGEN',
  SONSTIGE_ERLOESE: 'SONSTIGE_ERLOESE',
  EINMALIGE_SONDERZUFLUESSE: 'EINMALIGE_SONDERZUFLUESSE',
} as const;

export type InflowCategory = typeof INFLOW_CATEGORIES[keyof typeof INFLOW_CATEGORIES];

export const INFLOW_CATEGORY_LABELS: Record<InflowCategory, string> = {
  ALTFORDERUNGEN: 'Altforderungen (vor Insolvenz)',
  NEUFORDERUNGEN: 'Neuforderungen (nach Insolvenz)',
  KV_ZAHLUNGEN: 'KV-Zahlungen',
  HZV_ZAHLUNGEN: 'HZV-Zahlungen',
  SONSTIGE_ERLOESE: 'Sonstige Erloese',
  EINMALIGE_SONDERZUFLUESSE: 'Einmalige Sonderzufluesse',
};

export const INFLOW_CATEGORY_DESCRIPTIONS: Record<InflowCategory, string> = {
  ALTFORDERUNGEN: 'Forderungen, die vor Eroeffnung des Insolvenzverfahrens entstanden sind',
  NEUFORDERUNGEN: 'Forderungen, die nach Eroeffnung des Insolvenzverfahrens entstanden sind',
  KV_ZAHLUNGEN: 'Zahlungen aus Kaufvertraegen (Kundenanzahlungen, Restzahlungen)',
  HZV_ZAHLUNGEN: 'Zahlungen aus Handwerkervertraegen und Werkleistungen',
  SONSTIGE_ERLOESE: 'Andere laufende Einnahmen (z.B. Mietertraege, Lizenzgebuehren)',
  EINMALIGE_SONDERZUFLUESSE: 'Einmalige ausserordentliche Zufluesse (z.B. Verkaeufe, Rueckerstattungen)',
};

// =============================================================================
// OUTFLOW CATEGORIES (Auszahlungen)
// =============================================================================

export const OUTFLOW_CATEGORIES = {
  PERSONALKOSTEN: 'PERSONALKOSTEN',
  MIETE_LEASING: 'MIETE_LEASING',
  LIEFERANTEN: 'LIEFERANTEN',
  SOZIALABGABEN_STEUERN: 'SOZIALABGABEN_STEUERN',
  MASSEKOSTEN: 'MASSEKOSTEN',
  BANK_SICHERUNGSRECHTE: 'BANK_SICHERUNGSRECHTE',
  SONSTIGE_LAUFENDE_KOSTEN: 'SONSTIGE_LAUFENDE_KOSTEN',
  EINMALIGE_SONDERABFLUESSE: 'EINMALIGE_SONDERABFLUESSE',
} as const;

export type OutflowCategory = typeof OUTFLOW_CATEGORIES[keyof typeof OUTFLOW_CATEGORIES];

export const OUTFLOW_CATEGORY_LABELS: Record<OutflowCategory, string> = {
  PERSONALKOSTEN: 'Personalkosten',
  MIETE_LEASING: 'Miete / Leasing',
  LIEFERANTEN: 'Lieferanten',
  SOZIALABGABEN_STEUERN: 'Sozialabgaben / Steuern',
  MASSEKOSTEN: 'Massekosten',
  BANK_SICHERUNGSRECHTE: 'Bankbezogene Abfluesse / Sicherungsrechte',
  SONSTIGE_LAUFENDE_KOSTEN: 'Sonstige laufende Kosten',
  EINMALIGE_SONDERABFLUESSE: 'Einmalige Sonderabfluesse',
};

export const OUTFLOW_CATEGORY_DESCRIPTIONS: Record<OutflowCategory, string> = {
  PERSONALKOSTEN: 'Loehne, Gehaelter, Abfindungen, Insolvenzgeld-Vorfinanzierung',
  MIETE_LEASING: 'Mietaufwendungen, Leasing-Raten fuer Fahrzeuge/Maschinen',
  LIEFERANTEN: 'Zahlungen an Lieferanten fuer Waren und Dienstleistungen',
  SOZIALABGABEN_STEUERN: 'Sozialversicherungsbeitraege, Lohnsteuer, Umsatzsteuer',
  MASSEKOSTEN: 'Kosten des Insolvenzverfahrens (Verwalterverguetung, Gerichtskosten)',
  BANK_SICHERUNGSRECHTE: 'Bankgebuehren, Sicherungsuebertragungen, Kreditrueckfuehrung',
  SONSTIGE_LAUFENDE_KOSTEN: 'Versicherungen, Energie, Kommunikation, sonstige Betriebskosten',
  EINMALIGE_SONDERABFLUESSE: 'Einmalige ausserordentliche Abfluesse (z.B. Vergleichszahlungen)',
};

// =============================================================================
// ESTATE TYPE (Alt- vs Neumasse)
// =============================================================================

export const ESTATE_TYPES = {
  ALTMASSE: 'ALTMASSE',
  NEUMASSE: 'NEUMASSE',
  NICHT_ZUORDENBAR: 'NICHT_ZUORDENBAR',
} as const;

export type EstateType = typeof ESTATE_TYPES[keyof typeof ESTATE_TYPES];

export const ESTATE_TYPE_LABELS: Record<EstateType, string> = {
  ALTMASSE: 'Altmasse',
  NEUMASSE: 'Neumasse',
  NICHT_ZUORDENBAR: 'Nicht eindeutig zuordenbar',
};

export const ESTATE_TYPE_DESCRIPTIONS: Record<EstateType, string> = {
  ALTMASSE: 'Vermoegen, das bei Verfahrenseroeffnung vorhanden war',
  NEUMASSE: 'Vermoegen, das nach Verfahrenseroeffnung erworben wurde',
  NICHT_ZUORDENBAR: 'Zuordnung zur Masse kann nicht eindeutig bestimmt werden',
};

// =============================================================================
// VALUE TYPE (IST vs PLAN)
// =============================================================================

export const VALUE_TYPES = {
  IST: 'IST',
  PLAN: 'PLAN',
  UNSICHER: 'UNSICHER',
} as const;

export type ValueType = typeof VALUE_TYPES[keyof typeof VALUE_TYPES];

export const VALUE_TYPE_LABELS: Record<ValueType, string> = {
  IST: 'IST-Wert (tatsaechlich)',
  PLAN: 'PLAN-Wert (geplant)',
  UNSICHER: 'Unsicher (nicht eindeutig)',
};

// =============================================================================
// UNCERTAINTY MARKERS
// =============================================================================

export const UNCERTAINTY_LEVELS = {
  SICHER: 'SICHER',
  WAHRSCHEINLICH: 'WAHRSCHEINLICH',
  UNSICHER: 'UNSICHER',
  UNBEKANNT: 'UNBEKANNT',
} as const;

export type UncertaintyLevel = typeof UNCERTAINTY_LEVELS[keyof typeof UNCERTAINTY_LEVELS];

export const UNCERTAINTY_LABELS: Record<UncertaintyLevel, string> = {
  SICHER: 'Sicher',
  WAHRSCHEINLICH: 'Wahrscheinlich',
  UNSICHER: 'Unsicher',
  UNBEKANNT: 'Unbekannt',
};

export const UNCERTAINTY_COLORS: Record<UncertaintyLevel, string> = {
  SICHER: 'green',
  WAHRSCHEINLICH: 'blue',
  UNSICHER: 'amber',
  UNBEKANNT: 'red',
};

// =============================================================================
// AGGREGATED BUSINESS VIEW TYPES
// =============================================================================

/**
 * Represents a single derived cashflow entry with full context
 */
export interface DerivedCashflowEntry {
  id: string;
  flowType: 'INFLOW' | 'OUTFLOW';
  category: InflowCategory | OutflowCategory;
  estateType: EstateType;
  weekOffset: number; // 0-12
  valueType: ValueType;
  amountCents: number;
  isRecurring: boolean;

  // Source traceability
  sourceFileId: string;
  sourceFileName: string;
  sourceLocation: string;
  sourceRowIds: string[]; // Can aggregate multiple rows

  // Classification reasoning
  categoryReasoning: string;
  estateTypeReasoning: string;

  // Uncertainty markers
  categoryUncertainty: UncertaintyLevel;
  amountUncertainty: UncertaintyLevel;
  weekUncertainty: UncertaintyLevel;
  overallUncertainty: UncertaintyLevel;
  uncertaintyExplanation?: string;

  // Human validation state
  validationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  validatedBy?: string;
  validatedAt?: string;
  rejectionReason?: string;
  humanCorrections?: {
    field: string;
    originalValue: unknown;
    correctedValue: unknown;
    reason: string;
  }[];
}

/**
 * Aggregated view of a category
 */
export interface CategoryAggregation {
  category: InflowCategory | OutflowCategory;
  categoryLabel: string;
  flowType: 'INFLOW' | 'OUTFLOW';

  // Weekly breakdown
  weeklyTotals: {
    weekOffset: number;
    weekLabel: string; // e.g., "KW 3"
    amountCents: number;
    entryCount: number;
    hasUncertainty: boolean;
  }[];

  // Totals
  totalAmountCents: number;
  totalEntryCount: number;

  // Uncertainty summary
  uncertainEntryCount: number;
  uncertaintyPercentage: number;

  // Validation state
  validationStatus: 'PENDING' | 'PARTIAL' | 'APPROVED' | 'REJECTED';
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;

  // Source files contributing to this category
  sourceFiles: string[];
}

/**
 * Complete business-level view of AI interpretation
 */
export interface BusinessLevelView {
  jobId: string;
  caseId: string;
  caseNumber: string;
  debtorName: string;

  // Summary metrics
  planStartDate: string;
  weekCount: number; // Always 13

  // Aggregated inflows
  inflows: {
    categories: CategoryAggregation[];
    weeklyTotals: number[]; // 13 weeks
    grandTotal: number;
    uncertainCount: number;
  };

  // Aggregated outflows
  outflows: {
    categories: CategoryAggregation[];
    weeklyTotals: number[]; // 13 weeks
    grandTotal: number;
    uncertainCount: number;
  };

  // Overall validation
  overallValidationStatus: 'PENDING' | 'PARTIAL' | 'APPROVED';
  totalDerivedEntries: number;
  approvedEntries: number;
  pendingEntries: number;
  rejectedEntries: number;
  uncertainEntries: number;

  // Warnings and issues
  warnings: {
    type: 'UNCERTAIN_CATEGORY' | 'UNCERTAIN_AMOUNT' | 'UNCERTAIN_WEEK' | 'MISSING_DATA' | 'DUPLICATE_SUSPECTED';
    message: string;
    affectedEntryIds: string[];
    severity: 'INFO' | 'WARNING' | 'ERROR';
  }[];

  // Source file summary
  sourceFiles: {
    fileId: string;
    fileName: string;
    derivedEntryCount: number;
    uncertaintyCount: number;
  }[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the label for any category (inflow or outflow)
 */
export function getCategoryLabel(category: string): string {
  if (category in INFLOW_CATEGORY_LABELS) {
    return INFLOW_CATEGORY_LABELS[category as InflowCategory];
  }
  if (category in OUTFLOW_CATEGORY_LABELS) {
    return OUTFLOW_CATEGORY_LABELS[category as OutflowCategory];
  }
  return category;
}

/**
 * Determine if a category is valid
 */
export function isValidCategory(category: string, flowType: 'INFLOW' | 'OUTFLOW'): boolean {
  if (flowType === 'INFLOW') {
    return category in INFLOW_CATEGORIES;
  }
  return category in OUTFLOW_CATEGORIES;
}

/**
 * Get all categories for a flow type
 */
export function getCategoriesForFlowType(flowType: 'INFLOW' | 'OUTFLOW'): string[] {
  if (flowType === 'INFLOW') {
    return Object.keys(INFLOW_CATEGORIES);
  }
  return Object.keys(OUTFLOW_CATEGORIES);
}

/**
 * Calculate week label (e.g., "KW 3") from offset
 */
export function getWeekLabel(weekOffset: number, startDate?: Date): string {
  if (!startDate) {
    return `Woche ${weekOffset + 1}`;
  }
  const weekDate = new Date(startDate);
  weekDate.setDate(weekDate.getDate() + weekOffset * 7);
  const weekNumber = getISOWeekNumber(weekDate);
  return `KW ${weekNumber}`;
}

/**
 * Get ISO week number
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Format amount in German locale
 */
export function formatAmountCents(amountCents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amountCents / 100);
}

/**
 * Format amount in German locale (from euros)
 */
export function formatAmountEuros(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/**
 * Determine overall uncertainty from component uncertainties
 */
export function calculateOverallUncertainty(
  categoryUncertainty: UncertaintyLevel,
  amountUncertainty: UncertaintyLevel,
  weekUncertainty: UncertaintyLevel
): UncertaintyLevel {
  const levels: UncertaintyLevel[] = [categoryUncertainty, amountUncertainty, weekUncertainty];

  // If any is UNBEKANNT, overall is UNBEKANNT
  if (levels.includes('UNBEKANNT')) return 'UNBEKANNT';

  // If any is UNSICHER, overall is UNSICHER
  if (levels.includes('UNSICHER')) return 'UNSICHER';

  // If any is WAHRSCHEINLICH, overall is WAHRSCHEINLICH
  if (levels.includes('WAHRSCHEINLICH')) return 'WAHRSCHEINLICH';

  // All are SICHER
  return 'SICHER';
}

/**
 * Get CSS classes for uncertainty level
 */
export function getUncertaintyClasses(level: UncertaintyLevel): string {
  switch (level) {
    case 'SICHER':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'WAHRSCHEINLICH':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'UNSICHER':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'UNBEKANNT':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

/**
 * AI prompt context for insolvency-specific analysis
 */
export const AI_INSOLVENCY_CONTEXT = `
Du analysierst Finanzdaten im Kontext eines deutschen Insolvenzverfahrens.

PFLICHT-KATEGORIEN FUER EINZAHLUNGEN:
1. ALTFORDERUNGEN - Forderungen vor Verfahrenseroeffnung (Debitoren aus Altgeschaeft)
2. NEUFORDERUNGEN - Forderungen nach Verfahrenseroeffnung (laufende Umsaetze)
3. KV_ZAHLUNGEN - Zahlungen aus Kaufvertraegen
4. HZV_ZAHLUNGEN - Zahlungen aus Handwerkervertraegen
5. SONSTIGE_ERLOESE - Andere laufende Einnahmen
6. EINMALIGE_SONDERZUFLUESSE - Einmalige ausserordentliche Zufluesse

PFLICHT-KATEGORIEN FUER AUSZAHLUNGEN:
1. PERSONALKOSTEN - Loehne, Gehaelter, Abfindungen
2. MIETE_LEASING - Mieten, Leasing-Raten
3. LIEFERANTEN - Lieferantenrechnungen
4. SOZIALABGABEN_STEUERN - SV-Beitraege, Steuern
5. MASSEKOSTEN - Verfahrenskosten
6. BANK_SICHERUNGSRECHTE - Bankgebuehren, Kredite
7. SONSTIGE_LAUFENDE_KOSTEN - Sonstige Betriebskosten
8. EINMALIGE_SONDERABFLUESSE - Einmalige Sonderzahlungen

ALTMASSE vs NEUMASSE:
- ALTMASSE: Vermoegen bei Verfahrenseroeffnung vorhanden
- NEUMASSE: Vermoegen nach Verfahrenseroeffnung erworben
- Bei Unklarheit: "NICHT_ZUORDENBAR" mit Begruendung

UNSICHERHEITS-MARKIERUNGEN (PFLICHT):
- SICHER: Eindeutig aus Daten ableitbar
- WAHRSCHEINLICH: Mit hoher Wahrscheinlichkeit korrekt
- UNSICHER: Mehrere Interpretationen moeglich
- UNBEKANNT: Kann nicht bestimmt werden

REGELN:
1. NIEMALS raten - bei Unsicherheit immer markieren
2. IMMER begruenden, warum eine Kategorie gewaehlt wurde
3. Datum/Woche aus Kontext ableiten, nicht erfinden
4. IST vs PLAN unterscheiden wenn moeglich
5. Wiederkehrende Zahlungen erkennen und markieren
`;

export default {
  INFLOW_CATEGORIES,
  OUTFLOW_CATEGORIES,
  ESTATE_TYPES,
  VALUE_TYPES,
  UNCERTAINTY_LEVELS,
  getCategoryLabel,
  isValidCategory,
  getWeekLabel,
  formatAmountCents,
  formatAmountEuros,
  AI_INSOLVENCY_CONTEXT,
};
