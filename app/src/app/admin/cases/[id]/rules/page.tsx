"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface ClassificationRule {
  id: string;
  caseId: string;
  name: string;
  isActive: boolean;
  priority: number;
  matchField: string;
  matchType: string;
  matchValue: string;
  suggestedCategory: string | null;
  suggestedFlowType: string | null;
  suggestedLegalBucket: string | null;
  confidenceBonus: number;
  // Dimensions-Zuweisung
  assignBankAccountId: string | null;
  assignCounterpartyId: string | null;
  assignLocationId: string | null;
  // Service-Date-Regel (Phase C)
  assignServiceDateRule: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  iban: string | null;
}

interface Counterparty {
  id: string;
  name: string;
  shortName: string | null;
}

interface Location {
  id: string;
  name: string;
  shortName: string | null;
}

interface CaseData {
  id: string;
  caseNumber: string;
  debtorName: string;
}

const MATCH_TYPE_LABELS: Record<string, string> = {
  CONTAINS: "enthält (irgendwo im Text)",
  STARTS_WITH: "beginnt mit",
  ENDS_WITH: "endet mit",
  EQUALS: "ist exakt gleich",
  REGEX: "Regex (für Profis)",
  AMOUNT_RANGE: "liegt im Bereich (bei Betrag)",
};

// Normalized Fields für Rule-Matching (gem. 3-Ebenen-Import-Architektur)
const MATCH_FIELD_LABELS: Record<string, string> = {
  bezeichnung: "Bezeichnung / Verwendungszweck",
  standort: "Standort",
  counterpartyHint: "Gegenpartei (aus Import)",
  arzt: "Arzt / Behandler",
  zeitraum: "Zeitraum / Abrechnungsperiode",
  kategorie: "Kategorie",
  kontoname: "Kontoname / Bankverbindung",
  krankenkasse: "Krankenkasse / Kostenträger",
  lanr: "LANR (Arztnummer)",
  referenz: "Referenz / Belegnummer",
};

const MATCH_FIELD_HINTS: Record<string, string> = {
  bezeichnung: 'Der Text aus dem Kontoauszug, z.B. "Miete Januar" oder "KV-Abrechnung"',
  standort: 'Standort/Praxis/Filiale aus der Import-Datei, z.B. "Velbert" oder "Uckerath"',
  counterpartyHint: 'Gegenpartei-Hinweis aus Import, z.B. "KV Nordrhein" oder "PVS"',
  arzt: 'Arzt/Behandler aus Abrechnungsdaten',
  zeitraum: 'Abrechnungszeitraum, z.B. "Q4/2025" oder "Oktober 2025"',
  kategorie: 'Kategorie aus Import, z.B. "Einnahmen" oder "Personalkosten"',
  kontoname: 'Kontoname aus Bankexport',
  krankenkasse: 'Krankenkasse/KV aus Abrechnungsdaten',
  lanr: 'Lebenslange Arztnummer für Abrechner-Zuordnung',
  referenz: 'Rechnungs- oder Belegnummer',
};

const LEGAL_BUCKET_LABELS: Record<string, string> = {
  MASSE: "Masse",
  ABSONDERUNG: "Absonderung",
  NEUTRAL: "Neutral",
  UNKNOWN: "Unbekannt",
};

// Service-Date-Regeln (Phase C) für Alt/Neu-Zuordnung
const SERVICE_DATE_RULE_LABELS: Record<string, string> = {
  VORMONAT: "Vormonat (HZV-Logik)",
  SAME_MONTH: "Gleicher Monat",
  PREVIOUS_QUARTER: "Vorquartal (KV-Abrechnung)",
};

const SERVICE_DATE_RULE_HINTS: Record<string, string> = {
  VORMONAT: "Dezember-Zahlung → Leistung November. Für HZV und ähnliche Abrechnungen.",
  SAME_MONTH: "Zahlung und Leistung im selben Monat. Für Direktzahler.",
  PREVIOUS_QUARTER: "Januar-Zahlung → Q4-Leistung. Für KV-Quartalsabrechnungen.",
};

