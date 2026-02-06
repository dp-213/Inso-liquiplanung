/**
 * Classification Engine
 *
 * Rule-basierte Klassifikation von LedgerEntries.
 * Erstellt Vorschläge basierend auf konfigurierten ClassificationRules.
 */

import { PrismaClient, ClassificationRule, LedgerEntry } from '@prisma/client';
import { ClassificationSuggestion, MatchType, MATCH_TYPES, ServiceDateRule, SERVICE_DATE_RULES } from './types';
import { findMatchingRow, HVPLUS_MATRIX_ROWS, MatrixRowConfig } from '@/lib/cases/haevg-plus/matrix-config';
import { deriveFlowType } from '@/lib/ledger/types';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extrahiert den Feldwert aus einem LedgerEntry basierend auf dem matchField
 */
function getFieldValue(
  entry: Pick<LedgerEntry, 'description' | 'bookingReference' | 'bookingSource' | 'bookingSourceId' | 'amountCents'>,
  matchField: string
): string {
  switch (matchField) {
    case 'description':
      return entry.description || '';
    case 'bookingReference':
      return entry.bookingReference || '';
    case 'bookingSource':
      return entry.bookingSource || '';
    case 'bookingSourceId':
      return entry.bookingSourceId || '';
    case 'amountCents':
      return String(entry.amountCents);
    default:
      return '';
  }
}

/**
 * Parst einen Betragsbereich aus dem matchValue
 * Format: "min-max" oder "min-" oder "-max"
 * Beispiele: "1000-5000", "1000-", "-5000"
 */
