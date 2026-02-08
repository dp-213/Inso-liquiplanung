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
  const [selectedCreditLine, setSelectedCreditLine] =
    useState<CreditLine | null>(null);

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
        console.error("Fehler:", err);
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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

  const getRepaymentTypeLabel = (type: string) => {
    switch (type) {
      case "ANNUITÄT":
        return "Annuität";
      case "ENDFÄLLIG":
        return "Endfällig";
      case "TILGUNGSPLAN":
        return "Tilgungsplan";
      default:
        return type;
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
        {/* Breadcrumb */}
        <div className="flex items-center text-sm text-[var(--muted)]">
          <Link href="/admin/cases" className="hover:text-[var(--primary)]">
            Fälle
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

        {/* Error Card */}
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
            <Link href={`/admin/cases/${id}`} className="btn-primary">
              Zurück zur Fallübersicht
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-[var(--muted)]">
        <Link href="/admin/cases" className="hover:text-[var(--primary)]">
          Fälle
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
          Kreditlinien & Finanzierung
        </h1>
        <p className="text-[var(--muted)]">
          Übersicht aller Darlehen, Massekredite und Finanzierungskosten
        </p>
      </div>

      {/* Executive Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="admin-card p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-[var(--muted)]">Gesamt-Verschuldung</p>
            <svg
              className="w-5 h-5 text-[var(--muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-2xl font-bold text-[var(--foreground)]">
            {formatCurrency(data.summary.totalDebt)}
          </p>
          <p className="text-xs text-[var(--secondary)] mt-1">
            {data.summary.contractCount} Verträge, {data.summary.creditorCount}{" "}
            Kreditgeber
          </p>
        </div>

        <div className="admin-card p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-[var(--muted)]">Monatliche Zinsen</p>
            <svg
              className="w-5 h-5 text-[var(--muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </div>
          <p className="text-2xl font-bold text-orange-600">
            {formatCurrency(data.summary.monthlyInterest)}
          </p>
          <p className="text-xs text-[var(--secondary)] mt-1">
            Nur Zinszahlungen
          </p>
        </div>

        <div className="admin-card p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-[var(--muted)]">Monatliche Tilgung</p>
            <svg
              className="w-5 h-5 text-[var(--muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
              />
            </svg>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(data.summary.monthlyPrincipal)}
          </p>
          <p className="text-xs text-[var(--secondary)] mt-1">
            Kapitalrückzahlung
          </p>
        </div>

        <div className="admin-card p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-[var(--muted)]">
              Gesamt monatliche Rate
            </p>
            <svg
              className="w-5 h-5 text-[var(--muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(data.summary.monthlyTotal)}
          </p>
          <p className="text-xs text-[var(--secondary)] mt-1">
            Zinsen + Tilgung
          </p>
        </div>
      </div>

      {/* Aufschlüsselung nach Kreditgeber */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Aufschlüsselung nach Kreditgeber
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--secondary)]">
                  Kreditgeber
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-[var(--secondary)]">
                  Anzahl
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-[var(--secondary)]">
                  Gesamtbetrag
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-[var(--secondary)]">
                  Monatliche Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.summary.byCreditor)
                .sort(([, a], [, b]) => b.totalPrincipal - a.totalPrincipal)
                .map(([creditor, stats]) => (
                  <tr
                    key={creditor}
                    className="border-b border-[var(--border)] hover:bg-[var(--accent)]"
                  >
                    <td className="py-3 px-4 font-medium">{creditor}</td>
                    <td className="text-center py-3 px-4">{stats.count}</td>
                    <td className="text-right py-3 px-4 font-medium">
                      {formatCurrency(stats.totalPrincipal)}
                    </td>
                    <td className="text-right py-3 px-4 font-medium text-red-600">
                      {formatCurrency(stats.monthlyPayment)}
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--border)] font-bold">
                <td className="py-3 px-4">GESAMT</td>
                <td className="text-center py-3 px-4">
                  {data.summary.contractCount}
                </td>
                <td className="text-right py-3 px-4">
                  {formatCurrency(data.summary.totalDebt)}
                </td>
                <td className="text-right py-3 px-4 text-red-600">
                  {formatCurrency(data.summary.monthlyTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Einzelne Kreditlinien */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Einzelne Kreditlinien
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.creditLines.map((cl, idx) => (
            <div
              key={idx}
              className="border border-[var(--border)] rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedCreditLine(cl)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">
                    {cl.creditor}
                  </h3>
                  <p className="text-sm text-[var(--muted)]">
                    {cl.contractType}
                    {cl.contractNumber && ` • ${cl.contractNumber}`}
                  </p>
                </div>
                {getStatusBadge(cl.status)}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Darlehenssumme:</span>
                  <span className="font-medium">
                    {formatCurrency(cl.principal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Zinssatz:</span>
                  <span className="font-medium">
                    {cl.interestRate !== null && cl.interestRate !== undefined
                      ? `${cl.interestRate.toFixed(2)}% p.a.`
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Tilgungsart:</span>
                  <span className="font-medium">
                    {getRepaymentTypeLabel(cl.repaymentType)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Monatliche Rate:</span>
                  <span className="font-medium text-red-600">
                    {cl.monthlyInterest !== null || cl.monthlyPrincipal !== null
                      ? formatCurrency(
                          (cl.monthlyInterest || 0) + (cl.monthlyPrincipal || 0)
                        )
                      : "-"}
                  </span>
                </div>
                {cl.maturityDate && (
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Fälligkeit:</span>
                    <span className="font-medium">
                      {formatDate(cl.maturityDate)}
                    </span>
                  </div>
                )}
              </div>

              {cl.statusNote && (
                <div className="mt-3 pt-3 border-t border-[var(--border)]">
                  <p className="text-xs text-[var(--muted)]">{cl.statusNote}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Detail-Modal */}
      {selectedCreditLine && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedCreditLine(null)}
        >
          <div
            className="admin-card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-[var(--foreground)]">
                  {selectedCreditLine.creditor}
                </h2>
                <p className="text-[var(--muted)]">
                  {selectedCreditLine.contractType}
                </p>
              </div>
              <button
                onClick={() => setSelectedCreditLine(null)}
                className="btn-secondary"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-[var(--muted)]">Vertragsnummer</p>
                  <p className="font-medium">
                    {selectedCreditLine.contractNumber || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[var(--muted)]">Vertragsdatum</p>
                  <p className="font-medium">
                    {formatDate(selectedCreditLine.contractDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[var(--muted)]">Darlehenssumme</p>
                  <p className="font-medium text-lg">
                    {formatCurrency(selectedCreditLine.principal)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[var(--muted)]">Zinssatz</p>
                  <p className="font-medium">
                    {selectedCreditLine.interestRate !== null &&
                    selectedCreditLine.interestRate !== undefined
                      ? `${selectedCreditLine.interestRate.toFixed(2)}% p.a. (${selectedCreditLine.interestType})`
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[var(--muted)]">Laufzeit</p>
                  <p className="font-medium">
                    {formatDate(selectedCreditLine.startDate)} -{" "}
                    {formatDate(selectedCreditLine.maturityDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[var(--muted)]">Tilgungsart</p>
                  <p className="font-medium">
                    {getRepaymentTypeLabel(selectedCreditLine.repaymentType)}
                  </p>
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-4">
                <h3 className="font-semibold mb-2">Monatliche Kosten</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-[var(--muted)]">Zinsen</p>
                    <p className="font-medium text-orange-600">
                      {selectedCreditLine.monthlyInterest !== null &&
                      selectedCreditLine.monthlyInterest !== undefined
                        ? formatCurrency(selectedCreditLine.monthlyInterest)
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-[var(--muted)]">Tilgung</p>
                    <p className="font-medium text-blue-600">
                      {selectedCreditLine.monthlyPrincipal !== null &&
                      selectedCreditLine.monthlyPrincipal !== undefined
                        ? formatCurrency(selectedCreditLine.monthlyPrincipal)
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-[var(--muted)]">Gesamt</p>
                    <p className="font-medium text-red-600">
                      {(selectedCreditLine.monthlyInterest !== null &&
                        selectedCreditLine.monthlyInterest !== undefined) ||
                      (selectedCreditLine.monthlyPrincipal !== null &&
                        selectedCreditLine.monthlyPrincipal !== undefined)
                        ? formatCurrency(
                            (selectedCreditLine.monthlyInterest || 0) +
                              (selectedCreditLine.monthlyPrincipal || 0)
                          )
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>

              {selectedCreditLine.collateral.length > 0 && (
                <div className="border-t border-[var(--border)] pt-4">
                  <h3 className="font-semibold mb-2">Sicherheiten</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {selectedCreditLine.collateral.map((c, idx) => (
                      <li key={idx} className="text-[var(--secondary)]">
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedCreditLine.statusNote && (
                <div className="border-t border-[var(--border)] pt-4">
                  <h3 className="font-semibold mb-2">Hinweise</h3>
                  <p className="text-sm text-[var(--muted)]">
                    {selectedCreditLine.statusNote}
                  </p>
                </div>
              )}

              <div className="border-t border-[var(--border)] pt-4">
                <p className="text-xs text-[var(--muted)]">
                  Quelle: {selectedCreditLine.sourceFile}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
