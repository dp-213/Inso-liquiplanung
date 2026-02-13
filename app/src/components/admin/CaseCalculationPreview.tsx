"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface CalculationPreviewProps {
  caseId: string;
}

interface CalculationData {
  calculation: {
    openingBalanceCents: string;
    totalInflowsCents: string;
    totalOutflowsCents: string;
    totalNetCashflowCents: string;
    finalClosingBalanceCents: string;
    weeks: {
      weekLabel: string;
      closingBalanceCents: string;
    }[];
  };
}

export default function CaseCalculationPreview({ caseId }: CalculationPreviewProps) {
  const [data, setData] = useState<CalculationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCalculation() {
      try {
        const response = await fetch(`/api/cases/${caseId}/calculate`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("no-data");
            return;
          }
          throw new Error("Failed to fetch calculation");
        }
        const result = await response.json();
        setData(result);
      } catch {
        setError("error");
      } finally {
        setLoading(false);
      }
    }

    fetchCalculation();
  }, [caseId]);

  if (loading) {
    return (
      <div className="pt-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
          Berechnung wird geladen...
        </div>
      </div>
    );
  }

  if (error === "no-data") {
    return null;
  }

  if (error || !data || !data.calculation || !data.calculation.weeks) {
    return (
      <div className="pt-4 border-t border-[var(--border)]">
        <p className="text-sm text-[var(--muted)]">Vorschau nicht verfügbar</p>
      </div>
    );
  }

  const weeks = data.calculation.weeks;
  const finalBalance = BigInt(data.calculation.finalClosingBalanceCents);
  const minBalance = weeks.reduce((min, week) => {
    const balance = BigInt(week.closingBalanceCents);
    return balance < min ? balance : min;
  }, finalBalance);
  const criticalWeek = weeks.findIndex((week) => BigInt(week.closingBalanceCents) <= BigInt(0));

  const formatCurrency = (cents: bigint): string => {
    const euros = Number(cents) / 100;
    return euros.toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  return (
    <div className="pt-4 border-t border-[var(--border)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-[var(--foreground)]">Planungsvorschau</h3>
        <Link
          href={`/admin/cases/${caseId}/dashboard`}
          className="text-xs text-[var(--primary)] hover:underline"
        >
          Details anzeigen
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-[var(--muted)]">Endbestand (KW 13)</p>
          <p className={`font-bold ${finalBalance < BigInt(0) ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>
            {formatCurrency(finalBalance)}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-[var(--muted)]">Tiefster Stand</p>
          <p className={`font-bold ${minBalance < BigInt(0) ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>
            {formatCurrency(minBalance)}
          </p>
        </div>
      </div>

      {criticalWeek >= 0 && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800">Liquiditätsengpass erwartet</p>
              <p className="text-xs text-red-600">
                Unterdeckung ab {weeks[criticalWeek].weekLabel}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
