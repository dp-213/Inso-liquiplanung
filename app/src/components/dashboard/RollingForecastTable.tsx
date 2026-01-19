"use client";

import { useState, useEffect } from "react";

interface ForecastPeriod {
  periodIndex: number;
  periodLabel: string;
  openingBalanceCents: string;
  inflowsCents: string;
  outflowsCents: string;
  netCashflowCents: string;
  closingBalanceCents: string;
  source: "IST" | "PLAN" | "MIXED";
  istCount: number;
  planCount: number;
  isPast: boolean;
}

interface ForecastData {
  openingBalanceCents: string;
  todayPeriodIndex: number;
  periods: ForecastPeriod[];
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
function SourceIndicator({ source }: { source: "IST" | "PLAN" | "MIXED" }) {
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

  if (source === "PLAN") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700"
        title="Prognose / Planwert"
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

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/cases/${caseId}/ledger/rolling-forecast`);
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
  }, [caseId]);

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

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-3 px-4 font-semibold text-gray-700">Periode</th>
            <th className="text-center py-3 px-2 font-semibold text-gray-700 w-20">Quelle</th>
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

            return (
              <tr
                key={period.periodIndex}
                className={`border-b border-gray-100 transition-colors ${
                  isToday
                    ? "bg-amber-50 border-l-4 border-l-amber-400"
                    : period.source === "IST"
                      ? "bg-green-50/30 hover:bg-green-50"
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

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500 px-4">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span><strong>IST</strong> = Echte Bankbuchungen</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          <span><strong>PLAN</strong> = Prognose (wird bei IST-Erfassung ersetzt)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span><strong>Mix</strong> = Periode enthält IST und PLAN</span>
        </div>
      </div>
    </div>
  );
}
