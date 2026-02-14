"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

// ============================================================================
// TYPES & DATA
// ============================================================================

interface FaqItem {
  question: string;
  answer: React.ReactNode;
}

const GLOSSARY = [
  { term: "Absonderung", definition: "Sonderrecht eines Gläubigers an einem bestimmten Vermögensgegenstand (z.B. Pfandrecht). Wird getrennt von der allgemeinen Masse behandelt." },
  { term: "Altmasse", definition: "Vermögenswerte und Verbindlichkeiten, die vor der Insolvenzeröffnung entstanden sind. Auch: Forderungen für Leistungen vor dem Eröffnungstag." },
  { term: "Berechnungsannahmen", definition: "Dokumentierte Planungsgrundlagen (Prämissen) für Gericht und Gläubiger. Textuelle Beschreibung, keine Zahlenwerte." },
  { term: "BSNR", definition: "Betriebsstättennummer. Identifiziert eine Arztpraxis/Standort bei der Kassenärztlichen Vereinigung." },
  { term: "Buchungsquelle", definition: "Herkunft einer Buchung: Bankkonto (BANK_ACCOUNT), Kasse (CASH_REGISTER), ERP-System oder manuelle Eingabe." },
  { term: "Closing Balance", definition: "Endbestand einer Periode = Opening Balance + Einzahlungen - Auszahlungen." },
  { term: "Datenqualitäts-Check", definition: "Automatische Konsistenzprüfung im System-Panel. Prüft 6 Regeln (z.B. Gegenpartei-Konsistenz, Stammdaten-Referenzen)." },
  { term: "Eröffnungssaldo", definition: "Kontostand zu Beginn des Planungszeitraums (= Opening Balance)." },
  { term: "Gegenpartei", definition: "Geschäftspartner einer Buchung (z.B. KV, HAEVG, Vermieter). Wird zur Klassifikation und Analyse verwendet." },
  { term: "Geschäftskonten", definition: "Vorinsolvenz-Analyse: Kontobewegungen der regulären Bankkonten (vor Eröffnung der Insolvenzkonten)." },
  { term: "Headroom", definition: "Finanzieller Spielraum = Kontostand + Kreditlinie - Rückstellungen. Wird negativ, droht Zahlungsunfähigkeit." },
  { term: "HZV / HAEVG", definition: "Hausarztzentrierte Versorgung. Zahlungen über die HAEVG (Hausärztliche Vertragsgemeinschaft). Abrechnung ist arztgebunden (über LANR)." },
  { term: "ISK", definition: "Insolvenz-Sonderkonto. Separates Bankkonto, das nach Insolvenzeröffnung eingerichtet wird. Neue Zahlungen laufen hierüber." },
  { term: "IST", definition: "Echte, bestätigte Bankbuchungen aus importierten Kontoauszügen. Höchste Zuverlässigkeit." },
  { term: "IV", definition: "Insolvenzverwalter. Der gerichtlich bestellte Verwalter des Insolvenzverfahrens (= Ihr Mandant im Kundenportal)." },
  { term: "Klassifikation", definition: "Zuordnung einer Buchung zu Gegenpartei, Standort, Kostenart und Masse-Typ. Kann automatisch vorgeschlagen und manuell bestätigt werden." },
  { term: "Kostenart", definition: "Kategorisierung von Ausgaben (z.B. Personal, Miete, Material) mit optionalem Budget pro Periode." },
  { term: "Kreditor", definition: "Lieferant oder Dienstleister, an den Zahlungen geleistet werden. Verwaltet unter Beschaffung." },
  { term: "Kreditlinie", definition: "Vereinbarter Massekredit mit der Bank. Maximalbetrag, der als Betriebsmittelkredit zur Verfügung steht." },
  { term: "KV / KVNO", definition: "Kassenärztliche Vereinigung (Nordrhein). Zahlt Honorare an Ärzte für gesetzlich versicherte Patienten. Quartalsabrechnung." },
  { term: "LANR", definition: "Lebenslange Arztnummer. 7-stellige Nummer, die jeden Arzt eindeutig identifiziert. Relevant für HZV-Zuordnung." },
  { term: "LedgerEntry", definition: "Einzelne Buchung im Zahlungsregister. Zentrale Dateneinheit mit allen Dimensionen (Betrag, Datum, Gegenpartei, Masse-Typ etc.)." },
  { term: "Massekredit", definition: "Kredit der Bank an die Insolvenzmasse zur Fortführung des Geschäftsbetriebs. Hat Höchstbetrag und Laufzeit." },
  { term: "Neumasse", definition: "Vermögenswerte und Verbindlichkeiten, die nach der Insolvenzeröffnung entstanden sind. Auch: Forderungen für Leistungen ab dem Eröffnungstag." },
  { term: "Opening Balance", definition: "Anfangsbestand einer Periode. Bei der ersten Periode = Eröffnungssaldo des Bankkontos." },
  { term: "Periode", definition: "Zeitabschnitt in der Liquiditätsplanung. Je nach Fall wöchentlich (z.B. 13 Wochen) oder monatlich (z.B. 11 Monate)." },
  { term: "PLAN", definition: "Statische Planwerte (Legacy). Wird durch PROGNOSE ersetzt, sobald Annahmen aktiv sind." },
  { term: "PROGNOSE", definition: "Berechnete Zukunftswerte aus aktiven Annahmen. Werden automatisch für zukünftige Perioden erzeugt." },
  { term: "PVS", definition: "Privatärztliche Verrechnungsstelle. Rechnet Privatpatienten-Honorare ab und überweist an die Praxis." },
  { term: "Review-Status", definition: "Prüfstatus einer Buchung: UNGEPRÜFT (neu importiert), BESTÄTIGT (klassifiziert und freigegeben) oder ANGEPASST (manuell korrigiert)." },
  { term: "Rolling Forecast", definition: "Automatisch kombinierte Ansicht: IST-Daten (Vergangenheit) + PROGNOSE (Zukunft). Aktualisiert sich laufend." },
  { term: "Rückstellung", definition: "Reservierte Mittel für erwartete Verbindlichkeiten. Reduziert den verfügbaren Headroom." },
  { term: "Standort", definition: "Betriebsstätte des insolventen Unternehmens (z.B. Praxis Velbert, Praxis Uckerath). Hat eigene Bankzuordnung." },
  { term: "System", definition: "Diagnose-Dashboard: Daten-Übersicht, Konsistenz-Checks, Import-Historie, Aggregationsstatus." },
  { term: "Szenario", definition: "Planungskonfiguration mit Periodentyp (Wochen/Monate), Zeitraum und Eröffnungssaldo." },
  { term: "Token", definition: "Einmal-Link für externen Zugriff. Kann für Leseansicht (Share-Link) oder Bestelleinreichung (Firmen-Token) verwendet werden." },
  { term: "Verifikation", definition: "SOLL/IST-Abgleich: Wurden geplante Zahlungen tatsächlich ausgeführt? Ampelsystem (grün/gelb/rot)." },
];

// ============================================================================
// COMPONENTS
// ============================================================================

