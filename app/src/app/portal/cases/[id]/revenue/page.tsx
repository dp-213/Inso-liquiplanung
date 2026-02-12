"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardNav from "@/components/external/DashboardNav";
import RevenueChart from "@/components/external/RevenueChart";

interface CaseData {
  case: {
    id: string;
    caseNumber: string;
    debtorName: string;
    courtName: string;
    status: string;
  };
  calculation: {
    periodType: "WEEKLY" | "MONTHLY";
    periodCount: number;
    weeks: {
      weekOffset: number;
      weekLabel: string;
      totalInflowsCents: string;
    }[];
    categories: {
      categoryName: string;
      flowType: string;
      estateType: string;
      totalCents: string;
      weeklyTotals: string[];
      lines: {
        lineName: string;
        totalCents: string;
        weeklyValues: {
          weekOffset: number;
          effectiveCents: string;
        }[];
      }[];
    }[];
  };
}

// Payment source configuration for medical practices
const PAYMENT_SOURCES = [
  {
    id: "kv_advance",
    name: "KV-Abschläge",
    description: "Monatliche Abschlagszahlungen der Kassenärztlichen Vereinigung",
    rhythm: "Monatlich",
    color: "#3b82f6",
  },
  {
    id: "kv_final",
    name: "KV-Restzahlungen",
    description: "Quartalsweise Restzahlungen nach Abrechnung",
    rhythm: "Quartalsweise (Mrz, Jun, Sep, Dez)",
    color: "#10b981",
  },
  {
    id: "hzv_advance",
    name: "HZV-Abschläge",
    description: "Monatliche Pauschalen Hausarztzentrierte Versorgung",
    rhythm: "Monatlich",
    color: "#8b5cf6",
  },
  {
    id: "hzv_final",
    name: "HZV-Schlusszahlung",
    description: "Jährliche Abschlusszahlung HZV-Vertrag",
    rhythm: "Jährlich (Dez/Jan)",
    color: "#f59e0b",
  },
  {
    id: "pvs",
    name: "PVS-Zahlungen",
    description: "Privatpatienten-Abrechnungen",
    rhythm: "Laufend",
    color: "#ec4899",
  },
];

