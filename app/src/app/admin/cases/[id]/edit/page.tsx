"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PlanData {
  id: string;
  name: string;
  periodType: string;
  periodCount: number;
  planStartDate: string;
  description: string | null;
}

interface CaseData {
  id: string;
  caseNumber: string;
  debtorName: string;
  courtName: string;
  filingDate: string;
  openingDate: string | null;
  cutoffDate: string | null;  // Stichtag für Alt/Neu-Masse
  status: string;
  owner: { id: string; name: string; email: string };
  plans: Array<{
    id: string;
    name: string;
    periodType: string;
    periodCount: number;
    planStartDate: string;
    description: string | null;
    isActive: boolean;
  }>;
}


export default function CaseEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    caseNumber: "",
    debtorName: "",
    courtName: "",
    filingDate: "",
    openingDate: "",
    cutoffDate: "",  // Stichtag für Alt/Neu-Masse
    status: "",
  });
  const [planFormData, setPlanFormData] = useState({
    name: "",
    periodType: "WEEKLY",
    periodCount: 13,
    planStartDate: "",
    description: "",
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const caseRes = await fetch(`/api/cases/${id}`);

      if (caseRes.ok) {
        const data = await caseRes.json();
        setCaseData(data);
        setFormData({
          caseNumber: data.caseNumber,
          debtorName: data.debtorName,
          courtName: data.courtName,
          filingDate: data.filingDate
            ? new Date(data.filingDate).toISOString().split("T")[0]
            : "",
          openingDate: data.openingDate
            ? new Date(data.openingDate).toISOString().split("T")[0]
            : "",
          cutoffDate: data.cutoffDate
            ? new Date(data.cutoffDate).toISOString().split("T")[0]
            : "",
          status: data.status,
        });
        // Set plan data if active plan exists
        const activePlan = data.plans?.find((p: { isActive: boolean }) => p.isActive);
        if (activePlan) {
          setPlanFormData({
            name: activePlan.name || "",
            periodType: activePlan.periodType || "WEEKLY",
            periodCount: activePlan.periodCount || 13,
            planStartDate: activePlan.planStartDate
              ? new Date(activePlan.planStartDate).toISOString().split("T")[0]
              : "",
            description: activePlan.description || "",
          });
        }
      } else {
        setError("Fall nicht gefunden");
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Save case data
      const caseRes = await fetch(`/api/cases/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseNumber: formData.caseNumber,
          debtorName: formData.debtorName,
          courtName: formData.courtName,
          filingDate: formData.filingDate,
          openingDate: formData.openingDate || null,
          cutoffDate: formData.cutoffDate || null,
          status: formData.status,
        }),
      });

      if (!caseRes.ok) {
        const data = await caseRes.json();
        setError(data.error || "Fehler beim Speichern");
        return;
      }

      // Save plan settings
      const planRes = await fetch(`/api/cases/${id}/plan/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: planFormData.name,
          periodType: planFormData.periodType,
          periodCount: planFormData.periodCount,
          planStartDate: planFormData.planStartDate,
          description: planFormData.description || null,
        }),
      });

      if (!planRes.ok) {
        const data = await planRes.json();
        setError(data.error || "Fehler beim Speichern der Planeinstellungen");
        return;
      }

      router.push(`/admin/cases/${id}`);
    } catch (err) {
      setError("Netzwerkfehler beim Speichern");
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
      const res = await fetch(`/api/cases/${id}?hardDelete=true&confirm=PERMANENTLY_DELETE`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/admin/cases");
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <p className="text-[var(--danger)]">
            {error || "Fall nicht gefunden"}
          </p>
          <Link href="/admin/cases" className="btn-secondary mt-4 inline-block">
            Zurück zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-[var(--muted)]">
        <Link href="/admin/cases" className="hover:text-[var(--primary)]">
          Fälle
        </Link>
        <svg
          className="w-4 h-4 mx-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        <Link
          href={`/admin/cases/${id}`}
          className="hover:text-[var(--primary)]"
        >
          {caseData.debtorName}
        </Link>
        <svg
          className="w-4 h-4 mx-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        <span className="text-[var(--foreground)]">Bearbeiten</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Fall bearbeiten
          </h1>
          <p className="text-[var(--secondary)] mt-1">
            {caseData.caseNumber} - {caseData.debtorName}
          </p>
        </div>
        <Link href={`/admin/cases/${id}`} className="btn-secondary">
          Abbrechen
        </Link>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="admin-card p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label
              htmlFor="caseNumber"
              className="block text-sm font-medium text-[var(--foreground)] mb-2"
            >
              Aktenzeichen *
            </label>
            <input
              type="text"
              id="caseNumber"
              name="caseNumber"
              value={formData.caseNumber}
              onChange={handleChange}
              required
              className="input-field"
            />
          </div>

          <div>
            <label
              htmlFor="debtorName"
              className="block text-sm font-medium text-[var(--foreground)] mb-2"
            >
              Schuldner *
            </label>
            <input
              type="text"
              id="debtorName"
              name="debtorName"
              value={formData.debtorName}
              onChange={handleChange}
              required
              className="input-field"
            />
          </div>

          <div>
            <label
              htmlFor="courtName"
              className="block text-sm font-medium text-[var(--foreground)] mb-2"
            >
              Gericht *
            </label>
            <input
              type="text"
              id="courtName"
              name="courtName"
              value={formData.courtName}
              onChange={handleChange}
              required
              className="input-field"
            />
          </div>

          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium text-[var(--foreground)] mb-2"
            >
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="input-field"
            >
              <option value="PRELIMINARY">Vorläufig</option>
              <option value="OPENED">Eröffnet</option>
              <option value="CLOSED">Geschlossen</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="filingDate"
              className="block text-sm font-medium text-[var(--foreground)] mb-2"
            >
              Antragsdatum *
            </label>
            <input
              type="date"
              id="filingDate"
              name="filingDate"
              value={formData.filingDate}
              onChange={handleChange}
              required
              className="input-field"
            />
          </div>

          <div>
            <label
              htmlFor="openingDate"
              className="block text-sm font-medium text-[var(--foreground)] mb-2"
            >
              Eröffnungsdatum
            </label>
            <input
              type="date"
              id="openingDate"
              name="openingDate"
              value={formData.openingDate}
              onChange={handleChange}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Eigentümer (Kunde)
            </label>
            <input
              type="text"
              value={caseData.owner?.name || "Kein Kunde zugewiesen"}
              disabled
              className="input-field bg-gray-100 cursor-not-allowed"
            />
            <p className="text-xs text-[var(--muted)] mt-1">
              {caseData.owner?.email || ""}
            </p>
          </div>
        </div>

        {/* Insolvency Settings Section */}
        <div className="pt-6 border-t border-[var(--border)]">
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Insolvenz-Einstellungen</h3>
          <p className="text-sm text-[var(--muted)] mb-4">
            Diese Einstellungen steuern die automatische Alt-/Neumasse-Zuordnung beim Datenimport.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="cutoffDate"
                className="block text-sm font-medium text-[var(--foreground)] mb-2"
              >
                Stichtag (Alt-/Neumasse)
              </label>
              <input
                type="date"
                id="cutoffDate"
                name="cutoffDate"
                value={formData.cutoffDate}
                onChange={handleChange}
                className="input-field"
              />
              <p className="text-xs text-[var(--muted)] mt-1">
                Datum ab dem Forderungen/Leistungen als Neumasse gelten.
                Typischerweise das Datum des Insolvenzantrags.
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">Wie funktioniert die Zuordnung?</h4>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• <strong>Altmasse:</strong> Leistungen VOR dem Stichtag</li>
                <li>• <strong>Neumasse:</strong> Leistungen NACH dem Stichtag</li>
                <li>• <strong>Mixed:</strong> Leistungszeitraum überlappt Stichtag</li>
                <li>• <strong>Unklar:</strong> Kein Leistungsdatum vorhanden</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Plan Settings Section */}
        <div className="pt-6 border-t border-[var(--border)]">
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Planeinstellungen</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="planName"
                className="block text-sm font-medium text-[var(--foreground)] mb-2"
              >
                Planname
              </label>
              <input
                type="text"
                id="planName"
                value={planFormData.name}
                onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                className="input-field"
                placeholder="z.B. Hauptplan"
              />
            </div>

            <div>
              <label
                htmlFor="periodType"
                className="block text-sm font-medium text-[var(--foreground)] mb-2"
              >
                Periodentyp
              </label>
              <select
                id="periodType"
                value={planFormData.periodType}
                onChange={(e) => setPlanFormData({ ...planFormData, periodType: e.target.value })}
                className="input-field"
              >
                <option value="WEEKLY">Wöchentlich (13 Wochen Standard)</option>
                <option value="MONTHLY">Monatlich</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="periodCount"
                className="block text-sm font-medium text-[var(--foreground)] mb-2"
              >
                Anzahl Perioden
              </label>
              <input
                type="number"
                id="periodCount"
                value={planFormData.periodCount}
                onChange={(e) => setPlanFormData({ ...planFormData, periodCount: parseInt(e.target.value) || 13 })}
                min={1}
                max={52}
                className="input-field"
              />
              <p className="text-xs text-[var(--muted)] mt-1">
                {planFormData.periodType === "WEEKLY" ? "Wochen" : "Monate"} (1-52)
              </p>
            </div>

            <div>
              <label
                htmlFor="planStartDate"
                className="block text-sm font-medium text-[var(--foreground)] mb-2"
              >
                Planstart
              </label>
              <input
                type="date"
                id="planStartDate"
                value={planFormData.planStartDate}
                onChange={(e) => setPlanFormData({ ...planFormData, planStartDate: e.target.value })}
                className="input-field"
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="planDescription"
                className="block text-sm font-medium text-[var(--foreground)] mb-2"
              >
                Beschreibung (optional)
              </label>
              <input
                type="text"
                id="planDescription"
                value={planFormData.description}
                onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                className="input-field"
                placeholder="Optionale Beschreibung des Plans"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between gap-3 pt-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            Fall permanent löschen
          </button>
          <div className="flex gap-3">
            <Link href={`/admin/cases/${id}`} className="btn-secondary">
              Abbrechen
            </Link>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Speichern..." : "Änderungen speichern"}
            </button>
          </div>
        </div>
      </form>

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-red-600 mb-4">Fall permanent löschen?</h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800 mb-2">
                <strong>Achtung:</strong> Diese Aktion kann nicht rückgängig gemacht werden!
              </p>
              <p className="text-sm text-red-700">
                Alle Daten dieses Falls werden unwiderruflich gelöscht:
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
                disabled={saving || deleteInput !== "LOESCHEN"}
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
    </div>
  );
}
