"use client";

import { use } from "react";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function BerechnungsgrundlagenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [caseName, setCaseName] = useState<string>("");
  const [openingDate, setOpeningDate] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCaseData() {
      try {
        const response = await fetch(`/api/customer/cases/${id}`, {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setCaseName(data.case?.debtorName || "");
          if (data.case?.openingDate) {
            setOpeningDate(new Date(data.case.openingDate).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }));
          }
        }
      } catch {
        // Fehler beim Laden werden durch fehlende Daten im UI sichtbar
      } finally {
        setLoading(false);
      }
    }
    fetchCaseData();
  }, [id]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-[var(--muted)]">
        <Link href="/portal" className="hover:text-[var(--primary)]">
          Meine Fälle
        </Link>
        <svg
          className="w-4 h-4 mx-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        <Link
          href={`/portal/cases/${id}`}
          className="hover:text-[var(--primary)]"
        >
          {loading ? "..." : caseName}
        </Link>
        <svg
          className="w-4 h-4 mx-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        <span className="text-[var(--foreground)]">Berechnungsgrundlagen</span>
      </div>

      {/* Header */}
      <div className="admin-card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-600">
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
          Berechnungsgrundlagen der Liquiditätsplanung
        </h1>
        <p className="text-[var(--secondary)]">
          Transparente Methodik für präzise Prognosen in Ihrem Insolvenzverfahren
        </p>
      </div>

      {/* Unsere Methodik in 3 Schritten */}
      <div className="admin-card p-6">
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
          Unsere Methodik in 3 Schritten
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-[var(--foreground)] mb-2">
              1. Datenerfassung
            </h3>
            <p className="text-sm text-[var(--muted)]">
              Import von Kontoauszügen, Abrechnungsbescheiden und Verträgen mit
              automatischer Klassifikation
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-[var(--foreground)] mb-2">
              2. Alt/Neu-Zuordnung
            </h3>
            <p className="text-sm text-[var(--muted)]">
              Präzise Trennung von Altmasse (vor Insolvenz) und Neumasse (nach
              Insolvenz) nach § 55 InsO
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-8 h-8 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-[var(--foreground)] mb-2">
              3. Prognose
            </h3>
            <p className="text-sm text-[var(--muted)]">
              Liquiditätsplanung basierend auf IST-Daten, Vertragsregeln und
              realistischen Annahmen
            </p>
          </div>
        </div>
      </div>

      {/* Kernkonzepte */}
      <div className="admin-card p-6">
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
          Kernkonzepte der Berechnung
        </h2>
        <div className="space-y-6">
          {/* Alt/Neu-Masse */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-[var(--foreground)] mb-2">
              Altmasse vs. Neumasse (§ 55 InsO)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-yellow-700 mb-1">
                  🟡 Altmasse (vor Insolvenzeröffnung)
                </p>
                <ul className="space-y-1 text-[var(--muted)]">
                  <li>
                    • Leistungen vor dem {openingDate || "Eröffnungstag"}
                  </li>
                  <li>• Behandlung vor Insolvenzeröffnung</li>
                  <li>• Fließt in Insolvenzmasse (Quotenverteilung)</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-green-700 mb-1">
                  🟢 Neumasse (nach Insolvenzeröffnung)
                </p>
                <ul className="space-y-1 text-[var(--muted)]">
                  <li>• Leistungen ab Insolvenzeröffnung</li>
                  <li>• Behandlung nach Verfahrenseröffnung</li>
                  <li>• Masseverbindlichkeit (§ 55 InsO)</li>
                </ul>
              </div>
            </div>
            <div className="mt-3 p-3 bg-blue-50 rounded text-sm">
              <strong>Unsere Methodik:</strong> Wir verwenden Service-Date-Rules
              (Behandlungsdatum), Vertragsregeln (KV, HZV, PVS) und
              Massekredit-Vereinbarungen für präzise Zuordnungen.
            </div>
          </div>

          {/* IST vs PLAN */}
          <div className="border-l-4 border-green-500 pl-4">
            <h3 className="font-semibold text-[var(--foreground)] mb-2">
              IST-Daten vs. PLAN-Prognosen
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-blue-700 mb-1">📊 IST-Daten</p>
                <ul className="space-y-1 text-[var(--muted)]">
                  <li>• Tatsächliche Kontoauszüge</li>
                  <li>• Verifizierte Abrechnungsbescheide</li>
                  <li>• Bereits erfolgte Zahlungen</li>
                  <li>• 100% Verlässlichkeit</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-purple-700 mb-1">
                  📈 PLAN-Prognosen
                </p>
                <ul className="space-y-1 text-[var(--muted)]">
                  <li>• Vertragliche Vereinbarungen</li>
                  <li>• Durchschnittswerte (letzte 3-6 Monate)</li>
                  <li>• Saisonale Anpassungen</li>
                  <li>• Konservative Schätzungen</li>
                </ul>
              </div>
            </div>
            <div className="mt-3 p-3 bg-green-50 rounded text-sm">
              <strong>Qualität:</strong> IST-Daten sind verifiziert und
              nachvollziehbar. PLAN-Daten basieren auf realistischen Annahmen,
              die Sie jederzeit anpassen können.
            </div>
          </div>

          {/* Einnahmen vs Einzahlungen */}
          <div className="border-l-4 border-purple-500 pl-4">
            <h3 className="font-semibold text-[var(--foreground)] mb-2">
              Einnahmen vs. Einzahlungen (Cash-Basis)
            </h3>
            <p className="text-sm text-[var(--muted)] mb-3">
              <strong>Liquiditätsplanung = Zahlungsströme</strong>, nicht
              buchhalterische Einnahmen.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 px-3">Zeitpunkt</th>
                    <th className="text-left py-2 px-3">Einnahme (Leistung)</th>
                    <th className="text-left py-2 px-3">
                      Einzahlung (Liquidität)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[var(--border)]">
                    <td className="py-2 px-3">Oktober</td>
                    <td className="py-2 px-3 text-[var(--muted)]">
                      Patient behandelt
                    </td>
                    <td className="py-2 px-3">-</td>
                  </tr>
                  <tr className="border-b border-[var(--border)]">
                    <td className="py-2 px-3">November</td>
                    <td className="py-2 px-3">-</td>
                    <td className="py-2 px-3 font-medium text-green-600">
                      KV zahlt Abschlag
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Dezember</td>
                    <td className="py-2 px-3">-</td>
                    <td className="py-2 px-3 font-medium text-green-600">
                      KV zahlt Restzahlung
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 p-3 bg-purple-50 rounded text-sm">
              <strong>Wichtig:</strong> Unsere Liquiditätsplanung zeigt, wann
              Geld auf dem Konto ist, nicht wann die Leistung erbracht wurde.
            </div>
          </div>
        </div>
      </div>

      {/* Qualitätssicherung */}
      <div className="admin-card p-6">
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
          Qualitätssicherung & Prüfmechanismen
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex gap-3">
            <svg
              className="w-6 h-6 text-green-600 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="font-semibold text-[var(--foreground)] mb-1">
                Datenverifikation
              </h3>
              <p className="text-sm text-[var(--muted)]">
                Alle IST-Daten werden mit Kontoauszügen abgeglichen und als
                "VERIFIED" markiert.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <svg
              className="w-6 h-6 text-green-600 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="font-semibold text-[var(--foreground)] mb-1">
                Automatische Klassifikation
              </h3>
              <p className="text-sm text-[var(--muted)]">
                Pattern-Matching für Gegenparteien, Banken und Standorte mit
                manueller Überprüfung.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <svg
              className="w-6 h-6 text-green-600 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="font-semibold text-[var(--foreground)] mb-1">
                Nachvollziehbare Zuordnungen
              </h3>
              <p className="text-sm text-[var(--muted)]">
                Jede Alt/Neu-Zuordnung hat eine Begründung (Regel, Vertrag,
                Behandlungsdatum).
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <svg
              className="w-6 h-6 text-green-600 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="font-semibold text-[var(--foreground)] mb-1">
                Konservative Prognosen
              </h3>
              <p className="text-sm text-[var(--muted)]">
                PLAN-Werte basieren auf Durchschnittswerten, nicht auf
                Spitzenwerten.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Traceability */}
      <div className="admin-card p-6 bg-[var(--accent)]">
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3">
          Volle Nachvollziehbarkeit
        </h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          Jede Zahl in der Liquiditätsplanung ist zu ihrer Quelle
          zurückverfolgbar:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-[var(--card-bg)] p-4 rounded border border-[var(--border)]">
            <p className="font-medium text-[var(--foreground)] mb-2">
              📄 Quelldokumente
            </p>
            <p className="text-[var(--muted)]">
              Kontoauszüge, Abrechnungsbescheide, Verträge sind hinterlegt
            </p>
          </div>
          <div className="bg-[var(--card-bg)] p-4 rounded border border-[var(--border)]">
            <p className="font-medium text-[var(--foreground)] mb-2">
              🔍 Audit-Trail
            </p>
            <p className="text-[var(--muted)]">
              Jede Änderung wird protokolliert (Wer? Wann? Warum?)
            </p>
          </div>
          <div className="bg-[var(--card-bg)] p-4 rounded border border-[var(--border)]">
            <p className="font-medium text-[var(--foreground)] mb-2">
              📊 Traceability-Matrix
            </p>
            <p className="text-[var(--muted)]">
              Dokumentation der Herleitung jeder Prognose
            </p>
          </div>
        </div>
      </div>

      {/* Footer: Fragen */}
      <div className="admin-card p-6 bg-blue-50 border-l-4 border-blue-600">
        <div className="flex items-start gap-4">
          <svg
            className="w-8 h-8 text-blue-600 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="font-semibold text-[var(--foreground)] mb-2">
              Fragen zur Methodik?
            </h3>
            <p className="text-sm text-[var(--secondary)]">
              Unser Team erläutert Ihnen gerne Details zu den
              Berechnungsgrundlagen. Alle Annahmen und Regeln können bei Bedarf
              angepasst werden.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
