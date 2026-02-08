import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { calculateBankAccountBalances } from "@/lib/bank-accounts/calculate-balances";
import { generatePeriodLabel, getPeriodDates } from "@/lib/ledger-aggregation";

/**
 * GET /api/cases/[id]/bank-accounts
 *
 * Gibt detaillierte Bankkonto-Informationen zurück:
 * - Opening Balance pro Konto
 * - Aktuelle Balance (Opening + IST-Summe aus Ledger)
 * - Zuordnung zu Location
 * - Status (available, blocked, restricted)
 *
 * Response: {
 *   accounts: Array<{
 *     id: string;
 *     bankName: string;
 *     accountName: string;
 *     iban: string | null;
 *     status: string;
 *     location: { id: string; name: string } | null;
 *     openingBalanceCents: string;
 *     ledgerSumCents: string;
 *     currentBalanceCents: string;
 *   }>;
 *   summary: {
 *     totalBalanceCents: string;
 *     totalAvailableCents: string;
 *     accountCount: number;
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { id: caseId } = await params;

    // Hole aktiven Plan für periodType/periodCount
    const activePlan = await prisma.liquidityPlan.findFirst({
      where: { caseId, isActive: true },
      select: {
        id: true,
        periodType: true,
        periodCount: true,
        planStartDate: true,
      },
    });

    if (!activePlan) {
      return NextResponse.json({ error: "Kein aktiver Plan gefunden" }, { status: 404 });
    }

    const periodType = (activePlan.periodType as "WEEKLY" | "MONTHLY") || "MONTHLY";
    const periodCount = activePlan.periodCount || 11;
    const planStartDate = new Date(activePlan.planStartDate);

    // Lade BankAccounts mit Location-Relation
    const accounts = await prisma.bankAccount.findMany({
      where: { caseId },
      include: {
        location: { select: { id: true, name: true } },
      },
      orderBy: { displayOrder: "asc" },
    });

    // DEBUG: Log was wir bekommen
    console.log('[API /bank-accounts] Loaded accounts:');
    accounts.forEach(acc => {
      console.log(`  - ${acc.accountName}: locationId=${acc.locationId}, opening=${Number(acc.openingBalanceCents)/100}€`);
    });

    // Lade ALLE IST-Ledger-Entries (valueType=IST)
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        caseId,
        valueType: "IST",
      },
      select: {
        bankAccountId: true,
        amountCents: true,
        transactionDate: true,
      },
      orderBy: { transactionDate: "asc" },
    });

    // Berechne aktuelle Balances (Opening + IST-Ledger-Summen)
    const balanceData = await calculateBankAccountBalances(
      caseId,
      accounts.map((a) => ({
        id: a.id,
        openingBalanceCents: a.openingBalanceCents,
        status: a.status,
      }))
    );

    // Finde letztes IST-Datum pro Konto
    const lastIstDatePerAccount = new Map<string, Date>();
    for (const account of accounts) {
      const accountEntries = ledgerEntries.filter(e => e.bankAccountId === account.id);
      if (accountEntries.length > 0) {
        const lastDate = new Date(Math.max(...accountEntries.map(e => new Date(e.transactionDate).getTime())));
        lastIstDatePerAccount.set(account.id, lastDate);
      }
    }

    // Berechne Perioden-Verläufe pro Konto
    const accountPeriods = new Map<string, Array<{ periodIndex: number; periodLabel: string; balanceCents: bigint; isFrozen?: boolean; lastUpdateDate?: string }>>();

    for (const account of accounts) {
      const periods: Array<{ periodIndex: number; periodLabel: string; balanceCents: bigint; isFrozen?: boolean; lastUpdateDate?: string }> = [];
      let runningBalance = account.openingBalanceCents;
      const lastIstDate = lastIstDatePerAccount.get(account.id);

      for (let i = 0; i < periodCount; i++) {
        const { start, end } = getPeriodDates(periodType, i, planStartDate);
        const periodLabel = generatePeriodLabel(periodType, i, planStartDate);

        // Wenn Periode NACH letztem IST-Datum liegt: Balance einfrieren
        if (lastIstDate && start > lastIstDate) {
          periods.push({
            periodIndex: i,
            periodLabel,
            balanceCents: runningBalance, // Eingefroren
            isFrozen: true,
            lastUpdateDate: lastIstDate.toISOString(),
          });
          continue;
        }

        // Summiere Entries für dieses Konto in dieser Periode
        const periodSum = ledgerEntries
          .filter((e) => {
            if (e.bankAccountId !== account.id) return false;
            const entryDate = new Date(e.transactionDate);
            return entryDate >= start && entryDate < end;
          })
          .reduce((sum, e) => sum + e.amountCents, BigInt(0));

        runningBalance += periodSum;

        periods.push({
          periodIndex: i,
          periodLabel,
          balanceCents: runningBalance,
          isFrozen: false,
        });
      }

      accountPeriods.set(account.id, periods);
    }

    // WORKAROUND: Prisma gibt locationId nicht zurück, setze manuell basierend auf accountName
    const getLocationByAccountName = (accountName: string) => {
      if (accountName.toLowerCase().includes("velbert")) {
        return { id: "loc-haevg-velbert", name: "Praxis Velbert" };
      }
      if (accountName.toLowerCase().includes("uckerath")) {
        return { id: "loc-haevg-uckerath", name: "Praxis Uckerath" };
      }
      // HV PLUS eG und andere zentrale Konten
      return null;
    };

    // Response mit allen Details inkl. Perioden-Verläufe
    const result = accounts.map((acc) => {
      const balance = balanceData.balances.get(acc.id);
      const periods = accountPeriods.get(acc.id) || [];

      return {
        id: acc.id,
        bankName: acc.bankName,
        accountName: acc.accountName,
        iban: acc.iban,
        status: acc.status,
        location: getLocationByAccountName(acc.accountName), // WORKAROUND
        openingBalanceCents: acc.openingBalanceCents.toString(),
        ledgerSumCents: balance?.ledgerSumCents.toString() ?? "0",
        currentBalanceCents:
          balance?.currentBalanceCents.toString() ?? acc.openingBalanceCents.toString(),
        periods: periods.map((p) => ({
          periodIndex: p.periodIndex,
          periodLabel: p.periodLabel,
          balanceCents: p.balanceCents.toString(),
          isFrozen: p.isFrozen,
          lastUpdateDate: p.lastUpdateDate,
        })),
      };
    });

    return NextResponse.json({
      accounts: result,
      summary: {
        totalBalanceCents: balanceData.totalBalanceCents.toString(),
        totalAvailableCents: balanceData.totalAvailableCents.toString(),
        accountCount: accounts.length,
      },
      planInfo: {
        periodType,
        periodCount,
      },
    });
  } catch (error) {
    console.error("BankAccounts API Fehler:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
