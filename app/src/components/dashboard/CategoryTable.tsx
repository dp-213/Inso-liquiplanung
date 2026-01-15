"use client";

import { useMemo } from "react";
import {
  CaseDashboardConfig,
  DashboardCalculationData,
} from "@/lib/case-dashboard/types";
import { getCategoryDisplayLabel, getOrderedVisibleCategories } from "@/lib/case-dashboard/defaults";

interface CategoryTableProps {
  config: CaseDashboardConfig;
  data: DashboardCalculationData;
  viewMode: "internal" | "external";
}

/**
 * Configurable category table for displaying cashflow data
 */
export default function CategoryTable({
  config,
  data,
  viewMode,
}: CategoryTableProps) {
  const viewConfig = viewMode === "internal"
    ? config.viewVariants.internal.config
    : config.viewVariants.external.config;

  // Format currency
  const formatCurrency = (cents: bigint): string => {
    const euros = Number(cents) / 100;
    return euros.toLocaleString("de-DE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Get value class
  const getValueClass = (cents: bigint, isOutflow: boolean = false): string => {
    if (isOutflow) return "";
    if (cents < BigInt(0)) return "text-red-600";
    if (cents > BigInt(0)) return "text-green-600";
    return "";
  };

  // Get ordered visible inflow categories
  const inflowCategories = useMemo(() => {
    const ordered = getOrderedVisibleCategories("INFLOW", config);
    return ordered
      .map((catId) => data.categories.find((c) => c.categoryId === catId))
      .filter(Boolean);
  }, [config, data.categories]);

  // Get ordered visible outflow categories
  const outflowCategories = useMemo(() => {
    const ordered = getOrderedVisibleCategories("OUTFLOW", config);
    return ordered
      .map((catId) => data.categories.find((c) => c.categoryId === catId))
      .filter(Boolean);
  }, [config, data.categories]);

  // Calculate totals
  const weeklyInflowTotals = useMemo(() => {
    return data.weeks.map((w) => w.totalInflowsCents);
  }, [data.weeks]);

  const weeklyOutflowTotals = useMemo(() => {
    return data.weeks.map((w) => w.totalOutflowsCents);
  }, [data.weeks]);

  const weeklyNetCashflow = useMemo(() => {
    return data.weeks.map((w) => w.netCashflowCents);
  }, [data.weeks]);

  const weeklyClosingBalance = useMemo(() => {
    return data.weeks.map((w) => w.closingBalanceCents);
  }, [data.weeks]);

  const totalInflows = weeklyInflowTotals.reduce((a, b) => a + b, BigInt(0));
  const totalOutflows = weeklyOutflowTotals.reduce((a, b) => a + b, BigInt(0));
  const totalNet = weeklyNetCashflow.reduce((a, b) => a + b, BigInt(0));

  // Check if category is emphasized
  const isEmphasized = (categoryId: string): boolean => {
    return config.emphasizedCategories.includes(categoryId);
  };

  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse ${config.table.compactMode ? "text-sm" : ""}`}>
        <thead>
          <tr className="bg-gray-50 border-b border-[var(--border)]">
            <th
              className={`text-left px-4 py-3 font-semibold text-[var(--foreground)] ${
                config.table.freezeFirstColumn ? "sticky left-0 bg-gray-50 z-10" : ""
              }`}
              style={{ minWidth: "200px" }}
            >
              Position
            </th>
            {data.weeks.map((week) => (
              <th
                key={week.weekOffset}
                className="text-right px-3 py-3 font-semibold text-[var(--foreground)]"
                style={{ minWidth: "90px" }}
              >
                {config.table.showWeekNumbers && week.weekLabel}
                {config.table.showDateRanges && (
                  <span className="block text-xs font-normal text-[var(--muted)]">
                    {new Date(week.weekStartDate).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                )}
              </th>
            ))}
            <th
              className="text-right px-4 py-3 font-semibold text-[var(--foreground)]"
              style={{ minWidth: "100px" }}
            >
              Summe
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Opening Balance */}
          <tr className="bg-blue-50 font-semibold border-b border-[var(--border)]">
            <td
              className={`px-4 py-3 text-[var(--foreground)] ${
                config.table.freezeFirstColumn ? "sticky left-0 bg-blue-50 z-10" : ""
              }`}
            >
              Anfangsbestand
            </td>
            {data.weeks.map((week, idx) => (
              <td key={week.weekOffset} className="text-right px-3 py-3">
                {idx === 0
                  ? formatCurrency(data.kpis.openingBalanceCents)
                  : formatCurrency(data.weeks[idx - 1].closingBalanceCents)}
              </td>
            ))}
            <td className="text-right px-4 py-3">-</td>
          </tr>

          {/* Inflows Section Header */}
          <tr className="bg-green-50">
            <td
              colSpan={data.weeks.length + 2}
              className="px-4 py-2 font-semibold text-green-800"
            >
              Einzahlungen
            </td>
          </tr>

          {/* Inflow Categories */}
          {inflowCategories.map((category) => {
            if (!category) return null;
            const displayLabel = getCategoryDisplayLabel(category.categoryId, config);
            const emphasized = isEmphasized(category.categoryId);
            const estateLabel = viewConfig.showEstateTypes
              ? ` (${category.estateType === "ALTMASSE" ? "Alt" : "Neu"})`
              : "";

            return (
              <tr
                key={category.categoryId}
                className={`border-b border-[var(--border)] ${
                  emphasized ? "bg-yellow-50" : ""
                }`}
              >
                <td
                  className={`px-4 py-2 ${
                    emphasized ? "font-semibold" : "font-medium"
                  } text-[var(--secondary)] ${
                    config.table.freezeFirstColumn
                      ? `sticky left-0 z-10 ${emphasized ? "bg-yellow-50" : "bg-white"}`
                      : ""
                  }`}
                >
                  {displayLabel}{estateLabel}
                </td>
                {category.weeklyTotalsCents.map((cents, idx) => (
                  <td
                    key={idx}
                    className={`text-right px-3 py-2 ${getValueClass(cents)}`}
                  >
                    {formatCurrency(cents)}
                  </td>
                ))}
                <td className={`text-right px-4 py-2 font-medium ${getValueClass(category.totalCents)}`}>
                  {formatCurrency(category.totalCents)}
                </td>
              </tr>
            );
          })}

          {/* Inflow Subtotal */}
          {config.aggregations.showSubtotals && (
            <tr className="bg-green-100 font-semibold border-b border-[var(--border)]">
              <td
                className={`px-4 py-2 text-green-800 ${
                  config.table.freezeFirstColumn ? "sticky left-0 bg-green-100 z-10" : ""
                }`}
              >
                Summe Einzahlungen
              </td>
              {weeklyInflowTotals.map((cents, idx) => (
                <td key={idx} className="text-right px-3 py-2 text-green-800">
                  {formatCurrency(cents)}
                </td>
              ))}
              <td className="text-right px-4 py-2 text-green-800">
                {formatCurrency(totalInflows)}
              </td>
            </tr>
          )}

          {/* Outflows Section Header */}
          <tr className="bg-red-50">
            <td
              colSpan={data.weeks.length + 2}
              className="px-4 py-2 font-semibold text-red-800"
            >
              Auszahlungen
            </td>
          </tr>

          {/* Outflow Categories */}
          {outflowCategories.map((category) => {
            if (!category) return null;
            const displayLabel = getCategoryDisplayLabel(category.categoryId, config);
            const emphasized = isEmphasized(category.categoryId);
            const estateLabel = viewConfig.showEstateTypes
              ? ` (${category.estateType === "ALTMASSE" ? "Alt" : "Neu"})`
              : "";

            return (
              <tr
                key={category.categoryId}
                className={`border-b border-[var(--border)] ${
                  emphasized ? "bg-yellow-50" : ""
                }`}
              >
                <td
                  className={`px-4 py-2 ${
                    emphasized ? "font-semibold" : "font-medium"
                  } text-[var(--secondary)] ${
                    config.table.freezeFirstColumn
                      ? `sticky left-0 z-10 ${emphasized ? "bg-yellow-50" : "bg-white"}`
                      : ""
                  }`}
                >
                  {displayLabel}{estateLabel}
                </td>
                {category.weeklyTotalsCents.map((cents, idx) => (
                  <td key={idx} className="text-right px-3 py-2 text-red-600">
                    -{formatCurrency(cents)}
                  </td>
                ))}
                <td className="text-right px-4 py-2 font-medium text-red-600">
                  -{formatCurrency(category.totalCents)}
                </td>
              </tr>
            );
          })}

          {/* Outflow Subtotal */}
          {config.aggregations.showSubtotals && (
            <tr className="bg-red-100 font-semibold border-b border-[var(--border)]">
              <td
                className={`px-4 py-2 text-red-800 ${
                  config.table.freezeFirstColumn ? "sticky left-0 bg-red-100 z-10" : ""
                }`}
              >
                Summe Auszahlungen
              </td>
              {weeklyOutflowTotals.map((cents, idx) => (
                <td key={idx} className="text-right px-3 py-2 text-red-800">
                  -{formatCurrency(cents)}
                </td>
              ))}
              <td className="text-right px-4 py-2 text-red-800">
                -{formatCurrency(totalOutflows)}
              </td>
            </tr>
          )}

          {/* Net Cashflow */}
          <tr className="bg-gray-100 font-semibold border-b border-[var(--border)]">
            <td
              className={`px-4 py-3 text-[var(--foreground)] ${
                config.table.freezeFirstColumn ? "sticky left-0 bg-gray-100 z-10" : ""
              }`}
            >
              Netto-Cashflow
            </td>
            {weeklyNetCashflow.map((cents, idx) => (
              <td
                key={idx}
                className={`text-right px-3 py-3 ${
                  config.table.highlightNegative && cents < BigInt(0)
                    ? "text-red-600"
                    : cents > BigInt(0)
                    ? "text-green-600"
                    : ""
                }`}
              >
                {formatCurrency(cents)}
              </td>
            ))}
            <td
              className={`text-right px-4 py-3 ${
                config.table.highlightNegative && totalNet < BigInt(0)
                  ? "text-red-600"
                  : totalNet > BigInt(0)
                  ? "text-green-600"
                  : ""
              }`}
            >
              {formatCurrency(totalNet)}
            </td>
          </tr>

          {/* Closing Balance */}
          {config.aggregations.showRunningBalance && (
            <tr className="bg-blue-100 font-bold border-b border-[var(--border)]">
              <td
                className={`px-4 py-3 text-[var(--foreground)] ${
                  config.table.freezeFirstColumn ? "sticky left-0 bg-blue-100 z-10" : ""
                }`}
              >
                Endbestand
              </td>
              {weeklyClosingBalance.map((cents, idx) => (
                <td
                  key={idx}
                  className={`text-right px-3 py-3 ${
                    config.table.highlightNegative && cents < BigInt(0)
                      ? "text-red-600"
                      : ""
                  }`}
                >
                  {formatCurrency(cents)}
                </td>
              ))}
              <td
                className={`text-right px-4 py-3 ${
                  config.table.highlightNegative &&
                  weeklyClosingBalance[weeklyClosingBalance.length - 1] < BigInt(0)
                    ? "text-red-600"
                    : ""
                }`}
              >
                {formatCurrency(weeklyClosingBalance[weeklyClosingBalance.length - 1])}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
