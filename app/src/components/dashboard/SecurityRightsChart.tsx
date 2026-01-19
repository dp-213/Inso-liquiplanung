"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface AvailabilityPeriod {
  periodIndex: number;
  periodLabel: string;
  periodStart: string;
  available: string;
  encumbered: string;
  total: string;
}

interface SecurityRightsChartProps {
  caseId: string;
  periods?: number;
}

// Format Euro currency
function formatEuro(cents: number): string {
  const euros = cents / 100;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(euros);
}

export default function SecurityRightsChart({
  caseId,
  periods = 10,
}: SecurityRightsChartProps) {
  const [data, setData] = useState<AvailabilityPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/cases/${caseId}/ledger/availability?periods=${periods}`
        );

        if (res.ok) {
          const result = await res.json();
          setData(result.periods || []);
        } else {
          setError("Fehler beim Laden der Verfügbarkeitsdaten");
        }
      } catch (err) {
        setError("Fehler beim Laden der Verfügbarkeitsdaten");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId, periods]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-[var(--secondary)]">Lade Daten...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
      </div>
    );
  }

  // Check if there's any data with non-zero values
  const hasData = data.some(
    (d) => Number(d.available) !== 0 || Number(d.encumbered) !== 0
  );

  if (!hasData) {
    return (
      <div className="p-8 bg-gray-50 rounded-lg text-center">
        <svg
          className="w-12 h-12 text-gray-300 mx-auto mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
        <p className="text-[var(--muted)]">
          Keine Sicherungsrechte-Daten vorhanden
        </p>
        <p className="text-sm text-[var(--secondary)] mt-1">
          Die Daten werden aus dem Zahlungsregister basierend auf dem legalBucket
          aggregiert.
        </p>
      </div>
    );
  }

  // Transform data for chart
  const chartData = data.map((d) => ({
    name: d.periodLabel,
    available: Number(d.available) / 100, // Convert cents to euros
    encumbered: Math.abs(Number(d.encumbered)) / 100, // Ensure positive for chart
    total: Number(d.total) / 100,
  }));

  // Calculate totals
  const totalAvailable = data.reduce(
    (sum, d) => sum + Number(d.available),
    0
  );
  const totalEncumbered = data.reduce(
    (sum, d) => sum + Math.abs(Number(d.encumbered)),
    0
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-green-50 border border-green-200">
          <div className="text-sm text-green-700">Frei verfügbar (Masse)</div>
          <div className="text-2xl font-bold text-green-600">
            {formatEuro(totalAvailable)}
          </div>
        </div>
        <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
          <div className="text-sm text-orange-700">
            Gebunden (Absonderung)
          </div>
          <div className="text-2xl font-bold text-orange-600">
            {formatEuro(totalEncumbered)}
          </div>
        </div>
        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
          <div className="text-sm text-blue-700">Verfügbarkeitsquote</div>
          <div className="text-2xl font-bold text-blue-600">
            {totalAvailable + totalEncumbered > 0
              ? `${((totalAvailable / (totalAvailable + totalEncumbered)) * 100).toFixed(0)}%`
              : "–"}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer width="100%" height={320} minWidth={300}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              tickFormatter={(value) =>
                new Intl.NumberFormat("de-DE", {
                  notation: "compact",
                  compactDisplay: "short",
                }).format(value)
              }
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <Tooltip
              formatter={(value, name) => {
                const numValue = typeof value === 'number' ? value : 0;
                return [
                  formatEuro(numValue * 100),
                  name === "available" ? "Frei verfügbar" : "Gebunden",
                ];
              }}
              labelFormatter={(label) => `Periode: ${label}`}
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
            />
            <Legend
              formatter={(value) =>
                value === "available" ? "Frei verfügbar" : "Gebunden (Absonderung)"
              }
            />
            <Bar
              dataKey="available"
              stackId="a"
              fill="#10b981"
              radius={[0, 0, 0, 0]}
              name="available"
            />
            <Bar
              dataKey="encumbered"
              stackId="a"
              fill="#f97316"
              radius={[4, 4, 0, 0]}
              name="encumbered"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend Explanation */}
      <div className="flex flex-wrap gap-6 text-sm text-[var(--secondary)]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500" />
          <span>
            <strong>Frei verfügbar</strong>: Masseguthaben ohne Sicherungsrechte
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-500" />
          <span>
            <strong>Gebunden</strong>: Guthaben mit Absonderungsrechten
          </span>
        </div>
      </div>
    </div>
  );
}
