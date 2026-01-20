"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CasesError({ error, reset }: ErrorProps) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error("Cases page error:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
  }, [error]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Fälle</h1>
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
            Fälle konnten nicht geladen werden
          </h2>
          <p className="text-[var(--secondary)] mb-6">
            Die Daten konnten nicht abgerufen werden. Dies kann an einer Verbindungsstörung
            oder einem temporären Problem liegen.
          </p>

          {/* Error Details - immer sichtbar für Debugging */}
          <div className="text-left bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-red-800 mb-2">Fehler-Details:</p>
            <p className="text-xs text-red-700 font-mono mb-1">
              <span className="text-red-500">Name:</span> {error.name || "Unbekannt"}
            </p>
            <p className="text-xs text-red-700 font-mono mb-2">
              <span className="text-red-500">Nachricht:</span> {error.message || "Keine Nachricht"}
            </p>
            {error.digest && (
              <p className="text-xs text-red-700 font-mono mb-2">
                <span className="text-red-500">Referenz:</span> {error.digest}
              </p>
            )}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-red-600 underline"
            >
              {showDetails ? "Stack-Trace verbergen" : "Stack-Trace anzeigen"}
            </button>
            {showDetails && error.stack && (
              <pre className="text-xs text-red-600 mt-2 whitespace-pre-wrap overflow-auto max-h-40 bg-red-100 p-2 rounded">
                {error.stack}
              </pre>
            )}
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={reset} className="btn-primary">
              Erneut laden
            </button>
            <Link href="/admin" className="btn-secondary">
              Zur Übersicht
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
