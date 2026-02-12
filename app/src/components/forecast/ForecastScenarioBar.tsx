"use client";

import { useState } from "react";
import { formatEUR, formatEURInput, parseCentsFromEUR, type ForecastMeta } from "./types";

interface ForecastScenarioBarProps {
  meta: ForecastMeta;
  calculating: boolean;
  onSaveOpeningBalance: (cents: string, source: string) => Promise<void>;
  onSyncIst: () => Promise<void>;
}

export default function ForecastScenarioBar({
  meta,
  calculating,
  onSaveOpeningBalance,
  onSyncIst,
}: ForecastScenarioBarProps) {
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");

  return (
    <div className="admin-card p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {/* Eröffnungssaldo – Inline-Edit */}
        <div>
          <span className="text-xs text-[var(--muted)] font-semibold uppercase tracking-wider">Eröffnungssaldo</span>
          {editingBalance ? (
            <div className="mt-1 space-y-1">
              <input
                type="text"
                value={balanceInput}
                onChange={(e) => setBalanceInput(e.target.value)}
                placeholder="z.B. 50.000,00"
                className="w-full px-2 py-1 border border-[var(--border)] rounded text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditingBalance(false);
                  if (e.key === "Enter") {
                    const cents = parseCentsFromEUR(balanceInput);
                    onSaveOpeningBalance(cents, "Manuell eingegeben");
                    setEditingBalance(false);
                  }
                }}
              />
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    const cents = parseCentsFromEUR(balanceInput);
                    onSaveOpeningBalance(cents, "Manuell eingegeben");
                    setEditingBalance(false);
                  }}
                  className="px-2 py-0.5 text-xs bg-[var(--primary)] text-white rounded hover:opacity-90"
                >
                  Speichern
                </button>
                <button
                  onClick={() => setEditingBalance(false)}
                  className="px-2 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <div className="group">
              <button
                onClick={() => {
                  setBalanceInput(formatEURInput(meta.openingBalanceCents));
                  setEditingBalance(true);
                }}
                className="font-semibold mt-0.5 hover:text-[var(--primary)] transition-colors text-left"
                title="Klicken zum Bearbeiten"
              >
                {formatEUR(meta.openingBalanceCents)}
                <svg className="w-3 h-3 inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <p className="text-xs text-[var(--muted)] truncate" title={meta.openingBalanceSource}>{meta.openingBalanceSource}</p>
            </div>
          )}
        </div>

        {/* IST-Perioden */}
        <div>
          <span className="text-xs text-[var(--muted)] font-semibold uppercase tracking-wider">IST-Perioden</span>
          <p className="font-semibold mt-0.5">
            {meta.istPeriodCount > 0
              ? `${meta.istPeriodCount} von ${meta.periodCount} (automatisch)`
              : "Keine IST-Daten"
            }
          </p>
          <p className="text-xs text-[var(--muted)]">
            {meta.forecastPeriodCount} Prognose-Perioden
          </p>
        </div>

        {/* Periodentyp */}
        <div>
          <span className="text-xs text-[var(--muted)] font-semibold uppercase tracking-wider">Periodentyp</span>
          <p className="font-semibold mt-0.5">
            {meta.periodType === "MONTHLY" ? "Monatlich" : "Wöchentlich"}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {meta.periodCount} Perioden gesamt
          </p>
        </div>

        {/* Kreditlinie / Rückstellungen */}
        <div>
          <span className="text-xs text-[var(--muted)] font-semibold uppercase tracking-wider">Kreditlinie / Rückstellungen</span>
          <p className="font-semibold mt-0.5">{formatEUR(meta.creditLineCents)}</p>
          <p className="text-xs text-[var(--muted)] truncate" title={meta.creditLineSource}>
            {meta.creditLineSource}
          </p>
          {Number(meta.reservesTotalCents) > 0 && (
            <p className="text-xs text-amber-600 mt-0.5">
              Rückstellungen: {formatEUR(meta.reservesTotalCents)}
            </p>
          )}
        </div>
      </div>

      {/* IST aktualisieren Button */}
      <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center gap-2">
        <button
          onClick={onSyncIst}
          disabled={calculating}
          className="px-3 py-1.5 text-xs font-semibold text-[var(--primary)] border border-[var(--primary)] rounded-lg hover:bg-[var(--primary)]/10 transition-colors disabled:opacity-50"
        >
          {calculating ? "Wird aktualisiert..." : "IST-Daten aktualisieren"}
        </button>
        <span className="text-xs text-[var(--muted)]">
          Aktualisiert IST-Perioden und bietet an, den Eröffnungssaldo anzupassen
        </span>
      </div>
    </div>
  );
}
