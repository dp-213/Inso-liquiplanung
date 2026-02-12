"use client";

import { formatEUR, cn, type ForecastData } from "./types";

interface ForecastSummaryCardsProps {
  data: ForecastData;
}

export default function ForecastSummaryCards({ data }: ForecastSummaryCardsProps) {
  const { summary, periods } = data;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KPICard
        label="Schluss-Saldo"
        value={formatEUR(summary.finalClosingBalanceCents)}
        sub={`Ende ${periods[periods.length - 1]?.periodLabel || ""}`}
        color={Number(summary.finalClosingBalanceCents) >= 0 ? "green" : "red"}
      />
      <KPICard
        label="Min. Headroom"
        value={formatEUR(summary.minHeadroomCents)}
        sub={periods[summary.minHeadroomPeriodIndex]?.periodLabel || ""}
        color={Number(summary.minHeadroomCents) >= 0 ? "green" : "red"}
      />
      <KPICard
        label="Gesamt-Einzahlungen"
        value={formatEUR(summary.totalInflowsCents)}
        sub="Alle Perioden"
        color="blue"
      />
      <KPICard
        label="Gesamt-Auszahlungen"
        value={formatEUR(summary.totalOutflowsCents)}
        sub="Alle Perioden"
        color="gray"
      />
    </div>
  );
}

function KPICard({ label, value, sub, color }: {
  label: string;
  value: string;
  sub: string;
  color: "green" | "red" | "blue" | "gray";
}) {
  const colors = {
    green: "bg-green-50 border-green-200",
    red: "bg-red-50 border-red-200",
    blue: "bg-blue-50 border-blue-200",
    gray: "bg-gray-50 border-gray-200",
  };

  return (
    <div className={cn("rounded-lg border p-4", colors[color])}>
      <p className="text-xs text-[var(--muted)] font-semibold uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-[var(--foreground)] mt-1">{value}</p>
      <p className="text-xs text-[var(--muted)] mt-0.5 truncate" title={sub}>{sub}</p>
    </div>
  );
}
