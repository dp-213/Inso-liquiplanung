"use client";

import { useState, useEffect, useCallback } from "react";
import LocationPnL from "./LocationPnL";
import LocationCoverageCards from "./LocationCoverageCards";
import LocationCompareTable from "./LocationCompareTable";
import LocationMonthlyTrend from "./LocationMonthlyTrend";
import type { LocationCompareResponse } from "./LocationCoverageCards";

type EstateFilter = "NEUMASSE" | "ALTMASSE" | "GESAMT";

interface LocationViewProps {
  caseId: string;
}

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
  const [data, setData] = useState<LocationCompareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [estateFilter, setEstateFilter] = useState<EstateFilter>("NEUMASSE");

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
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [caseId, estateFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  return (
    <div className="space-y-6">
      {/* Header mit Estate-Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Standort-Vergleich</h2>
          <p className="text-sm text-[var(--secondary)]">
            Wirtschaftliche Tragfähigkeit pro Standort
          </p>
        </div>
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
                Summe: {formatCurrencyInline(data.unassigned.totalCents)} &mdash; Diese Buchungen sind in der Vergleichstabelle nicht enthalten.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sektion B: Deckungsgrad-Cards */}
      <LocationCoverageCards data={data} monthCount={data.monthLabels.length} />

      {/* Sektion C: Vergleichstabelle */}
      <LocationCompareTable data={data} onSelectLocation={setSelectedLocation} />

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

function formatCurrencyInline(cents: string): string {
  const value = BigInt(cents);
  const euros = Number(value) / 100;
  return euros.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
