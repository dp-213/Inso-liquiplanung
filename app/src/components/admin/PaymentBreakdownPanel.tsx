"use client";

import { useState, useEffect, useCallback } from "react";

interface BreakdownItem {
  id: string;
  recipientName: string;
  recipientIban: string;
  amountCents: string;
  purpose: string | null;
  itemIndex: number;
  createdLedgerEntryId: string | null;
}

interface BreakdownSource {
  id: string;
  referenceNumber: string;
  executionDate: string;
  totalAmountCents: string;
  bankAccountId: string;
  paymentType: string;
  status: string;
  matchedLedgerEntryId: string | null;
  matchNote: string | null;
  errorMessage: string | null;
  sourceFileName: string | null;
  splitAt: string | null;
  itemCount: number;
  items: BreakdownItem[];
}

interface BreakdownSummary {
  total: number;
  uploaded: number;
  matched: number;
  split: number;
  error: number;
}

interface SplitResult {
  sourceId: string;
  referenceNumber: string;
  childrenCreated: number;
  status: string;
}

function formatCurrency(cents: string | number): string {
  const val = typeof cents === "string" ? parseInt(cents) : cents;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(Math.abs(val) / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE");
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  UPLOADED: { label: "Hochgeladen", color: "text-gray-600 bg-gray-100", icon: "⬆" },
  MATCHED: { label: "Gematcht", color: "text-amber-700 bg-amber-100", icon: "🔗" },
  SPLIT: { label: "Gesplittet", color: "text-green-700 bg-green-100", icon: "✓" },
  ERROR: { label: "Fehler", color: "text-red-700 bg-red-100", icon: "✗" },
};

export default function PaymentBreakdownPanel({
  caseId,
  onSplitComplete,
}: {
  caseId: string;
  onSplitComplete?: () => void;
}) {
  const [sources, setSources] = useState<BreakdownSource[]>([]);
  const [summary, setSummary] = useState<BreakdownSummary | null>(null);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);

  const fetchSources = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/cases/${caseId}/ledger/breakdown`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Laden fehlgeschlagen");
      const data = await res.json();
      setSources(data.sources);
      setSummary(data.summary);
    } catch {
      setError("Zahlbelege konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const zahlbelege = json.zahlbelege || json;
      if (!Array.isArray(zahlbelege)) {
        throw new Error("Erwartetes Format: { zahlbelege: [...] }");
      }

      const res = await fetch(`/api/cases/${caseId}/ledger/breakdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          zahlbelege,
          sourceFileName: file.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload fehlgeschlagen");

      setSuccessMessage(
        `${data.uploaded} Zahlbelege hochgeladen, ${data.matched} gematcht` +
        (data.skipped > 0 ? `, ${data.skipped} übersprungen (Duplikate)` : "") +
        (data.errors.length > 0 ? `. ${data.errors.length} Fehler.` : "")
      );

      if (data.errors.length > 0) {
        setError(data.errors.join("\n"));
      }

      await fetchSources();
      setIsCollapsed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
      // File-Input zurücksetzen
      e.target.value = "";
    }
  };

  const handleSplit = async () => {
    setSplitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/cases/${caseId}/ledger/breakdown/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Split fehlgeschlagen");

      const splitResults = (data.results as SplitResult[]).filter(
        (r) => r.status === "SPLIT"
      );
      setSuccessMessage(
        `${data.processed} Zahlbelege gesplittet → ${data.childrenCreated} Einzelposten erstellt. ` +
        `Invarianten-Test: ${data.invariantenTest}` +
        (data.errors.length > 0 ? `. ${data.errors.length} Fehler.` : "")
      );

      if (data.errors.length > 0) {
        setError(data.errors.join("\n"));
      }

      await fetchSources();
      onSplitComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Split fehlgeschlagen");
    } finally {
      setSplitting(false);
    }
  };

  const matchedCount = summary?.matched || 0;
  const hasData = (summary?.total || 0) > 0;

  return (
    <div className="border border-gray-200 rounded-lg bg-white mb-4">
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-700">Zahlbeleg-Aufschlüsselung</h3>
          {hasData && summary && (
            <div className="flex items-center gap-2 text-xs">
              {summary.split > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  {summary.split} gesplittet
                </span>
              )}
              {summary.matched > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {summary.matched} bereit
                </span>
              )}
              {summary.uploaded > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {summary.uploaded} ohne Match
                </span>
              )}
              {summary.error > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  {summary.error} Fehler
                </span>
              )}
            </div>
          )}
        </div>
        {!hasData && (
          <span className="text-xs text-gray-400">Keine Zahlbelege importiert</span>
        )}
      </button>

      {/* Content */}
      {!isCollapsed && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {/* Actions */}
          <div className="flex items-center gap-3 py-3">
            <label className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md cursor-pointer transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {uploading ? "Wird hochgeladen..." : "JSON hochladen"}
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>

            {matchedCount > 0 && (
              <button
                onClick={handleSplit}
                disabled={splitting}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-amber-600 text-white hover:bg-amber-700 rounded-md disabled:opacity-50 transition-colors"
              >
                {splitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Wird gesplittet...
                  </>
                ) : (
                  `Splits ausführen (${matchedCount})`
                )}
              </button>
            )}
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 mb-3 text-sm">
              {successMessage}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-3 text-sm whitespace-pre-line">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-sm text-gray-500 py-4 text-center">Lade Zahlbelege...</div>
          )}

          {/* Source List */}
          {!loading && sources.length > 0 && (
            <div className="space-y-1">
              {sources.map((source) => {
                const config = STATUS_CONFIG[source.status] || STATUS_CONFIG.UPLOADED;
                const isExpanded = expandedSource === source.id;

                return (
                  <div key={source.id} className="border border-gray-100 rounded-md">
                    {/* Source Header */}
                    <button
                      onClick={() => setExpandedSource(isExpanded ? null : source.id)}
                      className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 text-sm transition-colors"
                    >
                      <svg
                        className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>

                      <span className="font-mono text-gray-900 font-medium">{source.referenceNumber}</span>
                      <span className="text-gray-500">{formatDate(source.executionDate)}</span>
                      <span className="font-mono text-gray-700">{formatCurrency(source.totalAmountCents)}</span>
                      <span className="text-gray-400">{source.itemCount} Posten</span>

                      <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                        {config.icon} {config.label}
                      </span>
                    </button>

                    {/* Expanded Items */}
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-gray-100">
                        {source.matchNote && (
                          <div className="text-xs text-gray-500 mt-2 mb-1">
                            Match: {source.matchNote}
                          </div>
                        )}
                        {source.errorMessage && (
                          <div className="text-xs text-red-600 mt-2 mb-1">
                            Fehler: {source.errorMessage}
                          </div>
                        )}
                        <table className="w-full text-xs mt-2">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-2 py-1 text-left w-8">#</th>
                              <th className="px-2 py-1 text-left">Empfänger</th>
                              <th className="px-2 py-1 text-right w-24">Betrag</th>
                              <th className="px-2 py-1 text-left">Verwendungszweck</th>
                              <th className="px-2 py-1 text-left w-48">IBAN</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {source.items.map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-2 py-1 text-gray-400">{item.itemIndex + 1}</td>
                                <td className="px-2 py-1">{item.recipientName}</td>
                                <td className="px-2 py-1 text-right font-mono">{formatCurrency(item.amountCents)}</td>
                                <td className="px-2 py-1 text-gray-500 truncate max-w-[200px]">{item.purpose || "—"}</td>
                                <td className="px-2 py-1 font-mono text-gray-400">{item.recipientIban}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
