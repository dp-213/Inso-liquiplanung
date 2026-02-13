"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatEUR, type AssumptionJSON } from "@/components/forecast/types";

// =============================================================================
// Types
// =============================================================================

interface PlanningAssumption {
  id: string;
  caseId: string;
  title: string;
  description: string;
  source: string;
  status: string;
  linkedModule: string | null;
  linkedEntityId: string | null;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Constants
// =============================================================================

const STATUS_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  ANNAHME: { label: "Annahme", icon: "○", color: "bg-amber-100 text-amber-700 border-amber-300" },
  VERIFIZIERT: { label: "Verifiziert", icon: "✓", color: "bg-green-100 text-green-700 border-green-300" },
  WIDERLEGT: { label: "Widerlegt", icon: "✗", color: "bg-red-100 text-red-700 border-red-300" },
};

const MODULE_LINKS: Record<string, { label: string; path: string }> = {
  banken: { label: "Finanzierung & Banken", path: "finanzierung" },
  personal: { label: "Personal", path: "personal" },
  "business-logic": { label: "Business-Logik", path: "business-logic" },
  counterparties: { label: "Gegenparteien", path: "counterparties" },
  "iv-notes": { label: "IV-Kommunikation", path: "iv-kommunikation" },
  finanzierung: { label: "Finanzierung", path: "finanzierung" },
};

const ASSUMPTION_TYPE_LABELS: Record<string, string> = {
  RUN_RATE: "Laufend",
  FIXED: "Fixbetrag",
  ONE_TIME: "Einmalig",
  PERCENTAGE_OF_REVENUE: "% der Einnahmen",
};

// =============================================================================
// Page Component
// =============================================================================

