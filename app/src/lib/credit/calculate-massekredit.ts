/**
 * Massekredit-Berechnung
 *
 * Berechnung gem. Vertragslogik (NICHT "frei zur Masse"):
 *
 * Massekredit Altforderungen =
 *   Altforderungszuflüsse (brutto)
 *   - Fortführungsbeitrag (z.B. 10%)
 *   - USt auf Fortführungsbeitrag (z.B. 19%)
 *   - USt auf Altforderungen (falls identifizierbar)
 *
 * WICHTIG: Diese Berechnung erfolgt zur Laufzeit aus den LedgerEntries.
 * Es wird KEIN MasseCreditDrawdown-Modell persistiert.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/db';
import {
  type MassekreditStatus,
  type AssumptionDoc,
  EstateAllocation,
} from '@/lib/types/allocation';

// =============================================================================
// TYPES
// =============================================================================

export interface BankMassekreditInput {
  bankAccountId: string;
  bankName: string;
  /** Fortführungsbeitrag Rate (z.B. 0.10 für 10%) - NULL wenn nicht vereinbart */
  contributionRate: Decimal | null;
  /** USt-Rate auf Fortführungsbeitrag (z.B. 0.19) - NULL wenn nicht vereinbart */
  contributionVatRate: Decimal | null;
  /** Massekredit-Cap in Cents - NULL wenn nicht vereinbart */
  creditCapCents: bigint | null;
  /** Ist die Vereinbarung unsicher? */
  isUncertain: boolean;
  /** Erklärung der Unsicherheit */
  uncertaintyNote: string | null;
}

export interface CaseMassekreditSummary {
  /** Berechnungen pro Bank */
  perBank: Map<string, MassekreditStatus>;

  /** Aggregiert über alle Banken */
  total: {
    altforderungenBruttoCents: bigint;
    fortfuehrungsbeitragCents: bigint;
    fortfuehrungsbeitragUstCents: bigint;
    massekreditAltforderungenCents: bigint;
    hasUncertainBanks: boolean;
  };

  /** Anzahl Buchungen ohne klare Zuordnung */
  unklarCount: number;

  /** Zeitstempel der Berechnung */
  calculatedAt: Date;
}

// =============================================================================
// MAIN CALCULATION FUNCTION
// =============================================================================

/**
 * Berechnet den Massekredit-Status für ein Bankkonto
 *
 * @param caseId - Case-ID
 * @param bankInput - Bank-Konfiguration mit Vereinbarungsdaten
 * @param asOfDate - Stichtag für die Berechnung (optional, default: now)
 */
export async function calculateMassekreditStatus(
  caseId: string,
  bankInput: BankMassekreditInput,
  asOfDate?: Date
): Promise<MassekreditStatus> {
  const assumptions: AssumptionDoc[] = [];

  // 1. Altforderungen brutto aus LedgerEntries
  const altforderungenBruttoCents = await sumAltforderungen(
    caseId,
    bankInput.bankAccountId,
    asOfDate
  );

  assumptions.push({
    field: 'Altforderungen brutto',
    assumption: formatCents(altforderungenBruttoCents),
    source: 'BERECHNET',
  });

  // 2. Fortführungsbeitrag berechnen
  let fortfuehrungsbeitragCents: bigint | null = null;
  let fortfuehrungsbeitragUstCents: bigint | null = null;

  if (bankInput.contributionRate !== null) {
    // Beitrag = Brutto * Rate
    const beitragDecimal = bankInput.contributionRate.times(altforderungenBruttoCents.toString());
    fortfuehrungsbeitragCents = BigInt(beitragDecimal.round().toString());

    assumptions.push({
      field: 'Fortführungsbeitrag',
      assumption: `${bankInput.contributionRate.times(100).toString()}% = ${formatCents(fortfuehrungsbeitragCents)}`,
      source: 'VERTRAG',
    });

    // USt auf Beitrag
    if (bankInput.contributionVatRate !== null) {
      const ustDecimal = bankInput.contributionVatRate.times(fortfuehrungsbeitragCents.toString());
      fortfuehrungsbeitragUstCents = BigInt(ustDecimal.round().toString());

      assumptions.push({
        field: 'USt auf Fortführungsbeitrag',
        assumption: `${bankInput.contributionVatRate.times(100).toString()}% = ${formatCents(fortfuehrungsbeitragUstCents)}`,
        source: 'VERTRAG',
      });
    }
  } else {
    assumptions.push({
      field: 'Fortführungsbeitrag',
      assumption: 'Nicht vereinbart',
      source: 'NICHT_VEREINBART',
    });
  }

  // 3. USt auf Altforderungen (optional - nur wenn im System identifizierbar)
  // Aktuell: Nicht implementiert, da Brutto-Beträge
  const ustAufAltforderungenCents: bigint | null = null;

  // 4. Massekredit berechnen
  const massekreditAltforderungenCents = calculateMassekreditNetto(
    altforderungenBruttoCents,
    fortfuehrungsbeitragCents,
    fortfuehrungsbeitragUstCents,
    ustAufAltforderungenCents
  );

  assumptions.push({
    field: 'Massekredit Altforderungen',
    assumption: formatCents(massekreditAltforderungenCents),
    source: 'BERECHNET',
  });

  // 5. Headroom berechnen (falls Cap vorhanden)
  let headroomCents: bigint | null = null;

  if (bankInput.creditCapCents !== null) {
    headroomCents = bankInput.creditCapCents - massekreditAltforderungenCents;

    assumptions.push({
      field: 'Cap',
      assumption: formatCents(bankInput.creditCapCents),
      source: 'VERTRAG',
    });

    assumptions.push({
      field: 'Headroom',
      assumption: formatCents(headroomCents),
      source: 'BERECHNET',
    });
  } else {
    assumptions.push({
      field: 'Cap',
      assumption: 'Nicht vereinbart',
      source: 'NICHT_VEREINBART',
    });
  }

  return {
    altforderungenBruttoCents,
    fortfuehrungsbeitragCents,
    fortfuehrungsbeitragUstCents,
    ustAufAltforderungenCents,
    massekreditAltforderungenCents,
    headroomCents,
    isUncertain: bankInput.isUncertain,
    uncertaintyNote: bankInput.uncertaintyNote,
    assumptions,
  };
}

