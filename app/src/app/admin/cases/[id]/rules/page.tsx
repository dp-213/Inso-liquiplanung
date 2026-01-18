"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
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
  createdAt: string;
  updatedAt: string;
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

const MATCH_FIELD_LABELS: Record<string, string> = {
  description: "Verwendungszweck / Buchungstext",
  bookingReference: "Rechnungs-/Referenznummer",
  bookingSourceId: "Gegenkonto (IBAN/Kontonr.)",
  amountCents: "Betrag (in Cent)",
};

const MATCH_FIELD_HINTS: Record<string, string> = {
  description: 'Der Text aus dem Kontoauszug, z.B. "Miete Januar" oder "Gehalt Müller"',
  bookingReference: "Rechnungsnummer, Auftragsnummer, Mandatsreferenz",
  bookingSourceId: "IBAN oder Kontonummer des Absenders/Empfängers",
  amountCents: 'Für Betragsbereich-Regeln, z.B. "1000-5000" (in Euro)',
};

const LEGAL_BUCKET_LABELS: Record<string, string> = {
  MASSE: "Masse",
  ABSONDERUNG: "Absonderung",
  NEUTRAL: "Neutral",
  UNKNOWN: "Unbekannt",
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

  // Form State für neue Rule
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    matchField: "description",
    matchType: "CONTAINS",
    matchValue: "",
    suggestedLegalBucket: "MASSE",
  });
  const [saving, setSaving] = useState(false);
  const [editingRule, setEditingRule] = useState<ClassificationRule | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [caseRes, rulesRes] = await Promise.all([
        fetch(`/api/cases/${id}`, { credentials: "include" }),
        fetch(`/api/cases/${id}/rules`, { credentials: "include" }),
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

    if (createFrom) {
      // Pre-fill form with entry description
      const shortPattern = createFrom.length > 20
        ? createFrom.substring(0, 20)
        : createFrom;

      setFormData({
        name: `Regel: ${shortPattern}...`,
        matchField: "description",
        matchType: "CONTAINS",
        matchValue: createFrom,
        suggestedLegalBucket: suggestBucket || "MASSE",
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
        ...formData,
        confidenceBonus: 0.15, // Ergibt ~85% Konfidenz für CONTAINS
        priority: editingRule?.priority || (rules.length + 1) * 10, // Auto-Priorität
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
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      matchField: "description",
      matchType: "CONTAINS",
      matchValue: "",
      suggestedLegalBucket: "MASSE",
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
          <Link href="/admin/cases" className="btn-secondary mt-4 inline-block">
            Zurück zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-[var(--muted)]">
        <Link href="/admin/cases" className="hover:text-[var(--primary)]">
          Fälle
        </Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link href={`/admin/cases/${id}`} className="hover:text-[var(--primary)]">
          {caseData.debtorName}
        </Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[var(--foreground)]">Klassifikationsregeln</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Klassifikationsregeln</h1>
          <p className="text-[var(--secondary)] mt-1">
            Automatische Vorschläge für Ledger-Einträge
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/admin/cases/${id}`} className="btn-secondary">
            Zurück zum Fall
          </Link>
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
              <li>Rules prüfen neue Ledger-Einträge automatisch</li>
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
                      ? "z.B. 1000-5000 (Euro)"
                      : formData.matchField === "bookingSourceId"
                      ? "z.B. DE89370400440532013000"
                      : "z.B. Miete, Gehalt, Sparkasse"
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
                      <span className={`badge ${
                        rule.suggestedLegalBucket === "MASSE" ? "badge-success" :
                        rule.suggestedLegalBucket === "ABSONDERUNG" ? "badge-warning" :
                        rule.suggestedLegalBucket === "NEUTRAL" ? "badge-info" : "badge-neutral"
                      }`}>
                        {LEGAL_BUCKET_LABELS[rule.suggestedLegalBucket || "UNKNOWN"]}
                      </span>
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

      {/* Quick-Start Examples */}
      {rules.length === 0 && !showForm && (
        <div className="admin-card p-6">
          <h3 className="font-medium text-[var(--foreground)] mb-3">Beispiel-Rules zum Schnellstart</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => {
                setFormData({
                  name: "Miete → Neutral",
                  matchField: "description",
                  matchType: "CONTAINS",
                  matchValue: "Miete",
                  suggestedLegalBucket: "NEUTRAL",
                });
                setShowForm(true);
              }}
              className="p-4 border border-dashed border-[var(--border)] rounded-lg hover:border-[var(--primary)] hover:bg-blue-50 transition-colors text-left"
            >
              <p className="font-medium">Miete → Neutral</p>
              <p className="text-sm text-[var(--muted)] mt-1">Mietkosten als neutral klassifizieren</p>
            </button>
            <button
              onClick={() => {
                setFormData({
                  name: "Gehalt → Masse",
                  matchField: "description",
                  matchType: "CONTAINS",
                  matchValue: "Gehalt",
                  suggestedLegalBucket: "MASSE",
                });
                setShowForm(true);
              }}
              className="p-4 border border-dashed border-[var(--border)] rounded-lg hover:border-[var(--primary)] hover:bg-blue-50 transition-colors text-left"
            >
              <p className="font-medium">Gehalt → Masse</p>
              <p className="text-sm text-[var(--muted)] mt-1">Gehaltszahlungen als Masse</p>
            </button>
            <button
              onClick={() => {
                setFormData({
                  name: "Bank → Absonderung",
                  matchField: "description",
                  matchType: "STARTS_WITH",
                  matchValue: "Bank",
                  suggestedLegalBucket: "ABSONDERUNG",
                });
                setShowForm(true);
              }}
              className="p-4 border border-dashed border-[var(--border)] rounded-lg hover:border-[var(--primary)] hover:bg-blue-50 transition-colors text-left"
            >
              <p className="font-medium">Bank → Absonderung</p>
              <p className="text-sm text-[var(--muted)] mt-1">Bankgebühren als Absonderung</p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