export default function RevenueAnalysisPage() {
  const params = useParams();
  const caseId = params.id as string;
  const [data, setData] = useState<CaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/customer/cases/${caseId}`, { credentials: "include" });
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || "Fehler beim Laden der Daten");
          return;
        }
        const caseData = await response.json();
        setData(caseData);
      } catch {
        setError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
      } finally {
        setLoading(false);
      }
    }

    if (caseId) {
      fetchData();
    }
  }, [caseId]);

  const formatCurrency = (cents: bigint | string): string => {
    const value = typeof cents === "string" ? BigInt(cents) : cents;
    const euros = Number(value) / 100;
    return euros.toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center text-sm text-[var(--muted)]">
          <Link href="/portal" className="hover:text-[var(--primary)]">
            Meine Fälle
          </Link>
          <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-[var(--foreground)]">Wird geladen...</span>
        </div>
        <div className="admin-card p-8 text-center">
          <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-[var(--secondary)]">Einnahmen-Analyse wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">Fehler</h1>
          <p className="text-[var(--secondary)] mb-4">{error || "Daten nicht verfügbar"}</p>
          <Link href="/portal" className="btn-primary">
            Zurück zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  // Extract inflow categories
  const inflowCategories = data.calculation.categories.filter(
    (c) => c.flowType === "INFLOW" && BigInt(c.totalCents) > BigInt(0)
  );

  // Calculate totals per source
  const sourceTotals = inflowCategories.map((cat) => ({
    name: cat.categoryName,
    total: BigInt(cat.totalCents),
    weeklyTotals: cat.weeklyTotals.map((t) => BigInt(t)),
  }));

  const grandTotal = sourceTotals.reduce((sum, s) => sum + s.total, BigInt(0));

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-[var(--muted)]">
        <Link href="/portal" className="hover:text-[var(--primary)]">
          Meine Fälle
        </Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link href={`/portal/cases/${caseId}`} className="hover:text-[var(--primary)]">
          {data.case.debtorName}
        </Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[var(--foreground)]">Einnahmen-Analyse</span>
      </div>

      {/* Case Header */}
      <div className="admin-card p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Einnahmen-Analyse
        </h1>
        <p className="mt-1 text-sm text-[var(--secondary)]">
          {data.case.debtorName} | {data.case.caseNumber}
        </p>
      </div>

      {/* Dashboard Navigation */}
      <DashboardNav caseId={caseId} />

      {/* Section 1: Revenue Timing by Source */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Einnahmen-Taktung nach Quelle
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Quelle</th>
                <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Beschreibung</th>
                <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Rhythmus</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">Anteil</th>
              </tr>
            </thead>
            <tbody>
              {PAYMENT_SOURCES.map((source) => (
                <tr key={source.id} className="border-b border-[var(--border)] hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: source.color }}
                      />
                      <span className="font-medium text-[var(--foreground)]">{source.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[var(--secondary)]">{source.description}</td>
                  <td className="py-3 px-4 text-[var(--secondary)]">{source.rhythm}</td>
                  <td className="py-3 px-4 text-right text-[var(--secondary)]">-</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Revenue by Category */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Einnahmen nach Kategorie
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {sourceTotals.map((source, idx) => (
            <div
              key={source.name}
              className="p-4 rounded-lg border border-[var(--border)] bg-gray-50"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--secondary)]">{source.name}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${PAYMENT_SOURCES[idx % PAYMENT_SOURCES.length].color}20`,
                    color: PAYMENT_SOURCES[idx % PAYMENT_SOURCES.length].color,
                  }}
                >
                  {grandTotal > BigInt(0)
                    ? `${((Number(source.total) / Number(grandTotal)) * 100).toFixed(0)}%`
                    : "0%"}
                </span>
              </div>
              <div className="text-2xl font-bold text-[var(--foreground)]">
                {formatCurrency(source.total)}
              </div>
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: grandTotal > BigInt(0)
                      ? `${(Number(source.total) / Number(grandTotal)) * 100}%`
                      : "0%",
                    backgroundColor: PAYMENT_SOURCES[idx % PAYMENT_SOURCES.length].color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="p-4 rounded-lg bg-[var(--primary)] text-white">
          <div className="flex items-center justify-between">
            <span className="font-medium">Gesamteinnahmen (Plan)</span>
            <span className="text-2xl font-bold">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Section 3: Stacked Revenue Chart */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Einnahmen-Verlauf nach Quelle
        </h2>
        <RevenueChart
          weeks={data.calculation.weeks}
          categories={inflowCategories}
        />
      </div>

      {/* Section 4: Payment Schedule Table */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Zahlungseingangs-Übersicht
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Periode</th>
                {sourceTotals.map((source) => (
                  <th key={source.name} className="text-right py-3 px-4 font-medium text-[var(--secondary)]">
                    {source.name}
                  </th>
                ))}
                <th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {data.calculation.weeks.map((week, weekIdx) => {
                const weekTotal = sourceTotals.reduce(
                  (sum, s) => sum + (s.weeklyTotals[weekIdx] || BigInt(0)),
                  BigInt(0)
                );
                return (
                  <tr key={week.weekOffset} className="border-b border-[var(--border)] hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-[var(--foreground)]">{week.weekLabel}</td>
                    {sourceTotals.map((source) => (
                      <td key={source.name} className="py-3 px-4 text-right text-[var(--secondary)]">
                        {formatCurrency(source.weeklyTotals[weekIdx] || BigInt(0))}
                      </td>
                    ))}
                    <td className="py-3 px-4 text-right font-medium text-[var(--foreground)]">
                      {formatCurrency(weekTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-medium">
                <td className="py-3 px-4 text-[var(--foreground)]">Summe</td>
                {sourceTotals.map((source) => (
                  <td key={source.name} className="py-3 px-4 text-right text-[var(--foreground)]">
                    {formatCurrency(source.total)}
                  </td>
                ))}
                <td className="py-3 px-4 text-right text-[var(--foreground)]">
                  {formatCurrency(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
