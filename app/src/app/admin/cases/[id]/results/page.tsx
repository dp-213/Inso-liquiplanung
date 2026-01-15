"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

interface WeeklyValue {
  id: string;
  weekNumber: number;
  weekStartDate: string;
  valueCents: string;
}

interface PlanLine {
  id: string;
  position: string;
  label: string;
  lineType: string;
  displayOrder: number;
  weeklyValues: WeeklyValue[];
}

interface Category {
  id: string;
  name: string;
  categoryType: string;
  displayOrder: number;
  lines: PlanLine[];
}

interface PlanVersion {
  id: string;
  versionNumber: number;
  snapshotDate: string;
  openingBalanceCents: string;
  dataHash: string;
}

interface Plan {
  id: string;
  name: string;
  planStartDate: string;
  horizonWeeks: number;
  isActive: boolean;
  versions: PlanVersion[];
  categories: Category[];
}

interface CaseData {
  id: string;
  caseNumber: string;
  debtorName: string;
  status: string;
  courtName: string;
  project: { name: string };
  plans: Plan[];
}

interface CalculationResult {
  success: boolean;
  weeks: {
    weekNumber: number;
    weekStartDate: string;
    weekEndDate: string;
    inflows: number;
    outflows: number;
    netCashflow: number;
    closingBalance: number;
  }[];
  summary: {
    totalInflows: number;
    totalOutflows: number;
    netChange: number;
    openingBalance: number;
    closingBalance: number;
    minimumBalance: number;
    minimumBalanceWeek: number;
  };
  calculatedAt: string;
  version: string;
}

