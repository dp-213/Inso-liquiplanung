"use client";

import { useState, useEffect } from "react";

interface BankAccountPeriod {
  periodIndex: number;
  periodLabel: string;
  balanceCents: string;
  isFrozen?: boolean;
  lastUpdateDate?: string;
}

interface BankAccountDetail {
  id: string;
  bankName: string;
  accountName: string;
  iban: string | null;
  status: string;
  location: { id: string; name: string } | null;
  openingBalanceCents: string;
  ledgerSumCents: string;
  currentBalanceCents: string;
  periods: BankAccountPeriod[];
}

interface BankAccountsSummary {
  totalBalanceCents: string;
  totalAvailableCents: string;
  accountCount: number;
}

interface BankAccountsData {
  accounts: BankAccountDetail[];
  summary: BankAccountsSummary;
  planInfo: {
    periodType: "WEEKLY" | "MONTHLY";
    periodCount: number;
  };
}

const STATUS_LABELS: Record<string, string> = {
  available: "Verfügbar",
  blocked: "Gesperrt",
  restricted: "Eingeschränkt",
  secured: "Gesichert",
  disputed: "Umstritten",
};

const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  blocked: "bg-red-100 text-red-800",
  restricted: "bg-yellow-100 text-yellow-800",
  secured: "bg-blue-100 text-blue-800",
  disputed: "bg-orange-100 text-orange-800",
};

// Kontext-Infos für bekannte Konten
const ACCOUNT_CONTEXT: Record<string, { usage: string; notes?: string }> = {
  "ISK Velbert": {
    usage: "KV, HZV, PVS (Velbert)",
    notes: "Seit Dez 2025 aktiv",
  },
  "ISK Uckerath": {
    usage: "KV, HZV (Uckerath + Eitorf)",
    notes: "Seit Nov 2025 aktiv - erhält ALLE HZV-Zahlungen",
  },
  "Geschäftskonto MVZ Velbert": {
    usage: "KV, HZV, PVS (Velbert)",
    notes: "Massekreditvereinbarung aktiv",
  },
  "MVZ Uckerath (Betriebskonto)": {
    usage: "KV, HZV, PVS (Uckerath)",
    notes: "Im November 2025 geschlossen",
  },
  "HV PLUS eG (Zentrale)": {
    usage: "Zentrale Zahlungen",
    notes: "Gesichert durch Bank",
  },
};

