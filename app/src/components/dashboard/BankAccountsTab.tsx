"use client";

import { useState, useEffect } from "react";

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
}

interface BankAccountsSummary {
  totalBalanceCents: string;
  totalAvailableCents: string;
  accountCount: number;
}

interface BankAccountsData {
  accounts: BankAccountDetail[];
  summary: BankAccountsSummary;
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
      minimumFractionDigits: 2,
    }).format(euros);
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

  // Gruppiere Accounts nach Location
  const accountsByLocation: Record<string, BankAccountDetail[]> = {
    ZENTRAL: [],
  };

  for (const acc of data.accounts) {
    const locationKey = acc.location ? acc.location.name : "ZENTRAL";
    if (!accountsByLocation[locationKey]) {
      accountsByLocation[locationKey] = [];
    }
    accountsByLocation[locationKey].push(acc);
  }

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

      {/* Konten gruppiert nach Location */}
      {Object.entries(accountsByLocation).map(([locationName, accounts]) => {
        if (accounts.length === 0) return null;

        return (
          <div key={locationName} className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
              {locationName}
            </h3>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 bg-white rounded-lg shadow">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bankkonto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Opening Balance
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IST-Bewegungen
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aktueller Saldo
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {accounts.map((acc) => (
                    <tr
                      key={acc.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {acc.accountName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {acc.bankName}
                        </div>
                        {acc.iban && (
                          <div className="text-xs text-gray-400 font-mono">
                            {acc.iban}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            STATUS_COLORS[acc.status] || "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {STATUS_LABELS[acc.status] || acc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-700">
                        {formatCents(acc.openingBalanceCents)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono">
                        <span
                          className={
                            Number(acc.ledgerSumCents) >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {formatCents(acc.ledgerSumCents)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-semibold">
                        <span
                          className={
                            Number(acc.currentBalanceCents) >= 0
                              ? "text-green-700"
                              : "text-red-700"
                          }
                        >
                          {formatCents(acc.currentBalanceCents)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Legende */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Legende</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>
            <strong>Opening Balance:</strong> Anfangssaldo vor allen
            Ledger-Buchungen (aus Planversion)
          </li>
          <li>
            <strong>IST-Bewegungen:</strong> Summe aller IST-Buchungen aus dem
            Ledger für dieses Konto
          </li>
          <li>
            <strong>Aktueller Saldo:</strong> Opening Balance + IST-Bewegungen
          </li>
          <li>
            <strong>Verfügbar:</strong> Summe aller nicht gesperrten Konten
          </li>
        </ul>
      </div>
    </div>
  );
}
