"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  REVIEW_ACTION_LABELS,
  REVIEW_REASON_LABELS,
  ReviewAction,
  ReviewReasonCode,
} from "@/lib/ingestion/types";

interface ReviewItem {
  id: string;
  jobId: string;
  targetCategoryName: string;
  targetCategoryFlowType: "INFLOW" | "OUTFLOW";
  targetCategoryEstateType: "ALTMASSE" | "NEUMASSE";
  lineName: string;
  weekOffset: number;
  valueType: "IST" | "PLAN";
  amountCents: string;
  originalAmountRaw: string | null;
  requiresReview: boolean;
  reviewReason: string | null;
  reviewReasonCode: ReviewReasonCode | null;
  status: string;
  sourceRecord: {
    rowNumber: number;
    rawData: Record<string, string>;
  };
}

interface JobInfo {
  id: string;
  fileName: string;
  case: {
    caseNumber: string;
    debtorName: string;
  };
}

interface DefaultCategory {
  name: string;
  flowType: "INFLOW" | "OUTFLOW";
  estateType: "NEUMASSE" | "ALTMASSE";
}

const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Umsatzerlöse", flowType: "INFLOW", estateType: "NEUMASSE" },
  { name: "Forderungseinzüge", flowType: "INFLOW", estateType: "ALTMASSE" },
  { name: "Sonstige Einzahlungen Neu", flowType: "INFLOW", estateType: "NEUMASSE" },
  { name: "Löhne und Gehälter", flowType: "OUTFLOW", estateType: "NEUMASSE" },
  { name: "Miete und Nebenkosten", flowType: "OUTFLOW", estateType: "NEUMASSE" },
  { name: "Material und Waren", flowType: "OUTFLOW", estateType: "NEUMASSE" },
  { name: "Sonstige Auszahlungen Neu", flowType: "OUTFLOW", estateType: "NEUMASSE" },
  { name: "Altmasseverbindlichkeiten", flowType: "OUTFLOW", estateType: "ALTMASSE" },
];

