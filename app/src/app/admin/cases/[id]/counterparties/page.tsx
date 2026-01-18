"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Counterparty {
  id: string;
  name: string;
  shortName: string | null;
  type: string | null;
  matchPattern: string | null;
  isTopPayer: boolean;
  notes: string | null;
  displayOrder: number;
}

const TYPE_OPTIONS = [
  { value: "PAYER", label: "Zahler", color: "bg-green-100 text-green-700" },
  { value: "SUPPLIER", label: "Lieferant", color: "bg-blue-100 text-blue-700" },
  { value: "AUTHORITY", label: "Behörde", color: "bg-purple-100 text-purple-700" },
  { value: "OTHER", label: "Sonstige", color: "bg-gray-100 text-gray-700" },
];

export default function CounterpartiesPage() {
  const params = useParams();
  const caseId = params.id as string;

  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    counterpartyId: null as string | null,
    name: "",
    shortName: "",
    type: "OTHER",
    matchPattern: "",
    isTopPayer: false,
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, [caseId]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/cases/${caseId}/counterparties`);
      if (res.ok) {
        const data = await res.json();
        setCounterparties(data.counterparties || []);
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
      const method = formData.counterpartyId ? "PUT" : "POST";
      const url = formData.counterpartyId
        ? `/api/cases/${caseId}/counterparties/${formData.counterpartyId}`
        : `/api/cases/${caseId}/counterparties`;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          shortName: formData.shortName || null,
          type: formData.type || null,
          matchPattern: formData.matchPattern || null,
          isTopPayer: formData.isTopPayer,
          notes: formData.notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Speichern");
      }

      setSuccess("Gegenpartei gespeichert");
      resetForm();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(counterpartyId: string) {
    if (!confirm("Gegenpartei wirklich löschen?")) return;

    try {
      const res = await fetch(`/api/cases/${caseId}/counterparties/${counterpartyId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Löschen");
      }

      setSuccess("Gegenpartei gelöscht");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  }

  function startEdit(counterparty: Counterparty) {
    setFormData({
      counterpartyId: counterparty.id,
      name: counterparty.name,
      shortName: counterparty.shortName || "",
      type: counterparty.type || "OTHER",
      matchPattern: counterparty.matchPattern || "",
      isTopPayer: counterparty.isTopPayer,
      notes: counterparty.notes || "",
    });
  }

  function resetForm() {
    setFormData({
      counterpartyId: null,
      name: "",
      shortName: "",
      type: "OTHER",
      matchPattern: "",
      isTopPayer: false,
      notes: "",
    });
  }

  const getTypeConfig = (type: string | null) => {
    return TYPE_OPTIONS.find((t) => t.value === type) || TYPE_OPTIONS[3];
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
        <span className="text-[var(--foreground)]">Gegenparteien</span>
      </div>

      {/* Header */}
      <div className="admin-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Gegenparteien</h1>
            <p className="mt-1 text-sm text-[var(--secondary)]">
              Zahler, Lieferanten und andere Geschäftspartner verwalten
            </p>
          </div>
          <Link href={`/admin/cases/${caseId}`} className="btn-secondary">
            Zurück zum Fall
          </Link>
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
          <p className="text-2xl font-bold text-[var(--foreground)]">{counterparties.length}</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Zahler</p>
          <p className="text-2xl font-bold text-green-600">
            {counterparties.filter(c => c.type === "PAYER").length}
          </p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Top-Zahler</p>
          <p className="text-2xl font-bold text-blue-600">
            {counterparties.filter(c => c.isTopPayer).length}
          </p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Lieferanten</p>
          <p className="text-2xl font-bold text-purple-600">
            {counterparties.filter(c => c.type === "SUPPLIER").length}
          </p>
        </div>
      </div>

      {/* Add/Edit Form */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          {formData.counterpartyId ? "Gegenpartei bearbeiten" : "Neue Gegenpartei hinzufügen"}
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
                placeholder="z.B. HAEVG Rechenzentrum"
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
                placeholder="z.B. HAEVG"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Typ
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="input w-full"
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Match-Pattern
              </label>
              <input
                type="text"
                value={formData.matchPattern}
                onChange={(e) => setFormData({ ...formData, matchPattern: e.target.value })}
                className="input w-full font-mono text-sm"
                placeholder="z.B. HAEVG|Rechenzentrum"
              />
              <p className="text-xs text-[var(--muted)] mt-1">
                Regex-Pattern für automatisches Matching in Buchungstexten
              </p>
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isTopPayer}
                  onChange={(e) => setFormData({ ...formData, isTopPayer: e.target.checked })}
                  className="w-5 h-5 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <span className="text-sm text-[var(--foreground)]">
                  Top-Zahler (separat in Auswertungen ausweisen)
                </span>
              </label>
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
              {saving ? "Speichern..." : formData.counterpartyId ? "Aktualisieren" : "Hinzufügen"}
            </button>
            {formData.counterpartyId && (
              <button type="button" onClick={resetForm} className="btn-secondary">
                Abbrechen
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Counterparties Table */}
      <div className="admin-card">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Übersicht ({counterparties.length})
          </h2>
        </div>
        {counterparties.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Noch keine Gegenparteien erfasst
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border)]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Kurzname</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--secondary)] uppercase">Typ</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Match-Pattern</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--secondary)] uppercase">Top-Zahler</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--secondary)] uppercase">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {counterparties.map((counterparty) => {
                  const typeConfig = getTypeConfig(counterparty.type);
                  return (
                    <tr key={counterparty.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-[var(--foreground)]">{counterparty.name}</td>
                      <td className="px-4 py-3 text-sm text-[var(--secondary)]">{counterparty.shortName || "-"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${typeConfig.color}`}>
                          {typeConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-[var(--secondary)]">
                        {counterparty.matchPattern || "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {counterparty.isTopPayer && (
                          <svg className="w-5 h-5 text-blue-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => startEdit(counterparty)}
                            className="p-1.5 text-[var(--secondary)] hover:text-[var(--primary)] hover:bg-gray-100 rounded"
                            title="Bearbeiten"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(counterparty.id)}
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
