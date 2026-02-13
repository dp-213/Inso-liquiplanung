/**
 * Performance-Engine — P&L-Zeilen-Konfiguration
 *
 * Case-spezifisches Mapping: categoryTag → P&L-Zeile.
 * Aktuell nur HVPlus. Für neue Fälle: eigene Config-Datei + Registry.
 */

import type { PnLRowConfig } from './types';

// =============================================================================
// HVPlus P&L MAPPING
// =============================================================================

export const HVPLUS_PNL_MAPPING: PnLRowConfig[] = [
  // REVENUE — alle Leistungserlöse, leistungsmonatbezogen
  // Alt/Neu-Anteil wird aus estateAllocation automatisch berechnet
  { key: 'revenue_hzv', label: 'HZV', group: 'REVENUE', tags: ['HZV', 'ALTFORDERUNG_HZV'] },
  { key: 'revenue_kv', label: 'KV', group: 'REVENUE', tags: ['KV', 'ALTFORDERUNG_KV'] },
  { key: 'revenue_pvs', label: 'PVS', group: 'REVENUE', tags: ['PVS', 'ALTFORDERUNG_PVS'] },
  { key: 'revenue_other', label: 'Sonstige Erlöse', group: 'REVENUE', tags: ['EINNAHME_SONSTIGE'] },

  // PERSONNEL_COST (aus EmployeeSalaryMonth, NICHT aus LedgerEntry)
  { key: 'personnel_gross', label: 'Bruttolöhne', group: 'PERSONNEL_COST', source: 'SALARY', field: 'grossSalaryCents' },
  { key: 'personnel_employer', label: 'AG-Kosten (SV, BG)', group: 'PERSONNEL_COST', source: 'SALARY', field: 'employerCostsCents' },

  // FIXED_COST
  { key: 'fixed_rent', label: 'Miete', group: 'FIXED_COST', tags: ['MIETE'] },
  { key: 'fixed_energy', label: 'Energie', group: 'FIXED_COST', tags: ['STROM'] },
  { key: 'fixed_it', label: 'IT/Software', group: 'FIXED_COST', tags: ['BUERO_IT', 'KOMMUNIKATION'] },
  { key: 'fixed_insurance', label: 'Versicherung', group: 'FIXED_COST', tags: ['VERSICHERUNG_BETRIEBLICH'] },
  { key: 'fixed_leasing', label: 'Leasing', group: 'FIXED_COST', tags: ['LEASING'] },
  { key: 'fixed_other', label: 'Sonstige Fix', group: 'FIXED_COST', tags: ['BETRIEBSKOSTEN', 'BANKGEBUEHREN', 'RUNDFUNK'] },

  // OTHER_COST — leer im MVP
  // Gruppe existiert im Type für zukünftige Fälle
];

// =============================================================================
// EXCLUDED TAGS (liquiditätsrelevant, aber NICHT performance-relevant)
// =============================================================================

export const EXCLUDED_FROM_PERFORMANCE: string[] = [
  // Keine Leistungserlöse
  'AUSKEHRUNG_ALTKONTEN',
  'INSO_EINZAHLUNG',
  // Keine operativen Kosten
  'DARLEHEN_TILGUNG',
  'STEUERN',
  'VERFAHRENSKOSTEN',
  // Insolvenz-Sondereffekte (einmalig, nicht operativ)
  'INSO_RUECKZAHLUNG',
  'INSO_VORFINANZIERUNG',
  'INSO_SACHAUFNAHME',
  // Personal in LedgerEntries → wird über EmployeeSalaryMonth abgebildet
  'PERSONAL',
  'SOZIALABGABEN',
  'ALTVERBINDLICHKEIT_PERSONAL',
  'ALTVERBINDLICHKEIT_BETRIEBSKOSTEN',
];

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validiert, dass kein Tag gleichzeitig in EXCLUDED und im PNL_MAPPING steht.
 * Wird bei Engine-Start aufgerufen.
 */
export function validateConfig(mapping: PnLRowConfig[]): string[] {
  const errors: string[] = [];
  const excludedSet = new Set(EXCLUDED_FROM_PERFORMANCE);

  for (const row of mapping) {
    if (!row.tags) continue;
    for (const tag of row.tags) {
      if (excludedSet.has(tag)) {
        errors.push(`Tag "${tag}" ist sowohl in EXCLUDED_FROM_PERFORMANCE als auch im PNL_MAPPING (Zeile "${row.key}").`);
      }
    }
  }

  return errors;
}

/**
 * Erstellt ein Lookup: categoryTag → PnLRowConfig key.
 * Nur für LEDGER-basierte Zeilen (nicht SALARY).
 */
export function buildTagToRowKeyMap(mapping: PnLRowConfig[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of mapping) {
    if (row.source === 'SALARY') continue;
    if (!row.tags) continue;
    for (const tag of row.tags) {
      map.set(tag, row.key);
    }
  }
  return map;
}
