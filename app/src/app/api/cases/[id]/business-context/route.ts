/**
 * Business-Context API Endpoint
 *
 * GET /api/cases/[id]/business-context
 * Aggregiert alle fallspezifischen Geschäftsdaten für die Business-Logic-Seiten.
 * Keine Ledger-Berechnungen — nur Stammdaten und Konfiguration.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCaseConfig } from "@/lib/cases/registry";
import type {
  BusinessContextResponse,
  BankAccountContext,
  BankAgreementContext,
  LocationContext,
  EmployeeContext,
  SettlementRuleContext,
  SplitRuleContext,
  PaymentFlowContext,
  ContactContext,
  OpenIssueContext,
  MassekreditSummaryContext,
  MassekreditBankContext,
} from "@/lib/types/business-context";

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

    // Case laden
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseData) {
      return NextResponse.json(
        { error: "Fall nicht gefunden" },
        { status: 404 }
      );
    }

    // Parallele Queries
    const [
      bankAccounts,
      bankAgreements,
      locations,
      employees,
      counterparties,
      contacts,
      ivNotes,
    ] = await Promise.all([
      prisma.bankAccount.findMany({
        where: { caseId },
        include: { location: true },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.bankAgreement.findMany({
        where: { caseId },
        include: { bankAccount: true },
      }),
      prisma.location.findMany({
        where: { caseId },
        include: { bankAccounts: { select: { id: true } } },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.employee.findMany({
        where: { caseId, isActive: true },
        include: { location: true },
        orderBy: [{ location: { displayOrder: "asc" } }, { lastName: "asc" }],
      }),
      prisma.counterparty.findMany({
        where: { caseId, isTopPayer: true },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.caseContact.findMany({
        where: { caseId },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.iVNote.findMany({
        where: {
          caseId,
          status: { not: "ERLEDIGT" },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Case-Config laden (Settlement Rules aus config.ts)
    const caseConfig = getCaseConfig(caseData.caseNumber);

    // Response zusammenbauen
    const response: BusinessContextResponse = {
      caseMetadata: {
        id: caseData.id,
        caseNumber: caseData.caseNumber,
        debtorName: caseData.debtorName,
        courtName: caseData.courtName,
        openingDate: caseData.openingDate?.toISOString() ?? null,
        cutoffDate: caseData.cutoffDate?.toISOString() ?? null,
        status: caseData.status,
      },

      locations: locations.map(
        (loc): LocationContext => ({
          id: loc.id,
          name: loc.name,
          shortName: loc.shortName,
          address: loc.address,
          displayOrder: loc.displayOrder,
          bankAccountIds: loc.bankAccounts.map((ba) => ba.id),
        })
      ),

      bankAccounts: bankAccounts.map(
        (ba): BankAccountContext => ({
          id: ba.id,
          bankName: ba.bankName,
          accountName: ba.accountName,
          iban: ba.iban,
          accountType: ba.accountType,
          isLiquidityRelevant: ba.isLiquidityRelevant,
          status: ba.status,
          locationId: ba.locationId,
          locationName: ba.location?.name ?? null,
          displayOrder: ba.displayOrder,
        })
      ),

      bankAgreements: bankAgreements.map(
        (ag): BankAgreementContext => ({
          id: ag.id,
          bankAccountId: ag.bankAccountId,
          bankName: ag.bankAccount.bankName,
          agreementStatus: ag.agreementStatus,
          agreementDate: ag.agreementDate?.toISOString() ?? null,
          agreementNote: ag.agreementNote,
          hasGlobalAssignment: ag.hasGlobalAssignment,
          contributionRate: ag.contributionRate
            ? Number(ag.contributionRate)
            : null,
          contributionVatRate: ag.contributionVatRate
            ? Number(ag.contributionVatRate)
            : null,
          creditCapCents: ag.creditCapCents?.toString() ?? null,
          isUncertain: ag.isUncertain,
          uncertaintyNote: ag.uncertaintyNote,
        })
      ),

      employees: employees.map(
        (emp): EmployeeContext => ({
          id: emp.id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          role: emp.role,
          lanr: emp.lanr,
          locationId: emp.locationId,
          locationName: emp.location?.name ?? null,
          isActive: emp.isActive,
        })
      ),

      settlementRules: caseConfig
        ? Object.entries(caseConfig.settlers).map(
            ([key, settler]): SettlementRuleContext => ({
              key,
              name: settler.name,
              rhythm: settler.rhythm,
              lagDays: settler.lagDays,
              requiresServiceDate: settler.requiresServiceDate,
              fallbackRule: settler.fallbackRule,
              splitRules: settler.splitRules
                ? Object.entries(settler.splitRules).map(
                    ([periodKey, rule]): SplitRuleContext => ({
                      periodKey,
                      altRatio: rule.altRatio,
                      neuRatio: rule.neuRatio,
                      source: rule.source,
                      note: rule.note,
                    })
                  )
                : [],
              legalReference: caseConfig.legalReferences?.[key],
            })
          )
        : [],

      paymentFlows: locations.map((loc): PaymentFlowContext => {
        const iskAccount = bankAccounts.find(
          (ba) =>
            ba.locationId === loc.id &&
            ba.isLiquidityRelevant &&
            ba.accountType === "ISK"
        );
        const locationTopPayers = counterparties
          .filter((cp) => cp.isTopPayer)
          .map((cp) => cp.name);

        return {
          locationId: loc.id,
          locationName: loc.name,
          iskAccountId: iskAccount?.id ?? null,
          iskAccountName: iskAccount?.accountName ?? null,
          iskBankName: iskAccount?.bankName ?? null,
          iskIban: iskAccount?.iban ?? null,
          topPayers: locationTopPayers,
        };
      }),

      contacts: contacts.map(
        (c): ContactContext => ({
          id: c.id,
          role: c.role,
          name: c.name,
          organization: c.organization,
          email: c.email,
          phone: c.phone,
          displayOrder: c.displayOrder,
        })
      ),

      openIssues: ivNotes.map(
        (note): OpenIssueContext => ({
          id: note.id,
          content: note.content,
          status: note.status,
          priority: note.priority,
          author: note.author,
          createdAt: note.createdAt.toISOString(),
        })
      ),

      massekreditSummary: buildMassekreditSummary(bankAgreements),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Business-Context API Fehler:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json(
      { error: "Interner Serverfehler", details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Baut die Massekredit-Zusammenfassung aus BankAgreements.
 * Nur Vertragsdaten — keine Ledger-Berechnungen.
 */
function buildMassekreditSummary(
  agreements: Array<{
    agreementStatus: string;
    creditCapCents: bigint | null;
    contributionRate: unknown;
    contributionVatRate: unknown;
    bankAccount: { bankName: string };
  }>
): MassekreditSummaryContext | null {
  if (agreements.length === 0) return null;

  let totalCapCents = BigInt(0);
  const banks: MassekreditBankContext[] = [];

  for (const ag of agreements) {
    if (ag.creditCapCents !== null) {
      totalCapCents += ag.creditCapCents;
    }

    banks.push({
      bankName: ag.bankAccount.bankName,
      agreementStatus: ag.agreementStatus,
      creditCapCents: ag.creditCapCents?.toString() ?? null,
      contributionRate: ag.contributionRate ? Number(ag.contributionRate) : null,
      contributionVatRate: ag.contributionVatRate
        ? Number(ag.contributionVatRate)
        : null,
    });
  }

  return {
    totalCapCents: totalCapCents.toString(),
    banks,
  };
}