function parseAmountRange(matchValue: string): [number, number] {
  const parts = matchValue.split('-');
  if (parts.length !== 2) {
    return [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
  }

  const min = parts[0] === '' ? Number.NEGATIVE_INFINITY : parseFloat(parts[0]);
  const max = parts[1] === '' ? Number.POSITIVE_INFINITY : parseFloat(parts[1]);

  return [isNaN(min) ? Number.NEGATIVE_INFINITY : min, isNaN(max) ? Number.POSITIVE_INFINITY : max];
}

/**
 * Berechnet den Basis-Confidence-Score basierend auf dem Match-Typ
 */
function getBaseConfidence(matchType: string): number {
  switch (matchType) {
    case MATCH_TYPES.EQUALS:
      return 0.9; // Exakter Match = höchste Confidence
    case MATCH_TYPES.STARTS_WITH:
    case MATCH_TYPES.ENDS_WITH:
      return 0.8; // Prefix/Suffix = hohe Confidence
    case MATCH_TYPES.CONTAINS:
      return 0.7; // Enthält = mittlere Confidence
    case MATCH_TYPES.REGEX:
      return 0.75; // Regex = kann präzise sein
    case MATCH_TYPES.AMOUNT_RANGE:
      return 0.6; // Betragsbereich = niedrigere Confidence
    default:
      return 0.5;
  }
}

// =============================================================================
// SERVICE DATE CALCULATION (Phase C)
// =============================================================================

interface ServiceDateResult {
  serviceDate?: Date;
  servicePeriodStart?: Date;
  servicePeriodEnd?: Date;
  explanation: string;
}

/**
 * Berechnet das Leistungsdatum basierend auf der Regel und dem Transaktionsdatum.
 *
 * VORMONAT: Zahlung bezieht sich auf Vormonat
 *   - Dezember-Zahlung → Leistungsdatum: 15. November (Monatsmitte)
 *
 * SAME_MONTH: Zahlung = Leistungsmonat
 *   - Dezember-Zahlung → Leistungsdatum: 15. Dezember (Monatsmitte)
 *
 * PREVIOUS_QUARTER: Zahlung bezieht sich auf Vorquartal
 *   - Januar-Zahlung → Leistungszeitraum: 1.10 - 31.12 (Q4)
 *   - April-Zahlung → Leistungszeitraum: 1.1 - 31.3 (Q1)
 */
export function calculateServiceDate(
  transactionDate: Date,
  rule: ServiceDateRule
): ServiceDateResult {
  const year = transactionDate.getFullYear();
  const month = transactionDate.getMonth(); // 0-indexed (0 = Januar)

  switch (rule) {
    case SERVICE_DATE_RULES.VORMONAT: {
      // Vormonat: Monatsmitte des Vormonats
      let targetMonth = month - 1;
      let targetYear = year;
      if (targetMonth < 0) {
        targetMonth = 11; // Dezember
        targetYear = year - 1;
      }
      const serviceDate = new Date(targetYear, targetMonth, 15);
      const monthName = serviceDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      return {
        serviceDate,
        explanation: `Vormonat-Regel: Leistungsdatum ${monthName}`,
      };
    }

    case SERVICE_DATE_RULES.SAME_MONTH: {
      // Gleicher Monat: Monatsmitte
      const serviceDate = new Date(year, month, 15);
      const monthName = serviceDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      return {
        serviceDate,
        explanation: `Gleicher-Monat-Regel: Leistungsdatum ${monthName}`,
      };
    }

    case SERVICE_DATE_RULES.PREVIOUS_QUARTER: {
      // Vorquartal als Zeitraum
      // Q1 (Jan-Mär) → Zahlung in Q2 (Apr-Jun)
      // Q2 (Apr-Jun) → Zahlung in Q3 (Jul-Sep)
      // Q3 (Jul-Sep) → Zahlung in Q4 (Okt-Dez)
      // Q4 (Okt-Dez) → Zahlung in Q1 nächstes Jahr (Jan-Mär)
      const currentQuarter = Math.floor(month / 3); // 0=Q1, 1=Q2, 2=Q3, 3=Q4
      let prevQuarter = currentQuarter - 1;
      let targetYear = year;
      if (prevQuarter < 0) {
        prevQuarter = 3; // Q4
        targetYear = year - 1;
      }

      // Quartals-Start/Ende berechnen
      const quarterStartMonth = prevQuarter * 3; // 0, 3, 6, 9
      const quarterEndMonth = quarterStartMonth + 2; // 2, 5, 8, 11
      const quarterEndDay = new Date(targetYear, quarterEndMonth + 1, 0).getDate(); // Letzter Tag des Monats

      const servicePeriodStart = new Date(targetYear, quarterStartMonth, 1);
      const servicePeriodEnd = new Date(targetYear, quarterEndMonth, quarterEndDay);

      const quarterLabel = `Q${prevQuarter + 1}/${targetYear}`;
      return {
        servicePeriodStart,
        servicePeriodEnd,
        explanation: `Vorquartal-Regel: Leistungszeitraum ${quarterLabel} (${servicePeriodStart.toLocaleDateString('de-DE')} - ${servicePeriodEnd.toLocaleDateString('de-DE')})`,
      };
    }

    default:
      return { explanation: 'Unbekannte Service-Date-Regel' };
  }
}

// =============================================================================
// MATCH RULE
// =============================================================================

/**
 * Prüft ob eine Regel auf einen LedgerEntry matcht
 */
export function matchRule(
  rule: Pick<ClassificationRule, 'matchField' | 'matchType' | 'matchValue'>,
  entry: Pick<LedgerEntry, 'description' | 'bookingReference' | 'bookingSource' | 'bookingSourceId' | 'amountCents'>
): boolean {
  const fieldValue = getFieldValue(entry, rule.matchField);
  const matchValue = rule.matchValue;

  switch (rule.matchType as MatchType) {
    case MATCH_TYPES.CONTAINS:
      return fieldValue.toLowerCase().includes(matchValue.toLowerCase());

    case MATCH_TYPES.STARTS_WITH:
      return fieldValue.toLowerCase().startsWith(matchValue.toLowerCase());

    case MATCH_TYPES.ENDS_WITH:
      return fieldValue.toLowerCase().endsWith(matchValue.toLowerCase());

    case MATCH_TYPES.EQUALS:
      return fieldValue.toLowerCase() === matchValue.toLowerCase();

    case MATCH_TYPES.REGEX:
      try {
        const regex = new RegExp(matchValue, 'i');
        return regex.test(fieldValue);
      } catch {
        // Ungültiger Regex → kein Match
        return false;
      }

    case MATCH_TYPES.AMOUNT_RANGE:
      const [min, max] = parseAmountRange(matchValue);
      const amount = Math.abs(Number(entry.amountCents)) / 100; // In EUR, absoluter Wert
      return amount >= min && amount <= max;

    default:
      return false;
  }
}

// =============================================================================
// CLASSIFY ENTRY
// =============================================================================

/**
 * Klassifiziert einen einzelnen LedgerEntry basierend auf aktiven Regeln
 * Gibt den besten Match (höchste Priorität, dann höchste Confidence) zurück
 */
export async function classifyEntry(
  prisma: PrismaClient,
  entry: LedgerEntry
): Promise<ClassificationSuggestion | null> {
  // Lade alle aktiven Regeln für den Case, sortiert nach Priorität (niedrig = wichtig)
  const rules = await prisma.classificationRule.findMany({
    where: {
      caseId: entry.caseId,
      isActive: true,
    },
    orderBy: { priority: 'asc' },
  });

  if (rules.length === 0) {
    return null;
  }

  // Finde die erste matchende Regel (Priorität-basiert)
  for (const rule of rules) {
    if (matchRule(rule, entry)) {
      const baseConfidence = getBaseConfidence(rule.matchType);
      const confidence = Math.min(1.0, baseConfidence + rule.confidenceBonus);

      // Service-Date berechnen wenn Regel vorhanden
      let serviceDateResult: ServiceDateResult | undefined;
      if (rule.assignServiceDateRule) {
        serviceDateResult = calculateServiceDate(
          entry.transactionDate,
          rule.assignServiceDateRule as ServiceDateRule
        );
      }

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        priority: rule.priority,
        suggestedCategory: rule.suggestedCategory || undefined,
        suggestedFlowType: rule.suggestedFlowType as 'INFLOW' | 'OUTFLOW' | undefined,
        suggestedLegalBucket: rule.suggestedLegalBucket as 'MASSE' | 'ABSONDERUNG' | 'NEUTRAL' | 'UNKNOWN' | undefined,
        // Dimensions-Zuweisung
        assignBankAccountId: rule.assignBankAccountId || undefined,
        assignCounterpartyId: rule.assignCounterpartyId || undefined,
        assignLocationId: rule.assignLocationId || undefined,
        // Service-Date-Vorschlag (Phase C)
        assignServiceDateRule: rule.assignServiceDateRule as ServiceDateRule | undefined,
        suggestedServiceDate: serviceDateResult?.serviceDate,
        suggestedServicePeriodStart: serviceDateResult?.servicePeriodStart,
        suggestedServicePeriodEnd: serviceDateResult?.servicePeriodEnd,
        confidence,
        matchDetails: serviceDateResult
          ? `${buildMatchDetails(rule, entry)} | ${serviceDateResult.explanation}`
          : buildMatchDetails(rule, entry),
      };
    }
  }

  return null;
}

