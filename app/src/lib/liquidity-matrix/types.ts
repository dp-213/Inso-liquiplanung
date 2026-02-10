/**
 * Shared Types für Liquidity Matrix Aggregation und Explanation
 */

import type { MatchResult } from '@/lib/cases/haevg-plus/matrix-config';

// =============================================================================
// ENTRY TRACE (für Explain-Cell)
// =============================================================================

export interface EntryTrace {
  // Identität
  entryId: string;
  transactionDate: string;
  description: string;
  originalAmountCents: string;
  valueType: 'IST' | 'PLAN';

  // Perioden-Zuordnung
  periodIndex: number;

  // IST/PLAN-Entscheidung
  wasSkippedByIstVorrang: boolean;

  // Estate-Split (aus LedgerEntry-Feldern)
  estateAllocation: string;
  estateRatio: number;
  neuAnteilCents: string;
  altAnteilCents: string;
  allocationSource: string | null;
  allocationNote: string | null;

  // Zeilen-Zuordnung Neu-Anteil
  neuMatch: MatchResult | null;

  // Zeilen-Zuordnung Alt-Anteil
  altCategoryTag: string | null;
  altMatch: MatchResult | null;

  // Dimensionen
  counterpartyName: string | null;
  locationName: string | null;
  bankAccountName: string | null;
  categoryTag: string | null;
  categoryTagSource: string | null;
  reviewStatus: string;
}

// =============================================================================
// AGGREGATE RESULT
// =============================================================================

export interface AggregateResult {
  rowAggregations: Map<string, Map<number, { amount: bigint; count: number }>>;
  periodsWithIst: Set<number>;
  periodValueTypes: Map<number, { ist: number; plan: number; planIgnored: number }>;
  stats: {
    totalEntries: number;
    istCount: number;
    planCount: number;
    planIgnoredCount: number;
    unklearCount: number;
    unreviewedCount: number;
  };
  traces: EntryTrace[];
}

// =============================================================================
// CELL EXPLANATION (API Response)
// =============================================================================

export interface CellExplanation {
  context: {
    rowId: string;
    rowLabel: string;
    blockLabel: string;
    periodIndex: number;
    periodLabel: string;
    periodStart: string;  // deutsch formatiert: "01.11.2025"
    periodEnd: string;    // deutsch formatiert: "30.11.2025"
    amountCents: string;
    entryCount: number;
    valueTypeUsed: 'IST' | 'PLAN' | 'MIXED';
    summaryText: string;
  };

  rules: {
    rowMatching: {
      ruleDescription: string;   // Menschenlesbare Erklärung der Zeilen-Regeln
      matchCriteria: Array<{     // Alle Matching-Regeln der Zeile
        type: string;
        value: string;
        label: string;           // Deutsch: "Kategorie-Tag = 'KV'"
      }>;
      entryMatchBreakdown: Array<{  // Wie jeder Entry gematcht wurde
        matchType: string;
        matchValue: string;
        entryCount: number;
        description: string;     // z.B. "4 Entries via Gegenpartei-Muster '(KV|KVNO|...)'"
      }>;
    };
    periodAssignment: {
      ruleDescription: string;
      periodType: string;
      dateRange: string;  // deutsch formatiert
    };
    istPlanDecision: {
      ruleDescription: string;
      periodsWithIst: boolean;
      planEntriesIgnored: number;
    };
    estateAllocation: {
      ruleDescription: string;
      ruleGroups: Array<{
        source: string;
        sourceLabel: string;  // Menschenlesbar: "Massekreditvertrag"
        note: string;
        entryCount: number;
        totalCents: string;
      }>;
    };
    categoryTag: {
      ruleDescription: string;
      tagValue: string | null;
      tagSource: string | null;
      tagSourceLabel: string | null;  // Menschenlesbar
    };
  };

  calculation: {
    steps: Array<{
      label: string;
      amountCents: string;
      entryCount: number;
      description: string;
    }>;
  };

  entries: Array<{
    id: string;
    transactionDate: string;
    amountCents: string;
    description: string;  // Vollständiger Text, nicht abgeschnitten
    counterpartyName: string | null;
    locationName: string | null;
    bankAccountName: string | null;
    valueType: string;
    reviewStatus: string;
    estateAllocation: string;
    estateRatio: number;
    contributedCents: string;
    matchReason: string;  // Warum dieser Entry in diese Zeile kam
    allocationSource: string | null;
    allocationNote: string | null;
  }>;
}
