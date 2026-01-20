/**
 * Rule Engine für Import-Klassifikation
 *
 * ARCHITEKTUR-PRINZIP:
 * - Regeln arbeiten NUR auf ImportContext.normalized
 * - NIE auf raw Excel-Daten oder LedgerEntry
 * - Ergebnis sind IDs (locationId, bankAccountId, etc.) die ins Ledger übertragen werden
 */

import { NormalizedImportContext, RuleMatchField, RULE_MATCH_FIELDS } from './normalized-schema';

// =============================================================================
// TYPES
// =============================================================================

export type MatchType = 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'REGEX' | 'EQUALS' | 'AMOUNT_RANGE';

export const MATCH_TYPES: MatchType[] = ['CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'REGEX', 'EQUALS', 'AMOUNT_RANGE'];

export const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  CONTAINS: 'Enthält',
  STARTS_WITH: 'Beginnt mit',
  ENDS_WITH: 'Endet mit',
  REGEX: 'Regex-Pattern',
  EQUALS: 'Ist gleich',
  AMOUNT_RANGE: 'Betragsbereich',
};

/**
 * Eine Klassifikationsregel
 */
export interface ClassificationRule {
  id: string;
  caseId: string;
  name: string;
  isActive: boolean;
  priority: number;

  // Match-Kriterien (auf normalized)
  matchField: RuleMatchField;
  matchType: MatchType;
  matchValue: string;

  // Ziel-Zuweisungen
  suggestedLegalBucket?: string;
  assignBankAccountId?: string;
  assignCounterpartyId?: string;
  assignLocationId?: string;
}

/**
 * Ergebnis einer Regelanwendung
 */
export interface RuleMatchResult {
  matched: boolean;
  rule: ClassificationRule;
  matchedValue?: string;        // Der Wert der gematcht hat
  matchedField?: string;        // Das Feld das gematcht hat
}

/**
 * Gesamtergebnis der Regelanwendung auf eine Zeile
 */
export interface ClassificationResult {
  // Alle matchenden Regeln (sortiert nach Priorität)
  matchedRules: RuleMatchResult[];

  // Aggregiertes Ergebnis (von höchster Priorität)
  suggestedLegalBucket?: string;
  assignBankAccountId?: string;
  assignCounterpartyId?: string;
  assignLocationId?: string;

  // Meta
  ruleCount: number;
  highestPriorityRule?: ClassificationRule;
}

// =============================================================================
// MATCHING LOGIC
// =============================================================================

/**
 * Prüft ob ein einzelner Wert einem Match-Kriterium entspricht
 */
export function matchValue(
  value: string | undefined | null,
  matchType: MatchType,
  matchPattern: string
): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  const normalizedValue = value.toLowerCase().trim();
  const normalizedPattern = matchPattern.toLowerCase().trim();

  switch (matchType) {
    case 'EQUALS':
      return normalizedValue === normalizedPattern;

    case 'CONTAINS':
      return normalizedValue.includes(normalizedPattern);

    case 'STARTS_WITH':
      return normalizedValue.startsWith(normalizedPattern);

    case 'ENDS_WITH':
      return normalizedValue.endsWith(normalizedPattern);

    case 'REGEX':
      try {
        const regex = new RegExp(matchPattern, 'i');
        return regex.test(value);
      } catch {
        console.warn(`Invalid regex pattern: ${matchPattern}`);
        return false;
      }

    case 'AMOUNT_RANGE':
      // Format: "min-max" z.B. "100-500" oder ">100" oder "<500"
      // Wird auf betrag angewendet
      return false; // Handled separately in matchRule

    default:
      return false;
  }
}

/**
 * Prüft ob eine Regel auf normalisierte Daten matcht
 */
export function matchRule(
  normalized: NormalizedImportContext,
  rule: ClassificationRule
): RuleMatchResult {
  const { matchField, matchType, matchValue: pattern } = rule;

  // Special handling for amount range
  if (matchType === 'AMOUNT_RANGE') {
    const amount = normalized.betrag;
    const matched = matchAmountRange(amount, pattern);
    return {
      matched,
      rule,
      matchedValue: matched ? String(amount) : undefined,
      matchedField: 'betrag',
    };
  }

  // Get the field value from normalized data
  const fieldValue = normalized[matchField as keyof NormalizedImportContext];

  if (typeof fieldValue !== 'string') {
    return { matched: false, rule };
  }

  const matched = matchValue(fieldValue, matchType, pattern);

  return {
    matched,
    rule,
    matchedValue: matched ? fieldValue : undefined,
    matchedField: matched ? matchField : undefined,
  };
}

