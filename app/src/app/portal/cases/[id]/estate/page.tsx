"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardNav from "@/components/external/DashboardNav";
import EstateComparisonChart from "@/components/external/EstateComparisonChart";

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
      totalOutflowsCents: string;
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

export default function EstateSummaryPage() {
  const params = useParams();
  const caseId = params.id as string;
  const [data, setData] = useState<CaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center text-sm text-[var(--muted)]">
          <Link href="/portal" className="hover:text-[var(--primary)]">
            Meine Faelle
          </Link>
          <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-[var(--foreground)]">Wird geladen...</span>
        </div>
        <div className="admin-card p-8 text-center">
          <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-[var(--secondary)]">Masseuebersicht wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">Fehler</h1>
          <p className="text-[var(--secondary)] mb-4">{error || "Daten nicht verfuegbar"}</p>
          <Link href="/portal" className="btn-primary">
            Zurueck zur Uebersicht
          </Link>
        </div>
      </div>
    );
  }

  // Separate categories by estate type
  const altmasseInflows = data.calculation.categories.filter(
    (c) => c.flowType === "INFLOW" && c.estateType === "ALTMASSE"
  );
  const altmasseOutflows = data.calculation.categories.filter(
    (c) => c.flowType === "OUTFLOW" && c.estateType === "ALTMASSE"
  );
  const neumasseInflows = data.calculation.categories.filter(
    (c) => c.flowType === "INFLOW" && c.estateType === "NEUMASSE"
  );
  const neumasseOutflows = data.calculation.categories.filter(
    (c) => c.flowType === "OUTFLOW" && c.estateType === "NEUMASSE"
  );

  // Calculate totals
  const altmasseInflowTotal = altmasseInflows.reduce(
    (sum, c) => sum + BigInt(c.totalCents),
    BigInt(0)
  );
  const altmasseOutflowTotal = altmasseOutflows.reduce(
    (sum, c) => sum + BigInt(c.totalCents),
    BigInt(0)
  );
  const altmasseNet = altmasseInflowTotal - altmasseOutflowTotal;

  const neumasseInflowTotal = neumasseInflows.reduce(
    (sum, c) => sum + BigInt(c.totalCents),
    BigInt(0)
  );
  const neumasseOutflowTotal = neumasseOutflows.reduce(
    (sum, c) => sum + BigInt(c.totalCents),
    BigInt(0)
  );
  const neumasseNet = neumasseInflowTotal - neumasseOutflowTotal;

  const totalInflows = altmasseInflowTotal + neumasseInflowTotal;
  const totalOutflows = altmasseOutflowTotal + neumasseOutflowTotal;
  const totalNet = totalInflows - totalOutflows;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-[var(--muted)]">
        <Link href="/portal" className="hover:text-[var(--primary)]">
          Meine Faelle
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
        <span className="text-[var(--foreground)]">Masseuebersicht</span>
      </div>

      {/* Case Header */}
      <div className="admin-card p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Masseuebersicht
        </h1>
        <p className="mt-1 text-sm text-[var(--secondary)]">
          {data.case.debtorName} | {data.case.caseNumber}
        </p>
      </div>

      {/* Dashboard Navigation */}
      <DashboardNav caseId={caseId} />

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Gesamteinnahmen</div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(totalInflows)}
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Gesamtausgaben</div>
          <div className="text-2xl font-bold text-red-600">
            -{formatCurrency(totalOutflows)}
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Netto-Zufluss</div>
          <div className={`text-2xl font-bold ${totalNet >= BigInt(0) ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(totalNet)}
          </div>
        </div>
      </div>

      {/* Comparison Chart */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Altmasse vs Neumasse Vergleich
        </h2>
        <EstateComparisonChart
          altmasseInflows={altmasseInflowTotal}
          altmasseOutflows={altmasseOutflowTotal}
          neumasseInflows={neumasseInflowTotal}
          neumasseOutflows={neumasseOutflowTotal}
        />
      </div>

      {/* Two-column layout for Altmasse and Neumasse */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Altmasse Section */}
        <div className="admin-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Altmasse
            </h2>
          </div>
          <p className="text-sm text-[var(--secondary)] mb-4">
            Forderungen und Verbindlichkeiten, die vor Insolvenzeroeffnung entstanden sind
          </p>

          {/* Altmasse Inflows */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-[var(--secondary)] mb-2">Einnahmen</h3>
            {altmasseInflows.length > 0 ? (
              <div className="space-y-2">
                {altmasseInflows.map((cat) => (
                  <div
                    key={cat.categoryName}
                    className="flex items-center justify-between py-2 px-3 bg-green-50 rounded"
                  >
                    <span className="text-sm text-[var(--foreground)]">{cat.categoryName}</span>
                    <span className="text-sm font-medium text-green-600">
                      {formatCurrency(cat.totalCents)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 px-3 bg-green-100 rounded font-medium">
                  <span className="text-sm text-[var(--foreground)]">Summe Einnahmen</span>
                  <span className="text-sm text-green-700">
                    {formatCurrency(altmasseInflowTotal)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)] italic py-2">Keine Altmasse-Einnahmen</p>
            )}
          </div>

          {/* Altmasse Outflows */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-[var(--secondary)] mb-2">Ausgaben</h3>
            {altmasseOutflows.length > 0 ? (
              <div className="space-y-2">
                {altmasseOutflows.map((cat) => (
                  <div
                    key={cat.categoryName}
                    className="flex items-center justify-between py-2 px-3 bg-red-50 rounded"
                  >
                    <span className="text-sm text-[var(--foreground)]">{cat.categoryName}</span>
                    <span className="text-sm font-medium text-red-600">
                      -{formatCurrency(cat.totalCents)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 px-3 bg-red-100 rounded font-medium">
                  <span className="text-sm text-[var(--foreground)]">Summe Ausgaben</span>
                  <span className="text-sm text-red-700">
                    -{formatCurrency(altmasseOutflowTotal)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)] italic py-2">Keine Altmasse-Ausgaben</p>
            )}
          </div>

          {/* Altmasse Net */}
          <div className={`p-3 rounded-lg ${altmasseNet >= BigInt(0) ? "bg-green-600" : "bg-red-600"} text-white`}>
            <div className="flex items-center justify-between">
              <span className="font-medium">Netto Altmasse</span>
              <span className="text-xl font-bold">{formatCurrency(altmasseNet)}</span>
            </div>
          </div>
        </div>

        {/* Neumasse Section */}
        <div className="admin-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Neumasse
            </h2>
          </div>
          <p className="text-sm text-[var(--secondary)] mb-4">
            Forderungen und Verbindlichkeiten, die nach Insolvenzeroeffnung entstanden sind
          </p>

          {/* Neumasse Inflows */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-[var(--secondary)] mb-2">Einnahmen</h3>
            {neumasseInflows.length > 0 ? (
              <div className="space-y-2">
                {neumasseInflows.map((cat) => (
                  <div
                    key={cat.categoryName}
                    className="flex items-center justify-between py-2 px-3 bg-green-50 rounded"
                  >
                    <span className="text-sm text-[var(--foreground)]">{cat.categoryName}</span>
                    <span className="text-sm font-medium text-green-600">
                      {formatCurrency(cat.totalCents)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 px-3 bg-green-100 rounded font-medium">
                  <span className="text-sm text-[var(--foreground)]">Summe Einnahmen</span>
                  <span className="text-sm text-green-700">
                    {formatCurrency(neumasseInflowTotal)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)] italic py-2">Keine Neumasse-Einnahmen</p>
            )}
          </div>

          {/* Neumasse Outflows */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-[var(--secondary)] mb-2">Ausgaben</h3>
            {neumasseOutflows.length > 0 ? (
              <div className="space-y-2">
                {neumasseOutflows.map((cat) => (
                  <div
                    key={cat.categoryName}
                    className="flex items-center justify-between py-2 px-3 bg-red-50 rounded"
                  >
                    <span className="text-sm text-[var(--foreground)]">{cat.categoryName}</span>
                    <span className="text-sm font-medium text-red-600">
                      -{formatCurrency(cat.totalCents)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 px-3 bg-red-100 rounded font-medium">
                  <span className="text-sm text-[var(--foreground)]">Summe Ausgaben</span>
                  <span className="text-sm text-red-700">
                    -{formatCurrency(neumasseOutflowTotal)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)] italic py-2">Keine Neumasse-Ausgaben</p>
            )}
          </div>

          {/* Neumasse Net */}
          <div className={`p-3 rounded-lg ${neumasseNet >= BigInt(0) ? "bg-green-600" : "bg-red-600"} text-white`}>
            <div className="flex items-center justify-between">
              <span className="font-medium">Netto Neumasse</span>
              <span className="text-xl font-bold">{formatCurrency(neumasseNet)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Explanation Box */}
      <div className="admin-card p-4 bg-amber-50 border-amber-200">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-amber-800">Unterscheidung Altmasse / Neumasse</h3>
            <p className="text-sm text-amber-700 mt-1">
              <strong>Altmasse:</strong> Alle Vermoegenswerte und Forderungen, die vor dem Insolvenzantrag bzw.
              der Eroeffnung des Insolvenzverfahrens entstanden sind. Diese unterliegen besonderen Regelungen
              fuer die Glaeubigerbefriedigung.
            </p>
            <p className="text-sm text-amber-700 mt-2">
              <strong>Neumasse:</strong> Alle Vermoegenswerte, die nach Insolvenzeroeffnung entstehen, z.B. aus
              der Fortfuehrung des Geschaeftsbetriebs. Diese stehen vorrangig fuer Masseverbindlichkeiten zur Verfuegung.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
