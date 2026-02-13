import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/cases/[id]/data-quality - Live-Kennzahlen aus DB
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { id: caseId } = await params;

    // Alle Queries parallel ausführen
    const [
      istEntries,
      planEntries,
      bankAccounts,
      counterpartyStats,
    ] = await Promise.all([
      // IST-Entries mit Breakdown
      prisma.ledgerEntry.findMany({
        where: { caseId, valueType: 'IST' },
        select: {
          id: true,
          transactionDate: true,
          reviewStatus: true,
          estateAllocation: true,
          counterpartyId: true,
        },
      }),
      // PLAN-Entries
      prisma.ledgerEntry.findMany({
        where: { caseId, valueType: 'PLAN' },
        select: {
          id: true,
          transactionDate: true,
        },
      }),
      // Bankkonten
      prisma.bankAccount.count({
        where: { caseId },
      }),
      // Gegenpartei-Quote
      prisma.ledgerEntry.count({
        where: { caseId, valueType: 'IST', counterpartyId: { not: null } },
      }),
    ]);

    // IST-Statistiken berechnen
    const totalIST = istEntries.length;
    const totalPLAN = planEntries.length;

    // Review-Status
    const confirmed = istEntries.filter(e => e.reviewStatus === 'CONFIRMED').length;
    const confirmedPct = totalIST > 0 ? Math.round((confirmed / totalIST) * 100) : 0;

    // Estate-Breakdown
    const estateBreakdown = {
      ALTMASSE: istEntries.filter(e => e.estateAllocation === 'ALTMASSE').length,
      NEUMASSE: istEntries.filter(e => e.estateAllocation === 'NEUMASSE').length,
      MIXED: istEntries.filter(e => e.estateAllocation === 'MIXED').length,
      UNKLAR: istEntries.filter(e => e.estateAllocation === 'UNKLAR' || !e.estateAllocation).length,
    };

    // Zeitraum
    const istDates = istEntries.map(e => new Date(e.transactionDate).getTime()).filter(d => !isNaN(d));
    const planDates = planEntries.map(e => new Date(e.transactionDate).getTime()).filter(d => !isNaN(d));
    const allDates = [...istDates, ...planDates];

    const dateRange = allDates.length > 0 ? {
      from: new Date(Math.min(...allDates)).toISOString(),
      to: new Date(Math.max(...allDates)).toISOString(),
    } : null;

    // PLAN-Monate extrahieren
    const planMonths = [...new Set(planEntries.map(e => {
      const d = new Date(e.transactionDate);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }))].sort();

    // Gegenpartei-Quote
    const counterpartyPct = totalIST > 0 ? Math.round((counterpartyStats / totalIST) * 100) : 0;

    return NextResponse.json({
      totalIST,
      totalPLAN,
      confirmedPct,
      estateBreakdown,
      dateRange,
      bankCount: bankAccounts,
      counterpartyPct,
      planMonths,
    });
  } catch (error) {
    console.error('DataQuality GET Error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
