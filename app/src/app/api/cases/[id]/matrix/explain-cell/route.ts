/**
 * API: Explain Cell – Drill-Down einer Zelle der Liquiditätsmatrix
 *
 * Erklärt, warum eine bestimmte Zelle (rowId + periodIndex) einen bestimmten
 * Wert hat. Nutzt exakt dieselbe Aggregationslogik wie die Matrix-API,
 * aber mit traceMode=true.
 *
 * GET /api/cases/[id]/matrix/explain-cell?rowId=cash_in_hzv&periodIndex=3&scope=GLOBAL&includeUnreviewed=false
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  HVPLUS_MATRIX_BLOCKS,
  HVPLUS_MATRIX_ROWS,
  getRowsForScope,
  filterEntriesByScope,
  type LiquidityScope,
} from '@/lib/cases/haevg-plus/matrix-config';
import { aggregateEntries } from '@/lib/liquidity-matrix/aggregate';
import { buildCellExplanation } from '@/lib/liquidity-matrix/explain';

// =============================================================================
// HELPER (identisch mit Matrix-API)
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

    // Auth: NUR Admin
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    // Query Parameters
    const rowId = searchParams.get('rowId');
    const periodIndexStr = searchParams.get('periodIndex');
    const scopeParam = searchParams.get('scope') || 'GLOBAL';
    const scope: LiquidityScope = ['GLOBAL', 'LOCATION_VELBERT', 'LOCATION_UCKERATH_EITORF'].includes(scopeParam)
      ? (scopeParam as LiquidityScope)
      : 'GLOBAL';
    const includeUnreviewed = searchParams.get('includeUnreviewed') === 'true';

    if (!rowId || periodIndexStr === null) {
      return NextResponse.json(
        { error: 'Parameter rowId und periodIndex sind erforderlich' },
        { status: 400 }
      );
    }

    const periodIndex = parseInt(periodIndexStr, 10);
    if (isNaN(periodIndex) || periodIndex < 0) {
      return NextResponse.json(
        { error: 'periodIndex muss eine positive Ganzzahl sein' },
        { status: 400 }
      );
    }

    // 1. Load Case + Plan
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

    if (periodIndex >= periodCount) {
      return NextResponse.json(
        { error: `periodIndex ${periodIndex} liegt außerhalb des Plans (${periodCount} Perioden)` },
        { status: 400 }
      );
    }

    // 2. Load LedgerEntries (nur liquidity-relevante Konten + PLAN-Entries)
    const reviewStatusFilter = includeUnreviewed
      ? { not: 'REJECTED' }
      : { in: ['CONFIRMED', 'ADJUSTED'] };

    // ISK-Only-Filter: Konsistent mit Matrix-API
    const liquidityAccountIds = existingCase.bankAccounts
      .filter(a => a.isLiquidityRelevant)
      .map(a => a.id);

    const allEntries = await prisma.ledgerEntry.findMany({
      where: {
        caseId,
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

    // 3. Apply Scope Filter
    const entries = filterEntriesByScope(
      allEntries.map(e => ({
        ...e,
        locationId: e.location?.id || null,
      })),
      scope
    );

    // 4. Bank Account Map
    const bankAccountMap = new Map<string, string>();
    for (const acc of existingCase.bankAccounts) {
      const nameLower = acc.bankName.toLowerCase();
      if (nameLower.includes('sparkasse')) {
        bankAccountMap.set(acc.id, 'sparkasse');
      } else if (nameLower.includes('apo')) {
        bankAccountMap.set(acc.id, 'apobank');
      }
    }

    // 5. Scope rows
    const scopeRows = getRowsForScope(HVPLUS_MATRIX_ROWS, scope);

    // Validate rowId
    const targetRow = scopeRows.find(r => r.id === rowId);
    if (!targetRow) {
      return NextResponse.json(
        { error: `Zeile '${rowId}' nicht gefunden in Scope '${scope}'` },
        { status: 404 }
      );
    }

    // 6. Aggregate with trace mode
    const aggregation = aggregateEntries({
      entries: entries as Parameters<typeof aggregateEntries>[0]['entries'],
      rows: scopeRows,
      periodCount,
      startDate,
      periodType,
      bankAccountMap,
      traceMode: true,
    });

    // 7. Filter traces for this cell
    // NUR Entries die tatsächlich in diese Zeile geflossen sind.
    // Übersprungene PLAN-Entries werden NICHT in die Trace-Liste aufgenommen,
    // ihre Anzahl wird aber als Statistik (planIgnoredForPeriod) übergeben.
    const cellTraces = aggregation.traces.filter(trace => {
      if (trace.periodIndex !== periodIndex) return false;
      if (trace.wasSkippedByIstVorrang) return false;

      // Prüfe ob Neu-Anteil in diese Zeile geflossen ist
      if (trace.neuMatch?.row.id === rowId) return true;
      // Prüfe ob Alt-Anteil in diese Zeile geflossen ist
      if (trace.altMatch?.row.id === rowId) return true;

      return false;
    });

    // 8. Get cell amount from aggregation
    const rowPeriods = aggregation.rowAggregations.get(rowId);
    const cellData = rowPeriods?.get(periodIndex);
    const amountCents = cellData?.amount.toString() ?? '0';

    // 9. Period info
    const { start, end } = getPeriodDates(periodIndex, startDate, periodType);
    const periodLabel = getPeriodLabel(periodIndex, startDate, periodType);

    // Block label
    const block = HVPLUS_MATRIX_BLOCKS.find(b => b.id === targetRow.block);
    const blockLabel = block?.label ?? targetRow.block;

    // Plan-ignored count for this period
    const pvt = aggregation.periodValueTypes.get(periodIndex);
    const planIgnoredForPeriod = pvt?.planIgnored ?? 0;

    // 10. Build explanation
    const explanation = buildCellExplanation({
      rowId,
      rowLabel: targetRow.label,
      blockLabel,
      periodIndex,
      periodLabel,
      periodStart: start.toISOString().split('T')[0],
      periodEnd: end.toISOString().split('T')[0],
      periodType,
      amountCents,
      traces: cellTraces,
      periodsWithIst: aggregation.periodsWithIst.has(periodIndex),
      planIgnoredForPeriod,
      rowMatches: targetRow.matches,
      rowMatchDescription: targetRow.matchDescription,
    });

    return NextResponse.json(explanation);
  } catch (error) {
    console.error('Explain Cell API Error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
