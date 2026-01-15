"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";

interface Week {
  weekOffset: number;
  weekLabel: string;
  openingBalanceCents: string;
  totalInflowsCents: string;
  totalOutflowsCents: string;
  netCashflowCents: string;
  closingBalanceCents: string;
}

interface BalanceChartProps {
  weeks: Week[];
}

export default function BalanceChart({ weeks }: BalanceChartProps) {
  // Transform data for chart
  const chartData = weeks.map((week) => ({
    name: week.weekLabel,
    balance: Number(BigInt(week.closingBalanceCents)) / 100,
    inflows: Number(BigInt(week.totalInflowsCents)) / 100,
    outflows: -Number(BigInt(week.totalOutflowsCents)) / 100,
  }));

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

  // Find min/max for better scaling
  const balances = chartData.map((d) => d.balance);
  const minBalance = Math.min(...balances);
  const maxBalance = Math.max(...balances);
  const padding = (maxBalance - minBalance) * 0.1 || 10000;

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ value: number; name: string; color: string }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-[var(--border)] rounded-lg shadow-lg p-3">
          <p className="font-medium text-[var(--foreground)] mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name === "balance" ? "Kontostand" :
               entry.name === "inflows" ? "Einzahlungen" :
               "Auszahlungen"}: {formatTooltipValue(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
        >
          <defs>
            <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1e40af" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#1e40af" stopOpacity={0} />
            </linearGradient>
          </defs>
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
            domain={[minBalance - padding, maxBalance + padding]}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="5 5" strokeWidth={2} />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="none"
            fill="url(#balanceGradient)"
          />
          <Line
            type="monotone"
            dataKey="balance"
            name="balance"
            stroke="#1e40af"
            strokeWidth={3}
            dot={{ fill: "#1e40af", strokeWidth: 2, r: 4 }}
            activeDot={{ fill: "#1e40af", strokeWidth: 0, r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
