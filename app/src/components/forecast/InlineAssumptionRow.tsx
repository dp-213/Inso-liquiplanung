"use client";

import { useRef, useCallback } from "react";
import SpreadsheetCell from "./SpreadsheetCell";
import {
  cn,
  formatEUR,
  formatEURInput,
  parseCentsFromEUR,
  ASSUMPTION_TYPE_LABELS,
  ASSUMPTION_TYPE_COLORS,
  type AssumptionJSON,
  type ForecastPeriodJSON,
} from "./types";

interface InlineAssumptionRowProps {
  assumption: AssumptionJSON;
  periods: ForecastPeriodJSON[];
  caseId: string;
  onAmountSaved: () => void;
  onLabelClick: (assumption: AssumptionJSON) => void;
}

export default function InlineAssumptionRow({
  assumption,
  periods,
  caseId,
  onAmountSaved,
  onLabelClick,
}: InlineAssumptionRowProps) {
  const cellRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleSaveAmount = useCallback(async (newValue: string) => {
    const cents = parseCentsFromEUR(newValue);
    const res = await fetch(`/api/cases/${caseId}/forecast/assumptions`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: assumption.id,
        baseAmountCents: cents,
      }),
    });
    if (!res.ok) throw new Error("Speichern fehlgeschlagen");
    onAmountSaved();
  }, [caseId, assumption.id, onAmountSaved]);

  const isInflow = assumption.flowType === "INFLOW";

  return (
    <tr className={cn(
      "border-b border-[var(--border)] hover:bg-gray-50/50",
      !assumption.isActive && "opacity-40"
    )}>
      {/* Label-Zelle: klickbar für Drawer */}
      <td className="p-2 px-3 pl-6 sticky left-0 bg-white z-10">
        <button
          onClick={() => onLabelClick(assumption)}
          className="text-left group flex items-center gap-2 hover:text-[var(--primary)] transition-colors"
          title="Details bearbeiten"
        >
          <span className="text-sm text-[var(--secondary)]">{assumption.categoryLabel}</span>
          <span className={cn(
            "px-1.5 py-0.5 text-[9px] font-semibold rounded border shrink-0",
            ASSUMPTION_TYPE_COLORS[assumption.assumptionType] || "bg-gray-100 text-gray-800"
          )}>
            {ASSUMPTION_TYPE_LABELS[assumption.assumptionType] || assumption.assumptionType}
          </span>
          {/* Stift-Icon bei Hover */}
          <svg className="w-3 h-3 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </td>

      {/* Perioden-Zellen */}
      {periods.map((period, idx) => {
        const isIst = period.dataSource === "IST";
        const isInRange = period.periodIndex >= assumption.startPeriodIndex
          && period.periodIndex <= assumption.endPeriodIndex;

        // IST-Perioden: nur "–" anzeigen
        if (isIst) {
          return (
            <SpreadsheetCell
              key={period.periodIndex}
              displayValue="–"
              editValue=""
              readonly
              className="bg-gray-50 text-gray-300 text-xs"
              title="IST-Daten – Details im Kontobuch"
            />
          );
        }

        // Außerhalb des Perioden-Range der Annahme
        if (!isInRange || !assumption.isActive) {
          return (
            <SpreadsheetCell
              key={period.periodIndex}
              displayValue="–"
              editValue=""
              readonly
              className="bg-blue-50/20 text-gray-300"
            />
          );
        }

        // Berechne den Wert für diese Periode aus dem lineItem
        const lineItem = period.lineItems.find(
          li => li.categoryKey === assumption.categoryKey
            && li.flowType === assumption.flowType
        );
        const amountCents = lineItem?.amountCents || "0";
        const displayAmount = Number(amountCents) === 0
          ? "–"
          : formatEUR(isInflow ? amountCents : `-${amountCents}`);

        return (
          <SpreadsheetCell
            key={period.periodIndex}
            displayValue={displayAmount}
            editValue={formatEURInput(assumption.baseAmountCents)}
            className="bg-blue-50/20"
            title={lineItem?.formula}
            onSave={handleSaveAmount}
            inputRef={(el) => { cellRefs.current[idx] = el; }}
            onTabNext={() => {
              // Nächste editierbare Periode finden
              for (let i = idx + 1; i < periods.length; i++) {
                if (periods[i].dataSource === "FORECAST" && cellRefs.current[i]) {
                  cellRefs.current[i]?.focus();
                  return;
                }
              }
            }}
            onTabPrev={() => {
              for (let i = idx - 1; i >= 0; i--) {
                if (periods[i].dataSource === "FORECAST" && cellRefs.current[i]) {
                  cellRefs.current[i]?.focus();
                  return;
                }
              }
            }}
          />
        );
      })}
    </tr>
  );
}
