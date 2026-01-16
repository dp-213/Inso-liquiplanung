"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface PeriodValue {
  lineId: string;
  periodIndex: number;
  valueType: "IST" | "PLAN";
  amountCents: bigint;
}

interface Line {
  lineId: string;
  lineName: string;
  totalCents: bigint;
  weeklyValuesCents: bigint[];
}

interface Category {
  categoryId: string;
  categoryName: string;
  flowType: "INFLOW" | "OUTFLOW";
  estateType: "ALTMASSE" | "NEUMASSE";
  totalCents: bigint;
  weeklyTotalsCents: bigint[];
  lines: Line[];
}

interface Week {
  weekOffset: number;
  weekLabel: string;
  weekStartDate: string;
  totalInflowsCents: bigint;
  totalOutflowsCents: bigint;
  netCashflowCents: bigint;
  closingBalanceCents: bigint;
}

interface EditableCategoryTableProps {
  caseId: string;
  categories: Category[];
  weeks: Week[];
  openingBalanceCents: bigint;
  onValueChange: () => void;
  onOpeningBalanceChange: (newValue: bigint) => void;
}

type CellStatus = "idle" | "editing" | "saving" | "saved" | "error";

interface CellState {
  status: CellStatus;
  originalValue: string;
  currentValue: string;
}

/**
 * Editable category table for admin dashboard
 * Allows inline editing of period values with auto-save
 */