/**
 * Erstellt eine lesbare Beschreibung des Matches
 */
function buildMatchDetails(
  rule: ClassificationRule,
  entry: Pick<LedgerEntry, 'description' | 'bookingReference' | 'bookingSource' | 'bookingSourceId' | 'amountCents'>
): string {
  const fieldLabels: Record<string, string> = {
    description: 'Beschreibung',
    bookingReference: 'Buchungsreferenz',
    bookingSource: 'Buchungsquelle',
    bookingSourceId: 'Konto-ID',
    amountCents: 'Betrag',
  };

  const matchTypeLabels: Record<string, string> = {
    CONTAINS: 'enthält',
    STARTS_WITH: 'beginnt mit',
    ENDS_WITH: 'endet mit',
    EQUALS: 'ist gleich',
    REGEX: 'matcht Pattern',
    AMOUNT_RANGE: 'liegt im Bereich',
  };

  const fieldLabel = fieldLabels[rule.matchField] || rule.matchField;
  const matchLabel = matchTypeLabels[rule.matchType] || rule.matchType;

  return `Regel "${rule.name}": ${fieldLabel} ${matchLabel} "${rule.matchValue}"`;
}

// =============================================================================
// CLASSIFY BATCH
// =============================================================================

/**
 * Klassifiziert mehrere LedgerEntries und schreibt die Vorschläge direkt
 */
