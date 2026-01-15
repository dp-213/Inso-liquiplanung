"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
}

function NewCaseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProjectId = searchParams.get("projectId");

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    projectId: "",
    caseNumber: "",
    debtorName: "",
    courtName: "",
    filingDate: new Date().toISOString().split("T")[0],
    openingDate: "",
    status: "PRELIMINARY",
  });

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch("/api/projects");
        if (res.ok) {
          const data = await res.json();
          setProjects(data);
          // Use preselected project from URL or first project
          if (preselectedProjectId && data.find((p: Project) => p.id === preselectedProjectId)) {
            setFormData((prev) => ({ ...prev, projectId: preselectedProjectId }));
          } else if (data.length > 0) {
            setFormData((prev) => ({ ...prev, projectId: data[0].id }));
          }
        }
      } catch (err) {
        console.error("Error loading projects:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProjects();
  }, [preselectedProjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const newCase = await res.json();
        router.push(`/admin/cases/${newCase.id}`);
      } else {
        const data = await res.json();
        setError(data.error || "Fehler beim Erstellen des Falls");
      }
    } catch (err) {
      setError("Netzwerkfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setSubmitting(false);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Neuen Fall anlegen
          </h1>
          <p className="text-[var(--secondary)] mt-1">
            Erstellen Sie ein neues Insolvenzverfahren
          </p>
        </div>
        <Link href="/admin/cases" className="btn-secondary">
          Abbrechen
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="admin-card p-8 text-center">
          <p className="text-[var(--muted)] mb-4">
            Sie muessen zuerst ein Projekt erstellen, bevor Sie einen Fall
            anlegen koennen.
          </p>
          <Link href="/admin/projects?new=true" className="btn-primary">
            Projekt erstellen
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="admin-card p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="projectId"
                className="block text-sm font-medium text-[var(--foreground)] mb-2"
              >
                Projekt *
              </label>
              <select
                id="projectId"
                name="projectId"
                value={formData.projectId}
                onChange={handleChange}
                required
                className="input-field"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

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
                placeholder="z.B. 123 IN 456/24"
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
                placeholder="Name des Schuldners"
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
                placeholder="z.B. AG Muenchen"
                className="input-field"
              />
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
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
            <Link href="/admin/cases" className="btn-secondary">
              Abbrechen
            </Link>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Erstelle..." : "Fall anlegen"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function NewCaseLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Neuen Fall anlegen</h1>
          <p className="text-[var(--secondary)] mt-1">Erstellen Sie ein neues Insolvenzverfahren</p>
        </div>
      </div>
      <div className="admin-card p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
          <span className="ml-3 text-[var(--muted)]">Wird geladen...</span>
        </div>
      </div>
    </div>
  );
}

export default function NewCasePage() {
  return (
    <Suspense fallback={<NewCaseLoading />}>
      <NewCaseContent />
    </Suspense>
  );
}
