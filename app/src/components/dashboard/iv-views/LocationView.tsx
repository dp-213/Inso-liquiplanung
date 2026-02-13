"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import LocationPnL from "./LocationPnL";
import { formatCurrency } from "@/types/dashboard";
import LocationCoverageCards from "./LocationCoverageCards";
import LocationCompareTable from "./LocationCompareTable";
import LocationMonthlyTrend from "./LocationMonthlyTrend";
import type {
  LocationCompareResponse,
  LocationCompareItem,
  MonthData,
} from "./location-compare-types";

type EstateFilter = "NEUMASSE" | "ALTMASSE" | "GESAMT";
type ViewMode = "total" | "average";

interface LocationViewProps {
  caseId: string;
}

// =============================================================================
// Standort-Gruppierung (Merge-Konfiguration)
// =============================================================================

interface MergeGroup {
  patterns: string[]; // shortName/name muss eines davon enthalten
  displayName: string;
  displayShortName: string;
}

/** Standorte die zusammengefasst dargestellt werden */
const LOCATION_MERGE_GROUPS: MergeGroup[] = [
  {
    patterns: ["Uckerath", "Eitorf"],
    displayName: "Praxis Uckerath/Eitorf",
    displayShortName: "Uckerath/Eitorf",
  },
];

function matchesGroup(loc: LocationCompareItem, group: MergeGroup): boolean {
  const label = loc.shortName || loc.name;
  return group.patterns.some((p) => label.includes(p));
}

function addRevenue(
  a: MonthData["revenue"],
  b: MonthData["revenue"],
): MonthData["revenue"] {
  return {
    kv: (BigInt(a.kv) + BigInt(b.kv)).toString(),
    hzv: (BigInt(a.hzv) + BigInt(b.hzv)).toString(),
    pvs: (BigInt(a.pvs) + BigInt(b.pvs)).toString(),
    other: (BigInt(a.other) + BigInt(b.other)).toString(),
  };
}

function addCosts(
  a: MonthData["costs"],
  b: MonthData["costs"],
): MonthData["costs"] {
  return {
    personal: (BigInt(a.personal) + BigInt(b.personal)).toString(),
    betriebskosten: (BigInt(a.betriebskosten) + BigInt(b.betriebskosten)).toString(),
    other: (BigInt(a.other) + BigInt(b.other)).toString(),
  };
}

function coverageBps(revCents: bigint, costCents: bigint): number {
  if (costCents === 0n) return revCents > 0n ? 10000 : 0;
  return Number((revCents * 10000n) / costCents);
}

function mergeItems(
  items: LocationCompareItem[],
  name: string,
  shortName: string,
): LocationCompareItem {
  const zero = { kv: "0", hzv: "0", pvs: "0", other: "0" };
  const zeroCosts = { personal: "0", betriebskosten: "0", other: "0" };

  let totalRev = 0n;
  let totalCost = 0n;
  let entryCount = 0;
  let revenue = { ...zero };
  let costs = { ...zeroCosts };
  let employees = { total: 0, doctors: 0 };

  for (const item of items) {
    totalRev += BigInt(item.totals.revenueCents);
    totalCost += BigInt(item.totals.costsCents);
    entryCount += item.totals.entryCount;
    revenue = addRevenue(revenue, item.revenue);
    costs = addCosts(costs, item.costs);
    employees.total += item.employees.total;
    employees.doctors += item.employees.doctors;
  }

  // Merge monthly data
  const allMonths = new Set<string>();
  for (const item of items) {
    for (const ym of Object.keys(item.months)) allMonths.add(ym);
  }

  const months: Record<string, MonthData> = {};
  for (const ym of allMonths) {
    let mRev = { ...zero };
    let mCost = { ...zeroCosts };
    for (const item of items) {
      const m = item.months[ym];
      if (m) {
        mRev = addRevenue(mRev, m.revenue);
        mCost = addCosts(mCost, m.costs);
      }
    }
    const mRevTotal = BigInt(mRev.kv) + BigInt(mRev.hzv) + BigInt(mRev.pvs) + BigInt(mRev.other);
    const mCostTotal = BigInt(mCost.personal) + BigInt(mCost.betriebskosten) + BigInt(mCost.other);
    months[ym] = {
      revenueCents: mRevTotal.toString(),
      costsCents: mCostTotal.toString(),
      netCents: (mRevTotal - mCostTotal).toString(),
      coverageBps: coverageBps(mRevTotal, mCostTotal),
      revenue: mRev,
      costs: mCost,
    };
  }

  return {
    id: items[0].id, // Drill-Down nutzt den primären Standort
    name,
    shortName,
    totals: {
      revenueCents: totalRev.toString(),
      costsCents: totalCost.toString(),
      netCents: (totalRev - totalCost).toString(),
      coverageBps: coverageBps(totalRev, totalCost),
      entryCount,
    },
    revenue,
    costs,
    months,
    employees,
  };
}

