"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AI_JOB_STATUS_LABELS,
  AI_FILE_STATUS_LABELS,
  AiJobStatus,
  AiFileStatus,
} from "@/lib/ai-preprocessing/types";

interface JobDetails {
  id: string;
  caseId: string;
  status: AiJobStatus;
  totalFiles: number;
  processedFiles: number;
  iterationCount: number;
  lastError?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  completedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  case: {
    id: string;
    caseNumber: string;
    debtorName: string;
  };
  files: Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileSizeBytes: string;
    status: AiFileStatus;
    errorMessage?: string;
    createdAt: string;
  }>;
  rowStats: {
    pending: number;
    approved: number;
    rejected: number;
    modified: number;
    unclear: number;
    total: number;
  };
  logs: Array<{
    id: string;
    action: string;
    details: string;
    userId: string;
    timestamp: string;
  }>;
}

export default function AiPreprocessingJobPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/ai-preprocessing/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setJob(data);
      } else {
        setError("Aufbereitungsvorgang nicht gefunden");
      }
    } catch (err) {
      console.error("Error fetching job:", err);
      setError("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
    // Poll for updates if processing
    const interval = setInterval(() => {
      if (job?.status === "PROCESSING" || job?.status === "CORRECTION") {
        fetchJob();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchJob, job?.status]);

  const handleDelete = async () => {
    if (!confirm("Sind Sie sicher, dass Sie diesen Vorgang löschen moechten?")) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/ai-preprocessing/${jobId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/admin/ai-preprocessing");
      } else {
        const data = await res.json();
        setError(data.error || "Fehler beim Löschen");
      }
    } catch (err) {
      setError("Fehler beim Löschen");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes: string): string => {
    const size = parseInt(bytes);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadgeClass = (status: AiJobStatus): string => {
    switch (status) {
      case "COMMITTED":
        return "badge-success";
      case "APPROVED":
        return "badge-info";
      case "REVIEW":
        return "badge-warning";
      case "CORRECTION":
        return "badge-warning";
      case "REJECTED":
        return "badge-danger";
      case "PROCESSING":
        return "badge-neutral";
      default:
        return "badge-neutral";
    }
  };

  const getFileStatusBadgeClass = (status: AiFileStatus): string => {
    switch (status) {
      case "COMPLETED":
        return "badge-success";
      case "PROCESSING":
        return "badge-warning";
      case "ERROR":
        return "badge-danger";
      default:
        return "badge-neutral";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
            <span className="ml-3 text-[var(--secondary)]">Laden...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <p className="text-[var(--danger)]">Aufbereitungsvorgang nicht gefunden</p>
          <Link
            href="/admin/ai-preprocessing"
            className="text-[var(--primary)] hover:underline mt-2 inline-block"
          >
            Zurück zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2 text-sm text-[var(--secondary)] mb-1">
            <Link href="/admin/ai-preprocessing" className="hover:underline">
              KI-Aufbereitung
            </Link>
            <span>/</span>
            <span>Details</span>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">
            Aufbereitungsvorgang
          </h1>
          <p className="text-sm text-[var(--secondary)] mt-1">
            {job.case.caseNumber} - {job.case.debtorName}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <span className={`badge ${getStatusBadgeClass(job.status)}`}>
            {AI_JOB_STATUS_LABELS[job.status] || job.status}
          </span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Last Error from Job */}
      {job.lastError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-md">
          <strong>Hinweis:</strong> {job.lastError}
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4">
        <div className="admin-card p-4">
          <div className="text-2xl font-semibold text-[var(--foreground)]">
            {job.totalFiles}
          </div>
          <div className="text-sm text-[var(--secondary)]">Dateien</div>
        </div>
        <div className="admin-card p-4">
          <div className="text-2xl font-semibold text-[var(--foreground)]">
            {job.rowStats.total}
          </div>
          <div className="text-sm text-[var(--secondary)]">Zeilen erkannt</div>
        </div>
        <div className="admin-card p-4">
          <div className="text-2xl font-semibold text-green-600">
            {job.rowStats.approved + job.rowStats.modified}
          </div>
          <div className="text-sm text-[var(--secondary)]">Genehmigt</div>
        </div>
        <div className="admin-card p-4">
          <div className="text-2xl font-semibold text-amber-600">
            {job.rowStats.pending}
          </div>
          <div className="text-sm text-[var(--secondary)]">Offen</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="admin-card p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-[var(--secondary)]">
            Erstellt am {formatDate(job.createdAt)} von {job.createdBy}
            {job.iterationCount > 0 && ` | ${job.iterationCount} Korrektur-Iterationen`}
          </div>
          <div className="flex items-center space-x-3">
            {job.status === "PROCESSING" && (
              <span className="flex items-center text-[var(--secondary)]">
                <svg
                  className="animate-spin mr-2 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Wird verarbeitet...
              </span>
            )}
            {["REVIEW", "CORRECTION"].includes(job.status) && (
              <Link
                href={`/admin/ai-preprocessing/${jobId}/review`}
                className="btn-primary"
              >
                Zur Prüfung
              </Link>
            )}
            {job.status === "APPROVED" && (
              <Link
                href={`/admin/ai-preprocessing/${jobId}/commit`}
                className="btn-primary"
              >
                Daten übernehmen
              </Link>
            )}
            {job.status !== "COMMITTED" && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-secondary text-red-600 border-red-200 hover:bg-red-50"
              >
                {deleting ? "Wird gelöscht..." : "Löschen"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Files List */}
      <div className="admin-card">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-medium text-[var(--foreground)]">
            Hochgeladene Dateien
          </h2>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {job.files.map((file) => (
            <div key={file.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center">
                <svg
                  className="w-8 h-8 text-[var(--secondary)] mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div>
                  <div className="font-medium text-[var(--foreground)]">
                    {file.fileName}
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    {file.fileType} | {formatFileSize(file.fileSizeBytes)}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {file.errorMessage && (
                  <span className="text-sm text-red-600" title={file.errorMessage}>
                    Fehler
                  </span>
                )}
                <span className={`badge ${getFileStatusBadgeClass(file.status)}`}>
                  {AI_FILE_STATUS_LABELS[file.status] || file.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Log */}
      <div className="admin-card">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-medium text-[var(--foreground)]">
            Aktivitaetsprotokoll
          </h2>
        </div>
        <div className="divide-y divide-[var(--border)] max-h-96 overflow-y-auto">
          {job.logs && job.logs.length > 0 ? (
            job.logs.map((log) => (
              <div key={log.id} className="p-4 flex items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-[var(--foreground)]">
                      {log.action}
                    </span>
                    <span className="text-sm text-[var(--muted)]">
                      von {log.userId}
                    </span>
                  </div>
                  <div className="text-sm text-[var(--secondary)] mt-1">
                    {(() => {
                      try {
                        const details = JSON.parse(log.details);
                        return Object.entries(details)
                          .slice(0, 3)
                          .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                          .join(" | ");
                      } catch {
                        return log.details;
                      }
                    })()}
                  </div>
                </div>
                <div className="text-sm text-[var(--muted)]">
                  {formatDate(log.timestamp)}
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-[var(--secondary)]">
              Keine Protokolleintraege
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
