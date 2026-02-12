/**
 * Case-spezifische Konfiguration: Hausärztliche Versorgung PLUS eG
 *
 * Stichtag: 29.10.2025 (Insolvenzantrag)
 *
 * Abrechnungsstellen:
 * - KV Nordrhein: Quartalsweise, 90 Tage Verzögerung
 * - HZV-Vertrag: Monatlich, Vormonat-Logik
 * - PVS rhein-ruhr: Per Behandlung, erfordert serviceDate
 *
 * Banken:
 * - Sparkasse Velbert: Vereinbarung vorhanden (10% Fortführungsbeitrag, Cap 137.000 EUR)
 * - apobank: Vereinbarung vorhanden (10% Fortführungsbeitrag, Cap 100.000 EUR)
 */

import {
  type SettlerConfig,
  type ContractSplitRule,
  type BankAgreementStatusType,
  AllocationSource,
  SettlementRhythm,
  FallbackRule,
  BankAgreementStatus,
} from '@/lib/types/allocation';

// =============================================================================
// CASE METADATA
// =============================================================================

export const HAEVG_CASE_NUMBER = 'HAEVG-PLUS-2025';
export const HAEVG_DEBTOR_NAME = 'Hausärztliche Versorgung PLUS eG';
export const HAEVG_CUTOFF_DATE = new Date('2025-10-29');

// =============================================================================
// LOCATIONS (Praxen/Standorte)
// =============================================================================

export interface LocationConfig {
  name: string;
  bankKey: string;
}

export const HAEVG_LOCATIONS: Record<string, LocationConfig> = {
  velbert: {
    name: 'Praxis Velbert',
    bankKey: 'sparkasse',
  },
  uckerath: {
    name: 'Praxis Uckerath',
    bankKey: 'apobank',
  },
  eitorf: {
    name: 'Zweigstelle Eitorf',
    bankKey: 'apobank',
  },
};

// =============================================================================
// SETTLERS (Abrechnungsstellen)
// =============================================================================

/**
 * KV Nordrhein - Kassenärztliche Vereinigung
 *
 * - Quartalsweise Abrechnung
 * - Ca. 90 Tage Verzögerung
 * - Q4/2025: Vertragsregel 1/3 Alt, 2/3 Neu (NICHT zeitanteilig!)
 */
const KV_SPLIT_RULES: Record<string, ContractSplitRule> = {
  // Q4/2025: Vertraglich vereinbarter Split
  Q4_2025: {
    altRatio: 1 / 3,
    neuRatio: 2 / 3,
    source: AllocationSource.VERTRAGSREGEL,
    note: 'Vertraglich vereinbarter Split gem. KV-Vereinbarung Q4/2025',
  },
  // Q3/2025 und früher: Vollständig Altmasse
  Q3_2025: {
    altRatio: 1,
    neuRatio: 0,
    source: AllocationSource.VERTRAGSREGEL,
    note: 'Q3/2025 vollständig vor Stichtag (29.10.2025)',
  },
  Q2_2025: {
    altRatio: 1,
    neuRatio: 0,
    source: AllocationSource.VERTRAGSREGEL,
    note: 'Q2/2025 vollständig vor Stichtag',
  },
  Q1_2025: {
    altRatio: 1,
    neuRatio: 0,
    source: AllocationSource.VERTRAGSREGEL,
    note: 'Q1/2025 vollständig vor Stichtag',
  },
  // Q1/2026 und später: Vollständig Neumasse
  Q1_2026: {
    altRatio: 0,
    neuRatio: 1,
    source: AllocationSource.VERTRAGSREGEL,
    note: 'Q1/2026 vollständig nach Stichtag',
  },
};

export const KV_CONFIG: SettlerConfig = {
  name: 'KV Nordrhein',
  rhythm: SettlementRhythm.QUARTERLY,
  lagDays: 90,
  splitRules: KV_SPLIT_RULES,
};

/**
 * HZV-Vertrag (Hausarztzentrierte Versorgung)
 *
 * - Monatliche Abrechnung
 * - Ca. 30 Tage Verzögerung
 * - Vormonat-Logik: Zahlung im Dezember bezieht sich auf November
 * - Oktober 2025: 28/31 Alt, 3/31 Neu (Stichtag 29.10. = erster Tag Neumasse)
 */
const HZV_SPLIT_RULES: Record<string, ContractSplitRule> = {
  // Oktober 2025: Zeitanteilige Aufteilung
  // Stichtag 29.10.2025 = Insolvenzeröffnung = erster Tag Neumasse
  // Tage 1-28 = Altmasse (28 Tage), Tage 29-31 = Neumasse (3 Tage)
  '2025-10': {
    altRatio: 28 / 31, // 28 Tage vor Stichtag (1.-28. Oktober)
    neuRatio: 3 / 31, // 3 Tage ab Stichtag (29.-31. Oktober)
    source: AllocationSource.VERTRAGSREGEL,
    note: 'Gem. Massekreditvertrag §1(2)b: 28/31 Alt (1.-28.10.), 3/31 Neu (29.-31.10.)',
  },
  // September 2025 und früher: Vollständig Altmasse
  '2025-09': {
    altRatio: 1,
    neuRatio: 0,
    source: AllocationSource.VORMONAT_LOGIK,
    note: 'September 2025 vollständig vor Stichtag',
  },
  // November 2025 und später: Vollständig Neumasse
  '2025-11': {
    altRatio: 0,
    neuRatio: 1,
    source: AllocationSource.VORMONAT_LOGIK,
    note: 'November 2025 vollständig nach Stichtag',
  },
};

