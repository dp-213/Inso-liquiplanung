"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import ForecastScenarioBar from "@/components/forecast/ForecastScenarioBar";
import ForecastSummaryCards from "@/components/forecast/ForecastSummaryCards";
import ForecastSpreadsheet from "@/components/forecast/ForecastSpreadsheet";
import AssumptionDetailDrawer from "@/components/forecast/AssumptionDetailDrawer";
import { cn, type ForecastData, type AssumptionJSON } from "@/components/forecast/types";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ForecastPage() {
  const params = useParams();
  const rawId = params.id;
  const caseId = (Array.isArray(rawId) ? rawId[0] : rawId) || "";

  const [forecastData, setForecastData] = useState<ForecastData | null>(null);
  const [assumptions, setAssumptions] = useState<AssumptionJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drawer-State: ID tracken, Objekt aus aktuellem assumptions-Array ableiten
  const [drawerAssumptionId, setDrawerAssumptionId] = useState<string | null>(null);
  const drawerAssumption = drawerAssumptionId
    ? assumptions.find(a => a.id === drawerAssumptionId) || null
    : null;

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchScenario = useCallback(async () => {
    try {
      await fetch(`/api/cases/${caseId}/forecast/scenarios`, { credentials: "include" });
    } catch {
      // Wird beim Calculate-Call erstellt
    }
  }, [caseId]);

  const fetchAssumptions = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/forecast/assumptions`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAssumptions(data.assumptions || []);
      }
    } catch {
      console.error("Fehler beim Laden der Annahmen");
    }
  }, [caseId]);

  const calculate = useCallback(async () => {
    setCalculating(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/forecast/calculate`, { credentials: "include" });
      if (!res.ok) {
        const errData = await res.json();
        setError(errData.error || "Berechnungsfehler");
        return;
      }
      const data = await res.json();
      setForecastData(data);
      setError(null);
    } catch {
      setError("Verbindungsfehler bei der Berechnung");
    } finally {
      setCalculating(false);
    }
  }, [caseId]);

  // Debounced refresh: verhindert parallele Calls bei schnellem Editieren
  // Assumptions + Calculate parallel statt sequentiell (halbe Wartezeit)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshCountRef = useRef(0);
  const refresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(async () => {
      const thisRefresh = ++refreshCountRef.current;
      await Promise.all([fetchAssumptions(), calculate()]);
      // Stale-Check: wenn inzwischen ein neuerer refresh kam, ignorieren
      if (refreshCountRef.current !== thisRefresh) return;
    }, 300);
  }, [fetchAssumptions, calculate]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchScenario();
      // Assumptions + Calculate parallel laden
      await Promise.all([fetchAssumptions(), calculate()]);
      setLoading(false);
    }
    if (caseId) init();
  }, [caseId, fetchScenario, fetchAssumptions, calculate]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const saveOpeningBalance = async (cents: string, source: string) => {
    const res = await fetch(`/api/cases/${caseId}/forecast/scenarios`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingBalanceCents: cents, openingBalanceSource: source }),
    });
    if (res.ok) await calculate();
  };

  const syncIstBalance = async () => {
    await calculate();
    if (forecastData?.meta && forecastData.meta.openingBalanceCents === "0") {
      alert(
        "Hinweis: Der Eröffnungssaldo steht noch auf 0 EUR.\n\n" +
        "Bitte setzen Sie den tatsächlichen Kontostand zum Planungsbeginn " +
        "(aus dem Kontoauszug) über das Bearbeitungs-Symbol beim Eröffnungssaldo."
      );
    }
  };

  const saveAssumption = async (data: Record<string, unknown>) => {
    const res = await fetch(`/api/cases/${caseId}/forecast/assumptions`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Speichern fehlgeschlagen");
    await refresh();
  };

  const deleteAssumption = async (id: string) => {
    if (!confirm("Annahme wirklich löschen?")) return;
    const res = await fetch(`/api/cases/${caseId}/forecast/assumptions?id=${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setDrawerAssumptionId(null);
      await refresh();
    }
  };

  const toggleAssumption = async (a: AssumptionJSON) => {
    await fetch(`/api/cases/${caseId}/forecast/assumptions`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id, isActive: !a.isActive }),
    });
    await refresh();
    // drawerAssumption wird automatisch aktualisiert (abgeleitet aus assumptions-Array)
  };

  // ============================================================================
  // LOADING / ERROR
  // ============================================================================

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-[var(--secondary)]">Prognose wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error && !forecastData) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">Fehler beim Laden</h1>
          <p className="text-[var(--secondary)] mb-4">{error}</p>
          <button
            onClick={() => { setError(null); calculate(); }}
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  const meta = forecastData?.meta;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Liquiditätsprognose</h1>
          {meta && (
            <p className="text-sm text-[var(--muted)] mt-1">
              {meta.scenarioName}
              {meta.generatedAt && (
                <span> &middot; Berechnet: {new Date(meta.generatedAt).toLocaleString("de-DE")}</span>
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={calculate}
            disabled={calculating}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
              calculating
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-[var(--primary)] text-white hover:opacity-90"
            )}
          >
            {calculating ? "Berechnet..." : "Neu berechnen"}
          </button>

          <div className="flex items-center bg-blue-50 rounded-lg p-1 border-2 border-blue-300">
            <Link
              href={`/admin/cases/${caseId}/results`}
              className="px-4 py-2 text-sm font-semibold rounded-md transition-colors text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/50"
            >
              Dashboard
            </Link>
            <span className="px-4 py-2 text-sm font-semibold rounded-md bg-white text-[var(--foreground)] shadow-sm">
              Prognose
            </span>
          </div>
        </div>
      </div>

      {/* Dashboard-Hinweis */}
      {forecastData && assumptions.some(a => a.isActive) && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium">Diese Annahmen fließen automatisch in das Dashboard ein.</p>
            <p className="text-blue-600 mt-1">
              Das{" "}
              <Link href={`/admin/cases/${caseId}/results`} className="underline font-medium hover:text-blue-800">
                Dashboard
              </Link>
              {" "}zeigt IST-Daten und Ihre Prognose-Annahmen kombiniert an.
            </p>
          </div>
        </div>
      )}

      {/* Szenario-Bar */}
      {meta && (
        <ForecastScenarioBar
          meta={meta}
          calculating={calculating}
          onSaveOpeningBalance={saveOpeningBalance}
          onSyncIst={syncIstBalance}
        />
      )}

      {/* Warnungen */}
      {forecastData?.warnings && forecastData.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          {forecastData.warnings.map((w, i) => (
            <p key={i} className="text-sm text-amber-800 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">&#9888;</span>
              {w}
            </p>
          ))}
        </div>
      )}

      {/* KPI Summary */}
      {forecastData?.summary && meta && (
        <ForecastSummaryCards data={forecastData} />
      )}

      {/* Unified Spreadsheet */}
      {forecastData && (
        <ForecastSpreadsheet
          data={forecastData}
          assumptions={assumptions}
          caseId={caseId}
          onAssumptionSaved={refresh}
          onAssumptionCreated={refresh}
          onOpenDrawer={(a) => setDrawerAssumptionId(a.id)}
        />
      )}

      {/* Detail-Drawer */}
      {drawerAssumption && meta && (
        <AssumptionDetailDrawer
          assumption={drawerAssumption}
          periods={forecastData?.periods || []}
          periodCount={meta.periodCount}
          onSave={saveAssumption}
          onDelete={deleteAssumption}
          onToggle={toggleAssumption}
          onClose={() => setDrawerAssumptionId(null)}
        />
      )}
    </div>
  );
}
