/**
 * Allocation Types für Alt/Neu-Masse-Zuordnung
 *
 * Zentrale Type-Definitionen für:
 * - Estate Allocation (Altmasse/Neumasse)
 * - Allocation Source (Revisionssprache)
 * - Split-Konfiguration
 */

import { Decimal } from '@prisma/client/runtime/library';

// =============================================================================
// ESTATE ALLOCATION (Alt/Neu-Masse)
// =============================================================================

/**
 * Estate Allocation - Zuordnung zu Altmasse oder Neumasse
 *
 * - ALTMASSE: Leistung/Forderung vollständig vor Stichtag
 * - NEUMASSE: Leistung/Forderung vollständig nach Stichtag
 * - MIXED: Teils vor, teils nach Stichtag (mit estateRatio)
 * - UNKLAR: Keine automatische Zuordnung möglich - Review erforderlich
 */
export const EstateAllocation = {
  ALTMASSE: 'ALTMASSE',
  NEUMASSE: 'NEUMASSE',
  MIXED: 'MIXED',
  UNKLAR: 'UNKLAR',
} as const;

export type EstateAllocationType = (typeof EstateAllocation)[keyof typeof EstateAllocation];

// =============================================================================
// ALLOCATION SOURCE (Revisionssprache)
// =============================================================================

/**
 * Allocation Source - Herkunft der Zuordnungsentscheidung
 *
 * Wichtig für Revision: Jede Zuordnung muss nachvollziehbar begründet sein.
 *
 * - VERTRAGSREGEL: Explizite Vertragsregel (z.B. KV Q4: 1/3-2/3)
 * - SERVICE_DATE_RULE: Binär vor/nach Stichtag basierend auf serviceDate
 * - PERIOD_PRORATA: Zeitanteilige Aufteilung basierend auf servicePeriod
 * - VORMONAT_LOGIK: HZV-spezifisch: Zahlung bezieht sich auf Vormonat
 * - MANUELL: Manuelle Zuordnung durch Benutzer
 * - UNKLAR: Keine Regel anwendbar - Review erforderlich
 */
export const AllocationSource = {
  VERTRAGSREGEL: 'VERTRAGSREGEL',
  SERVICE_DATE_RULE: 'SERVICE_DATE_RULE',
  PERIOD_PRORATA: 'PERIOD_PRORATA',
  VORMONAT_LOGIK: 'VORMONAT_LOGIK',
  MANUELL: 'MANUELL',
  UNKLAR: 'UNKLAR',
} as const;

export type AllocationSourceType = (typeof AllocationSource)[keyof typeof AllocationSource];

/**
 * Labels für UI-Anzeige
 */
export const AllocationSourceLabels: Record<AllocationSourceType, string> = {
  VERTRAGSREGEL: 'Vertragsregel',
  SERVICE_DATE_RULE: 'Leistungsdatum',
  PERIOD_PRORATA: 'Zeitanteilig',
  VORMONAT_LOGIK: 'Vormonat-Logik',
  MANUELL: 'Manuell',
  UNKLAR: 'Unklar',
};

/**
 * Beschreibungen für Tooltips
 */
export const AllocationSourceDescriptions: Record<AllocationSourceType, string> = {
  VERTRAGSREGEL: 'Zuordnung basiert auf einer expliziten Vertragsregel',
  SERVICE_DATE_RULE: 'Zuordnung basiert auf dem Leistungsdatum (vor/nach Stichtag)',
  PERIOD_PRORATA: 'Zeitanteilige Aufteilung basierend auf Leistungszeitraum',
  VORMONAT_LOGIK: 'HZV-Regel: Zahlung bezieht sich auf Vormonat',
  MANUELL: 'Manuelle Zuordnung durch Benutzer',
  UNKLAR: 'Keine automatische Zuordnung möglich - Review erforderlich',
};

// =============================================================================
// ALLOCATION RESULT
// =============================================================================

/**
 * Ergebnis der Estate-Allokation
 *
 * Enthält alle Informationen für Audit-Trail und UI-Anzeige.
 */
export interface AllocationResult {
  /** Zuordnung zu Alt/Neu-Masse */
  estateAllocation: EstateAllocationType;

  /** Bei MIXED: Anteil Neumasse (0.0-1.0) als Decimal für Präzision */
  estateRatio?: Decimal;

  /** Herkunft der Zuordnung (für Revision) */
  allocationSource: AllocationSourceType;

  /** Erklärungstext für Audit-Trail */
  allocationNote: string;

  /** Zeigt an, ob manuelle Prüfung erforderlich ist */
  requiresManualReview: boolean;
}

// =============================================================================
// SPLIT RATIO
// =============================================================================

/**
 * Split-Ratio für Alt/Neu-Aufteilung
 */
export interface SplitRatio {
  /** Anteil Altmasse (0.0-1.0) */
  altRatio: number;

  /** Anteil Neumasse (0.0-1.0) */
  neuRatio: number;

