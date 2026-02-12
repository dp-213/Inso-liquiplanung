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
  CATEGORY_TAG_LABELS,
  CATEGORY_TAG_OPTIONS,
  CATEGORY_TAG_SOURCE_LABELS,
  CategoryTagSource,
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

// Estate Allocation (Alt-/Neumasse)
type EstateAllocationType = "ALTMASSE" | "NEUMASSE" | "MIXED" | "UNKLAR" | "";
const ESTATE_ALLOCATION_OPTIONS: { value: EstateAllocationType; label: string }[] = [
  { value: "", label: "-- Nicht gesetzt --" },
  { value: "ALTMASSE", label: "Altmasse" },
  { value: "NEUMASSE", label: "Neumasse" },
  { value: "MIXED", label: "Gemischt" },
  { value: "UNKLAR", label: "Unklar / Prüfung nötig" },
];

const ESTATE_ALLOCATION_BADGE_CLASSES: Record<string, string> = {
  ALTMASSE: "bg-amber-100 text-amber-800 border-amber-200",
  NEUMASSE: "bg-green-100 text-green-800 border-green-200",
  MIXED: "bg-purple-100 text-purple-800 border-purple-200",
  UNKLAR: "bg-red-100 text-red-800 border-red-200",
};

// WICHTIG: Keine TRANSACTION_DATE_RULE - Buchungsdatum ist KEINE gültige Entscheidungsgrundlage
// für Alt/Neu-Zuordnung. Maßgeblich ist ausschließlich Forderungsentstehung (serviceDate, servicePeriod).
const ALLOCATION_SOURCE_LABELS: Record<string, string> = {
  VERTRAGSREGEL: "Vertragsregel",
  SERVICE_DATE_RULE: "Leistungsdatum",
  PERIOD_PRORATA: "Zeitanteilig",
  VORMONAT_LOGIK: "Vormonat-Logik (HZV)",
  MANUELL: "Manuell zugeordnet",
  UNKLAR: "Automatische Zuordnung nicht möglich",
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

interface BankAccount {
  id: string;
  bankName: string;
  iban: string;
  accountType: string;
}

interface Counterparty {
  id: string;
  name: string;
  shortName: string | null;
  type: string | null;
}

interface Location {
  id: string;
  name: string;
  shortName: string | null;
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

  // Steuerungsdimensionen
  const [formBankAccountId, setFormBankAccountId] = useState<string>("");
  const [formCounterpartyId, setFormCounterpartyId] = useState<string>("");
  const [formLocationId, setFormLocationId] = useState<string>("");
  const [formSteeringTag, setFormSteeringTag] = useState<string>("");

  // Matrix-Kategorie (categoryTag)
  const [formCategoryTag, setFormCategoryTag] = useState<string>("");

  // Estate Allocation (Alt-/Neumasse)
  const [formEstateAllocation, setFormEstateAllocation] = useState<EstateAllocationType>("");

  // Service Date / Period (für Alt/Neu-Zuordnung)
  const [serviceDate, setServiceDate] = useState<string>("");
  const [servicePeriodStart, setServicePeriodStart] = useState<string>("");
  const [servicePeriodEnd, setServicePeriodEnd] = useState<string>("");
  const [serviceDateMode, setServiceDateMode] = useState<"single" | "period">("single");

  // Dropdown-Listen
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Review state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewReason, setReviewReason] = useState<string>("");
  const [reviewingEntry, setReviewingEntry] = useState(false);

  // Import data (original columns from source file)
  const [importData, setImportData] = useState<{
    rawData: Record<string, unknown> | null;
    mappedData: Record<string, unknown> | null;
    sheetName: string | null;
  } | null>(null);

  // Split-Kontext
  const [splitContext, setSplitContext] = useState<{
    isParent: boolean;
    isChild: boolean;
    splitChildren: Array<{
      id: string;
      description: string;
      amountCents: string;
      counterpartyId: string | null;
      locationId: string | null;
      categoryTag: string | null;
      reviewStatus: string;
      note: string | null;
      bookingReference: string | null;
    }>;
    parentEntry: {
      id: string;
      description: string;
      amountCents: string;
      transactionDate: string;
      splitReason: string | null;
    } | null;
    siblings: Array<{
      id: string;
      description: string;
      amountCents: string;
      counterpartyId: string | null;
      locationId: string | null;
    }>;
    breakdownInfo: {
      recipientName: string;
      recipientIban: string;
      purpose: string | null;
      itemIndex: number;
      sourceReference: string;
      sourceDate: string;
      sourceFile: string | null;
    } | null;
  } | null>(null);

  // Transfer Partner
  const [transferPartner, setTransferPartner] = useState<LedgerEntryResponse | null>(null);
  const [unpairingTransfer, setUnpairingTransfer] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [caseRes, entryRes, bankRes, counterpartyRes, locationRes] = await Promise.all([
          fetch(`/api/cases/${id}`, { credentials: 'include' }),
          fetch(`/api/cases/${id}/ledger/${entryId}`, { credentials: 'include' }),
          fetch(`/api/cases/${id}/bank-accounts`, { credentials: 'include' }),
          fetch(`/api/cases/${id}/counterparties`, { credentials: 'include' }),
          fetch(`/api/cases/${id}/locations`, { credentials: 'include' }),
        ]);

        if (caseRes.ok) {
          const data = await caseRes.json();
          setCaseData(data);
        } else {
          setError("Fall nicht gefunden");
          return;
        }

        // Dropdown-Listen laden
        if (bankRes.ok) {
          const data = await bankRes.json();
          setBankAccounts(data.accounts || []);
        }
        if (counterpartyRes.ok) {
          const data = await counterpartyRes.json();
          setCounterparties(data.counterparties || []);
        }
        if (locationRes.ok) {
          const data = await locationRes.json();
          setLocations(data.locations || []);
        }

        if (entryRes.ok) {
          const data = await entryRes.json();
          setEntry(data);
          setFormLegalBucket(data.legalBucket);
          setFormNote(data.note || "");
          setFormDescription(data.description || "");
          // Steuerungsdimensionen initialisieren
          setFormBankAccountId(data.bankAccountId || "");
          setFormCounterpartyId(data.counterpartyId || "");
          setFormLocationId(data.locationId || "");
          setFormSteeringTag(data.steeringTag || "");
          // Matrix-Kategorie initialisieren
          setFormCategoryTag(data.categoryTag || "");
          // Estate Allocation initialisieren
          setFormEstateAllocation(data.estateAllocation || "");
          // Service Date / Period initialisieren
          if (data.serviceDate) {
            setServiceDateMode("single");
            setServiceDate(data.serviceDate.split("T")[0]);
            setServicePeriodStart("");
            setServicePeriodEnd("");
          } else if (data.servicePeriodStart && data.servicePeriodEnd) {
            setServiceDateMode("period");
            setServicePeriodStart(data.servicePeriodStart.split("T")[0]);
            setServicePeriodEnd(data.servicePeriodEnd.split("T")[0]);
            setServiceDate("");
          } else {
            setServiceDateMode("single");
            setServiceDate("");
            setServicePeriodStart("");
            setServicePeriodEnd("");
          }
          // Import-Rohdaten speichern
          if (data.importData) {
            setImportData(data.importData);
          }
          // Split-Kontext speichern
          if (data.splitContext) {
            setSplitContext(data.splitContext);
          }
          // Transfer-Partner laden
          if (data.transferPartnerEntryId) {
            try {
              const partnerRes = await fetch(
                `/api/cases/${id}/ledger/${data.transferPartnerEntryId}`,
                { credentials: 'include' }
              );
              if (partnerRes.ok) {
                const partnerData = await partnerRes.json();
                setTransferPartner(partnerData);
              }
            } catch {
              // Partner nicht ladbar — ignorieren
            }
          }
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
        credentials: "include",
        body: JSON.stringify({
          legalBucket: formLegalBucket,
          note: formNote || null,
          description: formDescription,
          bankAccountId: formBankAccountId || null,
          counterpartyId: formCounterpartyId || null,
          locationId: formLocationId || null,
          steeringTag: formSteeringTag || null,
          // Matrix-Kategorie
          categoryTag: formCategoryTag || null,
          // Estate Allocation - wenn manuell geändert, setze MANUELL als Quelle
          estateAllocation: formEstateAllocation || null,
          allocationSource: formEstateAllocation && formEstateAllocation !== entry?.estateAllocation
            ? "MANUELL"
            : undefined,
          // Service Date (je nach Modus)
          serviceDate: serviceDateMode === "single" && serviceDate ? serviceDate : null,
          servicePeriodStart: serviceDateMode === "period" && servicePeriodStart ? servicePeriodStart : null,
          servicePeriodEnd: serviceDateMode === "period" && servicePeriodEnd ? servicePeriodEnd : null,
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
        credentials: "include",
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

  const handleUnpairTransfer = async () => {
    if (!confirm("Möchten Sie die Umbuchungs-Verknüpfung wirklich aufheben?")) {
      return;
    }

    setUnpairingTransfer(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/cases/${id}/ledger/unpair-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ entryId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Aufheben fehlgeschlagen");
      }

      // Entry neu laden
      const entryRes = await fetch(`/api/cases/${id}/ledger/${entryId}`, {
        credentials: "include",
      });
      if (entryRes.ok) {
        const data = await entryRes.json();
        setEntry(data);
      }
      setTransferPartner(null);
      setSuccessMessage("Umbuchungs-Verknüpfung aufgehoben");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aufheben fehlgeschlagen");
    } finally {
      setUnpairingTransfer(false);
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
        credentials: "include",
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
        credentials: "include",
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

  // Flatten nested rawData structure to show original column names
  const flattenImportData = (rawData: Record<string, unknown>): Array<{ key: string; value: string }> => {
    const result: Array<{ key: string; value: string }> = [];
    const meta = rawData._meta as Record<string, unknown> | undefined;
    const originalHeaders = meta?.originalHeaders as string[] | undefined;

    // Helper to add a key-value pair
    const addEntry = (key: string, value: unknown) => {
      if (value === null || value === undefined || value === '') {
        result.push({ key, value: '' });
      } else if (typeof value === 'object') {
        result.push({ key, value: JSON.stringify(value) });
      } else {
        result.push({ key, value: String(value) });
      }
    };

    // Process nested objects (core, standard, additional) and flatten them
    for (const [section, sectionValue] of Object.entries(rawData)) {
      // Skip meta fields
      if (section.startsWith('_')) continue;

      if (typeof sectionValue === 'object' && sectionValue !== null) {
        // Flatten nested object
        for (const [field, fieldValue] of Object.entries(sectionValue as Record<string, unknown>)) {
          // Try to find original header name (capitalize first letter)
          const originalKey = originalHeaders?.find(h =>
            h.toLowerCase() === field.toLowerCase() ||
            h.toLowerCase().replace(/\s+/g, '') === field.toLowerCase().replace(/\s+/g, '')
          ) || field.charAt(0).toUpperCase() + field.slice(1);
          addEntry(originalKey, fieldValue);
        }
      } else {
        addEntry(section, sectionValue);
      }
    }

    return result;
  };

  // Get sheet name and row number from meta
  const getImportMeta = (rawData: Record<string, unknown>): { sheetName?: string; rowNumber?: number } => {
    const meta = rawData._meta as Record<string, unknown> | undefined;
    return {
      sheetName: meta?.sheetName as string | undefined,
      rowNumber: meta?.rowNumber as number | undefined,
    };
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
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Ledger-Eintrag bearbeiten</h1>
          <ReviewStatusBadge status={entry.reviewStatus} />
        </div>
        <p className="text-[var(--secondary)] mt-1">
          {caseData.caseNumber} - {caseData.debtorName}
        </p>
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

      {/* Transfer-Partner Info */}
      {entry.transferPartnerEntryId && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg">⇄</span>
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Umbuchung</h3>
                {transferPartner ? (
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-gray-600">
                      Gegenbuchung: {transferPartner.description}
                    </span>
                    <span className={`text-sm font-medium ${parseInt(transferPartner.amountCents) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(transferPartner.amountCents)}
                    </span>
                    <Link
                      href={`/admin/cases/${id}/ledger/${transferPartner.id}`}
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      Gegenbuchung öffnen →
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">
                    Gegenbuchung: {entry.transferPartnerEntryId}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleUnpairTransfer}
              disabled={unpairingTransfer}
              className="text-sm text-gray-500 hover:text-red-600 disabled:opacity-50"
            >
              {unpairingTransfer ? "..." : "Verknüpfung aufheben"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Umbuchungen werden in konsolidierten Summen (Matrix, Gesamtübersicht) nicht mitgezählt.
          </p>
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

              {/* Steuerungsdimensionen */}
              <div className="pt-4 border-t border-[var(--border)]">
                <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">Steuerungsdimensionen</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">
                      Bankkonto
                    </label>
                    <select
                      value={formBankAccountId}
                      onChange={(e) => setFormBankAccountId(e.target.value)}
                      className="input-field w-full"
                    >
                      <option value="">-- Nicht zugeordnet --</option>
                      {bankAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.bankName} {acc.iban ? `(${acc.iban.slice(-8)})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">
                      Gegenpartei
                    </label>
                    <select
                      value={formCounterpartyId}
                      onChange={(e) => setFormCounterpartyId(e.target.value)}
                      className="input-field w-full"
                    >
                      <option value="">-- Nicht zugeordnet --</option>
                      {counterparties.map((cp) => (
                        <option key={cp.id} value={cp.id}>
                          {cp.shortName || cp.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">
                      Standort
                    </label>
                    <select
                      value={formLocationId}
                      onChange={(e) => setFormLocationId(e.target.value)}
                      className="input-field w-full"
                    >
                      <option value="">-- Nicht zugeordnet --</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.shortName ? `${loc.shortName} - ${loc.name}` : loc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-[var(--muted)] mb-1">
                      Tag
                    </label>
                    <input
                      type="text"
                      value={formSteeringTag}
                      onChange={(e) => setFormSteeringTag(e.target.value)}
                      className="input-field w-full"
                      placeholder="z.B. TOP_PAYER"
                    />
                  </div>
                </div>
              </div>

              {/* Matrix-Kategorie (categoryTag) */}
              <div className="pt-4 border-t border-[var(--border)]">
                <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">Matrix-Kategorie</h3>

                {/* Vorschlag-Hinweis wenn abweichend */}
                {entry?.suggestedCategoryTag && entry.suggestedCategoryTag !== entry.categoryTag && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 text-sm">💡</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-800">
                          Vorschlag: {CATEGORY_TAG_LABELS[entry.suggestedCategoryTag] || entry.suggestedCategoryTag}
                        </p>
                        {entry.suggestedCategoryTagReason && (
                          <p className="text-xs text-blue-600 mt-0.5">{entry.suggestedCategoryTagReason}</p>
                        )}
                        <button
                          type="button"
                          onClick={() => setFormCategoryTag(entry.suggestedCategoryTag!)}
                          className="mt-1.5 text-xs text-blue-800 hover:text-blue-900 underline font-medium"
                        >
                          Vorschlag übernehmen
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <select
                  value={formCategoryTag}
                  onChange={(e) => setFormCategoryTag(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">-- Nicht zugeordnet --</option>
                  {CATEGORY_TAG_OPTIONS.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.tags.map((tag) => (
                        <option key={tag} value={tag}>
                          {CATEGORY_TAG_LABELS[tag] || tag}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                {/* Source + Note anzeigen */}
                {entry?.categoryTagSource && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${
                      entry.categoryTagSource === 'MANUELL'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : entry.categoryTagSource === 'AUTO'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}>
                      {CATEGORY_TAG_SOURCE_LABELS[entry.categoryTagSource as CategoryTagSource] || entry.categoryTagSource}
                    </span>
                    {entry.categoryTagNote && (
                      <span className="text-[var(--muted)] truncate" title={entry.categoryTagNote}>
                        {entry.categoryTagNote}
                      </span>
                    )}
                  </div>
                )}

                <p className="text-xs text-[var(--muted)] mt-1">
                  Bestimmt die Zeile in der Liquiditätsmatrix
                </p>
              </div>

              {/* Leistungszuordnung (für Alt/Neu-Berechnung) */}
              <div className="pt-4 border-t border-[var(--border)]">
                <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">
                  Leistungszuordnung
                </h3>
                <p className="text-xs text-[var(--muted)] mb-4 bg-blue-50 p-2 rounded border border-blue-100">
                  ℹ️ Das Leistungsdatum bestimmt die Alt-/Neumasse-Zuordnung.
                  Maßgeblich ist, wann die Forderung <strong>entstand</strong>, nicht wann die Zahlung einging.
                </p>

                {/* Vorschlag aus Klassifikationsregel (Phase C) */}
                {entry && (entry.suggestedServiceDate || entry.suggestedServicePeriodStart) && !serviceDate && !servicePeriodStart && (
                  <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <span className="text-purple-600">💡</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-purple-800">
                            Vorschlag aus Klassifikationsregel
                          </p>
                          {entry.suggestedServiceDateRule && (
                            <span className="text-xs font-normal bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                              {entry.suggestedServiceDateRule === "VORMONAT" && "Vormonat (HZV)"}
                              {entry.suggestedServiceDateRule === "SAME_MONTH" && "Gleicher Monat"}
                              {entry.suggestedServiceDateRule === "PREVIOUS_QUARTER" && "Vorquartal (KV)"}
                            </span>
                          )}
                          {(entry as LedgerEntryResponse & { suggestedRuleId?: string }).suggestedRuleId && (
                            <Link
                              href={`/admin/cases/${id}/rules?highlight=${(entry as LedgerEntryResponse & { suggestedRuleId?: string }).suggestedRuleId}`}
                              className="text-xs text-purple-600 hover:text-purple-800 underline"
                            >
                              Regel anzeigen →
                            </Link>
                          )}
                        </div>
                        <p className="text-sm text-purple-700 mt-1">
                          {entry.suggestedServiceDate && (
                            <>Leistungsdatum: <strong>{new Date(entry.suggestedServiceDate).toLocaleDateString("de-DE")}</strong></>
                          )}
                          {entry.suggestedServicePeriodStart && entry.suggestedServicePeriodEnd && (
                            <>Leistungszeitraum: <strong>{new Date(entry.suggestedServicePeriodStart).toLocaleDateString("de-DE")} - {new Date(entry.suggestedServicePeriodEnd).toLocaleDateString("de-DE")}</strong></>
                          )}
                        </p>
                        {(entry as LedgerEntryResponse & { suggestedReason?: string }).suggestedReason && (
                          <p className="text-xs text-purple-600 mt-1">
                            {(entry as LedgerEntryResponse & { suggestedReason?: string }).suggestedReason}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (entry.suggestedServiceDate) {
                              setServiceDateMode("single");
                              setServiceDate(entry.suggestedServiceDate.split("T")[0]);
                              setServicePeriodStart("");
                              setServicePeriodEnd("");
                            } else if (entry.suggestedServicePeriodStart && entry.suggestedServicePeriodEnd) {
                              setServiceDateMode("period");
                              setServicePeriodStart(entry.suggestedServicePeriodStart.split("T")[0]);
                              setServicePeriodEnd(entry.suggestedServicePeriodEnd.split("T")[0]);
                              setServiceDate("");
                            }
                          }}
                          className="mt-2 text-xs text-purple-800 hover:text-purple-900 underline font-medium"
                        >
                          Vorschlag übernehmen
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modus-Auswahl: Einzeldatum oder Zeitraum */}
                <div className="space-y-3 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="serviceDateMode"
                      checked={serviceDateMode === "single"}
                      onChange={() => {
                        setServiceDateMode("single");
                        setServicePeriodStart("");
                        setServicePeriodEnd("");
                      }}
                      className="w-4 h-4 text-[var(--primary)]"
                    />
                    <span className="text-sm text-[var(--foreground)]">Einzelnes Leistungsdatum</span>
                  </label>
                  {serviceDateMode === "single" && (
                    <div className="ml-6">
                      <input
                        type="date"
                        value={serviceDate}
                        onChange={(e) => setServiceDate(e.target.value)}
                        className="input-field w-48"
                      />
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="serviceDateMode"
                      checked={serviceDateMode === "period"}
                      onChange={() => {
                        setServiceDateMode("period");
                        setServiceDate("");
                      }}
                      className="w-4 h-4 text-[var(--primary)]"
                    />
                    <span className="text-sm text-[var(--foreground)]">Leistungszeitraum</span>
                  </label>
                  {serviceDateMode === "period" && (
                    <div className="ml-6 flex items-center gap-2">
                      <input
                        type="date"
                        value={servicePeriodStart}
                        onChange={(e) => setServicePeriodStart(e.target.value)}
                        className="input-field w-40"
                        placeholder="Von"
                      />
                      <span className="text-[var(--muted)]">bis</span>
                      <input
                        type="date"
                        value={servicePeriodEnd}
                        onChange={(e) => setServicePeriodEnd(e.target.value)}
                        className="input-field w-40"
                        placeholder="Bis"
                      />
                    </div>
                  )}
                </div>

                {/* Hinweis zur aktuellen Zuordnung */}
                {(serviceDate || (servicePeriodStart && servicePeriodEnd)) && (
                  <p className="text-xs text-green-700 bg-green-50 p-2 rounded border border-green-100">
                    Nach dem Speichern wird die Alt/Neu-Zuordnung automatisch berechnet.
                  </p>
                )}
              </div>

              {/* Massezuordnung (Alt/Neu) */}
              <div className="pt-4 border-t border-[var(--border)]">
                <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">
                  Massezuordnung (Alt/Neu)
                </h3>

                {/* Aktuelle Zuordnung anzeigen */}
                {entry && (entry as LedgerEntryResponse & { estateAllocation?: string; allocationSource?: string; allocationNote?: string }).estateAllocation && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-[var(--muted)]">Aktuell:</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        ESTATE_ALLOCATION_BADGE_CLASSES[(entry as LedgerEntryResponse & { estateAllocation?: string }).estateAllocation || ''] || 'badge-neutral'
                      }`}>
                        {ESTATE_ALLOCATION_OPTIONS.find(o => o.value === (entry as LedgerEntryResponse & { estateAllocation?: string }).estateAllocation)?.label || (entry as LedgerEntryResponse & { estateAllocation?: string }).estateAllocation}
                      </span>
                    </div>
                    {(entry as LedgerEntryResponse & { allocationSource?: string }).allocationSource && (
                      <p className="text-xs text-[var(--muted)]">
                        <span className="font-medium">Quelle:</span>{' '}
                        {ALLOCATION_SOURCE_LABELS[(entry as LedgerEntryResponse & { allocationSource?: string }).allocationSource || ''] || (entry as LedgerEntryResponse & { allocationSource?: string }).allocationSource}
                      </p>
                    )}
                    {(entry as LedgerEntryResponse & { allocationNote?: string }).allocationNote && (
                      <p className="text-xs text-[var(--muted)] mt-1">
                        <span className="font-medium">Begründung:</span>{' '}
                        {(entry as LedgerEntryResponse & { allocationNote?: string }).allocationNote}
                      </p>
                    )}
                  </div>
                )}

                {/* Manuelles Setzen */}
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">
                    Massezuordnung ändern
                  </label>
                  <select
                    value={formEstateAllocation}
                    onChange={(e) => setFormEstateAllocation(e.target.value as EstateAllocationType)}
                    className="input-field w-full"
                  >
                    {ESTATE_ALLOCATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    {(entry as LedgerEntryResponse & { estateAllocation?: string })?.estateAllocation === 'UNKLAR'
                      ? '⚠️ Automatische Zuordnung war nicht möglich - bitte manuell prüfen'
                      : 'Manuelle Änderung überschreibt automatische Zuordnung'
                    }
                  </p>
                </div>
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

          {/* Original Import Data - Flat display like Excel columns */}
          {importData?.rawData && Object.keys(importData.rawData).length > 0 && (
            <div className="admin-card p-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Original-Daten aus Import
              </h2>
              {(() => {
                const meta = getImportMeta(importData.rawData);
                const flatData = flattenImportData(importData.rawData);
                return (
                  <>
                    <div className="flex items-center gap-4 text-sm text-[var(--muted)] mb-4">
                      {meta.sheetName && (
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          Blatt: {meta.sheetName}
                        </span>
                      )}
                      {meta.rowNumber && (
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          Zeile {meta.rowNumber}
                        </span>
                      )}
                    </div>
                    <div className="bg-gray-50 rounded-lg border border-[var(--border)] overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-[var(--foreground)] w-1/3">Spalte</th>
                            <th className="px-4 py-2 text-left font-medium text-[var(--foreground)]">Wert</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {flatData.map(({ key, value }, idx) => (
                            <tr key={idx} className="hover:bg-white">
                              <td className="px-4 py-2 font-medium text-[var(--secondary)]">{key}</td>
                              <td className="px-4 py-2 text-[var(--foreground)]">
                                {value === '' ? (
                                  <span className="text-[var(--muted)] italic">–</span>
                                ) : value.length > 200 ? (
                                  <div className="max-h-24 overflow-auto text-xs whitespace-pre-wrap bg-white p-2 rounded border">
                                    {value}
                                  </div>
                                ) : (
                                  <span className="whitespace-pre-wrap">{value}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-3">
                      Diese Spalten stammen aus der Original-Importdatei. Nutze sie für die Regelerstellung und Zuordnung.
                    </p>
                  </>
                );
              })()}
            </div>
          )}
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

          {/* Split-Kontext Section */}
          {splitContext && (splitContext.isParent || splitContext.isChild) && (
            <div className="admin-card p-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Split-Kontext</h2>

              {/* Entry ist Parent (Sammelüberweisung) */}
              {splitContext.isParent && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                      Sammelüberweisung
                    </span>
                    <span className="text-sm text-[var(--muted)]">
                      {splitContext.splitChildren.length} Einzelposten
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {splitContext.splitChildren.map(child => {
                      const childAmount = parseInt(child.amountCents);
                      return (
                        <Link
                          key={child.id}
                          href={`/admin/cases/${id}/ledger/${child.id}`}
                          className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 transition-colors group text-sm"
                        >
                          <span className="truncate flex-1 mr-2 text-[var(--foreground)] group-hover:text-blue-600">
                            {child.description}
                          </span>
                          <span className={`font-mono text-xs whitespace-nowrap ${childAmount >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                            {formatCurrency(child.amountCents)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>

                  {/* Summenprüfung */}
                  {(() => {
                    const childrenSum = splitContext.splitChildren.reduce((sum, c) => sum + parseInt(c.amountCents), 0);
                    const parentAmount = parseInt(entry.amountCents);
                    const matches = childrenSum === parentAmount;
                    return (
                      <div className={`flex items-center justify-between pt-2 border-t border-[var(--border)] text-sm ${matches ? 'text-green-700' : 'text-red-600'}`}>
                        <span>Summe {matches ? 'stimmt' : 'weicht ab'}: {formatCurrency(childrenSum.toString())}</span>
                        <span>{matches ? '✓' : '✗'}</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Entry ist Child (Einzelposten) */}
              {splitContext.isChild && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                      Einzelposten
                    </span>
                  </div>

                  {/* Parent-Link */}
                  {splitContext.parentEntry && (
                    <div className="space-y-1">
                      <p className="text-xs text-[var(--muted)]">Aus Sammelüberweisung:</p>
                      <Link
                        href={`/admin/cases/${id}/ledger/${splitContext.parentEntry.id}`}
                        className="flex items-center justify-between py-2 px-3 rounded bg-gray-50 hover:bg-gray-100 transition-colors text-sm"
                      >
                        <div className="truncate mr-2">
                          <span className="font-medium text-[var(--foreground)]">{splitContext.parentEntry.description}</span>
                          <span className="text-xs text-[var(--muted)] ml-2">
                            (Posten {splitContext.breakdownInfo ? splitContext.breakdownInfo.itemIndex + 1 : '?'}/{splitContext.siblings.length + 1})
                          </span>
                        </div>
                        <span className={`font-mono text-xs whitespace-nowrap ${parseInt(splitContext.parentEntry.amountCents) >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                          {formatCurrency(splitContext.parentEntry.amountCents)}
                        </span>
                      </Link>
                    </div>
                  )}

                  {/* Zahlbeleg-Herkunft */}
                  {splitContext.breakdownInfo && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-[var(--foreground)]">Zahlbeleg-Herkunft</p>
                      <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
                        <div className="flex gap-2">
                          <span className="text-[var(--muted)] min-w-[60px]">Referenz:</span>
                          <span className="font-mono text-[var(--foreground)]">{splitContext.breakdownInfo.sourceReference}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-[var(--muted)] min-w-[60px]">Datum:</span>
                          <span className="text-[var(--foreground)]">{formatDate(splitContext.breakdownInfo.sourceDate)}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-[var(--muted)] min-w-[60px]">IBAN:</span>
                          <span className="font-mono text-xs text-[var(--foreground)]">{splitContext.breakdownInfo.recipientIban}</span>
                        </div>
                        {splitContext.breakdownInfo.purpose && (
                          <div className="flex gap-2">
                            <span className="text-[var(--muted)] min-w-[60px]">Zweck:</span>
                            <span className="text-[var(--foreground)]">{splitContext.breakdownInfo.purpose}</span>
                          </div>
                        )}
                        {splitContext.breakdownInfo.sourceFile && (
                          <div className="flex gap-2">
                            <span className="text-[var(--muted)] min-w-[60px]">Datei:</span>
                            <span className="text-xs text-[var(--secondary)]">{splitContext.breakdownInfo.sourceFile}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Geschwister-Liste */}
                  {splitContext.siblings.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-[var(--foreground)]">Geschwister ({splitContext.siblings.length})</p>
                      <div className="space-y-1">
                        {splitContext.siblings.map(sib => {
                          const sibAmount = parseInt(sib.amountCents);
                          return (
                            <Link
                              key={sib.id}
                              href={`/admin/cases/${id}/ledger/${sib.id}`}
                              className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50 transition-colors group text-sm"
                            >
                              <span className="truncate flex-1 mr-2 text-[var(--secondary)] group-hover:text-blue-600">
                                {sib.description}
                              </span>
                              <span className={`font-mono text-xs whitespace-nowrap ${sibAmount >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                {formatCurrency(sib.amountCents)}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Classification Suggestion (if available) */}
          {(entry as LedgerEntryResponse & { suggestedLegalBucket?: string; suggestedConfidence?: number; suggestedReason?: string }).suggestedLegalBucket && (
            <div className="admin-card p-6 bg-purple-50 border-purple-200">
              <h2 className="text-lg font-semibold text-purple-800 mb-4">Klassifikations-Vorschlag</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-purple-600">Vorgeschlagen:</span>
                  <span className="font-semibold text-purple-800">
                    {(entry as LedgerEntryResponse & { suggestedLegalBucket?: string }).suggestedLegalBucket}
                  </span>
                </div>
                {(entry as LedgerEntryResponse & { suggestedConfidence?: number }).suggestedConfidence && (
                  <div className="flex items-center gap-2">
                    <span className="text-purple-600">Konfidenz:</span>
                    <div className="flex-1 bg-purple-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-purple-600 h-full"
                        style={{ width: `${Math.round((entry as LedgerEntryResponse & { suggestedConfidence?: number }).suggestedConfidence! * 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-purple-800">
                      {Math.round((entry as LedgerEntryResponse & { suggestedConfidence?: number }).suggestedConfidence! * 100)}%
                    </span>
                  </div>
                )}
                {(entry as LedgerEntryResponse & { suggestedReason?: string }).suggestedReason && (
                  <div>
                    <span className="text-purple-600">Begründung:</span>
                    <p className="text-purple-800 mt-1 text-xs italic">
                      {(entry as LedgerEntryResponse & { suggestedReason?: string }).suggestedReason}
                    </p>
                  </div>
                )}
                {entry.reviewStatus === REVIEW_STATUS.UNREVIEWED && (
                  <div className="pt-3 border-t border-purple-200">
                    <button
                      onClick={() => {
                        setFormLegalBucket((entry as LedgerEntryResponse & { suggestedLegalBucket?: string }).suggestedLegalBucket as LegalBucket);
                      }}
                      className="text-sm text-purple-700 hover:text-purple-900 underline"
                    >
                      Vorschlag übernehmen
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rule erstellen */}
          <div className="admin-card p-6 bg-blue-50 border-blue-200">
            <h2 className="text-lg font-semibold text-blue-800 mb-3">Regel erstellen</h2>
            <p className="text-sm text-blue-700 mb-4">
              Erstelle eine Klassifikationsregel basierend auf diesem Eintrag.
            </p>
            <Link
              href={`/admin/cases/${id}/rules?createFrom=${encodeURIComponent(entry.description)}&suggestBucket=${formLegalBucket}`}
              className="w-full btn-secondary bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300 flex items-center justify-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Regel aus Beschreibung erstellen
            </Link>
            <p className="text-xs text-blue-600 mt-2">
              Pattern: &ldquo;{entry.description.substring(0, 30)}{entry.description.length > 30 ? "..." : ""}&rdquo;
            </p>
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
              {entry.reviewedBy && (
                <div>
                  <p className="text-[var(--muted)]">Geprüft von</p>
                  <p className="text-[var(--foreground)]">{entry.reviewedBy}</p>
                </div>
              )}
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
