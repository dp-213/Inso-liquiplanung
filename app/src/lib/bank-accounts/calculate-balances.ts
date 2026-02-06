import prisma from "@/lib/db";

export interface BankAccountBalance {
  accountId: string;
  openingBalanceCents: bigint;
  ledgerSumCents: bigint;
  currentBalanceCents: bigint;
}

export interface CaseBankBalances {
  balances: Map<string, BankAccountBalance>;
  totalBalanceCents: bigint;
  totalAvailableCents: bigint;
}

/**
 * Berechnet aktuelle Kontostände aus openingBalanceCents + IST-Ledger-Summen.
 *
 * currentBalanceCents = openingBalanceCents + SUM(IST-LedgerEntries.amountCents)
 * totalAvailableCents = SUM(currentBalanceCents) für Konten mit status !== 'blocked'
 */
export async function calculateBankAccountBalances(
  caseId: string,
  bankAccounts: { id: string; openingBalanceCents: bigint; status: string }[]
): Promise<CaseBankBalances> {
  const accountIds = bankAccounts.map((a) => a.id);

  // Ledger-Summen pro Bankkonto (nur IST-Buchungen)
  const ledgerSums = accountIds.length > 0
    ? await prisma.ledgerEntry.groupBy({
        by: ["bankAccountId"],
        where: {
          caseId,
          valueType: "IST",
          bankAccountId: { in: accountIds },
        },
        _sum: { amountCents: true },
      })
    : [];

  const sumMap = new Map<string, bigint>();
  for (const row of ledgerSums) {
    if (row.bankAccountId) {
      sumMap.set(row.bankAccountId, row._sum.amountCents ?? BigInt(0));
    }
  }

  const balances = new Map<string, BankAccountBalance>();
  let totalBalanceCents = BigInt(0);
  let totalAvailableCents = BigInt(0);

  for (const acc of bankAccounts) {
    const ledgerSum = sumMap.get(acc.id) ?? BigInt(0);
    const current = acc.openingBalanceCents + ledgerSum;

    balances.set(acc.id, {
      accountId: acc.id,
      openingBalanceCents: acc.openingBalanceCents,
      ledgerSumCents: ledgerSum,
      currentBalanceCents: current,
    });

    totalBalanceCents += current;
    if (acc.status !== "blocked") {
      totalAvailableCents += current;
    }
  }

  return { balances, totalBalanceCents, totalAvailableCents };
}