export default function BankAccountsTab({ caseId }: { caseId: string }) {
  const [data, setData] = useState<BankAccountsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/cases/${caseId}/bank-accounts`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(`Fehler beim Laden: ${res.status}`);
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [caseId]);

  const formatCents = (cents: string) => {
    const euros = Number(cents) / 100;
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(euros);
  };

  const formatIban = (iban: string) => {
    // Zeige nur die letzten 4 Ziffern
    return `...${iban.slice(-4)}`;
  };

  const getTrend = (current: string, previous: string): "up" | "down" | "stable" => {
    const diff = Number(current) - Number(previous);
    if (Math.abs(diff) < 1000) return "stable"; // < 10 EUR
    return diff > 0 ? "up" : "down";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Lade Bankkonten...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Fehler: {error}</p>
      </div>
    );
  }

  if (!data || data.accounts.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">Keine Bankkonten vorhanden</p>
      </div>
    );
  }

  // Gruppiere und sortiere Accounts nach Location
  const accountsByLocation: Record<string, BankAccountDetail[]> = {};
  const locationOrder = ["Velbert", "Uckerath/Eitorf", "Zentral"];

  for (const acc of data.accounts) {
    let locationKey: string;
    if (!acc.location) {
      locationKey = "Zentral";
      console.log(`[BankAccounts] ${acc.accountName}: NO location → Zentral`);
    } else {
      const locName = acc.location.name.toLowerCase();
      console.log(`[BankAccounts] ${acc.accountName}: location="${acc.location.name}" (lowercase="${locName}")`);

      if (locName.includes("velbert")) {
        locationKey = "Velbert";
      } else if (locName.includes("uckerath") || locName.includes("eitorf")) {
        locationKey = "Uckerath/Eitorf";
      } else {
        // HVPlus eG oder andere zentrale Locations
        locationKey = "Zentral";
      }
      console.log(`[BankAccounts]   → Grouped as: ${locationKey}`);
    }

    if (!accountsByLocation[locationKey]) {
      accountsByLocation[locationKey] = [];
    }
    accountsByLocation[locationKey].push(acc);
  }

  console.log('[BankAccounts] Final groups:', Object.keys(accountsByLocation));

  // Sortiere Konten innerhalb jeder Location (ISK zuerst, dann alphabetisch)
  Object.values(accountsByLocation).forEach((accounts) => {
    accounts.sort((a, b) => {
      const aIsISK = a.accountName.startsWith("ISK");
      const bIsISK = b.accountName.startsWith("ISK");
      if (aIsISK && !bIsISK) return -1;
      if (!aIsISK && bIsISK) return 1;
      return a.accountName.localeCompare(b.accountName);
    });
  });

  return (
    <div className="space-y-8">
      {/* Header mit Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Bankkonto-Übersicht
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-600">Anzahl Konten</div>
            <div className="text-2xl font-bold text-gray-900">
              {data.summary.accountCount}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Gesamtsaldo (aktuell)</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCents(data.summary.totalBalanceCents)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Verfügbar</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCents(data.summary.totalAvailableCents)}
            </div>
          </div>
        </div>
      </div>

      {/* Monatliche Verläufe - Horizontal */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Kontoverläufe ({data.planInfo.periodType === "MONTHLY" ? "Monatlich" : "Wöchentlich"})
        </h2>

        {locationOrder.map((locationName) => {
          const accounts = accountsByLocation[locationName];
          if (!accounts || accounts.length === 0) return null;

          return (
            <div key={locationName} className="space-y-4">
              {/* Location Header */}
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-800">
                  {locationName}
                </h3>
                <div className="flex-1 h-px bg-gray-300"></div>
              </div>

              {/* Horizontale Tabelle pro Konto */}
              {accounts.map((acc) => {
                const context = ACCOUNT_CONTEXT[acc.accountName];

                return (
                  <div
                    key={acc.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                  >
                    {/* Konto-Header */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-base font-semibold text-gray-900">
                              {acc.accountName}
                            </h4>
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                STATUS_COLORS[acc.status] || "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {STATUS_LABELS[acc.status] || acc.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                            <span className="flex items-center gap-1">
                              <span className="font-medium">Bank:</span>
                              {acc.bankName}
                            </span>
                            {acc.iban && (
                              <span className="flex items-center gap-1 font-mono" title={acc.iban}>
                                <span className="font-medium">IBAN:</span>
                                {formatIban(acc.iban)}
                              </span>
                            )}
                            {context && (
                              <>
                                <span className="flex items-center gap-1">
                                  <span className="font-medium">Verwendung:</span>
                                  {context.usage}
                                </span>
                                {context.notes && (
                                  <span className="text-blue-700 font-medium">
                                    ℹ️ {context.notes}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Horizontale Perioden-Tabelle */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 z-10">
                              Opening
                            </th>
                            {acc.periods.map((period) => (
                              <th
                                key={period.periodIndex}
                                className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap"
                              >
                                {period.periodLabel}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          <tr className="hover:bg-gray-50 transition-colors">
                            {/* Opening Balance - Sticky */}
                            <td className="sticky left-0 bg-blue-50 px-4 py-3 border-r border-gray-200 z-10">
                              <div className="text-sm font-bold text-blue-900 text-right font-mono">
                                {formatCents(acc.openingBalanceCents)}
                              </div>
                            </td>
                            {/* Perioden */}
                            {acc.periods.map((period, idx) => {
                              const prevBalance = idx === 0 ? acc.openingBalanceCents : acc.periods[idx - 1].balanceCents;
                              const trend = getTrend(period.balanceCents, prevBalance);
                              const isPositive = Number(period.balanceCents) >= 0;

                              // Formatiere Datum für frozen periods
                              const formatDate = (isoDate: string) => {
                                const date = new Date(isoDate);
                                return date.toLocaleDateString("de-DE", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                });
                              };

                              return (
                                <td
                                  key={period.periodIndex}
                                  className="px-4 py-3 text-center border-l border-gray-100"
                                >
                                  {period.isFrozen ? (
                                    // Frozen: Zeige Stand vom letzten Kontoauszug
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="text-xs text-gray-500">
                                        Stand vom
                                      </span>
                                      <span className="text-xs text-gray-500 font-medium">
                                        {period.lastUpdateDate && formatDate(period.lastUpdateDate)}
                                      </span>
                                      <span
                                        className={`text-sm font-semibold font-mono ${
                                          isPositive ? "text-gray-600" : "text-gray-600"
                                        }`}
                                      >
                                        {formatCents(period.balanceCents)}
                                      </span>
                                    </div>
                                  ) : (
                                    // Normal: Zeige aktuellen Stand mit Trend
                                    <div className="flex flex-col items-center gap-1">
                                      <span
                                        className={`text-sm font-semibold font-mono ${
                                          isPositive ? "text-green-700" : "text-red-700"
                                        }`}
                                      >
                                        {formatCents(period.balanceCents)}
                                      </span>
                                      {trend !== "stable" && (
                                        <span
                                          className={`text-xs ${
                                            trend === "up" ? "text-green-600" : "text-red-600"
                                          }`}
                                        >
                                          {trend === "up" ? "↑" : "↓"}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legende */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Legende</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>
            <strong>Opening:</strong> Anfangssaldo vor allen Ledger-Buchungen (aus Planversion)
          </li>
          <li>
            <strong>Monate mit IST-Daten:</strong> Kontostand am Ende der Periode (rollierend berechnet)
          </li>
          <li>
            <strong>Monate OHNE IST-Daten:</strong> Letzter bekannter Stand vom letzten Kontoauszug (grau)
          </li>
          <li>
            <strong>Trend-Pfeile:</strong> ↑ steigend, ↓ fallend (ab 10 € Differenz)
          </li>
          <li>
            <strong>Verfügbar:</strong> Summe aller nicht gesperrten Konten
          </li>
        </ul>
      </div>
    </div>
  );
}
