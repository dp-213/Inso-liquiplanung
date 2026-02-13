"use client";

import { useState, useEffect } from "react";
import RevenueTrendChart from "./RevenueTrendChart";
import RevenueTable from "./RevenueTable";

interface RevenueEntry {
  categoryTag: string | null;
  amountCents: string;
  neumasseAmountCents: string;
  altmasseAmountCents: string;
  periodLabel: string;
  transactionDate: string;
  counterpartyId: string | null;
  counterpartyName: string;
  locationId: string | null;
  locationName: string;
  periodIndex: number;
  estateRatio: number;
  description: string;
}

interface RevenueTabContentProps {
  caseId: string;
  scope: "GLOBAL" | "LOCATION_VELBERT" | "LOCATION_UCKERATH_EITORF";
}

const MONTH_OPTIONS = [
  { label: "3 Monate", value: 3 },
  { label: "6 Monate", value: 6 },
  { label: "12 Monate", value: 12 },
  { label: "Alle", value: 0 },
] as const;

/**
 * Wrapper für den Revenue-Tab: fetcht Daten einmal und gibt sie an Chart + Tabelle weiter.
 */
export default function RevenueTabContent({
  caseId,
  scope,
}: RevenueTabContentProps) {
  const [months, setMonths] = useState(6);
  const [entries, setEntries] = useState<RevenueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/cases/${caseId}/ledger/revenue?months=${months}&scope=${scope}`,
          { credentials: "include", signal: controller.signal }
        );

        if (res.ok) {
          const data = await res.json();
          setEntries(data.entries || []);
        } else {
          setError("Fehler beim Laden der Einnahmen-Daten");
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Fehler beim Laden der Einnahmen-Daten");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => controller.abort();
  }, [caseId, months, scope]);

  // Initialer Ladevorgang: Spinner
  const isInitialLoad = loading && entries.length === 0;

  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-[var(--secondary)]">Lade Einnahmen-Daten...</span>
      </div>
    );
  }

  if (error && entries.length === 0) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Monats-Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-[var(--secondary)] mr-1">Zeitraum:</span>
        {MONTH_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setMonths(opt.value)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              months === opt.value
                ? "bg-[var(--primary)] text-white"
                : "bg-gray-100 text-[var(--secondary)] hover:bg-gray-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
        {loading && (
          <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin ml-2" />
        )}
      </div>

      <div className={`admin-card p-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
          Einnahmen-Entwicklung
        </h2>
        <p className="text-sm text-[var(--secondary)] mb-4">
          Tatsächliche Zahlungseingänge nach Kategorie. Nur IST-Daten.
        </p>
        <RevenueTrendChart entries={entries} />
      </div>
      <div className={`admin-card p-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Einnahmen nach Kategorie
        </h2>
        <RevenueTable entries={entries} months={months} showSummary={true} />
      </div>
    </div>
  );
}
