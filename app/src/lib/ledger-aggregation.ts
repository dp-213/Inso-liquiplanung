/**
 * LedgerEntry Aggregation Engine
 *
 * Aggregiert LedgerEntry-Daten für Dashboard-Anzeige.
 * LedgerEntry ist die Single Source of Truth für alle Cash-Transaktionen.
 *
 * Aggregations-Logik:
 * - Gruppiert nach Periode (Woche oder Monat basierend auf transactionDate)
 * - Trennt nach legalBucket (MASSE, ABSONDERUNG, NEUTRAL)
 * - Trennt nach flowType (INFLOW wenn amountCents > 0, OUTFLOW wenn < 0)
 * - Unterstützt IST/PLAN Filterung
 */

import prisma from "@/lib/db";

// =============================================================================
// TYPES
// =============================================================================

export type LegalBucket = "MASSE" | "ABSONDERUNG" | "NEUTRAL" | "UNKNOWN";
export type FlowType = "INFLOW" | "OUTFLOW";
export type ValueType = "IST" | "PLAN";
export type PeriodType = "WEEKLY" | "MONTHLY";
export type ReviewStatus = "UNREVIEWED" | "CONFIRMED" | "ADJUSTED";
export type EstateAllocation = "ALTMASSE" | "NEUMASSE" | "MIXED" | "UNKLAR";

export interface PeriodAggregation {
  periodIndex: number;
  periodLabel: string;
  periodStartDate: Date;
  periodEndDate: Date;
  openingBalanceCents: bigint;
  closingBalanceCents: bigint;
  // Nach legalBucket getrennt
  masseInflowsCents: bigint;
  masseOutflowsCents: bigint;
  absonderungInflowsCents: bigint;
  absonderungOutflowsCents: bigint;
  neutralInflowsCents: bigint;
  neutralOutflowsCents: bigint;
  unknownInflowsCents: bigint;
  unknownOutflowsCents: bigint;
  // Nach estateAllocation getrennt (Alt/Neu-Masse)
  // WICHTIG: Diese Werte kommen aus estateAllocation, NICHT aus legalBucket!
  altmasseInflowsCents: bigint;
  altmasseOutflowsCents: bigint;
  neumasseInflowsCents: bigint;
  neumasseOutflowsCents: bigint;
  unklarInflowsCents: bigint;   // UNKLAR-Buchungen - NICHT in Alt/Neu verteilt!
  unklarOutflowsCents: bigint;
  // Summen
  totalInflowsCents: bigint;
  totalOutflowsCents: bigint;
  netCashflowCents: bigint;
}

export interface CategoryAggregation {
  categoryName: string;
  legalBucket: LegalBucket;
  flowType: FlowType;
  totalCents: bigint;
  periodTotals: bigint[];
  entries: {
    id: string;
    description: string;
    amountCents: bigint;
    periodIndex: number;
    counterpartyName?: string;
    locationName?: string;
    bankAccountName?: string;
    reviewStatus: ReviewStatus;
    valueType: ValueType;
  }[];
}

export interface AggregationResult {
  caseId: string;
  openingBalanceCents: bigint;
  periodType: PeriodType;
  periodCount: number;
  planStartDate: Date;
  periods: PeriodAggregation[];
  categories: CategoryAggregation[];
  // Summen
  totalInflowsCents: bigint;
  totalOutflowsCents: bigint;
  totalNetCashflowCents: bigint;
  finalClosingBalanceCents: bigint;
  // Nach legalBucket (für rechtliche Klassifikation)
  totalMasseInflowsCents: bigint;
  totalMasseOutflowsCents: bigint;
  totalAbsonderungInflowsCents: bigint;
  totalAbsonderungOutflowsCents: bigint;
  totalNeutralInflowsCents: bigint;
  totalNeutralOutflowsCents: bigint;
  // Nach estateAllocation (Alt/Neu-Masse aus Leistungsdatum!)
  // WICHTIG: legalBucket hat KEINEN Einfluss auf diese Werte!
  totalAltmasseInflowsCents: bigint;
  totalAltmasseOutflowsCents: bigint;
  totalNeumasseInflowsCents: bigint;
  totalNeumasseOutflowsCents: bigint;
  totalUnklarInflowsCents: bigint;   // UNKLAR - NICHT verteilt!
  totalUnklarOutflowsCents: bigint;
  // Statistiken
  entryCount: number;
  confirmedCount: number;
  unreviewedCount: number;
  istCount: number;
  planCount: number;
  unklarCount: number;  // Anzahl UNKLAR-Buchungen
  // Warnungen
  warnings: AggregationWarning[];
  // Metadata
  dataHash: string;
  calculatedAt: Date;
}

