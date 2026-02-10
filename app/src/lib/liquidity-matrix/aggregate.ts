/**
 * Aggregationslogik für die Liquiditätsmatrix
 *
 * Extrahiert aus route.ts, damit sowohl die Matrix-API als auch
 * die Explain-Cell-API dieselbe Logik verwenden.
 *
 * traceMode=false: Normaler Aggregationsmodus (performant, kein Trace)
 * traceMode=true:  Sammelt EntryTrace[] für Explain-Cell
 */

import {
  findMatchingRow,
  findMatchingRowWithTrace,
  getAltforderungCategoryTag,
  type MatrixRowConfig,
} from '@/lib/cases/haevg-plus/matrix-config';
import type { AggregateResult, EntryTrace } from './types';

// =============================================================================
// ENTRY TYPE (was die DB-Abfrage liefert)
// =============================================================================

export interface AggregateEntry {
  id: string;
  transactionDate: Date;
  description: string;
  amountCents: bigint;
  valueType: string;
  estateAllocation: string | null;
  estateRatio: number | null; // Prisma Decimal → number
  allocationSource: string | null;
  allocationNote: string | null;
  counterpartyId: string | null;
  locationId: string | null;
  bankAccountId: string | null;
  legalBucket: string | null;
  categoryTag: string | null;
  categoryTagSource: string | null;
  reviewStatus: string;
  transferPartnerEntryId: string | null;
  counterparty: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  bankAccount: { id: string; bankName: string } | null;
}

// =============================================================================
// HELPER: Perioden-Index
// =============================================================================

export function getPeriodIndex(date: Date, startDate: Date, periodType: string): number {
  if (periodType === 'MONTHLY') {
    const startMonth = startDate.getFullYear() * 12 + startDate.getMonth();
    const dateMonth = date.getFullYear() * 12 + date.getMonth();
    return dateMonth - startMonth;
  } else {
    const diffMs = date.getTime() - startDate.getTime();
    return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  }
}

// =============================================================================
// AGGREGATE FUNCTION
// =============================================================================

