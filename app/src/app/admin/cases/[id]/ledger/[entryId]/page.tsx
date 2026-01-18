"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  VALUE_TYPES,
  LEGAL_BUCKETS,
  ValueType,
  LegalBucket,
  LedgerEntryResponse,
  ReviewStatus,
  REVIEW_STATUS,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_COLORS,
} from "@/lib/ledger";

const VALUE_TYPE_LABELS: Record<ValueType, string> = {
  IST: "IST",
  PLAN: "PLAN",
};

const LEGAL_BUCKET_LABELS: Record<LegalBucket, string> = {
  MASSE: "Masse",
  ABSONDERUNG: "Absonderung",
  NEUTRAL: "Neutral",
  UNKNOWN: "Unbekannt",
};

// Review Status Badge Component
function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const label = REVIEW_STATUS_LABELS[status];
  const color = REVIEW_STATUS_COLORS[status];

  const colorClasses: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700 border-gray-200",
    green: "bg-green-100 text-green-700 border-green-200",
    amber: "bg-amber-100 text-amber-700 border-amber-200",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses[color] || colorClasses.gray}`}>
      {status === REVIEW_STATUS.CONFIRMED && (
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )}
      {status === REVIEW_STATUS.ADJUSTED && (
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
      )}
      {label}
    </span>
  );
}

interface CaseData {
  id: string;
  caseNumber: string;
  debtorName: string;
}

export default function LedgerEntryEditPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  const { id, entryId } = use(params);
  const router = useRouter();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [entry, setEntry] = useState<LedgerEntryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [formLegalBucket, setFormLegalBucket] = useState<LegalBucket>("UNKNOWN");
  const [formNote, setFormNote] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");

  // Review state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewReason, setReviewReason] = useState<string>("");
  const [reviewingEntry, setReviewingEntry] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [caseRes, entryRes] = await Promise.all([
          fetch(`/api/cases/${id}`),
          fetch(`/api/cases/${id}/ledger/${entryId}`),
        ]);

        if (caseRes.ok) {
          const data = await caseRes.json();
          setCaseData(data);
        } else {
          setError("Fall nicht gefunden");
          return;
        }

        if (entryRes.ok) {
          const data = await entryRes.json();
          setEntry(data);
          setFormLegalBucket(data.legalBucket);
          setFormNote(data.note || "");
          setFormDescription(data.description || "");
        } else {
          setError("Eintrag nicht gefunden");
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Fehler beim Laden der Daten");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id, entryId]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/cases/${id}/ledger/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalBucket: formLegalBucket,
          note: formNote || null,
          description: formDescription,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Speichern fehlgeschlagen");
      }

      const updated = await res.json();
      setEntry(updated);
      setSuccessMessage("Änderungen gespeichert");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Möchten Sie diesen Eintrag wirklich löschen?")) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/cases/${id}/ledger/${entryId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Löschen fehlgeschlagen");
      }

      router.push(`/admin/cases/${id}/ledger`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
      setSaving(false);
    }
  };

  const handleConfirmReview = async () => {
    setReviewingEntry(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/cases/${id}/ledger/${entryId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CONFIRM" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Bestätigung fehlgeschlagen");
      }

      const updated = await res.json();
      setEntry(updated);
      setSuccessMessage("Eintrag als geprüft markiert");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bestätigung fehlgeschlagen");
    } finally {
      setReviewingEntry(false);
    }
  };

  const handleAdjustReview = async () => {
    if (!reviewReason.trim()) {
      setError("Bitte geben Sie eine Begründung für die Korrektur an");
      return;
    }

    setReviewingEntry(true);
    setError(null);
    setSuccessMessage(null);

    // Build changes object (only include changed fields)
    const changes: Record<string, unknown> = {};
    if (entry && formDescription !== entry.description) {
      changes.description = formDescription;
    }
    if (entry && formLegalBucket !== entry.legalBucket) {
      changes.legalBucket = formLegalBucket;
    }

    if (Object.keys(changes).length === 0) {
      setError("Keine Änderungen zum Speichern. Nutzen Sie 'Bestätigen' wenn keine Korrektur nötig ist.");
      setReviewingEntry(false);
      return;
    }

    try {
      const res = await fetch(`/api/cases/${id}/ledger/${entryId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADJUST",
          reason: reviewReason,
          ...changes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Korrektur fehlgeschlagen");
      }

      const updated = await res.json();
      setEntry(updated);
      setSuccessMessage("Eintrag korrigiert und als geprüft markiert");
      setShowReviewModal(false);
      setReviewReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Korrektur fehlgeschlagen");
    } finally {
      setReviewingEntry(false);
    }
  };

  const formatCurrency = (cents: string | number): string => {
    const amount = typeof cents === "string" ? parseInt(cents) : cents;
    return (amount / 100).toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
    });
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (!caseData || !entry) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <p className="text-[var(--danger)]">{error || "Nicht gefunden"}</p>
          <Link href={`/admin/cases/${id}/ledger`} className="btn-secondary mt-4 inline-block">
            Zurück zum Zahlungsregister
          </Link>
        </div>
      </div>
    );
  }

  const amount = parseInt(entry.amountCents);
  const isInflow = amount >= 0;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-[var(--muted)]">
        <Link href="/admin/cases" className="hover:text-[var(--primary)]">
          Fälle
        </Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link href={`/admin/cases/${id}`} className="hover:text-[var(--primary)]">
          {caseData.debtorName}
        </Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link href={`/admin/cases/${id}/ledger`} className="hover:text-[var(--primary)]">
          Zahlungsregister
        </Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[var(--foreground)]">Bearbeiten</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Ledger-Eintrag bearbeiten</h1>
            <ReviewStatusBadge status={entry.reviewStatus} />
          </div>
          <p className="text-[var(--secondary)] mt-1">
            {caseData.caseNumber} - {caseData.debtorName}
          </p>
        </div>
        <Link href={`/admin/cases/${id}/ledger`} className="btn-secondary">
          Zurück zum Zahlungsregister
        </Link>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info (Read-only) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="admin-card p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Transaktionsdetails</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[var(--muted)]">Transaktionsdatum</p>
                <p className="font-medium text-[var(--foreground)]">
                  {formatDate(entry.transactionDate)}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted)]">Betrag</p>
                <p className={`text-xl font-bold ${isInflow ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                  {formatCurrency(entry.amountCents)}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted)]">Werttyp</p>
                <p className="font-medium text-[var(--foreground)]">
                  {VALUE_TYPE_LABELS[entry.valueType]}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted)]">Buchungsquelle</p>
                <p className="font-medium text-[var(--foreground)]">
                  {entry.bookingSource || "-"}
                </p>
              </div>
            </div>

            {/* Import Info */}
            {entry.importSource && (
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">Import-Herkunft</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[var(--muted)]">Quelle</p>
                    <p className="text-[var(--secondary)]">{entry.importSource}</p>
                  </div>
                  {entry.importFileHash && (
                    <div>
                      <p className="text-[var(--muted)]">Datei-Hash</p>
                      <p className="font-mono text-xs text-[var(--secondary)]">
                        {entry.importFileHash.substring(0, 16)}...
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Editable Fields */}
          <div className="admin-card p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Bearbeitbare Felder</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  Beschreibung
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  Rechtsstatus
                </label>
                <select
                  value={formLegalBucket}
                  onChange={(e) => setFormLegalBucket(e.target.value as LegalBucket)}
                  className="input-field w-full"
                >
                  {Object.entries(LEGAL_BUCKET_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Klassifizierung für die Insolvenzmasse
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  Notiz
                </label>
                <textarea
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  rows={3}
                  className="input-field w-full"
                  placeholder="Optionale Anmerkung zum Eintrag..."
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={handleDelete}
                disabled={saving}
                className="text-[var(--danger)] hover:underline text-sm disabled:opacity-50"
              >
                Eintrag löschen
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary disabled:opacity-50"
              >
                {saving ? "Speichern..." : "Änderungen speichern"}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar: Review + Audit Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Review Section */}
          <div className="admin-card p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Prüfung</h2>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--muted)]">Status:</span>
                <ReviewStatusBadge status={entry.reviewStatus} />
              </div>

              {entry.reviewedAt && (
                <div className="text-sm">
                  <p className="text-[var(--muted)]">Geprüft am</p>
                  <p className="text-[var(--foreground)]">{formatDateTime(entry.reviewedAt)}</p>
                  <p className="text-[var(--secondary)]">von {entry.reviewedBy}</p>
                </div>
              )}

              {entry.changeReason && (
                <div className="text-sm">
                  <p className="text-[var(--muted)]">Korrektur-Begründung</p>
                  <p className="text-[var(--foreground)] italic">&ldquo;{entry.changeReason}&rdquo;</p>
                </div>
              )}

              {entry.previousAmountCents && (
                <div className="text-sm">
                  <p className="text-[var(--muted)]">Ursprünglicher Betrag</p>
                  <p className="text-[var(--secondary)] line-through">
                    {formatCurrency(entry.previousAmountCents)}
                  </p>
                </div>
              )}

              {/* Review Actions */}
              {entry.reviewStatus === REVIEW_STATUS.UNREVIEWED && (
                <div className="pt-3 border-t border-[var(--border)] space-y-2">
                  <button
                    onClick={handleConfirmReview}
                    disabled={reviewingEntry}
                    className="w-full btn-primary bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    {reviewingEntry ? "..." : "✓ Als geprüft bestätigen"}
                  </button>
                  <button
                    onClick={() => setShowReviewModal(true)}
                    disabled={reviewingEntry}
                    className="w-full btn-secondary disabled:opacity-50"
                  >
                    Korrigieren & Prüfen
                  </button>
                </div>
              )}

              {entry.reviewStatus === REVIEW_STATUS.CONFIRMED && (
                <div className="pt-3 border-t border-[var(--border)]">
                  <p className="text-xs text-[var(--muted)] mb-2">
                    Bereits bestätigt. Bei Änderungen wird der Status auf &ldquo;Korrigiert&rdquo; gesetzt.
                  </p>
                  <button
                    onClick={() => setShowReviewModal(true)}
                    disabled={reviewingEntry}
                    className="w-full btn-secondary disabled:opacity-50"
                  >
                    Nochmals korrigieren
                  </button>
                </div>
              )}

              {entry.reviewStatus === REVIEW_STATUS.ADJUSTED && (
                <div className="pt-3 border-t border-[var(--border)]">
                  <p className="text-xs text-[var(--muted)] mb-2">
                    Wurde bereits korrigiert.
                  </p>
                  <button
                    onClick={() => setShowReviewModal(true)}
                    disabled={reviewingEntry}
                    className="w-full btn-secondary disabled:opacity-50"
                  >
                    Weitere Korrektur
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Audit Info */}
          <div className="admin-card p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Audit-Trail</h2>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-[var(--muted)]">Erstellt am</p>
                <p className="text-[var(--foreground)]">{formatDateTime(entry.createdAt)}</p>
              </div>
              <div>
                <p className="text-[var(--muted)]">Erstellt von</p>
                <p className="text-[var(--foreground)]">{entry.createdBy}</p>
              </div>
              <div className="pt-3 border-t border-[var(--border)]">
                <p className="text-[var(--muted)]">Zuletzt geändert</p>
                <p className="text-[var(--foreground)]">{formatDateTime(entry.updatedAt)}</p>
              </div>
              <div>
                <p className="text-[var(--muted)]">Geändert von</p>
                <p className="text-[var(--foreground)]">{entry.updatedBy}</p>
              </div>
              <div className="pt-3 border-t border-[var(--border)]">
                <p className="text-[var(--muted)]">Eintrag-ID</p>
                <p className="font-mono text-xs text-[var(--secondary)] break-all">{entry.id}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Eintrag korrigieren
              </h3>
              <p className="text-sm text-[var(--muted)] mb-4">
                Bitte nehmen Sie die gewünschten Änderungen vor und geben Sie eine Begründung an.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                    Begründung für Korrektur *
                  </label>
                  <textarea
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    rows={3}
                    className="input-field w-full"
                    placeholder="z.B. Betrag war falsch erfasst, Rechtsstatus korrigiert..."
                    required
                  />
                </div>

                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-xs text-[var(--muted)]">
                    Die Änderungen aus den Formularfeldern (Beschreibung, Rechtsstatus) werden übernommen.
                    Ändern Sie diese vor dem Speichern.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowReviewModal(false);
                    setReviewReason("");
                    setError(null);
                  }}
                  className="btn-secondary"
                  disabled={reviewingEntry}
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleAdjustReview}
                  className="btn-primary bg-amber-600 hover:bg-amber-700"
                  disabled={reviewingEntry || !reviewReason.trim()}
                >
                  {reviewingEntry ? "Speichern..." : "Korrigieren & Prüfen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
