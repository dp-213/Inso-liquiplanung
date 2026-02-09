/**
 * Ledger Aggregation Logic
 *
 * Calculates derived values from LedgerEntries:
 * - periodIndex (runtime calculation from transactionDate + plan.planStartDate)
 * - flowType (derived from amount sign)
 * - Aggregated PeriodValues
 */

import { PrismaClient, LedgerEntry, LiquidityPlan } from '@prisma/client';
import {
  AggregatedPeriodValue,
  PeriodIndexParams,
  LedgerAggregationResult,
  SyncResult,
  deriveFlowType,
  ValueType,
  FlowType,
  AGGREGATION_STATUS,
  AggregationStatus,
  AggregationStatusResponse,
} from './types';
import { createHash } from 'crypto';
import { calculateOpeningBalanceByScope } from '@/lib/bank-accounts/calculate-balances';

// =============================================================================
// SCOPE TYPES & CONSTANTS
// =============================================================================

export type LiquidityScope = "GLOBAL" | "LOCATION_VELBERT" | "LOCATION_UCKERATH_EITORF";

// Location-IDs für Standort-Scopes
const SCOPE_LOCATION_IDS: Record<Exclude<LiquidityScope, "GLOBAL">, string[]> = {
  LOCATION_VELBERT: ["loc-haevg-velbert"],
  LOCATION_UCKERATH_EITORF: ["loc-haevg-uckerath", "loc-haevg-eitorf"],
};

// Patterns für zentrale Verfahrenskosten (ohne Standortbezug)
const CENTRAL_PROCEDURE_COST_PATTERNS = [
  /verfahrenskosten/i,
  /insolvenzverwalter/i,
  /gerichtskosten/i,
  /gutachter/i,
  /rechtsanwalt.*insolvenz/i,
  /steuerberater.*verfahren/i,
  /zentral.*beratung/i,
  /unternehmensberater/i,
  /fortführungsbeitrag/i,
];

// =============================================================================
// PERIOD INDEX CALCULATION (runtime, not persisted)
// =============================================================================

/**
 * Calculate the period index for a transaction date relative to plan start
 * Returns 0-based index clamped to valid range
 */
export function calculatePeriodIndex(params: PeriodIndexParams): number {
  const { transactionDate, planStartDate, periodType, periodCount } = params;

  const txDate = new Date(transactionDate);
  const startDate = new Date(planStartDate);

  // Reset time components for date-only comparison
  txDate.setHours(0, 0, 0, 0);
  startDate.setHours(0, 0, 0, 0);

  if (periodType === 'WEEKLY') {
    const diffMs = txDate.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const weekIndex = Math.floor(diffDays / 7);
    return Math.max(0, Math.min(weekIndex, periodCount - 1));
  } else {
    // MONTHLY
    const monthsDiff =
      (txDate.getFullYear() - startDate.getFullYear()) * 12 +
      (txDate.getMonth() - startDate.getMonth());
    return Math.max(0, Math.min(monthsDiff, periodCount - 1));
  }
}

/**
 * Calculate the start date of a given period
 * Used for migration: creating synthetic LedgerEntries from PeriodValues
 */
export function calculatePeriodStartDate(
  planStartDate: Date,
  periodIndex: number,
  periodType: 'WEEKLY' | 'MONTHLY'
): Date {
  const startDate = new Date(planStartDate);
  startDate.setHours(0, 0, 0, 0);

  if (periodType === 'WEEKLY') {
    const daysToAdd = periodIndex * 7;
    startDate.setDate(startDate.getDate() + daysToAdd);
  } else {
    startDate.setMonth(startDate.getMonth() + periodIndex);
  }

  return startDate;
}

/**
 * Check if a transaction date is within the plan's period range
 */
export function isDateInPlanRange(
  transactionDate: Date,
  planStartDate: Date,
  periodType: 'WEEKLY' | 'MONTHLY',
  periodCount: number
): boolean {
  const txDate = new Date(transactionDate);
  const startDate = new Date(planStartDate);
  txDate.setHours(0, 0, 0, 0);
  startDate.setHours(0, 0, 0, 0);

  if (txDate < startDate) return false;

  const endDate = new Date(startDate);
  if (periodType === 'WEEKLY') {
    endDate.setDate(endDate.getDate() + periodCount * 7);
  } else {
    endDate.setMonth(endDate.getMonth() + periodCount);
  }

  return txDate < endDate;
}

// =============================================================================
// AGGREGATION
// =============================================================================

/**
 * Aggregate LedgerEntries for a specific plan
 * Groups by (periodIndex, valueType, flowType) and sums amounts
 */
