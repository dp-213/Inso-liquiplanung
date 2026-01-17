"use client";

import React, { useMemo, memo } from "react";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Cell,
  Line,
} from "recharts";

interface WaterfallData {
  periodLabel: string;
  openingBalance: number;
  inflows: number;
  outflows: number;
  insolvencyEffects: number;
  closingBalance: number;
}

interface WaterfallChartProps {
  data: WaterfallData[];
  showInsolvencyEffects?: boolean;
}

// Helper functions outside component
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

// Custom tooltip component outside main component
interface TooltipPayload {
  value: number;
  name: string;
  dataKey: string;
  payload: {
    rawOpeningBalance: number;
    rawInflows: number;
    rawOutflows: number;
    rawInsolvencyEffects: number;
    rawClosingBalance: number;
  };
}

const CustomTooltip = ({
  active,
  payload,
  label,
  showInsolvencyEffects,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  showInsolvencyEffects?: boolean;
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white border border-[var(--border)] rounded-lg shadow-lg p-3 min-w-[180px]">
        <p className="font-medium text-[var(--foreground)] mb-2 border-b pb-2">
          {label}
        </p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Anfangsbestand:</span>
            <span className="font-medium">{formatTooltipValue(data.rawOpeningBalance)}</span>
          </div>
          <div className="flex justify-between text-green-600">
            <span>+ Einzahlungen:</span>
            <span className="font-medium">{formatTooltipValue(data.rawInflows)}</span>
          </div>
          <div className="flex justify-between text-red-600">
            <span>- Auszahlungen:</span>
            <span className="font-medium">{formatTooltipValue(data.rawOutflows)}</span>
          </div>
          {showInsolvencyEffects && data.rawInsolvencyEffects !== 0 && (
            <div className={`flex justify-between ${data.rawInsolvencyEffects >= 0 ? "text-blue-600" : "text-orange-600"}`}>
              <span>{data.rawInsolvencyEffects >= 0 ? "+ " : ""}Insolvenzeffekte:</span>
              <span className="font-medium">{formatTooltipValue(data.rawInsolvencyEffects)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-1 mt-1">
            <span className="text-gray-700 font-medium">Endbestand:</span>
            <span className={`font-bold ${data.rawClosingBalance < 0 ? "text-red-600" : ""}`}>
              {formatTooltipValue(data.rawClosingBalance)}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

function WaterfallChartComponent({
  data,
  showInsolvencyEffects = true,
}: WaterfallChartProps) {
  // Memoize chart data transformation
  const chartData = useMemo(() => data.map((period, index) => ({
    name: period.periodLabel,
    opening: index === 0 ? period.openingBalance : 0,
    inflows: period.inflows,
    outflows: -period.outflows,
    insolvencyEffects: showInsolvencyEffects ? period.insolvencyEffects : 0,
    closingBalance: period.closingBalance,
    rawOpeningBalance: period.openingBalance,
    rawInflows: period.inflows,
    rawOutflows: period.outflows,
    rawInsolvencyEffects: period.insolvencyEffects,
    rawClosingBalance: period.closingBalance,
  })), [data, showInsolvencyEffects]);

  // Memoize min/max for scaling
  const { minValue, maxValue, padding } = useMemo(() => {
    const allValues = data.flatMap((d) => [
      d.openingBalance,
      d.closingBalance,
      d.openingBalance + d.inflows,
      d.openingBalance + d.inflows - d.outflows,
    ]);
    const min = Math.min(...allValues, 0);
    const max = Math.max(...allValues);
    return {
      minValue: min,
      maxValue: max,
      padding: (max - min) * 0.1 || 50000,
    };
  }, [data]);

  // Memoize summary values
  const summaryValues = useMemo(() => ({
    totalInflows: data.reduce((sum, d) => sum + d.inflows, 0),
    totalOutflows: data.reduce((sum, d) => sum + d.outflows, 0),
    totalInsolvencyEffects: data.reduce((sum, d) => sum + d.insolvencyEffects, 0),
    closingBalance: data[data.length - 1]?.closingBalance || 0,
  }), [data]);

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 justify-center text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500" />
          <span className="text-[var(--secondary)]">Einzahlungen</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500" />
          <span className="text-[var(--secondary)]">Auszahlungen</span>
        </div>
        {showInsolvencyEffects && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-purple-500" />
            <span className="text-[var(--secondary)]">Insolvenzeffekte</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-blue-600" />
          <span className="text-[var(--secondary)]">Endbestand</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
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
              domain={[minValue - padding, maxValue + padding]}
            />
            <Tooltip content={<CustomTooltip showInsolvencyEffects={showInsolvencyEffects} />} />
            <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="5 5" strokeWidth={2} />

            {/* Inflows (positive, green) */}
            <Bar dataKey="inflows" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`inflow-${index}`} fill="#22c55e" />
              ))}
            </Bar>

            {/* Outflows (negative, red) */}
            <Bar dataKey="outflows" stackId="b" fill="#ef4444" radius={[0, 0, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`outflow-${index}`} fill="#ef4444" />
              ))}
            </Bar>

            {/* Insolvency Effects (purple, can be positive or negative) */}
            {showInsolvencyEffects && (
              <Bar dataKey="insolvencyEffects" stackId="c" radius={[2, 2, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`effect-${index}`}
                    fill={entry.insolvencyEffects >= 0 ? "#a855f7" : "#f97316"}
                  />
                ))}
              </Bar>
            )}

            {/* Closing balance line */}
            <Line
              type="monotone"
              dataKey="closingBalance"
              stroke="#1e40af"
              strokeWidth={3}
              dot={{ fill: "#1e40af", strokeWidth: 2, r: 4 }}
              activeDot={{ fill: "#1e40af", strokeWidth: 0, r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="admin-card p-3">
          <p className="text-xs text-[var(--muted)]">Summe Einzahlungen</p>
          <p className="text-lg font-bold text-green-600">
            {formatTooltipValue(summaryValues.totalInflows)}
          </p>
        </div>
        <div className="admin-card p-3">
          <p className="text-xs text-[var(--muted)]">Summe Auszahlungen</p>
          <p className="text-lg font-bold text-red-600">
            {formatTooltipValue(summaryValues.totalOutflows)}
          </p>
        </div>
        {showInsolvencyEffects && (
          <div className="admin-card p-3">
            <p className="text-xs text-[var(--muted)]">Netto Insolvenzeffekte</p>
            <p className={`text-lg font-bold ${summaryValues.totalInsolvencyEffects >= 0 ? "text-purple-600" : "text-orange-600"}`}>
              {formatTooltipValue(summaryValues.totalInsolvencyEffects)}
            </p>
          </div>
        )}
        <div className="admin-card p-3">
          <p className="text-xs text-[var(--muted)]">Endbestand</p>
          <p className={`text-lg font-bold ${summaryValues.closingBalance < 0 ? "text-red-600" : "text-blue-600"}`}>
            {formatTooltipValue(summaryValues.closingBalance)}
          </p>
        </div>
      </div>
    </div>
  );
}

// Wrap with memo to prevent re-renders when parent state changes but props don't
const WaterfallChart = memo(WaterfallChartComponent);
export default WaterfallChart;
