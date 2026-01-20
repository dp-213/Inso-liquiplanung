/**
 * Split-Engine für Alt/Neu-Masse-Zuordnung
 *
 * Fallback-Kette für Estate-Allokation:
 * 1. Explizite Vertragsregel (z.B. KV Q4: 1/3-2/3) → VERTRAGSREGEL
 * 2. serviceDate vorhanden → Binär vor/nach Stichtag → SERVICE_DATE_RULE
 * 3. servicePeriod (Start+End) → Zeitanteilige Aufteilung → PERIOD_PRORATA
 * 4. HZV: Monatslogik (Zahlung = Vormonat) → VORMONAT_LOGIK
 * 5. PVS ohne serviceDate → UNKLAR (manuelles Mapping erforderlich)
 */

import { Decimal } from '@prisma/client/runtime/library';
import {
  type AllocationResult,
  type SettlerConfig,
  type SplitRatio,
  type ContractSplitRule,
  EstateAllocation,
  AllocationSource,
  FallbackRule,
  SettlementRhythm,
} from '@/lib/types/allocation';

// =============================================================================
// MAIN ALLOCATION FUNCTION
// =============================================================================

/**
 * Bestimmt die Estate-Allokation für einen LedgerEntry
 *
 * @param entry - Partial LedgerEntry mit relevanten Feldern
 * @param counterpartyConfig - Konfiguration der Abrechnungsstelle (optional)
 * @param cutoffDate - Stichtag des Insolvenzverfahrens
 * @param periodKey - Periode für Vertragsregel-Lookup (z.B. "Q4_2025" oder "2025-10")
 */
export function determineEstateAllocation(
  entry: {
    transactionDate: Date;
    serviceDate?: Date | null;
    servicePeriodStart?: Date | null;
    servicePeriodEnd?: Date | null;
  },
  counterpartyConfig: SettlerConfig | null | undefined,
  cutoffDate: Date,
  periodKey?: string
): AllocationResult {
  // 1. Explizite Vertragsregel?
  if (counterpartyConfig && periodKey) {
    const contractRule = findContractRule(counterpartyConfig, periodKey);
    if (contractRule) {
      return createAllocationFromContractRule(contractRule);
    }
  }

  // 2. serviceDate vorhanden? → Binär vor/nach Stichtag
  if (entry.serviceDate) {
    return createAllocationFromServiceDate(entry.serviceDate, cutoffDate);
  }

  // 3. servicePeriod (Start+End) vorhanden? → Zeitanteilig
  if (entry.servicePeriodStart && entry.servicePeriodEnd) {
    return createAllocationFromServicePeriod(
      entry.servicePeriodStart,
      entry.servicePeriodEnd,
      cutoffDate
    );
  }

  // 4. Fallback-Regeln der Abrechnungsstelle
  if (counterpartyConfig?.fallbackRule) {
    switch (counterpartyConfig.fallbackRule) {
      case FallbackRule.VORMONAT:
        return createAllocationFromVormonatLogik(entry.transactionDate, cutoffDate);

      case FallbackRule.UNKLAR_MANUELL:
        return {
          estateAllocation: EstateAllocation.UNKLAR,
          allocationSource: AllocationSource.UNKLAR,
          allocationNote: `${counterpartyConfig.name}: Zahlung ohne Leistungsdatum - manuelle Zuordnung erforderlich`,
          requiresManualReview: true,
        };
    }
  }

  // 5. Kein Match → UNKLAR
  return {
    estateAllocation: EstateAllocation.UNKLAR,
    allocationSource: AllocationSource.UNKLAR,
    allocationNote: 'Keine Regel anwendbar - manuelle Prüfung erforderlich',
    requiresManualReview: true,
  };
}

// =============================================================================
// ALLOCATION STRATEGIES
// =============================================================================

/**
 * Findet die passende Vertragsregel
 */
function findContractRule(
  config: SettlerConfig,
  periodKey: string
): ContractSplitRule | undefined {
  return config.splitRules?.[periodKey];
}

/**
 * Erstellt AllocationResult aus Vertragsregel
 */
