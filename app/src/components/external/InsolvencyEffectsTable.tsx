"use client";

interface InsolvencyEffect {
  name: string;
  description: string | null;
  effectType: "INFLOW" | "OUTFLOW";
  effectGroup: string;
  periods: {
    id: string;
    periodIndex: number;
    amountCents: string;
  }[];
}

interface InsolvencyEffectsTableProps {
  effects: InsolvencyEffect[];
  periodType: "WEEKLY" | "MONTHLY";
  periodCount: number;
  periodLabels: string[];
  openingBalance: bigint;
  closingBalancesBeforeEffects: bigint[];
}

// Effect group configuration
const EFFECT_GROUPS: Record<string, { label: string; order: number }> = {
  GENERAL: { label: "Allgemeine Insolvenzeffekte", order: 1 },
  PROCEDURE_COST: { label: "Verfahrenskosten", order: 2 },
};

export default function InsolvencyEffectsTable({
  effects,
  periodType,
  periodCount,
  periodLabels,
  openingBalance,
  closingBalancesBeforeEffects,
}: InsolvencyEffectsTableProps) {
  const formatCurrency = (cents: bigint | string): string => {
    const value = typeof cents === "string" ? BigInt(cents) : cents;
    const euros = Number(value) / 100;
    return euros.toLocaleString("de-DE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const getCellClass = (cents: bigint | string): string => {
    const value = typeof cents === "string" ? BigInt(cents) : cents;
    if (value < BigInt(0)) return "text-red-600";
    if (value > BigInt(0)) return "text-green-600";
    return "";
  };

  // Group effects by effectGroup
  const groupedEffects = effects.reduce((acc, effect) => {
    const group = effect.effectGroup || "GENERAL";
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(effect);
    return acc;
  }, {} as Record<string, InsolvencyEffect[]>);

  // Sort groups by order
  const sortedGroups = Object.entries(groupedEffects).sort(([a], [b]) => {
    return (EFFECT_GROUPS[a]?.order || 99) - (EFFECT_GROUPS[b]?.order || 99);
  });

  // Calculate totals per period
  const calculatePeriodTotals = (): { inflows: bigint[]; outflows: bigint[]; net: bigint[] } => {
    const inflows: bigint[] = Array(periodCount).fill(BigInt(0));
    const outflows: bigint[] = Array(periodCount).fill(BigInt(0));
    const net: bigint[] = Array(periodCount).fill(BigInt(0));

    effects.forEach((effect) => {
      effect.periods.forEach((period) => {
        const amount = BigInt(period.amountCents);
        if (effect.effectType === "INFLOW") {
          inflows[period.periodIndex] += amount;
        } else {
          outflows[period.periodIndex] += amount;
        }
        net[period.periodIndex] += effect.effectType === "INFLOW" ? amount : -amount;
      });
    });

    return { inflows, outflows, net };
  };

  const totals = calculatePeriodTotals();

  // Calculate cumulative effects
  const cumulativeEffects: bigint[] = [];
  let cumulative = BigInt(0);
  for (let i = 0; i < periodCount; i++) {
    cumulative += totals.net[i];
    cumulativeEffects.push(cumulative);
  }

  // Calculate closing balances after effects
  const closingBalancesAfterEffects = closingBalancesBeforeEffects.map((balance, i) =>
    balance + cumulativeEffects[i]
  );

  // Get amount for a specific effect and period
  const getEffectAmount = (effect: InsolvencyEffect, periodIndex: number): bigint => {
    const period = effect.periods.find((p) => p.periodIndex === periodIndex);
    return period ? BigInt(period.amountCents) : BigInt(0);
  };

  // Calculate line total
  const getLineTotal = (effect: InsolvencyEffect): bigint => {
    return effect.periods.reduce((sum, p) => sum + BigInt(p.amountCents), BigInt(0));
  };

  if (effects.length === 0) {
    return (
      <div className="admin-card p-6 text-center">
        <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">Keine Insolvenzeffekte</h3>
        <p className="text-sm text-[var(--muted)]">
          Für diesen Plan wurden noch keine insolvenzspezifischen Effekte erfasst.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Box */}
      <div className="admin-card p-4 bg-purple-50 border-purple-200">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-purple-600">PLAN</span>
          </div>
          <div>
            <h4 className="text-sm font-medium text-purple-800">
              Insolvenzspezifische Effekte
              <span className="ml-2 px-2 py-0.5 bg-purple-200 text-purple-700 text-xs rounded-full">Plan-Werte</span>
            </h4>
            <p className="text-xs text-purple-700 mt-1">
              Diese Tabelle zeigt <strong>geplante</strong> insolvenzspezifische Zahlungsströme.
              Diese sind keine realen Transaktionen (IST), sondern Planungsannahmen für zukünftige Effekte.
            </p>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="admin-card overflow-hidden">
        <div className="table-scroll-container custom-scrollbar">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase tracking-wider min-w-[200px] sticky left-0 bg-gray-50 z-10">
                  Position
                </th>
                {periodLabels.map((label, index) => (
                  <th key={index} scope="col" className="px-3 py-3 text-right text-xs font-semibold text-[var(--secondary)] uppercase tracking-wider min-w-[90px]">
                    {label}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-[var(--secondary)] uppercase tracking-wider min-w-[100px]">
                  Summe
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Balance before effects */}
              <tr className="bg-blue-50 font-medium">
                <td className="px-4 py-3 text-sm text-[var(--foreground)] sticky left-0 bg-blue-50 z-10">
                  Guthaben vor Insolvenzeffekten
                </td>
                {closingBalancesBeforeEffects.map((balance, index) => (
                  <td key={index} className="px-3 py-3 text-sm text-right">
                    {formatCurrency(balance)}
                  </td>
                ))}
                <td className="px-4 py-3 text-sm text-right">-</td>
              </tr>

              {/* Effect Groups */}
              {sortedGroups.map(([groupKey, groupEffects]) => (
                <>
                  {/* Group Header */}
                  <tr key={`group-${groupKey}`} className="bg-gray-100">
                    <td colSpan={periodCount + 2} className="px-4 py-2 text-xs font-semibold text-[var(--secondary)] uppercase">
                      {EFFECT_GROUPS[groupKey]?.label || groupKey}
                    </td>
                  </tr>

                  {/* Inflows in this group */}
                  {groupEffects
                    .filter((e) => e.effectType === "INFLOW")
                    .map((effect) => (
                      <tr key={effect.name} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-[var(--foreground)] pl-6 sticky left-0 bg-white z-10">
                          {effect.name}
                        </td>
                        {Array.from({ length: periodCount }).map((_, index) => {
                          const amount = getEffectAmount(effect, index);
                          return (
                            <td key={index} className={`px-3 py-2 text-sm text-right ${getCellClass(amount)}`}>
                              {amount !== BigInt(0) ? formatCurrency(amount) : "-"}
                            </td>
                          );
                        })}
                        <td className={`px-4 py-2 text-sm text-right font-medium ${getCellClass(getLineTotal(effect))}`}>
                          {formatCurrency(getLineTotal(effect))}
                        </td>
                      </tr>
                    ))}

                  {/* Outflows in this group */}
                  {groupEffects
                    .filter((e) => e.effectType === "OUTFLOW")
                    .map((effect) => {
                      const lineTotal = getLineTotal(effect);
                      return (
                        <tr key={effect.name} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-[var(--foreground)] pl-6 sticky left-0 bg-white z-10">
                            {effect.name}
                          </td>
                          {Array.from({ length: periodCount }).map((_, index) => {
                            const amount = getEffectAmount(effect, index);
                            return (
                              <td key={index} className="px-3 py-2 text-sm text-right text-red-600">
                                {amount !== BigInt(0) ? `-${formatCurrency(amount)}` : "-"}
                              </td>
                            );
                          })}
                          <td className="px-4 py-2 text-sm text-right font-medium text-red-600">
                            -{formatCurrency(lineTotal)}
                          </td>
                        </tr>
                      );
                    })}
                </>
              ))}

              {/* Subtotals */}
              <tr className="bg-gray-50 border-t-2 border-gray-300">
                <td className="px-4 py-3 text-sm font-medium text-[var(--foreground)] sticky left-0 bg-gray-50 z-10">
                  Saldo Insolvenzeffekte je {periodType === "MONTHLY" ? "Monat" : "Woche"}
                </td>
                {totals.net.map((amount, index) => (
                  <td key={index} className={`px-3 py-3 text-sm text-right font-medium ${getCellClass(amount)}`}>
                    {formatCurrency(amount)}
                  </td>
                ))}
                <td className={`px-4 py-3 text-sm text-right font-bold ${getCellClass(totals.net.reduce((a, b) => a + b, BigInt(0)))}`}>
                  {formatCurrency(totals.net.reduce((a, b) => a + b, BigInt(0)))}
                </td>
              </tr>

              {/* Cumulative Effects */}
              <tr className="bg-gray-100">
                <td className="px-4 py-3 text-sm font-medium text-[var(--foreground)] sticky left-0 bg-gray-100 z-10">
                  Kumulierter Effekt
                </td>
                {cumulativeEffects.map((amount, index) => (
                  <td key={index} className={`px-3 py-3 text-sm text-right font-medium ${getCellClass(amount)}`}>
                    {formatCurrency(amount)}
                  </td>
                ))}
                <td className="px-4 py-3 text-sm text-right">-</td>
              </tr>

              {/* Balance after effects */}
              <tr className="bg-green-50 font-bold border-t-2 border-green-300">
                <td className="px-4 py-3 text-sm text-[var(--foreground)] sticky left-0 bg-green-50 z-10">
                  Guthaben nach Insolvenzeffekten
                </td>
                {closingBalancesAfterEffects.map((balance, index) => (
                  <td key={index} className={`px-3 py-3 text-sm text-right ${balance < BigInt(0) ? "text-red-600" : ""}`}>
                    {formatCurrency(balance)}
                  </td>
                ))}
                <td className="px-4 py-3 text-sm text-right">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="admin-card p-4">
          <p className="text-xs font-medium text-[var(--secondary)]">Summe Einzahlungen</p>
          <p className="mt-1 text-lg font-bold text-green-600">
            +{formatCurrency(totals.inflows.reduce((a, b) => a + b, BigInt(0)))} €
          </p>
        </div>
        <div className="admin-card p-4">
          <p className="text-xs font-medium text-[var(--secondary)]">Summe Auszahlungen</p>
          <p className="mt-1 text-lg font-bold text-red-600">
            -{formatCurrency(totals.outflows.reduce((a, b) => a + b, BigInt(0)))} €
          </p>
        </div>
        <div className="admin-card p-4">
          <p className="text-xs font-medium text-[var(--secondary)]">Netto-Effekt</p>
          <p className={`mt-1 text-lg font-bold ${getCellClass(totals.net.reduce((a, b) => a + b, BigInt(0)))}`}>
            {formatCurrency(totals.net.reduce((a, b) => a + b, BigInt(0)))} €
          </p>
        </div>
      </div>
    </div>
  );
}
