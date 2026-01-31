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

import { useState, useEffect, useCallback } from "react";

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
        estateFilter,
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
  }, [caseId, estateFilter, showDetails, scope, includeUnreviewed]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* Header Row 1: IST/PLAN Badges */}
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-4 py-2 text-left font-medium text-gray-700 sticky left-0 bg-white z-10 min-w-[200px]">
                Position
              </th>
              {data.periods.map((period) => {
                const colors = getValueTypeColor(period.valueType);
                return (
                  <th key={period.periodIndex} className="px-2 py-2 text-center min-w-[80px]">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${colors.bg} ${colors.text}`}>
                      {period.valueType}
                    </span>
                  </th>
                );
              })}
              <th className="px-4 py-2 text-right font-medium text-gray-700 min-w-[100px]">
                Summe
              </th>
            </tr>

            {/* Header Row 2: Period Labels */}
            <tr className="border-b border-gray-300 bg-gray-50">
              <th className="px-4 py-2 text-left font-semibold text-gray-900 sticky left-0 bg-gray-50 z-10">
                Periode
              </th>
              {data.periods.map((period) => (
                <th key={period.periodIndex} className="px-2 py-2 text-center font-semibold text-gray-900">
                  {period.periodLabel}
                </th>
              ))}
              <th className="px-4 py-2 text-right font-semibold text-gray-900">
                Gesamt
              </th>
            </tr>
          </thead>

          <tbody>
            {data.blocks
              .filter((block) => block.rows.length > 0)  // Skip empty blocks
              .map((block) => (
              <>
                {/* Block rows */}
                {block.rows.map((row, rowIdx) => {
                  const isNegative = BigInt(row.total) < BigInt(0);
                  const bgClass = row.isSummary ? getBlockColorClass(block.id) : "";

                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-gray-100 ${bgClass} ${
                        row.isSummary ? "font-semibold" : ""
                      } hover:bg-gray-50`}
                    >
                      {/* Row Label */}
                      <td
                        className={`px-4 py-2 text-left sticky left-0 z-10 ${bgClass || "bg-white"} ${
                          row.isSubRow ? "pl-8 text-gray-600" : "text-gray-900"
                        }`}
                      >
                        {row.label}
                      </td>

                      {/* Period Values */}
                      {row.values.map((value) => {
                        const amount = BigInt(value.amountCents);
                        const isValueNegative = amount < BigInt(0);
                        const isError = data.validation.errorPeriods.includes(value.periodIndex) && row.isSummary && block.id === "CLOSING_BALANCE";

                        return (
                          <td
                            key={`${row.id}-${value.periodIndex}`}
                            className={`px-2 py-2 text-right tabular-nums ${
                              isValueNegative ? "text-red-600" : row.flowType === "INFLOW" ? "text-green-600" : ""
                            } ${isError ? "bg-red-100" : ""}`}
                          >
                            {formatCurrency(value.amountCents)}
                          </td>
                        );
                      })}

                      {/* Row Total */}
                      <td
                        className={`px-4 py-2 text-right tabular-nums font-medium ${
                          isNegative ? "text-red-600" : row.flowType === "INFLOW" ? "text-green-600" : ""
                        }`}
                      >
                        {formatCurrency(row.total)}
                      </td>
                    </tr>
                  );
                })}

                {/* Spacing row after block (except last) */}
                {block.order < data.blocks.length && (
                  <tr className="h-2 bg-white">
                    <td colSpan={data.periods.length + 2}></td>
                  </tr>
                )}
              </>
            ))}
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
