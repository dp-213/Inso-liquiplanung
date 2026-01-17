"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import {
  CaseDashboardConfig,
  DashboardCalculationData,
} from "@/lib/case-dashboard/types";
import { ConfigurableDashboard } from "@/components/dashboard";
import EditableCategoryTable from "@/components/admin/EditableCategoryTable";
import PlanStructureManager from "@/components/admin/PlanStructureManager";

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
  const [editMode, setEditMode] = useState(false);
  const [showStructureManager, setShowStructureManager] = useState(false);
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

      // Trigger calculation (GET for read-only calculation)
      const calcRes = await fetch(`/api/cases/${id}/calculate`);
      if (!calcRes.ok) {
        const errData = await calcRes.json();
        throw new Error(errData.error || "Calculation failed");
      }
      const calcData = await calcRes.json();

      // Find minimum balance week
      let minBalanceWeek = 0;
      let minBalance = BigInt(calcData.openingBalanceCents || "0");
      calcData.weeks?.forEach((w: { weekOffset: number; closingBalanceCents: string }) => {
        const balance = BigInt(w.closingBalanceCents);
        if (balance < minBalance) {
          minBalance = balance;
          minBalanceWeek = w.weekOffset;
        }
      });

      // Transform to DashboardCalculationData (GET returns flat structure)
      const transformed: DashboardCalculationData = {
        caseInfo: {
          caseId: id,
          caseNumber: calcData.caseNumber || "",
          debtorName: calcData.debtorName || "",
          courtName: "",
          planStartDate: calcData.planStartDate || new Date().toISOString(),
        },
        kpis: {
          openingBalanceCents: BigInt(calcData.openingBalanceCents || "0"),
          closingBalanceCents: BigInt(calcData.finalClosingBalanceCents || "0"),
          totalInflowsCents: BigInt(calcData.totalInflowsCents || "0"),
          totalOutflowsCents: BigInt(calcData.totalOutflowsCents || "0"),
          netChangeCents: BigInt(calcData.totalNetCashflowCents || "0"),
          minBalanceCents: minBalance,
          minBalanceWeek: minBalanceWeek,
          negativeWeeksCount: (calcData.weeks || []).filter(
            (w: { closingBalanceCents: string }) => BigInt(w.closingBalanceCents) < BigInt(0)
          ).length,
        },
        weeks: (calcData.weeks || []).map((w: {
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
        }) => ({
          weekOffset: w.weekOffset,
          weekLabel: w.weekLabel,
          weekStartDate: w.weekStartDate,
          weekEndDate: w.weekEndDate,
          openingBalanceCents: BigInt(w.openingBalanceCents || "0"),
          closingBalanceCents: BigInt(w.closingBalanceCents || "0"),
          totalInflowsCents: BigInt(w.totalInflowsCents || "0"),
          totalOutflowsCents: BigInt(w.totalOutflowsCents || "0"),
          netCashflowCents: BigInt(w.netCashflowCents || "0"),
          inflowsAltmasseCents: BigInt(w.inflowsAltmasseCents || "0"),
          inflowsNeumasseCents: BigInt(w.inflowsNeumasseCents || "0"),
          outflowsAltmasseCents: BigInt(w.outflowsAltmasseCents || "0"),
          outflowsNeumasseCents: BigInt(w.outflowsNeumasseCents || "0"),
        })),
        categories: (calcData.categories || []).map((c: {
          id: string;
          name: string;
          flowType: "INFLOW" | "OUTFLOW";
          estateType: "ALTMASSE" | "NEUMASSE";
          totalCents: string;
          weeklyTotals: string[];
          lines: Array<{
            id: string;
            name: string;
            totalCents: string;
            weeklyValues: Array<{ effectiveCents: string }>;
          }>;
        }) => ({
          categoryId: c.id,
          categoryName: c.name,
          flowType: c.flowType,
          estateType: c.estateType,
          totalCents: BigInt(c.totalCents || "0"),
          weeklyTotalsCents: (c.weeklyTotals || []).map((v: string) => BigInt(v || "0")),
          lines: (c.lines || []).map((l) => ({
            lineId: l.id,
            lineName: l.name,
            totalCents: BigInt(l.totalCents || "0"),
            weeklyValuesCents: (l.weeklyValues || []).map((wv) => BigInt(wv.effectiveCents || "0")),
          })),
        })),
        calculationMeta: {
          calculatedAt: new Date().toISOString(),
          engineVersion: "1.0.0",
          dataHash: calcData.dataHash || "",
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
              Zurück zum Fall
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!config || !calculationData) {
    return (
      <div className="admin-card p-8 text-center">
        <p className="text-[var(--muted)]">Keine Daten verfügbar</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* WIP Banner */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white px-6 py-2 rounded-full shadow-lg font-bold text-sm tracking-wide flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        WORK IN PROGRESS
      </div>

      {/* Breadcrumb and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center text-sm text-[var(--muted)]">
          <Link href="/admin/cases" className="hover:text-[var(--primary)]">
            Fälle
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
          {/* Edit Mode Toggle */}
          <button
            onClick={() => setEditMode(!editMode)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              editMode
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-white border border-gray-200 text-[var(--foreground)] hover:bg-gray-50"
            }`}
          >
            {editMode ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Bearbeitung beenden
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Bearbeiten
              </>
            )}
          </button>

          {/* Structure Manager Button */}
          {editMode && (
            <button
              onClick={() => setShowStructureManager(true)}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 bg-white border border-gray-200 text-[var(--foreground)] hover:bg-gray-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Struktur verwalten
            </button>
          )}

          {/* View Mode Toggle */}
          {!editMode && (
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
          )}

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
                : "Zusammengeführt"}
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
      {editMode ? (
        <div className="admin-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Liquiditätsplan bearbeiten
            </h2>
            <div className="text-sm text-[var(--muted)]">
              Klicken Sie auf eine Zelle, um den Wert zu bearbeiten.
              Änderungen werden automatisch gespeichert.
            </div>
          </div>
          <EditableCategoryTable
            caseId={id}
            categories={calculationData.categories}
            weeks={calculationData.weeks}
            openingBalanceCents={calculationData.kpis.openingBalanceCents}
            onValueChange={loadData}
            onOpeningBalanceChange={() => loadData()}
          />
        </div>
      ) : (
        <ConfigurableDashboard
          caseId={id}
          config={config}
          calculationData={calculationData}
          viewMode={viewMode}
          isPreview={false}
        />
      )}

      {/* Plan Structure Manager Modal */}
      {showStructureManager && (
        <PlanStructureManager
          caseId={id}
          categories={calculationData.categories.map((c) => ({
            id: c.categoryId,
            name: c.categoryName,
            flowType: c.flowType,
            estateType: c.estateType,
            displayOrder: 0,
            lines: c.lines.map((l) => ({
              id: l.lineId,
              name: l.lineName,
              description: null,
              displayOrder: 0,
            })),
          }))}
          onUpdate={() => {
            loadData();
          }}
          onClose={() => setShowStructureManager(false)}
        />
      )}
    </div>
  );
}
