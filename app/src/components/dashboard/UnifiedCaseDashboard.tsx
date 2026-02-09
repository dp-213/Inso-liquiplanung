"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  CaseDashboardData,
  AccessMode,
  DashboardCapabilities,
  DashboardConfig,
  DEFAULT_DASHBOARD_CONFIG,
  getCapabilitiesForAccessMode,
  getPeriods,
  formatCurrency,
  getStatusLabel,
  getPlanTitle,
  getPeriodLabelRange,
  TabConfig,
} from "@/types/dashboard";

// Import existing components
import KPICards from "@/components/external/KPICards";
import LiquidityTable from "@/components/external/LiquidityTable";
import BalanceChart, { ChartMarker } from "@/components/external/BalanceChart";
import PDFExportButton from "@/components/external/PDFExportButton";
import RevenueChart from "@/components/external/RevenueChart";
import EstateComparisonChart from "@/components/external/EstateComparisonChart";
import PlanningAssumptions from "@/components/external/PlanningAssumptions";
import InsolvencyEffectsTable from "@/components/external/InsolvencyEffectsTable";
import WaterfallChart from "@/components/external/WaterfallChart";
import RevenueTable from "@/components/dashboard/RevenueTable";
import SecurityRightsChart from "@/components/dashboard/SecurityRightsChart";
import RollingForecastChart from "@/components/dashboard/RollingForecastChart";
import RollingForecastTable from "@/components/dashboard/RollingForecastTable";
import MasseCreditTab from "@/components/dashboard/MasseCreditTab";
import LocationView from "@/components/dashboard/iv-views/LocationView";
import LiquidityMatrixTable, { LiquidityScope, SCOPE_LABELS } from "@/components/dashboard/LiquidityMatrixTable";
import IstPlanComparisonTable from "@/components/dashboard/IstPlanComparisonTable";
import BankAccountsTab from "@/components/dashboard/BankAccountsTab";
import BusinessLogicContent from "@/components/business-logic/BusinessLogicContent";
import UnklarRiskBanner from "@/components/dashboard/UnklarRiskBanner";
import DataSourceLegend from "@/components/dashboard/DataSourceLegend";
import Link from "next/link";

// =============================================================================
// Tab Navigation Icons
// =============================================================================

function TabIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "chart":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      );
    case "money":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "shield":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case "folder":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      );
    case "compare":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case "waterfall":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
      );
    case "alert":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case "document":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "bank":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      );
    case "location":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "table":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    case "lightbulb":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      );
    default:
      return null;
  }
}

// =============================================================================
// Status Badge
// =============================================================================

function getStatusBadge(status: string) {
  switch (status) {
    case "verfügbar":
      return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Verfügbar</span>;
    case "gesperrt":
      return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Gesperrt</span>;
    case "offen":
      return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Offen</span>;
    case "vereinbarung":
      return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">In Vereinbarung</span>;
    case "abgerechnet":
      return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Abgerechnet</span>;
    default:
      return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">{status}</span>;
  }
}

// =============================================================================
// Payment Sources Config
// =============================================================================

const PAYMENT_SOURCES = [
  { id: "kv_advance", name: "KV-Abschläge", description: "Monatliche Abschlagszahlungen", rhythm: "Monatlich", color: "#3b82f6" },
  { id: "kv_final", name: "KV-Restzahlungen", description: "Quartalsweise Restzahlungen", rhythm: "Quartalsweise", color: "#10b981" },
  { id: "hzv_advance", name: "HZV-Abschläge", description: "Monatliche Pauschalen HZV", rhythm: "Monatlich", color: "#8b5cf6" },
  { id: "hzv_final", name: "HZV-Schlusszahlung", description: "Jährliche Abschlusszahlung", rhythm: "Jährlich", color: "#f59e0b" },
  { id: "pvs", name: "PVS-Zahlungen", description: "Privatpatienten-Abrechnungen", rhythm: "Laufend", color: "#ec4899" },
];

