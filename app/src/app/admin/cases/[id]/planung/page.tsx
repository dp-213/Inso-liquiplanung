"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function PlanungPage() {
  const params = useParams();
  const rawId = params.id;
  const caseId = Array.isArray(rawId) ? rawId[0] : rawId;

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center text-sm text-[var(--muted)]">
        <Link href="/admin/cases" className="hover:text-[var(--primary)]">
          Fälle
        </Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link href={`/admin/cases/${caseId}`} className="hover:text-[var(--primary)]">
          Fall
        </Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[var(--foreground)]">Planung</span>
      </div>

      {/* Feature in Entwicklung */}
      <div className="admin-card p-8 text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">Planung wird migriert</h1>
        <p className="text-[var(--secondary)] mb-6 max-w-lg mx-auto">
          Die Planungsansicht wird gerade auf die neue Datenbank-Architektur migriert.
          Die Daten sind bereits in der Datenbank gespeichert (PLAN-Einträge im Ledger).
        </p>
        <p className="text-sm text-[var(--muted)] mb-6">
          Feature wird in einer kommenden Version verfügbar sein.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href={`/admin/cases/${caseId}`} className="btn-secondary">
            ← Zurück zum Fall
          </Link>
          <Link href={`/admin/cases/${caseId}/ledger`} className="btn-primary">
            Zum Ledger (PLAN-Einträge) →
          </Link>
        </div>
      </div>
    </div>
  );
}