export default function CaseRulesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [rules, setRules] = useState<ClassificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  // Dimensions State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Form State für neue Rule
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    matchField: "bezeichnung",  // Default: normalized field
    matchType: "CONTAINS",
    matchValue: "",
    suggestedLegalBucket: "MASSE",
    // Dimensions-Zuweisung
    assignBankAccountId: "",
    assignCounterpartyId: "",
    assignLocationId: "",
    // Service-Date-Regel (Phase C)
    assignServiceDateRule: "",
  });
  const [saving, setSaving] = useState(false);
  const [editingRule, setEditingRule] = useState<ClassificationRule | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [caseRes, rulesRes, bankRes, counterpartyRes, locationRes] = await Promise.all([
        fetch(`/api/cases/${id}`, { credentials: "include" }),
        fetch(`/api/cases/${id}/rules`, { credentials: "include" }),
        fetch(`/api/cases/${id}/bank-accounts`, { credentials: "include" }),
        fetch(`/api/cases/${id}/counterparties`, { credentials: "include" }),
        fetch(`/api/cases/${id}/locations`, { credentials: "include" }),
      ]);

      if (caseRes.ok) {
        setCaseData(await caseRes.json());
      } else {
        if (caseRes.status === 401) {
          setError("Nicht angemeldet");
        } else if (caseRes.status === 404) {
          setError("Fall nicht gefunden");
        } else {
          setError(`Fehler: ${caseRes.status}`);
        }
        return;
      }

      if (rulesRes.ok) {
        const data = await rulesRes.json();
        setRules(data.rules || []);
      } else {
        setError("Fehler beim Laden der Rules");
      }

      // Lade Dimensionen (nicht kritisch, daher keine Fehler werfen)
      if (bankRes.ok) {
        const data = await bankRes.json();
        setBankAccounts(data.accounts || []);
      }
      if (counterpartyRes.ok) {
        const data = await counterpartyRes.json();
        setCounterparties(data.counterparties || []);
      }
      if (locationRes.ok) {
        const data = await locationRes.json();
        setLocations(data.locations || []);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle createFrom query param (from LedgerEntry page)
  useEffect(() => {
    const createFrom = searchParams.get("createFrom");
    const suggestBucket = searchParams.get("suggestBucket");
    const matchField = searchParams.get("matchField");  // Optional: spezifisches Feld

    if (createFrom) {
      // Pre-fill form with entry description
      const shortPattern = createFrom.length > 20
        ? createFrom.substring(0, 20)
        : createFrom;

      setFormData({
        name: `Regel: ${shortPattern}...`,
        matchField: matchField || "bezeichnung",  // Default: normalized field
        matchType: "CONTAINS",
        matchValue: createFrom,
        suggestedLegalBucket: suggestBucket || "MASSE",
        assignBankAccountId: "",
        assignCounterpartyId: "",
        assignLocationId: "",
        assignServiceDateRule: "",
      });
      setShowForm(true);

      // Clear URL params without reload
      router.replace(`/admin/cases/${id}/rules`, { scroll: false });
    }
  }, [searchParams, id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = editingRule
        ? `/api/cases/${id}/rules/${editingRule.id}`
        : `/api/cases/${id}/rules`;

      // Automatische Defaults für vereinfachte UI
      const dataToSend = {
        name: formData.name,
        matchField: formData.matchField,
        matchType: formData.matchType,
        matchValue: formData.matchValue,
        suggestedLegalBucket: formData.suggestedLegalBucket,
        confidenceBonus: 0.15, // Ergibt ~85% Konfidenz für CONTAINS
        priority: editingRule?.priority || (rules.length + 1) * 10, // Auto-Priorität
        // Dimensions-Zuweisung (leere Strings → null)
        assignBankAccountId: formData.assignBankAccountId || null,
        assignCounterpartyId: formData.assignCounterpartyId || null,
        assignLocationId: formData.assignLocationId || null,
        // Service-Date-Regel (Phase C)
        assignServiceDateRule: formData.assignServiceDateRule || null,
      };

      const res = await fetch(url, {
        method: editingRule ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(dataToSend),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Speichern fehlgeschlagen");
      }

      setSuccessMessage(editingRule ? "Rule aktualisiert" : "Rule erstellt");
      setShowForm(false);
      setEditingRule(null);
      resetForm();
      fetchData();

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm("Rule wirklich löschen?")) return;

    setDeletingRuleId(ruleId);
    setError(null);

    try {
      const res = await fetch(`/api/cases/${id}/rules/${ruleId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Löschen fehlgeschlagen");
      }

      setSuccessMessage("Rule gelöscht");
      fetchData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    } finally {
      setDeletingRuleId(null);
    }
  };

  const handleToggleActive = async (rule: ClassificationRule) => {
    try {
      const res = await fetch(`/api/cases/${id}/rules/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !rule.isActive }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Aktualisieren fehlgeschlagen");
      }

      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aktualisieren fehlgeschlagen");
    }
  };

  const handleEdit = (rule: ClassificationRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      matchField: rule.matchField,
      matchType: rule.matchType,
      matchValue: rule.matchValue,
      suggestedLegalBucket: rule.suggestedLegalBucket || "MASSE",
      // Dimensions-Zuweisung
      assignBankAccountId: rule.assignBankAccountId || "",
      assignCounterpartyId: rule.assignCounterpartyId || "",
      assignLocationId: rule.assignLocationId || "",
      // Service-Date-Regel (Phase C)
      assignServiceDateRule: rule.assignServiceDateRule || "",
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      matchField: "bezeichnung",  // Default: normalized field
      matchType: "CONTAINS",
      matchValue: "",
      suggestedLegalBucket: "MASSE",
      assignBankAccountId: "",
      assignCounterpartyId: "",
      assignLocationId: "",
      assignServiceDateRule: "",
    });
  };

  const cancelEdit = () => {
    setShowForm(false);
    setEditingRule(null);
    resetForm();
  };

  if (loading && !caseData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <p className="text-[var(--danger)]">{error || "Fall nicht gefunden"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Klassifikationsregeln</h1>
          <p className="text-[var(--secondary)] mt-1">
            Automatische Vorschläge für Ledger-Einträge
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              resetForm();
              setEditingRule(null);
              setShowForm(true);
            }}
            className="btn-primary flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neue Rule
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="admin-card p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium">So funktionieren Rules:</p>
            <ul className="mt-1 list-disc list-inside space-y-1">
              <li>Rules prüfen Import-Daten auf <strong>normalized Fields</strong> (Standort, Gegenpartei, Bezeichnung, etc.)</li>
              <li>Wenn eine Rule matched, wird ein <strong>Vorschlag</strong> gespeichert (nicht die finale Klassifikation)</li>
              <li>Im Ledger können Sie dann alle Vorschläge per Bulk-Aktion bestätigen</li>
              <li>Niedrigere Priorität = wird zuerst geprüft</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
          {successMessage}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="admin-card p-6">
          <h2 className="text-lg font-medium text-[var(--foreground)] mb-4">
            {editingRule ? "Rule bearbeiten" : "Neue Rule erstellen"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field w-full"
                placeholder="z.B. Miete → Neutral"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  Wo suchen? *
                </label>
                <select
                  value={formData.matchField}
                  onChange={(e) => setFormData({ ...formData, matchField: e.target.value })}
                  className="input-field w-full"
                >
                  {Object.entries(MATCH_FIELD_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <p className="text-xs text-[var(--muted)] mt-1">
                  {MATCH_FIELD_HINTS[formData.matchField] || ""}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  Wie suchen? *
                </label>
                <select
                  value={formData.matchType}
                  onChange={(e) => setFormData({ ...formData, matchType: e.target.value })}
                  className="input-field w-full"
                >
                  {Object.entries(MATCH_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  Suchbegriff *
                </label>
                <input
                  type="text"
                  value={formData.matchValue}
                  onChange={(e) => setFormData({ ...formData, matchValue: e.target.value })}
                  className="input-field w-full"
                  placeholder={
                    formData.matchType === "AMOUNT_RANGE"
                      ? "z.B. 1000-5000 oder >500"
                      : formData.matchField === "standort"
                      ? "z.B. Velbert, Uckerath, Eitorf"
                      : formData.matchField === "counterpartyHint"
                      ? "z.B. KV, PVS, HZV"
                      : formData.matchField === "lanr"
                      ? "z.B. 123456789"
                      : "z.B. Miete, Gehalt, KV-Abrechnung"
                  }
                  required
                />
                <p className="text-xs text-[var(--muted)] mt-1">
                  Groß/Kleinschreibung wird ignoriert
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Dann klassifizieren als *
              </label>
              <select
                value={formData.suggestedLegalBucket}
                onChange={(e) => setFormData({ ...formData, suggestedLegalBucket: e.target.value })}
                className="input-field w-full max-w-xs"
              >
                {Object.entries(LEGAL_BUCKET_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Dimensions-Zuweisung */}
            {(bankAccounts.length > 0 || counterparties.length > 0 || locations.length > 0) && (
              <div className="pt-4 border-t border-[var(--border)]">
                <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">
                  Dimensions-Zuweisung (optional)
                </h3>
                <p className="text-xs text-[var(--muted)] mb-3">
                  Wenn die Regel matched, werden diese Dimensionen automatisch vorgeschlagen.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Bankkonto */}
                  {bankAccounts.length > 0 && (
                    <div>
                      <label className="block text-sm text-[var(--muted)] mb-1">Bankkonto</label>
                      <select
                        value={formData.assignBankAccountId}
                        onChange={(e) => setFormData({ ...formData, assignBankAccountId: e.target.value })}
                        className="input-field w-full"
                      >
                        <option value="">-- Keine Zuweisung --</option>
                        {bankAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.bankName} - {acc.accountName}
                            {acc.iban && ` (${acc.iban.slice(-4)})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Gegenpartei */}
                  {counterparties.length > 0 && (
                    <div>
                      <label className="block text-sm text-[var(--muted)] mb-1">Gegenpartei</label>
                      <select
                        value={formData.assignCounterpartyId}
                        onChange={(e) => setFormData({ ...formData, assignCounterpartyId: e.target.value })}
                        className="input-field w-full"
                      >
                        <option value="">-- Keine Zuweisung --</option>
                        {counterparties.map((cp) => (
                          <option key={cp.id} value={cp.id}>
                            {cp.name}
                            {cp.shortName && ` (${cp.shortName})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Standort */}
                  {locations.length > 0 && (
                    <div>
                      <label className="block text-sm text-[var(--muted)] mb-1">Standort</label>
                      <select
                        value={formData.assignLocationId}
                        onChange={(e) => setFormData({ ...formData, assignLocationId: e.target.value })}
                        className="input-field w-full"
                      >
                        <option value="">-- Keine Zuweisung --</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                            {loc.shortName && ` (${loc.shortName})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Service-Date-Regel (Phase C) */}
            <div className="pt-4 border-t border-[var(--border)]">
              <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">
                Leistungsdatum-Regel (optional)
              </h3>
              <p className="text-xs text-[var(--muted)] mb-3">
                Bestimmt automatisch das Leistungsdatum für die Alt/Neu-Masse-Zuordnung.
              </p>
              <div className="max-w-sm">
                <select
                  value={formData.assignServiceDateRule}
                  onChange={(e) => setFormData({ ...formData, assignServiceDateRule: e.target.value })}
                  className="input-field w-full"
                >
                  <option value="">-- Keine Regel --</option>
                  {Object.entries(SERVICE_DATE_RULE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                {formData.assignServiceDateRule && (
                  <p className="text-xs text-[var(--muted)] mt-1">
                    {SERVICE_DATE_RULE_HINTS[formData.assignServiceDateRule] || ""}
                  </p>
                )}
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-800">So wird die Regel angewendet:</p>
              <p className="mt-2 text-blue-900">
                Wenn der <span className="font-semibold">{MATCH_FIELD_LABELS[formData.matchField]}</span>{" "}
                <span className="font-semibold">{MATCH_TYPE_LABELS[formData.matchType]?.split(" ")[0]}</span>{" "}
                „<span className="font-bold text-blue-700">{formData.matchValue || "..."}</span>"
              </p>
              <p className="mt-1 text-blue-900">
                → Vorschlag: <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-bold bg-orange-100 text-orange-800">{LEGAL_BUCKET_LABELS[formData.suggestedLegalBucket]}</span>
                {formData.assignServiceDateRule && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-sm font-bold bg-purple-100 text-purple-800">
                    📅 {SERVICE_DATE_RULE_LABELS[formData.assignServiceDateRule]}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={cancelEdit} className="btn-secondary">
                Abbrechen
              </button>
              <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? "Speichern..." : editingRule ? "Aktualisieren" : "Erstellen"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules List */}
      <div className="admin-card">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-medium text-[var(--foreground)]">
            Rules ({rules.length})
          </h2>
        </div>

        {rules.length === 0 ? (
          <div className="p-8 text-center text-[var(--secondary)]">
            <svg className="w-12 h-12 mx-auto mb-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>Noch keine Rules vorhanden</p>
            <p className="text-sm mt-2">Erstellen Sie eine Rule, um automatische Klassifikations-Vorschläge zu aktivieren.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Aktiv</th>
                  <th>Name</th>
                  <th>Wenn...</th>
                  <th>Dann →</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className={!rule.isActive ? "opacity-50" : ""}>
                    <td>
                      <button
                        onClick={() => handleToggleActive(rule)}
                        className={`w-10 h-6 rounded-full relative transition-colors ${
                          rule.isActive ? "bg-green-500" : "bg-gray-300"
                        }`}
                        title={rule.isActive ? "Deaktivieren" : "Aktivieren"}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            rule.isActive ? "right-1" : "left-1"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="font-medium">{rule.name}</td>
                    <td className="text-sm">
                      <span className="text-[var(--muted)]">{MATCH_FIELD_LABELS[rule.matchField] || rule.matchField}</span>{" "}
                      <span className="text-purple-600">{MATCH_TYPE_LABELS[rule.matchType] || rule.matchType}</span>{" "}
                      „<span className="text-green-600 font-medium">{rule.matchValue}</span>"
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <span className={`badge ${
                          rule.suggestedLegalBucket === "MASSE" ? "badge-success" :
                          rule.suggestedLegalBucket === "ABSONDERUNG" ? "badge-warning" :
                          rule.suggestedLegalBucket === "NEUTRAL" ? "badge-info" : "badge-neutral"
                        }`}>
                          {LEGAL_BUCKET_LABELS[rule.suggestedLegalBucket || "UNKNOWN"]}
                        </span>
                        {rule.assignBankAccountId && (
                          <span className="badge badge-info text-xs" title="Bankkonto">
                            🏦 {bankAccounts.find(a => a.id === rule.assignBankAccountId)?.bankName || "..."}
                          </span>
                        )}
                        {rule.assignCounterpartyId && (
                          <span className="badge badge-info text-xs" title="Gegenpartei">
                            👤 {counterparties.find(c => c.id === rule.assignCounterpartyId)?.name || "..."}
                          </span>
                        )}
                        {rule.assignLocationId && (
                          <span className="badge badge-info text-xs" title="Standort">
                            📍 {locations.find(l => l.id === rule.assignLocationId)?.name || "..."}
                          </span>
                        )}
                        {rule.assignServiceDateRule && (
                          <span className="badge text-xs bg-purple-100 text-purple-800" title="Leistungsdatum-Regel">
                            📅 {SERVICE_DATE_RULE_LABELS[rule.assignServiceDateRule] || rule.assignServiceDateRule}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(rule)}
                          className="text-[var(--primary)] hover:underline text-sm"
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          disabled={deletingRuleId === rule.id}
                          className="text-[var(--danger)] hover:underline text-sm disabled:opacity-50"
                        >
                          {deletingRuleId === rule.id ? "..." : "Löschen"}
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

      {/* Systemregeln: Estate-Zuordnungsregeln (Read-Only) */}
      <div className="admin-card">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-medium text-[var(--foreground)]">
            Estate-Zuordnungsregeln (Systemkonfiguration)
          </h2>
          <p className="text-sm text-[var(--muted)] mt-1">
            Systemregeln f&uuml;r die Alt/Neu-Masse-Zuordnung. In Code konfiguriert, nicht &uuml;ber UI editierbar.
          </p>
        </div>

        <div className="p-4 space-y-6">
          {/* KV-Regeln */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2">
              KV-Regeln (Kassen&auml;rztliche Vereinigung)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 font-medium text-[var(--muted)]">Periode</th>
                    <th className="text-right px-3 py-2 font-medium text-[var(--muted)]">Alt-Anteil</th>
                    <th className="text-right px-3 py-2 font-medium text-[var(--muted)]">Neu-Anteil</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--muted)]">Quelle</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-[var(--border)]">
                    <td className="px-3 py-2">Q3/2025 und fr&uuml;her</td>
                    <td className="px-3 py-2 text-right font-mono text-red-700">100%</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">0%</td>
                    <td className="px-3 py-2 text-[var(--muted)]">Zeitliche Zuordnung</td>
                  </tr>
                  <tr className="border-t border-[var(--border)] bg-amber-50">
                    <td className="px-3 py-2 font-medium">Q4/2025</td>
                    <td className="px-3 py-2 text-right font-mono text-red-700 font-medium">1/3 (33,3%)</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700 font-medium">2/3 (66,7%)</td>
                    <td className="px-3 py-2 text-[var(--muted)]">Massekreditvertrag &sect;1(2)a</td>
                  </tr>
                  <tr className="border-t border-[var(--border)]">
                    <td className="px-3 py-2">Q1/2026+</td>
                    <td className="px-3 py-2 text-right font-mono text-red-700">0%</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">100%</td>
                    <td className="px-3 py-2 text-[var(--muted)]">Zeitliche Zuordnung</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* HZV-Regeln */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2">
              HZV-Regeln (Hausarztzentrierte Versorgung)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 font-medium text-[var(--muted)]">Periode</th>
                    <th className="text-right px-3 py-2 font-medium text-[var(--muted)]">Alt-Anteil</th>
                    <th className="text-right px-3 py-2 font-medium text-[var(--muted)]">Neu-Anteil</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--muted)]">Quelle</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-[var(--border)] bg-amber-50">
                    <td className="px-3 py-2 font-medium">Okt 2025</td>
                    <td className="px-3 py-2 text-right font-mono text-red-700 font-medium">29/31 (93,5%)</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700 font-medium">2/31 (6,5%)</td>
                    <td className="px-3 py-2 text-[var(--muted)]">Zeitanteilig (Stichtag 29.10.)</td>
                  </tr>
                  <tr className="border-t border-[var(--border)]">
                    <td className="px-3 py-2">Nov 2025+</td>
                    <td className="px-3 py-2 text-right font-mono text-red-700">0%</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">100%</td>
                    <td className="px-3 py-2 text-[var(--muted)]">Leistung nach Er&ouml;ffnung</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--muted)] mt-2">
              HZV-Logik: Zahlung im Monat M bezieht sich auf Leistung im Monat M-1 (Vormonat-Regel).
            </p>
          </div>

          {/* Fallback */}
          <div className="p-3 bg-gray-50 rounded-lg border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--foreground)]">Fallback:</span>{" "}
              Wenn keine Regel greift, wird die Zuordnung als <span className="font-mono font-medium text-amber-700">UNKLAR</span> markiert und muss manuell gepr&uuml;ft werden.
            </p>
          </div>

          <p className="text-xs text-[var(--muted)] italic">
            Systemregel &mdash; in Code konfiguriert (haevg-plus/config.ts), nicht &uuml;ber UI editierbar.
          </p>
        </div>
      </div>

      {/* Quick-Start Examples */}
      {rules.length === 0 && !showForm && (
        <div className="admin-card p-6">
          <h3 className="font-medium text-[var(--foreground)] mb-3">Beispiel-Rules zum Schnellstart</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => {
                setFormData({
                  name: "HZV-Zahlung → Vormonat",
                  matchField: "counterpartyHint",
                  matchType: "CONTAINS",
                  matchValue: "HZV",
                  suggestedLegalBucket: "MASSE",
                  assignBankAccountId: "",
                  assignCounterpartyId: "",
                  assignLocationId: "",
                  assignServiceDateRule: "VORMONAT",
                });
                setShowForm(true);
              }}
              className="p-4 border border-dashed border-[var(--border)] rounded-lg hover:border-[var(--primary)] hover:bg-blue-50 transition-colors text-left"
            >
              <p className="font-medium">HZV → Vormonat</p>
              <p className="text-sm text-[var(--muted)] mt-1">HZV-Zahlungen mit Vormonat-Regel für Alt/Neu</p>
            </button>
            <button
              onClick={() => {
                setFormData({
                  name: "KV-Zahlung → Vorquartal",
                  matchField: "counterpartyHint",
                  matchType: "CONTAINS",
                  matchValue: "KV",
                  suggestedLegalBucket: "MASSE",
                  assignBankAccountId: "",
                  assignCounterpartyId: "",
                  assignLocationId: "",
                  assignServiceDateRule: "PREVIOUS_QUARTER",
                });
                setShowForm(true);
              }}
              className="p-4 border border-dashed border-[var(--border)] rounded-lg hover:border-[var(--primary)] hover:bg-blue-50 transition-colors text-left"
            >
              <p className="font-medium">KV → Vorquartal</p>
              <p className="text-sm text-[var(--muted)] mt-1">KV-Zahlungen mit Vorquartal-Regel</p>
            </button>
            <button
              onClick={() => {
                setFormData({
                  name: "Miete → Neutral",
                  matchField: "bezeichnung",
                  matchType: "CONTAINS",
                  matchValue: "Miete",
                  suggestedLegalBucket: "NEUTRAL",
                  assignBankAccountId: "",
                  assignCounterpartyId: "",
                  assignLocationId: "",
                  assignServiceDateRule: "",
                });
                setShowForm(true);
              }}
              className="p-4 border border-dashed border-[var(--border)] rounded-lg hover:border-[var(--primary)] hover:bg-blue-50 transition-colors text-left"
            >
              <p className="font-medium">Miete → Neutral</p>
              <p className="text-sm text-[var(--muted)] mt-1">Mietkosten als neutral klassifizieren</p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
