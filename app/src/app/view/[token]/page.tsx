"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ExternalHeader from "@/components/external/ExternalHeader";
import UnifiedCaseDashboard from "@/components/dashboard/UnifiedCaseDashboard";
import { CaseDashboardData } from "@/types/dashboard";

export default function ExternalCaseView() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<CaseDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/share/${token}`);
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || "Fehler beim Laden der Daten");
          return;
        }
        const shareData = await response.json();
        setData(shareData);
      } catch {
        setError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchData();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-[var(--secondary)]">Liquiditätsplan wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="admin-card p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">Zugang nicht möglich</h1>
          <p className="text-[var(--secondary)]">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <ExternalHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <UnifiedCaseDashboard
          data={data}
          accessMode="external"
        />
      </main>
    </div>
  );
}
