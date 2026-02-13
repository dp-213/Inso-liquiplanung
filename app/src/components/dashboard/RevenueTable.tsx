"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "@/types/dashboard";
import {
  groupByCategoryTag,
  REVENUE_COLORS,
  OHNE_TAG,
  SONSTIGE_TAG,
  type RevenueEntryForGrouping,
} from "@/lib/revenue-helpers";
import { useTableControls } from "@/hooks/useTableControls";
import { SortableHeader } from "@/components/admin/TableToolbar";
import RevenueCategoryDrawer from "./RevenueCategoryDrawer";

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
  const [selectedCategory, setSelectedCategory] = useState<{
    tag: string;
    label: string;
    colorIndex: number;
  } | null>(null);

  // Summary: gruppiert nach categoryTag via shared helper
  const grouped = useMemo(() => groupByCategoryTag(entries, 5), [entries]);

  // Entries für ausgewählte Kategorie filtern
  const drawerEntries = useMemo(() => {
    if (!selectedCategory) return [];
    const tag = selectedCategory.tag;
    if (tag === SONSTIGE_TAG) {
      const topTags = new Set(grouped.filter((g) => g.tag !== SONSTIGE_TAG).map((g) => g.tag));
      return entries.filter((e) => {
        const entryTag = e.categoryTag || OHNE_TAG;
        return !topTags.has(entryTag);
      });
    }
    if (tag === OHNE_TAG) {
      return entries.filter((e) => !e.categoryTag);
    }
    return entries.filter((e) => e.categoryTag === tag);
  }, [selectedCategory, entries, grouped]);

  // Detail-Ansicht: useTableControls für flache sortierbare Tabelle
  const { search, setSearch, sortKey, sortDir, toggleSort, result: filtered } =
    useTableControls(entries, {
      searchFields: ["counterpartyName", "locationName", "description", "periodLabel"],
      defaultSort: { key: "transactionDate", dir: "desc" },
    });

  // Grand Totals (immer auf Basis aller Entries für Summary)
  const { grandTotal, grandNeumasseTotal, grandAltmasseTotal } = useMemo(() => ({
    grandTotal: entries.reduce((sum, e) => sum + BigInt(e.amountCents), BigInt(0)),
    grandNeumasseTotal: entries.reduce((sum, e) => sum + BigInt(e.neumasseAmountCents), BigInt(0)),
    grandAltmasseTotal: entries.reduce((sum, e) => sum + BigInt(e.altmasseAmountCents), BigInt(0)),
  }), [entries]);

  // Footer-Summen für Detail-Ansicht: basierend auf gefilterten Ergebnissen
  const filteredTotals = useMemo(() => ({
    total: filtered.reduce((sum, e) => sum + BigInt(e.amountCents), BigInt(0)),
    neumasse: filtered.reduce((sum, e) => sum + BigInt(e.neumasseAmountCents), BigInt(0)),
    altmasse: filtered.reduce((sum, e) => sum + BigInt(e.altmasseAmountCents), BigInt(0)),
  }), [filtered]);

  const totalLabel = months === 0 ? "Gesamteinnahmen (gesamt)" : `Gesamteinnahmen (${months} Monate)`;

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

  const footerLabel = filtered.length === entries.length
    ? "Gesamt"
    : `Gesamt (${filtered.length} von ${entries.length})`;

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
                onClick={() =>
                  setSelectedCategory({
                    tag: group.tag,
                    label: group.label,
                    colorIndex: idx,
                  })
                }
                className="p-4 rounded-lg border border-[var(--border)] bg-gray-50 cursor-pointer hover:shadow-md hover:border-[var(--primary)] transition-all"
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
              <span className="font-medium">{totalLabel}</span>
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
        /* Details View - Flat sortable table */
        <div className="space-y-0">
          {/* Kompakte Suchleiste */}
          <div className="py-2 flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buchungen durchsuchen..."
                className="input w-full pl-8 py-1.5 text-sm"
              />
            </div>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-xs text-[var(--primary)] hover:underline whitespace-nowrap"
              >
                Zurücksetzen
              </button>
            )}
            <span className="text-xs text-[var(--muted)] ml-auto whitespace-nowrap">
              {filtered.length === entries.length
                ? `${entries.length} Buchungen`
                : `${filtered.length} von ${entries.length} Buchungen`}
            </span>
          </div>

          {filtered.length === 0 && search ? (
            <div className="p-8 text-center bg-gray-50 rounded-lg">
              <p className="text-[var(--muted)]">
                Keine Treffer für &bdquo;{search}&ldquo;
              </p>
              <button
                onClick={() => setSearch("")}
                className="mt-2 text-sm text-[var(--primary)] hover:underline"
              >
                Suche zurücksetzen
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <SortableHeader
                      label="Monat"
                      sortKey="periodLabel"
                      currentSortKey={sortKey as string}
                      currentSortDir={sortDir}
                      onToggle={(k) => toggleSort(k as keyof RevenueEntry)}
                      className="py-3 px-4 text-xs font-medium text-[var(--secondary)]"
                    />
                    <SortableHeader
                      label="Datum"
                      sortKey="transactionDate"
                      currentSortKey={sortKey as string}
                      currentSortDir={sortDir}
                      onToggle={(k) => toggleSort(k as keyof RevenueEntry)}
                      className="py-3 px-4 text-xs font-medium text-[var(--secondary)]"
                    />
                    <SortableHeader
                      label="Quelle"
                      sortKey="counterpartyName"
                      currentSortKey={sortKey as string}
                      currentSortDir={sortDir}
                      onToggle={(k) => toggleSort(k as keyof RevenueEntry)}
                      className="py-3 px-4 text-xs font-medium text-[var(--secondary)]"
                    />
                    <SortableHeader
                      label="Standort"
                      sortKey="locationName"
                      currentSortKey={sortKey as string}
                      currentSortDir={sortDir}
                      onToggle={(k) => toggleSort(k as keyof RevenueEntry)}
                      className="py-3 px-4 text-xs font-medium text-[var(--secondary)]"
                    />
                    <SortableHeader
                      label="Beschreibung"
                      sortKey="description"
                      currentSortKey={sortKey as string}
                      currentSortDir={sortDir}
                      onToggle={(k) => toggleSort(k as keyof RevenueEntry)}
                      className="py-3 px-4 text-xs font-medium text-[var(--secondary)]"
                    />
                    <SortableHeader
                      label="Betrag"
                      sortKey="amountCents"
                      currentSortKey={sortKey as string}
                      currentSortDir={sortDir}
                      onToggle={(k) => toggleSort(k as keyof RevenueEntry)}
                      className="py-3 px-4 text-xs font-medium text-[var(--secondary)]"
                      align="right"
                    />
                    <th className="text-right py-3 px-4 font-medium text-[var(--secondary)] text-xs">Alt/Neu</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-[var(--border)] hover:bg-blue-50/50 ${idx % 2 === 1 ? "bg-gray-50/50" : ""}`}
                    >
                      <td className="py-3 px-4 text-[var(--secondary)] whitespace-nowrap">
                        {entry.periodLabel}
                      </td>
                      <td className="py-3 px-4 text-[var(--secondary)] whitespace-nowrap">
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
                      <td className="py-3 px-4 text-right font-medium text-green-600 whitespace-nowrap">
                        {formatCurrency(entry.amountCents)}
                      </td>
                      <td className="py-3 px-4 text-right text-xs whitespace-nowrap">
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
                </tbody>
                <tfoot>
                  <tr className="bg-[var(--primary)] text-white">
                    <td colSpan={5} className="py-3 px-4 font-medium">{footerLabel}</td>
                    <td className="py-3 px-4 text-right font-bold whitespace-nowrap">
                      {formatCurrency(filteredTotals.total)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs whitespace-nowrap space-y-0.5">
                      <div>Alt: {formatCurrency(filteredTotals.altmasse)}</div>
                      <div>Neu: {formatCurrency(filteredTotals.neumasse)}</div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Category Detail Drawer */}
      {selectedCategory && (
        <RevenueCategoryDrawer
          categoryLabel={selectedCategory.label}
          colorIndex={selectedCategory.colorIndex}
          entries={drawerEntries}
          onClose={() => setSelectedCategory(null)}
        />
      )}
    </div>
  );
}