  /** Tage vor Stichtag (bei PERIOD_PRORATA) */
  altDays?: number;

  /** Tage nach Stichtag (bei PERIOD_PRORATA) */
  neuDays?: number;

  /** Gesamttage (bei PERIOD_PRORATA) */
  totalDays?: number;
}

// =============================================================================
// CONTRACT SPLIT RULE
// =============================================================================

/**
 * Vertragsregel für Split-Konfiguration
 *
 * Explizite Vertragsregeln haben Vorrang vor automatischer Berechnung.
 */
export interface ContractSplitRule {
  /** Anteil Altmasse (0.0-1.0) */
  altRatio: number;

  /** Anteil Neumasse (0.0-1.0) */
  neuRatio: number;

  /** Quelle der Regel */
  source: AllocationSourceType;

  /** Erklärungstext für Audit */
  note: string;
}

// =============================================================================
// SETTLER CONFIG (Abrechnungsstelle)
// =============================================================================

/**
 * Abrechnungsrhythmus
 */
export const SettlementRhythm = {
  QUARTERLY: 'QUARTERLY',
  MONTHLY: 'MONTHLY',
  PER_TREATMENT: 'PER_TREATMENT',
} as const;

export type SettlementRhythmType = (typeof SettlementRhythm)[keyof typeof SettlementRhythm];

/**
 * Fallback-Regel wenn keine explizite Regel greift
 */
export const FallbackRule = {
  VORMONAT: 'VORMONAT',
  UNKLAR_MANUELL: 'UNKLAR_MANUELL',
} as const;

export type FallbackRuleType = (typeof FallbackRule)[keyof typeof FallbackRule];

/**
 * Konfiguration für eine Abrechnungsstelle (z.B. KV, HZV, PVS)
 */
export interface SettlerConfig {
  /** Name der Abrechnungsstelle */
  name: string;

  /** Abrechnungsrhythmus */
  rhythm: SettlementRhythmType;

  /** Tage Verzögerung zwischen Leistung und Zahlung */
  lagDays: number;

  /** Erfordert serviceDate für Zuordnung? */
  requiresServiceDate?: boolean;

  /** Fallback-Regel wenn keine explizite Regel greift */
  fallbackRule?: FallbackRuleType;

  /** Explizite Split-Regeln nach Periode */
  splitRules?: Record<string, ContractSplitRule>;
}

// =============================================================================
// BANK AGREEMENT STATUS
// =============================================================================

/**
 * Status einer Bankvereinbarung
 */
export const BankAgreementStatus = {
  OFFEN: 'OFFEN',
  VERHANDLUNG: 'VERHANDLUNG',
  VEREINBART: 'VEREINBART',
} as const;

export type BankAgreementStatusType =
  (typeof BankAgreementStatus)[keyof typeof BankAgreementStatus];

/**
 * Labels für UI-Anzeige
 */
export const BankAgreementStatusLabels: Record<BankAgreementStatusType, string> = {
  OFFEN: 'Offen',
  VERHANDLUNG: 'In Verhandlung',
  VEREINBART: 'Vereinbart',
};

// =============================================================================
// MASSEKREDIT STATUS
// =============================================================================

/**
 * Annahme-Dokumentation für Transparenz
 */
export interface AssumptionDoc {
  /** Betroffenes Feld */
  field: string;

  /** Annahme / Wert */
  assumption: string;

  /** Quelle: VERTRAG, BERECHNET, NICHT_VEREINBART */
  source: 'VERTRAG' | 'BERECHNET' | 'NICHT_VEREINBART';
}

/**
 * Massekredit-Status für eine Bank
 *
 * Berechnung gem. Vertragslogik:
 * Massekredit Altforderungen =
 *   Altforderungszuflüsse (brutto)
 *   - Fortführungsbeitrag (z.B. 10%)
 *   - USt auf Fortführungsbeitrag (z.B. 19%)
 *   - USt auf Altforderungen (falls identifizierbar)
 */
export interface MassekreditStatus {
  /** Altforderungszuflüsse (brutto) in Cents */
  altforderungenBruttoCents: bigint;

  /** Fortführungsbeitrag in Cents (null wenn nicht vereinbart) */
  fortfuehrungsbeitragCents: bigint | null;

  /** USt auf Fortführungsbeitrag in Cents (null wenn nicht vereinbart) */
  fortfuehrungsbeitragUstCents: bigint | null;

  /** USt auf Altforderungen in Cents (null wenn nicht identifizierbar) */
  ustAufAltforderungenCents: bigint | null;

  /** Ergebnis: Massekredit Altforderungen in Cents */
  massekreditAltforderungenCents: bigint;

  /** Headroom bis Cap in Cents (null wenn kein Cap vereinbart) */
  headroomCents: bigint | null;

  /** Ist die Berechnung unsicher? */
  isUncertain: boolean;

  /** Erklärung der Unsicherheit */
  uncertaintyNote: string | null;

  /** Dokumentation der getroffenen Annahmen */
  assumptions: AssumptionDoc[];
}
