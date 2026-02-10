"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface InsolvencyEffect {
  id: string;
  name: string;
  description: string | null;
  effectType: "INFLOW" | "OUTFLOW";
  effectGroup: string;
  periodIndex: number;
  amountCents: string;
  isActive: boolean;
  isAvailabilityOnly?: boolean;
}

interface PlanInfo {
  periodType: "WEEKLY" | "MONTHLY";
  periodCount: number;
  planStartDate: string;
}

const EFFECT_GROUPS = [
  { value: "GENERAL", label: "Allgemeine Insolvenzeffekte" },
  { value: "PROCEDURE_COST", label: "Verfahrenskosten" },
];

const STANDARD_EFFECTS = [
  { name: "Anfechtung SV-Beiträge", type: "INFLOW", group: "GENERAL" },
  { name: "Abverkauf Vorratsbestand", type: "INFLOW", group: "GENERAL" },
  { name: "Rückzahlung Kautionen", type: "INFLOW", group: "GENERAL" },
  { name: "Umsatzsteuer vorläufiges Verfahren", type: "OUTFLOW", group: "GENERAL" },
  { name: "Halteprämien", type: "OUTFLOW", group: "GENERAL" },
  { name: "Unsicherheitsfaktor", type: "OUTFLOW", group: "GENERAL" },
  { name: "Sachverwaltung", type: "OUTFLOW", group: "PROCEDURE_COST" },
  { name: "Gerichtskosten", type: "OUTFLOW", group: "PROCEDURE_COST" },
  { name: "Gläubigerausschuss", type: "OUTFLOW", group: "PROCEDURE_COST" },
  { name: "Verfahrenskosten Eigenverwaltung", type: "OUTFLOW", group: "PROCEDURE_COST" },
  { name: "Sonstige Beratungskosten", type: "OUTFLOW", group: "PROCEDURE_COST" },
  { name: "Insolvenzgeldvorfinanzierung Zinsen", type: "OUTFLOW", group: "PROCEDURE_COST" },
  { name: "Insolvenzrechtliche Buchhaltung", type: "OUTFLOW", group: "PROCEDURE_COST" },
  { name: "Insolvenzspezifische Versicherungen", type: "OUTFLOW", group: "PROCEDURE_COST" },
];

const RESERVE_TEMPLATES = [
  { name: "IV-Vergütung (geschätzt)", type: "OUTFLOW", group: "PROCEDURE_COST" },
  { name: "Gerichtskosten (geschätzt)", type: "OUTFLOW", group: "PROCEDURE_COST" },
  { name: "Gläubigerausschuss (geschätzt)", type: "OUTFLOW", group: "PROCEDURE_COST" },
  { name: "Massekosten-Reserve", type: "OUTFLOW", group: "GENERAL" },
];

