"use client";

interface ExecutiveSummaryProps {
  currentCash: bigint;
  minCash: bigint;
  periods: Array<{
    periodIndex: number;
    periodLabel?: string;
    weekLabel?: string;
    closingBalanceCents: string | bigint;
  }>;
  bankAccountData: {
    accounts: Array<{ id: string }>;
    totalBalance: bigint;
    totalAvailable: bigint;
  };
  formatCurrency: (cents: bigint) => string;
  bankBalanceCents?: bigint | null;
}

export default function ExecutiveSummary({
  currentCash,
  minCash,
  periods,
  bankAccountData,
  formatCurrency,
  bankBalanceCents,
}: ExecutiveSummaryProps) {
  // Sichere Berechnung mit BigInt - Helper-Funktion
  const toBigInt = (value: string | bigint): bigint => {
    return typeof value === 'bigint' ? value : BigInt(value);
  };

  // Maximum über alle Perioden
  const maxCash = periods.reduce((max, period) => {
    const balance = toBigInt(period.closingBalanceCents);
    return balance > max ? balance : max;
  }, BigInt(0));

  // Endbestand (letzte Periode)
  const finalBalance = periods.length > 0
    ? toBigInt(periods[periods.length - 1].closingBalanceCents)
    : BigInt(0);

  // Berechnungen
  const netChange = finalBalance - currentCash;
  const cashRange = maxCash - minCash;

  // Zeitraum-Labels
  const firstPeriod = periods[0]?.periodLabel || periods[0]?.weekLabel || "";
  const lastPeriod = periods[periods.length - 1]?.periodLabel || periods[periods.length - 1]?.weekLabel || "";

  const hasBankBalance = bankBalanceCents !== undefined && bankBalanceCents !== null;

  return (
    <div className="admin-card p-6">
      <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
        Liquiditätsübersicht
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        {/* Spalte 1: HEUTE */}
        <div className="border-r border-gray-200 pr-6 last:border-r-0 last:pr-0">
          <div className="text-sm font-medium text-gray-600 mb-3">Aktueller Stand</div>
          <div className="text-3xl font-bold text-[var(--foreground)] mb-4">
            {formatCurrency(currentCash)}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Bankkonten</span>
              <span className="font-medium">{bankAccountData.accounts.length}</span>
            </div>

            {hasBankBalance && (
              <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
                <span className="text-gray-600">Banksaldo (IST)</span>
                <span className={`font-semibold ${bankBalanceCents < BigInt(0) ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(bankBalanceCents)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Spalte 2: ENTWICKLUNG */}
        <div className="border-r border-gray-200 pr-6 last:border-r-0 last:pr-0">
          <div className="text-sm font-medium text-gray-600 mb-3">Im Planungszeitraum</div>

          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">Tiefster Stand</div>
              <div className={`text-xl font-semibold ${minCash < BigInt(0) ? 'text-red-600' : 'text-[var(--foreground)]'}`}>
                {formatCurrency(minCash)}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Höchster Stand</div>
              <div className="text-xl font-semibold text-[var(--foreground)]">
                {formatCurrency(maxCash)}
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <div className="text-xs text-gray-500 mb-1">Schwankungsbreite</div>
              <div className="text-sm font-medium text-gray-600">
                {formatCurrency(cashRange)}
              </div>
            </div>
          </div>
        </div>

        {/* Spalte 3: PROGNOSE */}
        <div>
          <div className="text-sm font-medium text-gray-600 mb-3">
            Prognose {lastPeriod}
          </div>

          <div className="text-3xl font-bold text-[var(--foreground)] mb-2">
            {formatCurrency(finalBalance)}
          </div>

          <div className="mb-4">
            <div className={`text-lg font-semibold ${netChange >= BigInt(0) ? 'text-green-600' : 'text-red-600'}`}>
              {netChange >= BigInt(0) ? '+' : ''}{formatCurrency(netChange)}
            </div>
            <div className="text-xs text-gray-500">Veränderung</div>
          </div>

          <div className="pt-3 border-t border-gray-100 text-xs text-gray-500">
            Zeitraum: {firstPeriod} - {lastPeriod}
          </div>
        </div>
      </div>
    </div>
  );
}