export async function aggregateLedgerEntries(
  prisma: PrismaClient,
  caseId: string,
  planId: string
): Promise<LedgerAggregationResult> {
  // Fetch plan for period calculation
  const plan = await prisma.liquidityPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error(`Plan ${planId} nicht gefunden`);
  }

  // Fetch all LedgerEntries for the case
  const entries = await prisma.ledgerEntry.findMany({
    where: { caseId },
    orderBy: { transactionDate: 'asc' },
  });

  // Aggregate by (periodIndex, valueType, flowType)
  const aggregationMap = new Map<string, AggregatedPeriodValue>();

  let totalInflows = BigInt(0);
  let totalOutflows = BigInt(0);

  for (const entry of entries) {
    // Transfers aus konsolidierten Summen ausschließen
    if (entry.transferPartnerEntryId) continue;

    const periodIndex = calculatePeriodIndex({
      transactionDate: entry.transactionDate,
      planStartDate: plan.planStartDate,
      periodType: plan.periodType as 'WEEKLY' | 'MONTHLY',
      periodCount: plan.periodCount,
    });

    const flowType = deriveFlowType(BigInt(entry.amountCents));
    const valueType = entry.valueType as ValueType;

    const key = `${periodIndex}-${valueType}-${flowType}`;

    if (!aggregationMap.has(key)) {
      aggregationMap.set(key, {
        periodIndex,
        valueType,
        flowType,
        totalAmountCents: BigInt(0),
        entryCount: 0,
        entryIds: [],
      });
    }

    const agg = aggregationMap.get(key)!;
    agg.totalAmountCents += BigInt(entry.amountCents);
    agg.entryCount++;
    agg.entryIds.push(entry.id);

    // Track totals
    if (flowType === 'INFLOW') {
      totalInflows += BigInt(entry.amountCents);
    } else {
      totalOutflows += BigInt(entry.amountCents); // Already negative
    }
  }

  return {
    planId,
    caseId,
    aggregatedAt: new Date().toISOString(),
    periods: Array.from(aggregationMap.values()),
    totalEntries: entries.length,
    totalInflows,
    totalOutflows,
  };
}

// =============================================================================
// SYNC TO PERIOD VALUES
// =============================================================================

/**
 * Synchronize LedgerEntries to PeriodValues
 * PeriodValue is a derived/cached view, recalculated from LedgerEntries
 *
 * Note: This function needs the plan's category/line structure.
 * It creates/updates PeriodValues based on aggregated LedgerEntries.
 *
 * Current implementation: Simple sync that updates existing PeriodValues
 * based on matching (lineId, periodIndex, valueType)
 */
export async function syncPeriodValues(
  prisma: PrismaClient,
  caseId: string,
  planId: string,
  userId: string
): Promise<SyncResult> {
  const errors: string[] = [];
  const created = 0;
  const updated = 0;
  const deleted = 0;

  try {
    // Get aggregation result
    const aggregation = await aggregateLedgerEntries(prisma, caseId, planId);

    // For now, log the aggregation result
    // Full sync implementation would:
    // 1. Map aggregated values to existing CashflowLines
    // 2. Update/create PeriodValues accordingly
    // 3. Optionally delete orphaned PeriodValues

    console.log(
      `[Ledger Sync] Plan ${planId}: ${aggregation.totalEntries} entries, ` +
        `${aggregation.periods.length} aggregated periods`
    );

    // TODO: Implement full sync logic
    // This requires mapping LedgerEntries to CashflowLines via category assignment
    // For MVP, we keep PeriodValues as-is and just log

    return {
      success: true,
      created,
      updated,
      deleted,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    errors.push(message);
    return {
      success: false,
      created,
      updated,
      deleted,
      errors,
    };
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get LedgerEntry composition for a specific PeriodValue
 * Used for drill-down/lineage view
 */
export async function getLedgerEntriesForPeriod(
  prisma: PrismaClient,
  caseId: string,
  planId: string,
  periodIndex: number,
  valueType: ValueType
): Promise<LedgerEntry[]> {
  const plan = await prisma.liquidityPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    return [];
  }

  // Calculate date range for this period
  const periodStart = calculatePeriodStartDate(
    plan.planStartDate,
    periodIndex,
    plan.periodType as 'WEEKLY' | 'MONTHLY'
  );

  const periodEnd = calculatePeriodStartDate(
    plan.planStartDate,
    periodIndex + 1,
    plan.periodType as 'WEEKLY' | 'MONTHLY'
  );

  return prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType,
      transactionDate: {
        gte: periodStart,
        lt: periodEnd,
      },
    },
    orderBy: { transactionDate: 'asc' },
  });
}

/**
 * Rebuild all PeriodValues from LedgerEntries
 * Use with caution - this will overwrite existing PeriodValues
 */
export async function rebuildPeriodValues(
  prisma: PrismaClient,
  caseId: string,
  planId: string,
  userId: string
): Promise<SyncResult> {
  // For MVP, delegate to syncPeriodValues
  // Full implementation would clear and rebuild
  return syncPeriodValues(prisma, caseId, planId, userId);
}

// =============================================================================
// AGGREGATION CACHE (Stale Detection)
// =============================================================================

/**
 * Calculate a hash of all LedgerEntries for a case
 * Used for stale detection - if hash changes, data has changed
 */
