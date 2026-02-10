"use client";

/**
 * CellExplanationModal – Drill-Down einer Zelle der Liquiditätsmatrix
 *
 * 4-Ebenen-Erklärung:
 * 1. Zusammenfassung (immer offen)
 * 2. Zuordnungsregeln (immer offen)
 * 3. Rechenweg (zugeklappt)
 * 4. Einzelbuchungen (zugeklappt)
 */

import { useState, useEffect, useCallback } from "react";
import type { CellExplanation } from "@/lib/liquidity-matrix/types";

// =============================================================================
// TYPES
// =============================================================================

interface CellExplanationModalProps {
  caseId: string;
  rowId: string;
  periodIndex: number;
  scope: string;
  includeUnreviewed: boolean;
  onClose: () => void;
}

// =============================================================================
// HELPER
// =============================================================================

function formatEUR(cents: string, decimals = 0): string {
  const value = BigInt(cents);
  const euros = Number(value) / 100;
  const formatted = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(euros));
  return value < 0n ? `-${formatted} EUR` : `${formatted} EUR`;
}

function formatEURSigned(cents: string, decimals = 0): string {
  const value = BigInt(cents);
  const euros = Number(value) / 100;
  const formatted = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(euros));
  if (value > 0n) return `+${formatted} EUR`;
  if (value < 0n) return `-${formatted} EUR`;
  return "0 EUR";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function CellExplanationModal({
  caseId,
  rowId,
  periodIndex,
  scope,
  includeUnreviewed,
  onClose,
}: CellExplanationModalProps) {
  const [data, setData] = useState<CellExplanation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<'date' | 'amount' | 'contributed'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        rowId,
        periodIndex: periodIndex.toString(),
        scope,
        includeUnreviewed: includeUnreviewed.toString(),
      });
      const res = await fetch(`/api/cases/${caseId}/matrix/explain-cell?${params}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Fehler beim Laden der Erklärung");
      }
      const explanation = await res.json();
      setData(explanation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [caseId, rowId, periodIndex, scope, includeUnreviewed]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {data ? `${data.context.rowLabel} \u00B7 ${data.context.periodLabel}` : "Zellen-Erklärung"}
            </h2>
            {data && (
              <p className="text-sm text-gray-500 mt-0.5">{data.context.blockLabel}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-500">Erklärung wird geladen...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium">Fehler</p>
              <p className="text-red-700 text-sm mt-1">{error}</p>
              <button onClick={fetchData} className="mt-2 text-sm text-red-600 hover:text-red-800 underline">
                Erneut versuchen
              </button>
            </div>
          )}

          {data && (
            <>
              {/* Ebene 1: Zusammenfassung */}
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Zusammenfassung
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    {formatEUR(data.context.amountCents)}
                  </div>
                  <p className="text-sm text-gray-700">{data.context.summaryText}</p>
                  <div className="mt-3 flex gap-2 items-center">
                    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded ${
                      data.context.valueTypeUsed === "IST" ? "bg-green-100 text-green-700" :
                      data.context.valueTypeUsed === "PLAN" ? "bg-purple-100 text-purple-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {data.context.valueTypeUsed === "IST" ? "IST-Daten" :
                       data.context.valueTypeUsed === "PLAN" ? "PLAN-Daten" : "Gemischt (IST+PLAN)"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {data.context.periodStart} – {data.context.periodEnd}
                    </span>
                  </div>
                </div>
              </section>

              {/* Ebene 2: Zuordnungsregeln */}
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Zuordnungsregeln
                </h3>
                <div className="space-y-3">
                  {/* Zeilen-Zuordnung */}
                  <RuleBlock title="Zeilen-Zuordnung">
                    <p className="text-sm text-gray-700">{data.rules.rowMatching.ruleDescription}</p>
                    {data.rules.rowMatching.matchCriteria.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {data.rules.rowMatching.matchCriteria.map((c, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{c.label}</code>
                          </div>
                        ))}
                      </div>
                    )}
                    {data.rules.rowMatching.entryMatchBreakdown.length > 0 && (
                      <div className="mt-3 bg-blue-50 rounded p-3">
                        <p className="text-xs font-medium text-blue-900 mb-1">Tatsächliche Zuordnung der Buchungen:</p>
                        {data.rules.rowMatching.entryMatchBreakdown.map((b, i) => (
                          <div key={i} className="text-xs text-blue-800">
                            {b.description}
                          </div>
                        ))}
                      </div>
                    )}
                  </RuleBlock>

                  {/* Periode */}
                  <RuleBlock title="Perioden-Zuordnung">
                    <p className="text-sm text-gray-700">{data.rules.periodAssignment.ruleDescription}</p>
                  </RuleBlock>

                  {/* IST/PLAN */}
                  <RuleBlock title="IST/PLAN-Entscheidung">
                    <p className="text-sm text-gray-700">{data.rules.istPlanDecision.ruleDescription}</p>
                  </RuleBlock>

                  {/* Alt/Neu-Zuordnung */}
                  {data.rules.estateAllocation.ruleGroups.length > 0 ? (
                    <RuleBlock title="Alt/Neu-Zuordnung">
                      <p className="text-sm text-gray-700 mb-2">{data.rules.estateAllocation.ruleDescription}</p>
                      <div className="space-y-2">
                        {data.rules.estateAllocation.ruleGroups.map((group, i) => (
                          <div key={i} className="bg-amber-50 rounded p-2.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-amber-900">
                                {group.entryCount}x via {group.sourceLabel}
                              </span>
                              <span className="text-amber-700 tabular-nums">
                                {formatEUR(group.totalCents, 2)}
                              </span>
                            </div>
                            <div className="text-amber-800 mt-0.5 italic">&quot;{group.note}&quot;</div>
                          </div>
                        ))}
                      </div>
                    </RuleBlock>
                  ) : (
                    <RuleBlock title="Alt/Neu-Zuordnung">
                      <p className="text-sm text-gray-700">{data.rules.estateAllocation.ruleDescription}</p>
                    </RuleBlock>
                  )}

                  {/* Kategorie-Tag */}
                  <RuleBlock title="Kategorie-Tag">
                    <p className="text-sm text-gray-700">{data.rules.categoryTag.ruleDescription}</p>
                    {data.rules.categoryTag.tagSourceLabel && (
                      <p className="text-xs text-gray-500 mt-1">
                        Quelle: {data.rules.categoryTag.tagSourceLabel}
                      </p>
                    )}
                  </RuleBlock>
                </div>
              </section>

              {/* Ebene 3: Rechenweg (zugeklappt) */}
              <CollapsibleSection
                title="Rechenweg"
                isExpanded={expandedSections.has("calculation")}
                onToggle={() => toggleSection("calculation")}
              >
                <div className="space-y-1">
                  {data.calculation.steps.map((step, i) => {
                    const isLast = i === data.calculation.steps.length - 1;
                    return (
                      <div
                        key={i}
                        className={`py-2.5 ${isLast ? "border-t-2 border-gray-300 mt-2 pt-3" : "border-b border-gray-100"}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className={`text-sm ${isLast ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                              {step.label}
                            </span>
                          </div>
                          <span className={`text-sm tabular-nums font-mono ${isLast ? "font-bold" : ""}`}>
                            {formatEURSigned(step.amountCents, 2)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>

              {/* Ebene 4: Einzelbuchungen (zugeklappt) */}
              <CollapsibleSection
                title={`Einzelbuchungen (${data.entries.length})`}
                isExpanded={expandedSections.has("entries")}
                onToggle={() => toggleSection("entries")}
              >
                {data.entries.length === 0 ? (
                  <p className="text-sm text-gray-500">Keine Buchungen in dieser Zelle.</p>
                ) : (
                  <div className="space-y-3">
                    {/* Sort-Buttons */}
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-gray-500 mr-1">Sortierung:</span>
                      <SortButton label="Datum" active={sortKey === 'date'} dir={sortKey === 'date' ? sortDir : undefined} onClick={() => {
                        if (sortKey === 'date') { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
                        else { setSortKey('date'); setSortDir('asc'); }
                      }} />
                      <SortButton label="Betrag" active={sortKey === 'amount'} dir={sortKey === 'amount' ? sortDir : undefined} onClick={() => {
                        if (sortKey === 'amount') { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
                        else { setSortKey('amount'); setSortDir('desc'); }
                      }} />
                      <SortButton label="Anteil" active={sortKey === 'contributed'} dir={sortKey === 'contributed' ? sortDir : undefined} onClick={() => {
                        if (sortKey === 'contributed') { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
                        else { setSortKey('contributed'); setSortDir('desc'); }
                      }} />
                    </div>
                    {sortEntries(data.entries, sortKey, sortDir).map((entry) => (
                      <div key={entry.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                        {/* Zeile 1: Datum + Betrag + Badges */}
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">
                              {formatDate(entry.transactionDate)}
                            </span>
                            <span className={`inline-block px-1.5 py-0.5 text-xs rounded ${
                              entry.valueType === "IST" ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700"
                            }`}>
                              {entry.valueType}
                            </span>
                            <span className={`inline-block px-1.5 py-0.5 text-xs rounded ${
                              entry.estateAllocation === "NEUMASSE" ? "bg-blue-50 text-blue-600" :
                              entry.estateAllocation === "ALTMASSE" ? "bg-amber-100 text-amber-700" :
                              entry.estateAllocation === "MIXED" ? "bg-orange-100 text-orange-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>
                              {entry.estateAllocation === "NEUMASSE" ? "Neumasse" :
                               entry.estateAllocation === "ALTMASSE" ? "Altmasse" :
                               entry.estateAllocation === "MIXED" ? `Gemischt ${Math.round(entry.estateRatio * 100)}% Neu` :
                               entry.estateAllocation}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm tabular-nums text-gray-600">
                              Gesamt: {formatEUR(entry.amountCents, 2)}
                            </div>
                            <div className="text-sm tabular-nums font-semibold text-blue-700">
                              Anteil: {formatEURSigned(entry.contributedCents, 2)}
                            </div>
                          </div>
                        </div>

                        {/* Zeile 2: Beschreibung (vollständig) */}
                        <p className="text-xs text-gray-800 leading-relaxed break-words">
                          {entry.description}
                        </p>

                        {/* Zeile 3: Zuordnungsgrund + Details */}
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          {entry.matchReason && (
                            <span title="Warum diese Buchung in dieser Zeile landet">
                              Zuordnung: {entry.matchReason}
                            </span>
                          )}
                          {entry.counterpartyName && (
                            <span>Gegenpartei: {entry.counterpartyName}</span>
                          )}
                          {entry.bankAccountName && (
                            <span>Bank: {entry.bankAccountName}</span>
                          )}
                          {entry.locationName && (
                            <span>Standort: {entry.locationName}</span>
                          )}
                        </div>

                        {/* Zeile 4: Allocation Note */}
                        {entry.allocationNote && (
                          <div className="mt-1.5 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 italic">
                            {entry.allocationNote}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleSection>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Erklärung basiert auf den konfigurierten Zuordnungsregeln
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SORT
// =============================================================================

type SortableEntry = CellExplanation['entries'][number];

function sortEntries(
  entries: SortableEntry[],
  key: 'date' | 'amount' | 'contributed',
  dir: 'asc' | 'desc'
): SortableEntry[] {
  const sorted = [...entries].sort((a, b) => {
    switch (key) {
      case 'date':
        return a.transactionDate.localeCompare(b.transactionDate);
      case 'amount': {
        const aVal = BigInt(a.amountCents);
        const bVal = BigInt(b.amountCents);
        // Absolutwerte vergleichen für Betragssortierung
        const aAbs = aVal < 0n ? -aVal : aVal;
        const bAbs = bVal < 0n ? -bVal : bVal;
        return aAbs < bAbs ? -1 : aAbs > bAbs ? 1 : 0;
      }
      case 'contributed': {
        const aCon = BigInt(a.contributedCents);
        const bCon = BigInt(b.contributedCents);
        const aAbs = aCon < 0n ? -aCon : aCon;
        const bAbs = bCon < 0n ? -bCon : bCon;
        return aAbs < bAbs ? -1 : aAbs > bAbs ? 1 : 0;
      }
    }
  });
  return dir === 'desc' ? sorted.reverse() : sorted;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function RuleBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h4>
      {children}
    </div>
  );
}

function CollapsibleSection({
  title,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-gray-200 rounded-lg">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors rounded-lg"
      >
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-700">
          {title}
        </h3>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </section>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir?: 'asc' | 'desc';
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded text-xs transition-colors ${
        active
          ? "bg-blue-100 text-blue-700 font-medium"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {label}
      {active && dir && (
        <span className="ml-0.5">{dir === 'asc' ? '\u2191' : '\u2193'}</span>
      )}
    </button>
  );
}
