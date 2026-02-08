"use client";

import { LedgerStats } from "@/types/dashboard";

interface DataSourceLegendProps {
  ledgerStats: LedgerStats;
}

export default function DataSourceLegend({ ledgerStats }: DataSourceLegendProps) {
  const { dataSource, istCount, planCount, unreviewedCount, entryCount } = ledgerStats;

  // Berechne IST/PLAN-Quote
  const totalRelevant = istCount + planCount;
  const istQuote = totalRelevant > 0 ? (istCount / totalRelevant) * 100 : 0;
  const planQuote = 100 - istQuote;

  // Berechne ungeprüfte Quote
  const unreviewedQuote = entryCount > 0 ? (unreviewedCount / entryCount) * 100 : 0;

  // Qualitätsindikator
  const getQualityLevel = (): { label: string; color: string; bgColor: string } => {
    if (dataSource === "LEGACY") {
      return { label: "Legacy-Daten", color: "text-gray-700", bgColor: "bg-gray-100" };
    }
    if (unreviewedQuote > 20) {
      return { label: "Prüfung erforderlich", color: "text-amber-700", bgColor: "bg-amber-100" };
    }
    if (unreviewedQuote > 5) {
      return { label: "Teilweise geprüft", color: "text-blue-700", bgColor: "bg-blue-100" };
    }
    if (istQuote < 20) {
      return { label: "Überwiegend Planung", color: "text-blue-700", bgColor: "bg-blue-100" };
    }
    return { label: "Hohe Datenqualität", color: "text-green-700", bgColor: "bg-green-100" };
  };

  const quality = getQualityLevel();

  return (
    <div className="admin-card p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Datenherkunft</h3>
          <p className="text-sm text-[var(--secondary)] mt-1">
            {dataSource === "LEDGER"
              ? "Berechnungen basieren auf dem Zahlungsregister (LedgerEntry)"
              : "Berechnungen basieren auf legacy Plan-Struktur"}
          </p>
        </div>
        <span
          className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${quality.bgColor} ${quality.color}`}
        >
          {quality.label}
        </span>
      </div>

      {dataSource === "LEDGER" && (
        <div className="space-y-4">
          {/* IST/PLAN-Verteilung */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-medium text-[var(--foreground)]">IST/PLAN-Verteilung</span>
              <span className="text-xs text-[var(--secondary)]">
                {totalRelevant} {totalRelevant === 1 ? "Buchung" : "Buchungen"}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="flex h-3 rounded-full overflow-hidden bg-gray-200">
              <div
                className="bg-blue-600 transition-all"
                style={{ width: `${istQuote}%` }}
                title={`IST: ${istQuote.toFixed(1)}%`}
              />
              <div
                className="bg-purple-500 transition-all"
                style={{ width: `${planQuote}%` }}
                title={`PLAN: ${planQuote.toFixed(1)}%`}
              />
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-2 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-blue-600" />
                <span className="text-[var(--secondary)]">
                  IST: <strong className="text-[var(--foreground)]">{istCount}</strong> ({istQuote.toFixed(1)}%)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-purple-500" />
                <span className="text-[var(--secondary)]">
                  PLAN: <strong className="text-[var(--foreground)]">{planCount}</strong> ({planQuote.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Ungeprüfte Buchungen */}
          {unreviewedCount > 0 && (
            <div className="pt-4 border-t border-[var(--border)]">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span className="text-sm font-medium text-amber-800">
                  {unreviewedCount} ungeprüfte {unreviewedCount === 1 ? "Buchung" : "Buchungen"}
                </span>
                <span className="text-xs text-amber-700">({unreviewedQuote.toFixed(1)}%)</span>
              </div>
              <p className="text-xs text-amber-700">
                Diese Buchungen wurden noch nicht manuell bestätigt oder angepasst. Die automatische Klassifikation kann Fehler enthalten.
              </p>
            </div>
          )}

          {/* Alles geprüft - Success State */}
          {unreviewedCount === 0 && entryCount > 0 && (
            <div className="pt-4 border-t border-[var(--border)]">
              <div className="flex items-center gap-2 text-green-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm font-medium">Alle Buchungen geprüft</span>
              </div>
            </div>
          )}
        </div>
      )}

      {dataSource === "LEGACY" && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            Diese Planung verwendet noch das alte Datenmodell. Migrieren Sie zu LedgerEntries, um erweiterte Analyse-Funktionen zu nutzen.
          </p>
        </div>
      )}
    </div>
  );
}
