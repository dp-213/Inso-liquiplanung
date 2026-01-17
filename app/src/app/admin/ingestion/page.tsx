"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  SOURCE_TYPES,
  SOURCE_TYPE_LABELS,
  INGESTION_STATUS_LABELS,
  SourceType,
  IngestionStatus,
} from "@/lib/ingestion/types";

interface Case {
  id: string;
  caseNumber: string;
  debtorName: string;
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
  case: {
    caseNumber: string;
    debtorName: string;
  };
  _count: {
    records: number;
  };
}

export default function IngestionCenterPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Upload form state
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [selectedSourceType, setSelectedSourceType] = useState<SourceType>("CSV_GENERIC");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Filter state
  const [filterCaseId, setFilterCaseId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      const [casesRes, jobsRes] = await Promise.all([
        fetch("/api/cases"),
        fetch("/api/ingestion"),
      ]);

      if (casesRes.ok) {
        const casesData = await casesRes.json();
        setCases(casesData);
      } else if (casesRes.status === 500) {
        setError("Datenbank nicht verfügbar. Für den produktiven Einsatz wird eine Cloud-Datenbank benötigt.");
      }

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(jobsData);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Datenbank nicht verfügbar. Für den produktiven Einsatz wird eine Cloud-Datenbank benötigt.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Poll for updates every 10 seconds
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
    // Validate file type
    const validExtensions = [".csv", ".xlsx", ".xls"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));

    if (!validExtensions.includes(ext)) {
      setError("Nur CSV und Excel-Dateien werden unterstützt");
      return;
    }

    // Auto-detect source type
    if (ext === ".csv") {
      setSelectedSourceType("CSV_GENERIC");
    } else {
      setSelectedSourceType("EXCEL_GENERIC");
    }

    setSelectedFile(file);
    setError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedCaseId) {
      setError("Bitte Fall und Datei auswählen");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("caseId", selectedCaseId);
      formData.append("sourceType", selectedSourceType);

      const res = await fetch("/api/ingestion", {
        method: "POST",
        body: formData,
      });

      let data;
      try {
        data = await res.json();
      } catch (jsonError) {
        console.error("Error parsing response:", jsonError);
        throw new Error("Server-Antwort konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.");
      }

      if (!res.ok) {
        // Build a detailed error message
        let errorMsg = data.error || "Upload fehlgeschlagen";

        // If there's a jobId, add link to view details
        if (data.jobId) {
          errorMsg += ` (Job-ID: ${data.jobId.substring(0, 8)}...)`;
        }

        // Log technical details to console for debugging
        if (data.details) {
          console.error("Upload error details:", data.details);
        }

        throw new Error(errorMsg);
      }

      setSuccessMessage(
        `Datei erfolgreich hochgeladen: ${data.recordCount} Zeilen erkannt`
      );
      setSelectedFile(null);

      // Refresh job list
      fetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Upload fehlgeschlagen";
      console.error("Upload error:", errorMessage);
      setError(errorMessage);
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

  const filteredJobs = jobs.filter((job) => {
    if (filterCaseId && job.caseId !== filterCaseId) return false;
    if (filterStatus && job.status !== filterStatus) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">
            Daten-Import
          </h1>
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
            Daten-Import
          </h1>
          <p className="text-sm text-[var(--secondary)] mt-1">
            Dateien hochladen und Zuordnungen verwalten
          </p>
        </div>
        <Link href="/admin/ingestion/review" className="btn-secondary">
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            Prüfung
          </span>
        </Link>
      </div>

      {/* Requirements Info Box - Enhanced */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-5">
        <div className="flex items-start">
          <svg
            className="w-6 h-6 text-blue-600 mr-3 mt-0.5 flex-shrink-0"
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
          <div className="flex-1">
            <h3 className="font-medium text-blue-800 text-lg">
              Beispieldateien und Datenanforderungen
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              Laden Sie Beispieldateien herunter, um zu sehen, wie Ihre Daten strukturiert sein müssen.
              Bei unstrukturierten Daten nutzen Sie die <Link href="/admin/ai-preprocessing" className="underline hover:no-underline font-medium">KI-Aufbereitung</Link>.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <a
                href="/api/examples/minimal-beispiel.xlsx"
                download="minimal-beispiel.xlsx"
                className="inline-flex items-center px-3 py-1.5 bg-white border border-blue-300 rounded-md text-sm font-medium text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-colors"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Minimalbeispiel
              </a>
              <a
                href="/api/examples/empfohlene-struktur.xlsx"
                download="empfohlene-struktur.xlsx"
                className="inline-flex items-center px-3 py-1.5 bg-white border border-blue-300 rounded-md text-sm font-medium text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-colors"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Empfohlene Struktur
              </a>
              <Link
                href="/admin/ingestion/requirements"
                className="inline-flex items-center px-3 py-1.5 bg-blue-600 rounded-md text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Alle Anforderungen
                <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <h4 className="font-medium text-red-800">Fehler beim Import</h4>
              <p className="text-red-700 mt-1">{error}</p>
              <p className="text-red-600 text-sm mt-2">
                Bitte ueberprüfen Sie die Datei und versuchen Sie es erneut. Bei anhaltenden Problemen wenden Sie sich an den Support.
              </p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 ml-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {successMessage && (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0"
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
            <div className="flex-1">
              <h4 className="font-medium text-green-800">Erfolg</h4>
              <p className="text-green-700 mt-1">{successMessage}</p>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-green-500 hover:text-green-700 ml-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
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
          {/* Case and Source Type Selection */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Fall auswählen *
              </label>
              <select
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                className="input-field"
              >
                <option value="">-- Fall wählen --</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.caseNumber} - {c.debtorName}
                  </option>
                ))}
              </select>
            </div>
            <div>
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
                  Unterstützte Formate: CSV, Excel (XLSX, XLS)
                </p>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <div className="flex justify-end">
            <button
              onClick={handleUpload}
              disabled={!selectedFile || !selectedCaseId || uploading}
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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-[var(--foreground)]">
              Importvorgänge
            </h2>
            <div className="flex items-center space-x-4">
              {/* Filter by Case */}
              <select
                value={filterCaseId}
                onChange={(e) => setFilterCaseId(e.target.value)}
                className="input-field text-sm py-1.5"
              >
                <option value="">Alle Fälle</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.caseNumber}
                  </option>
                ))}
              </select>

              {/* Filter by Status */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input-field text-sm py-1.5"
              >
                <option value="">Alle Status</option>
                {Object.entries(INGESTION_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredJobs.length === 0 ? (
          <div className="p-8 text-center text-[var(--secondary)]">
            Keine Importvorgänge gefunden
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Datei</th>
                  <th>Fall</th>
                  <th>Typ</th>
                  <th>Status</th>
                  <th>Zeilen</th>
                  <th>Qualität</th>
                  <th>Hochgeladen</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
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
                      <div className="text-sm">
                        <div className="font-medium">
                          {job.case.caseNumber}
                        </div>
                        <div className="text-[var(--muted)]">
                          {job.case.debtorName}
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
                          <div className="text-xs text-[var(--muted)] flex justify-between">
                            <span>
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
                            </span>
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