export async function calculateLedgerHash(
  prisma: PrismaClient,
  caseId: string
): Promise<string> {
  const entries = await prisma.ledgerEntry.findMany({
    where: { caseId },
    select: {
      id: true,
      amountCents: true,
      transactionDate: true,
      valueType: true,
      legalBucket: true,
      updatedAt: true,
    },
    orderBy: { id: 'asc' },
  });

  // Create a deterministic string representation
  const dataString = entries
    .map(
      (e) =>
        `${e.id}|${e.amountCents}|${e.transactionDate.toISOString()}|${e.valueType}|${e.legalBucket}|${e.updatedAt.toISOString()}`
    )
    .join('\n');

  // Calculate SHA-256 hash
  const hash = createHash('sha256').update(dataString).digest('hex');
  return hash;
}

/**
 * Check the aggregation status for a case
 * Returns CURRENT if no changes since last aggregation, STALE otherwise
 */
export async function checkAggregationStatus(
  prisma: PrismaClient,
  caseId: string
): Promise<AggregationStatusResponse> {
  const cache = await prisma.aggregationCache.findUnique({
    where: { caseId },
  });

  if (!cache) {
    return {
      status: AGGREGATION_STATUS.STALE,
      reason: 'Noch nie aggregiert',
      pendingChanges: 0,
      lastAggregatedAt: null,
    };
  }

  // If status is REBUILDING, return that
  if (cache.status === AGGREGATION_STATUS.REBUILDING) {
    return {
      status: AGGREGATION_STATUS.REBUILDING,
      reason: 'Wird gerade neu berechnet',
      pendingChanges: cache.pendingChanges,
      lastAggregatedAt: cache.lastAggregatedAt.toISOString(),
      planId: cache.planId,
    };
  }

  // Calculate current hash and compare
  const currentHash = await calculateLedgerHash(prisma, caseId);

  if (currentHash !== cache.dataHashAtAggregation) {
    return {
      status: AGGREGATION_STATUS.STALE,
      reason: 'Daten seit letzter Aggregation geändert',
      pendingChanges: cache.pendingChanges,
      lastAggregatedAt: cache.lastAggregatedAt.toISOString(),
      planId: cache.planId,
    };
  }

  return {
    status: AGGREGATION_STATUS.CURRENT,
    pendingChanges: 0,
    lastAggregatedAt: cache.lastAggregatedAt.toISOString(),
    planId: cache.planId,
  };
}

/**
 * Mark aggregation as stale (call after LedgerEntry changes)
 * This is a lightweight operation - just increments pending changes counter
 */
export async function markAggregationStale(
  prisma: PrismaClient,
  caseId: string
): Promise<void> {
  await prisma.aggregationCache.upsert({
    where: { caseId },
    update: {
      status: AGGREGATION_STATUS.STALE,
      pendingChanges: { increment: 1 },
      lastChangeAt: new Date(),
    },
    create: {
      caseId,
      planId: '', // Will be set on first rebuild
      status: AGGREGATION_STATUS.STALE,
      lastAggregatedAt: new Date(0), // Epoch
      dataHashAtAggregation: '',
      pendingChanges: 1,
      lastChangeAt: new Date(),
    },
  });
}

/**
 * Full aggregation rebuild with cache update
 * This recalculates all PeriodValues from LedgerEntries
 */
