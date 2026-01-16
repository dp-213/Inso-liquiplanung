"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
      <div className="admin-card p-8 max-w-md text-center">
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
        <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">
          Anwendungsfehler
        </h1>
        <p className="text-[var(--secondary)] mb-6">
          Ein unerwarteter Fehler ist aufgetreten. Bitte laden Sie die Seite neu oder versuchen Sie es spater erneut.
        </p>
        {error.message && (
          <p className="text-xs text-red-600 mb-2 font-mono bg-red-50 p-2 rounded">
            {error.message}
          </p>
        )}
        {error.digest && (
          <p className="text-xs text-[var(--muted)] mb-4 font-mono">
            Fehler-ID: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-primary">
            Erneut versuchen
          </button>
          <a href="/" className="btn-secondary">
            Zur Startseite
          </a>
        </div>
      </div>
    </div>
  );
}
