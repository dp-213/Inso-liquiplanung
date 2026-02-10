"use client";

/**
 * LiquidityMatrixTable – IDW S11-konforme Liquiditätstabelle
 *
 * 4-Block-Struktur:
 * I.  Finanzmittelbestand Periodenanfang
 * II. Einzahlungen (mit Standort-Aufgliederung via Collapse)
 * III. Auszahlungen (Personal, Betriebskosten, Steuern, Insolvenz)
 * IV. Liquiditätsentwicklung (Veränderung, Kreditlinie, Rückstellungen)
 *
 * Features:
 * - Collapse/Expand für Detail-Zeilen (parentRowId-basiert)
 * - Standort-Aufgliederung per lazy-load bei Expand
 * - Alt/Neu-Filter (zeilen-basiert im Frontend)
 * - IST/PLAN-Badge pro Periode
 * - Cell-Explanation Modal (Drill-Down)
 */

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import CellExplanationModal from "@/components/admin/CellExplanationModal";

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
  isSubtotal?: boolean;
  parentRowId?: string;
  defaultExpanded?: boolean;
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

interface LiquidityDevelopmentData {
  creditLineCents: string;
  creditLineStatus: string;
  creditLineNote: string | null;
  reservesTotalCents: string;
  reserveDetails: Array<{
    name: string;
    amountCents: string;
    effectGroup: string;
  }>;
}

interface LiquidityMatrixData {
  caseId: string;
  caseName: string;
  scope: LiquidityScope;
  scopeLabel: string;
  scopeHint: string | null;
  periods: MatrixPeriod[];
  blocks: MatrixBlock[];
  liquidityDevelopment: LiquidityDevelopmentData;
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
    case "CASH_OUT":
      return "bg-red-50";
    case "LIQUIDITY_DEVELOPMENT":
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
 */
function shouldShowRow(rowId: string, estateFilter: EstateFilter): boolean {
  if (estateFilter === "GESAMT") return true;

  // Balances, Ausgaben, Liquiditätsentwicklung immer anzeigen
  const alwaysShow =
    rowId.startsWith("opening_balance_") ||
    rowId.startsWith("closing_balance_") ||
    rowId.startsWith("cash_out_") ||
    rowId.startsWith("liquidity_") ||
    rowId.startsWith("credit_line") ||
    rowId.startsWith("coverage_") ||
    rowId.startsWith("reserves_") ||
    rowId === "cash_in_total";

  if (alwaysShow) return true;

  if (estateFilter === "NEUMASSE") {
    return !rowId.includes("altforderung");
  }

  if (estateFilter === "ALTMASSE") {
    return rowId.includes("altforderung");
  }

  if (estateFilter === "UNKLAR") {
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
  scope?: LiquidityScope;
  onScopeChange?: (scope: LiquidityScope) => void;
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

  // Cell Explanation Modal
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; periodIndex: number } | null>(null);

  // Collapse/Expand State (parentRowId-basiert)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Location breakdown data (lazy-loaded for Standort-Kinder)
  const [locationData, setLocationData] = useState<Record<string, LiquidityMatrixData>>({});
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationLoaded, setLocationLoaded] = useState(false);

  const isControlled = controlledScope !== undefined;
  const scope = isControlled ? controlledScope : localScope;
  const setScope = isControlled && onScopeChange ? onScopeChange : setLocalScope;

  // Initialize expandedRows from config when data loads
  useEffect(() => {
    if (!data) return;
    const initial = new Set<string>();
    for (const block of data.blocks) {
      for (const row of block.rows) {
        // Rows with children that have defaultExpanded !== false → expanded
        const hasChildren = block.rows.some(r => r.parentRowId === row.id);
        if (hasChildren && row.defaultExpanded !== false) {
          initial.add(row.id);
        }
      }
    }
    setExpandedRows(initial);
  }, [data]);

  // Build set of parent row IDs for quick lookup
  const parentRowIds = useMemo(() => {
    if (!data) return new Set<string>();
    const ids = new Set<string>();
    for (const block of data.blocks) {
      for (const row of block.rows) {
        if (row.parentRowId) {
          ids.add(row.parentRowId);
        }
      }
    }
    return ids;
  }, [data]);

  const toggleRow = useCallback((rowId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  // Fetch main data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
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
  }, [caseId, showDetails, scope, includeUnreviewed]);

  useEffect(() => {
    fetchData();
    // Reset location data when scope changes
    setLocationData({});
    setLocationLoaded(false);
  }, [fetchData]);