export async function classifyBatch(
  prisma: PrismaClient,
  caseId: string,
  entryIds?: string[]
): Promise<{ classified: number; unchanged: number; errors: number }> {
  // Lade die zu klassifizierenden Entries
  const where = entryIds
    ? { id: { in: entryIds }, caseId }
    : {
        caseId,
        reviewStatus: 'UNREVIEWED',
        suggestedLegalBucket: null, // Noch nicht klassifiziert
      };

  const entries = await prisma.ledgerEntry.findMany({ where });

  if (entries.length === 0) {
    return { classified: 0, unchanged: 0, errors: 0 };
  }

  // Lade alle aktiven Regeln einmal
  const rules = await prisma.classificationRule.findMany({
    where: { caseId, isActive: true },
    orderBy: { priority: 'asc' },
  });

  let classified = 0;
  let unchanged = 0;
  let errors = 0;

  // Verarbeite jeden Entry
  for (const entry of entries) {
    try {
      // Finde die erste matchende Regel
      let suggestion: ClassificationSuggestion | null = null;

      for (const rule of rules) {
        if (matchRule(rule, entry)) {
          const baseConfidence = getBaseConfidence(rule.matchType);
          const confidence = Math.min(1.0, baseConfidence + rule.confidenceBonus);

          // Service-Date berechnen wenn Regel vorhanden
          let serviceDateResult: ServiceDateResult | undefined;
          if (rule.assignServiceDateRule) {
            serviceDateResult = calculateServiceDate(
              entry.transactionDate,
              rule.assignServiceDateRule as ServiceDateRule
            );
          }

          suggestion = {
            ruleId: rule.id,
            ruleName: rule.name,
            priority: rule.priority,
            suggestedCategory: rule.suggestedCategory || undefined,
            suggestedFlowType: rule.suggestedFlowType as 'INFLOW' | 'OUTFLOW' | undefined,
            suggestedLegalBucket: rule.suggestedLegalBucket as 'MASSE' | 'ABSONDERUNG' | 'NEUTRAL' | 'UNKNOWN' | undefined,
            // Dimensions-Zuweisung
            assignBankAccountId: rule.assignBankAccountId || undefined,
            assignCounterpartyId: rule.assignCounterpartyId || undefined,
            assignLocationId: rule.assignLocationId || undefined,
            // Service-Date-Vorschlag (Phase C)
            assignServiceDateRule: rule.assignServiceDateRule as ServiceDateRule | undefined,
            suggestedServiceDate: serviceDateResult?.serviceDate,
            suggestedServicePeriodStart: serviceDateResult?.servicePeriodStart,
            suggestedServicePeriodEnd: serviceDateResult?.servicePeriodEnd,
            confidence,
            matchDetails: serviceDateResult
              ? `${buildMatchDetails(rule, entry)} | ${serviceDateResult.explanation}`
              : buildMatchDetails(rule, entry),
          };
          break; // Erste Regel (höchste Priorität) gewinnt
        }
      }

      if (suggestion) {
        // Schreibe Vorschlag an LedgerEntry (inkl. Dimensions- und Service-Date-Vorschläge)
        await prisma.ledgerEntry.update({
          where: { id: entry.id },
          data: {
            suggestedLegalBucket: suggestion.suggestedLegalBucket || null,
            suggestedCategory: suggestion.suggestedCategory || null,
            suggestedConfidence: suggestion.confidence,
            suggestedRuleId: suggestion.ruleId,
            suggestedReason: suggestion.matchDetails,
            // Dimensions-Vorschläge
            suggestedBankAccountId: suggestion.assignBankAccountId || null,
            suggestedCounterpartyId: suggestion.assignCounterpartyId || null,
            suggestedLocationId: suggestion.assignLocationId || null,
            // Service-Date-Vorschläge (Phase C)
            suggestedServiceDate: suggestion.suggestedServiceDate || null,
            suggestedServicePeriodStart: suggestion.suggestedServicePeriodStart || null,
            suggestedServicePeriodEnd: suggestion.suggestedServicePeriodEnd || null,
            suggestedServiceDateRule: suggestion.assignServiceDateRule || null,
          },
        });
        classified++;
      } else {
        unchanged++;
      }
    } catch (error) {
      console.error(`Error classifying entry ${entry.id}:`, error);
      errors++;
    }
  }

  return { classified, unchanged, errors };
}

// =============================================================================
// RECLASSIFY ALL
// =============================================================================

/**
 * Klassifiziert alle UNREVIEWED Entries eines Cases neu
 * Nützlich nach dem Hinzufügen/Ändern von Regeln
 */
export async function reclassifyUnreviewed(
  prisma: PrismaClient,
  caseId: string
): Promise<{ classified: number; unchanged: number; errors: number }> {
  // Setze alle Vorschläge für UNREVIEWED Entries zurück (inkl. Dimensions und Service-Date)
  await prisma.ledgerEntry.updateMany({
    where: {
      caseId,
      reviewStatus: 'UNREVIEWED',
    },
    data: {
      suggestedLegalBucket: null,
      suggestedCategory: null,
      suggestedConfidence: null,
      suggestedRuleId: null,
      suggestedReason: null,
      suggestedBankAccountId: null,
      suggestedCounterpartyId: null,
      suggestedLocationId: null,
      // Service-Date-Vorschläge (Phase C)
      suggestedServiceDate: null,
      suggestedServicePeriodStart: null,
      suggestedServicePeriodEnd: null,
      suggestedServiceDateRule: null,
    },
  });

  // Klassifiziere neu
  return classifyBatch(prisma, caseId);
}

