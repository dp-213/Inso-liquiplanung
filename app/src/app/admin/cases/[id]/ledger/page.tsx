"use client";

import { useState, useEffect, useCallback, useMemo, use, useRef } from "react";
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
  CATEGORY_TAG_LABELS,
  CATEGORY_TAG_OPTIONS,
  CATEGORY_TAG_SOURCE_LABELS,
} from "@/lib/ledger";
import { formatAllocationSource, formatCategoryTagSource } from "@/lib/ledger/format-helpers";
import { ColumnFilter, ColumnFilterValue } from "@/components/ledger/ColumnFilter";

type TabType = "all" | "review" | "rules" | "sources";

// Column configuration
interface ColumnConfig {
  id: string;
  label: string;
  defaultVisible: boolean;
  defaultWidth: number;
  minWidth: number;
}

const COLUMN_DEFINITIONS: ColumnConfig[] = [
  { id: "checkbox", label: "Auswahl", defaultVisible: true, defaultWidth: 40, minWidth: 40 },
  { id: "transactionDate", label: "Datum", defaultVisible: true, defaultWidth: 100, minWidth: 80 },
  { id: "categoryTag", label: "Matrix-Kat.", defaultVisible: true, defaultWidth: 140, minWidth: 100 },
  { id: "description", label: "Beschreibung", defaultVisible: true, defaultWidth: 250, minWidth: 150 },
  { id: "amountCents", label: "Betrag", defaultVisible: true, defaultWidth: 110, minWidth: 90 },
  { id: "import", label: "Quelle", defaultVisible: true, defaultWidth: 180, minWidth: 120 },
  { id: "location", label: "Standort", defaultVisible: true, defaultWidth: 120, minWidth: 80 },
  { id: "bankAccount", label: "Bankkonto", defaultVisible: true, defaultWidth: 150, minWidth: 100 },
  { id: "counterparty", label: "Gegenpartei", defaultVisible: true, defaultWidth: 150, minWidth: 100 },
  { id: "valueType", label: "Typ", defaultVisible: true, defaultWidth: 70, minWidth: 60 },
  { id: "estateAllocation", label: "Alt/Neu", defaultVisible: true, defaultWidth: 90, minWidth: 70 },
  { id: "legalBucket", label: "Rechtsstatus", defaultVisible: true, defaultWidth: 110, minWidth: 90 },
  { id: "reviewStatus", label: "Review", defaultVisible: true, defaultWidth: 90, minWidth: 70 },
  { id: "suggestion", label: "Vorschlag", defaultVisible: false, defaultWidth: 100, minWidth: 80 },
  { id: "dimSuggestion", label: "Dim.-Vorschlag", defaultVisible: false, defaultWidth: 100, minWidth: 80 },
  { id: "actions", label: "Aktionen", defaultVisible: true, defaultWidth: 140, minWidth: 120 },
];

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
  const activeTab: TabType = tabParam === "review" || tabParam === "rules" || tabParam === "sources" ? tabParam : "all";

  // Read estate filter from URL (supports both 'estate' and 'estateAllocation')
  const initialEstateAllocation = (searchParams.get("estateAllocation") || searchParams.get("estate") || "") as EstateAllocation;

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

  // Split/Batch State
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [splitModalEntry, setSplitModalEntry] = useState<(LedgerEntryResponse & { isBatchParent?: boolean }) | null>(null);

  const toggleBatchExpand = useCallback((entryId: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }, []);

  // Column Filters State
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterValue>>({});

  const openDetails = useCallback(async (entry: LedgerEntryResponse) => {
    setDetailsEntry(entry);
    setDetailsImportData(null);
    setDetailsLoading(true);
    try {
      const res = await fetch(`/api/cases/${id}/ledger/${entry.id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.importData?.rawData) {
          const raw = typeof data.importData.rawData === 'string'
            ? JSON.parse(data.importData.rawData)
            : data.importData.rawData;
          setDetailsImportData(raw);
        }
      }
    } catch {
      // Import-Daten nicht verfügbar
    } finally {
      setDetailsLoading(false);
    }
  }, [id]);

  const handleColumnFilterChange = useCallback((columnId: string, filter: ColumnFilterValue | null) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      if (filter) {
        next[columnId] = filter;
      } else {
        delete next[columnId];
      }
      return next;
    });
  }, []);

  // Column visibility and widths
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    COLUMN_DEFINITIONS.forEach(col => { initial[col.id] = col.defaultVisible; });
    return initial;
  });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    COLUMN_DEFINITIONS.forEach(col => { initial[col.id] = col.defaultWidth; });
    return initial;
  });
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [detailsEntry, setDetailsEntry] = useState<LedgerEntryResponse | null>(null);
  const [detailsImportData, setDetailsImportData] = useState<Record<string, unknown> | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);

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
  // Estate Allocation Filter (Alt-/Neumasse) - initialized from URL
  const [filterEstateAllocation, setFilterEstateAllocation] = useState<EstateAllocation>(initialEstateAllocation);
  // Category Tag Filter (Matrix-Kategorie)
  const [filterCategoryTag, setFilterCategoryTag] = useState<string>("");
  // Transfer-Filter (Umbuchungen)
  const [filterIsTransfer, setFilterIsTransfer] = useState<string>("");
  const [pairingTransfer, setPairingTransfer] = useState(false);

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
      // Category Tag Filter
      if (filterCategoryTag) queryParams.set("categoryTag", filterCategoryTag);
      // Transfer-Filter
      if (filterIsTransfer) queryParams.set("isTransfer", filterIsTransfer);

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
  }, [id, filterValueType, filterLegalBucket, filterReviewStatus, filterSuggestedBucket, filterFrom, filterTo, filterBankAccountId, filterCounterpartyId, filterLocationId, filterImportJobId, filterEstateAllocation, filterCategoryTag, filterIsTransfer]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Column resize handlers
  const handleResizeStart = (e: React.MouseEvent, columnId: string) => {
    e.preventDefault();
    setResizingColumn(columnId);
    const startX = e.clientX;
    const startWidth = columnWidths[columnId];
    const colConfig = COLUMN_DEFINITIONS.find(c => c.id === columnId);
    const minWidth = colConfig?.minWidth || 50;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startX;
      const newWidth = Math.max(minWidth, startWidth + diff);
      setColumnWidths(prev => ({ ...prev, [columnId]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const toggleColumnVisibility = (columnId: string) => {
    setColumnVisibility(prev => ({ ...prev, [columnId]: !prev[columnId] }));
  };

  const resetColumnWidths = () => {
    const initial: Record<string, number> = {};
    COLUMN_DEFINITIONS.forEach(col => { initial[col.id] = col.defaultWidth; });
    setColumnWidths(initial);
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
    setFilterCategoryTag("");
    setFilterIsTransfer("");
  };

  const hasActiveFilters = filterValueType || filterLegalBucket || filterReviewStatus || filterSuggestedBucket || filterFrom || filterTo || filterBankAccountId || filterCounterpartyId || filterLocationId || filterImportJobId || filterEstateAllocation || filterCategoryTag || filterIsTransfer;

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

  // Service Date Suggestions Preview Modal State
  const [showServiceDatePreviewModal, setShowServiceDatePreviewModal] = useState(false);
  const [serviceDatePreviewEntries, setServiceDatePreviewEntries] = useState<LedgerEntryResponse[]>([]);
  const [serviceDatePreviewLoading, setServiceDatePreviewLoading] = useState(false);

  const handleShowServiceDatePreview = async () => {
    setServiceDatePreviewLoading(true);
    setShowServiceDatePreviewModal(true);
    setError(null);

    try {
      // Hole alle UNREVIEWED Entries mit ServiceDate-Vorschlag
      const res = await fetch(`/api/cases/${id}/ledger?reviewStatus=UNREVIEWED&hasServiceDateSuggestion=true`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Fehler beim Laden der Vorschläge");
      }

      const data = await res.json();
      setServiceDatePreviewEntries(data.entries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden der Vorschläge");
      setShowServiceDatePreviewModal(false);
    } finally {
      setServiceDatePreviewLoading(false);
    }
  };

  const handleApplyServiceDateSuggestions = async () => {
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
          reason: "ServiceDate-Vorschläge übernommen (inkl. Alt/Neu-Berechnung)",
          applyServiceDateSuggestions: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "ServiceDate-Übernahme fehlgeschlagen");
      }

      setSuccessMessage(data.message || `${data.processed} Einträge mit ServiceDate aktualisiert`);
      setShowServiceDatePreviewModal(false);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ServiceDate-Übernahme fehlgeschlagen");
    } finally {
      setBulkProcessing(false);
    }
  };

  // Category Tag Suggestions
  const handleApplyCategoryTagSuggestions = async () => {
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
          entryIds: Array.from(selectedEntries),
          reason: "Kategorie-Vorschläge übernommen",
          applyCategoryTagSuggestions: true,
        }),
      });

      if (!res.ok) throw new Error("Bulk-Review fehlgeschlagen");

      const result = await res.json();
      setSuccessMessage(`${result.processed} Kategorie-Vorschläge übernommen`);
      setSelectedEntries(new Set());
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleSuggestCategoryTags = async () => {
    setBulkProcessing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/cases/${id}/ledger/suggest-category-tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error("Vorschlagsberechnung fehlgeschlagen");

      const result = await res.json();
      setSuccessMessage(`${result.updated} Kategorie-Vorschläge berechnet, ${result.skipped} übersprungen`);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
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

  // Delete Single Entry
  const handleDeleteEntry = async (entryId: string, description: string) => {
    if (!confirm(`Möchten Sie den Eintrag "${description}" wirklich löschen?`)) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/cases/${id}/ledger/${entryId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Löschen fehlgeschlagen");
      }

      setSuccessMessage("Eintrag gelöscht");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    }
  };

  // Transfer Pairing (Umbuchungen verknüpfen)
  const handlePairTransfer = async () => {
    if (selectedEntries.size !== 2) {
      setError("Bitte genau 2 Einträge auswählen");
      return;
    }

    setPairingTransfer(true);
    setError(null);
    setSuccessMessage(null);

    const ids = Array.from(selectedEntries);
    try {
      const res = await fetch(`/api/cases/${id}/ledger/pair-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ entryIdA: ids[0], entryIdB: ids[1] }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Verknüpfung fehlgeschlagen");
      }

      setSuccessMessage(data.message + (data.warning ? ` (${data.warning})` : ""));
      setSelectedEntries(new Set());
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verknüpfung fehlgeschlagen");
    } finally {
      setPairingTransfer(false);
    }
  };

  const handleUnpairTransfer = async (entryId: string) => {
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/cases/${id}/ledger/unpair-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ entryId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Aufheben fehlgeschlagen");
      }

      setSuccessMessage(data.message);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aufheben fehlgeschlagen");
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
    const visibleEntries = sortedEntries;
    const allVisibleSelected = visibleEntries.length > 0 && visibleEntries.every(e => selectedEntries.has(e.id));
    if (allVisibleSelected) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(visibleEntries.map((e) => e.id)));
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

  // Apply column filters (memoized)
  const filteredEntries = useMemo(() => entries.filter(entry => {
    const entryAny = entry as any;

    for (const [columnId, filter] of Object.entries(columnFilters)) {
      if (filter.type === 'multiselect' && filter.values && filter.values.length > 0) {
        let value = '';
        switch(columnId) {
          case 'categoryTag': value = entryAny.categoryTag || ''; break;
          case 'valueType': value = entry.valueType; break;
          case 'legalBucket': value = entry.legalBucket; break;
          case 'reviewStatus': value = entry.reviewStatus; break;
          case 'estateAllocation': value = entryAny.estateAllocation || ''; break;
          case 'import': value = entryAny.importSource || 'Manuell'; break;
          case 'location': value = entryAny.locationId || ''; break;
          case 'bankAccount': value = entryAny.bankAccountId || ''; break;
          case 'counterparty': value = entryAny.counterpartyId || ''; break;
        }
        if (!filter.values.includes(value)) return false;
      }

      if (filter.type === 'text' && filter.text && filter.text.trim()) {
        let text = '';
        switch(columnId) {
          case 'description': text = entry.description.toLowerCase(); break;
          case 'import': text = (entryAny.importSource || 'Manuell').toLowerCase(); break;
          case 'location': text = (locationsMap.get(entryAny.locationId) || '').toLowerCase(); break;
          case 'bankAccount': text = (bankAccountsMap.get(entryAny.bankAccountId) || '').toLowerCase(); break;
          case 'counterparty': text = (counterpartiesMap.get(entryAny.counterpartyId) || '').toLowerCase(); break;
        }
        if (!text.includes(filter.text.toLowerCase().trim())) return false;
      }

      if (filter.type === 'range') {
        if (columnId === 'amountCents') {
          const amountEuro = parseInt(entry.amountCents) / 100;
          if (filter.min !== undefined && amountEuro < filter.min) return false;
          if (filter.max !== undefined && amountEuro > filter.max) return false;
        }
      }
    }

    return true;
  }), [entries, columnFilters, locationsMap, bankAccountsMap, counterpartiesMap]);

  // Sort entries (memoized)
  const sortedEntries = useMemo(() => [...filteredEntries].sort((a, b) => {
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
  }), [filteredEntries, sortBy, sortOrder]);

  // Calculate selection summary
  const selectedEntriesData = entries.filter(e => selectedEntries.has(e.id));
  const selectionSummary = {
    count: selectedEntriesData.length,
    totalInflows: selectedEntriesData
      .filter(e => parseInt(e.amountCents) >= 0)
      .reduce((sum, e) => sum + BigInt(e.amountCents), BigInt(0)),
    totalOutflows: selectedEntriesData
      .filter(e => parseInt(e.amountCents) < 0)
      .reduce((sum, e) => sum + BigInt(e.amountCents), BigInt(0)),
    netAmount: selectedEntriesData
      .reduce((sum, e) => sum + BigInt(e.amountCents), BigInt(0)),
  };

  // Sort header component
  const SortHeader = ({ field, label, className = "" }: { field: SortField; label: string; className?: string }) => (
    <div
      className={`cursor-pointer hover:bg-gray-100 select-none flex items-center gap-1 ${className}`}
      onClick={() => handleSort(field)}
    >
      {label}
      <span className="text-[var(--muted)]">
        {sortBy === field ? (
          sortOrder === "asc" ? "↑" : "↓"
        ) : (
          <span className="opacity-30">↕</span>
        )}
      </span>
    </div>
  );


  // Filter Options (memoized)
  const categoryTagOptions = useMemo(() => Object.entries(CATEGORY_TAG_LABELS).map(([value, label]) => ({ value, label })), []);
  const valueTypeOptions = useMemo(() => Object.entries(VALUE_TYPE_LABELS).map(([value, label]) => ({ value, label })), []);
  const legalBucketOptions = useMemo(() => Object.entries(LEGAL_BUCKET_LABELS).map(([value, label]) => ({ value, label })), []);
  const reviewStatusOptions = useMemo(() => Object.entries(REVIEW_STATUS_LABELS).map(([value, label]) => ({ value, label })), []);
  const estateAllocationOptions = useMemo(() => Object.entries(ESTATE_ALLOCATION_LABELS).map(([value, label]) => ({ value, label })), []);

  const importSourceOptions = useMemo(() => Array.from(new Set(entries.map((e: any) => e.importSource || 'Manuell')))
    .map(v => ({ value: v, label: v })), [entries]);
  const locationOptions = useMemo(() => Array.from(new Set(entries.map((e: any) => e.locationId).filter(Boolean)))
    .map(id => ({ value: id, label: locationsMap.get(id) || id })), [entries, locationsMap]);
  const bankAccountOptions = useMemo(() => Array.from(new Set(entries.map((e: any) => e.bankAccountId).filter(Boolean)))
    .map(id => ({ value: id, label: bankAccountsMap.get(id) || id })), [entries, bankAccountsMap]);
  const counterpartyOptions = useMemo(() => Array.from(new Set(entries.map((e: any) => e.counterpartyId).filter(Boolean)))
    .map(id => ({ value: id, label: counterpartiesMap.get(id) || id })), [entries, counterpartiesMap]);

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
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
          <Link href={`/admin/cases/${id}/results`} className="btn-primary flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Dashboard
          </Link>
        </div>
      </div>

      {/* Sticky Total Summary - always visible at top */}
      {activeTab !== "rules" && activeTab !== "sources" && stats && (
        <div className="sticky top-0 z-20 bg-white shadow-sm border-b border-[var(--border)] py-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-2">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-[var(--muted)] font-medium">Anzahl Einträge</p>
              <p className="text-xl font-bold text-[var(--foreground)]">{stats.totalCount}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-[var(--muted)] font-medium">Einzahlungen</p>
              <p className="text-xl font-bold text-[var(--success)]">
                {formatCurrency(stats.totalInflows)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-[var(--muted)] font-medium">Auszahlungen</p>
              <p className="text-xl font-bold text-[var(--danger)]">
                {formatCurrency(stats.totalOutflows)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-[var(--muted)] font-medium">Netto</p>
              <p className={`text-xl font-bold ${
                parseInt(stats.netAmount) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
              }`}>
                {formatCurrency(stats.netAmount)}
              </p>
            </div>
          </div>
        </div>
      )}

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
          <button
            onClick={() => setActiveTab("sources")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "sources"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--secondary)] hover:bg-gray-100"
            }`}
          >
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Quellen
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

      {/* Sources Tab Content */}
      {activeTab === "sources" && (
        <div className="space-y-6">
          <div className="admin-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <svg className="w-6 h-6 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Quellen-Übersicht</h2>
                <p className="text-sm text-[var(--muted)]">
                  Alle Quelldateien und deren verarbeitete Daten im Überblick
                </p>
              </div>
            </div>

            {/* Sources Summary */}
            {(() => {
              // Group entries by importSource
              const sourceGroups = entries.reduce((acc, entry) => {
                const source = entry.importSource || "Manuell eingegeben";
                if (!acc[source]) {
                  acc[source] = {
                    entries: [],
                    byValueType: { IST: 0, PLAN: 0 },
                    byReviewStatus: { UNREVIEWED: 0, CONFIRMED: 0, ADJUSTED: 0 },
                    byEstate: { ALTMASSE: 0, NEUMASSE: 0, MIXED: 0, UNKLAR: 0, null: 0 },
                    totalInflows: BigInt(0),
                    totalOutflows: BigInt(0),
                  };
                }
                acc[source].entries.push(entry);
                acc[source].byValueType[entry.valueType as "IST" | "PLAN"]++;
                acc[source].byReviewStatus[entry.reviewStatus as "UNREVIEWED" | "CONFIRMED" | "ADJUSTED"]++;
                const estate = entry.estateAllocation || "null";
                if (estate in acc[source].byEstate) {
                  acc[source].byEstate[estate as keyof typeof acc[typeof source]["byEstate"]]++;
                }
                const amount = BigInt(entry.amountCents);
                if (amount >= 0) {
                  acc[source].totalInflows += amount;
                } else {
                  acc[source].totalOutflows += amount;
                }
                return acc;
              }, {} as Record<string, {
                entries: LedgerEntryResponse[];
                byValueType: { IST: number; PLAN: number };
                byReviewStatus: { UNREVIEWED: number; CONFIRMED: number; ADJUSTED: number };
                byEstate: { ALTMASSE: number; NEUMASSE: number; MIXED: number; UNKLAR: number; null: number };
                totalInflows: bigint;
                totalOutflows: bigint;
              }>);

              const sourceList = Object.entries(sourceGroups).sort((a, b) => b[1].entries.length - a[1].entries.length);

              if (sourceList.length === 0) {
                return (
                  <div className="text-center py-8 text-[var(--muted)]">
                    <p>Keine Daten vorhanden</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-[var(--muted)]">Quelldateien</p>
                      <p className="text-2xl font-bold text-[var(--foreground)]">{sourceList.length}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-[var(--muted)]">Gesamteinträge</p>
                      <p className="text-2xl font-bold text-[var(--foreground)]">{entries.length}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-[var(--muted)]">IST / PLAN</p>
                      <p className="text-lg font-semibold">
                        <span className="text-green-600">{entries.filter(e => e.valueType === "IST").length}</span>
                        {" / "}
                        <span className="text-blue-600">{entries.filter(e => e.valueType === "PLAN").length}</span>
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-[var(--muted)]">Ungeprüft</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {entries.filter(e => e.reviewStatus === "UNREVIEWED").length}
                      </p>
                    </div>
                  </div>

                  {/* Source Details */}
                  {sourceList.map(([source, data]) => {
                    const dateRange = data.entries.reduce((range, entry) => {
                      const date = new Date(entry.transactionDate);
                      if (!range.min || date < range.min) range.min = date;
                      if (!range.max || date > range.max) range.max = date;
                      return range;
                    }, { min: null as Date | null, max: null as Date | null });

                    return (
                      <div key={source} className="border rounded-lg overflow-hidden">
                        {/* Source Header */}
                        <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <div>
                              <p className="font-medium text-[var(--foreground)]">{source}</p>
                              {dateRange.min && dateRange.max && (
                                <p className="text-xs text-[var(--muted)]">
                                  Zeitraum: {dateRange.min.toLocaleDateString("de-DE")} – {dateRange.max.toLocaleDateString("de-DE")}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-semibold text-[var(--foreground)]">
                              {data.entries.length} Einträge
                            </span>
                            <button
                              onClick={() => {
                                // Filter to this source
                                const sourceEntries = entries.filter(e => (e.importSource || "Manuell eingegeben") === source);
                                if (sourceEntries.length > 0 && sourceEntries[0].importJobId) {
                                  setFilterImportJobId(sourceEntries[0].importJobId);
                                  setActiveTab("all");
                                  router.push(`/admin/cases/${id}/ledger?tab=all`);
                                }
                              }}
                              className="text-xs px-2 py-1 bg-[var(--primary)] text-white rounded hover:opacity-90"
                            >
                              Filtern
                            </button>
                          </div>
                        </div>

                        {/* Source Stats Grid */}
                        <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                          {/* Value Type */}
                          <div>
                            <p className="text-xs text-[var(--muted)] mb-1">Typ</p>
                            <div className="flex gap-2">
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                IST: {data.byValueType.IST}
                              </span>
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                PLAN: {data.byValueType.PLAN}
                              </span>
                            </div>
                          </div>

                          {/* Review Status */}
                          <div>
                            <p className="text-xs text-[var(--muted)] mb-1">Review-Status</p>
                            <div className="flex flex-wrap gap-1">
                              {data.byReviewStatus.UNREVIEWED > 0 && (
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                                  Offen: {data.byReviewStatus.UNREVIEWED}
                                </span>
                              )}
                              {data.byReviewStatus.CONFIRMED > 0 && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                  Bestätigt: {data.byReviewStatus.CONFIRMED}
                                </span>
                              )}
                              {data.byReviewStatus.ADJUSTED > 0 && (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                                  Korrigiert: {data.byReviewStatus.ADJUSTED}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Estate Allocation */}
                          <div>
                            <p className="text-xs text-[var(--muted)] mb-1">Alt/Neu-Masse</p>
                            <div className="flex flex-wrap gap-1">
                              {data.byEstate.ALTMASSE > 0 && (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                                  Alt: {data.byEstate.ALTMASSE}
                                </span>
                              )}
                              {data.byEstate.NEUMASSE > 0 && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                  Neu: {data.byEstate.NEUMASSE}
                                </span>
                              )}
                              {data.byEstate.MIXED > 0 && (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                  Mix: {data.byEstate.MIXED}
                                </span>
                              )}
                              {data.byEstate.UNKLAR > 0 && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                                  Unklar: {data.byEstate.UNKLAR}
                                </span>
                              )}
                              {data.byEstate.null > 0 && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                                  Keine: {data.byEstate.null}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Amounts */}
                          <div>
                            <p className="text-xs text-[var(--muted)] mb-1">Einzahlungen</p>
                            <p className="font-medium text-green-600">
                              {formatCurrency(data.totalInflows.toString())}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--muted)] mb-1">Auszahlungen</p>
                            <p className="font-medium text-red-600">
                              {formatCurrency(data.totalOutflows.toString())}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Review Status Cards - only show for non-rules/sources tabs */}
      {activeTab !== "rules" && activeTab !== "sources" && classificationStats && (
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

      {/* Import Jobs Overview - only show for non-sources tabs */}
      {activeTab !== "sources" && importJobs.length > 0 && (
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

      {/* Bulk Actions Bar - only show for non-rules/sources tabs */}
      {activeTab !== "rules" && activeTab !== "sources" && classificationStats && (classificationStats.byReviewStatus?.UNREVIEWED || 0) > 0 && (
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

            {/* ServiceDate-Vorschläge übernehmen */}
            {entries.some((e) => {
              const ext = e as LedgerEntryResponse & {
                suggestedServiceDate?: string | null;
                suggestedServicePeriodStart?: string | null;
              };
              return e.reviewStatus === "UNREVIEWED" && (ext.suggestedServiceDate || ext.suggestedServicePeriodStart);
            }) && (
              <button
                onClick={handleShowServiceDatePreview}
                disabled={bulkProcessing}
                className="btn-secondary text-sm bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100 disabled:opacity-50"
                title="Übernimmt ServiceDate-Vorschläge und berechnet Alt/Neu-Zuordnung"
              >
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  ServiceDate-Vorschläge
                </span>
              </button>
            )}

            {/* Kategorie-Vorschläge berechnen */}
            <button
              onClick={handleSuggestCategoryTags}
              disabled={bulkProcessing}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              title="Berechnet Matrix-Kategorie-Vorschläge für alle Einträge ohne Zuordnung"
            >
              Kat.-Vorschläge berechnen
            </button>
            {selectedEntries.size > 0 && (
              <button
                onClick={handleApplyCategoryTagSuggestions}
                disabled={bulkProcessing}
                className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                title="Übernimmt die berechneten Kategorie-Vorschläge für ausgewählte Einträge"
              >
                Kat.-Vorschläge übernehmen ({selectedEntries.size})
              </button>
            )}

            {/* Umbuchung verknüpfen */}
            {selectedEntries.size === 2 && (
              <button
                onClick={handlePairTransfer}
                disabled={pairingTransfer}
                className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                title="Die beiden ausgewählten Einträge als interne Umbuchung verknüpfen"
              >
                {pairingTransfer ? "Verknüpfe..." : "Als Umbuchung verknüpfen"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filters - only show for non-rules/sources tabs */}
      {activeTab !== "rules" && activeTab !== "sources" && (
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

          {/* Matrix-Kategorie Filter */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Matrix-Kat.
            </label>
            <select
              value={filterCategoryTag}
              onChange={(e) => setFilterCategoryTag(e.target.value)}
              className="input-field min-w-[150px]"
            >
              <option value="">Alle</option>
              <option value="null">Nicht zugeordnet</option>
              {CATEGORY_TAG_OPTIONS.map(group => (
                <optgroup key={group.group} label={group.group}>
                  {group.tags.map(tag => (
                    <option key={tag} value={tag}>{CATEGORY_TAG_LABELS[tag]}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Umbuchungs-Filter */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Umbuchungen
            </label>
            <select
              value={filterIsTransfer}
              onChange={(e) => setFilterIsTransfer(e.target.value)}
              className="input-field min-w-[150px]"
            >
              <option value="">Alle Einträge</option>
              <option value="false">Ohne Umbuchungen</option>
              <option value="true">Nur Umbuchungen</option>
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
      )}

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

      {/* Entries Table - only show for non-rules/sources tabs */}
      {activeTab !== "rules" && activeTab !== "sources" && (
      <div className="admin-card">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-lg font-medium text-[var(--foreground)]">
            Ledger-Einträge
            {loading && <span className="ml-2 text-sm text-[var(--muted)]">(lädt...)</span>}
          </h2>
          <div className="flex items-center gap-3">
            {/* Column Visibility Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                Spalten
              </button>
              {showColumnMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-56 py-2">
                  <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Spalten anzeigen</span>
                    <button
                      onClick={resetColumnWidths}
                      className="text-xs text-[var(--primary)] hover:underline"
                    >
                      Breiten zurücksetzen
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {COLUMN_DEFINITIONS.filter(col => col.id !== "checkbox" && col.id !== "actions").map(col => (
                      <label
                        key={col.id}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={columnVisibility[col.id]}
                          onChange={() => toggleColumnVisibility(col.id)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <span className="text-sm text-[var(--muted)]">
              {Object.keys(columnFilters).length > 0
                ? `${sortedEntries.length} von ${entries.length} Einträgen`
                : `${entries.length} Einträge`
              }
              {Object.keys(columnFilters).length > 0 && (
                <button
                  onClick={() => setColumnFilters({})}
                  className="ml-2 text-xs text-red-500 hover:text-red-700"
                >
                  Alle Filter zurücksetzen
                </button>
              )}
            </span>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="p-8 text-center text-[var(--secondary)]">
            {hasActiveFilters
              ? "Keine Einträge mit diesen Filterkriterien gefunden"
              : "Keine Ledger-Einträge für diesen Fall vorhanden"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              ref={tableRef}
              className="admin-table"
              style={{ tableLayout: "fixed" }}
            >
              <thead>
                <tr>
                  {/* 1. Checkbox - STICKY */}
                  <th
                    style={{
                      width: columnWidths.checkbox,
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      backgroundColor: 'white',
                      boxShadow: '2px 0 4px rgba(0,0,0,0.05)'
                    }}
                    className="relative"
                  >
                    <input
                      type="checkbox"
                      checked={sortedEntries.length > 0 && sortedEntries.every(e => selectedEntries.has(e.id))}
                      onChange={toggleAllEntries}
                      className="rounded border-gray-300"
                    />
                  </th>

                  {/* 2. Datum - STICKY */}
                  {columnVisibility.transactionDate && (
                    <th
                      style={{
                        width: columnWidths.transactionDate,
                        position: 'sticky',
                        left: columnWidths.checkbox,
                        zIndex: 10,
                        backgroundColor: 'white',
                        boxShadow: '2px 0 4px rgba(0,0,0,0.05)'
                      }}
                      className="relative group cursor-pointer"
                    >
                      <SortHeader field="transactionDate" label="Datum" />
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-blue-200"
                        onMouseDown={(e) => handleResizeStart(e, "transactionDate")}
                      />
                    </th>
                  )}

                  {/* 3. Matrix-Kat - STICKY */}
                  {columnVisibility.categoryTag && (
                    <th
                      style={{
                        width: columnWidths.categoryTag,
                        maxWidth: columnWidths.categoryTag,
                        position: 'sticky',
                        left: columnWidths.checkbox + columnWidths.transactionDate,
                        zIndex: 10,
                        backgroundColor: 'white',
                        boxShadow: '2px 0 4px rgba(0,0,0,0.05)',
                        overflow: 'hidden',
                      }}
                      className="relative group"
                    >
                      <div className="flex items-center">
                        Matrix-Kat.
                        <ColumnFilter columnId="categoryTag" filterType="multiselect" options={categoryTagOptions} currentFilter={columnFilters["categoryTag"]} onFilterChange={handleColumnFilterChange} />
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-blue-200"
                        onMouseDown={(e) => handleResizeStart(e, "categoryTag")}
                      />
                    </th>
                  )}

                  {/* 4. Beschreibung */}
                  {columnVisibility.description && (
                    <th style={{ width: columnWidths.description }} className="relative group cursor-pointer">
                      <div className="flex items-center">
                        <SortHeader field="description" label="Beschreibung" />
                        <span className="ml-1 text-gray-400 hover:text-gray-600 cursor-help" title="Beim Hovern über eine Beschreibung wird der volle Text angezeigt. Für den vollständigen Überweisungstext: Zeile anklicken → Originaldaten aus Kontoauszug">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </span>
                        <ColumnFilter columnId="description" filterType="text" currentFilter={columnFilters["description"]} onFilterChange={handleColumnFilterChange} />
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-blue-200"
                        onMouseDown={(e) => handleResizeStart(e, "description")}
                      />
                    </th>
                  )}

                  {/* 5. Betrag */}
                  {columnVisibility.amountCents && (
                    <th style={{ width: columnWidths.amountCents }} className="relative group text-right cursor-pointer">
                      <div className="flex items-center justify-end">
                        <SortHeader field="amountCents" label="Betrag" className="text-right" />
                        <ColumnFilter columnId="amountCents" filterType="range" currentFilter={columnFilters["amountCents"]} onFilterChange={handleColumnFilterChange} />
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-blue-200"
                        onMouseDown={(e) => handleResizeStart(e, "amountCents")}
                      />
                    </th>
                  )}

                  {/* 6. Quelle */}
                  {columnVisibility.import && (
                    <th style={{ width: columnWidths.import }} className="relative group">
                      <div className="flex items-center">
                        Quelle
                        <ColumnFilter columnId="import" filterType="multiselect" options={importSourceOptions} currentFilter={columnFilters["import"]} onFilterChange={handleColumnFilterChange} />
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-blue-200"
                        onMouseDown={(e) => handleResizeStart(e, "import")}
                      />
                    </th>
                  )}

                  {/* 7. Standort */}
                  {columnVisibility.location && (
                    <th style={{ width: columnWidths.location }} className="relative group">
                      <div className="flex items-center">
                        Standort
                        <ColumnFilter columnId="location" filterType="multiselect" options={locationOptions} currentFilter={columnFilters["location"]} onFilterChange={handleColumnFilterChange} />
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-blue-200"
                        onMouseDown={(e) => handleResizeStart(e, "location")}
                      />
                    </th>
                  )}

                  {/* 8. Bankkonto */}
                  {columnVisibility.bankAccount && (
                    <th style={{ width: columnWidths.bankAccount }} className="relative group">
                      <div className="flex items-center">
                        Bankkonto
                        <ColumnFilter columnId="bankAccount" filterType="multiselect" options={bankAccountOptions} currentFilter={columnFilters["bankAccount"]} onFilterChange={handleColumnFilterChange} />
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-blue-200"
                        onMouseDown={(e) => handleResizeStart(e, "bankAccount")}
                      />
                    </th>
                  )}

                  {/* 9. Gegenpartei */}
                  {columnVisibility.counterparty && (
                    <th style={{ width: columnWidths.counterparty }} className="relative group">
                      <div className="flex items-center">
                        Gegenpartei
                        <ColumnFilter columnId="counterparty" filterType="multiselect" options={counterpartyOptions} currentFilter={columnFilters["counterparty"]} onFilterChange={handleColumnFilterChange} />
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-blue-200"
                        onMouseDown={(e) => handleResizeStart(e, "counterparty")}
                      />
                    </th>
                  )}

                  {/* 10. Typ */}
                  {columnVisibility.valueType && (
                    <th style={{ width: columnWidths.valueType }} className="relative group cursor-pointer">
                      <div className="flex items-center">
                        <SortHeader field="valueType" label="Typ" />
                        <ColumnFilter columnId="valueType" filterType="multiselect" options={valueTypeOptions} currentFilter={columnFilters["valueType"]} onFilterChange={handleColumnFilterChange} />
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-blue-200"
                        onMouseDown={(e) => handleResizeStart(e, "valueType")}
                      />
                    </th>
                  )}

                  {/* 11. Alt/Neu */}
                  {columnVisibility.estateAllocation && (
                    <th style={{ width: columnWidths.estateAllocation }} className="relative group">
                      <div className="flex items-center">
                        Alt/Neu
                        <ColumnFilter columnId="estateAllocation" filterType="multiselect" options={estateAllocationOptions} currentFilter={columnFilters["estateAllocation"]} onFilterChange={handleColumnFilterChange} />
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-blue-200"
                        onMouseDown={(e) => handleResizeStart(e, "estateAllocation")}
                      />
                    </th>
                  )}

                  {/* 12. Rechtsstatus */}
                  {columnVisibility.legalBucket && (
                    <th style={{ width: columnWidths.legalBucket }} className="relative group">
                      <div className="flex items-center">
                        <SortHeader field="legalBucket" label="Rechtsstatus" />
                        <ColumnFilter columnId="legalBucket" filterType="multiselect" options={legalBucketOptions} currentFilter={columnFilters["legalBucket"]} onFilterChange={handleColumnFilterChange} />
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-blue-200"
                        onMouseDown={(e) => handleResizeStart(e, "legalBucket")}
                      />
                    </th>
                  )}

                  {/* 13. Review */}
                  {columnVisibility.reviewStatus && (
                    <th style={{ width: columnWidths.reviewStatus }} className="relative group">
                      <div className="flex items-center">
                        <SortHeader field="reviewStatus" label="Review" />
                        <ColumnFilter columnId="reviewStatus" filterType="multiselect" options={reviewStatusOptions} currentFilter={columnFilters["reviewStatus"]} onFilterChange={handleColumnFilterChange} />
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-blue-200"
                        onMouseDown={(e) => handleResizeStart(e, "reviewStatus")}
                      />
                    </th>
                  )}

                  {/* Vorschlag (hidden by default) */}
                  {columnVisibility.suggestion && (
                    <th style={{ width: columnWidths.suggestion }} className="relative group">
                      Vorschlag
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-blue-200"
                        onMouseDown={(e) => handleResizeStart(e, "suggestion")}
                      />
                    </th>
                  )}

                  {/* Dim.-Vorschlag (hidden by default) */}
                  {columnVisibility.dimSuggestion && (
                    <th style={{ width: columnWidths.dimSuggestion }} className="relative group">
                      Dim.-Vorschlag
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-blue-200"
                        onMouseDown={(e) => handleResizeStart(e, "dimSuggestion")}
                      />
                    </th>
                  )}

                  {/* 14. Aktionen */}
                  <th style={{ width: columnWidths.actions }}>Aktionen</th>
                </tr>
              </thead>
                            <tbody>
                {sortedEntries.flatMap((entry, index) => {
                  const amount = parseInt(entry.amountCents);
                  const isInflow = amount >= 0;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const entryAny = entry as any;
                  const isBatchParent = entryAny.isBatchParent === true;
                  const isChild = !!entryAny.parentEntryId;
                  const splitChildren: Array<{ id: string; description: string; amountCents: string; counterpartyId: string | null; locationId: string | null; categoryTag: string | null; reviewStatus: string; note: string | null }> = entryAny.splitChildren || [];
                  const isExpanded = expandedBatches.has(entry.id);

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
                    bankAccountId?: string | null;
                    counterpartyId?: string | null;
                    locationId?: string | null;
                  };

                  const isTransfer = !!(entryWithExtras as unknown as { transferPartnerEntryId: string | null }).transferPartnerEntryId;

                  // Zebra stripes: even rows get light gray background
                  const zebraClass = index % 2 === 0 ? '' : 'bg-gray-50/30';
                  const rowBgClass = selectedEntries.has(entry.id)
                    ? "bg-blue-50"
                    : isBatchParent
                    ? "bg-amber-50/70"
                    : isChild
                    ? "bg-gray-50/50"
                    : isTransfer
                    ? "bg-gray-100 text-gray-500"
                    : zebraClass;

                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const rows: any[] = [];
                  rows.push(
                    <tr
                      key={entry.id}
                      className={`${rowBgClass} hover:bg-gray-100/50 transition-colors cursor-pointer`}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('input, button, a, select')) return;
                        openDetails(entry);
                      }}
                    >
                      {/* 1. Checkbox - STICKY */}
                      <td
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 9,
                          backgroundColor: selectedEntries.has(entry.id)
                            ? '#eff6ff'
                            : isTransfer
                            ? '#f3f4f6'
                            : index % 2 === 0
                            ? 'white'
                            : 'rgba(249, 250, 251, 0.5)',
                          boxShadow: '2px 0 4px rgba(0,0,0,0.05)'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEntries.has(entry.id)}
                          onChange={() => toggleEntrySelection(entry.id)}
                          className="rounded border-gray-300"
                        />
                      </td>

                      {/* 2. Datum - STICKY */}
                      {columnVisibility.transactionDate && (
                        <td
                          className="whitespace-nowrap"
                          style={{
                            position: 'sticky',
                            left: columnWidths.checkbox,
                            zIndex: 9,
                            backgroundColor: selectedEntries.has(entry.id)
                              ? '#eff6ff'
                              : isTransfer
                              ? '#f3f4f6'
                              : index % 2 === 0
                              ? 'white'
                              : 'rgba(249, 250, 251, 0.5)',
                            boxShadow: '2px 0 4px rgba(0,0,0,0.05)'
                          }}
                        >
                          {formatDate(entry.transactionDate)}
                        </td>
                      )}

                      {/* 3. Matrix-Kat - STICKY */}
                      {columnVisibility.categoryTag && (
                        <td
                          className="px-2 py-1.5 text-xs overflow-hidden"
                          style={{
                            position: 'sticky',
                            left: columnWidths.checkbox + columnWidths.transactionDate,
                            zIndex: 9,
                            width: columnWidths.categoryTag,
                            maxWidth: columnWidths.categoryTag,
                            backgroundColor: selectedEntries.has(entry.id)
                              ? '#eff6ff'
                              : isTransfer
                              ? '#f3f4f6'
                              : index % 2 === 0
                              ? 'white'
                              : 'rgba(249, 250, 251, 0.5)',
                            boxShadow: '2px 0 4px rgba(0,0,0,0.05)'
                          }}
                        >
                          {(() => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const ext = entryWithExtras as any;
                            const tag = ext.categoryTag as string | null;
                            const source = ext.categoryTagSource as string | null;
                            const note = ext.categoryTagNote as string | null;
                            const suggested = ext.suggestedCategoryTag as string | null;
                            const reason = ext.suggestedCategoryTagReason as string | null;

                            if (tag) {
                              const label = CATEGORY_TAG_LABELS[tag] || tag;
                              const sourceLabel = source ? CATEGORY_TAG_SOURCE_LABELS[source as keyof typeof CATEGORY_TAG_SOURCE_LABELS] || source : '';
                              return (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-300 max-w-full truncate"
                                  title={`${label}${sourceLabel ? ` (${sourceLabel})` : ''}${note ? ` | ${note}` : ''}`}
                                >
                                  {label}
                                  {source === 'AUTO' && <span className="text-[9px] opacity-60 shrink-0">A</span>}
                                  {source === 'MANUELL' && <span className="text-[9px] opacity-60 shrink-0">M</span>}
                                </span>
                              );
                            }

                            if (suggested) {
                              const label = CATEGORY_TAG_LABELS[suggested] || suggested;
                              return (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600 border border-dashed border-blue-300 max-w-full truncate"
                                  title={`${label} (Vorschlag)${reason ? ` | ${reason}` : ''}`}
                                >
                                  {label}
                                  <span className="text-[9px] opacity-60 shrink-0">?</span>
                                </span>
                              );
                            }

                            return <span className="text-[var(--muted)]">&ndash;</span>;
                          })()}
                        </td>
                      )}

                      {/* 4. Beschreibung (NOT sticky anymore) */}
                      {columnVisibility.description && (
                        <td
                          title={entry.description}
                        >
                          <div className="truncate" style={{ maxWidth: columnWidths.description - 16 }}>
                            <div className="font-medium text-[var(--foreground)] truncate">
                              {isBatchParent && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleBatchExpand(entry.id); }}
                                  className="inline-flex items-center mr-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200 transition-colors"
                                >
                                  {isExpanded ? '▼' : '▶'} Sammelüberweisung ({splitChildren.length})
                                </button>
                              )}
                              {isChild && (
                                <span className="inline-flex items-center mr-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                  ↳ Einzelposten
                                </span>
                              )}
                              {isTransfer && (
                                <span className="inline-flex items-center mr-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
                                  &#8644; Umbuchung
                                </span>
                              )}
                              <span className={isBatchParent ? 'line-through text-gray-400' : ''}>
                                {entry.description}
                              </span>
                            </div>
                            {entry.note && (
                              <div className="text-xs text-[var(--muted)] truncate">
                                {entry.note}
                              </div>
                            )}
                          </div>
                        </td>
                      )}

                      {/* 5. Betrag (NOT sticky anymore) */}
                      {columnVisibility.amountCents && (
                        <td
                          className={`text-right font-mono whitespace-nowrap ${
                            isBatchParent ? "text-gray-400 line-through" : isInflow ? "text-[var(--success)]" : "text-[var(--danger)]"
                          }`}
                        >
                          {formatCurrency(entry.amountCents)}
                        </td>
                      )}

                      {/* 6. Quelle (NOT sticky anymore) */}
                      {columnVisibility.import && (
                        <td
                          className="text-xs truncate"
                          style={{ maxWidth: columnWidths.import }}
                        >
                          {entryWithExtras.importSource ? (
                            <span
                              className="import-filter-trigger cursor-pointer hover:text-[var(--primary)] hover:underline truncate block"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFilterImportJobId(entryWithExtras.importJobId || "");
                              }}
                              title={`${entryWithExtras.importSource}
