import { CATEGORY_TAG_LABELS } from '@/lib/ledger/types';

export interface RevenueEntryForGrouping {
  categoryTag: string | null;
  amountCents: string;
  neumasseAmountCents: string;
  altmasseAmountCents: string;
  periodLabel: string;
  transactionDate: string;
}

// Gemeinsame Farbpalette für Chart und Tabelle
export const REVENUE_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Green
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#94a3b8", // Slate (für Sonstige)
];

export interface GroupedSeries {
  tag: string;
  label: string;
  totalCents: bigint;
  neumasseTotal: bigint;
  altmasseTotal: bigint;
  entryCount: number;
}

export interface PeriodSeries {
  periodLabel: string;
  series: Record<string, bigint>; // tag → totalCents
  total: bigint;
  firstDate: string; // Frühestes transactionDate für chronologische Sortierung
}

const SONSTIGE_TAG = '__SONSTIGE__';
const OHNE_TAG = '__OHNE_TAG__';

/**
 * Gruppiert Einnahmen-Entries nach categoryTag.
 * Top N nach Betrag werden eigene Serien, Rest → "Sonstige".
 */
export function groupByCategoryTag(
  entries: RevenueEntryForGrouping[],
  maxSeries = 5
): GroupedSeries[] {
  const byTag = new Map<string, GroupedSeries>();

  for (const entry of entries) {
    const tag = entry.categoryTag || OHNE_TAG;

    if (!byTag.has(tag)) {
      byTag.set(tag, {
        tag,
        label: CATEGORY_TAG_LABELS[tag] || (tag === OHNE_TAG ? 'Ohne Kategorie' : tag),
        totalCents: BigInt(0),
        neumasseTotal: BigInt(0),
        altmasseTotal: BigInt(0),
        entryCount: 0,
      });
    }

    const group = byTag.get(tag)!;
    group.totalCents += BigInt(entry.amountCents);
    group.neumasseTotal += BigInt(entry.neumasseAmountCents);
    group.altmasseTotal += BigInt(entry.altmasseAmountCents);
    group.entryCount++;
  }

  // Sortiere absteigend nach totalCents
  const sorted = Array.from(byTag.values()).sort(
    (a, b) => Number(b.totalCents - a.totalCents)
  );

  if (sorted.length <= maxSeries) {
    return sorted;
  }

  // Top N behalten, Rest zu "Sonstige" zusammenfassen
  const top = sorted.slice(0, maxSeries);
  const rest = sorted.slice(maxSeries);

  const sonstige: GroupedSeries = {
    tag: SONSTIGE_TAG,
    label: 'Sonstige',
    totalCents: BigInt(0),
    neumasseTotal: BigInt(0),
    altmasseTotal: BigInt(0),
    entryCount: 0,
  };

  for (const r of rest) {
    sonstige.totalCents += r.totalCents;
    sonstige.neumasseTotal += r.neumasseTotal;
    sonstige.altmasseTotal += r.altmasseTotal;
    sonstige.entryCount += r.entryCount;
  }

  return [...top, sonstige];
}

/**
 * Gruppiert Entries nach categoryTag UND periodLabel für Chart-Zeitachse.
 * Gibt pro Periode die Beträge pro Serie zurück.
 */
export function groupByPeriodAndTag(
  entries: RevenueEntryForGrouping[],
  seriesTags: string[]
): PeriodSeries[] {
  const byPeriod = new Map<string, PeriodSeries>();

  for (const entry of entries) {
    const period = entry.periodLabel;
    const rawTag = entry.categoryTag || OHNE_TAG;
    const tag = seriesTags.includes(rawTag) ? rawTag : SONSTIGE_TAG;

    if (!byPeriod.has(period)) {
      byPeriod.set(period, {
        periodLabel: period,
        series: {},
        total: BigInt(0),
        firstDate: entry.transactionDate,
      });
    }

    const p = byPeriod.get(period)!;
    p.series[tag] = (p.series[tag] || BigInt(0)) + BigInt(entry.amountCents);
    p.total += BigInt(entry.amountCents);
    // Frühestes Datum pro Periode merken
    if (entry.transactionDate < p.firstDate) {
      p.firstDate = entry.transactionDate;
    }
  }

  // Sortiere Perioden chronologisch nach tatsächlichem Datum
  return Array.from(byPeriod.values()).sort((a, b) =>
    a.firstDate.localeCompare(b.firstDate)
  );
}

export { SONSTIGE_TAG, OHNE_TAG };
