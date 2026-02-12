"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ============================================================================
// TYPES (JSON-serialisierte Varianten)
// ============================================================================

interface ForecastLineItemJSON {
  assumptionId: string;
  categoryKey: string;
  categoryLabel: string;
  flowType: "INFLOW" | "OUTFLOW";
  amountCents: string;
  formula: string;
}

interface ForecastPeriodJSON {
  periodIndex: number;
  periodLabel: string;
  periodStartDate: string;
  dataSource: "IST" | "FORECAST";
  openingBalanceCents: string;
  cashInTotalCents: string;
  cashOutTotalCents: string;
  netCashflowCents: string;
  closingBalanceCents: string;
  creditLineAvailableCents: string;
  headroomCents: string;
  headroomAfterReservesCents: string;
  lineItems: ForecastLineItemJSON[];
}

interface ForecastMeta {
  scenarioId: string;
  scenarioName: string;
  periodType: string;
  periodCount: number;
  openingBalanceCents: string;
  openingBalanceSource: string;
  creditLineCents: string;
  creditLineSource: string;
  reservesTotalCents: string;
  istPeriodCount: number;
  forecastPeriodCount: number;
  generatedAt: string;
}

interface ForecastData {
  periods: ForecastPeriodJSON[];
  summary: {
    totalInflowsCents: string;
    totalOutflowsCents: string;
    finalClosingBalanceCents: string;
    minHeadroomCents: string;
    minHeadroomPeriodIndex: number;
  };
  warnings: string[];
  meta: ForecastMeta;
}

