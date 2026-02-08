"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

interface VerificationSummary {
  matched: { count: number; totalAmount: number };
  pending: { count: number; totalAmount: number };
  amountMismatch: { count: number; totalDiscrepancy: number };
  unplanned: { count: number; totalAmount: number };
  policyViolation: { count: number; totalAmount: number };
}

interface FreigabeEntry {
  lfdNr: number | null;
  standort: string | null;
  belegdatum: string | null;
  gegenstand: string | null;
  lieferant: string | null;
  betragBrutto: number | null;
  status: string | null;
  rechnungsnummer: string | null;
  zahlBetrag: number | null;
  bezahltAm: string | null;
}

interface IskTransaction {
  date: string;
  amount: number;
  description: string;
  counterparty: string;
  source: {
    file: string;
    account: string;
    period: any;
  };
}

interface MatchEntry {
  category: string;
  freigabe: FreigabeEntry | null;
  isk: IskTransaction | null;
  confidence: number | null;
  reason: string;
  discrepancy?: {
    expected: number;
    actual: number;
    difference: number;
  };
}

interface VerificationData {
  createdAt: string;
  sources: {
    freigabeliste: string;
    iskOutflows: string;
  };
  parameters: {
    dateToleranceDays: number;
    amountToleranceEUR: number;
    stringSimilarityThreshold: number;
  };
  summary: VerificationSummary;
  details: {
    matched: MatchEntry[];
    pending: MatchEntry[];
    amountMismatch: MatchEntry[];
    unplanned: MatchEntry[];
    policyViolation: MatchEntry[];
  };
}