export async function rebuildAggregation(
  prisma: PrismaClient,
  caseId: string,
  planId: string,
  userId: string
): Promise<{
  success: boolean;
  periodValuesCreated: number;
  entriesProcessed: number;
  error?: string;
}> {
  try {
    // 1. Set status to REBUILDING
    await prisma.aggregationCache.upsert({
      where: { caseId },
      update: { status: AGGREGATION_STATUS.REBUILDING },
      create: {
        caseId,
        planId,
        status: AGGREGATION_STATUS.REBUILDING,
        lastAggregatedAt: new Date(),
        dataHashAtAggregation: '',
      },
    });

    // 2. Get the plan
    const plan = await prisma.liquidityPlan.findUnique({
      where: { id: planId },
      include: {
        categories: {
          include: {
            lines: true,
          },
        },
      },
    });

    if (!plan) {
      throw new Error(`Plan ${planId} nicht gefunden`);
    }

    // 3. Get all LedgerEntries
    const entries = await prisma.ledgerEntry.findMany({
      where: { caseId },
    });

    // 4. Aggregate entries
    const aggregation = await aggregateLedgerEntries(prisma, caseId, planId);

    // 5. Sync to PeriodValues (this is where the actual update happens)
    const syncResult = await syncPeriodValues(prisma, caseId, planId, userId);

    // 6. Calculate new hash
    const newHash = await calculateLedgerHash(prisma, caseId);

    // 7. Update cache to CURRENT
    await prisma.aggregationCache.update({
      where: { caseId },
      data: {
        status: AGGREGATION_STATUS.CURRENT,
        planId,
        lastAggregatedAt: new Date(),
        dataHashAtAggregation: newHash,
        pendingChanges: 0,
      },
    });

    return {
      success: true,
      periodValuesCreated: syncResult.created + syncResult.updated,
      entriesProcessed: entries.length,
    };
  } catch (error) {
    // Revert to STALE on error
    await prisma.aggregationCache
      .update({
        where: { caseId },
        data: { status: AGGREGATION_STATUS.STALE },
      })
      .catch(() => {
        /* ignore if cache doesn't exist */
      });

    return {
      success: false,
      periodValuesCreated: 0,
      entriesProcessed: 0,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}

// =============================================================================
// AVAILABILITY AGGREGATION (Verfügbar vs. Gebunden)
// =============================================================================

/**
 * Liquidity breakdown by availability
 */
export interface LiquidityByAvailability {
  periodIndex: number;
  periodLabel: string;
  periodStart: Date;
  available: bigint;    // legalBucket = 'MASSE' oder 'NEUTRAL' oder 'UNKNOWN'
  encumbered: bigint;   // legalBucket = 'ABSONDERUNG'
  total: bigint;
}

/**
 * Aggregate LedgerEntries by availability (legalBucket)
 * Separates funds that are freely available (MASSE) from encumbered funds (ABSONDERUNG)
 */
export async function aggregateByAvailability(
  prisma: PrismaClient,
  caseId: string,
  planId: string,
  periodCount?: number
): Promise<LiquidityByAvailability[]> {
  // Get the plan
  const plan = await prisma.liquidityPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    return [];
  }

  const actualPeriodCount = periodCount || plan.periodCount;

  // Get all LedgerEntries for the case
  const entries = await prisma.ledgerEntry.findMany({
    where: { caseId },
    orderBy: { transactionDate: 'asc' },
  });

  // Initialize periods
  const periods: LiquidityByAvailability[] = [];
  for (let i = 0; i < actualPeriodCount; i++) {
    const periodStart = calculatePeriodStartDate(
      plan.planStartDate,
      i,
      plan.periodType as 'WEEKLY' | 'MONTHLY'
    );

    const periodLabel = formatPeriodLabel(periodStart, plan.periodType as 'WEEKLY' | 'MONTHLY');

    periods.push({
      periodIndex: i,
      periodLabel,
      periodStart,
      available: BigInt(0),
      encumbered: BigInt(0),
      total: BigInt(0),
    });
  }

  // Aggregate entries by period and availability
  for (const entry of entries) {
    // Transfers aus konsolidierten Summen ausschließen
    if (entry.transferPartnerEntryId) continue;

    const periodIndex = calculatePeriodIndex({
      transactionDate: entry.transactionDate,
      planStartDate: plan.planStartDate,
      periodType: plan.periodType as 'WEEKLY' | 'MONTHLY',
      periodCount: actualPeriodCount,
    });

    if (periodIndex >= 0 && periodIndex < actualPeriodCount) {
      const period = periods[periodIndex];
      const amount = BigInt(entry.amountCents);

      // Classify by legalBucket
      if (entry.legalBucket === 'ABSONDERUNG') {
        period.encumbered += amount;
      } else {
        // MASSE, NEUTRAL, UNKNOWN, null -> all count as available
        period.available += amount;
      }
      period.total += amount;
    }
  }

  return periods;
}

/**
 * Format a period label based on start date and period type
 */
function formatPeriodLabel(periodStart: Date, periodType: 'WEEKLY' | 'MONTHLY'): string {
  const months = ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  if (periodType === 'MONTHLY') {
    return `${months[periodStart.getMonth()]} ${periodStart.getFullYear()}`;
  } else {
    // Weekly: KW XX
    const startOfYear = new Date(periodStart.getFullYear(), 0, 1);
    const days = Math.floor((periodStart.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `KW ${weekNumber.toString().padStart(2, '0')}`;
  }
}

// =============================================================================
// REVENUE AGGREGATION BY COUNTERPARTY
// =============================================================================

/**
 * Revenue entry with counterparty information
 */
export interface RevenueBySource {
  counterpartyId: string | null;
  counterpartyName: string;
  locationId: string | null;
  locationName: string;
  periodIndex: number;
  periodLabel: string;
  amountCents: bigint; // Gesamtbetrag (wie gebucht)
  neumasseAmountCents: bigint; // Nur Neumasse-Anteil
  altmasseAmountCents: bigint; // Nur Altmasse-Anteil
  estateRatio: number; // 0.0 = 100% Alt, 1.0 = 100% Neu
  transactionDate: Date;
  description: string;
}

/**
 * Aggregate revenue (inflows) by counterparty and location
 */
export async function aggregateByCounterparty(
  prisma: PrismaClient,
  caseId: string,
  planId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    flowType?: 'INFLOW' | 'OUTFLOW' | 'ALL';
    scope?: LiquidityScope;
  }
): Promise<RevenueBySource[]> {
  const plan = await prisma.liquidityPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    return [];
  }

  const flowType = options?.flowType || 'INFLOW';
  const scope = options?.scope || 'GLOBAL';

  // Build date filter
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (options?.startDate) {
    dateFilter.gte = options.startDate;
  }
  if (options?.endDate) {
    dateFilter.lte = options.endDate;
  }

  // Build location filter based on scope
  const locationFilter: { in?: string[] } | undefined =
    scope !== 'GLOBAL' ? { in: SCOPE_LOCATION_IDS[scope] } : undefined;

  // Get entries with counterparty and location
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST', // Nur IST-Einnahmen (keine PLAN)
      ...(Object.keys(dateFilter).length > 0 ? { transactionDate: dateFilter } : {}),
      ...(flowType === 'INFLOW' ? { amountCents: { gt: 0 } } : {}),
      ...(flowType === 'OUTFLOW' ? { amountCents: { lt: 0 } } : {}),
      ...(locationFilter ? { locationId: locationFilter } : {}),
    },
    include: {
      counterparty: true,
      location: true,
    },
    orderBy: { transactionDate: 'asc' },
  });

  return entries.map((entry) => {
    const periodIndex = calculatePeriodIndex({
      transactionDate: entry.transactionDate,
      planStartDate: plan.planStartDate,
      periodType: plan.periodType as 'WEEKLY' | 'MONTHLY',
      periodCount: plan.periodCount,
    });

    const periodStart = calculatePeriodStartDate(
      plan.planStartDate,
      periodIndex,
      plan.periodType as 'WEEKLY' | 'MONTHLY'
    );

    const periodLabel = formatPeriodLabel(periodStart, plan.periodType as 'WEEKLY' | 'MONTHLY');

    // Calculate estate allocation breakdown
    // estateRatio: 0.0 = 100% Alt, 1.0 = 100% Neu, 0.67 = 67% Neu + 33% Alt
    const estateRatio = entry.estateRatio !== null ? Number(entry.estateRatio) : 1.0; // Default to 1.0 (Neumasse) if not set
    const totalAmount = entry.amountCents;
    const neumasseAmountCents = BigInt(Math.round(Number(totalAmount) * estateRatio));
    const altmasseAmountCents = totalAmount - neumasseAmountCents;

    return {
      counterpartyId: entry.counterpartyId,
      counterpartyName: entry.counterparty?.name || 'Unbekannt',
      locationId: entry.locationId,
      locationName: entry.location?.name || 'Ohne Standort',
      periodIndex,
      periodLabel,
      amountCents: totalAmount, // Gesamtbetrag (wie gebucht)
      neumasseAmountCents, // Neumasse-Anteil
      altmasseAmountCents, // Altmasse-Anteil
      estateRatio,
      transactionDate: entry.transactionDate,
      description: entry.description,
    };
  });
}