export default function InsolvencyEffectsPage() {
  const params = useParams();
  const caseId = params.id as string;

  const [effects, setEffects] = useState<InsolvencyEffect[]>([]);
  const [planInfo, setPlanInfo] = useState<PlanInfo>({
    periodType: "WEEKLY",
    periodCount: 13,
    planStartDate: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<"effects" | "reserves">("effects");

  // Transfer
  const [selectedEffectIds, setSelectedEffectIds] = useState<Set<string>>(new Set());
  const [transferredEffectIds, setTransferredEffectIds] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    effectType: "OUTFLOW" as "INFLOW" | "OUTFLOW",
    effectGroup: "GENERAL",
    periodIndex: 0,
    amountCents: "",
    effectId: null as string | null,
    isAvailabilityOnly: false,
  });

  const fetchTransferStatus = useCallback(async (effectIds: string[]) => {
    if (effectIds.length === 0) return;
    try {
      const res = await fetch(`/api/cases/${caseId}/effects/transfer?effectIds=${effectIds.join(",")}`);
      if (res.ok) {
        const data = await res.json();
        setTransferredEffectIds(new Set(data.transferredIds || []));
      }
    } catch {
      // Ignore errors
    }
  }, [caseId]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/plan/insolvency-effects`);
      if (res.ok) {
        const data = await res.json();
        const rawEffects = data.rawEffects || [];
        setEffects(rawEffects);
        setPlanInfo({
          periodType: data.periodType || "WEEKLY",
          periodCount: data.periodCount || 13,
          planStartDate: data.planStartDate || new Date().toISOString(),
        });
        const effectIds = rawEffects.filter((e: InsolvencyEffect) => !e.isAvailabilityOnly).map((e: InsolvencyEffect) => e.id);
        fetchTransferStatus(effectIds);
      }
    } catch {
      setError("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  }, [caseId, fetchTransferStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function generatePeriodLabels(): string[] {
    const labels: string[] = [];
    const planStart = new Date(planInfo.planStartDate);
    for (let i = 0; i < planInfo.periodCount; i++) {
      if (planInfo.periodType === "MONTHLY") {
        const date = new Date(planStart.getFullYear(), planStart.getMonth() + i, 1);
        labels.push(date.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }));
      } else {
        const weekDate = new Date(planStart);
        weekDate.setDate(weekDate.getDate() + i * 7);
        const weekNumber = Math.ceil((weekDate.getTime() - new Date(weekDate.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
        labels.push(`KW ${String(weekNumber).padStart(2, "0")}`);
      }
    }
    return labels;
  }

  const periodLabels = generatePeriodLabels();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/cases/${caseId}/plan/insolvency-effects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          effectType: formData.effectType,
          effectGroup: formData.effectGroup,
          periodIndex: formData.periodIndex,
          amountCents: Math.round(parseFloat(formData.amountCents) * 100),
          effectId: formData.effectId,
          isAvailabilityOnly: formData.isAvailabilityOnly,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Speichern");
      }

      setSuccess(formData.isAvailabilityOnly ? "Rückstellung gespeichert" : "Insolvenzeffekt gespeichert");
      resetForm();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(effectId: string) {
    if (!confirm("Eintrag wirklich löschen?")) return;

    try {
      const res = await fetch(`/api/cases/${caseId}/plan/insolvency-effects?effectId=${effectId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Löschen");
      }

      setSuccess("Eintrag gelöscht");
      setSelectedEffectIds((prev) => {
        const next = new Set(prev);
        next.delete(effectId);
        return next;
      });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  }

  async function handleTransfer() {
    if (selectedEffectIds.size === 0) return;

    setTransferring(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/cases/${caseId}/effects/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effectIds: Array.from(selectedEffectIds),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Fehler beim Transfer");
      }

      const messages: string[] = [];
      if (data.created > 0) messages.push(`${data.created} PLAN-Einträge erstellt`);
      if (data.deleted > 0) messages.push(`${data.deleted} alte Einträge ersetzt`);
      if (data.skipped > 0) messages.push(`${data.skipped} übersprungen`);

      setSuccess(messages.join(", ") || "Transfer abgeschlossen");
      setSelectedEffectIds(new Set());

      const effectIds = effects.filter(e => !e.isAvailabilityOnly).map((e) => e.id);
      fetchTransferStatus(effectIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Transfer");
    } finally {
      setTransferring(false);
    }
  }

  function startEdit(effect: InsolvencyEffect) {
    setFormData({
      name: effect.name,
      description: effect.description || "",
      effectType: effect.effectType,
      effectGroup: effect.effectGroup,
      periodIndex: effect.periodIndex,
      amountCents: (Number(effect.amountCents) / 100).toString(),
      effectId: effect.id,
      isAvailabilityOnly: effect.isAvailabilityOnly || false,
    });
  }

  function resetForm() {
    setFormData({
      name: "",
      description: "",
      effectType: "OUTFLOW",
      effectGroup: "GENERAL",
      periodIndex: 0,
      amountCents: "",
      effectId: null,
      isAvailabilityOnly: activeTab === "reserves",
    });
  }

  function applyTemplate(template: { name: string; type: string; group: string }) {
    setFormData({
      ...formData,
      name: template.name,
      effectType: template.type as "INFLOW" | "OUTFLOW",
      effectGroup: template.group,
      isAvailabilityOnly: activeTab === "reserves",
    });
  }

  function formatCurrencyLocal(cents: string | number): string {
    const value = typeof cents === "string" ? Number(cents) : cents;
    return (value / 100).toLocaleString("de-DE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  function toggleEffectSelection(effectId: string) {
    setSelectedEffectIds((prev) => {
      const next = new Set(prev);
      if (next.has(effectId)) {
        next.delete(effectId);
      } else {
        next.add(effectId);
      }
      return next;
    });
  }

  function toggleAllEffects() {
    const transferableEffects = effects.filter((e) => !e.isAvailabilityOnly);
    if (selectedEffectIds.size === transferableEffects.length) {
      setSelectedEffectIds(new Set());
    } else {
      setSelectedEffectIds(new Set(transferableEffects.map((e) => e.id)));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Filtered effects based on active tab
  const tabEffects = activeTab === "effects"
    ? effects.filter(e => !e.isAvailabilityOnly)
    : effects.filter(e => e.isAvailabilityOnly);

  const transferableEffects = effects.filter((e) => !e.isAvailabilityOnly);
  const reserveEffects = effects.filter(e => e.isAvailabilityOnly);
  const reserveTotal = reserveEffects.reduce((sum, e) => sum + Math.abs(Number(e.amountCents)), 0);

  const templates = activeTab === "effects" ? STANDARD_EFFECTS : RESERVE_TEMPLATES;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Insolvenzspezifische Effekte</h1>
            <p className="mt-1 text-sm text-[var(--secondary)]">
              Zahlungswirksame Effekte und Rückstellungen für die Liquiditätsplanung
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="admin-card">
        <div className="flex border-b border-[var(--border)]">
          <button
            onClick={() => { setActiveTab("effects"); resetForm(); }}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "effects"
                ? "border-blue-500 text-blue-700"
                : "border-transparent text-[var(--secondary)] hover:text-[var(--foreground)]"
            }`}
          >
            Zahlungswirksame Effekte ({transferableEffects.length})
          </button>
          <button
            onClick={() => { setActiveTab("reserves"); resetForm(); }}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "reserves"
                ? "border-blue-500 text-blue-700"
                : "border-transparent text-[var(--secondary)] hover:text-[var(--foreground)]"
            }`}
          >
            Rückstellungen ({reserveEffects.length})
            {reserveTotal > 0 && (
              <span className="ml-2 text-xs text-gray-500">
                (Gesamt: {formatCurrencyLocal(reserveTotal)} €)
              </span>
            )}
          </button>
        </div>

        {/* Tab Info Box */}
        <div className="p-4">
          {activeTab === "effects" ? (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-medium text-amber-800">
                  Zahlungswirksame Effekte
                </h4>
                <p className="text-xs text-amber-700 mt-1">
                  Rechtlich wirksame Zahlungswirkungen: Verfahrenskosten, Masseverbindlichkeiten, Halteprämien, etc.
                  Mit <em>&quot;In Planung überführen&quot;</em> werden sie als PLAN-Einträge im Zahlungsregister angelegt.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-800">
                  Rückstellungen (Liquiditätsreserve)
                </h4>
                <p className="text-xs text-blue-700 mt-1">
                  Diese Beträge werden als Liquiditätsreserve berücksichtigt und mindern die verfügbare Überdeckung
                  in der Liquiditätstabelle (Sektion IV). Sie werden <strong>nicht</strong> ins Zahlungsregister überführt,
                  sondern als konstanter Worst-Case-Abzug in jeder Periode dargestellt.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Templates Quick Add */}
      <div className="admin-card p-4">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">
          {activeTab === "effects" ? "Standard-Positionen" : "Rückstellungs-Vorlagen"}
        </h3>
        <div className="flex flex-wrap gap-2">
          {templates.map((template) => (
            <button
              key={template.name}
              onClick={() => applyTemplate(template)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                template.type === "INFLOW"
                  ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                  : activeTab === "reserves"
                    ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                    : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              }`}
            >
              {template.type === "INFLOW" ? "+" : "-"} {template.name}
            </button>
          ))}
        </div>
      </div>

      {/* Add/Edit Form */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          {formData.effectId
            ? (activeTab === "reserves" ? "Rückstellung bearbeiten" : "Effekt bearbeiten")
            : (activeTab === "reserves" ? "Neue Rückstellung hinzufügen" : "Neuen Effekt hinzufügen")}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Bezeichnung *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input w-full"
                placeholder={activeTab === "reserves" ? "z.B. IV-Vergütung" : "z.B. Anfechtung SV-Beiträge"}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Typ *
              </label>
              <select
                value={formData.effectType}
                onChange={(e) => setFormData({ ...formData, effectType: e.target.value as "INFLOW" | "OUTFLOW" })}
                className="input w-full"
                required
              >
                <option value="INFLOW">Einzahlung (+)</option>
                <option value="OUTFLOW">Auszahlung (-)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Gruppe *
              </label>
              <select
                value={formData.effectGroup}
                onChange={(e) => setFormData({ ...formData, effectGroup: e.target.value })}
                className="input w-full"
                required
              >
                {EFFECT_GROUPS.map((group) => (
                  <option key={group.value} value={group.value}>{group.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {activeTab === "reserves" ? "Periode (optional)" : "Periode *"}
              </label>
              <select
                value={formData.periodIndex}
                onChange={(e) => setFormData({ ...formData, periodIndex: parseInt(e.target.value) })}
                className="input w-full"
              >
                {periodLabels.map((label, index) => (
                  <option key={index} value={index}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Betrag (€) *
              </label>
              <input
                type="number"
                value={formData.amountCents}
                onChange={(e) => setFormData({ ...formData, amountCents: e.target.value })}
                className="input w-full"
                placeholder="z.B. 60000"
                step="0.01"
                min="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Beschreibung
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input w-full"
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Speichern..." : formData.effectId ? "Aktualisieren" : "Hinzufügen"}
            </button>
            {formData.effectId && (
              <button type="button" onClick={resetForm} className="btn-secondary">
                Abbrechen
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Transfer Actions (nur im Effects-Tab) */}
      {activeTab === "effects" && transferableEffects.length > 0 && (
        <div className="admin-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-[var(--secondary)]">
                {selectedEffectIds.size} von {transferableEffects.length} Effekten ausgewählt
              </span>
              {transferredEffectIds.size > 0 && (
                <span className="text-xs text-green-600">
                  ({transferredEffectIds.size} bereits im Ledger)
                </span>
              )}
            </div>
            <button
              onClick={handleTransfer}
              disabled={selectedEffectIds.size === 0 || transferring}
              className="btn-primary flex items-center gap-2"
            >
              {transferring ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Überführe...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  In Planung überführen ({selectedEffectIds.size})
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Effects/Reserves Table */}
      <div className="admin-card">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {activeTab === "effects"
              ? `Zahlungswirksame Effekte (${tabEffects.length})`
              : `Rückstellungen (${tabEffects.length})`}
          </h2>
        </div>
        {tabEffects.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            {activeTab === "effects"
              ? "Noch keine zahlungswirksamen Effekte erfasst"
              : "Noch keine Rückstellungen erfasst"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border)]">
              <thead className="bg-gray-50">
                <tr>
                  {activeTab === "effects" && (
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedEffectIds.size === transferableEffects.length && transferableEffects.length > 0}
                        onChange={toggleAllEffects}
                        className="rounded border-gray-300"
                        title="Alle auswählen"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Typ</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Gruppe</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Periode</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--secondary)] uppercase">Betrag</th>
                  {activeTab === "effects" && (
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--secondary)] uppercase">Status</th>
                  )}
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--secondary)] uppercase">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {tabEffects.map((effect) => {
                  const isTransferred = transferredEffectIds.has(effect.id);
                  return (
                    <tr key={effect.id} className="hover:bg-gray-50">
                      {activeTab === "effects" && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedEffectIds.has(effect.id)}
                            onChange={() => toggleEffectSelection(effect.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm font-medium text-[var(--foreground)]">{effect.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          effect.effectType === "INFLOW"
                            ? "bg-green-100 text-green-700"
                            : activeTab === "reserves"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-red-100 text-red-700"
                        }`}>
                          {effect.effectType === "INFLOW" ? "Einzahlung" : "Auszahlung"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--secondary)]">
                        {EFFECT_GROUPS.find((g) => g.value === effect.effectGroup)?.label || effect.effectGroup}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--secondary)]">
                        {periodLabels[effect.periodIndex] || `Periode ${effect.periodIndex + 1}`}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${
                        effect.effectType === "INFLOW" ? "text-green-600" :
                        activeTab === "reserves" ? "text-blue-600" : "text-red-600"
                      }`}>
                        {effect.effectType === "INFLOW" ? "+" : "-"}{formatCurrencyLocal(effect.amountCents)} €
                      </td>
                      {activeTab === "effects" && (
                        <td className="px-4 py-3 text-center">
                          {isTransferred ? (
                            <span className="badge badge-success text-xs" title="Bereits als PLAN-Entry im Ledger">
                              ✓ Im Ledger
                            </span>
                          ) : (
                            <span className="badge badge-neutral text-xs">
                              Nicht überführt
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => startEdit(effect)}
                            className="p-1.5 text-[var(--secondary)] hover:text-[var(--primary)] hover:bg-gray-100 rounded"
                            title="Bearbeiten"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(effect.id)}
                            className="p-1.5 text-[var(--secondary)] hover:text-red-600 hover:bg-red-50 rounded"
                            title="Löschen"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
