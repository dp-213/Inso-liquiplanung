"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import {
  CaseDashboardConfig,
  DashboardCalculationData,
} from "@/lib/case-dashboard/types";
import { ConfigurableDashboard } from "@/components/dashboard";

interface ConfigResponse {
  success: boolean;
  config: CaseDashboardConfig;
  metadata: {
    configSource: string;
    usesCustomCode: boolean;
    customComponentPath?: string;
  };
}

interface CalculationResponse {
  success: boolean;
  caseInfo: {
    caseId: string;
    caseNumber: string;
    debtorName: string;
    courtName: string;
    planStartDate: string;
  };
  result: {
    weeks: Array<{
      weekOffset: number;
      weekLabel: string;
      weekStartDate: string;
      weekEndDate: string;
      openingBalanceCents: string;
      closingBalanceCents: string;
      totalInflowsCents: string;
      totalOutflowsCents: string;
      netCashflowCents: string;
      inflowsAltmasseCents: string;
      inflowsNeumasseCents: string;
      outflowsAltmasseCents: string;
      outflowsNeumasseCents: string;
    }>;
    categories: Array<{
      categoryId: string;
      categoryName: string;
      flowType: "INFLOW" | "OUTFLOW";
      estateType: "ALTMASSE" | "NEUMASSE";
      totalCents: string;
      weeklyTotalsCents: string[];
      lines: Array<{
        lineId: string;
        lineName: string;
        totalCents: string;
        weeklyValuesCents: string[];
      }>;
    }>;
    summary: {
      openingBalance: number;
      closingBalance: number;
      totalInflows: number;
      totalOutflows: number;
      netChange: number;
      minimumBalance: number;
      minimumBalanceWeek: number;
    };
    calculatedAt: string;
    version: string;
    dataHash: string;
  };
}