  // Lazy-load location data when a Standort-Kind row is expanded
  const loadLocationData = useCallback(async () => {
    if (locationLoaded || locationLoading || scope !== "GLOBAL") return;

    setLocationLoading(true);
    try {
      const baseParams = new URLSearchParams({
        showDetails: "true",
        includeUnreviewed: includeUnreviewed.toString(),
      });

      const [velbert, uckerath] = await Promise.all([
        fetch(`/api/cases/${caseId}/dashboard/liquidity-matrix?${baseParams}&scope=LOCATION_VELBERT`, { credentials: "include" }).then(r => r.json()),
        fetch(`/api/cases/${caseId}/dashboard/liquidity-matrix?${baseParams}&scope=LOCATION_UCKERATH_EITORF`, { credentials: "include" }).then(r => r.json()),
      ]);

      setLocationData({
        LOCATION_VELBERT: velbert,
        LOCATION_UCKERATH_EITORF: uckerath,
      });
      setLocationLoaded(true);
    } catch (err) {
      console.error("Standort-Aufgliederung Fehler:", err);
    } finally {
      setLocationLoading(false);
    }
  }, [locationLoaded, locationLoading, scope, caseId, includeUnreviewed]);

  // Trigger location load when expanding a row that has Standort children
  const handleToggleRow = useCallback((rowId: string) => {
    toggleRow(rowId);

    // Check if this row has location-children (ending in _velbert or _uckerath)
    if (!locationLoaded && data) {
      for (const block of data.blocks) {
        const hasLocChildren = block.rows.some(r =>
          r.parentRowId === rowId && (r.id.endsWith("_velbert") || r.id.endsWith("_uckerath"))
        );
        if (hasLocChildren) {
          loadLocationData();
          break;
        }
      }
    }
  }, [toggleRow, locationLoaded, data, loadLocationData]);

  // Helper: Find row values in location data for Standort-Kinder
  function getLocationRowValues(locationKey: string, sourceRowId: string): MatrixRowValue[] | null {
    const locData = locationData[locationKey];
    if (!locData) return null;
    for (const block of locData.blocks) {
      const row = block.rows.find(r => r.id === sourceRowId);
      if (row) return row.values;
    }
    return null;
  }

  function getLocationRowTotal(locationKey: string, sourceRowId: string): string | null {
    const locData = locationData[locationKey];
    if (!locData) return null;
    for (const block of locData.blocks) {
      const row = block.rows.find(r => r.id === sourceRowId);
      if (row) return row.total;
    }
    return null;
  }

