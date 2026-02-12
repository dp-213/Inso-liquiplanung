"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface CaseSidebarProps {
  caseId: string;
  debtorName: string;
  caseNumber: string;
  status: string;
  pendingOrderCount: number;
  className?: string;
}

interface NavItem {
  name: string;
  href: string;
  badge?: number;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "PRELIMINARY": return "Vorläufig";
    case "OPENED": return "Eröffnet";
    case "CLOSED": return "Geschlossen";
    default: return status;
  }
}

function getStatusDot(status: string): string {
  switch (status) {
    case "PRELIMINARY": return "bg-amber-400";
    case "OPENED": return "bg-green-500";
    case "CLOSED": return "bg-gray-400";
    default: return "bg-gray-400";
  }
}

export default function CaseSidebar({
  caseId,
  debtorName,
  caseNumber,
  status,
  pendingOrderCount,
  className,
}: CaseSidebarProps) {
  const pathname = usePathname();
  const base = `/admin/cases/${caseId}`;

  const sections: NavSection[] = [
    {
      label: "DATEN",
      items: [
        { name: "Zahlungsregister", href: `${base}/ledger` },
        { name: "Import", href: `${base}/ingestion` },
        { name: "Bestellfreigaben", href: `${base}/orders`, badge: pendingOrderCount },
      ],
    },
    {
      label: "STAMMDATEN",
      items: [
        { name: "Bankkonten", href: `${base}/bank-accounts` },
        { name: "Gegenparteien", href: `${base}/counterparties` },
        { name: "Kreditoren", href: `${base}/creditors` },
        { name: "Kostenarten", href: `${base}/cost-categories` },
        { name: "Standorte", href: `${base}/locations` },
      ],
    },
    {
      label: "FALLDATEN",
      items: [
        { name: "Personal", href: `${base}/personal` },
        { name: "Kontakte", href: `${base}/kontakte` },
        { name: "Banken & Sicherungsrechte", href: `${base}/banken-sicherungsrechte` },
        { name: "Finanzierung", href: `${base}/finanzierung` },
      ],
    },
    {
      label: "VERFAHREN",
      items: [
        { name: "Insolvenzeffekte", href: `${base}/insolvency-effects` },
      ],
    },
    {
      label: "PLANUNG",
      items: [
        { name: "Prämissen", href: `${base}/assumptions` },
        { name: "Prognose", href: `${base}/forecast` },
        { name: "Liquiditätsplan", href: `${base}/results` },
        { name: "Business-Logik", href: `${base}/business-logic` },
      ],
    },
    {
      label: "ANALYSE",
      items: [
        { name: "IST-Daten", href: `${base}/kontobewegungen` },
        { name: "Geschäftskonten", href: `${base}/vorinsolvenz-analyse` },
        { name: "Klassifikation", href: `${base}/ist-klassifikation` },
        { name: "Verifikation", href: `${base}/zahlungsverifikation` },
        { name: "IV-Kommunikation", href: `${base}/iv-kommunikation` },
      ],
    },
    {
      label: "ZUGANG",
      items: [
        { name: "Freigaben", href: `${base}/freigaben` },
      ],
    },
  ];

  const isActive = (href: string) => {
    // Exact match for the case overview page
    if (href === base) return pathname === base;
    // For sub-pages, check startsWith
    return pathname.startsWith(href);
  };

  return (
    <aside className={className ?? "w-56 shrink-0 bg-[var(--card)] border-r border-[var(--border)] overflow-y-auto h-[calc(100vh-3.5rem)]"}>
      {/* Case Header */}
      <div className="px-4 py-4 border-b border-[var(--border)]">
        <Link href={base} className="block group">
          <h2 className="text-sm font-semibold text-[var(--foreground)] truncate group-hover:text-[var(--primary)] transition-colors">
            {debtorName}
          </h2>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`w-2 h-2 rounded-full ${getStatusDot(status)}`} />
            <span className="text-xs text-[var(--muted)]">{getStatusLabel(status)}</span>
          </div>
          {caseNumber && (
            <p className="text-xs text-[var(--muted)] mt-0.5 truncate">{caseNumber}</p>
          )}
        </Link>
      </div>

      {/* Overview link */}
      <div className="px-3 pt-3 pb-1">
        <Link
          href={base}
          className={`flex items-center px-3 py-2.5 lg:py-2 rounded-md text-sm transition-colors ${
            pathname === base
              ? "bg-[var(--primary)]/10 text-[var(--primary)] font-medium border-l-2 border-[var(--primary)] -ml-px"
              : "text-[var(--secondary)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          }`}
        >
          Übersicht
        </Link>
      </div>

      {/* Navigation Sections */}
      <nav className="px-3 py-2 space-y-4">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="px-3 mb-1">
              <span className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider">
                {section.label}
              </span>
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 lg:py-1.5 rounded-md text-sm transition-colors ${
                    isActive(item.href)
                      ? "bg-[var(--primary)]/10 text-[var(--primary)] font-medium border-l-2 border-[var(--primary)] -ml-px"
                      : "text-[var(--secondary)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <span className="truncate">{item.name}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1 rounded-full text-xs font-bold bg-amber-500 text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="px-3 py-4 mt-2 border-t border-[var(--border)] space-y-1">
        <Link
          href={`${base}/edit`}
          className={`flex items-center px-3 py-2.5 lg:py-1.5 rounded-md text-sm transition-colors ${
            isActive(`${base}/edit`)
              ? "bg-[var(--primary)]/10 text-[var(--primary)] font-medium"
              : "text-[var(--secondary)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          }`}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Fall bearbeiten
        </Link>
        <Link
          href={`${base}/results`}
          className="flex items-center px-3 py-2.5 lg:py-1.5 rounded-md text-sm text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors font-medium"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Dashboard
        </Link>
      </div>

      {/* Hilfe */}
      <div className="px-3 pb-4 border-t border-[var(--border)]">
        <Link
          href={`${base}/hilfe`}
          className={`flex items-center px-3 py-2.5 lg:py-1.5 mt-3 rounded-md text-sm transition-colors ${
            isActive(`${base}/hilfe`)
              ? "bg-[var(--primary)]/10 text-[var(--primary)] font-medium"
              : "text-[var(--muted)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          }`}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Hilfe
        </Link>
      </div>
    </aside>
  );
}