Klicken zum Filtern`}
                            >
                              {entryWithExtras.importSource}
                            </span>
                          ) : (
                            <span className="text-[var(--muted)]">Manuell</span>
                          )}
                        </td>
                      )}

                      {/* 7. Standort */}
                      {columnVisibility.location && (
                        <td
                          className="text-xs truncate"
                        >
                          {entryWithExtras.locationId ? (
                            <span title={locationsMap.get(entryWithExtras.locationId) || entryWithExtras.locationId}>
                              {locationsMap.get(entryWithExtras.locationId) || entryWithExtras.locationId}
                            </span>
                          ) : (
                            <span className="text-[var(--muted)]">-</span>
                          )}
                        </td>
                      )}

                      {/* 8. Bankkonto */}
                      {columnVisibility.bankAccount && (
                        <td
                          className="text-xs truncate"
                        >
                          {entryWithExtras.bankAccountId ? (
                            <span title={bankAccountsMap.get(entryWithExtras.bankAccountId) || entryWithExtras.bankAccountId}>
                              {bankAccountsMap.get(entryWithExtras.bankAccountId) || entryWithExtras.bankAccountId}
                            </span>
                          ) : (
                            <span className="text-[var(--muted)]">-</span>
                          )}
                        </td>
                      )}

                      {/* 9. Gegenpartei */}
                      {columnVisibility.counterparty && (
                        <td
                          className="text-xs truncate"
                        >
                          {entryWithExtras.counterpartyId ? (
                            <span title={counterpartiesMap.get(entryWithExtras.counterpartyId) || entryWithExtras.counterpartyId}>
                              {counterpartiesMap.get(entryWithExtras.counterpartyId) || entryWithExtras.counterpartyId}
                            </span>
                          ) : (
                            <span className="text-[var(--muted)]">-</span>
                          )}
                        </td>
                      )}

                      {/* 10. Typ */}
                      {columnVisibility.valueType && (
                        <td>
                          <span className={`badge ${getValueTypeBadgeClass(entry.valueType)}`}>
                            {VALUE_TYPE_LABELS[entry.valueType]}
                          </span>
                        </td>
                      )}

                      {/* 11. Alt/Neu */}
                      {columnVisibility.estateAllocation && (
                        <td>
                          {entryWithExtras.estateAllocation ? (
                            <span
                              className={`badge text-xs ${getEstateAllocationBadgeClass(entryWithExtras.estateAllocation)}`}
                              title={`${formatAllocationSource(entryWithExtras.allocationSource)}: ${entryWithExtras.allocationNote || '-'}`}
                            >
                              {ESTATE_ALLOCATION_LABELS[entryWithExtras.estateAllocation] || entryWithExtras.estateAllocation}
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--muted)]">-</span>
                          )}
                        </td>
                      )}

                      {/* 12. Rechtsstatus */}
                      {columnVisibility.legalBucket && (
                        <td>
                          <span className={`badge ${getBucketBadgeClass(entry.legalBucket)}`}>
                            {LEGAL_BUCKET_LABELS[entry.legalBucket]}
                          </span>
                        </td>
                      )}

                      {/* 13. Review */}
                      {columnVisibility.reviewStatus && (
                        <td>
                          <span className={`badge ${getReviewStatusBadgeClass(entry.reviewStatus as ReviewStatus)}`}>
                            {REVIEW_STATUS_LABELS[entry.reviewStatus as ReviewStatus] || entry.reviewStatus}
                          </span>
                        </td>
                      )}

                      {/* Vorschlag (hidden by default) */}
                      {columnVisibility.suggestion && (
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
                      )}

                      {/* Dim.-Vorschlag (hidden by default) */}
                      {columnVisibility.dimSuggestion && (
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
                      )}

                      {/* 14. Aktionen */}
                      <td>
                        <div className="flex items-center gap-1.5">
                          {/* Primary action - Details/Edit */}
                          <Link
                            href={`/admin/cases/${id}/ledger/${entry.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                            title="Bearbeiten"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Bearbeiten
                          </Link>

                          {/* Secondary actions in dropdown */}
                          <div className="relative group">
                            <button
                              className="inline-flex items-center justify-center w-6 h-6 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              title="Weitere Aktionen"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                              </svg>
                            </button>

                            {/* Dropdown menu */}
                            <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                              <div className="py-1">
                                <button
                                  onClick={() => openDetails(entry)}
                                  className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Details
                                </button>
                                {isTransfer && (
                                  <button
                                    onClick={() => handleUnpairTransfer(entry.id)}
                                    className="w-full px-3 py-2 text-left text-xs text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                    Entknüpfen
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteEntry(entry.id, entry.description)}
                                  className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-gray-100"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Löschen
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );

                  // Children-Zeilen nach dem Parent rendern (wenn aufgeklappt)
                  if (isBatchParent && isExpanded && splitChildren.length > 0) {
                    for (const child of splitChildren) {
                      const childAmount = parseInt(child.amountCents);
                      const childIsInflow = childAmount >= 0;
                      rows.push(
                        <tr
                          key={`child-${child.id}`}
                          className="bg-amber-50/30 hover:bg-amber-100/30 transition-colors text-xs border-l-4 border-amber-300"
                        >
                          {/* Checkbox */}
                          <td style={{ position: 'sticky', left: 0, zIndex: 9, backgroundColor: 'rgba(254, 252, 232, 0.3)', boxShadow: '2px 0 4px rgba(0,0,0,0.05)' }}>
                            <span className="text-gray-300 pl-1">↳</span>
                          </td>
                          {/* Datum */}
                          {columnVisibility.transactionDate && (
                            <td style={{ position: 'sticky', left: columnWidths.checkbox, zIndex: 9, backgroundColor: 'rgba(254, 252, 232, 0.3)', boxShadow: '2px 0 4px rgba(0,0,0,0.05)' }} className="whitespace-nowrap text-gray-400">
                              {formatDate(entry.transactionDate)}
                            </td>
                          )}
                          {/* Matrix-Kat */}
                          {columnVisibility.categoryTag && (
                            <td style={{ position: 'sticky', left: columnWidths.checkbox + columnWidths.transactionDate, zIndex: 9, backgroundColor: 'rgba(254, 252, 232, 0.3)', boxShadow: '2px 0 4px rgba(0,0,0,0.05)' }}>
                              {child.categoryTag && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700">
                                  {CATEGORY_TAG_LABELS[child.categoryTag] || child.categoryTag}
                                </span>
                              )}
                            </td>
                          )}
                          {/* Beschreibung */}
                          {columnVisibility.description && (
                            <td>
                              <div className="truncate pl-4" style={{ maxWidth: columnWidths.description - 32 }}>
                                <span className="inline-flex items-center mr-1 px-1 py-0.5 rounded text-[9px] font-medium bg-gray-100 text-gray-500 border border-gray-200">↳</span>
                                {child.description}
                              </div>
                              {child.note && <div className="text-[10px] text-gray-400 pl-4 truncate">{child.note}</div>}
                            </td>
                          )}
                          {/* Betrag */}
                          {columnVisibility.amountCents && (
                            <td className={`text-right font-mono whitespace-nowrap ${childIsInflow ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                              {formatCurrency(child.amountCents)}
                            </td>
                          )}
                          {/* Restliche Spalten: kompakte Darstellung */}
                          {columnVisibility.import && <td className="text-gray-400">-</td>}
                          {columnVisibility.location && <td className="text-gray-500 text-[10px]">{child.locationId || '-'}</td>}
                          {columnVisibility.bankAccount && <td className="text-gray-400">↑</td>}
                          {columnVisibility.counterparty && <td className="text-gray-500 text-[10px] truncate">{child.counterpartyId || '-'}</td>}
                          {columnVisibility.valueType && <td className="text-gray-400">↑</td>}
                          {columnVisibility.estateAllocation && <td className="text-gray-400">↑</td>}
                          {columnVisibility.legalBucket && <td className="text-gray-400">↑</td>}
                          {columnVisibility.reviewStatus && (
                            <td>
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                child.reviewStatus === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                                child.reviewStatus === 'ADJUSTED' ? 'bg-amber-100 text-amber-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {REVIEW_STATUS_LABELS[child.reviewStatus as ReviewStatus] || child.reviewStatus}
                              </span>
                            </td>
                          )}
                          {columnVisibility.suggestion && <td></td>}
                          {columnVisibility.dimSuggestion && <td></td>}
                          <td>
                            <Link
                              href={`/admin/cases/${id}/ledger/${child.id}`}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              Bearbeiten
                            </Link>
                          </td>
                        </tr>
                      );
                    }
                  }

                  return rows;
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Details Modal */}
      {detailsEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailsEntry(null)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Eintrag-Details</h3>
              <button
                onClick={() => setDetailsEntry(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              {(() => {
                const e = detailsEntry as LedgerEntryResponse & {
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
                  bankAccountId?: string | null;
                  counterpartyId?: string | null;
                  locationId?: string | null;
                };
                const amount = parseInt(e.amountCents);
                const isInflow = amount >= 0;
                return (
                  <>
                    {/* Grunddaten */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Grunddaten</h4>
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-gray-500">Datum</dt>
                          <dd className="font-medium">{formatDate(e.transactionDate)}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Betrag</dt>
                          <dd className={`font-mono font-medium ${isInflow ? "text-green-600" : "text-red-600"}`}>
                            {formatCurrency(e.amountCents)}
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-gray-500">Beschreibung</dt>
                          <dd className="font-medium">{e.description}</dd>
                        </div>
                        {e.note && (
                          <div className="col-span-2">
                            <dt className="text-gray-500">Notiz</dt>
                            <dd>{e.note}</dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    {/* Originaldaten aus Kontoauszug */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Originaldaten aus Kontoauszug</h4>
                      {detailsLoading ? (
                        <p className="text-sm text-gray-400">Lade Transaktionsdaten...</p>
                      ) : detailsImportData ? (
                        <dl className="grid grid-cols-1 gap-2 text-sm">
                          {(() => {
                            const raw = detailsImportData;
                            // Canonical schema: core, standard, additional, splitAmount
                            const core = (raw.core || {}) as Record<string, unknown>;
                            const standard = (raw.standard || {}) as Record<string, unknown>;
                            const additional = (raw.additional || {}) as Record<string, unknown>;
                            const splitAmount = (raw.splitAmount || {}) as Record<string, unknown>;

                            const fieldLabels: Record<string, string> = {
                              datum: 'Buchungsdatum',
                              betrag: 'Betrag',
                              bezeichnung: 'Überweisungstext',
                              einzahlung: 'Einzahlung',
                              auszahlung: 'Auszahlung',
                              kategorie: 'Kategorie',
                              zahlungsart: 'Zahlungsart',
                              typ: 'Typ',
                              konto: 'Konto/IBAN',
                              gegenpartei: 'Auftraggeber/Empfänger',
                              referenz: 'Referenz/Buchungsnummer',
                              kommentar: 'Kommentar',
                              notiz: 'Notiz',
                              quelle: 'Quelle',
                              alt_neu_forderung: 'Alt/Neu Forderung',
                              massetyp: 'Massetyp',
                              werttyp: 'Werttyp',
                              unsicherheit: 'Unsicherheit',
                            };

                            const allFields: [string, string][] = [];
                            // Core fields first
                            for (const [k, v] of Object.entries(core)) {
                              if (v != null && String(v).trim()) allFields.push([fieldLabels[k] || k, String(v)]);
                            }
                            // Split amount
                            for (const [k, v] of Object.entries(splitAmount)) {
                              if (v != null && String(v).trim()) allFields.push([fieldLabels[k] || k, String(v)]);
                            }
                            // Standard fields
                            for (const [k, v] of Object.entries(standard)) {
                              if (v != null && String(v).trim()) allFields.push([fieldLabels[k] || k, String(v)]);
                            }
                            // Additional (unmapped) fields
                            for (const [k, v] of Object.entries(additional)) {
                              if (v != null && String(v).trim()) allFields.push([k, String(v)]);
                            }

                            return allFields.map(([label, value], i) => (
                              <div key={i} className="flex gap-3">
                                <dt className="text-gray-500 min-w-[160px] shrink-0">{label}</dt>
                                <dd className="font-medium break-all">{value}</dd>
                              </div>
                            ));
                          })()}
                        </dl>
                      ) : (
                        <p className="text-sm text-gray-400">Keine Import-Daten verfügbar (manueller Eintrag)</p>
                      )}
                    </div>

                    {/* Klassifikation */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Klassifikation</h4>
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-gray-500">Werttyp</dt>
                          <dd><span className={`badge ${getValueTypeBadgeClass(e.valueType)}`}>{VALUE_TYPE_LABELS[e.valueType]}</span></dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Rechtsstatus</dt>
                          <dd><span className={`badge ${getBucketBadgeClass(e.legalBucket)}`}>{LEGAL_BUCKET_LABELS[e.legalBucket]}</span></dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Alt-/Neumasse</dt>
                          <dd>
                            {e.estateAllocation ? (
                              <span className={`badge text-xs ${getEstateAllocationBadgeClass(e.estateAllocation)}`}>
                                {ESTATE_ALLOCATION_LABELS[e.estateAllocation] || e.estateAllocation}
                              </span>
                            ) : "-"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Review-Status</dt>
                          <dd><span className={`badge ${getReviewStatusBadgeClass(e.reviewStatus as ReviewStatus)}`}>{REVIEW_STATUS_LABELS[e.reviewStatus as ReviewStatus]}</span></dd>
                        </div>
                      </dl>
                    </div>

                    {/* Dimensionen */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Dimensionen</h4>
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-gray-500">Bankkonto</dt>
                          <dd>{e.bankAccountId ? bankAccountsMap.get(e.bankAccountId) || e.bankAccountId : "-"}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Gegenpartei</dt>
                          <dd>{e.counterpartyId ? counterpartiesMap.get(e.counterpartyId) || e.counterpartyId : "-"}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Standort</dt>
                          <dd>{e.locationId ? locationsMap.get(e.locationId) || e.locationId : "-"}</dd>
                        </div>
                      </dl>
                    </div>

                    {/* Alt-/Neumasse Zuordnung */}
                    {(e.allocationSource || e.allocationNote) && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Alt-/Neumasse Zuordnung</h4>
                        <dl className="grid grid-cols-1 gap-3 text-sm">
                          {e.allocationSource && (
                            <div>
                              <dt className="text-gray-500">Zuordnungslogik</dt>
                              <dd className="text-sm bg-gray-50 p-2 rounded">{formatAllocationSource(e.allocationSource)}</dd>
                            </div>
                          )}
                          {e.allocationNote && (
                            <div>
                              <dt className="text-gray-500">Zuordnungshinweis</dt>
                              <dd>{e.allocationNote}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    )}

                    {/* Vorschläge */}
                    {(e.suggestedLegalBucket || e.suggestedBankAccountId || e.suggestedCounterpartyId || e.suggestedLocationId) && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Klassifikations-Vorschläge</h4>
                        <dl className="grid grid-cols-2 gap-3 text-sm">
                          {e.suggestedLegalBucket && (
                            <div>
                              <dt className="text-gray-500">Vorgeschlagener Rechtsstatus</dt>
                              <dd className="flex items-center gap-2">
                                <span className="badge badge-info text-xs">{e.suggestedLegalBucket}</span>
                                {e.suggestedConfidence && (
                                  <span className="text-xs text-gray-500">({Math.round(e.suggestedConfidence * 100)}%)</span>
                                )}
                              </dd>
                            </div>
                          )}
                          {e.suggestedReason && (
                            <div className="col-span-2">
                              <dt className="text-gray-500">Begründung</dt>
                              <dd className="text-xs">{e.suggestedReason}</dd>
                            </div>
                          )}
                          {e.suggestedBankAccountId && (
                            <div>
                              <dt className="text-gray-500">Vorgeschlagenes Bankkonto</dt>
                              <dd>{bankAccountsMap.get(e.suggestedBankAccountId) || e.suggestedBankAccountId}</dd>
                            </div>
                          )}
                          {e.suggestedCounterpartyId && (
                            <div>
                              <dt className="text-gray-500">Vorgeschlagene Gegenpartei</dt>
                              <dd>{counterpartiesMap.get(e.suggestedCounterpartyId) || e.suggestedCounterpartyId}</dd>
                            </div>
                          )}
                          {e.suggestedLocationId && (
                            <div>
                              <dt className="text-gray-500">Vorgeschlagener Standort</dt>
                              <dd>{locationsMap.get(e.suggestedLocationId) || e.suggestedLocationId}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    )}

                    {/* Verwendung im System */}
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-blue-800 uppercase mb-3">Verwendung / Berechnungslogik</h4>
                      <div className="text-sm text-blue-900 space-y-2">
                        <p>
                          <strong>Dieser Eintrag wird verwendet in:</strong>
                        </p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>
                            <strong>Rolling Forecast</strong>:
                            {e.valueType === "IST"
                              ? " Als IST-Wert (reale Bankbuchung) - ersetzt PLAN-Werte für diese Periode"
                              : " Als PLAN-Wert (Prognose) - wird von IST-Werten ersetzt sobald verfügbar"
                            }
                          </li>
                          <li>
                            <strong>Liquiditätsübersicht</strong>:
                            {isInflow ? " Einzahlung (+)" : " Auszahlung (-)"}
                            {e.legalBucket === "MASSE" && " → zählt zur Insolvenzmasse"}
                            {e.legalBucket === "ABSONDERUNG" && " → Absonderungsrecht, separat ausgewiesen"}
                            {e.legalBucket === "NEUTRAL" && " → durchlaufender Posten"}
                          </li>
                          {e.estateAllocation && (
                            <li>
                              <strong>Alt-/Neumasse</strong>:
                              {e.estateAllocation === "ALTMASSE" && " Vor Insolvenzeröffnung entstanden → Altmasse-Abrechnung"}
                              {e.estateAllocation === "NEUMASSE" && " Nach Insolvenzeröffnung entstanden → Neumasse"}
                              {e.estateAllocation === "MIXED" && " Teilweise Alt-/Neumasse (anteilig aufgeteilt)"}
                              {e.estateAllocation === "UNKLAR" && " Zuordnung noch offen → muss manuell geklärt werden"}
                            </li>
                          )}
                          {e.locationId && (
                            <li>
                              <strong>Standort-P&L</strong>: Wird dem Standort &quot;{locationsMap.get(e.locationId) || e.locationId}&quot; zugerechnet
                            </li>
                          )}
                        </ul>

                        {e.reviewStatus === "UNREVIEWED" && (
                          <div className="mt-3 p-2 bg-amber-100 rounded text-amber-800 text-xs">
                            <strong>Hinweis:</strong> Dieser Eintrag ist noch nicht geprüft.
                            Ungeprüfte Einträge werden standardmäßig NICHT in Berechnungen einbezogen,
                            es sei denn der Toggle &quot;Ungeprüfte einbeziehen&quot; ist aktiv.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Herkunft */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Herkunft / Import</h4>
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-gray-500">Import-Quelle</dt>
                          <dd>{e.importSource || "-"}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Import-Job-ID</dt>
                          <dd className="font-mono text-xs">{e.importJobId || "-"}</dd>
                        </div>
                        {e.bookingSource && (
                          <div>
                            <dt className="text-gray-500">Buchungsquelle</dt>
                            <dd>{e.bookingSource}</dd>
                          </div>
                        )}
                        {e.bookingReference && (
                          <div>
                            <dt className="text-gray-500">Buchungsreferenz</dt>
                            <dd className="font-mono text-xs">{e.bookingReference}</dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    {/* Technische IDs */}
                    <div className="border-t pt-4">
                      <details className="text-xs text-gray-400">
                        <summary className="cursor-pointer hover:text-gray-600">Technische Details</summary>
                        <dl className="mt-2 space-y-1 font-mono">
                          <div><dt className="inline">Entry-ID:</dt> <dd className="inline">{e.id}</dd></div>
                          <div><dt className="inline">Case-ID:</dt> <dd className="inline">{e.caseId}</dd></div>
                        </dl>
                      </details>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-2">
              <button
                onClick={() => setDetailsEntry(null)}
                className="btn-secondary"
              >
                Schließen
              </button>
              <Link
                href={`/admin/cases/${id}/ledger/${detailsEntry.id}`}
                className="btn-primary"
              >
                Bearbeiten
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ServiceDate Preview Modal */}
      {showServiceDatePreviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  ServiceDate-Vorschläge übernehmen
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Übernimmt Leistungsdaten aus Klassifikationsregeln und berechnet die Alt/Neu-Zuordnung
                </p>
              </div>
              <button
                onClick={() => setShowServiceDatePreviewModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto px-6 py-4">
              {serviceDatePreviewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              ) : serviceDatePreviewEntries.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">Keine Einträge mit ServiceDate-Vorschlägen gefunden.</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Erstellen Sie zuerst Klassifikationsregeln mit ServiceDate-Zuordnung.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-sm text-purple-800">
                      <strong>{serviceDatePreviewEntries.length}</strong> Einträge mit ServiceDate-Vorschlägen gefunden.
                      Bei Übernahme wird automatisch die Alt/Neu-Zuordnung basierend auf dem Stichtag berechnet.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Datum</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Beschreibung</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-700">Betrag</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Regel</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Vorgeschlagenes Leistungsdatum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {serviceDatePreviewEntries.slice(0, 50).map((entry) => {
                          const ext = entry as LedgerEntryResponse & {
                            suggestedServiceDate?: string | null;
                            suggestedServicePeriodStart?: string | null;
                            suggestedServicePeriodEnd?: string | null;
                            suggestedServiceDateRule?: string | null;
                            suggestedReason?: string | null;
                          };
                          return (
                            <tr key={entry.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 whitespace-nowrap">
                                {new Date(entry.transactionDate).toLocaleDateString("de-DE")}
                              </td>
                              <td className="px-3 py-2 max-w-[200px] truncate" title={entry.description}>
                                {entry.description}
                              </td>
                              <td className={`px-3 py-2 text-right whitespace-nowrap ${parseInt(entry.amountCents) >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {formatCurrency(entry.amountCents)}
                              </td>
                              <td className="px-3 py-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                  {ext.suggestedServiceDateRule === "VORMONAT" && "Vormonat"}
                                  {ext.suggestedServiceDateRule === "SAME_MONTH" && "Gleicher Monat"}
                                  {ext.suggestedServiceDateRule === "PREVIOUS_QUARTER" && "Vorquartal"}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                {ext.suggestedServiceDate ? (
                                  <span className="font-medium">
                                    {new Date(ext.suggestedServiceDate).toLocaleDateString("de-DE")}
                                  </span>
                                ) : ext.suggestedServicePeriodStart && ext.suggestedServicePeriodEnd ? (
                                  <span className="font-medium">
                                    {new Date(ext.suggestedServicePeriodStart).toLocaleDateString("de-DE")} - {new Date(ext.suggestedServicePeriodEnd).toLocaleDateString("de-DE")}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {serviceDatePreviewEntries.length > 50 && (
                    <p className="mt-4 text-sm text-gray-500 text-center">
                      ... und {serviceDatePreviewEntries.length - 50} weitere Einträge
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowServiceDatePreviewModal(false)}
                className="btn-secondary"
                disabled={bulkProcessing}
              >
                Abbrechen
              </button>
              <button
                onClick={handleApplyServiceDateSuggestions}
                disabled={bulkProcessing || serviceDatePreviewEntries.length === 0}
                className="btn-primary bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
              >
                {bulkProcessing ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Übernehme...
                  </span>
                ) : (
                  `Alle ${serviceDatePreviewEntries.length} übernehmen`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Selection Summary Bar - appears when entries are selected */}
      {selectedEntries.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-blue-600 text-white shadow-2xl border-t-4 border-blue-700">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span className="font-semibold text-lg">{selectionSummary.count} Einträge ausgewählt</span>
                </div>
                <div className="h-8 w-px bg-blue-400"></div>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xs text-blue-200">Einzahlungen</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(selectionSummary.totalInflows.toString())}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-200">Auszahlungen</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(selectionSummary.totalOutflows.toString())}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-200">Netto</p>
                    <p className={`text-lg font-bold ${
                      selectionSummary.netAmount >= BigInt(0) ? "text-green-300" : "text-red-300"
                    }`}>
                      {formatCurrency(selectionSummary.netAmount.toString())}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedEntries(new Set())}
                className="px-4 py-2 bg-white text-blue-600 rounded-md font-medium hover:bg-blue-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Auswahl aufheben
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
