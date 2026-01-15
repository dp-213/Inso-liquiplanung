"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  REVIEW_REASON_LABELS,
  INGESTION_STATUS_LABELS,
  ReviewReasonCode,
} from "@/lib/ingestion/types";

interface ReviewJob {
  id: string;
  fileName: string;
  sourceType: string;
  status: string;
  reviewableCount: number;
  errorCount: number;
  warningCount: number;
  startedAt: string;
  case: {
    id: string;
    caseNumber: string;
    debtorName: string;
  };
}

export default function GlobalReviewQueuePage() {
  const [jobs, setJobs] = useState<ReviewJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/ingestion");
        if (res.ok) {
          const allJobs = await res.json();
          // Filter to jobs that need review
          const reviewJobs = allJobs.filter(
            (job: ReviewJob) =>
              job.status === "REVIEW" ||
              job.status === "QUARANTINED" ||
              (job.reviewableCount && job.reviewableCount > 0)
          );
          setJobs(reviewJobs);
        }
      } catch (err) {
        setError("Fehler beim Laden der Daten");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    // Poll every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return "gerade eben";
    } else if (diffHours < 24) {
      return `vor ${diffHours} Stunde${diffHours > 1 ? "n" : ""}`;
    } else if (diffDays < 7) {
      return `vor ${diffDays} Tag${diffDays > 1 ? "en" : ""}`;
    } else {
      return date.toLocaleDateString("de-DE");
    }
  };

  const getStatusBadge = (status: string, reviewableCount: number) => {
    if (status === "QUARANTINED" || status === "REJECTED") {
      return (
        <span className="badge badge-danger">
          Probleme
        </span>
      );
    }
    if (status === "REVIEW" || reviewableCount > 0) {
      return (
        <span className="badge badge-warning">
          Prüfung ({reviewableCount})
        </span>
      );
    }
    return (
      <span className="badge badge-neutral">
        {INGESTION_STATUS_LABELS[status as keyof typeof INGESTION_STATUS_LABELS] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">
              Prüfungs-Warteschlange
            </h1>
            <p className="text-sm text-[var(--secondary)] mt-1">
              Importvorgänge, die Ihre Aufmerksamkeit erfordern
            </p>
          </div>
        </div>
        <div className="admin-card p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
            <span className="ml-3 text-[var(--secondary)]">Laden...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">
            Prüfungs-Warteschlange
          </h1>
          <p className="text-sm text-[var(--secondary)] mt-1">
            {jobs.length === 0
              ? "Keine Prüfungen ausstehend"
              : `${jobs.length} Import${jobs.length > 1 ? "e" : ""} erfordern Prüfung`}
          </p>
        </div>
        <Link href="/admin/ingestion" className="btn-secondary">
          Alle Importe
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="admin-card p-12 text-center">
          <svg
            className="w-20 h-20 mx-auto text-[var(--success)] mb-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
            Alles erledigt
          </h2>
          <p className="text-[var(--secondary)]">
            Keine Importvorgänge erfordern derzeit Ihre Prüfung.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="admin-card p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="font-semibold text-[var(--foreground)]">
                      {job.fileName}
                    </h3>
                    {getStatusBadge(job.status, job.reviewableCount)}
                  </div>
                  <div className="mt-2 text-sm text-[var(--secondary)]">
                    <span className="font-medium">{job.case.caseNumber}</span>
                    <span className="mx-2">|</span>
                    <span>{job.case.debtorName}</span>
                  </div>
                  <div className="mt-3 flex items-center space-x-4 text-sm">
                    {job.errorCount > 0 && (
                      <span className="text-[var(--danger)]">
                        {job.errorCount} Fehler
                      </span>
                    )}
                    {job.warningCount > 0 && (
                      <span className="text-[var(--warning)]">
                        {job.warningCount} Warnungen
                      </span>
                    )}
                    <span className="text-[var(--muted)]">
                      Hochgeladen {formatDate(job.startedAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Link
                    href={`/admin/ingestion/${job.id}`}
                    className="btn-secondary text-sm"
                  >
                    Details
                  </Link>
                  <Link
                    href={`/admin/ingestion/${job.id}/review`}
                    className="btn-primary text-sm"
                  >
                    Prüfen
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
