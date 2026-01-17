"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CaseAccess {
  id: string;
  caseId: string;
  accessLevel: string;
  grantedAt: string;
  grantedBy: string;
  expiresAt: string | null;
  isActive: boolean;
  revokedAt: string | null;
  revokedBy: string | null;
  lastAccessedAt: string | null;
  accessCount: number;
  case: {
    id: string;
    caseNumber: string;
    debtorName: string;
    status: string;
    project: { name: string };
  };
}

interface OwnedCase {
  id: string;
  caseNumber: string;
  debtorName: string;
  status: string;
  courtName: string;
  createdAt: string;
  plans: Array<{
    id: string;
    name: string;
    periodType: string;
    periodCount: number;
    planStartDate: string;
  }>;
}

interface Customer {
  id: string;
  email: string;
  name: string;
  company: string | null;
  phone: string | null;
  logoUrl: string | null;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  loginCount: number;
  failedLoginCount: number;
  lockedUntil: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  ownedCases: OwnedCase[];
  caseAccess: CaseAccess[];
}

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", company: "", phone: "", logoUrl: "" });
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  useEffect(() => {
    fetchCustomer();
  }, [id]);

  const fetchCustomer = async () => {
    try {
      const res = await fetch(`/api/customers/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCustomer(data);
        setEditForm({
          name: data.name,
          company: data.company || "",
          phone: data.phone || "",
          logoUrl: data.logoUrl || "",
        });
      } else if (res.status === 404) {
        setError("Kunde nicht gefunden");
      } else {
        setError("Fehler beim Laden des Kunden");
      }
    } catch (err) {
      console.error("Error fetching customer:", err);
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        const data = await res.json();
        setCustomer({ ...customer!, ...data.customer });
        setIsEditing(false);
      } else {
        const data = await res.json();
        setError(data.error || "Fehler beim Speichern");
      }
    } catch (err) {
      setError("Netzwerkfehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!confirm("Passwort wirklich zurücksetzen? Ein neues temporäres Passwort wird generiert.")) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetPassword: true }),
      });

      if (res.ok) {
        const data = await res.json();
        setNewPassword(data.temporaryPassword);
        fetchCustomer();
      } else {
        const data = await res.json();
        setError(data.error || "Fehler beim Zurücksetzen");
      }
    } catch (err) {
      setError("Netzwerkfehler");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    const action = customer?.isActive ? "deaktivieren" : "aktivieren";
    if (customer?.isActive && !confirm(`Kunden wirklich ${action}? Alle Fallzugriffe werden widerrufen.`)) return;

    setSaving(true);
    try {
      if (customer?.isActive) {
        await fetch(`/api/customers/${id}`, { method: "DELETE" });
      } else {
        await fetch(`/api/customers/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: true }),
        });
      }
      fetchCustomer();
    } catch (err) {
      setError(`Fehler beim ${action}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (deleteInput !== "LOESCHEN") {
      setError("Bitte geben Sie LOESCHEN ein, um zu bestätigen");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${id}?hardDelete=true&confirm=PERMANENTLY_DELETE`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/admin/customers");
      } else {
        const data = await res.json();
        setError(data.error || "Fehler beim Löschen");
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      setError("Netzwerkfehler beim Löschen");
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeAccess = async (accessId: string) => {
    if (!confirm("Zugang wirklich widerrufen?")) return;

    try {
      const access = customer?.caseAccess.find((a) => a.id === accessId);
      if (!access) return;

      const res = await fetch(`/api/cases/${access.caseId}/customers?accessId=${accessId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchCustomer();
      }
    } catch (err) {
      console.error("Error revoking access:", err);
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "PRELIMINARY": return "Vorläufig";
      case "OPENED": return "Eröffnet";
      case "CLOSED": return "Geschlossen";
      default: return status;
    }
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case "PRELIMINARY": return "badge-warning";
      case "OPENED": return "badge-success";
      case "CLOSED": return "badge-neutral";
      default: return "badge-info";
    }
  };

  const getAccessLevelLabel = (level: string): string => {
    switch (level) {
      case "VIEW": return "Ansicht";
      case "COMMENT": return "Kommentieren";
      case "DOWNLOAD": return "Herunterladen";
      default: return level;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (error && !customer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center text-sm text-[var(--muted)]">
          <Link href="/admin/customers" className="hover:text-[var(--primary)]">Kunden</Link>
          <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-[var(--foreground)]">Fehler</span>
        </div>
        <div className="admin-card p-8 text-center">
          <p className="text-[var(--danger)]">{error}</p>
          <Link href="/admin/customers" className="btn-secondary mt-4 inline-block">
            Zurück zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  if (!customer) return null;

  const activeAccess = customer.caseAccess.filter((a) => a.isActive);
  const revokedAccess = customer.caseAccess.filter((a) => !a.isActive);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-[var(--muted)]">
        <Link href="/admin/customers" className="hover:text-[var(--primary)]">Kunden</Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[var(--foreground)]">{customer.name}</span>
      </div>

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-red-600 mb-4">Kunde permanent löschen?</h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800 mb-2">
                <strong>Achtung:</strong> Diese Aktion kann nicht rückgängig gemacht werden!
              </p>
              <p className="text-sm text-red-700">
                Alle Daten dieses Kunden werden unwiderruflich gelöscht.
              </p>
              {customer.ownedCases.length > 0 && (
                <p className="text-sm text-red-800 mt-2 font-medium">
                  Dieser Kunde besitzt noch {customer.ownedCases.length} Fall/Fälle. Diese müssen zuerst gelöscht oder einem anderen Kunden zugewiesen werden.
                </p>
              )}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Geben Sie LOESCHEN ein, um zu bestätigen:
              </label>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                className="input-field"
                placeholder="LOESCHEN"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePermanentDelete}
                disabled={saving || deleteInput !== "LOESCHEN" || customer.ownedCases.length > 0}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg disabled:opacity-50"
              >
                {saving ? "Löschen..." : "Permanent löschen"}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteInput("");
                }}
                className="btn-secondary"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {newPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">Neues Passwort</h2>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-yellow-800 mb-2">
                Temporäres Passwort (nur einmal sichtbar):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white px-3 py-2 rounded border font-mono text-lg">
                  {newPassword}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(newPassword)}
                  className="btn-secondary text-sm"
                >
                  Kopieren
                </button>
              </div>
            </div>
            <button onClick={() => setNewPassword(null)} className="btn-primary w-full">
              Verstanden
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Customer Header */}
      <div className="admin-card p-6">
        {isEditing ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Kunde bearbeiten</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Unternehmen</label>
                <input
                  type="text"
                  value={editForm.company}
                  onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Telefon</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Logo URL</label>
                <input
                  type="url"
                  value={editForm.logoUrl}
                  onChange={(e) => setEditForm({ ...editForm, logoUrl: e.target.value })}
                  className="input-field"
                  placeholder="https://..."
                />
                <p className="text-xs text-[var(--muted)] mt-1">URL zum Kundenlogo (wird im Portal angezeigt)</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? "Speichern..." : "Speichern"}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditForm({
                    name: customer.name,
                    company: customer.company || "",
                    phone: customer.phone || "",
                    logoUrl: customer.logoUrl || "",
                  });
                }}
                className="btn-secondary"
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-[var(--foreground)]">{customer.name}</h1>
                <span className={`badge ${customer.isActive ? "badge-success" : "badge-neutral"}`}>
                  {customer.isActive ? "Aktiv" : "Inaktiv"}
                </span>
                {customer.lockedUntil && new Date(customer.lockedUntil) > new Date() && (
                  <span className="badge badge-danger">Gesperrt</span>
                )}
              </div>
              <div className="mt-2 space-y-1 text-sm text-[var(--secondary)]">
                <p>E-Mail: {customer.email}</p>
                {customer.company && <p>Unternehmen: {customer.company}</p>}
                {customer.phone && <p>Telefon: {customer.phone}</p>}
              </div>
              <div className="mt-2 text-sm text-[var(--muted)]">
                Erstellt: {new Date(customer.createdAt).toLocaleDateString("de-DE")} von {customer.createdBy}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setIsEditing(true)} className="btn-secondary">Bearbeiten</button>
              <button onClick={handleResetPassword} disabled={saving} className="btn-secondary">
                Passwort zurücksetzen
              </button>
              <button
                onClick={handleToggleActive}
                disabled={saving}
                className={`btn-secondary ${customer.isActive ? "text-[var(--danger)]" : "text-[var(--success)]"}`}
              >
                {customer.isActive ? "Deaktivieren" : "Aktivieren"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving}
                className="btn-secondary text-red-600 hover:bg-red-50"
              >
                Permanent löschen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Aktive Fallzugriffe</p>
          <p className="text-2xl font-bold text-[var(--foreground)]">{activeAccess.length}</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Logins gesamt</p>
          <p className="text-2xl font-bold text-[var(--foreground)]">{customer.loginCount}</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Letzter Login</p>
          <p className="text-lg font-bold text-[var(--foreground)]">
            {customer.lastLoginAt
              ? new Date(customer.lastLoginAt).toLocaleDateString("de-DE")
              : "Noch nie"}
          </p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Fehlversuche</p>
          <p className={`text-2xl font-bold ${customer.failedLoginCount > 0 ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>
            {customer.failedLoginCount}
          </p>
        </div>
      </div>

      {/* Owned Cases */}
      <div className="admin-card">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Eigene Fälle ({customer.ownedCases.length})</h2>
        </div>

        {customer.ownedCases.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Dieser Kunde besitzt keine Fälle.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Fall</th>
                <th>Gericht</th>
                <th>Status</th>
                <th>Plantyp</th>
                <th>Perioden</th>
                <th>Erstellt</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {customer.ownedCases.map((ownedCase) => {
                const plan = ownedCase.plans[0];
                return (
                  <tr key={ownedCase.id}>
                    <td>
                      <Link
                        href={`/admin/cases/${ownedCase.id}`}
                        className="font-medium text-[var(--foreground)] hover:text-[var(--primary)]"
                      >
                        {ownedCase.debtorName}
                      </Link>
                      <div className="text-xs text-[var(--muted)]">{ownedCase.caseNumber}</div>
                    </td>
                    <td className="text-[var(--secondary)]">{ownedCase.courtName}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(ownedCase.status)}`}>
                        {getStatusLabel(ownedCase.status)}
                      </span>
                    </td>
                    <td className="text-[var(--secondary)]">
                      {plan ? (plan.periodType === "WEEKLY" ? "Wöchentlich" : "Monatlich") : "-"}
                    </td>
                    <td className="text-[var(--secondary)]">
                      {plan ? `${plan.periodCount} ${plan.periodType === "WEEKLY" ? "Wochen" : "Monate"}` : "-"}
                    </td>
                    <td className="text-sm text-[var(--muted)]">
                      {new Date(ownedCase.createdAt).toLocaleDateString("de-DE")}
                    </td>
                    <td>
                      <Link
                        href={`/admin/cases/${ownedCase.id}/dashboard`}
                        className="text-xs text-[var(--primary)] hover:underline"
                      >
                        Dashboard
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Active Case Access */}
      <div className="admin-card">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Zusaetzliche Fallzugriffe</h2>
          <p className="text-sm text-[var(--muted)]">Zugriffe auf Fälle anderer Kunden</p>
        </div>

        {activeAccess.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Keine aktiven Fallzugriffe. Weisen Sie Fälle ueber die Falldetailseite zu.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Fall</th>
                <th>Projekt</th>
                <th>Status</th>
                <th>Zugriffslevel</th>
                <th>Erteilt am</th>
                <th>Laeuft ab</th>
                <th>Letzter Zugriff</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activeAccess.map((access) => (
                <tr key={access.id}>
                  <td>
                    <Link
                      href={`/admin/cases/${access.case.id}`}
                      className="font-medium text-[var(--foreground)] hover:text-[var(--primary)]"
                    >
                      {access.case.debtorName}
                    </Link>
                    <div className="text-xs text-[var(--muted)]">{access.case.caseNumber}</div>
                  </td>
                  <td className="text-[var(--secondary)]">{access.case.project.name}</td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(access.case.status)}`}>
                      {getStatusLabel(access.case.status)}
                    </span>
                  </td>
                  <td className="text-[var(--secondary)]">{getAccessLevelLabel(access.accessLevel)}</td>
                  <td className="text-sm text-[var(--muted)]">
                    {new Date(access.grantedAt).toLocaleDateString("de-DE")}
                  </td>
                  <td className="text-sm text-[var(--muted)]">
                    {access.expiresAt ? new Date(access.expiresAt).toLocaleDateString("de-DE") : "-"}
                  </td>
                  <td className="text-sm text-[var(--muted)]">
                    {access.lastAccessedAt
                      ? new Date(access.lastAccessedAt).toLocaleDateString("de-DE")
                      : "Noch nie"}
                    {access.accessCount > 0 && ` (${access.accessCount}x)`}
                  </td>
                  <td>
                    <button
                      onClick={() => handleRevokeAccess(access.id)}
                      className="text-xs text-[var(--danger)] hover:bg-red-50 py-1 px-2 rounded"
                    >
                      Widerrufen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Revoked Access History */}
      {revokedAccess.length > 0 && (
        <div className="admin-card">
          <details>
            <summary className="px-6 py-4 cursor-pointer text-[var(--secondary)] hover:text-[var(--foreground)]">
              Widerrufene Zugriffe ({revokedAccess.length})
            </summary>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fall</th>
                  <th>Widerrufen am</th>
                  <th>Widerrufen von</th>
                </tr>
              </thead>
              <tbody>
                {revokedAccess.map((access) => (
                  <tr key={access.id} className="opacity-60">
                    <td>{access.case.debtorName}</td>
                    <td className="text-sm text-[var(--muted)]">
                      {access.revokedAt ? new Date(access.revokedAt).toLocaleDateString("de-DE") : "-"}
                    </td>
                    <td className="text-sm text-[var(--muted)]">{access.revokedBy || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}
    </div>
  );
}
