"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CaseData {
  id: string;
  caseNumber: string;
  debtorName: string;
  courtName: string;
  filingDate: string;
  openingDate: string | null;
  status: string;
  projectId: string;
  project: { id: string; name: string };
}

interface Project {
  id: string;
  name: string;
}

export default function CaseEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    caseNumber: "",
    debtorName: "",
    courtName: "",
    filingDate: "",
    openingDate: "",
    status: "",
    projectId: "",
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [caseRes, projectsRes] = await Promise.all([
        fetch(`/api/cases/${id}`),
        fetch("/api/projects"),
      ]);

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
          status: data.status,
          projectId: data.projectId,
        });
      } else {
        setError("Fall nicht gefunden");
      }

      if (projectsRes.ok) {
        const projectsData = await projectsRes.json();
        setProjects(projectsData);
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
      const res = await fetch(`/api/cases/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseNumber: formData.caseNumber,
          debtorName: formData.debtorName,
          courtName: formData.courtName,
          filingDate: formData.filingDate,
          openingDate: formData.openingDate || null,
          status: formData.status,
        }),
      });

      if (res.ok) {
        router.push(`/admin/cases/${id}`);
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
            Zurueck zur Uebersicht
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
          Faelle
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
              <option value="PRELIMINARY">Vorlaeufig</option>
              <option value="OPENED">Eroeffnet</option>
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
              Eroeffnungsdatum
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
              Projekt
            </label>
            <input
              type="text"
              value={caseData.project.name}
              disabled
              className="input-field bg-gray-100 cursor-not-allowed"
            />
            <p className="text-xs text-[var(--muted)] mt-1">
              Das Projekt kann nicht geaendert werden
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
          <Link href={`/admin/cases/${id}`} className="btn-secondary">
            Abbrechen
          </Link>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Speichern..." : "Aenderungen speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