function createAllocationFromContractRule(rule: ContractSplitRule): AllocationResult {
  const estateAllocation =
    rule.altRatio === 1
      ? EstateAllocation.ALTMASSE
      : rule.neuRatio === 1
        ? EstateAllocation.NEUMASSE
        : EstateAllocation.MIXED;

  return {
    estateAllocation,
    estateRatio: estateAllocation === EstateAllocation.MIXED ? new Decimal(rule.neuRatio) : undefined,
    allocationSource: rule.source,
    allocationNote: rule.note,
    requiresManualReview: false,
  };
}

/**
 * Erstellt AllocationResult aus Leistungsdatum (binär vor/nach Stichtag)
 */
function createAllocationFromServiceDate(serviceDate: Date, cutoffDate: Date): AllocationResult {
  const isAlt = serviceDate < cutoffDate;

  return {
    estateAllocation: isAlt ? EstateAllocation.ALTMASSE : EstateAllocation.NEUMASSE,
    allocationSource: AllocationSource.SERVICE_DATE_RULE,
    allocationNote: `Leistungsdatum ${formatDate(serviceDate)} ${isAlt ? 'vor' : 'nach'} Stichtag (${formatDate(cutoffDate)})`,
    requiresManualReview: false,
  };
}

/**
 * Erstellt AllocationResult aus Leistungszeitraum (zeitanteilig)
 */
function createAllocationFromServicePeriod(
  periodStart: Date,
  periodEnd: Date,
  cutoffDate: Date
): AllocationResult {
  const ratio = calculatePeriodProrata(periodStart, periodEnd, cutoffDate);

  // Vollständig vor/nach Stichtag?
  if (ratio.altRatio === 1) {
    return {
      estateAllocation: EstateAllocation.ALTMASSE,
      allocationSource: AllocationSource.PERIOD_PRORATA,
      allocationNote: `Leistungszeitraum ${formatDate(periodStart)} - ${formatDate(periodEnd)} vollständig vor Stichtag`,
      requiresManualReview: false,
    };
  }

  if (ratio.neuRatio === 1) {
    return {
      estateAllocation: EstateAllocation.NEUMASSE,
      allocationSource: AllocationSource.PERIOD_PRORATA,
      allocationNote: `Leistungszeitraum ${formatDate(periodStart)} - ${formatDate(periodEnd)} vollständig nach Stichtag`,
      requiresManualReview: false,
    };
  }

  // Gemischt
  return {
    estateAllocation: EstateAllocation.MIXED,
    estateRatio: new Decimal(ratio.neuRatio),
    allocationSource: AllocationSource.PERIOD_PRORATA,
    allocationNote: `Zeitanteilig: ${ratio.altDays}/${ratio.totalDays} Alt, ${ratio.neuDays}/${ratio.totalDays} Neu`,
    requiresManualReview: false,
  };
}

/**
 * Erstellt AllocationResult aus Vormonat-Logik (HZV)
 *
 * Bei HZV bezieht sich die Zahlung auf den Vormonat:
 * - Zahlung im November → für Oktober
 * - Zahlung im Dezember → für November
 */
function createAllocationFromVormonatLogik(
  transactionDate: Date,
  cutoffDate: Date
): AllocationResult {
  // Vormonat berechnen
  const serviceMonth = new Date(transactionDate);
  serviceMonth.setMonth(serviceMonth.getMonth() - 1);

  // Erster und letzter Tag des Vormonats
  const serviceMonthStart = new Date(serviceMonth.getFullYear(), serviceMonth.getMonth(), 1);
  const serviceMonthEnd = new Date(serviceMonth.getFullYear(), serviceMonth.getMonth() + 1, 0);

  // Ist der gesamte Vormonat vor dem Stichtag?
  if (serviceMonthEnd < cutoffDate) {
    return {
      estateAllocation: EstateAllocation.ALTMASSE,
      allocationSource: AllocationSource.VORMONAT_LOGIK,
      allocationNote: `HZV-Regel: Zahlung für ${formatMonth(serviceMonth)} vollständig vor Stichtag`,
      requiresManualReview: false,
    };
  }

  // Ist der gesamte Vormonat nach dem Stichtag?
  if (serviceMonthStart >= cutoffDate) {
    return {
      estateAllocation: EstateAllocation.NEUMASSE,
      allocationSource: AllocationSource.VORMONAT_LOGIK,
      allocationNote: `HZV-Regel: Zahlung für ${formatMonth(serviceMonth)} vollständig nach Stichtag`,
      requiresManualReview: false,
    };
  }

  // Stichtag liegt im Vormonat → zeitanteilige Aufteilung
  return createAllocationFromServicePeriod(serviceMonthStart, serviceMonthEnd, cutoffDate);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Berechnet die zeitanteilige Aufteilung eines Zeitraums
 */
export function calculatePeriodProrata(
  periodStart: Date,
  periodEnd: Date,
  cutoffDate: Date
): SplitRatio {
  // Gesamttage im Zeitraum (inklusive Start und Ende)
  const totalDays = daysBetween(periodStart, periodEnd) + 1;

  // Vollständig vor Stichtag?
  if (periodEnd < cutoffDate) {
    return { altRatio: 1, neuRatio: 0, altDays: totalDays, neuDays: 0, totalDays };
  }

  // Vollständig nach Stichtag?
  if (periodStart >= cutoffDate) {
    return { altRatio: 0, neuRatio: 1, altDays: 0, neuDays: totalDays, totalDays };
  }

  // Stichtag liegt im Zeitraum
  const altDays = daysBetween(periodStart, cutoffDate); // Tage VOR Stichtag (exklusiv Stichtag)
  const neuDays = totalDays - altDays;

  return {
    altRatio: altDays / totalDays,
    neuRatio: neuDays / totalDays,
    altDays,
    neuDays,
    totalDays,
  };
}

/**
 * Berechnet die Anzahl Tage zwischen zwei Daten
 */
function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay);
}

