"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface CaseWithRelations {
  id: string;
  caseNumber: string;
  debtorName: string;
  status: string;
  updatedAt: string;
  owner: { id: string; name: string; email: string; company: string | null };
  plans: {
    periodType: string | null;
    periodCount: number | null;
    versions: { versionNumber: number }[];
  }[];
  shareLinks: { id: string }[];
}

export default function CasesListPage() {
  const [cases, setCases] = useState<CaseWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteCaseId, setDeleteCaseId] = useState<string | null>(null);
  const [deleteCaseName, setDeleteCaseName] = useState("");
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      const response = await fetch("/api/cases");
      if (response.ok) {
        const data = await response.json();
        setCases(data);
      } else {
        setError("Fehler beim Laden der Fälle");
      }
    } catch (err) {
      console.error("Error fetching cases:", err);
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (deleteInput !== "LÖSCHEN" || !deleteCaseId) return;

    setDeleting(true);
    try {
      const response = await fetch(
        `/api/cases/${deleteCaseId}?hardDelete=true&confirm=PERMANENTLY_DELETE`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setDeleteCaseId(null);
        setDeleteCaseName("");
        setDeleteInput("");
        fetchCases();
      } else {
        const data = await response.json();
        setError(data.error || "Fehler beim Löschen");
      }
    } catch (err) {
      console.error("Error deleting case:", err);
      setError("Netzwerkfehler beim Löschen");
    } finally {
      setDeleting(false);
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "PRELIMINARY":
        return "Vorläufig";
      case "OPENED":
        return "Eröffnet";
      case "CLOSED":
        return "Geschlossen";
      default:
        return status;
    }
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case "PRELIMINARY":
        return "badge-warning";
      case "OPENED":
        return "badge-success";
      case "CLOSED":
        return "badge-neutral";
      default:
        return "badge-info";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Fälle</h1>
          <p className="text-[var(--secondary)] mt-1">
            Alle Insolvenzverfahren verwalten
          </p>
        </div>
        <Link href="/admin/cases/new" className="btn-primary">
          Neuen Fall anlegen
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-600 mt-1 hover:underline"
          >
            Schließen
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCaseId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-red-600 mb-4">
              Fall permanent löschen?
            </h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800 mb-2">
                <strong>Achtung:</strong> Diese Aktion kann nicht rückgängig
                gemacht werden!
              </p>
              <p className="text-sm text-red-700">
                Alle Daten von <strong>{deleteCaseName}</strong> werden
                unwiderruflich gelöscht:
              </p>
              <ul className="text-sm text-red-700 mt-2 list-disc list-inside">
                <li>Liquiditätspläne und Versionen</li>
                <li>Kategorien und Zeilen</li>
                <li>Alle Periodenwerte</li>
                <li>Konfigurationen und Share-Links</li>
              </ul>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Geben Sie LÖSCHEN ein, um zu bestätigen:
              </label>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                className="input-field"
                placeholder="LÖSCHEN"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePermanentDelete}
                disabled={deleting || deleteInput !== "LÖSCHEN"}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg disabled:opacity-50"
              >
                {deleting ? "Löschen..." : "Permanent löschen"}
              </button>
              <button
                onClick={() => {
                  setDeleteCaseId(null);
                  setDeleteCaseName("");
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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Gesamt</p>
          <p className="text-2xl font-bold text-[var(--foreground)]">
            {cases.length}
          </p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Eröffnet</p>
          <p className="text-2xl font-bold text-[var(--success)]">
            {cases.filter((c) => c.status === "OPENED").length}
          </p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Vorläufig</p>
          <p className="text-2xl font-bold text-[var(--warning)]">
            {cases.filter((c) => c.status === "PRELIMINARY").length}
          </p>
        </div>
      </div>

      {/* Cases Table */}
      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Schuldner</th>
              <th>Aktenzeichen</th>
              <th>Kunde</th>
              <th>Status</th>
              <th>Planungsart</th>
              <th>Freigaben</th>
              <th>Aktualisiert</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((caseItem) => {
              const activePlan = caseItem.plans[0];
              const latestVersion = activePlan?.versions[0];
              const activeShareLinks = caseItem.shareLinks.length;

              return (
                <tr key={caseItem.id}>
                  <td>
                    <Link
                      href={`/admin/cases/${caseItem.id}`}
                      className="font-medium text-[var(--foreground)] hover:text-[var(--primary)]"
                    >
                      {caseItem.debtorName}
                    </Link>
                  </td>
                  <td className="text-[var(--secondary)]">
                    {caseItem.caseNumber}
                  </td>
                  <td>
                    <Link
                      href={`/admin/customers/${caseItem.owner.id}`}
                      className="text-[var(--secondary)] hover:text-[var(--primary)]"
                    >
                      {caseItem.owner.name}
                      {caseItem.owner.company && (
                        <span className="text-xs text-[var(--muted)] ml-1">
                          ({caseItem.owner.company})
                        </span>
                      )}
                    </Link>
                  </td>
                  <td>
                    <span
                      className={`badge ${getStatusBadgeClass(caseItem.status)}`}
                    >
                      {getStatusLabel(caseItem.status)}
                    </span>
                  </td>
                  <td>
                    {activePlan ? (
                      <div className="text-sm">
                        <span className="text-[var(--foreground)]">
                          {activePlan.periodCount || 13}{" "}
                          {(activePlan.periodType || "WEEKLY") === "MONTHLY"
                            ? "Monate"
                            : "Wochen"}
                        </span>
                        <span className="text-[var(--muted)] ml-1 text-xs">
                          (v{latestVersion?.versionNumber || 0})
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-[var(--muted)]">-</span>
                    )}
                  </td>
                  <td>
                    {activeShareLinks > 0 ? (
                      <span className="badge badge-info">
                        {activeShareLinks} aktiv
                      </span>
                    ) : (
                      <span className="text-sm text-[var(--muted)]">-</span>
                    )}
                  </td>
                  <td className="text-sm text-[var(--muted)]">
                    {new Date(caseItem.updatedAt).toLocaleDateString("de-DE")}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/cases/${caseItem.id}`}
                        className="text-xs py-1 px-2 text-[var(--primary)] hover:bg-blue-50 rounded"
                      >
                        Öffnen
                      </Link>
                      <button
                        onClick={() => {
                          setDeleteCaseId(caseItem.id);
                          setDeleteCaseName(caseItem.debtorName);
                        }}
                        className="text-xs py-1 px-2 text-[var(--danger)] hover:bg-red-50 rounded"
                        title="Permanent löschen"
                      >
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {cases.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-[var(--muted)]">
                  Keine Fälle vorhanden. Erstellen Sie Ihren ersten Fall.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
