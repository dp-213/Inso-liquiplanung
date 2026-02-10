/**
 * Explanation Builder für die Liquiditätsmatrix
 *
 * Generiert 4-Ebenen-Erklärungen aus Trace-Daten.
 * Alle Texte werden aus Regel-Parametern abgeleitet.
 */

import type { MatrixRowMatch } from '@/lib/cases/haevg-plus/matrix-config';
import type { CellExplanation, EntryTrace } from './types';

// =============================================================================
// LABELS (nur für DB-Felder, nicht für Config-Regeln)
// =============================================================================

const ALLOCATION_SOURCE_LABELS: Record<string, string> = {
  VERTRAGSREGEL: 'Vertragsregel',
  MASSEKREDITVERTRAG: 'Massekreditvertrag',
  SERVICE_DATE_RULE: 'Leistungsdatum-Regel',
  PERIOD_PRORATA: 'Zeitanteilige Zuordnung',
  VORMONAT_LOGIK: 'Vormonat-Logik',
  MANUAL: 'Manuelle Zuordnung',
  MIXED: 'Gemischt (Alt/Neu)',
  ALTMASSE: 'Altmasse (vollständig)',
  NEUMASSE: 'Neumasse (vollständig)',
  UNKLAR: 'Nicht zugeordnet',
};

const TAG_SOURCE_LABELS: Record<string, string> = {
  AUTO: 'Automatisch durch Klassifikationsregel zugewiesen',
  MANUAL: 'Manuell durch Berater zugewiesen',
  IMPORT: 'Aus Import übernommen',
  PLAN: 'Aus Planungsdaten',
  CLASSIFICATION_RULE: 'Durch Klassifikationsregel',
  SUGGESTED: 'Vorgeschlagen (noch nicht bestätigt)',
};

// =============================================================================
// HELPER: Datum deutsch formatieren
// =============================================================================

