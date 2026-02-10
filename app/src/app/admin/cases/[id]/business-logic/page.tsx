"use client";

import { use } from 'react';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function BusinessLogicPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [caseName, setCaseName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCaseData() {
      try {
        const response = await fetch(`/api/cases/${id}`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setCaseName(data.debtorName || data.name || '');
        }
      } catch (error) {
        console.error('Fehler beim Laden der Falldaten:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchCaseData();
  }, [id]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)]">
      {/* Header mit Navigation */}
      <div className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="container mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold">Business-Logik der Liquiditätsplanung</h1>
          <p className="text-muted-foreground mt-1">
            Grundkonzepte für Insolvenzverfahren — Einnahmen, Einzahlungen, Alt/Neu-Masse
          </p>
        </div>
      </div>

      {/* Inhaltsbereich */}
      <div className="container mx-auto px-6 py-8 max-w-5xl">
        <div className="space-y-8">
          {/* Tab-Navigation */}
          <div className="flex gap-2 border-b border-[var(--border)]" role="tablist">
            <TabButton href="#grundkonzepte" label="Grundkonzepte" />
            <TabButton href="#abrechnungslogik" label="Abrechnungslogik" />
            <TabButton href="#massekredit" label="Massekredit" />
            <TabButton href="#datenqualitaet" label="Datenqualität" />
          </div>

          {/* Tab-Inhalte */}
          <div className="space-y-12">
            <TabSection id="grundkonzepte" title="Grundkonzepte">
              <Grundkonzepte />
            </TabSection>

            <TabSection id="abrechnungslogik" title="Abrechnungslogik">
              <Abrechnungslogik />
            </TabSection>

            <TabSection id="massekredit" title="Massekredit">
              <Massekredit />
            </TabSection>

            <TabSection id="datenqualitaet" title="Datenqualität">
              <Datenqualitaet />
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

// ========== TAB 1: GRUNDKONZEPTE ==========

function Grundkonzepte() {
  return (
    <div className="space-y-8">
      {/* Einnahmen vs. Einzahlungen */}
      <div className="admin-card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">💰</span>
          Einnahmen vs. Einzahlungen
        </h3>

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
          <p className="text-sm font-medium text-blue-400 mb-2">⚠️ Warum wichtig?</p>
          <p className="text-sm">
            Liquiditätsplanung basiert auf <strong>Einzahlungen</strong> (wann kommt Geld?), nicht Einnahmen (wann wurde geleistet?).
          </p>
        </div>

        <div className="mt-4 bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
          <p className="text-sm font-semibold mb-2">Beispiel HZV:</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Leistung: Oktober 2025</li>
            <li>• Abschlag-Zahlung: November 2025 (Vormonat-Logik)</li>
            <li>• Schlusszahlung: Dezember 2025 (Quartalsende)</li>
          </ul>
          <p className="text-sm mt-3 font-medium">
            → Einzahlung = Vormonat-Logik + Quartalsschlusszahlung
          </p>
        </div>
      </div>

      {/* IST vs. PLAN */}
      <div className="admin-card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">📊</span>
          IST vs. PLAN
        </h3>

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
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">⚖️</span>
          Alt- vs. Neumasse
        </h3>

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
                <td className="py-3 px-3 text-muted-foreground">Vor 29.10.2025</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-medium">Neumasse</td>
                <td className="py-3 px-3">Leistungen AB Insolvenzeröffnung</td>
                <td className="py-3 px-3 text-muted-foreground">Ab 29.10.2025</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-sm font-medium text-amber-400 mb-2">⚠️ Warum wichtig?</p>
          <p className="text-sm mb-2">
            Massekreditvertrag bestimmt:
          </p>
          <ul className="space-y-1 text-sm">
            <li>• <strong>Altforderungen:</strong> 90% an Masse (10% + USt = Fortführungsbeitrag an Sparkasse)</li>
            <li>• <strong>Neuforderungen:</strong> 100% an Masse (kein Fortführungsbeitrag)</li>
          </ul>
        </div>

        <div className="mt-4 bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
          <p className="text-sm font-semibold mb-2">Zuordnungsregeln (HVPlus-spezifisch):</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• <strong>KV Q4/2025:</strong> 1/3 Alt, 2/3 Neu (§ 1 (2) a Massekreditvertrag)</li>
            <li>• <strong>HZV Oktober 2025:</strong> 28/31 Alt, 3/31 Neu (§ 1 (2) b)</li>
            <li>• <strong>PVS:</strong> Nach Behandlungsdatum (§ 1 (2) c)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ========== TAB 2: ABRECHNUNGSLOGIK ==========

function Abrechnungslogik() {
  return (
    <div className="space-y-8">
      {/* HZV */}
      <div className="admin-card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">🏥</span>
          HZV (Hausarztzentrierte Versorgung) — HAVG
        </h3>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 mb-4">
          <p className="text-sm font-semibold mb-2">Zahlungsstruktur:</p>
          <div className="space-y-2 text-sm">
            <div>
              <strong>Monat M:</strong>
              <ul className="ml-4 mt-1 space-y-1 text-muted-foreground">
                <li>• Abschlag für Leistung M-1 (Vormonat) = 30 T€ (Velbert) / 40 T€ (Uckerath)</li>
              </ul>
            </div>
            <div className="mt-3">
              <strong>Quartalsende (März, Juni, September, Dezember):</strong>
              <ul className="ml-4 mt-1 space-y-1 text-muted-foreground">
                <li>• Schlusszahlung für Quartal = ~100 T€ (Velbert) / ~110 T€ (Uckerath)</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <p className="text-sm font-semibold mb-2">Beispiel Velbert Q4/2025:</p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 px-3 font-semibold">Monat</th>
                <th className="text-right py-2 px-3 font-semibold">Abschlag (Vormonat)</th>
                <th className="text-right py-2 px-3 font-semibold">Schlusszahlung (Quartal)</th>
                <th className="text-right py-2 px-3 font-semibold">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--border)]">
                <td className="py-3 px-3">Oktober</td>
                <td className="py-3 px-3 text-right text-muted-foreground">30 T€ (Sep)</td>
                <td className="py-3 px-3 text-right">—</td>
                <td className="py-3 px-3 text-right font-medium">30 T€</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="py-3 px-3">November</td>
                <td className="py-3 px-3 text-right text-muted-foreground">30 T€ (Okt)</td>
                <td className="py-3 px-3 text-right">—</td>
                <td className="py-3 px-3 text-right font-medium">30 T€</td>
              </tr>
              <tr className="bg-green-500/10">
                <td className="py-3 px-3 font-semibold">Dezember</td>
                <td className="py-3 px-3 text-right text-muted-foreground">30 T€ (Nov)</td>
                <td className="py-3 px-3 text-right font-semibold text-green-400">100 T€ (Q4)</td>
                <td className="py-3 px-3 text-right font-bold text-green-400">130 T€</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-sm font-medium text-green-400">
            ➡️ Dezember ist immer der stärkste Monat pro Quartal!
          </p>
        </div>
      </div>

      {/* KV */}
      <div className="admin-card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">🏛️</span>
          KV (Kassenärztliche Vereinigung) — KVNO
        </h3>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 mb-4">
          <p className="text-sm font-semibold mb-2">Zahlungsstruktur:</p>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div>Quartal Q:</div>
            <ul className="ml-4 space-y-1">
              <li>• Abrechnung läuft über Quartal</li>
              <li>• Zahlung erfolgt ~6-8 Wochen nach Quartalsende</li>
              <li>• Restzahlung/Nachzahlung ~10 Wochen nach Quartalsende</li>
            </ul>
          </div>
        </div>

        <div className="overflow-x-auto">
          <p className="text-sm font-semibold mb-2">Beispiel Velbert Q3/2025:</p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 px-3 font-semibold">Zahlung</th>
                <th className="text-left py-2 px-3 font-semibold">Datum</th>
                <th className="text-right py-2 px-3 font-semibold">Betrag</th>
                <th className="text-left py-2 px-3 font-semibold">Bemerkung</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--border)]">
                <td className="py-3 px-3">Abschlag Q3</td>
                <td className="py-3 px-3 text-muted-foreground">10.10.2025</td>
                <td className="py-3 px-3 text-right text-green-400">39,1 T€</td>
                <td className="py-3 px-3 text-muted-foreground">Regulär</td>
              </tr>
              <tr className="bg-red-500/10">
                <td className="py-3 px-3 font-semibold">Restzahlung Q3</td>
                <td className="py-3 px-3 text-muted-foreground">10.12.2025</td>
                <td className="py-3 px-3 text-right font-semibold text-red-400">-7,8 T€</td>
                <td className="py-3 px-3 text-red-400 font-medium">Rückzahlung (Overpayment)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-sm font-semibold mb-2">Beispiel Uckerath Q3/2025:</p>
          <ul className="space-y-1 text-sm">
            <li>• <strong>Abschlag Q3:</strong> 42,7 T€ (10.10.2025)</li>
            <li>• <strong>Restzahlung Q3:</strong> +8,4 T€ (10.12.2025, Nachzahlung)</li>
          </ul>
        </div>

        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm font-medium text-red-400">
            ➡️ Restzahlungen können negativ (Velbert) oder positiv (Uckerath) sein!
          </p>
        </div>
      </div>

      {/* PVS */}
      <div className="admin-card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">💳</span>
          PVS (Privatärztliche Verrechnungsstelle)
        </h3>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 mb-4">
          <p className="text-sm font-semibold mb-2">Zahlungsstruktur:</p>
          <p className="text-sm text-muted-foreground">
            Patient behandelt → Rechnung an PVS → PVS zahlt nach ~30-60 Tagen
          </p>
        </div>

        <div className="mt-4 bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
          <p className="text-sm font-semibold mb-2">Durchschnittswerte (monatlich):</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• <strong>Velbert:</strong> ~7.500 EUR/Monat</li>
            <li>• <strong>Uckerath:</strong> Keine Daten</li>
            <li>• <strong>Eitorf:</strong> Keine Daten (läuft evtl. über Uckerath)</li>
          </ul>
        </div>

        <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-sm font-medium text-amber-400 mb-2">Zuordnung Alt/Neu:</p>
          <ul className="space-y-1 text-sm">
            <li>• <strong>Nach Behandlungsdatum</strong> (nicht nach Zahlungsdatum!)</li>
            <li>• Patient behandelt am 25.10.2025 → Altmasse (auch wenn Zahlung im Dezember)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ========== TAB 3: MASSEKREDIT ==========

function Massekredit() {
  return (
    <div className="space-y-8">
      {/* Massekreditvertrag */}
      <div className="admin-card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">🏦</span>
          Massekreditvertrag Sparkasse HRV
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
                <td className="py-3 px-3 text-muted-foreground">Sparkasse Hilden-Ratingen-Velbert</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="py-3 px-3">Maximalbetrag</td>
                <td className="py-3 px-3 font-semibold">137.000 EUR</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="py-3 px-3">Laufzeit</td>
                <td className="py-3 px-3 text-muted-foreground">Bis 31.08.2026</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="py-3 px-3">Zinsen</td>
                <td className="py-3 px-3 text-green-400">KEINE (unechter Massekredit)</td>
              </tr>
              <tr>
                <td className="py-3 px-3">Fortführungsbeitrag</td>
                <td className="py-3 px-3 font-semibold">10% + USt auf Altforderungen</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Fortführungsbeitrag */}
      <div className="admin-card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">🧮</span>
          Fortführungsbeitrag — Wie funktioniert es?
        </h3>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
          <p className="text-sm font-semibold mb-3">Beispiel Altforderung 100.000 EUR:</p>
          <div className="space-y-2 text-sm font-mono">
            <div className="flex justify-between">
              <span>Bruttoeinzug:</span>
              <span className="font-semibold">100.000 EUR</span>
            </div>
            <div className="flex justify-between text-red-400">
              <span>- USt (19%):</span>
              <span>-16.000 EUR (ca.)</span>
            </div>
            <div className="flex justify-between border-t border-[var(--border)] pt-2">
              <span>= Nettoeinzug:</span>
              <span className="font-semibold">84.000 EUR</span>
            </div>
            <div className="flex justify-between text-red-400 mt-3">
              <span>- Fortführungsbeitrag:</span>
              <span>-8.400 EUR (10% von Netto)</span>
            </div>
            <div className="flex justify-between text-red-400">
              <span>- USt auf FB (19%):</span>
              <span>-1.596 EUR</span>
            </div>
            <div className="flex justify-between border-t border-[var(--border)] pt-2 font-semibold text-green-400">
              <span>= Masse erhält:</span>
              <span>74.004 EUR</span>
            </div>
            <div className="flex justify-between mt-3 text-amber-400">
              <span>Sparkasse behält:</span>
              <span className="font-semibold">25.996 EUR (26%)</span>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-sm font-medium text-amber-400">
            ➡️ Nicht 10%, sondern ~26% der Bruttoeinzüge bleiben bei Sparkasse!
          </p>
        </div>
      </div>

      {/* Auswirkung auf Liquidität */}
      <div className="admin-card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">📈</span>
          Auswirkung auf Liquidität
        </h3>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
          <p className="text-sm font-semibold mb-3">Szenario: 250 T€ Altforderungen eingezogen bis Aug 2026</p>
          <div className="space-y-2 text-sm font-mono">
            <div className="flex justify-between">
              <span>Bruttoeinzug:</span>
              <span className="font-semibold">250.000 EUR</span>
            </div>
            <div className="flex justify-between text-green-400">
              <span>Masse erhält:</span>
              <span className="font-semibold">~185.000 EUR</span>
            </div>
            <div className="flex justify-between text-amber-400">
              <span>Sparkasse behält:</span>
              <span className="font-semibold">~65.000 EUR</span>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm font-medium text-blue-400">
            ➡️ Massekreditnutzung hängt ab vom Verhältnis Alt/Neu!
          </p>
        </div>
      </div>
    </div>
  );
}

