"use client";

import { useEffect, useMemo } from "react";
import { formatCurrency } from "@/types/dashboard";
import { REVENUE_COLORS } from "@/lib/revenue-helpers";
import { useTableControls } from "@/hooks/useTableControls";
import { SortableHeader } from "@/components/admin/TableToolbar";

interface RevenueEntry {
  counterpartyId: string | null;
  counterpartyName: string;
  locationId: string | null;
  locationName: string;
  categoryTag: string | null;
  periodIndex: number;
  periodLabel: string;
  amountCents: string;
  neumasseAmountCents: string;
  altmasseAmountCents: string;
  estateRatio: number;
  transactionDate: string;
  description: string;
}

interface RevenueCategoryDrawerProps {
  categoryLabel: string;
  colorIndex: number;
  entries: RevenueEntry[];
  onClose: () => void;
}

export default function RevenueCategoryDrawer({
  categoryLabel,
  colorIndex,
  entries,
  onClose,
}: RevenueCategoryDrawerProps) {
  const color = REVENUE_COLORS[colorIndex % REVENUE_COLORS.length];

  // Escape schließt Drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const { search, setSearch, sortKey, sortDir, toggleSort, result: filtered } =
    useTableControls(entries, {
      searchFields: ["counterpartyName", "locationName", "description"],
      defaultSort: { key: "transactionDate", dir: "desc" },
    });

  // Summary basierend auf gefilterten Entries
  const summary = useMemo(() => {
    let total = BigInt(0);
    let neumasse = BigInt(0);
    let altmasse = BigInt(0);
    for (const e of filtered) {
      total += BigInt(e.amountCents);
      neumasse += BigInt(e.neumasseAmountCents);
      altmasse += BigInt(e.altmasseAmountCents);
    }
    return { total, neumasse, altmasse };
  }, [filtered]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        style={{ animation: "150ms ease-out forwards backdropFadeIn" }}
        onClick={onClose}
      />

      {/* Slide-over */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl flex flex-col"
        style={{ animation: "200ms ease-out forwards drawerSlideIn" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <h2 className="text-lg font-bold text-[var(--foreground)]">{categoryLabel}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100 text-[var(--muted)]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary */}
        <div className="px-6 py-3 bg-gray-50 border-b border-[var(--border)] flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-[var(--secondary)]">Gesamt: </span>
            <span className="font-semibold text-[var(--foreground)]">{formatCurrency(summary.total)}</span>
          </div>
          <div>
            <span className="text-[var(--secondary)]">Neumasse: </span>
            <span className="font-semibold text-green-600">{formatCurrency(summary.neumasse)}</span>
          </div>
          <div>
            <span className="text-[var(--secondary)]">Altmasse: </span>
            <span className="font-semibold text-amber-600">{formatCurrency(summary.altmasse)}</span>
          </div>
          <div>
            <span className="text-[var(--secondary)]">
              {filtered.length === entries.length
                ? `${entries.length} Buchung${entries.length !== 1 ? "en" : ""}`
                : `${filtered.length} von ${entries.length} Buchungen`}
            </span>
          </div>
        </div>

        {/* Kompakte Suchleiste */}
        <div className="px-6 py-2 border-b border-[var(--border)] flex items-center gap-2">
          <div className="relative flex-1">
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
        </div>

        {/* Body – Tabelle */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && search ? (
            <div className="p-8 text-center">
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
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-[var(--border)]">
                  <SortableHeader
                    label="Datum"
                    sortKey="transactionDate"
                    currentSortKey={sortKey as string}
                    currentSortDir={sortDir}
                    onToggle={(k) => toggleSort(k as keyof RevenueEntry)}
                    className="py-2.5 px-4 text-xs font-medium text-[var(--secondary)]"
                  />
                  <SortableHeader
                    label="Quelle"
                    sortKey="counterpartyName"
                    currentSortKey={sortKey as string}
                    currentSortDir={sortDir}
                    onToggle={(k) => toggleSort(k as keyof RevenueEntry)}
                    className="py-2.5 px-4 text-xs font-medium text-[var(--secondary)]"
                  />
                  <SortableHeader
                    label="Standort"
                    sortKey="locationName"
                    currentSortKey={sortKey as string}
                    currentSortDir={sortDir}
                    onToggle={(k) => toggleSort(k as keyof RevenueEntry)}
                    className="py-2.5 px-4 text-xs font-medium text-[var(--secondary)]"
                  />
                  <SortableHeader
                    label="Beschreibung"
                    sortKey="description"
                    currentSortKey={sortKey as string}
                    currentSortDir={sortDir}
                    onToggle={(k) => toggleSort(k as keyof RevenueEntry)}
                    className="py-2.5 px-4 text-xs font-medium text-[var(--secondary)]"
                  />
                  <SortableHeader
                    label="Betrag"
                    sortKey="amountCents"
                    currentSortKey={sortKey as string}
                    currentSortDir={sortDir}
                    onToggle={(k) => toggleSort(k as keyof RevenueEntry)}
                    className="py-2.5 px-4 text-xs font-medium text-[var(--secondary)]"
                    align="right"
                  />
                  <th className="text-right py-2.5 px-4 font-medium text-[var(--secondary)] text-xs">Alt/Neu</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-[var(--border)] hover:bg-blue-50/50 ${idx % 2 === 1 ? "bg-gray-50/50" : ""}`}
                  >
                    <td className="py-2.5 px-4 text-[var(--secondary)] whitespace-nowrap">
                      {new Date(entry.transactionDate).toLocaleDateString("de-DE")}
                    </td>
                    <td className="py-2.5 px-4 font-medium">
                      {entry.counterpartyName}
                    </td>
                    <td className="py-2.5 px-4 text-[var(--secondary)]">
                      {entry.locationName}
                    </td>
                    <td className="py-2.5 px-4 text-[var(--secondary)] max-w-[200px] truncate">
                      {entry.description}
                    </td>
                    <td className="py-2.5 px-4 text-right font-medium text-green-600 whitespace-nowrap">
                      {formatCurrency(entry.amountCents)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-xs whitespace-nowrap">
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
                      {BigInt(entry.altmasseAmountCents) === BigInt(0) &&
                        BigInt(entry.neumasseAmountCents) === BigInt(0) && (
                          <div className="text-gray-400">-</div>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
