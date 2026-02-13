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
  getPeriodLabelRange,
  TabConfig,
} from "@/types/dashboard";

// Import existing components
import PDFExportButton from "@/components/external/PDFExportButton";
import EstateTabContent from "@/components/dashboard/EstateTabContent";
import PlanningAssumptions from "@/components/external/PlanningAssumptions";
import InsolvencyEffectsTable from "@/components/external/InsolvencyEffectsTable";
import WaterfallChart from "@/components/external/WaterfallChart";
import RevenueTabContent from "@/components/dashboard/RevenueTabContent";
import SecurityRightsChart from "@/components/dashboard/SecurityRightsChart";
import RollingForecastChart from "@/components/dashboard/RollingForecastChart";
import MasseCreditTab from "@/components/dashboard/MasseCreditTab";
import LocationView from "@/components/dashboard/iv-views/LocationView";
import LiquidityMatrixTable, { LiquidityScope, SCOPE_LABELS } from "@/components/dashboard/LiquidityMatrixTable";
import IstPlanComparisonTable from "@/components/dashboard/IstPlanComparisonTable";
import BankAccountsTab from "@/components/dashboard/BankAccountsTab";
import BusinessLogicContent from "@/components/business-logic/BusinessLogicContent";
import UnklarRiskBanner from "@/components/dashboard/UnklarRiskBanner";
import OverviewMetricsBar from "@/components/dashboard/OverviewMetricsBar";

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
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(
    new Set([config.tabs[0]?.id || "overview"])
  );

  useEffect(() => {
    setMountedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);
  const reportRef = useRef<HTMLDivElement>(null);

  // Global scope state for consistent filtering across tabs
  const [scope, setScope] = useState<LiquidityScope>("GLOBAL");

  // Get capabilities
  const capabilities = propCapabilities || getCapabilitiesForAccessMode(accessMode);

  // Effective caseId (prop takes priority, fallback to data.case.id)
  const caseId = propCaseId || data.case?.id;

  // Memoized calculations
  const periods = useMemo(() => getPeriods(data), [data]);

  const formatCurrencyFn = useCallback((cents: bigint | string): string => {
    return formatCurrency(cents);
  }, []);

  // Tabs die interne APIs mit Session-Auth benötigen
  const tabsRequiringInternalApi = new Set([
    "liquidity-matrix",
    "banks-security",
    "revenue", // RevenueTable braucht API
    "estate", // Estate-Summary API
    "locations",
    "compare",
    "business-logik",
  ]);

  // Tabs die Scope NICHT unterstützen (zeigen immer global)
  const tabsWithoutScopeSupport = new Set([
    "banks-security",    // BankAccountsTab zeigt alle Konten (Scope-Filter wäre irreführend für Bank-Übersicht)
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

  // Render tab content
  const renderTabContent = (tab: TabConfig) => {
    switch (tab.id) {
      case "overview": {
        const bankClaimsCents = data.massekreditSummary
          ? BigInt(data.massekreditSummary.massekreditAltforderungenCents)
          : undefined;

        return (
          <div className="space-y-4">
            {/* Kompakte Kennzahlen-Leiste */}
            <OverviewMetricsBar data={data} />

            {/* Rolling Forecast Chart – Hero-Visual (Admin/Customer) */}
            {accessMode !== "external" && caseId && (
              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Liquiditätsentwicklung</h2>
                <div className="h-[500px]">
                  <RollingForecastChart
                    caseId={caseId}
                    scope={scope}
                    bankClaimsCents={scope === "GLOBAL" ? bankClaimsCents : undefined}
                  />
                </div>
              </div>
            )}

            {/* Wasserfall – Fallback für External/Share (kein API-Zugang für RollingForecast) */}
            {accessMode === "external" && (
              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">Liquiditätsentwicklung</h2>
                <p className="text-sm text-[var(--secondary)] mb-4">
                  Einzahlungen (grün), Auszahlungen (rot) und Endbestand (blaue Linie) pro Periode.
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
            )}
          </div>
        );
      }

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

      case "banks-security":
        return (
          <div className="space-y-6">
            {caseId && (
              <>
                {/* Sektion 1: Bankenspiegel */}
                <div className="admin-card p-6">
                  <h2 className="text-lg font-semibold mb-4">Bankenspiegel</h2>
                  <BankAccountsTab caseId={caseId} />
                </div>

                {/* Sektion 2: Verfügbarkeit über Zeit */}
                <div className="admin-card p-6">
                  <h2 className="text-lg font-semibold mb-4">Verfügbarkeit über Zeit</h2>
                  <SecurityRightsChart caseId={caseId} periods={10} />
                </div>

                {/* Sektion 3: Massekredit-Analyse */}
                <MasseCreditTab caseId={caseId} />
              </>
            )}
          </div>
        );

      case "revenue":
        return caseId ? (
          <RevenueTabContent caseId={caseId} scope={scope} />
        ) : null;

      case "estate":
        return caseId ? (
          <EstateTabContent caseId={caseId} scope={scope} />
        ) : null;

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
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Berechnungsannahmen</h2>
                <p className="text-sm text-[var(--secondary)] mb-4">
                  Die Berechnungsannahmen dokumentieren die Annahmen hinter der Liquiditätsplanung.
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
                        Die Berechnungsannahmen für diesen Fall wurden noch nicht dokumentiert.
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
            {/* Wasserfall-Darstellung */}
            <div className="admin-card p-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">Wasserfall-Darstellung</h2>
              <p className="text-sm text-[var(--secondary)] mb-4">
                Zeigt die Zusammensetzung der Cashflows pro Periode: Einzahlungen (grün), Auszahlungen (rot) und Endbestand (blaue Linie).
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

            {caseId ? (
              <IstPlanComparisonTable caseId={caseId} scope={scope} />
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
        return caseId ? <BusinessLogicContent caseId={caseId} /> : null;

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

        {/* UNKLAR-Risiko Banner */}
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

        {/* Tab Content – Lazy Mount: Tabs werden erst beim ersten Besuch gemountet, dann keep-alive */}
        {visibleTabs.map((tab) => (
          <div key={tab.id} className={activeTab === tab.id ? "" : "hidden"}>
            {mountedTabs.has(tab.id) ? renderTabContent(tab) : null}
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
