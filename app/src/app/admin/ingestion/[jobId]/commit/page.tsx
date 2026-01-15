"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface JobData {
  id: string;
  caseId: string;
  fileName: string;
  fileHashSha256: string;
  status: string;
  recordCountRaw: number | null;
  recordCountNormalized: number | null;
  case: {
    caseNumber: string;
    debtorName: string;
  };
  reviewableCount: number;
}

interface StagedEntry {
  targetCategoryName: string;
  targetCategoryFlowType: string;
  lineName: string;
  weekOffset: number;
  valueType: string;
  amountCents: string;
  status: string;
}

export default function CommitPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [job, setJob] = useState<JobData | null>(null);
  const [stagedEntries, setStagedEntries] = useState<StagedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<{
    createdLines: number;
    createdValues: number;
    updatedValues: number;
    totalEntries: number;
  } | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/ingestion/${resolvedParams.jobId}`);
        if (!res.ok) {
          throw new Error("Import nicht gefunden");
        }
        const data = await res.json();
        setJob(data);

        // Extract staged entries from records
        const entries: StagedEntry[] = [];
        data.records.forEach((record: { stagedEntries: StagedEntry[] }) => {
          record.stagedEntries.forEach((entry: StagedEntry) => {
            if (entry.status === "STAGED" || entry.status === "REVIEWED") {
              entries.push(entry);
            }
          });
        });
        setStagedEntries(entries);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [resolvedParams.jobId]);

  const formatAmount = (cents: string): string => {
    const euros = Number(BigInt(cents)) / 100;
    return euros.toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleCommit = async () => {
    if (!job) return;

    if (job.status !== "READY") {
      setError("Import ist nicht bereit zur Übernahme");
      return;
    }

    if (job.reviewableCount > 0) {
      setError("Es gibt noch Einträge, die geprüft werden müssen");
      return;
    }

    setCommitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/ingestion/${resolvedParams.jobId}/commit`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Übernahme fehlgeschlagen");
      }

      setCommitResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler bei der Übernahme");
    } finally {
      setCommitting(false);
    }
  };

  // Group entries by category for summary
  const groupedEntries = stagedEntries.reduce((acc, entry) => {
    const key = `${entry.targetCategoryFlowType}-${entry.targetCategoryName}`;
    if (!acc[key]) {
      acc[key] = {
        categoryName: entry.targetCategoryName,
        flowType: entry.targetCategoryFlowType,
        entries: [],
        totalCents: BigInt(0),
      };
    }
    acc[key].entries.push(entry);
    acc[key].totalCents += BigInt(entry.amountCents);
    return acc;
  }, {} as Record<string, { categoryName: string; flowType: string; entries: StagedEntry[]; totalCents: bigint }>);

  const totalInflows = Object.values(groupedEntries)
    .filter((g) => g.flowType === "INFLOW")
    .reduce((sum, g) => sum + g.totalCents, BigInt(0));

  const totalOutflows = Object.values(groupedEntries)
    .filter((g) => g.flowType === "OUTFLOW")
    .reduce((sum, g) => sum + g.totalCents, BigInt(0));

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

  if (commitResult) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
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
          <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-4">
            Daten erfolgreich übernommen
          </h2>
          <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto mb-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-[var(--primary)]">
                {commitResult.createdLines}
              </div>
              <div className="text-sm text-[var(--secondary)]">
                Neue Positionen
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[var(--success)]">
                {commitResult.createdValues}
              </div>
              <div className="text-sm text-[var(--secondary)]">
                Neue Werte
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[var(--warning)]">
                {commitResult.updatedValues}
              </div>
              <div className="text-sm text-[var(--secondary)]">
                Aktualisiert
              </div>
            </div>
          </div>
          <div className="flex justify-center space-x-4">
            <Link href="/admin/ingestion" className="btn-secondary">
              Zurück zur Übersicht
            </Link>
            <Link href={`/admin/cases/${job?.caseId}`} className="btn-primary">
              Zum Fall
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!job || job.status !== "READY") {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <svg
            className="w-16 h-16 mx-auto text-[var(--warning)] mb-4"
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
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
            Import nicht bereit
          </h2>
          <p className="text-[var(--secondary)] mb-6">
            {job?.reviewableCount && job.reviewableCount > 0
              ? `Es gibt noch ${job.reviewableCount} Einträge, die geprüft werden müssen.`
              : "Der Import befindet sich nicht im Status 'Bereit'."}
          </p>
          <div className="flex justify-center space-x-4">
            <Link href={`/admin/ingestion/${resolvedParams.jobId}`} className="btn-secondary">
              Zurück zum Import
            </Link>
            {job?.reviewableCount && job.reviewableCount > 0 && (
              <Link href={`/admin/ingestion/${resolvedParams.jobId}/review`} className="btn-primary">
                Zur Prüfung
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href={`/admin/ingestion/${resolvedParams.jobId}`}
            className="text-[var(--secondary)] hover:text-[var(--foreground)]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">
              Daten übernehmen
            </h1>
            <p className="text-sm text-[var(--secondary)]">
              {job.fileName} - {job.case.caseNumber}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Einträge</div>
          <div className="text-2xl font-semibold text-[var(--foreground)]">
            {stagedEntries.length}
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Kategorien</div>
          <div className="text-2xl font-semibold text-[var(--foreground)]">
            {Object.keys(groupedEntries).length}
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Einzahlungen</div>
          <div className="text-2xl font-semibold text-[var(--success)]">
            {formatAmount(totalInflows.toString())} EUR
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Auszahlungen</div>
          <div className="text-2xl font-semibold text-[var(--danger)]">
            {formatAmount(totalOutflows.toString())} EUR
          </div>
        </div>
      </div>

      {/* Grouped Summary */}
      <div className="admin-card">
        <div className="p-4 border-b border-[var(--border)]">
          <h3 className="font-medium text-[var(--foreground)]">
            Zusammenfassung nach Kategorie
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Kategorie</th>
                <th>Art</th>
                <th className="text-right">Anzahl</th>
                <th className="text-right">Summe</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(groupedEntries)
                .sort((a, b) => {
                  if (a.flowType !== b.flowType) {
                    return a.flowType === "INFLOW" ? -1 : 1;
                  }
                  return a.categoryName.localeCompare(b.categoryName);
                })
                .map((group) => (
                  <tr key={`${group.flowType}-${group.categoryName}`}>
                    <td className="font-medium">{group.categoryName}</td>
                    <td>
                      <span
                        className={`badge ${
                          group.flowType === "INFLOW"
                            ? "badge-success"
                            : "badge-danger"
                        }`}
                      >
                        {group.flowType === "INFLOW" ? "Einzahlung" : "Auszahlung"}
                      </span>
                    </td>
                    <td className="text-right">{group.entries.length}</td>
                    <td className="text-right font-mono">
                      {formatAmount(group.totalCents.toString())} EUR
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-semibold">
                <td colSpan={2}>Gesamt</td>
                <td className="text-right">{stagedEntries.length}</td>
                <td className="text-right font-mono">
                  {formatAmount((totalInflows - totalOutflows).toString())} EUR
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Integrity Info */}
      <div className="admin-card p-4">
        <div className="flex items-center space-x-4">
          <svg
            className="w-8 h-8 text-[var(--primary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <div>
            <div className="font-medium text-[var(--foreground)]">
              Dateiintegrität verifiziert
            </div>
            <div className="text-sm text-[var(--muted)] font-mono">
              SHA-256: {job.fileHashSha256}
            </div>
          </div>
        </div>
      </div>

      {/* Commit Button */}
      <div className="flex justify-end space-x-4">
        <Link href={`/admin/ingestion/${resolvedParams.jobId}`} className="btn-secondary">
          Abbrechen
        </Link>
        <button
          onClick={handleCommit}
          disabled={committing}
          className="btn-primary px-8"
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
              Übernehme...
            </span>
          ) : (
            "Daten jetzt übernehmen"
          )}
        </button>
      </div>
    </div>
  );
}
