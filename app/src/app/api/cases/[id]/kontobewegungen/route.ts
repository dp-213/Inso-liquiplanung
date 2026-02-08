import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Hole Case mit Locations
    const caseData = await prisma.case.findUnique({
      where: { id },
      include: {
        locations: true,
      },
    });

    if (!caseData) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    // Hole alle IST-Einträge
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        caseId: id,
        valueType: 'IST',
      },
      orderBy: { transactionDate: 'desc' },
    });

    // Berechne Gesamtstatistiken
    let totalInflows = BigInt(0);
    let totalOutflows = BigInt(0);
    const byLocation: Record<string, {
      name: string;
      inflows: bigint;
      outflows: bigint;
      count: number;
      entries: typeof entries;
    }> = {};

    // Initialisiere Locations
    for (const loc of caseData.locations) {
      byLocation[loc.id] = {
        name: loc.name,
        inflows: BigInt(0),
        outflows: BigInt(0),
        count: 0,
        entries: [],
      };
    }
    // Für Einträge ohne Location
    byLocation['_none'] = {
      name: 'Ohne Standort',
      inflows: BigInt(0),
      outflows: BigInt(0),
      count: 0,
      entries: [],
    };

    // Aggregiere Daten
    for (const entry of entries) {
      const amount = entry.amountCents;
      const locId = entry.locationId || '_none';

      if (amount >= 0) {
        totalInflows += amount;
        if (byLocation[locId]) {
          byLocation[locId].inflows += amount;
        }
      } else {
        totalOutflows += amount;
        if (byLocation[locId]) {
          byLocation[locId].outflows += amount;
        }
      }

      if (byLocation[locId]) {
        byLocation[locId].count++;
        byLocation[locId].entries.push(entry);
      }
    }

    // Gruppiere nach Monat
    const byMonth: Record<string, {
      month: string;
      inflows: bigint;
      outflows: bigint;
      count: number;
    }> = {};

    for (const entry of entries) {
      const date = new Date(entry.transactionDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!byMonth[monthKey]) {
        byMonth[monthKey] = {
          month: monthKey,
          inflows: BigInt(0),
          outflows: BigInt(0),
          count: 0,
        };
      }

      if (entry.amountCents >= 0) {
        byMonth[monthKey].inflows += entry.amountCents;
      } else {
        byMonth[monthKey].outflows += entry.amountCents;
      }
      byMonth[monthKey].count++;
    }

    // Konvertiere BigInt zu String für JSON
    const result = {
      case: {
        id: caseData.id,
        caseNumber: caseData.caseNumber,
        debtorName: caseData.debtorName,
      },
      summary: {
        totalCount: entries.length,
        totalInflows: totalInflows.toString(),
        totalOutflows: totalOutflows.toString(),
        netAmount: (totalInflows + totalOutflows).toString(),
      },
      byLocation: Object.entries(byLocation)
        .filter(([, data]) => data.count > 0)
        .map(([locId, data]) => ({
          locationId: locId,
          locationName: data.name,
          inflows: data.inflows.toString(),
          outflows: data.outflows.toString(),
          netAmount: (data.inflows + data.outflows).toString(),
          count: data.count,
          entries: data.entries.map(e => ({
            id: e.id,
            date: e.transactionDate.toISOString(),
            description: e.description,
            amount: e.amountCents.toString(),
            estateAllocation: e.estateAllocation,
            allocationNote: e.allocationNote,
            importSource: e.importSource,
          })),
        })),
      byMonth: Object.values(byMonth)
        .sort((a, b) => a.month.localeCompare(b.month))
        .map(m => ({
          month: m.month,
          inflows: m.inflows.toString(),
          outflows: m.outflows.toString(),
          netAmount: (m.inflows + m.outflows).toString(),
          count: m.count,
        })),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching kontobewegungen:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Kontobewegungen' },
      { status: 500 }
    );
  }
}
