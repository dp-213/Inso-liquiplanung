"use client";

import { useMemo } from "react";
import {
  CaseDashboardConfig,
  DashboardCalculationData,
  DashboardProps,
} from "@/lib/case-dashboard/types";
import DashboardCard from "./DashboardCard";
import KPIDisplay from "./KPIDisplay";
import CategoryTable from "./CategoryTable";
import ChartDisplay from "./ChartDisplay";

/**
 * ConfigurableDashboard - Main dashboard component that renders based on configuration
 *
 * This component is the standard dashboard that can be used standalone or as a base
 * for case-specific custom dashboards.
 *
 * Architecture principle: This component only handles PRESENTATION.
 * All calculation data comes from the core engine via props.
 */
export default function ConfigurableDashboard({
  caseId,
  config,
  calculationData,
  viewMode,
  isPreview = false,
}: DashboardProps) {
  // Get view-specific config
  const viewConfig = useMemo(() => {
    return viewMode === "internal"
      ? config.viewVariants.internal.config
      : config.viewVariants.external.config;
  }, [config.viewVariants, viewMode]);

  // Get title and subtitle
  const title = useMemo(() => {
    if (viewConfig.titleOverride) {
      return viewConfig.titleOverride;
    }
    return `Liquiditätsplan - ${calculationData.caseInfo.debtorName}`;
  }, [viewConfig.titleOverride, calculationData.caseInfo.debtorName]);

  const subtitle = useMemo(() => {
    if (viewConfig.subtitleOverride) {
      return viewConfig.subtitleOverride;
    }
    return `${calculationData.caseInfo.caseNumber} | ${calculationData.caseInfo.courtName}`;
  }, [
    viewConfig.subtitleOverride,
    calculationData.caseInfo.caseNumber,
    calculationData.caseInfo.courtName,
  ]);

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("de-DE");
  };

  // Check if view is enabled
  const isViewEnabled =
    viewMode === "internal"
      ? config.viewVariants.internal.enabled
      : config.viewVariants.external.enabled;

  if (!isViewEnabled) {
    return (
      <div className="admin-card p-8 text-center">
        <p className="text-[var(--muted)]">
          Diese Ansicht ist für diesen Fall nicht aktiviert.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Preview Banner */}
      {isPreview && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-amber-600 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            <span className="text-sm text-amber-800">
              Vorschau-Modus - Änderungen wurden noch nicht gespeichert
            </span>
          </div>
        </div>
      )}

      {/* Header with custom styling */}
      <div
        className="admin-card p-6"
        style={
          config.styling.primaryColor
            ? { borderLeftColor: config.styling.primaryColor, borderLeftWidth: "4px" }
            : undefined
        }
      >
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Custom logo */}
            {config.styling.logoUrl && (
              <img
                src={config.styling.logoUrl}
                alt="Logo"
                className="h-12 w-auto object-contain"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-[var(--foreground)]">
                {title}
              </h1>
              <p className="text-[var(--secondary)] mt-1">{subtitle}</p>
              {config.styling.firmName && (
                <p className="text-sm text-[var(--muted)] mt-1">
                  {config.styling.firmName}
                </p>
              )}
            </div>
          </div>
          <div className="text-right text-sm text-[var(--muted)]">
            <p>Planungsbeginn: {formatDate(calculationData.caseInfo.planStartDate)}</p>
            <p>Stand: {formatDate(calculationData.calculationMeta.calculatedAt)}</p>
            {viewMode === "internal" && (
              <p className="font-mono text-xs mt-1">
                Hash: {calculationData.calculationMeta.dataHash.substring(0, 12)}...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <KPIDisplay config={config} data={calculationData} />

      {/* Warning if negative balance */}
      {calculationData.kpis.negativeWeeksCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-red-800">
                Liquiditaetsengpass prognostiziert
              </h3>
              <p className="text-sm text-red-700 mt-1">
                In {calculationData.kpis.negativeWeeksCount} von 13 Wochen wird ein negativer
                Kontostand erwartet. Der tiefste Stand wird in Woche{" "}
                {calculationData.kpis.minBalanceWeek + 1} erreicht.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {config.charts.visibleCharts.length > 0 && (
        <DashboardCard title="Liquiditaetsentwicklung">
          <ChartDisplay config={config} data={calculationData} />
        </DashboardCard>
      )}

      {/* Main Table */}
      <DashboardCard
        title={
          config.aggregations.groupBy === "week"
            ? "13-Wochen Liquiditätsplan"
            : "Monatliche Übersicht"
        }
        subtitle={`${formatDate(calculationData.caseInfo.planStartDate)} - ${formatDate(
          calculationData.weeks[calculationData.weeks.length - 1]?.weekEndDate ||
            calculationData.caseInfo.planStartDate
        )}`}
        noPadding
      >
        <CategoryTable config={config} data={calculationData} viewMode={viewMode} />
      </DashboardCard>

      {/* Footer */}
      {(config.styling.footerText || viewMode === "internal") && (
        <div className="text-center text-xs text-[var(--muted)] py-4">
          {config.styling.footerText && <p>{config.styling.footerText}</p>}
          {viewMode === "internal" && (
            <p className="mt-1">
              Berechnet am {formatDate(calculationData.calculationMeta.calculatedAt)} |
              Engine v{calculationData.calculationMeta.engineVersion}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Export sub-components for use in custom dashboards
 */
export { DashboardCard, KPIDisplay, CategoryTable, ChartDisplay };
