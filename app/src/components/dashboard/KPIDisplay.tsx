"use client";

import { useMemo } from "react";
import {
  CaseDashboardConfig,
  DashboardCalculationData,
  KPIType,
} from "@/lib/case-dashboard/types";
import { KPI_TYPE_LABELS } from "@/lib/case-dashboard/defaults";

interface KPIDisplayProps {
  config: CaseDashboardConfig;
  data: DashboardCalculationData;
}

interface KPIItem {
  type: KPIType;
  label: string;
  value: string;
  subtext?: string;
  isNegative: boolean;
  isWarning: boolean;
  icon: "currency" | "trend_down" | "clock" | "status" | "calendar" | "count";
}

/**
 * Configurable KPI display component
 */
export default function KPIDisplay({ config, data }: KPIDisplayProps) {
  const totalPeriods = data.weeks.length;
  // Format currency
  const formatCurrency = (cents: bigint): string => {
    const euros = Number(cents) / 100;
    return euros.toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Get ordered visible KPIs
  const visibleKPIs = useMemo((): KPIItem[] => {
    const orderedTypes = config.kpis.kpiOrder.filter((t) =>
      config.kpis.visibleKPIs.includes(t)
    );

    return orderedTypes.map((type): KPIItem => {
      const kpis = data.kpis;

      switch (type) {
        case "opening_balance":
          return {
            type,
            label: KPI_TYPE_LABELS[type],
            value: formatCurrency(kpis.openingBalanceCents),
            subtext: "Zu Beginn des Planungszeitraums",
            isNegative: kpis.openingBalanceCents < BigInt(0),
            isWarning: false,
            icon: "currency",
          };

        case "closing_balance":
          return {
            type,
            label: KPI_TYPE_LABELS[type],
            value: formatCurrency(kpis.closingBalanceCents),
            subtext: "Am Ende des Planungszeitraums",
            isNegative: kpis.closingBalanceCents < BigInt(0),
            isWarning: kpis.closingBalanceCents < BigInt(0),
            icon: "currency",
          };

        case "total_inflows":
          return {
            type,
            label: KPI_TYPE_LABELS[type],
            value: formatCurrency(kpis.totalInflowsCents),
            subtext: "Summe aller Einzahlungen",
            isNegative: false,
            isWarning: false,
            icon: "trend_down",
          };

        case "total_outflows":
          return {
            type,
            label: KPI_TYPE_LABELS[type],
            value: formatCurrency(kpis.totalOutflowsCents),
            subtext: "Summe aller Auszahlungen",
            isNegative: true,
            isWarning: false,
            icon: "trend_down",
          };

        case "net_change":
          return {
            type,
            label: KPI_TYPE_LABELS[type],
            value: formatCurrency(kpis.netChangeCents),
            subtext: "Einzahlungen minus Auszahlungen",
            isNegative: kpis.netChangeCents < BigInt(0),
            isWarning: kpis.netChangeCents < BigInt(0),
            icon: "status",
          };

        case "min_balance":
          return {
            type,
            label: KPI_TYPE_LABELS[type],
            value: formatCurrency(kpis.minBalanceCents),
            subtext: `Erreicht in Woche ${kpis.minBalanceWeek + 1}`,
            isNegative: kpis.minBalanceCents < BigInt(0),
            isWarning: kpis.minBalanceCents < BigInt(0),
            icon: "trend_down",
          };

        case "min_balance_week":
          return {
            type,
            label: KPI_TYPE_LABELS[type],
            value: `Woche ${kpis.minBalanceWeek + 1}`,
            subtext: `Saldo: ${formatCurrency(kpis.minBalanceCents)}`,
            isNegative: false,
            isWarning: kpis.minBalanceCents < BigInt(0),
            icon: "calendar",
          };

        case "negative_weeks_count":
          return {
            type,
            label: KPI_TYPE_LABELS[type],
            value: kpis.negativeWeeksCount.toString(),
            subtext:
              kpis.negativeWeeksCount === 0
                ? "Keine Unterdeckung"
                : `von ${totalPeriods} Perioden`,
            isNegative: kpis.negativeWeeksCount > 0,
            isWarning: kpis.negativeWeeksCount > 0,
            icon: "count",
          };

        default:
          return {
            type,
            label: type,
            value: "-",
            isNegative: false,
            isWarning: false,
            icon: "status",
          };
      }
    });
  }, [config.kpis, data.kpis]);

  // Icon components
  const renderIcon = (icon: KPIItem["icon"], isWarning: boolean, isNegative: boolean) => {
    const colorClass = isWarning
      ? "text-red-600"
      : isNegative
      ? "text-red-600"
      : "text-blue-600";

    const bgClass = isWarning
      ? "bg-red-100"
      : isNegative
      ? "bg-red-100"
      : "bg-blue-100";

    switch (icon) {
      case "currency":
        return (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgClass}`}>
            <svg className={`w-5 h-5 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );

      case "trend_down":
        return (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgClass}`}>
            <svg className={`w-5 h-5 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
          </div>
        );

      case "clock":
        return (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgClass}`}>
            <svg className={`w-5 h-5 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );

      case "status":
        return (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgClass}`}>
            {isWarning ? (
              <svg className={`w-5 h-5 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className={`w-5 h-5 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
        );

      case "calendar":
        return (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgClass}`}>
            <svg className={`w-5 h-5 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        );

      case "count":
        return (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgClass}`}>
            <svg className={`w-5 h-5 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
        );

      default:
        return null;
    }
  };

  // Grid columns based on number of KPIs
  const gridCols = visibleKPIs.length <= 3
    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    : visibleKPIs.length <= 4
    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6";

  return (
    <div className={`grid ${gridCols} gap-4`}>
      {visibleKPIs.map((kpi) => (
        <div key={kpi.type} className="admin-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--secondary)]">
                {kpi.label}
              </p>
              <p
                className={`mt-2 text-2xl font-bold ${
                  kpi.isWarning
                    ? "text-[var(--danger)]"
                    : kpi.isNegative
                    ? "text-[var(--danger)]"
                    : "text-[var(--foreground)]"
                }`}
              >
                {kpi.value}
              </p>
            </div>
            {renderIcon(kpi.icon, kpi.isWarning, kpi.isNegative)}
          </div>
          {kpi.subtext && (
            <p className="mt-3 text-xs text-[var(--muted)]">{kpi.subtext}</p>
          )}
        </div>
      ))}
    </div>
  );
}
