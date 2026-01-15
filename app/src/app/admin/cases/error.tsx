"use client";

import { useEffect } from "react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CasesError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Cases page error:", error);
  }, [error]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Faelle</h1>
          <p className="text-[var(--secondary)] mt-1">
            Alle Insolvenzverfahren verwalten
          </p>
        </div>
      </div>

      <div className="admin-card p-8">
        <div className="max-w-lg mx-auto text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-yellow-600"
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
          <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">
            Faelle konnten nicht geladen werden
          </h2>
          <p className="text-[var(--secondary)] mb-6">
            Die Daten konnten nicht abgerufen werden. Dies kann an einer Verbindungsstorung
            oder einem temporaren Problem liegen.
          </p>
          {error.digest && (
            <p className="text-xs text-[var(--muted)] mb-4 font-mono bg-gray-50 p-2 rounded">
              Fehler-Referenz: {error.digest}
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <button onClick={reset} className="btn-primary">
              Erneut laden
            </button>
            <Link href="/admin" className="btn-secondary">
              Zur Ubersicht
            </Link>
          </div>
        </div>
      </div>

      {/* Fallback empty state */}
      <div className="admin-card">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <div className="h-5 bg-gray-100 rounded w-32 animate-pulse"></div>
        </div>
        <div className="p-8 text-center text-[var(--muted)]">
          <p>Daten werden nach erfolgreicher Verbindung angezeigt.</p>
        </div>
      </div>
    </div>
  );
}
