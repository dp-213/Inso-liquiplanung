/**
 * API: Liquiditätsmatrix für IV-Dashboard
 *
 * Aggregiert LedgerEntries in IV-konforme Struktur:
 * - Anfangsbestand je Periode (fortgeschrieben)
 * - Cash-In/Out nach konfigurierbaren Zeilen
 * - Endbestand je Periode
 * - Optional: Bank-Split, Alt/Neu-Filter
 *
 * GET /api/cases/[id]/dashboard/liquidity-matrix
 * Query-Parameter:
 * - estateFilter: GESAMT | ALTMASSE | NEUMASSE | UNKLAR
 * - showDetails: true | false (nur Summen oder mit Unterzeilen)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getCustomerSession, checkCaseAccess } from '@/lib/customer-auth';
import {
  HVPLUS_MATRIX_CONFIG,
  HVPLUS_MATRIX_BLOCKS,
  HVPLUS_MATRIX_ROWS,
  findMatchingRow,
  getRowsForBlock,
  getRowsForScope,
  filterEntriesByScope,
  getScopeHintText,
  getAltforderungCategoryTag,
  LIQUIDITY_SCOPE_LABELS,
  type MatrixBlockId,
  type MatrixRowConfig,
  type LiquidityScope,
} from '@/lib/cases/haevg-plus/matrix-config';
import { calculateBankAccountBalances } from '@/lib/bank-accounts/calculate-balances';

// =============================================================================
// TYPES
// =============================================================================

export interface MatrixPeriod {
  periodIndex: number;
  periodLabel: string;
  periodStartDate: string;
  periodEndDate: string;
  valueType: 'IST' | 'PLAN' | 'MIXED';  // Basierend auf Datenquellen
}

export interface MatrixRowValue {
  rowId: string;
  periodIndex: number;
  amountCents: string;  // BigInt als String für JSON
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
  flowType?: 'INFLOW' | 'OUTFLOW';
  values: MatrixRowValue[];
  total: string;  // Summe über alle Perioden
}

export interface MatrixBlock {
  id: MatrixBlockId;
  label: string;
  order: number;
  rows: MatrixRow[];
  totals: string[];  // Summe pro Periode
}

export interface LiquidityMatrixData {
  caseId: string;
  caseName: string;
  scope: LiquidityScope;
  scopeLabel: string;
  scopeHint: string | null;  // Hinweis für Standort-Scopes
  periods: MatrixPeriod[];
  blocks: MatrixBlock[];
  validation: {
    hasBalanceError: boolean;  // Anfang + In + Out != Ende
    hasNegativeBalance: boolean;  // Negativer Endbestand
    unklearPercentage: number;  // Anteil UNKLAR
    errorPeriods: number[];  // Perioden mit Fehlern
  };
  meta: {
    entryCount: number;
    istCount: number;
    planCount: number;
    planIgnoredCount: number;  // PLAN-Buchungen ignoriert wegen IST-Vorrang
    unklearCount: number;
    unreviewedCount: number;  // Anzahl ungeprüfter Buchungen (nur wenn includeUnreviewed=true)
    includeUnreviewed: boolean;  // Zeigt an ob ungeprüfte enthalten sind
    generatedAt: string;
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getPeriodIndex(date: Date, startDate: Date, periodType: string): number {
  if (periodType === 'MONTHLY') {
    const startMonth = startDate.getFullYear() * 12 + startDate.getMonth();
    const dateMonth = date.getFullYear() * 12 + date.getMonth();
    return dateMonth - startMonth;
  } else {
    // WEEKLY
    const diffMs = date.getTime() - startDate.getTime();
    return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  }
}

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
    end.setDate(0);  // Letzter Tag des Monats
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

    // Falls Customer-Session: Prüfe Case-Access
    if (customerSession && !adminSession) {
      const access = await checkCaseAccess(customerSession.customerId, caseId);
      if (!access.hasAccess) {
        return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 });
      }
    }

    // Query Parameters
    const estateFilter = searchParams.get('estateFilter') || 'GESAMT';
    const showDetails = searchParams.get('showDetails') !== 'false';
    const scopeParam = searchParams.get('scope') || 'GLOBAL';
    const scope: LiquidityScope = ['GLOBAL', 'LOCATION_VELBERT', 'LOCATION_UCKERATH_EITORF'].includes(scopeParam)
      ? (scopeParam as LiquidityScope)
      : 'GLOBAL';
    // includeUnreviewed: Default false = nur CONFIRMED + ADJUSTED
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

    // 2. Load LedgerEntries
    // WICHTIG: estateFilter wird NICHT im Backend angewendet!
    // Backend aggregiert IMMER GESAMT. estateFilter wirkt nur im Frontend (Zeilen-Ausblendung).
    //
    // reviewStatus-Filter: Default nur geprüfte (CONFIRMED, ADJUSTED)
    // Mit includeUnreviewed=true auch UNREVIEWED
    const reviewStatusFilter = includeUnreviewed
      ? { not: 'REJECTED' }  // Alles außer REJECTED
      : { in: ['CONFIRMED', 'ADJUSTED'] };  // Nur geprüfte

    const allEntries = await prisma.ledgerEntry.findMany({
      where: {
        caseId,
        reviewStatus: reviewStatusFilter,
        // KEIN estateWhere mehr! Backend liefert ALLE Entries.
      },
      include: {
        counterparty: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        bankAccount: { select: { id: true, bankName: true } },
      },
      orderBy: { transactionDate: 'asc' },
    });

    // 3b. Apply Scope Filter - WICHTIG: VOR der Aggregation!
    const entries = filterEntriesByScope(
      allEntries.map(e => ({
        ...e,
        locationId: e.location?.id || null,
      })),
      scope
    );

    // 4. Build Bank Account ID mapping
    const bankAccountMap = new Map<string, string>();
    for (const acc of existingCase.bankAccounts) {
      // Map by name pattern for HVPlus
      const nameLower = acc.bankName.toLowerCase();
      if (nameLower.includes('sparkasse')) {
        bankAccountMap.set(acc.id, 'sparkasse');
      } else if (nameLower.includes('apo')) {
        bankAccountMap.set(acc.id, 'apobank');
      }
    }

    // 5. Build periods
    const periods: MatrixPeriod[] = [];
    for (let i = 0; i < periodCount; i++) {
      const { start, end } = getPeriodDates(i, startDate, periodType);
      periods.push({
        periodIndex: i,
        periodLabel: getPeriodLabel(i, startDate, periodType),
        periodStartDate: start.toISOString().split('T')[0],
        periodEndDate: end.toISOString().split('T')[0],
        valueType: 'MIXED',  // Will be determined later
      });
    }

    // 6. Get rows for current scope (filters out scope-specific rows like Velbert details in GLOBAL)
    const scopeRows = getRowsForScope(HVPLUS_MATRIX_ROWS, scope);

    // 6b. Initialize row aggregations
    const rowAggregations = new Map<string, Map<number, { amount: bigint; count: number }>>();
    for (const row of scopeRows) {
      const periodMap = new Map<number, { amount: bigint; count: number }>();
      for (let i = 0; i < periodCount; i++) {
        periodMap.set(i, { amount: BigInt(0), count: 0 });
      }
      rowAggregations.set(row.id, periodMap);
    }

    // 7. VORANALYSE: Ermittle welche Perioden IST-Daten haben
    // IST hat Vorrang vor PLAN - wenn IST existiert, wird PLAN für diese Periode ignoriert
    const periodsWithIst = new Set<number>();
    for (const entry of entries) {
      if (entry.transferPartnerEntryId) continue; // Transfers ignorieren
      if (entry.valueType === 'IST') {
        const periodIdx = getPeriodIndex(entry.transactionDate, startDate, periodType);
        if (periodIdx >= 0 && periodIdx < periodCount) {
          periodsWithIst.add(periodIdx);
        }
      }
    }

    // 7b. Track IST/PLAN per period (für Statistik)
    const periodValueTypes = new Map<number, { ist: number; plan: number; planIgnored: number }>();
    for (let i = 0; i < periodCount; i++) {
      periodValueTypes.set(i, { ist: 0, plan: 0, planIgnored: 0 });
    }

    // 8. Aggregate entries (IST hat Vorrang!)
    let totalEntries = 0;
    let istCount = 0;
    let planCount = 0;
    let planIgnoredCount = 0;  // PLAN-Buchungen die wegen IST-Vorrang ignoriert wurden
    let unklearCount = 0;
    let unreviewedCount = 0;

    for (const entry of entries) {
      // Transfers aus konsolidierten Summen ausschließen
      if (entry.transferPartnerEntryId) continue;

      const periodIdx = getPeriodIndex(entry.transactionDate, startDate, periodType);
      if (periodIdx < 0 || periodIdx >= periodCount) continue;

      // IST-VORRANG: Wenn diese Periode IST-Daten hat UND dieser Entry PLAN ist → überspringen
      if (entry.valueType === 'PLAN' && periodsWithIst.has(periodIdx)) {
        planIgnoredCount++;
        const pvt = periodValueTypes.get(periodIdx)!;
        pvt.planIgnored++;
        continue;  // PLAN-Entry ignorieren, da IST existiert
      }

      totalEntries++;
      const amount = entry.amountCents;
      const flowType = amount >= 0 ? 'INFLOW' : 'OUTFLOW';

      // Track IST/PLAN (nur für tatsächlich verwendete Entries)
      if (entry.valueType === 'IST') {
        istCount++;
        const pvt = periodValueTypes.get(periodIdx)!;
        pvt.ist++;
      } else {
        planCount++;
        const pvt = periodValueTypes.get(periodIdx)!;
        pvt.plan++;
      }

      // Track UNKLAR
      if (entry.estateAllocation === 'UNKLAR') {
        unklearCount++;
      }

      // Track UNREVIEWED (nur relevant wenn includeUnreviewed=true)
      if (entry.reviewStatus === 'UNREVIEWED') {
        unreviewedCount++;
      }

      // estateRatio-Splitting: Berechne Neu-Anteil und Alt-Anteil
      const estateRatio = entry.estateRatio !== null ? Number(entry.estateRatio) : 1.0;
      const estateAllocation = entry.estateAllocation || 'NEUMASSE';

      // Guard estateRatio to [0,1] range für Rundungssicherheit
      const safeRatio = Math.min(Math.max(estateRatio, 0), 1);

      // Berechne Anteile
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
          neuAnteilCents = amount; // Default: UNKLAR zählt als Neumasse
          break;
      }

      // Track entry aggregation to ensure count++ only once per LedgerEntry
      let entryWasAggregated = false;

      // Match Neu-Anteil (independent)
      if (neuAnteilCents !== BigInt(0)) {
        const neuRow = findMatchingRow(
          {
            description: entry.description,
            amountCents: neuAnteilCents,
            counterpartyId: entry.counterpartyId,
            counterpartyName: entry.counterparty?.name,
            locationId: entry.locationId,
            bankAccountId: entry.bankAccountId ? bankAccountMap.get(entry.bankAccountId) : undefined,
            legalBucket: entry.legalBucket,
            categoryTag: entry.categoryTag,
          },
          scopeRows,
          flowType
        );

        if (neuRow) {
          const rowPeriods = rowAggregations.get(neuRow.id);
          if (rowPeriods) {
            const periodData = rowPeriods.get(periodIdx);
            if (periodData) {
              periodData.amount += neuAnteilCents;
              if (!entryWasAggregated) {
                periodData.count++;
                entryWasAggregated = true;
              }
            }
          }
        }
      }

      // Match Alt-Anteil (independent of neuRow!)
      if (altAnteilCents !== BigInt(0)) {
        // Find Alt-Zeile via categoryTag mapping
        const altCategoryTag = getAltforderungCategoryTag(entry.categoryTag);

        const altRow = findMatchingRow(
          {
            description: entry.description,
            amountCents: altAnteilCents,
            counterpartyId: entry.counterpartyId,
            counterpartyName: entry.counterparty?.name,
            locationId: entry.locationId,
            bankAccountId: entry.bankAccountId ? bankAccountMap.get(entry.bankAccountId) : undefined,
            legalBucket: entry.legalBucket,
            categoryTag: altCategoryTag,
          },
          scopeRows,
          flowType
        );

        if (!altRow) {
          // Warnung: Alt-Match fehlgeschlagen
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
              if (!entryWasAggregated) {
                periodData.count++;
                entryWasAggregated = true;
              }
            }
          }
        }
      }

      // Also track by bank account for balance rows
      if (entry.bankAccountId) {
        const bankKey = bankAccountMap.get(entry.bankAccountId);
        if (bankKey) {
          // This will be used for bank-specific balance tracking
          // (simplified for now - just aggregate into cash-in/out)
        }
      }
    }

    // 9. Determine period value types
    for (const [periodIdx, { ist, plan }] of periodValueTypes) {
      if (ist > 0 && plan === 0) {
        periods[periodIdx].valueType = 'IST';
      } else if (plan > 0 && ist === 0) {
        periods[periodIdx].valueType = 'PLAN';
      } else {
        periods[periodIdx].valueType = 'MIXED';
      }
    }

    // 10. Calculate block sums and opening/closing balances
    const blockTotals = new Map<MatrixBlockId, bigint[]>();
    for (const block of HVPLUS_MATRIX_BLOCKS) {
      blockTotals.set(block.id, Array(periodCount).fill(BigInt(0)));
    }

    // Calculate Cash-In total
    const cashInRows = getRowsForBlock('CASH_IN', scopeRows);
    for (const row of cashInRows) {
      if (!row.isSummary) {
        const rowPeriods = rowAggregations.get(row.id)!;
        const totals = blockTotals.get('CASH_IN')!;
        for (let i = 0; i < periodCount; i++) {
          totals[i] += rowPeriods.get(i)!.amount;
        }
      }
    }

    // Calculate Cash-Out totals (all outflow blocks)
    for (const blockId of ['CASH_OUT_OPERATIVE', 'CASH_OUT_TAX', 'CASH_OUT_INSOLVENCY'] as MatrixBlockId[]) {
      const rows = getRowsForBlock(blockId, scopeRows);
      for (const row of rows) {
        if (!row.isSummary) {
          const rowPeriods = rowAggregations.get(row.id)!;
          const totals = blockTotals.get(blockId)!;
          for (let i = 0; i < periodCount; i++) {
            totals[i] += rowPeriods.get(i)!.amount;
          }
        }
      }
    }

    // Calculate CASH_OUT_TOTAL (Summe aller Auszahlungen)
    const cashOutTotalArr = Array(periodCount).fill(BigInt(0)) as bigint[];
    for (let i = 0; i < periodCount; i++) {
      cashOutTotalArr[i] =
        blockTotals.get('CASH_OUT_OPERATIVE')![i] +
        blockTotals.get('CASH_OUT_TAX')![i] +
        blockTotals.get('CASH_OUT_INSOLVENCY')![i];
    }
    blockTotals.set('CASH_OUT_TOTAL', cashOutTotalArr);

    // 10b. Populate Bank-spezifische Opening/Closing Balance Zeilen
    // WICHTIG: Muss VOR der Opening/Closing Balance Total-Berechnung erfolgen!
    // Für jedes Bankkonto: Berechne running balance pro Periode
    // WICHTIG: Bank-Balances sind immer GLOBAL (nicht scope-gefiltert),
    // aber die Sichtbarkeit der Zeilen wird über visibleInScopes gesteuert

    // 10c. Calculate Opening/Closing Balance Totals
    // Bankkonten-Details entfernt (2026-02-09) - nur noch Totals aus Cashflows
    // Einzelne Konten werden im Bankenspiegel (BankAccountsTab) angezeigt
    console.log('[Liquidity Matrix] Berechne Balance-Totals aus Cashflows...');

    const openingBalances: bigint[] = [];
    const closingBalances: bigint[] = [];

    for (let i = 0; i < periodCount; i++) {
      // Opening Balance: Periode 0 startet bei 0, danach = Closing der Vorperiode
      const periodOpening = i === 0 ? BigInt(0) : closingBalances[i - 1];
      openingBalances.push(periodOpening);

      // Closing Balance = Opening + Cash In + Cash Out
      const cashIn = blockTotals.get('CASH_IN')![i];
      const cashOutTotal = blockTotals.get('CASH_OUT_TOTAL')![i];
      const closing = periodOpening + cashIn + cashOutTotal;
      closingBalances.push(closing);
    }

    console.log(
      `[Balance Total] Period 0: Opening ${Number(openingBalances[0]) / 100}€, Closing ${Number(closingBalances[0]) / 100}€`
    );
    console.log(
      `[Balance Total] Period 1: Opening ${Number(openingBalances[1]) / 100}€ (should equal Closing P0: ${Number(closingBalances[0]) / 100}€)`
    );

    // Set balance block totals
    blockTotals.set('OPENING_BALANCE', openingBalances);
    blockTotals.set('CLOSING_BALANCE', closingBalances);

    // 11. Build response blocks
    const responseBlocks: MatrixBlock[] = [];

    for (const blockConfig of HVPLUS_MATRIX_BLOCKS) {
      const blockRows = getRowsForBlock(blockConfig.id, scopeRows);
      const responseRows: MatrixRow[] = [];

      for (const row of blockRows) {
        // Skip sub-rows and section headers if showDetails is false
        if (!showDetails && row.isSubRow) continue;
        if (!showDetails && row.isSectionHeader) continue;

        const rowPeriods = rowAggregations.get(row.id);
        const values: MatrixRowValue[] = [];
        let rowTotal = BigInt(0);

        for (let i = 0; i < periodCount; i++) {
          let amount: bigint;
          let count = 0;

          if (row.isSummary) {
            // Use block totals for summary rows
            amount = blockTotals.get(blockConfig.id)![i];
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

    // 12. Validation checks
    let hasBalanceError = false;
    let hasNegativeBalance = false;
    const errorPeriods: number[] = [];

    for (let i = 0; i < periodCount; i++) {
      const opening = openingBalances[i];
      const cashIn = blockTotals.get('CASH_IN')![i];
      const cashOutTotal = blockTotals.get('CASH_OUT_TOTAL')![i];
      const closing = closingBalances[i];

      const calculatedClosing = opening + cashIn + cashOutTotal;

      // Check for balance error (allow small rounding tolerance)
      const diff = closing - calculatedClosing;
      if (diff > BigInt(100) || diff < BigInt(-100)) {
        hasBalanceError = true;
        errorPeriods.push(i);
      }

      // Check for negative balance
      if (closing < BigInt(0)) {
        hasNegativeBalance = true;
        if (!errorPeriods.includes(i)) {
          errorPeriods.push(i);
        }
      }
    }

    const unklearPercentage = totalEntries > 0 ? (unklearCount / totalEntries) * 100 : 0;

    // 13. Build response
    const response: LiquidityMatrixData = {
      caseId,
      caseName: existingCase.debtorName,
      scope,
      scopeLabel: LIQUIDITY_SCOPE_LABELS[scope],
      scopeHint: getScopeHintText(scope),
      periods,
      blocks: responseBlocks,
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
