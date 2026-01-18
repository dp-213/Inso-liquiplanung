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
} from './types';

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
  let created = 0;
  let updated = 0;
  let deleted = 0;

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