function AccordionItem({ question, answer }: FaqItem) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3.5 text-left group"
      >
        <span className="text-sm font-medium text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors pr-4">
          {question}
        </span>
        <svg
          className={`w-4 h-4 text-[var(--muted)] flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="pb-4 text-sm text-[var(--secondary)] leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}

/** Mini rolling forecast chart as pure CSS illustration */
function MiniChart() {
  const bars = [
    { h: 45, color: "bg-green-400", label: "Okt" },
    { h: 55, color: "bg-green-400", label: "Nov" },
    { h: 50, color: "bg-green-400", label: "Dez" },
    { h: 60, color: "bg-green-500", label: "Jan" },
    { h: 65, color: "bg-blue-400", label: "Feb" },
    { h: 55, color: "bg-blue-400", label: "Mär" },
    { h: 70, color: "bg-blue-400", label: "Apr" },
    { h: 75, color: "bg-blue-300", label: "Mai" },
    { h: 68, color: "bg-blue-300", label: "Jun" },
  ];
  return (
    <div className="relative">
      {/* Y axis labels */}
      <div className="absolute -left-1 top-0 bottom-6 flex flex-col justify-between text-[9px] text-gray-400">
        <span>hoch</span>
        <span>0</span>
      </div>
      <div className="ml-6">
        {/* HEUTE marker */}
        <div className="flex items-end gap-1.5 h-24">
          {bars.map((bar, i) => (
            <div key={bar.label} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full rounded-t ${bar.color} transition-all relative`}
                style={{ height: `${bar.h}%` }}
              >
                {i === 3 && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="text-[8px] font-bold text-amber-600 bg-amber-100 px-1 rounded">HEUTE</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {/* X labels */}
        <div className="flex gap-1.5 mt-1">
          {bars.map((bar) => (
            <div key={bar.label} className="flex-1 text-center text-[9px] text-gray-400">{bar.label}</div>
          ))}
        </div>
        {/* Legend below */}
        <div className="flex items-center justify-center gap-4 mt-2">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-green-400" />
            <span className="text-[9px] text-gray-500">IST</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-blue-400" />
            <span className="text-[9px] text-gray-500">PROGNOSE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Clickable page card that links to the actual page */
function PageCard({
  href,
  icon,
  name,
  description,
  color,
}: {
  href: string;
  icon: React.ReactNode;
  name: string;
  description: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:border-[var(--primary)] hover:shadow-md transition-all"
    >
      <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
          {name} <span className="text-[var(--muted)] font-normal">&rarr;</span>
        </p>
        <p className="text-xs text-[var(--muted)] mt-0.5 leading-relaxed">{description}</p>
      </div>
    </Link>
  );
}

// ============================================================================
// ICONS
// ============================================================================

const icons = {
  upload: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  list: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  tag: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  bank: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  users: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  location: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  shield: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  doc: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  chart: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  calc: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  cog: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  eye: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  chat: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  link: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  order: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  table: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 3v18M14 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" />
    </svg>
  ),
  trending: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
};

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function HilfePage() {
  const params = useParams();
  const rawId = params.id;
  const caseId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = `/admin/cases/${caseId}`;

  const [glossaryFilter, setGlossaryFilter] = useState("");

  const filteredGlossary = GLOSSARY.filter(
    (item) =>
      item.term.toLowerCase().includes(glossaryFilter.toLowerCase()) ||
      item.definition.toLowerCase().includes(glossaryFilter.toLowerCase())
  );

  const faqSections: { title: string; items: FaqItem[] }[] = [
    {
      title: "Daten & Import",
      items: [
        {
          question: "Welche Dateiformate kann ich importieren?",
          answer: (
            <span>
              CSV-Dateien von allen gängigen Banken. Unter{" "}
              <Link href={`${base}/ingestion`} className="text-[var(--primary)] underline font-medium">Import</Link>{" "}
              können Sie Spalten manuell zuordnen, falls das Format nicht automatisch erkannt wird.
              Für PDF-Dokumente (z.B. Zahlbelege, Kontoauszüge) steht das AI-Preprocessing zur Verfügung, das Inhalte automatisch extrahiert.
            </span>
          ),
        },
        {
          question: "Was passiert bei doppelten Buchungen?",
          answer: "Das System prüft auf Duplikate anhand von Bankkonto, Buchungsdatum und Betrag. Erkannte Duplikate werden markiert und können beim Import übersprungen werden.",
        },
        {
          question: "Warum sehe ich \u201eUngeprüfte Buchungen\u201c?",
          answer: (
            <span>
              Neu importierte Buchungen haben den Status UNGEPRÜFT. Unter{" "}
              <Link href={`${base}/ist-klassifikation`} className="text-[var(--primary)] underline font-medium">Klassifikation</Link>{" "}
              ordnen Sie diese zu (Gegenpartei, Standort, Masse-Typ) und bestätigen sie.
              Das System schlägt basierend auf Regelwerk und Buchungstext automatisch Zuordnungen vor,
              die Sie per Klick akzeptieren oder anpassen können.
            </span>
          ),
        },
        {
          question: "Was bedeutet \u201eKlassifikation\u201c genau?",
          answer: (
            <div className="space-y-2">
              <p>
                Klassifikation bedeutet, jede Buchung mit Zusatzinformationen anzureichern:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Gegenpartei:</strong> Wer hat gezahlt / an wen wurde gezahlt? (z.B. KV, HAEVG, Vermieter)</li>
                <li><strong>Standort:</strong> Welchem Betriebsstandort ist die Buchung zuzuordnen?</li>
                <li><strong>Masse-Typ:</strong> Altmasse, Neumasse oder gemischt?</li>
                <li><strong>Kategorie-Tag:</strong> Inhaltliche Zuordnung (z.B. HZV, PERSONAL, MIETE)</li>
              </ul>
              <p>
                Das System macht automatische Vorschläge. Sie prüfen und bestätigen diese unter{" "}
                <Link href={`${base}/ist-klassifikation`} className="text-[var(--primary)] underline font-medium">Klassifikation</Link>.
                Massenverarbeitung ist per Bulk-Accept möglich.
              </p>
            </div>
          ),
        },
      ],
    },
    {
      title: "Prognose & Dashboard",
      items: [
        {
          question: "Woher kommen die blauen PROGNOSE-Werte im Dashboard?",
          answer: (
            <span>
              Aus Ihren Annahmen auf der{" "}
              <Link href={`${base}/forecast`} className="text-[var(--primary)] underline font-medium">Prognose-Seite</Link>.
              Jede aktive Annahme erzeugt automatisch Cashflows für zukünftige Perioden, die im{" "}
              <Link href={`${base}/dashboard`} className="text-[var(--primary)] underline font-medium">Dashboard</Link>{" "}
              als blaue Balken erscheinen.
            </span>
          ),
        },
        {
          question: "Warum startet das Dashboard bei 0 EUR?",
          answer: (
            <span>
              Das Dashboard zeigt die <strong>Cashflow-Entwicklung</strong>, nicht den absoluten Kontostand.
              So sehen Sie sofort, ob positiver oder negativer Cashflow generiert wird.
              Den <strong>echten Kontostand</strong> mit Headroom-Berechnung finden Sie auf der{" "}
              <Link href={`${base}/forecast`} className="text-[var(--primary)] underline font-medium">Prognose-Seite</Link>.
            </span>
          ),
        },
        {
          question: "Was ist der Unterschied zwischen Berechnungsannahmen und Prognose-Annahmen?",
          answer: (
            <span>
              <Link href={`${base}/assumptions`} className="text-[var(--primary)] underline font-medium">Berechnungsannahmen</Link>{" "}
              (auch Prämissen) sind <strong>Textbeschreibungen</strong> für die Dokumentation (Gericht, Gläubiger) &ndash; sie erzeugen keine Zahlen.{" "}
              <Link href={`${base}/forecast`} className="text-[var(--primary)] underline font-medium">Prognose-Annahmen</Link>{" "}
              sind <strong>Zahlenwerte</strong> (EUR pro Periode), die direkt in die Berechnung einfließen und die blauen PROGNOSE-Balken erzeugen.
            </span>
          ),
        },
        {
          question: "Was bedeutet \u201eHeadroom\u201c?",
          answer: (
            <span>
              Headroom = Kontostand + Kreditlinie &ndash; Rückstellungen.
              Es ist Ihr finanzieller Spielraum. Wird er negativ, droht Zahlungsunfähigkeit.
              Kreditlinien pflegen Sie unter{" "}
              <Link href={`${base}/finanzierung`} className="text-[var(--primary)] underline font-medium">Finanzierung &amp; Banken</Link>,
              Rückstellungen unter{" "}
              <Link href={`${base}/insolvency-effects`} className="text-[var(--primary)] underline font-medium">Insolvenzeffekte</Link>.
            </span>
          ),
        },
        {
          question: "Warum sehe ich \u201ePLAN\u201c statt \u201ePROGNOSE\u201c?",
          answer: (
            <span>
              PLAN ist der Legacy-Fallback. Er wird angezeigt wenn noch keine{" "}
              <Link href={`${base}/forecast`} className="text-[var(--primary)] underline font-medium">Prognose-Annahmen</Link>{" "}
              aktiv sind. Sobald Sie mindestens eine Annahme aktivieren, wechselt die Zukunft automatisch auf PROGNOSE (blau).
            </span>
          ),
        },
        {
          question: "Was zeigen die verschiedenen Dashboard-Tabs?",
          answer: (
            <div className="space-y-2">
              <p>Das Dashboard hat mehrere Reiter, die verschiedene Perspektiven bieten:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                <li><strong>Übersicht:</strong> KPI-Leiste, Rolling-Forecast-Chart und Wasserfall-Diagramm</li>
                <li><strong>Liquiditätstabelle:</strong> Detaillierte Tabelle aller Perioden mit Ein-/Auszahlungen</li>
                <li><strong>Finanzierung &amp; Banken:</strong> Bankenspiegel, Kontostände, Massekredit-Übersicht</li>
                <li><strong>Einnahmen:</strong> Aufschlüsselung nach Einnahmequelle (KV, HZV, PVS etc.)</li>
                <li><strong>Masseübersicht:</strong> Altmasse vs. Neumasse mit Warn-Hinweisen bei unklarer Zuordnung</li>
                <li><strong>Standorte:</strong> Standortbezogene Liquiditätsansicht</li>
                <li><strong>Insolvenzeffekte:</strong> Sondereffekte und Rückstellungen pro Periode</li>
                <li><strong>Berechnungsannahmen:</strong> Dokumentierte Planungsgrundlagen</li>
                <li><strong>Vergleich:</strong> IST vs. PLAN Gegenüberstellung</li>
                <li><strong>Business-Logik:</strong> Berechnungsmethodik und Regelwerk</li>
              </ul>
            </div>
          ),
        },
      ],
    },
    {
      title: "Datenqualität & System-Diagnose",
      items: [
        {
          question: "Wo finde ich die Datenqualitäts-Checks?",
          answer: (
            <div className="space-y-2">
              <p>
                Unter{" "}
                <Link href={`${base}/system`} className="text-[var(--primary)] underline font-medium">System</Link>{" "}
                (VERWALTUNG). Das System Health Panel prüft automatisch <strong>6 Konsistenzregeln</strong>:
              </p>
              <ol className="list-decimal list-inside space-y-1 ml-2 text-sm">
                <li>Gegenpartei und Kategorie-Tag stimmen überein</li>
                <li>Buchungen mit Kategorie-Tag haben passende Gegenpartei</li>
                <li>Alt/Neu-Zuordnung passt zum Leistungszeitraum</li>
                <li>Buchungstexte passen zum Match-Pattern der Gegenpartei</li>
                <li>Alle referenzierten Stammdaten existieren</li>
                <li>Gegenparteien mit 5+ Buchungen haben ein Match-Pattern</li>
              </ol>
              <p className="text-xs text-[var(--muted)]">
                Fehlgeschlagene Checks sind aufklappbar mit Detail-Items und Deep-Links zum Zahlungsregister.
              </p>
            </div>
          ),
        },
        {
          question: "Was zeigt die System-Seite noch?",
          answer: (
            <div className="space-y-2">
              <p>Neben den Health-Checks bietet die{" "}
                <Link href={`${base}/system`} className="text-[var(--primary)] underline font-medium">System-Seite</Link>{" "}
                weitere Diagnose-Informationen:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                <li><strong>Daten-Übersicht:</strong> Anzahl IST-/PLAN-Entries, Klassifikationsgrad, Datumsbereich</li>
                <li><strong>Masse-Verteilung:</strong> Aufschlüsselung nach ALTMASSE/NEUMASSE/MIXED/UNKLAR</li>
                <li><strong>Aggregationsstatus:</strong> Ob der Liquiditätsplan aktuell ist oder neu berechnet wird</li>
                <li><strong>Import-Historie:</strong> Alle bisherigen Datenimporte mit Anzahl, Beträgen und Zeitraum</li>
                <li><strong>Share-Link-Audit:</strong> Status und Zugriffszähler aller externen Links</li>
              </ul>
            </div>
          ),
        },
      ],
    },
    {
      title: "Bestell- & Zahlfreigaben",
      items: [
        {
          question: "Wie funktioniert der Freigabe-Workflow?",
          answer: (
            <div className="space-y-2">
              <p>Jede Bestellung oder Zahlungsanfrage durchläuft eine mehrstufige Freigabekette:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2 text-sm">
                <li><strong>Einreichung:</strong> Eine Bestellung/Zahlung wird mit Kreditor, Betrag und optionalem Dokument angelegt</li>
                <li><strong>Freigabekette:</strong> Die Anfrage durchläuft nacheinander die definierten Freigabestufen</li>
                <li><strong>Entscheidung:</strong> Jeder Freigeber kann genehmigen (ggf. mit anderem Betrag) oder ablehnen</li>
                <li><strong>Abschluss:</strong> Nach Genehmigung aller erforderlichen Stufen wird die Anfrage als freigegeben markiert</li>
              </ol>
              <p className="text-xs text-[var(--muted)]">
                Die Freigabekette wird unter{" "}
                <Link href={`${base}/edit`} className="text-[var(--primary)] underline font-medium">Fall bearbeiten</Link>{" "}
                konfiguriert (Rollen, Schwellwerte, Reihenfolge).
              </p>
            </div>
          ),
        },
        {
          question: "Kann der Insolvenzverwalter selbst Freigaben erteilen?",
          answer: (
            <span>
              Ja. Der IV sieht offene Anfragen in seinem{" "}
              <strong>Kundenportal</strong> unter &quot;Bestell- &amp; Zahlfreigaben&quot;.
              Er kann dort direkt genehmigen oder ablehnen, optional mit Kommentar.
              Bei Ablehnung muss ein Grund angegeben werden.
            </span>
          ),
        },
        {
          question: "Was ist der Auto-Freigabe-Schwellwert?",
          answer: (
            <span>
              Unter{" "}
              <Link href={`${base}/edit`} className="text-[var(--primary)] underline font-medium">Fall bearbeiten</Link>{" "}
              &rarr; &quot;Freigabe-Einstellungen&quot; kann ein EUR-Betrag definiert werden.
              Anfragen bis einschließlich diesem Betrag werden automatisch freigegeben (AUTO_APPROVED)
              und sofort als PLAN-Buchung verbucht.
            </span>
          ),
        },
        {
          question: "Wie funktioniert die externe Bestelleinreichung per Token?",
          answer: (
            <div className="space-y-2">
              <p>
                Für externe Partner (z.B. Praxismanager) können <strong>Firmen-Tokens</strong> generiert werden.
                Mit diesem Token erhält der externe Partner einen Link, über den er Bestellungen oder Zahlungsanfragen einreichen kann &ndash; ohne Login.
              </p>
              <p className="text-xs text-[var(--muted)]">
                Tokens werden unter{" "}
                <Link href={`${base}/orders`} className="text-[var(--primary)] underline font-medium">Bestellfreigaben</Link>{" "}
                erstellt und verwaltet. Jeder Token hat ein Label, kann aktiviert/deaktiviert werden und der Link ist sofort kopierbar.
              </p>
            </div>
          ),
        },
        {
          question: "Was sind Kreditoren und Kostenarten?",
          answer: (
            <div className="space-y-1">
              <p><strong>Kreditoren</strong> sind Ausgaben-Partner (Lieferanten, Behörden) unter BESCHAFFUNG &rarr; <Link href={`${base}/creditors`} className="text-[var(--primary)] underline font-medium">Kreditoren</Link>. Sie haben Name, IBAN und eine Kostenart.</p>
              <p><strong>Kostenarten</strong> kategorisieren Ausgaben (z.B. Personal, Miete) unter STAMMDATEN &rarr; <Link href={`${base}/cost-categories`} className="text-[var(--primary)] underline font-medium">Kostenarten</Link>. Optional mit Budget pro Periode.</p>
              <p className="text-xs text-[var(--muted)]">Beide sind optional: Bestellungen können auch ohne Zuordnung eingereicht werden.</p>
            </div>
          ),
        },
      ],
    },
    {
      title: "Masse-Zuordnung (Alt/Neu)",
      items: [
        {
          question: "Wie wird Alt- vs. Neumasse entschieden?",
          answer: (
            <div className="space-y-2">
              <p>Das System verwendet eine automatische Fallback-Kette:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2 text-sm">
                <li><strong>Vertragsregel:</strong> Vertragliche Vereinbarung (z.B. Massekreditvertrag definiert KV-Split)</li>
                <li><strong>Leistungsdatum-Regel:</strong> Basierend auf dem Behandlungs-/Leistungszeitraum</li>
                <li><strong>Zeitanteil (Pro Rata):</strong> Anteilige Aufteilung nach Tagen im Monat</li>
                <li><strong>Vormonat-Logik:</strong> Zahlung in Monat M = Leistung in Monat M-1</li>
                <li><strong>UNKLAR:</strong> Wenn keine Regel greift, wird die Zuordnung als unklar markiert</li>
              </ol>
              <p>
                Jede Zuordnung hat einen Audit-Trail (Quelle + Begründung). Die Regeln konfigurieren Sie unter{" "}
                <Link href={`${base}/business-logic`} className="text-[var(--primary)] underline font-medium">Business-Logik</Link>.
              </p>
            </div>
          ),
        },
        {
          question: "Was passiert mit UNKLAR-Buchungen?",
          answer: (
            <span>
              Buchungen mit Zuordnung UNKLAR erscheinen als Warnhinweis im Dashboard (Tab &quot;Masseübersicht&quot;) und auf der{" "}
              <Link href={`${base}/system`} className="text-[var(--primary)] underline font-medium">System-Seite</Link>.
              Sie sollten manuell zugeordnet werden, da sie die Genauigkeit der Masse-Trennung beeinflussen.
              Unter{" "}
              <Link href={`${base}/ist-klassifikation`} className="text-[var(--primary)] underline font-medium">Klassifikation</Link>{" "}
              können Sie die Zuordnung korrigieren.
            </span>
          ),
        },
      ],
    },
    {
      title: "Kundenportal & Zugänge",
      items: [
        {
          question: "Was sieht der Insolvenzverwalter im Kundenportal?",
          answer: (
            <div className="space-y-2">
              <p>Der IV (Ihr Mandant) sieht ein eigenständiges Portal mit folgenden Funktionen:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                <li><strong>Fall-Übersicht:</strong> Alle ihm zugeteilten Fälle (eigene + geteilte)</li>
                <li><strong>Dashboard:</strong> Komplettes Liquiditäts-Dashboard mit allen Tabs (wie im Admin)</li>
                <li><strong>Bestell- &amp; Zahlfreigaben:</strong> Offene Anfragen genehmigen oder ablehnen</li>
                <li><strong>Berechnungsgrundlagen:</strong> Erklärung der Methodik (Datenerfassung, Alt/Neu-Zuordnung, Prognose)</li>
                <li><strong>PDF-Export:</strong> Dashboard als PDF exportieren</li>
              </ul>
              <p className="text-xs text-[var(--muted)]">
                Der IV kann keine Daten ändern, importieren oder Stammdaten bearbeiten. Er hat eine reine Lese- und Freigabe-Sicht.
              </p>
            </div>
          ),
        },
        {
          question: "Wie gebe ich einem Kunden Zugriff auf einen Fall?",
          answer: (
            <div className="space-y-2">
              <p>
                Öffnen Sie{" "}
                <Link href={`${base}/freigaben`} className="text-[var(--primary)] underline font-medium">Freigaben</Link>{" "}
                und klicken Sie auf <strong>&quot;Fall freigeben&quot;</strong>.
              </p>
              <ol className="list-decimal list-inside space-y-1 ml-2 text-sm">
                <li><strong>Kunde wählen oder anlegen:</strong> Bestehenden Kunden auswählen oder direkt einen neuen erstellen (mit optionaler Subdomain)</li>
                <li><strong>Einladungstext kopieren:</strong> Nach der Freigabe erscheint ein kopierbarer Text mit Login-URL, E-Mail und Passwort</li>
                <li><strong>Text übermitteln:</strong> Per E-Mail oder Telefon an den Kunden senden</li>
              </ol>
              <p className="text-xs text-[var(--muted)]">
                Das generierte Passwort wird nur einmalig angezeigt (14 Zeichen, keine verwechselbaren Zeichen wie 0/O oder 1/l).
              </p>
            </div>
          ),
        },
        {
          question: "Was ist eine Kunden-Subdomain?",
          answer: (
            <span>
              Jeder Kunde kann eine eigene Subdomain erhalten, z.B. <strong>anchor.cases.gradify.de</strong>.
              Der Kunde sieht dann ein eigenes Portal ohne sichtbare &quot;/portal&quot;-Pfade.
              Die Subdomain wird beim Anlegen des Kunden über das Slug-Feld vergeben.
              Das Slug-Feld prüft live, ob der Name verfügbar ist, und zeigt eine Vorschau der URL.
            </span>
          ),
        },
        {
          question: "Was ist der Unterschied zwischen Kundenzugängen und externen Links?",
          answer: (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-xs font-bold text-blue-800 mb-1">Kundenzugänge</p>
                  <ul className="text-xs text-blue-700 space-y-0.5">
                    <li>Login mit E-Mail + Passwort</li>
                    <li>Bestell- &amp; Zahlfreigaben</li>
                    <li>Session-Tracking &amp; Zugriffszähler</li>
                    <li>Optionale eigene Subdomain</li>
                    <li>Widerrufbar mit Bestätigung</li>
                  </ul>
                </div>
                <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                  <p className="text-xs font-bold text-gray-800 mb-1">Externe Links</p>
                  <ul className="text-xs text-gray-700 space-y-0.5">
                    <li>Kein Login nötig (nur Link)</li>
                    <li>Nur Lese-Zugriff (kein Freigabe-Workflow)</li>
                    <li>Optionales Ablaufdatum</li>
                    <li>Schneller, temporärer Zugriff</li>
                    <li>Sofort kopierbar</li>
                  </ul>
                </div>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Beides verwalten Sie zentral unter{" "}
                <Link href={`${base}/freigaben`} className="text-[var(--primary)] underline font-medium">Freigaben</Link>.
              </p>
            </div>
          ),
        },
      ],
    },
    {
      title: "Analyse-Werkzeuge",
      items: [
        {
          question: "Was ist der Unterschied zwischen IST-Daten, Geschäftskonten und Performance?",
          answer: (
            <div className="space-y-2">
              <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                <li>
                  <Link href={`${base}/kontobewegungen`} className="text-[var(--primary)] underline font-medium">IST-Daten</Link>:{" "}
                  Alle importierten Kontobewegungen mit Filterung nach Bank, Zeitraum und Gegenpartei
                </li>
                <li>
                  <Link href={`${base}/vorinsolvenz-analyse`} className="text-[var(--primary)] underline font-medium">Geschäftskonten</Link>:{" "}
                  Vorinsolvenz-Analyse der regulären Bankkonten &ndash; zeigt Muster vor der Insolvenzeröffnung
                </li>
                <li>
                  <Link href={`${base}/performance`} className="text-[var(--primary)] underline font-medium">Performance (GuV)</Link>:{" "}
                  Gewinn- und Verlustrechnung mit Einnahmen nach Quelle und Ausgaben nach Kategorie
                </li>
              </ul>
            </div>
          ),
        },
        {
          question: "Wie funktioniert die Verifikation?",
          answer: (
            <span>
              Die{" "}
              <Link href={`${base}/zahlungsverifikation`} className="text-[var(--primary)] underline font-medium">Verifikation</Link>{" "}
              vergleicht geplante mit tatsächlichen Zahlungen (SOLL/IST-Abgleich).
              Ein Ampelsystem zeigt: Grün = Zahlung wie geplant eingegangen/geleistet,
              Gelb = Abweichung im Betrag oder Timing, Rot = Zahlung fehlt oder deutlich abweichend.
            </span>
          ),
        },
        {
          question: "Was ist die IV-Kommunikation?",
          answer: (
            <span>
              Die{" "}
              <Link href={`${base}/iv-kommunikation`} className="text-[var(--primary)] underline font-medium">IV-Kommunikation</Link>{" "}
              ist ein Notiz-System für den Austausch mit dem Insolvenzverwalter.
              Jede Notiz hat einen Status (Offen, Wartet, Erledigt) und eine Priorität.
              So behalten Sie den Überblick über offene Rückfragen und Abstimmungen.
            </span>
          ),
        },
      ],
    },
  ];

  return (
    <div className="space-y-8 max-w-4xl pb-12">
      {/* ================================================================ */}
      {/* HERO */}
      {/* ================================================================ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--primary)] to-indigo-700 text-white p-8">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold">Hilfe &amp; Dokumentation</h1>
          <p className="text-white/80 mt-2 text-lg max-w-xl">
            Alles, was Sie brauchen, um die Liquiditätsplanung effektiv zu nutzen &ndash;
            vom ersten Import bis zum fertigen Dashboard.
          </p>
        </div>
        {/* Decorative circles */}
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute right-20 bottom-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2" />
      </div>

      {/* ================================================================ */}
      {/* SYSTEM-ÜBERBLICK */}
      {/* ================================================================ */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-bold text-[var(--foreground)]">Was ist dieses System?</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">Liquiditätsplanung für Insolvenzverfahren</p>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-[var(--secondary)] leading-relaxed">
            Diese Anwendung unterstützt <strong>Insolvenzverwalter</strong> bei der laufenden Liquiditätsplanung
            ihrer Insolvenzverfahren. Sie erfasst echte Bankbuchungen (IST-Daten), klassifiziert diese automatisch
            und erstellt daraus einen <strong>Rolling Forecast</strong> &ndash; eine kombinierte Ansicht aus
            Vergangenheit (echte Daten) und Zukunft (Prognose).
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center mb-3">
                {icons.cog}
              </div>
              <p className="text-sm font-bold text-indigo-800">Berater (Admin)</p>
              <p className="text-xs text-indigo-600 mt-1">
                Importiert Bankdaten, klassifiziert Buchungen, pflegt Stammdaten,
                erstellt Prognosen und verwaltet Kundenzugänge.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
                {icons.users}
              </div>
              <p className="text-sm font-bold text-blue-800">Insolvenzverwalter (Kunde)</p>
              <p className="text-xs text-blue-600 mt-1">
                Sieht das Dashboard, erteilt Bestell-/Zahlfreigaben und
                kann den Liquiditätsplan als PDF exportieren. Eigenes Portal mit Login.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mb-3">
                {icons.link}
              </div>
              <p className="text-sm font-bold text-gray-800">Externe (Link-Zugang)</p>
              <p className="text-xs text-gray-600 mt-1">
                Lese-Zugriff per Share-Link. Kein Login nötig.
                Für Gläubigerausschuss, Gericht oder andere Beteiligte.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* QUICK START: 5 Schritte als große klickbare Karten */}
      {/* ================================================================ */}
      <div>
        <h2 className="text-xl font-bold text-[var(--foreground)] mb-1">Schnellstart</h2>
        <p className="text-sm text-[var(--muted)] mb-4">Die 5 Schritte zum fertigen Dashboard &ndash; klicken Sie auf einen Schritt, um direkt dorthin zu springen.</p>

        <div className="grid gap-3">
          {/* Step 1 */}
          <Link href={`${base}/ingestion`} className="group flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-green-400 hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center text-xl font-bold flex-shrink-0 group-hover:bg-green-500 group-hover:text-white transition-colors">
              1
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-[var(--foreground)] group-hover:text-green-600 transition-colors">Kontoauszüge importieren</p>
                <span className="text-xs text-[var(--muted)]">&rarr; Import</span>
              </div>
              <p className="text-xs text-[var(--muted)] mt-0.5">CSV hochladen, Spalten zuordnen, Buchungen ins System laden</p>
            </div>
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-600 text-xs font-medium">
              {icons.upload} Daten
            </div>
          </Link>

          {/* Step 2 */}
          <Link href={`${base}/ist-klassifikation`} className="group flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-green-400 hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center text-xl font-bold flex-shrink-0 group-hover:bg-green-500 group-hover:text-white transition-colors">
              2
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-[var(--foreground)] group-hover:text-green-600 transition-colors">Buchungen klassifizieren</p>
                <span className="text-xs text-[var(--muted)]">&rarr; Klassifikation</span>
              </div>
              <p className="text-xs text-[var(--muted)] mt-0.5">Gegenpartei zuordnen, Masse-Typ bestätigen, Vorschläge akzeptieren</p>
            </div>
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-600 text-xs font-medium">
              {icons.tag} Prüfen
            </div>
          </Link>

          {/* Step 3 */}
          <Link href={`${base}/assumptions`} className="group flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-amber-400 hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center text-xl font-bold flex-shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-colors">
              3
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-[var(--foreground)] group-hover:text-amber-600 transition-colors">Berechnungsannahmen dokumentieren</p>
                <span className="text-xs text-[var(--muted)]">&rarr; Berechnungsannahmen</span>
              </div>
              <p className="text-xs text-[var(--muted)] mt-0.5">Planungsgrundlagen beschreiben, Risikolevel zuordnen (für Gericht &amp; Gläubiger)</p>
            </div>
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-xs font-medium">
              {icons.doc} Governance
            </div>
          </Link>

          {/* Step 4 */}
          <Link href={`${base}/forecast`} className="group flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-400 hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold flex-shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-colors">
              4
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-[var(--foreground)] group-hover:text-blue-600 transition-colors">Prognose-Annahmen pflegen</p>
                <span className="text-xs text-[var(--muted)]">&rarr; Prognose</span>
              </div>
              <p className="text-xs text-[var(--muted)] mt-0.5">Einnahmen &amp; Ausgaben pro Kategorie eingeben &ndash; fließen automatisch ins Dashboard</p>
            </div>
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-medium">
              {icons.calc} Berechnung
            </div>
          </Link>

          {/* Step 5 */}
          <Link href={`${base}/dashboard`} className="group flex items-center gap-4 p-4 rounded-xl border-2 border-blue-300 bg-blue-50/50 hover:border-blue-500 hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center text-xl font-bold flex-shrink-0 group-hover:bg-blue-600 transition-colors">
              5
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-[var(--foreground)] group-hover:text-blue-600 transition-colors">Dashboard ablesen</p>
                <span className="text-xs text-[var(--muted)]">&rarr; Liquiditätsplan</span>
              </div>
              <p className="text-xs text-[var(--muted)] mt-0.5">Rolling Forecast: IST (grün) + PROGNOSE (blau) kombiniert in Chart und Tabelle</p>
            </div>
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
              {icons.chart} Ergebnis
            </div>
          </Link>
        </div>
      </div>

      {/* ================================================================ */}
      {/* SO LESEN SIE DAS DASHBOARD (visuell) */}
      {/* ================================================================ */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-bold text-[var(--foreground)]">So lesen Sie das Dashboard</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">Der Rolling Forecast kombiniert echte Bankdaten mit Ihrer Prognose</p>
        </div>

        <div className="p-6">
          {/* Mini-Chart */}
          <div className="max-w-sm mx-auto mb-6">
            <MiniChart />
          </div>

          {/* Source-Badges erklärt */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-300 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />IST
              </span>
              <div>
                <p className="text-sm font-medium text-green-800">Echte Bankbuchungen</p>
                <p className="text-xs text-green-600 mt-0.5">Vergangenheit &ndash; importiert und bestätigt. Höchste Zuverlässigkeit.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-300 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />PROGNOSE
              </span>
              <div>
                <p className="text-sm font-medium text-blue-800">Aus Ihren Annahmen berechnet</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Zukunft &ndash; aktualisiert sich automatisch. Annahmen pflegen:{" "}
                  <Link href={`${base}/forecast`} className="underline font-medium">Prognose-Seite</Link>
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-50 border border-purple-200">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-300 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />PLAN
              </span>
              <div>
                <p className="text-sm font-medium text-purple-800">Statische Planwerte</p>
                <p className="text-xs text-purple-600 mt-0.5">Fallback &ndash; wird automatisch durch PROGNOSE ersetzt, sobald Annahmen aktiv sind.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
              <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-800">Automatische Ablösung</p>
                <p className="text-xs text-gray-600 mt-0.5">Sobald neue Bankdaten vorliegen, ersetzen sie Prognose-Werte. Sie müssen nichts umschalten.</p>
              </div>
            </div>
          </div>

          {/* Zwei Perspektiven */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              href={`${base}/dashboard`}
              className="group p-4 rounded-xl border-2 border-gray-200 hover:border-[var(--primary)] transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-[var(--primary)]/10 flex items-center justify-center transition-colors">
                  {icons.chart}
                </div>
                <span className="font-bold text-sm">Dashboard</span>
                <span className="text-xs text-[var(--muted)]">&rarr;</span>
              </div>
              <p className="text-xs text-[var(--secondary)]">
                Startet bei <strong>0 EUR</strong>. Cashflow-Perspektive: &quot;Generieren wir positiven Cashflow?&quot;
              </p>
            </Link>
            <Link
              href={`${base}/forecast`}
              className="group p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                  {icons.calc}
                </div>
                <span className="font-bold text-sm">Prognose-Seite</span>
                <span className="text-xs text-[var(--muted)]">&rarr;</span>
              </div>
              <p className="text-xs text-[var(--secondary)]">
                Startet bei <strong>echtem Kontostand</strong>. Liquiditäts-Perspektive: &quot;Reicht das Geld?&quot;
              </p>
            </Link>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* DATENFLUSS-DIAGRAMM */}
      {/* ================================================================ */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">Wie die Daten fließen</h2>
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
          {[
            { label: "Kontoauszug", sub: "CSV-Datei", color: "bg-gray-100 border-gray-300 text-gray-700", href: `${base}/ingestion` },
            { label: "Import", sub: "Rohdaten", color: "bg-green-50 border-green-300 text-green-700", href: `${base}/ingestion` },
            { label: "Klassifikation", sub: "Zuordnung", color: "bg-amber-50 border-amber-300 text-amber-700", href: `${base}/ist-klassifikation` },
            { label: "IST-Daten", sub: "Bestätigt", color: "bg-green-100 border-green-400 text-green-800", href: `${base}/kontobewegungen` },
            { label: "+ Prognose", sub: "Annahmen", color: "bg-blue-100 border-blue-400 text-blue-800", href: `${base}/forecast` },
            { label: "Dashboard", sub: "Ergebnis", color: "bg-indigo-100 border-indigo-400 text-indigo-800", href: `${base}/dashboard` },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center gap-1 flex-shrink-0">
              <Link
                href={step.href}
                className={`px-3 py-2 rounded-lg border text-center hover:shadow-md transition-all ${step.color}`}
              >
                <p className="text-xs font-bold">{step.label}</p>
                <p className="text-[10px] opacity-70">{step.sub}</p>
              </Link>
              {i < arr.length - 1 && (
                <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ================================================================ */}
      {/* KUNDENPORTAL */}
      {/* ================================================================ */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-blue-50">
          <h2 className="text-lg font-bold text-[var(--foreground)]">Das Kundenportal</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">Was der Insolvenzverwalter sieht und tun kann</p>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-[var(--secondary)] leading-relaxed">
            Der Insolvenzverwalter (IV) erhält einen eigenen Login und sieht ein schlankes Portal mit seinen Fällen.
            Optional über eine eigene Subdomain (z.B. <strong>anchor.cases.gradify.de</strong>).
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="p-3 rounded-lg border border-gray-200">
              <p className="text-sm font-bold text-[var(--foreground)] mb-1">Fall-Dashboard</p>
              <p className="text-xs text-[var(--muted)]">
                Vollständiges Liquiditäts-Dashboard mit allen Tabs: Übersicht, Liquiditätstabelle,
                Finanzierung, Einnahmen, Masseübersicht, Standorte, Insolvenzeffekte, Annahmen, Vergleich.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-gray-200">
              <p className="text-sm font-bold text-[var(--foreground)] mb-1">Bestell- &amp; Zahlfreigaben</p>
              <p className="text-xs text-[var(--muted)]">
                Offene Anfragen einsehen, genehmigen oder ablehnen.
                Mehrstufige Freigabekette mit Fortschrittsanzeige und Kommentarfunktion.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-gray-200">
              <p className="text-sm font-bold text-[var(--foreground)] mb-1">Berechnungsgrundlagen</p>
              <p className="text-xs text-[var(--muted)]">
                Transparente Erklärung der Methodik: Wie werden Daten erfasst?
                Wie erfolgt die Alt/Neu-Zuordnung? Wie entsteht die Prognose?
              </p>
            </div>
            <div className="p-3 rounded-lg border border-gray-200">
              <p className="text-sm font-bold text-[var(--foreground)] mb-1">PDF-Export</p>
              <p className="text-xs text-[var(--muted)]">
                Das Dashboard kann als PDF exportiert werden &ndash;
                professionell formatiert für Präsentationen, Gläubigerversammlungen oder Gerichte.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* ALLE SEITEN (klickbare Karten nach Kategorie) */}
      {/* ================================================================ */}
      <div>
        <h2 className="text-xl font-bold text-[var(--foreground)] mb-1">Alle Bereiche im Admin</h2>
        <p className="text-sm text-[var(--muted)] mb-4">Klicken Sie auf eine Karte, um direkt dorthin zu navigieren.</p>

        <div className="space-y-6">
          {/* DATEN */}
          <div>
            <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2 px-1">Daten</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <PageCard href={`${base}/ledger`} icon={icons.list} name="Zahlungsregister" description="Alle Buchungen (IST + PLAN) in einer Übersicht mit Filter und Suche" color="bg-gray-100 text-gray-600" />
              <PageCard href={`${base}/ingestion`} icon={icons.upload} name="Import" description="Kontoauszüge als CSV importieren, Spalten zuordnen, Duplikate prüfen" color="bg-green-100 text-green-600" />
            </div>
          </div>

          {/* STAMMDATEN */}
          <div>
            <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2 px-1">Stammdaten</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <PageCard href={`${base}/bank-accounts`} icon={icons.bank} name="Bankkonten" description="Konten mit IBAN, Eröffnungssaldo, Sicherungsrechte und Liquiditätsrelevanz" color="bg-blue-100 text-blue-600" />
              <PageCard href={`${base}/counterparties`} icon={icons.users} name="Gegenparteien" description="Zahlungspartner (KV, HZV, PVS etc.) mit Match-Patterns für Auto-Klassifikation" color="bg-purple-100 text-purple-600" />
              <PageCard href={`${base}/cost-categories`} icon={icons.tag} name="Kostenarten" description="Ausgaben-Kategorien (Personal, Miete, Material) mit optionalem Budget" color="bg-amber-100 text-amber-600" />
              <PageCard href={`${base}/locations`} icon={icons.location} name="Standorte" description="Betriebsstätten mit Adresse und Bank-Zuordnung" color="bg-teal-100 text-teal-600" />
            </div>
          </div>

          {/* FALLDATEN */}
          <div>
            <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2 px-1">Falldaten</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <PageCard href={`${base}/personal`} icon={icons.users} name="Personal" description="Mitarbeiter mit Gehältern, LANR, Standort-Zuordnung und Rolle" color="bg-blue-100 text-blue-600" />
              <PageCard href={`${base}/kontakte`} icon={icons.chat} name="Kontakte" description="Ansprechpartner: IV, Berater, Buchhaltung, Rechtsanwälte" color="bg-purple-100 text-purple-600" />
              <PageCard href={`${base}/finanzierung`} icon={icons.bank} name="Finanzierung & Banken" description="Bankenspiegel, Sicherungsrechte, Massekredit-Details und -Konditionen" color="bg-indigo-100 text-indigo-600" />
              <PageCard href={`${base}/insolvency-effects`} icon={icons.shield} name="Insolvenzeffekte" description="Rückstellungen, Sondereffekte und einmalige Posten pro Periode" color="bg-red-100 text-red-600" />
              <PageCard href={`${base}/business-logic`} icon={icons.cog} name="Business-Logik" description="Klassifikationsregeln und Alt/Neu-Zuordnungsregeln konfigurieren" color="bg-gray-100 text-gray-600" />
              <PageCard href={`${base}/planung`} icon={icons.doc} name="Freie Planung" description="Manuelle PLAN-Werte eingeben (unabhängig von Prognose-Engine)" color="bg-amber-100 text-amber-600" />
            </div>
          </div>

          {/* PLANUNG */}
          <div>
            <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2 px-1">Planung</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <PageCard href={`${base}/dashboard`} icon={icons.chart} name="Dashboard" description="Liquiditätsplan mit Rolling Forecast, Wasserfall und KPI-Leiste" color="bg-indigo-100 text-indigo-600" />
              <PageCard href={`${base}/liquiditaetsmatrix`} icon={icons.table} name="Liquiditätstabelle" description="Detaillierte Tabelle aller Perioden mit Ein-/Auszahlungen und Salden" color="bg-indigo-100 text-indigo-600" />
              <PageCard href={`${base}/assumptions`} icon={icons.doc} name="Berechnungsannahmen" description="Planungsgrundlagen dokumentieren (Prämissen für Gericht und Gläubiger)" color="bg-amber-100 text-amber-600" />
              <PageCard href={`${base}/forecast`} icon={icons.calc} name="Prognose" description="Annahmen-Editor mit Headroom-Analyse und Szenario-Berechnung" color="bg-blue-100 text-blue-600" />
            </div>
          </div>

          {/* ANALYSE */}
          <div>
            <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2 px-1">Analyse</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <PageCard href={`${base}/kontobewegungen`} icon={icons.eye} name="IST-Daten" description="Alle importierten Kontobewegungen mit Filter nach Bank, Zeitraum, Gegenpartei" color="bg-green-100 text-green-600" />
              <PageCard href={`${base}/vorinsolvenz-analyse`} icon={icons.chart} name="Geschäftskonten" description="Vorinsolvenz-Analyse: Zahlungsmuster und Trends vor Insolvenzeröffnung" color="bg-gray-100 text-gray-600" />
              <PageCard href={`${base}/performance`} icon={icons.trending} name="Performance (GuV)" description="Gewinn- und Verlustrechnung: Einnahmen nach Quelle, Ausgaben nach Kategorie" color="bg-emerald-100 text-emerald-600" />
              <PageCard href={`${base}/ist-klassifikation`} icon={icons.tag} name="Klassifikation" description="Buchungen prüfen, Vorschläge akzeptieren, Bulk-Verarbeitung" color="bg-amber-100 text-amber-600" />
              <PageCard href={`${base}/zahlungsverifikation`} icon={icons.check} name="Verifikation" description="SOLL/IST-Abgleich mit Ampelsystem (grün/gelb/rot)" color="bg-emerald-100 text-emerald-600" />
              <PageCard href={`${base}/iv-kommunikation`} icon={icons.chat} name="IV-Kommunikation" description="Notizen und Rückfragen mit dem Insolvenzverwalter (Status + Priorität)" color="bg-purple-100 text-purple-600" />
            </div>
          </div>

          {/* BESCHAFFUNG */}
          <div>
            <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2 px-1">Beschaffung</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <PageCard href={`${base}/orders`} icon={icons.order} name="Bestellfreigaben" description="Bestell- und Zahlungsanfragen mit mehrstufiger Freigabekette" color="bg-amber-100 text-amber-600" />
              <PageCard href={`${base}/creditors`} icon={icons.users} name="Kreditoren" description="Lieferanten und Dienstleister mit IBAN und Kostenart" color="bg-gray-100 text-gray-600" />
            </div>
          </div>

          {/* ZUGANG */}
          <div>
            <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2 px-1">Zugang</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <PageCard href={`${base}/freigaben`} icon={icons.link} name="Freigaben" description="Kundenzugänge verwalten, externe Share-Links erstellen, Subdomains konfigurieren" color="bg-gray-100 text-gray-600" />
            </div>
          </div>

          {/* VERWALTUNG */}
          <div>
            <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2 px-1">Verwaltung</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <PageCard href={`${base}/edit`} icon={icons.cog} name="Fall bearbeiten" description="Falldaten, Planungskonfiguration und Freigabe-Regeln anpassen" color="bg-gray-100 text-gray-600" />
              <PageCard href={`${base}/system`} icon={icons.shield} name="System" description="Diagnose-Dashboard: Datenqualität, Health-Checks, Import-Historie, Aggregation" color="bg-green-100 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* ALTMASSE vs NEUMASSE (visuell) */}
      {/* ================================================================ */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">Altmasse vs. Neumasse</h2>
        <div className="flex items-stretch gap-0 max-w-lg mx-auto">
          {/* Alt */}
          <div className="flex-1 p-4 rounded-l-xl bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 text-center">
            <div className="w-10 h-10 rounded-full bg-orange-200 mx-auto mb-2 flex items-center justify-center">
              <span className="text-orange-700 text-lg font-bold">A</span>
            </div>
            <p className="text-sm font-bold text-orange-800">Altmasse</p>
            <p className="text-xs text-orange-600 mt-1">Vor Insolvenzeröffnung entstanden</p>
          </div>
          {/* Divider */}
          <div className="flex flex-col items-center justify-center px-3 bg-gray-50 border-y border-gray-200">
            <div className="w-px h-4 bg-gray-300" />
            <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center my-1">
              <span className="text-[9px] font-bold text-gray-500">TAG X</span>
            </div>
            <div className="w-px h-4 bg-gray-300" />
            <p className="text-[8px] text-gray-400 mt-1">Eröffnung</p>
          </div>
          {/* Neu */}
          <div className="flex-1 p-4 rounded-r-xl bg-gradient-to-br from-teal-50 to-teal-100 border border-teal-200 text-center">
            <div className="w-10 h-10 rounded-full bg-teal-200 mx-auto mb-2 flex items-center justify-center">
              <span className="text-teal-700 text-lg font-bold">N</span>
            </div>
            <p className="text-sm font-bold text-teal-800">Neumasse</p>
            <p className="text-xs text-teal-600 mt-1">Nach Insolvenzeröffnung entstanden</p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-sm text-[var(--secondary)] leading-relaxed">
            Die Trennung in Altmasse und Neumasse ist eine zentrale Anforderung der Insolvenzordnung (InsO).
            Jede Einzahlung und Auszahlung muss einem Masse-Typ zugeordnet werden. Das System verwendet dafür eine Fallback-Kette
            mit Vertragsregeln, Leistungsdatum-Analyse und anteiliger Berechnung.
          </p>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs font-bold text-amber-800 mb-1">Typische Splitting-Regeln (Beispiel Arztpraxis)</p>
            <ul className="text-xs text-amber-700 space-y-1">
              <li><strong>KV-Zahlungen:</strong> Quartalsabrechnung &ndash; Aufteilung nach Leistungszeitraum (z.B. Q4: 1/3 Alt, 2/3 Neu)</li>
              <li><strong>HZV-Zahlungen:</strong> Monatsabrechnung &ndash; Zahlung Monat M = Leistung Monat M-1 (Vormonat-Logik)</li>
              <li><strong>PVS-Zahlungen:</strong> Nach Behandlungsdatum des einzelnen Patienten</li>
              <li><strong>Personal:</strong> Nach Leistungszeitraum des Gehaltsmonats</li>
            </ul>
          </div>

          <p className="text-xs text-[var(--muted)] text-center max-w-md mx-auto">
            Die Zuordnungsregeln konfigurieren Sie unter{" "}
            <Link href={`${base}/business-logic`} className="text-[var(--primary)] underline font-medium">Business-Logik</Link>.
            Buchungen mit Zuordnung &quot;UNKLAR&quot; sollten manuell geprüft werden.
          </p>
        </div>
      </div>

      {/* ================================================================ */}
      {/* FAQ */}
      {/* ================================================================ */}
      <div>
        <h2 className="text-xl font-bold text-[var(--foreground)] mb-1">Häufig gestellte Fragen</h2>
        <p className="text-sm text-[var(--muted)] mb-4">Klicken Sie auf eine Frage, um die Antwort zu sehen.</p>

        <div className="space-y-4">
          {faqSections.map((section) => (
            <div key={section.title} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100">
                <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">{section.title}</h3>
              </div>
              <div className="px-5">
                {section.items.map((item) => (
                  <AccordionItem key={item.question} {...item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ================================================================ */}
      {/* GLOSSAR */}
      {/* ================================================================ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">Glossar</h2>
            <p className="text-sm text-[var(--muted)]">{GLOSSARY.length} Fachbegriffe schnell nachschlagen</p>
          </div>
          <input
            type="text"
            placeholder="Suchen..."
            value={glossaryFilter}
            onChange={(e) => setGlossaryFilter(e.target.value)}
            className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
          />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
          {filteredGlossary.map((item) => (
            <div key={item.term} className="flex gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
              <span className="text-sm font-bold text-[var(--foreground)] w-40 flex-shrink-0">
                {item.term}
              </span>
              <span className="text-sm text-[var(--secondary)]">
                {item.definition}
              </span>
            </div>
          ))}
          {filteredGlossary.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-[var(--muted)]">
              Kein Eintrag gefunden für &quot;{glossaryFilter}&quot;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
