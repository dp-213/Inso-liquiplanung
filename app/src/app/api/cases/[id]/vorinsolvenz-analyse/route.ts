import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { EXCLUDE_SPLIT_PARENTS } from '@/lib/ledger/types';

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
    const caseData = await prisma.case.findUnique({
      where: { id },
      include: {
        bankAccounts: {
          orderBy: { displayOrder: 'asc' },
          include: { location: true },
        },
        counterparties: { orderBy: { displayOrder: 'asc' } },
        locations: { orderBy: { displayOrder: 'asc' } },
      },
    });

    if (!caseData) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    // Alle Pre-Insolvency Entries laden (exclude split parents)
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        caseId: id,
        allocationSource: 'PRE_INSOLVENCY',
        ...EXCLUDE_SPLIT_PARENTS,
      },
      orderBy: { transactionDate: 'desc' },
    });

    if (entries.length === 0) {
      return NextResponse.json({
        summary: {
          totalCount: 0,
          classifiedCount: 0,
          totalInflowsCents: '0',
          totalOutflowsCents: '0',
          netCents: '0',
          avgMonthlyInflowsCents: '0',
          avgMonthlyOutflowsCents: '0',
          months: [],
        },
        counterpartyMonthly: [],
        monthlySummary: [],
        byBankAccount: [],
        unclassified: [],
        locations: [],
      });
    }

    // Counterparty-Lookup aufbauen
    const counterpartyMap = new Map<string, { name: string; type: string | null }>();
    for (const cp of caseData.counterparties) {
      counterpartyMap.set(cp.id, { name: cp.shortName || cp.name, type: cp.type });
    }

    // BankAccount → Location Mapping
    const bankAccountMap = new Map<string, { accountName: string; bankName: string; locationId: string | null; locationName: string | null }>();
    for (const ba of caseData.bankAccounts) {
      bankAccountMap.set(ba.id, {
        accountName: ba.accountName,
        bankName: ba.bankName,
        locationId: ba.locationId,
        locationName: ba.location?.shortName || ba.location?.name || null,
      });
    }

    // Location Lookup
    const locationMap = new Map<string, string>();
    for (const loc of caseData.locations) {
      locationMap.set(loc.id, loc.shortName || loc.name);
    }

    // === Aggregation in JS (wegen Turso Date-Bug) ===
    let totalInflows = BigInt(0);
    let totalOutflows = BigInt(0);
    let classifiedCount = 0;
    const monthSet = new Set<string>();

    // Counterparty → Monat → Summe
    const cpMonthly = new Map<string, {
      counterpartyId: string | null;
      totalCents: bigint;
      matchCount: number;
      monthly: Map<string, bigint>;
      hasInflows: boolean;
      hasOutflows: boolean;
      // Location breakdown: locationId → { totalCents, monthly }
      byLocation: Map<string, { totalCents: bigint; monthly: Map<string, bigint> }>;
    }>();

    // Monat → Summen
    const monthlyAgg = new Map<string, {
      inflowsCents: bigint;
      outflowsCents: bigint;
      count: number;
    }>();

    // BankAccount → Summen
    const bankAgg = new Map<string, {
      inflowsCents: bigint;
      outflowsCents: bigint;
      count: number;
    }>();

    // Unklassifizierte Entries sammeln
    const unclassified: Array<{
      id: string;
      description: string;
      note: string | null;
      amountCents: string;
      transactionDate: string;
    }> = [];

    // Track locations that actually have data
    const activeLocationIds = new Set<string>();

    for (const entry of entries) {
      const amount = entry.amountCents;
      const isInflow = amount >= BigInt(0);

      if (isInflow) {
        totalInflows += amount;
      } else {
        totalOutflows += amount;
      }

      // Effektive Counterparty: akzeptiert > vorgeschlagen
      const effectiveCpId = entry.counterpartyId || entry.suggestedCounterpartyId;

      // Klassifiziert = hat Counterparty (akzeptiert oder vorgeschlagen) ODER categoryTag
      if (effectiveCpId || entry.categoryTag) {
        classifiedCount++;
      } else {
        unclassified.push({
          id: entry.id,
          description: entry.description,
          note: entry.note,
          amountCents: amount.toString(),
          transactionDate: entry.transactionDate.toISOString(),
        });
      }

      // Monat bestimmen
      const date = new Date(entry.transactionDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthSet.add(monthKey);

      // Location via bankAccountId → locationId
      const baInfo = entry.bankAccountId ? bankAccountMap.get(entry.bankAccountId) : null;
      const locationId = baInfo?.locationId || '_zentral';
      if (baInfo?.locationId) {
        activeLocationIds.add(baInfo.locationId);
      }

      // Counterparty-Monthly aggregieren (akzeptiert > vorgeschlagen)
      const cpKey = effectiveCpId || '_unclassified';
      if (!cpMonthly.has(cpKey)) {
        cpMonthly.set(cpKey, {
          counterpartyId: effectiveCpId,
          totalCents: BigInt(0),
          matchCount: 0,
          monthly: new Map(),
          hasInflows: false,
          hasOutflows: false,
          byLocation: new Map(),
        });
      }
      const cpData = cpMonthly.get(cpKey)!;
      cpData.totalCents += amount;
      cpData.matchCount++;
      cpData.monthly.set(monthKey, (cpData.monthly.get(monthKey) || BigInt(0)) + amount);
      if (isInflow) cpData.hasInflows = true;
      else cpData.hasOutflows = true;

      // Location breakdown within counterparty
      if (!cpData.byLocation.has(locationId)) {
        cpData.byLocation.set(locationId, { totalCents: BigInt(0), monthly: new Map() });
      }
      const locData = cpData.byLocation.get(locationId)!;
      locData.totalCents += amount;
      locData.monthly.set(monthKey, (locData.monthly.get(monthKey) || BigInt(0)) + amount);

      // Monthly aggregieren
      if (!monthlyAgg.has(monthKey)) {
        monthlyAgg.set(monthKey, { inflowsCents: BigInt(0), outflowsCents: BigInt(0), count: 0 });
      }
      const mData = monthlyAgg.get(monthKey)!;
      if (isInflow) mData.inflowsCents += amount;
      else mData.outflowsCents += amount;
      mData.count++;

      // BankAccount aggregieren
      const baKey = entry.bankAccountId || '_none';
      if (!bankAgg.has(baKey)) {
        bankAgg.set(baKey, { inflowsCents: BigInt(0), outflowsCents: BigInt(0), count: 0 });
      }
      const baData = bankAgg.get(baKey)!;
      if (isInflow) baData.inflowsCents += amount;
      else baData.outflowsCents += amount;
      baData.count++;
    }

    // Sortierte Monate
    const months = Array.from(monthSet).sort();
    const monthCount = months.length || 1;

    // === Response aufbauen ===
    const summary = {
      totalCount: entries.length,
      classifiedCount,
      totalInflowsCents: totalInflows.toString(),
      totalOutflowsCents: totalOutflows.toString(),
      netCents: (totalInflows + totalOutflows).toString(),
      avgMonthlyInflowsCents: (totalInflows / BigInt(monthCount)).toString(),
      avgMonthlyOutflowsCents: (totalOutflows / BigInt(monthCount)).toString(),
      months,
    };

    // Counterparty-Monthly: Sortiert nach |totalCents| desc
    const counterpartyMonthly = Array.from(cpMonthly.entries())
      .sort((a, b) => {
        const absA = a[1].totalCents < BigInt(0) ? -a[1].totalCents : a[1].totalCents;
        const absB = b[1].totalCents < BigInt(0) ? -b[1].totalCents : b[1].totalCents;
        if (absB > absA) return 1;
        if (absB < absA) return -1;
        return 0;
      })
      .map(([key, data]) => {
        const cpInfo = data.counterpartyId ? counterpartyMap.get(data.counterpartyId) : null;
        const monthly: Record<string, string> = {};
        for (const [m, v] of data.monthly) {
          monthly[m] = v.toString();
        }

        // Location breakdown
        const byLocation = Array.from(data.byLocation.entries())
          .sort((a, b) => {
            const absA = a[1].totalCents < BigInt(0) ? -a[1].totalCents : a[1].totalCents;
            const absB = b[1].totalCents < BigInt(0) ? -b[1].totalCents : b[1].totalCents;
            if (absB > absA) return 1;
            if (absB < absA) return -1;
            return 0;
          })
          .map(([locId, locData]) => {
            const locMonthly: Record<string, string> = {};
            for (const [m, v] of locData.monthly) {
              locMonthly[m] = v.toString();
            }
            return {
              locationId: locId,
              locationName: locId === '_zentral' ? 'HVPlus eG (zentral)' : (locationMap.get(locId) || locId),
              totalCents: locData.totalCents.toString(),
              monthly: locMonthly,
            };
          });

        return {
          counterpartyId: data.counterpartyId,
          counterpartyName: cpInfo?.name || (key === '_unclassified' ? 'Nicht zugeordnet' : key),
          counterpartyType: cpInfo?.type || null,
          flowType: (data.hasInflows && data.hasOutflows ? 'MIXED' : data.hasInflows ? 'INFLOW' : 'OUTFLOW') as 'INFLOW' | 'OUTFLOW' | 'MIXED',
          totalCents: data.totalCents.toString(),
          matchCount: data.matchCount,
          monthly,
          byLocation,
        };
      });

    // Monthly Summary
    const monthlySummary = months.map((month) => {
      const data = monthlyAgg.get(month)!;
      return {
        month,
        inflowsCents: data.inflowsCents.toString(),
        outflowsCents: data.outflowsCents.toString(),
        netCents: (data.inflowsCents + data.outflowsCents).toString(),
        count: data.count,
      };
    });

    // By Bank Account
    const byBankAccount = Array.from(bankAgg.entries())
      .filter(([, data]) => data.count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([key, data]) => {
        const baInfo = key !== '_none' ? bankAccountMap.get(key) : null;
        return {
          accountId: key,
          accountName: baInfo?.accountName || 'Ohne Bankkonto',
          bankName: baInfo?.bankName || '',
          inflowsCents: data.inflowsCents.toString(),
          outflowsCents: data.outflowsCents.toString(),
          count: data.count,
        };
      });

    // Locations mit Daten
    const locations = Array.from(activeLocationIds).map((locId) => ({
      id: locId,
      name: locationMap.get(locId) || locId,
    }));

    return NextResponse.json({
      summary,
      counterpartyMonthly,
      monthlySummary,
      byBankAccount,
      unclassified,
      locations,
    });
  } catch (error) {
    console.error('Error fetching vorinsolvenz-analyse:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Vorinsolvenz-Analyse' },
      { status: 500 }
    );
  }
}
