"use client";

import { useState, useEffect, useMemo } from "react";
import { formatCurrency } from "@/types/dashboard";

interface RevenueEntry {
  counterpartyId: string | null;
  counterpartyName: string;
  locationId: string | null;
  locationName: string;
  periodIndex: number;
  periodLabel: string;
  amountCents: string;
  transactionDate: string;
  description: string;
}

interface RevenueSummary {
  counterpartyId: string | null;
  counterpartyName: string;
  totalCents: string;
  entryCount: number;
}

interface RevenueTableProps {
  caseId: string;
  months?: number;
  showSummary?: boolean;
}

// Farben für Quellen
const SOURCE_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Green
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#84cc16", // Lime
];

export default function RevenueTable({
  caseId,
  months = 6,
  showSummary = true,
}: RevenueTableProps) {
  const [entries, setEntries] = useState<RevenueEntry[]>([]);
  const [summary, setSummary] = useState<RevenueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"summary" | "details">(
    showSummary ? "summary" : "details"
  );

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // Fetch both summary and details
        const [summaryRes, detailsRes] = await Promise.all([
          fetch(`/api/cases/${caseId}/ledger/revenue?months=${months}&summarize=true`),
          fetch(`/api/cases/${caseId}/ledger/revenue?months=${months}`),
        ]);

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setSummary(summaryData.summary || []);
        }

        if (detailsRes.ok) {
          const detailsData = await detailsRes.json();
          setEntries(detailsData.entries || []);
        }
      } catch (err) {
        setError("Fehler beim Laden der Einnahmen-Daten");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId, months]);

  // Group entries by month for details view
  const entriesByMonth = useMemo(() => {
    const grouped = new Map<string, RevenueEntry[]>();

    for (const entry of entries) {
      const monthKey = entry.periodLabel;
      if (!grouped.has(monthKey)) {
        grouped.set(monthKey, []);
      }
      grouped.get(monthKey)!.push(entry);
    }

    return grouped;
  }, [entries]);

  // Calculate grand total
  const grandTotal = useMemo(() => {
    return summary.reduce((sum, s) => sum + BigInt(s.totalCents), BigInt(0));
  }, [summary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-[var(--secondary)]">Lade Einnahmen-Daten...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
      </div>
    );
  }

  if (summary.length === 0 && entries.length === 0) {
    return (
      <div className="p-8 bg-gray-50 rounded-lg text-center">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-[var(--muted)]">Keine Einnahmen im Zeitraum erfasst</p>
        <p className="text-sm text-[var(--secondary)] mt-1">
          Einnahmen werden automatisch aus dem Zahlungsregister aggregiert.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode("summary")}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            viewMode === "summary"
              ? "bg-[var(--primary)] text-white"
              : "bg-gray-100 text-[var(--secondary)] hover:bg-gray-200"
          }`}
        >
          Nach Quelle
        </button>
        <button
          onClick={() => setViewMode("details")}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            viewMode === "details"
              ? "bg-[var(--primary)] text-white"
              : "bg-gray-100 text-[var(--secondary)] hover:bg-gray-200"
          }`}
        >
          Detailansicht
        </button>
      </div>

      {viewMode === "summary" ? (
        /* Summary View - By Counterparty */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.map((source, idx) => (
              <div
                key={source.counterpartyId || `unknown-${idx}`}
                className="p-4 rounded-lg border border-[var(--border)] bg-gray-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: SOURCE_COLORS[idx % SOURCE_COLORS.length] }}
                    />
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {source.counterpartyName}
                    </span>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${SOURCE_COLORS[idx % SOURCE_COLORS.length]}20`,
                      color: SOURCE_COLORS[idx % SOURCE_COLORS.length],
                    }}
                  >
                    {grandTotal > BigInt(0)
                      ? `${((Number(source.totalCents) / Number(grandTotal)) * 100).toFixed(0)}%`
                      : "0%"}
                  </span>
                </div>
                <div className="text-2xl font-bold text-[var(--foreground)]">
                  {formatCurrency(source.totalCents)}
                </div>
                <div className="text-xs text-[var(--secondary)] mt-1">
                  {source.entryCount} Buchung{source.entryCount !== 1 ? "en" : ""}
                </div>
              </div>
            ))}
          </div>

          {/* Grand Total */}
          <div className="p-4 rounded-lg bg-[var(--primary)] text-white">
            <div className="flex items-center justify-between">
              <span className="font-medium">Gesamteinnahmen ({months} Monate)</span>
              <span className="text-2xl font-bold">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>
      ) : (
        /* Details View - Monthly Breakdown */
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Datum</th>
                <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Quelle</th>
                <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Standort</th>
                <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Beschreibung</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(entriesByMonth.entries()).map(([month, monthEntries]) => (
                <>
                  {/* Month Header */}
                  <tr key={`header-${month}`} className="bg-gray-50">
                    <td colSpan={5} className="py-2 px-4 font-semibold text-[var(--foreground)]">
                      {month}
                    </td>
                  </tr>
                  {/* Entries */}
                  {monthEntries.map((entry, idx) => (
                    <tr
                      key={`${month}-${idx}`}
                      className="border-b border-[var(--border)] hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 text-[var(--secondary)]">
                        {new Date(entry.transactionDate).toLocaleDateString("de-DE")}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium">{entry.counterpartyName}</span>
                      </td>
                      <td className="py-3 px-4 text-[var(--secondary)]">
                        {entry.locationName}
                      </td>
                      <td className="py-3 px-4 text-[var(--secondary)] max-w-xs truncate">
                        {entry.description}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-green-600">
                        {formatCurrency(entry.amountCents)}
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--primary)] text-white">
                <td colSpan={4} className="py-3 px-4 font-medium">Gesamt</td>
                <td className="py-3 px-4 text-right font-bold">
                  {formatCurrency(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