// =============================================================================
// Props Interface
// =============================================================================

interface UnifiedCaseDashboardProps {
  data: CaseDashboardData;
  accessMode: AccessMode;
  caseId?: string; // Explicit caseId for Rolling Forecast (fallback if data.case.id missing)
  capabilities?: DashboardCapabilities;
  config?: DashboardConfig;
  showHeader?: boolean;
  headerContent?: React.ReactNode;
}

// =============================================================================
// Main Component
// =============================================================================

export default function UnifiedCaseDashboard({
  data,
  accessMode,
  caseId: propCaseId,
  capabilities: propCapabilities,
  config = DEFAULT_DASHBOARD_CONFIG,
  showHeader = true,
  headerContent,
}: UnifiedCaseDashboardProps) {
  const [activeTab, setActiveTab] = useState(config.tabs[0]?.id || "overview");
  const reportRef = useRef<HTMLDivElement>(null);

  // Global scope state for consistent filtering across tabs
  const [scope, setScope] = useState<LiquidityScope>("GLOBAL");

  // Estate allocation state (loaded from API)
  const [estateData, setEstateData] = useState<{
    altmasseInflowTotal: bigint;
    altmasseOutflowTotal: bigint;
    neumasseInflowTotal: bigint;
    neumasseOutflowTotal: bigint;
    unklarInflowTotal: bigint;
    unklarOutflowTotal: bigint;
    unklarCount: number;
  } | null>(null);

  // Get capabilities
  const capabilities = propCapabilities || getCapabilitiesForAccessMode(accessMode);

  // Effective caseId (prop takes priority, fallback to data.case.id)
  const caseId = propCaseId || data.case?.id;

  // Memoized calculations
  const periods = useMemo(() => getPeriods(data), [data]);

  const { currentCash, minCash, runwayPeriod } = useMemo(() => {
    if (periods.length === 0) return { currentCash: BigInt(0), minCash: BigInt(0), runwayPeriod: -1 };
    const current = BigInt(periods[0]?.openingBalanceCents || "0");
    const min = periods.reduce((m, period) => {
      const balance = BigInt(period.closingBalanceCents);
      return balance < m ? balance : m;
    }, current);
    const runway = periods.findIndex((period) => BigInt(period.closingBalanceCents) <= BigInt(0));
    return { currentCash: current, minCash: min, runwayPeriod: runway };
  }, [periods]);

  const formatCurrencyFn = useCallback((cents: bigint | string): string => {
    return formatCurrency(cents);
  }, []);

  const paymentMarkers = useMemo((): ChartMarker[] => {
    if (periods.length === 0) return [];
    const markers: ChartMarker[] = [];
    const periodType = data.calculation.periodType || data.plan.periodType || "WEEKLY";
    if (periodType === "MONTHLY") {
      const kvMonths = ["Mrz", "Jun", "Sep", "Dez"];
      const hzvMonths = ["Dez", "Jan"];
      periods.forEach((period) => {
        const label = period.periodLabel || period.weekLabel || "";
        const monthAbbrev = label.split(" ")[0];
        if (kvMonths.some((m) => monthAbbrev.startsWith(m))) {
          markers.push({ periodLabel: label, label: "KV", color: "#10b981", type: "event" });
        }
        if (hzvMonths.some((m) => monthAbbrev.startsWith(m))) {
          markers.push({ periodLabel: label, label: "HZV", color: "#8b5cf6", type: "event" });
        }
      });
    }
    return markers;
  }, [periods, data.calculation.periodType, data.plan.periodType]);

  // Category calculations
  const { inflowCategories, outflowCategories } = useMemo(() => ({
    inflowCategories: data.calculation.categories.filter((c) => c.flowType === "INFLOW" && BigInt(c.totalCents) > BigInt(0)),
    outflowCategories: data.calculation.categories.filter((c) => c.flowType === "OUTFLOW" && BigInt(c.totalCents) > BigInt(0)),
  }), [data.calculation.categories]);

  // Load estate allocation data from API (IST LedgerEntries, not PLAN categories)
  useEffect(() => {
    if (!caseId) return;

    async function fetchEstateData() {
      try {
        const res = await fetch(`/api/cases/${caseId}/ledger/estate-summary?scope=${scope}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setEstateData({
            altmasseInflowTotal: BigInt(data.altmasseInflowCents),
            altmasseOutflowTotal: BigInt(data.altmasseOutflowCents),
            neumasseInflowTotal: BigInt(data.neumasseInflowCents),
            neumasseOutflowTotal: BigInt(data.neumasseOutflowCents),
            unklarInflowTotal: BigInt(data.unklarInflowCents),
            unklarOutflowTotal: BigInt(data.unklarOutflowCents),
            unklarCount: data.unklarCount,
          });
        }
      } catch (error) {
        console.error('Fehler beim Laden der Estate-Daten:', error);
      }
    }

    fetchEstateData();
  }, [caseId, scope]);

  // Revenue totals
  const { grandTotal, sourceTotals } = useMemo(() => ({
    grandTotal: inflowCategories.reduce((sum, c) => sum + BigInt(c.totalCents), BigInt(0)),
    sourceTotals: inflowCategories.map((cat) => ({
      name: cat.categoryName,
      total: BigInt(cat.totalCents),
      weeklyTotals: (cat.weeklyTotals || cat.periodTotals).map((t) => BigInt(t)),
    })),
  }), [inflowCategories]);

  // Bank account totals
  const bankAccountData = useMemo(() => {
    const accounts = data.bankAccounts?.accounts || [];
    return {
      accounts,
      totalBalance: accounts.reduce((sum, acc) => sum + BigInt(acc.currentBalanceCents || "0"), BigInt(0)),
      totalAvailable: accounts.reduce(
        (sum, acc) => acc.status !== "blocked" ? sum + BigInt(acc.currentBalanceCents || "0") : sum,
        BigInt(0)
      ),
    };
  }, [data.bankAccounts]);

  // Tabs die interne APIs mit Session-Auth benötigen
  const tabsRequiringInternalApi = new Set([
    "liquidity-matrix",
    "banks",
    "revenue", // RevenueTable braucht API
    "estate", // Estate-Summary API
    "security",
    "locations",
    "compare",
    "business-logik",
  ]);

  // Tabs die Scope NICHT unterstützen (zeigen immer global)
  const tabsWithoutScopeSupport = new Set([
    "banks",    // BankAccountsTab zeigt alle Konten (Scope-Filter wäre irreführend für Bank-Übersicht)
  ]);

  // Get visible tabs
  const visibleTabs = useMemo(() => {
    return config.tabs.filter((tab) => {
      // Für externe Ansicht: Tabs mit API-Abhängigkeiten ausblenden
      if (accessMode === "external" && tabsRequiringInternalApi.has(tab.id)) {
        return false;
      }

      // Für Standort-Ansicht: Tabs ohne Scope-Support ausblenden
      if (scope !== "GLOBAL" && tabsWithoutScopeSupport.has(tab.id)) {
        return false;
      }

      // Filter out tabs based on data availability
      if (tab.id === "insolvency" && (!data.insolvencyEffects || data.insolvencyEffects.effects.length === 0)) {
        // Still show but with placeholder
      }
      if (tab.id === "assumptions" && (!data.assumptions || data.assumptions.length === 0)) {
        // Still show but with placeholder
      }
      return true;
    });
  }, [config.tabs, data.insolvencyEffects, data.assumptions, accessMode, scope]);

  // Legacy data adapters for components expecting 'weeks'
  const weeksData = useMemo(() => {
    return periods.map((p) => ({
      weekOffset: p.periodIndex,
      weekLabel: p.periodLabel || p.weekLabel || "",
      openingBalanceCents: p.openingBalanceCents,
      totalInflowsCents: p.totalInflowsCents,
      totalOutflowsCents: p.totalOutflowsCents,
      netCashflowCents: p.netCashflowCents,
      closingBalanceCents: p.closingBalanceCents,
    }));
  }, [periods]);

  // Render tab content
  const renderTabContent = (tab: TabConfig) => {
    switch (tab.id) {
      case "overview":
        return (
          <div className="space-y-6">
            <KPICards
              currentCash={currentCash}
              minCash={minCash}
              runwayWeek={runwayPeriod >= 0 ? (periods[runwayPeriod]?.periodLabel || periods[runwayPeriod]?.weekLabel || null) : null}
              formatCurrency={(cents: bigint) => formatCurrencyFn(cents)}
              periodType={data.calculation.periodType || data.plan.periodType}
              periodCount={data.calculation.periodCount || data.plan.periodCount}
              bankBalanceCents={data.bankAccounts ? BigInt(data.bankAccounts.summary.totalBalanceCents) : null}
            />

            {/* Datenherkunft und Qualität */}
            {data.ledgerStats && <DataSourceLegend ledgerStats={data.ledgerStats} />}

            {/* Wasserfall-Darstellung */}
            <div className="admin-card p-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Wasserfall-Darstellung</h2>
              <p className="text-sm text-[var(--secondary)] mb-6">
                Die Wasserfall-Darstellung zeigt die Zusammensetzung der Cashflows pro Periode.
                Einzahlungen (grün) und Auszahlungen (rot) ergeben den Endbestand (blaue Linie).
              </p>
              <WaterfallChart
                data={periods.map((period) => ({
                  periodLabel: period.periodLabel || period.weekLabel || "",
                  openingBalance: Number(BigInt(period.openingBalanceCents)) / 100,
                  inflows: Number(BigInt(period.totalInflowsCents)) / 100,
                  outflows: Number(BigInt(period.totalOutflowsCents)) / 100,
                  insolvencyEffects: 0,
                  closingBalance: Number(BigInt(period.closingBalanceCents)) / 100,
                }))}
                showInsolvencyEffects={false}
              />
            </div>

            {/* Rolling Forecast Chart - IST (Vergangenheit) + PLAN (Zukunft) - NUR für angemeldete Nutzer */}
            {accessMode !== "external" && caseId && (
              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Rolling Forecast</h2>
                <RollingForecastChart caseId={caseId} scope={scope} />
              </div>
            )}

            {/* Rolling Forecast Tabelle - zeigt IST/PLAN pro Periode - NUR für angemeldete Nutzer */}
            {accessMode !== "external" && caseId && (
              <div className="admin-card">
                <div className="px-6 py-4 border-b border-[var(--border)]">
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">Liquiditätsübersicht</h2>
                </div>
                <RollingForecastTable caseId={caseId} />
              </div>
            )}

            {/* 10-Monatsplanung Kategorien-Tabelle */}
            <div className="admin-card">
              <div className="px-6 py-4 border-b border-[var(--border)]">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">{getPlanTitle(data)}</h2>
              </div>
              <LiquidityTable
                weeks={weeksData}
                categories={data.calculation.categories}
                openingBalance={BigInt(data.calculation.openingBalanceCents)}
                compact={true}
              />
            </div>
          </div>
        );

      case "liquidity-matrix":
        return (
          <div className="space-y-6">
            {caseId ? (
              <LiquidityMatrixTable
                caseId={caseId}
                scope={scope}
                onScopeChange={setScope}
                hideScopeToggle={true}
              />
            ) : (
              <div className="admin-card p-6">
                <div className="text-center text-gray-500">
                  Case-ID nicht verfügbar
                </div>
              </div>
            )}
          </div>
        );

      case "banks":
        return (
          <div className="space-y-6">
            {caseId ? (
              <>
                {/* Bankkonto-Übersicht mit Opening Balance und aktuellen Salden */}
                <div className="admin-card p-6">
                  <BankAccountsTab caseId={caseId} />
                </div>

                {/* Massekredit-Analyse (bestehend) */}
                <MasseCreditTab caseId={caseId} />
              </>
            ) : (
              <div className="admin-card p-6">
                <div className="text-center text-gray-500">
                  Case-ID nicht verfügbar
                </div>
              </div>
            )}
          </div>
        );

      case "revenue":
        return (
          <div className="space-y-6">
            {/* Datengetriebene Einnahmen-Übersicht aus Zahlungsregister */}
            {caseId && (
              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Einnahmen nach Quelle</h2>
                <RevenueTable caseId={caseId} months={6} showSummary={true} scope={scope} />
              </div>
            )}

            {/* Zusätzlich: Einnahmen aus Plankategorien (falls vorhanden) */}
            {sourceTotals.length > 0 && (
              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Einnahmen nach Plankategorie</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {sourceTotals.map((source, idx) => (
                    <div key={source.name} className="p-4 rounded-lg border border-[var(--border)] bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-[var(--secondary)]">{source.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${PAYMENT_SOURCES[idx % PAYMENT_SOURCES.length].color}20`, color: PAYMENT_SOURCES[idx % PAYMENT_SOURCES.length].color }}>
                          {grandTotal > BigInt(0) ? `${((Number(source.total) / Number(grandTotal)) * 100).toFixed(0)}%` : "0%"}
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-[var(--foreground)]">{formatCurrencyFn(source.total)}</div>
                    </div>
                  ))}
                </div>
                <div className="p-4 rounded-lg bg-[var(--primary)] text-white">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Gesamteinnahmen (Plan)</span>
                    <span className="text-2xl font-bold">{formatCurrencyFn(grandTotal)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="admin-card p-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Einnahmen-Verlauf</h2>
              <RevenueChart weeks={weeksData} categories={inflowCategories} />
            </div>
          </div>
        );

      case "security":
        return (
          <div className="space-y-6">
            {/* Verfügbar vs. Gebunden Chart */}
            {caseId && (
              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Verfügbarkeit über Zeit</h2>
                <SecurityRightsChart caseId={caseId} periods={10} />
              </div>
            )}

            {/* Bank Account Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="admin-card p-4">
                <div className="text-sm text-[var(--secondary)]">Bankguthaben Gesamt</div>
                <div className="text-2xl font-bold text-[var(--foreground)]">{formatCurrencyFn(bankAccountData.totalBalance)}</div>
              </div>
              <div className="admin-card p-4">
                <div className="text-sm text-[var(--secondary)]">Davon verfügbar</div>
                <div className="text-2xl font-bold text-green-600">{formatCurrencyFn(bankAccountData.totalAvailable)}</div>
              </div>
              <div className="admin-card p-4">
                <div className="text-sm text-[var(--secondary)]">Bankkonten</div>
                <div className="text-2xl font-bold text-[var(--foreground)]">{bankAccountData.accounts.length}</div>
              </div>
            </div>

            <div className="admin-card p-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Bankkonto-Übersicht (Bankenspiegel)</h2>
              <p className="text-sm text-[var(--secondary)] mb-4">Zeigt alle Bankkonten mit Standort-Zuordnung, Opening Balance und aktuellen Salden</p>
              {caseId ? (
                <BankAccountsTab caseId={caseId} />
              ) : (
                <div className="p-8 bg-gray-50 rounded-lg text-center">
                  <p className="text-[var(--muted)]">Case-ID nicht verfügbar</p>
                </div>
              )}
            </div>
          </div>
        );

      case "estate":
        if (!estateData) {
          return (
            <div className="flex items-center justify-center p-8">
              <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-[var(--secondary)]">Lade Estate-Daten...</span>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            {/* Links zu Detail-Listen (Backup Pages) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href={`/admin/cases/${caseId}/ledger?estateAllocation=ALTMASSE`}
                className="admin-card p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="font-medium">Altmasse</span>
                </div>
                <p className="text-sm text-[var(--secondary)]">
                  Alle Buchungen vor Insolvenzeröffnung ansehen →
                </p>
              </Link>

              <Link
                href={`/admin/cases/${caseId}/ledger?estateAllocation=NEUMASSE`}
                className="admin-card p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="font-medium">Neumasse</span>
                </div>
                <p className="text-sm text-[var(--secondary)]">
                  Alle Buchungen nach Insolvenzeröffnung ansehen →
                </p>
              </Link>

              {/* UNKLAR - prominent, mit Warnung */}
              {estateData.unklarCount > 0 && (
                <Link
                  href={`/admin/cases/${caseId}/ledger?estateAllocation=UNKLAR`}
                  className="admin-card p-4 hover:shadow-md transition-shadow border-l-4 border-amber-500 bg-amber-50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-medium text-amber-800">{estateData.unklarCount} nicht zugeordnet</span>
                  </div>
                  <p className="text-sm text-amber-700">
                    Buchungen ohne Alt/Neu-Zuordnung prüfen →
                  </p>
                </Link>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="admin-card p-4">
                <div className="text-sm text-[var(--secondary)]">Gesamteinnahmen</div>
                <div className="text-2xl font-bold text-green-600">{formatCurrencyFn(estateData.altmasseInflowTotal + estateData.neumasseInflowTotal)}</div>
              </div>
              <div className="admin-card p-4">
                <div className="text-sm text-[var(--secondary)]">Gesamtausgaben</div>
                <div className="text-2xl font-bold text-red-600">-{formatCurrencyFn(estateData.altmasseOutflowTotal + estateData.neumasseOutflowTotal)}</div>
              </div>
              <div className="admin-card p-4">
                <div className="text-sm text-[var(--secondary)]">Netto-Zufluss</div>
                <div className="text-2xl font-bold text-[var(--foreground)]">{formatCurrencyFn((estateData.altmasseInflowTotal + estateData.neumasseInflowTotal) - (estateData.altmasseOutflowTotal + estateData.neumasseOutflowTotal))}</div>
              </div>
            </div>

            <div className="admin-card p-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Altmasse vs Neumasse Vergleich</h2>
              <EstateComparisonChart altmasseInflows={estateData.altmasseInflowTotal} altmasseOutflows={estateData.altmasseOutflowTotal} neumasseInflows={estateData.neumasseInflowTotal} neumasseOutflows={estateData.neumasseOutflowTotal} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Altmasse */}
              <div className="admin-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">Altmasse</h2>
                </div>
                <p className="text-sm text-[var(--secondary)] mb-4">Vor Insolvenzeröffnung entstanden (inkl. anteilige MIXED-Buchungen)</p>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="p-3 bg-green-50 rounded">
                    <div className="text-xs text-[var(--secondary)] mb-1">Einnahmen</div>
                    <div className="text-lg font-semibold text-green-600">{formatCurrencyFn(estateData.altmasseInflowTotal)}</div>
                  </div>
                  <div className="p-3 bg-red-50 rounded">
                    <div className="text-xs text-[var(--secondary)] mb-1">Ausgaben</div>
                    <div className="text-lg font-semibold text-red-600">{formatCurrencyFn(estateData.altmasseOutflowTotal)}</div>
                  </div>
                </div>
                <div className={`mt-4 p-3 rounded-lg ${estateData.altmasseInflowTotal >= estateData.altmasseOutflowTotal ? "bg-green-600" : "bg-red-600"} text-white`}>
                  <div className="flex justify-between"><span>Netto Altmasse</span><span className="font-bold">{formatCurrencyFn(estateData.altmasseInflowTotal - estateData.altmasseOutflowTotal)}</span></div>
                </div>
              </div>

              {/* Neumasse */}
              <div className="admin-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">Neumasse</h2>
                </div>
                <p className="text-sm text-[var(--secondary)] mb-4">Nach Insolvenzeröffnung entstanden (inkl. anteilige MIXED-Buchungen)</p>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="p-3 bg-green-50 rounded">
                    <div className="text-xs text-[var(--secondary)] mb-1">Einnahmen</div>
                    <div className="text-lg font-semibold text-green-600">{formatCurrencyFn(estateData.neumasseInflowTotal)}</div>
                  </div>
                  <div className="p-3 bg-red-50 rounded">
                    <div className="text-xs text-[var(--secondary)] mb-1">Ausgaben</div>
                    <div className="text-lg font-semibold text-red-600">{formatCurrencyFn(estateData.neumasseOutflowTotal)}</div>
                  </div>
                </div>
                <div className={`mt-4 p-3 rounded-lg ${estateData.neumasseInflowTotal >= estateData.neumasseOutflowTotal ? "bg-green-600" : "bg-red-600"} text-white`}>
                  <div className="flex justify-between"><span>Netto Neumasse</span><span className="font-bold">{formatCurrencyFn(estateData.neumasseInflowTotal - estateData.neumasseOutflowTotal)}</span></div>
                </div>
              </div>
            </div>
          </div>
        );

      case "locations":
        return (
          <div className="space-y-6">
            {caseId ? (
              <LocationView caseId={caseId} />
            ) : (
              <div className="admin-card p-6 text-center text-gray-500">
                Case-ID nicht verfügbar
              </div>
            )}
          </div>
        );

      case "insolvency":
        return (
          <div className="space-y-6">
            {data.insolvencyEffects && data.insolvencyEffects.effects.length > 0 ? (
              <InsolvencyEffectsTable
                effects={data.insolvencyEffects.effects}
                periodType={data.calculation.periodType || data.plan.periodType || "WEEKLY"}
                periodCount={periods.length}
                periodLabels={periods.map((p) => p.periodLabel || p.weekLabel || "")}
                openingBalance={BigInt(data.calculation.openingBalanceCents)}
                closingBalancesBeforeEffects={periods.map((p) => BigInt(p.closingBalanceCents))}
              />
            ) : (
              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Insolvenzspezifische Effekte</h2>
                <p className="text-sm text-[var(--secondary)] mb-4">
                  Diese Ansicht trennt insolvenzspezifische Zahlungsströme vom operativen Geschäft.
                </p>
                <div className="p-8 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-blue-800">Datenerfassung erforderlich</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        Um insolvenzspezifische Effekte anzuzeigen, müssen diese zunächst im Admin-Bereich erfasst werden.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case "assumptions":
        return (
          <div className="space-y-6">
            {data.assumptions && data.assumptions.length > 0 ? (
              <PlanningAssumptions assumptions={data.assumptions} />
            ) : (
              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Planungsprämissen</h2>
                <p className="text-sm text-[var(--secondary)] mb-4">
                  Die Planungsprämissen dokumentieren die Annahmen hinter jeder Planungsposition.
                </p>
                <div className="p-8 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-amber-800">Dokumentation ausstehend</h3>
                      <p className="text-sm text-amber-700 mt-1">
                        Die Planungsprämissen für diesen Fall wurden noch nicht dokumentiert.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case "compare":
        return (
          <div className="space-y-6">
            {caseId ? (
              <IstPlanComparisonTable caseId={caseId} />
            ) : (
              <div className="admin-card p-6 text-center text-gray-500">
                Case-ID nicht verfügbar
              </div>
            )}

            <div className="admin-card p-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Aktuelle Version</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-[var(--secondary)]">Version</div>
                  <div className="font-medium text-[var(--foreground)]">{data.plan.versionNumber}</div>
                </div>
                <div>
                  <div className="text-[var(--secondary)]">Erstellt am</div>
                  <div className="font-medium text-[var(--foreground)]">{new Date(data.calculation.calculatedAt).toLocaleDateString("de-DE")}</div>
                </div>
                <div>
                  <div className="text-[var(--secondary)]">Gesamteinnahmen</div>
                  <div className="font-medium text-green-600">{formatCurrencyFn(data.calculation.totalInflowsCents)}</div>
                </div>
                <div>
                  <div className="text-[var(--secondary)]">Endbestand</div>
                  <div className="font-medium text-[var(--foreground)]">{formatCurrencyFn(data.calculation.finalClosingBalanceCents)}</div>
                </div>
              </div>
            </div>
          </div>
        );

      case "business-logik":
        return <BusinessLogicContent insolvencyDate={data.case.openingDate || undefined} />;

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div ref={reportRef} className="space-y-6">
        {/* Case Header */}
        {showHeader && (
          <div className="admin-card p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[var(--foreground)]">{data.case.debtorName}</h1>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--secondary)]">
                  <span>Aktenzeichen: {data.case.caseNumber}</span>
                  <span>Gericht: {data.case.courtName}</span>
                </div>
              </div>
              <div className="mt-4 md:mt-0 flex flex-col items-start md:items-end gap-1">
                <span className="text-sm text-[var(--muted)]">Planungszeitraum: {getPeriodLabelRange(data)}</span>
                <span className="text-xs text-[var(--muted)]">
                  Status: {getStatusLabel(data.case.status)}
                </span>
              </div>
            </div>
            {headerContent}
          </div>
        )}

        {/* UNKLAR-Risiko Banner - prominent oberhalb der Navigation */}
        {data.estateAllocation && caseId && (
          <UnklarRiskBanner caseId={caseId} estateAllocation={data.estateAllocation} />
        )}

        {/* Sticky Navigation: Scope Toggle + Tabs */}
        <div className="sticky top-0 z-30 -mx-1 px-1 pt-1 pb-2 bg-[var(--background)] space-y-3">
          {/* Global Scope Toggle - affects multiple tabs */}
          <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Standort:</span>
              <div className="flex items-center gap-1 bg-indigo-50 rounded-lg p-1">
                {(["GLOBAL", "LOCATION_VELBERT", "LOCATION_UCKERATH_EITORF"] as LiquidityScope[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      scope === s
                        ? "bg-white shadow-sm text-indigo-900 border border-indigo-200"
                        : "text-indigo-700 hover:text-indigo-900 hover:bg-indigo-100"
                    }`}
                  >
                    {SCOPE_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            {scope !== "GLOBAL" && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-md">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Standort-Ansicht: Zentrale Verfahrenskosten nicht enthalten • Einnahmen/Banken-Tabs ausgeblendet (zeigen nur globale Daten)</span>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <nav className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-lg">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-white text-[var(--primary)] shadow-sm"
                    : "text-[var(--secondary)] hover:text-[var(--foreground)] hover:bg-white/50"
                }`}
              >
                <TabIcon icon={tab.icon} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {visibleTabs.map((tab) => (
          <div key={tab.id} className={activeTab === tab.id ? "" : "hidden"}>
            {renderTabContent(tab)}
          </div>
        ))}

        {/* Footer Info */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-[var(--muted)] px-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Version {data.plan.versionNumber}</span>
            <span>|</span>
            <span>Stand: {new Date(data.calculation.calculatedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            {data.ledgerStats?.dataSource === "LEDGER" && (
              <>
                <span>|</span>
                <span className="text-green-600 font-medium">Zahlungsregister</span>
              </>
            )}
          </div>
          <div className="mt-2 sm:mt-0">
            Datenintegrität: {data.calculation.dataHash.substring(0, 8)}...
          </div>
        </div>
      </div>

      {/* PDF Export Button */}
      {capabilities.canExport && (
        <div className="fixed bottom-6 right-6 no-print">
          <PDFExportButton data={data} formatCurrency={(cents: bigint) => formatCurrencyFn(cents)} />
        </div>
      )}
    </div>
  );
}
