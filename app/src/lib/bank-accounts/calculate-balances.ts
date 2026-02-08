import prisma from "@/lib/db";
import type { LiquidityScope } from "@/lib/ledger/aggregation";

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

/**
 * Berechnet Opening Balance für einen gegebenen Scope.
 *
 * Logik:
 * - GLOBAL: Summe ALLER BankAccounts (inkl. zentrale Konten mit locationId=null)
 * - LOCATION_VELBERT: Summe BankAccounts mit locationId='loc-haevg-velbert'
 * - LOCATION_UCKERATH_EITORF: Summe BankAccounts mit locationId in ['loc-haevg-uckerath', 'loc-haevg-eitorf']
 *
 * Zentrale Konten (locationId=null) werden NUR in GLOBAL gezählt.
 *
 * @param caseId - Case ID
 * @param scope - LiquidityScope (GLOBAL, LOCATION_VELBERT, LOCATION_UCKERATH_EITORF)
 * @returns Opening Balance in Cents für den gegebenen Scope
 */
export async function calculateOpeningBalanceByScope(
  caseId: string,
  scope: LiquidityScope
): Promise<bigint> {
  // Mapping: Scope → Location IDs
  const SCOPE_LOCATION_IDS: Record<Exclude<LiquidityScope, "GLOBAL">, string[]> = {
    LOCATION_VELBERT: ["loc-haevg-velbert"],
    LOCATION_UCKERATH_EITORF: ["loc-haevg-uckerath", "loc-haevg-eitorf"],
  };

  if (scope === "GLOBAL") {
    // GLOBAL: Alle Konten (inkl. zentrale mit locationId=null)
    const accounts = await prisma.bankAccount.findMany({
      where: { caseId },
      select: { openingBalanceCents: true },
    });

    return accounts.reduce((sum, acc) => sum + acc.openingBalanceCents, BigInt(0));
  } else {
    // Location-spezifisch: Nur Konten mit matching locationId
    const allowedLocationIds = SCOPE_LOCATION_IDS[scope];

    const accounts = await prisma.bankAccount.findMany({
      where: {
        caseId,
        locationId: { in: allowedLocationIds },
      },
      select: { openingBalanceCents: true },
    });

    return accounts.reduce((sum, acc) => sum + acc.openingBalanceCents, BigInt(0));
  }
}
