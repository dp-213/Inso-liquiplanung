"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  groupByCategoryTag,
  groupByPeriodAndTag,
  REVENUE_COLORS,
  type RevenueEntryForGrouping,
} from "@/lib/revenue-helpers";

interface RevenueTrendChartProps {
  entries: RevenueEntryForGrouping[];
}

const formatAxisCurrency = (value: number): string => {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toFixed(0);
};

const formatTooltipCurrency = (cents: number): string => {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
};

export default function RevenueTrendChart({ entries }: RevenueTrendChartProps) {
  // 1. Top-5 Serien ermitteln
  const grouped = useMemo(() => groupByCategoryTag(entries, 5), [entries]);

  // 2. Tags für Chart-Serien
  const seriesTags = useMemo(() => grouped.map((g) => g.tag), [grouped]);

  // 3. Perioden-Daten für Chart
  const chartData = useMemo(() => {
    if (entries.length === 0) return [];

    const periodData = groupByPeriodAndTag(entries, seriesTags);

    return periodData.map((p) => {
      const row: Record<string, number | string> = {
        periodLabel: p.periodLabel,
      };
      for (const g of grouped) {
        // Cent → EUR für Chart-Anzeige
        row[g.tag] = Number(p.series[g.tag] || BigInt(0)) / 100;
      }
      return row;
    });
  }, [entries, grouped, seriesTags]);

  if (chartData.length === 0) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg text-center text-[var(--muted)]">
        Keine Einnahmen im Zeitraum erfasst
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="periodLabel"
          tick={{ fontSize: 12, fill: "var(--secondary)" }}
        />
        <YAxis
          tickFormatter={formatAxisCurrency}
          tick={{ fontSize: 12, fill: "var(--secondary)" }}
          width={60}
        />
        <Tooltip
          formatter={(value, name) => {
            const label = grouped.find((g) => g.tag === name)?.label || String(name);
            // value ist bereits EUR (÷100 oben), zurück zu Cents für Formatierung
            return [formatTooltipCurrency(Number(value) * 100), label];
          }}
          labelStyle={{ fontWeight: 600 }}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--border)",
            fontSize: 13,
          }}
        />
        <Legend
          formatter={(value: string) =>
            grouped.find((g) => g.tag === value)?.label || value
          }
          wrapperStyle={{ fontSize: 12 }}
        />
        {grouped.map((g, idx) => (
          <Bar
            key={g.tag}
            dataKey={g.tag}
            stackId="revenue"
            fill={REVENUE_COLORS[idx % REVENUE_COLORS.length]}
            radius={idx === grouped.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
