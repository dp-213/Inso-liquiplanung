"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";

// =============================================================================
// SERIALIZED TYPES (BigInt → string from API)
// =============================================================================

interface SPnLLineItem {
  key: string;
  label: string;
  group: "REVENUE" | "PERSONNEL_COST" | "FIXED_COST" | "OTHER_COST";
  amountCents: string;
  entryCount: number;
  source: "LEDGER" | "SALARY";
  valueSource: "IST" | "PLAN";
  periodizationMethod: string;
  altmasseAnteilCents: string;
  neumasseAnteilCents: string;
}

interface SPerformancePeriod {
  index: number;
  year: number;
  month: number;
  label: string;
  istCoverage: number;
}

interface SLocationMonthResult {
  locationId: string;
  locationName: string;
  period: SPerformancePeriod;
  lines: SPnLLineItem[];
  revenueCents: string;
  revenueAltmasseCents: string;
  revenueNeumasseCents: string;
  personnelCostsCents: string;
  fixedCostsCents: string;
  otherCostsCents: string;
  contributionCents: string;
  marginPercent: number;
  personnelHeadcount: number;
  istCoverage: number;
}

interface SLocationSummary {
  locationId: string;
  locationName: string;
  months: SLocationMonthResult[];
  totalRevenueCents: string;
  totalContributionCents: string;
  avgMarginPercent: number;
}

interface SLocationSummaryAfterAllocation {
  locationId: string;
  locationName: string;
  months: SLocationMonthResult[];
  allocatedCentralCostsCents: string;
  adjustedContributionCents: string;
  adjustedMarginPercent: number;
}

interface SDataQualityReport {
  totalEntries: number;
  entriesWithServicePeriod: number;
  entriesWithServiceDate: number;
  entriesWithFallbackDate: number;
  unclassifiedEntries: number;
  approximateSpreadCount: number;
  employeesWithSalaryData: number;
  employeesWithoutSalaryData: number;
  warnings: string[];
}

interface SPerformanceResult {
  caseId: string;
  calculatedAt: string;
  periodCount: number;
  planStartDate: string;
  periods: SPerformancePeriod[];
  locations: SLocationSummary[];
  locationsAfterAllocation?: SLocationSummaryAfterAllocation[];
  overallIstCoverage: number;
  central: {
    months: SLocationMonthResult[];
    totalCostsCents: string;
  };
  consolidated: SLocationMonthResult[];
  allocationMethod: string;
  dataQuality: SDataQualityReport;
}

// =============================================================================
// HELPERS
// =============================================================================

function centsToEUR(cents: string): number {
  return Number(cents) / 100;
}

