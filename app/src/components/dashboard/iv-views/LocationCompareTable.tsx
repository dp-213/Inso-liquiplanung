"use client";

import { formatCurrency } from "@/types/dashboard";
import type { LocationCompareResponse } from "./location-compare-types";

function coverageColorClass(bps: number): string {
  if (bps >= 10000) return "text-green-600";
  if (bps >= 7000) return "text-yellow-600";
  if (bps >= 4000) return "text-orange-600";
  return "text-red-600";
}

function formatBps(bps: number): string {
  return (bps / 100).toFixed(1).replace(".", ",") + " %";
}

interface LocationCompareTableProps {
  data: LocationCompareResponse;
  onSelectLocation: (locationId: string) => void;
  viewMode: "total" | "average";
}

export default function LocationCompareTable({ data, onSelectLocation, viewMode }: LocationCompareTableProps) {
  const locations = data.locations;
  if (locations.length === 0) return null;

  const monthCount = data.monthLabels.length;
  const isAvg = viewMode === "average" && monthCount > 0;

  /** Wert durch Monatsanzahl teilen wenn Durchschnittsmodus */
  const av = (cents: string | bigint): bigint => {
    const val = typeof cents === "bigint" ? cents : BigInt(cents);
    return isAvg ? val / BigInt(monthCount) : val;
  };

  // Compute GESAMT column
  const gesamt = {
    revenue: {
      kv: locations.reduce((s, l) => s + BigInt(l.revenue.kv), 0n),
      hzv: locations.reduce((s, l) => s + BigInt(l.revenue.hzv), 0n),
      pvs: locations.reduce((s, l) => s + BigInt(l.revenue.pvs), 0n),
      other: locations.reduce((s, l) => s + BigInt(l.revenue.other), 0n),
    },
    costs: {
      personal: locations.reduce((s, l) => s + BigInt(l.costs.personal), 0n),
      betriebskosten: locations.reduce((s, l) => s + BigInt(l.costs.betriebskosten), 0n),
      other: locations.reduce((s, l) => s + BigInt(l.costs.other), 0n),
    },
    totalRevenue: locations.reduce((s, l) => s + BigInt(l.totals.revenueCents), 0n),
    totalCosts: locations.reduce((s, l) => s + BigInt(l.totals.costsCents), 0n),
    employees: {
      total: locations.reduce((s, l) => s + l.employees.total, 0),
      doctors: locations.reduce((s, l) => s + l.employees.doctors, 0),
    },
  };
  const gesamtNet = gesamt.totalRevenue - gesamt.totalCosts;
  // Deckungsgrad ist ein Verhältnis - unabhängig von total/average
  const gesamtCoverageBps = gesamt.totalCosts > 0n
    ? Number((gesamt.totalRevenue * 10000n) / gesamt.totalCosts)
    : gesamt.totalRevenue > 0n ? 10000 : 0;

  const CurrencyCell = ({ cents, color }: { cents: bigint; color?: string }) => (
    <td className={`px-3 py-1.5 text-right tabular-nums text-sm ${color || ""}`}>
      {cents !== 0n ? formatCurrency(cents.toString()) : "--"}
    </td>
  );

  const HeaderCell = ({ children }: { children: React.ReactNode }) => (
    <th className="px-3 py-2 text-right text-xs font-semibold text-[var(--secondary)] uppercase tracking-wide">
      {children}
    </th>
  );

  const LabelCell = ({ children, bold }: { children: React.ReactNode; bold?: boolean }) => (
    <td className={`px-3 py-1.5 text-sm ${bold ? "font-semibold text-[var(--foreground)]" : "text-[var(--secondary)] pl-6"}`}>
      {children}
    </td>
  );

  const SeparatorRow = () => (
    <tr>
      <td colSpan={locations.length + 2} className="py-1">
        <div className="border-t border-[var(--border)]" />
      </td>
    </tr>
  );

  return (
    <div className="admin-card overflow-x-auto">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="px-3 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase tracking-wide w-[180px]">
              {isAvg ? "Ø Monat" : "Gesamt"}
            </th>
            {locations.map((loc) => (
              <th key={loc.id} className="px-3 py-3 text-right">
                <button
                  onClick={() => onSelectLocation(loc.id)}
                  className="text-xs font-semibold text-[var(--primary)] hover:underline uppercase tracking-wide"
                >
                  {loc.shortName || loc.name}
                </button>
              </th>
            ))}
            <HeaderCell>Gesamt</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {/* === EINNAHMEN === */}
          <tr className="bg-green-50/50">
            <LabelCell bold>Einnahmen</LabelCell>
            {locations.map((l) => <td key={l.id} />)}
            <td />
          </tr>
          <tr>
            <LabelCell>KV</LabelCell>
            {locations.map((l) => (
              <CurrencyCell key={l.id} cents={av(l.revenue.kv)} color="text-green-700" />
            ))}
            <CurrencyCell cents={av(gesamt.revenue.kv)} color="text-green-700" />
          </tr>
          <tr>
            <LabelCell>HZV</LabelCell>
            {locations.map((l) => (
              <CurrencyCell key={l.id} cents={av(l.revenue.hzv)} color="text-green-700" />
            ))}
            <CurrencyCell cents={av(gesamt.revenue.hzv)} color="text-green-700" />
          </tr>
          <tr>
            <LabelCell>PVS</LabelCell>
            {locations.map((l) => (
              <CurrencyCell key={l.id} cents={av(l.revenue.pvs)} color="text-green-700" />
            ))}
            <CurrencyCell cents={av(gesamt.revenue.pvs)} color="text-green-700" />
          </tr>
          {gesamt.revenue.other > 0n && (
            <tr>
              <LabelCell>Sonstige</LabelCell>
              {locations.map((l) => (
                <CurrencyCell key={l.id} cents={av(l.revenue.other)} color="text-green-700" />
              ))}
              <CurrencyCell cents={av(gesamt.revenue.other)} color="text-green-700" />
            </tr>
          )}
          <tr className="bg-green-50/70 font-semibold">
            <LabelCell bold>Summe Einnahmen</LabelCell>
            {locations.map((l) => (
              <CurrencyCell key={l.id} cents={av(l.totals.revenueCents)} color="text-green-700" />
            ))}
            <CurrencyCell cents={av(gesamt.totalRevenue)} color="text-green-700" />
          </tr>

          <SeparatorRow />

          {/* === KOSTEN === */}
          <tr className="bg-red-50/50">
            <LabelCell bold>Kosten</LabelCell>
            {locations.map((l) => <td key={l.id} />)}
            <td />
          </tr>
          <tr>
            <LabelCell>Personal</LabelCell>
            {locations.map((l) => (
              <CurrencyCell key={l.id} cents={av(l.costs.personal)} color="text-red-600" />
            ))}
            <CurrencyCell cents={av(gesamt.costs.personal)} color="text-red-600" />
          </tr>
          <tr>
            <LabelCell>Betriebskosten</LabelCell>
            {locations.map((l) => (
              <CurrencyCell key={l.id} cents={av(l.costs.betriebskosten)} color="text-red-600" />
            ))}
            <CurrencyCell cents={av(gesamt.costs.betriebskosten)} color="text-red-600" />
          </tr>
          {gesamt.costs.other > 0n && (
            <tr>
              <LabelCell>Sonstige</LabelCell>
              {locations.map((l) => (
                <CurrencyCell key={l.id} cents={av(l.costs.other)} color="text-red-600" />
              ))}
              <CurrencyCell cents={av(gesamt.costs.other)} color="text-red-600" />
            </tr>
          )}
          <tr className="bg-red-50/70 font-semibold">
            <LabelCell bold>Summe Kosten</LabelCell>
            {locations.map((l) => (
              <CurrencyCell key={l.id} cents={-av(l.totals.costsCents)} color="text-red-600" />
            ))}
            <CurrencyCell cents={-av(gesamt.totalCosts)} color="text-red-600" />
          </tr>

          <SeparatorRow />

          {/* === ERGEBNIS === */}
          <tr className="font-bold">
            <LabelCell bold>Netto</LabelCell>
            {locations.map((l) => {
              const net = av(l.totals.netCents);
              return (
                <CurrencyCell
                  key={l.id}
                  cents={net}
                  color={net >= 0n ? "text-green-700 font-bold" : "text-red-600 font-bold"}
                />
              );
            })}
            {(() => {
              const net = av(gesamtNet);
              return (
                <CurrencyCell
                  cents={net}
                  color={net >= 0n ? "text-green-700 font-bold" : "text-red-600 font-bold"}
                />
              );
            })()}
          </tr>
          <tr>
            <LabelCell bold>Deckungsgrad</LabelCell>
            {locations.map((l) => (
              <td key={l.id} className={`px-3 py-1.5 text-right text-sm font-bold ${coverageColorClass(l.totals.coverageBps)}`}>
                {formatBps(l.totals.coverageBps)}
              </td>
            ))}
            <td className={`px-3 py-1.5 text-right text-sm font-bold ${coverageColorClass(gesamtCoverageBps)}`}>
              {formatBps(gesamtCoverageBps)}
            </td>
          </tr>

          <SeparatorRow />

          {/* === PERSONAL === */}
          {gesamt.employees.total > 0 && (
            <>
              <tr>
                <LabelCell>MA-Anzahl</LabelCell>
                {locations.map((l) => (
                  <td key={l.id} className="px-3 py-1.5 text-right text-sm text-[var(--foreground)]">
                    {l.employees.total || "--"}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right text-sm font-semibold text-[var(--foreground)]">
                  {gesamt.employees.total}
                </td>
              </tr>
              <tr>
                <LabelCell>davon Ärzte</LabelCell>
                {locations.map((l) => (
                  <td key={l.id} className="px-3 py-1.5 text-right text-sm text-[var(--foreground)]">
                    {l.employees.doctors || "--"}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right text-sm font-semibold text-[var(--foreground)]">
                  {gesamt.employees.doctors}
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