export default function ZahlungsverifikationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VerificationData | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("matched");

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch(`/api/cases/${id}/zahlungsverifikation`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Fehler beim Laden der Verifikationsdaten");
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Unbekannter Fehler");
        }

        if (!result.available) {
          setError(result.message || "Keine Verifikationsdaten verfügbar");
          setLoading(false);
          return;
        }

        setData(result.data);
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
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("de-DE");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
          <p className="text-[var(--muted)]">Lade Verifikationsdaten...</p>
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
          <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <Link href={`/admin/cases/${id}`} className="hover:text-[var(--primary)]">
            Fall
          </Link>
          <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-[var(--foreground)]">Zahlungsverifikation</span>
        </div>

        {/* Error Card */}
        <div className="admin-card p-6">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
              {error}
            </h2>
            <p className="text-[var(--muted)] mb-4">
              Führen Sie zuerst die Zahlungsverifikation durch.
            </p>
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

  const summary = data.summary;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-[var(--muted)]">
        <Link href="/admin/cases" className="hover:text-[var(--primary)]">
          Fälle
        </Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link href={`/admin/cases/${id}`} className="hover:text-[var(--primary)]">
          Fall
        </Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[var(--foreground)]">Zahlungsverifikation</span>
      </div>

      {/* Header */}
      <div className="admin-card p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
          Zahlungsverifikation
        </h1>
        <p className="text-[var(--muted)]">
          Freigabeliste vs. ISK-Kontoauszüge (Nov 2025 - Jan 2026)
        </p>
        <div className="mt-4 text-sm text-[var(--secondary)]">
          Erstellt: {formatDate(data.createdAt)} | Quellen: {data.sources.freigabeliste}, {data.sources.iskOutflows}
        </div>
      </div>

      {/* Executive Summary */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Executive Summary
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--secondary)]">
                  Kategorie
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-[var(--secondary)]">
                  Anzahl
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-[var(--secondary)]">
                  Betrag
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--secondary)]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--border)] hover:bg-[var(--accent)] cursor-pointer" onClick={() => setActiveCategory("matched")}>
                <td className="py-3 px-4">
                  <span className="text-green-600 mr-2">✅</span>
                  Matched (Approved & Paid)
                </td>
                <td className="text-right py-3 px-4 font-medium">
                  {summary.matched.count}
                </td>
                <td className="text-right py-3 px-4 font-medium">
                  {formatCurrency(summary.matched.totalAmount)}
                </td>
                <td className="py-3 px-4">
                  <span className="badge badge-success">OK</span>
                </td>
              </tr>
              <tr className="border-b border-[var(--border)] hover:bg-[var(--accent)] cursor-pointer" onClick={() => setActiveCategory("pending")}>
                <td className="py-3 px-4">
                  <span className="text-yellow-600 mr-2">⏳</span>
                  Pending (Approved, Not Yet Paid)
                </td>
                <td className="text-right py-3 px-4 font-medium">
                  {summary.pending.count}
                </td>
                <td className="text-right py-3 px-4 font-medium">
                  {formatCurrency(summary.pending.totalAmount)}
                </td>
                <td className="py-3 px-4">
                  <span className="badge badge-warning">OK (future-dated)</span>
                </td>
              </tr>
              <tr className="border-b border-[var(--border)] hover:bg-[var(--accent)] cursor-pointer" onClick={() => setActiveCategory("amountMismatch")}>
                <td className="py-3 px-4">
                  <span className="text-orange-600 mr-2">⚠️</span>
                  Amount Mismatch
                </td>
                <td className="text-right py-3 px-4 font-medium">
                  {summary.amountMismatch.count}
                </td>
                <td className="text-right py-3 px-4 font-medium">
                  Differenz: {formatCurrency(summary.amountMismatch.totalDiscrepancy)}
                </td>
                <td className="py-3 px-4">
                  {summary.amountMismatch.count > 0 ? (
                    <span className="badge badge-warning">Investigate</span>
                  ) : (
                    <span className="badge badge-success">OK</span>
                  )}
                </td>
              </tr>
              <tr className="border-b border-[var(--border)] hover:bg-[var(--accent)] cursor-pointer" onClick={() => setActiveCategory("unplanned")}>
                <td className="py-3 px-4">
                  <span className="text-blue-600 mr-2">❓</span>
                  Unplanned (Paid, No Approval)
                </td>
                <td className="text-right py-3 px-4 font-medium">
                  {summary.unplanned.count}
                </td>
                <td className="text-right py-3 px-4 font-medium">
                  {formatCurrency(summary.unplanned.totalAmount)}
                </td>
                <td className="py-3 px-4">
                  <span className="badge badge-info">Siehe Details</span>
                </td>
              </tr>
              <tr className="border-b border-[var(--border)] hover:bg-[var(--accent)] cursor-pointer" onClick={() => setActiveCategory("policyViolation")}>
                <td className="py-3 px-4">
                  <span className="text-red-600 mr-2">❌</span>
                  Policy Violation (Rejected but Paid)
                </td>
                <td className="text-right py-3 px-4 font-medium">
                  {summary.policyViolation.count}
                </td>
                <td className="text-right py-3 px-4 font-medium">
                  {formatCurrency(summary.policyViolation.totalAmount)}
                </td>
                <td className="py-3 px-4">
                  {summary.policyViolation.count > 0 ? (
                    <span className="badge badge-error">CRITICAL</span>
                  ) : (
                    <span className="badge badge-success">OK</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {summary.policyViolation.count > 0 && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-red-800">
                  Kritische Policy Violations gefunden!
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  {summary.policyViolation.count} Zahlung(en) wurden abgelehnt, aber trotzdem bezahlt. Insolvenzverwalter informieren!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Details Section */}
      <div className="admin-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Details
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveCategory("matched")}
              className={`px-3 py-1.5 text-sm rounded ${activeCategory === "matched" ? "bg-[var(--primary)] text-white" : "bg-[var(--accent)] text-[var(--foreground)]"}`}
            >
              ✅ Matched ({summary.matched.count})
            </button>
            <button
              onClick={() => setActiveCategory("pending")}
              className={`px-3 py-1.5 text-sm rounded ${activeCategory === "pending" ? "bg-[var(--primary)] text-white" : "bg-[var(--accent)] text-[var(--foreground)]"}`}
            >
              ⏳ Pending ({summary.pending.count})
            </button>
            <button
              onClick={() => setActiveCategory("unplanned")}
              className={`px-3 py-1.5 text-sm rounded ${activeCategory === "unplanned" ? "bg-[var(--primary)] text-white" : "bg-[var(--accent)] text-[var(--foreground)]"}`}
            >
              ❓ Unplanned ({summary.unplanned.count})
            </button>
          </div>
        </div>

        {/* Matched */}
        {activeCategory === "matched" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 px-3 font-medium text-[var(--secondary)]">lfd. Nr.</th>
                  <th className="text-left py-2 px-3 font-medium text-[var(--secondary)]">Standort</th>
                  <th className="text-left py-2 px-3 font-medium text-[var(--secondary)]">Datum</th>
                  <th className="text-left py-2 px-3 font-medium text-[var(--secondary)]">Lieferant</th>
                  <th className="text-right py-2 px-3 font-medium text-[var(--secondary)]">Betrag</th>
                  <th className="text-center py-2 px-3 font-medium text-[var(--secondary)]">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {data.details.matched.slice(0, 50).map((entry, idx) => (
                  <tr key={idx} className="border-b border-[var(--border)] hover:bg-[var(--accent)]">
                    <td className="py-2 px-3">{entry.freigabe?.lfdNr || "-"}</td>
                    <td className="py-2 px-3">{entry.freigabe?.standort || "-"}</td>
                    <td className="py-2 px-3">{formatDate(entry.freigabe?.bezahltAm || null)}</td>
                    <td className="py-2 px-3">{entry.freigabe?.lieferant?.substring(0, 30) || "-"}</td>
                    <td className="text-right py-2 px-3 font-medium">
                      {formatCurrency(entry.freigabe?.zahlBetrag || 0)}
                    </td>
                    <td className="text-center py-2 px-3">
                      <span className="badge badge-success text-xs">
                        {((entry.confidence || 0) * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.details.matched.length > 50 && (
              <p className="text-sm text-[var(--muted)] mt-4 text-center">
                ... und {data.details.matched.length - 50} weitere Einträge
              </p>
            )}
          </div>
        )}

        {/* Pending */}
        {activeCategory === "pending" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 px-3 font-medium text-[var(--secondary)]">lfd. Nr.</th>
                  <th className="text-left py-2 px-3 font-medium text-[var(--secondary)]">Standort</th>
                  <th className="text-left py-2 px-3 font-medium text-[var(--secondary)]">Lieferant</th>
                  <th className="text-right py-2 px-3 font-medium text-[var(--secondary)]">Betrag</th>
                  <th className="text-left py-2 px-3 font-medium text-[var(--secondary)]">Zahlungsdatum</th>
                  <th className="text-left py-2 px-3 font-medium text-[var(--secondary)]">Grund</th>
                </tr>
              </thead>
              <tbody>
                {data.details.pending.slice(0, 50).map((entry, idx) => (
                  <tr key={idx} className="border-b border-[var(--border)] hover:bg-[var(--accent)]">
                    <td className="py-2 px-3">{entry.freigabe?.lfdNr || "-"}</td>
                    <td className="py-2 px-3">{entry.freigabe?.standort || "-"}</td>
                    <td className="py-2 px-3">{entry.freigabe?.lieferant?.substring(0, 25) || "-"}</td>
                    <td className="text-right py-2 px-3 font-medium">
                      {formatCurrency(entry.freigabe?.zahlBetrag || 0)}
                    </td>
                    <td className="py-2 px-3">{formatDate(entry.freigabe?.bezahltAm || null)}</td>
                    <td className="py-2 px-3 text-xs text-[var(--muted)]">
                      {entry.reason.substring(0, 50)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.details.pending.length > 50 && (
              <p className="text-sm text-[var(--muted)] mt-4 text-center">
                ... und {data.details.pending.length - 50} weitere Einträge
              </p>
            )}
          </div>
        )}

        {/* Unplanned */}
        {activeCategory === "unplanned" && (
          <div>
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Hinweis:</strong> Diese ISK-Ausgaben konnten nicht mit Freigabeliste-Einträgen gematched werden.
                Hauptgründe: Sammelüberweisungen (mehrere Rechnungen gebündelt), Sonder-Zahlungen (z.B. IV-Vorfinanzierung), fehlende Genehmigungen.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 px-3 font-medium text-[var(--secondary)]">Datum</th>
                    <th className="text-right py-2 px-3 font-medium text-[var(--secondary)]">Betrag</th>
                    <th className="text-left py-2 px-3 font-medium text-[var(--secondary)]">Gegenpartei</th>
                    <th className="text-left py-2 px-3 font-medium text-[var(--secondary)]">Beschreibung</th>
                    <th className="text-left py-2 px-3 font-medium text-[var(--secondary)]">Konto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.details.unplanned.map((entry, idx) => (
                    <tr key={idx} className="border-b border-[var(--border)] hover:bg-[var(--accent)]">
                      <td className="py-2 px-3">{formatDate(entry.isk?.date || null)}</td>
                      <td className="text-right py-2 px-3 font-medium">
                        {formatCurrency(Math.abs(entry.isk?.amount || 0))}
                      </td>
                      <td className="py-2 px-3">{entry.isk?.counterparty?.substring(0, 25) || "-"}</td>
                      <td className="py-2 px-3 text-xs">{entry.isk?.description?.substring(0, 40) || "-"}</td>
                      <td className="py-2 px-3 text-xs text-[var(--muted)]">
                        {entry.isk?.source.account || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Technical Details */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Technische Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[var(--muted)]">Datums-Toleranz</p>
            <p className="font-medium">±{data.parameters.dateToleranceDays} Tage</p>
          </div>
          <div>
            <p className="text-[var(--muted)]">Betrags-Toleranz</p>
            <p className="font-medium">±{formatCurrency(data.parameters.amountToleranceEUR)}</p>
          </div>
          <div>
            <p className="text-[var(--muted)]">String-Ähnlichkeit</p>
            <p className="font-medium">≥{(data.parameters.stringSimilarityThreshold * 100).toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-[var(--muted)]">Erstellt</p>
            <p className="font-medium">{formatDate(data.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
