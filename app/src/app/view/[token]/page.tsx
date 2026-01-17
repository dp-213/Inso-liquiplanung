"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import ExternalHeader from "@/components/external/ExternalHeader";
import KPICards from "@/components/external/KPICards";
import LiquidityTable from "@/components/external/LiquidityTable";
import BalanceChart, { ChartMarker } from "@/components/external/BalanceChart";
import PDFExportButton from "@/components/external/PDFExportButton";
import ExternalDashboardNav from "@/components/external/ExternalDashboardNav";
import RevenueChart from "@/components/external/RevenueChart";
import EstateComparisonChart from "@/components/external/EstateComparisonChart";
import PlanningAssumptions from "@/components/external/PlanningAssumptions";
import InsolvencyEffectsTable from "@/components/external/InsolvencyEffectsTable";
import WaterfallChart from "@/components/external/WaterfallChart";

interface Assumption {
  id: string;
  categoryName: string;
  source: string;
  description: string;
  riskLevel: string;
  createdAt: string;
  updatedAt: string;
}

interface InsolvencyEffect {
  name: string;
  description: string | null;
  effectType: "INFLOW" | "OUTFLOW";
  effectGroup: string;
  periods: {
    id: string;
    periodIndex: number;
    amountCents: string;
  }[];
}

interface BankAccountData {
  id: string;
  bankName: string;
  accountName: string;
  iban: string | null;
  balanceCents: string;
  availableCents: string;
  securityHolder: string | null;
  status: string;
  notes: string | null;
}

interface ShareData {
  case: {
    caseNumber: string;
    debtorName: string;
    courtName: string;
    status: string;
    filingDate: string;
    openingDate: string | null;
  };
  administrator: string;
  plan: {
    name: string;
    planStartDate: string;
    periodType?: "WEEKLY" | "MONTHLY";
    periodCount?: number;
    versionNumber: number;
    versionDate: string | null;
  };
  assumptions?: Assumption[];
  insolvencyEffects?: {
    effects: InsolvencyEffect[];
    rawEffects: {
      id: string;
      name: string;
      description: string | null;
      effectType: string;
      effectGroup: string;
      periodIndex: number;
      amountCents: string;
      isActive: boolean;
    }[];
  };
  bankAccounts?: {
    accounts: BankAccountData[];
    summary: {
      totalBalanceCents: string;
      totalAvailableCents: string;
      accountCount: number;
    };
  };
  calculation: {
    openingBalanceCents: string;
    totalInflowsCents: string;
    totalOutflowsCents: string;
    totalNetCashflowCents: string;
    finalClosingBalanceCents: string;
    dataHash: string;
    calculatedAt: string;
    periodType?: "WEEKLY" | "MONTHLY";
    periodCount?: number;
    weeks: {
      weekOffset: number;
      weekLabel: string;
      openingBalanceCents: string;
      totalInflowsCents: string;
      totalOutflowsCents: string;
      netCashflowCents: string;
      closingBalanceCents: string;
    }[];
    categories: {
      categoryName: string;
      flowType: string;
      estateType: string;
      totalCents: string;
      weeklyTotals: string[];
      lines: {
        lineName: string;
        totalCents: string;
        weeklyValues: {
          weekOffset: number;
          effectiveCents: string;
        }[];
      }[];
    }[];
  };
}

// Payment source configuration
const PAYMENT_SOURCES = [
  { id: "kv_advance", name: "KV-Abschlaege", description: "Monatliche Abschlagszahlungen", rhythm: "Monatlich", color: "#3b82f6" },
  { id: "kv_final", name: "KV-Restzahlungen", description: "Quartalsweise Restzahlungen", rhythm: "Quartalsweise", color: "#10b981" },
  { id: "hzv_advance", name: "HZV-Abschlaege", description: "Monatliche Pauschalen HZV", rhythm: "Monatlich", color: "#8b5cf6" },
  { id: "hzv_final", name: "HZV-Schlusszahlung", description: "Jaehrliche Abschlusszahlung", rhythm: "Jaehrlich", color: "#f59e0b" },
  { id: "pvs", name: "PVS-Zahlungen", description: "Privatpatienten-Abrechnungen", rhythm: "Laufend", color: "#ec4899" },
];

