/**
 * Forecast Engine – Reine Berechnungsfunktion
 *
 * Pure function: Gleiche Eingaben = gleiches Ergebnis.
 * Keine DB-Zugriffe, keine Side Effects.
 */

import type {
  ForecastEngineParams,
  ForecastCalculationResult,
  ForecastPeriodResult,
  ForecastLineItem,
  ForecastAssumptionInput,
  ForecastCalculationResultJSON,
  ForecastPeriodResultJSON,
  ForecastLineItemJSON,
} from './types';

// ============================================================================
// HELPER: Periodenlabel generieren
// ============================================================================

function generatePeriodLabel(planStartDate: string, periodIndex: number, periodType: 'WEEKLY' | 'MONTHLY'): string {
  const start = new Date(planStartDate);

  if (periodType === 'MONTHLY') {
    const date = new Date(start.getFullYear(), start.getMonth() + periodIndex, 1);
    return date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
  } else {
    const date = new Date(start.getTime() + periodIndex * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(date.getTime() + 6 * 24 * 60 * 60 * 1000);
    return `KW ${date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}–${weekEnd.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`;
  }
}

function generatePeriodStartDate(planStartDate: string, periodIndex: number, periodType: 'WEEKLY' | 'MONTHLY'): string {
  const start = new Date(planStartDate);

  if (periodType === 'MONTHLY') {
    const date = new Date(start.getFullYear(), start.getMonth() + periodIndex, 1);
    return date.toISOString().split('T')[0];
  } else {
    const date = new Date(start.getTime() + periodIndex * 7 * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }
}

// ============================================================================
// HELPER: Einzelannahme für eine Periode berechnen
// ============================================================================

function forecastAmount(
  assumption: ForecastAssumptionInput,
  periodIndex: number,
  planStartDate: string,
  periodType: 'WEEKLY' | 'MONTHLY',
): bigint {
  // Außerhalb des Gültigkeitsbereichs?
  if (periodIndex < assumption.startPeriodIndex || periodIndex > assumption.endPeriodIndex) {
    return BigInt(0);
  }

  if (!assumption.isActive) {
    return BigInt(0);
  }

  const base = assumption.baseAmountCents;

  switch (assumption.assumptionType) {
    case 'FIXED':
    case 'RUN_RATE': {
      // Wachstumsfaktor anwenden (kumulativ pro Periode ab startPeriodIndex)
      let amount = base;
      if (assumption.growthFactorPercent !== null && assumption.growthFactorPercent !== 0) {
        const periodsElapsed = periodIndex - assumption.startPeriodIndex;
        const growthFactor = Math.pow(1 + assumption.growthFactorPercent / 100, periodsElapsed);
        amount = BigInt(Math.round(Number(base) * growthFactor));
      }

      // Saisonaler Faktor (nur bei MONTHLY)
      if (periodType === 'MONTHLY' && assumption.seasonalProfile && assumption.seasonalProfile.length === 12) {
        const start = new Date(planStartDate);
        const monthIndex = (start.getMonth() + periodIndex) % 12;
        const seasonFactor = assumption.seasonalProfile[monthIndex];
        amount = BigInt(Math.round(Number(amount) * seasonFactor));
      }

      return amount;
    }

    case 'ONE_TIME': {
      // Nur in der Startperiode
      if (periodIndex === assumption.startPeriodIndex) {
        return base;
      }
      return BigInt(0);
    }

    case 'PERCENTAGE_OF_REVENUE': {
      // Wird im zweiten Durchlauf berechnet (benötigt cashIn-Summe)
      // Hier Platzhalter zurückgeben
      return BigInt(0);
    }

    default:
      return BigInt(0);
  }
}

// ============================================================================
// HELPER: Formel-String für Audit
// ============================================================================

function buildFormula(
  assumption: ForecastAssumptionInput,
  periodIndex: number,
  planStartDate: string,
  periodType: 'WEEKLY' | 'MONTHLY',
  resultCents: bigint,
): string {
  const baseEur = (Number(assumption.baseAmountCents) / 100).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const resultEur = (Number(resultCents) / 100).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  if (assumption.assumptionType === 'ONE_TIME') {
    return `${baseEur} EUR (einmalig) = ${resultEur} EUR`;
  }

  const parts: string[] = [baseEur];

  if (assumption.growthFactorPercent !== null && assumption.growthFactorPercent !== 0) {
    const periodsElapsed = periodIndex - assumption.startPeriodIndex;
    const factor = Math.pow(1 + assumption.growthFactorPercent / 100, periodsElapsed);
    parts.push(`× ${factor.toFixed(3)}`);
  }

  if (periodType === 'MONTHLY' && assumption.seasonalProfile && assumption.seasonalProfile.length === 12) {
    const start = new Date(planStartDate);
    const monthIndex = (start.getMonth() + periodIndex) % 12;
    parts.push(`× ${assumption.seasonalProfile[monthIndex].toFixed(1)}`);
  }

  parts.push(`= ${resultEur} EUR`);
  return parts.join(' ');
}

// ============================================================================
// MAIN ENGINE
// ============================================================================

export function forecastEngine(params: ForecastEngineParams): ForecastCalculationResult {
  const { scenario, assumptions, istPeriods, creditLineCents, reservesTotalCents } = params;
  const { periodType, periodCount, planStartDate, openingBalanceCents } = scenario;

  const warnings: string[] = [];
  const periods: ForecastPeriodResult[] = [];

  // IST-Cutoff bestimmen: höchster Perioden-Index mit IST-Daten
  const istCutoff = scenario.istCutoffOverride !== null
    ? scenario.istCutoffOverride
    : istPeriods.length > 0
      ? Math.max(...istPeriods.map(p => p.periodIndex))
      : -1;

  // IST-Perioden als Map
  const istMap = new Map(istPeriods.map(p => [p.periodIndex, p]));

  // Aktive Annahmen filtern
  const activeAssumptions = assumptions.filter(a => a.isActive);

  // Separate: Nicht-PERCENTAGE vs PERCENTAGE
  const standardAssumptions = activeAssumptions.filter(a => a.assumptionType !== 'PERCENTAGE_OF_REVENUE');
  const percentageAssumptions = activeAssumptions.filter(a => a.assumptionType === 'PERCENTAGE_OF_REVENUE');

  let currentOpeningBalance = openingBalanceCents;

  // Iterativ durch alle Perioden
  for (let i = 0; i < periodCount; i++) {
    const periodLabel = generatePeriodLabel(planStartDate, i, periodType as 'WEEKLY' | 'MONTHLY');
    const periodStartDate = generatePeriodStartDate(planStartDate, i, periodType as 'WEEKLY' | 'MONTHLY');

    if (i <= istCutoff && istMap.has(i)) {
      // IST-Periode: Daten aus Matrix übernehmen
      const ist = istMap.get(i)!;
      const opening = i === 0 ? openingBalanceCents : currentOpeningBalance;
      const netCashflow = ist.cashInCents + ist.cashOutCents; // cashOut ist bereits negativ
      const closing = opening + netCashflow;
      const headroom = closing + creditLineCents;
      const headroomAfterReserves = headroom - reservesTotalCents;

      periods.push({
        periodIndex: i,
        periodLabel: ist.periodLabel || periodLabel,
        periodStartDate: ist.periodStartDate || periodStartDate,
        dataSource: 'IST',
        openingBalanceCents: opening,
        cashInTotalCents: ist.cashInCents,
        cashOutTotalCents: ist.cashOutCents,
        netCashflowCents: netCashflow,
        closingBalanceCents: closing,
        creditLineAvailableCents: creditLineCents,
        headroomCents: headroom,
        headroomAfterReservesCents: headroomAfterReserves,
        lineItems: [], // IST hat keine Annahmen-LineItems
      });

      currentOpeningBalance = closing;
    } else {
      // FORECAST-Periode: Aus Annahmen berechnen
      const lineItems: ForecastLineItem[] = [];
      let cashIn = BigInt(0);
      let cashOut = BigInt(0);

      // Erster Durchlauf: Standard-Annahmen
      for (const assumption of standardAssumptions) {
        const amount = forecastAmount(assumption, i, planStartDate, periodType as 'WEEKLY' | 'MONTHLY');
        if (amount === BigInt(0)) continue;

        const formula = buildFormula(assumption, i, planStartDate, periodType as 'WEEKLY' | 'MONTHLY', amount);

        lineItems.push({
          assumptionId: assumption.id,
          categoryKey: assumption.categoryKey,
          categoryLabel: assumption.categoryLabel,
          flowType: assumption.flowType,
          amountCents: amount,
          formula,
        });

        if (assumption.flowType === 'INFLOW') {
          cashIn += amount;
        } else {
          cashOut += amount; // Annahmen-Betrag ist als positive Zahl gespeichert
        }
      }

      // Zweiter Durchlauf: PERCENTAGE_OF_REVENUE (braucht cashIn)
      for (const assumption of percentageAssumptions) {
        if (i < assumption.startPeriodIndex || i > assumption.endPeriodIndex) continue;
        if (!assumption.isActive) continue;

        // baseAmountCents interpretiert als Prozentsatz × 100 (z.B. 1000 = 10%)
        const percentage = Number(assumption.baseAmountCents) / 10000;
        const amount = BigInt(Math.round(Number(cashIn) * percentage));

        if (amount === BigInt(0)) continue;

        const percentStr = (Number(assumption.baseAmountCents) / 100).toLocaleString('de-DE');
        const resultEur = (Number(amount) / 100).toLocaleString('de-DE', { minimumFractionDigits: 0 });
        const formula = `${percentStr}% × Einnahmen = ${resultEur} EUR`;

        lineItems.push({
          assumptionId: assumption.id,
          categoryKey: assumption.categoryKey,
          categoryLabel: assumption.categoryLabel,
          flowType: assumption.flowType,
          amountCents: amount,
          formula,
        });

        if (assumption.flowType === 'INFLOW') {
          cashIn += amount;
        } else {
          cashOut += amount;
        }
      }

      // cashOut als negativ speichern (Konvention: Outflow = negativ)
      const cashOutNegative = cashOut > BigInt(0) ? -cashOut : cashOut;
      const netCashflow = cashIn + cashOutNegative;
      const closing = currentOpeningBalance + netCashflow;
      const headroom = closing + creditLineCents;
      const headroomAfterReserves = headroom - reservesTotalCents;

      periods.push({
        periodIndex: i,
        periodLabel,
        periodStartDate,
        dataSource: 'FORECAST',
        openingBalanceCents: currentOpeningBalance,
        cashInTotalCents: cashIn,
        cashOutTotalCents: cashOutNegative,
        netCashflowCents: netCashflow,
        closingBalanceCents: closing,
        creditLineAvailableCents: creditLineCents,
        headroomCents: headroom,
        headroomAfterReservesCents: headroomAfterReserves,
        lineItems,
      });

      currentOpeningBalance = closing;
    }
  }

  // Summary berechnen
  let totalInflowsCents = BigInt(0);
  let totalOutflowsCents = BigInt(0);
  let minHeadroomCents = BigInt(Number.MAX_SAFE_INTEGER);
  let minHeadroomPeriodIndex = 0;

  for (const period of periods) {
    totalInflowsCents += period.cashInTotalCents;
    totalOutflowsCents += period.cashOutTotalCents;

    if (period.headroomAfterReservesCents < minHeadroomCents) {
      minHeadroomCents = period.headroomAfterReservesCents;
      minHeadroomPeriodIndex = period.periodIndex;
    }
  }

  const finalClosingBalanceCents = periods.length > 0
    ? periods[periods.length - 1].closingBalanceCents
    : openingBalanceCents;

  // Warnungen
  if (minHeadroomCents < BigInt(0)) {
    const periodLabel = periods[minHeadroomPeriodIndex]?.periodLabel || `Periode ${minHeadroomPeriodIndex}`;
    warnings.push(`Liquiditätsengpass in ${periodLabel}: Headroom nach Rückstellungen ist negativ (${(Number(minHeadroomCents) / 100).toLocaleString('de-DE')} EUR)`);
  }

  if (activeAssumptions.length === 0) {
    warnings.push('Keine aktiven Annahmen vorhanden. Forecast-Perioden zeigen 0 EUR.');
  }

  return {
    periods,
    summary: {
      totalInflowsCents,
      totalOutflowsCents,
      finalClosingBalanceCents,
      minHeadroomCents: periods.length > 0 ? minHeadroomCents : BigInt(0),
      minHeadroomPeriodIndex,
    },
    warnings,
  };
}

// ============================================================================
// JSON SERIALIZATION HELPER
// ============================================================================

export function serializeForecastResult(result: ForecastCalculationResult): ForecastCalculationResultJSON {
  return {
    periods: result.periods.map(serializePeriod),
    summary: {
      totalInflowsCents: result.summary.totalInflowsCents.toString(),
      totalOutflowsCents: result.summary.totalOutflowsCents.toString(),
      finalClosingBalanceCents: result.summary.finalClosingBalanceCents.toString(),
      minHeadroomCents: result.summary.minHeadroomCents.toString(),
      minHeadroomPeriodIndex: result.summary.minHeadroomPeriodIndex,
    },
    warnings: result.warnings,
  };
}

function serializePeriod(period: ForecastPeriodResult): ForecastPeriodResultJSON {
  return {
    periodIndex: period.periodIndex,
    periodLabel: period.periodLabel,
    periodStartDate: period.periodStartDate,
    dataSource: period.dataSource,
    openingBalanceCents: period.openingBalanceCents.toString(),
    cashInTotalCents: period.cashInTotalCents.toString(),
    cashOutTotalCents: period.cashOutTotalCents.toString(),
    netCashflowCents: period.netCashflowCents.toString(),
    closingBalanceCents: period.closingBalanceCents.toString(),
    creditLineAvailableCents: period.creditLineAvailableCents.toString(),
    headroomCents: period.headroomCents.toString(),
    headroomAfterReservesCents: period.headroomAfterReservesCents.toString(),
    lineItems: period.lineItems.map(serializeLineItem),
  };
}

function serializeLineItem(item: ForecastLineItem): ForecastLineItemJSON {
  return {
    assumptionId: item.assumptionId,
    categoryKey: item.categoryKey,
    categoryLabel: item.categoryLabel,
    flowType: item.flowType,
    amountCents: item.amountCents.toString(),
    formula: item.formula,
  };
}