/**
 * Aggregate revenue summarized by counterparty (total per counterparty)
 */
export async function summarizeByCounterparty(
  prisma: PrismaClient,
  caseId: string,
  planId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    scope?: LiquidityScope;
  }
): Promise<Array<{
  counterpartyId: string | null;
  counterpartyName: string;
  totalCents: bigint;
  neumasseTotal: bigint;
  altmasseTotal: bigint;
  entryCount: number;
}>> {
  const entries = await aggregateByCounterparty(prisma, caseId, planId, {
    ...options,
    flowType: 'INFLOW',
  });

  const byCounterparty = new Map<string, {
    counterpartyId: string | null;
    counterpartyName: string;
    totalCents: bigint;
    neumasseTotal: bigint;
    altmasseTotal: bigint;
    entryCount: number;
  }>();

  for (const entry of entries) {
    const key = entry.counterpartyId || '__unknown__';

    if (!byCounterparty.has(key)) {
      byCounterparty.set(key, {
        counterpartyId: entry.counterpartyId,
        counterpartyName: entry.counterpartyName,
        totalCents: BigInt(0),
        neumasseTotal: BigInt(0),
        altmasseTotal: BigInt(0),
        entryCount: 0,
      });
    }

    const summary = byCounterparty.get(key)!;
    summary.totalCents += entry.amountCents;
    summary.neumasseTotal += entry.neumasseAmountCents;
    summary.altmasseTotal += entry.altmasseAmountCents;
    summary.entryCount++;
  }

  return Array.from(byCounterparty.values()).sort((a, b) =>
    Number(b.totalCents - a.totalCents)
  );
}

// =============================================================================
// ESTATE ALLOCATION AGGREGATION
// =============================================================================

export interface EstateAllocationSummary {
  altmasseInflowCents: bigint;
  altmasseOutflowCents: bigint;
  neumasseInflowCents: bigint;
  neumasseOutflowCents: bigint;
  unklarInflowCents: bigint;
  unklarOutflowCents: bigint;
  unklarCount: number;
}