  // Map Standort-Kind row IDs to their source (parent) row ID and location key
  function getStandortMapping(childRowId: string): { sourceRowId: string; locationKey: string } | null {
    if (childRowId.endsWith("_velbert")) {
      const sourceRowId = childRowId.replace(/_velbert$/, "");
      return { sourceRowId, locationKey: "LOCATION_VELBERT" };
    }
    if (childRowId.endsWith("_uckerath")) {
      const sourceRowId = childRowId.replace(/_uckerath$/, "");
      return { sourceRowId, locationKey: "LOCATION_UCKERATH_EITORF" };
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
          <button onClick={fetchData} className="mt-3 text-sm text-red-600 hover:text-red-800 underline">
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

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
            {/* Scope Toggle */}
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

            {/* Estate Filter */}
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

            {/* Unreviewed Toggle */}
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
          </div>
        </div>
      </div>

      {/* Warning Banners */}
      {data.meta.includeUnreviewed && data.meta.unreviewedCount > 0 && (
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium text-amber-900">Ungeprüfte Buchungen enthalten</span>
            <span className="text-amber-700">
              {data.meta.unreviewedCount} von {data.meta.entryCount} Buchungen sind noch nicht geprüft.
            </span>
          </div>
        </div>
      )}

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
          <thead className="sticky top-0 z-20">
            {/* IST/PLAN Badges */}
            <tr className="border-b border-gray-200 bg-white">
              <th className="px-4 py-2 text-left font-medium text-gray-700 sticky left-0 bg-white z-30 min-w-[260px]">
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

            {/* Period Labels */}
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
              .filter((block) => block.rows.length > 0)
              .map((block) => {
                const isCashInBlock = block.id === "CASH_IN";
                const isLiqDevBlock = block.id === "LIQUIDITY_DEVELOPMENT";

                // Compute filtered block totals for estate filter on CASH_IN
                const filteredBlockTotals = isCashInBlock && estateFilter !== "GESAMT"
                  ? data.periods.map((_, periodIdx) => {
                      let sum = BigInt(0);
                      for (const row of block.rows) {
                        if (row.isSectionHeader || row.isSummary || row.parentRowId) continue;
                        if (!shouldShowRow(row.id, estateFilter)) continue;
                        const value = row.values.find(v => v.periodIndex === periodIdx);
                        if (value) sum += BigInt(value.amountCents);
                      }
                      return sum;
                    })
                  : null;

                return (
                  <Fragment key={block.id}>
                    {block.rows.map((row) => {
                      // Estate filter: hide non-matching rows
                      if (!shouldShowRow(row.id, estateFilter) && !row.isSummary && !row.isSubtotal) {
                        return null;
                      }

                      // Collapse: hide children of collapsed parents
                      if (row.parentRowId && !expandedRows.has(row.parentRowId)) {
                        return null;
                      }

                      // Section headers: only show if visible children exist
                      if (row.isSectionHeader) {
                        const hasVisibleChildren = block.rows.some(r =>
                          !r.isSectionHeader &&
                          r.order > row.order &&
                          !r.parentRowId &&
                          shouldShowRow(r.id, estateFilter)
                        );
                        if (!hasVisibleChildren) return null;

                        return (
                          <tr key={row.id} className="border-b border-gray-200">
                            <td
                              colSpan={data.periods.length + 2}
                              className="px-4 py-1.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50/70 sticky left-0 z-10"
                            >
                              {row.label}
                            </td>
                          </tr>
                        );
                      }

                      // Determine row display properties
                      const hasChildren = parentRowIds.has(row.id);
                      const isExpanded = expandedRows.has(row.id);
                      const isChild = !!row.parentRowId;

                      // For Standort-Kind rows: get values from location data
                      const standortMapping = isChild ? getStandortMapping(row.id) : null;

                      // Calculate row total
                      let rowTotal: bigint;
                      if (row.isSummary && isCashInBlock && filteredBlockTotals) {
                        rowTotal = filteredBlockTotals.reduce((sum, val) => sum + val, BigInt(0));
                      } else if (standortMapping && locationLoaded) {
                        const locTotal = getLocationRowTotal(standortMapping.locationKey, standortMapping.sourceRowId);
                        rowTotal = locTotal ? BigInt(locTotal) : BigInt(0);
                      } else {
                        rowTotal = BigInt(row.total);
                      }

                      const isNegative = rowTotal < BigInt(0);
                      const bgClass = row.isSummary ? getBlockColorClass(block.id) : row.isSubtotal ? "bg-gray-50" : "";
                      const isLiqDevRow = isLiqDevBlock;

                      // Sektion IV: special styling for coverage_after_reserves
                      const isCoverageRow = row.id === "coverage_after_reserves";
                      const isCoverageBeforeRow = row.id === "coverage_before_reserves";

                      return (
                        <Fragment key={row.id}>
                          <tr
                            className={`border-b ${row.isSubtotal ? "border-t-2 border-gray-300" : "border-gray-100"} ${bgClass} ${
                              row.isSummary || row.isSubtotal ? "font-semibold" : ""
                            } ${hasChildren ? "cursor-pointer" : ""} ${
                              isLiqDevRow && !row.isSummary ? "" : ""
                            } hover:bg-gray-50`}
                            onClick={hasChildren ? () => handleToggleRow(row.id) : undefined}
                          >
                            {/* Row Label */}
                            <td
                              className={`px-4 py-2 text-left sticky left-0 z-10 ${bgClass || "bg-white"} ${
                                isChild ? "pl-12 text-gray-400 italic text-xs" :
                                row.isSubRow && !row.isSummary ? "pl-8 text-gray-600" :
                                "text-gray-900"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {hasChildren && (
                                  <span className={`text-gray-400 text-xs transition-transform inline-block ${isExpanded ? "rotate-90" : ""}`}>
                                    &#9654;
                                  </span>
                                )}
                                <span>{row.label}</span>
                                {/* Tooltip for credit line */}
                                {row.id === "credit_line_available" && data.liquidityDevelopment.creditLineNote && (
                                  <span className="text-xs text-gray-400 font-normal" title={data.liquidityDevelopment.creditLineNote}>
                                    ({data.liquidityDevelopment.creditLineNote})
                                  </span>
                                )}
                                {/* Tooltip for reserves */}
                                {row.id === "reserves_total" && data.liquidityDevelopment.reserveDetails.length > 0 && (
                                  <span
                                    className="text-xs text-gray-400 font-normal"
                                    title={`Worst-Case-Betrachtung: ${data.liquidityDevelopment.reserveDetails.map(d => d.name).join(", ")}`}
                                  >
                                    (Worst-Case)
                                  </span>
                                )}
                                {/* Loading indicator for location children */}
                                {hasChildren && !locationLoaded && locationLoading && isExpanded && (
                                  <span className="text-xs text-gray-400 font-normal">Lade...</span>
                                )}
                              </div>
                            </td>

                            {/* Period Values */}
                            {row.values.map((value) => {
                              let amount: bigint;
                              if (row.isSummary && isCashInBlock && filteredBlockTotals) {
                                amount = filteredBlockTotals[value.periodIndex];
                              } else if (standortMapping && locationLoaded) {
                                const locValues = getLocationRowValues(standortMapping.locationKey, standortMapping.sourceRowId);
                                const locVal = locValues?.find(v => v.periodIndex === value.periodIndex);
                                amount = locVal ? BigInt(locVal.amountCents) : BigInt(0);
                              } else if (standortMapping && !locationLoaded) {
                                amount = BigInt(0);
                              } else {
                                amount = BigInt(value.amountCents);
                              }

                              const isValueNegative = amount < BigInt(0);
                              const isError = data.validation.errorPeriods.includes(value.periodIndex) &&
                                (row.id === "closing_balance_total" || row.id === "coverage_after_reserves");
                              const hasNoData = value.entryCount === -1 && amount === BigInt(0);

                              // Klickbar: Nur Datenzeilen (nicht computed)
                              const isClickable = !row.isSummary && !row.isSectionHeader && !row.isSubtotal &&
                                !isChild && !isLiqDevRow &&
                                amount !== BigInt(0);

                              // Color for coverage rows
                              const coverageColor = (isCoverageRow || isCoverageBeforeRow)
                                ? (amount < BigInt(0) ? "text-red-700 font-bold" : "text-green-700 font-bold")
                                : "";

                              return (
                                <td
                                  key={`${row.id}-${value.periodIndex}`}
                                  className={`px-2 py-2 text-right tabular-nums ${
                                    coverageColor ||
                                    (isChild ? (amount === BigInt(0) ? "text-gray-300" : "text-gray-400") :
                                    hasNoData ? "text-gray-300" :
                                    isValueNegative ? "text-red-600" :
                                    row.flowType === "INFLOW" ? "text-green-600" : "")
                                  } ${isError ? "bg-red-100" : ""} ${
                                    isClickable ? "cursor-pointer hover:bg-blue-50/50 transition-colors" : ""
                                  }`}
                                  onClick={isClickable ? () => setSelectedCell({ rowId: row.id, periodIndex: value.periodIndex }) : undefined}
                                  title={isClickable ? "Klicken für Details" : undefined}
                                >
                                  {isChild && !locationLoaded && standortMapping ? "\u2013" :
                                   hasNoData ? "\u2013" :
                                   formatCurrency(amount.toString())}
                                </td>
                              );
                            })}

                            {/* Row Total */}
                            <td
                              className={`px-4 py-2 text-right tabular-nums font-medium ${
                                (isCoverageRow || isCoverageBeforeRow)
                                  ? (isNegative ? "text-red-700 font-bold" : "text-green-700 font-bold")
                                  : isChild ? (rowTotal === BigInt(0) ? "text-gray-300" : "text-gray-400")
                                  : isNegative ? "text-red-600"
                                  : row.flowType === "INFLOW" ? "text-green-600" : ""
                              }`}
                            >
                              {isChild && !locationLoaded && standortMapping ? "\u2013" :
                               formatCurrency(rowTotal.toString())}
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}

                    {/* Block spacing */}
                    {block.order < data.blocks.length && (
                      <tr className="h-2 bg-white">
                        <td colSpan={data.periods.length + 2}></td>
                      </tr>
                    )}
                  </Fragment>
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

      {/* Cell Explanation Modal */}
      {selectedCell && (
        <CellExplanationModal
          caseId={caseId}
          rowId={selectedCell.rowId}
          periodIndex={selectedCell.periodIndex}
          scope={scope}
          includeUnreviewed={includeUnreviewed}
          onClose={() => setSelectedCell(null)}
        />
      )}
    </div>
  );
}
