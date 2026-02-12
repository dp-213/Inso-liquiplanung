"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardNav from "@/components/external/DashboardNav";

interface BankAccountData {
  id: string;
  bankName: string;
  accountName: string;
  iban: string | null;
  openingBalanceCents: string;
  currentBalanceCents: string;
  securityHolder: string | null;
  status: string;
  notes: string | null;
}

interface CaseData {
  case: {
    id: string;
    caseNumber: string;
    debtorName: string;
    courtName: string;
    status: string;
  };
  bankAccounts: {
    accounts: BankAccountData[];
    summary: {
      totalBalanceCents: string;
      totalAvailableCents: string;
      accountCount: number;
    };
  };
}

function formatCents(cents: string | null): string {
  if (cents === null) return "—";
  return (Number(cents) / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function AccountStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "available":
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Verfügbar</span>;
    case "blocked":
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Gesperrt</span>;
    case "restricted":
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Eingeschränkt</span>;
    default:
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">{status}</span>;
  }
}

export default function BankenSicherungsrechtePage() {
  const params = useParams();
  const caseId = params.id as string;
  const [data, setData] = useState<CaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/customer/cases/${caseId}`, {
          credentials: "include",
        });
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-[var(--secondary)]">Bankdaten werden geladen...</p>
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

  const { accounts, summary } = data.bankAccounts;
  const accountsWithSecurity = accounts.filter((a) => a.securityHolder);

  return (
    <div className="space-y-6">
      {/* Case Header */}
      <div className="admin-card p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Banken & Sicherungsrechte
        </h1>
        <p className="mt-1 text-sm text-[var(--secondary)]">
          {data.case.debtorName} | {data.case.caseNumber}
        </p>
      </div>

      {/* Dashboard Navigation */}
      <DashboardNav caseId={caseId} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Bankkonten</div>
          <div className="text-2xl font-bold text-[var(--foreground)]">
            {summary.accountCount}
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Gesamtsaldo</div>
          <div className="text-2xl font-bold text-[var(--foreground)]">
            {formatCents(summary.totalBalanceCents)}
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Davon verfügbar</div>
          <div className="text-2xl font-bold text-green-600">
            {formatCents(summary.totalAvailableCents)}
          </div>
        </div>
      </div>

      {/* Bankenspiegel */}
      <div className="admin-card">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)] flex items-center">
            <svg className="w-5 h-5 mr-2 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Bankenspiegel
          </h2>
        </div>

        {accounts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Bank / Konto</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">IBAN</th>
                  <th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">Saldo</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Sicherungsnehmer</th>
                  <th className="text-center py-3 px-4 font-medium text-[var(--secondary)]">Status</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="border-b border-[var(--border)]">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-[var(--foreground)]">{account.bankName}</p>
                        <p className="text-xs text-[var(--muted)]">{account.accountName}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-[var(--secondary)]">
                      {account.iban || "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-[var(--foreground)]">
                      {formatCents(account.currentBalanceCents)}
                    </td>
                    <td className="py-3 px-4">
                      {account.securityHolder ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          {account.securityHolder}
                        </span>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <AccountStatusBadge status={account.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--accent)] font-medium">
                  <td colSpan={2} className="py-3 px-4 text-[var(--foreground)]">Summe</td>
                  <td className="py-3 px-4 text-right text-[var(--foreground)]">
                    {formatCents(summary.totalBalanceCents)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-[var(--muted)]">
            Keine Bankkonten vorhanden
          </div>
        )}
      </div>

      {/* Sicherungsrechte */}
      {accountsWithSecurity.length > 0 && (
        <div className="admin-card">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold text-[var(--foreground)] flex items-center">
              <svg className="w-5 h-5 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Sicherungsrechte
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Sicherungsnehmer</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Betroffenes Konto</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Bank</th>
                  <th className="text-center py-3 px-4 font-medium text-[var(--secondary)]">Kontostatus</th>
                </tr>
              </thead>
              <tbody>
                {accountsWithSecurity.map((account) => (
                  <tr key={account.id} className="border-b border-[var(--border)]">
                    <td className="py-3 px-4 font-medium text-[var(--foreground)]">
                      {account.securityHolder}
                    </td>
                    <td className="py-3 px-4 text-[var(--secondary)]">
                      {account.accountName}
                    </td>
                    <td className="py-3 px-4 text-[var(--secondary)]">
                      {account.bankName}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <AccountStatusBadge status={account.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
