"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  SOURCE_TYPE_LABELS,
  INGESTION_STATUS_LABELS,
  QUALITY_TIER_LABELS,
  SourceType,
  IngestionStatus,
  QualityTier,
} from "@/lib/ingestion/types";

interface JobDetail {
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
  recordCountNormalized: number | null;
  startedAt: string;
  completedAt: string | null;
  createdBy: string;
  reviewableCount: number;
  case: {
    caseNumber: string;
    debtorName: string;
  };
  records: Array<{
    id: string;
    rowNumber: number;
    rawData: Record<string, string>;
    mappedData: Record<string, unknown> | null;
    normalizedData: Record<string, unknown> | null;
    status: string;
    qualityTier: QualityTier | null;
    validationErrors: string[] | null;
    validationWarnings: string[] | null;
    stagedEntries: Array<{
      id: string;
      targetCategoryName: string;
      targetCategoryFlowType: string;
      lineName: string;
      weekOffset: number;
      valueType: string;
      amountCents: string;
      requiresReview: boolean;
      reviewReason: string | null;
      status: string;
    }>;
  }>;
}

export default function IngestionJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const resolvedParams = use(params);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "records" | "staged">(
    "overview"
  );
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJob() {
      try {
        const res = await fetch(`/api/ingestion/${resolvedParams.jobId}`);
        if (!res.ok) {
          throw new Error("Job nicht gefunden");
        }
        const data = await res.json();
        setJob(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    }

    fetchJob();
  }, [resolvedParams.jobId]);

  const formatFileSize = (bytes: string): string => {
    const size = parseInt(bytes);
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
      second: "2-digit",
    });
  };

  const formatAmount = (cents: string): string => {
    const euros = Number(BigInt(cents)) / 100;
    return euros.toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case "COMMITTED":
      case "VALID":
      case "READY":
        return "badge-success";
      case "REVIEW":
      case "STAGED":
        return "badge-warning";
      case "QUARANTINED":
      case "REJECTED":
        return "badge-danger";
      default:
        return "badge-neutral";
    }
  };

  const getQualityTierBadge = (tier: QualityTier | null): string => {
    if (!tier) return "badge-neutral";
    switch (tier) {
      case "TIER_1_VALID":
        return "badge-success";
      case "TIER_2_REVIEWABLE":
        return "badge-warning";
      case "TIER_3_QUARANTINED":
      case "TIER_4_REJECTED":
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

  if (error || !job) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8">
          <div className="text-center">
            <svg
              className="w-12 h-12 text-[var(--danger)] mx-auto mb-4"
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
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              {error || "Importvorgang nicht gefunden"}
            </h2>
            <p className="text-[var(--muted)] mb-4">
              Der Importvorgang konnte nicht geladen werden.
            </p>
          </div>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/admin/ingestion"
              className="btn-secondary"
            >
              Zur Import-Übersicht
            </Link>
            <Link
              href="/admin/cases"
              className="btn-primary"
            >
              Zur Fall-Übersicht
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Calculate quality breakdown
  const qualityBreakdown = {
    valid: job.records.filter((r) => r.status === "READY" || r.status === "VALID")
      .length,
    review: job.records.filter((r) => r.status === "REVIEW").length,
    quarantined: job.records.filter((r) => r.status === "QUARANTINED").length,
    rejected: job.records.filter((r) => r.status === "REJECTED").length,
    staging: job.records.filter((r) => r.status === "STAGING" || r.status === "MAPPED")
      .length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/admin/ingestion"
            className="text-[var(--secondary)] hover:text-[var(--foreground)]"
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
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">
              {job.fileName}
            </h1>
            <p className="text-sm text-[var(--secondary)]">
              {job.case.caseNumber} - {job.case.debtorName}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span
            className={`badge ${getStatusBadgeClass(job.status)}`}
          >
            {INGESTION_STATUS_LABELS[job.status] || job.status}
          </span>
          {job.status === "STAGING" && (
            <Link
              href={`/admin/ingestion/${job.id}/map`}
              className="btn-primary"
            >
              Zuordnung starten
            </Link>
          )}
          {job.status === "REVIEW" && (
            <Link
              href={`/admin/ingestion/${job.id}/review`}
              className="btn-primary"
            >
              Prüfung starten
            </Link>
          )}
          {job.status === "READY" && (
            <Link
              href={`/admin/ingestion/${job.id}/commit`}
              className="btn-primary"
            >
              Daten übernehmen
            </Link>
          )}
          <Link
            href={`/admin/cases/${job.caseId}/dashboard`}
            className="btn-secondary flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Dashboard
          </Link>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Dateigröße</div>
          <div className="text-xl font-semibold text-[var(--foreground)]">
            {formatFileSize(job.fileSizeBytes)}
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Zeilen gesamt</div>
          <div className="text-xl font-semibold text-[var(--foreground)]">
            {job.recordCountRaw ?? 0}
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Normalisiert</div>
          <div className="text-xl font-semibold text-[var(--foreground)]">
            {job.recordCountNormalized ?? 0}
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Prüfung offen</div>
          <div className="text-xl font-semibold text-[var(--warning)]">
            {job.reviewableCount}
          </div>
        </div>
      </div>

      {/* Quality Breakdown */}
      <div className="admin-card">
        <div className="p-4 border-b border-[var(--border)]">
          <h3 className="font-medium text-[var(--foreground)]">
            Qualitätsverteilung
          </h3>
        </div>
        <div className="p-4">
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden flex">
                <div
                  className="bg-[var(--success)] h-full"
                  style={{
                    width: `${
                      job.recordCountRaw
                        ? (qualityBreakdown.valid / job.recordCountRaw) * 100
                        : 0
                    }%`,
                  }}
                  title="Gültig"
                ></div>
                <div
                  className="bg-[var(--warning)] h-full"
                  style={{
                    width: `${
                      job.recordCountRaw
                        ? (qualityBreakdown.review / job.recordCountRaw) * 100
                        : 0
                    }%`,
                  }}
                  title="Prüfung"
                ></div>
                <div
                  className="bg-orange-400 h-full"
                  style={{
                    width: `${
                      job.recordCountRaw
                        ? (qualityBreakdown.quarantined / job.recordCountRaw) *
                          100
                        : 0
                    }%`,
                  }}
                  title="Quarantäne"
                ></div>
                <div
                  className="bg-[var(--danger)] h-full"
                  style={{
                    width: `${
                      job.recordCountRaw
                        ? (qualityBreakdown.rejected / job.recordCountRaw) * 100
                        : 0
                    }%`,
                  }}
                  title="Abgelehnt"
                ></div>
                <div
                  className="bg-gray-400 h-full"
                  style={{
                    width: `${
                      job.recordCountRaw
                        ? (qualityBreakdown.staging / job.recordCountRaw) * 100
                        : 0
                    }%`,
                  }}
                  title="Vorbereitung"
                ></div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-4 text-center text-sm">
            <div>
              <div className="font-medium text-[var(--success)]">
                {qualityBreakdown.valid}
              </div>
              <div className="text-[var(--muted)]">Gültig</div>
            </div>
            <div>
              <div className="font-medium text-[var(--warning)]">
                {qualityBreakdown.review}
              </div>
              <div className="text-[var(--muted)]">Prüfung</div>
            </div>
            <div>
              <div className="font-medium text-orange-500">
                {qualityBreakdown.quarantined}
              </div>
              <div className="text-[var(--muted)]">Quarantäne</div>
            </div>
            <div>
              <div className="font-medium text-[var(--danger)]">
                {qualityBreakdown.rejected}
              </div>
              <div className="text-[var(--muted)]">Abgelehnt</div>
            </div>
            <div>
              <div className="font-medium text-gray-500">
                {qualityBreakdown.staging}
              </div>
              <div className="text-[var(--muted)]">Vorbereitung</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-card">
        <div className="border-b border-[var(--border)]">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === "overview"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--secondary)] hover:text-[var(--foreground)]"
              }`}
            >
              Übersicht
            </button>
            <button
              onClick={() => setActiveTab("records")}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === "records"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--secondary)] hover:text-[var(--foreground)]"
              }`}
            >
              Rohdaten ({job.records.length})
            </button>
            <button
              onClick={() => setActiveTab("staged")}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === "staged"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--secondary)] hover:text-[var(--foreground)]"
              }`}
            >
              Normalisierte Daten
            </button>
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-[var(--foreground)] mb-3">
                  Dateiinformationen
                </h4>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-[var(--secondary)]">Dateityp:</dt>
                    <dd className="font-medium">
                      {SOURCE_TYPE_LABELS[job.sourceType] || job.sourceType}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--secondary)]">Größe:</dt>
                    <dd className="font-medium">
                      {formatFileSize(job.fileSizeBytes)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--secondary)]">Hash (SHA-256):</dt>
                    <dd className="font-mono text-xs">
                      {job.fileHashSha256}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--secondary)]">Hochgeladen:</dt>
                    <dd className="font-medium">{formatDate(job.startedAt)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--secondary)]">Hochgeladen von:</dt>
                    <dd className="font-medium">{job.createdBy}</dd>
                  </div>
                </dl>
              </div>
              <div>
                <h4 className="font-medium text-[var(--foreground)] mb-3">
                  Verarbeitungsstatus
                </h4>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-[var(--secondary)]">Status:</dt>
                    <dd>
                      <span
                        className={`badge ${getStatusBadgeClass(job.status)}`}
                      >
                        {INGESTION_STATUS_LABELS[job.status] || job.status}
                      </span>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--secondary)]">Zeilen erkannt:</dt>
                    <dd className="font-medium">{job.recordCountRaw ?? 0}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--secondary)]">Normalisiert:</dt>
                    <dd className="font-medium">
                      {job.recordCountNormalized ?? 0}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--secondary)]">Fehler:</dt>
                    <dd className="font-medium text-[var(--danger)]">
                      {job.errorCount}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--secondary)]">Warnungen:</dt>
                    <dd className="font-medium text-[var(--warning)]">
                      {job.warningCount}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Column Preview */}
            {job.records.length > 0 && (
              <div>
                <h4 className="font-medium text-[var(--foreground)] mb-3">
                  Erkannte Spalten
                </h4>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(job.records[0].rawData).map((col) => (
                    <span
                      key={col}
                      className="px-3 py-1 bg-gray-100 rounded-full text-sm"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Records Tab */}
        {activeTab === "records" && (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="w-16">Zeile</th>
                  <th>Status</th>
                  <th>Rohdaten</th>
                  <th>Fehler / Warnungen</th>
                  <th className="w-20">Details</th>
                </tr>
              </thead>
              <tbody>
                {job.records.slice(0, 100).map((record) => (
                  <>
                    <tr key={record.id}>
                      <td className="font-mono text-sm">{record.rowNumber}</td>
                      <td>
                        <span
                          className={`badge ${getStatusBadgeClass(
                            record.status
                          )}`}
                        >
                          {record.status}
                        </span>
                        {record.qualityTier && (
                          <span
                            className={`badge ml-2 ${getQualityTierBadge(
                              record.qualityTier
                            )}`}
                          >
                            {QUALITY_TIER_LABELS[record.qualityTier]}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="text-sm max-w-md truncate">
                          {Object.entries(record.rawData)
                            .slice(0, 3)
                            .map(([k, v]) => {
                              const displayValue = typeof v === 'object' && v !== null
                                ? JSON.stringify(v)
                                : String(v || '');
                              return `${k}: ${displayValue}`;
                            })
                            .join(" | ")}
                          {Object.keys(record.rawData).length > 3 && " ..."}
                        </div>
                      </td>
                      <td>
                        {record.validationErrors &&
                          record.validationErrors.length > 0 && (
                            <div className="text-sm text-[var(--danger)]">
                              {record.validationErrors[0]}
                              {record.validationErrors.length > 1 && (
                                <span className="text-[var(--muted)]">
                                  {" "}
                                  (+{record.validationErrors.length - 1})
                                </span>
                              )}
                            </div>
                          )}
                        {record.validationWarnings &&
                          record.validationWarnings.length > 0 && (
                            <div className="text-sm text-[var(--warning)]">
                              {record.validationWarnings[0]}
                              {record.validationWarnings.length > 1 && (
                                <span className="text-[var(--muted)]">
                                  {" "}
                                  (+{record.validationWarnings.length - 1})
                                </span>
                              )}
                            </div>
                          )}
                      </td>
                      <td>
                        <button
                          onClick={() =>
                            setExpandedRow(
                              expandedRow === record.id ? null : record.id
                            )
                          }
                          className="text-[var(--primary)] hover:underline text-sm"
                        >
                          {expandedRow === record.id ? "Weniger" : "Mehr"}
                        </button>
                      </td>
                    </tr>
                    {expandedRow === record.id && (
                      <tr>
                        <td colSpan={5} className="bg-gray-50 p-4">
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <h5 className="font-medium text-sm mb-2">
                                Rohdaten
                              </h5>
                              <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
                                {JSON.stringify(record.rawData, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <h5 className="font-medium text-sm mb-2">
                                Zugeordnete Daten
                              </h5>
                              {record.mappedData ? (
                                <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
                                  {JSON.stringify(record.mappedData, null, 2)}
                                </pre>
                              ) : (
                                <p className="text-sm text-[var(--muted)]">
                                  Noch nicht zugeordnet
                                </p>
                              )}
                            </div>
                          </div>
                          {record.stagedEntries.length > 0 && (
                            <div className="mt-4">
                              <h5 className="font-medium text-sm mb-2">
                                Normalisierte Einträge
                              </h5>
                              <table className="admin-table text-sm">
                                <thead>
                                  <tr>
                                    <th>Kategorie</th>
                                    <th>Bezeichnung</th>
                                    <th>Woche</th>
                                    <th>Typ</th>
                                    <th>Betrag</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {record.stagedEntries.map((entry) => (
                                    <tr key={entry.id}>
                                      <td>{entry.targetCategoryName}</td>
                                      <td>{entry.lineName}</td>
                                      <td>KW {entry.weekOffset}</td>
                                      <td>{entry.valueType}</td>
                                      <td className="text-right font-mono">
                                        {formatAmount(entry.amountCents)} EUR
                                      </td>
                                      <td>
                                        <span
                                          className={`badge ${getStatusBadgeClass(
                                            entry.status
                                          )}`}
                                        >
                                          {entry.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
            {job.records.length > 100 && (
              <div className="p-4 text-center text-[var(--muted)] text-sm">
                Zeigt erste 100 von {job.records.length} Zeilen
              </div>
            )}
          </div>
        )}

        {/* Staged Tab */}
        {activeTab === "staged" && (
          <div className="overflow-x-auto">
            {job.records.some((r) => r.stagedEntries.length > 0) ? (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Zeile</th>
                    <th>Kategorie</th>
                    <th>Bezeichnung</th>
                    <th>Woche</th>
                    <th>Typ</th>
                    <th>Betrag</th>
                    <th>Status</th>
                    <th>Hinweis</th>
                  </tr>
                </thead>
                <tbody>
                  {job.records
                    .flatMap((record) =>
                      record.stagedEntries.map((entry) => ({
                        ...entry,
                        rowNumber: record.rowNumber,
                      }))
                    )
                    .slice(0, 100)
                    .map((entry) => (
                      <tr key={entry.id}>
                        <td className="font-mono text-sm">{entry.rowNumber}</td>
                        <td>
                          <div className="text-sm">
                            <div>{entry.targetCategoryName}</div>
                            <div className="text-[var(--muted)] text-xs">
                              {entry.targetCategoryFlowType}
                            </div>
                          </div>
                        </td>
                        <td>{entry.lineName}</td>
                        <td>KW {entry.weekOffset}</td>
                        <td>
                          <span
                            className={`badge ${
                              entry.valueType === "IST"
                                ? "badge-info"
                                : "badge-neutral"
                            }`}
                          >
                            {entry.valueType}
                          </span>
                        </td>
                        <td className="text-right font-mono">
                          {formatAmount(entry.amountCents)} EUR
                        </td>
                        <td>
                          <span
                            className={`badge ${getStatusBadgeClass(
                              entry.status
                            )}`}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td>
                          {entry.requiresReview && entry.reviewReason && (
                            <span className="text-sm text-[var(--warning)]">
                              {entry.reviewReason}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-[var(--secondary)]">
                Noch keine normalisierten Daten vorhanden.
                {job.status === "STAGING" && (
                  <div className="mt-4">
                    <Link
                      href={`/admin/ingestion/${job.id}/map`}
                      className="btn-primary"
                    >
                      Zuordnung starten
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
