"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "@/types/dashboard";
import {
  groupByCategoryTag,
  REVENUE_COLORS,
  type RevenueEntryForGrouping,
} from "@/lib/revenue-helpers";

interface RevenueEntry extends RevenueEntryForGrouping {
  counterpartyId: string | null;
  counterpartyName: string;
  locationId: string | null;
  locationName: string;
  periodIndex: number;
  estateRatio: number;
  description: string;
}

interface RevenueTableProps {
  entries: RevenueEntry[];
  months: number;
  showSummary?: boolean;
}

export default function RevenueTable({
  entries,
  months,
  showSummary = true,
}: RevenueTableProps) {
  const [viewMode, setViewMode] = useState<"summary" | "details">(
    showSummary ? "summary" : "details"
  );

  // Summary: gruppiert nach categoryTag via shared helper
  const grouped = useMemo(() => groupByCategoryTag(entries, 5), [entries]);

  // Group entries by month for details view
  const entriesByMonth = useMemo(() => {
    const byMonth = new Map<string, RevenueEntry[]>();

    for (const entry of entries) {
      const monthKey = entry.periodLabel;
      if (!byMonth.has(monthKey)) {
        byMonth.set(monthKey, []);
      }
      byMonth.get(monthKey)!.push(entry);
    }

    return byMonth;
  }, [entries]);

  // Calculate grand totals from entries
  const { grandTotal, grandNeumasseTotal, grandAltmasseTotal } = useMemo(() => ({
    grandTotal: entries.reduce((sum, e) => sum + BigInt(e.amountCents), BigInt(0)),
    grandNeumasseTotal: entries.reduce((sum, e) => sum + BigInt(e.neumasseAmountCents), BigInt(0)),
    grandAltmasseTotal: entries.reduce((sum, e) => sum + BigInt(e.altmasseAmountCents), BigInt(0)),
  }), [entries]);

  if (entries.length === 0) {
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
          Nach Kategorie
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
        /* Summary View - By categoryTag */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped.map((group, idx) => (
              <div
                key={group.tag}
                className="p-4 rounded-lg border border-[var(--border)] bg-gray-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: REVENUE_COLORS[idx % REVENUE_COLORS.length] }}
                    />
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {group.label}
                    </span>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${REVENUE_COLORS[idx % REVENUE_COLORS.length]}20`,
                      color: REVENUE_COLORS[idx % REVENUE_COLORS.length],
                    }}
                  >
                    {grandTotal > BigInt(0)
                      ? `${((Number(group.totalCents) / Number(grandTotal)) * 100).toFixed(0)}%`
                      : "0%"}
                  </span>
                </div>
                <div className="text-2xl font-bold text-[var(--foreground)]">
                  {formatCurrency(group.totalCents)}
                </div>
                <div className="text-xs text-[var(--secondary)] mt-2 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span>davon Neumasse:</span>
                    <span className="font-medium text-green-600">{formatCurrency(group.neumasseTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>davon Altmasse:</span>
                    <span className="font-medium text-amber-600">{formatCurrency(group.altmasseTotal)}</span>
                  </div>
                </div>
                <div className="text-xs text-[var(--secondary)] mt-2 pt-2 border-t border-gray-200">
                  {group.entryCount} Buchung{group.entryCount !== 1 ? "en" : ""}
                </div>
              </div>
            ))}
          </div>

          {/* Grand Total */}
          <div className="p-4 rounded-lg bg-[var(--primary)] text-white space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">Gesamteinnahmen ({months} Monate)</span>
              <span className="text-2xl font-bold">{formatCurrency(grandTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm opacity-90 pt-2 border-t border-white/20">
              <span>davon Neumasse:</span>
              <span className="font-semibold">{formatCurrency(grandNeumasseTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm opacity-90">
              <span>davon Altmasse:</span>
              <span className="font-semibold">{formatCurrency(grandAltmasseTotal)}</span>
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
                <th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">Alt/Neu</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(entriesByMonth.entries()).map(([month, monthEntries]) => (
                <>
                  {/* Month Header */}
                  <tr key={`header-${month}`} className="bg-gray-50">
                    <td colSpan={6} className="py-2 px-4 font-semibold text-[var(--foreground)]">
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
                      <td className="py-3 px-4 text-right text-xs">
                        <div className="space-y-0.5">
                          {BigInt(entry.altmasseAmountCents) > BigInt(0) && (
                            <div className="text-amber-600">
                              Alt: {formatCurrency(entry.altmasseAmountCents)}
                            </div>
                          )}
                          {BigInt(entry.neumasseAmountCents) > BigInt(0) && (
                            <div className="text-green-600">
                              Neu: {formatCurrency(entry.neumasseAmountCents)}
                            </div>
                          )}
                          {BigInt(entry.altmasseAmountCents) === BigInt(0) && BigInt(entry.neumasseAmountCents) === BigInt(0) && (
                            <div className="text-gray-400">-</div>
                          )}
                        </div>
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
                <td className="py-3 px-4 text-right text-xs space-y-0.5">
                  <div>Alt: {formatCurrency(grandAltmasseTotal)}</div>
                  <div>Neu: {formatCurrency(grandNeumasseTotal)}</div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