// =============================================================================
// GET CLASSIFICATION STATISTICS
// =============================================================================

export interface ClassificationStats {
  totalUnreviewed: number;
  withSuggestion: number;
  withoutSuggestion: number;
  byLegalBucket: Record<string, number>;
  byConfidenceLevel: {
    high: number; // > 0.8
    medium: number; // 0.5 - 0.8
    low: number; // < 0.5
  };
}

/**
 * Gibt Statistiken über die Klassifikation der UNREVIEWED Entries
 */
export async function getClassificationStats(
  prisma: PrismaClient,
  caseId: string
): Promise<ClassificationStats> {
  // Hole alle UNREVIEWED Entries
  const entries = await prisma.ledgerEntry.findMany({
    where: { caseId, reviewStatus: 'UNREVIEWED' },
    select: {
      suggestedLegalBucket: true,
      suggestedConfidence: true,
    },
  });

  const stats: ClassificationStats = {
    totalUnreviewed: entries.length,
    withSuggestion: 0,
    withoutSuggestion: 0,
    byLegalBucket: {},
    byConfidenceLevel: { high: 0, medium: 0, low: 0 },
  };

  for (const entry of entries) {
    if (entry.suggestedLegalBucket) {
      stats.withSuggestion++;

      // Nach Legal Bucket
      const bucket = entry.suggestedLegalBucket;
      stats.byLegalBucket[bucket] = (stats.byLegalBucket[bucket] || 0) + 1;

      // Nach Confidence Level
      const confidence = entry.suggestedConfidence || 0;
      if (confidence > 0.8) {
        stats.byConfidenceLevel.high++;
      } else if (confidence >= 0.5) {
        stats.byConfidenceLevel.medium++;
      } else {
        stats.byConfidenceLevel.low++;
      }
    } else {
      stats.withoutSuggestion++;
    }
  }

  return stats;
}

// =============================================================================
// COUNTERPARTY PATTERN MATCHING
// =============================================================================

/**
 * Matcht Counterparty-Patterns gegen LedgerEntry-Beschreibungen.
 * Schreibt NUR suggestedCounterpartyId - User muss bestätigen!
 */
export async function matchCounterpartyPatterns(
  prisma: PrismaClient,
  caseId: string,
  entryIds?: string[]
): Promise<{ matched: number; skipped: number; errors: number }> {
  // Lade Counterparties mit Pattern
  const counterparties = await prisma.counterparty.findMany({
    where: {
      caseId,
      matchPattern: { not: null },
    },
    orderBy: { displayOrder: 'asc' },
  });

  if (counterparties.length === 0) {
    return { matched: 0, skipped: 0, errors: 0 };
  }

  // Lade Entries ohne Counterparty-Vorschlag
  const where = entryIds
    ? { id: { in: entryIds }, caseId }
    : {
        caseId,
        suggestedCounterpartyId: null,
        reviewStatus: 'UNREVIEWED',
      };

  const entries = await prisma.ledgerEntry.findMany({
    where,
    select: { id: true, description: true, suggestedReason: true },
  });

  if (entries.length === 0) {
    return { matched: 0, skipped: 0, errors: 0 };
  }

  let matched = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of entries) {
    let foundMatch = false;

    for (const cp of counterparties) {
      if (!cp.matchPattern) continue;

      try {
        const regex = new RegExp(cp.matchPattern, 'i');
        if (regex.test(entry.description)) {
          // Nur Vorschlag setzen - User muss bestätigen!
          const reason = entry.suggestedReason
            ? `${entry.suggestedReason} | Gegenpartei "${cp.name}" erkannt`
            : `Gegenpartei "${cp.name}" erkannt (Pattern: ${cp.matchPattern})`;

          await prisma.ledgerEntry.update({
            where: { id: entry.id },
            data: {
              suggestedCounterpartyId: cp.id,
              suggestedReason: reason,
            },
          });

          matched++;
          foundMatch = true;
          break; // Erste Übereinstimmung gewinnt
        }
      } catch (err) {
        console.warn(`Invalid regex pattern for counterparty ${cp.id}: ${cp.matchPattern}`, err);
        errors++;
      }
    }

    if (!foundMatch) {
      skipped++;
    }
  }

  return { matched, skipped, errors };
}

