"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AI_JOB_STATUS_LABELS,
  AiJobStatus,
  isFileTypeSupported,
  getFileType,
  SUPPORTED_FILE_TYPES,
} from "@/lib/ai-preprocessing/types";

interface Case {
  id: string;
  caseNumber: string;
  debtorName: string;
}

interface AiJob {
  id: string;
  caseId: string;
  status: AiJobStatus;
  totalFiles: number;
  processedFiles: number;
  iterationCount: number;
  createdAt: string;
  createdBy: string;
  case: {
    caseNumber: string;
    debtorName: string;
  };
  _count: {
    rows: number;
  };
  rowStats?: {
    pending: number;
    approved: number;
    rejected: number;
    modified: number;
    unclear: number;
  };
}

export default function AiPreprocessingPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Upload form state
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Filter state
  const [filterCaseId, setFilterCaseId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      const [casesRes, jobsRes] = await Promise.all([
        fetch("/api/cases"),
        fetch("/api/ai-preprocessing"),
      ]);

      if (casesRes.ok) {
        const casesData = await casesRes.json();
        setCases(casesData);
      } else if (casesRes.status === 500) {
        setError("Datenbank nicht verfügbar.");
      }

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(jobsData);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Datenbank nicht verfügbar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelect(Array.from(e.dataTransfer.files));
    }
  };

  const handleFilesSelect = (files: File[]) => {
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    for (const file of files) {
      if (isFileTypeSupported(file.name, file.type)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    }

    if (invalidFiles.length > 0) {
      setError(
        `Nicht unterstützte Dateien: ${invalidFiles.join(", ")}. Unterstützt: CSV, Excel, PDF`
      );
    } else {
      setError(null);
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !selectedCaseId) {
      setError("Bitte Fall und mindestens eine Datei auswählen");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append("caseId", selectedCaseId);
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const res = await fetch("/api/ai-preprocessing", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload fehlgeschlagen");
      }

      setSuccessMessage(
        `${selectedFiles.length} Datei(en) zur KI-Verarbeitung hochgeladen. Die Analyse wird gestartet.`
      );
      setSelectedFiles([]);

      // Refresh job list
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
            KI-Aufbereitung
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
            Intelligente Datenaufbereitung (Vorschlag)
          </h1>
          <p className="text-sm text-[var(--secondary)] mt-1">
            KI-gestuetzte Analyse heterogener Dateien mit manueller Prüfung
          </p>
        </div>
      </div>

      {/* Critical Warning Banner */}
      <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4">
        <div className="flex items-start">
          <svg
            className="w-6 h-6 text-amber-600 mr-3 mt-0.5 flex-shrink-0"
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
          <div className="flex-1">
            <h3 className="font-semibold text-amber-800 text-lg">
              Wichtiger Hinweis zur KI-Aufbereitung
            </h3>
            <div className="text-amber-700 mt-2 space-y-2">
              <p>
                <strong>Alle KI-Ergebnisse sind Vorschlaege</strong> und müssen
                vor der Übernahme manuell geprüft und freigegeben werden.
              </p>
              <ul className="list-disc list-inside ml-2 text-sm">
                <li>Die KI analysiert Dateien und schlägt Strukturen vor</li>
                <li>Jeder Vorschlag zeigt Konfidenzwerte und Erklärungen</li>
                <li>Sie können jeden Eintrag einzeln prüfen, korrigieren oder ablehnen</li>
                <li>Keine automatische Übernahme - explizite Freigabe erforderlich</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Explanation - Enhanced */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-lg p-5">
        <div className="flex items-start">
          <svg
            className="w-6 h-6 text-purple-600 mr-3 mt-0.5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="flex-1">
            <h3 className="font-medium text-purple-800 text-lg">
              Wann diese Funktion nutzen?
            </h3>
            <p className="text-sm text-purple-700 mt-1">
              Ideal für heterogene, unstrukturierte Dateien von Insolvenzverwaltern:
              gemischte Excel-Dateien, unvollständige Kontoauszüge, oder Dateien
              ohne klare Spaltenzuordnung. Die KI versucht, die Daten zu verstehen
              und schlägt eine Strukturierung vor.
            </p>
            <div className="mt-4 p-3 bg-white border border-purple-200 rounded-md">
              <p className="text-sm text-purple-800">
                <strong>Sieht Ihre Datei strukturiert aus?</strong> Mit klaren Spalten für Datum, Betrag und Bezeichnung?
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <Link
                  href="/admin/ingestion"
                  className="inline-flex items-center px-3 py-1.5 bg-green-600 rounded-md text-sm font-medium text-white hover:bg-green-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Standard-Import nutzen
                </Link>
                <Link
                  href="/admin/ingestion/requirements"
                  className="inline-flex items-center px-3 py-1.5 bg-white border border-purple-300 rounded-md text-sm font-medium text-purple-700 hover:bg-purple-50 hover:border-purple-400 transition-colors"
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Beispieldateien ansehen
                </Link>
              </div>
            </div>
          </div>
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
            Dateien zur KI-Analyse hochladen
          </h2>
          <p className="text-sm text-[var(--secondary)] mt-1">
            Laden Sie eine oder mehrere Dateien hoch. Die KI analysiert diese und erstellt Strukturvorschlaege.
          </p>
        </div>
        <div className="p-6 space-y-6">
          {/* Case Selection */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Fall auswählen *
            </label>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="input-field max-w-md"
            >
              <option value="">-- Fall wählen --</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.caseNumber} - {c.debtorName}
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
                    Dateien auswählen
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv,.xlsx,.xls,.pdf"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        handleFilesSelect(Array.from(e.target.files));
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
                Unterstützte Formate: CSV, Excel (XLSX, XLS), PDF
              </p>
            </div>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-[var(--foreground)]">
                Ausgewählte Dateien ({selectedFiles.length})
              </h3>
              <div className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-gray-50 rounded-md px-4 py-2"
                  >
                    <div className="flex items-center">
                      <svg
                        className="w-5 h-5 text-[var(--secondary)] mr-3"
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
                        <div className="text-sm font-medium text-[var(--foreground)]">
                          {file.name}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {formatFileSize(file.size)} |{" "}
                          {SUPPORTED_FILE_TYPES[getFileType(file.name) || "CSV"].label}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-[var(--danger)] hover:text-red-700"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Button */}
          <div className="flex justify-end">
            <button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || !selectedCaseId || uploading}
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
                  Wird hochgeladen...
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
                      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                    />
                  </svg>
                  KI-Analyse starten
                </span>
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
              KI-Aufbereitungsvorgänge
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
                {Object.entries(AI_JOB_STATUS_LABELS).map(([key, label]) => (
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
            Keine KI-Aufbereitungsvorgänge gefunden
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fall</th>
                  <th>Dateien</th>
                  <th>Status</th>
                  <th>Vorschlaege</th>
                  <th>Iterationen</th>
                  <th>Erstellt</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr key={job.id}>
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
                      <div className="text-sm">
                        {job.processedFiles} / {job.totalFiles} verarbeitet
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${getStatusBadgeClass(job.status)}`}
                      >
                        {AI_JOB_STATUS_LABELS[job.status] || job.status}
                      </span>
                    </td>
                    <td>
                      <div className="text-sm">
                        <div>{job._count?.rows || 0} Zeilen</div>
                        {job.rowStats && (
                          <div className="text-xs text-[var(--muted)]">
                            {job.rowStats.approved > 0 && (
                              <span className="text-green-600 mr-2">
                                {job.rowStats.approved} OK
                              </span>
                            )}
                            {job.rowStats.pending > 0 && (
                              <span className="text-amber-600 mr-2">
                                {job.rowStats.pending} offen
                              </span>
                            )}
                            {job.rowStats.rejected > 0 && (
                              <span className="text-red-600">
                                {job.rowStats.rejected} abgelehnt
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="text-sm">{job.iterationCount}</span>
                    </td>
                    <td>
                      <div className="text-sm text-[var(--secondary)]">
                        {formatDate(job.createdAt)}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {job.createdBy}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center space-x-2">
                        {job.status === "PROCESSING" && (
                          <span className="text-sm text-[var(--secondary)]">
                            Wird verarbeitet...
                          </span>
                        )}
                        {job.status === "REVIEW" && (
                          <Link
                            href={`/admin/ai-preprocessing/${job.id}/review`}
                            className="btn-secondary text-sm py-1 px-3"
                          >
                            Prüfen
                          </Link>
                        )}
                        {job.status === "CORRECTION" && (
                          <Link
                            href={`/admin/ai-preprocessing/${job.id}/review`}
                            className="btn-secondary text-sm py-1 px-3"
                          >
                            Korrigieren
                          </Link>
                        )}
                        {job.status === "APPROVED" && (
                          <Link
                            href={`/admin/ai-preprocessing/${job.id}/commit`}
                            className="btn-primary text-sm py-1 px-3"
                          >
                            Übernehmen
                          </Link>
                        )}
                        <Link
                          href={`/admin/ai-preprocessing/${job.id}`}
                          className="text-[var(--primary)] hover:underline text-sm"
                        >
                          Details
                        </Link>
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
