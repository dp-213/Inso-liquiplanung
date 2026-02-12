"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ForecastPeriod {
  periodIndex: number;
  periodLabel: string;
  openingBalanceCents: string;
  inflowsCents: string;
  outflowsCents: string;
  netCashflowCents: string;
  closingBalanceCents: string;
  source: "IST" | "PLAN" | "FORECAST" | "MIXED";
  istCount: number;
  planCount: number;
  isPast: boolean;
}

interface ForecastMeta {
  scenarioName: string;
  assumptionCount: number;
  creditLineCents: string;
  reservesTotalCents: string;
}

interface ForecastData {
  openingBalanceCents: string;
  todayPeriodIndex: number;
  periods: ForecastPeriod[];
  hasForecast?: boolean;
  forecastMeta?: ForecastMeta | null;
  // Filter info
  includeUnreviewed: boolean;
  unreviewedCount: number;
  totalEntryCount: number;
}

interface RollingForecastTableProps {
  caseId: string;
}

// Format currency
function formatEuro(cents: string | number): string {
  const value = typeof cents === "string" ? Number(cents) : cents;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

// Source indicator component
function SourceIndicator({ source }: { source: "IST" | "PLAN" | "FORECAST" | "MIXED" }) {
  if (source === "IST") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"
        title="Echte Bankbuchungen"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        IST
      </span>
    );
  }

  if (source === "FORECAST") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"
        title="Prognose aus Annahmen"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        PROGNOSE
      </span>
    );
  }

  if (source === "PLAN") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700"
        title="Statischer Planwert"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
        PLAN
      </span>
    );
  }

  // MIXED
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"
      title="Gemischt: IST und PLAN"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      Mix
    </span>
  );
}

export default function RollingForecastTable({
  caseId,
}: RollingForecastTableProps) {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeUnreviewed, setIncludeUnreviewed] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const url = `/api/cases/${caseId}/ledger/rolling-forecast?includeUnreviewed=${includeUnreviewed}`;
        const res = await fetch(url);
        if (res.ok) {
          const result = await res.json();
          setData(result);
        } else {
          setError("Fehler beim Laden");
        }
      } catch (err) {
        setError("Fehler beim Laden");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId, includeUnreviewed]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {error || "Keine Daten"}
      </div>
    );
  }

  const hasUnreviewedData = data.unreviewedCount > 0;
  const showingUnreviewed = data.includeUnreviewed && hasUnreviewedData;

  return (
    <div className="overflow-x-auto">
      {/* Forecast Info Banner */}
      {data.hasForecast && data.forecastMeta && (
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>
              Prognose-Daten aus <strong>{data.forecastMeta.scenarioName}</strong>
              {" "}&middot;{" "}
              {data.forecastMeta.assumptionCount} Annahmen
              {Number(data.forecastMeta.creditLineCents) > 0 && (
                <>
                  {" "}&middot;{" "}
                  Kreditlinie: {formatEuro(data.forecastMeta.creditLineCents)}
                </>
              )}
            </span>
          </div>
          <Link
            href={`/admin/cases/${caseId}/forecast`}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
          >
            Annahmen bearbeiten &rarr;
          </Link>
        </div>
      )}

      {/* Filter Toggle */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeUnreviewed}
              onChange={(e) => setIncludeUnreviewed(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
            />
            <span className="text-sm text-gray-700">
              Ungeprüfte Buchungen einbeziehen
            </span>
          </label>
          {hasUnreviewedData && (
            <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">
              {data.unreviewedCount} ungeprüft
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {data.totalEntryCount} Buchungen geladen
        </div>
      </div>

      {/* Warning when showing unreviewed data */}
      {showingUnreviewed && (
        <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">
              Achtung: Ungeprüfte Daten enthalten
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Diese Ansicht enthält {data.unreviewedCount} Buchungen, die noch nicht geprüft wurden.
              Die Zahlen können sich nach der Prüfung ändern.
            </p>
          </div>
        </div>
      )}

      {/* Empty state when no data and not including unreviewed */}
      {!includeUnreviewed && data.totalEntryCount === 0 && hasUnreviewedData && (
        <div className="mx-4 mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
          <p className="text-sm text-blue-800">
            Keine bestätigten Buchungen vorhanden.
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Es gibt {data.unreviewedCount} ungeprüfte Buchungen.
            Aktiviere &quot;Ungeprüfte Buchungen einbeziehen&quot; um diese anzuzeigen.
          </p>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-3 px-4 font-semibold text-gray-700">Periode</th>
            <th className="text-center py-3 px-2 font-semibold text-gray-700 w-24">Quelle</th>
            <th className="text-right py-3 px-4 font-semibold text-gray-700">Anfangsbestand</th>
            <th className="text-right py-3 px-4 font-semibold text-green-700">Einzahlungen</th>
            <th className="text-right py-3 px-4 font-semibold text-red-700">Auszahlungen</th>
            <th className="text-right py-3 px-4 font-semibold text-gray-700">Saldo</th>
            <th className="text-right py-3 px-4 font-semibold text-blue-700">Endbestand</th>
          </tr>
        </thead>
        <tbody>
          {data.periods.map((period, idx) => {
            const isToday = idx === data.todayPeriodIndex;
            const netPositive = Number(period.netCashflowCents) >= 0;
            const closingNegative = Number(period.closingBalanceCents) < 0;
            const isForecast = period.source === "FORECAST";

            return (
              <tr
                key={period.periodIndex}
                className={`border-b border-gray-100 transition-colors ${
                  isToday
                    ? "bg-amber-50 border-l-4 border-l-amber-400"
                    : period.source === "IST"
                      ? "bg-green-50/30 hover:bg-green-50"
                      : isForecast
                        ? "bg-blue-50/30 hover:bg-blue-50"
                        : "hover:bg-gray-50"
                }`}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${isToday ? "text-amber-700" : "text-gray-900"}`}>
                      {period.periodLabel}
                    </span>
                    {isToday && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 font-medium">
                        HEUTE
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-2 text-center">
                  <SourceIndicator source={period.source} />
                </td>
                <td className="py-3 px-4 text-right font-mono text-gray-600">
                  {formatEuro(period.openingBalanceCents)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-green-600">
                  +{formatEuro(period.inflowsCents)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-red-600">
                  {formatEuro(period.outflowsCents)}
                </td>
                <td className={`py-3 px-4 text-right font-mono ${netPositive ? "text-green-600" : "text-red-600"}`}>
                  {netPositive ? "+" : ""}{formatEuro(period.netCashflowCents)}
                </td>
                <td className={`py-3 px-4 text-right font-mono font-semibold ${closingNegative ? "text-red-600" : "text-blue-600"}`}>
                  {formatEuro(period.closingBalanceCents)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Footer */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 px-4">
        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span><strong>IST</strong> = Echte Bankbuchungen</span>
          </div>
          {data.hasForecast && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span><strong>PROGNOSE</strong> = Annahmen-basiert</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span><strong>PLAN</strong> = Statische Planwerte</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span><strong>Mix</strong> = IST und PLAN</span>
          </div>
        </div>

        {/* Forecast link */}
        {data.hasForecast && (
          <Link
            href={`/admin/cases/${caseId}/forecast`}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
          >
            Annahmen bearbeiten &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}
