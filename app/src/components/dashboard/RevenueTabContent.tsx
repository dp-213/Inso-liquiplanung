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
  months: number;
  scope: "GLOBAL" | "LOCATION_VELBERT" | "LOCATION_UCKERATH_EITORF";
}

/**
 * Wrapper für den Revenue-Tab: fetcht Daten einmal und gibt sie an Chart + Tabelle weiter.
 */
export default function RevenueTabContent({
  caseId,
  months,
  scope,
}: RevenueTabContentProps) {
  const [entries, setEntries] = useState<RevenueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/cases/${caseId}/ledger/revenue?months=${months}&scope=${scope}`,
          { credentials: "include" }
        );

        if (res.ok) {
          const data = await res.json();
          setEntries(data.entries || []);
        } else {
          setError("Fehler beim Laden der Einnahmen-Daten");
        }
      } catch {
        setError("Fehler beim Laden der Einnahmen-Daten");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId, months, scope]);

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

  return (
    <div className="space-y-6">
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
          Einnahmen-Entwicklung
        </h2>
        <p className="text-sm text-[var(--secondary)] mb-4">
          Tatsächliche Zahlungseingänge nach Kategorie. Nur IST-Daten.
        </p>
        <RevenueTrendChart entries={entries} />
      </div>
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Einnahmen nach Kategorie
        </h2>
        <RevenueTable entries={entries} months={months} showSummary={true} />
      </div>
    </div>
  );
}
