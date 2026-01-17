"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface InsolvencyEffect {
  id: string;
  name: string;
  description: string | null;
  effectType: "INFLOW" | "OUTFLOW";
  effectGroup: string;
  periodIndex: number;
  amountCents: string;
  isActive: boolean;
}

interface PlanInfo {
  periodType: "WEEKLY" | "MONTHLY";
  periodCount: number;
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

export default function InsolvencyEffectsPage() {
  const params = useParams();
  const caseId = params.id as string;

  const [effects, setEffects] = useState<InsolvencyEffect[]>([]);
  const [planInfo, setPlanInfo] = useState<PlanInfo>({ periodType: "WEEKLY", periodCount: 13 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    effectType: "OUTFLOW" as "INFLOW" | "OUTFLOW",
    effectGroup: "GENERAL",
    periodIndex: 0,
    amountCents: "",
    effectId: null as string | null,
  });

  useEffect(() => {
    fetchData();
  }, [caseId]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/cases/${caseId}/plan/insolvency-effects`);
      if (res.ok) {
        const data = await res.json();
        setEffects(data.rawEffects || []);
        setPlanInfo({
          periodType: data.periodType || "WEEKLY",
          periodCount: data.periodCount || 13,
        });
      }
    } catch (err) {
      setError("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  }

  function generatePeriodLabels(): string[] {
    const labels: string[] = [];
    const now = new Date();
    for (let i = 0; i < planInfo.periodCount; i++) {
      if (planInfo.periodType === "MONTHLY") {
        const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
        labels.push(date.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }));
      } else {
        labels.push(`KW ${String(i + 1).padStart(2, "0")}`);
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
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Speichern");
      }

      setSuccess("Insolvenzeffekt gespeichert");
      resetForm();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(effectId: string) {
    if (!confirm("Insolvenzeffekt wirklich löschen?")) return;

    try {
      const res = await fetch(`/api/cases/${caseId}/plan/insolvency-effects?effectId=${effectId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Löschen");
      }

      setSuccess("Insolvenzeffekt gelöscht");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
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
    });
  }

  function useStandardEffect(standardEffect: typeof STANDARD_EFFECTS[0]) {
    setFormData({
      ...formData,
      name: standardEffect.name,
      effectType: standardEffect.type as "INFLOW" | "OUTFLOW",
      effectGroup: standardEffect.group,
    });
  }

  function formatCurrency(cents: string | number): string {
    const value = typeof cents === "string" ? Number(cents) : cents;
    return (value / 100).toLocaleString("de-DE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  // Group effects by name for display
  const effectsByName = effects.reduce((acc, effect) => {
    if (!acc[effect.name]) {
      acc[effect.name] = {
        name: effect.name,
        effectType: effect.effectType,
        effectGroup: effect.effectGroup,
        entries: [],
      };
    }
    acc[effect.name].entries.push(effect);
    return acc;
  }, {} as Record<string, { name: string; effectType: string; effectGroup: string; entries: InsolvencyEffect[] }>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-[var(--muted)]">
        <Link href="/admin/cases" className="hover:text-[var(--primary)]">Fälle</Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link href={`/admin/cases/${caseId}`} className="hover:text-[var(--primary)]">Fall</Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[var(--foreground)]">Insolvenzeffekte</span>
      </div>

      {/* Header */}
      <div className="admin-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Insolvenzspezifische Effekte</h1>
            <p className="mt-1 text-sm text-[var(--secondary)]">
              Erfassen Sie insolvenzspezifische Zahlungsströme getrennt vom operativen Geschäft
            </p>
          </div>
          <Link href={`/admin/cases/${caseId}`} className="btn-secondary">
            Zurück zum Fall
          </Link>
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

      {/* Standard Effects Quick Add */}
      <div className="admin-card p-4">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Standard-Positionen (W&P-Katalog)</h3>
        <div className="flex flex-wrap gap-2">
          {STANDARD_EFFECTS.map((effect) => (
            <button
              key={effect.name}
              onClick={() => useStandardEffect(effect)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                effect.type === "INFLOW"
                  ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                  : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              }`}
            >
              {effect.type === "INFLOW" ? "+" : "-"} {effect.name}
            </button>
          ))}
        </div>
      </div>

      {/* Add/Edit Form */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          {formData.effectId ? "Effekt bearbeiten" : "Neuen Effekt hinzufügen"}
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
                placeholder="z.B. Anfechtung SV-Beiträge"
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
                Periode *
              </label>
              <select
                value={formData.periodIndex}
                onChange={(e) => setFormData({ ...formData, periodIndex: parseInt(e.target.value) })}
                className="input w-full"
                required
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

      {/* Existing Effects Table */}
      <div className="admin-card">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Erfasste Effekte ({effects.length})
          </h2>
        </div>
        {effects.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Noch keine Insolvenzeffekte erfasst
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border)]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Typ</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Gruppe</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Periode</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--secondary)] uppercase">Betrag</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--secondary)] uppercase">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {effects.map((effect) => (
                  <tr key={effect.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-[var(--foreground)]">{effect.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        effect.effectType === "INFLOW"
                          ? "bg-green-100 text-green-700"
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
                      effect.effectType === "INFLOW" ? "text-green-600" : "text-red-600"
                    }`}>
                      {effect.effectType === "INFLOW" ? "+" : "-"}{formatCurrency(effect.amountCents)} €
                    </td>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