interface AssumptionJSON {
  id: string;
  scenarioId: string;
  caseId: string;
  categoryKey: string;
  categoryLabel: string;
  flowType: string;
  assumptionType: string;
  baseAmountCents: string;
  baseAmountSource: string;
  baseAmountNote: string | null;
  growthFactorPercent: number | null;
  seasonalProfile: string | null;
  startPeriodIndex: number;
  endPeriodIndex: number;
  isActive: boolean;
  sortOrder: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatEUR(cents: string | number): string {
  const value = typeof cents === "string" ? Number(cents) : cents;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function formatEURInput(cents: string | number): string {
  const value = typeof cents === "string" ? Number(cents) : cents;
  return (value / 100).toFixed(2).replace(".", ",");
}

function parseCentsFromEUR(eurString: string): string {
  // Tausender-Punkte entfernen, dann Dezimal-Komma → Punkt
  const cleaned = eurString.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const value = parseFloat(cleaned);
  if (isNaN(value)) return "0";
  return String(Math.round(value * 100));
}

function cn(...classes: (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ============================================================================
// ASSUMPTION TYPE LABELS
// ============================================================================

const ASSUMPTION_TYPE_LABELS: Record<string, string> = {
  RUN_RATE: "Laufend",
  FIXED: "Fixbetrag",
  ONE_TIME: "Einmalig",
  PERCENTAGE_OF_REVENUE: "% der Einnahmen",
};

const ASSUMPTION_TYPE_COLORS: Record<string, string> = {
  RUN_RATE: "bg-blue-100 text-blue-800 border-blue-300",
  FIXED: "bg-green-100 text-green-800 border-green-300",
  ONE_TIME: "bg-amber-100 text-amber-800 border-amber-300",
  PERCENTAGE_OF_REVENUE: "bg-purple-100 text-purple-800 border-purple-300",
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ForecastPage() {
  const params = useParams();
  const rawId = params.id;
  const caseId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [activeTab, setActiveTab] = useState<"table" | "assumptions">("table");
  const [forecastData, setForecastData] = useState<ForecastData | null>(null);
  const [assumptions, setAssumptions] = useState<AssumptionJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingAssumption, setEditingAssumption] = useState<AssumptionJSON | null>(null);

  // Szenario-Edit state
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchScenario = useCallback(async () => {
    try {
      // Szenario initialisieren (auto-create falls nötig)
      await fetch(`/api/cases/${caseId}/forecast/scenarios`, {
        credentials: "include",
      });
    } catch {
      // Ignorieren - wird beim Calculate-Call erstellt
    }
  }, [caseId]);

  const fetchAssumptions = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/forecast/assumptions`, {
        credentials: "include",
      });
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
      const res = await fetch(`/api/cases/${caseId}/forecast/calculate`, {
        credentials: "include",
      });
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

  useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchScenario();
      await fetchAssumptions();
      await calculate();
      setLoading(false);
    }
    if (caseId) init();
  }, [caseId, fetchScenario, fetchAssumptions, calculate]);

  // ============================================================================
  // ASSUMPTION CRUD
  // ============================================================================

  const saveAssumption = async (data: Record<string, unknown>) => {
    const isEdit = !!editingAssumption;
    const method = isEdit ? "PUT" : "POST";
    const body = isEdit ? { ...data, id: editingAssumption!.id } : data;

    const res = await fetch(`/api/cases/${caseId}/forecast/assumptions`, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setShowModal(false);
      setEditingAssumption(null);
      await fetchAssumptions();
      await calculate();
    }
  };

  const deleteAssumption = async (id: string) => {
    if (!confirm("Annahme wirklich löschen?")) return;

    const res = await fetch(`/api/cases/${caseId}/forecast/assumptions?id=${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (res.ok) {
      await fetchAssumptions();
      await calculate();
    }
  };

  const saveOpeningBalance = async (cents: string, source: string) => {
    const res = await fetch(`/api/cases/${caseId}/forecast/scenarios`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingBalanceCents: cents, openingBalanceSource: source }),
    });
    if (res.ok) {
      setEditingBalance(false);
      await calculate();
    }
  };

  const syncIstBalance = async () => {
    // IST-Daten neu berechnen (neue LedgerEntries einbeziehen)
    await calculate();

    // Hinweis wenn Eröffnungssaldo noch 0 ist
    if (meta && meta.openingBalanceCents === "0") {
      alert(
        "Hinweis: Der Eröffnungssaldo steht noch auf 0 EUR.\n\n" +
        "Bitte setzen Sie den tatsächlichen Kontostand zum Planungsbeginn " +
        "(aus dem Kontoauszug) über das Bearbeitungs-Symbol beim Eröffnungssaldo."
      );
    }
  };

  const toggleAssumption = async (a: AssumptionJSON) => {
    await fetch(`/api/cases/${caseId}/forecast/assumptions`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id, isActive: !a.isActive }),
    });
    await fetchAssumptions();
    await calculate();
  };

  // ============================================================================
  // LOADING / ERROR STATES
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
              {" "}zeigt IST-Daten (Vergangenheit) und Ihre Prognose-Annahmen (Zukunft) kombiniert an.
            </p>
          </div>
        </div>
      )}

      {/* Szenario-Info */}
      {meta && (
        <div className="admin-card p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-xs text-[var(--muted)] font-semibold uppercase tracking-wider">Eröffnungssaldo</span>
              {editingBalance ? (
                <div className="mt-1 space-y-1">
                  <input
                    type="text"
                    value={balanceInput}
                    onChange={(e) => setBalanceInput(e.target.value)}
                    placeholder="z.B. 50.000,00"
                    className="w-full px-2 py-1 border border-[var(--border)] rounded text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEditingBalance(false);
                      if (e.key === "Enter") {
                        const cents = parseCentsFromEUR(balanceInput);
                        saveOpeningBalance(cents, "Manuell eingegeben");
                      }
                    }}
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        const cents = parseCentsFromEUR(balanceInput);
                        saveOpeningBalance(cents, "Manuell eingegeben");
                      }}
                      className="px-2 py-0.5 text-xs bg-[var(--primary)] text-white rounded hover:opacity-90"
                    >
                      Speichern
                    </button>
                    <button
                      onClick={() => setEditingBalance(false)}
                      className="px-2 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group">
                  <button
                    onClick={() => {
                      setBalanceInput(formatEURInput(meta.openingBalanceCents));
                      setEditingBalance(true);
                    }}
                    className="font-semibold mt-0.5 hover:text-[var(--primary)] transition-colors text-left"
                    title="Klicken zum Bearbeiten"
                  >
                    {formatEUR(meta.openingBalanceCents)}
                    <svg className="w-3 h-3 inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <p className="text-xs text-[var(--muted)] truncate" title={meta.openingBalanceSource}>{meta.openingBalanceSource}</p>
                </div>
              )}
            </div>
            <div>
              <span className="text-xs text-[var(--muted)] font-semibold uppercase tracking-wider">IST-Perioden</span>
              <p className="font-semibold mt-0.5">
                {meta.istPeriodCount > 0
                  ? `${meta.istPeriodCount} von ${meta.periodCount} (automatisch)`
                  : "Keine IST-Daten"
                }
              </p>
              <p className="text-xs text-[var(--muted)]">
                {meta.forecastPeriodCount} Prognose-Perioden
              </p>
            </div>
            <div>
              <span className="text-xs text-[var(--muted)] font-semibold uppercase tracking-wider">Periodentyp</span>
              <p className="font-semibold mt-0.5">
                {meta.periodType === "MONTHLY" ? "Monatlich" : "Wöchentlich"}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {meta.periodCount} Perioden gesamt
              </p>
            </div>
            <div>
              <span className="text-xs text-[var(--muted)] font-semibold uppercase tracking-wider">Kreditlinie / Rückstellungen</span>
              <p className="font-semibold mt-0.5">{formatEUR(meta.creditLineCents)}</p>
              <p className="text-xs text-[var(--muted)] truncate" title={meta.creditLineSource}>
                {meta.creditLineSource}
              </p>
              {Number(meta.reservesTotalCents) > 0 && (
                <p className="text-xs text-amber-600 mt-0.5">
                  Rückstellungen: {formatEUR(meta.reservesTotalCents)}
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center gap-2">
            <button
              onClick={syncIstBalance}
              disabled={calculating}
              className="px-3 py-1.5 text-xs font-semibold text-[var(--primary)] border border-[var(--primary)] rounded-lg hover:bg-[var(--primary)]/10 transition-colors disabled:opacity-50"
            >
              {calculating ? "Wird aktualisiert..." : "IST-Daten aktualisieren"}
            </button>
            <span className="text-xs text-[var(--muted)]">
              Aktualisiert IST-Perioden und bietet an, den Eröffnungssaldo anzupassen
            </span>
          </div>
        </div>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            label="Schluss-Saldo"
            value={formatEUR(forecastData.summary.finalClosingBalanceCents)}
            sub={`Ende ${forecastData.periods[forecastData.periods.length - 1]?.periodLabel || ""}`}
            color={Number(forecastData.summary.finalClosingBalanceCents) >= 0 ? "green" : "red"}
          />
          <KPICard
            label="Min. Headroom"
            value={formatEUR(forecastData.summary.minHeadroomCents)}
            sub={forecastData.periods[forecastData.summary.minHeadroomPeriodIndex]?.periodLabel || ""}
            color={Number(forecastData.summary.minHeadroomCents) >= 0 ? "green" : "red"}
          />
          <KPICard
            label="Gesamt-Einzahlungen"
            value={formatEUR(forecastData.summary.totalInflowsCents)}
            sub="Alle Perioden"
            color="blue"
          />
          <KPICard
            label="Gesamt-Auszahlungen"
            value={formatEUR(forecastData.summary.totalOutflowsCents)}
            sub="Alle Perioden"
            color="gray"
          />
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab("table")}
          className={cn(
            "px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px",
            activeTab === "table"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
          )}
        >
          Prognose-Tabelle
        </button>
        <button
          onClick={() => setActiveTab("assumptions")}
          className={cn(
            "px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px",
            activeTab === "assumptions"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
          )}
        >
          Annahmen ({assumptions.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "table" && forecastData && (
        <ForecastTable data={forecastData} />
      )}

      {activeTab === "assumptions" && (
        <AssumptionsEditor
          assumptions={assumptions}
          periodCount={meta?.periodCount || 11}
          periods={forecastData?.periods || []}
          onEdit={(a) => { setEditingAssumption(a); setShowModal(true); }}
          onDelete={deleteAssumption}
          onToggle={toggleAssumption}
          onAdd={() => { setEditingAssumption(null); setShowModal(true); }}
        />
      )}

      {/* Modal */}
      {showModal && (
        <AssumptionModal
          assumption={editingAssumption}
          periodCount={meta?.periodCount || 11}
          periods={forecastData?.periods || []}
          onSave={saveAssumption}
          onClose={() => { setShowModal(false); setEditingAssumption(null); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// KPI CARD
// ============================================================================

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

// ============================================================================
// FORECAST TABLE
// ============================================================================

function ForecastTable({ data }: { data: ForecastData }) {
  const { periods } = data;

  // Einzigartige Inflow/Outflow LineItems sammeln (aus Forecast-Perioden)
  const inflowKeys = new Map<string, string>(); // categoryKey → categoryLabel
  const outflowKeys = new Map<string, string>();

  for (const p of periods) {
    if (p.dataSource !== "FORECAST") continue;
    for (const li of p.lineItems) {
      if (li.flowType === "INFLOW") {
        inflowKeys.set(li.categoryKey, li.categoryLabel);
      } else {
        outflowKeys.set(li.categoryKey, li.categoryLabel);
      }
    }
  }

  return (
    <div className="admin-card overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-[var(--border)]">
            <th className="text-left p-3 font-semibold sticky left-0 bg-white z-10 min-w-[200px]">Position</th>
            {periods.map((p) => (
              <th
                key={p.periodIndex}
                className={cn(
                  "text-right p-3 font-semibold min-w-[110px]",
                  p.dataSource === "IST" ? "bg-gray-50" : "bg-blue-50/50"
                )}
              >
                {p.periodLabel}
                <br />
                <span className={cn(
                  "text-[10px] font-normal uppercase tracking-wider",
                  p.dataSource === "IST" ? "text-gray-500" : "text-blue-500"
                )}>
                  {p.dataSource}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Block 1: Eröffnungssaldo */}
          <SectionHeader label="Eröffnungssaldo" />
          <DataRow
            label="Kontostand Periodenstart"
            periods={periods}
            getValue={(p) => p.openingBalanceCents}
            isBold
          />

          {/* Block 2: Einzahlungen */}
          <SectionHeader label="Einzahlungen" />
          {inflowKeys.size > 0 ? (
            Array.from(inflowKeys).map(([key, label]) => (
              <DataRow
                key={key}
                label={label}
                periods={periods}
                getValue={(p) => {
                  if (p.dataSource === "IST") return "";
                  const item = p.lineItems.find(li => li.categoryKey === key && li.flowType === "INFLOW");
                  return item?.amountCents || "0";
                }}
                getTooltip={(p) => {
                  if (p.dataSource === "IST") return undefined;
                  const item = p.lineItems.find(li => li.categoryKey === key && li.flowType === "INFLOW");
                  return item?.formula;
                }}
                isSubRow
                istBlank
              />
            ))
          ) : (
            <tr className="border-b border-[var(--border)]">
              <td className="p-2 px-3 pl-6 text-xs text-[var(--muted)] italic sticky left-0 bg-white z-10" colSpan={1}>
                Noch keine Annahmen erstellt
              </td>
              <td colSpan={periods.length} />
            </tr>
          )}
          <DataRow
            label="Summe Einzahlungen"
            periods={periods}
            getValue={(p) => p.cashInTotalCents}
            isBold
            isSummary
          />

          {/* Block 3: Auszahlungen */}
          <SectionHeader label="Auszahlungen" />
          {outflowKeys.size > 0 ? (
            Array.from(outflowKeys).map(([key, label]) => (
              <DataRow
                key={key}
                label={label}
                periods={periods}
                getValue={(p) => {
                  if (p.dataSource === "IST") return "";
                  const item = p.lineItems.find(li => li.categoryKey === key && li.flowType === "OUTFLOW");
                  if (!item || item.amountCents === "0") return "0";
                  return `-${item.amountCents}`;
                }}
                getTooltip={(p) => {
                  if (p.dataSource === "IST") return undefined;
                  const item = p.lineItems.find(li => li.categoryKey === key && li.flowType === "OUTFLOW");
                  return item?.formula;
                }}
                isSubRow
                istBlank
              />
            ))
          ) : (
            <tr className="border-b border-[var(--border)]">
              <td className="p-2 px-3 pl-6 text-xs text-[var(--muted)] italic sticky left-0 bg-white z-10" colSpan={1}>
                Noch keine Annahmen erstellt
              </td>
              <td colSpan={periods.length} />
            </tr>
          )}
          <DataRow
            label="Summe Auszahlungen"
            periods={periods}
            getValue={(p) => p.cashOutTotalCents}
            isBold
            isSummary
          />

          {/* Block 4: Liquidität */}
          <SectionHeader label="Liquiditätsentwicklung" />
          <DataRow
            label="Veränderung"
            periods={periods}
            getValue={(p) => p.netCashflowCents}
          />
          <DataRow
            label="Endbestand"
            periods={periods}
            getValue={(p) => p.closingBalanceCents}
            isBold
          />
          <DataRow
            label="+ Kreditlinie"
            periods={periods}
            getValue={(p) => p.creditLineAvailableCents}
          />
          <DataRow
            label="Headroom"
            periods={periods}
            getValue={(p) => p.headroomCents}
            isBold
          />
          <DataRow
            label="Headroom nach Rückstellungen"
            periods={periods}
            getValue={(p) => p.headroomAfterReservesCents}
            getTooltip={() => {
              const reserves = data.meta?.reservesTotalCents;
              return reserves && Number(reserves) > 0
                ? `Headroom − Rückstellungen (${formatEUR(reserves)})`
                : "Endbestand + Kreditlinie − Rückstellungen";
            }}
            isBold
            isHighlight
          />
        </tbody>
      </table>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr className="bg-gray-100">
      <td colSpan={100} className="p-2 px-3 font-bold text-xs uppercase tracking-wider text-[var(--muted)] sticky left-0 bg-gray-100">
        {label}
      </td>
    </tr>
  );
}

function DataRow({ label, periods, getValue, getTooltip, isBold, isSubRow, isSummary, isHighlight, istBlank }: {
  label: string;
  periods: ForecastPeriodJSON[];
  getValue: (p: ForecastPeriodJSON) => string;
  getTooltip?: (p: ForecastPeriodJSON) => string | undefined;
  isBold?: boolean;
  isSubRow?: boolean;
  isSummary?: boolean;
  isHighlight?: boolean;
  istBlank?: boolean;
}) {
  return (
    <tr className={cn(
      "border-b border-[var(--border)]",
      isSummary && "border-t-2 border-t-[var(--border)]",
      isHighlight && "bg-blue-50/30"
    )}>
      <td className={cn(
        "p-2 px-3 sticky left-0 bg-white z-10",
        isBold ? "font-semibold" : "font-normal",
        isSubRow && "pl-6 text-[var(--secondary)]",
        isHighlight && "bg-blue-50/30"
      )}>
        {label}
      </td>
      {periods.map((p) => {
        const rawValue = getValue(p);
        const tooltip = getTooltip?.(p);

        // IST-Perioden: Sub-Rows leer lassen (Details im Dashboard)
        if (istBlank && p.dataSource === "IST") {
          return (
            <td
              key={p.periodIndex}
              className="text-right p-2 px-3 bg-gray-50 text-gray-300 text-xs"
            >
              ···
            </td>
          );
        }

        // Leere Werte (z.B. IST-Perioden in Sub-Rows)
        if (rawValue === "") {
          return (
            <td key={p.periodIndex} className={cn("text-right p-2 px-3", p.dataSource === "IST" ? "bg-gray-50" : "bg-blue-50/20")} />
          );
        }

        const numValue = Number(rawValue);
        return (
          <td
            key={p.periodIndex}
            title={tooltip}
            className={cn(
              "text-right p-2 px-3 tabular-nums",
              isBold && "font-semibold",
              p.dataSource === "IST" ? "bg-gray-50" : "bg-blue-50/20",
              isHighlight && "bg-blue-50/30",
              numValue < 0 && "text-red-600",
              tooltip && "cursor-help"
            )}
          >
            {numValue === 0 && !isBold ? "–" : formatEUR(rawValue)}
          </td>
        );
      })}
    </tr>
  );
}

// ============================================================================
// ASSUMPTIONS EDITOR
// ============================================================================

function AssumptionsEditor({ assumptions, onEdit, onDelete, onToggle, onAdd, periods }: {
  assumptions: AssumptionJSON[];
  periodCount: number;
  periods: ForecastPeriodJSON[];
  onEdit: (a: AssumptionJSON) => void;
  onDelete: (id: string) => void;
  onToggle: (a: AssumptionJSON) => void;
  onAdd: () => void;
}) {
  const inflows = assumptions.filter(a => a.flowType === "INFLOW");
  const outflows = assumptions.filter(a => a.flowType === "OUTFLOW");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">
          {assumptions.length} Annahmen ({inflows.length} Einzahlungen, {outflows.length} Auszahlungen)
        </p>
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-semibold hover:opacity-90"
        >
          + Neue Annahme
        </button>
      </div>

      {/* Einzahlungen */}
      <AssumptionGroup
        title="Einzahlungen"
        items={inflows}
        periods={periods}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggle={onToggle}
      />

      {/* Auszahlungen */}
      <AssumptionGroup
        title="Auszahlungen"
        items={outflows}
        periods={periods}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggle={onToggle}
      />

      {assumptions.length === 0 && (
        <div className="admin-card p-8 text-center text-[var(--muted)]">
          <p className="text-lg mb-2">Keine Annahmen vorhanden</p>
          <p className="text-sm">Erstellen Sie Annahmen, um die Prognose-Tabelle zu füllen.</p>
        </div>
      )}
    </div>
  );
}

function AssumptionGroup({ title, items, periods, onEdit, onDelete, onToggle }: {
  title: string;
  items: AssumptionJSON[];
  periods: ForecastPeriodJSON[];
  onEdit: (a: AssumptionJSON) => void;
  onDelete: (id: string) => void;
  onToggle: (a: AssumptionJSON) => void;
}) {
  if (items.length === 0) return null;

  const getPeriodLabel = (idx: number) => {
    const p = periods.find(p => p.periodIndex === idx);
    return p?.periodLabel || `P${idx}`;
  };

  return (
    <div className="admin-card">
      <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wider px-4 pt-4 pb-2">
        {title}
      </h3>
      <div className="divide-y divide-[var(--border)]">
        {items.map(a => (
          <div key={a.id} className={cn("px-4 py-3 flex items-center gap-4", !a.isActive && "opacity-50")}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{a.categoryLabel}</span>
                <span className={cn(
                  "px-2 py-0.5 text-[10px] font-semibold rounded border",
                  ASSUMPTION_TYPE_COLORS[a.assumptionType] || "bg-gray-100 text-gray-800"
                )}>
                  {ASSUMPTION_TYPE_LABELS[a.assumptionType] || a.assumptionType}
                </span>
                {!a.isActive && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded border bg-gray-100 text-gray-500 border-gray-300">
                    Deaktiviert
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--muted)] mt-1 flex items-center gap-3">
                <span className="font-medium">{formatEUR(a.baseAmountCents)}/Periode</span>
                <span>Perioden {getPeriodLabel(a.startPeriodIndex)}–{getPeriodLabel(a.endPeriodIndex)}</span>
                {a.growthFactorPercent !== null && a.growthFactorPercent !== 0 && (
                  <span className={a.growthFactorPercent > 0 ? "text-green-600" : "text-red-600"}>
                    {a.growthFactorPercent > 0 ? "+" : ""}{a.growthFactorPercent}%/P
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--muted)] mt-0.5">
                Quelle: {a.baseAmountSource}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onToggle(a)}
                className="p-1.5 rounded hover:bg-gray-100 text-[var(--muted)]"
                title={a.isActive ? "Deaktivieren" : "Aktivieren"}
              >
                {a.isActive ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => onEdit(a)}
                className="p-1.5 rounded hover:bg-gray-100 text-[var(--muted)]"
                title="Bearbeiten"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => onDelete(a.id)}
                className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                title="Löschen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// ASSUMPTION MODAL
// ============================================================================

function AssumptionModal({ assumption, periodCount, periods, onSave, onClose }: {
  assumption: AssumptionJSON | null;
  periodCount: number;
  periods: ForecastPeriodJSON[];
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const isEdit = !!assumption;

  // Escape-Key schließt Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const [categoryKey, setCategoryKey] = useState(assumption?.categoryKey || "");
  const [categoryLabel, setCategoryLabel] = useState(assumption?.categoryLabel || "");
  const [flowType, setFlowType] = useState(assumption?.flowType || "INFLOW");
  const [assumptionType, setAssumptionType] = useState(assumption?.assumptionType || "RUN_RATE");
  const [baseAmount, setBaseAmount] = useState(
    assumption ? formatEURInput(assumption.baseAmountCents) : ""
  );
  const [baseAmountSource, setBaseAmountSource] = useState(assumption?.baseAmountSource || "");
  const [baseAmountNote, setBaseAmountNote] = useState(assumption?.baseAmountNote || "");
  const [growthFactor, setGrowthFactor] = useState(
    assumption?.growthFactorPercent !== null && assumption?.growthFactorPercent !== undefined
      ? String(assumption.growthFactorPercent)
      : ""
  );
  const [startPeriod, setStartPeriod] = useState(assumption?.startPeriodIndex ?? 0);
  const [endPeriod, setEndPeriod] = useState(assumption?.endPeriodIndex ?? (periodCount - 1));

  const getPeriodLabel = (idx: number) => {
    const p = periods.find(p => p.periodIndex === idx);
    return p?.periodLabel || `Periode ${idx}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      categoryKey: categoryKey || categoryLabel.toUpperCase().replace(/[^A-ZÄÖÜ0-9]/g, "_"),
      categoryLabel,
      flowType,
      assumptionType,
      baseAmountCents: parseCentsFromEUR(baseAmount),
      baseAmountSource,
      baseAmountNote: baseAmountNote || null,
      growthFactorPercent: growthFactor ? parseFloat(growthFactor.replace(",", ".")) : null,
      startPeriodIndex: startPeriod,
      endPeriodIndex: endPeriod,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">
            {isEdit ? "Annahme bearbeiten" : "Neue Annahme"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Kategorie */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Bezeichnung *</label>
                <input
                  type="text"
                  value={categoryLabel}
                  onChange={(e) => setCategoryLabel(e.target.value)}
                  placeholder="z.B. HZV Uckerath"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Schlüssel</label>
                <input
                  type="text"
                  value={categoryKey}
                  onChange={(e) => setCategoryKey(e.target.value)}
                  placeholder="HZV_UCKERATH"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Typ-Auswahl */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Richtung *</label>
                <select
                  value={flowType}
                  onChange={(e) => setFlowType(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                >
                  <option value="INFLOW">Einzahlung</option>
                  <option value="OUTFLOW">Auszahlung</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Annahme-Typ *</label>
                <select
                  value={assumptionType}
                  onChange={(e) => setAssumptionType(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                >
                  <option value="RUN_RATE">Laufend (Run Rate)</option>
                  <option value="FIXED">Fixbetrag</option>
                  <option value="ONE_TIME">Einmalig</option>
                  <option value="PERCENTAGE_OF_REVENUE">% der Einnahmen</option>
                </select>
              </div>
            </div>

            {/* Betrag */}
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                {assumptionType === "PERCENTAGE_OF_REVENUE" ? "Prozentsatz (%)" : "Betrag (EUR) *"}
              </label>
              <input
                type="text"
                value={baseAmount}
                onChange={(e) => setBaseAmount(e.target.value)}
                placeholder={assumptionType === "PERCENTAGE_OF_REVENUE" ? "z.B. 10,00" : "z.B. 40.000,00"}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                required
              />
            </div>

            {/* Quelle (Pflichtfeld) */}
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Quelle / Begründung *</label>
              <input
                type="text"
                value={baseAmountSource}
                onChange={(e) => setBaseAmountSource(e.target.value)}
                placeholder="z.B. Durchschnitt IST Okt–Jan 2026"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                required
              />
            </div>

            {/* Notiz */}
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Notiz</label>
              <input
                type="text"
                value={baseAmountNote}
                onChange={(e) => setBaseAmountNote(e.target.value)}
                placeholder="Optionale Erläuterung"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
              />
            </div>

            {/* Wachstumsfaktor (nur bei RUN_RATE) */}
            {(assumptionType === "RUN_RATE" || assumptionType === "FIXED") && (
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                  Wachstumsfaktor (%/Periode)
                </label>
                <input
                  type="text"
                  value={growthFactor}
                  onChange={(e) => setGrowthFactor(e.target.value)}
                  placeholder="z.B. -5 für 5% Rückgang"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                />
              </div>
            )}

            {/* Perioden-Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Von Periode</label>
                <select
                  value={startPeriod}
                  onChange={(e) => setStartPeriod(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                >
                  {Array.from({ length: periodCount }, (_, i) => (
                    <option key={i} value={i}>{getPeriodLabel(i)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Bis Periode</label>
                <select
                  value={endPeriod}
                  onChange={(e) => setEndPeriod(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                >
                  {Array.from({ length: periodCount }, (_, i) => (
                    <option key={i} value={i}>{getPeriodLabel(i)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-[var(--secondary)] hover:text-[var(--foreground)] transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-semibold hover:opacity-90"
              >
                {isEdit ? "Speichern" : "Erstellen"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
