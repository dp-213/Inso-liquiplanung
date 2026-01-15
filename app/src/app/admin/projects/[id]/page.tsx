"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Case {
  id: string;
  caseNumber: string;
  debtorName: string;
  status: string;
  courtName: string;
  createdAt: string;
  updatedAt: string;
  plans: { id: string; name: string }[];
  _count: { ingestionJobs: number };
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  cases: Case[];
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", status: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProject();
  }, [id]);

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        setEditForm({
          name: data.name,
          description: data.description || "",
          status: data.status,
        });
      } else if (res.status === 404) {
        setError("Projekt nicht gefunden");
      } else {
        setError("Fehler beim Laden des Projekts");
      }
    } catch (err) {
      console.error("Error fetching project:", err);
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        const updatedProject = await res.json();
        setProject({ ...project!, ...updatedProject });
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

  const handleArchive = async () => {
    if (!confirm("Projekt wirklich archivieren?")) return;

    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });

      if (res.ok) {
        router.push("/admin/projects");
      } else {
        const data = await res.json();
        setError(data.error || "Fehler beim Archivieren");
      }
    } catch (err) {
      setError("Netzwerkfehler beim Archivieren");
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "PRELIMINARY":
        return "Vorlaeufig";
      case "OPENED":
        return "Eroeffnet";
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

  if (error && !project) {
    return (
      <div className="space-y-6">
        <div className="flex items-center text-sm text-[var(--muted)]">
          <Link href="/admin/projects" className="hover:text-[var(--primary)]">
            Projekte
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
          <span className="text-[var(--foreground)]">Fehler</span>
        </div>
        <div className="admin-card p-8 text-center">
          <p className="text-[var(--danger)]">{error}</p>
          <Link href="/admin/projects" className="btn-secondary mt-4 inline-block">
            Zurueck zur Uebersicht
          </Link>
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-[var(--muted)]">
        <Link href="/admin/projects" className="hover:text-[var(--primary)]">
          Projekte
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
        <span className="text-[var(--foreground)]">{project.name}</span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Project Header */}
      <div className="admin-card p-6">
        {isEditing ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Projekt bearbeiten
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  Projektname
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm({ ...editForm, status: e.target.value })
                  }
                  className="input-field"
                >
                  <option value="ACTIVE">Aktiv</option>
                  <option value="ARCHIVED">Archiviert</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  Beschreibung
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  className="input-field"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? "Speichern..." : "Speichern"}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditForm({
                    name: project.name,
                    description: project.description || "",
                    status: project.status,
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
                <h1 className="text-2xl font-bold text-[var(--foreground)]">
                  {project.name}
                </h1>
                <span
                  className={`badge ${
                    project.status === "ACTIVE" ? "badge-success" : "badge-neutral"
                  }`}
                >
                  {project.status === "ACTIVE" ? "Aktiv" : "Archiviert"}
                </span>
              </div>
              {project.description && (
                <p className="mt-2 text-[var(--secondary)]">
                  {project.description}
                </p>
              )}
              <div className="mt-2 text-sm text-[var(--muted)]">
                Erstellt: {new Date(project.createdAt).toLocaleDateString("de-DE")}
                {project.updatedAt !== project.createdAt && (
                  <span className="ml-4">
                    Aktualisiert:{" "}
                    {new Date(project.updatedAt).toLocaleDateString("de-DE")}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setIsEditing(true)} className="btn-secondary">
                Bearbeiten
              </button>
              {project.status === "ACTIVE" && project.cases.length === 0 && (
                <button
                  onClick={handleArchive}
                  className="btn-secondary text-[var(--danger)]"
                >
                  Archivieren
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Gesamt Faelle</p>
          <p className="text-2xl font-bold text-[var(--foreground)]">
            {project.cases.length}
          </p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Eroeffnet</p>
          <p className="text-2xl font-bold text-[var(--success)]">
            {project.cases.filter((c) => c.status === "OPENED").length}
          </p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Vorlaeufig</p>
          <p className="text-2xl font-bold text-[var(--warning)]">
            {project.cases.filter((c) => c.status === "PRELIMINARY").length}
          </p>
        </div>
      </div>

      {/* Cases List */}
      <div className="admin-card">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Faelle in diesem Projekt
          </h2>
          <Link
            href={`/admin/cases/new?projectId=${project.id}`}
            className="btn-primary text-sm"
          >
            Neuen Fall anlegen
          </Link>
        </div>

        {project.cases.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Keine Faelle in diesem Projekt vorhanden.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Schuldner</th>
                <th>Aktenzeichen</th>
                <th>Gericht</th>
                <th>Status</th>
                <th>Plan</th>
                <th>Aktualisiert</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {project.cases.map((caseItem) => (
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
                  <td className="text-[var(--secondary)]">{caseItem.courtName}</td>
                  <td>
                    <span
                      className={`badge ${getStatusBadgeClass(caseItem.status)}`}
                    >
                      {getStatusLabel(caseItem.status)}
                    </span>
                  </td>
                  <td>
                    {caseItem.plans.length > 0 ? (
                      <span className="badge badge-info">Vorhanden</span>
                    ) : (
                      <span className="text-[var(--muted)]">-</span>
                    )}
                  </td>
                  <td className="text-sm text-[var(--muted)]">
                    {new Date(caseItem.updatedAt).toLocaleDateString("de-DE")}
                  </td>
                  <td>
                    <Link
                      href={`/admin/cases/${caseItem.id}`}
                      className="text-[var(--primary)] hover:underline text-sm"
                    >
                      Oeffnen
                    </Link>
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
