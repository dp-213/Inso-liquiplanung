"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

// --- Types ---

interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  iban: string | null;
  status: string;
  isLiquidityRelevant: boolean;
  securityHolder: string | null;
}

interface BankAccountsResponse {
  accounts: BankAccount[];
}

interface Assumption {
  field: string;
  assumption: string;
  source: "VERTRAG" | "BERECHNET" | "NICHT_VEREINBART";
}

interface PerBankMassekredit {
  bankAccountId: string;
  bankName: string;
  agreementStatus: string;
  hasGlobalAssignment: boolean;
  status: {
    altforderungenBruttoCents: string;
    fortfuehrungsbeitragCents: string | null;
    fortfuehrungsbeitragUstCents: string | null;
    massekreditAltforderungenCents: string;
    headroomCents: string | null;
    isUncertain: boolean;
    uncertaintyNote: string | null;
    assumptions: Assumption[];
  };
}

interface MassekreditResponse {
  perBank: PerBankMassekredit[];
  total: {
    altforderungenBruttoCents: string;
    fortfuehrungsbeitragCents: string;
    fortfuehrungsbeitragUstCents: string;
    massekreditAltforderungenCents: string;
    hasUncertainBanks: boolean;
  };
  unklarCount: number;
  calculatedAt: string;
}

// --- Helpers ---

function formatCents(cents: string | null): string {
  if (cents === null) return "—";
  return (Number(cents) / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    VEREINBART: { bg: "bg-green-100", text: "text-green-800", label: "Vereinbart" },
    VERHANDLUNG: { bg: "bg-amber-100", text: "text-amber-800", label: "Verhandlung" },
    OFFEN: { bg: "bg-red-100", text: "text-red-800", label: "Offen" },
  };
  const c = config[status] ?? { bg: "bg-gray-100", text: "text-gray-800", label: status };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function AccountStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "available":
      return <span className="badge badge-success">Verfügbar</span>;
    case "blocked":
      return <span className="badge badge-danger">Gesperrt</span>;
    case "restricted":
      return <span className="badge badge-warning">Eingeschränkt</span>;
    default:
      return <span className="badge badge-neutral">{status}</span>;
  }
}

