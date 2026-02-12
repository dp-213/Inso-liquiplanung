"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "gradify-cookie-consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 sm:p-6">
      <div className="max-w-xl mx-auto bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <p className="text-sm text-[var(--secondary)] flex-1">
          Diese Anwendung verwendet technisch notwendige Cookies für die Anmeldung und Sitzungsverwaltung. Es werden keine Tracking- oder Analyse-Cookies eingesetzt.
        </p>
        <button
          onClick={accept}
          className="btn-primary whitespace-nowrap shrink-0"
        >
          Verstanden
        </button>
      </div>
    </div>
  );
}
