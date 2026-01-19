"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Assumption {
  id: string;
  categoryName: string;
  source: string;
  description: string;
  riskLevel: string;
  createdAt: string;
  updatedAt: string;
}

interface Category {
  name: string;
  flowType: string;
}

const RISK_LEVELS = [
  { value: "conservative", label: "Konservativ", symbol: "○", color: "bg-green-100 text-green-700" },
  { value: "low", label: "Gering", symbol: "◐", color: "bg-blue-100 text-blue-700" },
  { value: "medium", label: "Mittel", symbol: "◑", color: "bg-yellow-100 text-yellow-700" },
  { value: "high", label: "Hoch", symbol: "●", color: "bg-orange-100 text-orange-700" },
  { value: "aggressive", label: "Aggressiv", symbol: "●●", color: "bg-red-100 text-red-700" },
];

export default function AssumptionsManagementPage() {
  const params = useParams();
  const caseId = params.id as string;

  const [assumptions, setAssumptions] = useState<Assumption[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    categoryName: "",
    source: "",
    description: "",
    riskLevel: "medium",
  });

  useEffect(() => {
    fetchData();
  }, [caseId]);

  async function fetchData() {
    try {
      // Fetch assumptions
      const assumptionsRes = await fetch(`/api/cases/${caseId}/plan/assumptions`);
      if (assumptionsRes.ok) {
        const data = await assumptionsRes.json();
        setAssumptions(data.assumptions || []);
      }

      // Fetch categories for dropdown
      const caseRes = await fetch(`/api/cases/${caseId}`);
      if (caseRes.ok) {
        const caseData = await caseRes.json();
        const plan = caseData.plans?.[0];
        if (plan?.categories) {
          setCategories(plan.categories.map((c: { name: string; flowType: string }) => ({
            name: c.name,
            flowType: c.flowType,
          })));
        }
      }
    } catch (err) {
      setError("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/cases/${caseId}/plan/assumptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Speichern");
      }

      setSuccess("Planungsprämisse gespeichert");
      setFormData({ categoryName: "", source: "", description: "", riskLevel: "medium" });
      setEditingId(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(assumptionId: string) {
    if (!confirm("Planungsprämisse wirklich löschen?")) return;

    try {
      const res = await fetch(`/api/cases/${caseId}/plan/assumptions?assumptionId=${assumptionId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Löschen");
      }

      setSuccess("Planungsprämisse gelöscht");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  }

  function startEdit(assumption: Assumption) {
    setEditingId(assumption.id);
    setFormData({
      categoryName: assumption.categoryName,
      source: assumption.source,
      description: assumption.description,
      riskLevel: assumption.riskLevel,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setFormData({ categoryName: "", source: "", description: "", riskLevel: "medium" });
  }

  const getRiskConfig = (level: string) => {
    return RISK_LEVELS.find((r) => r.value === level) || RISK_LEVELS[2];
  };

  // Find categories without assumptions
  const categoriesWithoutAssumptions = categories.filter(
    (cat) => !assumptions.find((a) => a.categoryName === cat.name)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-[var(--muted)]">
        <Link href="/admin/cases" className="hover:text-[var(--primary)]">Fälle</Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link href={`/admin/cases/${caseId}`} className="hover:text-[var(--primary)]">Fall</Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[var(--foreground)]">Planungsprämissen</span>
      </div>

      {/* Header */}
      <div className="admin-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Planungsprämissen</h1>
            <p className="mt-1 text-sm text-[var(--secondary)]">
              Dokumentation der Annahmen hinter jeder Planungsposition
            </p>
          </div>
          <Link href={`/admin/cases/${caseId}`} className="btn-secondary">
            Zurück zum Fall
          </Link>
        </div>
      </div>

      {/* Info-Box: Was sind Planungsprämissen? */}
      <div className="admin-card p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-medium text-blue-800">
              Planungsprämissen = Dokumentation
            </h4>
            <p className="text-xs text-blue-700 mt-1">
              Prämissen dokumentieren die Annahmen hinter Ihrer Planung.
              Sie erzeugen <strong>keine</strong> Zahlungsströme, sondern dienen
              der Nachvollziehbarkeit für Gericht und Gläubiger.
              Änderungen an Prämissen haben keinen Einfluss auf die Liquiditätsberechnung.
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Risk Legend */}
      <div className="admin-card p-4">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Risiko-Bewertungsskala</h3>
        <div className="flex flex-wrap gap-4">
          {RISK_LEVELS.map((level) => (
            <div key={level.value} className="flex items-center gap-2">
              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${level.color}`}>
                {level.symbol}
              </span>
              <span className="text-sm text-[var(--secondary)]">{level.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Form */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          {editingId ? "Prämisse bearbeiten" : "Neue Prämisse hinzufügen"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Kategorie *
              </label>
              <select
                value={formData.categoryName}
                onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
                className="input w-full"
                required
                disabled={!!editingId}
              >
                <option value="">Kategorie wählen...</option>
                {(editingId ? categories : categoriesWithoutAssumptions).map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name} ({cat.flowType === "INFLOW" ? "Einzahlung" : "Auszahlung"})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Risikobewertung *
              </label>
              <select
                value={formData.riskLevel}
                onChange={(e) => setFormData({ ...formData, riskLevel: e.target.value })}
                className="input w-full"
                required
              >
                {RISK_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.symbol} {level.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Informationsquelle *
            </label>
            <input
              type="text"
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              className="input w-full"
              placeholder="z.B. OP-Debitorenliste zum 05.01.2026"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Planungsprämisse (Beschreibung) *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input w-full"
              rows={3}
              placeholder="Detaillierte Beschreibung der Annahme..."
              required
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Speichern..." : editingId ? "Aktualisieren" : "Hinzufügen"}
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="btn-secondary">
                Abbrechen
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Existing Assumptions */}
      <div className="admin-card">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Dokumentierte Prämissen ({assumptions.length})
          </h2>
        </div>
        {assumptions.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Noch keine Planungsprämissen dokumentiert
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {assumptions.map((assumption) => {
              const riskConfig = getRiskConfig(assumption.riskLevel);
              return (
                <div key={assumption.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${riskConfig.color}`}>
                          {riskConfig.symbol}
                        </span>
                        <h3 className="font-semibold text-[var(--foreground)]">
                          {assumption.categoryName}
                        </h3>
                      </div>
                      <div className="ml-10 space-y-2">
                        <div>
                          <span className="text-xs font-medium text-[var(--muted)] uppercase">Quelle:</span>
                          <p className="text-sm text-[var(--secondary)]">{assumption.source}</p>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-[var(--muted)] uppercase">Prämisse:</span>
                          <p className="text-sm text-[var(--secondary)]">{assumption.description}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => startEdit(assumption)}
                        className="p-2 text-[var(--secondary)] hover:text-[var(--primary)] hover:bg-gray-100 rounded"
                        title="Bearbeiten"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(assumption.id)}
                        className="p-2 text-[var(--secondary)] hover:text-red-600 hover:bg-red-50 rounded"
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
    </div>
  );
}
