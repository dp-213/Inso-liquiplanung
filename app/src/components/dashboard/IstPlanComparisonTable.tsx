"use client";

import { useState, useEffect } from "react";
import type { IstPlanComparisonData, ComparisonPeriod } from "@/app/api/cases/[id]/dashboard/ist-plan-comparison/route";

interface IstPlanComparisonTableProps {
  caseId: string;
}

function formatCurrency(centsStr: string): string {
  const cents = BigInt(centsStr);
  const euros = Number(cents) / 100;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(euros);
}

function formatPercent(value: number | null): string {
  if (value === null) return "-";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function DeviationBadge({ value, type }: { value: string; type: "inflow" | "outflow" | "net" }) {
  const cents = BigInt(value);
  if (cents === BigInt(0)) {
    return <span className="text-gray-400">±0</span>;
  }

  // Für Einnahmen: positiv = gut (grün), negativ = schlecht (rot)
  // Für Ausgaben: positiv = schlecht (mehr Ausgaben), negativ = gut (weniger Ausgaben)
  // Für Netto: positiv = gut (mehr Gewinn), negativ = schlecht
  let isPositive = cents > BigInt(0);
  let isGood = type === "outflow" ? !isPositive : isPositive;

  return (
    <span
      className={`text-sm font-medium ${
        isGood ? "text-green-600" : "text-red-600"
      }`}
    >
      {isPositive ? "+" : ""}
      {formatCurrency(value)}
    </span>
  );
}

function PeriodStatusBadge({ period }: { period: ComparisonPeriod }) {
  if (period.hasIst && period.hasPlan) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
        IST + PLAN
      </span>
    );
  }
  if (period.hasIst) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        IST
      </span>
    );
  }
  if (period.hasPlan) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        PLAN
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      Keine Daten
    </span>
  );
}

