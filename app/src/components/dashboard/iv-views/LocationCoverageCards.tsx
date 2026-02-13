"use client";

import { formatCurrency } from "@/types/dashboard";

export interface LocationCompareItem {
  id: string;
  name: string;
  shortName: string | null;
  totals: {
    revenueCents: string;
    costsCents: string;
    netCents: string;
    coverageBps: number;
    entryCount: number;
  };
  revenue: { kv: string; hzv: string; pvs: string; other: string };
  costs: { personal: string; betriebskosten: string; other: string };
  months: Record<string, MonthData>;
  employees: { total: number; doctors: number };
}

export interface MonthData {
  revenueCents: string;
  costsCents: string;
  netCents: string;
  coverageBps: number;
  revenue: { kv: string; hzv: string; pvs: string; other: string };
  costs: { personal: string; betriebskosten: string; other: string };
}

export interface LocationCompareResponse {
  locations: LocationCompareItem[];
  unassigned: { count: number; totalCents: string };
  monthLabels: string[];
  estateFilter: string;
}

function coverageColor(bps: number): { bg: string; text: string; bar: string } {
  if (bps >= 10000) return { bg: "bg-green-50", text: "text-green-700", bar: "bg-green-500" };
  if (bps >= 7000) return { bg: "bg-yellow-50", text: "text-yellow-700", bar: "bg-yellow-500" };
  if (bps >= 4000) return { bg: "bg-orange-50", text: "text-orange-700", bar: "bg-orange-500" };
  return { bg: "bg-red-50", text: "text-red-700", bar: "bg-red-500" };
}

function formatBps(bps: number): string {
  return (bps / 100).toFixed(1).replace(".", ",") + " %";
}

interface LocationCoverageCardsProps {
  data: LocationCompareResponse;
  monthCount: number;
}

export default function LocationCoverageCards({ data, monthCount }: LocationCoverageCardsProps) {
  // Filter out locations with 0 entries
  const activeLocations = data.locations.filter((l) => l.totals.entryCount > 0);

  if (activeLocations.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {activeLocations.map((loc) => {
        const bps = loc.totals.coverageBps;
        const colors = coverageColor(bps);
        const barWidth = Math.min(bps / 100, 100); // cap at 100%
        const netCents = BigInt(loc.totals.netCents);
        const monthlyDeficit = monthCount > 0 ? netCents / BigInt(monthCount) : 0n;

        return (
          <div key={loc.id} className={`admin-card p-5 ${colors.bg} border`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[var(--foreground)]">
                {loc.shortName || loc.name}
              </h3>
              <span className={`text-2xl font-bold ${colors.text}`}>
                {formatBps(bps)}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
              <div
                className={`h-3 rounded-full transition-all ${colors.bar}`}
                style={{ width: `${barWidth}%` }}
              />
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--secondary)]">Einnahmen</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(loc.totals.revenueCents)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--secondary)]">Kosten</span>
                <span className="font-medium text-red-600">
                  -{formatCurrency(loc.totals.costsCents)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-200">
                <span className="text-[var(--secondary)]">Netto gesamt</span>
                <span className={`font-bold ${netCents >= 0n ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(loc.totals.netCents)}
                </span>
              </div>
              {monthCount > 0 && netCents < 0n && (
                <div className="flex justify-between">
                  <span className="text-[var(--secondary)]">Fehlbetrag/Monat</span>
                  <span className="font-medium text-red-600">
                    {formatCurrency(monthlyDeficit.toString())}
                  </span>
                </div>
              )}
              {(loc.employees.total > 0) && (
                <div className="flex justify-between pt-1 border-t border-gray-200">
                  <span className="text-[var(--secondary)]">Mitarbeiter</span>
                  <span className="font-medium text-[var(--foreground)]">
                    {loc.employees.total} ({loc.employees.doctors} {loc.employees.doctors === 1 ? "Arzt" : "Ärzte"})
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
