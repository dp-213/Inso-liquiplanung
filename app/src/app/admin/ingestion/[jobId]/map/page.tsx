"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Minimale Zielfelder für Ledger-Import
const TARGET_FIELDS = {
  transactionDate: {
    label: "Buchungsdatum",
    description: "Wann war die Zahlung?",
    required: true,
  },
  amount: {
    label: "Betrag",
    description: "Zahlungsbetrag (positiv = Eingang, negativ = Ausgang)",
    required: true,
  },
  description: {
    label: "Beschreibung",
    description: "Verwendungszweck oder Buchungstext",
    required: true,
  },
  bookingReference: {
    label: "Referenz",
    description: "Rechnungsnummer, Belegnummer etc.",
    required: false,
  },
  bookingSourceId: {
    label: "Konto/IBAN",
    description: "Bankkonto oder Kassennummer",
    required: false,
  },
};

interface JobData {
  id: string;
  caseId: string;
  fileName: string;
  sourceType: string;
  fileHashSha256: string;
  case: {
    caseNumber: string;
    debtorName: string;
  };
  records: Array<{
    rowNumber: number;
    rawData: Record<string, string>;
  }>;
}

interface BankAccount {
  id: string;
  bankName: string;
  iban: string;
  accountType: string;
}

export default function MappingPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [job, setJob] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Erkannte Spalten aus der Datei
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [sampleData, setSampleData] = useState<Record<string, string>[]>([]);

  // Mapping State - einfach: sourceColumn -> targetField
  const [mappings, setMappings] = useState<Record<string, string>>({
    transactionDate: "",
    amount: "",
    description: "",
    bookingReference: "",
    bookingSourceId: "",
  });

  // Konfiguration
  const [valueType, setValueType] = useState<"IST" | "PLAN">("IST");
  const [dateFormat, setDateFormat] = useState("DD.MM.YYYY");
  const [decimalSeparator, setDecimalSeparator] = useState(",");

  // Bankkontoauswahl (optional)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/ingestion/${resolvedParams.jobId}`);
        if (!res.ok) throw new Error("Job nicht gefunden");

        const data = await res.json();
        setJob(data);

        // Bankkonten für diesen Case laden
        const bankRes = await fetch(`/api/cases/${data.caseId}/bank-accounts`);
        if (bankRes.ok) {
          const bankData = await bankRes.json();
          setBankAccounts(bankData.accounts || []);
        }

        if (data.records.length > 0) {
          const cols = Object.keys(data.records[0].rawData);
          setSourceColumns(cols);
          setSampleData(data.records.slice(0, 5).map((r: { rawData: Record<string, string> }) => r.rawData));

          // Auto-Erkennung
          const autoMappings = { ...mappings };

          cols.forEach((col) => {
            const lowerCol = col.toLowerCase();

            // Datum erkennen
            if (["datum", "date", "buchungstag", "valuta", "wertstellung", "booking date"].some(k => lowerCol.includes(k))) {
              if (!autoMappings.transactionDate) autoMappings.transactionDate = col;
            }
            // Betrag erkennen
            else if (["betrag", "amount", "summe", "wert", "haben", "soll", "credit", "debit"].some(k => lowerCol.includes(k))) {
              if (!autoMappings.amount) autoMappings.amount = col;
            }
            // Beschreibung erkennen
            else if (["verwendungszweck", "beschreibung", "text", "buchungstext", "creditor", "debtor", "empfänger", "auftraggeber", "partner", "name", "transaktionsinformation", "transaction"].some(k => lowerCol.includes(k))) {
              if (!autoMappings.description) autoMappings.description = col;
            }
            // Referenz erkennen
            else if (["referenz", "reference", "beleg", "rechnung", "invoice"].some(k => lowerCol.includes(k))) {
              if (!autoMappings.bookingReference) autoMappings.bookingReference = col;
            }
            // Konto erkennen
            else if (["iban", "konto", "account"].some(k => lowerCol.includes(k))) {
              if (!autoMappings.bookingSourceId) autoMappings.bookingSourceId = col;
            }
          });

          setMappings(autoMappings);
        }
      } catch (err) {
        setError("Fehler beim Laden der Daten");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [resolvedParams.jobId]);

  const handleSubmit = async () => {
    // Validierung
    if (!mappings.transactionDate) {
      setError("Bitte eine Spalte für das Buchungsdatum auswählen");
      return;
    }
    if (!mappings.amount) {
      setError("Bitte eine Spalte für den Betrag auswählen");
      return;
    }
    if (!mappings.description) {
      setError("Bitte eine Spalte für die Beschreibung auswählen");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/ingestion/${resolvedParams.jobId}/to-ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mappings,
          valueType,
          dateFormat,
          decimalSeparator,
          bankAccountId: selectedBankAccountId || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Import fehlgeschlagen");
      }

      // Erfolg - zum Ledger-Review weiterleiten
      router.push(`/admin/cases/${job?.caseId}/ledger?imported=${data.created}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import fehlgeschlagen");
    } finally {
      setSubmitting(false);
    }
  };

  // Validierungsstatus
  const isValid = mappings.transactionDate && mappings.amount && mappings.description;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
            <span className="ml-3 text-[var(--secondary)]">Laden...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <div className="text-[var(--danger)]">Importvorgang nicht gefunden</div>
          <Link href="/admin/ingestion" className="text-[var(--primary)] hover:underline mt-4 block">
            Zurück
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href={`/admin/ingestion/${resolvedParams.jobId}`}
            className="text-[var(--secondary)] hover:text-[var(--foreground)]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">
              Zahlungen einlesen
            </h1>
            <p className="text-sm text-[var(--secondary)]">
              {job.fileName} · {job.case.debtorName}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Datenvorschau */}
      <div className="admin-card">
        <div className="p-4 border-b border-[var(--border)]">
          <h3 className="font-medium text-[var(--foreground)]">Ihre Daten</h3>
          <p className="text-sm text-[var(--secondary)] mt-1">
            {job.records.length} Zeilen aus &quot;{job.fileName}&quot;
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="admin-table text-sm">
            <thead>
              <tr>
                <th className="w-12">#</th>
                {sourceColumns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sampleData.map((row, idx) => (
                <tr key={idx}>
                  <td className="font-mono">{idx + 1}</td>
                  {sourceColumns.map((col) => {
                    const value = row[col];
                    const displayValue = typeof value === 'object' && value !== null
                      ? JSON.stringify(value)
                      : (value || "-");
                    return (
                      <td key={col} className="max-w-xs truncate">
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Spaltenzuordnung */}
      <div className="admin-card">
        <div className="p-4 border-b border-[var(--border)]">
          <h3 className="font-medium text-[var(--foreground)]">Spalten zuordnen</h3>
          <p className="text-sm text-[var(--secondary)] mt-1">
            Welche Spalte enthält welche Information?
          </p>
        </div>
        <div className="p-4 space-y-4">
          {Object.entries(TARGET_FIELDS).map(([fieldKey, field]) => (
            <div key={fieldKey} className="flex items-center space-x-4">
              <div className="w-48">
                <span className={`font-medium ${field.required ? "text-[var(--foreground)]" : "text-[var(--secondary)]"}`}>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </span>
                <p className="text-xs text-[var(--muted)]">{field.description}</p>
              </div>
              <div className="flex-1">
                <select
                  value={mappings[fieldKey as keyof typeof mappings]}
                  onChange={(e) => setMappings({ ...mappings, [fieldKey]: e.target.value })}
                  className={`input-field ${
                    field.required && !mappings[fieldKey as keyof typeof mappings]
                      ? "border-red-300"
                      : ""
                  }`}
                >
                  <option value="">-- Spalte auswählen --</option>
                  {sourceColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
              {mappings[fieldKey as keyof typeof mappings] && (
                <div className="w-64 text-sm text-[var(--muted)] truncate">
                  Beispiel: {sampleData[0]?.[mappings[fieldKey as keyof typeof mappings]] || "-"}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Optionen */}
      <div className="admin-card">
        <div className="p-4 border-b border-[var(--border)]">
          <h3 className="font-medium text-[var(--foreground)]">Optionen</h3>
        </div>
        <div className="p-4 space-y-4">
          {/* Bankkonto-Zuordnung (prominent oben) */}
          {bankAccounts.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-blue-800 mb-2">
                Bankkonto zuordnen (optional)
              </label>
              <select
                value={selectedBankAccountId}
                onChange={(e) => setSelectedBankAccountId(e.target.value)}
                className="input-field w-full max-w-md"
              >
                <option value="">-- Kein Bankkonto zuordnen --</option>
                {bankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bankName} - {acc.iban} ({acc.accountType})
                  </option>
                ))}
              </select>
              <p className="text-xs text-blue-600 mt-2">
                Alle importierten Zahlungen werden diesem Bankkonto zugeordnet.
                Dies erleichtert spätere Auswertungen nach Konten.
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Werttyp
              </label>
              <select
                value={valueType}
                onChange={(e) => setValueType(e.target.value as "IST" | "PLAN")}
                className="input-field"
              >
                <option value="IST">IST (tatsächliche Zahlungen)</option>
                <option value="PLAN">PLAN (geplante Zahlungen)</option>
              </select>
              <p className="text-xs text-[var(--muted)] mt-1">
                Bank-Kontoauszüge sind typischerweise IST-Werte
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Datumsformat
              </label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="input-field"
              >
                <option value="AUTO">Automatisch erkennen</option>
                <option value="DD.MM.YYYY">TT.MM.JJJJ (deutsch)</option>
                <option value="DD.MM.YY">TT.MM.JJ (deutsch kurz)</option>
                <option value="MM/DD/YY">MM/TT/JJ (US kurz)</option>
                <option value="MM/DD/YYYY">MM/TT/JJJJ (US)</option>
                <option value="DD/MM/YYYY">TT/MM/JJJJ</option>
                <option value="DD/MM/YY">TT/MM/JJ</option>
                <option value="YYYY-MM-DD">JJJJ-MM-TT (ISO)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Dezimaltrennzeichen
              </label>
              <select
                value={decimalSeparator}
                onChange={(e) => setDecimalSeparator(e.target.value)}
                className="input-field"
              >
                <option value=",">, (Komma - deutsch)</option>
                <option value=".">. (Punkt - englisch)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Status und Submit */}
      <div className="admin-card">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--secondary)]">
              {isValid ? (
                <span className="text-green-600">
                  ✓ Bereit zum Import ({job.records.length} Zahlungen)
                </span>
              ) : (
                <span className="text-red-600">
                  Bitte alle Pflichtfelder zuordnen
                </span>
              )}
            </div>
            <div className="flex space-x-3">
              <Link
                href={`/admin/ingestion/${resolvedParams.jobId}`}
                className="btn-secondary"
              >
                Abbrechen
              </Link>
              <button
                onClick={handleSubmit}
                disabled={submitting || !isValid}
                className="btn-primary disabled:opacity-50"
              >
                {submitting ? "Importiere..." : "Zahlungen importieren"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hinweis */}
      <div className="text-sm text-[var(--muted)] text-center">
        Die importierten Zahlungen erscheinen im Ledger zur Prüfung.
        Kategorien und Zuordnungen können dort vorgenommen werden.
      </div>
    </div>
  );
}