export function aggregateEntries(options: {
  entries: AggregateEntry[];
  rows: MatrixRowConfig[];
  periodCount: number;
  startDate: Date;
  periodType: string;
  bankAccountMap: Map<string, string>;
  traceMode: boolean;
}): AggregateResult {
  const { entries, rows, periodCount, startDate, periodType, bankAccountMap, traceMode } = options;

  // Initialize row aggregations
  const rowAggregations = new Map<string, Map<number, { amount: bigint; count: number }>>();
  for (const row of rows) {
    const periodMap = new Map<number, { amount: bigint; count: number }>();
    for (let i = 0; i < periodCount; i++) {
      periodMap.set(i, { amount: BigInt(0), count: 0 });
    }
    rowAggregations.set(row.id, periodMap);
  }

  // VORANALYSE: Ermittle welche Perioden IST-Daten haben
  const periodsWithIst = new Set<number>();
  for (const entry of entries) {
    if (entry.transferPartnerEntryId) continue;
    if (entry.valueType === 'IST') {
      const periodIdx = getPeriodIndex(entry.transactionDate, startDate, periodType);
      if (periodIdx >= 0 && periodIdx < periodCount) {
        periodsWithIst.add(periodIdx);
      }
    }
  }

  // Track IST/PLAN per period
  const periodValueTypes = new Map<number, { ist: number; plan: number; planIgnored: number }>();
  for (let i = 0; i < periodCount; i++) {
    periodValueTypes.set(i, { ist: 0, plan: 0, planIgnored: 0 });
  }

  // Stats
  let totalEntries = 0;
  let istCount = 0;
  let planCount = 0;
  let planIgnoredCount = 0;
  let unklearCount = 0;
  let unreviewedCount = 0;

  const traces: EntryTrace[] = [];

  // Aggregate
  for (const entry of entries) {
    if (entry.transferPartnerEntryId) continue;

    const periodIdx = getPeriodIndex(entry.transactionDate, startDate, periodType);
    if (periodIdx < 0 || periodIdx >= periodCount) continue;

    // IST-VORRANG
    if (entry.valueType === 'PLAN' && periodsWithIst.has(periodIdx)) {
      planIgnoredCount++;
      const pvt = periodValueTypes.get(periodIdx)!;
      pvt.planIgnored++;

      if (traceMode) {
        traces.push({
          entryId: entry.id,
          transactionDate: entry.transactionDate.toISOString(),
          description: entry.description,
          originalAmountCents: entry.amountCents.toString(),
          valueType: 'PLAN',
          periodIndex: periodIdx,
          wasSkippedByIstVorrang: true,
          estateAllocation: entry.estateAllocation || 'NEUMASSE',
          estateRatio: entry.estateRatio !== null ? Number(entry.estateRatio) : 1.0,
          neuAnteilCents: '0',
          altAnteilCents: '0',
          allocationSource: entry.allocationSource,
          allocationNote: entry.allocationNote,
          neuMatch: null,
          altCategoryTag: null,
          altMatch: null,
          counterpartyName: entry.counterparty?.name ?? null,
          locationName: entry.location?.name ?? null,
          bankAccountName: entry.bankAccount?.bankName ?? null,
          categoryTag: entry.categoryTag,
          categoryTagSource: entry.categoryTagSource,
          reviewStatus: entry.reviewStatus,
        });
      }

      continue;
    }

    totalEntries++;
    const amount = entry.amountCents;
    const flowType = amount >= 0 ? 'INFLOW' : 'OUTFLOW';

    // Track IST/PLAN
    if (entry.valueType === 'IST') {
      istCount++;
      periodValueTypes.get(periodIdx)!.ist++;
    } else {
      planCount++;
      periodValueTypes.get(periodIdx)!.plan++;
    }

    if (entry.estateAllocation === 'UNKLAR') unklearCount++;
    if (entry.reviewStatus === 'UNREVIEWED') unreviewedCount++;

    // Estate-Splitting
    const estateRatio = entry.estateRatio !== null ? Number(entry.estateRatio) : 1.0;
    const estateAllocation = entry.estateAllocation || 'NEUMASSE';
    const safeRatio = Math.min(Math.max(estateRatio, 0), 1);

    let neuAnteilCents = BigInt(0);
    let altAnteilCents = BigInt(0);

    switch (estateAllocation) {
      case 'NEUMASSE':
        neuAnteilCents = amount;
        break;
      case 'ALTMASSE':
        altAnteilCents = amount;
        break;
      case 'MIXED':
        neuAnteilCents = BigInt(Math.round(Number(amount) * safeRatio));
        altAnteilCents = amount - neuAnteilCents;
        break;
      case 'UNKLAR':
        neuAnteilCents = amount;
        break;
    }

    let entryWasAggregated = false;

    // Entscheide ob mit oder ohne Trace
    const matchFn = traceMode ? findMatchingRowWithTrace : null;

    // --- Neu-Anteil matchen ---
    let neuMatchResult = null;
    if (neuAnteilCents !== BigInt(0)) {
      const entryForMatch = {
        description: entry.description,
        amountCents: neuAnteilCents,
        counterpartyId: entry.counterpartyId,
        counterpartyName: entry.counterparty?.name,
        locationId: entry.locationId,
        bankAccountId: entry.bankAccountId ? bankAccountMap.get(entry.bankAccountId) : undefined,
        legalBucket: entry.legalBucket,
        categoryTag: entry.categoryTag,
      };

      if (traceMode) {
        neuMatchResult = findMatchingRowWithTrace(entryForMatch, rows, flowType);
        const neuRow = neuMatchResult?.row;
        if (neuRow) {
          const rowPeriods = rowAggregations.get(neuRow.id);
          if (rowPeriods) {
            const periodData = rowPeriods.get(periodIdx);
            if (periodData) {
              periodData.amount += neuAnteilCents;
              if (!entryWasAggregated) { periodData.count++; entryWasAggregated = true; }
            }
          }
        }
      } else {
        const neuRow = findMatchingRow(entryForMatch, rows, flowType);
        if (neuRow) {
          const rowPeriods = rowAggregations.get(neuRow.id);
          if (rowPeriods) {
            const periodData = rowPeriods.get(periodIdx);
            if (periodData) {
              periodData.amount += neuAnteilCents;
              if (!entryWasAggregated) { periodData.count++; entryWasAggregated = true; }
            }
          }
        }
      }
    }

    // --- Alt-Anteil matchen ---
    const altCategoryTag = getAltforderungCategoryTag(entry.categoryTag);
    let altMatchResult = null;

    if (altAnteilCents !== BigInt(0)) {
      const entryForAltMatch = {
        description: entry.description,
        amountCents: altAnteilCents,
        counterpartyId: entry.counterpartyId,
        counterpartyName: entry.counterparty?.name,
        locationId: entry.locationId,
        bankAccountId: entry.bankAccountId ? bankAccountMap.get(entry.bankAccountId) : undefined,
        legalBucket: entry.legalBucket,
        categoryTag: altCategoryTag,
      };

      if (traceMode) {
        altMatchResult = findMatchingRowWithTrace(entryForAltMatch, rows, flowType);
        const altRow = altMatchResult?.row;
        if (altRow) {
          const rowPeriods = rowAggregations.get(altRow.id);
          if (rowPeriods) {
            const periodData = rowPeriods.get(periodIdx);
            if (periodData) {
              periodData.amount += altAnteilCents;
              if (!entryWasAggregated) { periodData.count++; entryWasAggregated = true; }
            }
          }
        }
      } else {
        const altRow = findMatchingRow(entryForAltMatch, rows, flowType);
        if (!altRow) {
          console.error(
            `[ALT-MATCH FAILED] Entry ${entry.id}: ${Number(altAnteilCents) / 100}€ Alt-Anteil konnte nicht zugeordnet werden. ` +
            `CategoryTag: ${entry.categoryTag}, Alt-Tag: ${altCategoryTag}`
          );
        } else {
          const rowPeriods = rowAggregations.get(altRow.id);
          if (rowPeriods) {
            const periodData = rowPeriods.get(periodIdx);
            if (periodData) {
              periodData.amount += altAnteilCents;
              if (!entryWasAggregated) { periodData.count++; entryWasAggregated = true; }
            }
          }
        }
      }
    }

    // Trace speichern
    if (traceMode) {
      traces.push({
        entryId: entry.id,
        transactionDate: entry.transactionDate.toISOString(),
        description: entry.description,
        originalAmountCents: entry.amountCents.toString(),
        valueType: entry.valueType as 'IST' | 'PLAN',
        periodIndex: periodIdx,
        wasSkippedByIstVorrang: false,
        estateAllocation,
        estateRatio: safeRatio,
        neuAnteilCents: neuAnteilCents.toString(),
        altAnteilCents: altAnteilCents.toString(),
        allocationSource: entry.allocationSource,
        allocationNote: entry.allocationNote,
        neuMatch: neuMatchResult,
        altCategoryTag,
        altMatch: altMatchResult,
        counterpartyName: entry.counterparty?.name ?? null,
        locationName: entry.location?.name ?? null,
        bankAccountName: entry.bankAccount?.bankName ?? null,
        categoryTag: entry.categoryTag,
        categoryTagSource: entry.categoryTagSource,
        reviewStatus: entry.reviewStatus,
      });
    }
  }

  return {
    rowAggregations,
    periodsWithIst,
    periodValueTypes,
    stats: {
      totalEntries,
      istCount,
      planCount,
      planIgnoredCount,
      unklearCount,
      unreviewedCount,
    },
    traces,
  };
}
