"use client";

import { usePathname } from "next/navigation";

interface MobileCaseHeaderProps {
  debtorName: string;
  onMenuToggle: () => void;
}

const segmentLabels: Record<string, string> = {
  ledger: "Zahlungsregister",
  ingestion: "Import",
  orders: "Bestellfreigaben",
  "bank-accounts": "Bankkonten",
  counterparties: "Gegenparteien",
  creditors: "Kreditoren",
  "cost-categories": "Kostenarten",
  locations: "Standorte",
  "insolvency-effects": "Insolvenzeffekte",
  finanzierung: "Finanzierung & Banken",
  assumptions: "Prämissen",
  forecast: "Prognose",
  results: "Dashboard",
  liquiditaetsmatrix: "Liquiditätstabelle",
  "business-logic": "Business-Logik",
  kontobewegungen: "IST-Daten",
  "ist-klassifikation": "Klassifikation",
  zahlungsverifikation: "Verifikation",
  "iv-kommunikation": "IV-Kommunikation",
  freigaben: "Freigaben",
  edit: "Bearbeiten",
  hilfe: "Hilfe",
  dashboard: "Dashboard",
  config: "Konfiguration",
  rules: "Regeln",
  planung: "Planung",
};

function getCurrentSection(pathname: string): string | null {
  // Pfad: /admin/cases/[id]/[section]/...
  const parts = pathname.split("/");
  // parts = ["", "admin", "cases", id, section?, ...]
  const section = parts[4];
  if (!section) return null;
  return segmentLabels[section] || null;
}

export default function MobileCaseHeader({ debtorName, onMenuToggle }: MobileCaseHeaderProps) {
  const pathname = usePathname();
  const section = getCurrentSection(pathname);

  return (
    <div className="lg:hidden sticky top-14 z-[var(--z-sidebar)] bg-[var(--card)] border-b border-[var(--border)]">
      <div className="flex items-center h-11 px-3">
        {/* Hamburger */}
        <button
          onClick={onMenuToggle}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 text-[var(--secondary)] hover:text-[var(--foreground)]"
          aria-label="Navigation öffnen"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Case-Name + Sektion */}
        <div className="flex-1 min-w-0 ml-1">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-semibold text-[var(--foreground)] truncate">
              {debtorName}
            </span>
            {section && (
              <>
                <span className="text-[var(--muted)] shrink-0">·</span>
                <span className="text-[var(--muted)] truncate">{section}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
