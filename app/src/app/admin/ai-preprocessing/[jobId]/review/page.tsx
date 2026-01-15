"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  INFLOW_CATEGORY_LABELS,
  OUTFLOW_CATEGORY_LABELS,
  INFLOW_CATEGORIES,
  OUTFLOW_CATEGORIES,
  UNCERTAINTY_LABELS,
  getUncertaintyClasses,
  formatAmountCents,
  type BusinessLevelView,
  type CategoryAggregation,
  type InflowCategory,
  type OutflowCategory,
} from "@/lib/ai-preprocessing/insolvency-categories";
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_DESCRIPTIONS,
  type DocumentType,
} from "@/lib/ai-preprocessing/types";

interface DetailRow {
  id: string;
  fileId: string;
  fileName: string;
  sourceLocation: string;
  status: string;
  aiSuggestion: {
    amount?: number;
    isInflow?: boolean;
    category?: string;
    weekOffset?: number;
    estateType?: string;
    valueType?: string;
    isRecurring?: boolean;
    categoryReasoning?: string;
    estateTypeReasoning?: string;
    categoryUncertainty?: string;
    amountUncertainty?: string;
    weekUncertainty?: string;
    uncertaintyExplanation?: string;
    lineName?: string;
    description?: string;
  };
  aiExplanation: string;
  confidenceScore: number;
}

