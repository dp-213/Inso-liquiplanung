"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  caseCount: number;
  activeCases: number;
}

function ProjectsContent() {
  const searchParams = useSearchParams();
  const showNewForm = searchParams.get("new") === "true";

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [showForm, setShowForm] = useState(showNewForm);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
        setDbError(false);
      } else if (response.status === 500) {
        setDbError(true);
      }
    } catch (err) {
      console.error("Error fetching projects:", err);
      setDbError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fehler beim Erstellen");
      }

      setFormData({ name: "", description: "" });
      setShowForm(false);
      fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Projekt wirklich archivieren?")) return;

    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });

      if (response.ok) {
        fetchProjects();
      }
    } catch (err) {
      console.error("Error archiving project:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Projekte</h1>
          <p className="text-[var(--secondary)] mt-1">Verwalten Sie Insolvenzverwalter und Mandate</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          Neues Projekt
        </button>
      </div>

      {dbError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            Datenbank nicht verfügbar. Für den produktiven Einsatz wird eine Cloud-Datenbank benötigt.
          </p>
        </div>
      )}

      {/* New Project Form */}
      {showForm && !dbError && (
        <div className="admin-card p-6">
          <h2 className="text-lg font-semibold mb-4">Neues Projekt erstellen</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Projektname (Insolvenzverwalter)
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field"
                placeholder="z.B. Dr. Müller Insolvenzverwaltung"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Beschreibung (optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input-field"
                rows={2}
                placeholder="Zusätzliche Informationen..."
              />
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Wird erstellt..." : "Erstellen"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Projects Table */}
      <div className="admin-card">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Wird geladen...</div>
        ) : projects.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Noch keine Projekte vorhanden. Erstellen Sie Ihr erstes Projekt.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Projektname</th>
                <th>Fälle</th>
                <th>Status</th>
                <th>Erstellt</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>
                    <div>
                      <div className="font-medium text-[var(--foreground)]">{project.name}</div>
                      {project.description && (
                        <div className="text-sm text-[var(--muted)]">{project.description}</div>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="text-[var(--foreground)]">{project.caseCount}</span>
                    <span className="text-[var(--muted)] ml-1">
                      ({project.activeCases} aktiv)
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${project.status === "ACTIVE" ? "badge-success" : "badge-neutral"}`}>
                      {project.status === "ACTIVE" ? "Aktiv" : "Archiviert"}
                    </span>
                  </td>
                  <td className="text-[var(--muted)]">
                    {new Date(project.createdAt).toLocaleDateString("de-DE")}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <Link href={`/admin/projects/${project.id}`} className="btn-secondary text-xs py-1 px-2">
                        Details
                      </Link>
                      {project.status === "ACTIVE" && project.caseCount === 0 && (
                        <button
                          onClick={() => handleArchive(project.id)}
                          className="text-xs py-1 px-2 text-[var(--danger)] hover:bg-red-50 rounded"
                        >
                          Archivieren
                        </button>
                      )}
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

function ProjectsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Projekte</h1>
          <p className="text-[var(--secondary)] mt-1">Verwalten Sie Insolvenzverwalter und Mandate</p>
        </div>
        <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
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

export default function ProjectsPage() {
  return (
    <Suspense fallback={<ProjectsLoading />}>
      <ProjectsContent />
    </Suspense>
  );
}
