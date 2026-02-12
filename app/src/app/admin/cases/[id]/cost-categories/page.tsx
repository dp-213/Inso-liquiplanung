"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface CostCategory {
  id: string;
  name: string;
  shortName: string | null;
  description: string | null;
  budgetCents: string | null;
  categoryTag: string | null;
  displayOrder: number;
  isActive: boolean;
}

const CATEGORY_TAG_OPTIONS = [
  { value: "", label: "Kein Mapping" },
  { value: "PERSONAL", label: "Personal" },
  { value: "SOZIALABGABEN", label: "Sozialabgaben" },
  { value: "MIETE", label: "Miete" },
  { value: "STROM", label: "Strom/Energie" },
  { value: "KOMMUNIKATION", label: "Kommunikation" },
  { value: "LEASING", label: "Leasing" },
  { value: "VERSICHERUNG_BETRIEBLICH", label: "Versicherung" },
  { value: "BUERO_IT", label: "Büro/IT" },
  { value: "BANKGEBUEHREN", label: "Bankgebühren" },
  { value: "BETRIEBSKOSTEN", label: "Betriebskosten (allg.)" },
  { value: "STEUERN", label: "Steuern" },
  { value: "VERFAHRENSKOSTEN", label: "Verfahrenskosten" },
  { value: "DARLEHEN_TILGUNG", label: "Darlehen/Tilgung" },
];

export default function CostCategoriesPage() {
  const params = useParams();
  const caseId = params.id as string;

  const [categories, setCategories] = useState<CostCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    categoryId: null as string | null,
    name: "",
    shortName: "",
    description: "",
    budgetEur: "",
    categoryTag: "",
    isActive: true,
  });

  useEffect(() => {
    fetchData();
  }, [caseId]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/cases/${caseId}/cost-categories`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCategories(data.costCategories || []);
      }
    } catch {
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
      const method = formData.categoryId ? "PUT" : "POST";
      const url = formData.categoryId
        ? `/api/cases/${caseId}/cost-categories/${formData.categoryId}`
        : `/api/cases/${caseId}/cost-categories`;

      const budgetCents = formData.budgetEur
        ? Math.round(parseFloat(formData.budgetEur) * 100)
        : null;

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          shortName: formData.shortName || null,
          description: formData.description || null,
          budgetCents,
          categoryTag: formData.categoryTag || null,
          isActive: formData.isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Speichern");
      }

      setSuccess("Kostenart gespeichert");
      resetForm();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(categoryId: string) {
    if (!confirm("Kostenart wirklich löschen?")) return;

    try {
      const res = await fetch(`/api/cases/${caseId}/cost-categories/${categoryId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Löschen");
      }

      setSuccess("Kostenart gelöscht");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  }

  function startEdit(category: CostCategory) {
    const budgetEur = category.budgetCents
      ? (Number(category.budgetCents) / 100).toFixed(2)
      : "";
    setFormData({
      categoryId: category.id,
      name: category.name,
      shortName: category.shortName || "",
      description: category.description || "",
      budgetEur,
      categoryTag: category.categoryTag || "",
      isActive: category.isActive,
    });
  }

  function resetForm() {
    setFormData({
      categoryId: null,
      name: "",
      shortName: "",
      description: "",
      budgetEur: "",
      categoryTag: "",
      isActive: true,
    });
  }

  const fmt = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Kostenarten</h1>
            <p className="mt-1 text-sm text-[var(--secondary)]">
              Kategorien für Ausgaben-Planung und Freigabe-Zuordnung
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Gesamt</p>
          <p className="text-2xl font-bold text-[var(--foreground)]">{categories.length}</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Aktiv</p>
          <p className="text-2xl font-bold text-green-600">
            {categories.filter(c => c.isActive).length}
          </p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Mit Budget</p>
          <p className="text-2xl font-bold text-blue-600">
            {categories.filter(c => c.budgetCents).length}
          </p>
        </div>
      </div>

      {/* Add/Edit Form */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          {formData.categoryId ? "Kostenart bearbeiten" : "Neue Kostenart hinzufügen"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input w-full"
                placeholder="z.B. Miete & Nebenkosten"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Kurzname
              </label>
              <input
                type="text"
                value={formData.shortName}
                onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                className="input w-full"
                placeholder="z.B. Miete"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Budget (EUR/Monat)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.budgetEur}
                onChange={(e) => setFormData({ ...formData, budgetEur: e.target.value })}
                className="input w-full"
                placeholder="z.B. 5000.00"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Matrix-Mapping (categoryTag)
              </label>
              <select
                value={formData.categoryTag}
                onChange={(e) => setFormData({ ...formData, categoryTag: e.target.value })}
                className="input w-full"
              >
                {CATEGORY_TAG_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <p className="text-xs text-[var(--muted)] mt-1">
                Verknüpft diese Kostenart mit der Liquiditätsmatrix
              </p>
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-5 h-5 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <span className="text-sm text-[var(--foreground)]">
                  Aktiv (in Dropdown-Auswahlen verfügbar)
                </span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Beschreibung
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input w-full"
              rows={2}
              placeholder="Optionale Beschreibung..."
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Speichern..." : formData.categoryId ? "Aktualisieren" : "Hinzufügen"}
            </button>
            {formData.categoryId && (
              <button type="button" onClick={resetForm} className="btn-secondary">
                Abbrechen
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="admin-card">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Übersicht ({categories.length})
          </h2>
        </div>
        {categories.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Noch keine Kostenarten erfasst
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border)]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Kurzname</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--secondary)] uppercase">Budget</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--secondary)] uppercase">Mapping</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--secondary)] uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--secondary)] uppercase">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {categories.map((category) => (
                  <tr key={category.id} className={`hover:bg-gray-50 ${!category.isActive ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 text-sm font-medium text-[var(--foreground)]">
                      {category.name}
                      {category.description && (
                        <p className="text-xs text-[var(--muted)] mt-0.5">{category.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--secondary)]">{category.shortName || "-"}</td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-[var(--foreground)]">
                      {category.budgetCents ? fmt.format(Number(category.budgetCents) / 100) : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {category.categoryTag ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 font-mono">
                          {category.categoryTag}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        category.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {category.isActive ? "Aktiv" : "Inaktiv"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => startEdit(category)}
                          className="p-1.5 text-[var(--secondary)] hover:text-[var(--primary)] hover:bg-gray-100 rounded"
                          title="Bearbeiten"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(category.id)}
                          className="p-1.5 text-[var(--secondary)] hover:text-red-600 hover:bg-red-50 rounded"
                          title="Löschen"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