/**
 * Formatiert ein Datum für Anzeige
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formatiert einen Monat für Anzeige
 */
function formatMonth(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  });
}

// =============================================================================
// SPLIT AMOUNT CALCULATION
// =============================================================================

/**
 * Splittet einen Betrag nach Alt/Neu-Verhältnis
 *
 * @param amountCents - Gesamtbetrag in Cents
 * @param allocationResult - Ergebnis der Allokation
 * @returns { altAmountCents, neuAmountCents }
 */
export function splitAmountByAllocation(
  amountCents: bigint,
  allocationResult: AllocationResult
): { altAmountCents: bigint; neuAmountCents: bigint } {
  switch (allocationResult.estateAllocation) {
    case EstateAllocation.ALTMASSE:
      return { altAmountCents: amountCents, neuAmountCents: BigInt(0) };

    case EstateAllocation.NEUMASSE:
      return { altAmountCents: BigInt(0), neuAmountCents: amountCents };

    case EstateAllocation.MIXED: {
      if (!allocationResult.estateRatio) {
        // Fallback: 50/50 wenn kein Ratio
        const half = amountCents / BigInt(2);
        return { altAmountCents: half, neuAmountCents: amountCents - half };
      }

      // Berechnung mit Decimal für Präzision
      const neuRatio = allocationResult.estateRatio;
      const altRatio = new Decimal(1).minus(neuRatio);

      // Betrag splitten (Rundung auf Cent)
      const neuAmountDecimal = neuRatio.times(amountCents.toString());
      const neuAmountCents = BigInt(neuAmountDecimal.round().toString());
      const altAmountCents = amountCents - neuAmountCents;

      return { altAmountCents, neuAmountCents };
    }

    case EstateAllocation.UNKLAR:
    default:
      // Bei UNKLAR: Konservativ als Altmasse behandeln (kann manuell korrigiert werden)
      return { altAmountCents: amountCents, neuAmountCents: BigInt(0) };
  }
}

// =============================================================================
// BATCH PROCESSING
// =============================================================================

/**
 * Verarbeitet mehrere Entries und fügt Estate-Allokation hinzu
 */
export function processEntriesForAllocation<
  T extends {
    transactionDate: Date;
    serviceDate?: Date | null;
    servicePeriodStart?: Date | null;
    servicePeriodEnd?: Date | null;
    counterpartyId?: string | null;
  },
>(
  entries: T[],
  cutoffDate: Date,
  getCounterpartyConfig: (counterpartyId: string | null | undefined) => SettlerConfig | null,
  getPeriodKey: (entry: T) => string | undefined
): Array<T & { allocation: AllocationResult }> {
  return entries.map((entry) => {
    const counterpartyConfig = getCounterpartyConfig(entry.counterpartyId);
    const periodKey = getPeriodKey(entry);

    const allocation = determineEstateAllocation(
      entry,
      counterpartyConfig,
      cutoffDate,
      periodKey
    );

    return { ...entry, allocation };
  });
}
