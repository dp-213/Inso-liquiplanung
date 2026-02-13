"use client";

import { formatCurrency } from "@/types/dashboard";
import type { LocationCompareResponse, LocationCompareItem } from "./location-compare-types";

const MONTH_NAMES = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split("-");
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year.slice(2)}`;
}

function formatBps(bps: number): string {
  return (bps / 100).toFixed(1).replace(".", ",") + " %";
}

function coverageColorClass(bps: number): string {
  if (bps >= 10000) return "text-green-600";
  if (bps >= 7000) return "text-yellow-600";
  if (bps >= 4000) return "text-orange-600";
  return "text-red-600";
}

/**
 * Berechnet prozentuale Veränderung von first zu last.
 * Dividiert durch |first| für korrekte Vorzeichen auch bei negativen Werten.
 *
 * Beispiel: -53.600 → -44.600 = +16,8 % (Verbesserung)
 */
function computeTrend(first: bigint, last: bigint): string | null {
  if (first === 0n) return null;
  const diff = Number(last - first);
  const base = Math.abs(Number(first));
  if (base === 0) return null;
  const pct = (diff / base) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1).replace(".", ",")} %`;
}

function computeTrendPP(firstBps: number, lastBps: number): string | null {
  if (firstBps === 0 && lastBps === 0) return null;
  const diff = (lastBps - firstBps) / 100;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${diff.toFixed(1).replace(".", ",")} PP`;
}

interface LocationMonthlyTrendProps {
  data: LocationCompareResponse;
}

function LocationMonthTable({ location, monthLabels }: { location: LocationCompareItem; monthLabels: string[] }) {
  if (monthLabels.length === 0) return null;

  const firstMonth = location.months[monthLabels[0]];
  const lastMonth = location.months[monthLabels[monthLabels.length - 1]];

  const firstRev = firstMonth ? BigInt(firstMonth.revenueCents) : 0n;
  const lastRev = lastMonth ? BigInt(lastMonth.revenueCents) : 0n;
  const firstCost = firstMonth ? BigInt(firstMonth.costsCents) : 0n;
  const lastCost = lastMonth ? BigInt(lastMonth.costsCents) : 0n;
  const firstNet = firstMonth ? BigInt(firstMonth.netCents) : 0n;
  const lastNet = lastMonth ? BigInt(lastMonth.netCents) : 0n;
  const firstCov = firstMonth?.coverageBps ?? 0;
  const lastCov = lastMonth?.coverageBps ?? 0;

  const revTrend = computeTrend(firstRev, lastRev);
  const costTrend = computeTrend(firstCost, lastCost);
  const netTrend = computeTrend(firstNet, lastNet);
  const covTrend = computeTrendPP(firstCov, lastCov);

  return (
    <div className="admin-card overflow-x-auto">
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          {location.shortName || location.name}
        </h3>
      </div>
      <table className="w-full min-w-[500px]">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--secondary)] w-[120px]">
              Position
            </th>
            {monthLabels.map((ym) => (
              <th key={ym} className="px-3 py-2 text-right text-xs font-semibold text-[var(--secondary)]">
                {formatMonthLabel(ym)}
              </th>
            ))}
            <th className="px-3 py-2 text-right text-xs font-semibold text-[var(--secondary)]">
              Trend
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-3 py-1.5 text-sm text-[var(--secondary)]">Einnahmen</td>
            {monthLabels.map((ym) => {
              const m = location.months[ym];
              const val = m ? BigInt(m.revenueCents) : 0n;
              return (
                <td key={ym} className="px-3 py-1.5 text-right text-sm tabular-nums text-green-700">
                  {val !== 0n ? formatCurrency(val.toString()) : "--"}
                </td>
              );
            })}
            <td className="px-3 py-1.5 text-right text-xs font-medium text-[var(--secondary)]">
              {revTrend || "--"}
            </td>
          </tr>
          <tr>
            <td className="px-3 py-1.5 text-sm text-[var(--secondary)]">Kosten</td>
            {monthLabels.map((ym) => {
              const m = location.months[ym];
              const val = m ? BigInt(m.costsCents) : 0n;
              return (
                <td key={ym} className="px-3 py-1.5 text-right text-sm tabular-nums text-red-600">
                  {val !== 0n ? `-${formatCurrency(val.toString())}` : "--"}
                </td>
              );
            })}
            <td className="px-3 py-1.5 text-right text-xs font-medium text-[var(--secondary)]">
              {costTrend || "--"}
            </td>
          </tr>
          <tr className="font-semibold border-t border-[var(--border)]">
            <td className="px-3 py-1.5 text-sm text-[var(--foreground)]">Netto</td>
            {monthLabels.map((ym) => {
              const m = location.months[ym];
              const val = m ? BigInt(m.netCents) : 0n;
              return (
                <td key={ym} className={`px-3 py-1.5 text-right text-sm tabular-nums ${val >= 0n ? "text-green-700" : "text-red-600"}`}>
                  {val !== 0n ? formatCurrency(val.toString()) : "--"}
                </td>
              );
            })}
            <td className="px-3 py-1.5 text-right text-xs font-medium text-[var(--secondary)]">
              {netTrend || "--"}
            </td>
          </tr>
          <tr>
            <td className="px-3 py-1.5 text-sm text-[var(--secondary)]">Deckungsgrad</td>
            {monthLabels.map((ym) => {
              const m = location.months[ym];
              const bps = m?.coverageBps ?? 0;
              return (
                <td key={ym} className={`px-3 py-1.5 text-right text-sm font-medium ${coverageColorClass(bps)}`}>
                  {bps > 0 ? formatBps(bps) : "--"}
                </td>
              );
            })}
            <td className="px-3 py-1.5 text-right text-xs font-medium text-[var(--secondary)]">
              {covTrend || "--"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function LocationMonthlyTrend({ data }: LocationMonthlyTrendProps) {
  const activeLocations = data.locations.filter((l) => l.totals.entryCount > 0);

  if (activeLocations.length === 0 || data.monthLabels.length === 0) return null;

  return (
    <div className="space-y-4">
      {activeLocations.map((loc) => (
        <LocationMonthTable key={loc.id} location={loc} monthLabels={data.monthLabels} />
      ))}
    </div>
  );
}
