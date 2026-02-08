"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function FinanzierungPage() {
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
        <span className="text-[var(--foreground)]">Finanzierung</span>
      </div>

      {/* Feature in Entwicklung */}
      <div className="admin-card p-8 text-center">
        <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">Finanzierungsübersicht folgt</h1>
        <p className="text-[var(--secondary)] mb-6 max-w-lg mx-auto">
          Die Finanzierungsübersicht (Massekredit, Darlehen, Zinsen) wird in einer zukünftigen Version implementiert.
        </p>
        <p className="text-sm text-[var(--muted)] mb-6">
          Benötigte Daten: Massekreditvertrag, Darlehensbedingungen, monatliche Belastungen
        </p>
        <Link href={`/admin/cases/${caseId}`} className="btn-primary">
          ← Zurück zum Fall
        </Link>
      </div>
    </div>
  );
}
