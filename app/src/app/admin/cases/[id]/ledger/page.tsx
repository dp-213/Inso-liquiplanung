"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  VALUE_TYPES,
  LEGAL_BUCKETS,
  ValueType,
  LegalBucket,
  LedgerEntryResponse,
  ReviewStatus,
  REVIEW_STATUS,
} from "@/lib/ledger";

type TabType = "all" | "review" | "rules";

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

const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  UNREVIEWED: "Ungeprüft",
  CONFIRMED: "Bestätigt",
  ADJUSTED: "Korrigiert",
};

// Estate Allocation (Alt-/Neumasse)
type EstateAllocation = "ALTMASSE" | "NEUMASSE" | "MIXED" | "UNKLAR" | "";
const ESTATE_ALLOCATION_LABELS: Record<string, string> = {
  ALTMASSE: "Altmasse",
  NEUMASSE: "Neumasse",
  MIXED: "Gemischt",
  UNKLAR: "Unklar",
};

interface CaseData {
  id: string;
  caseNumber: string;
  debtorName: string;
  status: string;
}

interface LedgerStats {
  totalCount: number;
  totalInflows: string;
  totalOutflows: string;
  netAmount: string;
}

interface ClassificationStats {
  byReviewStatus: Record<string, number>;
  classification: {
    withSuggestion: number;
    withoutSuggestion: number;
    byLegalBucket: Record<string, number>;
  };
}

interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
}

interface Counterparty {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
}

interface ImportJob {
  importJobId: string;
  importSource: string | null;
  entryCount: number;
  totalAmountCents: string;
  firstEntryDate: string;
  lastEntryDate: string;
  createdAt: string;
}

