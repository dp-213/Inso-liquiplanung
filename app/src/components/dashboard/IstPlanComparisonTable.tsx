"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import type { LiquidityScope } from "@/components/dashboard/LiquidityMatrixTable";
import type {
  IstPlanComparisonData,
  ComparisonPeriod,
} from "@/app/api/cases/[id]/dashboard/ist-plan-comparison/route";

// =============================================================================
// TYPES
// =============================================================================

interface IstPlanComparisonTableProps {
  caseId: string;
  scope?: LiquidityScope;
}

// =============================================================================
// FORMAT HELPERS
// =============================================================================

/** Formatiert Cent-Werte als EUR ohne Währungssymbol (für Tabellenzellen) */
function fmtNum(centsStr: string): string {
  const euros = Number(BigInt(centsStr)) / 100;
  return euros.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** Formatiert Cent-Werte als EUR mit Währungssymbol (für Summary Cards) */
function fmtCurrency(centsStr: string): string {
  const euros = Number(BigInt(centsStr)) / 100;
  return euros.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function fmtPercent(value: number | null): string {
  if (value === null) return "\u2013";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} %`;
}

/** Bestimmt ob eine Abweichung "gut" ist */
function isGoodDeviation(centsStr: string, type: "inflow" | "outflow" | "net"): boolean | null {
  const cents = BigInt(centsStr);
  if (cents === BigInt(0)) return null;
  const isPositive = cents > BigInt(0);
  // Einnahmen: positiv = gut, Ausgaben: positiv = schlecht (mehr Ausgaben), Netto: positiv = gut
  return type === "outflow" ? !isPositive : isPositive;
}

function deviationColor(centsStr: string, type: "inflow" | "outflow" | "net"): string {
  const good = isGoodDeviation(centsStr, type);
  if (good === null) return "text-gray-400";
  return good ? "text-green-700" : "text-red-600";
}

function deviationSign(centsStr: string): string {
  const cents = BigInt(centsStr);
  if (cents > BigInt(0)) return "+";
  return "";
}

// =============================================================================
// CHART COMPONENT
// =============================================================================

function ComparisonChart({ data }: { data: IstPlanComparisonData }) {
  const chartData = useMemo(() => {
    return data.periods
      .filter((p) => p.hasIst || p.hasPlan)
      .map((p) => ({
        name: p.periodLabel,
        istInflows: p.hasIst ? Number(BigInt(p.istInflowsCents)) / 100 : null,
        planInflows: p.hasPlan ? Number(BigInt(p.planInflowsCents)) / 100 : null,
        istOutflows: p.hasIst ? Math.abs(Number(BigInt(p.istOutflowsCents))) / 100 : null,
        planOutflows: p.hasPlan ? Math.abs(Number(BigInt(p.planOutflowsCents))) / 100 : null,
        deviationNet: p.hasIst && p.hasPlan ? Number(BigInt(p.deviationNetCents)) / 100 : null,
      }));
  }, [data.periods]);

  if (chartData.length === 0) return null;

  return (
    <div className="admin-card p-4">
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(value, name) => {
                const labels: Record<string, string> = {
                  istInflows: "IST Einnahmen",
                  planInflows: "PLAN Einnahmen",
                  istOutflows: "IST Ausgaben",
                  planOutflows: "PLAN Ausgaben",
                  deviationNet: "Netto-Abweichung",
                };
                const num = typeof value === "number" ? value : 0;
                return [
                  num.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }),
                  labels[String(name)] || String(name),
                ];
              }}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend
              iconSize={10}
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value: string) => {
                const labels: Record<string, string> = {
                  istInflows: "IST Einnahmen",
                  planInflows: "PLAN Einnahmen",
                  istOutflows: "IST Ausgaben",
                  planOutflows: "PLAN Ausgaben",
                  deviationNet: "Netto-Abweichung",
                };
                return labels[value] || value;
              }}
            />
            <Bar dataKey="istInflows" fill="#10b981" opacity={0.8} radius={[2, 2, 0, 0]} barSize={16} />
            <Bar dataKey="planInflows" fill="#6366f1" opacity={0.5} radius={[2, 2, 0, 0]} barSize={16} />
            <Bar dataKey="istOutflows" fill="#ef4444" opacity={0.8} radius={[2, 2, 0, 0]} barSize={16} />
            <Bar dataKey="planOutflows" fill="#f59e0b" opacity={0.5} radius={[2, 2, 0, 0]} barSize={16} />
            <Line
              type="monotone"
              dataKey="deviationNet"
              stroke="#8b5cf6"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={{ r: 3, fill: "#8b5cf6" }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// =============================================================================
// TABLE ROW HELPERS
// =============================================================================

/** Renders eine Datenzeile über alle Perioden */
function DataRow({
  label,
  periods,
  getValue,
  className = "",
  valueClassName = "",
  showSign = false,
  totalValue,
  totalClassName = "",
}: {
  label: string;
  periods: ComparisonPeriod[];
  getValue: (p: ComparisonPeriod) => string | null;
  className?: string;
  valueClassName?: string | ((p: ComparisonPeriod) => string);
  showSign?: boolean;
  totalValue?: string | null;
  totalClassName?: string;
}) {
  return (
    <tr className={className}>
      <td className="py-2 px-3 text-sm whitespace-nowrap sticky left-0 z-10 bg-inherit">
        {label}
      </td>
      {periods.map((p) => {
        const val = getValue(p);
        const cellClass = typeof valueClassName === "function" ? valueClassName(p) : valueClassName;
        return (
          <td key={p.periodIndex} className={`py-2 px-3 text-sm text-right tabular-nums ${cellClass}`}>
            {val === null ? (
              <span className="text-gray-300">{"\u2013"}</span>
            ) : (
              <>
                {showSign && deviationSign(val)}
                {fmtNum(val)}
              </>
            )}
          </td>
        );
      })}
      <td className={`py-2 px-3 text-sm text-right tabular-nums font-medium border-l border-gray-200 ${totalClassName}`}>
        {totalValue === null || totalValue === undefined ? (
          <span className="text-gray-300">{"\u2013"}</span>
        ) : (
          <>
            {showSign && deviationSign(totalValue)}
            {fmtNum(totalValue)}
          </>
        )}
      </td>
    </tr>
  );
}

/** Renders eine Prozent-Zeile */
function PercentRow({
  label,
  periods,
  getPercent,
  className = "",
  totalPercent,
}: {
  label: string;
  periods: ComparisonPeriod[];
  getPercent: (p: ComparisonPeriod) => number | null;
  className?: string;
  totalPercent?: number | null;
}) {
  return (
    <tr className={className}>
      <td className="py-1.5 px-3 text-xs whitespace-nowrap sticky left-0 z-10 bg-inherit text-gray-500">
        {label}
      </td>
      {periods.map((p) => {
        const pct = getPercent(p);
        return (
          <td key={p.periodIndex} className="py-1.5 px-3 text-xs text-right tabular-nums text-gray-500">
            {pct === null ? (
              <span className="text-gray-300">{"\u2013"}</span>
            ) : (
              <span className={pct >= 0 ? "text-green-600" : "text-red-500"}>
                {fmtPercent(pct)}
              </span>
            )}
          </td>
        );
      })}
      <td className="py-1.5 px-3 text-xs text-right tabular-nums text-gray-500 border-l border-gray-200">
        {totalPercent === null || totalPercent === undefined ? (
          <span className="text-gray-300">{"\u2013"}</span>
        ) : (
          <span className={totalPercent >= 0 ? "text-green-600" : "text-red-500"}>
            {fmtPercent(totalPercent)}
          </span>
        )}
      </td>
    </tr>
  );
}

/** Section Header Zeile */
function SectionHeader({
  label,
  colSpan,
}: {
  label: string;
  colSpan: number;
}) {
  return (
    <tr className="bg-gray-50 border-y border-gray-200">
      <td
        colSpan={colSpan}
        className="py-2 px-3 text-xs font-bold text-gray-600 uppercase tracking-wider sticky left-0 z-10 bg-gray-50"
      >
        {label}
      </td>
    </tr>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function IstPlanComparisonTable({ caseId, scope = "GLOBAL" }: IstPlanComparisonTableProps) {
  const [data, setData] = useState<IstPlanComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `/api/cases/${caseId}/dashboard/ist-plan-comparison?scope=${scope}`,
          { credentials: "include" }
        );

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Fehler beim Laden");
        }

        const result: IstPlanComparisonData = await res.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [caseId, scope]);

  // Nur Perioden mit Daten anzeigen
  const periodsWithData = useMemo(() => {
    if (!data) return [];
    return data.periods.filter((p) => p.hasIst || p.hasPlan);
  }, [data]);

  const totalColumns = periodsWithData.length + 2; // Label + Perioden + Gesamt

  if (loading) {
    return (
      <div className="admin-card p-8 text-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-gray-200 rounded-full mb-4" />
          <div className="h-4 w-48 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-card p-6">
        <div className="text-red-600 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!data || periodsWithData.length === 0) {
    return (
      <div className="admin-card p-8 text-center text-gray-500">
        Keine Daten für den IST/PLAN-Vergleich vorhanden.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header mit Info-Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">IST/PLAN-Vergleich</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Gegenüberstellung realer Zahlungen und Planwerte pro Periode
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {data.meta.istEntryCount} IST
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            {data.meta.planEntryCount} PLAN
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-200">
            Nur geprüfte Buchungen
          </span>
        </div>
      </div>

      {/* Chart */}
      <ComparisonChart data={data} />

      {/* Vergleichstabelle: Monate als Spalten */}
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            {/* Header: Perioden-Labels */}
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-2.5 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 z-20 bg-gray-50 min-w-[160px]">
                  in EUR
                </th>
                {periodsWithData.map((p) => (
                  <th
                    key={p.periodIndex}
                    className="py-2.5 px-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]"
                  >
                    <div>{p.periodLabel}</div>
                    <div className="mt-0.5 font-normal normal-case">
                      {p.hasIst && p.hasPlan ? (
                        <span className="text-purple-600">IST+PLAN</span>
                      ) : p.hasIst ? (
                        <span className="text-emerald-600">IST</span>
                      ) : (
                        <span className="text-blue-600">PLAN</span>
                      )}
                    </div>
                  </th>
                ))}
                <th className="py-2.5 px-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[110px] border-l border-gray-200 bg-gray-100">
                  Gesamt
                </th>
              </tr>
            </thead>

            <tbody>
              {/* ── EINNAHMEN ────────────────────────────────────── */}
              <SectionHeader label="Einnahmen" colSpan={totalColumns} />

              {/* IST Einnahmen */}
              <DataRow
                label="IST"
                periods={periodsWithData}
                getValue={(p) => (p.hasIst ? p.istInflowsCents : null)}
                className="bg-emerald-50/40"
                valueClassName="text-gray-900"
                totalValue={data.totals.istInflowsCents}
                totalClassName="text-gray-900"
              />

              {/* PLAN Einnahmen */}
              <DataRow
                label="PLAN"
                periods={periodsWithData}
                getValue={(p) => (p.hasPlan ? p.planInflowsCents : null)}
                className="bg-blue-50/40"
                valueClassName="text-gray-900"
                totalValue={data.totals.planInflowsCents}
                totalClassName="text-gray-900"
              />

              {/* Abweichung Einnahmen */}
              <DataRow
                label="Abweichung"
                periods={periodsWithData}
                getValue={(p) => (p.hasIst && p.hasPlan ? p.deviationInflowsCents : null)}
                className="border-b border-gray-100"
                valueClassName={(p) =>
                  p.hasIst && p.hasPlan
                    ? `font-medium ${deviationColor(p.deviationInflowsCents, "inflow")}`
                    : ""
                }
                showSign
                totalValue={data.totals.deviationInflowsCents}
                totalClassName={`font-medium ${deviationColor(data.totals.deviationInflowsCents, "inflow")}`}
              />

              <PercentRow
                label="Abweichung %"
                periods={periodsWithData}
                getPercent={(p) => (p.hasIst && p.hasPlan ? p.deviationInflowsPercent : null)}
                className="border-b border-gray-200"
                totalPercent={data.totals.deviationInflowsPercent}
              />

              {/* ── AUSGABEN ─────────────────────────────────────── */}
              <SectionHeader label="Ausgaben" colSpan={totalColumns} />

              {/* IST Ausgaben */}
              <DataRow
                label="IST"
                periods={periodsWithData}
                getValue={(p) => (p.hasIst ? p.istOutflowsCents : null)}
                className="bg-emerald-50/40"
                valueClassName="text-gray-900"
                totalValue={data.totals.istOutflowsCents}
                totalClassName="text-gray-900"
              />

              {/* PLAN Ausgaben */}
              <DataRow
                label="PLAN"
                periods={periodsWithData}
                getValue={(p) => (p.hasPlan ? p.planOutflowsCents : null)}
                className="bg-blue-50/40"
                valueClassName="text-gray-900"
                totalValue={data.totals.planOutflowsCents}
                totalClassName="text-gray-900"
              />

              {/* Abweichung Ausgaben */}
              <DataRow
                label="Abweichung"
                periods={periodsWithData}
                getValue={(p) => (p.hasIst && p.hasPlan ? p.deviationOutflowsCents : null)}
                className="border-b border-gray-100"
                valueClassName={(p) =>
                  p.hasIst && p.hasPlan
                    ? `font-medium ${deviationColor(p.deviationOutflowsCents, "outflow")}`
                    : ""
                }
                showSign
                totalValue={data.totals.deviationOutflowsCents}
                totalClassName={`font-medium ${deviationColor(data.totals.deviationOutflowsCents, "outflow")}`}
              />

              <PercentRow
                label="Abweichung %"
                periods={periodsWithData}
                getPercent={(p) => (p.hasIst && p.hasPlan ? p.deviationOutflowsPercent : null)}
                className="border-b border-gray-200"
                totalPercent={data.totals.deviationOutflowsPercent}
              />

              {/* ── NETTO CASHFLOW ───────────────────────────────── */}
              <SectionHeader label="Netto-Cashflow" colSpan={totalColumns} />

              {/* IST Netto */}
              <DataRow
                label="IST"
                periods={periodsWithData}
                getValue={(p) => (p.hasIst ? p.istNetCents : null)}
                className="bg-emerald-50/40"
                valueClassName={(p) =>
                  p.hasIst
                    ? BigInt(p.istNetCents) >= 0
                      ? "text-green-700 font-medium"
                      : "text-red-600 font-medium"
                    : ""
                }
                totalValue={data.totals.istNetCents}
                totalClassName={BigInt(data.totals.istNetCents) >= 0 ? "text-green-700" : "text-red-600"}
              />

              {/* PLAN Netto */}
              <DataRow
                label="PLAN"
                periods={periodsWithData}
                getValue={(p) => (p.hasPlan ? p.planNetCents : null)}
                className="bg-blue-50/40"
                valueClassName={(p) =>
                  p.hasPlan
                    ? BigInt(p.planNetCents) >= 0
                      ? "text-blue-700 font-medium"
                      : "text-red-600 font-medium"
                    : ""
                }
                totalValue={data.totals.planNetCents}
                totalClassName={BigInt(data.totals.planNetCents) >= 0 ? "text-blue-700" : "text-red-600"}
              />

              {/* Abweichung Netto */}
              <DataRow
                label="Abweichung"
                periods={periodsWithData}
                getValue={(p) => (p.hasIst && p.hasPlan ? p.deviationNetCents : null)}
                className="border-b border-gray-100"
                valueClassName={(p) =>
                  p.hasIst && p.hasPlan
                    ? `font-semibold ${deviationColor(p.deviationNetCents, "net")}`
                    : ""
                }
                showSign
                totalValue={data.totals.deviationNetCents}
                totalClassName={`font-semibold ${deviationColor(data.totals.deviationNetCents, "net")}`}
              />

              <PercentRow
                label="Abweichung %"
                periods={periodsWithData}
                getPercent={(p) => (p.hasIst && p.hasPlan ? p.deviationNetPercent : null)}
                className="border-b border-gray-200"
                totalPercent={data.totals.deviationNetPercent}
              />

              {/* ── KUMULIERTE ABWEICHUNG ────────────────────────── */}
              <tr className="bg-gray-50 border-t-2 border-gray-300">
                <td className="py-2.5 px-3 text-sm font-semibold text-gray-700 whitespace-nowrap sticky left-0 z-10 bg-gray-50">
                  Kumulierte Abweichung
                </td>
                {periodsWithData.map((p) => {
                  const hasBoth = p.hasIst && p.hasPlan;
                  return (
                    <td
                      key={p.periodIndex}
                      className={`py-2.5 px-3 text-sm text-right tabular-nums font-semibold ${
                        hasBoth ? deviationColor(p.cumulativeDeviationNetCents, "net") : "text-gray-300"
                      }`}
                    >
                      {hasBoth ? (
                        <>
                          {deviationSign(p.cumulativeDeviationNetCents)}
                          {fmtNum(p.cumulativeDeviationNetCents)}
                        </>
                      ) : (
                        "\u2013"
                      )}
                    </td>
                  );
                })}
                <td className="py-2.5 px-3 text-sm text-right tabular-nums font-semibold border-l border-gray-200 bg-gray-100">
                  {/* Gesamt = letzte kumulierte Abweichung */}
                  {(() => {
                    const lastWithBoth = [...periodsWithData].reverse().find((p) => p.hasIst && p.hasPlan);
                    if (!lastWithBoth) return "\u2013";
                    return (
                      <span className={deviationColor(lastWithBoth.cumulativeDeviationNetCents, "net")}>
                        {deviationSign(lastWithBoth.cumulativeDeviationNetCents)}
                        {fmtNum(lastWithBoth.cumulativeDeviationNetCents)}
                      </span>
                    );
                  })()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Einnahmen-Abweichung */}
        <div className="admin-card p-4">
          <div className="text-xs text-gray-500 mb-1">Gesamt-Abweichung Einnahmen</div>
          <div className={`text-xl font-bold ${deviationColor(data.totals.deviationInflowsCents, "inflow")}`}>
            {deviationSign(data.totals.deviationInflowsCents)}{fmtCurrency(data.totals.deviationInflowsCents)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {data.totals.deviationInflowsPercent !== null
              ? fmtPercent(data.totals.deviationInflowsPercent)
              : "Kein PLAN"}
          </div>
        </div>

        {/* Ausgaben-Abweichung */}
        <div className="admin-card p-4">
          <div className="text-xs text-gray-500 mb-1">Gesamt-Abweichung Ausgaben</div>
          <div className={`text-xl font-bold ${deviationColor(data.totals.deviationOutflowsCents, "outflow")}`}>
            {deviationSign(data.totals.deviationOutflowsCents)}{fmtCurrency(data.totals.deviationOutflowsCents)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {data.totals.deviationOutflowsPercent !== null
              ? fmtPercent(data.totals.deviationOutflowsPercent)
              : "Kein PLAN"}
          </div>
        </div>

        {/* Netto-Abweichung */}
        <div className={`admin-card p-4 border-l-4 ${
          BigInt(data.totals.deviationNetCents) >= 0 ? "border-green-500" : "border-red-500"
        }`}>
          <div className="text-xs text-gray-500 mb-1">Netto-Abweichung</div>
          <div className={`text-xl font-bold ${deviationColor(data.totals.deviationNetCents, "net")}`}>
            {deviationSign(data.totals.deviationNetCents)}{fmtCurrency(data.totals.deviationNetCents)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {data.totals.deviationNetPercent !== null
              ? fmtPercent(data.totals.deviationNetPercent)
              : "Kein PLAN"}
          </div>
        </div>
      </div>
    </div>
  );
}
