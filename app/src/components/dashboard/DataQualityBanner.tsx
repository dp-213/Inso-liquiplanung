"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// =============================================================================
// Types
// =============================================================================

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

// =============================================================================
// Component
// =============================================================================

interface DataQualityBannerProps {
  caseId: string;
}

export default function DataQualityBanner({ caseId }: DataQualityBannerProps) {
  const [data, setData] = useState<ConsistencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchData = () => {
    setLoading(true);
    setError(false);
    fetch(`/api/cases/${caseId}/validate-consistency`, { credentials: "include" })
      .then(r => (r.ok ? r.json() : Promise.reject(r)))
      .then((result: ConsistencyData) => {
        setData(result);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  // Loading-Skeleton
  if (loading) {
    return (
      <div className="no-print bg-gray-50 border border-gray-200 rounded-lg p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-64" />
        </div>
      </div>
    );
  }

  // Error-State: "Check nicht verfügbar" + Retry
  if (error) {
    return (
      <div className="no-print bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-gray-600">Datenqualitäts-Check nicht verfügbar</span>
          </div>
          <button
            onClick={fetchData}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  // allPassed → kein Banner
  if (!data || data.allPassed) {
    return null;
  }

  const { summary, checks } = data;
  const totalProblems = summary.errors + summary.warnings;
  const hasErrors = summary.errors > 0;

  // Sortiere: Fehler zuerst, dann Warnungen, dann OK
  const sortedChecks = Object.values(checks).sort((a, b) => {
    if (a.passed !== b.passed) return a.passed ? 1 : -1;
    if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
    return 0;
  });

  return (
    <div
      className={`no-print rounded-lg border-l-4 ${
        hasErrors
          ? "bg-red-50 border-red-500"
          : "bg-amber-50 border-amber-500"
      }`}
    >
      {/* Header – immer sichtbar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-5 h-5 ${hasErrors ? "text-red-600" : "text-amber-600"}`}
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
          <span className={`text-sm font-semibold ${hasErrors ? "text-red-800" : "text-amber-800"}`}>
            {totalProblems} Datenqualitäts-{totalProblems === 1 ? "Problem" : "Probleme"} gefunden
          </span>
          {summary.errors > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-200 text-red-900">
              {summary.errors} Fehler
            </span>
          )}
          {summary.warnings > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-200 text-amber-900">
              {summary.warnings} {summary.warnings === 1 ? "Warnung" : "Warnungen"}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 transition-transform ${expanded ? "rotate-180" : ""} ${
            hasErrors ? "text-red-600" : "text-amber-600"
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Details – aufklappbar */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {sortedChecks.map((check) => (
            <div
              key={check.id}
              className={`rounded-md px-3 py-2 text-sm ${
                check.passed
                  ? "bg-green-50 text-green-800"
                  : check.severity === "error"
                    ? "bg-red-100 text-red-900"
                    : "bg-amber-100 text-amber-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {check.passed ? (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : check.severity === "error" ? (
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                    </svg>
                  )}
                  <span className="font-medium">{check.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  {check.passed ? (
                    <span className="text-xs">OK</span>
                  ) : (
                    <span className="text-xs font-medium">
                      {check.failed} {check.severity === "error" ? "Fehler" : "Warnungen"}
                    </span>
                  )}
                </div>
              </div>
              {check.skipped > 0 && (
                <p className="text-xs mt-1 opacity-75">
                  ({check.skipped} übersprungen{check.id === "estateAllocationQuarter" ? ": Quartal nicht bestimmbar" : check.id === "patternMatchValidation" ? ": ohne Pattern" : check.id === "counterpartiesWithoutPattern" ? ": unter Schwelle" : ""})
                </p>
              )}
              {!check.passed && (
                <div className="mt-1">
                  <Link
                    href={check.id === "counterpartiesWithoutPattern"
                      ? `/admin/cases/${caseId}/counterparties?filter=NO_PATTERN`
                      : `/admin/cases/${caseId}/ledger`}
                    className="text-xs underline font-medium hover:opacity-80"
                  >
                    {check.id === "counterpartiesWithoutPattern"
                      ? "Gegenparteien verwalten →"
                      : "Im Ledger zeigen →"}
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
