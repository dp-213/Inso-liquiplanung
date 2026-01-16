"use client";

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

interface Week {
  weekOffset: number;
  weekLabel: string;
  totalInflowsCents: string;
}

interface Category {
  categoryName: string;
  flowType: string;
  estateType: string;
  totalCents: string;
  weeklyTotals: string[];
}

interface RevenueChartProps {
  weeks: Week[];
  categories: Category[];
}

const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4"];

export default function RevenueChart({ weeks, categories }: RevenueChartProps) {
  // Transform data for stacked bar chart
  const chartData = weeks.map((week, weekIdx) => {
    const dataPoint: Record<string, string | number> = {
      name: week.weekLabel,
    };

    categories.forEach((cat) => {
      const value = cat.weeklyTotals[weekIdx] || "0";
      dataPoint[cat.categoryName] = Number(BigInt(value)) / 100;
    });

    return dataPoint;
  });

  const formatCurrency = (value: number): string => {
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toFixed(0);
  };

  const formatTooltipValue = (value: number): string => {
    return value.toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Custom tooltip
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number; name: string; color: string }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum, entry) => sum + entry.value, 0);
      return (
        <div className="bg-white border border-[var(--border)] rounded-lg shadow-lg p-3">
          <p className="font-medium text-[var(--foreground)] mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatTooltipValue(entry.value)}
            </p>
          ))}
          <p className="text-sm font-medium text-[var(--foreground)] mt-2 pt-2 border-t border-[var(--border)]">
            Gesamt: {formatTooltipValue(total)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickLine={{ stroke: "#e2e8f0" }}
            axisLine={{ stroke: "#e2e8f0" }}
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickLine={{ stroke: "#e2e8f0" }}
            axisLine={{ stroke: "#e2e8f0" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: "20px" }}
            formatter={(value) => (
              <span className="text-sm text-[var(--secondary)]">{value}</span>
            )}
          />
          {categories.map((cat, idx) => (
            <Bar
              key={cat.categoryName}
              dataKey={cat.categoryName}
              stackId="revenue"
              fill={COLORS[idx % COLORS.length]}
              radius={idx === categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
