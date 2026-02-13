"use client";

interface MassekreditProps {
  massekreditAltforderungenCents: bigint;
  bereinigteEndLiquiditaetCents: bigint;
  hasUncertainBanks: boolean;
  fortfuehrungsbeitragCents: bigint;
}

interface ExecutiveSummaryProps {
  // Spalte 1: IST-Kontostand
  bankBalanceCents: bigint | null;
  bankAccountCount: number;
  // Spalte 2: Verlauf
  minCash: bigint;
  minCashPeriodLabel: string;
  // Spalte 3: Bereinigte Prognose
  finalBalance: bigint;
  massekreditSummary?: MassekreditProps;
  periodRange: string;
  formatCurrency: (cents: bigint) => string;
}

export default function ExecutiveSummary({
  bankBalanceCents,
  bankAccountCount,
  minCash,
  minCashPeriodLabel,
  finalBalance,
  massekreditSummary,
  periodRange,
  formatCurrency,
}: ExecutiveSummaryProps) {
  const hasBankBalance = bankBalanceCents !== null;
  const hasMassekredit = !!massekreditSummary;

  return (
    <div className="admin-card p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        {/* Spalte 1: IST-Kontostand */}
        <div className="md:border-r border-gray-200 md:pr-6">
          <div className="text-sm font-medium text-gray-500 mb-2">Kontostand (IST)</div>
          {hasBankBalance ? (
            <>
              <div className={`text-3xl font-bold mb-1 ${bankBalanceCents < BigInt(0) ? 'text-red-600' : 'text-[var(--foreground)]'}`}>
                {formatCurrency(bankBalanceCents)}
              </div>
              <div className="text-sm text-gray-500">
                {bankAccountCount} {bankAccountCount === 1 ? 'Bankkonto' : 'Bankkonten'}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-400 italic">
              Keine Bankkonten konfiguriert
            </div>
          )}
        </div>

        {/* Spalte 2: Verlauf */}
        <div className="md:border-r border-gray-200 md:pr-6">
          <div className="text-sm font-medium text-gray-500 mb-2">Tiefster Stand</div>
          <div className={`text-2xl font-bold mb-1 ${minCash < BigInt(0) ? 'text-red-600' : 'text-[var(--foreground)]'}`}>
            {formatCurrency(minCash)}
          </div>
          <div className="text-sm text-gray-500">
            {minCashPeriodLabel}
          </div>
          {minCash < BigInt(0) && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Liquiditätsengpass erwartet
            </div>
          )}
        </div>

        {/* Spalte 3: Prognose */}
        <div>
          <div className="text-sm font-medium text-gray-500 mb-2">Prognose Planungsende</div>

          {hasMassekredit ? (
            // MIT Bereinigung: Endbestand durchgestrichen, Bankforderungen, bereinigt
            <div className="space-y-2">
              {/* Endbestand (klein, durchgestrichen) */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Endbestand</span>
                <span className="text-gray-400 line-through">{formatCurrency(finalBalance)}</span>
              </div>

              {/* Bankforderungen (rot) */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-red-600">Bankforderungen</span>
                <span className="text-red-600 font-medium">
                  -{formatCurrency(massekreditSummary.massekreditAltforderungenCents)}
                </span>
              </div>

              {/* Fortführungsbeitrag (positiv, klein) */}
              {massekreditSummary.fortfuehrungsbeitragCents > BigInt(0) && (
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>davon Fortführungsbeitrag</span>
                  <span>+{formatCurrency(massekreditSummary.fortfuehrungsbeitragCents)}</span>
                </div>
              )}

              {/* Trennlinie */}
              <div className="border-t border-gray-200 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--foreground)]">Bereinigte Liquidität</span>
                  <span className={`text-2xl font-bold ${massekreditSummary.bereinigteEndLiquiditaetCents < BigInt(0) ? 'text-red-600' : 'text-[var(--foreground)]'}`}>
                    {formatCurrency(massekreditSummary.bereinigteEndLiquiditaetCents)}
                  </span>
                </div>
              </div>

              {/* Uncertain Badge */}
              {massekreditSummary.hasUncertainBanks && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Bankvereinbarung teilweise unsicher
                </div>
              )}
            </div>
          ) : (
            // OHNE Bereinigung: Nur Endbestand
            <div>
              <div className={`text-3xl font-bold ${finalBalance < BigInt(0) ? 'text-red-600' : 'text-[var(--foreground)]'}`}>
                {formatCurrency(finalBalance)}
              </div>
            </div>
          )}

          <div className="mt-3 text-xs text-gray-400">
            {periodRange}
          </div>
        </div>
      </div>
    </div>
  );
}
