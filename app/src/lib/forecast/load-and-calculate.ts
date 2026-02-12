/**
 * Shared Helper: Forecast laden und berechnen
 *
 * Wird von:
 * - /api/cases/[id]/forecast/calculate (Forecast-Seite)
 * - /api/cases/[id]/ledger/rolling-forecast (Dashboard-Integration)
 *
 * Lädt ForecastScenario + Annahmen + Kreditlinie + Rückstellungen,
 * extrahiert IST-Perioden aus LedgerEntries, ruft forecastEngine() auf.
 */

import { prisma } from '@/lib/db';
import { forecastEngine } from './engine';
import type { ForecastAssumptionInput, IstPeriodData, ForecastCalculationResult } from './types';
import {
  HVPLUS_MATRIX_ROWS,
  getRowsForBlock,
  getRowsForScope,
} from '@/lib/cases/haevg-plus/matrix-config';
import { aggregateEntries } from '@/lib/liquidity-matrix/aggregate';

// ============================================================================
// TYPES
// ============================================================================

export interface ForecastLoadResult {
  result: ForecastCalculationResult;
  meta: {
    scenarioId: string;
    scenarioName: string;
    periodType: string;
    periodCount: number;
    openingBalanceCents: string;
    openingBalanceSource: string;
    creditLineCents: string;
    creditLineSource: string;
    reservesTotalCents: string;
    istPeriodCount: number;
    forecastPeriodCount: number;
    assumptionCount: number;
    generatedAt: string;
  };
}

// ============================================================================
// IST-Daten aus Matrix-Aggregation extrahieren
// ============================================================================

function extractIstPeriods(params: {
  entries: Parameters<typeof aggregateEntries>[0]['entries'];
  periodCount: number;
  startDate: Date;
  periodType: string;
  bankAccountMap: Map<string, string>;
  openingBalanceCents: bigint;
}): IstPeriodData[] {
  const { entries, periodCount, startDate, periodType, bankAccountMap, openingBalanceCents } = params;

  const scopeRows = getRowsForScope(HVPLUS_MATRIX_ROWS, 'GLOBAL');

  const aggregation = aggregateEntries({
    entries,
    rows: scopeRows,
    periodCount,
    startDate,
    periodType,
    bankAccountMap,
    traceMode: false,
  });

  const { rowAggregations, periodsWithIst } = aggregation;

  // Berechne cashIn/cashOut pro IST-Periode
  const cashInRows = getRowsForBlock('CASH_IN', scopeRows);
  const cashOutRows = getRowsForBlock('CASH_OUT', scopeRows);

  const istPeriods: IstPeriodData[] = [];
  let runningBalance = openingBalanceCents;

  for (let i = 0; i < periodCount; i++) {
    if (!periodsWithIst.has(i)) continue;

    let cashIn = BigInt(0);
    let cashOut = BigInt(0);

    for (const row of cashInRows) {
      if (!row.isSummary && !row.isSectionHeader && !row.parentRowId) {
        const rowPeriods = rowAggregations.get(row.id);
        if (rowPeriods) {
          cashIn += rowPeriods.get(i)!.amount;
        }
      }
    }

    for (const row of cashOutRows) {
      if (!row.isSummary && !row.isSectionHeader && !row.isSubtotal && !row.parentRowId) {
        const rowPeriods = rowAggregations.get(row.id);
        if (rowPeriods) {
          cashOut += rowPeriods.get(i)!.amount;
        }
      }
    }

    const closing = runningBalance + cashIn + cashOut;

    // Periodenlabel generieren
    const periodDate = new Date(startDate);
    if (periodType === 'MONTHLY') {
      periodDate.setMonth(periodDate.getMonth() + i);
    } else {
      periodDate.setDate(periodDate.getDate() + i * 7);
    }
    const periodLabel = periodDate.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
    const periodStartDate = periodDate.toISOString().split('T')[0];

    istPeriods.push({
      periodIndex: i,
      periodLabel,
      periodStartDate,
      cashInCents: cashIn,
      cashOutCents: cashOut,
      closingBalanceCents: closing,
    });

    runningBalance = closing;
  }

  return istPeriods;
}

// ============================================================================
// MAIN HELPER
// ============================================================================

/**
 * Lädt Forecast-Daten und berechnet das Ergebnis.
 *
 * @param caseId - ID des Falls
 * @param options.requireActiveAssumptions - Wenn true (default), gibt null zurück
 *   wenn keine aktiven Annahmen existieren. Für Dashboard-Integration (Rolling Forecast)
 *   auf true setzen, damit PLAN-Fallback greift. Für Forecast-Seite auf false setzen,
 *   damit die Engine auch mit 0 Annahmen läuft (zeigt Warnung).
 */
