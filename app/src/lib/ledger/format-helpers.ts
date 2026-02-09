/**
 * Utility-Funktionen für Ledger-Anzeige
 * Übersetzt technische Codes in lesbare Beschreibungen für User
 */

/**
 * Übersetzt technische allocationSource-Werte in lesbare Beschreibungen
 */
export function formatAllocationSource(source: string | null | undefined): string {
  if (!source) return 'Unbekannt';

  const translations: Record<string, string> = {
    'AUTO_CALCULATED': 'Transaktionsdatum-Regel (vor/nach Insolvenz-Eröffnung)',
    'Q4_2025_RULE_1_3_2_3': 'Q4/2025-Regel (1/3 Alt, 2/3 Neu)',
    'SERVICE_PERIOD_BEFORE_CUTOFF': 'Leistungszeitraum vor Insolvenz-Eröffnung',
    'MASSEKREDITVERTRAG': 'Massekreditvertrag §1',
    'PERIOD_PRORATA': 'Anteilig nach Leistungszeitraum',
    'VORMONAT_LOGIK': 'Vormonats-Logik (Zahlung M = Leistung M-1)',
    'MANUAL': 'Manuelle Zuordnung',
    'VERTRAGSREGEL': 'Vertragsspezifische Regel',
  };

  return translations[source] || source;
}

/**
 * Übersetzt technische categoryTagSource-Werte in lesbare Beschreibungen
 */
export function formatCategoryTagSource(source: string | null | undefined): string {
  if (!source) return 'Unbekannt';

  const translations: Record<string, string> = {
    'AUTO': 'Automatische Klassifikation',
    'MANUAL': 'Manuelle Korrektur',
    'RULE': 'Regelbasierte Klassifikation',
    'AI': 'KI-gestützte Klassifikation',
  };

  return translations[source] || source;
}
