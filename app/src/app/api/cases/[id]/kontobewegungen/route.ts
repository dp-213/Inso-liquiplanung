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
    // Hole Case mit Locations und BankAccounts
    const caseData = await prisma.case.findUnique({
      where: { id },
      include: {
        locations: true,
        bankAccounts: {
          orderBy: { displayOrder: 'asc' },
        },
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

    for (const entry of entries) {
      if (entry.amountCents >= 0) {
        totalInflows += entry.amountCents;
      } else {
        totalOutflows += entry.amountCents;
      }
    }

    // === Gruppierung nach Kontentyp (ISK vs. Gläubigerkonten) ===
    const iskAccounts: Record<string, {
      accountId: string;
      accountName: string;
      bankName: string;
      iban: string | null;
      inflows: bigint;
      outflows: bigint;
      count: number;
      entries: typeof entries;
    }> = {};

    const glaeubigerAccounts: Record<string, {
      accountId: string;
      accountName: string;
      bankName: string;
      iban: string | null;
      inflows: bigint;
      outflows: bigint;
      count: number;
      entries: typeof entries;
    }> = {};

    // Initialisiere BankAccounts
    for (const account of caseData.bankAccounts) {
      const target = account.isLiquidityRelevant ? iskAccounts : glaeubigerAccounts;
      target[account.id] = {
        accountId: account.id,
        accountName: account.accountName,
        bankName: account.bankName,
        iban: account.iban,
        inflows: BigInt(0),
        outflows: BigInt(0),
        count: 0,
        entries: [],
      };
    }

    // Bucket für Einträge ohne Bankkonto
    const noBankAccount = {
      accountId: '_none',
      accountName: 'Ohne Bankkonto',
      bankName: '',
      iban: null as string | null,
      inflows: BigInt(0),
      outflows: BigInt(0),
      count: 0,
      entries: [] as typeof entries,
    };

    // Aggregiere Daten nach Kontentyp
    for (const entry of entries) {
      const accountId = entry.bankAccountId;

      let bucket: typeof noBankAccount;
      if (!accountId) {
        bucket = noBankAccount;
      } else if (iskAccounts[accountId]) {
        bucket = iskAccounts[accountId];
      } else if (glaeubigerAccounts[accountId]) {
        bucket = glaeubigerAccounts[accountId];
      } else {
        bucket = noBankAccount;
      }

      if (entry.amountCents >= 0) {
        bucket.inflows += entry.amountCents;
      } else {
        bucket.outflows += entry.amountCents;
      }
      bucket.count++;
      bucket.entries.push(entry);
    }

    // === Gruppierung nach Standort ===
    const byLocation: Record<string, {
      name: string;
      inflows: bigint;
      outflows: bigint;
      count: number;
      entries: typeof entries;
    }> = {};

    for (const loc of caseData.locations) {
      byLocation[loc.id] = {
        name: loc.name,
        inflows: BigInt(0),
        outflows: BigInt(0),
        count: 0,
        entries: [],
      };
    }
    byLocation['_none'] = {
      name: 'Ohne Standort',
      inflows: BigInt(0),
      outflows: BigInt(0),
      count: 0,
      entries: [],
    };

    for (const entry of entries) {
      const locId = entry.locationId || '_none';
      if (byLocation[locId]) {
        if (entry.amountCents >= 0) {
          byLocation[locId].inflows += entry.amountCents;
        } else {
          byLocation[locId].outflows += entry.amountCents;
        }
        byLocation[locId].count++;
        byLocation[locId].entries.push(entry);
      }
    }

    // === Gruppierung nach Monat ===
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

    // Hilfsfunktion: Entry für JSON serialisieren
    const serializeEntry = (e: typeof entries[number]) => ({
      id: e.id,
      date: e.transactionDate.toISOString(),
      description: e.description,
      amount: e.amountCents.toString(),
      estateAllocation: e.estateAllocation,
      allocationNote: e.allocationNote,
      importSource: e.importSource,
      counterpartyId: e.counterpartyId,
      categoryTag: e.categoryTag,
    });

    // Hilfsfunktion: Account-Bucket für JSON serialisieren
    const serializeAccountBucket = (b: typeof noBankAccount) => ({
      accountId: b.accountId,
      accountName: b.accountName,
      bankName: b.bankName,
      iban: b.iban,
      inflows: b.inflows.toString(),
      outflows: b.outflows.toString(),
      netAmount: (b.inflows + b.outflows).toString(),
      count: b.count,
      entries: b.entries.map(serializeEntry),
    });

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
      byAccountType: {
        isk: Object.values(iskAccounts)
          .filter(a => a.count > 0)
          .map(serializeAccountBucket),
        glaeubigerkonten: Object.values(glaeubigerAccounts)
          .filter(a => a.count > 0)
          .map(serializeAccountBucket),
        ohneBankkonto: noBankAccount.count > 0 ? serializeAccountBucket(noBankAccount) : null,
        iskTotal: {
          inflows: Object.values(iskAccounts).reduce((s, a) => s + a.inflows, BigInt(0)).toString(),
          outflows: Object.values(iskAccounts).reduce((s, a) => s + a.outflows, BigInt(0)).toString(),
          count: Object.values(iskAccounts).reduce((s, a) => s + a.count, 0),
        },
        glaeubigerTotal: {
          inflows: Object.values(glaeubigerAccounts).reduce((s, a) => s + a.inflows, BigInt(0)).toString(),
          outflows: Object.values(glaeubigerAccounts).reduce((s, a) => s + a.outflows, BigInt(0)).toString(),
          count: Object.values(glaeubigerAccounts).reduce((s, a) => s + a.count, 0),
        },
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
          entries: data.entries.map(serializeEntry),
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
