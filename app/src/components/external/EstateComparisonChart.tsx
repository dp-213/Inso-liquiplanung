"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

interface EstateComparisonChartProps {
  altmasseInflows: bigint;
  altmasseOutflows: bigint;
  neumasseInflows: bigint;
  neumasseOutflows: bigint;
}

export default function EstateComparisonChart({
  altmasseInflows,
  altmasseOutflows,
  neumasseInflows,
  neumasseOutflows,
}: EstateComparisonChartProps) {
  const chartData = [
    {
      name: "Altmasse",
      einnahmen: Number(altmasseInflows) / 100,
      ausgaben: -Number(altmasseOutflows) / 100,
      netto: Number(altmasseInflows - altmasseOutflows) / 100,
    },
    {
      name: "Neumasse",
      einnahmen: Number(neumasseInflows) / 100,
      ausgaben: -Number(neumasseOutflows) / 100,
      netto: Number(neumasseInflows - neumasseOutflows) / 100,
    },
  ];

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
    return Math.abs(value).toLocaleString("de-DE", {
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
    payload?: Array<{ value: number; name: string; dataKey: string }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-[var(--border)] rounded-lg shadow-lg p-3">
          <p className="font-medium text-[var(--foreground)] mb-2">{label}</p>
          {payload.map((entry, index) => {
            const labelMap: Record<string, string> = {
              einnahmen: "Einnahmen",
              ausgaben: "Ausgaben",
              netto: "Netto",
            };
            const colorMap: Record<string, string> = {
              einnahmen: "#10b981",
              ausgaben: "#ef4444",
              netto: entry.value >= 0 ? "#10b981" : "#ef4444",
            };
            return (
              <p key={index} className="text-sm" style={{ color: colorMap[entry.dataKey] }}>
                {labelMap[entry.dataKey]}: {entry.dataKey === "ausgaben" ? "-" : ""}
                {formatTooltipValue(entry.value)}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          barGap={8}
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
            wrapperStyle={{ paddingTop: "10px" }}
            formatter={(value) => {
              const labelMap: Record<string, string> = {
                einnahmen: "Einnahmen",
                ausgaben: "Ausgaben",
                netto: "Netto",
              };
              return <span className="text-sm text-[var(--secondary)]">{labelMap[value] || value}</span>;
            }}
          />
          <Bar dataKey="einnahmen" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="ausgaben" fill="#ef4444" radius={[4, 4, 0, 0]} />
          <Bar dataKey="netto" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.netto >= 0 ? "#3b82f6" : "#f97316"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