/**
 * Aggregate estate allocation (Alt/Neu-Masse) from IST LedgerEntries
 *
 * WICHTIG: Nutzt estateAllocation + estateRatio aus LedgerEntries, NICHT aus PLAN-Kategorien
 *
 * Logik:
 * - ALTMASSE (estateRatio = 0.0): Betrag → Altmasse
 * - NEUMASSE (estateRatio = 1.0): Betrag → Neumasse
 * - MIXED (estateRatio = 0.0-1.0): Betrag aufteilen (Alt-Anteil = 1-estateRatio, Neu-Anteil = estateRatio)
 * - UNKLAR: Betrag → UNKLAR (Warnung!)
 */
export async function aggregateEstateAllocation(
  prisma: PrismaClient,
  caseId: string,
  options?: {
    scope?: LiquidityScope;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<EstateAllocationSummary> {
  const scope = options?.scope || 'GLOBAL';

  // Build date filter
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (options?.startDate) {
    dateFilter.gte = options.startDate;
  }
  if (options?.endDate) {
    dateFilter.lte = options.endDate;
  }

  // Build location filter based on scope
  const locationFilter: { in?: string[] } | undefined =
    scope !== 'GLOBAL' ? { in: SCOPE_LOCATION_IDS[scope] } : undefined;

  // Get ALL IST entries
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST', // Nur IST-Einträge
      ...(Object.keys(dateFilter).length > 0 ? { transactionDate: dateFilter } : {}),
      ...(locationFilter ? { locationId: locationFilter } : {}),
    },
    select: {
      id: true,
      amountCents: true,
      estateAllocation: true,
      estateRatio: true,
    },
  });

  let altmasseInflowCents = BigInt(0);
  let altmasseOutflowCents = BigInt(0);
  let neumasseInflowCents = BigInt(0);
  let neumasseOutflowCents = BigInt(0);
  let unklarInflowCents = BigInt(0);
  let unklarOutflowCents = BigInt(0);
  let unklarCount = 0;

  for (const entry of entries) {
    const amountCents = BigInt(entry.amountCents);
    const isInflow = amountCents > BigInt(0);
    const estateAllocation = entry.estateAllocation || 'UNKLAR';
    const estateRatio = entry.estateRatio !== null ? Number(entry.estateRatio) : null;

    if (estateAllocation === 'UNKLAR' || estateRatio === null) {
      // UNKLAR: Keine Zuordnung möglich
      if (isInflow) {
        unklarInflowCents += amountCents;
      } else {
        unklarOutflowCents += amountCents < BigInt(0) ? -amountCents : BigInt(0);
      }
      unklarCount++;
    } else if (estateAllocation === 'ALTMASSE') {
      // ALTMASSE: 100% Alt
      if (isInflow) {
        altmasseInflowCents += amountCents;
      } else {
        altmasseOutflowCents += -amountCents;
      }
    } else if (estateAllocation === 'NEUMASSE') {
      // NEUMASSE: 100% Neu
      if (isInflow) {
        neumasseInflowCents += amountCents;
      } else {
        neumasseOutflowCents += -amountCents;
      }
    } else if (estateAllocation === 'MIXED') {
      // MIXED: Aufteilen nach estateRatio
      // estateRatio = Neu-Anteil, (1 - estateRatio) = Alt-Anteil
      const absoluteAmount = amountCents < BigInt(0) ? -amountCents : amountCents;
      const neuAnteilCents = BigInt(Math.round(Number(absoluteAmount) * estateRatio));
      const altAnteilCents = absoluteAmount - neuAnteilCents;

      if (isInflow) {
        altmasseInflowCents += altAnteilCents;
        neumasseInflowCents += neuAnteilCents;
      } else {
        altmasseOutflowCents += altAnteilCents;
        neumasseOutflowCents += neuAnteilCents;
      }
    }
  }

  return {
    altmasseInflowCents,
    altmasseOutflowCents,
    neumasseInflowCents,
    neumasseOutflowCents,
    unklarInflowCents,
    unklarOutflowCents,
    unklarCount,
  };
}

// =============================================================================
// ROLLING FORECAST AGGREGATION
// =============================================================================

/**
 * Data source for a period in the rolling forecast
 */
export type RollingForecastSource = 'IST' | 'PLAN' | 'MIXED';

/**
 * Rolling Forecast period data
 */
export interface RollingForecastPeriod {
  periodIndex: number;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;

  // Aggregated values (IST preferred, PLAN as fallback)
  openingBalanceCents: bigint;
  inflowsCents: bigint;
  outflowsCents: bigint;
  netCashflowCents: bigint;
  closingBalanceCents: bigint;

  // Data source indication
  source: RollingForecastSource;
  istCount: number;      // Number of IST entries
  planCount: number;     // Number of PLAN entries

  // For transparency: raw values
  istInflowsCents: bigint;
  istOutflowsCents: bigint;
  planInflowsCents: bigint;
  planOutflowsCents: bigint;

  // Is this period in the past (before today)?
  isPast: boolean;
}

/**
 * Rolling Forecast result
 */
export interface RollingForecastResult {
  caseId: string;
  planId: string;
  calculatedAt: string;
  openingBalanceCents: bigint;
  periods: RollingForecastPeriod[];

  // Summary
  totalIstPeriods: number;
  totalPlanPeriods: number;
  todayPeriodIndex: number;  // Which period contains "today"

