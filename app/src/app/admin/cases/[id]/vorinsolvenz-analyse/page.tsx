"use client";

import { useEffect, useState, use, useCallback } from "react";

// === Types ===

interface LocationBreakdown {
  locationId: string;
  locationName: string;
  totalCents: string;
  monthly: Record<string, string>;
}

interface CounterpartyRow {
  counterpartyId: string | null;
  counterpartyName: string;
  counterpartyType: string | null;
  flowType: "INFLOW" | "OUTFLOW" | "MIXED";
  totalCents: string;
  matchCount: number;
  monthly: Record<string, string>;
  byLocation: LocationBreakdown[];
}

interface MonthlySummaryRow {
  month: string;
  inflowsCents: string;
  outflowsCents: string;
  netCents: string;
  count: number;
}

interface UnclassifiedEntry {
  id: string;
  description: string;
  note: string | null;
  amountCents: string;
  transactionDate: string;
}

interface LocationInfo {
  id: string;
  name: string;
}

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
  byBankAccount: Array<{
    accountId: string;
    accountName: string;
    bankName: string;
    inflowsCents: string;
    outflowsCents: string;
    count: number;
  }>;
  unclassified: UnclassifiedEntry[];
  locations: LocationInfo[];
}

// === Helpers ===

function formatCompact(cents: string): string {
  const val = parseInt(cents) / 100;
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(val / 1_000)}K`;
  if (abs === 0) return "0";
  return val.toFixed(0);
}

function formatCurrency(cents: string): string {
  const value = parseInt(cents);
  const euros = value / 100;
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(euros);
}

function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const names = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  return `${names[parseInt(month) - 1]} ${year.slice(2)}`;
}

function formatMonthLong(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const names = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
  ];
  return `${names[parseInt(month) - 1]} ${year}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

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

  const toggleRow = useCallback((key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // === Loading/Error states ===

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-500">Vorinsolvenz-Analyse wird berechnet...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="admin-card p-8 text-center">
        <p className="text-red-600">{error || "Keine Daten"}</p>
      </div>
    );
  }

  if (data.summary.totalCount === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Vorinsolvenz-Analyse</h1>
        <div className="admin-card p-8 text-center">
          <p className="text-gray-500">Keine Vorinsolvenz-Daten vorhanden.</p>
          <p className="text-sm text-gray-400 mt-2">
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
  const classRate = ((data.summary.classifiedCount / data.summary.totalCount) * 100).toFixed(0);
  const locationCount = data.locations.length;

  // Einnahmen/Ausgaben getrennt
  const inflowRows = data.counterpartyMonthly.filter(
    (r) => r.flowType === "INFLOW" || (r.flowType === "MIXED" && parseInt(r.totalCents) >= 0)
  );
  const outflowRows = data.counterpartyMonthly.filter(
    (r) => r.flowType === "OUTFLOW" || (r.flowType === "MIXED" && parseInt(r.totalCents) < 0)
  );

  const netCents = parseInt(data.summary.netCents);

  // === Render ===

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Vorinsolvenz-Analyse
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {firstMonth} – {lastMonth} · {data.summary.totalCount.toLocaleString("de-DE")} Buchungen · {locationCount > 0 ? `${locationCount} Standorte · ` : ""}{months.length} Monate
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="admin-card p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Einnahmen</p>
          <p className="text-xl font-bold text-green-600 mt-1">
            {formatCurrency(data.summary.totalInflowsCents)} €
          </p>
        </div>
        <div className="admin-card p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Ausgaben</p>
          <p className="text-xl font-bold text-red-600 mt-1">
            {formatCurrency(data.summary.totalOutflowsCents)} €
          </p>
        </div>
        <div className="admin-card p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Netto-Cashflow</p>
          <p className={`text-xl font-bold mt-1 ${netCents >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(data.summary.netCents)} €
          </p>
        </div>
        <div className="admin-card p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Klassifiziert</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {classRate}%
          </p>
          <p className="text-xs text-gray-400">
            {data.summary.classifiedCount} / {data.summary.totalCount}
          </p>
        </div>
      </div>

      {/* === Matrix Table === */}
      <div className="admin-card overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20">
              {/* Period Labels */}
              <tr className="border-b border-gray-300 bg-gray-50">
                <th className="px-4 py-2.5 text-left font-semibold text-gray-900 sticky left-0 bg-gray-50 z-30 min-w-[240px]">
                  Position
                </th>
                {months.map((m) => (
                  <th key={m} className="px-2 py-2.5 text-right font-semibold text-gray-900 min-w-[80px] bg-gray-50">
                    {formatMonth(m)}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right font-semibold text-gray-900 min-w-[100px] border-l border-gray-300 bg-gray-50">
                  Gesamt
                </th>
              </tr>
            </thead>

            <tbody>
              {/* ===== BLOCK: EINNAHMEN ===== */}
              <tr className="bg-green-100/80">
                <td
                  colSpan={months.length + 2}
                  className="px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-green-800"
                >
                  Einnahmen ({inflowRows.length} Gegenparteien)
                </td>
              </tr>

              {inflowRows.map((row) => {
                const rowKey = `in-${row.counterpartyId || row.counterpartyName}`;
                const hasLocations = row.byLocation.length > 1;
                const isExpanded = expandedRows.has(rowKey);

                return (
                  <RowWithLocations
                    key={rowKey}
                    row={row}
                    rowKey={rowKey}
                    months={months}
                    hasLocations={hasLocations}
                    isExpanded={isExpanded}
                    onToggle={toggleRow}
                    colorClass="text-green-600"
                    bgClass="bg-white"
                  />
                );
              })}

              {/* Summe Einnahmen */}
              <tr className="bg-green-50 font-bold border-t-2 border-green-200">
                <td className="px-4 py-2.5 sticky left-0 bg-green-50 z-10 text-green-800">
                  Summe Einnahmen
                </td>
                {months.map((m) => {
                  const mData = data.monthlySummary.find((ms) => ms.month === m);
                  return (
                    <td key={m} className="px-2 py-2.5 text-right tabular-nums text-green-600">
                      {mData ? formatCompact(mData.inflowsCents) : "–"}
                    </td>
                  );
                })}
                <td className="px-4 py-2.5 text-right tabular-nums font-bold text-green-600 border-l border-green-200">
                  {formatCompact(data.summary.totalInflowsCents)}
                </td>
              </tr>

              {/* Block spacing */}
              <tr className="h-3 bg-white">
                <td colSpan={months.length + 2}></td>
              </tr>

              {/* ===== BLOCK: AUSGABEN ===== */}
              <tr className="bg-red-100/80">
                <td
                  colSpan={months.length + 2}
                  className="px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-red-800"
                >
                  Ausgaben ({outflowRows.length} Gegenparteien)
                </td>
              </tr>

              {outflowRows.map((row) => {
                const rowKey = `out-${row.counterpartyId || row.counterpartyName}`;
                const hasLocations = row.byLocation.length > 1;
                const isExpanded = expandedRows.has(rowKey);

                return (
                  <RowWithLocations
                    key={rowKey}
                    row={row}
                    rowKey={rowKey}
                    months={months}
                    hasLocations={hasLocations}
                    isExpanded={isExpanded}
                    onToggle={toggleRow}
                    colorClass="text-red-600"
                    bgClass="bg-white"
                  />
                );
              })}

              {/* Summe Ausgaben */}
              <tr className="bg-red-50 font-bold border-t-2 border-red-200">
                <td className="px-4 py-2.5 sticky left-0 bg-red-50 z-10 text-red-800">
                  Summe Ausgaben
                </td>
                {months.map((m) => {
                  const mData = data.monthlySummary.find((ms) => ms.month === m);
                  return (
                    <td key={m} className="px-2 py-2.5 text-right tabular-nums text-red-600">
                      {mData ? formatCompact(mData.outflowsCents) : "–"}
                    </td>
                  );
                })}
                <td className="px-4 py-2.5 text-right tabular-nums font-bold text-red-600 border-l border-red-200">
                  {formatCompact(data.summary.totalOutflowsCents)}
                </td>
              </tr>

              {/* Block spacing */}
              <tr className="h-3 bg-white">
                <td colSpan={months.length + 2}></td>
              </tr>

              {/* ===== BLOCK: NETTO ===== */}
              <tr className="bg-blue-100/80">
                <td
                  colSpan={months.length + 2}
                  className="px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-blue-800"
                >
                  Netto-Cashflow
                </td>
              </tr>

              <tr className="font-bold border-b border-blue-200 bg-blue-50">
                <td className="px-4 py-2.5 sticky left-0 bg-blue-50 z-10 text-gray-900">
                  Netto-Cashflow
                </td>
                {months.map((m) => {
                  const mData = data.monthlySummary.find((ms) => ms.month === m);
                  const net = mData ? parseInt(mData.netCents) : 0;
                  return (
                    <td
                      key={m}
                      className={`px-2 py-2.5 text-right tabular-nums ${
                        net >= 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {mData ? formatCompact(mData.netCents) : "–"}
                    </td>
                  );
                })}
                <td
                  className={`px-4 py-2.5 text-right tabular-nums font-bold border-l border-blue-200 ${
                    netCents >= 0 ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {formatCompact(data.summary.netCents)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
          <span>Beträge in EUR (gerundet, K = Tausend)</span>
          <span>Ø monatl. Einnahmen: {formatCompact(data.summary.avgMonthlyInflowsCents)} · Ausgaben: {formatCompact(data.summary.avgMonthlyOutflowsCents)}</span>
        </div>
      </div>

      {/* === Nicht zugeordnet === */}
      {data.unclassified.length > 0 && (
        <div className="admin-card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-amber-50">
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-800">
              Nicht zugeordnet ({data.unclassified.length} Buchungen)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Datum</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Beschreibung</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {data.unclassified.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 whitespace-nowrap text-gray-900">{formatDate(entry.transactionDate)}</td>
                    <td className="py-2 px-3 text-gray-700">
                      <div className="max-w-md truncate" title={entry.description}>{entry.description}</div>
                      {entry.note && <div className="text-xs text-gray-400">{entry.note}</div>}
                    </td>
                    <td className={`py-2 px-3 text-right font-mono whitespace-nowrap ${parseInt(entry.amountCents) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(entry.amountCents)} €
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

// === Sub-Component: Row with Location Breakdown ===

function RowWithLocations({
  row,
  rowKey,
  months,
  hasLocations,
  isExpanded,
  onToggle,
  colorClass,
  bgClass,
}: {
  row: CounterpartyRow;
  rowKey: string;
  months: string[];
  hasLocations: boolean;
  isExpanded: boolean;
  onToggle: (key: string) => void;
  colorClass: string;
  bgClass: string;
}) {
  const typeBadge = row.counterpartyType ? (
    <span className={`px-1.5 py-0.5 text-[10px] rounded ${
      row.counterpartyType === "PAYER" ? "bg-green-100 text-green-800" :
      row.counterpartyType === "SUPPLIER" ? "bg-blue-100 text-blue-800" :
      row.counterpartyType === "AUTHORITY" ? "bg-purple-100 text-purple-800" :
      "bg-gray-100 text-gray-600"
    }`}>
      {row.counterpartyType === "PAYER" ? "Zahler" :
       row.counterpartyType === "SUPPLIER" ? "Lieferant" :
       row.counterpartyType === "AUTHORITY" ? "Behörde" : "Sonstige"}
    </span>
  ) : null;

  return (
    <>
      {/* Parent Row */}
      <tr
        className={`border-b border-gray-100 ${hasLocations ? "cursor-pointer" : ""} hover:bg-gray-50`}
        onClick={hasLocations ? () => onToggle(rowKey) : undefined}
      >
        <td className={`px-4 py-2 sticky left-0 z-10 ${bgClass}`}>
          <div className="flex items-center gap-2">
            {hasLocations && (
              <span className={`text-gray-400 text-xs transition-transform inline-block ${isExpanded ? "rotate-90" : ""}`}>
                &#9654;
              </span>
            )}
            <span className="font-medium text-gray-900 truncate max-w-[180px]" title={row.counterpartyName}>
              {row.counterpartyName}
            </span>
            {typeBadge}
            <span className="text-[10px] text-gray-400">{row.matchCount}×</span>
          </div>
        </td>
        {months.map((m) => {
          const val = row.monthly[m];
          return (
            <td key={m} className={`px-2 py-2 text-right tabular-nums text-xs ${val ? "" : "text-gray-300"}`}>
              {val ? formatCompact(val) : "–"}
            </td>
          );
        })}
        <td className={`px-4 py-2 text-right tabular-nums font-semibold ${colorClass} border-l border-gray-200`}>
          {formatCompact(row.totalCents)}
        </td>
      </tr>

      {/* Location Children */}
      {isExpanded && row.byLocation.map((loc) => (
        <tr key={`${rowKey}-${loc.locationId}`} className="border-b border-gray-50 hover:bg-gray-50">
          <td className={`px-4 py-1.5 pl-12 sticky left-0 z-10 ${bgClass} text-gray-500 text-xs`}>
            davon {loc.locationName}
          </td>
          {months.map((m) => {
            const val = loc.monthly[m];
            return (
              <td key={m} className={`px-2 py-1.5 text-right tabular-nums text-xs ${val ? "text-gray-400" : "text-gray-300"}`}>
                {val ? formatCompact(val) : "–"}
              </td>
            );
          })}
          <td className="px-4 py-1.5 text-right tabular-nums text-xs text-gray-400 border-l border-gray-200">
            {formatCompact(loc.totalCents)}
          </td>
        </tr>
      ))}
    </>
  );
}