export default function CaseResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/cases/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCaseData(data);
        // Auto-calculate if there's an active plan
        if (data.plans && data.plans.length > 0) {
          await runCalculation();
        }
      } else {
        setError("Fall nicht gefunden");
      }
    } catch (err) {
      console.error("Error fetching case:", err);
      setError("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  };

  const runCalculation = async () => {
    setCalculating(true);
    try {
      const res = await fetch(`/api/cases/${id}/calculate`, {
        method: "POST",
      });
      if (res.ok) {
        const result = await res.json();
        setCalculation(result);
      } else {
        const data = await res.json();
        setError(data.error || "Berechnung fehlgeschlagen");
      }
    } catch (err) {
      console.error("Error calculating:", err);
      setError("Fehler bei der Berechnung");
    } finally {
      setCalculating(false);
    }
  };

  const formatCurrency = (cents: number): string => {
    return (cents / 100).toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
    });
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("de-DE");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <p className="text-[var(--danger)]">
            {error || "Fall nicht gefunden"}
          </p>
          <Link href="/admin/cases" className="btn-secondary mt-4 inline-block">
            Zurueck zur Uebersicht
          </Link>
        </div>
      </div>
    );
  }

  const activePlan = caseData.plans?.find((p) => p.isActive);
  const latestVersion = activePlan?.versions?.[0];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-[var(--muted)]">
        <Link href="/admin/cases" className="hover:text-[var(--primary)]">
          Faelle
        </Link>
        <svg
          className="w-4 h-4 mx-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        <Link
          href={`/admin/cases/${id}`}
          className="hover:text-[var(--primary)]"
        >
          {caseData.debtorName}
        </Link>
        <svg
          className="w-4 h-4 mx-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        <span className="text-[var(--foreground)]">Liquiditaetsplan</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Liquiditaetsplan
          </h1>
          <p className="text-[var(--secondary)] mt-1">
            {caseData.caseNumber} - {caseData.debtorName}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={runCalculation}
            disabled={calculating || !activePlan}
            className="btn-primary disabled:opacity-50"
          >
            {calculating ? "Berechne..." : "Neu berechnen"}
          </button>
          <Link href={`/admin/cases/${id}`} className="btn-secondary">
            Zurueck zum Fall
          </Link>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* No Plan Message */}
      {!activePlan && (
        <div className="admin-card p-8 text-center">
          <svg
            className="w-12 h-12 text-[var(--muted)] mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
            Kein Liquiditaetsplan vorhanden
          </h3>
          <p className="text-[var(--muted)] mb-4">
            Importieren Sie zuerst Daten, um einen Liquiditaetsplan zu erstellen.
          </p>
          <Link
            href={`/admin/cases/${id}/ingestion`}
            className="btn-primary inline-flex items-center"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            Daten importieren
          </Link>
        </div>
      )}

      {/* Plan Information */}
      {activePlan && (
        <>
          {/* Plan Meta */}
          <div className="admin-card p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-[var(--muted)]">Planname</p>
                <p className="font-medium text-[var(--foreground)]">
                  {activePlan.name}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted)]">Version</p>
                <p className="font-medium text-[var(--foreground)]">
                  {latestVersion ? `v${latestVersion.versionNumber}` : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted)]">Planstart</p>
                <p className="font-medium text-[var(--foreground)]">
                  {formatDate(activePlan.planStartDate)}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted)]">Horizont</p>
                <p className="font-medium text-[var(--foreground)]">
                  {activePlan.horizonWeeks} Wochen
                </p>
              </div>
            </div>
          </div>

          {/* Calculation Results */}
          {calculation && calculation.success && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="admin-card p-4">
                  <p className="text-sm text-[var(--muted)]">Anfangssaldo</p>
                  <p className="text-xl font-bold text-[var(--foreground)]">
                    {formatCurrency(calculation.summary.openingBalance)}
                  </p>
                </div>
                <div className="admin-card p-4">
                  <p className="text-sm text-[var(--muted)]">Gesamteinnahmen</p>
                  <p className="text-xl font-bold text-[var(--success)]">
                    {formatCurrency(calculation.summary.totalInflows)}
                  </p>
                </div>
                <div className="admin-card p-4">
                  <p className="text-sm text-[var(--muted)]">Gesamtausgaben</p>
                  <p className="text-xl font-bold text-[var(--danger)]">
                    {formatCurrency(calculation.summary.totalOutflows)}
                  </p>
                </div>
                <div className="admin-card p-4">
                  <p className="text-sm text-[var(--muted)]">Endsaldo</p>
                  <p
                    className={`text-xl font-bold ${
                      calculation.summary.closingBalance >= 0
                        ? "text-[var(--foreground)]"
                        : "text-[var(--danger)]"
                    }`}
                  >
                    {formatCurrency(calculation.summary.closingBalance)}
                  </p>
                </div>
              </div>

              {/* Minimum Balance Warning */}
              {calculation.summary.minimumBalance < 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg
                      className="w-5 h-5 text-red-600 mt-0.5 mr-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div>
                      <h3 className="text-sm font-medium text-red-800">
                        Liquiditaetsengpass
                      </h3>
                      <p className="text-sm text-red-700 mt-1">
                        In Woche {calculation.summary.minimumBalanceWeek} wird ein
                        Minimum von{" "}
                        {formatCurrency(calculation.summary.minimumBalance)}{" "}
                        erreicht.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Weekly Table */}
              <div className="admin-card">
                <div className="px-6 py-4 border-b border-[var(--border)]">
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">
                    Woechentliche Uebersicht
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Woche</th>
                        <th>Zeitraum</th>
                        <th className="text-right">Einnahmen</th>
                        <th className="text-right">Ausgaben</th>
                        <th className="text-right">Netto</th>
                        <th className="text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculation.weeks.map((week) => (
                        <tr
                          key={week.weekNumber}
                          className={
                            week.closingBalance < 0 ? "bg-red-50" : ""
                          }
                        >
                          <td className="font-medium">KW {week.weekNumber}</td>
                          <td className="text-sm text-[var(--muted)]">
                            {formatDate(week.weekStartDate)} -{" "}
                            {formatDate(week.weekEndDate)}
                          </td>
                          <td className="text-right text-[var(--success)]">
                            {formatCurrency(week.inflows)}
                          </td>
                          <td className="text-right text-[var(--danger)]">
                            {formatCurrency(week.outflows)}
                          </td>
                          <td
                            className={`text-right font-medium ${
                              week.netCashflow >= 0
                                ? "text-[var(--success)]"
                                : "text-[var(--danger)]"
                            }`}
                          >
                            {formatCurrency(week.netCashflow)}
                          </td>
                          <td
                            className={`text-right font-bold ${
                              week.closingBalance >= 0
                                ? "text-[var(--foreground)]"
                                : "text-[var(--danger)]"
                            }`}
                          >
                            {formatCurrency(week.closingBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Calculation Meta */}
              <div className="text-xs text-[var(--muted)] text-right">
                Berechnet am: {formatDate(calculation.calculatedAt)} | Engine: v
                {calculation.version}
              </div>
            </>
          )}

          {/* No Calculation Yet */}
          {!calculation && !calculating && (
            <div className="admin-card p-8 text-center">
              <p className="text-[var(--muted)]">
                Klicken Sie auf &quot;Neu berechnen&quot;, um den Liquiditaetsplan zu
                erstellen.
              </p>
            </div>
          )}

          {/* Calculating */}
          {calculating && (
            <div className="admin-card p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)] mx-auto mb-3"></div>
              <p className="text-[var(--muted)]">
                Liquiditaetsplan wird berechnet...
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
