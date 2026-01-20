/**
 * Massekredit API Endpoint
 *
 * GET /api/cases/[id]/massekredit
 * Berechnet den aktuellen Massekredit-Status für alle Banken eines Cases.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { EstateAllocation } from "@/lib/types/allocation";

interface AssumptionDoc {
  field: string;
  assumption: string;
  source: "VERTRAG" | "BERECHNET" | "NICHT_VEREINBART";
}

/**
 * Formatiert Cents als Euro-String
 */
function formatCents(cents: bigint): string {
  const euros = Number(cents) / 100;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(euros);
}

/**
 * Summiert Altforderungen (Einnahmen mit estateAllocation ALTMASSE oder MIXED-Anteil)
 */
async function sumAltforderungen(
  caseId: string,
  bankAccountId: string
): Promise<bigint> {
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      bankAccountId,
      valueType: "IST",
      amountCents: { gt: 0 },
      OR: [
        { estateAllocation: EstateAllocation.ALTMASSE },
        { estateAllocation: EstateAllocation.MIXED },
      ],
    },
    select: {
      amountCents: true,
      estateAllocation: true,
      estateRatio: true,
    },
  });

  let total = BigInt(0);

  for (const entry of entries) {
    if (entry.estateAllocation === EstateAllocation.ALTMASSE) {
      total += entry.amountCents;
    } else if (
      entry.estateAllocation === EstateAllocation.MIXED &&
      entry.estateRatio
    ) {
      const altRatio = new Decimal(1).minus(entry.estateRatio);
      const altAmount = altRatio.times(entry.amountCents.toString());
      total += BigInt(altAmount.round().toString());
    }
  }

  return total;
}

/**
 * Zählt Buchungen ohne klare Alt/Neu-Zuordnung
 */
