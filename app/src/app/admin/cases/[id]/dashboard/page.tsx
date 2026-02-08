"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import {
  CaseDashboardConfig,
  DashboardCalculationData,
} from "@/lib/case-dashboard/types";
import { ConfigurableDashboard } from "@/components/dashboard";
import EditableCategoryTable from "@/components/admin/EditableCategoryTable";
import PlanStructureManager from "@/components/admin/PlanStructureManager";
import LedgerDrillDownModal from "@/components/admin/LedgerDrillDownModal";
import EstateAllocationSummary from "@/components/admin/EstateAllocationSummary";

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
  const [drillDownPeriod, setDrillDownPeriod] = useState<number | null>(null);
  const [scope, setScope] = useState<"GLOBAL" | "LOCATION_VELBERT" | "LOCATION_UCKERATH_EITORF">("GLOBAL");
  // Estate Allocation (Alt/Neu aus Leistungsdatum)
  const [estateAllocation, setEstateAllocation] = useState<{
    totalAltmasseInflowsCents: string;
    totalAltmasseOutflowsCents: string;
    totalNeumasseInflowsCents: string;
    totalNeumasseOutflowsCents: string;
    totalUnklarInflowsCents: string;
    totalUnklarOutflowsCents: string;
    unklarCount: number;
    warnings: { type: string; severity: string; message: string; count: number; totalCents: string }[];
  } | null>(null);

  // Load config and calculate - defined with useCallback so it properly reacts to scope changes
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

      // Load dashboard data with scope (includes calculation + estate allocation)
      const dashboardRes = await fetch(`/api/cases/${id}/dashboard?scope=${scope}`, {
        credentials: "include",
      });
      if (!dashboardRes.ok) {
        const errData = await dashboardRes.json();
        throw new Error(errData.error || "Dashboard data failed to load");
      }
      const dashboardData = await dashboardRes.json();

      // Use dashboard calculation as calcData (correct API shape)
      const calcData = dashboardData.calculation || {};

      // Set estate allocation
      if (dashboardData.estateAllocation) {
        setEstateAllocation(dashboardData.estateAllocation);
      }

      // Find minimum balance week (use periods from dashboard)
      const periods = calcData.periods || [];
      let minBalanceWeek = 0;
      let minBalance = BigInt(calcData.openingBalanceCents || "0");
      periods.forEach((p: { periodIndex: number; closingBalanceCents: string }) => {
        const balance = BigInt(p.closingBalanceCents);
        if (balance < minBalance) {
          minBalance = balance;
          minBalanceWeek = p.periodIndex;
        }
      });

      // Transform to DashboardCalculationData (dashboard uses periods, not weeks)
      const transformed: DashboardCalculationData = {
        caseInfo: {
          caseId: id,
          caseNumber: dashboardData.case?.caseNumber || "",
          debtorName: dashboardData.case?.debtorName || "",
          courtName: dashboardData.case?.courtName || "",
          planStartDate: dashboardData.plan?.planStartDate || new Date().toISOString(),
        },
        kpis: {
          openingBalanceCents: BigInt(calcData.openingBalanceCents || "0"),
          closingBalanceCents: BigInt(calcData.finalClosingBalanceCents || "0"),
          totalInflowsCents: BigInt(calcData.totalInflowsCents || "0"),
          totalOutflowsCents: BigInt(calcData.totalOutflowsCents || "0"),
          netChangeCents: BigInt(calcData.totalNetCashflowCents || "0"),
          minBalanceCents: minBalance,
          minBalanceWeek: minBalanceWeek,
          negativeWeeksCount: periods.filter(
            (p: { closingBalanceCents: string }) => BigInt(p.closingBalanceCents) < BigInt(0)
          ).length,
        },
        weeks: periods.map((p: {
          periodIndex: number;
          periodLabel: string;
          periodStartDate: string;
          periodEndDate: string;
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
          weekOffset: p.periodIndex,
          weekLabel: p.periodLabel,
          weekStartDate: p.periodStartDate,
          weekEndDate: p.periodEndDate,
          openingBalanceCents: BigInt(p.openingBalanceCents || "0"),
          closingBalanceCents: BigInt(p.closingBalanceCents || "0"),
          totalInflowsCents: BigInt(p.totalInflowsCents || "0"),
          totalOutflowsCents: BigInt(p.totalOutflowsCents || "0"),
          netCashflowCents: BigInt(p.netCashflowCents || "0"),
          inflowsAltmasseCents: BigInt(p.inflowsAltmasseCents || "0"),
          inflowsNeumasseCents: BigInt(p.inflowsNeumasseCents || "0"),
          outflowsAltmasseCents: BigInt(p.outflowsAltmasseCents || "0"),
          outflowsNeumasseCents: BigInt(p.outflowsNeumasseCents || "0"),
        })),
        categories: (calcData.categories || []).map((c: {
          categoryName: string;
          flowType: "INFLOW" | "OUTFLOW";
          estateType: "ALTMASSE" | "NEUMASSE";
          totalCents: string | bigint;
          periodTotals: (string | bigint)[];
          lines: Array<{
            lineName: string;
            totalCents: string | bigint;
            periodValues: Array<{ periodIndex: number; effectiveCents: string | bigint }>;
          }>;
        }) => ({
          categoryId: c.categoryName.toLowerCase().replace(/\s+/g, '-'),
          categoryName: c.categoryName,
          flowType: c.flowType,
          estateType: c.estateType,
          totalCents: typeof c.totalCents === 'bigint' ? c.totalCents : BigInt(c.totalCents || "0"),
          weeklyTotalsCents: (c.periodTotals || []).map((v) => typeof v === 'bigint' ? v : BigInt(v || "0")),
          lines: (c.lines || []).map((l) => ({
            lineId: l.lineName.toLowerCase().replace(/\s+/g, '-'),
            lineName: l.lineName,
            totalCents: typeof l.totalCents === 'bigint' ? l.totalCents : BigInt(l.totalCents || "0"),
            weeklyValuesCents: (l.periodValues || []).map((pv) => typeof pv.effectiveCents === 'bigint' ? pv.effectiveCents : BigInt(pv.effectiveCents || "0")),
          })),
        })),
        calculationMeta: {
          calculatedAt: calcData.calculatedAt || new Date().toISOString(),
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
  }, [id, scope]);

  // Load config and calculate - runs whenever loadData changes (which happens when id or scope changes)
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
        <div className="flex items-center gap-4">
          {/* Breadcrumb */}
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

          {/* Tab Switcher: Dashboard / Planung - PROMINENT oben links */}
          <div className="flex items-center bg-blue-50 rounded-lg p-1 border border-blue-200">
            <Link
              href={`/admin/cases/${id}/dashboard`}
              className="px-4 py-1.5 text-sm font-medium rounded-md transition-colors bg-white text-[var(--foreground)] shadow-sm"
            >
              📊 Dashboard
            </Link>
            <Link
              href={`/admin/cases/${id}/planung`}
              className="px-4 py-1.5 text-sm font-medium rounded-md transition-colors text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/50"
            >
              📋 Planung
            </Link>
          </div>
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

          {/* Location Scope Toggle */}
          {!editMode && (
            <div className="flex items-center bg-blue-50 rounded-lg p-1">
              <button
                onClick={() => setScope("GLOBAL")}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  scope === "GLOBAL"
                    ? "bg-white text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                Gesamt
              </button>
              <button
                onClick={() => setScope("LOCATION_VELBERT")}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  scope === "LOCATION_VELBERT"
                    ? "bg-white text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                Velbert
              </button>
              <button
                onClick={() => setScope("LOCATION_UCKERATH_EITORF")}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  scope === "LOCATION_UCKERATH_EITORF"
                    ? "bg-white text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                Uckerath/Eitorf
              </button>
            </div>
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

      {/* Estate Allocation Summary (Alt/Neu aus Leistungsdatum) */}
      {estateAllocation && !editMode && (
        <EstateAllocationSummary caseId={id} data={estateAllocation} />
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

      {/* Ledger Drill-Down Modal */}
      {drillDownPeriod !== null && (
        <LedgerDrillDownModal
          caseId={id}
          periodIndex={drillDownPeriod}
          onClose={() => setDrillDownPeriod(null)}
        />
      )}

      {/* Drill-Down Bar (visible in non-edit mode) */}
      {!editMode && calculationData.weeks.length > 0 && (
        <div className="admin-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-[var(--foreground)]">
              Drill-Down: Ledger-Einträge pro Periode
            </h3>
            <Link
              href={`/admin/cases/${id}/ledger`}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              Vollständiges Zahlungsregister öffnen
            </Link>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-2">
            {calculationData.weeks.map((week) => (
              <button
                key={week.weekOffset}
                onClick={() => setDrillDownPeriod(week.weekOffset)}
                className="flex-shrink-0 px-3 py-2 text-xs rounded border border-[var(--border)] hover:bg-gray-50 hover:border-[var(--primary)] transition-colors"
                title={`${week.weekLabel}: Einträge anzeigen`}
              >
                <div className="font-medium">{week.weekLabel}</div>
                <div className="text-[var(--muted)] mt-0.5">
                  {((Number(week.netCashflowCents) / 100) / 1000).toFixed(0)}k
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
