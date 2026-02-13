"use client";

import {
  CaseDashboardData,
  formatCurrency,
  getPeriods,
} from "@/types/dashboard";

interface OverviewMetricsBarProps {
  data: CaseDashboardData;
}

export default function OverviewMetricsBar({ data }: OverviewMetricsBarProps) {
  const periods = getPeriods(data);

  // 1. ISK-Saldo
  const iskBalanceCents = data.bankAccounts?.summary.iskBalanceCents;
  const iskAccountCount = data.bankAccounts?.summary.iskAccountCount ?? 0;
  const hasIsk = iskAccountCount > 0;

  // 2. End-Prognose
  const hasMassekredit = !!data.massekreditSummary?.hasBankAgreements;
  const endPrognoseCents = hasMassekredit
    ? data.massekreditSummary!.bereinigteEndLiquiditaetCents
    : data.calculation.finalClosingBalanceCents;
  const endPrognoseLabel = hasMassekredit ? "bereinigt" : "Planungsende";
  const endPrognoseNegative = BigInt(endPrognoseCents) < BigInt(0);

  // 3. IST-Fortschritt
  const now = new Date();
  const istPeriodCount = periods.filter(
    (p) => p.periodStartDate && new Date(p.periodStartDate) < now
  ).length;
  const totalPeriods = periods.length;
  const progressPct = totalPeriods > 0 ? (istPeriodCount / totalPeriods) * 100 : 0;
  const periodTypeLabel = data.plan.periodType === "MONTHLY" ? "Monate" : "Wochen";

  // 4. Datenstand
  const istCount = data.ledgerStats?.istCount ?? 0;
  const planCount = data.ledgerStats?.planCount ?? 0;
  const unreviewedCount = data.ledgerStats?.unreviewedCount ?? 0;

  return (
    <div className="admin-card px-5 py-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {/* ISK-Saldo */}
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-1">
            ISK-Saldo
          </div>
          {hasIsk ? (
            <>
              <div className={`text-lg font-bold leading-tight ${BigInt(iskBalanceCents!) < BigInt(0) ? "text-red-600" : "text-[var(--foreground)]"}`}>
                {formatCurrency(iskBalanceCents!)}
              </div>
              <div className="text-[11px] text-gray-500">
                {iskAccountCount} ISK-{iskAccountCount === 1 ? "Konto" : "Konten"}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-400 italic">Kein ISK</div>
          )}
        </div>

        {/* End-Prognose */}
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-1">
            End-Prognose
          </div>
          <div className={`text-lg font-bold leading-tight ${endPrognoseNegative ? "text-red-600" : "text-emerald-600"}`}>
            {formatCurrency(endPrognoseCents)}
          </div>
          <div className="text-[11px] text-gray-500">{endPrognoseLabel}</div>
        </div>

        {/* IST-Fortschritt */}
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-1">
            IST-Fortschritt
          </div>
          <div className="text-lg font-bold leading-tight text-[var(--foreground)]">
            {istPeriodCount} / {totalPeriods} {periodTypeLabel}
          </div>
          <div className="mt-1 flex h-1.5 rounded-full overflow-hidden bg-gray-200">
            <div
              className="bg-blue-600 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Datenstand */}
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-1">
            Datenstand
          </div>
          <div className="text-sm font-medium text-[var(--foreground)] leading-tight">
            <span className="text-blue-600">{istCount} IST</span>
            {" / "}
            <span className="text-purple-600">{planCount} PLAN</span>
          </div>
          {unreviewedCount > 0 && (
            <div className="text-[11px] text-amber-600 font-medium mt-0.5">
              {unreviewedCount} ungeprüft
            </div>
          )}
          {unreviewedCount === 0 && (istCount + planCount) > 0 && (
            <div className="text-[11px] text-green-600 mt-0.5">
              Alle geprüft
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