  // Filter info
  includeUnreviewed: boolean;  // Whether unreviewed entries are included
  unreviewedCount: number;      // Number of unreviewed entries (for warning)
  totalEntryCount: number;      // Total entries used in calculation
}

/**
 * Aggregate Rolling Forecast
 *
 * Logic:
 * - For each period, prefer IST over PLAN
 * - Past periods (before today): Should have IST
 * - Future periods (after today): Will have PLAN
 * - Mixed periods: Period contains today, may have both
 *
 * The forecast "rolls" automatically as new IST data comes in
 */
export interface RollingForecastOptions {
  /** Include UNREVIEWED entries (default: false = only CONFIRMED/ADJUSTED) */
  includeUnreviewed?: boolean;
  /** Standortspezifische Filterung (Default: GLOBAL) */
  scope?: LiquidityScope;
  /** Filtere Einträge mit diesen steeringTags aus (z.B. ['INTERNE_UMBUCHUNG']) */
  excludeSteeringTags?: string[];
}

export async function aggregateRollingForecast(
  prisma: PrismaClient,
  caseId: string,
  planId: string,
  options: RollingForecastOptions = {}
): Promise<RollingForecastResult> {
  const {
    includeUnreviewed = false,
    scope = "GLOBAL",
    excludeSteeringTags = []
  } = options;

  // 1. Load plan
  const plan = await prisma.liquidityPlan.findUnique({
    where: { id: planId },
    select: { id: true, periodType: true, periodCount: true, planStartDate: true },
  });

  if (!plan) {
    throw new Error(`Plan ${planId} nicht gefunden`);
  }

  // Get opening balance BY SCOPE (scope-aware)
  const openingBalanceCents = await calculateOpeningBalanceByScope(caseId, scope);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 2. Load LedgerEntries based on filter setting
  const allEntries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      ...(includeUnreviewed
        ? {} // All entries
        : { reviewStatus: { in: ['CONFIRMED', 'ADJUSTED'] } } // Only reviewed
      ),
      ...(excludeSteeringTags.length
        ? {
            OR: [
              { steeringTag: null },
              { steeringTag: { notIn: excludeSteeringTags } },
            ],
          }
        : {}),
    },
    include: {
      location: { select: { id: true, name: true } },
    },
    orderBy: { transactionDate: 'asc' },
  });

  // Scope-Filterung (WICHTIG: VOR der Aggregation!)
  const entries = scope === "GLOBAL"
    ? allEntries
    : allEntries.filter((entry) => {
        // Zentrale Verfahrenskosten in Standort-Scopes ausschließen
        const isCentral =
          !entry.location?.id &&
          (entry.legalBucket === "ABSONDERUNG" ||
            CENTRAL_PROCEDURE_COST_PATTERNS.some((p) => p.test(entry.description)));
        if (isCentral) return false;

        // Nur Entries des Standorts durchlassen
        if (!entry.location?.id) return false;

        const allowedLocationIds = SCOPE_LOCATION_IDS[scope as Exclude<LiquidityScope, "GLOBAL">];
        return allowedLocationIds.includes(entry.location.id.toLowerCase());
      });

  // Debug-Logging
  console.log(`[Rolling Forecast] Scope: ${scope}, All Entries: ${allEntries.length}, Filtered: ${entries.length}`);

  // Count unreviewed entries for statistics (even if not included)
  const unreviewedCount = includeUnreviewed
    ? entries.filter((e) => e.reviewStatus === 'UNREVIEWED').length
    : await prisma.ledgerEntry.count({
        where: { caseId, reviewStatus: 'UNREVIEWED' },
      });

  // 3. Initialize periods
  const periods: RollingForecastPeriod[] = [];
  let runningBalance = openingBalanceCents;

  for (let i = 0; i < plan.periodCount; i++) {
    const periodStart = calculatePeriodStartDate(
      plan.planStartDate,
      i,
      plan.periodType as 'WEEKLY' | 'MONTHLY'
    );

    const periodEnd = calculatePeriodStartDate(
      plan.planStartDate,
      i + 1,
      plan.periodType as 'WEEKLY' | 'MONTHLY'
    );

    const periodLabel = formatPeriodLabel(periodStart, plan.periodType as 'WEEKLY' | 'MONTHLY');

    // Determine if period is in the past
    const isPast = periodEnd <= today;

    periods.push({
      periodIndex: i,
      periodLabel,
      periodStart,
      periodEnd,
      openingBalanceCents: BigInt(0),
      inflowsCents: BigInt(0),
      outflowsCents: BigInt(0),
      netCashflowCents: BigInt(0),
      closingBalanceCents: BigInt(0),
      source: 'PLAN',
      istCount: 0,
      planCount: 0,
      istInflowsCents: BigInt(0),
      istOutflowsCents: BigInt(0),
      planInflowsCents: BigInt(0),
      planOutflowsCents: BigInt(0),
      isPast,
    });
  }

  // 4. Aggregate entries into periods
  for (const entry of entries) {
    // Transfers aus konsolidierten Summen ausschließen
    if (entry.transferPartnerEntryId) continue;

    const periodIndex = calculatePeriodIndex({
      transactionDate: entry.transactionDate,
      planStartDate: plan.planStartDate,
      periodType: plan.periodType as 'WEEKLY' | 'MONTHLY',
      periodCount: plan.periodCount,
    });

    if (periodIndex >= 0 && periodIndex < plan.periodCount) {
      const period = periods[periodIndex];
      const amount = BigInt(entry.amountCents);
      const isInflow = amount > BigInt(0);
      const valueType = entry.valueType as 'IST' | 'PLAN';

      if (valueType === 'IST') {
        period.istCount++;
        if (isInflow) {
          period.istInflowsCents += amount;
        } else {
          period.istOutflowsCents += amount; // Already negative
        }
      } else {
        period.planCount++;
        if (isInflow) {
          period.planInflowsCents += amount;
        } else {
          period.planOutflowsCents += amount; // Already negative
        }
      }
    }
  }

  // 5. Determine final values per period (IST preferred over PLAN)
  let todayPeriodIndex = -1;
  let totalIstPeriods = 0;
  let totalPlanPeriods = 0;

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];

    // Find which period contains today
    if (today >= period.periodStart && today < period.periodEnd) {
      todayPeriodIndex = i;
    }

    // Opening balance from previous period
    period.openingBalanceCents = runningBalance;

    // Determine source and values
    // Rule: If we have ANY IST data, use IST. Otherwise use PLAN.
    if (period.istCount > 0) {
      // Use IST values
      period.inflowsCents = period.istInflowsCents;
      period.outflowsCents = period.istOutflowsCents;

      // MIXED nur wenn:
      // 1. Sowohl IST als auch PLAN Buchungen vorhanden sind UND
      // 2. Die Periode ist NICHT vollständig in der Vergangenheit
      // Rationale: Vergangene Perioden mit IST-Daten sind vollständig erfasst,
      // auch wenn noch alte PLAN-Buchungen existieren (die ignoriert werden)
      if (period.planCount > 0 && !period.isPast) {
        period.source = 'MIXED';
      } else {
        period.source = 'IST';
      }
      totalIstPeriods++;
    } else {
      // Use PLAN values
      period.inflowsCents = period.planInflowsCents;
      period.outflowsCents = period.planOutflowsCents;
      period.source = 'PLAN';
      totalPlanPeriods++;
    }

    // Calculate net and closing
    period.netCashflowCents = period.inflowsCents + period.outflowsCents;
    period.closingBalanceCents = period.openingBalanceCents + period.netCashflowCents;

    // Carry forward
    runningBalance = period.closingBalanceCents;
  }

  // If today is after all periods, set to last
  if (todayPeriodIndex === -1 && periods.length > 0) {
    if (today < periods[0].periodStart) {
      todayPeriodIndex = 0;
    } else {
      todayPeriodIndex = periods.length - 1;
    }
  }

  return {
    caseId,
    planId,
    calculatedAt: new Date().toISOString(),
    openingBalanceCents,
    periods,
    totalIstPeriods,
    totalPlanPeriods,
    todayPeriodIndex,
    // Filter info
    includeUnreviewed,
    unreviewedCount,
    totalEntryCount: entries.length,
  };
}

