import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getCustomerSession, checkCaseAccess } from '@/lib/customer-auth';
import { aggregateByCounterparty, summarizeByCounterparty, type LiquidityScope } from '@/lib/ledger/aggregation';

/**
 * GET /api/cases/[id]/ledger/revenue
 *
 * Aggregiert Einnahmen nach Gegenpartei (Counterparty) und Standort (Location)
 *
 * Query-Parameter:
 * - months: Anzahl Monate zurück (default: 6)
 * - summarize: 'true' für Summary pro Counterparty, sonst Detail-Liste
 *
 * Response (summarize=false):
 * {
 *   entries: Array<{
 *     counterpartyId: string | null;
 *     counterpartyName: string;
 *     locationId: string | null;
 *     locationName: string;
 *     periodIndex: number;
 *     periodLabel: string;
 *     amountCents: string;
 *     transactionDate: string;
 *     description: string;
 *   }>
 * }
 *
 * Response (summarize=true):
 * {
 *   summary: Array<{
 *     counterpartyId: string | null;
 *     counterpartyName: string;
 *     totalCents: string;
 *     entryCount: number;
 *   }>
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;

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
    const { searchParams } = new URL(request.url);
    const monthsParam = searchParams.get('months');
    const summarizeParam = searchParams.get('summarize');
    const scopeParam = searchParams.get('scope');

    const months = monthsParam ? parseInt(monthsParam, 10) : 6;
    const shouldSummarize = summarizeParam === 'true';
    const scope = (scopeParam as 'GLOBAL' | 'LOCATION_VELBERT' | 'LOCATION_UCKERATH_EITORF') || 'GLOBAL';

    // Get active plan for case
    const plan = await prisma.liquidityPlan.findFirst({
      where: { caseId, isActive: true },
      select: { id: true },
    });

    if (!plan) {
      return NextResponse.json(
        { error: 'Kein aktiver Liquiditätsplan für diesen Fall' },
        { status: 404 }
      );
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    if (shouldSummarize) {
      // Return summarized data per counterparty
      const summary = await summarizeByCounterparty(prisma, caseId, plan.id, {
        startDate,
        endDate,
        scope,
      });

      // Convert BigInt to string for JSON serialization
      const serializedSummary = summary.map((s) => ({
        counterpartyId: s.counterpartyId,
        counterpartyName: s.counterpartyName,
        totalCents: s.totalCents.toString(),
        entryCount: s.entryCount,
      }));

      return NextResponse.json({
        summary: serializedSummary,
        periodStart: startDate.toISOString(),
        periodEnd: endDate.toISOString(),
      });
    } else {
      // Return detailed entries
      const entries = await aggregateByCounterparty(prisma, caseId, plan.id, {
        startDate,
        endDate,
        flowType: 'INFLOW',
        scope,
      });

      // Convert BigInt to string for JSON serialization
      const serializedEntries = entries.map((e) => ({
        counterpartyId: e.counterpartyId,
        counterpartyName: e.counterpartyName,
        locationId: e.locationId,
        locationName: e.locationName,
        periodIndex: e.periodIndex,
        periodLabel: e.periodLabel,
        amountCents: e.amountCents.toString(),
        transactionDate: e.transactionDate.toISOString(),
        description: e.description,
      }));

      return NextResponse.json({
        entries: serializedEntries,
        periodStart: startDate.toISOString(),
        periodEnd: endDate.toISOString(),
      });
    }
  } catch (error) {
    console.error('Fehler bei Revenue-Aggregation:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}
