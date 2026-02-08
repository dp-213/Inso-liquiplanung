"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

interface LocationData {
  locationId: string;
  locationName: string;
  inflows: string;
  outflows: string;
  netAmount: string;
  count: number;
  entries: {
    id: string;
    date: string;
    description: string;
    amount: string;
    estateAllocation: string | null;
    allocationNote: string | null;
    importSource: string | null;
  }[];
}

interface MonthData {
  month: string;
  inflows: string;
  outflows: string;
  netAmount: string;
  count: number;
}

interface KontobewegungData {
  case: {
    id: string;
    caseNumber: string;
    debtorName: string;
  };
  summary: {
    totalCount: number;
    totalInflows: string;
    totalOutflows: string;
    netAmount: string;
  };
  byLocation: LocationData[];
  byMonth: MonthData[];
}

export default function KontobewegungPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<KontobewegungData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/cases/${id}/kontobewegungen`, {
          credentials: "include",
        });
        if (!res.ok) {
          const err = await res.json();
          setError(err.error || "Fehler beim Laden");
          return;
        }
        const result = await res.json();
        setData(result);
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

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatMonth = (monthKey: string): string => {
    const [year, month] = monthKey.split("-");
    const months = [
      "Januar", "Februar", "März", "April", "Mai", "Juni",
      "Juli", "August", "September", "Oktober", "November", "Dezember"
    ];
    return `${months[parseInt(month) - 1]} ${year}`;
  };

  const toggleLocation = (locId: string) => {
    const newExpanded = new Set(expandedLocations);
    if (newExpanded.has(locId)) {
      newExpanded.delete(locId);
    } else {
      newExpanded.add(locId);
    }
    setExpandedLocations(newExpanded);
  };

  const getEstateAllocationBadge = (allocation: string | null) => {
    if (!allocation) return null;
    const styles: Record<string, string> = {
      ALTMASSE: "bg-amber-100 text-amber-800",
      NEUMASSE: "bg-green-100 text-green-800",
      MIXED: "bg-purple-100 text-purple-800",
      UNKLAR: "bg-gray-100 text-gray-600",
    };
    const labels: Record<string, string> = {
      ALTMASSE: "Alt",
      NEUMASSE: "Neu",
      MIXED: "Mix",
      UNKLAR: "?",
    };
    return (
      <span className={`px-1.5 py-0.5 text-xs rounded ${styles[allocation] || "bg-gray-100"}`}>
        {labels[allocation] || allocation}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <p className="text-[var(--danger)]">{error || "Keine Daten"}</p>
          <Link href="/admin/cases" className="btn-secondary mt-4 inline-block">
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
        <Link href="/admin/cases" className="hover:text-[var(--primary)]">Fälle</Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link href={`/admin/cases/${id}`} className="hover:text-[var(--primary)]">
          {data.case.debtorName}
        </Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[var(--foreground)]">IST-Kontobewegungen</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">IST-Kontobewegungen</h1>
          <p className="text-[var(--secondary)] mt-1">
            {data.case.caseNumber} - {data.summary.totalCount} Buchungen
          </p>
        </div>
        <div className="flex gap-3">
          <Link href={`/admin/cases/${id}/ledger?valueType=IST`} className="btn-secondary">
            Zur Detailansicht
          </Link>
          <Link href={`/admin/cases/${id}/results`} className="btn-primary">
            Dashboard
          </Link>
        </div>
      </div>

      {/* Gesamt-Übersicht */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold mb-4 text-[var(--foreground)]">Gesamt</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-[var(--muted)]">Buchungen</p>
            <p className="text-3xl font-bold text-[var(--foreground)]">{data.summary.totalCount}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--muted)]">Einzahlungen</p>
            <p className="text-3xl font-bold text-[var(--success)]">
              {formatCurrency(data.summary.totalInflows)}
            </p>
          </div>
          <div>
            <p className="text-sm text-[var(--muted)]">Auszahlungen</p>
            <p className="text-3xl font-bold text-[var(--danger)]">
              {formatCurrency(data.summary.totalOutflows)}
            </p>
          </div>
          <div>
            <p className="text-sm text-[var(--muted)]">Netto</p>
            <p className={`text-3xl font-bold ${parseInt(data.summary.netAmount) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
              {formatCurrency(data.summary.netAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* Nach Monat */}
      {data.byMonth.length > 0 && (
        <div className="admin-card p-6">
          <h2 className="text-lg font-semibold mb-4 text-[var(--foreground)]">Nach Monat</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Monat</th>
                  <th className="text-right py-2 px-3 font-medium">Buchungen</th>
                  <th className="text-right py-2 px-3 font-medium">Einzahlungen</th>
                  <th className="text-right py-2 px-3 font-medium">Auszahlungen</th>
                  <th className="text-right py-2 px-3 font-medium">Netto</th>
                </tr>
              </thead>
              <tbody>
                {data.byMonth.map((m) => (
                  <tr key={m.month} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium">{formatMonth(m.month)}</td>
                    <td className="py-2 px-3 text-right">{m.count}</td>
                    <td className="py-2 px-3 text-right text-[var(--success)]">
                      {formatCurrency(m.inflows)}
                    </td>
                    <td className="py-2 px-3 text-right text-[var(--danger)]">
                      {formatCurrency(m.outflows)}
                    </td>
                    <td className={`py-2 px-3 text-right font-medium ${parseInt(m.netAmount) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                      {formatCurrency(m.netAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Nach Standort */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Nach Standort</h2>

        {data.byLocation.map((loc) => (
          <div key={loc.locationId} className="admin-card overflow-hidden">
            {/* Location Header - Klickbar */}
            <button
              onClick={() => toggleLocation(loc.locationId)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <svg
                  className={`w-5 h-5 text-[var(--muted)] transition-transform ${expandedLocations.has(loc.locationId) ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <div className="text-left">
                  <h3 className="font-semibold text-[var(--foreground)]">{loc.locationName}</h3>
                  <p className="text-sm text-[var(--muted)]">{loc.count} Buchungen</p>
                </div>
              </div>
              <div className="flex gap-8 text-right">
                <div>
                  <p className="text-xs text-[var(--muted)]">Einzahlungen</p>
                  <p className="font-semibold text-[var(--success)]">{formatCurrency(loc.inflows)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Auszahlungen</p>
                  <p className="font-semibold text-[var(--danger)]">{formatCurrency(loc.outflows)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Netto</p>
                  <p className={`font-semibold ${parseInt(loc.netAmount) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                    {formatCurrency(loc.netAmount)}
                  </p>
                </div>
              </div>
            </button>

            {/* Location Details - Expandierbar */}
            {expandedLocations.has(loc.locationId) && (
              <div className="border-t">
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium">Datum</th>
                        <th className="text-left py-2 px-3 font-medium">Beschreibung</th>
                        <th className="text-center py-2 px-3 font-medium">Alt/Neu</th>
                        <th className="text-right py-2 px-3 font-medium">Betrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loc.entries.map((entry) => {
                        const amount = parseInt(entry.amount);
                        return (
                          <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-3 whitespace-nowrap">{formatDate(entry.date)}</td>
                            <td className="py-2 px-3">
                              <div className="max-w-md truncate" title={entry.description}>
                                {entry.description}
                              </div>
                              {entry.importSource && (
                                <div className="text-xs text-[var(--muted)]">{entry.importSource}</div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {getEstateAllocationBadge(entry.estateAllocation)}
                            </td>
                            <td className={`py-2 px-3 text-right font-mono whitespace-nowrap ${amount >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                              {formatCurrency(entry.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
