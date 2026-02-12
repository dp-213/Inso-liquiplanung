"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

interface PeriodData {
  index: number;
  label: string;
  startDate: string;
  endDate: string;
  plan: { inflows: string; outflows: string; net: string };
  ist: { inflows: string; outflows: string; net: string };
  deviation: string;
  deviationPercent: number;
  status: "green" | "yellow" | "red" | "neutral";
  hasIstData: boolean;
}

interface VerifikationData {
  plan: {
    id: string;
    name: string;
    periodType: string;
    periodCount: number;
    planStartDate: string;
  };
  summary: {
    totalPlan: string;
    totalIst: string;
    totalDeviation: string;
    totalDeviationPercent: number;
    totalStatus: "green" | "yellow" | "red" | "neutral";
    periodsWithIst: number;
    periodsTotal: number;
  };
  periods: PeriodData[];
}

interface ApiResponse {
  success: boolean;
  available: boolean;
  message?: string;
  data: VerifikationData | null;
}

export default function ZahlungsverifikationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/cases/${id}/zahlungsverifikation`, {
          credentials: "include",
        });
        if (!res.ok) {
          const err = await res.json();
          setError(err.error || "Fehler beim Laden");
          return;
        }
        const result = await res.json();
        setResponse(result);
      } catch {
        setError("Verbindungsfehler");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const formatCurrency = (cents: string): string => {
    const amount = parseInt(cents) / 100;
    return amount.toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "green": return "text-[var(--success)]";
      case "yellow": return "text-amber-500";
      case "red": return "text-[var(--danger)]";
      default: return "text-[var(--muted)]";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "green": return "bg-green-50 dark:bg-green-900/10";
      case "yellow": return "bg-amber-50 dark:bg-amber-900/10";
      case "red": return "bg-red-50 dark:bg-red-900/10";
      default: return "";
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case "green": return "bg-green-500";
      case "yellow": return "bg-amber-500";
      case "red": return "bg-red-500";
      default: return "bg-gray-300 dark:bg-gray-600";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "green": return "Im Plan";
      case "yellow": return "Abweichung";
      case "red": return "Kritisch";
      default: return "–";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <p className="text-[var(--danger)]">{error}</p>
        </div>
      </div>
    );
  }

  // Kein aktiver Plan
  if (!response?.available || !response.data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Zahlungsverifikation</h1>
          <Link href={`/admin/cases/${id}/results`} className="btn-primary">
            Dashboard
          </Link>
        </div>
        <div className="admin-card p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">Kein aktiver Plan</h2>
          <p className="text-[var(--secondary)] max-w-md mx-auto">
            {response?.message || "Bitte legen Sie zuerst einen Liquiditätsplan an, um den SOLL/IST-Abgleich durchführen zu können."}
          </p>
        </div>
      </div>
    );
  }

  const { data } = response;
  const { summary, periods, plan } = data;
  const periodLabel = plan.periodType === "MONTHLY" ? "Monate" : "Wochen";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Zahlungsverifikation</h1>
          <p className="text-[var(--secondary)] mt-1">
            SOLL/IST-Abgleich – {plan.name} ({plan.periodCount} {periodLabel})
          </p>
        </div>
        <div className="flex gap-3">
          <Link href={`/admin/cases/${id}/kontobewegungen`} className="btn-secondary">
            IST-Daten
          </Link>
          <Link href={`/admin/cases/${id}/results`} className="btn-primary">
            Dashboard
          </Link>
        </div>
      </div>

      {/* Zusammenfassung - 3 Kacheln */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="admin-card p-6">
          <p className="text-sm text-[var(--muted)] mb-1">PLAN gesamt</p>
          <p className="text-2xl font-bold text-[var(--foreground)]">
            {formatCurrency(summary.totalPlan)}
          </p>
          <p className="text-xs text-[var(--muted)] mt-1">
            {summary.periodsTotal} {periodLabel}
          </p>
        </div>

        <div className="admin-card p-6">
          <p className="text-sm text-[var(--muted)] mb-1">IST gesamt</p>
          <p className="text-2xl font-bold text-[var(--foreground)]">
            {formatCurrency(summary.totalIst)}
          </p>
          <p className="text-xs text-[var(--muted)] mt-1">
            {summary.periodsWithIst} von {summary.periodsTotal} {periodLabel} mit Daten
          </p>
        </div>

        <div className={`admin-card p-6 ${getStatusBg(summary.totalStatus)}`}>
          <p className="text-sm text-[var(--muted)] mb-1">Abweichung</p>
          <p className={`text-2xl font-bold ${getStatusColor(summary.totalStatus)}`}>
            {formatCurrency(summary.totalDeviation)}
          </p>
          <p className={`text-xs mt-1 ${getStatusColor(summary.totalStatus)}`}>
            {summary.totalDeviationPercent > 0 ? "+" : ""}{summary.totalDeviationPercent}%
          </p>
        </div>
      </div>

      {/* Perioden-Tabelle */}
      <div className="admin-card overflow-hidden">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Perioden-Übersicht
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--background-secondary)]">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-[var(--foreground)]">Periode</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--foreground)]">PLAN</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--foreground)]">IST</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--foreground)]">Abweichung</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--foreground)]">%</th>
                <th className="text-center py-3 px-4 font-medium text-[var(--foreground)]">Status</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr
                  key={period.index}
                  className={`border-b border-[var(--border)] transition-colors ${
                    period.hasIstData
                      ? `hover:bg-[var(--background-secondary)] ${getStatusBg(period.status)}`
                      : "opacity-50"
                  }`}
                >
                  <td className="py-3 px-4 font-medium text-[var(--foreground)]">
                    {period.label}
                  </td>
                  <td className="py-3 px-4 text-right text-[var(--foreground)] font-mono">
                    {formatCurrency(period.plan.net)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {period.hasIstData ? (
                      <span className="text-[var(--foreground)]">{formatCurrency(period.ist.net)}</span>
                    ) : (
                      <span className="text-[var(--muted)]">–</span>
                    )}
                  </td>
                  <td className={`py-3 px-4 text-right font-mono ${period.hasIstData ? getStatusColor(period.status) : "text-[var(--muted)]"}`}>
                    {period.hasIstData ? formatCurrency(period.deviation) : "–"}
                  </td>
                  <td className={`py-3 px-4 text-right font-mono ${period.hasIstData ? getStatusColor(period.status) : "text-[var(--muted)]"}`}>
                    {period.hasIstData ? (
                      `${period.deviationPercent > 0 ? "+" : ""}${period.deviationPercent}%`
                    ) : "–"}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {period.hasIstData ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${getStatusDot(period.status)}`}></span>
                        <span className={`text-xs ${getStatusColor(period.status)}`}>
                          {getStatusLabel(period.status)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">Keine Daten</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legende */}
      <div className="admin-card p-4">
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-[var(--foreground)]">Im Plan</span>
            <span className="text-[var(--muted)]">(&lt; 5% Abweichung)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span className="text-[var(--foreground)]">Abweichung</span>
            <span className="text-[var(--muted)]">(5–15%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span className="text-[var(--foreground)]">Kritisch</span>
            <span className="text-[var(--muted)]">(&gt; 15%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