export interface AggregationWarning {
  type: "UNKLAR_ENTRIES" | "MISSING_SERVICE_DATE";
  severity: "info" | "warning" | "error";
  message: string;
  count: number;
  totalCents: bigint;
}

// Scope-Typen für standortspezifische Filterung (aus matrix-config importiert)
export type LiquidityScope = "GLOBAL" | "LOCATION_VELBERT" | "LOCATION_UCKERATH_EITORF";

// Location-IDs für Standort-Scopes
const SCOPE_LOCATION_IDS: Record<Exclude<LiquidityScope, "GLOBAL">, string[]> = {
  LOCATION_VELBERT: ["loc-haevg-velbert"],
  LOCATION_UCKERATH_EITORF: ["loc-haevg-uckerath", "loc-haevg-eitorf"],
};

// Patterns für zentrale Verfahrenskosten (ohne Standortbezug)
const CENTRAL_PROCEDURE_COST_PATTERNS = [
  /verfahrenskosten/i,
  /insolvenzverwalter/i,
  /gerichtskosten/i,
  /gutachter/i,
  /rechtsanwalt.*insolvenz/i,
  /steuerberater.*verfahren/i,
  /zentral.*beratung/i,
  /unternehmensberater/i,
  /fortführungsbeitrag/i,
];

