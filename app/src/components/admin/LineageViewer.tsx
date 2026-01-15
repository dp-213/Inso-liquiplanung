"use client";

import { useState, useEffect } from "react";

interface LineageEntry {
  stage: string;
  timestamp: string;
  data: Record<string, unknown>;
  actor?: string;
  action?: string;
}

interface LineageData {
  valueId: string;
  lineId: string;
  lineName: string;
  categoryName: string;
  weekOffset: number;
  valueType: string;
  amountCents: string;
  lineage: LineageEntry[];
}

interface LineageViewerProps {
  valueId?: string;
  lineId?: string;
  weekOffset?: number;
  valueType?: string;
  onClose: () => void;
}

export default function LineageViewer({
  valueId,
  lineId,
  weekOffset,
  valueType,
  onClose,
}: LineageViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lineageData, setLineageData] = useState<LineageData | null>(null);

  useEffect(() => {
    async function fetchLineage() {
      if (!valueId && !lineId) {
        setError("Keine ID angegeben");
        setLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (valueId) params.set("valueId", valueId);
        if (lineId) params.set("lineId", lineId);
        if (weekOffset !== undefined) params.set("weekOffset", weekOffset.toString());
        if (valueType) params.set("valueType", valueType);

        const res = await fetch(`/api/lineage?${params.toString()}`);
        if (!res.ok) {
          throw new Error("Herkunft konnte nicht geladen werden");
        }
        const data = await res.json();
        setLineageData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    }

    fetchLineage();
  }, [valueId, lineId, weekOffset, valueType]);

  const formatTimestamp = (ts: string): string => {
    return new Date(ts).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatAmount = (cents: string): string => {
    const euros = Number(BigInt(cents)) / 100;
    return euros.toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getStageLabel = (stage: string): string => {
    const labels: Record<string, string> = {
      RAW_FILE: "Quelldatei",
      PARSED_RECORD: "Eingelesene Zeile",
      TRANSFORMATION: "Transformation",
      STAGED_ENTRY: "Normalisierter Eintrag",
      REVIEW: "Prüfung",
      COMMITTED: "Übernahme",
    };
    return labels[stage] || stage;
  };

  const getStageIcon = (stage: string): React.ReactNode => {
    switch (stage) {
      case "RAW_FILE":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case "PARSED_RECORD":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
        );
      case "TRANSFORMATION":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        );
      case "STAGED_ENTRY":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        );
      case "REVIEW":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
      case "COMMITTED":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getStageColor = (stage: string): string => {
    switch (stage) {
      case "RAW_FILE":
        return "bg-gray-100 text-gray-600";
      case "PARSED_RECORD":
        return "bg-blue-100 text-blue-600";
      case "TRANSFORMATION":
        return "bg-purple-100 text-purple-600";
      case "STAGED_ENTRY":
        return "bg-yellow-100 text-yellow-600";
      case "REVIEW":
        return "bg-orange-100 text-orange-600";
      case "COMMITTED":
        return "bg-green-100 text-green-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              Datenherkunft
            </h2>
            <p className="text-sm text-[var(--secondary)] mt-1">
              Vollständige Nachverfolgung des Wertes
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--foreground)] p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
              <span className="ml-3 text-[var(--secondary)]">Laden...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-[var(--danger)] mb-2">{error}</div>
              <button onClick={onClose} className="text-[var(--primary)] hover:underline">
                Schließen
              </button>
            </div>
          ) : lineageData ? (
            <div className="space-y-6">
              {/* Value Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-[var(--muted)]">Position</div>
                    <div className="font-medium">{lineageData.lineName}</div>
                  </div>
                  <div>
                    <div className="text-[var(--muted)]">Kategorie</div>
                    <div className="font-medium">{lineageData.categoryName}</div>
                  </div>
                  <div>
                    <div className="text-[var(--muted)]">Woche / Typ</div>
                    <div className="font-medium">
                      KW {lineageData.weekOffset} / {lineageData.valueType}
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--muted)]">Betrag</div>
                    <div className="font-medium font-mono">
                      {formatAmount(lineageData.amountCents)} EUR
                    </div>
                  </div>
                </div>
              </div>

              {/* Lineage Timeline */}
              <div>
                <h3 className="font-medium text-[var(--foreground)] mb-4">
                  Verarbeitungshistorie
                </h3>
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200"></div>

                  {/* Timeline entries */}
                  <div className="space-y-6">
                    {lineageData.lineage.map((entry, index) => (
                      <div key={index} className="relative flex items-start pl-12">
                        {/* Icon */}
                        <div
                          className={`absolute left-0 w-10 h-10 rounded-full flex items-center justify-center ${getStageColor(
                            entry.stage
                          )}`}
                        >
                          {getStageIcon(entry.stage)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 bg-white border border-[var(--border)] rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-[var(--foreground)]">
                              {getStageLabel(entry.stage)}
                            </span>
                            <span className="text-xs text-[var(--muted)]">
                              {formatTimestamp(entry.timestamp)}
                            </span>
                          </div>

                          {entry.actor && (
                            <div className="text-sm text-[var(--secondary)] mb-2">
                              {entry.action ? `${entry.action} von ` : ""}
                              <span className="font-medium">{entry.actor}</span>
                            </div>
                          )}

                          {/* Data Display */}
                          <div className="text-sm">
                            {entry.stage === "RAW_FILE" && entry.data && (
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-[var(--muted)]">Datei:</span>
                                  <span className="font-medium">
                                    {entry.data.fileName as string}
                                  </span>
                                </div>
                                {typeof entry.data.fileHash === "string" && (
                                  <div className="flex justify-between">
                                    <span className="text-[var(--muted)]">Hash:</span>
                                    <span className="font-mono text-xs">
                                      {entry.data.fileHash.substring(0, 16)}...
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {entry.stage === "PARSED_RECORD" && entry.data && (
                              <div className="bg-gray-50 rounded p-2 text-xs font-mono overflow-x-auto">
                                {Object.entries(entry.data).map(([key, value]) => (
                                  <div key={key} className="flex">
                                    <span className="text-[var(--muted)] w-32 flex-shrink-0">
                                      {key}:
                                    </span>
                                    <span>{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {entry.stage === "TRANSFORMATION" && entry.data && (
                              <div className="space-y-1">
                                <div className="flex items-center">
                                  <span className="text-[var(--muted)] mr-2">
                                    {entry.data.sourceField as string}:
                                  </span>
                                  <span className="font-mono bg-red-50 px-2 py-0.5 rounded">
                                    {entry.data.sourceValue as string}
                                  </span>
                                  <svg
                                    className="w-4 h-4 mx-2 text-[var(--muted)]"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                                    />
                                  </svg>
                                  <span className="font-mono bg-green-50 px-2 py-0.5 rounded">
                                    {entry.data.targetValue as string}
                                  </span>
                                </div>
                                <div className="text-xs text-[var(--muted)]">
                                  Transformation: {entry.data.transformationType as string}
                                </div>
                              </div>
                            )}

                            {entry.stage === "STAGED_ENTRY" && entry.data && (
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-[var(--muted)]">Kategorie:</span>
                                  <span>{entry.data.categoryName as string}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-[var(--muted)]">Betrag:</span>
                                  <span className="font-mono">
                                    {formatAmount(entry.data.amountCents as string)} EUR
                                  </span>
                                </div>
                              </div>
                            )}

                            {entry.stage === "REVIEW" && entry.data && (
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-[var(--muted)]">Aktion:</span>
                                  <span className="font-medium">
                                    {entry.data.action as string}
                                  </span>
                                </div>
                                {typeof entry.data.note === "string" && (
                                  <div className="text-[var(--secondary)] italic">
                                    &quot;{entry.data.note}&quot;
                                  </div>
                                )}
                              </div>
                            )}

                            {entry.stage === "COMMITTED" && entry.data && (
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-[var(--muted)]">Aktion:</span>
                                  <span className="font-medium text-[var(--success)]">
                                    {entry.data.actionType as string}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-[var(--muted)]">Ziel-ID:</span>
                                  <span className="font-mono text-xs">
                                    {(entry.data.targetId as string).substring(0, 8)}...
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-[var(--secondary)]">
              Keine Herkunftsdaten verfügbar
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-xs text-[var(--muted)]">
              Alle Änderungen werden protokolliert und sind auditierbar
            </div>
            <button onClick={onClose} className="btn-secondary">
              Schließen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
