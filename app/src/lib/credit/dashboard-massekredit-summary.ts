/**
 * Dashboard-Integration für Massekredit-Berechnung
 *
 * Nutzt die bestehenden Funktionen aus calculate-massekredit.ts.
 * Keine Logik-Duplikation - nur ein dünner Wrapper für die Dashboard-API.
 */

import {
  loadBankMassekreditInputs,
  calculateCaseMassekreditSummary,
  type CaseMassekreditSummary,
} from './calculate-massekredit';

export interface DashboardMassekreditResult {
  altforderungenBruttoCents: bigint;
  fortfuehrungsbeitragCents: bigint;
  fortfuehrungsbeitragUstCents: bigint;
  massekreditAltforderungenCents: bigint;
  hasUncertainBanks: boolean;
}

/**
 * Berechnet die Massekredit-Summary für das Dashboard.
 * Gibt null zurück wenn keine BankAgreements vorhanden sind.
 */
export async function getDashboardMassekreditSummary(
  caseId: string
): Promise<DashboardMassekreditResult | null> {
  const inputs = await loadBankMassekreditInputs(caseId);
  if (inputs.length === 0) return null;

  const summary: CaseMassekreditSummary = await calculateCaseMassekreditSummary(caseId, inputs);
  return summary.total;
}