export interface AggregationOptions {
  valueTypes?: ValueType[]; // Wenn leer/undefined: beide
  reviewStatuses?: ReviewStatus[]; // Wenn leer/undefined: nur CONFIRMED + ADJUSTED
  includeSuggested?: boolean; // Für UNREVIEWED: suggestedLegalBucket verwenden
  scope?: LiquidityScope; // Standortspezifische Filterung (Default: GLOBAL)
  excludeSteeringTags?: string[]; // Filtere Einträge mit diesen steeringTags aus (z.B. ['INTERNE_UMBUCHUNG'])
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Berechne ISO-Wochennummer
 */
function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

/**
 * Generiere Perioden-Label
 */
function generatePeriodLabel(
  periodType: PeriodType,
  periodIndex: number,
  startDate: Date
): string {
  if (periodType === "WEEKLY") {
    const weekDate = new Date(startDate);
    weekDate.setDate(weekDate.getDate() + periodIndex * 7);
    return `KW ${getISOWeek(weekDate).toString().padStart(2, "0")}`;
  } else {
    const monthDate = new Date(startDate);
    monthDate.setMonth(monthDate.getMonth() + periodIndex);
    const monthNames = ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    const year = monthDate.getFullYear().toString().slice(-2);
    return `${monthNames[monthDate.getMonth()]} ${year}`;
  }
}

/**
 * Berechne Perioden-Datumsbereich
 */
function getPeriodDates(
  periodType: PeriodType,
  periodIndex: number,
  planStartDate: Date
): { start: Date; end: Date } {
  if (periodType === "WEEKLY") {
    const start = new Date(planStartDate);
    start.setDate(start.getDate() + periodIndex * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end };
  } else {
    const start = new Date(planStartDate);
    start.setMonth(start.getMonth() + periodIndex);
    start.setDate(1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    return { start, end };
  }
}

/**
 * Bestimme Period-Index für ein Datum
 */
function getPeriodIndex(
  transactionDate: Date,
  planStartDate: Date,
  periodType: PeriodType
): number {
  const txDate = new Date(transactionDate);
  const startDate = new Date(planStartDate);

  if (periodType === "WEEKLY") {
    const diffTime = txDate.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7);
  } else {
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const txYear = txDate.getFullYear();
    const txMonth = txDate.getMonth();
    return (txYear - startYear) * 12 + (txMonth - startMonth);
  }
}

/**
 * Berechne Hash für Datenintegrität
 */
function calculateDataHash(entries: { id: string; amountCents: bigint }[], openingBalance: bigint): string {
  const sortedEntries = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  const parts = [`opening:${openingBalance.toString()}`];
  for (const e of sortedEntries) {
    parts.push(`${e.id}:${e.amountCents.toString()}`);
  }
  // Einfacher Hash (für Production: crypto.createHash verwenden)
  let hash = 0;
  const str = parts.join("|");
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

// =============================================================================
// MAIN AGGREGATION FUNCTION
// =============================================================================

/**
 * Aggregiert LedgerEntry-Daten für ein Case
 */
export async function aggregateLedgerEntries(
  caseId: string,
  planStartDate: Date,
  periodType: PeriodType,
  periodCount: number,
  openingBalanceCents: bigint,
  options: AggregationOptions = {}
): Promise<AggregationResult> {
  const calculatedAt = new Date();

  // Default: Nur bestätigte Einträge verwenden
  const reviewStatuses = options.reviewStatuses || ["CONFIRMED", "ADJUSTED"];

  // Lade LedgerEntry für den Case
  const allEntries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      reviewStatus: { in: reviewStatuses },
      ...(options.valueTypes?.length ? { valueType: { in: options.valueTypes } } : {}),
      ...(options.excludeSteeringTags?.length
        ? {
            OR: [
              { steeringTag: null },
              { steeringTag: { notIn: options.excludeSteeringTags } },
            ],
          }
        : {}),
    },
    include: {
      counterparty: { select: { name: true } },
      location: { select: { id: true, name: true } },
      bankAccount: { select: { accountName: true } },
    },
    orderBy: { transactionDate: "asc" },
  });

  // Scope-Filterung (WICHTIG: VOR der Aggregation!)
  const scope = options.scope || "GLOBAL";
  const entries = scope === "GLOBAL"
    ? allEntries
    : allEntries.filter((entry) => {
        // Zentrale Verfahrenskosten in Standort-Scopes ausschließen
        const isCentral =
          !entry.location?.id &&
          (entry.legalBucket === "ABSONDERUNG" ||
            CENTRAL_PROCEDURE_COST_PATTERNS.some((p) => p.test(entry.description)));
        if (isCentral) return false;

        // Nur Entries des Standorts durchlassen
        if (!entry.location?.id) return false;

        const allowedLocationIds = SCOPE_LOCATION_IDS[scope as Exclude<LiquidityScope, "GLOBAL">];
        return allowedLocationIds.includes(entry.location.id.toLowerCase());
      });

  // Debug-Logging
  console.log(`[Ledger Aggregation] Scope: ${scope}, All Entries: ${allEntries.length}, Filtered: ${entries.length}`);

  // Initialisiere Perioden
  const periods: PeriodAggregation[] = [];
  let currentOpeningBalance = openingBalanceCents;

  for (let i = 0; i < periodCount; i++) {
    const { start, end } = getPeriodDates(periodType, i, planStartDate);
    periods.push({
      periodIndex: i,
      periodLabel: generatePeriodLabel(periodType, i, planStartDate),
      periodStartDate: start,
      periodEndDate: end,
      openingBalanceCents: currentOpeningBalance,
      closingBalanceCents: BigInt(0), // Wird später berechnet
      // legalBucket-basiert (rechtliche Klassifikation)
      masseInflowsCents: BigInt(0),
      masseOutflowsCents: BigInt(0),
      absonderungInflowsCents: BigInt(0),
      absonderungOutflowsCents: BigInt(0),
      neutralInflowsCents: BigInt(0),
      neutralOutflowsCents: BigInt(0),
      unknownInflowsCents: BigInt(0),
      unknownOutflowsCents: BigInt(0),
      // estateAllocation-basiert (Alt/Neu aus Leistungsdatum!)
      altmasseInflowsCents: BigInt(0),
      altmasseOutflowsCents: BigInt(0),
      neumasseInflowsCents: BigInt(0),
      neumasseOutflowsCents: BigInt(0),
      unklarInflowsCents: BigInt(0),
      unklarOutflowsCents: BigInt(0),
      // Summen
      totalInflowsCents: BigInt(0),
      totalOutflowsCents: BigInt(0),
      netCashflowCents: BigInt(0),
    });
  }

  // Kategorien-Map für Gruppierung
  const categoryMap = new Map<string, CategoryAggregation>();

  // Statistiken
  let confirmedCount = 0;
  let unreviewedCount = 0;
  let istCount = 0;
  let planCount = 0;
  let unklarCount = 0;
  let totalUnklarCents = BigInt(0);

  // Verarbeite jeden Eintrag
  for (const entry of entries) {
    const periodIndex = getPeriodIndex(entry.transactionDate, planStartDate, periodType);

    // Nur Einträge innerhalb des Planungszeitraums
    if (periodIndex < 0 || periodIndex >= periodCount) continue;

    const period = periods[periodIndex];
    const amount = entry.amountCents;
    const isInflow = amount > BigInt(0);
    const absAmount = amount < BigInt(0) ? -amount : amount;

    // Bestimme legalBucket (für rechtliche Klassifikation)
    let bucket: LegalBucket = entry.legalBucket as LegalBucket;
    if (bucket === "UNKNOWN" && options.includeSuggested && entry.suggestedLegalBucket) {
      bucket = entry.suggestedLegalBucket as LegalBucket;
    }

    // Aggregiere nach legalBucket (rechtliche Klassifikation)
    if (isInflow) {
      period.totalInflowsCents += absAmount;
      switch (bucket) {
        case "MASSE": period.masseInflowsCents += absAmount; break;
        case "ABSONDERUNG": period.absonderungInflowsCents += absAmount; break;
        case "NEUTRAL": period.neutralInflowsCents += absAmount; break;
        default: period.unknownInflowsCents += absAmount;
      }
    } else {
      period.totalOutflowsCents += absAmount;
      switch (bucket) {
        case "MASSE": period.masseOutflowsCents += absAmount; break;
        case "ABSONDERUNG": period.absonderungOutflowsCents += absAmount; break;
        case "NEUTRAL": period.neutralOutflowsCents += absAmount; break;
        default: period.unknownOutflowsCents += absAmount;
      }
    }

    // =========================================================================
    // WICHTIG: Alt/Neu-Zuordnung aus estateAllocation (NICHT aus legalBucket!)
    // =========================================================================
    const allocation = entry.estateAllocation as EstateAllocation | null;
    const estateRatio = entry.estateRatio ? Number(entry.estateRatio) : null;

    if (allocation === "ALTMASSE") {
      // 100% Altmasse
      if (isInflow) {
        period.altmasseInflowsCents += absAmount;
      } else {
        period.altmasseOutflowsCents += absAmount;
      }
    } else if (allocation === "NEUMASSE") {
      // 100% Neumasse
      if (isInflow) {
        period.neumasseInflowsCents += absAmount;
      } else {
        period.neumasseOutflowsCents += absAmount;
      }
    } else if (allocation === "MIXED" && estateRatio !== null) {
      // MIXED: Split nach estateRatio
      // estateRatio = Anteil NEUMASSE (0.0 - 1.0)
      const neumasseAmount = BigInt(Math.round(Number(absAmount) * estateRatio));
      const altmasseAmount = absAmount - neumasseAmount;

      if (isInflow) {
        period.altmasseInflowsCents += altmasseAmount;
        period.neumasseInflowsCents += neumasseAmount;
      } else {
        period.altmasseOutflowsCents += altmasseAmount;
        period.neumasseOutflowsCents += neumasseAmount;
      }
    } else {
      // UNKLAR oder null: NICHT verteilen, separat tracken!
      unklarCount++;
      totalUnklarCents += absAmount;
      if (isInflow) {
        period.unklarInflowsCents += absAmount;
      } else {
        period.unklarOutflowsCents += absAmount;
      }
    }

    // Kategorisiere für Detail-Anzeige
    const categoryKey = `${bucket}:${isInflow ? "INFLOW" : "OUTFLOW"}`;
    if (!categoryMap.has(categoryKey)) {
      categoryMap.set(categoryKey, {
        categoryName: bucket === "UNKNOWN" ? "Nicht klassifiziert" : bucket,
        legalBucket: bucket,
        flowType: isInflow ? "INFLOW" : "OUTFLOW",
        totalCents: BigInt(0),
        periodTotals: new Array(periodCount).fill(BigInt(0)),
        entries: [],
      });
    }

    const category = categoryMap.get(categoryKey)!;
    category.totalCents += absAmount;
    category.periodTotals[periodIndex] += absAmount;
    category.entries.push({
      id: entry.id,
      description: entry.description,
      amountCents: amount,
      periodIndex,
      counterpartyName: entry.counterparty?.name,
      locationName: entry.location?.name,
      bankAccountName: entry.bankAccount?.accountName,
      reviewStatus: entry.reviewStatus as ReviewStatus,
      valueType: entry.valueType as ValueType,
    });

    // Statistiken
    if (entry.reviewStatus === "CONFIRMED" || entry.reviewStatus === "ADJUSTED") confirmedCount++;
    if (entry.reviewStatus === "UNREVIEWED") unreviewedCount++;
    if (entry.valueType === "IST") istCount++;
    if (entry.valueType === "PLAN") planCount++;
  }

  // Berechne Closing-Balances
  for (let i = 0; i < periodCount; i++) {
    const period = periods[i];
    period.netCashflowCents = period.totalInflowsCents - period.totalOutflowsCents;
    period.closingBalanceCents = period.openingBalanceCents + period.netCashflowCents;

    // Propagiere zum nächsten Period
    if (i < periodCount - 1) {
      periods[i + 1].openingBalanceCents = period.closingBalanceCents;
    }
  }

  // Gesamtsummen (legalBucket)
  const totalInflowsCents = periods.reduce((sum, p) => sum + p.totalInflowsCents, BigInt(0));
  const totalOutflowsCents = periods.reduce((sum, p) => sum + p.totalOutflowsCents, BigInt(0));
  const totalMasseInflowsCents = periods.reduce((sum, p) => sum + p.masseInflowsCents, BigInt(0));
  const totalMasseOutflowsCents = periods.reduce((sum, p) => sum + p.masseOutflowsCents, BigInt(0));
  const totalAbsonderungInflowsCents = periods.reduce((sum, p) => sum + p.absonderungInflowsCents, BigInt(0));
  const totalAbsonderungOutflowsCents = periods.reduce((sum, p) => sum + p.absonderungOutflowsCents, BigInt(0));
  const totalNeutralInflowsCents = periods.reduce((sum, p) => sum + p.neutralInflowsCents, BigInt(0));
  const totalNeutralOutflowsCents = periods.reduce((sum, p) => sum + p.neutralOutflowsCents, BigInt(0));

  // Gesamtsummen (estateAllocation - Alt/Neu)
  const totalAltmasseInflowsCents = periods.reduce((sum, p) => sum + p.altmasseInflowsCents, BigInt(0));
  const totalAltmasseOutflowsCents = periods.reduce((sum, p) => sum + p.altmasseOutflowsCents, BigInt(0));
  const totalNeumasseInflowsCents = periods.reduce((sum, p) => sum + p.neumasseInflowsCents, BigInt(0));
  const totalNeumasseOutflowsCents = periods.reduce((sum, p) => sum + p.neumasseOutflowsCents, BigInt(0));
  const totalUnklarInflowsCents = periods.reduce((sum, p) => sum + p.unklarInflowsCents, BigInt(0));
  const totalUnklarOutflowsCents = periods.reduce((sum, p) => sum + p.unklarOutflowsCents, BigInt(0));

  // Warnungen generieren
  const warnings: AggregationWarning[] = [];

  if (unklarCount > 0) {
    warnings.push({
      type: "UNKLAR_ENTRIES",
      severity: "warning",
      message: `${unklarCount} Buchung${unklarCount === 1 ? "" : "en"} ohne Alt/Neu-Zuordnung (${formatCentsForWarning(totalUnklarCents)}). Diese Beträge sind NICHT in den Alt/Neu-Summen enthalten.`,
      count: unklarCount,
      totalCents: totalUnklarCents,
    });
  }

  const dataHash = calculateDataHash(
    entries.map((e) => ({ id: e.id, amountCents: e.amountCents })),
    openingBalanceCents
  );

  return {
    caseId,
    openingBalanceCents,
    periodType,
    periodCount,
    planStartDate,
    periods,
    categories: Array.from(categoryMap.values()).sort((a, b) => {
      // Sortiere: MASSE vor ABSONDERUNG vor NEUTRAL vor UNKNOWN, dann INFLOW vor OUTFLOW
      const bucketOrder = { MASSE: 0, ABSONDERUNG: 1, NEUTRAL: 2, UNKNOWN: 3 };
      const flowOrder = { INFLOW: 0, OUTFLOW: 1 };
      const bucketDiff = bucketOrder[a.legalBucket] - bucketOrder[b.legalBucket];
      if (bucketDiff !== 0) return bucketDiff;
      return flowOrder[a.flowType] - flowOrder[b.flowType];
    }),
    totalInflowsCents,
    totalOutflowsCents,
    totalNetCashflowCents: totalInflowsCents - totalOutflowsCents,
    finalClosingBalanceCents: periods[periodCount - 1]?.closingBalanceCents ?? openingBalanceCents,
    // legalBucket-Summen
    totalMasseInflowsCents,
    totalMasseOutflowsCents,
    totalAbsonderungInflowsCents,
    totalAbsonderungOutflowsCents,
    totalNeutralInflowsCents,
    totalNeutralOutflowsCents,
    // estateAllocation-Summen (Alt/Neu)
    totalAltmasseInflowsCents,
    totalAltmasseOutflowsCents,
    totalNeumasseInflowsCents,
    totalNeumasseOutflowsCents,
    totalUnklarInflowsCents,
    totalUnklarOutflowsCents,
    // Statistiken
    entryCount: entries.length,
    confirmedCount,
    unreviewedCount,
    istCount,
    planCount,
    unklarCount,
    // Warnungen
    warnings,
    // Metadata
    dataHash,
    calculatedAt,
  };
}

