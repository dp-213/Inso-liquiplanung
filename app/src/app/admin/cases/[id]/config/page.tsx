"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import {
  CaseDashboardConfig,
  ChartType,
  KPIType,
} from "@/lib/case-dashboard/types";
import {
  ALL_INFLOW_CATEGORIES,
  ALL_OUTFLOW_CATEGORIES,
  DEFAULT_CATEGORY_LABELS,
  ALL_CHART_TYPES,
  ALL_KPI_TYPES,
  KPI_TYPE_LABELS,
  CHART_TYPE_LABELS,
} from "@/lib/case-dashboard/defaults";

interface ConfigResponse {
  success: boolean;
  caseId: string;
  caseName: string;
  caseNumber: string;
  config: CaseDashboardConfig;
  metadata: {
    configSource: string;
    usesCustomCode: boolean;
    customComponentPath?: string;
    warnings: string[];
    codeConfig?: {
      displayName: string;
      version: string;
      description?: string;
      replaceUIConfig?: boolean;
    };
  };
}

export default function CaseConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [caseName, setCaseName] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [config, setConfig] = useState<CaseDashboardConfig | null>(null);
  const [metadata, setMetadata] = useState<ConfigResponse["metadata"] | null>(null);
  const [activeTab, setActiveTab] = useState<
    "categories" | "display" | "charts" | "styling" | "pdfTexts" | "advanced"
  >("categories");

  // Fetch current configuration
  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/cases/${id}/config`);
      if (!res.ok) {
        throw new Error("Failed to load configuration");
      }
      const data: ConfigResponse = await res.json();
      setCaseName(data.caseName);
      setCaseNumber(data.caseNumber);
      setConfig(data.config);
      setMetadata(data.metadata);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Save configuration
  const saveConfig = async () => {
    if (!config) return;

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const res = await fetch(`/api/cases/${id}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, userId: "admin" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      const data = await res.json();
      setConfig(data.config);
      setMetadata(data.metadata);
      setSuccessMessage("Konfiguration erfolgreich gespeichert");

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults
  const resetToDefaults = async () => {
    if (!confirm("Konfiguration auf Standardwerte zurücksetzen?")) return;

    try {
      setSaving(true);
      setError(null);

      const res = await fetch(`/api/cases/${id}/config`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to reset");
      }

      const data = await res.json();
      setConfig(data.config);
      setMetadata(data.metadata);
      setSuccessMessage("Konfiguration zurückgesetzt");

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset");
    } finally {
      setSaving(false);
    }
  };

  // Update config helper
  const updateConfig = <K extends keyof CaseDashboardConfig>(
    key: K,
    value: CaseDashboardConfig[K]
  ) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  };

  // Toggle category visibility
  const toggleCategoryVisibility = (
    flowType: "inflows" | "outflows",
    categoryId: string
  ) => {
    if (!config) return;
    const current = config.visibleCategories[flowType];
    const newList = current.includes(categoryId)
      ? current.filter((c) => c !== categoryId)
      : [...current, categoryId];
    updateConfig("visibleCategories", {
      ...config.visibleCategories,
      [flowType]: newList,
    });
  };

  // Move category in order
  const moveCategoryOrder = (
    flowType: "inflows" | "outflows",
    categoryId: string,
    direction: "up" | "down"
  ) => {
    if (!config) return;
    const current = [...config.categoryOrder[flowType]];
    const idx = current.indexOf(categoryId);
    if (idx === -1) return;

    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= current.length) return;

    [current[idx], current[newIdx]] = [current[newIdx], current[idx]];
    updateConfig("categoryOrder", {
      ...config.categoryOrder,
      [flowType]: current,
    });
  };

  // Update category label
  const updateCategoryLabel = (categoryId: string, label: string) => {
    if (!config) return;
    updateConfig("categoryLabels", {
      ...config.categoryLabels,
      [categoryId]: label,
    });
  };

  // Toggle emphasized category
  const toggleEmphasized = (categoryId: string) => {
    if (!config) return;
    const current = config.emphasizedCategories;
    const newList = current.includes(categoryId)
      ? current.filter((c) => c !== categoryId)
      : [...current, categoryId];
    updateConfig("emphasizedCategories", newList);
  };

  // Toggle chart visibility
  const toggleChartVisibility = (chartType: ChartType) => {
    if (!config) return;
    const current = config.charts.visibleCharts;
    const newList = current.includes(chartType)
      ? current.filter((c) => c !== chartType)
      : [...current, chartType];
    updateConfig("charts", {
      ...config.charts,
      visibleCharts: newList,
    });
  };

  // Toggle KPI visibility
  const toggleKPIVisibility = (kpiType: KPIType) => {
    if (!config) return;
    const current = config.kpis.visibleKPIs;
    const newList = current.includes(kpiType)
      ? current.filter((k) => k !== kpiType)
      : [...current, kpiType];
    updateConfig("kpis", {
      ...config.kpis,
      visibleKPIs: newList,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="admin-card p-8 text-center">
        <p className="text-[var(--danger)]">{error}</p>
        <Link href="/admin/cases" className="btn-secondary mt-4 inline-block">
          Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-[var(--muted)]">
        <Link href="/admin/cases" className="hover:text-[var(--primary)]">
          Fälle
        </Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link href={`/admin/cases/${id}`} className="hover:text-[var(--primary)]">
          {caseName}
        </Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[var(--foreground)]">Konfiguration</span>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Dashboard-Konfiguration
          </h1>
          <p className="text-[var(--secondary)] mt-1">
            {caseNumber} - {caseName}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={resetToDefaults} className="btn-secondary" disabled={saving}>
            Zurücksetzen
          </button>
          <Link href={`/admin/cases/${id}/dashboard`} className="btn-secondary">
            Vorschau
          </Link>
          <button onClick={saveConfig} className="btn-primary" disabled={saving}>
            {saving ? "Speichern..." : "Speichern"}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
          {successMessage}
        </div>
      )}

      {/* Code Config Warning */}
      {metadata?.usesCustomCode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-blue-800">
                Fall-spezifischer Code aktiv
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                Dieser Fall verwendet benutzerdefinierten Dashboard-Code
                {metadata.codeConfig && ` (${metadata.codeConfig.displayName} v${metadata.codeConfig.version})`}.
                {metadata.codeConfig?.replaceUIConfig
                  ? " Der Code ersetzt die UI-Konfiguration vollstaendig."
                  : " Änderungen hier werden mit dem Code zusammengeführt."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[var(--border)]">
        <nav className="flex space-x-8">
          {[
            { id: "categories", label: "Kategorien" },
            { id: "display", label: "Anzeige" },
            { id: "charts", label: "Diagramme" },
            { id: "styling", label: "Styling" },
            { id: "pdfTexts", label: "PDF-Texte" },
            { id: "advanced", label: "Erweitert" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="admin-card p-6">
        {/* Categories Tab */}
        {activeTab === "categories" && (
          <div className="space-y-8">
            {/* Inflows */}
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Einzahlungen
              </h3>
              <div className="space-y-3">
                {config.categoryOrder.inflows.map((catId, idx) => {
                  const isVisible = config.visibleCategories.inflows.includes(catId);
                  const isEmphasized = config.emphasizedCategories.includes(catId);
                  const label = config.categoryLabels[catId] || DEFAULT_CATEGORY_LABELS[catId] || catId;

                  return (
                    <div
                      key={catId}
                      className={`flex items-center gap-4 p-3 rounded-lg border ${
                        isEmphasized ? "border-yellow-300 bg-yellow-50" : "border-[var(--border)] bg-gray-50"
                      }`}
                    >
                      {/* Visibility checkbox */}
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => toggleCategoryVisibility("inflows", catId)}
                        className="w-4 h-4 rounded"
                      />

                      {/* Order buttons */}
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => moveCategoryOrder("inflows", catId, "up")}
                          disabled={idx === 0}
                          className="p-0.5 text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveCategoryOrder("inflows", catId, "down")}
                          disabled={idx === config.categoryOrder.inflows.length - 1}
                          className="p-0.5 text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      {/* Label input */}
                      <input
                        type="text"
                        value={config.categoryLabels[catId] || ""}
                        onChange={(e) => updateCategoryLabel(catId, e.target.value)}
                        placeholder={DEFAULT_CATEGORY_LABELS[catId] || catId}
                        className="flex-1 px-3 py-1.5 border border-[var(--border)] rounded-md text-sm"
                      />

                      {/* Emphasize button */}
                      <button
                        onClick={() => toggleEmphasized(catId)}
                        className={`p-2 rounded-md ${
                          isEmphasized
                            ? "bg-yellow-200 text-yellow-800"
                            : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                        }`}
                        title={isEmphasized ? "Hervorhebung entfernen" : "Hervorheben"}
                      >
                        <svg className="w-4 h-4" fill={isEmphasized ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Outflows */}
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Auszahlungen
              </h3>
              <div className="space-y-3">
                {config.categoryOrder.outflows.map((catId, idx) => {
                  const isVisible = config.visibleCategories.outflows.includes(catId);
                  const isEmphasized = config.emphasizedCategories.includes(catId);

                  return (
                    <div
                      key={catId}
                      className={`flex items-center gap-4 p-3 rounded-lg border ${
                        isEmphasized ? "border-yellow-300 bg-yellow-50" : "border-[var(--border)] bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => toggleCategoryVisibility("outflows", catId)}
                        className="w-4 h-4 rounded"
                      />

                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => moveCategoryOrder("outflows", catId, "up")}
                          disabled={idx === 0}
                          className="p-0.5 text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveCategoryOrder("outflows", catId, "down")}
                          disabled={idx === config.categoryOrder.outflows.length - 1}
                          className="p-0.5 text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      <input
                        type="text"
                        value={config.categoryLabels[catId] || ""}
                        onChange={(e) => updateCategoryLabel(catId, e.target.value)}
                        placeholder={DEFAULT_CATEGORY_LABELS[catId] || catId}
                        className="flex-1 px-3 py-1.5 border border-[var(--border)] rounded-md text-sm"
                      />

                      <button
                        onClick={() => toggleEmphasized(catId)}
                        className={`p-2 rounded-md ${
                          isEmphasized
                            ? "bg-yellow-200 text-yellow-800"
                            : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                        }`}
                      >
                        <svg className="w-4 h-4" fill={isEmphasized ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Display Tab */}
        {activeTab === "display" && (
          <div className="space-y-8">
            {/* Table Settings */}
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Tabelleneinstellungen
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.table.showWeekNumbers}
                    onChange={(e) =>
                      updateConfig("table", { ...config.table, showWeekNumbers: e.target.checked })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-[var(--foreground)]">Wochennummern anzeigen</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.table.showDateRanges}
                    onChange={(e) =>
                      updateConfig("table", { ...config.table, showDateRanges: e.target.checked })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-[var(--foreground)]">Datumsbereiche anzeigen</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.table.highlightNegative}
                    onChange={(e) =>
                      updateConfig("table", { ...config.table, highlightNegative: e.target.checked })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-[var(--foreground)]">Negative Werte hervorheben</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.table.compactMode}
                    onChange={(e) =>
                      updateConfig("table", { ...config.table, compactMode: e.target.checked })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-[var(--foreground)]">Kompakte Darstellung</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.table.freezeFirstColumn}
                    onChange={(e) =>
                      updateConfig("table", { ...config.table, freezeFirstColumn: e.target.checked })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-[var(--foreground)]">Erste Spalte fixieren</span>
                </label>
              </div>
            </div>

            {/* Aggregation Settings */}
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Aggregation
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.aggregations.showSubtotals}
                    onChange={(e) =>
                      updateConfig("aggregations", {
                        ...config.aggregations,
                        showSubtotals: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-[var(--foreground)]">Zwischensummen anzeigen</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.aggregations.showRunningBalance}
                    onChange={(e) =>
                      updateConfig("aggregations", {
                        ...config.aggregations,
                        showRunningBalance: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-[var(--foreground)]">Laufenden Saldo anzeigen</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.aggregations.showEstateSubtotals}
                    onChange={(e) =>
                      updateConfig("aggregations", {
                        ...config.aggregations,
                        showEstateSubtotals: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-[var(--foreground)]">Alt-/Neumasse-Summen anzeigen</span>
                </label>
              </div>
            </div>

            {/* KPI Settings */}
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Kennzahlen (KPIs)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ALL_KPI_TYPES.map((kpiType) => (
                  <label key={kpiType} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={config.kpis.visibleKPIs.includes(kpiType)}
                      onChange={() => toggleKPIVisibility(kpiType)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-[var(--foreground)]">{KPI_TYPE_LABELS[kpiType]}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* View Variants */}
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Ansichtsvarianten
              </h3>
              <div className="space-y-4">
                <div className="p-4 border border-[var(--border)] rounded-lg">
                  <h4 className="font-medium text-[var(--foreground)] mb-3">Interne Ansicht</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={config.viewVariants.internal.enabled}
                        onChange={(e) =>
                          updateConfig("viewVariants", {
                            ...config.viewVariants,
                            internal: { ...config.viewVariants.internal, enabled: e.target.checked },
                          })
                        }
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-[var(--secondary)]">Aktiviert</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={config.viewVariants.internal.config.showEstateTypes}
                        onChange={(e) =>
                          updateConfig("viewVariants", {
                            ...config.viewVariants,
                            internal: {
                              ...config.viewVariants.internal,
                              config: {
                                ...config.viewVariants.internal.config,
                                showEstateTypes: e.target.checked,
                              },
                            },
                          })
                        }
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-[var(--secondary)]">Alt-/Neumasse anzeigen</span>
                    </label>
                  </div>
                </div>

                <div className="p-4 border border-[var(--border)] rounded-lg">
                  <h4 className="font-medium text-[var(--foreground)] mb-3">Externe Ansicht (Share Links)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={config.viewVariants.external.enabled}
                        onChange={(e) =>
                          updateConfig("viewVariants", {
                            ...config.viewVariants,
                            external: { ...config.viewVariants.external, enabled: e.target.checked },
                          })
                        }
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-[var(--secondary)]">Aktiviert</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={config.viewVariants.external.config.showEstateTypes}
                        onChange={(e) =>
                          updateConfig("viewVariants", {
                            ...config.viewVariants,
                            external: {
                              ...config.viewVariants.external,
                              config: {
                                ...config.viewVariants.external.config,
                                showEstateTypes: e.target.checked,
                              },
                            },
                          })
                        }
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-[var(--secondary)]">Alt-/Neumasse anzeigen</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Charts Tab */}
        {activeTab === "charts" && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Sichtbare Diagramme
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ALL_CHART_TYPES.map((chartType) => (
                  <label key={chartType} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={config.charts.visibleCharts.includes(chartType)}
                      onChange={() => toggleChartVisibility(chartType)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-[var(--foreground)]">{CHART_TYPE_LABELS[chartType]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Standard-Diagramm
              </h3>
              <select
                value={config.charts.defaultChart}
                onChange={(e) =>
                  updateConfig("charts", {
                    ...config.charts,
                    defaultChart: e.target.value as ChartType,
                  })
                }
                className="px-3 py-2 border border-[var(--border)] rounded-md"
              >
                {ALL_CHART_TYPES.map((chartType) => (
                  <option key={chartType} value={chartType}>
                    {CHART_TYPE_LABELS[chartType]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Diagramm-Optionen
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.charts.showLegend}
                    onChange={(e) =>
                      updateConfig("charts", { ...config.charts, showLegend: e.target.checked })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-[var(--foreground)]">Legende anzeigen</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.charts.showDataLabels}
                    onChange={(e) =>
                      updateConfig("charts", { ...config.charts, showDataLabels: e.target.checked })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-[var(--foreground)]">Datenbeschriftungen anzeigen</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Styling Tab */}
        {activeTab === "styling" && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Branding
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    Kanzlei/Firmenname
                  </label>
                  <input
                    type="text"
                    value={config.styling.firmName || ""}
                    onChange={(e) =>
                      updateConfig("styling", { ...config.styling, firmName: e.target.value })
                    }
                    placeholder="z.B. Musterkanzlei GmbH"
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    Logo-URL
                  </label>
                  <input
                    type="url"
                    value={config.styling.logoUrl || ""}
                    onChange={(e) =>
                      updateConfig("styling", { ...config.styling, logoUrl: e.target.value })
                    }
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Farben
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    Primaerfarbe
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={config.styling.primaryColor || "#CE353A"}
                      onChange={(e) =>
                        updateConfig("styling", { ...config.styling, primaryColor: e.target.value })
                      }
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={config.styling.primaryColor || ""}
                      onChange={(e) =>
                        updateConfig("styling", { ...config.styling, primaryColor: e.target.value })
                      }
                      placeholder="#CE353A"
                      className="flex-1 px-3 py-2 border border-[var(--border)] rounded-md"
                    />
                    {config.styling.primaryColor && (
                      <button
                        onClick={() => updateConfig("styling", { ...config.styling, primaryColor: undefined })}
                        className="text-[var(--muted)] hover:text-[var(--danger)]"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    Akzentfarbe
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={config.styling.accentColor || "#E05A5F"}
                      onChange={(e) =>
                        updateConfig("styling", { ...config.styling, accentColor: e.target.value })
                      }
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={config.styling.accentColor || ""}
                      onChange={(e) =>
                        updateConfig("styling", { ...config.styling, accentColor: e.target.value })
                      }
                      placeholder="#E05A5F"
                      className="flex-1 px-3 py-2 border border-[var(--border)] rounded-md"
                    />
                    {config.styling.accentColor && (
                      <button
                        onClick={() => updateConfig("styling", { ...config.styling, accentColor: undefined })}
                        className="text-[var(--muted)] hover:text-[var(--danger)]"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Fußzeile
              </h3>
              <textarea
                value={config.styling.footerText || ""}
                onChange={(e) =>
                  updateConfig("styling", { ...config.styling, footerText: e.target.value })
                }
                placeholder="Optionaler Text für die Fußzeile..."
                rows={2}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-md"
              />
            </div>
          </div>
        )}

        {/* PDF Texts Tab */}
        {activeTab === "pdfTexts" && (
          <div className="space-y-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                Diese Texte erscheinen in der exportierten PDF. Platzhalter:
                <code className="bg-blue-100 px-1 mx-1 rounded">{"{{debtorName}}"}</code>,
                <code className="bg-blue-100 px-1 mx-1 rounded">{"{{caseNumber}}"}</code>,
                <code className="bg-blue-100 px-1 mx-1 rounded">{"{{planStartDate}}"}</code>,
                <code className="bg-blue-100 px-1 mx-1 rounded">{"{{administrator}}"}</code>
              </p>
            </div>

            {/* Legal Disclaimers */}
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                Rechtliche Vorbemerkungen
              </h3>
              <p className="text-sm text-[var(--muted)] mb-4">
                Erscheinen auf Seite 2 der PDF (eine Zeile pro Absatz)
              </p>
              <textarea
                value={config.pdfTexts?.legalDisclaimers?.join("\n") || ""}
                onChange={(e) =>
                  updateConfig("pdfTexts", {
                    ...config.pdfTexts,
                    legalDisclaimers: e.target.value.split("\n"),
                  })
                }
                rows={12}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-md font-mono text-sm"
              />
            </div>

            {/* Data Sources */}
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                Verwendete Datenquellen
              </h3>
              <p className="text-sm text-[var(--muted)] mb-4">
                Eine Quelle pro Zeile
              </p>
              <textarea
                value={config.pdfTexts?.dataSources?.join("\n") || ""}
                onChange={(e) =>
                  updateConfig("pdfTexts", {
                    ...config.pdfTexts,
                    dataSources: e.target.value.split("\n"),
                  })
                }
                rows={4}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-md font-mono text-sm"
              />
            </div>

            {/* Liquidity Planning Context */}
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                Vorbemerkungen zur Liquiditätsplanung
              </h3>
              <p className="text-sm text-[var(--muted)] mb-4">
                Kontext und Erläuterungen (Seite 4)
              </p>
              <textarea
                value={config.pdfTexts?.liquidityPlanningContext?.join("\n") || ""}
                onChange={(e) =>
                  updateConfig("pdfTexts", {
                    ...config.pdfTexts,
                    liquidityPlanningContext: e.target.value.split("\n"),
                  })
                }
                rows={10}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-md font-mono text-sm"
              />
            </div>

            {/* Declaration Text */}
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                Vollständigkeitserklärung
              </h3>
              <p className="text-sm text-[var(--muted)] mb-4">
                Text auf der letzten Seite
              </p>
              <textarea
                value={config.pdfTexts?.declarationText?.join("\n") || ""}
                onChange={(e) =>
                  updateConfig("pdfTexts", {
                    ...config.pdfTexts,
                    declarationText: e.target.value.split("\n"),
                  })
                }
                rows={8}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-md font-mono text-sm"
              />
            </div>

            {/* Confidentiality Notice */}
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                Vertraulichkeitshinweis
              </h3>
              <p className="text-sm text-[var(--muted)] mb-4">
                Erscheint auf der Titelseite
              </p>
              <textarea
                value={config.pdfTexts?.confidentialityNotice || ""}
                onChange={(e) =>
                  updateConfig("pdfTexts", {
                    ...config.pdfTexts,
                    confidentialityNotice: e.target.value,
                  })
                }
                rows={2}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-md"
              />
            </div>

            {/* PDF Footer */}
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                PDF-Fußzeile
              </h3>
              <input
                type="text"
                value={config.pdfTexts?.pdfFooterText || ""}
                onChange={(e) =>
                  updateConfig("pdfTexts", {
                    ...config.pdfTexts,
                    pdfFooterText: e.target.value,
                  })
                }
                placeholder="z.B. Gradify oder Ihr Firmenname"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-md"
              />
            </div>
          </div>
        )}

        {/* Advanced Tab */}
        {activeTab === "advanced" && (
          <div className="space-y-8">
            {/* Custom Titles */}
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Benutzerdefinierte Titel
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    Titel (intern)
                  </label>
                  <input
                    type="text"
                    value={config.viewVariants.internal.config.titleOverride || ""}
                    onChange={(e) =>
                      updateConfig("viewVariants", {
                        ...config.viewVariants,
                        internal: {
                          ...config.viewVariants.internal,
                          config: {
                            ...config.viewVariants.internal.config,
                            titleOverride: e.target.value || undefined,
                          },
                        },
                      })
                    }
                    placeholder="Standard: Liquiditätsplan - [Schuldner]"
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    Titel (extern)
                  </label>
                  <input
                    type="text"
                    value={config.viewVariants.external.config.titleOverride || ""}
                    onChange={(e) =>
                      updateConfig("viewVariants", {
                        ...config.viewVariants,
                        external: {
                          ...config.viewVariants.external,
                          config: {
                            ...config.viewVariants.external.config,
                            titleOverride: e.target.value || undefined,
                          },
                        },
                      })
                    }
                    placeholder="Standard: Liquiditätsplan - [Schuldner]"
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md"
                  />
                </div>
              </div>
            </div>

            {/* Configuration Metadata */}
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Metadaten
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <p>
                  <span className="font-medium">Schema-Version:</span> {config.schemaVersion}
                </p>
                <p>
                  <span className="font-medium">Letzte Änderung:</span>{" "}
                  {new Date(config.metadata.lastUpdated).toLocaleString("de-DE")}
                </p>
                <p>
                  <span className="font-medium">Geändert von:</span> {config.metadata.lastUpdatedBy}
                </p>
                {metadata?.configSource && (
                  <p>
                    <span className="font-medium">Konfigurationsquelle:</span>{" "}
                    {metadata.configSource === "default"
                      ? "Standard"
                      : metadata.configSource === "database"
                      ? "Datenbank"
                      : metadata.configSource === "code"
                      ? "Code"
                      : "Zusammengeführt"}
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Notizen
              </h3>
              <textarea
                value={config.metadata.notes || ""}
                onChange={(e) =>
                  updateConfig("metadata", {
                    ...config.metadata,
                    notes: e.target.value || undefined,
                  })
                }
                placeholder="Interne Notizen zu dieser Konfiguration..."
                rows={3}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-md"
              />
            </div>

            {/* Raw JSON (read-only) */}
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Roh-Konfiguration (JSON)
              </h3>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-xs">
                {JSON.stringify(config, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