export default function BerechnungsannahmenPage() {
  const params = useParams();
  const caseId = params.id as string;

  // Block 2: PlanningAssumptions
  const [assumptions, setAssumptions] = useState<PlanningAssumption[]>([]);
  const [loadingAssumptions, setLoadingAssumptions] = useState(true);

  // Block 3: ForecastAssumptions
  const [forecastAssumptions, setForecastAssumptions] = useState<AssumptionJSON[]>([]);
  const [loadingForecast, setLoadingForecast] = useState(true);

  // Form state for Block 2
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    source: "",
    description: "",
    status: "ANNAHME",
    linkedModule: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch data
  const fetchAssumptions = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/plan/assumptions`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setAssumptions(data.assumptions || []);
      }
    } catch {
      console.error("Fehler beim Laden der Planungsannahmen");
    } finally {
      setLoadingAssumptions(false);
    }
  }, [caseId]);

  const fetchForecastAssumptions = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/forecast/assumptions`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setForecastAssumptions(data.assumptions || []);
      }
    } catch {
      console.error("Fehler beim Laden der Prognose-Annahmen");
    } finally {
      setLoadingForecast(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchAssumptions();
    fetchForecastAssumptions();
  }, [fetchAssumptions, fetchForecastAssumptions]);

  // Form handlers
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/cases/${caseId}/plan/assumptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...(editingId && { id: editingId }),
          title: formData.title,
          source: formData.source,
          description: formData.description,
          status: formData.status,
          linkedModule: formData.linkedModule || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Speichern");
      }

      setSuccess(editingId ? "Annahme aktualisiert" : "Annahme erstellt");
      resetForm();
      fetchAssumptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Planungsannahme wirklich löschen?")) return;
    try {
      const res = await fetch(`/api/cases/${caseId}/plan/assumptions?assumptionId=${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Fehler beim Löschen");
      setSuccess("Annahme gelöscht");
      fetchAssumptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  }

  function startEdit(a: PlanningAssumption) {
    setEditingId(a.id);
    setFormData({
      title: a.title,
      source: a.source,
      description: a.description,
      status: a.status,
      linkedModule: a.linkedModule || "",
    });
    setShowForm(true);
  }

  function resetForm() {
    setEditingId(null);
    setFormData({ title: "", source: "", description: "", status: "ANNAHME", linkedModule: "" });
    setShowForm(false);
  }

  // Group forecast assumptions by flowType
  const inflowAssumptions = forecastAssumptions.filter(a => a.flowType === "INFLOW" && a.isActive);
  const outflowAssumptions = forecastAssumptions.filter(a => a.flowType === "OUTFLOW" && a.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-card p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Berechnungsannahmen</h1>
        <p className="mt-1 text-sm text-[var(--secondary)]">
          Datenqualität, Planungsannahmen und Prognose-Parameter auf einen Blick
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">×</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-2 font-bold">×</button>
        </div>
      )}

      {/* ================================================================== */}
      {/* Planungsannahmen (Dokumentation, Case-Level)                      */}
      {/* ================================================================== */}
      <div className="admin-card">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Planungsannahmen</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">Fallweite Annahmen — dokumentiert, nicht berechnet</p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}
            className="btn-primary text-sm"
          >
            {showForm ? "Abbrechen" : "+ Annahme"}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="px-6 py-4 border-b border-[var(--border)] bg-gray-50">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Titel *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input w-full"
                  placeholder="z.B. Fortführung aller Praxen bis Ende Q1/2026"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Quelle *</label>
                  <input
                    type="text"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="input w-full"
                    placeholder="z.B. IV-Gespräch 09.02.2026"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="input w-full"
                    >
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Verlinkt mit</label>
                    <select
                      value={formData.linkedModule}
                      onChange={(e) => setFormData({ ...formData, linkedModule: e.target.value })}
                      className="input w-full"
                    >
                      <option value="">— Kein Link —</option>
                      {Object.entries(MODULE_LINKS).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Beschreibung *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input w-full"
                  rows={2}
                  placeholder="Detaillierte Beschreibung der Annahme..."
                  required
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary text-sm" disabled={saving}>
                  {saving ? "Speichert..." : editingId ? "Aktualisieren" : "Erstellen"}
                </button>
                {editingId && (
                  <button type="button" onClick={resetForm} className="btn-secondary text-sm">
                    Abbrechen
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* List */}
        {loadingAssumptions ? (
          <div className="p-6 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[var(--secondary)]">Lade Annahmen...</span>
          </div>
        ) : assumptions.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)] text-sm">
            Noch keine Planungsannahmen dokumentiert
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {assumptions.map((a) => {
              const statusCfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.ANNAHME;
              const moduleLink = a.linkedModule ? MODULE_LINKS[a.linkedModule] : null;
              return (
                <div key={a.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${statusCfg.color}`}>
                          {statusCfg.icon} {statusCfg.label}
                        </span>
                        <h3 className="font-medium text-sm text-[var(--foreground)] truncate">
                          {a.title}
                        </h3>
                      </div>
                      <p className="text-sm text-[var(--secondary)] mb-1">{a.description}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                        <span>Quelle: {a.source}</span>
                        {moduleLink && (
                          <Link
                            href={`/admin/cases/${caseId}/${moduleLink.path}`}
                            className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline"
                          >
                            <span>→</span> {moduleLink.label}
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(a)}
                        className="p-1.5 text-[var(--secondary)] hover:text-[var(--primary)] hover:bg-gray-100 rounded"
                        title="Bearbeiten"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="p-1.5 text-[var(--secondary)] hover:text-red-600 hover:bg-red-50 rounded"
                        title="Löschen"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* BLOCK 3: Prognose-Annahmen (Berechnung, read-only)                */}
      {/* ================================================================== */}
      <div className="admin-card">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Prognose-Annahmen</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">BASE-Szenario — Bearbeitung im Prognose-Editor</p>
          </div>
          <Link
            href={`/admin/cases/${caseId}/forecast`}
            className="btn-secondary text-sm inline-flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Prognose-Editor
          </Link>
        </div>

        {loadingForecast ? (
          <div className="p-6 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[var(--secondary)]">Lade Prognose-Annahmen...</span>
          </div>
        ) : forecastAssumptions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-[var(--muted)] mb-3">Noch keine Prognose-Annahmen konfiguriert</p>
            <Link
              href={`/admin/cases/${caseId}/forecast`}
              className="btn-primary text-sm"
            >
              Zum Prognose-Editor
            </Link>
          </div>
        ) : (
          <div>
            {/* EINNAHMEN */}
            {inflowAssumptions.length > 0 && (
              <div>
                <div className="px-6 py-2 bg-green-50 border-b border-green-200">
                  <span className="text-xs font-bold text-green-800 uppercase tracking-wide">Einnahmen</span>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {inflowAssumptions.map((a) => (
                    <ForecastAssumptionRow key={a.id} assumption={a} />
                  ))}
                </div>
              </div>
            )}

            {/* AUSZAHLUNGEN */}
            {outflowAssumptions.length > 0 && (
              <div>
                <div className="px-6 py-2 bg-red-50 border-b border-red-200">
                  <span className="text-xs font-bold text-red-800 uppercase tracking-wide">Auszahlungen</span>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {outflowAssumptions.map((a) => (
                    <ForecastAssumptionRow key={a.id} assumption={a} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Sub-Component: ForecastAssumptionRow
// =============================================================================

function ForecastAssumptionRow({ assumption: a }: { assumption: AssumptionJSON }) {
  const hasRisk = a.riskProbability !== null && a.riskProbability !== undefined;

  return (
    <div className="px-6 py-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-[var(--foreground)]">{a.categoryLabel}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-[var(--muted)]">
            {ASSUMPTION_TYPE_LABELS[a.assumptionType] || a.assumptionType}
          </span>
        </div>
        <span className="font-semibold text-sm text-[var(--foreground)]">
          {formatEUR(a.baseAmountCents)}
          {a.assumptionType === "RUN_RATE" && <span className="text-xs text-[var(--muted)] ml-1">/Monat</span>}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-0.5 text-xs text-[var(--muted)]">
        {a.method && (
          <div>Methode: {a.method}</div>
        )}
        {a.baseReferencePeriod && (
          <div>Referenz: {a.baseReferencePeriod}</div>
        )}
        {!a.method && !a.baseReferencePeriod && a.baseAmountSource && (
          <div>Quelle: {a.baseAmountSource}</div>
        )}
      </div>

      {/* Risiko */}
      {hasRisk && (
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            {Math.round((a.riskProbability || 0) * 100)}%
            {a.riskImpactCents && (
              <> · {formatEUR(a.riskImpactCents)}</>
            )}
          </span>
          {a.riskComment && (
            <span className="text-[var(--muted)] italic">"{a.riskComment}"</span>
          )}
        </div>
      )}
    </div>
  );
}