// ========== TAB 4: DATENQUALITÄT ==========

function Datenqualitaet() {
  return (
    <div className="space-y-8">
      {/* Datenqualitäts-Matrix */}
      <div className="admin-card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">📊</span>
          Datenqualitäts-Matrix
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 px-3 font-semibold">Bereich</th>
                <th className="text-left py-2 px-3 font-semibold">Status</th>
                <th className="text-left py-2 px-3 font-semibold">Quelle</th>
                <th className="text-right py-2 px-3 font-semibold">Zuverlässigkeit</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--border)] bg-green-500/10">
                <td className="py-3 px-3">Einnahmen Velbert</td>
                <td className="py-3 px-3">✅ Hoch</td>
                <td className="py-3 px-3 text-muted-foreground">Abrechnungsbescheide Q1-Q3/2025</td>
                <td className="py-3 px-3 text-right font-semibold text-green-400">90%</td>
              </tr>
              <tr className="border-b border-[var(--border)] bg-amber-500/10">
                <td className="py-3 px-3">Einnahmen Uckerath</td>
                <td className="py-3 px-3">⚠️ Mittel</td>
                <td className="py-3 px-3 text-muted-foreground">Annahmen-Excel (keine Bescheide)</td>
                <td className="py-3 px-3 text-right font-semibold text-amber-400">60%</td>
              </tr>
              <tr className="border-b border-[var(--border)] bg-amber-500/10">
                <td className="py-3 px-3">Einnahmen Eitorf</td>
                <td className="py-3 px-3">⚠️ Niedrig</td>
                <td className="py-3 px-3 text-muted-foreground">Geschätzt</td>
                <td className="py-3 px-3 text-right font-semibold text-amber-400">40%</td>
              </tr>
              <tr className="border-b border-[var(--border)] bg-green-500/10">
                <td className="py-3 px-3">Personal Velbert</td>
                <td className="py-3 px-3">✅ Hoch</td>
                <td className="py-3 px-3 text-muted-foreground">Excel MVZVelbert_Personal_Gehälter.xlsx</td>
                <td className="py-3 px-3 text-right font-semibold text-green-400">95%</td>
              </tr>
              <tr className="border-b border-[var(--border)] bg-amber-500/10">
                <td className="py-3 px-3">Personal Uckerath</td>
                <td className="py-3 px-3">⚠️ Mittel</td>
                <td className="py-3 px-3 text-muted-foreground">Datenraum-Zugang verfügbar (Details zu extrahieren)</td>
                <td className="py-3 px-3 text-right font-semibold text-amber-400">70%</td>
              </tr>
              <tr className="border-b border-[var(--border)] bg-red-500/10">
                <td className="py-3 px-3">Personal Eitorf</td>
                <td className="py-3 px-3">❓ Unklar</td>
                <td className="py-3 px-3 text-muted-foreground">Keine Daten</td>
                <td className="py-3 px-3 text-right font-semibold text-red-400">0%</td>
              </tr>
              <tr className="border-b border-[var(--border)] bg-green-500/10">
                <td className="py-3 px-3">Mieten</td>
                <td className="py-3 px-3">✅ Hoch</td>
                <td className="py-3 px-3 text-muted-foreground">Mietverträge vollständig</td>
                <td className="py-3 px-3 text-right font-semibold text-green-400">100%</td>
              </tr>
              <tr className="border-b border-[var(--border)] bg-red-500/10">
                <td className="py-3 px-3">Versicherungen</td>
                <td className="py-3 px-3">❌ Fehlend</td>
                <td className="py-3 px-3 text-muted-foreground">Keine Verträge extrahiert</td>
                <td className="py-3 px-3 text-right font-semibold text-red-400">0%</td>
              </tr>
              <tr className="bg-red-500/10">
                <td className="py-3 px-3">Wartungsverträge</td>
                <td className="py-3 px-3">❌ Fehlend</td>
                <td className="py-3 px-3 text-muted-foreground">Keine Verträge</td>
                <td className="py-3 px-3 text-right font-semibold text-red-400">0%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Offene Fragen */}
      <div className="admin-card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">❓</span>
          Offene Fragen an IV
        </h3>

        <div className="space-y-3">
          <QuestionBox
            number={1}
            question="Personalkosten Uckerath detailliert (Datenraum-Daten extrahieren)"
            priority="WICHTIG"
            impact="±5.000 EUR/Monat (Präzision verbessern)"
          />
          <QuestionBox
            number={2}
            question="Versicherungsverträge (Berufshaftpflicht, Betriebshaftpflicht)"
            priority="KRITISCH"
            impact="±2.000 EUR/Monat (±20.000 EUR gesamt)"
          />
          <QuestionBox
            number={3}
            question="Personalstatus Eitorf (Dr. Rösing angestellt oder freiberuflich?)"
            priority="KRITISCH"
            impact="±15.000 EUR/Monat (±75.000 EUR gesamt)"
          />
          <QuestionBox
            number={4}
            question="PVS-Durchschnittswerte Uckerath/Eitorf"
            priority="WICHTIG"
            impact="±5.000 EUR/Monat (Planungssicherheit)"
          />
          <QuestionBox
            number={5}
            question="Wartungsverträge (Medizintechnik, IT)"
            priority="WICHTIG"
            impact="±1.500 EUR/Monat (±15.000 EUR gesamt)"
          />
          <QuestionBox
            number={6}
            question="Genaue AG-SV-Beiträge (statt 20%-Schätzung)"
            priority="NIEDRIG"
            impact="±1.000 EUR/Monat (±10.000 EUR gesamt)"
          />
        </div>

        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm font-medium text-red-400">
            ➡️ Ohne diese Daten ist die Liquiditätsplanung mit hoher Unsicherheit behaftet!
          </p>
        </div>
      </div>
    </div>
  );
}

function QuestionBox({
  number,
  question,
  priority,
  impact
}: {
  number: number;
  question: string;
  priority: string;
  impact: string;
}) {
  const priorityColor = priority === 'KRITISCH' ? 'text-red-400' : 'text-amber-400';
  const priorityBg = priority === 'KRITISCH' ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20';

  return (
    <div className={`border rounded-lg p-4 ${priorityBg}`}>
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 text-xl font-bold">{number}.</span>
        <div className="flex-1">
          <p className="text-sm font-semibold mb-2">{question}</p>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className={`font-medium ${priorityColor}`}>Priorität: {priority}</span>
            <span className="text-muted-foreground">Auswirkung: {impact}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
