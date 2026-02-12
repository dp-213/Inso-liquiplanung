"use client";

import { useRef, useEffect } from "react";
import CaseSidebar from "./CaseSidebar";

interface CaseSidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  debtorName: string;
  caseNumber: string;
  status: string;
  pendingOrderCount: number;
}

export default function CaseSidebarDrawer({
  isOpen,
  onClose,
  caseId,
  debtorName,
  caseNumber,
  status,
  pendingOrderCount,
}: CaseSidebarDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus-Trap: Panel fokussieren wenn geöffnet
  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div
      className="lg:hidden"
      role="dialog"
      aria-modal={isOpen}
      aria-label="Fall-Navigation"
    >
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        style={{ zIndex: "var(--z-drawer-backdrop)" }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`fixed inset-y-0 left-0 w-[280px] max-w-[85vw] bg-[var(--card)] shadow-2xl outline-none transition-transform duration-250 ease-out ${
          isOpen
            ? "translate-x-0 pointer-events-auto"
            : "-translate-x-full pointer-events-none"
        }`}
        style={{ zIndex: "var(--z-drawer)" }}
      >
        {/* Schließen-Button oben rechts */}
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
            aria-label="Navigation schließen"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <CaseSidebar
          caseId={caseId}
          debtorName={debtorName}
          caseNumber={caseNumber}
          status={status}
          pendingOrderCount={pendingOrderCount}
          className="w-full h-full overflow-y-auto bg-[var(--card)]"
        />
      </div>
    </div>
  );
}