export async function loadAndCalculateForecast(
  caseId: string,
  options?: { requireActiveAssumptions?: boolean }
): Promise<ForecastLoadResult | null> {
  const { requireActiveAssumptions = true } = options || {};

  // 1. Szenario laden
  const scenario = await prisma.forecastScenario.findFirst({
    where: { caseId, scenarioType: 'BASE', isActive: true },
    include: { assumptions: true },
  });

  if (!scenario) {
    return null;
  }

  // Keine aktiven Annahmen? → Je nach Modus null oder weitermachen
  const activeAssumptions = scenario.assumptions.filter(a => a.isActive);
  if (requireActiveAssumptions && activeAssumptions.length === 0) {
    return null;
  }

  // 2. Case + Plan + BankAccounts laden
  const existingCase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      plans: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      bankAccounts: true,
    },
  });

  if (!existingCase) {
    return null;
  }

  // 3. Kreditlinie live aus BankAgreement
  const bankAgreements = await prisma.bankAgreement.findMany({
    where: { caseId, agreementStatus: 'VEREINBART' },
    include: { bankAccount: { select: { bankName: true } } },
  });
  const creditLineCents = bankAgreements.reduce(
    (sum, a) => sum + (a.creditCapCents || BigInt(0)), BigInt(0)
  );

  // 4. Rückstellungen aus InsolvencyEffects
  const plan = existingCase.plans[0];
  let reservesTotalCents = BigInt(0);
  if (plan) {
    const reserveEffects = await prisma.insolvencyEffect.findMany({
      where: { planId: plan.id, isActive: true, isAvailabilityOnly: true },
    });
    reservesTotalCents = reserveEffects.reduce(
      (sum, e) => sum + (e.amountCents < 0 ? -e.amountCents : e.amountCents), BigInt(0)
    );
  }

  // 5. IST-Daten aus LedgerEntries aggregieren
  const liquidityAccountIds = existingCase.bankAccounts
    .filter(a => a.isLiquidityRelevant)
    .map(a => a.id);

  const allEntries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      reviewStatus: { in: ['CONFIRMED', 'ADJUSTED'] },
      OR: [
        { bankAccountId: { in: liquidityAccountIds } },
        { bankAccountId: null },
        { valueType: 'PLAN' },
      ],
    },
    include: {
      counterparty: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
      bankAccount: { select: { id: true, bankName: true } },
    },
    orderBy: { transactionDate: 'asc' },
  });

  // Bank Account Map
  const bankAccountMap = new Map<string, string>();
  for (const acc of existingCase.bankAccounts) {
    const nameLower = acc.bankName.toLowerCase();
    if (nameLower.includes('sparkasse')) {
      bankAccountMap.set(acc.id, 'sparkasse');
    } else if (nameLower.includes('apo')) {
      bankAccountMap.set(acc.id, 'apobank');
    }
  }

  const startDate = new Date(scenario.planStartDate);

  // IST-Perioden extrahieren
  const istPeriods = extractIstPeriods({
    entries: allEntries as Parameters<typeof aggregateEntries>[0]['entries'],
    periodCount: scenario.periodCount,
    startDate,
    periodType: scenario.periodType,
    bankAccountMap,
    openingBalanceCents: scenario.openingBalanceCents,
  });

  // 6. Annahmen für Engine vorbereiten
  const assumptions: ForecastAssumptionInput[] = scenario.assumptions.map(a => ({
    id: a.id,
    categoryKey: a.categoryKey,
    categoryLabel: a.categoryLabel,
    flowType: a.flowType as 'INFLOW' | 'OUTFLOW',
    assumptionType: a.assumptionType as ForecastAssumptionInput['assumptionType'],
    baseAmountCents: a.baseAmountCents,
    baseAmountSource: a.baseAmountSource,
    growthFactorPercent: a.growthFactorPercent !== null ? Number(a.growthFactorPercent) : null,
    seasonalProfile: a.seasonalProfile ? JSON.parse(a.seasonalProfile) : null,
    startPeriodIndex: a.startPeriodIndex,
    endPeriodIndex: a.endPeriodIndex,
    isActive: a.isActive,
  }));

  // 7. Engine aufrufen
  const result = forecastEngine({
    scenario: {
      periodType: scenario.periodType as 'WEEKLY' | 'MONTHLY',
      periodCount: scenario.periodCount,
      planStartDate: scenario.planStartDate.toISOString(),
      openingBalanceCents: scenario.openingBalanceCents,
      istCutoffOverride: scenario.istCutoffOverride,
    },
    assumptions,
    istPeriods,
    creditLineCents,
    reservesTotalCents,
  });

  // 8. Meta-Daten zusammenstellen
  const creditLineSource = bankAgreements
    .filter(a => a.creditCapCents && a.creditCapCents > BigInt(0))
    .map(a => `${a.bankAccount.bankName}: ${(Number(a.creditCapCents!) / 100).toLocaleString('de-DE')} EUR`)
    .join(', ') || 'Keine Kreditlinie';

  return {
    result,
    meta: {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      periodType: scenario.periodType,
      periodCount: scenario.periodCount,
      openingBalanceCents: scenario.openingBalanceCents.toString(),
      openingBalanceSource: scenario.openingBalanceSource,
      creditLineCents: creditLineCents.toString(),
      creditLineSource,
      reservesTotalCents: reservesTotalCents.toString(),
      istPeriodCount: istPeriods.length,
      forecastPeriodCount: scenario.periodCount - istPeriods.length,
      assumptionCount: activeAssumptions.length,
      generatedAt: new Date().toISOString(),
    },
  };
}
