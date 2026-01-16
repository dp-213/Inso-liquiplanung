"use client";

import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
  ReferenceArea,
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

export interface ChartMarker {
  periodLabel: string;  // e.g., "Dez 25"
  label: string;        // e.g., "KV-Restzahlung"
  color: string;        // e.g., "#10b981"
  type: "event" | "phase";  // event = single point, phase = range
  endPeriodLabel?: string;  // for phase type
}

interface BalanceChartProps {
  weeks: Week[];
  markers?: ChartMarker[];
  showPhases?: boolean;  // Show Fortführung/Nachlauf phases
}

export default function BalanceChart({ weeks, markers = [], showPhases = false }: BalanceChartProps) {
  // Transform data for chart
  const chartData = weeks.map((week) => ({
    name: week.weekLabel,
    balance: Number(BigInt(week.closingBalanceCents)) / 100,
    inflows: Number(BigInt(week.totalInflowsCents)) / 100,
    outflows: -Number(BigInt(week.totalOutflowsCents)) / 100,
  }));

  // Find marker positions by period label
  const getMarkerIndex = (periodLabel: string): number => {
    return chartData.findIndex((d) => d.name === periodLabel);
  };

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

          {/* Phase areas (Fortführung/Nachlauf) */}
          {showPhases && chartData.length > 3 && (
            <>
              <ReferenceArea
                x1={chartData[0].name}
                x2={chartData[Math.floor(chartData.length / 2)].name}
                fill="#10b981"
                fillOpacity={0.05}
                label={{ value: "Fortfuehrung", position: "insideTopLeft", fill: "#10b981", fontSize: 11 }}
              />
              <ReferenceArea
                x1={chartData[Math.floor(chartData.length / 2)].name}
                x2={chartData[chartData.length - 1].name}
                fill="#f59e0b"
                fillOpacity={0.05}
                label={{ value: "Nachlauf", position: "insideTopRight", fill: "#f59e0b", fontSize: 11 }}
              />
            </>
          )}

          {/* Event markers */}
          {markers.filter(m => m.type === "event").map((marker, idx) => {
            const markerIdx = getMarkerIndex(marker.periodLabel);
            if (markerIdx === -1) return null;
            return (
              <ReferenceLine
                key={`marker-${idx}`}
                x={marker.periodLabel}
                stroke={marker.color}
                strokeWidth={2}
                strokeDasharray="4 4"
                label={{
                  value: marker.label,
                  position: "top",
                  fill: marker.color,
                  fontSize: 10,
                  fontWeight: 500,
                }}
              />
            );
          })}

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