/**
 * Hilfsfunktion: Formatiere Cents für Warnungen
 */
function formatCentsForWarning(cents: bigint): string {
  const euros = Number(cents) / 100;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(euros);
}

// =============================================================================
// CONVERSION TO LEGACY FORMAT
// =============================================================================

/**
 * Konvertiert AggregationResult zum Legacy-Format für Abwärtskompatibilität
 * mit bestehenden Dashboard-Komponenten
 *
 * WICHTIG: Alt/Neu-Werte kommen aus estateAllocation (Leistungsdatum),
 * NICHT aus legalBucket!
 */
export function convertToLegacyFormat(result: AggregationResult): {
  weeks: {
    weekOffset: number;
    weekLabel: string;
    weekStartDate: string;
    weekEndDate: string;
    openingBalanceCents: string;
    totalInflowsCents: string;
    totalOutflowsCents: string;
    netCashflowCents: string;
    closingBalanceCents: string;
    // Alt/Neu aus estateAllocation (NICHT aus legalBucket!)
    inflowsAltmasseCents: string;
    inflowsNeumasseCents: string;
    outflowsAltmasseCents: string;
    outflowsNeumasseCents: string;
    // UNKLAR - NICHT in Alt/Neu verteilt!
    inflowsUnklarCents: string;
    outflowsUnklarCents: string;
  }[];
  categories: {
    categoryName: string;
    flowType: string;
    estateType: string;  // Deprecated - nur für Abwärtskompatibilität
    totalCents: string;
    weeklyTotals: string[];
    lines: {
      lineName: string;
      totalCents: string;
      weeklyValues: { weekOffset: number; effectiveCents: string }[];
    }[];
  }[];
  // Gesamtsummen Alt/Neu
  totalAltmasseInflowsCents: string;
  totalAltmasseOutflowsCents: string;
  totalNeumasseInflowsCents: string;
  totalNeumasseOutflowsCents: string;
  totalUnklarInflowsCents: string;
  totalUnklarOutflowsCents: string;
  // Warnungen
  warnings: {
    type: string;
    severity: string;
    message: string;
    count: number;
    totalCents: string;
  }[];
  unklarCount: number;
} {
  // Konvertiere Perioden zu "weeks" (Legacy-Name)
  // WICHTIG: Alt/Neu kommt aus estateAllocation!
  const weeks = result.periods.map((p) => ({
    weekOffset: p.periodIndex,
    weekLabel: p.periodLabel,
    weekStartDate: p.periodStartDate.toISOString(),
    weekEndDate: p.periodEndDate.toISOString(),
    openingBalanceCents: p.openingBalanceCents.toString(),
    totalInflowsCents: p.totalInflowsCents.toString(),
    totalOutflowsCents: p.totalOutflowsCents.toString(),
    netCashflowCents: p.netCashflowCents.toString(),
    closingBalanceCents: p.closingBalanceCents.toString(),
    // Alt/Neu aus estateAllocation
    inflowsAltmasseCents: p.altmasseInflowsCents.toString(),
    inflowsNeumasseCents: p.neumasseInflowsCents.toString(),
    outflowsAltmasseCents: p.altmasseOutflowsCents.toString(),
    outflowsNeumasseCents: p.neumasseOutflowsCents.toString(),
    // UNKLAR
    inflowsUnklarCents: p.unklarInflowsCents.toString(),
    outflowsUnklarCents: p.unklarOutflowsCents.toString(),
  }));

  // Konvertiere Kategorien
  // HINWEIS: estateType ist deprecated - Alt/Neu kommt jetzt aus period-level Daten
  const categories = result.categories.map((cat) => {
    // Gruppiere Einträge nach Beschreibung als "Zeilen"
    const lineMap = new Map<string, {
      lineName: string;
      totalCents: bigint;
      weeklyValues: Map<number, bigint>;
    }>();

    for (const entry of cat.entries) {
      const lineName = entry.description.substring(0, 50); // Kürze für Anzeige
      if (!lineMap.has(lineName)) {
        lineMap.set(lineName, {
          lineName,
          totalCents: BigInt(0),
          weeklyValues: new Map(),
        });
      }
      const line = lineMap.get(lineName)!;
      const absAmount = entry.amountCents < BigInt(0) ? -entry.amountCents : entry.amountCents;
      line.totalCents += absAmount;
      line.weeklyValues.set(
        entry.periodIndex,
        (line.weeklyValues.get(entry.periodIndex) ?? BigInt(0)) + absAmount
      );
    }

    return {
      categoryName: cat.legalBucket === "UNKNOWN" ? "Nicht klassifiziert" : `${cat.legalBucket} (${cat.flowType === "INFLOW" ? "Einzahlungen" : "Auszahlungen"})`,
      flowType: cat.flowType,
      // DEPRECATED: estateType auf Kategorie-Ebene ist veraltet
      // Alt/Neu kommt jetzt aus estateAllocation auf Entry-Ebene
      // Wir setzen hier einen Platzhalter für Abwärtskompatibilität
      estateType: "MIXED",  // Kategorien haben kein festes estateType mehr
      totalCents: cat.totalCents.toString(),
      weeklyTotals: cat.periodTotals.map((t) => t.toString()),
      lines: Array.from(lineMap.values()).map((line) => ({
        lineName: line.lineName,
        totalCents: line.totalCents.toString(),
        weeklyValues: Array.from({ length: result.periodCount }, (_, i) => ({
          weekOffset: i,
          effectiveCents: (line.weeklyValues.get(i) ?? BigInt(0)).toString(),
        })),
      })),
    };
  });

  return {
    weeks,
    categories,
    // Alt/Neu Gesamtsummen
    totalAltmasseInflowsCents: result.totalAltmasseInflowsCents.toString(),
    totalAltmasseOutflowsCents: result.totalAltmasseOutflowsCents.toString(),
    totalNeumasseInflowsCents: result.totalNeumasseInflowsCents.toString(),
    totalNeumasseOutflowsCents: result.totalNeumasseOutflowsCents.toString(),
    totalUnklarInflowsCents: result.totalUnklarInflowsCents.toString(),
    totalUnklarOutflowsCents: result.totalUnklarOutflowsCents.toString(),
    // Warnungen
    warnings: result.warnings.map((w) => ({
      type: w.type,
      severity: w.severity,
      message: w.message,
      count: w.count,
      totalCents: w.totalCents.toString(),
    })),
    unklarCount: result.unklarCount,
  };
}
