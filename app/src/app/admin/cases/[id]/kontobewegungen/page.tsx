"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

interface EntryData {
  id: string;
  date: string;
  description: string;
  amount: string;
  estateAllocation: string | null;
  allocationNote: string | null;
  importSource: string | null;
  counterpartyId: string | null;
  categoryTag: string | null;
}

interface AccountBucket {
  accountId: string;
  accountName: string;
  bankName: string;
  iban: string | null;
  inflows: string;
  outflows: string;
  netAmount: string;
  count: number;
  entries: EntryData[];
}

interface LocationData {
  locationId: string;
  locationName: string;
  inflows: string;
  outflows: string;
  netAmount: string;
  count: number;
  entries: EntryData[];
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
  byAccountType: {
    isk: AccountBucket[];
    glaeubigerkonten: AccountBucket[];
    ohneBankkonto: AccountBucket | null;
    iskTotal: { inflows: string; outflows: string; count: number };
    glaeubigerTotal: { inflows: string; outflows: string; count: number };
  };
  byLocation: LocationData[];
  byMonth: MonthData[];
}

type TabView = "kontentyp" | "monat" | "standort";

export default function KontobewegungPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<KontobewegungData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabView>("kontentyp");
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
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

  const toggleAccount = (accountId: string) => {
    const next = new Set(expandedAccounts);
    if (next.has(accountId)) {
      next.delete(accountId);
    } else {
      next.add(accountId);
    }
    setExpandedAccounts(next);
  };

  const toggleLocation = (locId: string) => {
    const next = new Set(expandedLocations);
    if (next.has(locId)) {
      next.delete(locId);
    } else {
      next.add(locId);
    }
    setExpandedLocations(next);
  };

  const getEstateAllocationBadge = (allocation: string | null) => {
    if (!allocation) return null;
    const styles: Record<string, string> = {
      ALTMASSE: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      NEUMASSE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      MIXED: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      UNKLAR: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
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

  // Shared: Transaktions-Tabelle rendern
  const renderEntryTable = (entries: EntryData[]) => (
    <div className="border-t border-[var(--border)]">
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--background-secondary)] sticky top-0">
            <tr>
              <th className="text-left py-2 px-3 font-medium text-[var(--foreground)]">Datum</th>
              <th className="text-left py-2 px-3 font-medium text-[var(--foreground)]">Beschreibung</th>
              <th className="text-center py-2 px-3 font-medium text-[var(--foreground)]">Alt/Neu</th>
              <th className="text-right py-2 px-3 font-medium text-[var(--foreground)]">Betrag</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const amount = parseInt(entry.amount);
              return (
                <tr key={entry.id} className="border-b border-[var(--border)] hover:bg-[var(--background-secondary)] transition-colors">
                  <td className="py-2 px-3 whitespace-nowrap text-[var(--foreground)]">{formatDate(entry.date)}</td>
                  <td className="py-2 px-3 text-[var(--foreground)]">
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
  );

  // Shared: Chevron-Icon
  const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
    <svg
      className={`w-5 h-5 text-[var(--muted)] transition-transform ${expanded ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );

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
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">IST-Kontobewegungen</h1>
          <p className="text-[var(--secondary)] mt-1">
            {data.case.caseNumber} – {data.summary.totalCount} Buchungen
          </p>
        </div>
        <div className="flex gap-3">
          <Link href={`/admin/cases/${id}/ledger?valueType=IST`} className="btn-secondary">
            Zur Detailansicht
          </Link>
          <Link href={`/admin/cases/${id}/dashboard`} className="btn-primary">
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

      {/* Tab-Toggle */}
      <div className="flex gap-1 p-1 bg-[var(--background-secondary)] rounded-lg w-fit">
        {([
          { key: "kontentyp", label: "Nach Kontentyp" },
          { key: "monat", label: "Nach Monat" },
          { key: "standort", label: "Nach Standort" },
        ] as { key: TabView; label: string }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.key
                ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Nach Kontentyp */}
      {activeTab === "kontentyp" && (
        <div className="space-y-6">
          {/* ISK (operative Massekonten) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Insolvenz-Sonderkonten (ISK)
              </h2>
              <div className="flex gap-4 text-sm text-[var(--muted)]">
                <span>{data.byAccountType.iskTotal.count} Buchungen</span>
                <span className="text-[var(--success)]">{formatCurrency(data.byAccountType.iskTotal.inflows)}</span>
                <span className="text-[var(--danger)]">{formatCurrency(data.byAccountType.iskTotal.outflows)}</span>
              </div>
            </div>

            {data.byAccountType.isk.length === 0 ? (
              <div className="admin-card p-4 text-center text-[var(--muted)] text-sm">
                Keine Buchungen auf ISK-Konten
              </div>
            ) : (
              data.byAccountType.isk.map((account) => (
                <div key={account.accountId} className="admin-card overflow-hidden">
                  <button
                    onClick={() => toggleAccount(account.accountId)}
                    className="w-full p-4 flex items-center justify-between hover:bg-[var(--background-secondary)] transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <ChevronIcon expanded={expandedAccounts.has(account.accountId)} />
                      <div className="text-left">
                        <h3 className="font-semibold text-[var(--foreground)]">
                          {account.accountName}
                          <span className="font-normal text-[var(--muted)] ml-2">– {account.bankName}</span>
                        </h3>
                        <p className="text-sm text-[var(--muted)]">
                          {account.iban && <span className="font-mono mr-3">{account.iban}</span>}
                          {account.count} Buchungen
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-8 text-right">
                      <div>
                        <p className="text-xs text-[var(--muted)]">Einzahlungen</p>
                        <p className="font-semibold text-[var(--success)]">{formatCurrency(account.inflows)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--muted)]">Auszahlungen</p>
                        <p className="font-semibold text-[var(--danger)]">{formatCurrency(account.outflows)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--muted)]">Netto</p>
                        <p className={`font-semibold ${parseInt(account.netAmount) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                          {formatCurrency(account.netAmount)}
                        </p>
                      </div>
                    </div>
                  </button>
                  {expandedAccounts.has(account.accountId) && renderEntryTable(account.entries)}
                </div>
              ))
            )}
          </div>

          {/* Gläubigerkonten */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Gläubigerkonten
              </h2>
              <div className="flex gap-4 text-sm text-[var(--muted)]">
                <span>{data.byAccountType.glaeubigerTotal.count} Buchungen</span>
                <span className="text-[var(--success)]">{formatCurrency(data.byAccountType.glaeubigerTotal.inflows)}</span>
                <span className="text-[var(--danger)]">{formatCurrency(data.byAccountType.glaeubigerTotal.outflows)}</span>
              </div>
            </div>

            {data.byAccountType.glaeubigerkonten.length === 0 ? (
              <div className="admin-card p-4 text-center text-[var(--muted)] text-sm">
                Keine Buchungen auf Gläubigerkonten
              </div>
            ) : (
              data.byAccountType.glaeubigerkonten.map((account) => (
                <div key={account.accountId} className="admin-card overflow-hidden">
                  <button
                    onClick={() => toggleAccount(account.accountId)}
                    className="w-full p-4 flex items-center justify-between hover:bg-[var(--background-secondary)] transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <ChevronIcon expanded={expandedAccounts.has(account.accountId)} />
                      <div className="text-left">
                        <h3 className="font-semibold text-[var(--foreground)]">
                          {account.accountName}
                          <span className="font-normal text-[var(--muted)] ml-2">– {account.bankName}</span>
                        </h3>
                        <p className="text-sm text-[var(--muted)]">
                          {account.iban && <span className="font-mono mr-3">{account.iban}</span>}
                          {account.count} Buchungen
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-8 text-right">
                      <div>
                        <p className="text-xs text-[var(--muted)]">Einzahlungen</p>
                        <p className="font-semibold text-[var(--success)]">{formatCurrency(account.inflows)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--muted)]">Auszahlungen</p>
                        <p className="font-semibold text-[var(--danger)]">{formatCurrency(account.outflows)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--muted)]">Netto</p>
                        <p className={`font-semibold ${parseInt(account.netAmount) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                          {formatCurrency(account.netAmount)}
                        </p>
                      </div>
                    </div>
                  </button>
                  {expandedAccounts.has(account.accountId) && renderEntryTable(account.entries)}
                </div>
              ))
            )}
          </div>

          {/* Ohne Bankkonto */}
          {data.byAccountType.ohneBankkonto && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Ohne Bankkonto</h2>
              <div className="admin-card overflow-hidden">
                <button
                  onClick={() => toggleAccount("_none")}
                  className="w-full p-4 flex items-center justify-between hover:bg-[var(--background-secondary)] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <ChevronIcon expanded={expandedAccounts.has("_none")} />
                    <div className="text-left">
                      <h3 className="font-semibold text-[var(--foreground)]">Nicht zugeordnet</h3>
                      <p className="text-sm text-[var(--muted)]">{data.byAccountType.ohneBankkonto.count} Buchungen</p>
                    </div>
                  </div>
                  <div className="flex gap-8 text-right">
                    <div>
                      <p className="text-xs text-[var(--muted)]">Netto</p>
                      <p className={`font-semibold ${parseInt(data.byAccountType.ohneBankkonto.netAmount) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                        {formatCurrency(data.byAccountType.ohneBankkonto.netAmount)}
                      </p>
                    </div>
                  </div>
                </button>
                {expandedAccounts.has("_none") && renderEntryTable(data.byAccountType.ohneBankkonto.entries)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Nach Monat */}
      {activeTab === "monat" && data.byMonth.length > 0 && (
        <div className="admin-card p-6">
          <h2 className="text-lg font-semibold mb-4 text-[var(--foreground)]">Nach Monat</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 px-3 font-medium text-[var(--foreground)]">Monat</th>
                  <th className="text-right py-2 px-3 font-medium text-[var(--foreground)]">Buchungen</th>
                  <th className="text-right py-2 px-3 font-medium text-[var(--foreground)]">Einzahlungen</th>
                  <th className="text-right py-2 px-3 font-medium text-[var(--foreground)]">Auszahlungen</th>
                  <th className="text-right py-2 px-3 font-medium text-[var(--foreground)]">Netto</th>
                </tr>
              </thead>
              <tbody>
                {data.byMonth.map((m) => (
                  <tr key={m.month} className="border-b border-[var(--border)] hover:bg-[var(--background-secondary)]">
                    <td className="py-2 px-3 font-medium text-[var(--foreground)]">{formatMonth(m.month)}</td>
                    <td className="py-2 px-3 text-right text-[var(--foreground)]">{m.count}</td>
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

      {/* Tab: Nach Standort */}
      {activeTab === "standort" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Nach Standort</h2>

          {data.byLocation.map((loc) => (
            <div key={loc.locationId} className="admin-card overflow-hidden">
              <button
                onClick={() => toggleLocation(loc.locationId)}
                className="w-full p-4 flex items-center justify-between hover:bg-[var(--background-secondary)] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <ChevronIcon expanded={expandedLocations.has(loc.locationId)} />
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
              {expandedLocations.has(loc.locationId) && renderEntryTable(loc.entries)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
