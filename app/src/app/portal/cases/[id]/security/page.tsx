"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardNav from "@/components/external/DashboardNav";

interface CaseData {
  case: {
    id: string;
    caseNumber: string;
    debtorName: string;
    courtName: string;
    status: string;
  };
  calculation: {
    openingBalanceCents: string;
    finalClosingBalanceCents: string;
  };
}

// Demo data for security rights - in production this would come from the API
const DEMO_BANK_ACCOUNTS = [
  {
    id: "1",
    accountName: "Geschaeftskonto",
    bankName: "Sparkasse Koeln-Bonn",
    iban: "DE89 3704 0044 0532 0130 00",
    balance: BigInt(5000000), // 50,000 EUR
    securityHolder: "Globalzession Bank XY",
    status: "gesperrt",
  },
  {
    id: "2",
    accountName: "Praxiskonto",
    bankName: "VR-Bank Rhein-Sieg",
    iban: "DE89 3806 0186 0123 4567 89",
    balance: BigInt(1200000), // 12,000 EUR
    securityHolder: null,
    status: "verfügbar",
  },
];

const DEMO_SECURITY_RIGHTS = [
  {
    id: "1",
    creditorName: "Sparkasse Koeln-Bonn",
    securityType: "Globalzession",
    assetDescription: "Saemtliche KV-Forderungen",
    estimatedValue: BigInt(12000000), // 120,000 EUR
    settlementStatus: "offen",
    settlementAmount: null,
  },
  {
    id: "2",
    creditorName: "MedTech Leasing GmbH",
    securityType: "Eigentumsvorbehalt",
    assetDescription: "Medizinische Geraete (Roentgen, EKG)",
    estimatedValue: BigInt(3500000), // 35,000 EUR
    settlementStatus: "vereinbarung",
    settlementAmount: BigInt(2800000), // 28,000 EUR
  },
  {
    id: "3",
    creditorName: "Vermieter Praxisraeume",
    securityType: "Vermieterpfandrecht",
    assetDescription: "Praxiseinrichtung",
    estimatedValue: BigInt(1500000), // 15,000 EUR
    settlementStatus: "abgerechnet",
    settlementAmount: BigInt(1500000),
  },
];

export default function SecurityRightsPage() {
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verfügbar":
        return <span className="badge badge-success">Verfügbar</span>;
      case "gesperrt":
        return <span className="badge badge-warning">Gesperrt</span>;
      case "offen":
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Offen</span>;
      case "vereinbarung":
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">In Vereinbarung</span>;
      case "abgerechnet":
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Abgerechnet</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center text-sm text-[var(--muted)]">
          <Link href="/portal" className="hover:text-[var(--primary)]">
            Meine Fälle
          </Link>
          <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-[var(--foreground)]">Wird geladen...</span>
        </div>
        <div className="admin-card p-8 text-center">
          <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-[var(--secondary)]">Sicherungsrechte werden geladen...</p>
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

  // Calculate totals
  const totalBankBalance = DEMO_BANK_ACCOUNTS.reduce((sum, acc) => sum + acc.balance, BigInt(0));
  const availableBalance = DEMO_BANK_ACCOUNTS
    .filter((acc) => acc.status === "verfügbar")
    .reduce((sum, acc) => sum + acc.balance, BigInt(0));

  const totalSecurityValue = DEMO_SECURITY_RIGHTS.reduce((sum, sr) => sum + sr.estimatedValue, BigInt(0));
  const settledAmount = DEMO_SECURITY_RIGHTS
    .filter((sr) => sr.settlementAmount)
    .reduce((sum, sr) => sum + (sr.settlementAmount || BigInt(0)), BigInt(0));

  const settlementProgress = Number(settledAmount) / Number(totalSecurityValue) * 100;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-[var(--muted)]">
        <Link href="/portal" className="hover:text-[var(--primary)]">
          Meine Fälle
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
        <span className="text-[var(--foreground)]">Sicherungsrechte</span>
      </div>

      {/* Case Header */}
      <div className="admin-card p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Sicherungsrechte & Bankabrechnung
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
          <div className="text-sm text-[var(--secondary)]">Bankguthaben Gesamt</div>
          <div className="text-2xl font-bold text-[var(--foreground)]">
            {formatCurrency(totalBankBalance)}
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Davon verfügbar</div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(availableBalance)}
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Sicherungswerte</div>
          <div className="text-2xl font-bold text-[var(--foreground)]">
            {formatCurrency(totalSecurityValue)}
          </div>
        </div>
      </div>

      {/* Section 1: Bank Accounts */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Bankkonto-Übersicht
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Konto</th>
                <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Bank</th>
                <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">IBAN</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">Saldo</th>
                <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Sicherungsnehmer</th>
                <th className="text-center py-3 px-4 font-medium text-[var(--secondary)]">Status</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_BANK_ACCOUNTS.map((account) => (
                <tr key={account.id} className="border-b border-[var(--border)] hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-[var(--foreground)]">{account.accountName}</td>
                  <td className="py-3 px-4 text-[var(--secondary)]">{account.bankName}</td>
                  <td className="py-3 px-4 text-[var(--secondary)] font-mono text-xs">{account.iban}</td>
                  <td className="py-3 px-4 text-right font-medium text-[var(--foreground)]">
                    {formatCurrency(account.balance)}
                  </td>
                  <td className="py-3 px-4 text-[var(--secondary)]">
                    {account.securityHolder || "-"}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {getStatusBadge(account.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Security Rights Register */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Sicherungsrechte-Register
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Sicherungsnehmer</th>
                <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Art</th>
                <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Gegenstand</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">Wert (ca.)</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">Abrechnung</th>
                <th className="text-center py-3 px-4 font-medium text-[var(--secondary)]">Status</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_SECURITY_RIGHTS.map((sr) => (
                <tr key={sr.id} className="border-b border-[var(--border)] hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-[var(--foreground)]">{sr.creditorName}</td>
                  <td className="py-3 px-4 text-[var(--secondary)]">{sr.securityType}</td>
                  <td className="py-3 px-4 text-[var(--secondary)]">{sr.assetDescription}</td>
                  <td className="py-3 px-4 text-right text-[var(--foreground)]">
                    {formatCurrency(sr.estimatedValue)}
                  </td>
                  <td className="py-3 px-4 text-right text-[var(--secondary)]">
                    {sr.settlementAmount ? formatCurrency(sr.settlementAmount) : "-"}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {getStatusBadge(sr.settlementStatus)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-medium">
                <td colSpan={3} className="py-3 px-4 text-[var(--foreground)]">Summe</td>
                <td className="py-3 px-4 text-right text-[var(--foreground)]">
                  {formatCurrency(totalSecurityValue)}
                </td>
                <td className="py-3 px-4 text-right text-[var(--foreground)]">
                  {formatCurrency(settledAmount)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Section 3: Settlement Progress */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Verwertungsfortschritt
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--secondary)]">Abgerechnet</span>
            <span className="font-medium text-[var(--foreground)]">
              {formatCurrency(settledAmount)} von {formatCurrency(totalSecurityValue)}
            </span>
          </div>
          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500"
              style={{ width: `${settlementProgress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-green-600 font-medium">{settlementProgress.toFixed(0)}% abgeschlossen</span>
            <span className="text-[var(--secondary)]">
              Offen: {formatCurrency(totalSecurityValue - settledAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="admin-card p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-blue-800">Hinweis</h3>
            <p className="text-sm text-blue-700 mt-1">
              Die angezeigten Sicherungsrechte und Bankkonten sind Beispieldaten.
              In einer produktiven Umgebung werden diese aus dem Fallmanagementsystem importiert.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
