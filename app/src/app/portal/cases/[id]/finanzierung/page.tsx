"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

interface CreditLine {
  creditor: string;
  contractType: string;
  contractNumber?: string;
  contractDate?: string;
  principal: number;
  interestRate: number;
  interestType: string;
  startDate?: string;
  maturityDate?: string;
  repaymentType: string;
  monthlyPayment?: number | null;
  monthlyInterest?: number | null;
  monthlyPrincipal?: number | null;
  collateral: string[];
  status: string;
  statusNote?: string;
  sourceFile: string;
}

interface FinancingData {
  summary: {
    totalDebt: number;
    monthlyInterest: number;
    monthlyPrincipal: number;
    monthlyTotal: number;
    creditorCount: number;
    contractCount: number;
    byCreditor: Record<
      string,
      { count: number; totalPrincipal: number; monthlyPayment: number }
    >;
  };
  creditLines: CreditLine[];
}

export default function FinanzierungPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FinancingData | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch(`/api/cases/${id}/finanzierung`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Fehler beim Laden der Finanzierungsdaten");
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Unbekannter Fehler");
        }

        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("de-DE");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <span className="badge badge-success">Aktiv</span>;
      case "INSOLVENCY_CLAIM":
        return <span className="badge badge-warning">Altforderung</span>;
      case "TERMINATED":
        return <span className="badge badge-neutral">Beendet</span>;
      default:
        return <span className="badge badge-info">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
          <p className="text-[var(--muted)]">Lade Finanzierungsdaten...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center text-sm text-[var(--muted)]">
          <Link href="/portal" className="hover:text-[var(--primary)]">
            Meine Fälle
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
          <span className="text-[var(--foreground)]">Finanzierung</span>
        </div>

        <div className="admin-card p-6">
          <div className="text-center">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
              {error}
            </h2>
            <Link href={`/portal/cases/${id}`} className="btn-primary">
              Zurück zur Übersicht
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Separate active and inactive credit lines
  const activeLines = data.creditLines.filter((cl) => cl.status === "ACTIVE");
  const inactiveLines = data.creditLines.filter(
    (cl) => cl.status !== "ACTIVE"
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-[var(--muted)]">
        <Link href="/portal" className="hover:text-[var(--primary)]">
          Meine Fälle
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
          href={`/portal/cases/${id}`}
          className="hover:text-[var(--primary)]"
        >
          Fall
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
        <span className="text-[var(--foreground)]">Finanzierung</span>
      </div>

      {/* Header */}
      <div className="admin-card p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
          Finanzierungsübersicht
        </h1>
        <p className="text-[var(--muted)]">
          Transparente Darstellung aller Kreditlinien und laufenden
          Verpflichtungen
        </p>
      </div>

      {/* Executive Summary - Key Message */}
      <div className="admin-card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500">
        <div className="flex items-start gap-4">
          <svg
            className="w-12 h-12 text-blue-600 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Laufende Finanzierungskosten unter Kontrolle
            </h2>
            <p className="text-gray-700 mb-4">
              Von insgesamt <strong>{formatCurrency(data.summary.totalDebt)}</strong>{" "}
              Verbindlichkeiten sind <strong>nur {formatCurrency(data.summary.monthlyTotal)}/Monat</strong>{" "}
              aktive Masseverpflichtungen. Alle weiteren Kreditlinien sind{" "}
              <strong>Altforderungen</strong> (§ 38 InsO) und belasten die Masse nicht.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Gesamt-Verschuldung</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(data.summary.totalDebt)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">
                  Aktive monatliche Kosten
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(data.summary.monthlyTotal)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="text-2xl font-bold text-blue-600">
                  {activeLines.length} aktiv, {inactiveLines.length}{" "}
                  Altforderungen
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Aktive Kreditlinien */}
      {activeLines.length > 0 && (
        <div className="admin-card p-6">
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center">
            <svg
              className="w-5 h-5 mr-2 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Aktive Masseverpflichtungen
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-3 px-4 text-sm font-medium text-[var(--secondary)]">
                    Kreditgeber
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[var(--secondary)]">
                    Typ
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-[var(--secondary)]">
                    Betrag
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-[var(--secondary)]">
                    Zinssatz
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-[var(--secondary)]">
                    Monatl. Kosten
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[var(--secondary)]">
                    Fälligkeit
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeLines.map((cl, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-[var(--border)] hover:bg-[var(--accent)]"
                  >
                    <td className="py-3 px-4 font-medium">{cl.creditor}</td>
                    <td className="py-3 px-4 text-sm">{cl.contractType}</td>
                    <td className="text-right py-3 px-4 font-medium">
                      {formatCurrency(cl.principal)}
                    </td>
                    <td className="text-right py-3 px-4">
                      {cl.interestRate !== null && cl.interestRate !== undefined
                        ? `${cl.interestRate.toFixed(2)}%`
                        : "-"}
                    </td>
                    <td className="text-right py-3 px-4 font-medium text-green-600">
                      {cl.monthlyInterest !== null ||
                      cl.monthlyPrincipal !== null
                        ? formatCurrency(
                            (cl.monthlyInterest || 0) + (cl.monthlyPrincipal || 0)
                          )
                        : "-"}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {formatDate(cl.maturityDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Altforderungen (Insolvency Claims) */}
      {inactiveLines.length > 0 && (
        <div className="admin-card p-6">
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2 flex items-center">
            <svg
              className="w-5 h-5 mr-2 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Altforderungen (§ 38 InsO)
          </h2>
          <p className="text-sm text-[var(--muted)] mb-4">
            Diese Kreditlinien bestanden vor Insolvenzeröffnung und werden{" "}
            <strong>nicht aus der Masse bedient</strong>. Sie laufen als
            Tabellenforderungen und erhalten ggf. eine Quote am Verfahrensende.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-3 px-4 text-sm font-medium text-[var(--secondary)]">
                    Kreditgeber
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[var(--secondary)]">
                    Typ
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-[var(--secondary)]">
                    Urspr. Betrag
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-[var(--secondary)]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {inactiveLines.map((cl, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-[var(--border)] hover:bg-[var(--accent)]"
                  >
                    <td className="py-3 px-4 font-medium">{cl.creditor}</td>
                    <td className="py-3 px-4 text-sm">{cl.contractType}</td>
                    <td className="text-right py-3 px-4 font-medium text-gray-500">
                      {formatCurrency(cl.principal)}
                    </td>
                    <td className="text-center py-3 px-4">
                      {getStatusBadge(cl.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Zusammenfassung */}
      <div className="admin-card p-6 bg-gray-50">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Interpretation für die Liquiditätsplanung
        </h2>
        <div className="space-y-3 text-sm text-[var(--secondary)]">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p>
              <strong>Aktive Masseverpflichtungen</strong> sind in der
              Liquiditätsplanung als laufende Ausgaben berücksichtigt.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p>
              <strong>Altforderungen</strong> belasten die Liquidität{" "}
              <strong>nicht</strong> und tauchen in der Liquiditätsplanung nicht
              als Ausgaben auf.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p>
              Die Finanzierungskosten von{" "}
              <strong>{formatCurrency(data.summary.monthlyTotal)}/Monat</strong>{" "}
              sind tragbar und durch die laufenden Einnahmen gedeckt.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
