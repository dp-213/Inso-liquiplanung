"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/types/dashboard";
import type { LocationCompareResponse, LocationDeltaRow } from "./location-compare-types";

interface LocationDeltaViewProps {
  postData: LocationCompareResponse;
  preData: LocationCompareResponse;
}

function computeAvg(totalCents: string, monthCount: number): number {
  if (monthCount === 0) return 0;
  return Number(BigInt(totalCents)) / monthCount;
}

function computeCoverageBps(revCents: number, costCents: number): number {
  if (costCents === 0) return revCents > 0 ? 10000 : 0;
  return Math.round((revCents / costCents) * 10000);
}

function pctChange(pre: number, post: number): number | null {
  if (pre === 0) return null;
  return ((post - pre) / Math.abs(pre)) * 100;
}

function formatPct(val: number | null): string {
  if (val === null) return "–";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(1).replace(".", ",")} %`;
}

function formatPP(val: number): string {
  const pp = val / 100; // bps to percentage points
  const sign = pp > 0 ? "+" : "";
  return `${sign}${pp.toFixed(1).replace(".", ",")} PP`;
}

function formatAvgCurrency(cents: number): string {
  return formatCurrency(Math.round(cents).toString());
}

/** Einnahmen/Netto: Grün = gestiegen, Rot = gefallen */
function revenueColor(delta: number): string {
  if (delta > 0) return "text-emerald-600";
  if (delta < 0) return "text-red-600";
  return "text-gray-500";
}

/** Kosten: Grün = gesunken, Rot = gestiegen (invertiert) */
function costColor(delta: number): string {
  if (delta < 0) return "text-emerald-600";
  if (delta > 0) return "text-red-600";
  return "text-gray-500";
}

export default function LocationDeltaView({ postData, preData }: LocationDeltaViewProps) {
  const rows: LocationDeltaRow[] = useMemo(() => {
    const result: LocationDeltaRow[] = [];

    for (const postLoc of postData.locations) {
      const preLoc = preData.locations.find(
        (l) => l.id === postLoc.id
          || l.name === postLoc.name
          || (l.shortName != null && l.shortName === postLoc.shortName)
      );

      const postMonthCount = postData.monthLabels.length;
      const preMonthCount = preLoc ? preData.monthLabels.length : 0;

      const postRevAvg = computeAvg(postLoc.totals.revenueCents, postMonthCount);
      const postCostAvg = computeAvg(postLoc.totals.costsCents, postMonthCount);
      const postNetAvg = postRevAvg - postCostAvg;
      const postCovBps = computeCoverageBps(postRevAvg, postCostAvg);

      const preRevAvg = preLoc ? computeAvg(preLoc.totals.revenueCents, preMonthCount) : 0;
      const preCostAvg = preLoc ? computeAvg(preLoc.totals.costsCents, preMonthCount) : 0;
      const preNetAvg = preRevAvg - preCostAvg;
      const preCovBps = computeCoverageBps(preRevAvg, preCostAvg);

      result.push({
        locationName: postLoc.name,
        locationShortName: postLoc.shortName,
        pre: { revenueCentsAvg: preRevAvg, costsCentsAvg: preCostAvg, netCentsAvg: preNetAvg, coverageBps: preCovBps, monthCount: preMonthCount },
        post: { revenueCentsAvg: postRevAvg, costsCentsAvg: postCostAvg, netCentsAvg: postNetAvg, coverageBps: postCovBps, monthCount: postMonthCount },
        delta: { revenueCents: postRevAvg - preRevAvg, costsCents: postCostAvg - preCostAvg, netCents: postNetAvg - preNetAvg, coveragePP: postCovBps - preCovBps },
        deltaPercent: { revenue: pctChange(preRevAvg, postRevAvg), costs: pctChange(preCostAvg, postCostAvg), net: pctChange(preNetAvg, postNetAvg) },
      });
    }

    return result;
  }, [postData, preData]);

  const hasPreData = preData.monthLabels.length > 0;
  const hasPostData = postData.monthLabels.length > 0;

  if (!hasPreData || !hasPostData) {
    return (
      <div className="admin-card p-6">
        <div className="text-center py-8">
          <p className="text-[var(--muted)]">
            {!hasPreData
              ? "Keine Vorinsolvenz-Daten vorhanden – Delta kann nicht berechnet werden."
              : "Keine Verfahrensdaten vorhanden – Delta kann nicht berechnet werden."}
          </p>
        </div>
      </div>
    );
  }

  // Zeilen-Definition für die Tabelle
  const tableRows: {
    label: string;
    bold?: boolean;
    bgClass?: string;
    getValue: (row: LocationDeltaRow) => { pre: string; post: string; delta: string; colorClass: string };
  }[] = [
    {
      label: "Einnahmen Ø/Mo",
      getValue: (row) => ({
        pre: formatAvgCurrency(row.pre.revenueCentsAvg),
        post: formatAvgCurrency(row.post.revenueCentsAvg),
        delta: formatPct(row.deltaPercent.revenue),
        colorClass: revenueColor(row.delta.revenueCents),
      }),
    },
    {
      label: "Kosten Ø/Mo",
      getValue: (row) => ({
        pre: formatAvgCurrency(row.pre.costsCentsAvg),
        post: formatAvgCurrency(row.post.costsCentsAvg),
        delta: formatPct(row.deltaPercent.costs),
        colorClass: costColor(row.delta.costsCents),
      }),
    },
    {
      label: "Netto Ø/Mo",
      bold: true,
      bgClass: "bg-gray-50",
      getValue: (row) => ({
        pre: formatAvgCurrency(row.pre.netCentsAvg),
        post: formatAvgCurrency(row.post.netCentsAvg),
        delta: formatAvgCurrency(row.delta.netCents),
        colorClass: revenueColor(row.delta.netCents),
      }),
    },
    {
      label: "Deckungsgrad",
      getValue: (row) => ({
        pre: `${(row.pre.coverageBps / 100).toFixed(1).replace(".", ",")} %`,
        post: `${(row.post.coverageBps / 100).toFixed(1).replace(".", ",")} %`,
        delta: formatPP(row.delta.coveragePP),
        colorClass: revenueColor(row.delta.coveragePP),
      }),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="admin-card p-4 bg-blue-50 border border-blue-200">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-blue-700">
            Vergleich Ø/Monat: Geschäftskonten ({preData.monthLabels.length} Mon.) vs. ISK ({postData.monthLabels.length} Mon.)
          </p>
        </div>
      </div>

      {/* Delta-Tabelle: 1 Label-Spalte + 3 Spalten (Vor, Verfahren, Δ) pro Standort */}
      <div className="admin-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {/* Standort-Namen */}
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]" />
              {rows.map((row) => (
                <th
                  key={row.locationName}
                  colSpan={3}
                  className="text-center py-3 px-2 font-semibold text-[var(--foreground)]"
                >
                  {row.locationShortName || row.locationName}
                </th>
              ))}
            </tr>
            {/* Sub-Header: Vor | Verfahren | Δ */}
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 px-4 text-xs text-[var(--muted)]" />
              {rows.map((row) => (
                <th key={`sub-${row.locationName}`} colSpan={3} className="py-2 px-2">
                  <div className="grid grid-cols-3 text-xs text-[var(--muted)]">
                    <span className="text-right pr-2">Vor</span>
                    <span className="text-right pr-2">Verfahren</span>
                    <span className="text-right">Δ</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((tr) => (
              <tr
                key={tr.label}
                className={`border-b border-gray-100 hover:bg-gray-50 ${tr.bgClass || ""}`}
              >
                <td className={`py-3 px-4 text-[var(--foreground)] ${tr.bold ? "font-semibold" : "font-medium"}`}>
                  {tr.label}
                </td>
                {rows.map((row) => {
                  const val = tr.getValue(row);
                  return (
                    <td key={row.locationName} colSpan={3} className="py-3 px-2">
                      <div className="grid grid-cols-3">
                        <span className="text-right pr-2 text-[var(--secondary)]">{val.pre}</span>
                        <span className={`text-right pr-2 ${tr.bold ? "font-medium" : ""} text-[var(--foreground)]`}>{val.post}</span>
                        <span className={`text-right font-medium ${val.colorClass}`}>{val.delta}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