// =============================================================================
// AGGREGATION STATISTICS
// =============================================================================

/**
 * Get aggregation statistics for a case
 */
export async function getAggregationStats(
  prisma: PrismaClient,
  caseId: string,
  planId: string
): Promise<{
  ledgerEntriesTotal: number;
  ledgerEntriesIst: number;
  ledgerEntriesPlan: number;
  periodValuesTotal: number;
  status: AggregationStatus;
}> {
  const [
    ledgerEntriesTotal,
    ledgerEntriesIst,
    ledgerEntriesPlan,
    plan,
    statusResponse,
  ] = await Promise.all([
    prisma.ledgerEntry.count({ where: { caseId } }),
    prisma.ledgerEntry.count({ where: { caseId, valueType: 'IST' } }),
    prisma.ledgerEntry.count({ where: { caseId, valueType: 'PLAN' } }),
    prisma.liquidityPlan.findUnique({
      where: { id: planId },
      include: {
        categories: {
          include: {
            lines: {
              include: {
                _count: { select: { periodValues: true } },
              },
            },
          },
        },
      },
    }),
    checkAggregationStatus(prisma, caseId),
  ]);

  // Count PeriodValues across all lines
  let periodValuesTotal = 0;
  if (plan) {
    for (const category of plan.categories) {
      for (const line of category.lines) {
        periodValuesTotal += (line as unknown as { _count: { periodValues: number } })._count.periodValues;
      }
    }
  }

  return {
    ledgerEntriesTotal,
    ledgerEntriesIst,
    ledgerEntriesPlan,
    periodValuesTotal,
    status: statusResponse.status,
  };
}
