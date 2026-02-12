"use client";

import { useEffect, useState, use, useCallback, useMemo } from "react";

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
  insolvencyMonth: string | null;
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

function formatCurrencyExact(cents: string): string {
  const value = parseInt(cents);
  const euros = value / 100;
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

function insolvencyBorderClass(month: string, insolvencyMonth: string | null): string {
  return insolvencyMonth !== null && month === insolvencyMonth ? "border-l-2 border-l-orange-400" : "";
}

/** Trend-Indikator: Abweichung vom Durchschnitt */
function trendIndicator(value: number, avg: number): { symbol: string; className: string } | null {
  if (avg === 0 || Math.abs(value) < 1000) return null; // Ignoriere Kleinstbeträge (<10€)
  const deviation = (value - avg) / Math.abs(avg);
  if (deviation > 0.3) return { symbol: "▲", className: "text-green-500" };
  if (deviation < -0.3) return { symbol: "▼", className: "text-red-400" };
  return null;
}

// === CSV Export ===

function exportCSV(
  months: string[],
  inflowRows: CounterpartyRow[],
  outflowRows: CounterpartyRow[],
  monthlySummary: MonthlySummaryRow[],
  summary: VorinsolvenzData["summary"],
) {
  const header = ["Position", ...months.map(formatMonth), "Gesamt", "Ø/Mon"].join(";");
  const monthCount = months.length || 1;

  function rowToCSV(label: string, monthly: Record<string, string>, total: string): string {
    const avg = String(Math.round(parseInt(total) / monthCount));
    const cells = months.map(m => {
      const val = monthly[m];
      return val ? formatCurrencyExact(val) : "";
    });
    return [label, ...cells, formatCurrencyExact(total), formatCurrencyExact(avg)].join(";");
  }

  const lines: string[] = [header, ""];

  // Einnahmen
  lines.push("EINNAHMEN");
  for (const row of inflowRows) {
    lines.push(rowToCSV(row.counterpartyName, row.monthly, row.totalCents));
  }
  const inflowMonthly: Record<string, string> = {};
  for (const ms of monthlySummary) inflowMonthly[ms.month] = ms.inflowsCents;
  lines.push(rowToCSV("Summe Einnahmen", inflowMonthly, summary.totalInflowsCents));
  lines.push("");

  // Ausgaben
  lines.push("AUSGABEN");
  for (const row of outflowRows) {
    lines.push(rowToCSV(row.counterpartyName, row.monthly, row.totalCents));
  }
  const outflowMonthly: Record<string, string> = {};
  for (const ms of monthlySummary) outflowMonthly[ms.month] = ms.outflowsCents;
  lines.push(rowToCSV("Summe Ausgaben", outflowMonthly, summary.totalOutflowsCents));
  lines.push("");

  // Netto
  lines.push("NETTO");
  const nettoMonthly: Record<string, string> = {};
  for (const ms of monthlySummary) nettoMonthly[ms.month] = ms.netCents;
  lines.push(rowToCSV("Netto-Cashflow", nettoMonthly, summary.netCents));

  const csv = "\uFEFF" + lines.join("\n"); // BOM for Excel
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `geschaeftskonten-analyse-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
  const [locationFilter, setLocationFilter] = useState<string | null>(null);

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

  // === Gefilterte Daten nach Standort ===
  const filtered = useMemo(() => {
    if (!data) return null;
    if (!locationFilter) return data;

    // Counterparty-Rows auf Location filtern
    const filteredCpMonthly = data.counterpartyMonthly
      .map(row => {
        const locData = row.byLocation.find(l => l.locationId === locationFilter);
        if (!locData) return null;
        return {
          ...row,
          monthly: locData.monthly,
          totalCents: locData.totalCents,
          byLocation: [locData],
        };
      })
      .filter((r): r is CounterpartyRow => r !== null);

    // Monthly Summary neu berechnen
    const monthlySummary = data.summary.months.map(month => {
      let inflowsCents = 0;
      let outflowsCents = 0;
      let count = 0;
      for (const row of filteredCpMonthly) {
        const val = parseInt(row.monthly[month] || "0");
        if (val >= 0) inflowsCents += val;
        else outflowsCents += val;
        if (row.monthly[month]) count++;
      }
      return {
        month,
        inflowsCents: String(inflowsCents),
        outflowsCents: String(outflowsCents),
        netCents: String(inflowsCents + outflowsCents),
        count,
      };
    });

    // Summary neu berechnen
    let totalInflows = 0;
    let totalOutflows = 0;
    let totalCount = 0;
    for (const row of filteredCpMonthly) {
      const val = parseInt(row.totalCents);
      if (val >= 0) totalInflows += val;
      else totalOutflows += val;
      totalCount += row.matchCount;
    }
    const mc = data.summary.months.length || 1;

    return {
      ...data,
      summary: {
        ...data.summary,
        totalInflowsCents: String(totalInflows),
        totalOutflowsCents: String(totalOutflows),
        netCents: String(totalInflows + totalOutflows),
        avgMonthlyInflowsCents: String(Math.round(totalInflows / mc)),
        avgMonthlyOutflowsCents: String(Math.round(totalOutflows / mc)),
        totalCount,
        classifiedCount: totalCount,
      },
      counterpartyMonthly: filteredCpMonthly,
      monthlySummary,
    } satisfies VorinsolvenzData;
  }, [data, locationFilter]);

  // === Loading/Error states ===

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-500">Geschäftskonten-Analyse wird berechnet...</span>
      </div>
    );
  }

  if (error || !data || !filtered) {
    return (
      <div className="admin-card p-8 text-center">
        <p className="text-red-600">{error || "Keine Daten"}</p>
      </div>
    );
  }

  if (data.summary.totalCount === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Geschäftskonten-Analyse</h1>
        <div className="admin-card p-8 text-center">
          <p className="text-gray-500">Keine Daten auf Geschäftskonten vorhanden.</p>
        </div>
      </div>
    );
  }

  // === Derived data (aus gefiltertem Datensatz) ===

  const { months } = filtered.summary;
  const insolvencyMonth = filtered.insolvencyMonth;
  const firstMonth = formatMonthLong(months[0]);
  const lastMonth = formatMonthLong(months[months.length - 1]);
  const classRate = filtered.summary.totalCount > 0
    ? ((filtered.summary.classifiedCount / filtered.summary.totalCount) * 100).toFixed(0)
    : "0";
  const locationCount = data.locations.length;

  const inflowRows = filtered.counterpartyMonthly.filter(
    (r) => r.flowType === "INFLOW" || (r.flowType === "MIXED" && parseInt(r.totalCents) >= 0)
  );
  const outflowRows = filtered.counterpartyMonthly.filter(
    (r) => r.flowType === "OUTFLOW" || (r.flowType === "MIXED" && parseInt(r.totalCents) < 0)
  );

  const netCents = parseInt(filtered.summary.netCents);
  const monthCount = months.length || 1;
  const computeAvg = (total: string) => String(Math.round(parseInt(total) / monthCount));
  const activeLocationName = locationFilter
    ? data.locations.find(l => l.id === locationFilter)?.name || locationFilter
    : null;

  // === Render ===

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Geschäftskonten-Analyse
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {firstMonth} – {lastMonth} · {filtered.summary.totalCount.toLocaleString("de-DE")} Buchungen · {locationCount > 0 ? `${locationCount} Standorte · ` : ""}{months.length} Monate
            {locationFilter && <span className="text-orange-600 font-medium"> · Filter: {activeLocationName}</span>}
          </p>
        </div>

        {/* CSV Export Button */}
        <button
          onClick={() => exportCSV(months, inflowRows, outflowRows, filtered.monthlySummary, filtered.summary)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          CSV Export
        </button>
      </div>

      {/* Standort-Filter + KPI Cards */}
      <div className="space-y-4">
        {/* Standort-Filter */}
        {data.locations.length > 1 && (
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            <span className="px-2 text-xs font-medium text-gray-500">Standort:</span>
            <button
              onClick={() => setLocationFilter(null)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                !locationFilter
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Alle
            </button>
            {data.locations.map(loc => (
              <button
                key={loc.id}
                onClick={() => setLocationFilter(loc.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  locationFilter === loc.id
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {loc.name}
              </button>
            ))}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="admin-card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Einnahmen</p>
            <p className="text-xl font-bold text-green-600 mt-1">
              {formatCurrency(filtered.summary.totalInflowsCents)} €
            </p>
          </div>
          <div className="admin-card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Ausgaben</p>
            <p className="text-xl font-bold text-red-600 mt-1">
              {formatCurrency(filtered.summary.totalOutflowsCents)} €
            </p>
          </div>
          <div className="admin-card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Netto-Cashflow</p>
            <p className={`text-xl font-bold mt-1 ${netCents >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(filtered.summary.netCents)} €
            </p>
          </div>
          <div className="admin-card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Klassifiziert</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {classRate}%
            </p>
            <p className="text-xs text-gray-400">
              {filtered.summary.classifiedCount} / {filtered.summary.totalCount}
            </p>
          </div>
        </div>
      </div>

      {/* === Matrix Table === */}
      <div className="admin-card overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20">
              {/* Insolvenz-Label-Zeile */}
              {insolvencyMonth && months.includes(insolvencyMonth) && (
                <tr className="bg-white border-b border-gray-100">
                  <th className="sticky left-0 bg-white z-30"></th>
                  {months.map((m) => (
                    <th
                      key={m}
                      className={`px-2 py-1 text-center text-[10px] font-medium min-w-[80px] bg-white ${insolvencyBorderClass(m, insolvencyMonth)}`}
                    >
                      {insolvencyMonth && m < insolvencyMonth && (
                        <span className="text-gray-400">vor Insolvenz</span>
                      )}
                      {insolvencyMonth && m >= insolvencyMonth && (
                        <span className="text-orange-500">nach Eröffnung</span>
                      )}
                    </th>
                  ))}
                  <th className="bg-white"></th>
                  <th className="bg-white"></th>
                </tr>
              )}

              {/* Period Labels */}
              <tr className="border-b border-gray-300 bg-gray-50">
                <th className="px-4 py-2.5 text-left font-semibold text-gray-900 sticky left-0 bg-gray-50 z-30 min-w-[240px]">
                  Position
                </th>
                {months.map((m) => (
                  <th key={m} className={`px-2 py-2.5 text-right font-semibold text-gray-900 min-w-[80px] bg-gray-50 ${insolvencyBorderClass(m, insolvencyMonth)}`}>
                    {formatMonth(m)}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right font-semibold text-gray-900 min-w-[70px] border-l border-gray-300 bg-gray-50">
                  Gesamt
                </th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-400 min-w-[70px] border-l border-gray-200 bg-gray-50">
                  Ø/Mon
                </th>
              </tr>
            </thead>

            <tbody>
              {/* ===== BLOCK: EINNAHMEN ===== */}
              <tr className="bg-green-100/80">
                <td
                  colSpan={months.length + 3}
                  className="px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-green-800"
                >
                  Einnahmen ({inflowRows.length} Gegenparteien)
                </td>
              </tr>

              {inflowRows.map((row) => {
                const rowKey = `in-${row.counterpartyId || row.counterpartyName}`;
                const hasLocations = !locationFilter && row.byLocation.length > 1;
                const isExpanded = expandedRows.has(rowKey);

                return (
                  <RowWithLocations
                    key={rowKey}
                    row={row}
                    rowKey={rowKey}
                    months={months}
                    monthCount={monthCount}
                    hasLocations={hasLocations}
                    isExpanded={isExpanded}
                    onToggle={toggleRow}
                    colorClass="text-green-600"
                    bgClass="bg-white"
                    insolvencyMonth={insolvencyMonth}
                    showTrend
                  />
                );
              })}

              {/* Summe Einnahmen */}
              <SummaryRow
                label="Summe Einnahmen"
                months={months}
                monthCount={monthCount}
                monthlySummary={filtered.monthlySummary}
                valueKey="inflowsCents"
                totalCents={filtered.summary.totalInflowsCents}
                colorClass="text-green-600"
                bgClass="bg-green-50"
                borderClass="border-t-2 border-green-200"
                borderLClass="border-l border-green-200"
                insolvencyMonth={insolvencyMonth}
              />

              <tr className="h-3 bg-white"><td colSpan={months.length + 3}></td></tr>

              {/* ===== BLOCK: AUSGABEN ===== */}
              <tr className="bg-red-100/80">
                <td
                  colSpan={months.length + 3}
                  className="px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-red-800"
                >
                  Ausgaben ({outflowRows.length} Gegenparteien)
                </td>
              </tr>

              {outflowRows.map((row) => {
                const rowKey = `out-${row.counterpartyId || row.counterpartyName}`;
                const hasLocations = !locationFilter && row.byLocation.length > 1;
                const isExpanded = expandedRows.has(rowKey);

                return (
                  <RowWithLocations
                    key={rowKey}
                    row={row}
                    rowKey={rowKey}
                    months={months}
                    monthCount={monthCount}
                    hasLocations={hasLocations}
                    isExpanded={isExpanded}
                    onToggle={toggleRow}
                    colorClass="text-red-600"
                    bgClass="bg-white"
                    insolvencyMonth={insolvencyMonth}
                    showTrend
                  />
                );
              })}

              {/* Summe Ausgaben */}
              <SummaryRow
                label="Summe Ausgaben"
                months={months}
                monthCount={monthCount}
                monthlySummary={filtered.monthlySummary}
                valueKey="outflowsCents"
                totalCents={filtered.summary.totalOutflowsCents}
                colorClass="text-red-600"
                bgClass="bg-red-50"
                borderClass="border-t-2 border-red-200"
                borderLClass="border-l border-red-200"
                insolvencyMonth={insolvencyMonth}
              />

              <tr className="h-3 bg-white"><td colSpan={months.length + 3}></td></tr>

              {/* ===== BLOCK: NETTO ===== */}
              <tr className="bg-blue-100/80">
                <td
                  colSpan={months.length + 3}
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
                  const mData = filtered.monthlySummary.find((ms) => ms.month === m);
                  const net = mData ? parseInt(mData.netCents) : 0;
                  const avg = parseInt(filtered.summary.netCents) / monthCount;
                  const trend = trendIndicator(net, avg);
                  return (
                    <td
                      key={m}
                      className={`px-2 py-2.5 text-right tabular-nums ${
                        net >= 0 ? "text-green-700" : "text-red-700"
                      } ${insolvencyBorderClass(m, insolvencyMonth)}`}
                    >
                      {mData ? formatCompact(mData.netCents) : "–"}
                      {trend && <span className={`ml-0.5 text-[9px] ${trend.className}`}>{trend.symbol}</span>}
                    </td>
                  );
                })}
                <td
                  className={`px-3 py-2.5 text-right tabular-nums font-bold border-l border-blue-200 ${
                    netCents >= 0 ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {formatCompact(filtered.summary.netCents)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right tabular-nums border-l border-gray-200 text-xs ${
                    netCents >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCompact(computeAvg(filtered.summary.netCents))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex items-center justify-between flex-wrap gap-2">
          <span>Beträge in EUR (gerundet, K = Tausend) · nur Geschäftskonten (ohne ISK)</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="text-green-500 text-[9px]">▲</span>
              <span className="text-red-400 text-[9px]">▼</span>
              &gt;30% Abweichung vom Ø
            </span>
            {insolvencyMonth && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-0.5 bg-orange-400"></span>
                Insolvenzeröffnung
              </span>
            )}
          </div>
        </div>
      </div>

      {/* === Nicht zugeordnet === */}
      {filtered.unclassified.length > 0 && (
        <div className="admin-card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-amber-50">
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-800">
              Nicht zugeordnet ({filtered.unclassified.length} Buchungen)
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
                {filtered.unclassified.map((entry) => (
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

// === Sub-Component: Summary Row ===

function SummaryRow({
  label,
  months,
  monthCount,
  monthlySummary,
  valueKey,
  totalCents,
  colorClass,
  bgClass,
  borderClass,
  borderLClass,
  insolvencyMonth,
}: {
  label: string;
  months: string[];
  monthCount: number;
  monthlySummary: MonthlySummaryRow[];
  valueKey: "inflowsCents" | "outflowsCents";
  totalCents: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  borderLClass: string;
  insolvencyMonth: string | null;
}) {
  const avg = String(Math.round(parseInt(totalCents) / monthCount));
  const avgColorClass = colorClass.replace("600", "500");
  return (
    <tr className={`${bgClass} font-bold ${borderClass}`}>
      <td className={`px-4 py-2.5 sticky left-0 ${bgClass} z-10 ${colorClass.replace("text-", "text-").replace("600", "800")}`}>
        {label}
      </td>
      {months.map((m) => {
        const mData = monthlySummary.find((ms) => ms.month === m);
        return (
          <td key={m} className={`px-2 py-2.5 text-right tabular-nums ${colorClass} ${insolvencyBorderClass(m, insolvencyMonth)}`}>
            {mData ? formatCompact(mData[valueKey]) : "–"}
          </td>
        );
      })}
      <td className={`px-3 py-2.5 text-right tabular-nums font-bold ${colorClass} ${borderLClass}`}>
        {formatCompact(totalCents)}
      </td>
      <td className={`px-3 py-2.5 text-right tabular-nums ${avgColorClass} border-l border-gray-200 text-xs`}>
        {formatCompact(avg)}
      </td>
    </tr>
  );
}

// === Sub-Component: Row with Location Breakdown ===

function RowWithLocations({
  row,
  rowKey,
  months,
  monthCount,
  hasLocations,
  isExpanded,
  onToggle,
  colorClass,
  bgClass,
  insolvencyMonth,
  showTrend,
}: {
  row: CounterpartyRow;
  rowKey: string;
  months: string[];
  monthCount: number;
  hasLocations: boolean;
  isExpanded: boolean;
  onToggle: (key: string) => void;
  colorClass: string;
  bgClass: string;
  insolvencyMonth: string | null;
  showTrend: boolean;
}) {
  const avg = parseInt(row.totalCents) / monthCount;
  const avgStr = String(Math.round(avg));

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
          const numVal = val ? parseInt(val) : 0;
          const trend = showTrend && val ? trendIndicator(numVal, avg) : null;
          return (
            <td key={m} className={`px-2 py-2 text-right tabular-nums text-xs ${val ? "" : "text-gray-300"} ${insolvencyBorderClass(m, insolvencyMonth)}`}>
              {val ? formatCompact(val) : "–"}
              {trend && <span className={`ml-0.5 text-[9px] ${trend.className}`}>{trend.symbol}</span>}
            </td>
          );
        })}
        <td className={`px-3 py-2 text-right tabular-nums font-semibold ${colorClass} border-l border-gray-200`}>
          {formatCompact(row.totalCents)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-xs text-gray-400 border-l border-gray-200">
          {formatCompact(avgStr)}
        </td>
      </tr>

      {/* Location Children */}
      {isExpanded && row.byLocation.map((loc) => {
        const locAvg = String(Math.round(parseInt(loc.totalCents) / monthCount));
        return (
          <tr key={`${rowKey}-${loc.locationId}`} className="border-b border-gray-50 hover:bg-gray-50">
            <td className={`px-4 py-1.5 pl-12 sticky left-0 z-10 ${bgClass} text-gray-500 text-xs`}>
              davon {loc.locationName}
            </td>
            {months.map((m) => {
              const val = loc.monthly[m];
              return (
                <td key={m} className={`px-2 py-1.5 text-right tabular-nums text-xs ${val ? "text-gray-400" : "text-gray-300"} ${insolvencyBorderClass(m, insolvencyMonth)}`}>
                  {val ? formatCompact(val) : "–"}
                </td>
              );
            })}
            <td className="px-3 py-1.5 text-right tabular-nums text-xs text-gray-400 border-l border-gray-200">
              {formatCompact(loc.totalCents)}
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums text-xs text-gray-300 border-l border-gray-200">
              {formatCompact(locAvg)}
            </td>
          </tr>
        );
      })}
    </>
  );
}
