"use client";

/**
 * LiquidityMatrixTable – IV-konforme Liquiditätstabelle
 *
 * Zeigt die Liquiditätsentwicklung in IV-üblicher Struktur:
 * - Anfangsbestand (mit Banksplit)
 * - Cash-In (KV, HZV, PVS, etc.)
 * - Cash-Out (Operativ, Steuern, Insolvenz)
 * - Endbestand (mit Banksplit)
 *
 * Features:
 * - Toggle: Gesamt / Altmasse / Neumasse / Unklar
 * - Toggle: Nur Summen / Mit Detailzeilen
 * - Validierungs-Warnungen (Rechenfehler, Negativsaldo, Unklar-Anteil)
 * - IST/PLAN-Badge pro Periode
 */

import { useState, useEffect, useCallback, Fragment } from "react";

// =============================================================================
// TYPES (from API)
// =============================================================================

interface MatrixPeriod {
  periodIndex: number;
  periodLabel: string;
  periodStartDate: string;
  periodEndDate: string;
  valueType: "IST" | "PLAN" | "MIXED";
}

interface MatrixRowValue {
  rowId: string;
  periodIndex: number;
  amountCents: string;
  entryCount: number;
}

interface MatrixRow {
  id: string;
  label: string;
  labelShort?: string;
  block: string;
  order: number;
  isSubRow: boolean;
  isSummary: boolean;
  isSectionHeader?: boolean;
  flowType?: "INFLOW" | "OUTFLOW";
  values: MatrixRowValue[];
  total: string;
}

interface MatrixBlock {
  id: string;
  label: string;
  order: number;
  rows: MatrixRow[];
  totals: string[];
}

interface LiquidityMatrixData {
  caseId: string;
  caseName: string;
  scope: LiquidityScope;
  scopeLabel: string;
  scopeHint: string | null;
  periods: MatrixPeriod[];
  blocks: MatrixBlock[];
  validation: {
    hasBalanceError: boolean;
    hasNegativeBalance: boolean;
    unklearPercentage: number;
    errorPeriods: number[];
  };
  meta: {
    entryCount: number;
    istCount: number;
    planCount: number;
    planIgnoredCount: number;
    unklearCount: number;
    unreviewedCount: number;
    includeUnreviewed: boolean;
    generatedAt: string;
  };
}

type EstateFilter = "GESAMT" | "ALTMASSE" | "NEUMASSE" | "UNKLAR";

// Exported for use in parent components
export type LiquidityScope = "GLOBAL" | "LOCATION_VELBERT" | "LOCATION_UCKERATH_EITORF";

export const SCOPE_LABELS: Record<LiquidityScope, string> = {
  GLOBAL: "Gesamt",
  LOCATION_VELBERT: "Velbert",
  LOCATION_UCKERATH_EITORF: "Uckerath/Eitorf",
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatCurrency(cents: string | bigint, showSign = false): string {
  const value = typeof cents === "string" ? BigInt(cents) : cents;
  const euros = Number(value) / 100;
  const formatted = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(euros));

  if (showSign && value !== BigInt(0)) {
    return value >= 0 ? `+${formatted}` : `-${formatted}`;
  }
  return value < 0 ? `-${formatted}` : formatted;
}

function getBlockColorClass(blockId: string): string {
  switch (blockId) {
    case "OPENING_BALANCE":
      return "bg-gray-50";
    case "CASH_IN":
      return "bg-green-50";
    case "CASH_OUT_OPERATIVE":
      return "bg-red-50";
    case "CASH_OUT_TAX":
      return "bg-orange-50";
    case "CASH_OUT_INSOLVENCY":
      return "bg-purple-50";
    case "CASH_OUT_TOTAL":
      return "bg-red-100";
    case "CLOSING_BALANCE":
      return "bg-blue-50";
    default:
      return "bg-white";
  }
}

function getValueTypeColor(valueType: string): { bg: string; text: string } {
  switch (valueType) {
    case "IST":
      return { bg: "bg-green-100", text: "text-green-700" };
    case "PLAN":
      return { bg: "bg-purple-100", text: "text-purple-700" };
    default:
      return { bg: "bg-gray-100", text: "text-gray-600" };
  }
}

