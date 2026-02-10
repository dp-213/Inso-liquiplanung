"use client";

export default function ZahlungsverifikationPage() {
  return (
    <div className="space-y-6">
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
      </div>
    </div>
  );
}