export default function BusinessLevelReviewPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [businessView, setBusinessView] = useState<BusinessLevelView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Detail view state
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [categoryRows, setCategoryRows] = useState<DetailRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  // Category validation dialog
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationCategory, setValidationCategory] = useState<CategoryAggregation | null>(null);
  const [validationAction, setValidationAction] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [rejectionReason, setRejectionReason] = useState("");
  const [correctionCategory, setCorrectionCategory] = useState("");

  const fetchBusinessView = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/ai-preprocessing/${jobId}/business-view`);
      if (res.ok) {
        const data = await res.json();
        setBusinessView(data);
      } else {
        const errData = await res.json();
        setError(errData.error || "Fehler beim Laden der Daten");
      }
    } catch (err) {
      console.error("Error fetching business view:", err);
      setError("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchBusinessView();
  }, [fetchBusinessView]);

  const fetchCategoryRows = async (category: string, flowType: "INFLOW" | "OUTFLOW") => {
    setLoadingRows(true);
    try {
      const res = await fetch(`/api/ai-preprocessing/${jobId}/rows?limit=100`);
      if (res.ok) {
        const data = await res.json();
        // Filter rows by category
        const filtered = data.rows.filter((row: DetailRow) => {
          return (
            row.aiSuggestion.category === category &&
            row.aiSuggestion.isInflow === (flowType === "INFLOW")
          );
        });
        setCategoryRows(filtered);
      }
    } catch (err) {
      console.error("Error fetching category rows:", err);
    } finally {
      setLoadingRows(false);
    }
  };

  const handleCategoryClick = (category: CategoryAggregation) => {
    const key = `${category.flowType}-${category.category}`;
    if (expandedCategory === key) {
      setExpandedCategory(null);
      setCategoryRows([]);
    } else {
      setExpandedCategory(key);
      fetchCategoryRows(category.category, category.flowType);
    }
  };

  const openValidationDialog = (category: CategoryAggregation, action: "APPROVE" | "REJECT") => {
    setValidationCategory(category);
    setValidationAction(action);
    setRejectionReason("");
    setCorrectionCategory("");
    setShowValidationDialog(true);
  };

  const handleCategoryValidation = async () => {
    if (!validationCategory) return;

    if (validationAction === "REJECT" && !rejectionReason.trim()) {
      setError("Bitte geben Sie einen Grund fuer die Ablehnung an");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/ai-preprocessing/${jobId}/validate-category`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: validationCategory.category,
          flowType: validationCategory.flowType,
          action: validationAction,
          rejectionReason: rejectionReason || undefined,
          correctionCategory: correctionCategory || undefined,
          correctionExplanation: rejectionReason || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Fehler bei der Validierung");
      }

      setSuccessMessage(data.message);
      setShowValidationDialog(false);
      fetchBusinessView();

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler bei der Validierung");
    } finally {
      setSaving(false);
    }
  };

  const handleApproveAll = async () => {
    if (!businessView) return;

    if (businessView.pendingEntries > 0) {
      setError("Es gibt noch offene Positionen zur Pruefung");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/ai-preprocessing/${jobId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Fehler bei der Freigabe");
      }

      setSuccessMessage("Vorgang freigegeben! Sie koennen die Daten nun uebernehmen.");
      router.push(`/admin/ai-preprocessing/${jobId}/commit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler bei der Freigabe");
    } finally {
      setSaving(false);
    }
  };

  const getValidationStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Genehmigt</span>;
      case "PARTIAL":
        return <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">Teilweise</span>;
      case "REJECTED":
        return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">Abgelehnt</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">Offen</span>;
    }
  };

  if (loading && !businessView) {
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

  if (!businessView) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <p className="text-[var(--danger)]">{error || "Aufbereitungsvorgang nicht gefunden"}</p>
          <Link href="/admin/ai-preprocessing" className="text-[var(--primary)] hover:underline mt-2 inline-block">
            Zurueck zur Uebersicht
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2 text-sm text-[var(--secondary)] mb-1">
            <Link href="/admin/ai-preprocessing" className="hover:underline">
              KI-Aufbereitung
            </Link>
            <span>/</span>
            <span>Pruefung</span>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">
            So versteht die KI Ihre Daten
          </h1>
          <p className="text-sm text-[var(--secondary)] mt-1">
            {businessView.caseNumber} - {businessView.debtorName}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {businessView.pendingEntries === 0 && businessView.approvedEntries > 0 && (
            <button
              onClick={handleApproveAll}
              disabled={saving}
              className="btn-primary"
            >
              Freigeben und weiter
            </button>
          )}
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="font-medium text-amber-800">Geschaeftliche Interpretation pruefen</h3>
            <p className="text-sm text-amber-700 mt-1">
              Die KI hat die hochgeladenen Daten in insolvenzspezifische Kategorien eingeteilt.
              Pruefen Sie jede Kategorie und bestaetigen oder korrigieren Sie die Zuordnung.
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
          <button onClick={() => setError(null)} className="float-right text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
          {successMessage}
        </div>
      )}

      {/* Warnings */}
      {businessView.warnings.length > 0 && (
        <div className="admin-card p-4">
          <h3 className="font-medium text-[var(--foreground)] mb-3">Hinweise</h3>
          <div className="space-y-2">
            {businessView.warnings.map((warning, idx) => (
              <div
                key={idx}
                className={`flex items-start p-2 rounded ${
                  warning.severity === "ERROR"
                    ? "bg-red-50 text-red-700"
                    : warning.severity === "WARNING"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-blue-50 text-blue-700"
                }`}
              >
                <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {warning.severity === "ERROR" ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  )}
                </svg>
                <span className="text-sm">{warning.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="admin-card p-4">
          <div className="text-2xl font-semibold text-[var(--foreground)]">
            {businessView.totalDerivedEntries}
          </div>
          <div className="text-sm text-[var(--secondary)]">Positionen gesamt</div>
        </div>
        <div className="admin-card p-4 border-l-4 border-l-amber-400">
          <div className="text-2xl font-semibold text-amber-600">
            {businessView.pendingEntries}
          </div>
          <div className="text-sm text-[var(--secondary)]">Offen</div>
        </div>
        <div className="admin-card p-4 border-l-4 border-l-green-400">
          <div className="text-2xl font-semibold text-green-600">
            {businessView.approvedEntries}
          </div>
          <div className="text-sm text-[var(--secondary)]">Genehmigt</div>
        </div>
        <div className="admin-card p-4 border-l-4 border-l-red-400">
          <div className="text-2xl font-semibold text-red-600">
            {businessView.rejectedEntries}
          </div>
          <div className="text-sm text-[var(--secondary)]">Abgelehnt</div>
        </div>
        <div className="admin-card p-4 border-l-4 border-l-orange-400">
          <div className="text-2xl font-semibold text-orange-600">
            {businessView.uncertainEntries}
          </div>
          <div className="text-sm text-[var(--secondary)]">Unsicher</div>
        </div>
      </div>

      {/* Einzahlungen Section */}
      <div className="admin-card">
        <div className="p-4 border-b border-[var(--border)] bg-green-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-green-800">So versteht die KI Ihre Einzahlungen</h2>
              <p className="text-sm text-green-600">
                Gesamt: {formatAmountCents(businessView.inflows.grandTotal)} |
                {businessView.inflows.uncertainCount > 0 && (
                  <span className="text-amber-600 ml-2">
                    {businessView.inflows.uncertainCount} unsichere Zuordnungen
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Inflow Categories */}
        <div className="divide-y divide-[var(--border)]">
          {businessView.inflows.categories
            .filter((cat) => cat.totalEntryCount > 0 || cat.category in INFLOW_CATEGORIES)
            .map((category) => (
              <CategoryRow
                key={`INFLOW-${category.category}`}
                category={category}
                isExpanded={expandedCategory === `INFLOW-${category.category}`}
                rows={expandedCategory === `INFLOW-${category.category}` ? categoryRows : []}
                loadingRows={loadingRows && expandedCategory === `INFLOW-${category.category}`}
                onToggle={() => handleCategoryClick(category)}
                onApprove={() => openValidationDialog(category, "APPROVE")}
                onReject={() => openValidationDialog(category, "REJECT")}
                getValidationStatusBadge={getValidationStatusBadge}
              />
            ))}
        </div>
      </div>

      {/* Auszahlungen Section */}
      <div className="admin-card">
        <div className="p-4 border-b border-[var(--border)] bg-red-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-red-800">So versteht die KI Ihre Auszahlungen</h2>
              <p className="text-sm text-red-600">
                Gesamt: {formatAmountCents(businessView.outflows.grandTotal)} |
                {businessView.outflows.uncertainCount > 0 && (
                  <span className="text-amber-600 ml-2">
                    {businessView.outflows.uncertainCount} unsichere Zuordnungen
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Outflow Categories */}
        <div className="divide-y divide-[var(--border)]">
          {businessView.outflows.categories
            .filter((cat) => cat.totalEntryCount > 0 || cat.category in OUTFLOW_CATEGORIES)
            .map((category) => (
              <CategoryRow
                key={`OUTFLOW-${category.category}`}
                category={category}
                isExpanded={expandedCategory === `OUTFLOW-${category.category}`}
                rows={expandedCategory === `OUTFLOW-${category.category}` ? categoryRows : []}
                loadingRows={loadingRows && expandedCategory === `OUTFLOW-${category.category}`}
                onToggle={() => handleCategoryClick(category)}
                onApprove={() => openValidationDialog(category, "APPROVE")}
                onReject={() => openValidationDialog(category, "REJECT")}
                getValidationStatusBadge={getValidationStatusBadge}
              />
            ))}
        </div>
      </div>

      {/* Source Files Summary */}
      <div className="admin-card">
        <div className="p-4 border-b border-[var(--border)]">
          <h3 className="font-medium text-[var(--foreground)]">Quelldateien und Dokumenterkennung</h3>
        </div>
        <div className="p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--muted)]">
                <th className="pb-2">Datei</th>
                <th className="pb-2">Dokumenttyp</th>
                <th className="pb-2 text-right">Positionen</th>
                <th className="pb-2 text-right">Unsicher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {businessView.sourceFiles.map((file) => {
                const docType = (file as { documentType?: DocumentType }).documentType;
                const docTypeExplanation = (file as { documentTypeExplanation?: string }).documentTypeExplanation;
                return (
                  <tr key={file.fileId}>
                    <td className="py-2">
                      <div className="font-medium">{file.fileName}</div>
                    </td>
                    <td className="py-2">
                      {docType ? (
                        <div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            docType === 'LIQUIDITAETSPLANUNG' ? 'bg-green-100 text-green-800' :
                            docType === 'KONTOAUSZUG' ? 'bg-blue-100 text-blue-800' :
                            docType === 'GUV_PL' || docType === 'BWA' ? 'bg-purple-100 text-purple-800' :
                            docType === 'SUSA' ? 'bg-indigo-100 text-indigo-800' :
                            docType === 'ZAHLUNGSTERMINE' ? 'bg-cyan-100 text-cyan-800' :
                            docType === 'UNBEKANNT' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {DOCUMENT_TYPE_LABELS[docType] || docType}
                          </span>
                          {docTypeExplanation && (
                            <div className="text-xs text-[var(--muted)] mt-1" title={DOCUMENT_TYPE_DESCRIPTIONS[docType] || ''}>
                              {docTypeExplanation}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[var(--muted)]">-</span>
                      )}
                    </td>
                    <td className="py-2 text-right">{file.derivedEntryCount}</td>
                    <td className="py-2 text-right">
                      {file.uncertaintyCount > 0 ? (
                        <span className="text-amber-600">{file.uncertaintyCount}</span>
                      ) : (
                        <span className="text-green-600">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Document Type Legend */}
        <div className="px-4 pb-4 border-t border-[var(--border)] mt-2 pt-3">
          <h4 className="text-xs font-medium text-[var(--muted)] mb-2">Dokumenttyp-Erklaerung</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span>Liquiditaetsplanung = direkt verwendbar</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>Kontoauszug = IST-Transaktionen</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              <span>GuV/BWA = umgerechnet</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-gray-500"></span>
              <span>Andere = manuelle Pruefung</span>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Dialog */}
      {showValidationDialog && validationCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {validationAction === "APPROVE" ? "Kategorie genehmigen" : "Kategorie ablehnen / korrigieren"}
            </h3>

            <div className="mb-4 p-3 bg-gray-50 rounded">
              <div className="font-medium">{validationCategory.categoryLabel}</div>
              <div className="text-sm text-[var(--secondary)]">
                {validationCategory.totalEntryCount} Positionen | {formatAmountCents(validationCategory.totalAmountCents)}
              </div>
            </div>

            {validationAction === "APPROVE" ? (
              <p className="text-sm text-[var(--secondary)] mb-4">
                Alle {validationCategory.pendingCount} offenen Positionen in dieser Kategorie werden genehmigt.
              </p>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    Grund fuer Ablehnung / Korrektur *
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="z.B. 'Diese Positionen gehoeren zu Personalkosten, nicht zu Lieferanten'"
                    className="input-field w-full h-24 resize-none"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    Richtige Kategorie (optional - fuer automatische Korrektur)
                  </label>
                  <select
                    value={correctionCategory}
                    onChange={(e) => setCorrectionCategory(e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="">-- Keine Korrektur, nur ablehnen --</option>
                    <optgroup label="Einzahlungen">
                      {Object.entries(INFLOW_CATEGORY_LABELS).map(([key, label]) => (
                        <option key={key} value={key} disabled={validationCategory.flowType === "OUTFLOW"}>
                          {label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Auszahlungen">
                      {Object.entries(OUTFLOW_CATEGORY_LABELS).map(([key, label]) => (
                        <option key={key} value={key} disabled={validationCategory.flowType === "INFLOW"}>
                          {label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Wenn Sie eine Kategorie waehlen, werden alle Positionen zur erneuten Pruefung zurueckgesetzt
                  </p>
                </div>
              </>
            )}

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowValidationDialog(false)}
                className="btn-secondary"
              >
                Abbrechen
              </button>
              <button
                onClick={handleCategoryValidation}
                disabled={saving || (validationAction === "REJECT" && !rejectionReason.trim())}
                className={validationAction === "APPROVE" ? "btn-primary" : "btn-secondary text-red-600 border-red-200 hover:bg-red-50"}
              >
                {saving
                  ? "Wird verarbeitet..."
                  : validationAction === "APPROVE"
                  ? "Genehmigen"
                  : correctionCategory
                  ? "Korrigieren"
                  : "Ablehnen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Category Row Component
function CategoryRow({
  category,
  isExpanded,
  rows,
  loadingRows,
  onToggle,
  onApprove,
  onReject,
  getValidationStatusBadge,
}: {
  category: CategoryAggregation;
  isExpanded: boolean;
  rows: DetailRow[];
  loadingRows: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  getValidationStatusBadge: (status: string) => React.ReactNode;
}) {
  const hasEntries = category.totalEntryCount > 0;
  const hasUncertainty = category.uncertainEntryCount > 0;

  return (
    <div className={`${hasUncertainty ? "bg-amber-50/30" : ""}`}>
      {/* Category Header */}
      <div
        className={`p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 ${
          !hasEntries ? "opacity-50" : ""
        }`}
        onClick={hasEntries ? onToggle : undefined}
      >
        <div className="flex items-center space-x-3">
          {hasEntries && (
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
          <div>
            <div className="font-medium text-[var(--foreground)]">
              {category.categoryLabel}
              {hasUncertainty && (
                <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-700">
                  {category.uncertainEntryCount} unsicher
                </span>
              )}
            </div>
            <div className="text-sm text-[var(--secondary)]">
              {category.totalEntryCount} Positionen
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Weekly mini chart */}
          {hasEntries && (
            <div className="hidden md:flex items-end space-x-0.5 h-6">
              {category.weeklyTotals.map((week, idx) => {
                const maxAmount = Math.max(...category.weeklyTotals.map((w) => w.amountCents));
                const height = maxAmount > 0 ? (week.amountCents / maxAmount) * 100 : 0;
                return (
                  <div
                    key={idx}
                    className={`w-2 rounded-t ${
                      week.hasUncertainty
                        ? "bg-amber-400"
                        : category.flowType === "INFLOW"
                        ? "bg-green-400"
                        : "bg-red-400"
                    }`}
                    style={{ height: `${Math.max(height, 2)}%` }}
                    title={`${week.weekLabel}: ${formatAmountCents(week.amountCents)}`}
                  />
                );
              })}
            </div>
          )}

          {/* Total */}
          <div className="text-right min-w-[100px]">
            <div className={`font-semibold ${category.flowType === "INFLOW" ? "text-green-600" : "text-red-600"}`}>
              {formatAmountCents(category.totalAmountCents)}
            </div>
            {getValidationStatusBadge(category.validationStatus)}
          </div>

          {/* Actions */}
          {hasEntries && category.pendingCount > 0 && (
            <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={onApprove}
                className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                title="Passt"
              >
                Passt
              </button>
              <button
                onClick={onReject}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                title="Passt nicht"
              >
                Passt nicht
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Detail */}
      {isExpanded && (
        <div className="border-t border-[var(--border)] bg-gray-50/50">
          {/* Weekly breakdown table */}
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted)]">
                  <th className="pb-2 pr-4">Woche</th>
                  {category.weeklyTotals.map((week) => (
                    <th key={week.weekOffset} className="pb-2 px-2 text-center min-w-[70px]">
                      {week.weekLabel}
                    </th>
                  ))}
                  <th className="pb-2 pl-4 text-right">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2 pr-4 font-medium">Betrag</td>
                  {category.weeklyTotals.map((week) => (
                    <td
                      key={week.weekOffset}
                      className={`py-2 px-2 text-center ${
                        week.hasUncertainty ? "bg-amber-50 text-amber-700" : ""
                      }`}
                    >
                      {week.amountCents > 0 ? formatAmountCents(week.amountCents) : "-"}
                    </td>
                  ))}
                  <td className="py-2 pl-4 text-right font-semibold">
                    {formatAmountCents(category.totalAmountCents)}
                  </td>
                </tr>
                <tr className="text-xs text-[var(--muted)]">
                  <td className="py-1 pr-4">Anz.</td>
                  {category.weeklyTotals.map((week) => (
                    <td key={week.weekOffset} className="py-1 px-2 text-center">
                      {week.entryCount > 0 ? week.entryCount : ""}
                    </td>
                  ))}
                  <td className="py-1 pl-4 text-right">{category.totalEntryCount}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Detail rows */}
          {loadingRows ? (
            <div className="p-4 text-center text-[var(--secondary)]">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"></span>
              Lade Details...
            </div>
          ) : rows.length > 0 ? (
            <div className="border-t border-[var(--border)]">
              <div className="p-3 bg-gray-100 text-xs font-medium text-[var(--secondary)] grid grid-cols-12 gap-2">
                <div className="col-span-1">Woche</div>
                <div className="col-span-2">Betrag</div>
                <div className="col-span-3">Quelle</div>
                <div className="col-span-4">Hinweis / Begruendung</div>
                <div className="col-span-2">Status</div>
              </div>
              <div className="max-h-[400px] overflow-y-auto divide-y divide-[var(--border)]">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className={`p-3 text-sm grid grid-cols-12 gap-2 items-start ${
                      row.aiSuggestion.categoryUncertainty === "UNSICHER" ||
                      row.aiSuggestion.categoryUncertainty === "UNBEKANNT"
                        ? "bg-amber-50/50"
                        : ""
                    }`}
                  >
                    <div className="col-span-1">
                      {row.aiSuggestion.weekOffset !== undefined ? `W${row.aiSuggestion.weekOffset + 1}` : "-"}
                      {row.aiSuggestion.weekUncertainty === "UNSICHER" && (
                        <span className="text-amber-500 ml-1" title="Woche unsicher">?</span>
                      )}
                    </div>
                    <div className="col-span-2 font-mono">
                      {row.aiSuggestion.amount !== undefined
                        ? new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
                            row.aiSuggestion.amount
                          )
                        : "-"}
                      {row.aiSuggestion.amountUncertainty === "UNSICHER" && (
                        <span className="text-amber-500 ml-1" title="Betrag unsicher">?</span>
                      )}
                    </div>
                    <div className="col-span-3 text-xs">
                      <div className="text-[var(--foreground)]">{row.fileName}</div>
                      <div className="text-[var(--muted)]">{row.sourceLocation}</div>
                    </div>
                    <div className="col-span-4 text-xs">
                      {row.aiSuggestion.categoryReasoning && (
                        <div className="text-[var(--secondary)]">{row.aiSuggestion.categoryReasoning}</div>
                      )}
                      {row.aiSuggestion.uncertaintyExplanation && (
                        <div className="text-amber-600 mt-1">
                          Unsicherheit: {row.aiSuggestion.uncertaintyExplanation}
                        </div>
                      )}
                    </div>
                    <div className="col-span-2">
                      {row.aiSuggestion.categoryUncertainty && (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${getUncertaintyClasses(
                            row.aiSuggestion.categoryUncertainty as any
                          )}`}
                        >
                          {UNCERTAINTY_LABELS[row.aiSuggestion.categoryUncertainty as keyof typeof UNCERTAINTY_LABELS] ||
                            row.aiSuggestion.categoryUncertainty}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-[var(--secondary)] text-sm">
              Keine Detaildaten verfuegbar
            </div>
          )}
        </div>
      )}
    </div>
  );
}
