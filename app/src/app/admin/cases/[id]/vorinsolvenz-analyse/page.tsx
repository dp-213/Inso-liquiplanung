"use client";

import { useEffect, useState, use } from "react";

// === Types ===

interface VorinsolvenzData {
  summary: {
    totalCount: number;
    classifiedCount: number;
    totalInflowsCents: string;
    totalOutflowsCents: string;
    netCents: string;
    avgMonthlyInflowsCents: string;
    avgMonthlyOutflowsCents: string;
    months: string[];
  };
  counterpartyMonthly: CounterpartyRow[];
  monthlySummary: MonthlySummaryRow[];
  byBankAccount: BankAccountRow[];
  unclassified: UnclassifiedEntry[];
}

interface CounterpartyRow {
  counterpartyId: string | null;
  counterpartyName: string;
  counterpartyType: string | null;
  flowType: "INFLOW" | "OUTFLOW" | "MIXED";
  totalCents: string;
  matchCount: number;
  monthly: Record<string, string>;
}

interface MonthlySummaryRow {
  month: string;
  inflowsCents: string;
  outflowsCents: string;
  netCents: string;
  count: number;
}

interface BankAccountRow {
  accountId: string;
  accountName: string;
  bankName: string;
  inflowsCents: string;
  outflowsCents: string;
  count: number;
}

interface UnclassifiedEntry {
  id: string;
  description: string;
  note: string | null;
  amountCents: string;
  transactionDate: string;
}

type TabView = "matrix" | "top" | "bank";

// === Component ===

export default function VorinsolvenzAnalysePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<VorinsolvenzData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabView>("matrix");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/cases/${id}/vorinsolvenz-analyse`, {
          credentials: "include",
        });
        if (!res.ok) {
          const err = await res.json();
          setError(err.error || "Fehler beim Laden");
          return;
        }
        setData(await res.json());
      } catch {
        setError("Verbindungsfehler");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  // === Helpers ===

  const formatCurrency = (cents: string): string => {
    const amount = parseInt(cents) / 100;
    return amount.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
  };

  const formatCompact = (cents: string): string => {
    const val = parseInt(cents) / 100;
    const abs = Math.abs(val);
    if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
    return val.toFixed(0);
  };

  const formatMonth = (monthKey: string): string => {
    const [year, month] = monthKey.split("-");
    const names = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    return `${names[parseInt(month) - 1]} ${year.slice(2)}`;
  };

  const formatMonthLong = (monthKey: string): string => {
    const [year, month] = monthKey.split("-");
    const names = [
      "Januar", "Februar", "März", "April", "Mai", "Juni",
      "Juli", "August", "September", "Oktober", "November", "Dezember",
    ];
    return `${names[parseInt(month) - 1]} ${year}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  };

  const toggleRow = (key: string) => {
    const next = new Set(expandedRows);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedRows(next);
  };

  const getTypeBadge = (type: string | null) => {
    if (!type) return null;
    const styles: Record<string, string> = {
      PAYER: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      SUPPLIER: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      AUTHORITY: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      OTHER: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    };
    const labels: Record<string, string> = {
      PAYER: "Zahler", SUPPLIER: "Lieferant", AUTHORITY: "Behörde", OTHER: "Sonstige",
    };
    return (
      <span className={`px-1.5 py-0.5 text-[10px] rounded ${styles[type] || styles.OTHER}`}>
        {labels[type] || type}
      </span>
    );
  };

  const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
    <svg
      className={`w-4 h-4 text-[var(--muted)] transition-transform ${expanded ? "rotate-90" : ""}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );

  // === Loading/Error states ===

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="admin-card p-8 text-center">
        <p className="text-[var(--danger)]">{error || "Keine Daten"}</p>
      </div>
    );
  }

  if (data.summary.totalCount === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Vorinsolvenz-Analyse</h1>
        <div className="admin-card p-8 text-center">
          <p className="text-[var(--muted)]">Keine Vorinsolvenz-Daten vorhanden.</p>
          <p className="text-sm text-[var(--muted)] mt-2">
            Dieser Fall hat keine Einträge mit allocationSource = PRE_INSOLVENCY.
          </p>
        </div>
      </div>
    );
  }

  // === Derived data ===

  const { months } = data.summary;
  const firstMonth = formatMonthLong(months[0]);
  const lastMonth = formatMonthLong(months[months.length - 1]);
  const classRate = ((data.summary.classifiedCount / data.summary.totalCount) * 100).toFixed(1);

  // Einnahmen/Ausgaben getrennt für Matrix
  const inflowRows = data.counterpartyMonthly.filter(
    (r) => r.flowType === "INFLOW" || (r.flowType === "MIXED" && parseInt(r.totalCents) >= 0)
  );
  const outflowRows = data.counterpartyMonthly.filter(
    (r) => r.flowType === "OUTFLOW" || (r.flowType === "MIXED" && parseInt(r.totalCents) < 0)
  );

  // Top 20 für Tab 2
  const topInflows = data.counterpartyMonthly
    .filter((r) => r.flowType === "INFLOW" || r.flowType === "MIXED")
    .sort((a, b) => parseInt(b.totalCents) - parseInt(a.totalCents))
    .slice(0, 20);
  const topOutflows = data.counterpartyMonthly
    .filter((r) => r.flowType === "OUTFLOW" || r.flowType === "MIXED")
    .sort((a, b) => parseInt(a.totalCents) - parseInt(b.totalCents))
    .slice(0, 20);

  const totalInflowAbs = Math.abs(parseInt(data.summary.totalInflowsCents));
  const totalOutflowAbs = Math.abs(parseInt(data.summary.totalOutflowsCents));

  // === Render ===

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Vorinsolvenz-Analyse ({firstMonth}–{lastMonth})
        </h1>
        <p className="text-[var(--secondary)] mt-1">
          {data.summary.totalCount} Buchungen über {months.length} Monate
        </p>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="admin-card p-4">
          <p className="text-xs text-[var(--muted)]">Einnahmen</p>
          <p className="text-xl font-bold text-[var(--success)]">
            {formatCurrency(data.summary.totalInflowsCents)}
          </p>
        </div>
        <div className="admin-card p-4">
          <p className="text-xs text-[var(--muted)]">Ausgaben</p>
          <p className="text-xl font-bold text-[var(--danger)]">
            {formatCurrency(data.summary.totalOutflowsCents)}
          </p>
        </div>
        <div className="admin-card p-4">
          <p className="text-xs text-[var(--muted)]">Netto</p>
          <p className={`text-xl font-bold ${parseInt(data.summary.netCents) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
            {formatCurrency(data.summary.netCents)}
          </p>
        </div>
        <div className="admin-card p-4">
          <p className="text-xs text-[var(--muted)]">Klassifiziert</p>
          <p className="text-xl font-bold text-[var(--foreground)]">
            {classRate}%
          </p>
          <p className="text-[10px] text-[var(--muted)]">
            {data.summary.classifiedCount} / {data.summary.totalCount}
          </p>
        </div>
        <div className="admin-card p-4">
          <p className="text-xs text-[var(--muted)]">Ø monatl. Cashflow</p>
          <p className="text-lg font-bold text-[var(--success)]">
            +{formatCompact(data.summary.avgMonthlyInflowsCents)}
          </p>
          <p className="text-lg font-bold text-[var(--danger)]">
            {formatCompact(data.summary.avgMonthlyOutflowsCents)}
          </p>
        </div>
      </div>

      {/* Tab-Toggle */}
      <div className="flex gap-1 p-1 bg-[var(--background-secondary)] rounded-lg w-fit">
        {([
          { key: "matrix" as TabView, label: "Monatsmatrix" },
          { key: "top" as TabView, label: "Top-Gegenparteien" },
          { key: "bank" as TabView, label: "Bankkonten" },
        ]).map((tab) => (
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

      {/* === Tab 1: Monatsmatrix === */}
      {activeTab === "matrix" && (
        <div className="space-y-6">
          {/* Einnahmen-Block */}
          <div className="admin-card overflow-hidden">
            <div className="p-4 border-b border-[var(--border)]">
              <h2 className="text-sm font-semibold text-[var(--success)] uppercase tracking-wider">
                Einnahmen ({inflowRows.length} Gegenparteien)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--background-secondary)]">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium text-[var(--foreground)] sticky left-0 bg-[var(--background-secondary)] min-w-[200px] z-10">
                      Gegenpartei
                    </th>
                    {months.map((m) => (
                      <th key={m} className="text-right py-2 px-2 font-medium text-[var(--foreground)] min-w-[80px]">
                        {formatMonth(m)}
                      </th>
                    ))}
                    <th className="text-right py-2 px-3 font-medium text-[var(--foreground)] min-w-[100px] border-l border-[var(--border)]">
                      Gesamt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {inflowRows.map((row) => {
                    const rowKey = `in-${row.counterpartyId || row.counterpartyName}`;
                    return (
                      <tr
                        key={rowKey}
                        className="border-b border-[var(--border)] hover:bg-[var(--background-secondary)] transition-colors"
                      >
                        <td className="py-2 px-3 sticky left-0 bg-[var(--card)] z-10">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[var(--foreground)] truncate max-w-[180px]" title={row.counterpartyName}>
                              {row.counterpartyName}
                            </span>
                            {getTypeBadge(row.counterpartyType)}
                          </div>
                          <span className="text-[10px] text-[var(--muted)]">{row.matchCount}×</span>
                        </td>
                        {months.map((m) => {
                          const val = row.monthly[m];
                          return (
                            <td key={m} className="py-2 px-2 text-right font-mono text-xs text-[var(--foreground)]">
                              {val ? formatCompact(val) : "–"}
                            </td>
                          );
                        })}
                        <td className="py-2 px-3 text-right font-mono text-sm font-semibold text-[var(--success)] border-l border-[var(--border)]">
                          {formatCompact(row.totalCents)}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Summenzeile Einnahmen */}
                  <tr className="bg-[var(--background-secondary)] font-semibold border-t-2 border-[var(--border)]">
                    <td className="py-2 px-3 sticky left-0 bg-[var(--background-secondary)] z-10 text-[var(--foreground)]">
                      Summe Einnahmen
                    </td>
                    {months.map((m) => {
                      const mData = data.monthlySummary.find((ms) => ms.month === m);
                      return (
                        <td key={m} className="py-2 px-2 text-right font-mono text-xs text-[var(--success)]">
                          {mData ? formatCompact(mData.inflowsCents) : "–"}
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right font-mono text-sm text-[var(--success)] border-l border-[var(--border)]">
                      {formatCompact(data.summary.totalInflowsCents)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Ausgaben-Block */}
          <div className="admin-card overflow-hidden">
            <div className="p-4 border-b border-[var(--border)]">
              <h2 className="text-sm font-semibold text-[var(--danger)] uppercase tracking-wider">
                Ausgaben ({outflowRows.length} Gegenparteien)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--background-secondary)]">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium text-[var(--foreground)] sticky left-0 bg-[var(--background-secondary)] min-w-[200px] z-10">
                      Gegenpartei
                    </th>
                    {months.map((m) => (
                      <th key={m} className="text-right py-2 px-2 font-medium text-[var(--foreground)] min-w-[80px]">
                        {formatMonth(m)}
                      </th>
                    ))}
                    <th className="text-right py-2 px-3 font-medium text-[var(--foreground)] min-w-[100px] border-l border-[var(--border)]">
                      Gesamt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {outflowRows.map((row) => {
                    const rowKey = `out-${row.counterpartyId || row.counterpartyName}`;
                    return (
                      <tr
                        key={rowKey}
                        className="border-b border-[var(--border)] hover:bg-[var(--background-secondary)] transition-colors"
                      >
                        <td className="py-2 px-3 sticky left-0 bg-[var(--card)] z-10">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[var(--foreground)] truncate max-w-[180px]" title={row.counterpartyName}>
                              {row.counterpartyName}
                            </span>
                            {getTypeBadge(row.counterpartyType)}
                          </div>
                          <span className="text-[10px] text-[var(--muted)]">{row.matchCount}×</span>
                        </td>
                        {months.map((m) => {
                          const val = row.monthly[m];
                          return (
                            <td key={m} className="py-2 px-2 text-right font-mono text-xs text-[var(--foreground)]">
                              {val ? formatCompact(val) : "–"}
                            </td>
                          );
                        })}
                        <td className="py-2 px-3 text-right font-mono text-sm font-semibold text-[var(--danger)] border-l border-[var(--border)]">
                          {formatCompact(row.totalCents)}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Summenzeile Ausgaben */}
                  <tr className="bg-[var(--background-secondary)] font-semibold border-t-2 border-[var(--border)]">
                    <td className="py-2 px-3 sticky left-0 bg-[var(--background-secondary)] z-10 text-[var(--foreground)]">
                      Summe Ausgaben
                    </td>
                    {months.map((m) => {
                      const mData = data.monthlySummary.find((ms) => ms.month === m);
                      return (
                        <td key={m} className="py-2 px-2 text-right font-mono text-xs text-[var(--danger)]">
                          {mData ? formatCompact(mData.outflowsCents) : "–"}
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right font-mono text-sm text-[var(--danger)] border-l border-[var(--border)]">
                      {formatCompact(data.summary.totalOutflowsCents)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Netto-Cashflow-Zeile */}
          <div className="admin-card p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="font-bold">
                    <td className="py-2 px-3 text-[var(--foreground)] min-w-[200px]">Netto-Cashflow</td>
                    {months.map((m) => {
                      const mData = data.monthlySummary.find((ms) => ms.month === m);
                      const net = mData ? parseInt(mData.netCents) : 0;
                      return (
                        <td key={m} className={`py-2 px-2 text-right font-mono text-xs min-w-[80px] ${net >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                          {mData ? formatCompact(mData.netCents) : "–"}
                        </td>
                      );
                    })}
                    <td className={`py-2 px-3 text-right font-mono text-sm min-w-[100px] border-l border-[var(--border)] ${parseInt(data.summary.netCents) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                      {formatCompact(data.summary.netCents)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Unklassifizierte Entries */}
          {data.unclassified.length > 0 && (
            <div className="admin-card overflow-hidden">
              <div className="p-4 border-b border-[var(--border)]">
                <h2 className="text-sm font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  Nicht zugeordnet ({data.unclassified.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--background-secondary)]">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium text-[var(--foreground)]">Datum</th>
                      <th className="text-left py-2 px-3 font-medium text-[var(--foreground)]">Beschreibung</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--foreground)]">Betrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.unclassified.map((entry) => (
                      <tr key={entry.id} className="border-b border-[var(--border)] hover:bg-[var(--background-secondary)]">
                        <td className="py-2 px-3 whitespace-nowrap text-[var(--foreground)]">{formatDate(entry.transactionDate)}</td>
                        <td className="py-2 px-3 text-[var(--foreground)]">
                          <div className="max-w-md truncate" title={entry.description}>{entry.description}</div>
                          {entry.note && <div className="text-xs text-[var(--muted)]">{entry.note}</div>}
                        </td>
                        <td className={`py-2 px-3 text-right font-mono whitespace-nowrap ${parseInt(entry.amountCents) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                          {formatCurrency(entry.amountCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* === Tab 2: Top-Gegenparteien === */}
      {activeTab === "top" && (
        <div className="space-y-6">
          {/* Top Einnahmen */}
          <div className="admin-card overflow-hidden">
            <div className="p-4 border-b border-[var(--border)]">
              <h2 className="text-sm font-semibold text-[var(--success)] uppercase tracking-wider">
                Top Einnahmen
              </h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {topInflows.map((row, idx) => {
                const rowKey = `top-in-${row.counterpartyId || row.counterpartyName}`;
                const total = parseInt(row.totalCents);
                const pct = totalInflowAbs > 0 ? (total / totalInflowAbs) * 100 : 0;
                return (
                  <div key={rowKey}>
                    <button
                      onClick={() => toggleRow(rowKey)}
                      className="w-full p-4 flex items-center gap-4 hover:bg-[var(--background-secondary)] transition-colors"
                    >
                      <span className="text-sm font-mono text-[var(--muted)] w-6">{idx + 1}.</span>
                      <ChevronIcon expanded={expandedRows.has(rowKey)} />
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--foreground)] truncate">{row.counterpartyName}</span>
                          {getTypeBadge(row.counterpartyType)}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-[var(--background-secondary)] rounded-full overflow-hidden max-w-xs">
                            <div className="h-full bg-[var(--success)] rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="text-xs text-[var(--muted)]">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-[var(--success)]">{formatCurrency(row.totalCents)}</p>
                        <p className="text-xs text-[var(--muted)]">{row.matchCount} Buchungen</p>
                      </div>
                    </button>
                    {expandedRows.has(rowKey) && (
                      <div className="px-4 pb-4">
                        <div className="bg-[var(--background-secondary)] rounded-lg p-3">
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {months.map((m) => {
                              const val = row.monthly[m];
                              return (
                                <div key={m} className="text-center">
                                  <p className="text-[10px] text-[var(--muted)]">{formatMonth(m)}</p>
                                  <p className="text-xs font-mono text-[var(--foreground)]">
                                    {val ? formatCompact(val) : "–"}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Ausgaben */}
          <div className="admin-card overflow-hidden">
            <div className="p-4 border-b border-[var(--border)]">
              <h2 className="text-sm font-semibold text-[var(--danger)] uppercase tracking-wider">
                Top Ausgaben
              </h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {topOutflows.map((row, idx) => {
                const rowKey = `top-out-${row.counterpartyId || row.counterpartyName}`;
                const total = Math.abs(parseInt(row.totalCents));
                const pct = totalOutflowAbs > 0 ? (total / totalOutflowAbs) * 100 : 0;
                return (
                  <div key={rowKey}>
                    <button
                      onClick={() => toggleRow(rowKey)}
                      className="w-full p-4 flex items-center gap-4 hover:bg-[var(--background-secondary)] transition-colors"
                    >
                      <span className="text-sm font-mono text-[var(--muted)] w-6">{idx + 1}.</span>
                      <ChevronIcon expanded={expandedRows.has(rowKey)} />
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--foreground)] truncate">{row.counterpartyName}</span>
                          {getTypeBadge(row.counterpartyType)}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-[var(--background-secondary)] rounded-full overflow-hidden max-w-xs">
                            <div className="h-full bg-[var(--danger)] rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="text-xs text-[var(--muted)]">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-[var(--danger)]">{formatCurrency(row.totalCents)}</p>
                        <p className="text-xs text-[var(--muted)]">{row.matchCount} Buchungen</p>
                      </div>
                    </button>
                    {expandedRows.has(rowKey) && (
                      <div className="px-4 pb-4">
                        <div className="bg-[var(--background-secondary)] rounded-lg p-3">
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {months.map((m) => {
                              const val = row.monthly[m];
                              return (
                                <div key={m} className="text-center">
                                  <p className="text-[10px] text-[var(--muted)]">{formatMonth(m)}</p>
                                  <p className="text-xs font-mono text-[var(--foreground)]">
                                    {val ? formatCompact(val) : "–"}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* === Tab 3: Bankkonten === */}
      {activeTab === "bank" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Bankkonten-Verteilung</h2>
          {data.byBankAccount.map((ba) => {
            const net = parseInt(ba.inflowsCents) + parseInt(ba.outflowsCents);
            return (
              <div key={ba.accountId} className="admin-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-[var(--foreground)]">
                      {ba.accountName}
                      {ba.bankName && <span className="font-normal text-[var(--muted)] ml-2">– {ba.bankName}</span>}
                    </h3>
                    <p className="text-sm text-[var(--muted)]">{ba.count} Buchungen</p>
                  </div>
                  <div className="flex gap-8 text-right">
                    <div>
                      <p className="text-xs text-[var(--muted)]">Einzahlungen</p>
                      <p className="font-semibold text-[var(--success)]">{formatCurrency(ba.inflowsCents)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--muted)]">Auszahlungen</p>
                      <p className="font-semibold text-[var(--danger)]">{formatCurrency(ba.outflowsCents)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--muted)]">Netto</p>
                      <p className={`font-semibold ${net >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                        {formatCurrency(String(net))}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