export default function ReviewPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [job, setJob] = useState<JobInfo | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Current item being edited
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Edit form state
  const [editLineName, setEditLineName] = useState("");
  const [editWeekOffset, setEditWeekOffset] = useState(0);
  const [editAmountCents, setEditAmountCents] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editNote, setEditNote] = useState("");

  // Filter state
  const [filterReason, setFilterReason] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, [resolvedParams.jobId]);

  const fetchData = async () => {
    try {
      const [jobRes, reviewRes] = await Promise.all([
        fetch(`/api/ingestion/${resolvedParams.jobId}`),
        fetch(`/api/ingestion/${resolvedParams.jobId}/review`),
      ]);

      if (jobRes.ok) {
        const jobData = await jobRes.json();
        setJob(jobData);
      }

      if (reviewRes.ok) {
        const reviewData = await reviewRes.json();
        setItems(reviewData);
      }
    } catch (err) {
      setError("Fehler beim Laden der Daten");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (cents: string): string => {
    const euros = Number(BigInt(cents)) / 100;
    return euros.toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const parseAmount = (input: string): string => {
    // Parse German format to cents
    let cleaned = input.replace(/\./g, "").replace(",", ".");
    const value = parseFloat(cleaned);
    if (isNaN(value)) return "0";
    return Math.round(value * 100).toString();
  };

  const handleSelectItem = (item: ReviewItem) => {
    setSelectedItem(item);
    setEditLineName(item.lineName);
    setEditWeekOffset(item.weekOffset);
    setEditAmountCents(formatAmount(item.amountCents));
    setEditCategory(item.targetCategoryName);
    setEditNote("");
    setEditMode(false);
    setError(null);
  };

  const handleAction = async (action: ReviewAction, item?: ReviewItem) => {
    const targetItem = item || selectedItem;
    if (!targetItem) return;

    setSubmitting(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        entryId: targetItem.id,
        action,
      };

      // Add modified data if in edit mode and action is MODIFY
      if (action === "MODIFY" && editMode) {
        body.modifiedData = {
          lineName: editLineName,
          weekOffset: editWeekOffset,
          amountCents: parseAmount(editAmountCents),
          targetCategoryName: editCategory,
        };
        if (editNote) {
          body.reviewNote = editNote;
        }
      }

      const res = await fetch(`/api/ingestion/${resolvedParams.jobId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Aktion fehlgeschlagen");
      }

      // Remove item from list
      setItems(items.filter((i) => i.id !== targetItem.id));
      setSelectedItem(null);
      setEditMode(false);

      if (data.remainingReviews === 0) {
        setSuccessMessage("Alle Einträge geprüft. Import kann übernommen werden.");
      } else {
        setSuccessMessage(`Eintrag ${REVIEW_ACTION_LABELS[action].toLowerCase()}. ${data.remainingReviews} offen.`);
      }

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler bei der Aktion");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkAction = async (action: "APPROVE_ALL" | "REJECT_ALL") => {
    if (!confirm(`Wirklich alle ${items.length} Einträge ${action === "APPROVE_ALL" ? "genehmigen" : "ablehnen"}?`)) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/ingestion/${resolvedParams.jobId}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        throw new Error("Massenaktion fehlgeschlagen");
      }

      setItems([]);
      setSelectedItem(null);
      setSuccessMessage(
        action === "APPROVE_ALL"
          ? "Alle Einträge genehmigt"
          : "Alle Einträge abgelehnt"
      );

      // Redirect after brief delay
      setTimeout(() => {
        router.push(`/admin/ingestion/${resolvedParams.jobId}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler bei der Massenaktion");
    } finally {
      setSubmitting(false);
    }
  };

  const getReasonLabel = (code: ReviewReasonCode | null, text: string | null): string => {
    if (code && REVIEW_REASON_LABELS[code]) {
      return REVIEW_REASON_LABELS[code];
    }
    return text || "Prüfung erforderlich";
  };

  const filteredItems = filterReason
    ? items.filter((item) => item.reviewReasonCode === filterReason || item.reviewReason?.includes(filterReason))
    : items;

  // Get unique reasons for filter
  const uniqueReasons = [...new Set(items.map((item) => item.reviewReasonCode || item.reviewReason).filter(Boolean))];

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
              Prüfung
            </h1>
            <p className="text-sm text-[var(--secondary)]">
              {job?.fileName} - {job?.case.caseNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-sm text-[var(--secondary)]">
            {items.length} Einträge zu prüfen
          </span>
          {items.length > 0 && (
            <>
              <button
                onClick={() => handleBulkAction("APPROVE_ALL")}
                disabled={submitting}
                className="btn-secondary text-[var(--success)]"
              >
                Alle genehmigen
              </button>
              <button
                onClick={() => handleBulkAction("REJECT_ALL")}
                disabled={submitting}
                className="btn-secondary text-[var(--danger)]"
              >
                Alle ablehnen
              </button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
          {successMessage}
        </div>
      )}

      {items.length === 0 ? (
        <div className="admin-card p-8 text-center">
          <svg
            className="w-16 h-16 mx-auto text-[var(--success)] mb-4"
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
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
            Prüfung abgeschlossen
          </h2>
          <p className="text-[var(--secondary)] mb-6">
            Alle Einträge wurden geprüft. Der Import kann nun übernommen werden.
          </p>
          <Link
            href={`/admin/ingestion/${resolvedParams.jobId}`}
            className="btn-primary"
          >
            Zurück zum Import
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {/* Item List */}
          <div className="col-span-1 admin-card">
            <div className="p-4 border-b border-[var(--border)]">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-[var(--foreground)]">
                  Zu prüfen ({filteredItems.length})
                </h3>
                {uniqueReasons.length > 1 && (
                  <select
                    value={filterReason}
                    onChange={(e) => setFilterReason(e.target.value)}
                    className="input-field text-xs py-1 w-auto"
                  >
                    <option value="">Alle Gründe</option>
                    {uniqueReasons.map((reason) => (
                      <option key={reason} value={reason!}>
                        {reason && REVIEW_REASON_LABELS[reason as ReviewReasonCode]
                          ? REVIEW_REASON_LABELS[reason as ReviewReasonCode]
                          : reason}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="divide-y divide-[var(--border)] max-h-[600px] overflow-y-auto">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                    selectedItem?.id === item.id ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-[var(--foreground)] truncate">
                        {item.lineName}
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-1">
                        Zeile {item.sourceRecord.rowNumber} | KW {item.weekOffset}
                      </div>
                      <div className="text-xs text-[var(--warning)] mt-1 truncate">
                        {getReasonLabel(item.reviewReasonCode, item.reviewReason)}
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <div className="font-mono text-sm">
                        {formatAmount(item.amountCents)}
                      </div>
                      <div className="text-xs text-[var(--muted)]">EUR</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detail Panel */}
          <div className="col-span-2 admin-card">
            {selectedItem ? (
              <div>
                <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                  <h3 className="font-medium text-[var(--foreground)]">
                    Zeile {selectedItem.sourceRecord.rowNumber}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setEditMode(!editMode)}
                      className={`btn-secondary text-sm ${editMode ? "bg-gray-200" : ""}`}
                    >
                      {editMode ? "Ansicht" : "Bearbeiten"}
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Reason Banner */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <svg
                        className="w-5 h-5 text-[var(--warning)] mt-0.5 mr-3 flex-shrink-0"
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
                      <div>
                        <h4 className="font-medium text-[var(--warning)]">
                          Prüfung erforderlich
                        </h4>
                        <p className="text-sm mt-1">
                          {getReasonLabel(selectedItem.reviewReasonCode, selectedItem.reviewReason)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Raw Data */}
                  <div>
                    <h4 className="text-sm font-medium text-[var(--foreground)] mb-2">
                      Quelldaten
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-4 text-sm">
                      <table className="w-full">
                        <tbody>
                          {Object.entries(selectedItem.sourceRecord.rawData).map(
                            ([key, value]) => (
                              <tr key={key}>
                                <td className="py-1 pr-4 text-[var(--muted)] font-medium">
                                  {key}
                                </td>
                                <td className="py-1">{value || "-"}</td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mapped Values */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-[var(--foreground)] mb-3">
                        Zugeordnete Werte
                      </h4>
                      {editMode ? (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs text-[var(--muted)] mb-1">
                              Bezeichnung
                            </label>
                            <input
                              type="text"
                              value={editLineName}
                              onChange={(e) => setEditLineName(e.target.value)}
                              className="input-field"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-[var(--muted)] mb-1">
                              Betrag (EUR)
                            </label>
                            <input
                              type="text"
                              value={editAmountCents}
                              onChange={(e) => setEditAmountCents(e.target.value)}
                              className="input-field font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-[var(--muted)] mb-1">
                              Woche (0-12)
                            </label>
                            <select
                              value={editWeekOffset}
                              onChange={(e) => setEditWeekOffset(parseInt(e.target.value))}
                              className="input-field"
                            >
                              {Array.from({ length: 13 }, (_, i) => (
                                <option key={i} value={i}>
                                  KW {i}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <dl className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-[var(--muted)]">Bezeichnung:</dt>
                            <dd className="font-medium">{selectedItem.lineName}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-[var(--muted)]">Betrag:</dt>
                            <dd className="font-mono font-medium">
                              {formatAmount(selectedItem.amountCents)} EUR
                            </dd>
                          </div>
                          {selectedItem.originalAmountRaw && (
                            <div className="flex justify-between">
                              <dt className="text-[var(--muted)]">Original:</dt>
                              <dd className="font-mono text-[var(--secondary)]">
                                {selectedItem.originalAmountRaw}
                              </dd>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <dt className="text-[var(--muted)]">Woche:</dt>
                            <dd className="font-medium">KW {selectedItem.weekOffset}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-[var(--muted)]">Typ:</dt>
                            <dd className="font-medium">{selectedItem.valueType}</dd>
                          </div>
                        </dl>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-[var(--foreground)] mb-3">
                        Kategorie
                      </h4>
                      {editMode ? (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs text-[var(--muted)] mb-1">
                              Kategorie
                            </label>
                            <select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              className="input-field"
                            >
                              {DEFAULT_CATEGORIES.map((cat) => (
                                <option key={cat.name} value={cat.name}>
                                  {cat.name} ({cat.flowType})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-[var(--muted)] mb-1">
                              Notiz (optional)
                            </label>
                            <textarea
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              className="input-field"
                              rows={3}
                              placeholder="Begründung für die Korrektur..."
                            />
                          </div>
                        </div>
                      ) : (
                        <dl className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-[var(--muted)]">Kategorie:</dt>
                            <dd className="font-medium">
                              {selectedItem.targetCategoryName}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-[var(--muted)]">Art:</dt>
                            <dd>
                              <span
                                className={`badge ${
                                  selectedItem.targetCategoryFlowType === "INFLOW"
                                    ? "badge-success"
                                    : "badge-danger"
                                }`}
                              >
                                {selectedItem.targetCategoryFlowType === "INFLOW"
                                  ? "Einzahlung"
                                  : "Auszahlung"}
                              </span>
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-[var(--muted)]">Masse:</dt>
                            <dd>
                              <span className="badge badge-neutral">
                                {selectedItem.targetCategoryEstateType}
                              </span>
                            </dd>
                          </div>
                        </dl>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="border-t border-[var(--border)] pt-6 flex items-center justify-between">
                    <div className="text-sm text-[var(--muted)]">
                      Wählen Sie eine Aktion für diesen Eintrag
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleAction("REJECT")}
                        disabled={submitting}
                        className="btn-secondary text-[var(--danger)]"
                      >
                        Ablehnen
                      </button>
                      <button
                        onClick={() => handleAction("NEEDS_CLARIFICATION")}
                        disabled={submitting}
                        className="btn-secondary text-[var(--warning)]"
                      >
                        Rückfrage
                      </button>
                      {editMode ? (
                        <button
                          onClick={() => handleAction("MODIFY")}
                          disabled={submitting}
                          className="btn-primary"
                        >
                          {submitting ? "Speichern..." : "Mit Korrektur genehmigen"}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAction("APPROVE")}
                          disabled={submitting}
                          className="btn-primary bg-[var(--success)]"
                        >
                          {submitting ? "Speichern..." : "Genehmigen"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-[var(--secondary)]">
                <svg
                  className="w-16 h-16 mx-auto text-[var(--muted)] mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <p>Wählen Sie einen Eintrag aus der Liste zur Prüfung</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