/**
 * Prüft, ob eine Zeile im aktuellen estateFilter angezeigt werden soll.
 * estateFilter wirkt NUR im Frontend (zeilen-ausblendung), Backend liefert IMMER GESAMT.
 */
function shouldShowRow(rowId: string, estateFilter: EstateFilter): boolean {
  // GESAMT: Alle Zeilen anzeigen
  if (estateFilter === 'GESAMT') return true;

  // NEUMASSE: Neumasse-Einnahmen + ALLE Ausgaben + Balances
  if (estateFilter === 'NEUMASSE') {
    // Zeige alles AUSSER Altforderungs-Zeilen
    return !rowId.includes('altforderung');
  }

  // ALTMASSE: Nur Altforderungs-Einnahmen + Balances + Summenzeilen
  if (estateFilter === 'ALTMASSE') {
    // Zeige: Balances, Cash-In-Total, Altforderungs-Zeilen
    const altmasseRows = [
      // Balances
      'opening_balance_total',
      'closing_balance_total',
      // Bank-spezifische Balances
      'opening_balance_isk_velbert',
      'opening_balance_sparkasse_velbert',
      'opening_balance_isk_uckerath',
      'opening_balance_apobank_uckerath',
      'opening_balance_apobank_hvplus',
      'closing_balance_isk_velbert',
      'closing_balance_sparkasse_velbert',
      'closing_balance_isk_uckerath',
      'closing_balance_apobank_uckerath',
      'closing_balance_apobank_hvplus',
      // Cash-In Summe
      'cash_in_total',
      // Altforderungs-Zeilen
      'cash_in_altforderung_header',
      'cash_in_altforderung_hzv',
      'cash_in_altforderung_kv',
      'cash_in_altforderung_pvs',
    ];
    return altmasseRows.includes(rowId);
  }

  // UNKLAR: Zeige nur Zeilen mit unklar-Anteil (aktuell nicht implementiert)
  if (estateFilter === 'UNKLAR') {
    return false;
  }

  return true;
}

// =============================================================================
// COMPONENT
// =============================================================================

interface LiquidityMatrixTableProps {
  caseId: string;
  className?: string;
  /** Controlled scope (from parent) - if provided, hides local scope toggle */
  scope?: LiquidityScope;
  onScopeChange?: (scope: LiquidityScope) => void;
  /** If true, hides the scope toggle (useful when parent shows global scope toggle) */
  hideScopeToggle?: boolean;
}

