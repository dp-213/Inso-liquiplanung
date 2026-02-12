"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface CostCategoryRef {
  id: string;
  name: string;
  shortName: string | null;
}

interface Creditor {
  id: string;
  name: string;
  shortName: string | null;
  iban: string | null;
  taxId: string | null;
  category: string | null;
  defaultCostCategoryId: string | null;
  defaultCostCategory: CostCategoryRef | null;
  notes: string | null;
  displayOrder: number;
}

const CATEGORY_OPTIONS = [
  { value: "LIEFERANT", label: "Lieferant", color: "bg-blue-100 text-blue-700" },
  { value: "DIENSTLEISTER", label: "Dienstleister", color: "bg-purple-100 text-purple-700" },
  { value: "BEHOERDE", label: "Behörde", color: "bg-amber-100 text-amber-700" },
  { value: "SONSTIGE", label: "Sonstige", color: "bg-gray-100 text-gray-700" },
];

export default function CreditorsPage() {
  const params = useParams();
  const caseId = params.id as string;

  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [costCategories, setCostCategories] = useState<CostCategoryRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    creditorId: null as string | null,
    name: "",
    shortName: "",
    iban: "",
    taxId: "",
    category: "LIEFERANT",
    defaultCostCategoryId: "",
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, [caseId]);

  async function fetchData() {
    try {
      const [credRes, catRes] = await Promise.all([
        fetch(`/api/cases/${caseId}/creditors`),
        fetch(`/api/cases/${caseId}/cost-categories`),
      ]);

      if (credRes.ok) {
        const data = await credRes.json();
        setCreditors(data.creditors || []);
      }
      if (catRes.ok) {
        const data = await catRes.json();
        setCostCategories(
          (data.costCategories || []).filter((c: { isActive: boolean }) => c.isActive)
        );
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
      const method = formData.creditorId ? "PUT" : "POST";
      const url = formData.creditorId
        ? `/api/cases/${caseId}/creditors/${formData.creditorId}`
        : `/api/cases/${caseId}/creditors`;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          shortName: formData.shortName || null,
          iban: formData.iban || null,
          taxId: formData.taxId || null,
          category: formData.category || null,
          defaultCostCategoryId: formData.defaultCostCategoryId || null,
          notes: formData.notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Speichern");
      }

      setSuccess("Kreditor gespeichert");
      resetForm();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(creditorId: string) {
    if (!confirm("Kreditor wirklich löschen?")) return;

    try {
      const res = await fetch(`/api/cases/${caseId}/creditors/${creditorId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Löschen");
      }

      setSuccess("Kreditor gelöscht");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  }

  function startEdit(creditor: Creditor) {
    setFormData({
      creditorId: creditor.id,
      name: creditor.name,
      shortName: creditor.shortName || "",
      iban: creditor.iban || "",
      taxId: creditor.taxId || "",
      category: creditor.category || "LIEFERANT",
      defaultCostCategoryId: creditor.defaultCostCategoryId || "",
      notes: creditor.notes || "",
    });
  }

  function resetForm() {
    setFormData({
      creditorId: null,
      name: "",
      shortName: "",
      iban: "",
      taxId: "",
      category: "LIEFERANT",
      defaultCostCategoryId: "",
      notes: "",
    });
  }

  const getCategoryConfig = (cat: string | null) => {
    return CATEGORY_OPTIONS.find((c) => c.value === cat) || CATEGORY_OPTIONS[3];
  };

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
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Kreditoren</h1>
            <p className="mt-1 text-sm text-[var(--secondary)]">
              Lieferanten, Dienstleister und andere Gläubiger verwalten
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Gesamt</p>
          <p className="text-2xl font-bold text-[var(--foreground)]">{creditors.length}</p>
        </div>
        {CATEGORY_OPTIONS.slice(0, 3).map((cat) => (
          <div key={cat.value} className="admin-card p-4">
            <p className="text-sm text-[var(--muted)]">{cat.label}</p>
            <p className="text-2xl font-bold text-[var(--foreground)]">
              {creditors.filter(c => c.category === cat.value).length}
            </p>
          </div>
        ))}
      </div>

      {/* Add/Edit Form */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          {formData.creditorId ? "Kreditor bearbeiten" : "Neuen Kreditor hinzufügen"}
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
                placeholder="z.B. Vodafone GmbH"
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
                placeholder="z.B. Vodafone"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Kategorie
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="input w-full"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                IBAN
              </label>
              <input
                type="text"
                value={formData.iban}
                onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                className="input w-full font-mono text-sm"
                placeholder="DE89 3704 0044 0532 0130 00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                USt-ID
              </label>
              <input
                type="text"
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                className="input w-full font-mono text-sm"
                placeholder="DE123456789"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Standard-Kostenart
              </label>
              <select
                value={formData.defaultCostCategoryId}
                onChange={(e) => setFormData({ ...formData, defaultCostCategoryId: e.target.value })}
                className="input w-full"
              >
                <option value="">Keine</option>
                {costCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--muted)] mt-1">
                Wird bei Bestellungen automatisch vorausgewählt
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Anmerkungen
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input w-full"
              rows={2}
              placeholder="Optionale Hinweise..."
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Speichern..." : formData.creditorId ? "Aktualisieren" : "Hinzufügen"}
            </button>
            {formData.creditorId && (
              <button type="button" onClick={resetForm} className="btn-secondary">
                Abbrechen
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Creditors Table */}
      <div className="admin-card">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Übersicht ({creditors.length})
          </h2>
        </div>
        {creditors.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Noch keine Kreditoren erfasst
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border)]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Name</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--secondary)] uppercase">Kategorie</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">IBAN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Kostenart</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--secondary)] uppercase">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {creditors.map((creditor) => {
                  const catConfig = getCategoryConfig(creditor.category);
                  return (
                    <tr key={creditor.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-[var(--foreground)]">{creditor.name}</div>
                        {creditor.shortName && (
                          <div className="text-xs text-[var(--muted)]">{creditor.shortName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${catConfig.color}`}>
                          {catConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-[var(--secondary)]">
                        {creditor.iban || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--secondary)]">
                        {creditor.defaultCostCategory?.name || "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => startEdit(creditor)}
                            className="p-1.5 text-[var(--secondary)] hover:text-[var(--primary)] hover:bg-gray-100 rounded"
                            title="Bearbeiten"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(creditor.id)}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
