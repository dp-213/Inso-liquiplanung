"use client";

import { useState, useRef, useCallback } from "react";
import { cn, parseCentsFromEUR, type ForecastPeriodJSON } from "./types";

interface QuickAddRowProps {
  flowType: "INFLOW" | "OUTFLOW";
  caseId: string;
  periods: ForecastPeriodJSON[];
  periodCount: number;
  onCreated: () => void;
}

export default function QuickAddRow({
  flowType,
  caseId,
  periods,
  periodCount,
  onCreated,
}: QuickAddRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formular-State
  const [label, setLabel] = useState("");
  const [type, setType] = useState("RUN_RATE");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");

  const labelRef = useRef<HTMLInputElement>(null);

  // Erste Prognose-Periode finden
  const firstForecastIdx = periods.find(p => p.dataSource === "FORECAST")?.periodIndex ?? 0;

  const resetForm = useCallback(() => {
    setLabel("");
    setType("RUN_RATE");
    setAmount("");
    setSource("");
  }, []);

  const handleSave = useCallback(async () => {
    if (!label.trim() || !amount.trim() || !source.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const categoryKey = label.trim().toUpperCase().replace(/[^A-ZÄÖÜ0-9]/gi, "_");
      const res = await fetch(`/api/cases/${caseId}/forecast/assumptions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryKey,
          categoryLabel: label.trim(),
          flowType,
          assumptionType: type,
          baseAmountCents: parseCentsFromEUR(amount),
          baseAmountSource: source.trim(),
          startPeriodIndex: firstForecastIdx,
          endPeriodIndex: periodCount - 1,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Erstellen fehlgeschlagen");
      }

      resetForm();
      onCreated();
      // Formular bleibt offen für nächsten Eintrag (Bulk-Modus)
      setTimeout(() => labelRef.current?.focus(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Erstellen");
    } finally {
      setSaving(false);
    }
  }, [label, amount, source, type, flowType, caseId, firstForecastIdx, periodCount, resetForm, onCreated]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      setIsOpen(false);
      resetForm();
    }
  }, [handleSave, resetForm]);

  // Geschlossen: nur "+ Neue Zeile" Button
  if (!isOpen) {
    return (
      <tr className="border-b border-[var(--border)]">
        <td
          colSpan={periods.length + 1}
          className="p-1 px-3 pl-6 sticky left-0 bg-white z-10"
        >
          <button
            onClick={() => {
              setIsOpen(true);
              setTimeout(() => labelRef.current?.focus(), 50);
            }}
            className="text-xs text-[var(--primary)] hover:text-[var(--primary)]/80 font-medium py-1"
          >
            + Neue {flowType === "INFLOW" ? "Einzahlung" : "Auszahlung"}
          </button>
        </td>
      </tr>
    );
  }

  // Offen: 4-Felder-Inline-Formular
  return (
    <tr className="border-b border-[var(--border)] bg-yellow-50/50">
      <td
        colSpan={periods.length + 1}
        className="p-2 px-3 pl-6"
      >
        <div className="flex items-center gap-2" onKeyDown={handleKeyDown}>
          {/* Bezeichnung */}
          <input
            ref={labelRef}
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Bezeichnung"
            className="px-2 py-1.5 border border-[var(--border)] rounded text-sm w-48 focus:ring-2 focus:ring-yellow-400 focus:outline-none"
          />

          {/* Typ */}
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-2 py-1.5 border border-[var(--border)] rounded text-sm w-28 focus:ring-2 focus:ring-yellow-400 focus:outline-none"
          >
            <option value="RUN_RATE">Laufend</option>
            <option value="FIXED">Fixbetrag</option>
            <option value="ONE_TIME">Einmalig</option>
          </select>

          {/* Betrag */}
          <div className="relative">
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Betrag"
              className="px-2 py-1.5 border border-[var(--border)] rounded text-sm w-32 text-right pr-8 focus:ring-2 focus:ring-yellow-400 focus:outline-none"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)]">EUR</span>
          </div>

          {/* Quelle */}
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Quelle / Begründung"
            className="px-2 py-1.5 border border-[var(--border)] rounded text-sm flex-1 min-w-[160px] focus:ring-2 focus:ring-yellow-400 focus:outline-none"
          />

          {/* Aktionen */}
          <button
            onClick={handleSave}
            disabled={saving || !label.trim() || !amount.trim() || !source.trim()}
            className={cn(
              "p-1.5 rounded transition-colors",
              saving
                ? "text-gray-400"
                : "text-green-600 hover:bg-green-50"
            )}
            title="Speichern (Enter)"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <button
            onClick={() => { setIsOpen(false); resetForm(); }}
            className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Abbrechen (Escape)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-600 mt-1 ml-0.5">{error}</p>
        )}
        <p className="text-[10px] text-[var(--muted)] mt-1 ml-0.5">
          Enter = Speichern & nächste Zeile &middot; Escape = Schließen
        </p>
      </td>
    </tr>
  );
}