export default function IstPlanComparisonTable({ caseId }: IstPlanComparisonTableProps) {
  const [data, setData] = useState<IstPlanComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"net" | "detailed">("net");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/cases/${caseId}/dashboard/ist-plan-comparison`, {
          credentials: "include",
        });

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
  }, [caseId]);

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

  if (!data) return null;

  // Perioden mit Daten
  const periodsWithData = data.periods.filter((p) => p.hasIst || p.hasPlan);

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-medium text-blue-900">IST/PLAN-Vergleich</h3>
            <p className="text-sm text-blue-700 mt-1">
              Diese Ansicht zeigt PLAN-Werte auch für Perioden mit IST-Daten. In der Liquiditätstabelle
              werden PLAN-Werte durch IST ersetzt - hier sehen Sie beide nebeneinander.
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* IST Total */}
        <div className="admin-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-green-700 font-bold text-xs">IST</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Reale Zahlungen</h3>
              <p className="text-xs text-gray-500">{data.meta.istEntryCount} Buchungen</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Einnahmen</span>
              <span className="text-sm font-medium text-green-600">{formatCurrency(data.totals.istInflowsCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Ausgaben</span>
              <span className="text-sm font-medium text-red-600">{formatCurrency(data.totals.istOutflowsCents)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-700">Netto</span>
              <span className={`text-sm font-bold ${BigInt(data.totals.istNetCents) >= 0 ? "text-green-700" : "text-red-700"}`}>
                {formatCurrency(data.totals.istNetCents)}
              </span>
            </div>
          </div>
        </div>

        {/* PLAN Total */}
        <div className="admin-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-700 font-bold text-xs">PLAN</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Geplante Werte</h3>
              <p className="text-xs text-gray-500">{data.meta.planEntryCount} Buchungen</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Einnahmen</span>
              <span className="text-sm font-medium text-green-600">{formatCurrency(data.totals.planInflowsCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Ausgaben</span>
              <span className="text-sm font-medium text-red-600">{formatCurrency(data.totals.planOutflowsCents)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-700">Netto</span>
              <span className={`text-sm font-bold ${BigInt(data.totals.planNetCents) >= 0 ? "text-green-700" : "text-red-700"}`}>
                {formatCurrency(data.totals.planNetCents)}
              </span>
            </div>
          </div>
        </div>

        {/* Abweichung Total */}
        <div className="admin-card p-4 border-l-4 border-purple-500">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <span className="text-purple-700 font-bold text-xs">Δ</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Abweichung</h3>
              <p className="text-xs text-gray-500">IST − PLAN</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Einnahmen</span>
              <DeviationBadge value={data.totals.deviationInflowsCents} type="inflow" />
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Ausgaben</span>
              <DeviationBadge value={data.totals.deviationOutflowsCents} type="outflow" />
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-700">Netto</span>
              <DeviationBadge value={data.totals.deviationNetCents} type="net" />
            </div>
          </div>
        </div>
      </div>

      {/* Toggle View Mode */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Ansicht:</span>
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setViewMode("net")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === "net"
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Netto-Ansicht
          </button>
          <button
            onClick={() => setViewMode("detailed")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === "detailed"
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Detailansicht
          </button>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700 sticky left-0 bg-gray-50 z-10">
                  Periode
                </th>
                <th className="text-center py-3 px-2 font-medium text-gray-700 min-w-[80px]">
                  Status
                </th>
                {viewMode === "detailed" ? (
                  <>
                    <th className="text-right py-3 px-4 font-medium text-green-700 bg-green-50/50">
                      IST Einnahmen
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-blue-700 bg-blue-50/50">
                      PLAN Einnahmen
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-purple-700">
                      Δ
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-green-700 bg-green-50/50">
                      IST Ausgaben
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-blue-700 bg-blue-50/50">
                      PLAN Ausgaben
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-purple-700">
                      Δ
                    </th>
                  </>
                ) : (
                  <>
                    <th className="text-right py-3 px-4 font-medium text-green-700 bg-green-50/50">
                      IST Netto
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-blue-700 bg-blue-50/50">
                      PLAN Netto
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-purple-700">
                      Abweichung
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">
                      %
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {periodsWithData.length === 0 ? (
                <tr>
                  <td colSpan={viewMode === "detailed" ? 9 : 6} className="py-8 text-center text-gray-500">
                    Keine Daten für den Vergleich vorhanden
                  </td>
                </tr>
              ) : (
                periodsWithData.map((period) => (
                  <tr
                    key={period.periodIndex}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-gray-900 sticky left-0 bg-white z-10">
                      {period.periodLabel}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <PeriodStatusBadge period={period} />
                    </td>
                    {viewMode === "detailed" ? (
                      <>
                        {/* Einnahmen */}
                        <td className="py-3 px-4 text-right bg-green-50/30">
                          {period.hasIst ? (
                            <span className="text-green-700">{formatCurrency(period.istInflowsCents)}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right bg-blue-50/30">
                          {period.hasPlan ? (
                            <span className="text-blue-700">{formatCurrency(period.planInflowsCents)}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {period.hasIst && period.hasPlan ? (
                            <DeviationBadge value={period.deviationInflowsCents} type="inflow" />
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        {/* Ausgaben */}
                        <td className="py-3 px-4 text-right bg-green-50/30">
                          {period.hasIst ? (
                            <span className="text-red-600">{formatCurrency(period.istOutflowsCents)}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right bg-blue-50/30">
                          {period.hasPlan ? (
                            <span className="text-red-600">{formatCurrency(period.planOutflowsCents)}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {period.hasIst && period.hasPlan ? (
                            <DeviationBadge value={period.deviationOutflowsCents} type="outflow" />
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        {/* Netto-Ansicht */}
                        <td className="py-3 px-4 text-right bg-green-50/30">
                          {period.hasIst ? (
                            <span className={BigInt(period.istNetCents) >= 0 ? "text-green-700" : "text-red-600"}>
                              {formatCurrency(period.istNetCents)}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right bg-blue-50/30">
                          {period.hasPlan ? (
                            <span className={BigInt(period.planNetCents) >= 0 ? "text-blue-700" : "text-red-600"}>
                              {formatCurrency(period.planNetCents)}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {period.hasIst && period.hasPlan ? (
                            <DeviationBadge value={period.deviationNetCents} type="net" />
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-500">
                          {period.hasIst && period.hasPlan ? (
                            formatPercent(period.deviationNetPercent)
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {/* Summenzeile */}
            {periodsWithData.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 font-medium">
                  <td className="py-3 px-4 text-gray-900 sticky left-0 bg-gray-100 z-10">
                    Gesamt
                  </td>
                  <td className="py-3 px-2"></td>
                  {viewMode === "detailed" ? (
                    <>
                      <td className="py-3 px-4 text-right text-green-700 bg-green-100/50">
                        {formatCurrency(data.totals.istInflowsCents)}
                      </td>
                      <td className="py-3 px-4 text-right text-blue-700 bg-blue-100/50">
                        {formatCurrency(data.totals.planInflowsCents)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <DeviationBadge value={data.totals.deviationInflowsCents} type="inflow" />
                      </td>
                      <td className="py-3 px-4 text-right text-red-600 bg-green-100/50">
                        {formatCurrency(data.totals.istOutflowsCents)}
                      </td>
                      <td className="py-3 px-4 text-right text-red-600 bg-blue-100/50">
                        {formatCurrency(data.totals.planOutflowsCents)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <DeviationBadge value={data.totals.deviationOutflowsCents} type="outflow" />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className={`py-3 px-4 text-right bg-green-100/50 ${BigInt(data.totals.istNetCents) >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {formatCurrency(data.totals.istNetCents)}
                      </td>
                      <td className={`py-3 px-4 text-right bg-blue-100/50 ${BigInt(data.totals.planNetCents) >= 0 ? "text-blue-700" : "text-red-600"}`}>
                        {formatCurrency(data.totals.planNetCents)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <DeviationBadge value={data.totals.deviationNetCents} type="net" />
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500">
                        {data.meta.planEntryCount > 0 ? (
                          formatPercent(
                            Number(
                              ((BigInt(data.totals.istNetCents) - BigInt(data.totals.planNetCents)) * BigInt(10000)) /
                                (BigInt(data.totals.planNetCents) || BigInt(1))
                            ) / 100
                          )
                        ) : (
                          "-"
                        )}
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 px-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-100 border border-green-300"></span>
          <span>IST = Reale Bankbewegungen</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-100 border border-blue-300"></span>
          <span>PLAN = Ursprüngliche Planung</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-purple-100 border border-purple-300"></span>
          <span>Δ = Abweichung (IST − PLAN)</span>
        </div>
      </div>
    </div>
  );
}
