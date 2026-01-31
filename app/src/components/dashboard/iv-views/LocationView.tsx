"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/types/dashboard";
import LocationPnL from "./LocationPnL";

type EstateFilter = "GESAMT" | "ALTMASSE" | "NEUMASSE" | "UNKLAR";

interface EstateBreakdown {
  inflowsCents: string;
  outflowsCents: string;
  netCents: string;
  count: number;
  isViable: boolean;
}

interface LocationSummary {
  id: string;
  name: string;
  address: string | null;
  inflowsCents: string;
  outflowsCents: string;
  netCents: string;
  entryCount: number;
  isViable: boolean;
  estateBreakdown: {
    ALTMASSE: EstateBreakdown;
    NEUMASSE: EstateBreakdown;
    UNKLAR: EstateBreakdown;
  };
}

interface LocationViewProps {
  caseId: string;
}

/**
 * LocationView - Standort-Übersicht
 *
 * Zeigt alle Standorte mit deren P&L-Kennzahlen.
 * Ermöglicht Drill-Down in einzelne Standorte.
 */
export default function LocationView({ caseId }: LocationViewProps) {
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [estateFilter, setEstateFilter] = useState<EstateFilter>("GESAMT");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ estateFilter });
      const res = await fetch(`/api/cases/${caseId}/dashboard/locations?${params}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Fehler beim Laden der Standort-Daten");
      }
      const data = await res.json();
      setLocations(data.locations || []);
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
        {[1, 2, 3].map((i) => (
          <div key={i} className="admin-card p-4">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
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

  // Show LocationPnL if a location is selected
  if (selectedLocation) {
    return (
      <LocationPnL
        caseId={caseId}
        locationId={selectedLocation}
        onClose={() => setSelectedLocation(null)}
      />
    );
  }

  if (locations.length === 0) {
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

  // Summary stats
  const totalInflows = locations.reduce((sum, l) => sum + BigInt(l.inflowsCents), BigInt(0));
  const totalOutflows = locations.reduce((sum, l) => sum + BigInt(l.outflowsCents), BigInt(0));
  const totalNet = totalInflows - totalOutflows;
  const viableCount = locations.filter((l) => l.isViable).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Standorte</div>
          <div className="text-2xl font-bold text-[var(--foreground)]">{locations.length}</div>
          <div className="text-xs text-[var(--muted)]">
            insgesamt
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Gesamt-Einnahmen</div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(totalInflows.toString())}
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Gesamt-Kosten</div>
          <div className="text-2xl font-bold text-red-600">
            -{formatCurrency(totalOutflows.toString())}
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Tragfähig</div>
          <div className="text-2xl font-bold text-[var(--foreground)]">
            {viableCount} / {locations.length}
          </div>
          <div className="text-xs text-[var(--muted)]">
            {viableCount === locations.length ? "Alle tragfähig" : `${locations.length - viableCount} defizitär`}
          </div>
        </div>
      </div>

      {/* Location List */}
      <div className="admin-card">
        <div className="px-6 py-4 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Standort-Übersicht</h2>

          {/* Estate Filter Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(["GESAMT", "ALTMASSE", "NEUMASSE", "UNKLAR"] as EstateFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setEstateFilter(filter)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  estateFilter === filter
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {filter === "GESAMT" ? "Gesamt" : filter === "ALTMASSE" ? "Altmasse" : filter === "NEUMASSE" ? "Neumasse" : "Unklar"}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {locations.map((location) => {
            const netCents = BigInt(location.netCents);

            return (
              <button
                key={location.id}
                onClick={() => setSelectedLocation(location.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    location.isViable ? "bg-green-100" : "bg-red-100"
                  }`}>
                    {location.isViable ? (
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <span className="font-semibold text-[var(--foreground)]">{location.name}</span>
                    {location.address && (
                      <p className="text-sm text-[var(--secondary)]">{location.address}</p>
                    )}
                    <p className="text-xs text-[var(--muted)]">{location.entryCount} Buchungen</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-sm text-[var(--secondary)]">Einnahmen</div>
                    <div className="font-medium text-green-600">
                      {formatCurrency(location.inflowsCents)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-[var(--secondary)]">Kosten</div>
                    <div className="font-medium text-red-600">
                      -{formatCurrency(location.outflowsCents)}
                    </div>
                  </div>
                  <div className="text-right min-w-[100px]">
                    <div className="text-sm text-[var(--secondary)]">Netto</div>
                    <div className={`text-lg font-bold ${
                      netCents >= BigInt(0) ? "text-green-600" : "text-red-600"
                    }`}>
                      {formatCurrency(location.netCents)}
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Estate Filter Info */}
      {estateFilter !== "GESAMT" && (
        <div className="admin-card p-4 bg-amber-50 border border-amber-200">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-medium text-amber-800">
                {estateFilter === "ALTMASSE" && "Nur Altmasse-Buchungen"}
                {estateFilter === "NEUMASSE" && "Nur Neumasse-Buchungen"}
                {estateFilter === "UNKLAR" && "Nur unklare Buchungen"}
              </h4>
              <p className="text-sm text-amber-700 mt-1">
                {estateFilter === "ALTMASSE" && "Zeigt nur Buchungen aus der Zeit vor der Insolvenzeröffnung (Leistungsdatum vor Stichtag)."}
                {estateFilter === "NEUMASSE" && "Zeigt nur Buchungen aus der Zeit nach der Insolvenzeröffnung (Leistungsdatum nach Stichtag)."}
                {estateFilter === "UNKLAR" && "Zeigt Buchungen ohne klare Alt/Neu-Zuordnung. Diese sollten manuell geprüft werden."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="admin-card p-4 bg-blue-50 border border-blue-200">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="font-medium text-blue-800">Standort-Einzelbewertung</h4>
            <p className="text-sm text-blue-700 mt-1">
              Klicken Sie auf einen Standort, um die detaillierte Einnahmen-/Kostenstruktur zu sehen.
              Dies beantwortet die Frage: &quot;Kann dieser Standort alleine weitergeführt werden?&quot;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
