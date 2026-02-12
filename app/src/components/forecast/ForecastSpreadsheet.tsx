"use client";

import InlineAssumptionRow from "./InlineAssumptionRow";
import QuickAddRow from "./QuickAddRow";
import {
  cn,
  formatEUR,
  type ForecastData,
  type AssumptionJSON,
  type ForecastPeriodJSON,
} from "./types";

interface ForecastSpreadsheetProps {
  data: ForecastData;
  assumptions: AssumptionJSON[];
  caseId: string;
  onAssumptionSaved: () => void;
  onAssumptionCreated: () => void;
  onOpenDrawer: (assumption: AssumptionJSON) => void;
}

export default function ForecastSpreadsheet({
  data,
  assumptions,
  caseId,
  onAssumptionSaved,
  onAssumptionCreated,
  onOpenDrawer,
}: ForecastSpreadsheetProps) {
  const { periods, meta } = data;

  const inflowAssumptions = assumptions.filter(a => a.flowType === "INFLOW");
  const outflowAssumptions = assumptions.filter(a => a.flowType === "OUTFLOW");

  return (
    <div className="admin-card overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        {/* Header */}
        <thead>
          <tr className="border-b-2 border-[var(--border)]">
            <th className="text-left p-3 font-semibold sticky left-0 bg-white z-10 min-w-[220px]">
              Position
            </th>
            {periods.map((p) => (
              <th
                key={p.periodIndex}
                className={cn(
                  "text-right p-3 font-semibold min-w-[110px]",
                  p.dataSource === "IST" ? "bg-gray-50" : "bg-blue-50/50"
                )}
              >
                {p.periodLabel}
                <br />
                <span className={cn(
                  "text-[10px] font-normal uppercase tracking-wider",
                  p.dataSource === "IST" ? "text-gray-500" : "text-blue-500"
                )}>
                  {p.dataSource === "IST" ? "IST" : "Prognose"}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {/* ── ERÖFFNUNGSSALDO ── */}
          <SectionHeader label="Eröffnungssaldo" />
          <SummaryRow
            label="Kontostand Periodenstart"
            periods={periods}
            getValue={(p) => p.openingBalanceCents}
            isBold
          />

          {/* ── EINZAHLUNGEN ── */}
          <SectionHeader label="Einzahlungen" />

          {inflowAssumptions.length > 0 ? (
            inflowAssumptions.map(a => (
              <InlineAssumptionRow
                key={a.id}
                assumption={a}
                periods={periods}
                caseId={caseId}
                onAmountSaved={onAssumptionSaved}
                onLabelClick={onOpenDrawer}
              />
            ))
          ) : (
            <tr className="border-b border-[var(--border)]">
              <td className="p-2 px-3 pl-6 text-xs text-[var(--muted)] italic sticky left-0 bg-white z-10" colSpan={1}>
                Noch keine Einzahlungs-Annahmen
              </td>
              <td colSpan={periods.length} />
            </tr>
          )}

          {/* + Neue Zeile (Einzahlungen) */}
          <QuickAddRow
            flowType="INFLOW"
            caseId={caseId}
            periods={periods}
            periodCount={meta.periodCount}
            onCreated={onAssumptionCreated}
          />

          <SummaryRow
            label="Summe Einzahlungen"
            periods={periods}
            getValue={(p) => p.cashInTotalCents}
            isBold
            isSummary
          />

          {/* ── AUSZAHLUNGEN ── */}
          <SectionHeader label="Auszahlungen" />

          {outflowAssumptions.length > 0 ? (
            outflowAssumptions.map(a => (
              <InlineAssumptionRow
                key={a.id}
                assumption={a}
                periods={periods}
                caseId={caseId}
                onAmountSaved={onAssumptionSaved}
                onLabelClick={onOpenDrawer}
              />
            ))
          ) : (
            <tr className="border-b border-[var(--border)]">
              <td className="p-2 px-3 pl-6 text-xs text-[var(--muted)] italic sticky left-0 bg-white z-10" colSpan={1}>
                Noch keine Auszahlungs-Annahmen
              </td>
              <td colSpan={periods.length} />
            </tr>
          )}

          {/* + Neue Zeile (Auszahlungen) */}
          <QuickAddRow
            flowType="OUTFLOW"
            caseId={caseId}
            periods={periods}
            periodCount={meta.periodCount}
            onCreated={onAssumptionCreated}
          />

          <SummaryRow
            label="Summe Auszahlungen"
            periods={periods}
            getValue={(p) => p.cashOutTotalCents}
            isBold
            isSummary
          />

          {/* ── LIQUIDITÄTSENTWICKLUNG ── */}
          <SectionHeader label="Liquiditätsentwicklung" />
          <SummaryRow
            label="Veränderung"
            periods={periods}
            getValue={(p) => p.netCashflowCents}
          />
          <SummaryRow
            label="Endbestand"
            periods={periods}
            getValue={(p) => p.closingBalanceCents}
            isBold
          />
          <SummaryRow
            label="+ Kreditlinie"
            periods={periods}
            getValue={(p) => p.creditLineAvailableCents}
          />
          <SummaryRow
            label="Headroom"
            periods={periods}
            getValue={(p) => p.headroomCents}
            isBold
          />
          <SummaryRow
            label="Headroom nach Rückstellungen"
            periods={periods}
            getValue={(p) => p.headroomAfterReservesCents}
            isBold
            isHighlight
            tooltip={
              meta.reservesTotalCents && Number(meta.reservesTotalCents) > 0
                ? `Headroom − Rückstellungen (${formatEUR(meta.reservesTotalCents)})`
                : undefined
            }
          />
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Sub-Komponenten (intern)
// ============================================================================

function SectionHeader({ label }: { label: string }) {
  return (
    <tr className="bg-gray-100">
      <td colSpan={100} className="p-2 px-3 font-bold text-xs uppercase tracking-wider text-[var(--muted)] sticky left-0 bg-gray-100">
        {label}
      </td>
    </tr>
  );
}

function SummaryRow({ label, periods, getValue, isBold, isSummary, isHighlight, tooltip }: {
  label: string;
  periods: ForecastPeriodJSON[];
  getValue: (p: ForecastPeriodJSON) => string;
  isBold?: boolean;
  isSummary?: boolean;
  isHighlight?: boolean;
  tooltip?: string;
}) {
  return (
    <tr className={cn(
      "border-b border-[var(--border)]",
      isSummary && "border-t-2 border-t-[var(--border)]",
      isHighlight && "bg-blue-50/30"
    )}>
      <td className={cn(
        "p-2 px-3 sticky left-0 bg-white z-10",
        isBold ? "font-semibold" : "font-normal",
        isHighlight && "bg-blue-50/30"
      )}>
        {label}
      </td>
      {periods.map((p) => {
        const rawValue = getValue(p);
        const numValue = Number(rawValue);

        return (
          <td
            key={p.periodIndex}
            title={tooltip}
            className={cn(
              "text-right p-2 px-3 tabular-nums",
              isBold && "font-semibold",
              p.dataSource === "IST" ? "bg-gray-50" : "bg-blue-50/20",
              isHighlight && "bg-blue-50/30",
              numValue < 0 && "text-red-600",
              tooltip && "cursor-help"
            )}
          >
            {numValue === 0 && !isBold ? "–" : formatEUR(rawValue)}
          </td>
        );
      })}
    </tr>
  );
}
