"use client";

import { useState, useEffect, useCallback } from "react";
import {
  cn,
  formatEURInput,
  parseCentsFromEUR,
  type AssumptionJSON,
  type ForecastPeriodJSON,
} from "./types";

interface AssumptionDetailDrawerProps {
  assumption: AssumptionJSON;
  periods: ForecastPeriodJSON[];
  periodCount: number;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => void;
  onToggle: (assumption: AssumptionJSON) => void;
  onClose: () => void;
}

export default function AssumptionDetailDrawer({
  assumption,
  periods,
  periodCount,
  onSave,
  onDelete,
  onToggle,
  onClose,
}: AssumptionDetailDrawerProps) {
  // Formular-State
  const [categoryLabel, setCategoryLabel] = useState(assumption.categoryLabel);
  const [categoryKey, setCategoryKey] = useState(assumption.categoryKey);
  const [flowType, setFlowType] = useState(assumption.flowType);
  const [assumptionType, setAssumptionType] = useState(assumption.assumptionType);
  const [baseAmount, setBaseAmount] = useState(formatEURInput(assumption.baseAmountCents));
  const [baseAmountSource, setBaseAmountSource] = useState(assumption.baseAmountSource);
  const [baseAmountNote, setBaseAmountNote] = useState(assumption.baseAmountNote || "");
  const [growthFactor, setGrowthFactor] = useState(
    assumption.growthFactorPercent !== null && assumption.growthFactorPercent !== undefined
      ? String(assumption.growthFactorPercent)
      : ""
  );
  const [startPeriod, setStartPeriod] = useState(assumption.startPeriodIndex);
  const [endPeriod, setEndPeriod] = useState(assumption.endPeriodIndex);
  // Neue Felder: Methodik & Risiko
  const [method, setMethod] = useState(assumption.method || "");
  const [baseReferencePeriod, setBaseReferencePeriod] = useState(assumption.baseReferencePeriod || "");
  const [riskProbability, setRiskProbability] = useState(
    assumption.riskProbability !== null && assumption.riskProbability !== undefined
      ? String(Math.round(assumption.riskProbability * 100))
      : ""
  );
  const [riskImpactCents, setRiskImpactCents] = useState(
    assumption.riskImpactCents ? formatEURInput(assumption.riskImpactCents) : ""
  );
  const [riskComment, setRiskComment] = useState(assumption.riskComment || "");
  const [visibilityScope, setVisibilityScope] = useState(assumption.visibilityScope || "INTERN");

  const [saving, setSaving] = useState(false);

  // Escape schließt Drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const getPeriodLabel = useCallback((idx: number) => {
    const p = periods.find(p => p.periodIndex === idx);
    return p?.periodLabel || `Periode ${idx}`;
  }, [periods]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        id: assumption.id,
        categoryKey: categoryKey || categoryLabel.toUpperCase().replace(/[^A-ZÄÖÜ0-9]/gi, "_"),
        categoryLabel,
        flowType,
        assumptionType,
        baseAmountCents: parseCentsFromEUR(baseAmount),
        baseAmountSource,
        baseAmountNote: baseAmountNote || null,
        growthFactorPercent: growthFactor ? parseFloat(growthFactor.replace(",", ".")) : null,
        startPeriodIndex: startPeriod,
        endPeriodIndex: endPeriod,
        // Neue Felder
        method: method || null,
        baseReferencePeriod: baseReferencePeriod || null,
        riskProbability: riskProbability ? parseFloat(riskProbability) / 100 : null,
        riskImpactCents: riskImpactCents ? parseCentsFromEUR(riskImpactCents) : null,
        riskComment: riskComment || null,
        visibilityScope: visibilityScope || null,
      });
      onClose();
    } catch (err) {
      console.error("Speichern fehlgeschlagen:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        style={{ animation: "150ms ease-out forwards backdropFadeIn" }}
        onClick={onClose}
      />

      {/* SlideOver */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col"
        style={{ animation: "200ms ease-out forwards drawerSlideIn" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--foreground)]">Annahme bearbeiten</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100 text-[var(--muted)]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body + Footer als ein Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Bezeichnung + Key */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Bezeichnung *</label>
                <input
                  type="text"
                  value={categoryLabel}
                  onChange={(e) => setCategoryLabel(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Schlüssel</label>
                <input
                  type="text"
                  value={categoryKey}
                  onChange={(e) => setCategoryKey(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm font-mono"
                />
              </div>
            </div>

            {/* Richtung + Typ */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Richtung</label>
                <select
                  value={flowType}
                  onChange={(e) => setFlowType(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                >
                  <option value="INFLOW">Einzahlung</option>
                  <option value="OUTFLOW">Auszahlung</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Annahme-Typ</label>
                <select
                  value={assumptionType}
                  onChange={(e) => setAssumptionType(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                >
                  <option value="RUN_RATE">Laufend (Run Rate)</option>
                  <option value="FIXED">Fixbetrag</option>
                  <option value="ONE_TIME">Einmalig</option>
                  <option value="PERCENTAGE_OF_REVENUE">% der Einnahmen</option>
                </select>
              </div>
            </div>

            {/* Betrag */}
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                {assumptionType === "PERCENTAGE_OF_REVENUE" ? "Prozentsatz (%)" : "Betrag (EUR) *"}
              </label>
              <input
                type="text"
                value={baseAmount}
                onChange={(e) => setBaseAmount(e.target.value)}
                placeholder={assumptionType === "PERCENTAGE_OF_REVENUE" ? "z.B. 10,00" : "z.B. 40.000,00"}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                required
              />
            </div>

            {/* Quelle */}
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Quelle / Begründung *</label>
              <input
                type="text"
                value={baseAmountSource}
                onChange={(e) => setBaseAmountSource(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                required
              />
            </div>

            {/* Notiz */}
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Notiz</label>
              <input
                type="text"
                value={baseAmountNote}
                onChange={(e) => setBaseAmountNote(e.target.value)}
                placeholder="Optionale Erläuterung"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
              />
            </div>

            {/* Wachstumsfaktor */}
            {(assumptionType === "RUN_RATE" || assumptionType === "FIXED") && (
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                  Wachstumsfaktor (%/Periode)
                </label>
                <input
                  type="text"
                  value={growthFactor}
                  onChange={(e) => setGrowthFactor(e.target.value)}
                  placeholder="z.B. -5 für 5% Rückgang"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                />
              </div>
            )}

            {/* === Methodik & Risiko (neue Sektion) === */}
            <div className="pt-3 border-t border-[var(--border)]">
              <h3 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wide mb-3">Methodik & Risiko</h3>

              {/* Methode */}
              <div className="mb-3">
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Methode</label>
                <input
                  type="text"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  placeholder="z.B. Durchschnitt IST Dez–Jan"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                />
              </div>

              {/* Referenzzeitraum */}
              <div className="mb-3">
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Referenzzeitraum</label>
                <input
                  type="text"
                  value={baseReferencePeriod}
                  onChange={(e) => setBaseReferencePeriod(e.target.value)}
                  placeholder="z.B. IST Dez 2025 – Jan 2026"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                />
              </div>

              {/* Risiko: Wahrscheinlichkeit + Auswirkung */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Abw.-Wahrscheinlichkeit (%)</label>
                  <input
                    type="text"
                    value={riskProbability}
                    onChange={(e) => setRiskProbability(e.target.value)}
                    placeholder="z.B. 15"
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Auswirkung (EUR)</label>
                  <input
                    type="text"
                    value={riskImpactCents}
                    onChange={(e) => setRiskImpactCents(e.target.value)}
                    placeholder="z.B. -4.800,00"
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Risiko-Kommentar */}
              <div className="mb-3">
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Risiko-Begründung</label>
                <input
                  type="text"
                  value={riskComment}
                  onChange={(e) => setRiskComment(e.target.value)}
                  placeholder="z.B. Versichertenzahlen bei Arztwechsel"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                />
              </div>

              {/* Sichtbarkeit */}
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Sichtbarkeit</label>
                <select
                  value={visibilityScope}
                  onChange={(e) => setVisibilityScope(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                >
                  <option value="INTERN">Nur intern</option>
                  <option value="EXTERN">Auch im Portal sichtbar</option>
                </select>
              </div>
            </div>

            {/* Perioden-Range mit Monatsnamen */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Von Periode</label>
                <select
                  value={startPeriod}
                  onChange={(e) => setStartPeriod(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                >
                  {Array.from({ length: periodCount }, (_, i) => (
                    <option key={i} value={i}>{getPeriodLabel(i)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Bis Periode</label>
                <select
                  value={endPeriod}
                  onChange={(e) => setEndPeriod(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm"
                >
                  {Array.from({ length: periodCount }, (_, i) => (
                    <option key={i} value={i}>{getPeriodLabel(i)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Aktiviert/Deaktiviert Toggle */}
            <div className="flex items-center justify-between py-2 border-t border-[var(--border)]">
              <div>
                <span className="text-sm font-medium text-[var(--foreground)]">Aktiv</span>
                <p className="text-xs text-[var(--muted)]">Deaktivierte Annahmen werden nicht berechnet</p>
              </div>
              <button
                type="button"
                onClick={() => onToggle(assumption)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  assumption.isActive ? "bg-[var(--primary)]" : "bg-gray-300"
                )}
              >
                <span className={cn(
                  "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                  assumption.isActive ? "translate-x-6" : "translate-x-1"
                )} />
              </button>
            </div>

            {/* Löschen */}
            <div className="pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => onDelete(assumption.id)}
                className="text-sm text-red-500 hover:text-red-700 font-medium"
              >
                Annahme löschen
              </button>
            </div>
          </div>

          {/* Footer – innerhalb des Form */}
          <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[var(--secondary)] hover:text-[var(--foreground)] transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Speichert..." : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
