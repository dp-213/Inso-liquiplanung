"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LedgerEntryResponse, ValueType, LegalBucket } from "@/lib/ledger";
import { formatAllocationSource, formatCategoryTagSource } from "@/lib/ledger/format-helpers";

const VALUE_TYPE_LABELS: Record<ValueType, string> = {
  IST: "IST",
  PLAN: "PLAN",
};

const LEGAL_BUCKET_LABELS: Record<LegalBucket, string> = {
  MASSE: "Masse",
  ABSONDERUNG: "Absonderung",
  NEUTRAL: "Neutral",
  UNKNOWN: "Unbekannt",
};

interface PeriodInfo {
  periodIndex: number;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  periodType: string;
}

interface LedgerDrillDownModalProps {
  caseId: string;
  periodIndex: number;
  onClose: () => void;
}

export default function LedgerDrillDownModal({
  caseId,
  periodIndex,
  onClose,
}: LedgerDrillDownModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<LedgerEntryResponse[]>([]);
  const [periodInfo, setPeriodInfo] = useState<PeriodInfo | null>(null);
  const [stats, setStats] = useState<{
    totalCount: number;
    totalInflows: string;
    totalOutflows: string;
    netAmount: string;
  } | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/cases/${caseId}/ledger/period/${periodIndex}`);

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Fehler beim Laden");
        }

        const data = await res.json();
        setEntries(data.entries || []);
        setPeriodInfo(data.periodInfo);
        setStats({
          totalCount: data.totalCount || 0,
          totalInflows: data.totalInflows || "0",
          totalOutflows: data.totalOutflows || "0",
          netAmount: data.netAmount || "0",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId, periodIndex]);

  const formatCurrency = (cents: string | number): string => {
    const amount = typeof cents === "string" ? parseInt(cents) : cents;
    return (amount / 100).toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
    });
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getBucketBadgeClass = (bucket: LegalBucket): string => {
    switch (bucket) {
      case "MASSE":
        return "badge-success";
      case "ABSONDERUNG":
        return "badge-warning";
      case "NEUTRAL":
        return "badge-info";
      case "UNKNOWN":
      default:
        return "badge-neutral";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Ledger-Einträge: {periodInfo?.periodLabel || `Periode ${periodIndex + 1}`}
            </h2>
            {periodInfo && (
              <p className="text-sm text-[var(--muted)]">
                {formatDate(periodInfo.periodStart)} - {formatDate(periodInfo.periodEnd)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--foreground)] p-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats */}
        {stats && !loading && (
          <div className="px-6 py-3 bg-gray-50 border-b border-[var(--border)] grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-[var(--muted)]">Einträge:</span>{" "}
              <span className="font-medium">{stats.totalCount}</span>
            </div>
            <div>
              <span className="text-[var(--muted)]">Einzahlungen:</span>{" "}
              <span className="font-medium text-[var(--success)]">{formatCurrency(stats.totalInflows)}</span>
            </div>
            <div>
              <span className="text-[var(--muted)]">Auszahlungen:</span>{" "}
              <span className="font-medium text-[var(--danger)]">{formatCurrency(stats.totalOutflows)}</span>
            </div>
            <div>
              <span className="text-[var(--muted)]">Netto:</span>{" "}
              <span className={`font-medium ${parseInt(stats.netAmount) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                {formatCurrency(stats.netAmount)}
              </span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-[var(--danger)]">{error}</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted)]">
              Keine Ledger-Einträge für diese Periode vorhanden
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Beschreibung</th>
                  <th className="text-right">Betrag</th>
                  <th>Typ</th>
                  <th>Status</th>
                  <th>Category Tag</th>
                  <th>Alt/Neu</th>
                  <th>Quelle</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const amount = parseInt(entry.amountCents);
                  const isInflow = amount >= 0;

                  return (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap text-sm">
                        {formatDate(entry.transactionDate)}
                      </td>
                      <td>
                        <div className="max-w-xs">
                          <div className="font-medium text-[var(--foreground)] text-sm truncate">
                            {entry.description}
                          </div>
                          {entry.note && (
                            <div className="text-xs text-[var(--muted)] truncate">
                              {entry.note}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className={`text-right font-mono text-sm whitespace-nowrap ${
                        isInflow ? "text-[var(--success)]" : "text-[var(--danger)]"
                      }`}>
                        {formatCurrency(entry.amountCents)}
                      </td>
                      <td>
                        <span className={`badge text-xs ${entry.valueType === "IST" ? "badge-success" : "badge-info"}`}>
                          {VALUE_TYPE_LABELS[entry.valueType]}
                        </span>
                      </td>
                      <td>
                        <span className={`badge text-xs ${getBucketBadgeClass(entry.legalBucket)}`}>
                          {LEGAL_BUCKET_LABELS[entry.legalBucket]}
                        </span>
                      </td>
                      <td>
                        {entry.categoryTag ? (
                          <span
                            className="badge badge-info text-xs cursor-help"
                            title={`${formatCategoryTagSource(entry.categoryTagSource)}: ${entry.categoryTagNote || '-'}`}
                          >
                            {entry.categoryTag}
                          </span>
                        ) : (
                          <span className="text-[var(--muted)] text-xs">-</span>
                        )}
                      </td>
                      <td>
                        {entry.estateAllocation ? (
                          <span
                            className={`badge text-xs cursor-help ${
                              entry.estateAllocation === 'ALTMASSE' ? 'badge-warning' :
                              entry.estateAllocation === 'NEUMASSE' ? 'badge-success' :
                              entry.estateAllocation === 'MIXED' ? 'badge-info' :
                              'badge-neutral'
                            }`}
                            title={`${formatAllocationSource(entry.allocationSource)}: ${entry.allocationNote || '-'}`}
                          >
                            {entry.estateAllocation}
                            {entry.estateRatio && entry.estateAllocation === 'MIXED' && (
                              <span className="ml-1">({(parseFloat(entry.estateRatio) * 100).toFixed(1)}%)</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-[var(--muted)] text-xs">-</span>
                        )}
                      </td>
                      <td className="text-sm text-[var(--muted)]">
                        {entry.bookingSource || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between bg-gray-50">
          <Link
            href={`/admin/cases/${caseId}/ledger?from=${periodInfo?.periodStart?.slice(0, 10) || ""}&to=${periodInfo?.periodEnd?.slice(0, 10) || ""}`}
            className="text-[var(--primary)] hover:underline text-sm"
          >
            Im Zahlungsregister öffnen
          </Link>
          <button onClick={onClose} className="btn-secondary">
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