function formatDateDE(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatMonthDE(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

// =============================================================================
// BUILDER
// =============================================================================

export function buildCellExplanation(params: {
  rowId: string;
  rowLabel: string;
  blockLabel: string;
  periodIndex: number;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  periodType: string;
  amountCents: string;
  traces: EntryTrace[];
  periodsWithIst: boolean;
  planIgnoredForPeriod: number;
  rowMatches: MatrixRowMatch[];
  rowMatchDescription?: string;  // Aus MatrixRowConfig.matchDescription
}): CellExplanation {
  const {
    rowId,
    rowLabel,
    blockLabel,
    periodIndex,
    periodLabel,
    periodStart,
    periodEnd,
    periodType,
    amountCents,
    traces,
    periodsWithIst,
    planIgnoredForPeriod,
    rowMatches,
    rowMatchDescription,
  } = params;

  // Nur aktive Traces (nicht übersprungene)
  const activeTraces = traces;
  const entryCount = activeTraces.length;

  // ValueType bestimmen
  const istTraces = activeTraces.filter(t => t.valueType === 'IST');
  const planTraces = activeTraces.filter(t => t.valueType === 'PLAN');
  const valueTypeUsed: 'IST' | 'PLAN' | 'MIXED' =
    istTraces.length > 0 && planTraces.length === 0 ? 'IST' :
    planTraces.length > 0 && istTraces.length === 0 ? 'PLAN' : 'MIXED';

  // Datum deutsch formatieren
  const periodStartDE = formatDateDE(periodStart);
  const periodEndDE = formatDateDE(periodEnd);
  const periodMonthDE = periodType === 'MONTHLY' ? formatMonthDE(periodStart) : null;

  // --- Ebene 1: Zusammenfassung ---
  const summaryText = buildSummaryText({
    entryCount,
    valueTypeUsed,
    rowLabel,
    periodMonthDE,
    periodLabel,
  });

  // --- Ebene 2: Zuordnungsregeln ---
  const matchCriteria = buildMatchCriteria(rowMatches);
  const entryMatchBreakdown = buildEntryMatchBreakdown(activeTraces, rowId);
  const rowMatchingDesc = buildRowMatchingDescription(rowLabel, matchCriteria, rowMatchDescription);
  const estateGroups = buildEstateGroups(activeTraces);

  // Dominantes categoryTag (das häufigste unter den Entries)
  const tagCounts = new Map<string, number>();
  for (const t of activeTraces) {
    if (t.categoryTag) {
      tagCounts.set(t.categoryTag, (tagCounts.get(t.categoryTag) ?? 0) + 1);
    }
  }
  let dominantTag: string | null = null;
  let maxCount = 0;
  for (const [tag, count] of tagCounts) {
    if (count > maxCount) { dominantTag = tag; maxCount = count; }
  }
  const dominantTagSource = activeTraces.find(t => t.categoryTag === dominantTag)?.categoryTagSource ?? null;

  // --- Ebene 3: Rechenweg ---
  const calcSteps = buildCalculationSteps(activeTraces, amountCents, rowId);

  // --- Ebene 4: Buchungen ---
  const entryDetails = buildEntryDetails(activeTraces, rowId);

  return {
    context: {
      rowId,
      rowLabel,
      blockLabel,
      periodIndex,
      periodLabel,
      periodStart: periodStartDE,
      periodEnd: periodEndDE,
      amountCents,
      entryCount,
      valueTypeUsed,
      summaryText,
    },
    rules: {
      rowMatching: {
        ruleDescription: rowMatchingDesc,
        matchCriteria,
        entryMatchBreakdown,
      },
      periodAssignment: {
        ruleDescription: periodType === 'MONTHLY'
          ? `Monatliche Periode: Alle Buchungen mit Transaktionsdatum im ${periodMonthDE} (${periodStartDE} bis ${periodEndDE}).`
          : `Wöchentliche Periode: Alle Buchungen vom ${periodStartDE} bis ${periodEndDE}.`,
        periodType,
        dateRange: `${periodStartDE} – ${periodEndDE}`,
      },
      istPlanDecision: {
        ruleDescription: buildIstPlanDescription(periodsWithIst, planIgnoredForPeriod, istTraces.length, planTraces.length),
        periodsWithIst,
        planEntriesIgnored: planIgnoredForPeriod,
      },
      estateAllocation: {
        ruleDescription: buildEstateDescription(estateGroups, activeTraces),
        ruleGroups: estateGroups,
      },
      categoryTag: {
        ruleDescription: buildCategoryTagDescription(dominantTag, dominantTagSource, tagCounts),
        tagValue: dominantTag,
        tagSource: dominantTagSource,
        tagSourceLabel: dominantTagSource ? (TAG_SOURCE_LABELS[dominantTagSource] ?? dominantTagSource) : null,
      },
    },
    calculation: {
      steps: calcSteps,
    },
    entries: entryDetails,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function buildSummaryText(ctx: {
  entryCount: number;
  valueTypeUsed: string;
  rowLabel: string;
  periodMonthDE: string | null;
  periodLabel: string;
}): string {
  const period = ctx.periodMonthDE ?? ctx.periodLabel;
  if (ctx.entryCount === 0) {
    return `Keine Buchungen für "${ctx.rowLabel}" im ${period}.`;
  }
  return `${ctx.entryCount} ${ctx.valueTypeUsed}-Buchung${ctx.entryCount !== 1 ? 'en' : ''} für "${ctx.rowLabel}" im ${period}.`;
}

function buildMatchCriteria(matches: MatrixRowMatch[]): CellExplanation['rules']['rowMatching']['matchCriteria'] {
  return matches.map(m => ({
    type: m.type,
    value: m.value,
    label: m.description ?? `${m.type} = '${m.value}'`,
  }));
}

function buildRowMatchingDescription(
  rowLabel: string,
  matchCriteria: CellExplanation['rules']['rowMatching']['matchCriteria'],
  rowMatchDescription?: string
): string {
  // Wenn eine Zeilen-Beschreibung aus der Config vorliegt, diese bevorzugen
  if (rowMatchDescription) {
    return rowMatchDescription;
  }

  if (matchCriteria.length === 0) {
    return `Zeile "${rowLabel}" hat keine Matching-Regeln (Summenzeile).`;
  }

  // Fallback: Aus den einzelnen Match-Beschreibungen zusammenbauen
  const parts: string[] = [];
  parts.push(`Zeile "${rowLabel}" sammelt Buchungen nach folgenden Regeln:`);

  for (const m of matchCriteria) {
    parts.push(m.label + '.');
  }

  return parts.join(' ');
}

function buildEntryMatchBreakdown(
  traces: EntryTrace[],
  rowId: string
): CellExplanation['rules']['rowMatching']['entryMatchBreakdown'] {
  // Gruppiere Entries nach Match-Grund
  const groups = new Map<string, { type: string; value: string; description: string; count: number }>();

  for (const trace of traces) {
    // Welcher Match hat diesen Entry in diese Zeile gebracht?
    let matchType = 'UNKNOWN';
    let matchValue = '';
    let matchDesc = '';

    if (trace.neuMatch?.row.id === rowId) {
      matchType = trace.neuMatch.matchType;
      matchValue = trace.neuMatch.matchValue;
      matchDesc = trace.neuMatch.matchDescription;
    } else if (trace.altMatch?.row.id === rowId) {
      matchType = trace.altMatch.matchType;
      matchValue = trace.altMatch.matchValue;
      matchDesc = trace.altMatch.matchDescription;
    }

    const key = `${matchType}::${matchValue}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
    } else {
      groups.set(key, { type: matchType, value: matchValue, description: matchDesc, count: 1 });
    }
  }

  return Array.from(groups.values()).map(g => ({
    matchType: g.type,
    matchValue: g.value,
    entryCount: g.count,
    description: `${g.count} Buchung${g.count !== 1 ? 'en' : ''} via ${g.description || `${g.type} '${g.value}'`}`,
  }));
}

function buildIstPlanDescription(
  periodsWithIst: boolean,
  planIgnored: number,
  istCount: number,
  planCount: number
): string {
  if (!periodsWithIst) {
    return `Keine IST-Daten für diese Periode vorhanden. Es werden ${planCount} PLAN-Buchung${planCount !== 1 ? 'en' : ''} verwendet.`;
  }
  if (planIgnored > 0) {
    return `IST-Daten vorhanden (${istCount} Buchungen). ${planIgnored} PLAN-Buchung${planIgnored !== 1 ? 'en' : ''} wurden ignoriert, weil IST-Daten Vorrang haben.`;
  }
  return `IST-Daten vorhanden (${istCount} Buchungen). Keine PLAN-Buchungen zu ignorieren.`;
}

function buildEstateGroups(traces: EntryTrace[]): CellExplanation['rules']['estateAllocation']['ruleGroups'] {
  const groups = new Map<string, { source: string; note: string; count: number; total: bigint }>();

  for (const trace of traces) {
    if (trace.estateAllocation === 'NEUMASSE' && trace.estateRatio === 1.0) {
      continue; // Volle Neumasse braucht keine Regel-Erklärung
    }

    const source = trace.allocationSource || trace.estateAllocation;
    const note = trace.allocationNote || buildDefaultAllocationNote(trace);
    const key = `${source}::${note}`;

    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      existing.total += BigInt(trace.originalAmountCents);
    } else {
      groups.set(key, {
        source,
        note,
        count: 1,
        total: BigInt(trace.originalAmountCents),
      });
    }
  }

  return Array.from(groups.values()).map(data => ({
    source: data.source,
    sourceLabel: ALLOCATION_SOURCE_LABELS[data.source] ?? data.source,
    note: data.note,
    entryCount: data.count,
    totalCents: data.total.toString(),
  }));
}

function buildDefaultAllocationNote(trace: EntryTrace): string {
  const pct = Math.round(trace.estateRatio * 100);
  switch (trace.estateAllocation) {
    case 'MIXED':
      return `Gemischt: ${pct}% Neumasse, ${100 - pct}% Altmasse`;
    case 'ALTMASSE':
      return 'Vollständig Altmasse';
    case 'UNKLAR':
      return 'Zuordnung unklar (wird als Neumasse behandelt)';
    default:
      return `${trace.estateAllocation} (Ratio: ${trace.estateRatio})`;
  }
}

function buildEstateDescription(
  groups: CellExplanation['rules']['estateAllocation']['ruleGroups'],
  traces: EntryTrace[]
): string {
  if (groups.length === 0) {
    const allNeu = traces.every(t => t.estateAllocation === 'NEUMASSE');
    if (allNeu) {
      return 'Alle Buchungen sind vollständig Neumasse (keine Alt/Neu-Aufteilung nötig).';
    }
    return 'Keine explizite Alt/Neu-Zuordnungsregel.';
  }

  const totalEntries = groups.reduce((sum, g) => sum + g.entryCount, 0);
  return `${totalEntries} Buchung${totalEntries !== 1 ? 'en' : ''} mit Alt/Neu-Aufteilung:`;
}

function buildCategoryTagDescription(
  tag: string | null,
  source: string | null,
  tagCounts: Map<string, number>
): string {
  if (!tag) {
    return 'Kein Kategorie-Tag gesetzt. Zuordnung erfolgt über andere Kriterien (z.B. Gegenpartei-Name oder Buchungstext).';
  }

  const sourceLabel = source ? (TAG_SOURCE_LABELS[source] ?? source) : 'unbekannt';
  const uniqueTags = Array.from(tagCounts.keys());

  if (uniqueTags.length === 1) {
    return `Alle Buchungen haben Kategorie-Tag '${tag}' (${sourceLabel}).`;
  }

  const tagList = uniqueTags.map(t => `'${t}' (${tagCounts.get(t)}x)`).join(', ');
  return `Verschiedene Kategorie-Tags: ${tagList}. Häufigstes: '${tag}' (${sourceLabel}).`;
}

function buildCalculationSteps(
  traces: EntryTrace[],
  totalAmountCents: string,
  rowId: string
): CellExplanation['calculation']['steps'] {
  const steps: CellExplanation['calculation']['steps'] = [];

  // Schritt 1: Original-Beträge (vor Split)
  const originalTotal = traces.reduce((sum, t) => sum + BigInt(t.originalAmountCents), BigInt(0));
  if (traces.length > 0) {
    steps.push({
      label: 'Originale Buchungsbeträge',
      amountCents: originalTotal.toString(),
      entryCount: traces.length,
      description: `Summe der ${traces.length} Original-Buchung${traces.length !== 1 ? 'en' : ''} (vor Alt/Neu-Split)`,
    });
  }

  // Schritt 2: Nach Estate-Split (Neu-Anteil + Alt-Anteil getrennt)
  const mixedTraces = traces.filter(t => t.estateAllocation === 'MIXED');
  if (mixedTraces.length > 0) {
    const neuFromMixed = mixedTraces.reduce((sum, t) => {
      return sum + (t.neuMatch?.row.id === rowId ? BigInt(t.neuAnteilCents) : BigInt(0));
    }, BigInt(0));
    const altFromMixed = mixedTraces.reduce((sum, t) => {
      return sum + (t.altMatch?.row.id === rowId ? BigInt(t.altAnteilCents) : BigInt(0));
    }, BigInt(0));

    if (neuFromMixed !== BigInt(0)) {
      steps.push({
        label: 'Neumasse-Anteil (nach Split)',
        amountCents: neuFromMixed.toString(),
        entryCount: mixedTraces.filter(t => t.neuMatch?.row.id === rowId).length,
        description: `Neumasse-Anteil der gemischten Buchungen, der in diese Zeile fließt`,
      });
    }
    if (altFromMixed !== BigInt(0)) {
      steps.push({
        label: 'Altmasse-Anteil (nach Split)',
        amountCents: altFromMixed.toString(),
        entryCount: mixedTraces.filter(t => t.altMatch?.row.id === rowId).length,
        description: `Altmasse-Anteil der gemischten Buchungen, der in diese Zeile fließt`,
      });
    }
  }

  // Schritt 3: Reine Neumasse/Altmasse (kein Split)
  const pureNeu = traces.filter(t => t.estateAllocation === 'NEUMASSE' && t.neuMatch?.row.id === rowId);
  const pureAlt = traces.filter(t => t.estateAllocation === 'ALTMASSE' && t.altMatch?.row.id === rowId);

  if (pureNeu.length > 0 && (pureAlt.length > 0 || mixedTraces.length > 0)) {
    steps.push({
      label: 'Reine Neumasse-Buchungen',
      amountCents: pureNeu.reduce((s, t) => s + BigInt(t.neuAnteilCents), BigInt(0)).toString(),
      entryCount: pureNeu.length,
      description: `${pureNeu.length} Buchung${pureNeu.length !== 1 ? 'en' : ''} ohne Alt/Neu-Split`,
    });
  }

  // Gesamt (= tatsächlicher Zellenwert)
  steps.push({
    label: 'Ergebnis dieser Zelle',
    amountCents: totalAmountCents,
    entryCount: traces.length,
    description: 'Summe aller Anteile, die in diese Zeile geflossen sind',
  });

  return steps;
}

function buildEntryDetails(
  traces: EntryTrace[],
  rowId: string
): CellExplanation['entries'] {
  return traces.map(trace => {
    // Berechne den Anteil, der in DIESE Zeile geflossen ist
    let contributedCents = BigInt(0);
    let matchReason = '';

    if (trace.neuMatch?.row.id === rowId) {
      contributedCents += BigInt(trace.neuAnteilCents);
      matchReason = `Neumasse-Anteil via ${trace.neuMatch.matchDescription}`;
    }
    if (trace.altMatch?.row.id === rowId) {
      contributedCents += BigInt(trace.altAnteilCents);
      const altPart = `Altmasse-Anteil via ${trace.altMatch.matchDescription}`;
      matchReason = matchReason ? `${matchReason} + ${altPart}` : altPart;
    }

    return {
      id: trace.entryId,
      transactionDate: trace.transactionDate,
      amountCents: trace.originalAmountCents,
      description: trace.description,
      counterpartyName: trace.counterpartyName,
      locationName: trace.locationName,
      bankAccountName: trace.bankAccountName,
      valueType: trace.valueType,
      reviewStatus: trace.reviewStatus,
      estateAllocation: trace.estateAllocation,
      estateRatio: trace.estateRatio,
      contributedCents: contributedCents.toString(),
      matchReason,
      allocationSource: trace.allocationSource,
      allocationNote: trace.allocationNote,
    };
  });
}
