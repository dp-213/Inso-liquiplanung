"use client";

interface MassekreditProps {
  massekreditAltforderungenCents: bigint;
  bereinigteEndLiquiditaetCents: bigint;
  hasUncertainBanks: boolean;
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

  // Die Zahl die der IV tatsächlich interessiert
  const heroBalance = hasMassekredit
    ? massekreditSummary.bereinigteEndLiquiditaetCents
    : finalBalance;

  return (
    <div className="admin-card p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        {/* Spalte 1: IST-Kontostand */}
        <div className="md:border-r border-gray-200 md:pr-6">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-3">Kontostand aktuell</div>
          {hasBankBalance ? (
            <>
              <div className={`text-2xl font-bold mb-1 ${bankBalanceCents < BigInt(0) ? 'text-red-600' : 'text-[var(--foreground)]'}`}>
                {formatCurrency(bankBalanceCents)}
              </div>
              <div className="text-sm text-gray-500">
                {bankAccountCount} {bankAccountCount === 1 ? 'Bankkonto' : 'Bankkonten'}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-400 italic mt-2">
              Keine Bankkonten konfiguriert
            </div>
          )}
        </div>

        {/* Spalte 2: Tiefster Stand */}
        <div className="md:border-r border-gray-200 md:pr-6">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-3">Tiefster Stand</div>
          <div className={`text-2xl font-bold mb-1 ${minCash < BigInt(0) ? 'text-red-600' : 'text-[var(--foreground)]'}`}>
            {formatCurrency(minCash)}
          </div>
          <div className="text-sm text-gray-500">
            {minCashPeriodLabel}
          </div>
          {minCash < BigInt(0) && (
            <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-100 px-2.5 py-1.5 rounded-md">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Liquiditätsengpass
            </div>
          )}
        </div>

        {/* Spalte 3: Prognose */}
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-3">
            {hasMassekredit ? 'Bereinigte Prognose' : 'Prognose Planungsende'}
          </div>

          {/* Hero-Zahl: Das ist DIE Zahl die der IV wissen will */}
          <div className={`text-3xl font-bold mb-1 ${heroBalance < BigInt(0) ? 'text-red-600' : 'text-emerald-600'}`}>
            {formatCurrency(heroBalance)}
          </div>

          {hasMassekredit ? (
            // Kontext-Info: Wie kommt die bereinigte Zahl zustande
            <div className="space-y-1.5 mt-2">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Endbestand vor Bereinigung</span>
                <span className="line-through">{formatCurrency(finalBalance)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-red-500">
                <span>./. Bankforderungen (netto)</span>
                <span>-{formatCurrency(massekreditSummary.massekreditAltforderungenCents)}</span>
              </div>
              {massekreditSummary.hasUncertainBanks && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded-md">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Vereinbarung teilw. unsicher
                </div>
              )}
            </div>
          ) : null}

          <div className="mt-3 text-xs text-gray-400">
            {periodRange}
          </div>
        </div>
      </div>
    </div>
  );
}
