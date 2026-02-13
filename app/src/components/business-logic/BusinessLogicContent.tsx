"use client";

import { useState, useEffect } from "react";
import type {
  BusinessContextResponse,
  BankAgreementContext,
  SettlementRuleContext,
  EmployeeContext,
  PaymentFlowContext,
  OpenIssueContext,
} from "@/lib/types/business-context";

interface BusinessLogicContentProps {
  caseId: string;
}

export default function BusinessLogicContent({ caseId }: BusinessLogicContentProps) {
  const [data, setData] = useState<BusinessContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/cases/${caseId}/business-context`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [caseId]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="admin-card p-6 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-slate-100 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="admin-card p-6 border-l-4 border-red-500">
        <h2 className="text-lg font-semibold text-red-600 mb-2">Fehler beim Laden</h2>
        <p className="text-sm text-[var(--muted)]">{error || "Keine Daten verfügbar"}</p>
      </div>
    );
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("de-DE");
  };

  const formatCentsAsEUR = (centsStr: string) => {
    const euros = Number(centsStr) / 100;
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(euros);
  };

  const formatPercent = (rate: number) => `${Math.round(rate * 100)}%`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-card p-6 border-l-4 border-slate-600">
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
          Business-Logik {data.caseMetadata.debtorName}
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Abrechnungslogik, Zahlungsströme und Vertragsregeln
        </p>
      </div>

      {/* Verfahrenseckdaten */}
      <div className="admin-card">
        <div className="px-6 py-4 bg-slate-50 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Verfahrenseckdaten</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-[var(--muted)] text-xs mb-1">Aktenzeichen</div>
              <div className="font-medium">{data.caseMetadata.caseNumber}</div>
            </div>
            <div>
              <div className="text-[var(--muted)] text-xs mb-1">Insolvenzeröffnung</div>
              <div className="font-medium">{formatDate(data.caseMetadata.openingDate)}</div>
            </div>
            <div>
              <div className="text-[var(--muted)] text-xs mb-1">Stichtag Alt/Neu</div>
              <div className="font-medium">{formatDate(data.caseMetadata.cutoffDate)}</div>
            </div>
            <div>
              <div className="text-[var(--muted)] text-xs mb-1">Massekredit</div>
              <div className="font-medium">
                {data.massekreditSummary
                  ? `${formatCentsAsEUR(data.massekreditSummary.totalCapCents)} (${data.massekreditSummary.banks.map((b) => b.bankName).join(" + ")})`
                  : "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Patientenarten & Abrechnungswege */}
      {data.settlementRules.length > 0 && (
        <SettlementOverviewSection rules={data.settlementRules} />
      )}

      {/* Settlement-Rules: Split-Regeln pro Abrechnungsstelle */}
      {data.settlementRules.map((rule) =>
        rule.splitRules.length > 0 ? (
          <SplitRuleSection key={rule.key} rule={rule} />
        ) : null
      )}

      {/* Zahlungsströme */}
      {data.paymentFlows.length > 0 && (
        <PaymentFlowsSection flows={data.paymentFlows} bankAccounts={data.bankAccounts} />
      )}

      {/* LANR-Tabelle */}
      <EmployeeLanrSection employees={data.employees} />

      {/* Bankverbindungen */}
      <BankAgreementsSection
        agreements={data.bankAgreements}
        bankAccounts={data.bankAccounts}
        formatCentsAsEUR={formatCentsAsEUR}
        formatPercent={formatPercent}
        formatDate={formatDate}
      />

      {/* Offene Punkte */}
      {data.openIssues.length > 0 && <OpenIssuesSection issues={data.openIssues} />}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function SettlementOverviewSection({ rules }: { rules: SettlementRuleContext[] }) {
  const gkvRules = rules.filter((r) => r.key === "kv" || r.key === "hzv");
  const pkvRules = rules.filter((r) => r.key === "pvs");

  const rhythmLabel = (rhythm: string) => {
    switch (rhythm) {
      case "QUARTERLY": return "Quartalsabrechnung";
      case "MONTHLY": return "Monatliche Pauschalen";
      case "PER_TREATMENT": return "Einzelrechnungen";
      default: return rhythm;
    }
  };

  return (
    <div className="admin-card">
      <div className="px-6 py-4 bg-slate-50 border-b border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Patientenarten & Abrechnungswege</h2>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* GKV */}
          {gkvRules.length > 0 && (
            <div className="border-2 border-slate-200 rounded-lg p-5">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-base">GKV-Patienten (gesetzlich)</h3>
                  <p className="text-xs text-[var(--muted)]">{gkvRules.length} Abrechnungswege</p>
                </div>
              </div>
              <div className="space-y-4">
                {gkvRules.map((rule, idx) => (
                  <div key={rule.key} className="bg-slate-50 rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-blue-600 text-white rounded text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </div>
                      <div className="font-semibold text-sm">{rule.name}</div>
                    </div>
                    <div className="text-xs text-[var(--muted)] space-y-1 ml-8">
                      <div>→ {rhythmLabel(rule.rhythm)}</div>
                      <div>→ ca. {rule.lagDays} Tage Verzögerung</div>
                      {rule.fallbackRule === "VORMONAT" && (
                        <div>→ Vormonat-Logik (Zahlung M = Leistung M-1)</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PKV */}
          {pkvRules.length > 0 && (
            <div className="border-2 border-slate-200 rounded-lg p-5">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                <div className="w-10 h-10 bg-purple-100 rounded flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-base">PKV-Patienten (privat)</h3>
                  <p className="text-xs text-[var(--muted)]">{pkvRules.length} Abrechnungsweg</p>
                </div>
              </div>
              <div className="space-y-4">
                {pkvRules.map((rule, idx) => (
                  <div key={rule.key} className="bg-slate-50 rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-purple-600 text-white rounded text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </div>
                      <div className="font-semibold text-sm">{rule.name}</div>
                    </div>
                    <div className="text-xs text-[var(--muted)] space-y-1 ml-8">
                      <div>→ {rhythmLabel(rule.rhythm)}</div>
                      <div>→ ca. {rule.lagDays} Tage Verzögerung</div>
                      {rule.requiresServiceDate && (
                        <div className="text-amber-600">
                          → Erfordert Behandlungsdatum für Alt/Neu-Zuordnung
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SplitRuleSection({ rule }: { rule: SettlementRuleContext }) {
  const sortedRules = [...rule.splitRules].sort((a, b) =>
    a.periodKey.localeCompare(b.periodKey)
  );

  // Finde die interessanteste Regel (Mixed, also weder 100% Alt noch 100% Neu)
  const mixedRule = sortedRules.find((r) => r.altRatio > 0 && r.altRatio < 1);

  const formatRatio = (ratio: number) => {
    // Bruchdarstellung für bekannte Werte
    const fractions: Record<string, string> = {
      "0.3333": "1/3",
      "0.6667": "2/3",
    };
    const key = ratio.toFixed(4);
    if (fractions[key]) return fractions[key];
    // Für Tagesanteile (z.B. 28/31)
    if (ratio > 0 && ratio < 1) {
      for (let denom = 2; denom <= 31; denom++) {
        const num = Math.round(ratio * denom);
        if (Math.abs(num / denom - ratio) < 0.001) {
          return `${num}/${denom}`;
        }
      }
    }
    return `${Math.round(ratio * 100)}%`;
  };

  return (
    <div className="admin-card">
      <div className="px-6 py-4 bg-slate-50 border-b border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          {rule.name} — Alt/Neu-Regel
          {rule.fallbackRule === "VORMONAT" && " & Zeitversatz"}
        </h2>
      </div>
      <div className="p-6">
        {rule.fallbackRule === "VORMONAT" && (
          <div className="mb-6">
            <div className="flex items-center gap-8 mb-4">
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium text-[var(--muted)]">Leistung:</div>
                <div className="px-3 py-2 bg-slate-100 rounded font-medium">Monat M-1</div>
              </div>
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium text-[var(--muted)]">Zahlung:</div>
                <div className="px-3 py-2 bg-blue-500 text-white rounded font-medium">Monat M</div>
              </div>
            </div>
            <div className="text-sm text-[var(--muted)]">
              Beispiel: Dezember-Zahlung = November-Leistung
            </div>
          </div>
        )}

        {mixedRule && (
          <div className="bg-slate-50 rounded p-4">
            <div className="font-semibold mb-3 text-sm">
              Übergangsperiode ({mixedRule.periodKey}):
            </div>
            <div className="mb-1 text-xs text-[var(--muted)]">Alt/Neu-Aufteilung:</div>
            <SplitRuleBar altRatio={mixedRule.altRatio} neuRatio={mixedRule.neuRatio} formatRatio={formatRatio} />
          </div>
        )}

        {rule.legalReference && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
            <strong>Rechtsgrundlage:</strong> {rule.legalReference}
          </div>
        )}
      </div>
    </div>
  );
}

function SplitRuleBar({
  altRatio,
  neuRatio,
  formatRatio,
}: {
  altRatio: number;
  neuRatio: number;
  formatRatio: (r: number) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-8 rounded overflow-hidden border border-slate-300 flex">
        <div
          className="bg-amber-500 flex items-center justify-center text-white text-xs font-medium"
          style={{ width: `${altRatio * 100}%` }}
        >
          {formatRatio(altRatio)} Altmasse
        </div>
        <div
          className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
          style={{ width: `${neuRatio * 100}%` }}
        >
          {formatRatio(neuRatio)} Neumasse
        </div>
      </div>
    </div>
  );
}

function PaymentFlowsSection({
  flows,
  bankAccounts,
}: {
  flows: PaymentFlowContext[];
  bankAccounts: { id: string; bankName: string; accountName: string; iban: string | null; isLiquidityRelevant: boolean; accountType: string }[];
}) {
  const iskFlows = flows.filter((f) => f.iskAccountId);

  if (iskFlows.length === 0) return null;

  return (
    <div className="admin-card">
      <div className="px-6 py-4 bg-slate-50 border-b border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Zahlungsströme</h2>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {iskFlows.map((flow) => (
            <div key={flow.locationId} className="border-2 border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold">{flow.iskAccountName || flow.locationName}</div>
                  {flow.iskIban && (
                    <div className="text-xs text-[var(--muted)] font-mono">
                      {flow.iskIban.replace(/(.{4})/g, "$1 ").trim()}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {flow.topPayers.map((payer) => (
                  <div key={payer} className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div>{payer}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmployeeLanrSection({ employees }: { employees: EmployeeContext[] }) {
  const lanrEmployees = employees.filter((e) => e.lanr);

  if (lanrEmployees.length === 0) return null;

  return (
    <div className="admin-card">
      <div className="px-6 py-4 bg-slate-50 border-b border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          HZV-Ärzte (LANR-gebunden)
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Standort</th>
              <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Arzt</th>
              <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">LANR</th>
              <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Rolle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {lanrEmployees.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50">
                <td className="py-3 px-4">{emp.locationName || "—"}</td>
                <td className="py-3 px-4 font-medium">
                  {emp.lastName}{emp.firstName ? `, ${emp.firstName}` : ""}
                </td>
                <td className="py-3 px-4 font-mono text-xs">{emp.lanr}</td>
                <td className="py-3 px-4 text-[var(--muted)]">{emp.role || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BankAgreementsSection({
  agreements,
  bankAccounts,
  formatCentsAsEUR,
  formatPercent,
  formatDate,
}: {
  agreements: BankAgreementContext[];
  bankAccounts: { id: string; bankName: string; iban: string | null }[];
  formatCentsAsEUR: (cents: string) => string;
  formatPercent: (rate: number) => string;
  formatDate: (date: string | null) => string;
}) {
  if (agreements.length === 0) return null;

  const statusBadge = (status: string) => {
    switch (status) {
      case "VEREINBART":
        return <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">Vereinbart</span>;
      case "VERHANDLUNG":
        return <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded">In Verhandlung</span>;
      default:
        return <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">Offen</span>;
    }
  };

  return (
    <div className="admin-card">
      <div className="px-6 py-4 bg-slate-50 border-b border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Bankverbindungen & Status</h2>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {agreements.map((ag) => {
          const account = bankAccounts.find((ba) => ba.id === ag.bankAccountId);
          return (
            <div key={ag.id} className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">{ag.bankName}</h3>
                  {account?.iban && (
                    <div className="text-xs text-[var(--muted)] font-mono">{account.iban}</div>
                  )}
                </div>
                {statusBadge(ag.agreementStatus)}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {ag.creditCapCents && (
                  <div>
                    <div className="text-[var(--muted)] text-xs">Massekredit-Cap</div>
                    <div className="font-medium">{formatCentsAsEUR(ag.creditCapCents)}</div>
                  </div>
                )}
                {ag.contributionRate !== null && (
                  <div>
                    <div className="text-[var(--muted)] text-xs">Fortführungsbeitrag</div>
                    <div className="font-medium">
                      {formatPercent(ag.contributionRate)}
                      {ag.contributionVatRate !== null && ` + ${formatPercent(ag.contributionVatRate)} USt`}
                    </div>
                  </div>
                )}
                {ag.hasGlobalAssignment && (
                  <div>
                    <div className="text-[var(--muted)] text-xs">Globalzession</div>
                    <div className="font-medium text-green-700">Ja</div>
                  </div>
                )}
                {ag.agreementDate && (
                  <div>
                    <div className="text-[var(--muted)] text-xs">Vereinbarungsdatum</div>
                    <div className="font-medium">{formatDate(ag.agreementDate)}</div>
                  </div>
                )}
              </div>
              {ag.agreementNote && (
                <div className="mt-3 p-3 bg-slate-50 rounded text-xs text-[var(--muted)]">
                  {ag.agreementNote}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OpenIssuesSection({ issues }: { issues: OpenIssueContext[] }) {
  const priorityStyles: Record<string, { bg: string; icon: string }> = {
    KRITISCH: { bg: "bg-red-50 border-red-200", icon: "bg-red-600" },
    HOCH: { bg: "bg-amber-50 border-amber-200", icon: "bg-amber-600" },
    MITTEL: { bg: "bg-amber-50 border-amber-200", icon: "bg-amber-500" },
    NIEDRIG: { bg: "bg-slate-50 border-slate-200", icon: "bg-slate-500" },
  };

  return (
    <div className="admin-card">
      <div className="px-6 py-4 bg-slate-50 border-b border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Offene Punkte</h2>
      </div>
      <div className="p-6">
        <div className="space-y-3">
          {issues.map((issue, idx) => {
            const style = priorityStyles[issue.priority] || priorityStyles.MITTEL;
            return (
              <div key={issue.id} className={`flex items-start gap-3 p-3 rounded border ${style.bg}`}>
                <div className={`w-6 h-6 rounded ${style.icon} text-white flex items-center justify-center flex-shrink-0 text-xs font-bold`}>
                  {idx + 1}
                </div>
                <div className="text-sm">
                  <div>{issue.content}</div>
                  <div className="flex gap-3 mt-1 text-xs text-[var(--muted)]">
                    <span>Priorität: {issue.priority}</span>
                    <span>Status: {issue.status}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