// =============================================================================
// CATEGORY TAG SUGGESTION ENGINE
// =============================================================================

/**
 * Berechnet categoryTag-Vorschläge für Einträge ohne categoryTag.
 *
 * Nutzt exakt findMatchingRow() aus der Matrix-Config -- dieselbe Logik
 * wie die Matrix-Darstellung. Kein zweites Matching-System.
 *
 * Für IST-Daten: Findet die passende Matrix-Zeile und extrahiert den
 * CATEGORY_TAG-Match daraus als Vorschlag.
 */
export async function suggestCategoryTags(
  prisma: PrismaClient,
  caseId: string,
  entryIds?: string[]
): Promise<{ updated: number; skipped: number }> {
  // Lade Entries ohne categoryTag (= noch nicht zugeordnet)
  const whereClause: Record<string, unknown> = {
    caseId,
    categoryTag: null,
  };
  if (entryIds && entryIds.length > 0) {
    whereClause.id = { in: entryIds };
  }

  const entries = await prisma.ledgerEntry.findMany({
    where: whereClause,
    include: {
      counterparty: { select: { name: true } },
    },
  });

  let updated = 0;
  let skipped = 0;

  for (const entry of entries) {
    const flowType = deriveFlowType(BigInt(entry.amountCents));
    const flowTypeStr = flowType === 'INFLOW' ? 'INFLOW' : 'OUTFLOW';

    // findMatchingRow() mit denselben Daten wie die Matrix-Berechnung
    const matchedRow = findMatchingRow(
      {
        description: entry.description,
        amountCents: entry.amountCents,
        counterpartyId: entry.counterpartyId,
        counterpartyName: entry.counterparty?.name || null,
        locationId: entry.locationId,
        bankAccountId: entry.bankAccountId,
        legalBucket: entry.legalBucket,
        categoryTag: null, // Explizit null -- wir suchen ja gerade den Vorschlag
      },
      HVPLUS_MATRIX_ROWS,
      flowTypeStr
    );

    if (!matchedRow) {
      skipped++;
      continue;
    }

    // Suche den CATEGORY_TAG-Match in der gefundenen Zeile
    const tagMatch = matchedRow.matches.find(m => m.type === 'CATEGORY_TAG');

    if (!tagMatch) {
      // Zeile gefunden aber hat keinen CATEGORY_TAG (z.B. Fallback-Zeile)
      skipped++;
      continue;
    }

    // Bestimme welcher Match-Typ tatsächlich gegriffen hat (für Reason)
    const actualMatchType = determineActualMatchType(entry, matchedRow);

    await prisma.ledgerEntry.update({
      where: { id: entry.id },
      data: {
        suggestedCategoryTag: tagMatch.value,
        suggestedCategoryTagReason: `${matchedRow.label} (${actualMatchType})`,
      },
    });

    updated++;
  }

  return { updated, skipped };
}

/**
 * Bestimmt welcher Match-Typ bei findMatchingRow() tatsächlich gegriffen hat.
 * Minimal und stabil -- nur für die Reason-Anzeige.
 */
function determineActualMatchType(
  entry: LedgerEntry & { counterparty?: { name: string } | null },
  row: MatrixRowConfig
): string {
  for (const match of row.matches) {
    switch (match.type) {
      case 'COUNTERPARTY_PATTERN':
        if (entry.counterparty?.name && new RegExp(match.value, 'i').test(entry.counterparty.name)) {
          return 'COUNTERPARTY_PATTERN';
        }
        break;
      case 'COUNTERPARTY_ID':
        if (entry.counterpartyId === match.value) return 'COUNTERPARTY_ID';
        break;
      case 'DESCRIPTION_PATTERN':
        if (new RegExp(match.value, 'i').test(entry.description)) return 'DESCRIPTION_PATTERN';
        break;
      case 'LOCATION_ID':
        if (entry.locationId === match.value) return 'LOCATION_ID';
        break;
      case 'BANK_ACCOUNT_ID':
        if (entry.bankAccountId === match.value) return 'BANK_ACCOUNT_ID';
        break;
      case 'LEGAL_BUCKET':
        if (entry.legalBucket === match.value) return 'LEGAL_BUCKET';
        break;
    }
  }
  return 'FALLBACK';
}
