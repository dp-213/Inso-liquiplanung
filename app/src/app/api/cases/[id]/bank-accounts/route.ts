import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCustomerSession, checkCaseAccess } from "@/lib/customer-auth";
import { calculateBankAccountBalances } from "@/lib/bank-accounts/calculate-balances";
import { generatePeriodLabel, getPeriodDates } from "@/lib/ledger-aggregation";
import { EXCLUDE_SPLIT_PARENTS } from "@/lib/ledger/types";

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
    const { id: caseId } = await params;

    // Auth: Prüfe Admin- ODER Customer-Session
    const adminSession = await getSession();
    const customerSession = await getCustomerSession();

    if (!adminSession && !customerSession) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    // Falls Customer-Session: Prüfe Case-Access
    if (customerSession && !adminSession) {
      const access = await checkCaseAccess(customerSession.customerId, caseId);
      if (!access.hasAccess) {
        return NextResponse.json({ error: "Zugriff verweigert" }, { status: 403 });
      }
    }

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

    // Lade ALLE IST-Ledger-Entries (valueType=IST, exclude split parents)
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        caseId,
        valueType: "IST",
        ...EXCLUDE_SPLIT_PARENTS,
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
        isLiquidityRelevant: acc.isLiquidityRelevant,
        securityHolder: acc.securityHolder,
        location: acc.location, // Verwendet echte DB-Relation
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