export default function CaseDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<CaseDashboardConfig | null>(null);
  const [calculationData, setCalculationData] =
    useState<DashboardCalculationData | null>(null);
  const [viewMode, setViewMode] = useState<"internal" | "external">("internal");
  const [metadata, setMetadata] = useState<ConfigResponse["metadata"] | null>(null);

  // Load config and calculate
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load config
      const configRes = await fetch(`/api/cases/${id}/config`);
      if (!configRes.ok) {
        throw new Error("Failed to load configuration");
      }
      const configData: ConfigResponse = await configRes.json();
      setConfig(configData.config);
      setMetadata(configData.metadata);

      // Trigger calculation
      const calcRes = await fetch(`/api/cases/${id}/calculate`, {
        method: "POST",
      });
      if (!calcRes.ok) {
        const errData = await calcRes.json();
        throw new Error(errData.error || "Calculation failed");
      }
      const calcData: CalculationResponse = await calcRes.json();

      // Transform to DashboardCalculationData
      const transformed: DashboardCalculationData = {
        caseInfo: calcData.caseInfo || {
          caseId: id,
          caseNumber: "",
          debtorName: "",
          courtName: "",
          planStartDate: new Date().toISOString(),
        },
        kpis: {
          openingBalanceCents: BigInt(Math.round(calcData.result.summary.openingBalance)),
          closingBalanceCents: BigInt(Math.round(calcData.result.summary.closingBalance)),
          totalInflowsCents: BigInt(Math.round(calcData.result.summary.totalInflows)),
          totalOutflowsCents: BigInt(Math.round(calcData.result.summary.totalOutflows)),
          netChangeCents: BigInt(Math.round(calcData.result.summary.netChange)),
          minBalanceCents: BigInt(Math.round(calcData.result.summary.minimumBalance)),
          minBalanceWeek: calcData.result.summary.minimumBalanceWeek,
          negativeWeeksCount: calcData.result.weeks.filter(
            (w) => BigInt(w.closingBalanceCents) < BigInt(0)
          ).length,
        },
        weeks: calcData.result.weeks.map((w) => ({
          weekOffset: w.weekOffset,
          weekLabel: w.weekLabel,
          weekStartDate: w.weekStartDate,
          weekEndDate: w.weekEndDate,
          openingBalanceCents: BigInt(w.openingBalanceCents),
          closingBalanceCents: BigInt(w.closingBalanceCents),
          totalInflowsCents: BigInt(w.totalInflowsCents),
          totalOutflowsCents: BigInt(w.totalOutflowsCents),
          netCashflowCents: BigInt(w.netCashflowCents),
          inflowsAltmasseCents: BigInt(w.inflowsAltmasseCents || "0"),
          inflowsNeumasseCents: BigInt(w.inflowsNeumasseCents || "0"),
          outflowsAltmasseCents: BigInt(w.outflowsAltmasseCents || "0"),
          outflowsNeumasseCents: BigInt(w.outflowsNeumasseCents || "0"),
        })),
        categories: calcData.result.categories.map((c) => ({
          categoryId: c.categoryId,
          categoryName: c.categoryName,
          flowType: c.flowType,
          estateType: c.estateType,
          totalCents: BigInt(c.totalCents),
          weeklyTotalsCents: c.weeklyTotalsCents.map((v) => BigInt(v)),
          lines: c.lines.map((l) => ({
            lineId: l.lineId,
            lineName: l.lineName,
            totalCents: BigInt(l.totalCents),
            weeklyValuesCents: l.weeklyValuesCents.map((v) => BigInt(v)),
          })),
        })),
        calculationMeta: {
          calculatedAt: calcData.result.calculatedAt,
          engineVersion: calcData.result.version,
          dataHash: calcData.result.dataHash,
        },
      };

      setCalculationData(transformed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
        <span className="ml-3 text-[var(--muted)]">Dashboard wird geladen...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <svg
            className="w-12 h-12 text-[var(--danger)] mx-auto mb-4"
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
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            Dashboard konnte nicht geladen werden
          </h2>
          <p className="text-[var(--muted)] mb-4">{error}</p>
          <div className="flex justify-center gap-3">
            <button onClick={loadData} className="btn-primary">
              Erneut versuchen
            </button>
            <Link href={`/admin/cases/${id}`} className="btn-secondary">
              Zurueck zum Fall
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!config || !calculationData) {
    return (
      <div className="admin-card p-8 text-center">
        <p className="text-[var(--muted)]">Keine Daten verfuegbar</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center text-sm text-[var(--muted)]">
          <Link href="/admin/cases" className="hover:text-[var(--primary)]">
            Faelle
          </Link>
          <svg
            className="w-4 h-4 mx-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <Link href={`/admin/cases/${id}`} className="hover:text-[var(--primary)]">
            {calculationData.caseInfo.debtorName}
          </Link>
          <svg
            className="w-4 h-4 mx-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <span className="text-[var(--foreground)]">Dashboard</span>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("internal")}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === "internal"
                  ? "bg-white text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Intern
            </button>
            <button
              onClick={() => setViewMode("external")}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === "external"
                  ? "bg-white text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Extern
            </button>
          </div>

          <Link href={`/admin/cases/${id}/config`} className="btn-secondary">
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Konfigurieren
          </Link>

          <button onClick={loadData} className="btn-secondary">
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Config Source Info */}
      {metadata && (
        <div className="flex items-center gap-4 text-sm text-[var(--muted)]">
          <span>
            Konfiguration:{" "}
            <span className="font-medium text-[var(--secondary)]">
              {metadata.configSource === "default"
                ? "Standard"
                : metadata.configSource === "database"
                ? "Gespeichert"
                : metadata.configSource === "code"
                ? "Code"
                : "Zusammengefuehrt"}
            </span>
          </span>
          {metadata.usesCustomCode && (
            <span className="flex items-center text-blue-600">
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
              Custom Code aktiv
            </span>
          )}
          <span>
            Ansicht:{" "}
            <span className="font-medium text-[var(--secondary)]">
              {viewMode === "internal" ? "Intern" : "Extern"}
            </span>
          </span>
        </div>
      )}

      {/* Dashboard */}
      <ConfigurableDashboard
        caseId={id}
        config={config}
        calculationData={calculationData}
        viewMode={viewMode}
        isPreview={false}
      />
    </div>
  );
}
