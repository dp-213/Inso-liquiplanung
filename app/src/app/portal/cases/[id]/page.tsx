"use client";

import { useEffect, useState, useRef, useMemo, useCallback, memo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import KPICards from "@/components/external/KPICards";
import LiquidityTable from "@/components/external/LiquidityTable";
import BalanceChart, { ChartMarker } from "@/components/external/BalanceChart";
import PDFExportButton from "@/components/external/PDFExportButton";
import RevenueChart from "@/components/external/RevenueChart";
import EstateComparisonChart from "@/components/external/EstateComparisonChart";

// Tab type
type TabId = "overview" | "revenue" | "security" | "estate" | "compare";

// Navigation items
const navItems: { id: TabId; label: string; icon: string }[] = [
  { id: "overview", label: "Übersicht", icon: "chart" },
  { id: "revenue", label: "Einnahmen", icon: "money" },
  { id: "security", label: "Sicherungsrechte", icon: "shield" },
  { id: "estate", label: "Masseübersicht", icon: "folder" },
  { id: "compare", label: "Vergleich", icon: "compare" },
];

interface CaseData {
  case: {
    id: string;
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
    periodType: "WEEKLY" | "MONTHLY";
    periodCount: number;
    versionNumber: number;
    versionDate: string | null;
  };
  calculation: {
    openingBalanceCents: string;
    totalInflowsCents: string;
    totalOutflowsCents: string;
    totalNetCashflowCents: string;
    finalClosingBalanceCents: string;
    dataHash: string;
    calculatedAt: string;
    periodType: "WEEKLY" | "MONTHLY";
    periodCount: number;
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

// Demo data for security rights
const DEMO_BANK_ACCOUNTS = [
  { id: "1", accountName: "Geschäftskonto", bankName: "Sparkasse Köln-Bonn", iban: "DE89 3704 0044 0532 0130 00", balance: BigInt(5000000), securityHolder: "Globalzession Bank XY", status: "gesperrt" },
  { id: "2", accountName: "Praxiskonto", bankName: "VR-Bank Rhein-Sieg", iban: "DE89 3806 0186 0123 4567 89", balance: BigInt(1200000), securityHolder: null, status: "verfügbar" },
];

const DEMO_SECURITY_RIGHTS = [
  { id: "1", creditorName: "Sparkasse Köln-Bonn", securityType: "Globalzession", assetDescription: "Sämtliche KV-Forderungen", estimatedValue: BigInt(12000000), settlementStatus: "offen", settlementAmount: null },
  { id: "2", creditorName: "MedTech Leasing GmbH", securityType: "Eigentumsvorbehalt", assetDescription: "Medizinische Geräte (Röntgen, EKG)", estimatedValue: BigInt(3500000), settlementStatus: "vereinbarung", settlementAmount: BigInt(2800000) },
  { id: "3", creditorName: "Vermieter Praxisräume", securityType: "Vermieterpfandrecht", assetDescription: "Praxiseinrichtung", estimatedValue: BigInt(1500000), settlementStatus: "abgerechnet", settlementAmount: BigInt(1500000) },
];

// Payment sources config
const PAYMENT_SOURCES = [
  { id: "kv_advance", name: "KV-Abschläge", description: "Monatliche Abschlagszahlungen der Kassenärztlichen Vereinigung", rhythm: "Monatlich", color: "#3b82f6" },
  { id: "kv_final", name: "KV-Restzahlungen", description: "Quartalsweise Restzahlungen nach Abrechnung", rhythm: "Quartalsweise (Mrz, Jun, Sep, Dez)", color: "#10b981" },
  { id: "hzv_advance", name: "HZV-Abschläge", description: "Monatliche Pauschalen Hausarztzentrierte Versorgung", rhythm: "Monatlich", color: "#8b5cf6" },
  { id: "hzv_final", name: "HZV-Schlusszahlung", description: "Jährliche Abschlusszahlung HZV-Vertrag", rhythm: "Jährlich (Dez/Jan)", color: "#f59e0b" },
  { id: "pvs", name: "PVS-Zahlungen", description: "Privatpatienten-Abrechnungen", rhythm: "Laufend", color: "#ec4899" },
];

// Icon component
const NavIcon = memo(({ icon }: { icon: string }) => {
  switch (icon) {
    case "chart": return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>;
    case "money": return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case "shield": return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
    case "folder": return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>;
    case "compare": return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
    default: return null;
  }
});
NavIcon.displayName = "NavIcon";

export default function CustomerCaseDashboard() {
  const params = useParams();
  const caseId = params.id as string;
  const [data, setData] = useState<CaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [compareMode, setCompareMode] = useState<"ist_plan" | "versions">("ist_plan");
  const reportRef = useRef<HTMLDivElement>(null);

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
    if (caseId) fetchData();
  }, [caseId]);

  // Memoized format function
  const formatCurrency = useCallback((cents: bigint | string): string => {
    const value = typeof cents === "string" ? BigInt(cents) : cents;
    const euros = Number(value) / 100;
    return euros.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center text-sm text-[var(--muted)]">
          <Link href="/portal" className="hover:text-[var(--primary)]">Meine Fälle</Link>
          <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-[var(--foreground)]">Wird geladen...</span>
        </div>
        <div className="admin-card p-8 text-center">
          <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-[var(--secondary)]">Liquiditätsplan wird geladen...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center text-sm text-[var(--muted)]">
          <Link href="/portal" className="hover:text-[var(--primary)]">Meine Fälle</Link>
          <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-[var(--foreground)]">Fehler</span>
        </div>
        <div className="admin-card p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">Zugang nicht möglich</h1>
          <p className="text-[var(--secondary)] mb-4">{error}</p>
          <Link href="/portal" className="btn-primary">Zurück zur Übersicht</Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Memoized calculations
  const weeks = data.calculation.weeks;
  const currentCash = BigInt(weeks[0]?.openingBalanceCents || "0");
  const minCash = weeks.reduce((min, week) => {
    const balance = BigInt(week.closingBalanceCents);
    return balance < min ? balance : min;
  }, currentCash);
  const runwayWeek = weeks.findIndex((week) => BigInt(week.closingBalanceCents) <= BigInt(0));

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
    const periodType = data.calculation.periodType || "WEEKLY";
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
  const altmasseNet = altmasseInflowTotal - altmasseOutflowTotal;
  const neumasseNet = neumasseInflowTotal - neumasseOutflowTotal;
  const totalInflows = altmasseInflowTotal + neumasseInflowTotal;
  const totalOutflows = altmasseOutflowTotal + neumasseOutflowTotal;
  const totalNet = totalInflows - totalOutflows;

  // Revenue calculations
  const grandTotal = inflowCategories.reduce((sum, c) => sum + BigInt(c.totalCents), BigInt(0));
  const sourceTotals = inflowCategories.map((cat) => ({
    name: cat.categoryName,
    total: BigInt(cat.totalCents),
    weeklyTotals: cat.weeklyTotals.map((t) => BigInt(t)),
  }));

  // Security calculations
  const totalBankBalance = DEMO_BANK_ACCOUNTS.reduce((sum, acc) => sum + acc.balance, BigInt(0));
  const availableBalance = DEMO_BANK_ACCOUNTS.filter((acc) => acc.status === "verfügbar").reduce((sum, acc) => sum + acc.balance, BigInt(0));
  const totalSecurityValue = DEMO_SECURITY_RIGHTS.reduce((sum, sr) => sum + sr.estimatedValue, BigInt(0));
  const settledAmount = DEMO_SECURITY_RIGHTS.filter((sr) => sr.settlementAmount).reduce((sum, sr) => sum + (sr.settlementAmount || BigInt(0)), BigInt(0));
  const settlementProgress = Number(settledAmount) / Number(totalSecurityValue) * 100;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verfügbar": return <span className="badge badge-success">Verfügbar</span>;
      case "gesperrt": return <span className="badge badge-warning">Gesperrt</span>;
      case "offen": return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Offen</span>;
      case "vereinbarung": return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">In Vereinbarung</span>;
      case "abgerechnet": return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Abgerechnet</span>;
      default: return <span className="badge badge-neutral">{status}</span>;
    }
  };

  const getVarianceClass = (variance: number): string => {
    if (variance > 10) return "text-green-600 bg-green-50";
    if (variance < -10) return "text-red-600 bg-red-50";
    return "text-[var(--secondary)] bg-gray-50";
  };

  // Simulated IST data for compare
  const comparisonData = weeks.map((week) => {
    const varianceFactor = 0.85 + Math.random() * 0.3;
    const planInflows = BigInt(week.totalInflowsCents);
    const planOutflows = BigInt(week.totalOutflowsCents);
    const istInflows = BigInt(Math.floor(Number(planInflows) * varianceFactor));
    const istOutflows = BigInt(Math.floor(Number(planOutflows) * (0.9 + Math.random() * 0.2)));
    return {
      label: week.weekLabel,
      plan: { inflows: planInflows, outflows: planOutflows, net: planInflows - planOutflows },
      ist: { inflows: istInflows, outflows: istOutflows, net: istInflows - istOutflows },
      variance: {
        inflows: Number(istInflows - planInflows) / Number(planInflows) * 100 || 0,
        outflows: Number(istOutflows - planOutflows) / Number(planOutflows) * 100 || 0,
      },
    };
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-[var(--muted)]">
        <Link href="/portal" className="hover:text-[var(--primary)]">Meine Fälle</Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        <span className="text-[var(--foreground)]">{data.case.debtorName}</span>
      </div>

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

        {/* Navigation - Client-Side Tabs */}
        <nav className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-lg">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? "bg-white text-[var(--primary)] shadow-sm"
                  : "text-[var(--secondary)] hover:text-[var(--foreground)] hover:bg-white/50"
              }`}
            >
              <NavIcon icon={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* TAB: Overview */}
        <div className={activeTab === "overview" ? "" : "hidden"}>
          <div className="space-y-6">
            <KPICards currentCash={currentCash} minCash={minCash} runwayWeek={runwayWeek >= 0 ? weeks[runwayWeek]?.weekLabel : null} formatCurrency={formatCurrency} periodType={data.calculation.periodType} periodCount={data.calculation.periodCount} />
            <div className="admin-card p-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Liquiditätsverlauf</h2>
              <BalanceChart weeks={weeks} markers={getPaymentMarkers()} showPhases={data.calculation.periodType === "MONTHLY"} />
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
                  <thead><tr className="border-b border-[var(--border)]"><th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Quelle</th><th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Beschreibung</th><th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Rhythmus</th><th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">Anteil</th></tr></thead>
                  <tbody>
                    {PAYMENT_SOURCES.map((source) => (
                      <tr key={source.id} className="border-b border-[var(--border)] hover:bg-gray-50">
                        <td className="py-3 px-4"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: source.color }} /><span className="font-medium text-[var(--foreground)]">{source.name}</span></div></td>
                        <td className="py-3 px-4 text-[var(--secondary)]">{source.description}</td>
                        <td className="py-3 px-4 text-[var(--secondary)]">{source.rhythm}</td>
                        <td className="py-3 px-4 text-right text-[var(--secondary)]">-</td>
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
                <div className="flex items-center justify-between"><span className="font-medium">Gesamteinnahmen (Plan)</span><span className="text-2xl font-bold">{formatCurrency(grandTotal)}</span></div>
              </div>
            </div>
            <div className="admin-card p-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Einnahmen-Verlauf nach Quelle</h2>
              <RevenueChart weeks={weeks} categories={inflowCategories} />
            </div>
          </div>
        </div>

        {/* TAB: Security */}
        <div className={activeTab === "security" ? "" : "hidden"}>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="admin-card p-4"><div className="text-sm text-[var(--secondary)]">Bankguthaben Gesamt</div><div className="text-2xl font-bold text-[var(--foreground)]">{formatCurrency(totalBankBalance)}</div></div>
              <div className="admin-card p-4"><div className="text-sm text-[var(--secondary)]">Davon verfügbar</div><div className="text-2xl font-bold text-green-600">{formatCurrency(availableBalance)}</div></div>
              <div className="admin-card p-4"><div className="text-sm text-[var(--secondary)]">Sicherungswerte</div><div className="text-2xl font-bold text-[var(--foreground)]">{formatCurrency(totalSecurityValue)}</div></div>
            </div>
            <div className="admin-card p-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Bankkonto-Übersicht</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[var(--border)]"><th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Konto</th><th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Bank</th><th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">IBAN</th><th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">Saldo</th><th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Sicherungsnehmer</th><th className="text-center py-3 px-4 font-medium text-[var(--secondary)]">Status</th></tr></thead>
                  <tbody>
                    {DEMO_BANK_ACCOUNTS.map((account) => (
                      <tr key={account.id} className="border-b border-[var(--border)] hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-[var(--foreground)]">{account.accountName}</td>
                        <td className="py-3 px-4 text-[var(--secondary)]">{account.bankName}</td>
                        <td className="py-3 px-4 text-[var(--secondary)] font-mono text-xs">{account.iban}</td>
                        <td className="py-3 px-4 text-right font-medium text-[var(--foreground)]">{formatCurrency(account.balance)}</td>
                        <td className="py-3 px-4 text-[var(--secondary)]">{account.securityHolder || "-"}</td>
                        <td className="py-3 px-4 text-center">{getStatusBadge(account.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="admin-card p-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Sicherungsrechte-Register</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[var(--border)]"><th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Sicherungsnehmer</th><th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Art</th><th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Gegenstand</th><th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">Wert (ca.)</th><th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">Abrechnung</th><th className="text-center py-3 px-4 font-medium text-[var(--secondary)]">Status</th></tr></thead>
                  <tbody>
                    {DEMO_SECURITY_RIGHTS.map((sr) => (
                      <tr key={sr.id} className="border-b border-[var(--border)] hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-[var(--foreground)]">{sr.creditorName}</td>
                        <td className="py-3 px-4 text-[var(--secondary)]">{sr.securityType}</td>
                        <td className="py-3 px-4 text-[var(--secondary)]">{sr.assetDescription}</td>
                        <td className="py-3 px-4 text-right text-[var(--foreground)]">{formatCurrency(sr.estimatedValue)}</td>
                        <td className="py-3 px-4 text-right text-[var(--secondary)]">{sr.settlementAmount ? formatCurrency(sr.settlementAmount) : "-"}</td>
                        <td className="py-3 px-4 text-center">{getStatusBadge(sr.settlementStatus)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="bg-gray-50 font-medium"><td colSpan={3} className="py-3 px-4 text-[var(--foreground)]">Summe</td><td className="py-3 px-4 text-right text-[var(--foreground)]">{formatCurrency(totalSecurityValue)}</td><td className="py-3 px-4 text-right text-[var(--foreground)]">{formatCurrency(settledAmount)}</td><td></td></tr></tfoot>
                </table>
              </div>
            </div>
            <div className="admin-card p-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Verwertungsfortschritt</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm"><span className="text-[var(--secondary)]">Abgerechnet</span><span className="font-medium text-[var(--foreground)]">{formatCurrency(settledAmount)} von {formatCurrency(totalSecurityValue)}</span></div>
                <div className="h-4 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500" style={{ width: `${settlementProgress}%` }} /></div>
                <div className="flex items-center justify-between text-sm"><span className="text-green-600 font-medium">{settlementProgress.toFixed(0)}% abgeschlossen</span><span className="text-[var(--secondary)]">Offen: {formatCurrency(totalSecurityValue - settledAmount)}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* TAB: Estate */}
        <div className={activeTab === "estate" ? "" : "hidden"}>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="admin-card p-4"><div className="text-sm text-[var(--secondary)]">Gesamteinnahmen</div><div className="text-2xl font-bold text-green-600">{formatCurrency(totalInflows)}</div></div>
              <div className="admin-card p-4"><div className="text-sm text-[var(--secondary)]">Gesamtausgaben</div><div className="text-2xl font-bold text-red-600">-{formatCurrency(totalOutflows)}</div></div>
              <div className="admin-card p-4"><div className="text-sm text-[var(--secondary)]">Netto-Zufluss</div><div className={`text-2xl font-bold ${totalNet >= BigInt(0) ? "text-green-600" : "text-red-600"}`}>{formatCurrency(totalNet)}</div></div>
            </div>
            <div className="admin-card p-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Altmasse vs Neumasse Vergleich</h2>
              <EstateComparisonChart altmasseInflows={altmasseInflowTotal} altmasseOutflows={altmasseOutflowTotal} neumasseInflows={neumasseInflowTotal} neumasseOutflows={neumasseOutflowTotal} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Altmasse */}
              <div className="admin-card p-6">
                <div className="flex items-center gap-2 mb-4"><div className="w-3 h-3 rounded-full bg-amber-500" /><h2 className="text-lg font-semibold text-[var(--foreground)]">Altmasse</h2></div>
                <p className="text-sm text-[var(--secondary)] mb-4">Forderungen und Verbindlichkeiten vor Insolvenzeröffnung</p>
                <div className="mb-4"><h3 className="text-sm font-medium text-[var(--secondary)] mb-2">Einnahmen</h3>
                  {altmasseInflows.length > 0 ? (<div className="space-y-2">{altmasseInflows.map((cat) => (<div key={cat.categoryName} className="flex items-center justify-between py-2 px-3 bg-green-50 rounded"><span className="text-sm text-[var(--foreground)]">{cat.categoryName}</span><span className="text-sm font-medium text-green-600">{formatCurrency(cat.totalCents)}</span></div>))}<div className="flex items-center justify-between py-2 px-3 bg-green-100 rounded font-medium"><span className="text-sm text-[var(--foreground)]">Summe Einnahmen</span><span className="text-sm text-green-700">{formatCurrency(altmasseInflowTotal)}</span></div></div>) : (<p className="text-sm text-[var(--muted)] italic py-2">Keine Altmasse-Einnahmen</p>)}
                </div>
                <div className="mb-4"><h3 className="text-sm font-medium text-[var(--secondary)] mb-2">Ausgaben</h3>
                  {altmasseOutflows.length > 0 ? (<div className="space-y-2">{altmasseOutflows.map((cat) => (<div key={cat.categoryName} className="flex items-center justify-between py-2 px-3 bg-red-50 rounded"><span className="text-sm text-[var(--foreground)]">{cat.categoryName}</span><span className="text-sm font-medium text-red-600">-{formatCurrency(cat.totalCents)}</span></div>))}<div className="flex items-center justify-between py-2 px-3 bg-red-100 rounded font-medium"><span className="text-sm text-[var(--foreground)]">Summe Ausgaben</span><span className="text-sm text-red-700">-{formatCurrency(altmasseOutflowTotal)}</span></div></div>) : (<p className="text-sm text-[var(--muted)] italic py-2">Keine Altmasse-Ausgaben</p>)}
                </div>
                <div className={`p-3 rounded-lg ${altmasseNet >= BigInt(0) ? "bg-green-600" : "bg-red-600"} text-white`}><div className="flex items-center justify-between"><span className="font-medium">Netto Altmasse</span><span className="text-xl font-bold">{formatCurrency(altmasseNet)}</span></div></div>
              </div>
              {/* Neumasse */}
              <div className="admin-card p-6">
                <div className="flex items-center gap-2 mb-4"><div className="w-3 h-3 rounded-full bg-blue-500" /><h2 className="text-lg font-semibold text-[var(--foreground)]">Neumasse</h2></div>
                <p className="text-sm text-[var(--secondary)] mb-4">Forderungen und Verbindlichkeiten nach Insolvenzeröffnung</p>
                <div className="mb-4"><h3 className="text-sm font-medium text-[var(--secondary)] mb-2">Einnahmen</h3>
                  {neumasseInflows.length > 0 ? (<div className="space-y-2">{neumasseInflows.map((cat) => (<div key={cat.categoryName} className="flex items-center justify-between py-2 px-3 bg-green-50 rounded"><span className="text-sm text-[var(--foreground)]">{cat.categoryName}</span><span className="text-sm font-medium text-green-600">{formatCurrency(cat.totalCents)}</span></div>))}<div className="flex items-center justify-between py-2 px-3 bg-green-100 rounded font-medium"><span className="text-sm text-[var(--foreground)]">Summe Einnahmen</span><span className="text-sm text-green-700">{formatCurrency(neumasseInflowTotal)}</span></div></div>) : (<p className="text-sm text-[var(--muted)] italic py-2">Keine Neumasse-Einnahmen</p>)}
                </div>
                <div className="mb-4"><h3 className="text-sm font-medium text-[var(--secondary)] mb-2">Ausgaben</h3>
                  {neumasseOutflows.length > 0 ? (<div className="space-y-2">{neumasseOutflows.map((cat) => (<div key={cat.categoryName} className="flex items-center justify-between py-2 px-3 bg-red-50 rounded"><span className="text-sm text-[var(--foreground)]">{cat.categoryName}</span><span className="text-sm font-medium text-red-600">-{formatCurrency(cat.totalCents)}</span></div>))}<div className="flex items-center justify-between py-2 px-3 bg-red-100 rounded font-medium"><span className="text-sm text-[var(--foreground)]">Summe Ausgaben</span><span className="text-sm text-red-700">-{formatCurrency(neumasseOutflowTotal)}</span></div></div>) : (<p className="text-sm text-[var(--muted)] italic py-2">Keine Neumasse-Ausgaben</p>)}
                </div>
                <div className={`p-3 rounded-lg ${neumasseNet >= BigInt(0) ? "bg-green-600" : "bg-red-600"} text-white`}><div className="flex items-center justify-between"><span className="font-medium">Netto Neumasse</span><span className="text-xl font-bold">{formatCurrency(neumasseNet)}</span></div></div>
              </div>
            </div>
          </div>
        </div>

        {/* TAB: Compare */}
        <div className={activeTab === "compare" ? "" : "hidden"}>
          <div className="space-y-6">
            <div className="admin-card p-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-[var(--secondary)]">Vergleichsmodus:</span>
                <div className="flex gap-2">
                  <button onClick={() => setCompareMode("ist_plan")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${compareMode === "ist_plan" ? "bg-[var(--primary)] text-white" : "bg-gray-100 text-[var(--secondary)] hover:bg-gray-200"}`}>IST vs PLAN</button>
                  <button onClick={() => setCompareMode("versions")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${compareMode === "versions" ? "bg-[var(--primary)] text-white" : "bg-gray-100 text-[var(--secondary)] hover:bg-gray-200"}`}>Versionen</button>
                </div>
              </div>
            </div>
            {compareMode === "ist_plan" ? (
              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">IST vs PLAN Vergleich</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-[var(--border)]"><th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Periode</th><th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">PLAN Einnahmen</th><th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">IST Einnahmen</th><th className="text-center py-3 px-4 font-medium text-[var(--secondary)]">Abw. %</th><th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">PLAN Ausgaben</th><th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">IST Ausgaben</th><th className="text-center py-3 px-4 font-medium text-[var(--secondary)]">Abw. %</th></tr></thead>
                    <tbody>
                      {comparisonData.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="border-b border-[var(--border)] hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium text-[var(--foreground)]">{row.label}</td>
                          <td className="py-3 px-4 text-right text-[var(--secondary)]">{formatCurrency(row.plan.inflows)}</td>
                          <td className="py-3 px-4 text-right text-[var(--foreground)]">{formatCurrency(row.ist.inflows)}</td>
                          <td className="py-3 px-4 text-center"><span className={`px-2 py-1 rounded text-xs font-medium ${getVarianceClass(row.variance.inflows)}`}>{row.variance.inflows >= 0 ? "+" : ""}{row.variance.inflows.toFixed(1)}%</span></td>
                          <td className="py-3 px-4 text-right text-[var(--secondary)]">-{formatCurrency(row.plan.outflows)}</td>
                          <td className="py-3 px-4 text-right text-[var(--foreground)]">-{formatCurrency(row.ist.outflows)}</td>
                          <td className="py-3 px-4 text-center"><span className={`px-2 py-1 rounded text-xs font-medium ${getVarianceClass(-row.variance.outflows)}`}>{row.variance.outflows >= 0 ? "+" : ""}{row.variance.outflows.toFixed(1)}%</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="admin-card p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Versionsvergleich</h2>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">Aktuelle Version: Version {data.plan.versionNumber}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><div className="text-[var(--secondary)]">Erstellt am</div><div className="font-medium text-[var(--foreground)]">{new Date(data.calculation.calculatedAt).toLocaleDateString("de-DE")}</div></div>
                    <div><div className="text-[var(--secondary)]">Gesamteinnahmen</div><div className="font-medium text-green-600">{formatCurrency(data.calculation.totalInflowsCents)}</div></div>
                    <div><div className="text-[var(--secondary)]">Gesamtausgaben</div><div className="font-medium text-red-600">-{formatCurrency(data.calculation.totalOutflowsCents)}</div></div>
                    <div><div className="text-[var(--secondary)]">Endbestand</div><div className="font-medium text-[var(--foreground)]">{formatCurrency(data.calculation.finalClosingBalanceCents)}</div></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-[var(--muted)] px-1">
          <div>Version {data.plan.versionNumber} | Stand: {new Date(data.calculation.calculatedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
          <div className="mt-2 sm:mt-0">Datenintegrität: {data.calculation.dataHash.substring(0, 8)}...</div>
        </div>
      </div>

      {/* PDF Export Button - Fixed Position */}
      <div className="fixed bottom-6 right-6 no-print">
        <PDFExportButton data={data} formatCurrency={formatCurrency} />
      </div>
    </div>
  );
}