export default function EditableCategoryTable({
  caseId,
  categories,
  weeks,
  openingBalanceCents,
  onValueChange,
  onOpeningBalanceChange,
}: EditableCategoryTableProps) {
  // Track cell states: key = `${lineId}-${periodIndex}`
  const [cellStates, setCellStates] = useState<Record<string, CellState>>({});
  const [openingBalanceState, setOpeningBalanceState] = useState<CellState>({
    status: "idle",
    originalValue: formatCentsToEuro(openingBalanceCents),
    currentValue: formatCentsToEuro(openingBalanceCents),
  });
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Update opening balance state when prop changes
  useEffect(() => {
    setOpeningBalanceState({
      status: "idle",
      originalValue: formatCentsToEuro(openingBalanceCents),
      currentValue: formatCentsToEuro(openingBalanceCents),
    });
  }, [openingBalanceCents]);

  // Format cents to EUR string (e.g., 150000 -> "1.500,00")
  function formatCentsToEuro(cents: bigint): string {
    const euros = Number(cents) / 100;
    return euros.toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // Format display (compact, no decimals)
  function formatDisplay(cents: bigint): string {
    const euros = Number(cents) / 100;
    return euros.toLocaleString("de-DE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  // Parse EUR string to cents (e.g., "1.500,00" -> 150000)
  function parseEuroToCents(value: string): bigint | null {
    // Remove thousand separators and replace decimal comma with dot
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(normalized);
    if (isNaN(parsed)) return null;
    return BigInt(Math.round(parsed * 100));
  }

  // Get cell key
  const getCellKey = (lineId: string, periodIndex: number) =>
    `${lineId}-${periodIndex}`;

  // Handle cell focus
  const handleCellFocus = useCallback(
    (lineId: string, periodIndex: number, currentCents: bigint) => {
      const key = getCellKey(lineId, periodIndex);
      const formatted = formatCentsToEuro(currentCents);
      setCellStates((prev) => ({
        ...prev,
        [key]: {
          status: "editing",
          originalValue: formatted,
          currentValue: formatted,
        },
      }));
    },
    []
  );

  // Handle cell input change
  const handleCellChange = useCallback(
    (lineId: string, periodIndex: number, value: string) => {
      const key = getCellKey(lineId, periodIndex);
      setCellStates((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          currentValue: value,
        },
      }));
    },
    []
  );

  // Handle cell blur (save)
  const handleCellBlur = useCallback(
    async (lineId: string, periodIndex: number) => {
      const key = getCellKey(lineId, periodIndex);
      const state = cellStates[key];
      if (!state) return;

      // No change? Reset to idle
      if (state.currentValue === state.originalValue) {
        setCellStates((prev) => ({
          ...prev,
          [key]: { ...prev[key], status: "idle" },
        }));
        return;
      }

      // Parse value
      const cents = parseEuroToCents(state.currentValue);
      if (cents === null) {
        // Invalid input, reset to original
        setCellStates((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            status: "error",
            currentValue: state.originalValue,
          },
        }));
        setTimeout(() => {
          setCellStates((prev) => ({
            ...prev,
            [key]: { ...prev[key], status: "idle" },
          }));
        }, 2000);
        return;
      }

      // Set saving state
      setCellStates((prev) => ({
        ...prev,
        [key]: { ...prev[key], status: "saving" },
      }));

      try {
        const response = await fetch(`/api/cases/${caseId}/plan/values`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineId,
            periodIndex,
            valueType: "PLAN", // Default to PLAN for now
            amountCents: cents.toString(),
          }),
        });

        if (!response.ok) {
          throw new Error("Save failed");
        }

        // Success
        setCellStates((prev) => ({
          ...prev,
          [key]: {
            status: "saved",
            originalValue: formatCentsToEuro(cents),
            currentValue: formatCentsToEuro(cents),
          },
        }));

        // Reset to idle after showing success
        setTimeout(() => {
          setCellStates((prev) => ({
            ...prev,
            [key]: { ...prev[key], status: "idle" },
          }));
        }, 1500);

        // Trigger recalculation
        onValueChange();
      } catch {
        // Error - reset to original
        setCellStates((prev) => ({
          ...prev,
          [key]: {
            status: "error",
            originalValue: state.originalValue,
            currentValue: state.originalValue,
          },
        }));
        setTimeout(() => {
          setCellStates((prev) => ({
            ...prev,
            [key]: { ...prev[key], status: "idle" },
          }));
        }, 2000);
      }
    },
    [caseId, cellStates, onValueChange]
  );

  // Handle opening balance focus
  const handleOpeningBalanceFocus = useCallback(() => {
    setOpeningBalanceState((prev) => ({
      ...prev,
      status: "editing",
    }));
  }, []);

  // Handle opening balance change
  const handleOpeningBalanceInputChange = useCallback((value: string) => {
    setOpeningBalanceState((prev) => ({
      ...prev,
      currentValue: value,
    }));
  }, []);

  // Handle opening balance blur (save)
  const handleOpeningBalanceBlur = useCallback(async () => {
    const state = openingBalanceState;

    // No change? Reset to idle
    if (state.currentValue === state.originalValue) {
      setOpeningBalanceState((prev) => ({ ...prev, status: "idle" }));
      return;
    }

    // Parse value
    const cents = parseEuroToCents(state.currentValue);
    if (cents === null) {
      setOpeningBalanceState((prev) => ({
        ...prev,
        status: "error",
        currentValue: prev.originalValue,
      }));
      setTimeout(() => {
        setOpeningBalanceState((prev) => ({ ...prev, status: "idle" }));
      }, 2000);
      return;
    }

    // Set saving state
    setOpeningBalanceState((prev) => ({ ...prev, status: "saving" }));

    try {
      const response = await fetch(
        `/api/cases/${caseId}/plan/opening-balance`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            openingBalanceCents: cents.toString(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Save failed");
      }

      // Success
      setOpeningBalanceState({
        status: "saved",
        originalValue: formatCentsToEuro(cents),
        currentValue: formatCentsToEuro(cents),
      });

      setTimeout(() => {
        setOpeningBalanceState((prev) => ({ ...prev, status: "idle" }));
      }, 1500);

      onOpeningBalanceChange(cents);
    } catch {
      setOpeningBalanceState((prev) => ({
        status: "error",
        originalValue: prev.originalValue,
        currentValue: prev.originalValue,
      }));
      setTimeout(() => {
        setOpeningBalanceState((prev) => ({ ...prev, status: "idle" }));
      }, 2000);
    }
  }, [caseId, openingBalanceState, onOpeningBalanceChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent,
      lineId: string,
      periodIndex: number,
      allLines: { lineId: string }[],
      maxPeriod: number
    ) => {
      const currentLineIdx = allLines.findIndex((l) => l.lineId === lineId);

      if (e.key === "Tab") {
        e.preventDefault();
        const nextPeriod = e.shiftKey ? periodIndex - 1 : periodIndex + 1;

        if (nextPeriod >= 0 && nextPeriod < maxPeriod) {
          // Same line, next/prev period
          const nextKey = getCellKey(lineId, nextPeriod);
          inputRefs.current[nextKey]?.focus();
        } else if (!e.shiftKey && nextPeriod >= maxPeriod) {
          // Next line, first period
          const nextLineIdx = currentLineIdx + 1;
          if (nextLineIdx < allLines.length) {
            const nextKey = getCellKey(allLines[nextLineIdx].lineId, 0);
            inputRefs.current[nextKey]?.focus();
          }
        } else if (e.shiftKey && nextPeriod < 0) {
          // Previous line, last period
          const prevLineIdx = currentLineIdx - 1;
          if (prevLineIdx >= 0) {
            const prevKey = getCellKey(
              allLines[prevLineIdx].lineId,
              maxPeriod - 1
            );
            inputRefs.current[prevKey]?.focus();
          }
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        const key = getCellKey(lineId, periodIndex);
        setCellStates((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            status: "idle",
            currentValue: prev[key]?.originalValue || "",
          },
        }));
        (e.target as HTMLInputElement).blur();
      }
    },
    []
  );

  // Get cell background class
  const getCellBgClass = (status: CellStatus): string => {
    switch (status) {
      case "editing":
        return "bg-yellow-50 ring-2 ring-yellow-400";
      case "saving":
        return "bg-blue-50";
      case "saved":
        return "bg-green-50";
      case "error":
        return "bg-red-50";
      default:
        return "bg-white hover:bg-gray-50";
    }
  };

  // Separate inflows and outflows
  const inflowCategories = categories.filter((c) => c.flowType === "INFLOW");
  const outflowCategories = categories.filter((c) => c.flowType === "OUTFLOW");

  // Flatten all lines for keyboard navigation
  const allLines = categories.flatMap((c) => c.lines);

  // Calculate totals
  const weeklyInflowTotals = weeks.map((w) => w.totalInflowsCents);
  const weeklyOutflowTotals = weeks.map((w) => w.totalOutflowsCents);
  const weeklyNetCashflow = weeks.map((w) => w.netCashflowCents);
  const weeklyClosingBalance = weeks.map((w) => w.closingBalanceCents);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-[var(--border)]">
            <th
              className="text-left px-4 py-3 font-semibold text-[var(--foreground)] sticky left-0 bg-gray-50 z-10"
              style={{ minWidth: "250px" }}
            >
              Position
            </th>
            {weeks.map((week) => (
              <th
                key={week.weekOffset}
                className="text-right px-2 py-3 font-semibold text-[var(--foreground)]"
                style={{ minWidth: "100px" }}
              >
                {week.weekLabel}
                <span className="block text-xs font-normal text-[var(--muted)]">
                  {new Date(week.weekStartDate).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
              </th>
            ))}
            <th
              className="text-right px-4 py-3 font-semibold text-[var(--foreground)]"
              style={{ minWidth: "110px" }}
            >
              Summe
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Opening Balance */}
          <tr className="bg-blue-50 font-semibold border-b border-[var(--border)]">
            <td className="px-4 py-3 text-[var(--foreground)] sticky left-0 bg-blue-50 z-10">
              Anfangsbestand
            </td>
            <td className="px-2 py-2">
              <input
                type="text"
                value={openingBalanceState.currentValue}
                onChange={(e) =>
                  handleOpeningBalanceInputChange(e.target.value)
                }
                onFocus={handleOpeningBalanceFocus}
                onBlur={handleOpeningBalanceBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className={`w-full text-right px-2 py-1 rounded border border-gray-200 text-sm ${getCellBgClass(
                  openingBalanceState.status
                )}`}
              />
            </td>
            {weeks.slice(1).map((week, idx) => (
              <td
                key={week.weekOffset}
                className="text-right px-3 py-3 text-gray-500"
              >
                {formatDisplay(weeklyClosingBalance[idx])}
              </td>
            ))}
            <td className="text-right px-4 py-3 text-gray-400">-</td>
          </tr>

          {/* Inflows Section Header */}
          <tr className="bg-green-50">
            <td
              colSpan={weeks.length + 2}
              className="px-4 py-2 font-semibold text-green-800"
            >
              Einzahlungen
            </td>
          </tr>

          {/* Inflow Categories with Lines */}
          {inflowCategories.map((category) => (
            <>
              {/* Category Header */}
              <tr
                key={`cat-${category.categoryId}`}
                className="bg-green-50/50 border-b border-[var(--border)]"
              >
                <td className="px-4 py-2 font-semibold text-[var(--secondary)] sticky left-0 bg-green-50/50 z-10">
                  {category.categoryName}
                  <span className="text-xs text-gray-500 ml-2">
                    ({category.estateType === "ALTMASSE" ? "Alt" : "Neu"})
                  </span>
                </td>
                {category.weeklyTotalsCents.map((cents, idx) => (
                  <td
                    key={idx}
                    className="text-right px-3 py-2 font-medium text-green-700"
                  >
                    {formatDisplay(cents)}
                  </td>
                ))}
                <td className="text-right px-4 py-2 font-semibold text-green-700">
                  {formatDisplay(category.totalCents)}
                </td>
              </tr>

              {/* Lines within category */}
              {category.lines.map((line) => (
                <tr
                  key={line.lineId}
                  className="border-b border-gray-100 hover:bg-gray-50/50"
                >
                  <td className="px-4 py-2 pl-8 text-[var(--muted)] sticky left-0 bg-white z-10">
                    {line.lineName}
                  </td>
                  {line.weeklyValuesCents.map((cents, periodIndex) => {
                    const key = getCellKey(line.lineId, periodIndex);
                    const state = cellStates[key];
                    const displayValue =
                      state?.status === "editing" || state?.status === "saving"
                        ? state.currentValue
                        : formatCentsToEuro(cents);

                    return (
                      <td key={periodIndex} className="px-2 py-1">
                        <input
                          ref={(el) => {
                            inputRefs.current[key] = el;
                          }}
                          type="text"
                          value={displayValue}
                          onChange={(e) =>
                            handleCellChange(
                              line.lineId,
                              periodIndex,
                              e.target.value
                            )
                          }
                          onFocus={() =>
                            handleCellFocus(line.lineId, periodIndex, cents)
                          }
                          onBlur={() => handleCellBlur(line.lineId, periodIndex)}
                          onKeyDown={(e) =>
                            handleKeyDown(
                              e,
                              line.lineId,
                              periodIndex,
                              allLines,
                              weeks.length
                            )
                          }
                          className={`w-full text-right px-2 py-1 rounded border border-gray-200 text-sm transition-colors ${getCellBgClass(
                            state?.status || "idle"
                          )}`}
                        />
                      </td>
                    );
                  })}
                  <td className="text-right px-4 py-2 font-medium text-[var(--secondary)]">
                    {formatDisplay(line.totalCents)}
                  </td>
                </tr>
              ))}
            </>
          ))}

          {/* Inflow Subtotal */}
          <tr className="bg-green-100 font-semibold border-b border-[var(--border)]">
            <td className="px-4 py-2 text-green-800 sticky left-0 bg-green-100 z-10">
              Summe Einzahlungen
            </td>
            {weeklyInflowTotals.map((cents, idx) => (
              <td key={idx} className="text-right px-3 py-2 text-green-800">
                {formatDisplay(cents)}
              </td>
            ))}
            <td className="text-right px-4 py-2 text-green-800">
              {formatDisplay(
                weeklyInflowTotals.reduce((a, b) => a + b, BigInt(0))
              )}
            </td>
          </tr>

          {/* Outflows Section Header */}
          <tr className="bg-red-50">
            <td
              colSpan={weeks.length + 2}
              className="px-4 py-2 font-semibold text-red-800"
            >
              Auszahlungen
            </td>
          </tr>

          {/* Outflow Categories with Lines */}
          {outflowCategories.map((category) => (
            <>
              {/* Category Header */}
              <tr
                key={`cat-${category.categoryId}`}
                className="bg-red-50/50 border-b border-[var(--border)]"
              >
                <td className="px-4 py-2 font-semibold text-[var(--secondary)] sticky left-0 bg-red-50/50 z-10">
                  {category.categoryName}
                  <span className="text-xs text-gray-500 ml-2">
                    ({category.estateType === "ALTMASSE" ? "Alt" : "Neu"})
                  </span>
                </td>
                {category.weeklyTotalsCents.map((cents, idx) => (
                  <td
                    key={idx}
                    className="text-right px-3 py-2 font-medium text-red-700"
                  >
                    -{formatDisplay(cents)}
                  </td>
                ))}
                <td className="text-right px-4 py-2 font-semibold text-red-700">
                  -{formatDisplay(category.totalCents)}
                </td>
              </tr>

              {/* Lines within category */}
              {category.lines.map((line) => (
                <tr
                  key={line.lineId}
                  className="border-b border-gray-100 hover:bg-gray-50/50"
                >
                  <td className="px-4 py-2 pl-8 text-[var(--muted)] sticky left-0 bg-white z-10">
                    {line.lineName}
                  </td>
                  {line.weeklyValuesCents.map((cents, periodIndex) => {
                    const key = getCellKey(line.lineId, periodIndex);
                    const state = cellStates[key];
                    const displayValue =
                      state?.status === "editing" || state?.status === "saving"
                        ? state.currentValue
                        : formatCentsToEuro(cents);

                    return (
                      <td key={periodIndex} className="px-2 py-1">
                        <input
                          ref={(el) => {
                            inputRefs.current[key] = el;
                          }}
                          type="text"
                          value={displayValue}
                          onChange={(e) =>
                            handleCellChange(
                              line.lineId,
                              periodIndex,
                              e.target.value
                            )
                          }
                          onFocus={() =>
                            handleCellFocus(line.lineId, periodIndex, cents)
                          }
                          onBlur={() => handleCellBlur(line.lineId, periodIndex)}
                          onKeyDown={(e) =>
                            handleKeyDown(
                              e,
                              line.lineId,
                              periodIndex,
                              allLines,
                              weeks.length
                            )
                          }
                          className={`w-full text-right px-2 py-1 rounded border border-gray-200 text-sm transition-colors ${getCellBgClass(
                            state?.status || "idle"
                          )}`}
                        />
                      </td>
                    );
                  })}
                  <td className="text-right px-4 py-2 font-medium text-[var(--secondary)]">
                    -{formatDisplay(line.totalCents)}
                  </td>
                </tr>
              ))}
            </>
          ))}

          {/* Outflow Subtotal */}
          <tr className="bg-red-100 font-semibold border-b border-[var(--border)]">
            <td className="px-4 py-2 text-red-800 sticky left-0 bg-red-100 z-10">
              Summe Auszahlungen
            </td>
            {weeklyOutflowTotals.map((cents, idx) => (
              <td key={idx} className="text-right px-3 py-2 text-red-800">
                -{formatDisplay(cents)}
              </td>
            ))}
            <td className="text-right px-4 py-2 text-red-800">
              -{formatDisplay(
                weeklyOutflowTotals.reduce((a, b) => a + b, BigInt(0))
              )}
            </td>
          </tr>

          {/* Net Cashflow */}
          <tr className="bg-gray-100 font-semibold border-b border-[var(--border)]">
            <td className="px-4 py-3 text-[var(--foreground)] sticky left-0 bg-gray-100 z-10">
              Netto-Cashflow
            </td>
            {weeklyNetCashflow.map((cents, idx) => (
              <td
                key={idx}
                className={`text-right px-3 py-3 ${
                  cents < BigInt(0)
                    ? "text-red-600"
                    : cents > BigInt(0)
                    ? "text-green-600"
                    : ""
                }`}
              >
                {formatDisplay(cents)}
              </td>
            ))}
            <td
              className={`text-right px-4 py-3 ${
                weeklyNetCashflow.reduce((a, b) => a + b, BigInt(0)) < BigInt(0)
                  ? "text-red-600"
                  : "text-green-600"
              }`}
            >
              {formatDisplay(
                weeklyNetCashflow.reduce((a, b) => a + b, BigInt(0))
              )}
            </td>
          </tr>

          {/* Closing Balance */}
          <tr className="bg-blue-100 font-bold border-b border-[var(--border)]">
            <td className="px-4 py-3 text-[var(--foreground)] sticky left-0 bg-blue-100 z-10">
              Endbestand
            </td>
            {weeklyClosingBalance.map((cents, idx) => (
              <td
                key={idx}
                className={`text-right px-3 py-3 ${
                  cents < BigInt(0) ? "text-red-600" : ""
                }`}
              >
                {formatDisplay(cents)}
              </td>
            ))}
            <td
              className={`text-right px-4 py-3 ${
                weeklyClosingBalance[weeklyClosingBalance.length - 1] <
                BigInt(0)
                  ? "text-red-600"
                  : ""
              }`}
            >
              {formatDisplay(
                weeklyClosingBalance[weeklyClosingBalance.length - 1]
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-xs text-[var(--muted)]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-50 border border-yellow-400 rounded"></div>
          <span>Wird bearbeitet</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded"></div>
          <span>Wird gespeichert</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
          <span>Gespeichert</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
          <span>Fehler</span>
        </div>
      </div>
    </div>
  );
}