/**
 * Berechnet den Massekredit-Status für alle Banken eines Cases
 */
export async function calculateCaseMassekreditSummary(
  caseId: string,
  bankInputs: BankMassekreditInput[],
  asOfDate?: Date
): Promise<CaseMassekreditSummary> {
  const perBank = new Map<string, MassekreditStatus>();

  // Pro Bank berechnen
  for (const bankInput of bankInputs) {
    const status = await calculateMassekreditStatus(caseId, bankInput, asOfDate);
    perBank.set(bankInput.bankAccountId, status);
  }

  // Aggregieren
  let totalAltforderungen = BigInt(0);
  let totalBeitrag = BigInt(0);
  let totalBeitragUst = BigInt(0);
  let totalMassekredit = BigInt(0);
  let hasUncertainBanks = false;

  for (const status of perBank.values()) {
    totalAltforderungen += status.altforderungenBruttoCents;
    totalBeitrag += status.fortfuehrungsbeitragCents ?? BigInt(0);
    totalBeitragUst += status.fortfuehrungsbeitragUstCents ?? BigInt(0);
    totalMassekredit += status.massekreditAltforderungenCents;

    if (status.isUncertain) {
      hasUncertainBanks = true;
    }
  }

  // Anzahl UNKLAR-Buchungen
  const unklarCount = await countUnklarEntries(caseId);

  return {
    perBank,
    total: {
      altforderungenBruttoCents: totalAltforderungen,
      fortfuehrungsbeitragCents: totalBeitrag,
      fortfuehrungsbeitragUstCents: totalBeitragUst,
      massekreditAltforderungenCents: totalMassekredit,
      hasUncertainBanks,
    },
    unklarCount,
    calculatedAt: new Date(),
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Summiert Altforderungen (Einnahmen mit estateAllocation ALTMASSE oder MIXED-Anteil)
 */
async function sumAltforderungen(
  caseId: string,
  bankAccountId: string,
  asOfDate?: Date
): Promise<bigint> {
  // Alle positiven Einträge (Einnahmen) für diese Bank mit Altmasse-Zuordnung
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      bankAccountId,
      valueType: 'IST',
      amountCents: { gt: 0 }, // Nur Einnahmen
      ...(asOfDate && { transactionDate: { lte: asOfDate } }),
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
    } else if (entry.estateAllocation === EstateAllocation.MIXED && entry.estateRatio) {
      // Bei MIXED: Nur Alt-Anteil (1 - neuRatio)
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
      valueType: 'IST',
      OR: [{ estateAllocation: EstateAllocation.UNKLAR }, { estateAllocation: null }],
    },
  });

  return count;
}

/**
 * Berechnet Massekredit netto
 *
 * Massekredit = Brutto - Beitrag - Beitrag-USt - USt
 */
function calculateMassekreditNetto(
  brutto: bigint,
  beitrag: bigint | null,
  beitragUst: bigint | null,
  ust: bigint | null
): bigint {
  let netto = brutto;

  if (beitrag !== null) {
    netto -= beitrag;
  }

  if (beitragUst !== null) {
    netto -= beitragUst;
  }

  if (ust !== null) {
    netto -= ust;
  }

  return netto;
}

/**
 * Formatiert Cents als Euro-Betrag
 */
function formatCents(cents: bigint): string {
  const euros = Number(cents) / 100;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(euros);
}

// =============================================================================
// BANK AGREEMENT LOADER
// =============================================================================

/**
 * Lädt BankAgreements und erstellt BankMassekreditInput-Array
 */
export async function loadBankMassekreditInputs(caseId: string): Promise<BankMassekreditInput[]> {
  const agreements = await prisma.bankAgreement.findMany({
    where: { caseId },
    include: {
      bankAccount: true,
    },
  });

  return agreements.map((agreement) => ({
    bankAccountId: agreement.bankAccountId,
    bankName: agreement.bankAccount.bankName,
    contributionRate: agreement.contributionRate,
    contributionVatRate: agreement.contributionVatRate,
    creditCapCents: agreement.creditCapCents,
    isUncertain: agreement.isUncertain,
    uncertaintyNote: agreement.uncertaintyNote,
  }));
}
