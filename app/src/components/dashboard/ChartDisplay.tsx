"use client";

import { useState, useMemo } from "react";
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
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  CaseDashboardConfig,
  DashboardCalculationData,
  ChartType,
} from "@/lib/case-dashboard/types";
import { CHART_TYPE_LABELS } from "@/lib/case-dashboard/defaults";

interface ChartDisplayProps {
  config: CaseDashboardConfig;
  data: DashboardCalculationData;
}

/**
 * Configurable chart display component
 */
export default function ChartDisplay({ config, data }: ChartDisplayProps) {
  const [activeChart, setActiveChart] = useState<ChartType>(
    config.charts.defaultChart
  );

  // Format currency for axis
  const formatAxisCurrency = (value: number): string => {
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toFixed(0);
  };

  // Format currency for tooltip
  const formatTooltipCurrency = (value: number): string => {
    return value.toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Transform data for charts
  const chartData = useMemo(() => {
    return data.weeks.map((week) => ({
      name: week.weekLabel,
      closingBalance: Number(week.closingBalanceCents) / 100,
      openingBalance: Number(week.openingBalanceCents) / 100,
      inflows: Number(week.totalInflowsCents) / 100,
      outflows: Number(week.totalOutflowsCents) / 100,
      netCashflow: Number(week.netCashflowCents) / 100,
      inflowsAltmasse: Number(week.inflowsAltmasseCents) / 100,
      inflowsNeumasse: Number(week.inflowsNeumasseCents) / 100,
      outflowsAltmasse: Number(week.outflowsAltmasseCents) / 100,
      outflowsNeumasse: Number(week.outflowsNeumasseCents) / 100,
    }));
  }, [data.weeks]);

  // Calculate domain for balance chart
  const balanceDomain = useMemo(() => {
    const balances = chartData.map((d) => d.closingBalance);
    const min = Math.min(...balances);
    const max = Math.max(...balances);
    const padding = (max - min) * 0.1 || 10000;
    return [min - padding, max + padding];
  }, [chartData]);

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
      return (
        <div className="bg-white border border-[var(--border)] rounded-lg shadow-lg p-3">
          <p className="font-medium text-[var(--foreground)] mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p
              key={index}
              className="text-sm"
              style={{ color: entry.color }}
            >
              {getPayloadLabel(entry.name)}: {formatTooltipCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Get label for payload name
  const getPayloadLabel = (name: string): string => {
    const labels: Record<string, string> = {
      closingBalance: "Endbestand",
      openingBalance: "Anfangsbestand",
      inflows: "Einzahlungen",
      outflows: "Auszahlungen",
      netCashflow: "Netto-Cashflow",
      inflowsAltmasse: "Einzahlungen Altmasse",
      inflowsNeumasse: "Einzahlungen Neumasse",
      outflowsAltmasse: "Auszahlungen Altmasse",
      outflowsNeumasse: "Auszahlungen Neumasse",
    };
    return labels[name] || name;
  };

  // Render balance line chart
  const renderBalanceLineChart = () => (
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
          tickFormatter={formatAxisCurrency}
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={{ stroke: "#e2e8f0" }}
          axisLine={{ stroke: "#e2e8f0" }}
          domain={balanceDomain}
        />
        <Tooltip content={<CustomTooltip />} />
        {config.charts.showLegend && <Legend />}
        <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="5 5" strokeWidth={2} />
        <Area
          type="monotone"
          dataKey="closingBalance"
          stroke="none"
          fill="url(#balanceGradient)"
          name="Endbestand"
        />
        <Line
          type="monotone"
          dataKey="closingBalance"
          name="Endbestand"
          stroke="#1e40af"
          strokeWidth={3}
          dot={{ fill: "#1e40af", strokeWidth: 2, r: 4 }}
          activeDot={{ fill: "#1e40af", strokeWidth: 0, r: 6 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );

  // Render cashflow bar chart
  const renderCashflowBarChart = () => (
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
          tickFormatter={formatAxisCurrency}
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={{ stroke: "#e2e8f0" }}
          axisLine={{ stroke: "#e2e8f0" }}
        />
        <Tooltip content={<CustomTooltip />} />
        {config.charts.showLegend && <Legend />}
        <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
        <Bar
          dataKey="netCashflow"
          name="Netto-Cashflow"
          fill="#3b82f6"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );

  // Render inflow/outflow stacked chart
  const renderInflowOutflowChart = () => (
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
          tickFormatter={formatAxisCurrency}
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={{ stroke: "#e2e8f0" }}
          axisLine={{ stroke: "#e2e8f0" }}
        />
        <Tooltip content={<CustomTooltip />} />
        {config.charts.showLegend && <Legend />}
        <Bar
          dataKey="inflows"
          name="Einzahlungen"
          fill="#22c55e"
          stackId="a"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="outflows"
          name="Auszahlungen"
          fill="#ef4444"
          stackId="b"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );

  // Render estate comparison chart
  const renderEstateComparisonChart = () => (
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
          tickFormatter={formatAxisCurrency}
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={{ stroke: "#e2e8f0" }}
          axisLine={{ stroke: "#e2e8f0" }}
        />
        <Tooltip content={<CustomTooltip />} />
        {config.charts.showLegend && <Legend />}
        <Bar
          dataKey="inflowsAltmasse"
          name="Einz. Altmasse"
          fill="#4ade80"
          stackId="inflow"
        />
        <Bar
          dataKey="inflowsNeumasse"
          name="Einz. Neumasse"
          fill="#22c55e"
          stackId="inflow"
        />
        <Bar
          dataKey="outflowsAltmasse"
          name="Ausz. Altmasse"
          fill="#f87171"
          stackId="outflow"
        />
        <Bar
          dataKey="outflowsNeumasse"
          name="Ausz. Neumasse"
          fill="#ef4444"
          stackId="outflow"
        />
      </BarChart>
    </ResponsiveContainer>
  );

  // Render active chart
  const renderChart = () => {
    switch (activeChart) {
      case "balance_line":
        return renderBalanceLineChart();
      case "cashflow_bar":
        return renderCashflowBarChart();
      case "inflow_outflow_stacked":
        return renderInflowOutflowChart();
      case "estate_comparison":
        return renderEstateComparisonChart();
      default:
        return renderBalanceLineChart();
    }
  };

  // If no charts are visible, return null
  if (config.charts.visibleCharts.length === 0) {
    return null;
  }

  return (
    <div>
      {/* Chart type selector */}
      {config.charts.visibleCharts.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {config.charts.visibleCharts.map((chartType) => (
            <button
              key={chartType}
              onClick={() => setActiveChart(chartType)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeChart === chartType
                  ? "bg-[var(--primary)] text-white"
                  : "bg-gray-100 text-[var(--secondary)] hover:bg-gray-200"
              }`}
            >
              {CHART_TYPE_LABELS[chartType]}
            </button>
          ))}
        </div>
      )}

      {/* Chart container */}
      <div className="h-[300px] w-full">{renderChart()}</div>
    </div>
  );
}
