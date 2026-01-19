/**
 * Classification Engine
 *
 * Rule-basierte Klassifikation von LedgerEntries.
 * Erstellt Vorschläge basierend auf konfigurierten ClassificationRules.
 */

import { PrismaClient, ClassificationRule, LedgerEntry } from '@prisma/client';
import { ClassificationSuggestion, MatchType, MATCH_TYPES } from './types';

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
        confidence,
        matchDetails: buildMatchDetails(rule, entry),
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
            confidence,
            matchDetails: buildMatchDetails(rule, entry),
          };
          break; // Erste Regel (höchste Priorität) gewinnt
        }
      }

      if (suggestion) {
        // Schreibe Vorschlag an LedgerEntry (inkl. Dimensions-Vorschläge)
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
  // Setze alle Vorschläge für UNREVIEWED Entries zurück (inkl. Dimensions)
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
