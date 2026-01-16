"use client";

interface KPICardsProps {
  currentCash: bigint;
  minCash: bigint;
  runwayWeek: string | null;
  formatCurrency: (cents: bigint) => string;
  periodType?: "WEEKLY" | "MONTHLY";
  periodCount?: number;
}

export default function KPICards({
  currentCash,
  minCash,
  runwayWeek,
  formatCurrency,
  periodType = "WEEKLY",
  periodCount = 13,
}: KPICardsProps) {
  const isNegativeMinCash = minCash < BigInt(0);
  const isNegativeCurrentCash = currentCash < BigInt(0);

  // Dynamische Beschriftung basierend auf Periodentyp
  const getFullPeriodLabel = (): string => {
    if (periodType === "MONTHLY") {
      return `${periodCount}+ Monate`;
    }
    return `${periodCount}+ Wochen`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Current Cash */}
      <div className="admin-card p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--secondary)]">Aktueller Bestand</p>
            <p className={`mt-2 text-2xl font-bold ${isNegativeCurrentCash ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>
              {formatCurrency(currentCash)}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isNegativeCurrentCash ? "bg-red-100" : "bg-blue-100"}`}>
            <svg className={`w-5 h-5 ${isNegativeCurrentCash ? "text-red-600" : "text-blue-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">Eröffnungssaldo Planungszeitraum</p>
      </div>

      {/* Minimum Cash */}
      <div className="admin-card p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--secondary)]">Tiefster Stand</p>
            <p className={`mt-2 text-2xl font-bold ${isNegativeMinCash ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>
              {formatCurrency(minCash)}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isNegativeMinCash ? "bg-red-100" : "bg-amber-100"}`}>
            <svg className={`w-5 h-5 ${isNegativeMinCash ? "text-red-600" : "text-amber-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">Niedrigster Kontostand im Zeitraum</p>
      </div>

      {/* Runway / Reichweite */}
      <div className="admin-card p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--secondary)]">Liquiditaetsreichweite</p>
            <p className={`mt-2 text-2xl font-bold ${runwayWeek ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>
              {runwayWeek ? runwayWeek : getFullPeriodLabel()}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${runwayWeek ? "bg-red-100" : "bg-blue-100"}`}>
            <svg className={`w-5 h-5 ${runwayWeek ? "text-red-600" : "text-blue-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          {runwayWeek
            ? (periodType === "MONTHLY" ? "Erster Monat mit negativem Saldo" : "Erste Woche mit negativem Saldo")
            : "Keine Unterdeckung im Planungszeitraum"}
        </p>
      </div>
    </div>
  );
}
