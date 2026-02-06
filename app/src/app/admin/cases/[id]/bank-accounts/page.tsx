"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  iban: string | null;
  openingBalanceCents: string;
  currentBalanceCents: string;
  securityHolder: string | null;
  status: string;
  notes: string | null;
  displayOrder: number;
}

const STATUS_OPTIONS = [
  { value: "available", label: "Verfügbar", color: "bg-green-100 text-green-700" },
  { value: "blocked", label: "Gesperrt", color: "bg-yellow-100 text-yellow-700" },
  { value: "restricted", label: "Eingeschränkt", color: "bg-orange-100 text-orange-700" },
];

export default function BankAccountsPage() {
  const params = useParams();
  const caseId = params.id as string;

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    accountId: null as string | null,
    bankName: "",
    accountName: "",
    iban: "",
    openingBalanceCents: "",
    securityHolder: "",
    status: "available",
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, [caseId]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/cases/${caseId}/bank-accounts`);
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch (err) {
      setError("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const method = formData.accountId ? "PUT" : "POST";
      const res = await fetch(`/api/cases/${caseId}/bank-accounts`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: formData.accountId,
          bankName: formData.bankName,
          accountName: formData.accountName,
          iban: formData.iban || null,
          openingBalanceCents: Math.round(parseFloat(formData.openingBalanceCents) * 100),
          securityHolder: formData.securityHolder || null,
          status: formData.status,
          notes: formData.notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Speichern");
      }

      setSuccess("Bankkonto gespeichert");
      resetForm();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(accountId: string) {
    if (!confirm("Bankkonto wirklich löschen?")) return;

    try {
      const res = await fetch(`/api/cases/${caseId}/bank-accounts?accountId=${accountId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Löschen");
      }

      setSuccess("Bankkonto gelöscht");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  }

  function startEdit(account: BankAccount) {
    setFormData({
      accountId: account.id,
      bankName: account.bankName,
      accountName: account.accountName,
      iban: account.iban || "",
      openingBalanceCents: (Number(account.openingBalanceCents) / 100).toString(),
      securityHolder: account.securityHolder || "",
      status: account.status,
      notes: account.notes || "",
    });
  }

  function resetForm() {
    setFormData({
      accountId: null,
      bankName: "",
      accountName: "",
      iban: "",
      openingBalanceCents: "",
      securityHolder: "",
      status: "available",
      notes: "",
    });
  }

  function formatCurrency(cents: string | number): string {
    const value = typeof cents === "string" ? Number(cents) : cents;
    return (value / 100).toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    });
  }

  function formatIBAN(iban: string): string {
    return iban.replace(/(.{4})/g, "$1 ").trim();
  }

  const getStatusConfig = (status: string) => {
    return STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
  };

  // Calculate totals from currentBalanceCents
  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.currentBalanceCents), 0);
  const totalAvailable = accounts.reduce(
    (sum, acc) => acc.status !== "blocked" ? sum + Number(acc.currentBalanceCents) : sum,
    0
  );

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
        <span className="text-[var(--foreground)]">Bankenspiegel</span>
      </div>

      {/* Header */}
      <div className="admin-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Bankenspiegel</h1>
            <p className="mt-1 text-sm text-[var(--secondary)]">
              Übersicht aller Bankkonten mit IBAN, Saldo und Status
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Anzahl Konten</p>
          <p className="text-2xl font-bold text-[var(--foreground)]">{accounts.length}</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Gesamtsaldo</p>
          <p className="text-2xl font-bold text-[var(--foreground)]">{formatCurrency(totalBalance)}</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Liquide Mittel</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalAvailable)}</p>
        </div>
      </div>

      {/* Add/Edit Form */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          {formData.accountId ? "Konto bearbeiten" : "Neues Konto hinzufügen"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Kreditinstitut *
              </label>
              <input
                type="text"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                className="input w-full"
                placeholder="z.B. Sparkasse"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Kontobezeichnung *
              </label>
              <input
                type="text"
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                className="input w-full"
                placeholder="z.B. Geschäftskonto"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                IBAN
              </label>
              <input
                type="text"
                value={formData.iban}
                onChange={(e) => setFormData({ ...formData, iban: e.target.value.toUpperCase().replace(/\s/g, "") })}
                className="input w-full font-mono"
                placeholder="DE89370400440532013000"
                maxLength={34}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Anfangssaldo (EUR) *
              </label>
              <input
                type="number"
                value={formData.openingBalanceCents}
                onChange={(e) => setFormData({ ...formData, openingBalanceCents: e.target.value })}
                className="input w-full"
                placeholder="z.B. 89775.00"
                step="0.01"
                required
              />
              <p className="text-xs text-[var(--muted)] mt-1">Saldo vor allen Ledger-Buchungen</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="input w-full"
                required
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Sicherungsnehmer
              </label>
              <input
                type="text"
                value={formData.securityHolder}
                onChange={(e) => setFormData({ ...formData, securityHolder: e.target.value })}
                className="input w-full"
                placeholder="z.B. Globalzession Bank XY"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Anmerkungen
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input w-full"
              rows={2}
              placeholder="Optionale Hinweise zum Konto..."
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Speichern..." : formData.accountId ? "Aktualisieren" : "Hinzufügen"}
            </button>
            {formData.accountId && (
              <button type="button" onClick={resetForm} className="btn-secondary">
                Abbrechen
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Accounts Table */}
      <div className="admin-card">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Kontenübersicht ({accounts.length})
          </h2>
        </div>
        {accounts.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Noch keine Bankkonten erfasst
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border)]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Kreditinstitut</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Konto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">IBAN</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--secondary)] uppercase">Anfangssaldo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--secondary)] uppercase">Aktueller Saldo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Sicherungsnehmer</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--secondary)] uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--secondary)] uppercase">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {accounts.map((account) => {
                  const statusConfig = getStatusConfig(account.status);
                  return (
                    <tr key={account.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-[var(--foreground)]">{account.bankName}</td>
                      <td className="px-4 py-3 text-sm text-[var(--secondary)]">{account.accountName}</td>
                      <td className="px-4 py-3 text-sm font-mono text-[var(--secondary)]">
                        {account.iban ? formatIBAN(account.iban) : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-[var(--secondary)]">{formatCurrency(account.openingBalanceCents)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(account.currentBalanceCents)}</td>
                      <td className="px-4 py-3 text-sm text-[var(--secondary)]">{account.securityHolder || "-"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => startEdit(account)}
                            className="p-1.5 text-[var(--secondary)] hover:text-[var(--primary)] hover:bg-gray-100 rounded"
                            title="Bearbeiten"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(account.id)}
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
                {/* Totals Row */}
                <tr className="bg-gray-100 font-semibold">
                  <td className="px-4 py-3 text-sm" colSpan={4}>Summe</td>
                  <td className="px-4 py-3 text-sm text-right">{formatCurrency(totalBalance)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
