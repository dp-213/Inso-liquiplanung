"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AiJobStatus } from "@/lib/ai-preprocessing/types";

interface JobDetails {
  id: string;
  status: AiJobStatus;
  case: {
    id: string;
    caseNumber: string;
    debtorName: string;
  };
  rowStats: {
    pending: number;
    approved: number;
    rejected: number;
    modified: number;
    unclear: number;
    total: number;
  };
  approvedAt?: string;
  approvedBy?: string;
  iterationCount: number;
  logs: Array<{
    id: string;
    action: string;
    details: string;
    userId: string;
    timestamp: string;
  }>;
}

export default function AiPreprocessingCommitPage() {
  const params = useParams();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<{
    ingestionJobId: string;
    stagedEntries: number;
  } | null>(null);

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
  }, [fetchJob]);

  const handleCommit = async () => {
    if (!job || job.status !== "APPROVED") return;

    setCommitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/ai-preprocessing/${jobId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Fehler beim Übertragen");
      }

      setSuccessMessage(data.message);
      setCommitResult({
        ingestionJobId: data.ingestionJobId,
        stagedEntries: data.stagedEntries,
      });

      // Refresh job data
      fetchJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Übertragen");
    } finally {
      setCommitting(false);
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
            <span>Übernahme</span>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">
            Daten übernehmen
          </h1>
          <p className="text-sm text-[var(--secondary)] mt-1">
            {job.case.caseNumber} - {job.case.debtorName}
          </p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
          {successMessage}
        </div>
      )}

      {/* Status Check */}
      {job.status === "COMMITTED" ? (
        <div className="admin-card p-6">
          <div className="flex items-center text-green-600 mb-4">
            <svg
              className="w-8 h-8 mr-3"
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
            <h2 className="text-xl font-semibold">Daten wurden übertragen</h2>
          </div>
          <p className="text-[var(--secondary)] mb-4">
            Die aufbereiteten Daten wurden erfolgreich in die Staging-Tabelle übertragen.
            Sie können nun im regulaeren Daten-Import-Bereich die endgültige Übernahme
            in das System durchführen.
          </p>
          <div className="flex space-x-3">
            <Link href="/admin/ingestion" className="btn-primary">
              Zum Daten-Import
            </Link>
            <Link href="/admin/ai-preprocessing" className="btn-secondary">
              Zurück zur Übersicht
            </Link>
          </div>
        </div>
      ) : job.status !== "APPROVED" ? (
        <div className="admin-card p-6">
          <div className="flex items-center text-amber-600 mb-4">
            <svg
              className="w-8 h-8 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 className="text-xl font-semibold">Vorgang nicht freigegeben</h2>
          </div>
          <p className="text-[var(--secondary)] mb-4">
            Dieser Aufbereitungsvorgang wurde noch nicht freigegeben. Bitte prüfen Sie
            zuerst alle Vorschlaege und geben Sie den Vorgang frei.
          </p>
          <div className="flex space-x-3">
            <Link
              href={`/admin/ai-preprocessing/${jobId}/review`}
              className="btn-primary"
            >
              Zur Prüfung
            </Link>
            <Link href="/admin/ai-preprocessing" className="btn-secondary">
              Zurück zur Übersicht
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Card */}
          <div className="admin-card p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
              Zusammenfassung
            </h2>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-sm font-medium text-[var(--secondary)] mb-2">
                  Statistik
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[var(--secondary)]">Genehmigt:</span>
                    <span className="font-medium text-green-600">
                      {job.rowStats.approved + job.rowStats.modified}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--secondary)]">Abgelehnt:</span>
                    <span className="font-medium text-red-600">
                      {job.rowStats.rejected}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--secondary)]">Unklar:</span>
                    <span className="font-medium text-gray-600">
                      {job.rowStats.unclear}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-[var(--foreground)] font-medium">
                      Zu übertragen:
                    </span>
                    <span className="font-semibold text-[var(--primary)]">
                      {job.rowStats.approved + job.rowStats.modified}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-[var(--secondary)] mb-2">
                  Freigabe-Details
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[var(--secondary)]">Freigegeben von:</span>
                    <span className="font-medium">{job.approvedBy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--secondary)]">Freigegeben am:</span>
                    <span className="font-medium">
                      {job.approvedAt ? formatDate(job.approvedAt) : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--secondary)]">Korrektur-Iterationen:</span>
                    <span className="font-medium">{job.iterationCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Final Warning */}
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <h3 className="font-medium text-amber-800">Vor der Übernahme</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    Die Daten werden in die Staging-Tabelle übertragen. Von dort aus
                    können Sie die endgültige Übernahme im regulaeren Daten-Import-Bereich
                    durchführen. Dieser Schritt kann nicht rückgängig gemacht werden.
                  </p>
                </div>
              </div>
            </div>

            {/* Commit Button */}
            <div className="flex justify-end space-x-3">
              <Link
                href={`/admin/ai-preprocessing/${jobId}/review`}
                className="btn-secondary"
              >
                Zurück zur Prüfung
              </Link>
              <button
                onClick={handleCommit}
                disabled={committing}
                className="btn-primary"
              >
                {committing ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                    Wird übertragen...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Daten übertragen
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Commit Result */}
          {commitResult && (
            <div className="admin-card p-6 border-2 border-green-300 bg-green-50">
              <div className="flex items-center text-green-600 mb-4">
                <svg
                  className="w-6 h-6 mr-2"
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
                <h3 className="font-semibold">Erfolgreich übertragen!</h3>
              </div>
              <p className="text-[var(--secondary)] mb-4">
                <strong>{commitResult.stagedEntries}</strong> Eintraege wurden in die
                Staging-Tabelle übertragen. Sie können nun im Daten-Import-Bereich
                die endgültige Übernahme durchführen.
              </p>
              <Link
                href={`/admin/ingestion/${commitResult.ingestionJobId}/commit`}
                className="btn-primary"
              >
                Zur endgültigen Übernahme
              </Link>
            </div>
          )}
        </>
      )}

      {/* Audit Log */}
      <div className="admin-card">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-medium text-[var(--foreground)]">
            Protokoll
          </h2>
        </div>
        <div className="divide-y divide-[var(--border)]">
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
                          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                          .join(", ");
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
