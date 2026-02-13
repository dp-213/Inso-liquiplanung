"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";

interface ForecastPeriod {
  periodIndex: number;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
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
  totalIstPeriods: number;
  totalPlanPeriods: number;
  totalForecastPeriods?: number;
  periodType: string;
  hasForecast?: boolean;
  forecastMeta?: ForecastMeta | null;
  periods: ForecastPeriod[];
}

interface RollingForecastChartProps {
  caseId: string;
  scope?: "GLOBAL" | "LOCATION_VELBERT" | "LOCATION_UCKERATH_EITORF";
  /** Bankforderungen als Referenzlinie (nur bei GLOBAL sinnvoll) */
  bankClaimsCents?: bigint;
}

// Format currency
function formatEuro(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatCompact(value: number): string {
  const euros = value / 100;
  if (Math.abs(euros) >= 1000000) {
    return `${(euros / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(euros) >= 1000) {
    return `${(euros / 1000).toFixed(0)}K`;
  }
  return euros.toFixed(0);
}

// Custom tooltip
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; payload: ChartDataPoint }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const sourceLabel =
    data.source === "IST"
      ? "Echte Bankdaten"
      : data.source === "FORECAST"
        ? "Prognose (Annahmen)"
        : data.source === "PLAN"
          ? "Plan (Legacy)"
          : "Gemischt";

  const sourceBadgeClass =
    data.source === "IST"
      ? "bg-green-100 text-green-700"
      : data.source === "FORECAST"
        ? "bg-blue-100 text-blue-700"
        : data.source === "PLAN"
          ? "bg-purple-100 text-purple-700"
          : "bg-amber-100 text-amber-700";

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[200px]">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-900">{label}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sourceBadgeClass}`}>
          {sourceLabel}
        </span>
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Kontostand:</span>
          <span className="font-medium">{formatEuro(data.balance * 100)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Einzahlungen:</span>
          <span className="text-green-600">+{formatEuro(data.inflows * 100)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Auszahlungen:</span>
          <span className="text-red-600">{formatEuro(data.outflows * 100)}</span>
        </div>
      </div>
      {data.source === "IST" && (
        <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
          {data.istCount} Buchung{data.istCount !== 1 ? "en" : ""} erfasst
        </div>
      )}
    </div>
  );
}

interface ChartDataPoint {
  name: string;
  balance: number;
  inflows: number;
  outflows: number;
  source: "IST" | "PLAN" | "FORECAST" | "MIXED";
  istCount: number;
  planCount: number;
  isPast: boolean;
  isToday: boolean;
  // For split lines
  istBalance: number | null;
  forecastBalance: number | null;
  planBalance: number | null;
}

export default function RollingForecastChart({
  caseId,
  scope = "GLOBAL",
  bankClaimsCents,
}: RollingForecastChartProps) {
  const pathname = usePathname();
  const isAdminContext = pathname?.startsWith("/admin");
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/cases/${caseId}/ledger/rolling-forecast?scope=${scope}`);
        if (res.ok) {
          const result = await res.json();
          setData(result);
        } else {
          setError("Fehler beim Laden des Rolling Forecast");
        }
      } catch (err) {
        setError("Fehler beim Laden des Rolling Forecast");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId, scope]);

  // Transform data for chart
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!data) return [];

    // Finde den letzten IST-Punkt für den Übergang
    const lastIstIndex = data.periods.reduce((last, p, idx) =>
      p.source === "IST" || p.source === "MIXED" ? idx : last, -1
    );

    return data.periods.map((p, idx) => {
      const balance = Number(p.closingBalanceCents) / 100;
      const isToday = idx === data.todayPeriodIndex;

      // IST-Linie: IST + MIXED Perioden, plus Übergangs-Punkt
      const isIst = p.source === "IST" || p.source === "MIXED";
      // Forecast/Plan-Linie: FORECAST/PLAN Perioden, plus Übergangs-Punkt (letzter IST)
      const isForecast = p.source === "FORECAST";
      const isPlan = p.source === "PLAN";
      const isTransitionPoint = idx === lastIstIndex && lastIstIndex >= 0;

      return {
        name: p.periodLabel,
        balance,
        inflows: Number(p.inflowsCents) / 100,
        outflows: Number(p.outflowsCents) / 100,
        source: p.source,
        istCount: p.istCount,
        planCount: p.planCount,
        isPast: p.isPast,
        isToday,
        istBalance: isIst ? balance : null,
        forecastBalance: isForecast || (isTransitionPoint && data.hasForecast) ? balance : null,
        planBalance: isPlan || (isTransitionPoint && !data.hasForecast && !isForecast) ? balance : null,
      };
    });
  }, [data]);

  // Find today's period for the reference line
  const todayLabel = useMemo(() => {
    if (!data || data.todayPeriodIndex < 0) return null;
    return data.periods[data.todayPeriodIndex]?.periodLabel;
  }, [data]);

  // Calculate min/max for Y axis (inkl. Bankforderungen-Linie falls vorhanden)
  const { minBalance, maxBalance } = useMemo(() => {
    if (chartData.length === 0) return { minBalance: 0, maxBalance: 100000 };
    const balances = chartData.map((d) => d.balance);
    if (bankClaimsCents && bankClaimsCents > BigInt(0)) {
      balances.push(Number(bankClaimsCents) / 100);
    }
    const min = Math.min(...balances);
    const max = Math.max(...balances);
    const padding = (max - min) * 0.1 || 10000;
    return {
      minBalance: min - padding,
      maxBalance: max + padding,
    };
  }, [chartData, bankClaimsCents]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-[var(--secondary)]">Lade Rolling Forecast...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error || "Keine Daten verfügbar"}
      </div>
    );
  }

  const hasForecastPeriods = data.hasForecast && (data.totalForecastPeriods || 0) > 0;
  const hasPlanPeriods = data.totalPlanPeriods > 0;

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-green-500 rounded" />
          <span className="text-[var(--secondary)]">
            IST (Bankdaten): <strong className="text-green-600">{data.totalIstPeriods} Perioden</strong>
          </span>
        </div>
        {hasForecastPeriods && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-blue-500 rounded" />
            <span className="text-[var(--secondary)]">
              Prognose: <strong className="text-blue-600">{data.totalForecastPeriods} Perioden</strong>
            </span>
          </div>
        )}
        {hasPlanPeriods && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-purple-500 rounded" style={{ borderStyle: 'dashed', borderWidth: '2px', borderColor: '#8b5cf6', height: 0 }} />
            <span className="text-[var(--secondary)]">
              PLAN (Zukunft): <strong className="text-purple-600">{data.totalPlanPeriods} Perioden</strong>
            </span>
          </div>
        )}
        {hasForecastPeriods && data.forecastMeta && isAdminContext && (
          <Link
            href={`/admin/cases/${caseId}/forecast`}
            className="ml-auto text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Prognose aktiv ({data.forecastMeta.assumptionCount} Annahmen)
          </Link>
        )}
        {hasForecastPeriods && data.forecastMeta && !isAdminContext && (
          <span className="ml-auto text-xs text-blue-600 font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Prognose aktiv ({data.forecastMeta.assumptionCount} Annahmen)
          </span>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" aspect={2.5} minHeight={200}>
        <ComposedChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
          >
            <defs>
              <linearGradient id="istGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="planGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />

            <YAxis
              tickFormatter={(v) => formatCompact(v * 100)}
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              domain={[minBalance, maxBalance]}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Zero line */}
            <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="5 5" strokeWidth={1.5} />

            {/* Today marker */}
            {todayLabel && (
              <ReferenceLine
                x={todayLabel}
                stroke="#f59e0b"
                strokeWidth={2}
                label={{
                  value: "HEUTE",
                  position: "top",
                  fill: "#f59e0b",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
            )}

            {/* Bankforderungen-Referenzlinie */}
            {bankClaimsCents && bankClaimsCents > BigInt(0) && (
              <ReferenceLine
                y={Number(bankClaimsCents) / 100}
                stroke="#ef4444"
                strokeDasharray="8 4"
                strokeWidth={1.5}
                strokeOpacity={0.7}
                label={{
                  value: "Bankforderungen",
                  position: "right",
                  fill: "#ef4444",
                  fontSize: 10,
                  fontWeight: 500,
                }}
              />
            )}

            {/* IST Line - solid green */}
            <Line
              type="monotone"
              dataKey="istBalance"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ fill: "#10b981", strokeWidth: 2, stroke: "white", r: 5 }}
              activeDot={{ r: 7, strokeWidth: 0 }}
              connectNulls={false}
              name="IST"
            />

            {/* FORECAST Line - solid blue */}
            <Line
              type="monotone"
              dataKey="forecastBalance"
              stroke="#3b82f6"
              strokeWidth={3}
              strokeDasharray="8 4"
              dot={{ fill: "#3b82f6", strokeWidth: 2, stroke: "white", r: 5 }}
              activeDot={{ r: 7, strokeWidth: 0 }}
              connectNulls={false}
              name="PROGNOSE"
            />

            {/* PLAN Line - dashed purple (Legacy-Fallback) */}
            <Line
              type="monotone"
              dataKey="planBalance"
              stroke="#8b5cf6"
              strokeWidth={3}
              strokeDasharray="8 4"
              dot={{ fill: "#8b5cf6", strokeWidth: 2, stroke: "white", r: 5 }}
              activeDot={{ r: 7, strokeWidth: 0 }}
              connectNulls={false}
              name="PLAN"
            />

            <Legend
              content={() => (
                <div className="flex justify-center gap-6 mt-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-gray-600">IST (echte Bankdaten)</span>
                  </div>
                  {hasForecastPeriods && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-gray-600">Prognose (Annahmen-basiert)</span>
                    </div>
                  )}
                  {hasPlanPeriods && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      <span className="text-gray-600">PLAN (statisch)</span>
                    </div>
                  )}
                </div>
              )}
            />
          </ComposedChart>
        </ResponsiveContainer>

      {/* Info box */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        <strong>Rolling Forecast:</strong> Vergangenheit zeigt echte Bankbuchungen (IST),
        Zukunft zeigt {hasForecastPeriods ? "Prognosen aus Ihren Annahmen (PROGNOSE)" : "Planwerte (PLAN)"}.
        Sobald neue Bankdaten erfasst werden, ersetzen sie automatisch die Prognosewerte.
      </div>
    </div>
  );
}
