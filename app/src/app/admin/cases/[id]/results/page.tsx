"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import UnifiedCaseDashboard from "@/components/dashboard/UnifiedCaseDashboard";
import { CaseDashboardData } from "@/types/dashboard";

export default function AdminDashboardPage() {
  const params = useParams();
  // Sicherstellen dass caseId ein String ist (nicht Array)
  const rawId = params.id;
  const caseId = Array.isArray(rawId) ? rawId[0] : rawId;
  const [data, setData] = useState<CaseDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/cases/${caseId}/dashboard`);
        if (!response.ok) {
          const errorData = await response.json();
          const errorMsg = errorData.details
            ? `${errorData.error}: ${errorData.details}`
            : errorData.error || "Fehler beim Laden der Daten";
          setError(errorMsg);
          return;
        }
        const dashboardData = await response.json();
        setData(dashboardData);
      } catch {
        setError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
      } finally {
        setLoading(false);
      }
    }
    if (caseId) fetchData();
  }, [caseId]);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center text-sm text-[var(--muted)]">
          <Link href="/admin/cases" className="hover:text-[var(--primary)]">Fälle</Link>
          <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-[var(--foreground)]">Wird geladen...</span>
        </div>
        <div className="admin-card p-8 text-center">
          <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-[var(--secondary)]">Liquiditätsplan wird geladen...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center text-sm text-[var(--muted)]">
          <Link href="/admin/cases" className="hover:text-[var(--primary)]">Fälle</Link>
          <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-[var(--foreground)]">Fehler</span>
        </div>
        <div className="admin-card p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">Fehler beim Laden</h1>
          <p className="text-[var(--secondary)] mb-4">{error}</p>
          <Link href="/admin/cases" className="btn-primary">Zurück zur Übersicht</Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-[var(--muted)]">
        <Link href="/admin/cases" className="hover:text-[var(--primary)]">Fälle</Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link href={`/admin/cases/${caseId}`} className="hover:text-[var(--primary)]">
          {data.case.debtorName}
        </Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[var(--foreground)]">Dashboard</span>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-end gap-2">
        <Link
          href={`/admin/cases/${caseId}/kontobewegungen`}
          className="btn-secondary text-sm py-1.5 px-3 flex items-center"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          IST
        </Link>
        <Link
          href={`/admin/cases/${caseId}/ledger`}
          className="btn-secondary text-sm py-1.5 px-3 flex items-center"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          Ledger
        </Link>
      </div>

      {/* Dashboard Content */}
      <UnifiedCaseDashboard
        data={data}
        accessMode="admin"
        caseId={caseId}
      />
    </div>
  );
}
