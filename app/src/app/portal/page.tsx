"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface CaseAccess {
  id: string;
  caseNumber: string;
  debtorName: string;
  courtName: string;
  status: string;
  projectName: string;
  accessLevel: string;
  grantedAt: string;
  hasPlan: boolean;
  latestVersion: number | null;
}

export default function PortalDashboard() {
  const [cases, setCases] = useState<CaseAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCases() {
      try {
        const response = await fetch("/api/portal/cases");
        if (!response.ok) {
          throw new Error("Failed to fetch cases");
        }
        const data = await response.json();
        setCases(data.cases);
      } catch {
        setError("Faelle konnten nicht geladen werden");
      } finally {
        setLoading(false);
      }
    }

    fetchCases();
  }, []);

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "PRELIMINARY":
        return "Vorlaeufig";
      case "OPENED":
        return "Eroeffnet";
      case "CLOSED":
        return "Geschlossen";
      default:
        return status;
    }
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case "PRELIMINARY":
        return "badge-warning";
      case "OPENED":
        return "badge-success";
      case "CLOSED":
        return "badge-neutral";
      default:
        return "badge-info";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Meine Faelle
          </h1>
          <p className="text-[var(--secondary)] mt-1">
            Liquiditaetsplaene Ihrer zugewiesenen Insolvenzverfahren
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="admin-card p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-100 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-gray-100 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Meine Faelle
          </h1>
        </div>
        <div className="admin-card p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
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
          </div>
          <p className="text-[var(--secondary)]">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary mt-4"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Meine Faelle
        </h1>
        <p className="text-[var(--secondary)] mt-1">
          Liquiditaetsplaene Ihrer zugewiesenen Insolvenzverfahren
        </p>
      </div>

      {cases.length === 0 ? (
        <div className="admin-card p-8 text-center">
          <svg
            className="w-16 h-16 text-[var(--muted)] mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            Keine Faelle zugewiesen
          </h2>
          <p className="text-[var(--secondary)]">
            Ihnen wurden noch keine Insolvenzverfahren zur Einsicht freigegeben.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.map((caseItem) => (
            <Link
              key={caseItem.id}
              href={`/portal/cases/${caseItem.id}`}
              className="admin-card p-6 hover:shadow-lg transition-shadow block"
            >
              <div className="flex items-start justify-between mb-3">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  {caseItem.debtorName}
                </h2>
                <span
                  className={`badge ${getStatusBadgeClass(caseItem.status)}`}
                >
                  {getStatusLabel(caseItem.status)}
                </span>
              </div>
              <div className="space-y-1 text-sm text-[var(--secondary)] mb-4">
                <p>Aktenzeichen: {caseItem.caseNumber}</p>
                <p>Gericht: {caseItem.courtName}</p>
              </div>
              {caseItem.hasPlan ? (
                <div className="flex items-center text-sm text-[var(--success)]">
                  <svg
                    className="w-4 h-4 mr-1"
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
                  Liquiditaetsplan verfuegbar
                  {caseItem.latestVersion && (
                    <span className="ml-1">(v{caseItem.latestVersion})</span>
                  )}
                </div>
              ) : (
                <div className="flex items-center text-sm text-[var(--muted)]">
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Plan in Vorbereitung
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