function formatEUR(cents: string): string {
  const value = centsToEUR(cents);
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatEURCompact(cents: string): string {
  const value = Math.abs(centsToEUR(cents));
  if (value >= 1_000_000) return `${(centsToEUR(cents) / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (value >= 1_000) return `${(centsToEUR(cents) / 1_000).toFixed(0)}K`;
  return formatEUR(cents);
}

function formatAxisEUR(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toFixed(0);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(".", ",")} %`;
}

// =============================================================================
// CHART COLORS
// =============================================================================

const LOCATION_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f97316"];
const CENTRAL_COLOR = "#94a3b8";
const MARGIN_COLOR = "#f59e0b";

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function PerformancePage() {
  const params = useParams();
  const rawId = params.id;
  const caseId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [data, setData] = useState<SPerformanceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allocationMethod, setAllocationMethod] = useState<string>("NONE");
  const [includeUnreviewed, setIncludeUnreviewed] = useState(false);
  const [selectedView, setSelectedView] = useState<string>("GESAMT");
  const [showDataQuality, setShowDataQuality] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["REVENUE", "PERSONNEL_COST", "FIXED_COST", "OTHER_COST"])
  );

  // ---------------------------------------------------------------------------
  // FETCH
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchParams = new URLSearchParams({
      allocationMethod,
      includeUnreviewed: includeUnreviewed.toString(),
    });

    fetch(`/api/cases/${caseId}/performance?${fetchParams}`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) return res.json().then((e) => Promise.reject(new Error(e.error || "Fehler beim Laden")));
        return res.json();
      })
      .then((result: SPerformanceResult) => {
        if (!cancelled) setData(result);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [caseId, allocationMethod, includeUnreviewed]);

  // ---------------------------------------------------------------------------
  // DERIVED DATA
  // ---------------------------------------------------------------------------

  const tabs = useMemo(() => {
    if (!data) return [];
    return [
      {
        key: "GESAMT",
        label: "Gesamt",
        isPositive: data.consolidated.reduce((s, m) => s + Number(m.contributionCents), 0) >= 0,
      },
      ...data.locations.map((loc) => ({
        key: loc.locationId,
        label: loc.locationName,
        isPositive: Number(loc.totalContributionCents) >= 0,
      })),
      {
        key: "ZENTRAL",
        label: "Zentral",
        isPositive: false,
      },
    ];
  }, [data]);

  // Active months for selected view
  const activeMonths = useMemo((): SLocationMonthResult[] | null => {
    if (!data) return null;
    if (selectedView === "GESAMT") return data.consolidated;
    if (selectedView === "ZENTRAL") return data.central.months;

    // Location: prefer after-allocation if available
    if (allocationMethod !== "NONE" && data.locationsAfterAllocation) {
      const loc = data.locationsAfterAllocation.find((l) => l.locationId === selectedView);
      if (loc) return loc.months;
    }
    const loc = data.locations.find((l) => l.locationId === selectedView);
    return loc?.months ?? null;
  }, [data, selectedView, allocationMethod]);

  // KPI totals for selected view
  const kpis = useMemo(() => {
    if (!activeMonths) return null;
    let revenueCents = 0;
    let personnelCostsCents = 0;
    let fixedCostsCents = 0;
    let otherCostsCents = 0;
    let contributionCents = 0;
    let marginSum = 0;
    let monthsWithRevenue = 0;

    for (const m of activeMonths) {
      revenueCents += Number(m.revenueCents);
      personnelCostsCents += Number(m.personnelCostsCents);
      fixedCostsCents += Number(m.fixedCostsCents);
      otherCostsCents += Number(m.otherCostsCents);
      contributionCents += Number(m.contributionCents);
      if (Number(m.revenueCents) > 0) {
        marginSum += m.marginPercent;
        monthsWithRevenue++;
      }
    }

    const totalCostsCents = personnelCostsCents + fixedCostsCents + otherCostsCents;
    const avgMargin = monthsWithRevenue > 0 ? marginSum / monthsWithRevenue : 0;

    return {
      revenueCents: String(revenueCents),
      totalCostsCents: String(totalCostsCents),
      contributionCents: String(contributionCents),
      avgMargin,
    };
  }, [activeMonths]);

  // Chart data
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.periods.map((period, idx) => {
      const row: Record<string, number | string> = { name: period.label };
      for (const loc of data.locations) {
        row[`db_${loc.locationId}`] = centsToEUR(loc.months[idx].contributionCents);
      }
      const cm = data.central.months[idx];
      row.db_ZENTRAL =
        centsToEUR(cm.personnelCostsCents) +
        centsToEUR(cm.fixedCostsCents) +
        centsToEUR(cm.otherCostsCents);
      row.marginPercent = data.consolidated[idx].marginPercent;
      return row;
    });
  }, [data]);

  // P&L grouped lines
  const pnlGroups = useMemo(() => {
    if (!activeMonths || activeMonths.length === 0) return [];
    const firstMonth = activeMonths[0];
    const groupOrder: Array<{ group: string; label: string }> = [
      { group: "REVENUE", label: "Erlöse" },
      { group: "PERSONNEL_COST", label: "Personal" },
      { group: "FIXED_COST", label: "Fixkosten" },
      { group: "OTHER_COST", label: "Sonstige Kosten" },
    ];
    return groupOrder
      .map(({ group, label }) => {
        const lines = firstMonth.lines.filter((l) => l.group === group);
        return { group, label, lineKeys: lines.map((l) => ({ key: l.key, label: l.label })) };
      })
      .filter((g) => g.lineKeys.length > 0);
  }, [activeMonths]);

  // ---------------------------------------------------------------------------
  // TOGGLE HELPERS
  // ---------------------------------------------------------------------------

  function toggleGroup(group: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // RENDER: LOADING
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-[var(--secondary)]">Performance wird berechnet...</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: ERROR
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">Fehler beim Laden</h1>
          <p className="text-[var(--secondary)] mb-4">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || !activeMonths || !kpis) return null;

  // ---------------------------------------------------------------------------
  // RENDER: MAIN
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* HEADER */}
      {/* ================================================================= */}
      <div className="admin-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-[var(--foreground)]">
              Ergebnisrechnung (GuV-light)
            </h1>
            {/* IST-Abdeckung Bar */}
            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs text-[var(--secondary)] whitespace-nowrap">IST-Abdeckung</span>
              <div className="flex-1 max-w-[200px] h-2 bg-[var(--accent)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round(data.overallIstCoverage * 100)}%`,
                    backgroundColor:
                      data.overallIstCoverage >= 0.7
                        ? "var(--success)"
                        : data.overallIstCoverage >= 0.3
                          ? "#f59e0b"
                          : "var(--danger)",
                  }}
                />
              </div>
              <span className="text-xs font-semibold text-[var(--foreground)]">
                {Math.round(data.overallIstCoverage * 100)} %
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:items-end gap-3">
            {/* Allocation Toggle */}
            <div className="flex items-center gap-0.5 bg-[var(--accent)] rounded-lg p-1">
              {(["NONE", "REVENUE_SHARE", "HEADCOUNT_SHARE"] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setAllocationMethod(method)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    allocationMethod === method
                      ? "bg-[var(--card)] shadow-sm text-[var(--foreground)]"
                      : "text-[var(--secondary)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {method === "NONE"
                    ? "Ohne Umlage"
                    : method === "REVENUE_SHARE"
                      ? "Umlage (Erlösanteil)"
                      : "Umlage (Kopfzahl)"}
                </button>
              ))}
            </div>
            {/* Include Unreviewed */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeUnreviewed}
                onChange={(e) => setIncludeUnreviewed(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <span className="text-xs text-[var(--secondary)]">Ungeprüfte einbeziehen</span>
            </label>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* SECTION 1: KPI CARDS */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Erlöse */}
        <div className="admin-card p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-[var(--secondary)]">Gesamterlöse</p>
              <p className="mt-1 sm:mt-2 text-xl sm:text-2xl font-bold text-green-600 truncate">
                {formatEURCompact(kpis.revenueCents)} €
              </p>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-3 bg-green-100">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <p className="mt-2 sm:mt-3 text-xs text-[var(--muted)]">
            {data.periodCount} Monate, {selectedView === "GESAMT" ? "alle Standorte" : tabs.find((t) => t.key === selectedView)?.label ?? ""}
          </p>
        </div>

        {/* Kosten */}
        <div className="admin-card p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-[var(--secondary)]">Gesamtkosten</p>
              <p className="mt-1 sm:mt-2 text-xl sm:text-2xl font-bold text-[var(--danger)] truncate">
                {formatEURCompact(kpis.totalCostsCents)} €
              </p>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-3 bg-red-100">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            </div>
          </div>
          <p className="mt-2 sm:mt-3 text-xs text-[var(--muted)]">Personal + Fixkosten + Sonstige</p>
        </div>

        {/* Deckungsbeitrag */}
        <div className="admin-card p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-[var(--secondary)]">Deckungsbeitrag</p>
              <p className={`mt-1 sm:mt-2 text-xl sm:text-2xl font-bold truncate ${Number(kpis.contributionCents) >= 0 ? "text-green-600" : "text-[var(--danger)]"}`}>
                {formatEURCompact(kpis.contributionCents)} €
              </p>
            </div>
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-3 ${Number(kpis.contributionCents) >= 0 ? "bg-green-100" : "bg-red-100"}`}>
              <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${Number(kpis.contributionCents) >= 0 ? "text-green-600" : "text-red-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <p className="mt-2 sm:mt-3 text-xs text-[var(--muted)]">Erlöse abzgl. aller Kosten</p>
        </div>

        {/* Durchschnittliche Marge */}
        <div className="admin-card p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-[var(--secondary)]">Ø Marge</p>
              <p className={`mt-1 sm:mt-2 text-xl sm:text-2xl font-bold truncate ${kpis.avgMargin >= 0 ? "text-green-600" : "text-[var(--danger)]"}`}>
                {formatPercent(kpis.avgMargin)}
              </p>
            </div>
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-3 ${kpis.avgMargin >= 0 ? "bg-blue-100" : "bg-red-100"}`}>
              <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${kpis.avgMargin >= 0 ? "text-blue-600" : "text-red-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            </div>
          </div>
          <p className="mt-2 sm:mt-3 text-xs text-[var(--muted)]">DB / Erlöse (Durchschnitt)</p>
        </div>
      </div>

      {/* ================================================================= */}
      {/* SECTION 2: TREND CHART */}
      {/* ================================================================= */}
      <div className="admin-card p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">
          Deckungsbeitrag nach Standort
        </h3>
        <div className="w-full" style={{ height: "clamp(280px, 30vw, 380px)" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "var(--secondary)" }}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tickFormatter={formatAxisEUR}
                tick={{ fontSize: 12, fill: "var(--secondary)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                tick={{ fontSize: 12, fill: MARGIN_COLOR }}
                tickLine={false}
                axisLine={false}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card)",
                  fontSize: 13,
                }}
                formatter={((value: number, name: string) => {
                  if (name === "marginPercent") return [`${value.toFixed(1)} %`, "Marge"];
                  const locName =
                    name === "db_ZENTRAL"
                      ? "Zentral"
                      : data.locations.find((l) => `db_${l.locationId}` === name)?.locationName ?? name;
                  return [
                    `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)} €`,
                    locName,
                  ];
                }) as never}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <ReferenceLine yAxisId="left" y={0} stroke="var(--danger)" strokeDasharray="3 3" strokeOpacity={0.6} />

              {/* Bars per location */}
              {data.locations.map((loc, idx) => (
                <Bar
                  key={loc.locationId}
                  yAxisId="left"
                  dataKey={`db_${loc.locationId}`}
                  name={`db_${loc.locationId}`}
                  fill={LOCATION_COLORS[idx % LOCATION_COLORS.length]}
                  radius={[2, 2, 0, 0]}
                  barSize={20}
                />
              ))}

              {/* Central costs bar */}
              <Bar
                yAxisId="left"
                dataKey="db_ZENTRAL"
                name="db_ZENTRAL"
                fill={CENTRAL_COLOR}
                radius={[2, 2, 0, 0]}
                barSize={20}
              />

              {/* Margin line */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="marginPercent"
                name="marginPercent"
                stroke={MARGIN_COLOR}
                strokeWidth={2}
                dot={{ r: 4, fill: MARGIN_COLOR }}
                activeDot={{ r: 6 }}
              />

              <Legend
                formatter={(value: string) => {
                  if (value === "marginPercent") return "Marge %";
                  if (value === "db_ZENTRAL") return "Zentral";
                  return data.locations.find((l) => `db_${l.locationId}` === value)?.locationName ?? value;
                }}
                wrapperStyle={{ fontSize: 12 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ================================================================= */}
      {/* SECTION 3: STANDORT-TABS */}
      {/* ================================================================= */}
      <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedView(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              selectedView === tab.key
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "bg-[var(--accent)] text-[var(--secondary)] hover:bg-[var(--hover)]"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                tab.key === "ZENTRAL"
                  ? "bg-gray-400"
                  : tab.isPositive
                    ? "bg-green-400"
                    : "bg-red-400"
              }`}
            />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ================================================================= */}
      {/* SECTION 4: P&L TABLE */}
      {/* ================================================================= */}
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="liquidity-table">
            <thead>
              <tr>
                <th className="min-w-[160px]">Position</th>
                {data.periods.map((p, idx) => {
                  const istCov = activeMonths[idx]?.istCoverage ?? 0;
                  return (
                    <th key={p.index} className="min-w-[100px]">
                      <div>{p.label}</div>
                      <span
                        className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          istCov >= 0.7
                            ? "bg-green-100 text-green-700"
                            : istCov > 0.3
                              ? "bg-amber-100 text-amber-700"
                              : istCov > 0
                                ? "bg-purple-100 text-purple-700"
                                : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {istCov >= 0.7 ? "IST" : istCov > 0.3 ? "MIX" : istCov > 0 ? "PLAN" : "–"}
                      </span>
                    </th>
                  );
                })}
                <th className="min-w-[110px]">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {pnlGroups.map((group) => {
                const isExpanded = expandedGroups.has(group.group);
                // Calculate group subtotals per month
                const subtotals = data.periods.map((_, idx) => {
                  let sum = 0;
                  for (const line of group.lineKeys) {
                    const entry = activeMonths[idx]?.lines.find((l) => l.key === line.key);
                    if (entry) sum += Number(entry.amountCents);
                  }
                  return sum;
                });
                const groupTotal = subtotals.reduce((a, b) => a + b, 0);

                return (
                  <PnLGroupRows
                    key={group.group}
                    group={group}
                    isExpanded={isExpanded}
                    onToggle={() => toggleGroup(group.group)}
                    activeMonths={activeMonths}
                    periods={data.periods}
                    subtotals={subtotals}
                    groupTotal={groupTotal}
                  />
                );
              })}

              {/* DB Row */}
              <tr className="row-total">
                <td className="font-bold">Deckungsbeitrag</td>
                {data.periods.map((_, idx) => {
                  const val = Number(activeMonths[idx]?.contributionCents ?? "0");
                  return (
                    <td key={idx} className={val < 0 ? "!text-red-300" : "!text-green-300"}>
                      {formatEUR(String(val))}
                    </td>
                  );
                })}
                <td className={Number(kpis.contributionCents) < 0 ? "!text-red-300" : "!text-green-300"}>
                  {formatEUR(kpis.contributionCents)}
                </td>
              </tr>

              {/* Margin Row */}
              <tr>
                <td className="text-xs italic text-[var(--muted)]">Marge %</td>
                {data.periods.map((_, idx) => {
                  const margin = activeMonths[idx]?.marginPercent ?? 0;
                  return (
                    <td
                      key={idx}
                      className={`text-xs italic ${margin < 0 ? "value-negative" : margin > 0 ? "value-positive" : "text-[var(--muted)]"}`}
                    >
                      {formatPercent(margin)}
                    </td>
                  );
                })}
                <td className={`text-xs italic ${kpis.avgMargin < 0 ? "value-negative" : kpis.avgMargin > 0 ? "value-positive" : "text-[var(--muted)]"}`}>
                  {formatPercent(kpis.avgMargin)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================================= */}
      {/* SECTION 5: DATA QUALITY */}
      {/* ================================================================= */}
      <div className="admin-card overflow-hidden">
        <button
          onClick={() => setShowDataQuality(!showDataQuality)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--accent)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--foreground)]">Datenqualität</span>
            <span
              className={`badge ${
                data.dataQuality.warnings.length === 0 ? "badge-success" : "badge-warning"
              }`}
            >
              {data.dataQuality.warnings.length === 0
                ? "Gut"
                : `${data.dataQuality.warnings.length} Hinweise`}
            </span>
          </div>
          <svg
            className={`w-5 h-5 text-[var(--secondary)] transition-transform ${showDataQuality ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDataQuality && (
          <div className="px-4 pb-4 space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBox label="Entries gesamt" value={data.dataQuality.totalEntries} />
              <StatBox label="Mit Leistungszeitraum" value={data.dataQuality.entriesWithServicePeriod} />
              <StatBox label="Mit Leistungsdatum" value={data.dataQuality.entriesWithServiceDate} />
              <StatBox label="Fallback (Buchungsdatum)" value={data.dataQuality.entriesWithFallbackDate} highlight={data.dataQuality.entriesWithFallbackDate > 0} />
              <StatBox label="Nicht klassifiziert" value={data.dataQuality.unclassifiedEntries} highlight={data.dataQuality.unclassifiedEntries > 0} />
              <StatBox label="Gleichverteilung" value={data.dataQuality.approximateSpreadCount} highlight={data.dataQuality.approximateSpreadCount > 0} />
              <StatBox label="MA mit Gehaltsdaten" value={data.dataQuality.employeesWithSalaryData} />
              <StatBox label="MA ohne Gehaltsdaten" value={data.dataQuality.employeesWithoutSalaryData} highlight={data.dataQuality.employeesWithoutSalaryData > 0} />
            </div>

            {/* Warnings */}
            {data.dataQuality.warnings.length > 0 && (
              <div className="space-y-2">
                {data.dataQuality.warnings.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800"
                  >
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function PnLGroupRows({
  group,
  isExpanded,
  onToggle,
  activeMonths,
  periods,
  subtotals,
  groupTotal,
}: {
  group: { group: string; label: string; lineKeys: Array<{ key: string; label: string }> };
  isExpanded: boolean;
  onToggle: () => void;
  activeMonths: SLocationMonthResult[];
  periods: SPerformancePeriod[];
  subtotals: number[];
  groupTotal: number;
}) {
  return (
    <>
      {/* Group Header */}
      <tr className="row-category">
        <td
          onClick={onToggle}
          className="cursor-pointer select-none"
        >
          <span className="mr-1">{isExpanded ? "▾" : "▸"}</span>
          {group.label}
        </td>
        {periods.map((_, idx) => (
          <td key={idx} />
        ))}
        <td />
      </tr>

      {/* Individual Lines */}
      {isExpanded &&
        group.lineKeys.map((line) => {
          const lineTotal = periods.reduce((sum, _, idx) => {
            const entry = activeMonths[idx]?.lines.find((l) => l.key === line.key);
            return sum + (entry ? Number(entry.amountCents) : 0);
          }, 0);
          return (
            <tr key={line.key}>
              <td className="pl-6 text-[var(--secondary)]">{line.label}</td>
              {periods.map((_, idx) => {
                const entry = activeMonths[idx]?.lines.find((l) => l.key === line.key);
                const val = entry ? Number(entry.amountCents) : 0;
                return (
                  <td key={idx} className={val < 0 ? "value-negative" : ""}>
                    {val === 0 ? "–" : formatEUR(String(val))}
                  </td>
                );
              })}
              <td className={lineTotal < 0 ? "value-negative" : ""}>
                {lineTotal === 0 ? "–" : formatEUR(String(lineTotal))}
              </td>
            </tr>
          );
        })}

      {/* Subtotal */}
      <tr className="row-subtotal">
        <td>Σ {group.label}</td>
        {subtotals.map((val, idx) => (
          <td key={idx} className={val < 0 ? "value-negative" : ""}>
            {formatEUR(String(val))}
          </td>
        ))}
        <td className={groupTotal < 0 ? "value-negative" : ""}>
          {formatEUR(String(groupTotal))}
        </td>
      </tr>
    </>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? "bg-amber-50 border border-amber-200" : "bg-[var(--accent)]"}`}>
      <p className={`text-lg font-bold ${highlight ? "text-amber-700" : "text-[var(--foreground)]"}`}>
        {value.toLocaleString("de-DE")}
      </p>
      <p className={`text-xs ${highlight ? "text-amber-600" : "text-[var(--muted)]"}`}>{label}</p>
    </div>
  );
}
