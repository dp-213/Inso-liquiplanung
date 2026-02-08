"use client";

interface KPICardsProps {
  currentCash: bigint;
  minCash: bigint;
  runwayWeek: string | null;
  formatCurrency: (cents: bigint) => string;
  periodType?: "WEEKLY" | "MONTHLY";
  periodCount?: number;
  bankBalanceCents?: bigint | null; // Optionaler aktueller Bank-Bestand
}

export default function KPICards({
  currentCash,
  minCash,
  runwayWeek,
  formatCurrency,
  periodType = "WEEKLY",
  periodCount = 13,
  bankBalanceCents,
}: KPICardsProps) {
  const isNegativeMinCash = minCash < BigInt(0);
  const isNegativeCurrentCash = currentCash < BigInt(0);
  const hasBankBalance = bankBalanceCents !== undefined && bankBalanceCents !== null;
  const isNegativeBankBalance = hasBankBalance && bankBalanceCents < BigInt(0);

  // Dynamische Beschriftung basierend auf Periodentyp
  const getFullPeriodLabel = (): string => {
    if (periodType === "MONTHLY") {
      return `${periodCount}+ Monate`;
    }
    return `${periodCount}+ Wochen`;
  };

  // Grid-Klassen je nachdem ob Bank-Balance vorhanden ist
  const gridClass = hasBankBalance
    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
    : "grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4";

  return (
    <div className={gridClass}>
      {/* Aktueller Bank-Bestand - NUR wenn vorhanden, dann ZUERST */}
      {hasBankBalance && (
        <div className="admin-card p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-[var(--secondary)]">Aktueller Bank-Bestand</p>
              <p className={`mt-1 sm:mt-2 text-xl sm:text-2xl font-bold truncate ${isNegativeBankBalance ? "text-[var(--danger)]" : "text-green-600"}`}>
                {formatCurrency(bankBalanceCents)}
              </p>
            </div>
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-3 ${isNegativeBankBalance ? "bg-red-100" : "bg-green-100"}`}>
              <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${isNegativeBankBalance ? "text-red-600" : "text-green-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
          <p className="mt-2 sm:mt-3 text-xs text-[var(--muted)]">IST-Salden aller Bankkonten</p>
        </div>
      )}

      {/* Plan-Startsaldo */}
      <div className="admin-card p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-[var(--secondary)]">Plan-Startsaldo</p>
            <p className={`mt-1 sm:mt-2 text-xl sm:text-2xl font-bold truncate ${isNegativeCurrentCash ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>
              {formatCurrency(currentCash)}
            </p>
          </div>
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-3 ${isNegativeCurrentCash ? "bg-red-100" : "bg-purple-100"}`}>
            <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${isNegativeCurrentCash ? "text-red-600" : "text-purple-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
        <p className="mt-2 sm:mt-3 text-xs text-[var(--muted)]">Eröffnungssaldo Planungszeitraum</p>
      </div>

      {/* Minimum Cash */}
      <div className="admin-card p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-[var(--secondary)]">Tiefster Stand</p>
            <p className={`mt-1 sm:mt-2 text-xl sm:text-2xl font-bold truncate ${isNegativeMinCash ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>
              {formatCurrency(minCash)}
            </p>
          </div>
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-3 ${isNegativeMinCash ? "bg-red-100" : "bg-amber-100"}`}>
            <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${isNegativeMinCash ? "text-red-600" : "text-amber-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
          </div>
        </div>
        <p className="mt-2 sm:mt-3 text-xs text-[var(--muted)]">Niedrigster Kontostand im Zeitraum</p>
      </div>

      {/* Runway / Reichweite */}
      <div className="admin-card p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-[var(--secondary)]">Liquiditaetsreichweite</p>
            <p className={`mt-1 sm:mt-2 text-xl sm:text-2xl font-bold truncate ${runwayWeek ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>
              {runwayWeek ? runwayWeek : getFullPeriodLabel()}
            </p>
          </div>
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-3 ${runwayWeek ? "bg-red-100" : "bg-blue-100"}`}>
            <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${runwayWeek ? "text-red-600" : "text-blue-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <p className="mt-2 sm:mt-3 text-xs text-[var(--muted)]">
          {runwayWeek
            ? (periodType === "MONTHLY" ? "Erster Monat mit negativem Saldo" : "Erste Woche mit negativem Saldo")
            : "Keine Unterdeckung im Planungszeitraum"}
        </p>
      </div>
    </div>
  );
}