export default function CaseLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as TabType | null;
  const activeTab: TabType = tabParam === "review" || tabParam === "rules" ? tabParam : "all";

  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [entries, setEntries] = useState<LedgerEntryResponse[]>([]);
  const [stats, setStats] = useState<LedgerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [classificationStats, setClassificationStats] = useState<ClassificationStats | null>(null);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "grouped">("table");

  // Dimensions für Name-Lookup
  const [bankAccountsMap, setBankAccountsMap] = useState<Map<string, string>>(new Map());
  const [counterpartiesMap, setCounterpartiesMap] = useState<Map<string, string>>(new Map());
  const [locationsMap, setLocationsMap] = useState<Map<string, string>>(new Map());
  const [bankAccountsList, setBankAccountsList] = useState<BankAccount[]>([]);
  const [counterpartiesList, setCounterpartiesList] = useState<Counterparty[]>([]);
  const [locationsList, setLocationsList] = useState<Location[]>([]);
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [deletingImport, setDeletingImport] = useState<string | null>(null);

  // Tab switching
  const setActiveTab = (tab: TabType) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "all") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    router.push(`/admin/cases/${id}/ledger${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
  };

  // Filter state - review tab auto-sets reviewStatus filter
  const [filterValueType, setFilterValueType] = useState<ValueType | "">("");
  const [filterLegalBucket, setFilterLegalBucket] = useState<LegalBucket | "">("");
  const [filterReviewStatus, setFilterReviewStatus] = useState<ReviewStatus | "">("");
  const [filterSuggestedBucket, setFilterSuggestedBucket] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  // Dimensions-Filter
  const [filterBankAccountId, setFilterBankAccountId] = useState<string>("");
  const [filterCounterpartyId, setFilterCounterpartyId] = useState<string>("");
  const [filterLocationId, setFilterLocationId] = useState<string>("");
  // Import-Filter
  const [filterImportJobId, setFilterImportJobId] = useState<string>("");
  // Estate Allocation Filter (Alt-/Neumasse)
  const [filterEstateAllocation, setFilterEstateAllocation] = useState<EstateAllocation>("");

  // Auto-set review filter when tab changes
  useEffect(() => {
    if (activeTab === "review") {
      setFilterReviewStatus("UNREVIEWED");
    } else if (filterReviewStatus === "UNREVIEWED" && activeTab === "all") {
      // Clear the auto-set filter when switching back to "all"
      setFilterReviewStatus("");
    }
  }, [activeTab]);

  // Sort state
  type SortField = "transactionDate" | "description" | "amountCents" | "valueType" | "legalBucket" | "reviewStatus";
  const [sortBy, setSortBy] = useState<SortField>("transactionDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Build query params
      const queryParams = new URLSearchParams();
      if (filterValueType) queryParams.set("valueType", filterValueType);
      if (filterLegalBucket) queryParams.set("legalBucket", filterLegalBucket);
      if (filterReviewStatus) queryParams.set("reviewStatus", filterReviewStatus);
      if (filterSuggestedBucket) queryParams.set("suggestedLegalBucket", filterSuggestedBucket);
      if (filterFrom) queryParams.set("from", filterFrom);
      if (filterTo) queryParams.set("to", filterTo);
      // Dimensions-Filter
      if (filterBankAccountId) queryParams.set("bankAccountId", filterBankAccountId);
      if (filterCounterpartyId) queryParams.set("counterpartyId", filterCounterpartyId);
      if (filterLocationId) queryParams.set("locationId", filterLocationId);
      // Import-Filter
      if (filterImportJobId) queryParams.set("importJobId", filterImportJobId);
      // Estate Allocation Filter
      if (filterEstateAllocation) queryParams.set("estateAllocation", filterEstateAllocation);

      const queryString = queryParams.toString();
      const url = `/api/cases/${id}/ledger${queryString ? `?${queryString}` : ""}`;

      const [caseRes, ledgerRes, intakeRes, bankRes, counterpartyRes, locationRes, importJobsRes] = await Promise.all([
        fetch(`/api/cases/${id}`, { credentials: 'include' }),
        fetch(url, { credentials: 'include' }),
        fetch(`/api/cases/${id}/intake`, { credentials: 'include' }),
        fetch(`/api/cases/${id}/bank-accounts`, { credentials: 'include' }),
        fetch(`/api/cases/${id}/counterparties`, { credentials: 'include' }),
        fetch(`/api/cases/${id}/locations`, { credentials: 'include' }),
        fetch(`/api/cases/${id}/import-jobs`, { credentials: 'include' }),
      ]);

      if (caseRes.ok) {
        const data = await caseRes.json();
        setCaseData(data);
      } else {
        const errorData = await caseRes.json().catch(() => ({}));
        if (caseRes.status === 401) {
          setError("Nicht angemeldet - bitte neu einloggen");
        } else if (caseRes.status === 404) {
          setError("Fall nicht gefunden");
        } else {
          setError(errorData.error || `Fehler: ${caseRes.status}`);
        }
        return;
      }

      if (ledgerRes.ok) {
        const data = await ledgerRes.json();
        setEntries(data.entries || []);
        setStats({
          totalCount: data.totalCount || 0,
          totalInflows: data.totalInflows || "0",
          totalOutflows: data.totalOutflows || "0",
          netAmount: data.netAmount || "0",
        });
      } else {
        setError("Fehler beim Laden der Ledger-Einträge");
      }

      // Lade Klassifikations-Statistiken
      if (intakeRes.ok) {
        const intakeData = await intakeRes.json();
        setClassificationStats(intakeData);
      }

      // Lade Dimensionen für Name-Lookup
      if (bankRes.ok) {
        const data = await bankRes.json();
        const accounts = data.accounts || [];
        setBankAccountsList(accounts);
        const map = new Map<string, string>();
        accounts.forEach((acc: BankAccount) => map.set(acc.id, `${acc.bankName} - ${acc.accountName}`));
        setBankAccountsMap(map);
      }
      if (counterpartyRes.ok) {
        const data = await counterpartyRes.json();
        const cps = data.counterparties || [];
        setCounterpartiesList(cps);
        const map = new Map<string, string>();
        cps.forEach((cp: Counterparty) => map.set(cp.id, cp.name));
        setCounterpartiesMap(map);
      }
      if (locationRes.ok) {
        const data = await locationRes.json();
        const locs = data.locations || [];
        setLocationsList(locs);
        const map = new Map<string, string>();
        locs.forEach((loc: Location) => map.set(loc.id, loc.name));
        setLocationsMap(map);
      }
      if (importJobsRes.ok) {
        const data = await importJobsRes.json();
        setImportJobs(data.importJobs || []);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  }, [id, filterValueType, filterLegalBucket, filterReviewStatus, filterSuggestedBucket, filterFrom, filterTo, filterBankAccountId, filterCounterpartyId, filterLocationId, filterImportJobId, filterEstateAllocation]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const getBucketBadgeClass = (bucket: LegalBucket): string => {
    switch (bucket) {
      case "MASSE":
        return "badge-success";
      case "ABSONDERUNG":
        return "badge-warning";
      case "NEUTRAL":
        return "badge-info";
      case "UNKNOWN":
      default:
        return "badge-neutral";
    }
  };

  const getValueTypeBadgeClass = (valueType: ValueType): string => {
    return valueType === "IST" ? "badge-success" : "badge-info";
  };

  const clearFilters = () => {
    setFilterValueType("");
    setFilterLegalBucket("");
    setFilterReviewStatus("");
    setFilterSuggestedBucket("");
    setFilterFrom("");
    setFilterTo("");
    setFilterBankAccountId("");
    setFilterCounterpartyId("");
    setFilterLocationId("");
    setFilterImportJobId("");
    setFilterEstateAllocation("");
  };

  const hasActiveFilters = filterValueType || filterLegalBucket || filterReviewStatus || filterSuggestedBucket || filterFrom || filterTo || filterBankAccountId || filterCounterpartyId || filterLocationId || filterImportJobId || filterEstateAllocation;

  // Bulk Actions
  const handleBulkConfirm = async (filter?: { suggestedLegalBucket?: string; minConfidence?: number }) => {
    setBulkProcessing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const body: Record<string, unknown> = {
        action: "CONFIRM",
        note: "Bulk-Bestätigung",
      };

      if (filter) {
        body.filter = {
          reviewStatus: "UNREVIEWED",
          ...filter,
        };
      } else if (selectedEntries.size > 0) {
        body.entryIds = Array.from(selectedEntries);
      } else {
        setError("Keine Einträge ausgewählt");
        return;
      }

      const res = await fetch(`/api/cases/${id}/ledger/bulk-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Bulk-Bestätigung fehlgeschlagen");
      }

      setSuccessMessage(data.message || `${data.processed} Einträge bestätigt`);
      setSelectedEntries(new Set());
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk-Bestätigung fehlgeschlagen");
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleApplyClassification = async (suggestedLegalBucket: string) => {
    setBulkProcessing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/cases/${id}/ledger/bulk-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "ADJUST",
          filter: {
            reviewStatus: "UNREVIEWED",
            suggestedLegalBucket,
          },
          reason: `Klassifikation "${suggestedLegalBucket}" übernommen`,
          applyClassificationSuggestions: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Klassifikations-Übernahme fehlgeschlagen");
      }

      setSuccessMessage(data.message || `${data.processed} Einträge klassifiziert`);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Klassifikations-Übernahme fehlgeschlagen");
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleApplyDimensionSuggestions = async () => {
    setBulkProcessing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/cases/${id}/ledger/bulk-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "ADJUST",
          filter: {
            reviewStatus: "UNREVIEWED",
          },
          reason: "Dimensions-Vorschläge übernommen",
          applyDimensionSuggestions: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Dimensions-Übernahme fehlgeschlagen");
      }

      setSuccessMessage(data.message || `${data.processed} Einträge mit Dimensionen aktualisiert`);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dimensions-Übernahme fehlgeschlagen");
    } finally {
      setBulkProcessing(false);
    }
  };

  // Delete Import Job
  const handleDeleteImport = async (importJobId: string, importSource: string | null) => {
    if (!confirm(`Möchten Sie wirklich alle Einträge aus dem Import "${importSource || importJobId}" löschen?`)) {
      return;
    }

    setDeletingImport(importJobId);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/cases/${id}/import-jobs/${encodeURIComponent(importJobId)}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Löschen fehlgeschlagen");
      }

      setSuccessMessage(data.message);
      // Clear import filter if we just deleted the filtered import
      if (filterImportJobId === importJobId) {
        setFilterImportJobId("");
      }
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    } finally {
      setDeletingImport(null);
    }
  };

  const toggleEntrySelection = (entryId: string) => {
    const newSelected = new Set(selectedEntries);
    if (newSelected.has(entryId)) {
      newSelected.delete(entryId);
    } else {
      newSelected.add(entryId);
    }
    setSelectedEntries(newSelected);
  };

  const toggleAllEntries = () => {
    if (selectedEntries.size === entries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(entries.map((e) => e.id)));
    }
  };

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  // Sort entries
  const sortedEntries = [...entries].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "transactionDate":
        comparison = new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime();
        break;
      case "description":
        comparison = a.description.localeCompare(b.description, "de");
        break;
      case "amountCents":
        comparison = parseInt(a.amountCents) - parseInt(b.amountCents);
        break;
      case "valueType":
        comparison = a.valueType.localeCompare(b.valueType);
        break;
      case "legalBucket":
        comparison = a.legalBucket.localeCompare(b.legalBucket);
        break;
      case "reviewStatus":
        comparison = a.reviewStatus.localeCompare(b.reviewStatus);
        break;
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  // Sort header component
  const SortHeader = ({ field, label, className = "" }: { field: SortField; label: string; className?: string }) => (
    <th
      className={`cursor-pointer hover:bg-gray-100 select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className="text-[var(--muted)]">
          {sortBy === field ? (
            sortOrder === "asc" ? "↑" : "↓"
          ) : (
            <span className="opacity-30">↕</span>
          )}
        </span>
      </div>
    </th>
  );

  const getReviewStatusBadgeClass = (status: ReviewStatus): string => {
    switch (status) {
      case "CONFIRMED":
        return "badge-success";
      case "ADJUSTED":
        return "badge-warning";
      case "UNREVIEWED":
      default:
        return "badge-neutral";
    }
  };

  const getConfidenceBadgeClass = (confidence: number | null): string => {
    if (!confidence) return "badge-neutral";
    if (confidence >= 0.8) return "badge-success";
    if (confidence >= 0.5) return "badge-warning";
    return "badge-danger";
  };

  const getEstateAllocationBadgeClass = (allocation: string | null): string => {
    switch (allocation) {
      case "ALTMASSE":
        return "bg-amber-100 text-amber-800";
      case "NEUMASSE":
        return "bg-green-100 text-green-800";
      case "MIXED":
        return "bg-purple-100 text-purple-800";
      case "UNKLAR":
        return "bg-red-100 text-red-800";
      default:
        return "badge-neutral";
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/cases/${id}/ledger/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Synchronisation fehlgeschlagen");
      }

      setSuccessMessage(data.message || "Synchronisation erfolgreich");
      fetchData(); // Refresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : "Synchronisation fehlgeschlagen");
    } finally {
      setSyncing(false);
    }
  };

  if (loading && !caseData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <p className="text-[var(--danger)]">{error || "Fall nicht gefunden"}</p>
          <Link href="/admin/cases" className="btn-secondary mt-4 inline-block">
            Zurück zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

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
        <span className="text-[var(--foreground)]">Zahlungsregister</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Zahlungsregister</h1>
          <p className="text-[var(--secondary)] mt-1">
            {caseData.caseNumber} - {caseData.debtorName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-secondary flex items-center disabled:opacity-50"
            title="PeriodValues aus Ledger-Einträgen neu berechnen"
          >
            <svg className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? "Synchronisiere..." : "Aggregation sync"}
          </button>
          <Link href={`/admin/cases/${id}`} className="btn-secondary">
            Zurück zum Fall
          </Link>
          <Link href={`/admin/cases/${id}/results`} className="btn-primary flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Dashboard
          </Link>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="admin-card p-1">
        <nav className="flex gap-1">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "all"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--secondary)] hover:bg-gray-100"
            }`}
          >
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Alle Einträge
            </span>
          </button>
          <button
            onClick={() => setActiveTab("review")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "review"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--secondary)] hover:bg-gray-100"
            }`}
          >
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Zur Prüfung
              {classificationStats?.byReviewStatus?.UNREVIEWED ? (
                <span className="ml-2 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                  {classificationStats.byReviewStatus.UNREVIEWED}
                </span>
              ) : null}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("rules")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "rules"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--secondary)] hover:bg-gray-100"
            }`}
          >
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Regeln
            </span>
          </button>
        </nav>
      </div>

      {/* Rules Tab Content */}
      {activeTab === "rules" && (
        <div className="admin-card p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium">Klassifikationsregeln</p>
                <p className="mt-1">
                  Regeln werden automatisch auf neue Ledger-Einträge angewendet und erzeugen Klassifikations-Vorschläge.
                </p>
              </div>
            </div>
            <Link
              href={`/admin/cases/${id}/rules`}
              className="btn-primary flex items-center text-sm"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Regeln verwalten
            </Link>
          </div>
        </div>
      )}

      {/* Stats Cards - only show for non-rules tabs */}
      {activeTab !== "rules" && stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="admin-card p-4">
            <p className="text-sm text-[var(--muted)]">Anzahl Einträge</p>
            <p className="text-2xl font-bold text-[var(--foreground)]">{stats.totalCount}</p>
          </div>
          <div className="admin-card p-4">
            <p className="text-sm text-[var(--muted)]">Einzahlungen</p>
            <p className="text-2xl font-bold text-[var(--success)]">
              {formatCurrency(stats.totalInflows)}
            </p>
          </div>
          <div className="admin-card p-4">
            <p className="text-sm text-[var(--muted)]">Auszahlungen</p>
            <p className="text-2xl font-bold text-[var(--danger)]">
              {formatCurrency(stats.totalOutflows)}
            </p>
          </div>
          <div className="admin-card p-4">
            <p className="text-sm text-[var(--muted)]">Netto</p>
            <p className={`text-2xl font-bold ${
              parseInt(stats.netAmount) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
            }`}>
              {formatCurrency(stats.netAmount)}
            </p>
          </div>
        </div>
      )}

      {/* Review Status Cards */}
      {classificationStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="admin-card p-4 border-l-4 border-gray-400">
            <p className="text-sm text-[var(--muted)]">Ungeprüft</p>
            <p className="text-2xl font-bold text-[var(--foreground)]">
              {classificationStats.byReviewStatus?.UNREVIEWED || 0}
            </p>
            {classificationStats.classification?.withSuggestion > 0 && (
              <p className="text-xs text-[var(--secondary)] mt-1">
                {classificationStats.classification.withSuggestion} mit Vorschlag
              </p>
            )}
          </div>
          <div className="admin-card p-4 border-l-4 border-green-500">
            <p className="text-sm text-[var(--muted)]">Bestätigt</p>
            <p className="text-2xl font-bold text-[var(--success)]">
              {classificationStats.byReviewStatus?.CONFIRMED || 0}
            </p>
          </div>
          <div className="admin-card p-4 border-l-4 border-amber-500">
            <p className="text-sm text-[var(--muted)]">Korrigiert</p>
            <p className="text-2xl font-bold text-amber-600">
              {classificationStats.byReviewStatus?.ADJUSTED || 0}
            </p>
          </div>
          <div className="admin-card p-4 border-l-4 border-purple-500">
            <p className="text-sm text-[var(--muted)]">Klassifikation</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(classificationStats.classification?.byLegalBucket || {}).map(([bucket, count]) => (
                bucket !== "null" && (
                  <span key={bucket} className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                    {bucket}: {count}
                  </span>
                )
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Import Jobs Overview */}
      {importJobs.length > 0 && (
        <div className="admin-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-[var(--foreground)]">
              Daten-Importe ({importJobs.length})
            </h3>
          </div>
          <div className="space-y-2">
            {importJobs.map((job) => {
              const importDate = new Date(job.createdAt);
              const isFiltered = filterImportJobId === job.importJobId;
              return (
                <div
                  key={job.importJobId}
                  className={`flex items-center justify-between p-3 rounded-md border ${
                    isFiltered ? "bg-blue-50 border-blue-300" : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-medium text-sm text-[var(--foreground)]">
                        {job.importSource || job.importJobId.slice(0, 8) + "..."}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {importDate.toLocaleDateString("de-DE")} {importDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} • {job.entryCount} Einträge
                      </div>
                    </div>
                    <span className="text-xs text-[var(--muted)]">
                      {formatDate(job.firstEntryDate)} – {formatDate(job.lastEntryDate)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFilterImportJobId(isFiltered ? "" : job.importJobId)}
                      className={`text-xs px-2 py-1 rounded ${
                        isFiltered
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      {isFiltered ? "Filter aktiv" : "Filtern"}
                    </button>
                    <button
                      onClick={() => handleDeleteImport(job.importJobId, job.importSource)}
                      disabled={deletingImport === job.importJobId}
                      className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                    >
                      {deletingImport === job.importJobId ? "Lösche..." : "Löschen"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {classificationStats && (classificationStats.byReviewStatus?.UNREVIEWED || 0) > 0 && (
        <div className="admin-card p-4 bg-blue-50 border-blue-200">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-blue-800">Bulk-Aktionen:</span>

            {classificationStats.classification?.byLegalBucket?.MASSE && (
              <button
                onClick={() => handleApplyClassification("MASSE")}
                disabled={bulkProcessing}
                className="btn-secondary text-sm bg-white disabled:opacity-50"
              >
                MASSE bestätigen ({classificationStats.classification.byLegalBucket.MASSE})
              </button>
            )}

            {classificationStats.classification?.byLegalBucket?.ABSONDERUNG && (
              <button
                onClick={() => handleApplyClassification("ABSONDERUNG")}
                disabled={bulkProcessing}
                className="btn-secondary text-sm bg-white disabled:opacity-50"
              >
                ABSONDERUNG bestätigen ({classificationStats.classification.byLegalBucket.ABSONDERUNG})
              </button>
            )}

            {classificationStats.classification?.withSuggestion > 0 && (
              <button
                onClick={() => handleBulkConfirm({ minConfidence: 0.8 })}
                disabled={bulkProcessing}
                className="btn-primary text-sm disabled:opacity-50"
              >
                Hohe Konfidenz (&gt;80%) bestätigen
              </button>
            )}

            {selectedEntries.size > 0 && (
              <button
                onClick={() => handleBulkConfirm()}
                disabled={bulkProcessing}
                className="btn-primary text-sm disabled:opacity-50"
              >
                Ausgewählte bestätigen ({selectedEntries.size})
              </button>
            )}

            {/* Dimensions-Vorschläge übernehmen */}
            {entries.some((e) => {
              const ext = e as LedgerEntryResponse & {
                suggestedBankAccountId?: string | null;
                suggestedCounterpartyId?: string | null;
                suggestedLocationId?: string | null;
              };
              return ext.suggestedBankAccountId || ext.suggestedCounterpartyId || ext.suggestedLocationId;
            }) && (
              <button
                onClick={handleApplyDimensionSuggestions}
                disabled={bulkProcessing}
                className="btn-secondary text-sm bg-white disabled:opacity-50"
                title="Übernimmt vorgeschlagene Bankkonten, Gegenparteien und Standorte"
              >
                Dimensionen übernehmen
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="admin-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Werttyp
            </label>
            <select
              value={filterValueType}
              onChange={(e) => setFilterValueType(e.target.value as ValueType | "")}
              className="input-field min-w-[120px]"
            >
              <option value="">Alle</option>
              {Object.entries(VALUE_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Rechtsstatus
            </label>
            <select
              value={filterLegalBucket}
              onChange={(e) => setFilterLegalBucket(e.target.value as LegalBucket | "")}
              className="input-field min-w-[150px]"
            >
              <option value="">Alle</option>
              {Object.entries(LEGAL_BUCKET_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Review-Status
            </label>
            <select
              value={filterReviewStatus}
              onChange={(e) => setFilterReviewStatus(e.target.value as ReviewStatus | "")}
              className="input-field min-w-[150px]"
            >
              <option value="">Alle</option>
              {Object.entries(REVIEW_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Vorschlag
            </label>
            <select
              value={filterSuggestedBucket}
              onChange={(e) => setFilterSuggestedBucket(e.target.value)}
              className="input-field min-w-[150px]"
            >
              <option value="">Alle</option>
              <option value="MASSE">MASSE</option>
              <option value="ABSONDERUNG">ABSONDERUNG</option>
              <option value="NEUTRAL">NEUTRAL</option>
              <option value="null">Ohne Vorschlag</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Von
            </label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Bis
            </label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="input-field"
            />
          </div>

          {/* Dimensions-Filter */}
          {bankAccountsList.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Bankkonto
              </label>
              <select
                value={filterBankAccountId}
                onChange={(e) => setFilterBankAccountId(e.target.value)}
                className="input-field min-w-[150px]"
              >
                <option value="">Alle</option>
                <option value="null">Ohne Bankkonto</option>
                {bankAccountsList.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bankName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {counterpartiesList.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Gegenpartei
              </label>
              <select
                value={filterCounterpartyId}
                onChange={(e) => setFilterCounterpartyId(e.target.value)}
                className="input-field min-w-[150px]"
              >
                <option value="">Alle</option>
                <option value="null">Ohne Gegenpartei</option>
                {counterpartiesList.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {locationsList.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Standort
              </label>
              <select
                value={filterLocationId}
                onChange={(e) => setFilterLocationId(e.target.value)}
                className="input-field min-w-[150px]"
              >
                <option value="">Alle</option>
                <option value="null">Ohne Standort</option>
                {locationsList.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {importJobs.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Import
              </label>
              <select
                value={filterImportJobId}
                onChange={(e) => setFilterImportJobId(e.target.value)}
                className="input-field min-w-[200px]"
              >
                <option value="">Alle Importe</option>
                {importJobs.map((job) => (
                  <option key={job.importJobId} value={job.importJobId}>
                    {job.importSource || job.importJobId.slice(0, 8)} ({job.entryCount} Einträge)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Alt-/Neumasse Filter */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Alt-/Neumasse
            </label>
            <select
              value={filterEstateAllocation}
              onChange={(e) => setFilterEstateAllocation(e.target.value as EstateAllocation)}
              className="input-field min-w-[130px]"
            >
              <option value="">Alle</option>
              <option value="ALTMASSE">Altmasse</option>
              <option value="NEUMASSE">Neumasse</option>
              <option value="MIXED">Gemischt</option>
              <option value="UNKLAR">Unklar</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="btn-secondary text-sm"
            >
              Filter zurücksetzen
            </button>
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

      {/* Entries Table */}
      <div className="admin-card">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-lg font-medium text-[var(--foreground)]">
            Ledger-Einträge
            {loading && <span className="ml-2 text-sm text-[var(--muted)]">(lädt...)</span>}
          </h2>
          <span className="text-sm text-[var(--muted)]">
            {entries.length} Einträge
          </span>
        </div>

        {entries.length === 0 ? (
          <div className="p-8 text-center text-[var(--secondary)]">
            {hasActiveFilters
              ? "Keine Einträge mit diesen Filterkriterien gefunden"
              : "Keine Ledger-Einträge für diesen Fall vorhanden"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      checked={selectedEntries.size === entries.length && entries.length > 0}
                      onChange={toggleAllEntries}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <SortHeader field="transactionDate" label="Datum" />
                  <SortHeader field="description" label="Beschreibung" />
                  <SortHeader field="amountCents" label="Betrag" className="text-right" />
                  <SortHeader field="valueType" label="Typ" />
                  <th>Alt/Neu</th>
                  <SortHeader field="legalBucket" label="Rechtsstatus" />
                  <SortHeader field="reviewStatus" label="Review" />
                  <th>Vorschlag</th>
                  <th>Dim.-Vorschlag</th>
                  <th>Import</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((entry) => {
                  const amount = parseInt(entry.amountCents);
                  const isInflow = amount >= 0;
                  const entryWithExtras = entry as LedgerEntryResponse & {
                    suggestedLegalBucket?: string | null;
                    suggestedConfidence?: number | null;
                    suggestedReason?: string | null;
                    suggestedBankAccountId?: string | null;
                    suggestedCounterpartyId?: string | null;
                    suggestedLocationId?: string | null;
                    importSource?: string | null;
                    importJobId?: string | null;
                    estateAllocation?: string | null;
                    allocationSource?: string | null;
                    allocationNote?: string | null;
                  };

                  return (
                    <tr key={entry.id} className={selectedEntries.has(entry.id) ? "bg-blue-50" : ""}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedEntries.has(entry.id)}
                          onChange={() => toggleEntrySelection(entry.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="whitespace-nowrap">
                        {formatDate(entry.transactionDate)}
                      </td>
                      <td>
                        <div className="max-w-xs">
                          <div className="font-medium text-[var(--foreground)] truncate">
                            {entry.description}
                          </div>
                          {entry.note && (
                            <div className="text-xs text-[var(--muted)] truncate">
                              {entry.note}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className={`text-right font-mono whitespace-nowrap ${
                        isInflow ? "text-[var(--success)]" : "text-[var(--danger)]"
                      }`}>
                        {formatCurrency(entry.amountCents)}
                      </td>
                      <td>
                        <span className={`badge ${getValueTypeBadgeClass(entry.valueType)}`}>
                          {VALUE_TYPE_LABELS[entry.valueType]}
                        </span>
                      </td>
                      <td>
                        {entryWithExtras.estateAllocation ? (
                          <span
                            className={`badge text-xs ${getEstateAllocationBadgeClass(entryWithExtras.estateAllocation)}`}
                            title={entryWithExtras.allocationNote || entryWithExtras.allocationSource || ''}
                          >
                            {ESTATE_ALLOCATION_LABELS[entryWithExtras.estateAllocation] || entryWithExtras.estateAllocation}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--muted)]">-</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${getBucketBadgeClass(entry.legalBucket)}`}>
                          {LEGAL_BUCKET_LABELS[entry.legalBucket]}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${getReviewStatusBadgeClass(entry.reviewStatus as ReviewStatus)}`}>
                          {REVIEW_STATUS_LABELS[entry.reviewStatus as ReviewStatus] || entry.reviewStatus}
                        </span>
                      </td>
                      <td>
                        {entryWithExtras.suggestedLegalBucket ? (
                          <div className="flex flex-col gap-1">
                            <span className="badge badge-info text-xs">
                              {entryWithExtras.suggestedLegalBucket}
                            </span>
                            {entryWithExtras.suggestedConfidence && (
                              <span className={`text-xs ${getConfidenceBadgeClass(entryWithExtras.suggestedConfidence)}`}>
                                {Math.round(entryWithExtras.suggestedConfidence * 100)}%
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--muted)]">-</span>
                        )}
                      </td>
                      <td className="text-xs">
                        {(entryWithExtras.suggestedBankAccountId || entryWithExtras.suggestedCounterpartyId || entryWithExtras.suggestedLocationId) ? (
                          <div className="flex flex-wrap gap-1">
                            {entryWithExtras.suggestedBankAccountId && (
                              <span className="badge badge-info text-xs" title={`Bankkonto: ${bankAccountsMap.get(entryWithExtras.suggestedBankAccountId) || '...'}`}>
                                🏦
                              </span>
                            )}
                            {entryWithExtras.suggestedCounterpartyId && (
                              <span className="badge badge-info text-xs" title={`Gegenpartei: ${counterpartiesMap.get(entryWithExtras.suggestedCounterpartyId) || '...'}`}>
                                👤
                              </span>
                            )}
                            {entryWithExtras.suggestedLocationId && (
                              <span className="badge badge-info text-xs" title={`Standort: ${locationsMap.get(entryWithExtras.suggestedLocationId) || '...'}`}>
                                📍
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--muted)]">-</span>
                        )}
                      </td>
                      <td className="text-xs">
                        {entryWithExtras.importSource ? (
                          <button
                            onClick={() => setFilterImportJobId(entryWithExtras.importJobId || "")}
                            className="badge badge-neutral hover:bg-gray-200 cursor-pointer truncate max-w-[100px]"
                            title={`Import: ${entryWithExtras.importSource}\nKlicken zum Filtern`}
                          >
                            {entryWithExtras.importSource.length > 15
                              ? entryWithExtras.importSource.slice(0, 12) + "..."
                              : entryWithExtras.importSource}
                          </button>
                        ) : (
                          <span className="text-[var(--muted)]">-</span>
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/admin/cases/${id}/ledger/${entry.id}`}
                          className="text-[var(--primary)] hover:underline text-sm"
                        >
                          Bearbeiten
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
