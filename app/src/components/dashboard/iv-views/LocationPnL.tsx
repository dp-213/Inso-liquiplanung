"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/types/dashboard";

interface LocationPnLData {
  locationId: string;
  locationName: string;
  address: string;
  periodStart: string;
  periodEnd: string;
  entryCount: number;
  revenues: {
    kv: { cents: string; count: number };
    hzv: { cents: string; count: number };
    pvs: { cents: string; count: number };
    other: { cents: string; count: number };
    total: string;
  };
  costs: {
    personnel: { cents: string; count: number };
    rent: { cents: string; count: number };
    utilities: { cents: string; count: number };
    other: { cents: string; count: number };
    total: string;
  };
  netResult: string;
  isViable: boolean;
  personnelChanges: {
    type: "ADD" | "REMOVE";
    description: string;
    monthlyImpactCents: string;
    status: string;
  }[];
}

interface LocationPnLProps {
  caseId: string;
  locationId: string;
  onClose?: () => void;
}

/**
 * LocationPnL - Praxis-Einzelbewertung
 *
 * Beantwortet die IV-Frage: "Können wir diesen Standort alleine weiterführen?"
 *
 * Zeigt:
 * - Einnahmen nach Quelle (KV/HZV/PVS)
 * - Kosten nach Kategorie (Personal/Miete/Sonstige)
 * - Netto-Ergebnis und Tragfähigkeit
 * - Geplante Personaländerungen und deren Auswirkung
 */
