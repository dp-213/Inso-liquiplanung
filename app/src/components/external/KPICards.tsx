"use client";

interface KPICardsProps {
  currentCash: bigint;
  minCash: bigint;
  runwayWeek: string | null;
  criticalWeek: string | null;
  formatCurrency: (cents: bigint) => string;
}

export default function KPICards({
  currentCash,
  minCash,
  runwayWeek,
  criticalWeek,
  formatCurrency,
}: KPICardsProps) {
  const isNegativeMinCash = minCash < BigInt(0);
  const isNegativeCurrentCash = currentCash < BigInt(0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Runway Week */}
      <div className="admin-card p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--secondary)]">Liquiditätsreichweite</p>
            <p className={`mt-2 text-2xl font-bold ${runwayWeek ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>
              {runwayWeek ? runwayWeek : "13+ Wochen"}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${runwayWeek ? "bg-red-100" : "bg-green-100"}`}>
            <svg className={`w-5 h-5 ${runwayWeek ? "text-red-600" : "text-green-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          {runwayWeek ? "Erste Woche mit negativem Saldo" : "Keine Unterdeckung prognostiziert"}
        </p>
      </div>

      {/* Critical Week / Status */}
      <div className="admin-card p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--secondary)]">Status</p>
            <p className={`mt-2 text-2xl font-bold ${
              runwayWeek ? "text-[var(--danger)]" :
              criticalWeek ? "text-[var(--warning)]" :
              "text-[var(--success)]"
            }`}>
              {runwayWeek ? "Kritisch" : criticalWeek ? "Beobachten" : "Stabil"}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            runwayWeek ? "bg-red-100" :
            criticalWeek ? "bg-amber-100" :
            "bg-green-100"
          }`}>
            {runwayWeek ? (
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : criticalWeek ? (
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          {runwayWeek
            ? "Handlungsbedarf - Unterdeckung erwartet"
            : criticalWeek
              ? `Aufmerksamkeit ab ${criticalWeek}`
              : "Liquidität ausreichend gesichert"
          }
        </p>
      </div>
    </div>
  );
}