function SourceBadge({ source }: { source: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    VERTRAG: { bg: "bg-blue-100", text: "text-blue-700" },
    BERECHNET: { bg: "bg-gray-100", text: "text-gray-700" },
    NICHT_VEREINBART: { bg: "bg-red-50", text: "text-red-600" },
  };
  const c = config[source] ?? { bg: "bg-gray-100", text: "text-gray-700" };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.text}`}>
      {source}
    </span>
  );
}

// --- Main Component ---

export default function BankenSicherungsrechtePage() {
  const { id: caseId } = useParams<{ id: string }>();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [massekredit, setMassekredit] = useState<MassekreditResponse | null>(null);
  const [massekreditError, setMassekreditError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      setMassekreditError(null);

      try {
        // Bankkonten laden
        const accountsRes = await fetch(`/api/cases/${caseId}/bank-accounts`, {
          credentials: "include",
        });
        if (!accountsRes.ok) throw new Error("Bankkonten konnten nicht geladen werden");
        const accountsData: BankAccountsResponse = await accountsRes.json();
        setAccounts(accountsData.accounts);

        // Massekredit laden (kann 404 sein wenn keine BankAgreements)
        const mkRes = await fetch(`/api/cases/${caseId}/massekredit`, {
          credentials: "include",
        });
        if (mkRes.ok) {
          const mkData: MassekreditResponse = await mkRes.json();
          setMassekredit(mkData);
        } else if (mkRes.status === 404) {
          setMassekreditError("Keine Bankvereinbarungen konfiguriert");
        } else {
          setMassekreditError("Massekredit-Daten konnten nicht geladen werden");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-card p-8 text-center">
        <p className="text-red-600 font-medium">{error}</p>
        <button onClick={() => window.location.reload()} className="btn-secondary mt-4">
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Banken & Sicherungsrechte</h1>
          <p className="text-[var(--secondary)] mt-1">
            Bankenspiegel, Sicherungsvereinbarungen und Massekredit-Status
          </p>
        </div>
        <Link href={`/admin/cases/${caseId}/bank-accounts`} className="btn-primary flex items-center">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Bankkonten bearbeiten
        </Link>
      </div>

      {/* Sektion A: Bankenspiegel */}
      <SektionBankenspiegel accounts={accounts} caseId={caseId} />

      {/* Sektion B: Sicherungsrechte & Vereinbarungen */}
      <SektionSicherungsrechte massekredit={massekredit} massekreditError={massekreditError} />

      {/* Sektion C: Massekredit-Status */}
      <SektionMassekredit massekredit={massekredit} massekreditError={massekreditError} caseId={caseId} />
    </div>
  );
}

// --- Sektion A: Bankenspiegel ---

function SektionBankenspiegel({ accounts, caseId }: { accounts: BankAccount[]; caseId: string }) {
  return (
    <div className="admin-card">
      <div className="px-6 py-4 border-b border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)] flex items-center">
          <svg className="w-5 h-5 mr-2 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          Bankenspiegel
        </h2>
      </div>

      {accounts.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Bank / Konto</th>
                <th>IBAN</th>
                <th>Typ</th>
                <th>Sicherungsnehmer</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.id}>
                  <td>
                    <div>
                      <p className="font-medium text-[var(--foreground)]">{acc.bankName}</p>
                      <p className="text-sm text-[var(--muted)]">{acc.accountName}</p>
                    </div>
                  </td>
                  <td className="font-mono text-sm">{acc.iban || "—"}</td>
                  <td>
                    {acc.isLiquidityRelevant ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        ISK (Masse)
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        Gläubigerkonto
                      </span>
                    )}
                  </td>
                  <td>
                    {acc.securityHolder ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        {acc.securityHolder}
                      </span>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td>
                    <AccountStatusBadge status={acc.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center text-[var(--muted)]">
          <p>Keine Bankkonten vorhanden</p>
          <Link href={`/admin/cases/${caseId}/bank-accounts`} className="text-[var(--primary)] hover:underline text-sm mt-1 inline-block">
            Bankkonten anlegen
          </Link>
        </div>
      )}
    </div>
  );
}

// --- Sektion B: Sicherungsrechte & Vereinbarungen ---

function SektionSicherungsrechte({
  massekredit,
  massekreditError,
}: {
  massekredit: MassekreditResponse | null;
  massekreditError: string | null;
}) {
  return (
    <div className="admin-card">
      <div className="px-6 py-4 border-b border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)] flex items-center">
          <svg className="w-5 h-5 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Sicherungsrechte & Vereinbarungen
        </h2>
      </div>

      {massekreditError ? (
        <div className="p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium">Keine Vereinbarungen hinterlegt</p>
              <p className="mt-1">
                Vereinbarungen werden unter{" "}
                <span className="font-medium">STAMMDATEN → Bankkonten</span>{" "}
                gepflegt. Legen Sie dort Bankvereinbarungen (Globalzession, Fortführungsbeitrag) an.
              </p>
            </div>
          </div>
        </div>
      ) : massekredit ? (
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Bank</th>
                <th>Globalzession</th>
                <th>Fortführungsbeitrag</th>
                <th>Status</th>
                <th>Hinweis</th>
              </tr>
            </thead>
            <tbody>
              {massekredit.perBank.map((bank) => {
                const beitragAssumption = bank.status.assumptions.find(
                  (a) => a.field === "Fortführungsbeitrag"
                );
                return (
                  <tr key={bank.bankAccountId}>
                    <td className="font-medium text-[var(--foreground)]">{bank.bankName}</td>
                    <td>
                      {bank.hasGlobalAssignment ? (
                        <span className="text-orange-700 font-medium">Ja</span>
                      ) : (
                        <span className="text-[var(--muted)]">Nein</span>
                      )}
                    </td>
                    <td className="text-sm">
                      {beitragAssumption ? beitragAssumption.assumption : "—"}
                    </td>
                    <td>
                      <StatusBadge status={bank.agreementStatus} />
                    </td>
                    <td className="text-sm text-[var(--muted)]">
                      {bank.status.isUncertain && bank.status.uncertaintyNote ? (
                        <span className="text-amber-700">{bank.status.uncertaintyNote}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Info-Box */}
      <div className="px-6 py-3 border-t border-[var(--border)] bg-gray-50">
        <p className="text-xs text-[var(--muted)]">
          Vereinbarungen werden unter STAMMDATEN → Bankkonten gepflegt.
        </p>
      </div>
    </div>
  );
}

// --- Sektion C: Massekredit-Status ---

function SektionMassekredit({
  massekredit,
  massekreditError,
  caseId,
}: {
  massekredit: MassekreditResponse | null;
  massekreditError: string | null;
  caseId: string;
}) {
  if (massekreditError) {
    return (
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Massekredit-Status
        </h2>
        <div className="bg-gray-50 border border-[var(--border)] rounded-lg p-6 text-center">
          <p className="text-[var(--muted)] mb-2">Massekredit-Berechnung nicht verfügbar</p>
          <p className="text-sm text-[var(--muted)]">
            Legen Sie zunächst Bankvereinbarungen an, um die Massekredit-Berechnung zu aktivieren.
          </p>
          <Link href={`/admin/cases/${caseId}/bank-accounts`} className="btn-secondary mt-4 inline-block">
            Bankkonten & Vereinbarungen pflegen
          </Link>
        </div>
      </div>
    );
  }

  if (!massekredit) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--foreground)] flex items-center">
        <svg className="w-5 h-5 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Massekredit-Status
      </h2>

      {/* UNKLAR-Warning */}
      {massekredit.unklarCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div className="text-sm text-amber-800">
            <p className="font-medium">Genauigkeit eingeschränkt</p>
            <p>{massekredit.unklarCount} Buchungen ohne Alt/Neu-Zuordnung beeinflussen die Genauigkeit der Berechnung.</p>
          </div>
        </div>
      )}

      {/* Per-Bank Cards */}
      {massekredit.perBank.map((bank) => (
        <MassekreditCard key={bank.bankAccountId} bank={bank} />
      ))}

      {/* Gesamt-Summe */}
      {massekredit.perBank.length > 1 && (
        <div className="admin-card p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--foreground)]">Gesamt Massekredit</span>
            <span className="font-bold text-lg text-[var(--foreground)]">
              {formatCents(massekredit.total.massekreditAltforderungenCents)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1 text-sm text-[var(--muted)]">
            <span>Altforderungen brutto</span>
            <span>{formatCents(massekredit.total.altforderungenBruttoCents)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-[var(--muted)]">
            <span>./. Fortführungsbeitrag</span>
            <span>{formatCents(massekredit.total.fortfuehrungsbeitragCents)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-[var(--muted)]">
            <span>./. USt</span>
            <span>{formatCents(massekredit.total.fortfuehrungsbeitragUstCents)}</span>
          </div>
        </div>
      )}

      {/* Berechnungszeitpunkt */}
      <p className="text-xs text-[var(--muted)] text-right">
        Berechnet: {new Date(massekredit.calculatedAt).toLocaleString("de-DE")}
      </p>
    </div>
  );
}

// --- Massekredit Card ---

function MassekreditCard({ bank }: { bank: PerBankMassekredit }) {
  const { status } = bank;

  // Headroom-Berechnung
  let headroomPercent: number | null = null;
  let headroomColor = "text-gray-500";
  let headroomBarColor = "bg-gray-400";

  if (status.headroomCents !== null) {
    // Cap = Massekredit + Headroom (da headroom = cap - massekredit)
    const massekreditCents = Number(status.massekreditAltforderungenCents);
    const headroomCents = Number(status.headroomCents);
    const totalCap = massekreditCents + headroomCents;
    if (totalCap > 0) {
      headroomPercent = (headroomCents / totalCap) * 100;
    }

    if (headroomPercent !== null) {
      if (headroomPercent > 50) {
        headroomColor = "text-green-700";
        headroomBarColor = "bg-green-500";
      } else if (headroomPercent >= 20) {
        headroomColor = "text-amber-700";
        headroomBarColor = "bg-amber-500";
      } else {
        headroomColor = "text-red-700";
        headroomBarColor = "bg-red-500";
      }
    }
  }

  return (
    <div className="admin-card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <h3 className="font-semibold text-[var(--foreground)]">{bank.bankName}</h3>
        <StatusBadge status={bank.agreementStatus} />
      </div>

      {/* Berechnungszeilen */}
      <div className="px-6 py-4 space-y-2">
        {status.assumptions
          .filter((a) => headroomPercent !== null ? (a.field !== "Cap" && a.field !== "Headroom") : true)
          .map((a, i) => {
          const isTotal = a.field === "Massekredit Altforderungen";
          const isDeduction = a.field.startsWith("Fortführungsbeitrag") || a.field.startsWith("USt");

          return (
            <div
              key={i}
              className={`flex items-center justify-between py-1 ${
                isTotal ? "border-t border-[var(--border)] pt-2 font-semibold" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-sm ${isTotal ? "text-[var(--foreground)]" : "text-[var(--secondary)]"}`}>
                  {isDeduction ? "– " : ""}{a.field === "Massekredit Altforderungen" ? "= Massekredit" : a.field}
                </span>
                <SourceBadge source={a.source} />
              </div>
              <span className={`text-sm font-mono ${isTotal ? "text-[var(--foreground)] font-bold" : "text-[var(--secondary)]"}`}>
                {a.assumption}
              </span>
            </div>
          );
        })}

        {/* Headroom-Bar */}
        {headroomPercent !== null && status.headroomCents !== null && (
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            {/* Cap-Zeile */}
            {(() => {
              const capAssumption = status.assumptions.find((a) => a.field === "Cap");
              return capAssumption ? (
                <div className="flex items-center justify-between py-1 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--secondary)]">Cap (vertraglich)</span>
                    <SourceBadge source={capAssumption.source} />
                  </div>
                  <span className="text-sm font-mono text-[var(--secondary)]">{capAssumption.assumption}</span>
                </div>
              ) : null;
            })()}
            {/* Headroom-Zeile mit Bar */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-[var(--secondary)]">Headroom</span>
              <span className={`text-sm font-semibold ${headroomColor}`}>
                {formatCents(status.headroomCents)} ({headroomPercent.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${headroomBarColor}`}
                style={{ width: `${Math.max(0, Math.min(100, 100 - headroomPercent))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-[var(--muted)] mt-0.5">
              <span>Ausgeschöpft</span>
              <span>Verfügbar</span>
            </div>
          </div>
        )}
      </div>

      {/* Uncertainty warning */}
      {status.isUncertain && (
        <div className="px-6 py-3 bg-amber-50 border-t border-amber-200 text-sm text-amber-800 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
          </svg>
          {status.uncertaintyNote || "Vereinbarung unsicher – Details klären"}
        </div>
      )}
    </div>
  );
}