// Demo security rights data (not yet in data model)
const DEMO_SECURITY_RIGHTS = [
  { id: "1", creditorName: "Sparkasse", securityType: "Globalzession", assetDescription: "KV-Forderungen", estimatedValue: BigInt(12000000), settlementStatus: "offen", settlementAmount: null },
  { id: "2", creditorName: "Leasing GmbH", securityType: "Eigentumsvorbehalt", assetDescription: "Medizingeraete", estimatedValue: BigInt(3500000), settlementStatus: "vereinbarung", settlementAmount: BigInt(2800000) },
  { id: "3", creditorName: "Vermieter", securityType: "Vermieterpfandrecht", assetDescription: "Praxiseinrichtung", estimatedValue: BigInt(1500000), settlementStatus: "abgerechnet", settlementAmount: BigInt(1500000) },
];

export default function ExternalCaseView() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/share/${token}`);
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || "Fehler beim Laden der Daten");
          return;
        }
        const shareData = await response.json();
        setData(shareData);
      } catch {
        setError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchData();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-[var(--secondary)]">Liquiditätsplan wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="admin-card p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">Zugang nicht moeglich</h1>
          <p className="text-[var(--secondary)]">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Calculate KPIs
  const weeks = data.calculation.weeks;
  const currentCash = BigInt(weeks[0]?.openingBalanceCents || "0");
  const minCash = weeks.reduce((min, week) => {
    const balance = BigInt(week.closingBalanceCents);
    return balance < min ? balance : min;
  }, currentCash);
  const runwayWeek = weeks.findIndex((week) => BigInt(week.closingBalanceCents) <= BigInt(0));

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

  const getPeriodLabel = (): string => {
    if (weeks.length === 0) return "";
    return `${weeks[0].weekLabel} - ${weeks[weeks.length - 1].weekLabel}`;
  };

  const getPlanTitle = (): string => {
    const periodType = data.calculation.periodType || data.plan.periodType || "WEEKLY";
    const periodCount = data.calculation.periodCount || data.plan.periodCount || 13;
    return periodType === "MONTHLY" ? `${periodCount}-Monats-Planung` : `${periodCount}-Wochen-Planung`;
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "PRELIMINARY": return "Vorläufiges Verfahren";
      case "OPENED": return "Eröffnetes Verfahren";
      case "CLOSED": return "Geschlossen";
      default: return status;
    }
  };

  const getPaymentMarkers = (): ChartMarker[] => {
    const markers: ChartMarker[] = [];
    const periodType = data.calculation.periodType || data.plan.periodType || "WEEKLY";
    if (periodType === "MONTHLY") {
      const kvMonths = ["Mrz", "Jun", "Sep", "Dez"];
      const hzvMonths = ["Dez", "Jan"];
      weeks.forEach((week) => {
        const monthAbbrev = week.weekLabel.split(" ")[0];
        if (kvMonths.some((m) => monthAbbrev.startsWith(m))) {
          markers.push({ periodLabel: week.weekLabel, label: "KV", color: "#10b981", type: "event" });
        }
        if (hzvMonths.some((m) => monthAbbrev.startsWith(m))) {
          markers.push({ periodLabel: week.weekLabel, label: "HZV", color: "#8b5cf6", type: "event" });
        }
      });
    }
    return markers;
  };

  // Category calculations
  const inflowCategories = data.calculation.categories.filter((c) => c.flowType === "INFLOW" && BigInt(c.totalCents) > BigInt(0));
  const outflowCategories = data.calculation.categories.filter((c) => c.flowType === "OUTFLOW" && BigInt(c.totalCents) > BigInt(0));

  // Estate calculations
  const altmasseInflows = data.calculation.categories.filter((c) => c.flowType === "INFLOW" && c.estateType === "ALTMASSE");
  const altmasseOutflows = data.calculation.categories.filter((c) => c.flowType === "OUTFLOW" && c.estateType === "ALTMASSE");
  const neumasseInflows = data.calculation.categories.filter((c) => c.flowType === "INFLOW" && c.estateType === "NEUMASSE");
  const neumasseOutflows = data.calculation.categories.filter((c) => c.flowType === "OUTFLOW" && c.estateType === "NEUMASSE");

  const altmasseInflowTotal = altmasseInflows.reduce((sum, c) => sum + BigInt(c.totalCents), BigInt(0));
  const altmasseOutflowTotal = altmasseOutflows.reduce((sum, c) => sum + BigInt(c.totalCents), BigInt(0));
  const neumasseInflowTotal = neumasseInflows.reduce((sum, c) => sum + BigInt(c.totalCents), BigInt(0));
  const neumasseOutflowTotal = neumasseOutflows.reduce((sum, c) => sum + BigInt(c.totalCents), BigInt(0));

  // Revenue totals
  const grandTotal = inflowCategories.reduce((sum, c) => sum + BigInt(c.totalCents), BigInt(0));
  const sourceTotals = inflowCategories.map((cat) => ({
    name: cat.categoryName,
    total: BigInt(cat.totalCents),
    weeklyTotals: cat.weeklyTotals.map((t) => BigInt(t)),
  }));

  // Bank account totals (from real data)
  const bankAccounts = data.bankAccounts?.accounts || [];
  const totalBankBalance = bankAccounts.reduce((sum, acc) => sum + BigInt(acc.balanceCents), BigInt(0));
  const totalAvailableBalance = bankAccounts.reduce((sum, acc) => sum + BigInt(acc.availableCents), BigInt(0));

  // Security totals (demo data - not yet in data model)
  const totalSecurityValue = DEMO_SECURITY_RIGHTS.reduce((sum, sr) => sum + sr.estimatedValue, BigInt(0));
  const settledAmount = DEMO_SECURITY_RIGHTS.filter((sr) => sr.settlementAmount).reduce((sum, sr) => sum + (sr.settlementAmount || BigInt(0)), BigInt(0));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verfügbar": return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Verfügbar</span>;
      case "gesperrt": return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Gesperrt</span>;
      case "offen": return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Offen</span>;
      case "vereinbarung": return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">In Vereinbarung</span>;
      case "abgerechnet": return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Abgerechnet</span>;
      default: return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <ExternalHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div ref={reportRef} className="space-y-6">
          {/* Case Header */}
          <div className="admin-card p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[var(--foreground)]">{data.case.debtorName}</h1>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--secondary)]">
                  <span>Aktenzeichen: {data.case.caseNumber}</span>
                  <span>Gericht: {data.case.courtName}</span>
                </div>
              </div>
              <div className="mt-4 md:mt-0 flex flex-col items-start md:items-end gap-2">
                <span className={`badge ${data.case.status === "OPENED" ? "badge-success" : data.case.status === "PRELIMINARY" ? "badge-warning" : "badge-neutral"}`}>
                  {getStatusLabel(data.case.status)}
                </span>
                <span className="text-sm text-[var(--muted)]">Planungszeitraum: {getPeriodLabel()}</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <ExternalDashboardNav activeTab={activeTab} onTabChange={setActiveTab} />

          {/* TAB: Overview */}
          <div className={activeTab === "overview" ? "" : "hidden"}>
            <div className="space-y-6">
              <KPICards
                currentCash={currentCash}
                minCash={minCash}
                runwayWeek={runwayWeek >= 0 ? weeks[runwayWeek]?.weekLabel : null}
                formatCurrency={(cents: bigint) => formatCurrency(cents)}
                periodType={data.calculation.periodType || data.plan.periodType}
                periodCount={data.calculation.periodCount || data.plan.periodCount}
              />

              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Liquiditaetsverlauf</h2>
                <BalanceChart weeks={weeks} markers={getPaymentMarkers()} showPhases={(data.calculation.periodType || data.plan.periodType) === "MONTHLY"} />
                {(data.calculation.periodType || data.plan.periodType) === "MONTHLY" && (
                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-[var(--secondary)]">
                    <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-[#10b981]"></div><span>KV-Restzahlung</span></div>
                    <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-[#8b5cf6]"></div><span>HZV-Schlusszahlung</span></div>
                  </div>
                )}
              </div>

              <div className="admin-card">
                <div className="px-6 py-4 border-b border-[var(--border)]">
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">{getPlanTitle()}</h2>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                  <LiquidityTable weeks={weeks} categories={data.calculation.categories} openingBalance={BigInt(data.calculation.openingBalanceCents)} />
                </div>
              </div>
            </div>
          </div>

          {/* TAB: Revenue */}
          <div className={activeTab === "revenue" ? "" : "hidden"}>
            <div className="space-y-6">
              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Einnahmen-Taktung nach Quelle</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Quelle</th>
                        <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Beschreibung</th>
                        <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Rhythmus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PAYMENT_SOURCES.map((source) => (
                        <tr key={source.id} className="border-b border-[var(--border)] hover:bg-gray-50">
                          <td className="py-3 px-4"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: source.color }} /><span className="font-medium">{source.name}</span></div></td>
                          <td className="py-3 px-4 text-[var(--secondary)]">{source.description}</td>
                          <td className="py-3 px-4 text-[var(--secondary)]">{source.rhythm}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Einnahmen nach Kategorie</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {sourceTotals.map((source, idx) => (
                    <div key={source.name} className="p-4 rounded-lg border border-[var(--border)] bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-[var(--secondary)]">{source.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${PAYMENT_SOURCES[idx % PAYMENT_SOURCES.length].color}20`, color: PAYMENT_SOURCES[idx % PAYMENT_SOURCES.length].color }}>
                          {grandTotal > BigInt(0) ? `${((Number(source.total) / Number(grandTotal)) * 100).toFixed(0)}%` : "0%"}
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-[var(--foreground)]">{formatCurrency(source.total)}</div>
                    </div>
                  ))}
                </div>
                <div className="p-4 rounded-lg bg-[var(--primary)] text-white">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Gesamteinnahmen (Plan)</span>
                    <span className="text-2xl font-bold">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Einnahmen-Verlauf</h2>
                <RevenueChart weeks={weeks} categories={inflowCategories} />
              </div>
            </div>
          </div>

          {/* TAB: Security */}
          <div className={activeTab === "security" ? "" : "hidden"}>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="admin-card p-4">
                  <div className="text-sm text-[var(--secondary)]">Bankguthaben Gesamt</div>
                  <div className="text-2xl font-bold text-[var(--foreground)]">{formatCurrency(totalBankBalance)}</div>
                </div>
                <div className="admin-card p-4">
                  <div className="text-sm text-[var(--secondary)]">Davon verfügbar</div>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(totalAvailableBalance)}</div>
                </div>
                <div className="admin-card p-4">
                  <div className="text-sm text-[var(--secondary)]">Sicherungswerte</div>
                  <div className="text-2xl font-bold text-[var(--foreground)]">{formatCurrency(totalSecurityValue)}</div>
                </div>
              </div>

              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Bankkonto-Übersicht (Bankenspiegel)</h2>
                {bankAccounts.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Konto</th>
                        <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Bank</th>
                        <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">IBAN</th>
                        <th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">Guthaben</th>
                        <th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">Verfügbar</th>
                        <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Sicherungsnehmer</th>
                        <th className="text-center py-3 px-4 font-medium text-[var(--secondary)]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bankAccounts.map((acc) => (
                        <tr key={acc.id} className="border-b border-[var(--border)]">
                          <td className="py-3 px-4 font-medium">{acc.accountName}</td>
                          <td className="py-3 px-4 text-[var(--secondary)]">{acc.bankName}</td>
                          <td className="py-3 px-4 text-[var(--secondary)] font-mono text-xs">{acc.iban || "-"}</td>
                          <td className="py-3 px-4 text-right font-medium">{formatCurrency(acc.balanceCents)}</td>
                          <td className="py-3 px-4 text-right font-medium text-green-600">{formatCurrency(acc.availableCents)}</td>
                          <td className="py-3 px-4 text-[var(--secondary)]">{acc.securityHolder || "-"}</td>
                          <td className="py-3 px-4 text-center">{getStatusBadge(acc.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-medium">
                        <td className="py-3 px-4" colSpan={3}>Summe ({bankAccounts.length} Konten)</td>
                        <td className="py-3 px-4 text-right">{formatCurrency(totalBankBalance)}</td>
                        <td className="py-3 px-4 text-right text-green-600">{formatCurrency(totalAvailableBalance)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <div className="p-8 bg-gray-50 rounded-lg text-center">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    <p className="text-[var(--muted)]">Noch keine Bankkonten erfasst</p>
                    <p className="text-sm text-[var(--secondary)] mt-1">Die Bankkonten können im Admin-Bereich angelegt werden.</p>
                  </div>
                )}
              </div>

              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Sicherungsrechte-Register</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Glaeubiger</th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Art</th>
                      <th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">Wert</th>
                      <th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">Abrechnung</th>
                      <th className="text-center py-3 px-4 font-medium text-[var(--secondary)]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEMO_SECURITY_RIGHTS.map((sr) => (
                      <tr key={sr.id} className="border-b border-[var(--border)]">
                        <td className="py-3 px-4 font-medium">{sr.creditorName}</td>
                        <td className="py-3 px-4 text-[var(--secondary)]">{sr.securityType}</td>
                        <td className="py-3 px-4 text-right">{formatCurrency(sr.estimatedValue)}</td>
                        <td className="py-3 px-4 text-right text-[var(--secondary)]">{sr.settlementAmount ? formatCurrency(sr.settlementAmount) : "-"}</td>
                        <td className="py-3 px-4 text-center">{getStatusBadge(sr.settlementStatus)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Verwertungsfortschritt</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--secondary)]">Abgerechnet</span>
                    <span className="font-medium">{formatCurrency(settledAmount)} von {formatCurrency(totalSecurityValue)}</span>
                  </div>
                  <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full" style={{ width: `${Number(settledAmount) / Number(totalSecurityValue) * 100}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-600 font-medium">{(Number(settledAmount) / Number(totalSecurityValue) * 100).toFixed(0)}% abgeschlossen</span>
                    <span className="text-[var(--secondary)]">Offen: {formatCurrency(totalSecurityValue - settledAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TAB: Estate */}
          <div className={activeTab === "estate" ? "" : "hidden"}>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="admin-card p-4">
                  <div className="text-sm text-[var(--secondary)]">Gesamteinnahmen</div>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(altmasseInflowTotal + neumasseInflowTotal)}</div>
                </div>
                <div className="admin-card p-4">
                  <div className="text-sm text-[var(--secondary)]">Gesamtausgaben</div>
                  <div className="text-2xl font-bold text-red-600">-{formatCurrency(altmasseOutflowTotal + neumasseOutflowTotal)}</div>
                </div>
                <div className="admin-card p-4">
                  <div className="text-sm text-[var(--secondary)]">Netto-Zufluss</div>
                  <div className="text-2xl font-bold text-[var(--foreground)]">{formatCurrency((altmasseInflowTotal + neumasseInflowTotal) - (altmasseOutflowTotal + neumasseOutflowTotal))}</div>
                </div>
              </div>

              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Altmasse vs Neumasse Vergleich</h2>
                <EstateComparisonChart altmasseInflows={altmasseInflowTotal} altmasseOutflows={altmasseOutflowTotal} neumasseInflows={neumasseInflowTotal} neumasseOutflows={neumasseOutflowTotal} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="admin-card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <h2 className="text-lg font-semibold text-[var(--foreground)]">Altmasse</h2>
                  </div>
                  <p className="text-sm text-[var(--secondary)] mb-4">Vor Insolvenzeröffnung entstanden</p>
                  <div className="space-y-2">
                    {altmasseInflows.map((cat) => (
                      <div key={cat.categoryName} className="flex justify-between py-2 px-3 bg-green-50 rounded">
                        <span className="text-sm">{cat.categoryName}</span>
                        <span className="text-sm font-medium text-green-600">{formatCurrency(cat.totalCents)}</span>
                      </div>
                    ))}
                    {altmasseOutflows.map((cat) => (
                      <div key={cat.categoryName} className="flex justify-between py-2 px-3 bg-red-50 rounded">
                        <span className="text-sm">{cat.categoryName}</span>
                        <span className="text-sm font-medium text-red-600">-{formatCurrency(cat.totalCents)}</span>
                      </div>
                    ))}
                  </div>
                  <div className={`mt-4 p-3 rounded-lg ${altmasseInflowTotal >= altmasseOutflowTotal ? "bg-green-600" : "bg-red-600"} text-white`}>
                    <div className="flex justify-between"><span>Netto Altmasse</span><span className="font-bold">{formatCurrency(altmasseInflowTotal - altmasseOutflowTotal)}</span></div>
                  </div>
                </div>

                <div className="admin-card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <h2 className="text-lg font-semibold text-[var(--foreground)]">Neumasse</h2>
                  </div>
                  <p className="text-sm text-[var(--secondary)] mb-4">Nach Insolvenzeröffnung entstanden</p>
                  <div className="space-y-2">
                    {neumasseInflows.map((cat) => (
                      <div key={cat.categoryName} className="flex justify-between py-2 px-3 bg-green-50 rounded">
                        <span className="text-sm">{cat.categoryName}</span>
                        <span className="text-sm font-medium text-green-600">{formatCurrency(cat.totalCents)}</span>
                      </div>
                    ))}
                    {neumasseOutflows.map((cat) => (
                      <div key={cat.categoryName} className="flex justify-between py-2 px-3 bg-red-50 rounded">
                        <span className="text-sm">{cat.categoryName}</span>
                        <span className="text-sm font-medium text-red-600">-{formatCurrency(cat.totalCents)}</span>
                      </div>
                    ))}
                  </div>
                  <div className={`mt-4 p-3 rounded-lg ${neumasseInflowTotal >= neumasseOutflowTotal ? "bg-green-600" : "bg-red-600"} text-white`}>
                    <div className="flex justify-between"><span>Netto Neumasse</span><span className="font-bold">{formatCurrency(neumasseInflowTotal - neumasseOutflowTotal)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TAB: Waterfall */}
          <div className={activeTab === "waterfall" ? "" : "hidden"}>
            <div className="space-y-6">
              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Wasserfall-Darstellung</h2>
                <p className="text-sm text-[var(--secondary)] mb-6">
                  Die Wasserfall-Darstellung zeigt die Zusammensetzung der Cashflows pro Periode.
                  Einzahlungen (grün) und Auszahlungen (rot) ergeben den Endbestand (blaue Linie).
                </p>
                <WaterfallChart
                  data={weeks.map((week) => ({
                    periodLabel: week.weekLabel,
                    openingBalance: Number(BigInt(week.openingBalanceCents)) / 100,
                    inflows: Number(BigInt(week.totalInflowsCents)) / 100,
                    outflows: Number(BigInt(week.totalOutflowsCents)) / 100,
                    insolvencyEffects: 0,
                    closingBalance: Number(BigInt(week.closingBalanceCents)) / 100,
                  }))}
                  showInsolvencyEffects={false}
                />
              </div>
            </div>
          </div>

          {/* TAB: Insolvency Effects */}
          <div className={activeTab === "insolvency" ? "" : "hidden"}>
            <div className="space-y-6">
              {data.insolvencyEffects && data.insolvencyEffects.effects.length > 0 ? (
                <InsolvencyEffectsTable
                  effects={data.insolvencyEffects.effects}
                  periodType={data.calculation.periodType || data.plan.periodType || "WEEKLY"}
                  periodCount={weeks.length}
                  periodLabels={weeks.map((w) => w.weekLabel)}
                  openingBalance={BigInt(data.calculation.openingBalanceCents)}
                  closingBalancesBeforeEffects={weeks.map((w) => BigInt(w.closingBalanceCents))}
                />
              ) : (
                <div className="admin-card p-6">
                  <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Insolvenzspezifische Effekte</h2>
                  <p className="text-sm text-[var(--secondary)] mb-4">
                    Diese Ansicht trennt insolvenzspezifische Zahlungsströme vom operativen Geschäft.
                    Die Struktur folgt dem W&P-Industriestandard für professionelle Liquiditätsberichte.
                  </p>
                  <div className="p-8 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-medium text-blue-800">Datenerfassung erforderlich</h3>
                        <p className="text-sm text-blue-700 mt-1">
                          Um insolvenzspezifische Effekte anzuzeigen, müssen diese zunächst im Admin-Bereich erfasst werden.
                          Typische Positionen umfassen: Anfechtung SV-Beiträge, Halteprämien, Verfahrenskosten.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="p-3 bg-white rounded-lg">
                        <div className="text-blue-600 font-medium">Standard-Positionen</div>
                        <ul className="text-blue-700 text-xs mt-1 space-y-0.5">
                          <li>• Anfechtung SV-Beiträge</li>
                          <li>• Halteprämien</li>
                          <li>• Unsicherheitsfaktor</li>
                        </ul>
                      </div>
                      <div className="p-3 bg-white rounded-lg">
                        <div className="text-blue-600 font-medium">Verfahrenskosten</div>
                        <ul className="text-blue-700 text-xs mt-1 space-y-0.5">
                          <li>• Sachverwaltung</li>
                          <li>• Gerichtskosten</li>
                          <li>• Gläubigerausschuss</li>
                        </ul>
                      </div>
                      <div className="p-3 bg-white rounded-lg">
                        <div className="text-blue-600 font-medium">Einzahlungen</div>
                        <ul className="text-blue-700 text-xs mt-1 space-y-0.5">
                          <li>• Abverkauf Vorräte</li>
                          <li>• Anfechtungserlöse</li>
                          <li>• Rückzahlungen</li>
                        </ul>
                      </div>
                      <div className="p-3 bg-white rounded-lg">
                        <div className="text-blue-600 font-medium">Beratung</div>
                        <ul className="text-blue-700 text-xs mt-1 space-y-0.5">
                          <li>• Rechtsberatung</li>
                          <li>• Inso-Buchhaltung</li>
                          <li>• Versicherungen</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* TAB: Planning Assumptions */}
          <div className={activeTab === "assumptions" ? "" : "hidden"}>
            <div className="space-y-6">
              {data.assumptions && data.assumptions.length > 0 ? (
                <PlanningAssumptions assumptions={data.assumptions} />
              ) : (
                <div className="admin-card p-6">
                  <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Planungsprämissen</h2>
                  <p className="text-sm text-[var(--secondary)] mb-4">
                    Die Planungsprämissen dokumentieren die Annahmen hinter jeder Planungsposition.
                    Jede Position hat eine Informationsquelle, Beschreibung und Risikobewertung nach dem W&P-Standard.
                  </p>
                  <div className="p-8 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-medium text-amber-800">Dokumentation ausstehend</h3>
                        <p className="text-sm text-amber-700 mt-1">
                          Die Planungsprämissen für diesen Fall wurden noch nicht dokumentiert.
                          Diese können im Admin-Bereich erfasst werden.
                        </p>
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                      <h4 className="font-medium text-amber-800 mb-3">Risiko-Bewertungsskala (W&P-Standard)</h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold">○</span>
                          <span className="text-amber-700">Konservativ</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">◐</span>
                          <span className="text-amber-700">Gering</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">◑</span>
                          <span className="text-amber-700">Mittel</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">●</span>
                          <span className="text-amber-700">Hoch</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold">●●</span>
                          <span className="text-amber-700">Aggressiv</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* TAB: Compare */}
          <div className={activeTab === "compare" ? "" : "hidden"}>
            <div className="space-y-6">
              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">IST vs PLAN Vergleich</h2>
                <p className="text-sm text-[var(--secondary)] mb-4">
                  Der Vergleich zwischen geplanten und tatsächlichen Werten wird verfügbar sein, sobald IST-Daten erfasst werden.
                </p>
                <div className="p-8 bg-gray-50 rounded-lg text-center">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-[var(--muted)]">Noch keine IST-Daten vorhanden</p>
                </div>
              </div>

              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Aktuelle Version</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-[var(--secondary)]">Version</div>
                    <div className="font-medium text-[var(--foreground)]">{data.plan.versionNumber}</div>
                  </div>
                  <div>
                    <div className="text-[var(--secondary)]">Erstellt am</div>
                    <div className="font-medium text-[var(--foreground)]">{new Date(data.calculation.calculatedAt).toLocaleDateString("de-DE")}</div>
                  </div>
                  <div>
                    <div className="text-[var(--secondary)]">Gesamteinnahmen</div>
                    <div className="font-medium text-green-600">{formatCurrency(data.calculation.totalInflowsCents)}</div>
                  </div>
                  <div>
                    <div className="text-[var(--secondary)]">Endbestand</div>
                    <div className="font-medium text-[var(--foreground)]">{formatCurrency(data.calculation.finalClosingBalanceCents)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-[var(--muted)] px-1">
            <div>
              Version {data.plan.versionNumber} | Stand: {new Date(data.calculation.calculatedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="mt-2 sm:mt-0">
              Datenintegritaet: {data.calculation.dataHash.substring(0, 8)}...
            </div>
          </div>
        </div>

        {/* PDF Export Button */}
        <div className="fixed bottom-6 right-6 no-print">
          <PDFExportButton data={data} formatCurrency={(cents: bigint) => formatCurrency(cents)} />
        </div>
      </main>
    </div>
  );
}
