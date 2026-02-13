"use client";

import { useEffect, useMemo } from "react";
import { formatCurrency } from "@/types/dashboard";
import { REVENUE_COLORS } from "@/lib/revenue-helpers";

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

  // Sortiert nach Datum (neueste zuerst)
  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate)),
    [entries]
  );

  // Summary
  const summary = useMemo(() => {
    let total = BigInt(0);
    let neumasse = BigInt(0);
    let altmasse = BigInt(0);
    for (const e of entries) {
      total += BigInt(e.amountCents);
      neumasse += BigInt(e.neumasseAmountCents);
      altmasse += BigInt(e.altmasseAmountCents);
    }
    return { total, neumasse, altmasse, count: entries.length };
  }, [entries]);

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
            <span className="text-[var(--secondary)]">{summary.count} Buchung{summary.count !== 1 ? "en" : ""}</span>
          </div>
        </div>

        {/* Body – Tabelle */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2.5 px-4 font-medium text-[var(--secondary)]">Datum</th>
                <th className="text-left py-2.5 px-4 font-medium text-[var(--secondary)]">Quelle</th>
                <th className="text-left py-2.5 px-4 font-medium text-[var(--secondary)]">Standort</th>
                <th className="text-left py-2.5 px-4 font-medium text-[var(--secondary)]">Beschreibung</th>
                <th className="text-right py-2.5 px-4 font-medium text-[var(--secondary)]">Betrag</th>
                <th className="text-right py-2.5 px-4 font-medium text-[var(--secondary)]">Alt/Neu</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry, idx) => (
                <tr
                  key={idx}
                  className="border-b border-[var(--border)] hover:bg-gray-50"
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
        </div>
      </div>
    </>
  );
}
