"use client";

interface PlanningAssumption {
  id: string;
  title: string;
  source: string;
  description: string;
  status: string;
  linkedModule: string | null;
}

interface ForecastAssumption {
  categoryLabel: string;
  flowType: string;
  assumptionType: string;
  baseAmountCents: string;
  baseAmountSource: string;
  method: string | null;
  baseReferencePeriod: string | null;
  riskProbability: number | null;
  riskImpactCents: string | null;
  riskComment: string | null;
  visibilityScope: string | null;
}

interface PlanningAssumptionsProps {
  assumptions: PlanningAssumption[];
  forecastAssumptions?: ForecastAssumption[];
}

const STATUS_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  ANNAHME: { label: "Annahme", icon: "○", color: "text-amber-700 bg-amber-100" },
  VERIFIZIERT: { label: "Verifiziert", icon: "✓", color: "text-green-700 bg-green-100" },
  WIDERLEGT: { label: "Widerlegt", icon: "✗", color: "text-red-700 bg-red-100" },
};

function formatEUR(cents: string | number): string {
  const value = typeof cents === "string" ? Number(cents) : cents;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

const ASSUMPTION_TYPE_LABELS: Record<string, string> = {
  RUN_RATE: "Laufend",
  FIXED: "Fixbetrag",
  ONE_TIME: "Einmalig",
  PERCENTAGE_OF_REVENUE: "% der Einnahmen",
};

export default function PlanningAssumptions({ assumptions, forecastAssumptions }: PlanningAssumptionsProps) {
  // Nur extern sichtbare Forecast-Annahmen
  const visibleForecasts = (forecastAssumptions || []).filter(
    a => a.visibilityScope === "EXTERN"
  );

  if (assumptions.length === 0 && visibleForecasts.length === 0) {
    return (
      <div className="admin-card p-6 text-center">
        <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">Keine Berechnungsannahmen</h3>
        <p className="text-sm text-[var(--muted)]">
          Für diesen Fall wurden noch keine Berechnungsannahmen dokumentiert.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Planungsannahmen */}
      {assumptions.length > 0 && (
        <div className="admin-card">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Planungsannahmen</h3>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {assumptions.map((a) => {
              const statusCfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.ANNAHME;
              return (
                <div key={a.id} className="px-6 py-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusCfg.color}`}>
                      {statusCfg.icon} {statusCfg.label}
                    </span>
                    <h4 className="font-medium text-sm text-[var(--foreground)]">{a.title}</h4>
                  </div>
                  <p className="text-sm text-[var(--secondary)] mb-1">{a.description}</p>
                  <div className="text-xs text-[var(--muted)]">Quelle: {a.source}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Extern sichtbare Prognose-Annahmen */}
      {visibleForecasts.length > 0 && (
        <div className="admin-card">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Prognose-Annahmen</h3>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {visibleForecasts.map((a, i) => (
              <div key={i} className="px-6 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-[var(--foreground)]">{a.categoryLabel}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-[var(--muted)]">
                      {ASSUMPTION_TYPE_LABELS[a.assumptionType] || a.assumptionType}
                    </span>
                  </div>
                  <span className="font-semibold text-sm text-[var(--foreground)]">
                    {formatEUR(a.baseAmountCents)}
                  </span>
                </div>
                {a.method && (
                  <div className="text-xs text-[var(--muted)]">Methode: {a.method}</div>
                )}
                {a.riskProbability !== null && (
                  <div className="mt-1 text-xs text-amber-700">
                    Risiko: {Math.round((a.riskProbability || 0) * 100)}%
                    {a.riskImpactCents && <> · {formatEUR(a.riskImpactCents)}</>}
                    {a.riskComment && <> — {a.riskComment}</>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="text-xs text-[var(--muted)] px-1">
        {assumptions.length} Planungsannahme{assumptions.length !== 1 ? "n" : ""}
        {visibleForecasts.length > 0 && <>, {visibleForecasts.length} Prognose-Annahme{visibleForecasts.length !== 1 ? "n" : ""}</>}
      </div>
    </div>
  );
}