export const HZV_CONFIG: SettlerConfig = {
  name: 'HZV-Vertrag',
  rhythm: SettlementRhythm.MONTHLY,
  lagDays: 30,
  fallbackRule: FallbackRule.VORMONAT,
  splitRules: HZV_SPLIT_RULES,
};

/**
 * PVS rhein-ruhr (Privatärztliche Verrechnungsstelle)
 *
 * - Abrechnung per Behandlung
 * - Ca. 45 Tage Verzögerung
 * - ERFORDERT serviceDate für Alt/Neu-Zuordnung
 * - Ohne serviceDate → UNKLAR (manuelles Mapping erforderlich)
 */
export const PVS_CONFIG: SettlerConfig = {
  name: 'PVS rhein-ruhr',
  rhythm: SettlementRhythm.PER_TREATMENT,
  lagDays: 45,
  requiresServiceDate: true,
  fallbackRule: FallbackRule.UNKLAR_MANUELL,
};

/**
 * Alle Abrechnungsstellen für HAEVG PLUS
 */
export const HAEVG_SETTLERS: Record<string, SettlerConfig> = {
  kv: KV_CONFIG,
  hzv: HZV_CONFIG,
  pvs: PVS_CONFIG,
};

// =============================================================================
// BANKS (Bankverbindungen mit Vereinbarungen)
// =============================================================================

export interface BankConfig {
  name: string;
  hasGlobalAssignment: boolean;
  agreementStatus: BankAgreementStatusType;
  /** Fortführungsbeitrag (z.B. 0.10 für 10%) - NULL wenn nicht vereinbart */
  contributionRate: number | null;
  /** USt auf Fortführungsbeitrag (z.B. 0.19 für 19%) - NULL wenn nicht vereinbart */
  contributionVatRate: number | null;
  /** Massekredit-Cap in Cents - NULL wenn nicht vereinbart */
  creditCapCents: bigint | null;
  /** Ist die Vereinbarung unsicher? */
  isUncertain: boolean;
  /** Erklärung der Unsicherheit */
  uncertaintyNote: string | null;
}

/**
 * Sparkasse Velbert
 *
 * - Globalzession vorhanden
 * - Unechter Massekreditvertrag, unterschrieben
 * - 10% Fortführungsbeitrag zzgl. 19% USt
 * - Max. 137.000 EUR Massekredit
 * - Laufzeit bis 31.08.2026
 * - Sicherheit: Neuforderungen aus Velbert (Bargeschäft § 142 InsO)
 */
export const SPARKASSE_CONFIG: BankConfig = {
  name: 'Sparkasse Velbert',
  hasGlobalAssignment: true,
  agreementStatus: BankAgreementStatus.VEREINBART,
  contributionRate: 0.1, // 10%
  contributionVatRate: 0.19, // 19%
  creditCapCents: BigInt(13700000), // 137.000 EUR
  isUncertain: false,
  uncertaintyNote: null,
};

/**
 * apobank
 *
 * - Globalzession vorhanden (HZV/KV/PVS vom 08./09.07.2024)
 * - Massekreditvertrag unterschrieben (apoBank 15.01.2026, HVPlus 20.01.2026)
 * - 10% Fortführungsbeitrag zzgl. 19% USt
 * - Max. 100.000 EUR Massekredit
 * - Laufzeit bis 31.08.2026
 * - Einzugskonto: ISK Uckerath (DE91 6005 0101 0400 0801 56)
 */
export const APOBANK_CONFIG: BankConfig = {
  name: 'apobank',
  hasGlobalAssignment: true,
  agreementStatus: BankAgreementStatus.VEREINBART,
  contributionRate: 0.1, // 10%
  contributionVatRate: 0.19, // 19%
  creditCapCents: BigInt(10000000), // 100.000 EUR
  isUncertain: false,
  uncertaintyNote: null,
};

/**
 * Alle Banken für HAEVG PLUS
 */
export const HAEVG_BANKS: Record<string, BankConfig> = {
  sparkasse: SPARKASSE_CONFIG,
  apobank: APOBANK_CONFIG,
};

// =============================================================================
// FULL CONFIG EXPORT
// =============================================================================

export const HAEVG_CONFIG = {
  caseNumber: HAEVG_CASE_NUMBER,
  debtorName: HAEVG_DEBTOR_NAME,
  cutoffDate: HAEVG_CUTOFF_DATE,
  locations: HAEVG_LOCATIONS,
  settlers: HAEVG_SETTLERS,
  banks: HAEVG_BANKS,
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Ermittelt das Quartal für ein Datum
 */
export function getQuarterKey(date: Date): string {
  const year = date.getFullYear();
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `Q${quarter}_${year}`;
}

/**
 * Ermittelt den Monat für ein Datum (Format: YYYY-MM)
 */
export function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Findet die passende Split-Regel für eine Abrechnungsstelle und Periode
 */
export function findSplitRule(
  settlerKey: string,
  periodKey: string
): ContractSplitRule | undefined {
  const settler = HAEVG_SETTLERS[settlerKey];
  if (!settler?.splitRules) return undefined;
  return settler.splitRules[periodKey];
}

/**
 * Ermittelt die Bank-Konfiguration für einen Standort
 */
export function getBankForLocation(locationKey: string): BankConfig | undefined {
  const location = HAEVG_LOCATIONS[locationKey];
  if (!location) return undefined;
  return HAEVG_BANKS[location.bankKey];
}
