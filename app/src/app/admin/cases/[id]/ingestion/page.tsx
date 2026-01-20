"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import {
  SOURCE_TYPES,
  SOURCE_TYPE_LABELS,
  INGESTION_STATUS_LABELS,
  SourceType,
  IngestionStatus,
} from "@/lib/ingestion/types";

interface CaseData {
  id: string;
  caseNumber: string;
  debtorName: string;
  status: string;
  project: { name: string };
}

interface IngestionJob {
  id: string;
  caseId: string;
  sourceType: SourceType;
  fileName: string;
  fileHashSha256: string;
  fileSizeBytes: string;
  status: IngestionStatus;
  errorCount: number;
  warningCount: number;
  quarantinedCount: number;
  recordCountRaw: number | null;
  recordCountValid: number | null;
  recordCountNormalized: number | null;
  qualityScore: number | null;
  startedAt: string;
  completedAt: string | null;
  createdBy: string;
}

export default function CaseIngestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Upload form state
  const [selectedSourceType, setSelectedSourceType] =
    useState<SourceType>("CSV_GENERIC");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  const handleDeleteJob = async (jobId: string, jobStatus: string) => {
    const isCommitted = jobStatus === "COMMITTED";
    const confirmMessage = isCommitted
      ? "Dieser Import wurde bereits übernommen. Beim Löschen werden auch alle importierten Buchungen entfernt. Fortfahren?"
      : "Diesen Import wirklich löschen?";

    if (!confirm(confirmMessage)) return;

    setDeletingJobId(jobId);
    try {
      const res = await fetch(`/api/ingestion/${jobId}`, { method: "DELETE" });
      if (res.ok) {
        setSuccessMessage(
          isCommitted
            ? "Import und zugehörige Buchungen wurden gelöscht"
            : "Import wurde gelöscht"
        );
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Fehler beim Löschen");
      }
    } catch {
      setError("Fehler beim Löschen des Imports");
    } finally {
      setDeletingJobId(null);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const [caseRes, jobsRes] = await Promise.all([
        fetch(`/api/cases/${id}`),
        fetch(`/api/ingestion?caseId=${id}`),
      ]);

      if (caseRes.ok) {
        const data = await caseRes.json();
        setCaseData(data);
      } else {
        setError("Fall nicht gefunden");
      }

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        // Filter jobs for this case
        const caseJobs = Array.isArray(jobsData)
          ? jobsData.filter((j: IngestionJob) => j.caseId === id)
          : [];
        setJobs(caseJobs);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    const validExtensions = [".csv", ".xlsx", ".xls"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));

    if (!validExtensions.includes(ext)) {
      setError("Nur CSV und Excel-Dateien werden unterstuetzt");
      return;
    }

    if (ext === ".csv") {
      setSelectedSourceType("CSV_GENERIC");
    } else {
      setSelectedSourceType("EXCEL_GENERIC");
    }

    setSelectedFile(file);
    setError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Bitte Datei auswählen");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("caseId", id);
      formData.append("sourceType", selectedSourceType);

      const res = await fetch("/api/ingestion", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload fehlgeschlagen");
      }

      setSuccessMessage(
        `Datei erfolgreich hochgeladen: ${data.recordCount} Zeilen erkannt`
      );
      setSelectedFile(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: string | number): string => {
    const size = typeof bytes === "string" ? parseInt(bytes) : bytes;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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

  const getStatusBadgeClass = (status: IngestionStatus): string => {
    switch (status) {
      case "COMMITTED":
        return "badge-success";
      case "READY":
      case "RESOLVED":
        return "badge-info";
      case "REVIEW":
        return "badge-warning";
      case "QUARANTINED":
      case "REJECTED":
        return "badge-danger";
      default:
        return "badge-neutral";
    }
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
        <span className="text-[var(--foreground)]">Daten-Import</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Daten-Import
          </h1>
          <p className="text-[var(--secondary)] mt-1">
            {caseData.caseNumber} - {caseData.debtorName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/admin/cases/${id}`} className="btn-secondary">
            Zurück zum Fall
          </Link>
          <Link href={`/admin/cases/${id}/results`} className="btn-primary flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Dashboard
          </Link>
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

      {/* Upload Section */}
      <div className="admin-card">
        <div className="p-6 border-b border-[var(--border)]">
          <h2 className="text-lg font-medium text-[var(--foreground)]">
            Neue Datei hochladen
          </h2>
        </div>
        <div className="p-6 space-y-6">
          {/* Source Type Selection */}
          <div className="max-w-md">
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Dateityp
            </label>
            <select
              value={selectedSourceType}
              onChange={(e) =>
                setSelectedSourceType(e.target.value as SourceType)
              }
              className="input-field"
            >
              {Object.entries(SOURCE_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? "border-[var(--primary)] bg-blue-50"
                : "border-[var(--border)] hover:border-[var(--primary-light)]"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {selectedFile ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center text-[var(--foreground)]">
                  <svg
                    className="w-8 h-8 text-[var(--success)] mr-3"
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
                  <span className="font-medium">{selectedFile.name}</span>
                </div>
                <p className="text-sm text-[var(--secondary)]">
                  {formatFileSize(selectedFile.size)}
                </p>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-sm text-[var(--danger)] hover:underline"
                >
                  Datei entfernen
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <svg
                  className="w-12 h-12 mx-auto text-[var(--muted)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <div>
                  <label className="cursor-pointer">
                    <span className="text-[var(--primary)] hover:underline">
                      Datei auswählen
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleFileSelect(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                  <span className="text-[var(--secondary)]">
                    {" "}
                    oder hierher ziehen
                  </span>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  Unterstuetzte Formate: CSV, Excel (XLSX, XLS)
                </p>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <div className="flex justify-end">
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
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
                  Hochladen...
                </span>
              ) : (
                "Datei hochladen"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="admin-card">
        <div className="p-6 border-b border-[var(--border)]">
          <h2 className="text-lg font-medium text-[var(--foreground)]">
            Import-Historie für diesen Fall
          </h2>
        </div>

        {jobs.length === 0 ? (
          <div className="p-8 text-center text-[var(--secondary)]">
            Keine Importvorgänge für diesen Fall vorhanden
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Datei</th>
                  <th>Typ</th>
                  <th>Status</th>
                  <th>Zeilen</th>
                  <th>Qualitaet</th>
                  <th>Hochgeladen</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <div>
                        <div className="font-medium text-[var(--foreground)]">
                          {job.fileName}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {formatFileSize(job.fileSizeBytes)} |{" "}
                          {job.fileHashSha256.substring(0, 12)}...
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="text-sm">
                        {SOURCE_TYPE_LABELS[job.sourceType] || job.sourceType}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${getStatusBadgeClass(job.status)}`}
                      >
                        {INGESTION_STATUS_LABELS[job.status] || job.status}
                      </span>
                    </td>
                    <td>
                      <div className="text-sm">
                        <div>{job.recordCountRaw ?? "-"} eingelesen</div>
                        {job.recordCountNormalized !== null && (
                          <div className="text-[var(--muted)]">
                            {job.recordCountNormalized} normalisiert
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      {job.recordCountRaw !== null && job.recordCountRaw > 0 ? (
                        <div className="space-y-1">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                job.errorCount > 0
                                  ? "bg-[var(--danger)]"
                                  : job.warningCount > 0
                                  ? "bg-[var(--warning)]"
                                  : "bg-[var(--success)]"
                              }`}
                              style={{
                                width: `${
                                  job.qualityScore ??
                                  Math.round(
                                    ((job.recordCountNormalized ?? 0) /
                                      job.recordCountRaw) *
                                      100
                                  )
                                }%`,
                              }}
                            ></div>
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            {job.errorCount > 0 && (
                              <span className="text-[var(--danger)]">
                                {job.errorCount} Fehler
                              </span>
                            )}
                            {job.warningCount > 0 && (
                              <span className="text-[var(--warning)] ml-2">
                                {job.warningCount} Warnungen
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[var(--muted)]">-</span>
                      )}
                    </td>
                    <td>
                      <div className="text-sm text-[var(--secondary)]">
                        {formatDate(job.startedAt)}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {job.createdBy}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/admin/ingestion/${job.id}`}
                          className="text-[var(--primary)] hover:underline text-sm"
                        >
                          Details
                        </Link>
                        {job.status === "STAGING" && (
                          <Link
                            href={`/admin/ingestion/${job.id}/map`}
                            className="text-[var(--primary)] hover:underline text-sm"
                          >
                            Zuordnen
                          </Link>
                        )}
                        {job.status === "REVIEW" && (
                          <Link
                            href={`/admin/ingestion/${job.id}/review`}
                            className="text-[var(--warning)] hover:underline text-sm"
                          >
                            Prüfen
                          </Link>
                        )}
                        {job.status === "READY" && (
                          <Link
                            href={`/admin/ingestion/${job.id}/commit`}
                            className="text-[var(--success)] hover:underline text-sm"
                          >
                            Übernehmen
                          </Link>
                        )}
                        <button
                          onClick={() => handleDeleteJob(job.id, job.status)}
                          disabled={deletingJobId === job.id}
                          className="text-[var(--danger)] hover:underline text-sm disabled:opacity-50"
                        >
                          {deletingJobId === job.id ? "..." : "Löschen"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
