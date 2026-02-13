"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
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
  if (value === 0) return "0,0 %";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1).replace(".", ",")} %`;
}

/**
 * Farbcodierung für Abweichungen: positiv = grün, negativ = rot.
 * Gilt einheitlich für Einnahmen, Ausgaben und Netto, weil Outflows
 * bereits als negative Beträge gespeichert sind. deviation = IST - PLAN:
 * +5k bei Outflows = IST weniger negativ = weniger ausgegeben = gut.
 */
function deviationColor(centsStr: string): string {
  const cents = BigInt(centsStr);
  if (cents === BigInt(0)) return "text-gray-400";
  return cents > BigInt(0) ? "text-green-700" : "text-red-600";
}

function deviationSign(centsStr: string): string {
  return BigInt(centsStr) > BigInt(0) ? "+" : "";
}

// Opake Hintergrundfarben für Sticky-Spalten (kein Durchscheinen beim Scrollen)
const STICKY_BG = {
  default: "bg-white",
  ist: "bg-emerald-50",
  plan: "bg-blue-50",
  sectionHeader: "bg-gray-50",
  cumulative: "bg-gray-50",
  totalCol: "bg-gray-100",
} as const;

// =============================================================================
// CHART COMPONENT
// =============================================================================

function ComparisonChart({ data }: { data: IstPlanComparisonData }) {
  const chartData = useMemo(() => {
    return data.periods
      .filter((p) => p.hasIst || p.hasPlan)
      .map((p) => ({
        name: p.periodLabel,
        istNetto: p.hasIst ? Number(BigInt(p.istNetCents)) / 100 : null,
        planNetto: p.hasPlan ? Number(BigInt(p.planNetCents)) / 100 : null,
        abweichung: p.hasIst && p.hasPlan ? Number(BigInt(p.cumulativeDeviationNetCents)) / 100 : null,
      }));
  }, [data.periods]);

  if (chartData.length === 0) return null;

  return (
    <div className="admin-card p-4">
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) =>
                Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
              }
            />
            <Tooltip
              formatter={(value, name) => {
                const labels: Record<string, string> = {
                  istNetto: "IST Netto",
                  planNetto: "PLAN Netto",
                  abweichung: "Kum. Abweichung",
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
                  istNetto: "IST Netto",
                  planNetto: "PLAN Netto",
                  abweichung: "Kum. Abweichung",
                };
                return labels[value] || value;
              }}
            />
            <Bar dataKey="istNetto" fill="#10b981" opacity={0.85} radius={[3, 3, 0, 0]} barSize={24} />
            <Bar dataKey="planNetto" fill="#6366f1" opacity={0.55} radius={[3, 3, 0, 0]} barSize={24} />
            <Line
              type="monotone"
              dataKey="abweichung"
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
  rowBg,
  valueClassName = "",
  showSign = false,
  totalValue,
  totalClassName = "",
}: {
  label: string;
  periods: ComparisonPeriod[];
  getValue: (p: ComparisonPeriod) => string | null;
  rowBg: string;
  valueClassName?: string | ((p: ComparisonPeriod) => string);
  showSign?: boolean;
  totalValue?: string | null;
  totalClassName?: string;
}) {
  return (
    <tr className={rowBg}>
      <td className={`py-2 px-3 text-sm whitespace-nowrap sticky left-0 z-10 ${rowBg}`}>
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
      <td className={`py-2 px-3 text-sm text-right tabular-nums font-medium border-l border-gray-200 ${STICKY_BG.totalCol} ${totalClassName}`}>
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
  rowBg,
  totalPercent,
}: {
  label: string;
  periods: ComparisonPeriod[];
  getPercent: (p: ComparisonPeriod) => number | null;
  rowBg: string;
  totalPercent?: number | null;
}) {
  return (
    <tr className={`${rowBg} border-b border-gray-200`}>
      <td className={`py-1.5 px-3 text-xs whitespace-nowrap sticky left-0 z-10 ${rowBg} text-gray-500`}>
        {label}
      </td>
      {periods.map((p) => {
        const pct = getPercent(p);
        return (
          <td key={p.periodIndex} className="py-1.5 px-3 text-xs text-right tabular-nums text-gray-500">
            {pct === null ? (
              <span className="text-gray-300">{"\u2013"}</span>
            ) : (
              <span className={pct === 0 ? "text-gray-400" : pct > 0 ? "text-green-600" : "text-red-500"}>
                {fmtPercent(pct)}
              </span>
            )}
          </td>
        );
      })}
      <td className={`py-1.5 px-3 text-xs text-right tabular-nums text-gray-500 border-l border-gray-200 ${STICKY_BG.totalCol}`}>
        {totalPercent === null || totalPercent === undefined ? (
          <span className="text-gray-300">{"\u2013"}</span>
        ) : (
          <span className={totalPercent === 0 ? "text-gray-400" : totalPercent > 0 ? "text-green-600" : "text-red-500"}>
            {fmtPercent(totalPercent)}
          </span>
        )}
      </td>
    </tr>
  );
}

/** Section Header Zeile */
function SectionHeader({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr className={`${STICKY_BG.sectionHeader} border-y border-gray-200`}>
      <td
        colSpan={colSpan}
        className={`py-2 px-3 text-xs font-bold text-gray-600 uppercase tracking-wider sticky left-0 z-10 ${STICKY_BG.sectionHeader}`}
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
      {/* Header mit Info-Badges */}
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

      {/* Chart: IST Netto vs PLAN Netto + kumulierte Abweichungslinie */}
      <ComparisonChart data={data} />

      {/* Vergleichstabelle: Monate als Spalten */}
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className={`${STICKY_BG.sectionHeader} border-b border-gray-200`}>
                <th className={`py-2.5 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 z-20 ${STICKY_BG.sectionHeader} min-w-[160px]`}>
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
                <th className={`py-2.5 px-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px] border-l border-gray-200 ${STICKY_BG.totalCol}`}>
                  <div>{"\u03A3"} Vergleich</div>
                  <div className="mt-0.5 font-normal normal-case text-gray-400" title="Nur Perioden mit IST- und PLAN-Daten">
                    {data.totals.overlapPeriodCount} von {periodsWithData.length} Per.
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              {/* ── EINNAHMEN ────────────────────────────────────── */}
              <SectionHeader label="Einnahmen" colSpan={totalColumns} />

              <DataRow
                label="IST"
                periods={periodsWithData}
                getValue={(p) => (p.hasIst ? p.istInflowsCents : null)}
                rowBg={STICKY_BG.ist}
                valueClassName="text-gray-900"
                totalValue={data.totals.istInflowsCents}
                totalClassName="text-gray-900"
              />
              <DataRow
                label="PLAN"
                periods={periodsWithData}
                getValue={(p) => (p.hasPlan ? p.planInflowsCents : null)}
                rowBg={STICKY_BG.plan}
                valueClassName="text-gray-900"
                totalValue={data.totals.planInflowsCents}
                totalClassName="text-gray-900"
              />
              <DataRow
                label="Abweichung"
                periods={periodsWithData}
                getValue={(p) => (p.hasIst && p.hasPlan ? p.deviationInflowsCents : null)}
                rowBg={STICKY_BG.default}
                valueClassName={(p) =>
                  p.hasIst && p.hasPlan
                    ? `font-medium ${deviationColor(p.deviationInflowsCents)}`
                    : ""
                }
                showSign
                totalValue={data.totals.deviationInflowsCents}
                totalClassName={`font-medium ${deviationColor(data.totals.deviationInflowsCents)}`}
              />
              <PercentRow
                label="Abweichung %"
                periods={periodsWithData}
                getPercent={(p) => p.deviationInflowsPercent}
                rowBg={STICKY_BG.default}
                totalPercent={data.totals.deviationInflowsPercent}
              />

              {/* ── AUSGABEN ─────────────────────────────────────── */}
              <SectionHeader label="Ausgaben" colSpan={totalColumns} />

              <DataRow
                label="IST"
                periods={periodsWithData}
                getValue={(p) => (p.hasIst ? p.istOutflowsCents : null)}
                rowBg={STICKY_BG.ist}
                valueClassName="text-gray-900"
                totalValue={data.totals.istOutflowsCents}
                totalClassName="text-gray-900"
              />
              <DataRow
                label="PLAN"
                periods={periodsWithData}
                getValue={(p) => (p.hasPlan ? p.planOutflowsCents : null)}
                rowBg={STICKY_BG.plan}
                valueClassName="text-gray-900"
                totalValue={data.totals.planOutflowsCents}
                totalClassName="text-gray-900"
              />
              <DataRow
                label="Abweichung"
                periods={periodsWithData}
                getValue={(p) => (p.hasIst && p.hasPlan ? p.deviationOutflowsCents : null)}
                rowBg={STICKY_BG.default}
                valueClassName={(p) =>
                  p.hasIst && p.hasPlan
                    ? `font-medium ${deviationColor(p.deviationOutflowsCents)}`
                    : ""
                }
                showSign
                totalValue={data.totals.deviationOutflowsCents}
                totalClassName={`font-medium ${deviationColor(data.totals.deviationOutflowsCents)}`}
              />
              <PercentRow
                label="Abweichung %"
                periods={periodsWithData}
                getPercent={(p) => p.deviationOutflowsPercent}
                rowBg={STICKY_BG.default}
                totalPercent={data.totals.deviationOutflowsPercent}
              />

              {/* ── NETTO CASHFLOW ───────────────────────────────── */}
              <SectionHeader label="Netto-Cashflow" colSpan={totalColumns} />

              <DataRow
                label="IST"
                periods={periodsWithData}
                getValue={(p) => (p.hasIst ? p.istNetCents : null)}
                rowBg={STICKY_BG.ist}
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
              <DataRow
                label="PLAN"
                periods={periodsWithData}
                getValue={(p) => (p.hasPlan ? p.planNetCents : null)}
                rowBg={STICKY_BG.plan}
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
              <DataRow
                label="Abweichung"
                periods={periodsWithData}
                getValue={(p) => (p.hasIst && p.hasPlan ? p.deviationNetCents : null)}
                rowBg={STICKY_BG.default}
                valueClassName={(p) =>
                  p.hasIst && p.hasPlan
                    ? `font-semibold ${deviationColor(p.deviationNetCents)}`
                    : ""
                }
                showSign
                totalValue={data.totals.deviationNetCents}
                totalClassName={`font-semibold ${deviationColor(data.totals.deviationNetCents)}`}
              />
              <PercentRow
                label="Abweichung %"
                periods={periodsWithData}
                getPercent={(p) => p.deviationNetPercent}
                rowBg={STICKY_BG.default}
                totalPercent={data.totals.deviationNetPercent}
              />

              {/* ── KUMULIERTE ABWEICHUNG ────────────────────────── */}
              <tr className={`${STICKY_BG.cumulative} border-t-2 border-gray-300`}>
                <td className={`py-2.5 px-3 text-sm font-semibold text-gray-700 whitespace-nowrap sticky left-0 z-10 ${STICKY_BG.cumulative}`}>
                  Kumulierte Abweichung
                </td>
                {periodsWithData.map((p) => {
                  const hasBoth = p.hasIst && p.hasPlan;
                  return (
                    <td
                      key={p.periodIndex}
                      className={`py-2.5 px-3 text-sm text-right tabular-nums font-semibold ${
                        hasBoth ? deviationColor(p.cumulativeDeviationNetCents) : "text-gray-300"
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
                <td className={`py-2.5 px-3 text-sm text-right tabular-nums font-semibold border-l border-gray-200 ${STICKY_BG.totalCol}`}>
                  {(() => {
                    const lastWithBoth = [...periodsWithData].reverse().find((p) => p.hasIst && p.hasPlan);
                    if (!lastWithBoth) return "\u2013";
                    return (
                      <span className={deviationColor(lastWithBoth.cumulativeDeviationNetCents)}>
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
        <div className="admin-card p-4">
          <div className="text-xs text-gray-500 mb-1">Abweichung Einnahmen</div>
          <div className={`text-xl font-bold ${deviationColor(data.totals.deviationInflowsCents)}`}>
            {deviationSign(data.totals.deviationInflowsCents)}{fmtCurrency(data.totals.deviationInflowsCents)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {data.totals.deviationInflowsPercent !== null
              ? fmtPercent(data.totals.deviationInflowsPercent)
              : "Kein Vergleich möglich"}
          </div>
        </div>

        <div className="admin-card p-4">
          <div className="text-xs text-gray-500 mb-1">Abweichung Ausgaben</div>
          <div className={`text-xl font-bold ${deviationColor(data.totals.deviationOutflowsCents)}`}>
            {deviationSign(data.totals.deviationOutflowsCents)}{fmtCurrency(data.totals.deviationOutflowsCents)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {data.totals.deviationOutflowsPercent !== null
              ? fmtPercent(data.totals.deviationOutflowsPercent)
              : "Kein Vergleich möglich"}
          </div>
        </div>

        <div className={`admin-card p-4 border-l-4 ${
          BigInt(data.totals.deviationNetCents) >= 0 ? "border-green-500" : "border-red-500"
        }`}>
          <div className="text-xs text-gray-500 mb-1">Netto-Abweichung</div>
          <div className={`text-xl font-bold ${deviationColor(data.totals.deviationNetCents)}`}>
            {deviationSign(data.totals.deviationNetCents)}{fmtCurrency(data.totals.deviationNetCents)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {data.totals.deviationNetPercent !== null
              ? fmtPercent(data.totals.deviationNetPercent)
              : "Kein Vergleich möglich"}
            {data.totals.overlapPeriodCount > 0 && (
              <span className="ml-1">({data.totals.overlapPeriodCount} Perioden)</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
