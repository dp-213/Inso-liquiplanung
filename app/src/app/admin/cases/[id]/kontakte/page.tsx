"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTableControls } from "@/hooks/useTableControls";
import { TableToolbar, SortableHeader } from "@/components/admin/TableToolbar";

interface CaseContact {
  id: string;
  role: string;
  name: string;
  organization: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  displayOrder: number;
}

const ROLE_OPTIONS = [
  { value: "IV", label: "Insolvenzverwalter", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "BERATER", label: "Berater", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  { value: "BUCHHALTUNG", label: "Buchhaltung", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  { value: "RECHTSANWALT", label: "Rechtsanwalt", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  { value: "GESCHAEFTSFUEHRUNG", label: "Geschäftsführung", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
  { value: "SONSTIGE", label: "Sonstige", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" },
];

export default function KontaktePage() {
  const params = useParams();
  const caseId = params.id as string;

  const [contacts, setContacts] = useState<CaseContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    contactId: null as string | null,
    role: "SONSTIGE",
    name: "",
    organization: "",
    email: "",
    phone: "",
    notes: "",
    displayOrder: 0,
  });

  useEffect(() => {
    fetchData();
  }, [caseId]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/cases/${caseId}/contacts`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
      }
    } catch {
      setError("Fehler beim Laden der Kontakte");
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
      const method = formData.contactId ? "PUT" : "POST";
      const url = formData.contactId
        ? `/api/cases/${caseId}/contacts/${formData.contactId}`
        : `/api/cases/${caseId}/contacts`;

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: formData.role,
          name: formData.name,
          organization: formData.organization || null,
          email: formData.email || null,
          phone: formData.phone || null,
          notes: formData.notes || null,
          displayOrder: formData.displayOrder,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Speichern");
      }

      setSuccess(formData.contactId ? "Kontakt aktualisiert" : "Kontakt angelegt");
      resetForm();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(contactId: string, name: string) {
    if (!confirm(`Kontakt "${name}" wirklich löschen?`)) return;

    try {
      const res = await fetch(`/api/cases/${caseId}/contacts/${contactId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Löschen");
      }

      setSuccess("Kontakt gelöscht");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  }

  function startEdit(contact: CaseContact) {
    setFormData({
      contactId: contact.id,
      role: contact.role,
      name: contact.name,
      organization: contact.organization || "",
      email: contact.email || "",
      phone: contact.phone || "",
      notes: contact.notes || "",
      displayOrder: contact.displayOrder,
    });
  }

  function resetForm() {
    setFormData({
      contactId: null,
      role: "SONSTIGE",
      name: "",
      organization: "",
      email: "",
      phone: "",
      notes: "",
      displayOrder: 0,
    });
  }

  const { search, setSearch, sortKey, sortDir, toggleSort, result } = useTableControls(contacts, {
    searchFields: ["name", "organization", "role", "email", "phone"],
    defaultSort: { key: "displayOrder", dir: "asc" },
  });

  const getRoleConfig = (role: string) => {
    return ROLE_OPTIONS.find((r) => r.value === role) || ROLE_OPTIONS[ROLE_OPTIONS.length - 1];
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
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Kontakte</h1>
        <p className="mt-1 text-sm text-[var(--secondary)]">
          Ansprechpartner für diesen Fall (IV, Berater, Buchhaltung, etc.)
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="float-right font-bold">&times;</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg">
          {success}
          <button onClick={() => setSuccess(null)} className="float-right font-bold">&times;</button>
        </div>
      )}

      {/* Add/Edit Form */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          {formData.contactId ? "Kontakt bearbeiten" : "Neuer Kontakt"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Rolle *</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="input w-full"
                required
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input w-full"
                placeholder="z.B. Sarah Wolf"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Organisation</label>
              <input
                type="text"
                value={formData.organization}
                onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                className="input w-full"
                placeholder="z.B. Anchor Rechtsanwälte"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">E-Mail</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input w-full"
                placeholder="email@beispiel.de"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Telefon</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="input w-full"
                placeholder="+49 ..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Reihenfolge</label>
              <input
                type="number"
                value={formData.displayOrder}
                onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                className="input w-full"
                min={0}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Notizen</label>
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
              {saving ? "Speichern..." : formData.contactId ? "Aktualisieren" : "Hinzufügen"}
            </button>
            {formData.contactId && (
              <button type="button" onClick={resetForm} className="btn-secondary">
                Abbrechen
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Contacts Table */}
      <div className="admin-card">
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          resultCount={result.length}
          totalCount={contacts.length}
        />
        {result.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            {contacts.length === 0 ? "Noch keine Kontakte erfasst" : "Keine Treffer"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border)]">
              <thead>
                <tr>
                  <SortableHeader label="Rolle" sortKey="role" currentSortKey={sortKey as string} currentSortDir={sortDir} onToggle={(k) => toggleSort(k as keyof CaseContact)} className="px-4 py-3 text-center text-xs font-semibold text-[var(--secondary)] uppercase" />
                  <SortableHeader label="Name" sortKey="name" currentSortKey={sortKey as string} currentSortDir={sortDir} onToggle={(k) => toggleSort(k as keyof CaseContact)} />
                  <SortableHeader label="Organisation" sortKey="organization" currentSortKey={sortKey as string} currentSortDir={sortDir} onToggle={(k) => toggleSort(k as keyof CaseContact)} />
                  <SortableHeader label="E-Mail" sortKey="email" currentSortKey={sortKey as string} currentSortDir={sortDir} onToggle={(k) => toggleSort(k as keyof CaseContact)} />
                  <SortableHeader label="Telefon" sortKey="phone" currentSortKey={sortKey as string} currentSortDir={sortDir} onToggle={(k) => toggleSort(k as keyof CaseContact)} />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Notizen</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--secondary)] uppercase">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {result.map((contact) => {
                  const roleConfig = getRoleConfig(contact.role);
                  return (
                    <tr key={contact.id} className="hover:bg-[var(--accent)]">
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${roleConfig.color}`}>
                          {roleConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-[var(--foreground)]">
                        {contact.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--secondary)]">
                        {contact.organization || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--secondary)]">
                        {contact.email ? (
                          <a href={`mailto:${contact.email}`} className="text-[var(--primary)] hover:underline">
                            {contact.email}
                          </a>
                        ) : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--secondary)]">
                        {contact.phone ? (
                          <a href={`tel:${contact.phone}`} className="text-[var(--primary)] hover:underline">
                            {contact.phone}
                          </a>
                        ) : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--muted)] max-w-xs truncate">
                        {contact.notes || "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => startEdit(contact)}
                            className="p-1.5 text-[var(--secondary)] hover:text-[var(--primary)] hover:bg-[var(--accent)] rounded"
                            title="Bearbeiten"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(contact.id, contact.name)}
                            className="p-1.5 text-[var(--secondary)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
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