/**
 * Prüft Betragsbereich
 * Formate: "100-500", ">100", "<500", ">=100", "<=500"
 */
function matchAmountRange(amount: number, pattern: string): boolean {
  const trimmed = pattern.trim();

  // Range: "100-500"
  if (trimmed.includes('-') && !trimmed.startsWith('-') && !trimmed.startsWith('>') && !trimmed.startsWith('<')) {
    const [minStr, maxStr] = trimmed.split('-');
    const min = parseFloat(minStr);
    const max = parseFloat(maxStr);
    if (!isNaN(min) && !isNaN(max)) {
      return amount >= min && amount <= max;
    }
  }

  // Greater than or equal: ">=100"
  if (trimmed.startsWith('>=')) {
    const threshold = parseFloat(trimmed.slice(2));
    return !isNaN(threshold) && amount >= threshold;
  }

  // Less than or equal: "<=100"
  if (trimmed.startsWith('<=')) {
    const threshold = parseFloat(trimmed.slice(2));
    return !isNaN(threshold) && amount <= threshold;
  }

  // Greater than: ">100"
  if (trimmed.startsWith('>')) {
    const threshold = parseFloat(trimmed.slice(1));
    return !isNaN(threshold) && amount > threshold;
  }

  // Less than: "<100"
  if (trimmed.startsWith('<')) {
    const threshold = parseFloat(trimmed.slice(1));
    return !isNaN(threshold) && amount < threshold;
  }

  return false;
}

// =============================================================================
// RULE APPLICATION
// =============================================================================

/**
 * Wendet alle Regeln auf normalisierte Daten an
 * Regeln werden nach Priorität sortiert (niedrigere Zahl = höhere Priorität)
 */
export function applyRules(
  normalized: NormalizedImportContext,
  rules: ClassificationRule[]
): ClassificationResult {
  // Filter active rules and sort by priority
  const activeRules = rules
    .filter(r => r.isActive)
    .sort((a, b) => a.priority - b.priority);

  // Match all rules
  const matchedRules: RuleMatchResult[] = [];

  for (const rule of activeRules) {
    const result = matchRule(normalized, rule);
    if (result.matched) {
      matchedRules.push(result);
    }
  }

  // Build aggregated result from highest priority matches
  const result: ClassificationResult = {
    matchedRules,
    ruleCount: matchedRules.length,
  };

  // Apply assignments from matched rules (highest priority first)
  for (const match of matchedRules) {
    const rule = match.rule;

    if (!result.suggestedLegalBucket && rule.suggestedLegalBucket) {
      result.suggestedLegalBucket = rule.suggestedLegalBucket;
    }
    if (!result.assignBankAccountId && rule.assignBankAccountId) {
      result.assignBankAccountId = rule.assignBankAccountId;
    }
    if (!result.assignCounterpartyId && rule.assignCounterpartyId) {
      result.assignCounterpartyId = rule.assignCounterpartyId;
    }
    if (!result.assignLocationId && rule.assignLocationId) {
      result.assignLocationId = rule.assignLocationId;
    }

    // Track highest priority rule
    if (!result.highestPriorityRule) {
      result.highestPriorityRule = rule;
    }
  }

  return result;
}

/**
 * Generiert eine menschenlesbare Erklärung für eine Regelanwendung
 */
export function explainRuleMatch(match: RuleMatchResult): string {
  const { rule, matchedValue, matchedField } = match;

  const fieldLabel = matchedField || rule.matchField;
  const matchTypeLabel = MATCH_TYPE_LABELS[rule.matchType as MatchType] || rule.matchType;

  return `Regel "${rule.name}": ${fieldLabel} ${matchTypeLabel.toLowerCase()} "${rule.matchValue}" (gefunden: "${matchedValue || '-'}")`;
}

/**
 * Generiert eine Zusammenfassung der Klassifikation
 */
export function summarizeClassification(result: ClassificationResult): string {
  if (result.matchedRules.length === 0) {
    return 'Keine Regel gematcht';
  }

  const parts: string[] = [];

  if (result.assignLocationId) {
    parts.push('→ Standort zugewiesen');
  }
  if (result.assignBankAccountId) {
    parts.push('→ Bankkonto zugewiesen');
  }
  if (result.assignCounterpartyId) {
    parts.push('→ Gegenpartei zugewiesen');
  }
  if (result.suggestedLegalBucket) {
    parts.push(`→ Rechtsstatus: ${result.suggestedLegalBucket}`);
  }

  const ruleNames = result.matchedRules.map(m => m.rule.name).join(', ');
  return `${result.ruleCount} Regel(n) gematcht (${ruleNames}). ${parts.join(', ')}`;
}
