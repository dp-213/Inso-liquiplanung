/**
 * API: Liquiditätsmatrix für IV-Dashboard
 *
 * IDW S11-konforme Struktur mit 4 Blöcken:
 * I.  Finanzmittelbestand Periodenanfang
 * II. Einzahlungen
 * III. Auszahlungen (inkl. Zwischensumme insolvenzspezifisch)
 * IV. Liquiditätsentwicklung (Veränderung, EoP, Kreditlinie, Rückstellungen)
 *
 * GET /api/cases/[id]/dashboard/liquidity-matrix
 * Query-Parameter:
 * - showDetails: true | false (nur Summen oder mit Unterzeilen)
 * - scope: GLOBAL | LOCATION_VELBERT | LOCATION_UCKERATH_EITORF
 * - includeUnreviewed: true | false
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getCustomerSession, checkCaseAccess } from '@/lib/customer-auth';
import { EXCLUDE_SPLIT_PARENTS } from '@/lib/ledger/types';
import {
  HVPLUS_MATRIX_BLOCKS,
  HVPLUS_MATRIX_ROWS,
  INSOLVENCY_ROW_IDS,
  getRowsForBlock,
  getRowsForScope,
  filterEntriesByScope,
  getScopeHintText,
  LIQUIDITY_SCOPE_LABELS,
  type MatrixBlockId,
  type LiquidityScope,
} from '@/lib/cases/haevg-plus/matrix-config';
import { aggregateEntries } from '@/lib/liquidity-matrix/aggregate';
import type { LiquidityDevelopmentData } from '@/lib/liquidity-matrix/types';

// =============================================================================
// TYPES
// =============================================================================

export interface MatrixPeriod {
  periodIndex: number;
  periodLabel: string;
  periodStartDate: string;
  periodEndDate: string;
  valueType: 'IST' | 'PLAN' | 'MIXED';
}

export interface MatrixRowValue {
  rowId: string;
  periodIndex: number;
  amountCents: string;
  entryCount: number;
}

export interface MatrixRow {
  id: string;
  label: string;
  labelShort?: string;
  block: MatrixBlockId;
  order: number;
  isSubRow: boolean;
  isSummary: boolean;
  isSectionHeader?: boolean;
  isSubtotal?: boolean;
  parentRowId?: string;
  defaultExpanded?: boolean;
  flowType?: 'INFLOW' | 'OUTFLOW';
  values: MatrixRowValue[];
  total: string;
}

export interface MatrixBlock {
  id: MatrixBlockId;
  label: string;
  order: number;
  rows: MatrixRow[];
  totals: string[];
}

export interface LiquidityMatrixData {
  caseId: string;
  caseName: string;
  scope: LiquidityScope;
  scopeLabel: string;
  scopeHint: string | null;
  periods: MatrixPeriod[];
  blocks: MatrixBlock[];
  liquidityDevelopment: LiquidityDevelopmentData;
  validation: {
    hasBalanceError: boolean;
    hasNegativeBalance: boolean;
    unklearPercentage: number;
    errorPeriods: number[];
  };
  meta: {
    entryCount: number;
    istCount: number;
    planCount: number;
    planIgnoredCount: number;
    unklearCount: number;
    unreviewedCount: number;
    includeUnreviewed: boolean;
    generatedAt: string;
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getPeriodLabel(periodIndex: number, startDate: Date, periodType: string): string {
  const periodDate = new Date(startDate);
  if (periodType === 'MONTHLY') {
    periodDate.setMonth(periodDate.getMonth() + periodIndex);
    return periodDate.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
  } else {
    periodDate.setDate(periodDate.getDate() + periodIndex * 7);
    const weekNum = Math.ceil((periodDate.getDate() + new Date(periodDate.getFullYear(), periodDate.getMonth(), 1).getDay()) / 7);
    return `KW ${String(weekNum).padStart(2, '0')}`;
  }
}

function getPeriodDates(periodIndex: number, startDate: Date, periodType: string): { start: Date; end: Date } {
  const start = new Date(startDate);
  const end = new Date(startDate);

  if (periodType === 'MONTHLY') {
    start.setMonth(start.getMonth() + periodIndex);
    start.setDate(1);
    end.setMonth(end.getMonth() + periodIndex + 1);
    end.setDate(0);
  } else {
    start.setDate(start.getDate() + periodIndex * 7);
    end.setDate(start.getDate() + 6);
  }

  return { start, end };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const { searchParams } = new URL(request.url);

    // Auth: Prüfe Admin- ODER Customer-Session
    const adminSession = await getSession();
    const customerSession = await getCustomerSession();

    if (!adminSession && !customerSession) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    if (customerSession && !adminSession) {
      const access = await checkCaseAccess(customerSession.customerId, caseId);
      if (!access.hasAccess) {
        return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 });
      }
    }

    // Query Parameters
    const showDetails = searchParams.get('showDetails') !== 'false';
    const scopeParam = searchParams.get('scope') || 'GLOBAL';
    const scope: LiquidityScope = ['GLOBAL', 'LOCATION_VELBERT', 'LOCATION_UCKERATH_EITORF'].includes(scopeParam)
      ? (scopeParam as LiquidityScope)
      : 'GLOBAL';
    const includeUnreviewed = searchParams.get('includeUnreviewed') === 'true';

    // 1. Load Case with Plan settings
    const existingCase = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        plans: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        bankAccounts: true,
      },
    });

    if (!existingCase) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    const plan = existingCase.plans[0];
    if (!plan) {
      return NextResponse.json({ error: 'Kein Liquiditätsplan vorhanden' }, { status: 404 });
    }

    const periodType = plan.periodType || 'MONTHLY';
    const periodCount = plan.periodCount || 10;
    const startDate = plan.planStartDate ? new Date(plan.planStartDate) : new Date();

    // 2. Load BankAgreements für Kreditlinie
    const bankAgreements = await prisma.bankAgreement.findMany({
      where: { caseId, agreementStatus: 'VEREINBART' },
      include: { bankAccount: { select: { bankName: true } } },
    });
    const creditLineCents = bankAgreements.reduce(
      (sum, a) => sum + (a.creditCapCents || BigInt(0)), BigInt(0)
    );

    // 3. Load Rückstellungen aus InsolvencyEffects (isAvailabilityOnly=true)
    const reserveEffects = await prisma.insolvencyEffect.findMany({
      where: { planId: plan.id, isActive: true, isAvailabilityOnly: true },
    });
    const reservesTotalCents = reserveEffects.reduce(
      (sum, e) => sum + (e.amountCents < 0 ? -e.amountCents : e.amountCents), BigInt(0)
    );

    // 4. Load LedgerEntries (nur liquidity-relevante Konten + PLAN-Entries)
    const reviewStatusFilter = includeUnreviewed
      ? { not: 'REJECTED' }
      : { in: ['CONFIRMED', 'ADJUSTED'] };

    // ISK-Only-Filter: Nur operative Massekonten in der Matrix
    const liquidityAccountIds = existingCase.bankAccounts
      .filter(a => a.isLiquidityRelevant)
      .map(a => a.id);

    const allEntries = await prisma.ledgerEntry.findMany({
      where: {
        caseId,
        ...EXCLUDE_SPLIT_PARENTS,
        reviewStatus: reviewStatusFilter,
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

    // 5. Apply Scope Filter
    const entries = filterEntriesByScope(
      allEntries.map(e => ({
        ...e,
        locationId: e.location?.id || null,
      })),
      scope
    );

    // 6. Build Bank Account ID mapping
    const bankAccountMap = new Map<string, string>();
    for (const acc of existingCase.bankAccounts) {
      const nameLower = acc.bankName.toLowerCase();
      if (nameLower.includes('sparkasse')) {
        bankAccountMap.set(acc.id, 'sparkasse');
      } else if (nameLower.includes('apo')) {
        bankAccountMap.set(acc.id, 'apobank');
      }
    }

    // 7. Build periods
    const periods: MatrixPeriod[] = [];
    for (let i = 0; i < periodCount; i++) {
      const { start, end } = getPeriodDates(i, startDate, periodType);
      periods.push({
        periodIndex: i,
        periodLabel: getPeriodLabel(i, startDate, periodType),
        periodStartDate: start.toISOString().split('T')[0],
        periodEndDate: end.toISOString().split('T')[0],
        valueType: 'MIXED',
      });
    }

    // 8. Get rows for current scope
    const scopeRows = getRowsForScope(HVPLUS_MATRIX_ROWS, scope);

    // 9. Aggregation via shared aggregate function
    const aggregation = aggregateEntries({
      entries: entries as Parameters<typeof aggregateEntries>[0]['entries'],
      rows: scopeRows,
      periodCount,
      startDate,
      periodType,
      bankAccountMap,
      traceMode: false,
    });

    const { rowAggregations, periodValueTypes, stats } = aggregation;
    const { totalEntries, istCount, planCount, planIgnoredCount, unklearCount, unreviewedCount } = stats;

    // 10. Determine period value types
    for (const [periodIdx, { ist, plan: planCnt }] of periodValueTypes) {
      if (ist > 0 && planCnt === 0) {
        periods[periodIdx].valueType = 'IST';
      } else if (planCnt > 0 && ist === 0) {
        periods[periodIdx].valueType = 'PLAN';
      } else {
        periods[periodIdx].valueType = 'MIXED';
      }
    }

    // 11. Calculate block sums
    // CASH_IN total
    const cashInTotals = Array(periodCount).fill(BigInt(0)) as bigint[];
    const cashInRows = getRowsForBlock('CASH_IN', scopeRows);
    for (const row of cashInRows) {
      if (!row.isSummary && !row.isSectionHeader && !row.parentRowId) {
        const rowPeriods = rowAggregations.get(row.id);
        if (rowPeriods) {
          for (let i = 0; i < periodCount; i++) {
            cashInTotals[i] += rowPeriods.get(i)!.amount;
          }
        }
      }
    }

    // CASH_OUT total (all outflow rows in the unified CASH_OUT block)
    const cashOutTotals = Array(periodCount).fill(BigInt(0)) as bigint[];
    const cashOutRows = getRowsForBlock('CASH_OUT', scopeRows);
    for (const row of cashOutRows) {
      if (!row.isSummary && !row.isSectionHeader && !row.isSubtotal && !row.parentRowId) {
        const rowPeriods = rowAggregations.get(row.id);
        if (rowPeriods) {
          for (let i = 0; i < periodCount; i++) {
            cashOutTotals[i] += rowPeriods.get(i)!.amount;
          }
        }
      }
    }

    // Insolvency subtotal (nur die spezifischen Inso-Zeilen)
    const insoSubtotals = Array(periodCount).fill(BigInt(0)) as bigint[];
    for (const insoRowId of INSOLVENCY_ROW_IDS) {
      const rowPeriods = rowAggregations.get(insoRowId);
      if (rowPeriods) {
        for (let i = 0; i < periodCount; i++) {
          insoSubtotals[i] += rowPeriods.get(i)!.amount;
        }
      }
    }

    // Set subtotal in rowAggregations for cash_out_subtotal_insolvency
    const insoSubtotalAgg = rowAggregations.get('cash_out_subtotal_insolvency');
    if (insoSubtotalAgg) {
      for (let i = 0; i < periodCount; i++) {
        insoSubtotalAgg.get(i)!.amount = insoSubtotals[i];
      }
    }

    // 12. Calculate Opening/Closing Balances
    const openingBalances: bigint[] = [];
    const closingBalances: bigint[] = [];

    for (let i = 0; i < periodCount; i++) {
      const periodOpening = i === 0 ? BigInt(0) : closingBalances[i - 1];
      openingBalances.push(periodOpening);

      const closing = periodOpening + cashInTotals[i] + cashOutTotals[i];
      closingBalances.push(closing);
    }

    // 13. Sektion IV: Liquiditätsentwicklung berechnen
    // Alle 6 Zeilen sind computed — direkt in rowAggregations schreiben
    for (let i = 0; i < periodCount; i++) {
      const change = cashInTotals[i] + cashOutTotals[i];
      const coverage = closingBalances[i] + creditLineCents;
      const coverageAfter = coverage - reservesTotalCents;

      // liquidity_change
      const lcAgg = rowAggregations.get('liquidity_change');
      if (lcAgg) { lcAgg.get(i)!.amount = change; lcAgg.get(i)!.count = -1; }

      // closing_balance_total
      const cbAgg = rowAggregations.get('closing_balance_total');
      if (cbAgg) { cbAgg.get(i)!.amount = closingBalances[i]; cbAgg.get(i)!.count = -1; }

      // credit_line_available
      const clAgg = rowAggregations.get('credit_line_available');
      if (clAgg) { clAgg.get(i)!.amount = creditLineCents; clAgg.get(i)!.count = -1; }

      // coverage_before_reserves
      const cbrAgg = rowAggregations.get('coverage_before_reserves');
      if (cbrAgg) { cbrAgg.get(i)!.amount = coverage; cbrAgg.get(i)!.count = -1; }

      // reserves_total (konstanter Worst-Case-Betrag, negativ dargestellt)
      const rtAgg = rowAggregations.get('reserves_total');
      if (rtAgg) { rtAgg.get(i)!.amount = -reservesTotalCents; rtAgg.get(i)!.count = -1; }

      // coverage_after_reserves
      const carAgg = rowAggregations.get('coverage_after_reserves');
      if (carAgg) { carAgg.get(i)!.amount = coverageAfter; carAgg.get(i)!.count = -1; }
    }

    // Block totals map for building response
    const blockTotals = new Map<MatrixBlockId, bigint[]>();
    blockTotals.set('OPENING_BALANCE', openingBalances);
    blockTotals.set('CASH_IN', cashInTotals);
    blockTotals.set('CASH_OUT', cashOutTotals);
    // Liquiditätsentwicklung hat keine eigene "Block-Summe" — jede Zeile ist eigenständig
    // Verwende coverage_after_reserves als Block-Total
    const liqDevTotals = Array(periodCount).fill(BigInt(0)) as bigint[];
    for (let i = 0; i < periodCount; i++) {
      liqDevTotals[i] = closingBalances[i] + creditLineCents - reservesTotalCents;
    }
    blockTotals.set('LIQUIDITY_DEVELOPMENT', liqDevTotals);

    // 14. Build response blocks
    const responseBlocks: MatrixBlock[] = [];

    for (const blockConfig of HVPLUS_MATRIX_BLOCKS) {
      const blockRows = getRowsForBlock(blockConfig.id, scopeRows);
      const responseRows: MatrixRow[] = [];

      for (const row of blockRows) {
        // Skip sub-rows and section headers if showDetails is false
        if (!showDetails && row.isSubRow && !row.isSummary) continue;
        if (!showDetails && row.isSectionHeader) continue;
        if (!showDetails && row.isSubtotal) continue;

        const rowPeriods = rowAggregations.get(row.id);
        const values: MatrixRowValue[] = [];
        let rowTotal = BigInt(0);

        for (let i = 0; i < periodCount; i++) {
          let amount: bigint;
          let count = 0;

          if (row.isSummary && blockConfig.id !== 'LIQUIDITY_DEVELOPMENT') {
            // Use block totals for summary rows (except Sektion IV — each row is its own computed value)
            amount = blockTotals.get(blockConfig.id)![i];
            count = -1;
          } else if (row.isSubtotal && row.id === 'cash_out_subtotal_insolvency') {
            amount = insoSubtotals[i];
            count = -1;
          } else if (rowPeriods) {
            const periodData = rowPeriods.get(i)!;
            amount = periodData.amount;
            count = periodData.count;
          } else {
            amount = BigInt(0);
          }

          values.push({
            rowId: row.id,
            periodIndex: i,
            amountCents: amount.toString(),
            entryCount: count,
          });

          rowTotal += amount;
        }

        responseRows.push({
          id: row.id,
          label: row.label,
          labelShort: row.labelShort,
          block: row.block,
          order: row.order,
          isSubRow: row.isSubRow,
          isSummary: row.isSummary,
          ...(row.isSectionHeader ? { isSectionHeader: true } : {}),
          ...(row.isSubtotal ? { isSubtotal: true } : {}),
          ...(row.parentRowId ? { parentRowId: row.parentRowId } : {}),
          ...(row.defaultExpanded !== undefined ? { defaultExpanded: row.defaultExpanded } : {}),
          flowType: row.flowType,
          values,
          total: rowTotal.toString(),
        });
      }

      responseBlocks.push({
        id: blockConfig.id,
        label: blockConfig.label,
        order: blockConfig.order,
        rows: responseRows,
        totals: blockTotals.get(blockConfig.id)!.map(t => t.toString()),
      });
    }

    // 15. Validation checks
    let hasBalanceError = false;
    let hasNegativeBalance = false;
    const errorPeriods: number[] = [];

    for (let i = 0; i < periodCount; i++) {
      const opening = openingBalances[i];
      const calculatedClosing = opening + cashInTotals[i] + cashOutTotals[i];

      const diff = closingBalances[i] - calculatedClosing;
      if (diff > BigInt(100) || diff < BigInt(-100)) {
        hasBalanceError = true;
        errorPeriods.push(i);
      }

      if (closingBalances[i] < BigInt(0)) {
        hasNegativeBalance = true;
        if (!errorPeriods.includes(i)) {
          errorPeriods.push(i);
        }
      }
    }

    const unklearPercentage = totalEntries > 0 ? (unklearCount / totalEntries) * 100 : 0;

    // 16. Liquidity Development metadata
    const liquidityDevelopment: LiquidityDevelopmentData = {
      creditLineCents: creditLineCents.toString(),
      creditLineStatus: bankAgreements.length > 0 ? 'VEREINBART' : 'KEINE',
      creditLineNote: bankAgreements.length > 0
        ? bankAgreements.map(a =>
            `${a.bankAccount.bankName}: ${(Number(a.creditCapCents || 0) / 100).toLocaleString('de-DE')} €`
          ).join(', ')
        : null,
      reservesTotalCents: reservesTotalCents.toString(),
      reserveDetails: reserveEffects.map(e => ({
        name: e.name,
        amountCents: e.amountCents.toString(),
        effectGroup: e.effectGroup,
      })),
    };

    // 17. Build response
    const response: LiquidityMatrixData = {
      caseId,
      caseName: existingCase.debtorName,
      scope,
      scopeLabel: LIQUIDITY_SCOPE_LABELS[scope],
      scopeHint: getScopeHintText(scope),
      periods,
      blocks: responseBlocks,
      liquidityDevelopment,
      validation: {
        hasBalanceError,
        hasNegativeBalance,
        unklearPercentage,
        errorPeriods,
      },
      meta: {
        entryCount: totalEntries,
        istCount,
        planCount,
        planIgnoredCount,
        unklearCount,
        unreviewedCount,
        includeUnreviewed,
        generatedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Liquidity Matrix API Error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
