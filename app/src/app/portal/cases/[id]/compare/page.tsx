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
          {/* IST vs PLAN – In Vorbereitung */}
          <div className="admin-card p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              IST vs PLAN Vergleich
            </h2>
            <p className="text-sm text-[var(--secondary)] max-w-md mx-auto">
              Der SOLL/IST-Abgleich für Ihr Verfahren wird vorbereitet.
              Sobald ausreichend verifizierte IST-Daten vorliegen, wird hier die
              Abweichungsanalyse angezeigt.
            </p>
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
