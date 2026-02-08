import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { calculateBankAccountBalances } from "@/lib/bank-accounts/calculate-balances";

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

    // Lade BankAccounts mit Location-Relation
    const accounts = await prisma.bankAccount.findMany({
      where: { caseId },
      include: {
        location: { select: { id: true, name: true } },
      },
      orderBy: { displayOrder: "asc" },
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

    // Response mit allen Details
    const result = accounts.map((acc) => {
      const balance = balanceData.balances.get(acc.id);
      return {
        id: acc.id,
        bankName: acc.bankName,
        accountName: acc.accountName,
        iban: acc.iban,
        status: acc.status,
        location: acc.location
          ? { id: acc.location.id, name: acc.location.name }
          : null,
        openingBalanceCents: acc.openingBalanceCents.toString(),
        ledgerSumCents: balance?.ledgerSumCents.toString() ?? "0",
        currentBalanceCents:
          balance?.currentBalanceCents.toString() ?? acc.openingBalanceCents.toString(),
      };
    });

    return NextResponse.json({
      accounts: result,
      summary: {
        totalBalanceCents: balanceData.totalBalanceCents.toString(),
        totalAvailableCents: balanceData.totalAvailableCents.toString(),
        accountCount: accounts.length,
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
