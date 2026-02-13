"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import type {
  BusinessContextResponse,
  SettlementRuleContext,
  BankAgreementContext,
} from "@/lib/types/business-context";

export default function BusinessLogicPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [data, setData] = useState<BusinessContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/cases/${id}/business-context`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setData(await response.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--text)]">
        <div className="container mx-auto px-6 py-8 max-w-5xl">
          {[1, 2, 3].map((i) => (
            <div key={i} className="admin-card p-6 mb-6 animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-slate-100 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--text)]">
        <div className="container mx-auto px-6 py-8 max-w-5xl">
          <div className="admin-card p-6 border-l-4 border-red-500">
            <h2 className="text-lg font-semibold text-red-600 mb-2">Fehler beim Laden</h2>
            <p className="text-sm text-muted-foreground">{error || "Keine Daten verfügbar"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)]">
      <div className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="container mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold">
            Business-Logik — {data.caseMetadata.debtorName}
          </h1>
          <p className="text-muted-foreground mt-1">
            Grundkonzepte für Insolvenzverfahren — Einnahmen, Einzahlungen, Alt/Neu-Masse
          </p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-5xl">
        <div className="space-y-8">
          <div className="flex gap-2 border-b border-[var(--border)]" role="tablist">
            <TabButton href="#grundkonzepte" label="Grundkonzepte" />
            <TabButton href="#abrechnungslogik" label="Abrechnungslogik" />
            <TabButton href="#massekredit" label="Massekredit" />
            <TabButton href="#datenqualitaet" label="Datenqualität" />
          </div>

          <div className="space-y-12">
            <TabSection id="grundkonzepte" title="Grundkonzepte">
              <Grundkonzepte data={data} />
            </TabSection>

            <TabSection id="abrechnungslogik" title="Abrechnungslogik">
              <Abrechnungslogik rules={data.settlementRules} />
            </TabSection>

            <TabSection id="massekredit" title="Massekredit">
              <MassekreditSection agreements={data.bankAgreements} />
            </TabSection>

            <TabSection id="datenqualitaet" title="Datenqualität">
              <Datenqualitaet issues={data.openIssues} />
            </TabSection>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-[var(--text)] border-b-2 border-transparent hover:border-[var(--accent)] transition-colors"
    >
      {label}
    </a>
  );
}

function TabSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-bold mb-6 border-b border-[var(--border)] pb-2">{title}</h2>
      {children}
    </section>
  );
}

// =============================================================================
// TAB 1: GRUNDKONZEPTE
// =============================================================================

function Grundkonzepte({ data }: { data: BusinessContextResponse }) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("de-DE");
  };

  const cutoffLabel = data.caseMetadata.cutoffDate
    ? `Vor ${formatDate(data.caseMetadata.cutoffDate)}`
    : "Vor Insolvenzeröffnung";

  const cutoffLabelAfter = data.caseMetadata.cutoffDate
    ? `Ab ${formatDate(data.caseMetadata.cutoffDate)}`
    : "Ab Insolvenzeröffnung";

  // Finde die HZV-Regel falls vorhanden für das Beispiel
  const hzvRule = data.settlementRules.find((r) => r.key === "hzv");

  return (
    <div className="space-y-8">
      {/* Einnahmen vs. Einzahlungen */}
      <div className="admin-card p-6">
        <h3 className="text-lg font-semibold mb-4">Einnahmen vs. Einzahlungen</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 px-3 font-semibold">Begriff</th>
                <th className="text-left py-2 px-3 font-semibold">Definition</th>
                <th className="text-left py-2 px-3 font-semibold">Beispiel</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--border)]">
                <td className="py-3 px-3 font-medium">Einnahme</td>
                <td className="py-3 px-3">Leistung wurde erbracht, Rechnung gestellt</td>
                <td className="py-3 px-3 text-muted-foreground">Patient behandelt am 15.11. → Einnahme Nov</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-medium">Einzahlung</td>
                <td className="py-3 px-3">Geld ist auf dem Konto eingegangen</td>
                <td className="py-3 px-3 text-muted-foreground">KV zahlt am 10.12. → Einzahlung Dez</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm font-medium text-blue-400 mb-2">Warum wichtig?</p>
          <p className="text-sm">
            Liquiditätsplanung basiert auf <strong>Einzahlungen</strong> (wann kommt Geld?), nicht Einnahmen (wann wurde geleistet?).
          </p>
        </div>
        {hzvRule && (
          <div className="mt-4 bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <p className="text-sm font-semibold mb-2">Beispiel {hzvRule.name}:</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>Leistung: Oktober 2025</li>
              <li>Abschlag-Zahlung: November 2025 (Vormonat-Logik)</li>
              <li>Schlusszahlung: Dezember 2025 (Quartalsende)</li>
            </ul>
            <p className="text-sm mt-3 font-medium">
              → Einzahlung = Vormonat-Logik + Quartalsschlusszahlung
            </p>
          </div>
        )}
      </div>

      {/* IST vs. PLAN */}
      <div className="admin-card p-6">
        <h3 className="text-lg font-semibold mb-4">IST vs. PLAN</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 px-3 font-semibold">Begriff</th>
                <th className="text-left py-2 px-3 font-semibold">Definition</th>
                <th className="text-left py-2 px-3 font-semibold">Quelle</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--border)]">
                <td className="py-3 px-3 font-medium">IST</td>
                <td className="py-3 px-3">Tatsächlich gebuchte Transaktionen</td>
                <td className="py-3 px-3 text-muted-foreground">Kontoauszüge, Abrechnungsbescheide</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-medium">PLAN</td>
                <td className="py-3 px-3">Prognostizierte zukünftige Transaktionen</td>
                <td className="py-3 px-3 text-muted-foreground">Annahmen, Verträge, Durchschnitte</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Alt- vs. Neumasse */}
      <div className="admin-card p-6">
        <h3 className="text-lg font-semibold mb-4">Alt- vs. Neumasse</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 px-3 font-semibold">Begriff</th>
                <th className="text-left py-2 px-3 font-semibold">Definition</th>
                <th className="text-left py-2 px-3 font-semibold">Zeitpunkt</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--border)]">
                <td className="py-3 px-3 font-medium">Altmasse</td>
                <td className="py-3 px-3">Leistungen VOR Insolvenzeröffnung</td>
                <td className="py-3 px-3 text-muted-foreground">{cutoffLabel}</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-medium">Neumasse</td>
                <td className="py-3 px-3">Leistungen AB Insolvenzeröffnung</td>
                <td className="py-3 px-3 text-muted-foreground">{cutoffLabelAfter}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {data.bankAgreements.some((a) => a.contributionRate !== null) && (
          <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-sm font-medium text-amber-400 mb-2">Warum wichtig?</p>
            <p className="text-sm mb-2">Massekreditvertrag bestimmt:</p>
            <ul className="space-y-1 text-sm">
              <li><strong>Altforderungen:</strong> Fortführungsbeitrag an Bank</li>
              <li><strong>Neuforderungen:</strong> 100% an Masse (kein Fortführungsbeitrag)</li>
            </ul>
          </div>
        )}

        {data.settlementRules.length > 0 && (
          <div className="mt-4 bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <p className="text-sm font-semibold mb-2">Zuordnungsregeln ({data.caseMetadata.debtorName}):</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {data.settlementRules.map((rule) => {
                const mixedRule = rule.splitRules.find((r) => r.altRatio > 0 && r.altRatio < 1);
                if (!mixedRule) return null;
                return (
                  <li key={rule.key}>
                    <strong>{rule.name}:</strong> {mixedRule.note}
                  </li>
                );
              })}
              {data.settlementRules
                .filter((r) => r.requiresServiceDate)
                .map((rule) => (
                  <li key={rule.key}>
                    <strong>{rule.name}:</strong> Nach Behandlungsdatum
                    {rule.legalReference && ` (${rule.legalReference})`}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// TAB 2: ABRECHNUNGSLOGIK
// =============================================================================

function Abrechnungslogik({ rules }: { rules: SettlementRuleContext[] }) {
  if (rules.length === 0) {
    return (
      <div className="admin-card p-6">
        <p className="text-muted-foreground">Keine Abrechnungsregeln konfiguriert.</p>
      </div>
    );
  }

  const rhythmLabel = (rhythm: string) => {
    switch (rhythm) {
      case "QUARTERLY": return "Quartalsweise";
      case "MONTHLY": return "Monatlich";
      case "PER_TREATMENT": return "Per Behandlung";
      default: return rhythm;
    }
  };

  return (
    <div className="space-y-8">
      {rules.map((rule) => (
        <div key={rule.key} className="admin-card p-6">
          <h3 className="text-lg font-semibold mb-4">{rule.name}</h3>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold mb-2">Zahlungsstruktur:</p>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>Rhythmus: {rhythmLabel(rule.rhythm)}</div>
              <div>Verzögerung: ca. {rule.lagDays} Tage</div>
              {rule.fallbackRule === "VORMONAT" && (
                <div>Regel: Zahlung M = Leistung M-1 (Vormonat-Logik)</div>
              )}
              {rule.requiresServiceDate && (
                <div className="text-amber-400">Erfordert Behandlungsdatum für Alt/Neu-Zuordnung</div>
              )}
            </div>
          </div>

          {/* Split-Regeln */}
          {rule.splitRules.length > 0 && (
            <div className="overflow-x-auto">
              <p className="text-sm font-semibold mb-2">Alt/Neu-Zuordnung:</p>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 px-3 font-semibold">Periode</th>
                    <th className="text-right py-2 px-3 font-semibold">Altmasse</th>
                    <th className="text-right py-2 px-3 font-semibold">Neumasse</th>
                    <th className="text-left py-2 px-3 font-semibold">Quelle</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rule.splitRules]
                    .sort((a, b) => a.periodKey.localeCompare(b.periodKey))
                    .map((sr) => (
                      <tr key={sr.periodKey} className="border-b border-[var(--border)]">
                        <td className="py-3 px-3 font-medium">{sr.periodKey}</td>
                        <td className="py-3 px-3 text-right">
                          <span className={sr.altRatio > 0 ? "text-amber-400 font-semibold" : "text-muted-foreground"}>
                            {formatRatio(sr.altRatio)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className={sr.neuRatio > 0 ? "text-green-400 font-semibold" : "text-muted-foreground"}>
                            {formatRatio(sr.neuRatio)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground text-xs">{sr.note}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {rule.legalReference && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs">
              <strong>Rechtsgrundlage:</strong> {rule.legalReference}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// TAB 3: MASSEKREDIT
// =============================================================================

function MassekreditSection({ agreements }: { agreements: BankAgreementContext[] }) {
  if (agreements.length === 0) {
    return (
      <div className="admin-card p-6">
        <p className="text-muted-foreground">Keine Bankvereinbarungen konfiguriert.</p>
      </div>
    );
  }

  const formatCentsAsEUR = (centsStr: string) => {
    const euros = Number(centsStr) / 100;
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(euros);
  };

  return (
    <div className="space-y-8">
      {agreements.map((ag) => (
        <div key={ag.id} className="admin-card p-6">
          <h3 className="text-lg font-semibold mb-4">
            Massekreditvertrag {ag.bankName}
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 px-3 font-semibold">Parameter</th>
                  <th className="text-left py-2 px-3 font-semibold">Wert</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--border)]">
                  <td className="py-3 px-3">Kreditgeber</td>
                  <td className="py-3 px-3 text-muted-foreground">{ag.bankName}</td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="py-3 px-3">Status</td>
                  <td className="py-3 px-3">
                    <AgreementStatusBadge status={ag.agreementStatus} />
                  </td>
                </tr>
                {ag.creditCapCents && (
                  <tr className="border-b border-[var(--border)]">
                    <td className="py-3 px-3">Maximalbetrag</td>
                    <td className="py-3 px-3 font-semibold">
                      {formatCentsAsEUR(ag.creditCapCents)}
                    </td>
                  </tr>
                )}
                {ag.contributionRate !== null && (
                  <tr className="border-b border-[var(--border)]">
                    <td className="py-3 px-3">Fortführungsbeitrag</td>
                    <td className="py-3 px-3 font-semibold">
                      {Math.round(ag.contributionRate * 100)}%
                      {ag.contributionVatRate !== null && ` + USt auf Altforderungen`}
                    </td>
                  </tr>
                )}
                {ag.hasGlobalAssignment && (
                  <tr className="border-b border-[var(--border)]">
                    <td className="py-3 px-3">Globalzession</td>
                    <td className="py-3 px-3 text-green-400">Vorhanden</td>
                  </tr>
                )}
                {ag.agreementDate && (
                  <tr>
                    <td className="py-3 px-3">Vereinbarungsdatum</td>
                    <td className="py-3 px-3 text-muted-foreground">
                      {new Date(ag.agreementDate).toLocaleDateString("de-DE")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {ag.isUncertain && ag.uncertaintyNote && (
            <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-sm font-medium text-amber-400">Unsicherheit: {ag.uncertaintyNote}</p>
            </div>
          )}
        </div>
      ))}

      {/* Fortführungsbeitrag-Beispiel */}
      {agreements.some((a) => a.contributionRate !== null) && (
        <FortfuehrungsbeitragExample agreements={agreements} />
      )}
    </div>
  );
}

function FortfuehrungsbeitragExample({ agreements }: { agreements: BankAgreementContext[] }) {
  // Nimm die erste Bank mit Fortführungsbeitrag als Beispiel
  const ag = agreements.find((a) => a.contributionRate !== null);
  if (!ag || ag.contributionRate === null) return null;

  const rate = ag.contributionRate;
  const vatRate = ag.contributionVatRate ?? 0;

  // Berechnung mit 100.000 EUR Beispiel-Altforderung (Brutto)
  const brutto = 100000;
  const beitrag = brutto * rate;
  const ust = beitrag * vatRate;
  const masseErhaelt = brutto - beitrag - ust;
  const bankBehaelt = beitrag + ust;
  const bankProzent = (bankBehaelt / brutto * 100).toFixed(0);

  const formatEUR = (val: number) =>
    new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(val);

  return (
    <div className="admin-card p-6">
      <h3 className="text-lg font-semibold mb-4">
        Fortführungsbeitrag — Rechenbeispiel
      </h3>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
        <p className="text-sm font-semibold mb-3">
          Beispiel Altforderung {formatEUR(brutto)} EUR (Brutto):
        </p>
        <div className="space-y-2 text-sm font-mono">
          <div className="flex justify-between">
            <span>Bruttoeinzug:</span>
            <span className="font-semibold">{formatEUR(brutto)} EUR</span>
          </div>
          <div className="flex justify-between text-red-400">
            <span>- Fortführungsbeitrag ({Math.round(rate * 100)}% von Brutto):</span>
            <span>-{formatEUR(beitrag)} EUR</span>
          </div>
          {vatRate > 0 && (
            <div className="flex justify-between text-red-400">
              <span>- USt auf FB ({Math.round(vatRate * 100)}%):</span>
              <span>-{formatEUR(ust)} EUR</span>
            </div>
          )}
          <div className="flex justify-between border-t border-[var(--border)] pt-2 font-semibold text-green-400">
            <span>= Masse erhält:</span>
            <span>{formatEUR(masseErhaelt)} EUR</span>
          </div>
          <div className="flex justify-between mt-3 text-amber-400">
            <span>Bank behält:</span>
            <span className="font-semibold">{formatEUR(bankBehaelt)} EUR ({bankProzent}%)</span>
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <p className="text-sm font-medium text-amber-400">
          → Nicht {Math.round(rate * 100)}%, sondern ~{bankProzent}% der Bruttoeinzüge bleiben bei der Bank!
        </p>
      </div>
    </div>
  );
}

function AgreementStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "VEREINBART":
      return <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">Vereinbart</span>;
    case "VERHANDLUNG":
      return <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded">In Verhandlung</span>;
    default:
      return <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">Offen</span>;
  }
}

// =============================================================================
// TAB 4: DATENQUALITÄT
// =============================================================================

function Datenqualitaet({ issues }: { issues: BusinessContextResponse["openIssues"] }) {
  return (
    <div className="space-y-8">
      {/* Offene Fragen */}
      {issues.length > 0 && (
        <div className="admin-card p-6">
          <h3 className="text-lg font-semibold mb-4">Offene Fragen an IV</h3>
          <div className="space-y-3">
            {issues.map((issue, idx) => (
              <QuestionBox
                key={issue.id}
                number={idx + 1}
                question={issue.content}
                priority={issue.priority}
                status={issue.status}
              />
            ))}
          </div>
          {issues.some((i) => i.priority === "KRITISCH" || i.priority === "HOCH") && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm font-medium text-red-400">
                → Ohne diese Daten ist die Liquiditätsplanung mit hoher Unsicherheit behaftet!
              </p>
            </div>
          )}
        </div>
      )}

      {issues.length === 0 && (
        <div className="admin-card p-6">
          <p className="text-muted-foreground">Keine offenen Fragen vorhanden.</p>
        </div>
      )}
    </div>
  );
}

function QuestionBox({
  number,
  question,
  priority,
  status,
}: {
  number: number;
  question: string;
  priority: string;
  status: string;
}) {
  const priorityColor = priority === "KRITISCH" ? "text-red-400" : "text-amber-400";
  const priorityBg =
    priority === "KRITISCH"
      ? "bg-red-500/10 border-red-500/20"
      : "bg-amber-500/10 border-amber-500/20";

  return (
    <div className={`border rounded-lg p-4 ${priorityBg}`}>
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 text-xl font-bold">{number}.</span>
        <div className="flex-1">
          <p className="text-sm font-semibold mb-2">{question}</p>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className={`font-medium ${priorityColor}`}>Priorität: {priority}</span>
            <span className="text-muted-foreground">Status: {status}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function formatRatio(ratio: number): string {
  if (ratio === 0) return "0%";
  if (ratio === 1) return "100%";
  // Bruchdarstellung
  const fractions: Record<string, string> = {
    "0.3333": "1/3",
    "0.6667": "2/3",
  };
  const key = ratio.toFixed(4);
  if (fractions[key]) return fractions[key];
  // Tagesanteile
  for (let denom = 2; denom <= 31; denom++) {
    const num = Math.round(ratio * denom);
    if (Math.abs(num / denom - ratio) < 0.001) {
      return `${num}/${denom}`;
    }
  }
  return `${Math.round(ratio * 100)}%`;
}
