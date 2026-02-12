"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardNav from "@/components/external/DashboardNav";

interface CaseData {
  case: {
    id: string;
    caseNumber: string;
    debtorName: string;
    courtName: string;
    status: string;
  };
  plan: {
    versionNumber: number;
    versionDate: string | null;
  };
  calculation: {
    periodType: "WEEKLY" | "MONTHLY";
    periodCount: number;
    openingBalanceCents: string;
    totalInflowsCents: string;
    totalOutflowsCents: string;
    totalNetCashflowCents: string;
    finalClosingBalanceCents: string;
    calculatedAt: string;
    weeks: {
      weekOffset: number;
      weekLabel: string;
      totalInflowsCents: string;
      totalOutflowsCents: string;
      netCashflowCents: string;
      closingBalanceCents: string;
    }[];
    categories: {
      categoryName: string;
      flowType: string;
      estateType: string;
      totalCents: string;
      weeklyTotals: string[];
    }[];
  };
}

export default function CompareViewPage() {
  const params = useParams();
  const caseId = params.id as string;
  const [data, setData] = useState<CaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState<"ist_plan" | "versions">("ist_plan");

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/customer/cases/${caseId}`);
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

  const getVarianceClass = (variance: number): string => {
    if (variance > 10) return "text-green-600 bg-green-50";
    if (variance < -10) return "text-red-600 bg-red-50";
    return "text-[var(--secondary)] bg-gray-50";
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
          <p className="mt-4 text-[var(--secondary)]">Vergleichsansicht wird geladen...</p>
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

  // For demo purposes, create simulated IST data with some variance
  const simulateIstData = () => {
    return data.calculation.weeks.map((week, idx) => {
      // Add some random variance for demo (in real app, this would come from actual IST data)
      const varianceFactor = 0.85 + Math.random() * 0.3; // 85% to 115% of plan
      const planInflows = BigInt(week.totalInflowsCents);
      const planOutflows = BigInt(week.totalOutflowsCents);
      const istInflows = BigInt(Math.floor(Number(planInflows) * varianceFactor));
      const istOutflows = BigInt(Math.floor(Number(planOutflows) * (0.9 + Math.random() * 0.2)));

      return {
        label: week.weekLabel,
        plan: {
          inflows: planInflows,
          outflows: planOutflows,
          net: planInflows - planOutflows,
        },
        ist: {
          inflows: istInflows,
          outflows: istOutflows,
          net: istInflows - istOutflows,
        },
        variance: {
          inflows: Number(istInflows - planInflows) / Number(planInflows) * 100 || 0,
          outflows: Number(istOutflows - planOutflows) / Number(planOutflows) * 100 || 0,
        },
      };
    });
  };

  const comparisonData = simulateIstData();

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
        <span className="text-[var(--foreground)]">Vergleichsansicht</span>
      </div>

      {/* Case Header */}
      <div className="admin-card p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Vergleichsansicht
        </h1>
        <p className="mt-1 text-sm text-[var(--secondary)]">
          {data.case.debtorName} | {data.case.caseNumber}
        </p>
      </div>

      {/* Dashboard Navigation */}
      <DashboardNav caseId={caseId} />

      {/* Compare Mode Toggle */}
      <div className="admin-card p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-[var(--secondary)]">Vergleichsmodus:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setCompareMode("ist_plan")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                compareMode === "ist_plan"
                  ? "bg-[var(--primary)] text-white"
                  : "bg-gray-100 text-[var(--secondary)] hover:bg-gray-200"
              }`}
            >
              IST vs PLAN
            </button>
            <button
              onClick={() => setCompareMode("versions")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                compareMode === "versions"
                  ? "bg-[var(--primary)] text-white"
                  : "bg-gray-100 text-[var(--secondary)] hover:bg-gray-200"
              }`}
            >
              Versionen
            </button>
          </div>
        </div>
      </div>

      {compareMode === "ist_plan" ? (
        <>
          {/* IST vs PLAN Comparison */}
          <div className="admin-card p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
              IST vs PLAN Vergleich
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Periode</th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">PLAN Einnahmen</th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">IST Einnahmen</th>
                    <th className="text-center py-3 px-4 font-medium text-[var(--secondary)]">Abw. %</th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">PLAN Ausgaben</th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">IST Ausgaben</th>
                    <th className="text-center py-3 px-4 font-medium text-[var(--secondary)]">Abw. %</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="border-b border-[var(--border)] hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-[var(--foreground)]">{row.label}</td>
                      <td className="py-3 px-4 text-right text-[var(--secondary)]">
                        {formatCurrency(row.plan.inflows)}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--foreground)]">
                        {formatCurrency(row.ist.inflows)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getVarianceClass(row.variance.inflows)}`}>
                          {row.variance.inflows >= 0 ? "+" : ""}{row.variance.inflows.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--secondary)]">
                        -{formatCurrency(row.plan.outflows)}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--foreground)]">
                        -{formatCurrency(row.ist.outflows)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getVarianceClass(-row.variance.outflows)}`}>
                          {row.variance.outflows >= 0 ? "+" : ""}{row.variance.outflows.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Variance Legend */}
          <div className="admin-card p-4">
            <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">Legende Abweichungen</h3>
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-green-50 text-green-600">&gt; +10%</span>
                <span className="text-[var(--secondary)]">Übererfüllung</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-gray-50 text-[var(--secondary)]">-10% bis +10%</span>
                <span className="text-[var(--secondary)]">Im Rahmen</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-red-50 text-red-600">&lt; -10%</span>
                <span className="text-[var(--secondary)]">Untererfüllung</span>
              </div>
            </div>
          </div>

          {/* Info Note */}
          <div className="admin-card p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-blue-800">Hinweis</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Die IST-Daten in dieser Demo sind simuliert. In der produktiven Umgebung werden
                  tatsächliche Ist-Werte aus dem Buchhaltungssystem oder manuellen Eingaben importiert.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Versions Comparison */}
          <div className="admin-card p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
              Versionsvergleich
            </h2>

            {/* Version Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 border border-[var(--border)] rounded-lg">
                <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                  Version A
                </label>
                <select className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm">
                  <option>Version {data.plan.versionNumber} (aktuell)</option>
                </select>
              </div>
              <div className="p-4 border border-[var(--border)] rounded-lg">
                <label className="block text-sm font-medium text-[var(--secondary)] mb-2">
                  Version B
                </label>
                <select className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm">
                  <option>Keine früheren Versionen</option>
                </select>
              </div>
            </div>

            {/* Current Version Info */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">
                Aktuelle Version: Version {data.plan.versionNumber}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-[var(--secondary)]">Erstellt am</div>
                  <div className="font-medium text-[var(--foreground)]">
                    {new Date(data.calculation.calculatedAt).toLocaleDateString("de-DE")}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--secondary)]">Gesamteinnahmen</div>
                  <div className="font-medium text-green-600">
                    {formatCurrency(data.calculation.totalInflowsCents)}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--secondary)]">Gesamtausgaben</div>
                  <div className="font-medium text-red-600">
                    -{formatCurrency(data.calculation.totalOutflowsCents)}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--secondary)]">Endbestand</div>
                  <div className="font-medium text-[var(--foreground)]">
                    {formatCurrency(data.calculation.finalClosingBalanceCents)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info Note */}
          <div className="admin-card p-4 bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-amber-800">Versionshistorie</h3>
                <p className="text-sm text-amber-700 mt-1">
                  Die Versionierung ermöglicht es, ältere Planstände mit der aktuellen Version
                  zu vergleichen. Bei jeder wesentlichen Änderung der Planung wird automatisch
                  eine neue Version erstellt.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
