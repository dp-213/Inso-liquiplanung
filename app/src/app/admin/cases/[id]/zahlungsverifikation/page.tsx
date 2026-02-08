"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function ZahlungsverifikationPage() {
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
        <span className="text-[var(--foreground)]">Zahlungsverifikation</span>
      </div>

      {/* Feature in Entwicklung */}
      <div className="admin-card p-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">Zahlungsverifikation folgt</h1>
        <p className="text-[var(--secondary)] mb-6 max-w-lg mx-auto">
          Die Zahlungsverifikation (SOLL vs. IST) wird in einer zukünftigen Version implementiert.
        </p>
        <p className="text-sm text-[var(--muted)] mb-6">
          Feature: Automatischer Abgleich zwischen erwarteten und tatsächlichen Zahlungen
        </p>
        <Link href={`/admin/cases/${caseId}`} className="btn-primary">
          ← Zurück zum Fall
        </Link>
      </div>
    </div>
  );
}