/** Fasst Standort-Gruppen zusammen, behält Reihenfolge */
function mergeLocationGroups(data: LocationCompareResponse): LocationCompareResponse {
  const result: LocationCompareItem[] = [];
  const mergedIds = new Set<string>();
  const insertedGroups = new Set<number>();

  // Bestimme welche IDs zu welcher Gruppe gehören
  const idToGroup = new Map<string, number>();
  for (const loc of data.locations) {
    for (let gi = 0; gi < LOCATION_MERGE_GROUPS.length; gi++) {
      if (matchesGroup(loc, LOCATION_MERGE_GROUPS[gi])) {
        idToGroup.set(loc.id, gi);
        break;
      }
    }
  }

  // Zähle Matches pro Gruppe - nur mergen wenn >1 Match
  const groupCounts = new Map<number, number>();
  for (const gi of idToGroup.values()) {
    groupCounts.set(gi, (groupCounts.get(gi) || 0) + 1);
  }

  for (const loc of data.locations) {
    const gi = idToGroup.get(loc.id);
    if (gi !== undefined && (groupCounts.get(gi) || 0) > 1) {
      // Gehört zu einer Merge-Gruppe
      if (!insertedGroups.has(gi)) {
        const group = LOCATION_MERGE_GROUPS[gi];
        const matching = data.locations.filter((l) => matchesGroup(l, group));
        result.push(mergeItems(matching, group.displayName, group.displayShortName));
        insertedGroups.add(gi);
      }
      mergedIds.add(loc.id);
    } else {
      result.push(loc);
    }
  }

  return { ...data, locations: result };
}

// =============================================================================
// LocationView Component
// =============================================================================

/**
 * LocationView - Standort-Vergleichsansicht
 *
 * Beantwortet die IV-Kernfrage: "Fortführung welcher Standorte ist wirtschaftlich vertretbar?"
 *
 * Sektionen:
 * A) Datenlücken-Banner (wenn relevant)
 * B) Deckungsgrad-Cards pro Standort
 * C) Vergleichstabelle (alle Standorte nebeneinander)
 * D) Monatliche Entwicklung pro Standort
 */
export default function LocationView({ caseId }: LocationViewProps) {
  const [rawData, setRawData] = useState<LocationCompareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [estateFilter, setEstateFilter] = useState<EstateFilter>("NEUMASSE");
  const [viewMode, setViewMode] = useState<ViewMode>("average");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ estateFilter });
      const res = await fetch(`/api/cases/${caseId}/dashboard/locations/compare?${params}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Fehler beim Laden der Standort-Daten");
      }
      const json = await res.json();
      setRawData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [caseId, estateFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Merge-Logik: Eitorf+Uckerath zusammenfassen
  const data = useMemo(() => {
    if (!rawData) return null;
    return mergeLocationGroups(rawData);
  }, [rawData]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="admin-card p-5 h-40 bg-gray-100" />
          ))}
        </div>
        <div className="admin-card p-4 h-64 bg-gray-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-card p-6">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  // Drill-Down in einzelnen Standort
  if (selectedLocation) {
    return (
      <LocationPnL
        caseId={caseId}
        locationId={selectedLocation}
        onClose={() => setSelectedLocation(null)}
      />
    );
  }

  if (!data || data.locations.length === 0) {
    return (
      <div className="admin-card p-6">
        <div className="text-center py-8">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-[var(--muted)]">Keine Standorte angelegt</p>
          <p className="text-sm text-[var(--secondary)] mt-1">
            Standorte können in der Dimensionen-Verwaltung angelegt werden.
          </p>
        </div>
      </div>
    );
  }

  const monthCount = data.monthLabels.length;

  return (
    <div className="space-y-6">
      {/* Header mit Filtern */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Standort-Vergleich</h2>
          <p className="text-sm text-[var(--secondary)]">
            Wirtschaftliche Tragfähigkeit pro Standort
            {viewMode === "average" && monthCount > 0 && (
              <span className="ml-1 text-[var(--muted)]">
                (Ø {monthCount} Monate)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Zeitraum-Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("average")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === "average"
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Ø Monat
            </button>
            <button
              onClick={() => setViewMode("total")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === "total"
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Gesamt
            </button>
          </div>
          {/* Estate-Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(["NEUMASSE", "ALTMASSE", "GESAMT"] as EstateFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setEstateFilter(filter)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  estateFilter === filter
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {filter === "NEUMASSE" ? "Neumasse" : filter === "ALTMASSE" ? "Altmasse" : "Gesamt"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sektion A: Datenlücken-Banner */}
      {data.unassigned.count > 0 && (
        <div className="admin-card p-4 bg-amber-50 border border-amber-200">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h4 className="font-medium text-amber-800">
                {data.unassigned.count} Buchung{data.unassigned.count !== 1 ? "en" : ""} ohne Standort-Zuordnung
              </h4>
              <p className="text-sm text-amber-700 mt-1">
                Summe: {formatCurrency(data.unassigned.totalCents)} &mdash; Diese Buchungen sind in der Vergleichstabelle nicht enthalten.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sektion B: Deckungsgrad-Cards */}
      <LocationCoverageCards data={data} monthCount={monthCount} viewMode={viewMode} />

      {/* Sektion C: Vergleichstabelle */}
      <LocationCompareTable
        data={data}
        onSelectLocation={setSelectedLocation}
        viewMode={viewMode}
      />

      {/* Sektion D: Monatliche Entwicklung */}
      {data.monthLabels.length > 1 && (
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Monatliche Entwicklung</h2>
          <LocationMonthlyTrend data={data} />
        </div>
      )}

      {/* Estate-Filter Info */}
      {estateFilter !== "GESAMT" && (
        <div className="admin-card p-4 bg-blue-50 border border-blue-200">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-medium text-blue-800">
                {estateFilter === "NEUMASSE" ? "Nur Neumasse-Buchungen" : "Nur Altmasse-Buchungen"}
              </h4>
              <p className="text-sm text-blue-700 mt-1">
                {estateFilter === "NEUMASSE"
                  ? "Zeigt nur Buchungen nach Insolvenzeröffnung (Fortführungsperspektive)."
                  : "Zeigt nur Buchungen aus der Zeit vor der Insolvenzeröffnung."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
