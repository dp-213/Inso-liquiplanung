"use client";

import Link from "next/link";

// Canonical schema example files
const EXAMPLE_FILES = [
  {
    filename: "minimal-import.csv",
    displayName: "Minimal (nur Pflichtfelder)",
    description: "Datum, Betrag, Bezeichnung",
    format: "CSV",
    recommended: false,
    icon: (
      <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    filename: "standard-import.csv",
    displayName: "Standard (empfohlen)",
    description: "Mit Kategorie, Konto, Referenz",
    format: "CSV",
    recommended: true,
    icon: (
      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    filename: "extended-import.csv",
    displayName: "Erweitert (mit Zusatzspalten)",
    description: "Demonstriert Erweiterbarkeit",
    format: "CSV",
    recommended: false,
    icon: (
      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
  },
  {
    filename: "split-amount-import.csv",
    displayName: "Einzahlung/Auszahlung getrennt",
    description: "Alternative Betragsdarstellung",
    format: "CSV",
    recommended: false,
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    filename: "bank-statement-format.csv",
    displayName: "Kontoauszugs-Format",
    description: "Alternative Spaltennamen",
    format: "CSV",
    recommended: false,
    icon: (
      <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
];

// Required fields definition
const REQUIRED_FIELDS = [
  {
    name: "Datum",
    alternatives: ["Buchungsdatum", "Valuta", "Wertstellung", "Date"],
    description: "Datum der Zahlungswirksamkeit",
    example: "15.01.2026",
  },
  {
    name: "Betrag",
    alternatives: ["Oder: Einzahlung + Auszahlung", "Soll/Haben", "Amount"],
    description: "Zahlungsbetrag (positiv = Einzahlung, negativ = Auszahlung)",
    example: "-1.234,56",
  },
  {
    name: "Bezeichnung",
    alternatives: ["Verwendungszweck", "Beschreibung", "Text", "Description"],
    description: "Beschreibung der Position",
    example: "Miete Januar 2026",
  },
];

// Optional standard fields
const OPTIONAL_FIELDS = [
  { name: "Kategorie", description: "Liquiditaetskategorie", example: "Miete" },
  { name: "Zahlungsart", description: "Ueberweisung, Lastschrift, Bar", example: "Ueberweisung" },
  { name: "Alt_Neu / Massetyp", description: "Altmasse oder Neumasse", example: "Neumasse" },
  { name: "Konto", description: "Kontobezeichnung oder IBAN", example: "1200" },
  { name: "Gegenpartei", description: "Geschaeftspartner", example: "Meier GmbH" },
  { name: "Referenz", description: "Rechnungs- oder Belegnummer", example: "RE-2026-001" },
  { name: "Kommentar", description: "Freitext-Anmerkung", example: "Anzahlung" },
  { name: "Unsicherheit", description: "Kennzeichen für geschaetzte Werte", example: "geschaetzt" },
  { name: "Quelle", description: "Datenherkunft", example: "Kontoauszug" },
  { name: "Werttyp", description: "IST oder PLAN", example: "IST" },
];

export default function DataRequirementsPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Kanonisches Import-Schema
        </h1>
        <p className="text-sm text-[var(--secondary)] mt-1">
          Ein einheitliches, erweiterbares Schema für alle Datenimporte
        </p>
      </div>

      {/* Key Principle Banner */}
      <section className="admin-card bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300">
        <div className="p-6">
          <div className="flex items-start">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mr-4 flex-shrink-0">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-emerald-800 mb-2">
                Kernprinzip: Erweiterbar ohne Fehler
              </h2>
              <ul className="text-sm text-emerald-700 space-y-1">
                <li className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <strong>Nur 3 Pflichtfelder</strong> - alles andere ist optional
                </li>
                <li className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <strong>Zusaetzliche Spalten</strong> werden akzeptiert und gespeichert
                </li>
                <li className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <strong>Keine Fehler</strong> durch unbekannte oder zusaetzliche Daten
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Download Example Files Section */}
      <section className="admin-card border-2 border-blue-200">
        <div className="p-6 border-b border-blue-200 bg-blue-50">
          <div className="flex items-center">
            <svg className="w-6 h-6 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <h2 className="text-lg font-medium text-[var(--foreground)]">
              Beispieldateien herunterladen
            </h2>
          </div>
          <p className="text-sm text-[var(--secondary)] mt-2">
            Alle Dateien verwenden das kanonische Schema. Wählen Sie das passende Format.
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {EXAMPLE_FILES.map((file) => (
              <a
                key={file.filename}
                href={`/api/examples/${file.filename}`}
                download={file.filename}
                className={`flex items-start p-4 border rounded-lg hover:shadow-md transition-all group ${
                  file.recommended
                    ? "bg-green-50 border-green-300 hover:border-green-400"
                    : "bg-white border-gray-200 hover:border-blue-400"
                }`}
              >
                <div className="flex-shrink-0 mr-3">
                  {file.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium group-hover:text-blue-600 ${file.recommended ? "text-green-800" : "text-[var(--foreground)]"}`}>
                    {file.displayName}
                    {file.recommended && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-green-200 text-green-800 rounded-full">
                        Empfohlen
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    {file.format} | {file.description}
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Decision Helper Section */}
      <section className="admin-card border-2 border-amber-200">
        <div className="p-6 border-b border-amber-200 bg-amber-50">
          <div className="flex items-center">
            <svg className="w-6 h-6 text-amber-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-lg font-medium text-[var(--foreground)]">
              Welcher Import ist der richtige?
            </h2>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Standard Import */}
            <div className="p-5 bg-green-50 border-2 border-green-200 rounded-lg">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-green-800 text-lg">Standard-Import</h3>
              </div>
              <p className="text-sm text-green-700 mb-4">
                Ihre Daten entsprechen dem kanonischen Schema (mind. Datum, Betrag, Bezeichnung).
              </p>
              <div className="mb-4">
                <div className="text-sm font-medium text-green-800 mb-2">Geeignet für:</div>
                <ul className="text-sm text-green-700 space-y-1">
                  <li className="flex items-start">
                    <svg className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Kontoauszuege und Banktransaktionen
                  </li>
                  <li className="flex items-start">
                    <svg className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Exporte aus Buchhaltungssystemen
                  </li>
                  <li className="flex items-start">
                    <svg className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Manuell vorbereitete Dateien
                  </li>
                </ul>
              </div>
              <Link
                href="/admin/ingestion"
                className="mt-4 w-full inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Zum Standard-Import
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* AI Preprocessing */}
            <div className="p-5 bg-purple-50 border-2 border-purple-200 rounded-lg">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-purple-800 text-lg">KI-Aufbereitung</h3>
              </div>
              <p className="text-sm text-purple-700 mb-4">
                Ihre Daten sind unstrukturiert oder in einem anderen Format.
              </p>
              <div className="mb-4">
                <div className="text-sm font-medium text-purple-800 mb-2">Die KI wandelt um:</div>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li className="flex items-start">
                    <svg className="w-4 h-4 text-purple-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Beliebige Excel/CSV-Formate
                  </li>
                  <li className="flex items-start">
                    <svg className="w-4 h-4 text-purple-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    PDFs und gescannte Dokumente
                  </li>
                  <li className="flex items-start">
                    <svg className="w-4 h-4 text-purple-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Output: Kanonisches Schema
                  </li>
                </ul>
              </div>
              <Link
                href="/admin/ai-preprocessing"
                className="mt-4 w-full inline-flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
              >
                Zur KI-Aufbereitung
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Required Fields */}
      <section className="admin-card">
        <div className="p-6 border-b border-[var(--border)]">
          <div className="flex items-center">
            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium mr-3">
              Pflicht
            </span>
            <h2 className="text-lg font-medium text-[var(--foreground)]">
              Pflichtfelder (3 Felder)
            </h2>
          </div>
          <p className="text-sm text-[var(--secondary)] mt-2">
            Diese Felder müssen vorhanden sein. Der Import schlaegt nur fehl, wenn diese fehlen.
          </p>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Feld</th>
                  <th>Erkannte Varianten</th>
                  <th>Beschreibung</th>
                  <th>Beispiel</th>
                </tr>
              </thead>
              <tbody>
                {REQUIRED_FIELDS.map((field) => (
                  <tr key={field.name}>
                    <td>
                      <span className="font-semibold text-red-700">{field.name}</span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {field.alternatives.map((alt, i) => (
                          <span key={i} className="px-2 py-0.5 bg-gray-100 text-xs rounded">
                            {alt}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-sm text-[var(--secondary)]">{field.description}</td>
                    <td className="font-mono text-sm">{field.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Amount alternatives info */}
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">Betragsdarstellung</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium text-blue-700">Option A: Eine Spalte</div>
                <div className="text-blue-600">Betrag mit Vorzeichen (+/- bestimmt Richtung)</div>
              </div>
              <div>
                <div className="font-medium text-blue-700">Option B: Zwei Spalten</div>
                <div className="text-blue-600">Einzahlung und Auszahlung getrennt</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Optional Fields */}
      <section className="admin-card">
        <div className="p-6 border-b border-[var(--border)]">
          <div className="flex items-center">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mr-3">
              Optional
            </span>
            <h2 className="text-lg font-medium text-[var(--foreground)]">
              Optionale Standardfelder
            </h2>
          </div>
          <p className="text-sm text-[var(--secondary)] mt-2">
            Diese Felder werden erkannt und verarbeitet, sind aber nicht erforderlich.
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {OPTIONAL_FIELDS.map((field) => (
              <div key={field.name} className="flex items-start p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-[var(--foreground)]">{field.name}</div>
                  <div className="text-xs text-[var(--muted)]">{field.description}</div>
                </div>
                <div className="font-mono text-xs text-[var(--secondary)] bg-white px-2 py-1 rounded">
                  {field.example}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Extensibility - NEW SECTION */}
      <section className="admin-card border-2 border-purple-200">
        <div className="p-6 border-b border-purple-200 bg-purple-50">
          <div className="flex items-center">
            <svg className="w-6 h-6 text-purple-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <h2 className="text-lg font-medium text-[var(--foreground)]">
              Erweiterbarkeit: Zusaetzliche Spalten
            </h2>
          </div>
          <p className="text-sm text-purple-700 mt-2">
            <strong>Wichtig:</strong> Ihre Dateien können beliebige zusaetzliche Spalten enthalten!
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white border border-purple-200 rounded-lg">
              <div className="font-medium text-purple-800 mb-2">Nie abgelehnt</div>
              <p className="text-sm text-purple-600">
                Unbekannte Spalten fuehren niemals zu einem Fehler
              </p>
            </div>
            <div className="p-4 bg-white border border-purple-200 rounded-lg">
              <div className="font-medium text-purple-800 mb-2">Vollstaendig gespeichert</div>
              <p className="text-sm text-purple-600">
                Alle Daten werden als Metadaten erhalten
              </p>
            </div>
            <div className="p-4 bg-white border border-purple-200 rounded-lg">
              <div className="font-medium text-purple-800 mb-2">Zukunftssicher</div>
              <p className="text-sm text-purple-600">
                Neue Features können diese Daten später nutzen
              </p>
            </div>
          </div>

          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h4 className="font-medium text-purple-800 mb-2">Beispiele für Zusatzspalten:</h4>
            <div className="flex flex-wrap gap-2">
              {["Kostenstelle", "Projekt", "Buchungskreis", "Sachbearbeiter", "Mandant", "Abteilung", "Standort", "..."].map((col) => (
                <span key={col} className="px-3 py-1 bg-white border border-purple-300 rounded-full text-sm text-purple-700">
                  {col}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Supported Formats */}
      <section className="admin-card">
        <div className="p-6 border-b border-[var(--border)]">
          <h2 className="text-lg font-medium text-[var(--foreground)]">
            Unterstuetzte Dateiformate
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center mb-2">
                <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium text-green-800">Excel (.xlsx, .xls)</span>
              </div>
              <p className="text-sm text-green-700">
                Erstes Tabellenblatt wird verwendet. Erste Zeile = Spaltennamen.
              </p>
            </div>
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center mb-2">
                <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium text-green-800">CSV (.csv)</span>
              </div>
              <p className="text-sm text-green-700">
                UTF-8 empfohlen. Komma oder Semikolon als Trennzeichen.
              </p>
            </div>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-amber-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-medium text-amber-800">Flexibilitaet:</p>
                <ul className="text-sm text-amber-700 mt-1 list-disc list-inside space-y-1">
                  <li>Spaltenreihenfolge ist <strong>nicht</strong> wichtig</li>
                  <li>Spaltennamen werden <strong>nicht</strong> case-sensitiv erkannt</li>
                  <li>Leere Zeilen werden übersprungen</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Error Messages */}
      <section className="admin-card">
        <div className="p-6 border-b border-[var(--border)]">
          <h2 className="text-lg font-medium text-[var(--foreground)]">
            Fehlermeldungen verstehen
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-[var(--secondary)]">
            Fehlermeldungen beziehen sich <strong>ausschliesslich</strong> auf fehlende Pflichtfelder:
          </p>

          <div className="space-y-3">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="font-medium text-red-800 mb-1">Pflichtfeld fehlt: Datum</div>
              <p className="text-sm text-red-600">Die Datei enthält keine erkennbare Datumsspalte.</p>
            </div>
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="font-medium text-red-800 mb-1">Pflichtfeld fehlt: Betrag</div>
              <p className="text-sm text-red-600">Weder Betrag noch Einzahlung/Auszahlung gefunden.</p>
            </div>
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="font-medium text-red-800 mb-1">Pflichtfeld fehlt: Bezeichnung</div>
              <p className="text-sm text-red-600">Keine Spalte für Beschreibung/Verwendungszweck gefunden.</p>
            </div>
          </div>

          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium text-green-800">
                Unbekannte oder zusaetzliche Spalten erzeugen niemals Fehler!
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Help Section */}
      <section className="admin-card bg-gray-50">
        <div className="p-6">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-[var(--primary)] mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-medium text-[var(--foreground)]">
                Weitere Hilfe benoetigt?
              </h3>
              <p className="text-sm text-[var(--secondary)] mt-1">
                Laden Sie die Beispieldateien herunter und passen Sie Ihre Daten entsprechend an.
                Bei unstrukturierten Daten nutzen Sie die KI-Aufbereitung.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
