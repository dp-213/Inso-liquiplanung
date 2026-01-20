"use client";

/**
 * EstateAllocationSummary Component
 *
 * Zeigt die Alt-/Neumasse-Zuordnung aus estateAllocation an.
 * WICHTIG: Alt/Neu kommt aus dem Leistungsdatum, NICHT aus legalBucket!
 *
 * Features:
 * - UNKLAR-Warnung wenn Buchungen ohne Zuordnung existieren
 * - Alt/Neu-Summen übersichtlich dargestellt
 * - Link zum Zahlungsregister für Nachbearbeitung
 */

import Link from "next/link";

interface EstateAllocationData {
  totalAltmasseInflowsCents: string;
  totalAltmasseOutflowsCents: string;
  totalNeumasseInflowsCents: string;
  totalNeumasseOutflowsCents: string;
  totalUnklarInflowsCents: string;
  totalUnklarOutflowsCents: string;
  unklarCount: number;
  warnings: {
    type: string;
    severity: string;
    message: string;
    count: number;
    totalCents: string;
  }[];
}

interface Props {
  caseId: string;
  data: EstateAllocationData | null;
}

function formatCurrency(cents: string | number): string {
  const value = typeof cents === "string" ? parseInt(cents, 10) : cents;
  const euros = value / 100;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(euros);
}

export default function EstateAllocationSummary({ caseId, data }: Props) {
  if (!data) {
    return null;
  }

  const hasUnklarEntries = data.unklarCount > 0;
  const totalUnklarCents =
    BigInt(data.totalUnklarInflowsCents) + BigInt(data.totalUnklarOutflowsCents);

  // Berechne Netto Alt/Neu
  const nettoAltmasse =
    BigInt(data.totalAltmasseInflowsCents) -
    BigInt(data.totalAltmasseOutflowsCents);
  const nettoNeumasse =
    BigInt(data.totalNeumasseInflowsCents) -
    BigInt(data.totalNeumasseOutflowsCents);

  return (
    <div className="space-y-4">
      {/* UNKLAR-Warnung - prominent anzeigen! */}
      {hasUnklarEntries && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg
                className="w-6 h-6 text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-800">
                {data.unklarCount} Buchung
                {data.unklarCount === 1 ? "" : "en"} ohne Alt/Neu-Zuordnung
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                <strong>{formatCurrency(totalUnklarCents.toString())}</strong>{" "}
                sind NICHT in den Alt/Neu-Summen enthalten. Diese Beträge werden
                still ignoriert und könnten die Berechnungen verfälschen.
              </p>
              <div className="mt-3">
                <Link
                  href={`/admin/cases/${caseId}/ledger?filter=unklar`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-800 hover:text-amber-900 underline"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Leistungsdaten nachpflegen
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alt/Neu-Zusammenfassung */}
      <div className="admin-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Alt-/Neumasse-Zuordnung
          </h3>
          <span className="text-xs text-[var(--muted)] bg-blue-50 px-2 py-0.5 rounded">
            aus Leistungsdatum
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Altmasse */}
          <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
            <div className="text-xs font-medium text-orange-700 uppercase tracking-wide mb-1">
              Altmasse
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-orange-600">Einzahlungen</span>
                <span className="font-medium text-green-700">
                  +{formatCurrency(data.totalAltmasseInflowsCents)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-orange-600">Auszahlungen</span>
                <span className="font-medium text-red-700">
                  -{formatCurrency(data.totalAltmasseOutflowsCents)}
                </span>
              </div>
              <div className="border-t border-orange-200 pt-1 mt-1">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-orange-800">Netto</span>
                  <span
                    className={
                      nettoAltmasse >= 0 ? "text-green-700" : "text-red-700"
                    }
                  >
                    {formatCurrency(nettoAltmasse.toString())}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Neumasse */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1">
              Neumasse
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-blue-600">Einzahlungen</span>
                <span className="font-medium text-green-700">
                  +{formatCurrency(data.totalNeumasseInflowsCents)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-600">Auszahlungen</span>
                <span className="font-medium text-red-700">
                  -{formatCurrency(data.totalNeumasseOutflowsCents)}
                </span>
              </div>
              <div className="border-t border-blue-200 pt-1 mt-1">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-blue-800">Netto</span>
                  <span
                    className={
                      nettoNeumasse >= 0 ? "text-green-700" : "text-red-700"
                    }
                  >
                    {formatCurrency(nettoNeumasse.toString())}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* UNKLAR separat anzeigen wenn vorhanden */}
        {hasUnklarEntries && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Nicht zugeordnet (UNKLAR)
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {data.unklarCount} Buchungen,{" "}
                  {formatCurrency(totalUnklarCents.toString())}
                </div>
              </div>
              <span className="text-xs text-gray-500 italic">
                Nicht in Alt/Neu enthalten
              </span>
            </div>
          </div>
        )}

        {/* Hinweis zur Datenquelle */}
        <p className="text-xs text-[var(--muted)] mt-4 flex items-start gap-1.5">
          <svg
            className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Die Alt/Neu-Zuordnung basiert auf dem <strong>Leistungsdatum</strong>{" "}
          der Buchungen, nicht auf dem Buchungsdatum oder der rechtlichen
          Klassifikation.
        </p>
      </div>
    </div>
  );
}