export default function LocationPnL({ caseId, locationId, onClose }: LocationPnLProps) {
  const [data, setData] = useState<LocationPnLData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`/api/cases/${caseId}/dashboard/locations/${locationId}`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("Fehler beim Laden der Standort-Daten");
        }
        const locationData = await res.json();
        setData(locationData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [caseId, locationId]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="admin-card p-6">
        <div className="text-red-600">{error || "Keine Daten verfügbar"}</div>
      </div>
    );
  }

  const netResult = BigInt(data.netResult);
  const totalRevenue = BigInt(data.revenues.total);
  const totalCosts = BigInt(data.costs.total);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">
              Praxis {data.locationName}
            </h2>
            {data.address && (
              <p className="text-sm text-[var(--secondary)] mt-1">{data.address}</p>
            )}
            <p className="text-xs text-[var(--muted)] mt-2">
              Zeitraum: {new Date(data.periodStart).toLocaleDateString("de-DE")} –{" "}
              {new Date(data.periodEnd).toLocaleDateString("de-DE")}
              {" "}({data.entryCount} Buchungen)
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Question Banner */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 font-medium">
            📋 Frage: Können wir {data.locationName} alleine weiterführen?
          </p>
        </div>
      </div>

      {/* Revenue Section */}
      <div className="admin-card p-6">
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Einnahmen
        </h3>
        <div className="space-y-3">
          {/* KV */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-700 font-bold text-sm">KV</span>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Kassenärztliche Vereinigung</p>
                <p className="text-xs text-[var(--muted)]">{data.revenues.kv.count} Buchungen</p>
              </div>
            </div>
            <span className="text-lg font-bold text-green-600">
              {formatCurrency(data.revenues.kv.cents)}
            </span>
          </div>

          {/* HZV */}
          <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <span className="text-purple-700 font-bold text-sm">HZV</span>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Hausarztzentrierte Versorgung</p>
                <p className="text-xs text-[var(--muted)]">{data.revenues.hzv.count} Buchungen</p>
              </div>
            </div>
            <span className="text-lg font-bold text-green-600">
              {formatCurrency(data.revenues.hzv.cents)}
            </span>
          </div>

          {/* PVS */}
          <div className="flex items-center justify-between p-3 bg-pink-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
                <span className="text-pink-700 font-bold text-sm">PVS</span>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Privatärztliche Verrechnungsstelle</p>
                <p className="text-xs text-[var(--muted)]">{data.revenues.pvs.count} Buchungen</p>
              </div>
            </div>
            <span className="text-lg font-bold text-green-600">
              {formatCurrency(data.revenues.pvs.cents)}
            </span>
          </div>

          {/* Other Revenue */}
          {BigInt(data.revenues.other.cents) > BigInt(0) && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-600 font-bold text-sm">+</span>
                </div>
                <div>
                  <p className="font-medium text-[var(--foreground)]">Sonstige Einnahmen</p>
                  <p className="text-xs text-[var(--muted)]">{data.revenues.other.count} Buchungen</p>
                </div>
              </div>
              <span className="text-lg font-bold text-green-600">
                {formatCurrency(data.revenues.other.cents)}
              </span>
            </div>
          )}

          {/* Total Revenue */}
          <div className="flex items-center justify-between p-3 bg-green-100 rounded-lg mt-2">
            <span className="font-semibold text-green-800">Summe Einnahmen</span>
            <span className="text-xl font-bold text-green-700">
              {formatCurrency(data.revenues.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Costs Section */}
      <div className="admin-card p-6">
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Kosten
        </h3>
        <div className="space-y-3">
          {/* Personnel */}
          <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Personal</p>
                <p className="text-xs text-[var(--muted)]">{data.costs.personnel.count} Buchungen</p>
              </div>
            </div>
            <span className="text-lg font-bold text-red-600">
              -{formatCurrency(data.costs.personnel.cents)}
            </span>
          </div>

          {/* Rent */}
          <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Miete</p>
                <p className="text-xs text-[var(--muted)]">{data.costs.rent.count} Buchungen</p>
              </div>
            </div>
            <span className="text-lg font-bold text-red-600">
              -{formatCurrency(data.costs.rent.cents)}
            </span>
          </div>

          {/* Utilities */}
          {BigInt(data.costs.utilities.cents) > BigInt(0) && (
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-[var(--foreground)]">Energie & Nebenkosten</p>
                  <p className="text-xs text-[var(--muted)]">{data.costs.utilities.count} Buchungen</p>
                </div>
              </div>
              <span className="text-lg font-bold text-red-600">
                -{formatCurrency(data.costs.utilities.cents)}
              </span>
            </div>
          )}

          {/* Other Costs */}
          {BigInt(data.costs.other.cents) > BigInt(0) && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-600 font-bold text-sm">−</span>
                </div>
                <div>
                  <p className="font-medium text-[var(--foreground)]">Sonstige Kosten</p>
                  <p className="text-xs text-[var(--muted)]">{data.costs.other.count} Buchungen</p>
                </div>
              </div>
              <span className="text-lg font-bold text-red-600">
                -{formatCurrency(data.costs.other.cents)}
              </span>
            </div>
          )}

          {/* Total Costs */}
          <div className="flex items-center justify-between p-3 bg-red-100 rounded-lg mt-2">
            <span className="font-semibold text-red-800">Summe Kosten</span>
            <span className="text-xl font-bold text-red-700">
              -{formatCurrency(data.costs.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Result Section */}
      <div className={`admin-card p-6 ${data.isViable ? "bg-green-50 border-2 border-green-300" : "bg-red-50 border-2 border-red-300"}`}>
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Ergebnis
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[var(--secondary)]">Netto-Ergebnis</p>
            <p className={`text-3xl font-bold ${data.isViable ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(data.netResult)}
            </p>
          </div>
          <div className={`px-4 py-2 rounded-lg ${data.isViable ? "bg-green-200 text-green-800" : "bg-red-200 text-red-800"}`}>
            {data.isViable ? (
              <span className="flex items-center gap-2 font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Trägt sich selbst
              </span>
            ) : (
              <span className="flex items-center gap-2 font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Defizitär
              </span>
            )}
          </div>
        </div>

        {/* Margin calculation */}
        {totalRevenue > BigInt(0) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-[var(--secondary)]">
              Marge: {((Number(netResult) / Number(totalRevenue)) * 100).toFixed(1)}% der Einnahmen
            </p>
          </div>
        )}
      </div>

      {/* Personnel Changes (if any) */}
      {data.personnelChanges.length > 0 && (
        <div className="admin-card p-6">
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
            Geplante Personaländerungen
          </h3>
          <div className="space-y-3">
            {data.personnelChanges.map((change, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg ${change.type === "ADD" ? "bg-blue-50" : "bg-amber-50"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={change.type === "ADD" ? "text-blue-600" : "text-amber-600"}>
                      {change.type === "ADD" ? "+" : "−"}
                    </span>
                    <span className="font-medium">{change.description}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      change.status === "CONFIRMED" ? "bg-green-100 text-green-700" :
                      change.status === "PLANNED" ? "bg-blue-100 text-blue-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {change.status === "CONFIRMED" ? "Bestätigt" :
                       change.status === "PLANNED" ? "Geplant" : "Unsicher"}
                    </span>
                  </div>
                  <span className={`font-bold ${change.type === "ADD" ? "text-red-600" : "text-green-600"}`}>
                    {change.type === "ADD" ? "-" : "+"}{formatCurrency(change.monthlyImpactCents)}/Monat
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Placeholder for personnel changes */}
      {data.personnelChanges.length === 0 && (
        <div className="admin-card p-4 bg-gray-50">
          <p className="text-sm text-[var(--muted)] text-center">
            💡 Geplante Personaländerungen können in der Standort-Verwaltung hinterlegt werden.
          </p>
        </div>
      )}
    </div>
  );
}
