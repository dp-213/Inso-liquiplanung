"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Customer {
  id: string;
  email: string;
  name: string;
  company: string | null;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  loginCount: number;
  createdAt: string;
  _count: {
    caseAccess: number;
  };
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [createdCustomerName, setCreatedCustomerName] = useState("");
  const [deleteCustomerId, setDeleteCustomerId] = useState<string | null>(null);
  const [deleteCustomerName, setDeleteCustomerName] = useState("");
  const [deleteInput, setDeleteInput] = useState("");

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/customers");
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error("Error fetching customers:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Fehler beim Erstellen");
      }

      setCreatedCustomerName(data.customer.name);
      setCreatedPassword(data.temporaryPassword);
      setFormData({ name: "", email: "", company: "", phone: "" });
      setShowForm(false);
      fetchCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Kunden wirklich deaktivieren? Alle Fallzugriffe werden widerrufen.")) return;

    try {
      const response = await fetch(`/api/customers/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchCustomers();
      }
    } catch (err) {
      console.error("Error deactivating customer:", err);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      const response = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });

      if (response.ok) {
        fetchCustomers();
      }
    } catch (err) {
      console.error("Error activating customer:", err);
    }
  };

  const handleResetPassword = async (id: string, name: string) => {
    if (!confirm(`Passwort fuer "${name}" wirklich zuruecksetzen?`)) return;

    try {
      const response = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetPassword: true }),
      });

      const data = await response.json();

      if (response.ok && data.temporaryPassword) {
        setCreatedCustomerName(name);
        setCreatedPassword(data.temporaryPassword);
      } else {
        alert("Fehler beim Zuruecksetzen des Passworts");
      }
    } catch (err) {
      console.error("Error resetting password:", err);
      alert("Fehler beim Zuruecksetzen des Passworts");
    }
  };

  const handlePermanentDelete = async () => {
    if (deleteInput !== "LOESCHEN" || !deleteCustomerId) return;

    setSaving(true);
    try {
      const response = await fetch(
        `/api/customers/${deleteCustomerId}?hardDelete=true&confirm=PERMANENTLY_DELETE`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setDeleteCustomerId(null);
        setDeleteCustomerName("");
        setDeleteInput("");
        fetchCustomers();
      } else {
        const data = await response.json();
        setError(data.error || "Fehler beim Loeschen");
      }
    } catch (err) {
      console.error("Error deleting customer:", err);
      setError("Netzwerkfehler beim Loeschen");
    } finally {
      setSaving(false);
    }
  };

  const activeCount = customers.filter((c) => c.isActive).length;
  const inactiveCount = customers.filter((c) => !c.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Kunden</h1>
          <p className="text-[var(--secondary)] mt-1">
            Verwalten Sie Kundenportal-Benutzer und deren Fallzugriffe
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          Neuen Kunden anlegen
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="admin-card p-4">
          <div className="text-2xl font-bold text-[var(--foreground)]">{customers.length}</div>
          <div className="text-sm text-[var(--muted)]">Gesamt</div>
        </div>
        <div className="admin-card p-4">
          <div className="text-2xl font-bold text-[var(--success)]">{activeCount}</div>
          <div className="text-sm text-[var(--muted)]">Aktiv</div>
        </div>
        <div className="admin-card p-4">
          <div className="text-2xl font-bold text-[var(--secondary)]">{inactiveCount}</div>
          <div className="text-sm text-[var(--muted)]">Inaktiv</div>
        </div>
      </div>

      {/* Password Modal */}
      {createdPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold">Neues Passwort</h2>
            </div>
            <p className="text-sm text-[var(--secondary)] mb-4">
              Neues Passwort fuer <strong>{createdCustomerName}</strong>:
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-yellow-800 mb-2">
                Temporaeres Passwort (nur einmal sichtbar):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white px-3 py-2 rounded border font-mono text-lg">
                  {createdPassword}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdPassword);
                  }}
                  className="btn-secondary text-sm"
                >
                  Kopieren
                </button>
              </div>
            </div>
            <p className="text-xs text-[var(--muted)] mb-4">
              Teilen Sie dieses Passwort sicher mit dem Kunden. Er kann sich damit unter /customer-login anmelden.
            </p>
            <button
              onClick={() => {
                setCreatedPassword(null);
                setCreatedCustomerName("");
              }}
              className="btn-primary w-full"
            >
              Verstanden
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCustomerId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-red-600 mb-4">Kunde permanent loeschen?</h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800 mb-2">
                <strong>Achtung:</strong> Diese Aktion kann nicht rueckgaengig gemacht werden!
              </p>
              <p className="text-sm text-red-700">
                Alle Daten von <strong>{deleteCustomerName}</strong> werden unwiderruflich geloescht.
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Geben Sie LOESCHEN ein, um zu bestaetigen:
              </label>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                className="input-field"
                placeholder="LOESCHEN"
              />
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 mb-4">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handlePermanentDelete}
                disabled={saving || deleteInput !== "LOESCHEN"}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg disabled:opacity-50"
              >
                {saving ? "Loeschen..." : "Permanent loeschen"}
              </button>
              <button
                onClick={() => {
                  setDeleteCustomerId(null);
                  setDeleteCustomerName("");
                  setDeleteInput("");
                  setError("");
                }}
                className="btn-secondary"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Customer Form */}
      {showForm && (
        <div className="admin-card p-6">
          <h2 className="text-lg font-semibold mb-4">Neuen Kunden anlegen</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="Max Mustermann"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  E-Mail-Adresse *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field"
                  placeholder="kunde@beispiel.de"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  Unternehmen
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="input-field"
                  placeholder="Firma GmbH"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  Telefon
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input-field"
                  placeholder="+49 123 456789"
                />
              </div>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Ein temporaeres Passwort wird automatisch generiert und nach der Erstellung angezeigt.
            </p>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Wird erstellt..." : "Kunde anlegen"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Customers Table */}
      <div className="admin-card">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Wird geladen...</div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Noch keine Kunden vorhanden. Legen Sie Ihren ersten Kunden an.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>E-Mail</th>
                <th>Unternehmen</th>
                <th>Status</th>
                <th>Faelle</th>
                <th>Letzter Login</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td className="font-medium text-[var(--foreground)]">{customer.name}</td>
                  <td className="text-[var(--secondary)]">{customer.email}</td>
                  <td className="text-[var(--secondary)]">{customer.company || "-"}</td>
                  <td>
                    <span
                      className={`badge ${customer.isActive ? "badge-success" : "badge-neutral"}`}
                    >
                      {customer.isActive ? "Aktiv" : "Inaktiv"}
                    </span>
                  </td>
                  <td className="text-[var(--foreground)]">{customer._count.caseAccess}</td>
                  <td className="text-[var(--muted)]">
                    {customer.lastLoginAt
                      ? new Date(customer.lastLoginAt).toLocaleDateString("de-DE")
                      : "Noch nie"}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className="btn-secondary text-xs py-1 px-2"
                      >
                        Details
                      </Link>
                      <button
                        onClick={() => handleResetPassword(customer.id, customer.name)}
                        className="text-xs py-1 px-2 text-[var(--primary)] hover:bg-blue-50 rounded"
                        title="Neues Passwort generieren"
                      >
                        Passwort
                      </button>
                      {customer.isActive ? (
                        <button
                          onClick={() => handleDeactivate(customer.id)}
                          className="text-xs py-1 px-2 text-[var(--danger)] hover:bg-red-50 rounded"
                        >
                          Deaktivieren
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(customer.id)}
                          className="text-xs py-1 px-2 text-[var(--success)] hover:bg-green-50 rounded"
                        >
                          Aktivieren
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setDeleteCustomerId(customer.id);
                          setDeleteCustomerName(customer.name);
                        }}
                        className="text-xs py-1 px-2 text-red-700 hover:bg-red-100 rounded font-medium"
                        title="Permanent loeschen"
                      >
                        Loeschen
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
