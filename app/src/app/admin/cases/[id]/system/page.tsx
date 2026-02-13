"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

// =============================================================================
// Types
// =============================================================================

interface DataQuality {
  totalIST: number;
  totalPLAN: number;
  confirmedPct: number;
  estateBreakdown: { ALTMASSE: number; NEUMASSE: number; MIXED: number; UNKLAR: number };
  dateRange: { from: string; to: string } | null;
  bankCount: number;
  counterpartyPct: number;
}

interface CheckItem {
  entryId: string;
  description: string;
  [key: string]: unknown;
}

interface CheckResult {
  id: string;
  title: string;
  severity: "error" | "warning";
  passed: boolean;
  checked: number;
  failed: number;
  skipped: number;
  totalItems: number;
  shownItems: number;
  items: CheckItem[];
  description: string;
}

interface ConsistencyData {
  caseId: string;
  validatedAt: string;
  allPassed: boolean;
  summary: { errors: number; warnings: number; passed: number; skipped: number };
  checks: Record<string, CheckResult>;
}

interface AggregationData {
  status: "CURRENT" | "STALE" | "REBUILDING";
  reason?: string;
  pendingChanges: number;
  lastAggregatedAt: string | null;
  activePlanId: string | null;
  activePlanName: string | null;
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

interface ShareLink {
  id: string;
  label: string;
  isActive: boolean;
  expiresAt: string | null;
  accessCount: number;
  lastAccessAt: string | null;
  createdAt: string;
}

// =============================================================================
// Helpers
// =============================================================================

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCents(cents: string): string {
  const num = parseInt(cents, 10);
  if (isNaN(num)) return "0,00 €";
  return (num / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    CURRENT: "bg-green-100 text-green-800",
    STALE: "bg-amber-100 text-amber-800",
    REBUILDING: "bg-blue-100 text-blue-800",
  };
  const labels: Record<string, string> = {
    CURRENT: "Aktuell",
    STALE: "Veraltet",
    REBUILDING: "Wird berechnet",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-800"}`}>
      {labels[status] || status}
    </span>
  );
}

// =============================================================================
// Component
// =============================================================================

export default function SystemHealthPage() {
  const params = useParams();
  const caseId = params.id as string;
  const base = `/admin/cases/${caseId}`;

  const [dataQuality, setDataQuality] = useState<DataQuality | null>(null);
  const [consistency, setConsistency] = useState<ConsistencyData | null>(null);
  const [aggregation, setAggregation] = useState<AggregationData | null>(null);
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAll = useCallback(async () => {
    try {
      const opts = { credentials: "include" as RequestCredentials };
      const [dqRes, conRes, aggRes, impRes, shareRes] = await Promise.all([
        fetch(`/api/cases/${caseId}/data-quality`, opts),
        fetch(`/api/cases/${caseId}/validate-consistency`, opts),
        fetch(`/api/cases/${caseId}/aggregation?stats=true`, opts),
        fetch(`/api/cases/${caseId}/import-jobs`, opts),
        fetch(`/api/cases/${caseId}/share`, opts),
      ]);

      if (dqRes.ok) setDataQuality(await dqRes.json());
      if (conRes.ok) setConsistency(await conRes.json());
      if (aggRes.ok) setAggregation(await aggRes.json());
      if (impRes.ok) {
        const data = await impRes.json();
        setImportJobs(data.importJobs || []);
      }
      if (shareRes.ok) setShareLinks(await shareRes.json());

      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError("Fehler beim Laden der Systemdaten");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/aggregation/rebuild`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        // Kurz warten, dann neu laden
        setTimeout(fetchAll, 1000);
      }
    } catch (e) {
      console.error("Rebuild fehlgeschlagen:", e);
    } finally {
      setRebuilding(false);
    }
  };

  const toggleCheck = (id: string) => {
    setExpandedChecks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-[var(--foreground)]">System</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !dataQuality && !consistency) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 mb-3">{error}</p>
          <button onClick={fetchAll} className="text-sm text-red-600 hover:text-red-800 font-medium underline">
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  // Consistency checks sortiert: Fehler → Warnungen → OK
  const sortedChecks = consistency
    ? Object.values(consistency.checks).sort((a, b) => {
        if (a.passed !== b.passed) return a.passed ? 1 : -1;
        if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
        return 0;
      })
    : [];

  const failedChecks = sortedChecks.filter((c) => !c.passed);
  const passedChecks = sortedChecks.filter((c) => c.passed);

  // Share-Link Statistiken
  const activeLinks = shareLinks.filter((l) => l.isActive);
  const expiredLinks = shareLinks.filter(
    (l) => l.isActive && l.expiresAt && new Date(l.expiresAt) < new Date()
  );

  // Letzter Import
  const lastImport = importJobs.length > 0 ? importJobs[0] : null;

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">System</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Zuletzt aktualisiert: {formatDateTime(lastRefresh.toISOString())} · Auto-Refresh alle 30s
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="text-sm text-[var(--primary)] hover:underline font-medium"
        >
          Jetzt aktualisieren
        </button>
      </div>

      {/* ================================================================= */}
      {/* SEKTION A: Daten-Übersicht */}
      {/* ================================================================= */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
          Daten-Übersicht
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* IST-Buchungen */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <div className="text-xs text-[var(--muted)] font-medium uppercase tracking-wide">IST-Buchungen</div>
            <div className="mt-2 text-2xl font-bold text-[var(--foreground)]">
              {dataQuality?.totalIST ?? "–"}
            </div>
            {dataQuality?.dateRange && (
              <p className="text-xs text-[var(--muted)] mt-1">
                {formatDate(dataQuality.dateRange.from)} – {formatDate(dataQuality.dateRange.to)}
              </p>
            )}
            {dataQuality && dataQuality.totalPLAN > 0 && (
              <p className="text-xs text-[var(--muted)] mt-0.5">
                + {dataQuality.totalPLAN} PLAN-Einträge
              </p>
            )}
          </div>

          {/* Review-Status */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <div className="text-xs text-[var(--muted)] font-medium uppercase tracking-wide">Review-Status</div>
            <div className="mt-2 text-2xl font-bold text-[var(--foreground)]">
              {dataQuality?.confirmedPct ?? 0}%
            </div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  (dataQuality?.confirmedPct ?? 0) >= 80
                    ? "bg-green-500"
                    : (dataQuality?.confirmedPct ?? 0) >= 50
                      ? "bg-amber-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${dataQuality?.confirmedPct ?? 0}%` }}
              />
            </div>
            <p className="text-xs text-[var(--muted)] mt-1">bestätigt</p>
          </div>

          {/* Gegenpartei-Zuordnung */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <div className="text-xs text-[var(--muted)] font-medium uppercase tracking-wide">Gegenpartei-Zuordnung</div>
            <div className="mt-2 text-2xl font-bold text-[var(--foreground)]">
              {dataQuality?.counterpartyPct ?? 0}%
            </div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  (dataQuality?.counterpartyPct ?? 0) >= 80 ? "bg-green-500" : "bg-amber-500"
                }`}
                style={{ width: `${dataQuality?.counterpartyPct ?? 0}%` }}
              />
            </div>
            <p className="text-xs text-[var(--muted)] mt-1">zugeordnet</p>
          </div>

          {/* Alt/Neu-Verteilung */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <div className="text-xs text-[var(--muted)] font-medium uppercase tracking-wide">Alt/Neu-Verteilung</div>
            {dataQuality?.estateBreakdown ? (
              <>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-teal-700">Altmasse</span>
                    <span className="font-medium">{dataQuality.estateBreakdown.ALTMASSE}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-blue-700">Neumasse</span>
                    <span className="font-medium">{dataQuality.estateBreakdown.NEUMASSE}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-purple-700">Mixed</span>
                    <span className="font-medium">{dataQuality.estateBreakdown.MIXED}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className={dataQuality.estateBreakdown.UNKLAR > 0 ? "text-red-600 font-medium" : "text-gray-500"}>
                      Unklar
                    </span>
                    <span className={`font-medium ${dataQuality.estateBreakdown.UNKLAR > 0 ? "text-red-600" : ""}`}>
                      {dataQuality.estateBreakdown.UNKLAR}
                    </span>
                  </div>
                </div>
                {dataQuality.estateBreakdown.UNKLAR > 0 && (
                  <p className="text-xs text-red-600 mt-1.5">
                    {dataQuality.estateBreakdown.UNKLAR} Buchungen ohne Zuordnung
                  </p>
                )}
              </>
            ) : (
              <div className="mt-2 text-sm text-[var(--muted)]">–</div>
            )}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* SEKTION B: Konfigurationsprüfung */}
      {/* ================================================================= */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider">
            Konfigurationsprüfung
          </h2>
          {consistency && (
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              {failedChecks.length === 0 ? (
                <span className="text-green-700 font-medium">Alle Checks bestanden</span>
              ) : (
                <>
                  {consistency.summary.errors > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      {consistency.summary.errors} Fehler
                    </span>
                  )}
                  {consistency.summary.warnings > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      {consistency.summary.warnings} Warnungen
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {/* Fehlgeschlagene Checks */}
          {failedChecks.map((check) => (
            <div
              key={check.id}
              className={`bg-[var(--card)] border rounded-lg overflow-hidden ${
                check.severity === "error" ? "border-red-300" : "border-amber-300"
              }`}
            >
              <button
                onClick={() => toggleCheck(check.id)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--accent)]/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  {check.severity === "error" ? (
                    <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                    </svg>
                  )}
                  <span className="text-sm font-medium text-[var(--foreground)]">{check.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${check.severity === "error" ? "text-red-700" : "text-amber-700"}`}>
                    {check.failed} {check.severity === "error" ? "Fehler" : "Warnungen"}
                  </span>
                  <svg
                    className={`w-4 h-4 text-[var(--muted)] transition-transform ${expandedChecks.has(check.id) ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              {expandedChecks.has(check.id) && (
                <div className="px-4 pb-3 border-t border-[var(--border)]">
                  <p className="text-xs text-[var(--muted)] mt-2 mb-2">{check.description}</p>
                  {check.skipped > 0 && (
                    <p className="text-xs text-[var(--muted)] mb-2">
                      ({check.skipped} übersprungen)
                    </p>
                  )}
                  <div className="space-y-1">
                    {check.items.map((item, idx) => (
                      <div key={idx} className="text-xs py-1 px-2 bg-[var(--accent)]/50 rounded text-[var(--secondary)]">
                        {item.description}
                      </div>
                    ))}
                    {check.totalItems > check.shownItems && (
                      <p className="text-xs text-[var(--muted)] italic">
                        … und {check.totalItems - check.shownItems} weitere
                      </p>
                    )}
                  </div>
                  <div className="mt-2">
                    <Link
                      href={
                        check.id === "counterpartiesWithoutPattern"
                          ? `${base}/counterparties?filter=NO_PATTERN`
                          : `${base}/ledger`
                      }
                      className="text-xs text-[var(--primary)] hover:underline font-medium"
                    >
                      {check.id === "counterpartiesWithoutPattern"
                        ? "Gegenparteien verwalten →"
                        : "Im Ledger zeigen →"}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Bestandene Checks */}
          {passedChecks.length > 0 && (
            <div className="bg-[var(--card)] border border-green-200 rounded-lg">
              <div className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-green-800">
                    {passedChecks.length} {passedChecks.length === 1 ? "Check" : "Checks"} bestanden
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {passedChecks.map((check) => (
                    <span key={check.id} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                      {check.title}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ================================================================= */}
      {/* SEKTION C: System-Status */}
      {/* ================================================================= */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
          System-Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* C1: Aggregation */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Aggregation</h3>
              {aggregation && <StatusBadge status={aggregation.status} />}
            </div>
            {aggregation ? (
              <div className="space-y-2 text-xs text-[var(--secondary)]">
                {aggregation.pendingChanges > 0 && (
                  <div className="flex justify-between">
                    <span>Ausstehende Änderungen</span>
                    <span className="font-medium text-amber-700">{aggregation.pendingChanges}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Letzter Rebuild</span>
                  <span className="font-medium">
                    {aggregation.lastAggregatedAt
                      ? formatDateTime(aggregation.lastAggregatedAt)
                      : "Nie"}
                  </span>
                </div>
                {aggregation.activePlanName && (
                  <div className="flex justify-between">
                    <span>Aktiver Plan</span>
                    <span className="font-medium">{aggregation.activePlanName}</span>
                  </div>
                )}
                <button
                  onClick={handleRebuild}
                  disabled={rebuilding || aggregation.status === "REBUILDING"}
                  className="mt-2 w-full text-center py-1.5 rounded text-xs font-medium bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {rebuilding ? "Wird berechnet…" : "Jetzt aktualisieren"}
                </button>
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)]">Nicht verfügbar</p>
            )}
          </div>

          {/* C2: Letzter Import */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Importe</h3>
              <span className="text-xs text-[var(--muted)]">{importJobs.length} gesamt</span>
            </div>
            {lastImport ? (
              <div className="space-y-2 text-xs text-[var(--secondary)]">
                <div className="flex justify-between">
                  <span>Letzter Import</span>
                  <span className="font-medium">{formatDate(lastImport.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Quelle</span>
                  <span className="font-medium truncate ml-2 max-w-[140px]" title={lastImport.importSource || "–"}>
                    {lastImport.importSource || "–"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Einträge</span>
                  <span className="font-medium">{lastImport.entryCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Summe</span>
                  <span className="font-medium">{formatCents(lastImport.totalAmountCents)}</span>
                </div>
                <Link
                  href={`${base}/ingestion`}
                  className="block mt-2 text-center py-1.5 rounded text-xs font-medium text-[var(--primary)] border border-[var(--primary)]/30 hover:bg-[var(--primary)]/5 transition-colors"
                >
                  Alle Importe anzeigen →
                </Link>
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)]">Keine Importe vorhanden</p>
            )}
          </div>

          {/* C3: Freigaben */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Freigaben</h3>
              <span className="text-xs text-[var(--muted)]">{shareLinks.length} gesamt</span>
            </div>
            {shareLinks.length > 0 ? (
              <div className="space-y-2 text-xs text-[var(--secondary)]">
                <div className="flex justify-between">
                  <span>Aktive Links</span>
                  <span className="font-medium text-green-700">{activeLinks.length}</span>
                </div>
                {expiredLinks.length > 0 && (
                  <div className="flex justify-between">
                    <span>Abgelaufen</span>
                    <span className="font-medium text-red-600">{expiredLinks.length}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Inaktive Links</span>
                  <span className="font-medium">{shareLinks.filter((l) => !l.isActive).length}</span>
                </div>
                {shareLinks.some((l) => l.lastAccessAt) && (
                  <div className="flex justify-between">
                    <span>Letzter Zugriff</span>
                    <span className="font-medium">
                      {formatDateTime(
                        shareLinks
                          .filter((l) => l.lastAccessAt)
                          .sort((a, b) => new Date(b.lastAccessAt!).getTime() - new Date(a.lastAccessAt!).getTime())[0]
                          ?.lastAccessAt || ""
                      )}
                    </span>
                  </div>
                )}
                <Link
                  href={`${base}/freigaben`}
                  className="block mt-2 text-center py-1.5 rounded text-xs font-medium text-[var(--primary)] border border-[var(--primary)]/30 hover:bg-[var(--primary)]/5 transition-colors"
                >
                  Freigaben verwalten →
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-xs text-[var(--muted)] mb-2">Keine Freigaben erstellt</p>
                <Link
                  href={`${base}/freigaben`}
                  className="text-xs text-[var(--primary)] hover:underline font-medium"
                >
                  Freigabe erstellen →
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