async function countUnklarEntries(caseId: string): Promise<number> {
  const count = await prisma.ledgerEntry.count({
    where: {
      caseId,
      valueType: "IST",
      OR: [
        { estateAllocation: EstateAllocation.UNKLAR },
        { estateAllocation: null },
      ],
    },
  });

  return count;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;

    // Prüfen ob Case existiert
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseData) {
      return NextResponse.json({ error: "Case nicht gefunden" }, { status: 404 });
    }

    // BankAgreements laden
    const agreements = await prisma.bankAgreement.findMany({
      where: { caseId },
      include: {
        bankAccount: true,
      },
    });

    if (agreements.length === 0) {
      return NextResponse.json(
        { error: "Keine Bankvereinbarungen konfiguriert" },
        { status: 404 }
      );
    }

    // Pro Bank Massekredit berechnen
    const perBank = await Promise.all(
      agreements.map(async (agreement) => {
        const assumptions: AssumptionDoc[] = [];

        // 1. Altforderungen brutto
        const altforderungenBruttoCents = await sumAltforderungen(
          caseId,
          agreement.bankAccountId
        );

        assumptions.push({
          field: "Altforderungen brutto",
          assumption: formatCents(altforderungenBruttoCents),
          source: "BERECHNET",
        });

        // 2. Fortführungsbeitrag
        let fortfuehrungsbeitragCents: bigint | null = null;
        let fortfuehrungsbeitragUstCents: bigint | null = null;

        if (agreement.contributionRate !== null) {
          const rate = new Decimal(agreement.contributionRate.toString());
          const beitrag = rate.times(altforderungenBruttoCents.toString());
          fortfuehrungsbeitragCents = BigInt(beitrag.round().toString());

          assumptions.push({
            field: "Fortführungsbeitrag",
            assumption: `${rate.times(100).toString()}% = ${formatCents(fortfuehrungsbeitragCents)}`,
            source: "VERTRAG",
          });

          if (agreement.contributionVatRate !== null) {
            const vatRate = new Decimal(agreement.contributionVatRate.toString());
            const ust = vatRate.times(fortfuehrungsbeitragCents.toString());
            fortfuehrungsbeitragUstCents = BigInt(ust.round().toString());

            assumptions.push({
              field: "USt auf Fortführungsbeitrag",
              assumption: `${vatRate.times(100).toString()}% = ${formatCents(fortfuehrungsbeitragUstCents)}`,
              source: "VERTRAG",
            });
          }
        } else {
          assumptions.push({
            field: "Fortführungsbeitrag",
            assumption: "Nicht vereinbart",
            source: "NICHT_VEREINBART",
          });
        }

        // 3. Massekredit berechnen
        let massekreditAltforderungenCents = altforderungenBruttoCents;
        if (fortfuehrungsbeitragCents !== null) {
          massekreditAltforderungenCents -= fortfuehrungsbeitragCents;
        }
        if (fortfuehrungsbeitragUstCents !== null) {
          massekreditAltforderungenCents -= fortfuehrungsbeitragUstCents;
        }

        assumptions.push({
          field: "Massekredit Altforderungen",
          assumption: formatCents(massekreditAltforderungenCents),
          source: "BERECHNET",
        });

        // 4. Headroom
        let headroomCents: bigint | null = null;
        if (agreement.creditCapCents !== null) {
          headroomCents = agreement.creditCapCents - massekreditAltforderungenCents;

          assumptions.push({
            field: "Cap",
            assumption: formatCents(agreement.creditCapCents),
            source: "VERTRAG",
          });

          assumptions.push({
            field: "Headroom",
            assumption: formatCents(headroomCents),
            source: "BERECHNET",
          });
        } else {
          assumptions.push({
            field: "Cap",
            assumption: "Nicht vereinbart",
            source: "NICHT_VEREINBART",
          });
        }

        return {
          bankAccountId: agreement.bankAccountId,
          bankName: agreement.bankAccount.bankName,
          agreementStatus: agreement.agreementStatus,
          hasGlobalAssignment: agreement.hasGlobalAssignment,
          status: {
            altforderungenBruttoCents: altforderungenBruttoCents.toString(),
            fortfuehrungsbeitragCents: fortfuehrungsbeitragCents?.toString() ?? null,
            fortfuehrungsbeitragUstCents: fortfuehrungsbeitragUstCents?.toString() ?? null,
            ustAufAltforderungenCents: null,
            massekreditAltforderungenCents: massekreditAltforderungenCents.toString(),
            headroomCents: headroomCents?.toString() ?? null,
            isUncertain: agreement.isUncertain,
            uncertaintyNote: agreement.uncertaintyNote,
            assumptions,
          },
        };
      })
    );

    // Aggregieren
    let totalAltforderungen = BigInt(0);
    let totalBeitrag = BigInt(0);
    let totalBeitragUst = BigInt(0);
    let totalMassekredit = BigInt(0);
    let hasUncertainBanks = false;

    for (const bank of perBank) {
      totalAltforderungen += BigInt(bank.status.altforderungenBruttoCents);
      if (bank.status.fortfuehrungsbeitragCents) {
        totalBeitrag += BigInt(bank.status.fortfuehrungsbeitragCents);
      }
      if (bank.status.fortfuehrungsbeitragUstCents) {
        totalBeitragUst += BigInt(bank.status.fortfuehrungsbeitragUstCents);
      }
      totalMassekredit += BigInt(bank.status.massekreditAltforderungenCents);
      if (bank.status.isUncertain) {
        hasUncertainBanks = true;
      }
    }

    // Anzahl UNKLAR-Buchungen
    const unklarCount = await countUnklarEntries(caseId);

    return NextResponse.json({
      perBank,
      total: {
        altforderungenBruttoCents: totalAltforderungen.toString(),
        fortfuehrungsbeitragCents: totalBeitrag.toString(),
        fortfuehrungsbeitragUstCents: totalBeitragUst.toString(),
        massekreditAltforderungenCents: totalMassekredit.toString(),
        hasUncertainBanks,
      },
      unklarCount,
      calculatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Massekredit API Fehler:", error);
    const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler";
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      {
        error: "Interner Serverfehler",
        details: errorMessage,
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}
