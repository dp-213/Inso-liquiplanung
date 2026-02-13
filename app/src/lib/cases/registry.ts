/**
 * Case-Config-Registry
 *
 * Mappt caseNumber auf die jeweilige Case-Config.
 * Neue Fälle: Einfach config.ts anlegen und hier registrieren.
 */

import type { SettlerConfig } from '@/lib/types/allocation';
import { HAEVG_SETTLERS, HAEVG_CASE_NUMBER } from './haevg-plus/config';

export interface CaseConfig {
  settlers: Record<string, SettlerConfig>;
  /** Optionale rechtliche Referenzen pro Settler-Key */
  legalReferences?: Record<string, string>;
}

const CASE_CONFIGS: Record<string, CaseConfig> = {
  [HAEVG_CASE_NUMBER]: {
    settlers: HAEVG_SETTLERS,
    legalReferences: {
      kv: 'Massekreditvertrag §1(2)a',
      hzv: 'Massekreditvertrag §1(2)b',
      pvs: 'Massekreditvertrag §1(2)c',
    },
  },
};

/**
 * Gibt die Case-Config für eine caseNumber zurück.
 * Gibt null zurück, wenn kein Config registriert ist.
 */
export function getCaseConfig(caseNumber: string): CaseConfig | null {
  return CASE_CONFIGS[caseNumber] ?? null;
}