export default function LiquidityMatrixTable({
  caseId,
  className = "",
  scope: controlledScope,
  onScopeChange,
  hideScopeToggle = false,
}: LiquidityMatrixTableProps) {
  const [data, setData] = useState<LiquidityMatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Toggles
  const [estateFilter, setEstateFilter] = useState<EstateFilter>("GESAMT");
  const [showDetails, setShowDetails] = useState(true);
  const [localScope, setLocalScope] = useState<LiquidityScope>("GLOBAL");
  const [includeUnreviewed, setIncludeUnreviewed] = useState(false);
  const [showLocationBreakdown, setShowLocationBreakdown] = useState(false);
  const [locationData, setLocationData] = useState<Record<string, LiquidityMatrixData>>({});
  const [locationLoading, setLocationLoading] = useState(false);

  // Collapsible Bank Rows - standardmäßig eingeklappt
  const [collapsedBankBlocks, setCollapsedBankBlocks] = useState<Set<string>>(
    new Set(["OPENING_BALANCE", "CLOSING_BALANCE"])
  );

  const toggleBankBlock = (blockId: string) => {
    setCollapsedBankBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  };

  // Use controlled scope if provided, otherwise use local state
  const isControlled = controlledScope !== undefined;
  const scope = isControlled ? controlledScope : localScope;
  const setScope = isControlled && onScopeChange ? onScopeChange : setLocalScope;

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        // KEIN estateFilter mehr! Backend liefert IMMER GESAMT.
        // estateFilter wirkt nur im Frontend (zeilen-ausblendung).
        showDetails: showDetails.toString(),
        scope,
        includeUnreviewed: includeUnreviewed.toString(),
      });

      const res = await fetch(`/api/cases/${caseId}/dashboard/liquidity-matrix?${params}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Fehler beim Laden der Daten");
      }

      const matrixData = await res.json();
      setData(matrixData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [caseId, showDetails, scope, includeUnreviewed]);  // estateFilter NICHT mehr hier!

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch location breakdown data (parallel fetch for Velbert + Uckerath/Eitorf)
  useEffect(() => {
    if (!showLocationBreakdown || scope !== "GLOBAL") {
      setLocationData({});
      return;
    }

    let cancelled = false;
    const fetchLocations = async () => {
      setLocationLoading(true);
      try {
        const baseParams = new URLSearchParams({
          // KEIN estateFilter mehr - Backend liefert IMMER GESAMT
          showDetails: "true",
          includeUnreviewed: includeUnreviewed.toString(),
        });

        const [velbert, uckerath] = await Promise.all([
          fetch(`/api/cases/${caseId}/dashboard/liquidity-matrix?${baseParams}&scope=LOCATION_VELBERT`, { credentials: "include" }).then(r => r.json()),
          fetch(`/api/cases/${caseId}/dashboard/liquidity-matrix?${baseParams}&scope=LOCATION_UCKERATH_EITORF`, { credentials: "include" }).then(r => r.json()),
        ]);

        if (!cancelled) {
          setLocationData({
            LOCATION_VELBERT: velbert,
            LOCATION_UCKERATH_EITORF: uckerath,
          });
        }
      } catch (err) {
        console.error("Standort-Aufgliederung Fehler:", err);
      } finally {
        if (!cancelled) setLocationLoading(false);
      }
    };

    fetchLocations();
    return () => { cancelled = true; };
  }, [showLocationBreakdown, scope, caseId, includeUnreviewed]);  // estateFilter NICHT mehr hier!

  // Helper: Find row in location data
  function getLocationRow(locationKey: string, rowId: string): MatrixRow | null {
    const locData = locationData[locationKey];
    if (!locData) return null;
    for (const block of locData.blocks) {
      const row = block.rows.find(r => r.id === rowId);
      if (row) return row;
    }
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className={`admin-card p-6 ${className}`}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-500">Liquiditätsmatrix wird berechnet...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`admin-card p-6 ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-800 font-medium">Fehler beim Laden</span>
          </div>
          <p className="text-red-700 text-sm mt-1">{error}</p>
          <button
            onClick={fetchData}
            className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  // No data
  if (!data) {
    return (
      <div className={`admin-card p-6 ${className}`}>
        <p className="text-gray-500 text-center">Keine Daten verfügbar</p>
      </div>
    );
  }

  return (
    <div className={`admin-card ${className}`}>
      {/* Header with Toggles */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Liquiditätstabelle</h2>
            <p className="text-sm text-gray-500 mt-1">
              {data.meta.entryCount} Buchungen | {data.meta.istCount} IST | {data.meta.planCount} PLAN
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Scope Toggle (Standort-Sicht) - hide when requested via prop */}
            {!hideScopeToggle && (
              <div className="flex items-center gap-1 bg-indigo-100 rounded-lg p-1">
                <span className="px-2 text-xs font-medium text-indigo-600">Sicht:</span>
                {(["GLOBAL", "LOCATION_VELBERT", "LOCATION_UCKERATH_EITORF"] as LiquidityScope[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      scope === s
                        ? "bg-white shadow-sm text-indigo-900"
                        : "text-indigo-700 hover:text-indigo-900"
                    }`}
                  >
                    {SCOPE_LABELS[s]}
                  </button>
                ))}
              </div>
            )}

            {/* Estate Filter Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {(["GESAMT", "ALTMASSE", "NEUMASSE", "UNKLAR"] as EstateFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setEstateFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    estateFilter === filter
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {filter === "GESAMT" ? "Gesamt" : filter === "ALTMASSE" ? "Alt" : filter === "NEUMASSE" ? "Neu" : "Unklar"}
                </button>
              ))}
            </div>

            {/* Detail Toggle */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                showDetails
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-gray-100 border-gray-200 text-gray-600"
              }`}
            >
              {showDetails ? "Mit Details" : "Nur Summen"}
            </button>

            {/* Unreviewed Toggle (Admin-Feature) */}
            <label className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer transition-colors bg-gray-50 border-gray-200 hover:bg-gray-100">
              <input
                type="checkbox"
                checked={includeUnreviewed}
                onChange={(e) => setIncludeUnreviewed(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <span className={includeUnreviewed ? "text-amber-700" : "text-gray-600"}>
                inkl. ungeprüfte
              </span>
            </label>

            {/* Location Breakdown Toggle (nur in Gesamtsicht) */}
            {scope === "GLOBAL" && (
              <label className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer transition-colors bg-gray-50 border-gray-200 hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={showLocationBreakdown}
                  onChange={(e) => setShowLocationBreakdown(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className={showLocationBreakdown ? "text-indigo-700" : "text-gray-600"}>
                  {locationLoading ? "Lade..." : "Standort-Aufgliederung"}
                </span>
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Unreviewed Warning Banner */}
      {data.meta.includeUnreviewed && data.meta.unreviewedCount > 0 && (
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium text-amber-900">Ungeprüfte Buchungen enthalten</span>
            <span className="text-amber-700">
              {data.meta.unreviewedCount} von {data.meta.entryCount} Buchungen sind noch nicht geprüft.
              Diese Zahlen sind vorläufig.
            </span>
          </div>
        </div>
      )}

      {/* IST-Vorrang Info Banner */}
      {data.meta.planIgnoredCount > 0 && (
        <div className="px-6 py-3 bg-green-50 border-b border-green-200">
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium text-green-900">IST-Daten verwendet</span>
            <span className="text-green-700">
              {data.meta.planIgnoredCount} PLAN-Buchungen wurden durch IST-Daten ersetzt.
            </span>
          </div>
        </div>
      )}

      {/* Scope Hint Banner (nur bei Standort-Scopes) */}
      {data.scopeHint && (
        <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-200">
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-medium text-indigo-900">Standort-Sicht: {data.scopeLabel}</span>
            <span className="text-indigo-700">{data.scopeHint}</span>
          </div>
        </div>
      )}

      {/* Validation Warnings */}
      {(data.validation.hasBalanceError || data.validation.hasNegativeBalance || data.validation.unklearPercentage > 10) && (
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200">
          <div className="flex flex-wrap gap-4 text-sm">
            {data.validation.hasBalanceError && (
              <div className="flex items-center gap-2 text-amber-800">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Rechendifferenz in Periode(n): {data.validation.errorPeriods.map(p => data.periods[p]?.periodLabel).join(", ")}</span>
              </div>
            )}
            {data.validation.hasNegativeBalance && (
              <div className="flex items-center gap-2 text-red-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
                <span>Negativer Endbestand</span>
              </div>
            )}
            {data.validation.unklearPercentage > 10 && (
              <div className="flex items-center gap-2 text-amber-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{data.validation.unklearPercentage.toFixed(1)}% UNKLAR</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-auto max-h-[75vh]">
        <table className="w-full text-sm">
          {/* Sticky Header */}
          <thead className="sticky top-0 z-20">
            {/* Header Row 1: IST/PLAN Badges */}
            <tr className="border-b border-gray-200 bg-white">
              <th className="px-4 py-2 text-left font-medium text-gray-700 sticky left-0 bg-white z-30 min-w-[200px]">
                Position
              </th>
              {data.periods.map((period) => {
                const colors = getValueTypeColor(period.valueType);
                return (
                  <th key={period.periodIndex} className="px-2 py-2 text-center min-w-[80px] bg-white">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${colors.bg} ${colors.text}`}>
                      {period.valueType}
                    </span>
                  </th>
                );
              })}
              <th className="px-4 py-2 text-right font-medium text-gray-700 min-w-[100px] bg-white">
                Summe
              </th>
            </tr>

            {/* Header Row 2: Period Labels */}
            <tr className="border-b border-gray-300 bg-gray-50">
              <th className="px-4 py-2 text-left font-semibold text-gray-900 sticky left-0 bg-gray-50 z-30">
                Periode
              </th>
              {data.periods.map((period) => (
                <th key={period.periodIndex} className="px-2 py-2 text-center font-semibold text-gray-900 bg-gray-50">
                  {period.periodLabel}
                </th>
              ))}
              <th className="px-4 py-2 text-right font-semibold text-gray-900 bg-gray-50">
                Gesamt
              </th>
            </tr>
          </thead>

          <tbody>
            {data.blocks
              .filter((block) => block.rows.length > 0)  // Skip empty blocks
              .map((block) => {
                // Berechne gefilterte Block-Summe (nur sichtbare Zeilen)
                const filteredBlockTotals = data.periods.map((_, periodIdx) => {
                  let sum = BigInt(0);
                  for (const row of block.rows) {
                    // Skip section headers, summary rows, and filtered rows
                    if (row.isSectionHeader || row.isSummary) continue;
                    if (!shouldShowRow(row.id, estateFilter)) continue;
                    const value = row.values.find(v => v.periodIndex === periodIdx);
                    if (value) {
                      sum += BigInt(value.amountCents);
                    }
                  }
                  return sum;
                });

                return (
              <>
                {/* Block rows */}
                {block.rows.map((row) => {
                  // estateFilter: Zeile ausblenden, wenn sie nicht zum Filter passt
                  if (!shouldShowRow(row.id, estateFilter) && !row.isSummary) {
                    return null;
                  }

                  // Section headers: Nur anzeigen wenn mind. 1 Zeile darunter sichtbar ist
                  if (row.isSectionHeader) {
                    // Prüfe, ob nachfolgende Zeilen sichtbar sind
                    const hasVisibleChildren = block.rows.some(r =>
                      !r.isSectionHeader &&
                      r.order > row.order &&
                      shouldShowRow(r.id, estateFilter)
                    );
                    if (!hasVisibleChildren) return null;

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-gray-200"
                      >
                        <td
                          colSpan={data.periods.length + 2}
                          className="px-4 py-1.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50/70 sticky left-0 z-10"
                        >
                          {row.label}
                        </td>
                      </tr>
                    );
                  }

                  // Skip bank account sub-rows wenn Block collapsed ist
                  const isBankRow = (block.id === "OPENING_BALANCE" || block.id === "CLOSING_BALANCE") &&
                                    row.isSubRow &&
                                    row.id.includes("balance_");

                  if (isBankRow && collapsedBankBlocks.has(block.id)) {
                    return null;
                  }

                  // Bei Summary-Zeilen: Verwende gefilterte Gesamt-Summe wenn estateFilter aktiv
                  const rowTotal = row.isSummary && estateFilter !== 'GESAMT'
                    ? filteredBlockTotals.reduce((sum, val) => sum + val, BigInt(0))
                    : BigInt(row.total);

                  const isNegative = rowTotal < BigInt(0);
                  const bgClass = row.isSummary ? getBlockColorClass(block.id) : "";
                  const showBreakdown = showLocationBreakdown && scope === "GLOBAL" && !row.isSummary && Object.keys(locationData).length > 0;

                  // Bank Block Total Row ist clickable zum Expand/Collapse
                  const isBankBlockTotal = row.isSummary && (block.id === "OPENING_BALANCE" || block.id === "CLOSING_BALANCE");
                  const isExpanded = !collapsedBankBlocks.has(block.id);

                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={`border-b border-gray-100 ${bgClass} ${
                          row.isSummary ? "font-semibold" : ""
                        } ${isBankBlockTotal ? "cursor-pointer hover:bg-gray-100" : "hover:bg-gray-50"}`}
                        onClick={isBankBlockTotal ? () => toggleBankBlock(block.id) : undefined}
                      >
                        {/* Row Label */}
                        <td
                          className={`px-4 py-2 text-left sticky left-0 z-10 ${bgClass || "bg-white"} ${
                            row.isSubRow ? "pl-8 text-gray-600" : "text-gray-900"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isBankBlockTotal && (
                              <svg
                                className={`w-4 h-4 text-gray-500 transition-transform ${
                                  isExpanded ? "rotate-90" : ""
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            )}
                            <span>{row.label}</span>
                            {isBankBlockTotal && (
                              <span className="text-xs text-gray-400 font-normal">
                                ({isExpanded ? "aufgeklappt" : "eingeklappt"})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Period Values */}
                        {row.values.map((value) => {
                          // Bei Summary-Zeilen: Verwende gefilterte Summen wenn estateFilter aktiv
                          const amount = row.isSummary && estateFilter !== 'GESAMT'
                            ? filteredBlockTotals[value.periodIndex]
                            : BigInt(value.amountCents);

                          const isValueNegative = amount < BigInt(0);
                          const isError = data.validation.errorPeriods.includes(value.periodIndex) && row.isSummary && block.id === "CLOSING_BALANCE";
                          const hasNoData = value.entryCount === -1;

                          return (
                            <td
                              key={`${row.id}-${value.periodIndex}`}
                              className={`px-2 py-2 text-right tabular-nums ${
                                hasNoData ? "text-gray-300" : isValueNegative ? "text-red-600" : row.flowType === "INFLOW" ? "text-green-600" : ""
                              } ${isError ? "bg-red-100" : ""}`}
                            >
                              {hasNoData ? "–" : formatCurrency(amount.toString())}
                            </td>
                          );
                        })}

                        {/* Row Total */}
                        <td
                          className={`px-4 py-2 text-right tabular-nums font-medium ${
                            isNegative ? "text-red-600" : row.flowType === "INFLOW" ? "text-green-600" : ""
                          }`}
                        >
                          {formatCurrency(rowTotal.toString())}
                        </td>
                      </tr>

                      {/* Standort-Aufgliederung Sub-Rows */}
                      {showBreakdown && (
                        <>
                          {(["LOCATION_VELBERT", "LOCATION_UCKERATH_EITORF"] as const).map((locKey) => {
                            const locRow = getLocationRow(locKey, row.id);
                            if (!locRow) return null;
                            const locTotal = BigInt(locRow.total);
                            const locNegative = locTotal < BigInt(0);

                            return (
                              <tr
                                key={`${row.id}-${locKey}`}
                                className="border-b border-gray-50"
                              >
                                <td className="pl-12 pr-4 py-1 text-left text-xs text-gray-400 italic sticky left-0 bg-white z-10">
                                  {SCOPE_LABELS[locKey]}
                                </td>
                                {locRow.values.map((value) => {
                                  const amount = BigInt(value.amountCents);
                                  const isLocNeg = amount < BigInt(0);
                                  return (
                                    <td
                                      key={`${row.id}-${locKey}-${value.periodIndex}`}
                                      className={`px-2 py-1 text-right text-xs tabular-nums ${
                                        isLocNeg ? "text-red-400" : amount > BigInt(0) ? "text-gray-400" : "text-gray-300"
                                      }`}
                                    >
                                      {amount === BigInt(0) ? "\u2013" : formatCurrency(value.amountCents)}
                                    </td>
                                  );
                                })}
                                <td
                                  className={`px-4 py-1 text-right text-xs tabular-nums ${
                                    locNegative ? "text-red-400" : locTotal > BigInt(0) ? "text-gray-400" : "text-gray-300"
                                  }`}
                                >
                                  {locTotal === BigInt(0) ? "\u2013" : formatCurrency(locRow.total)}
                                </td>
                              </tr>
                            );
                          })}
                        </>
                      )}
                    </Fragment>
                  );
                })}

                {/* Spacing row after block (except last) */}
                {block.order < data.blocks.length && (
                  <tr className="h-2 bg-white">
                    <td colSpan={data.periods.length + 2}></td>
                  </tr>
                )}
              </>
            );
              })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
        <span>
          Stand: {new Date(data.meta.generatedAt).toLocaleString("de-DE")}
        </span>
        <span>
          Beträge in EUR (gerundet)
        </span>
      </div>
    </div>
  );
}
