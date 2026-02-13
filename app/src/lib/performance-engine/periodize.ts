/**
 * Performance-Engine — Periodisierung
 *
 * Ordnet Erlöse dem Leistungsmonat zu (nicht dem Zahlungsdatum).
 *
 * Fallback-Hierarchie:
 * 1. servicePeriodStart/End → Gleichverteilung über betroffene Monate
 * 2. serviceDate → Monat des Leistungsdatums
 * 3. transactionDate → Zahlungsmonat (+ DataQuality-Warning)
 */

// =============================================================================
// MONTH KEY HELPERS
// =============================================================================

/** "2025-10" Format */
export function toMonthKey(year: number, month: number): string {
  return `${year}-${month.toString().padStart(2, '0')}`;
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split('-');
  return { year: parseInt(y, 10), month: parseInt(m, 10) };
}

export function dateToMonthKey(date: Date): string {
  return toMonthKey(date.getFullYear(), date.getMonth() + 1);
}

// =============================================================================
// PERFORMANCE MONTH
// =============================================================================

export type PeriodizationMethod = 'SERVICE_PERIOD' | 'SERVICE_DATE' | 'TRANSACTION_DATE';

export interface PeriodizationResult {
  /** monthKey → Anteil in Cents */
  amounts: Map<string, bigint>;
  method: PeriodizationMethod;
  /** true wenn Gleichverteilung über mehrere Monate */
  isApproximateSpread: boolean;
}

/**
 * Bestimme den Leistungsmonat für einen LedgerEntry.
 *
 * Fallback-Hierarchie:
 * 1. servicePeriodStart/End → Gleichverteilung über Monate
 * 2. serviceDate → Monat des Leistungsdatums
 * 3. transactionDate → Zahlungsmonat
 */
export function periodizeEntry(params: {
  amountCents: bigint;
  transactionDate: Date;
  serviceDate: Date | null;
  servicePeriodStart: Date | null;
  servicePeriodEnd: Date | null;
}): PeriodizationResult {
  const { amountCents, transactionDate, serviceDate, servicePeriodStart, servicePeriodEnd } = params;

  // 1. servicePeriod → Gleichverteilung
  if (servicePeriodStart && servicePeriodEnd) {
    const amounts = spreadByServicePeriod(amountCents, servicePeriodStart, servicePeriodEnd);
    const isApproximateSpread = amounts.size > 1;
    return { amounts, method: 'SERVICE_PERIOD', isApproximateSpread };
  }

  // 2. serviceDate → Monat des Leistungsdatums
  if (serviceDate) {
    const key = dateToMonthKey(serviceDate);
    return {
      amounts: new Map([[key, amountCents]]),
      method: 'SERVICE_DATE',
      isApproximateSpread: false,
    };
  }

  // 3. Fallback: transactionDate
  const key = dateToMonthKey(transactionDate);
  return {
    amounts: new Map([[key, amountCents]]),
    method: 'TRANSACTION_DATE',
    isApproximateSpread: false,
  };
}

// =============================================================================
// SPREADING
// =============================================================================

/**
 * Gleichverteilung eines Betrags über alle Monate im Zeitraum.
 *
 * Beispiel: KV Q4 (Okt-Dez) → 1/3 pro Monat.
 * Rundungsdifferenz auf den letzten Monat (deterministische Zuordnung).
 */
export function spreadByServicePeriod(
  amountCents: bigint,
  periodStart: Date,
  periodEnd: Date,
): Map<string, bigint> {
  const months = getMonthsBetween(periodStart, periodEnd);

  if (months.length === 0) {
    // Sicherheitsfallback: Start- und Endmonat identisch
    const key = dateToMonthKey(periodStart);
    return new Map([[key, amountCents]]);
  }

  if (months.length === 1) {
    return new Map([[months[0], amountCents]]);
  }

  const result = new Map<string, bigint>();
  const perMonth = amountCents / BigInt(months.length);
  let distributed = 0n;

  for (let i = 0; i < months.length; i++) {
    if (i === months.length - 1) {
      // Letzter Monat bekommt den Rest (Rundungsdifferenz)
      result.set(months[i], amountCents - distributed);
    } else {
      result.set(months[i], perMonth);
      distributed += perMonth;
    }
  }

  return result;
}

/**
 * Alle Monate zwischen Start und End (inklusive beider Monate).
 */
function getMonthsBetween(start: Date, end: Date): string[] {
  const months: string[] = [];

  let year = start.getFullYear();
  let month = start.getMonth() + 1; // 1-based

  const endYear = end.getFullYear();
  const endMonth = end.getMonth() + 1;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(toMonthKey(year, month));
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return months;
}

// =============================================================================
// PERIOD GENERATION
// =============================================================================

const MONTH_LABELS = ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/**
 * Generiert N aufeinanderfolgende Monats-Perioden ab einem Startdatum.
 */
export function generateMonthlyPeriods(
  planStartDate: Date,
  periodCount: number,
): { index: number; year: number; month: number; label: string; monthKey: string }[] {
  const periods = [];

  let year = planStartDate.getFullYear();
  let month = planStartDate.getMonth() + 1; // 1-based

  for (let i = 0; i < periodCount; i++) {
    periods.push({
      index: i,
      year,
      month,
      label: `${MONTH_LABELS[month - 1]} ${year}`,
      monthKey: toMonthKey(year, month),
    });

    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return periods;
}
