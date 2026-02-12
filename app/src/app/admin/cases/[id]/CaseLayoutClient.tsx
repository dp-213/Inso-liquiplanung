"use client";

import CaseSidebar from "@/components/admin/CaseSidebar";
import MobileCaseHeader from "@/components/admin/MobileCaseHeader";
import CaseSidebarDrawer from "@/components/admin/CaseSidebarDrawer";
import { useMobileSidebar } from "@/hooks/useMobileSidebar";

interface CaseLayoutClientProps {
  caseId: string;
  debtorName: string;
  caseNumber: string;
  status: string;
  pendingOrderCount: number;
  children: React.ReactNode;
}

export default function CaseLayoutClient({
  caseId,
  debtorName,
  caseNumber,
  status,
  pendingOrderCount,
  children,
}: CaseLayoutClientProps) {
  const sidebar = useMobileSidebar();

  return (
    /* Negativer Margin: Full-bleed Pattern – Content füllt den gesamten
       Bereich unter dem AdminShell-Header, Sidebar + Content teilen sich die Fläche */
    <div className="-m-4 sm:-m-6">
      {/* Mobile: Case-Header mit Hamburger (nur < lg sichtbar) */}
      <MobileCaseHeader
        debtorName={debtorName}
        onMenuToggle={sidebar.toggle}
      />

      {/* Mobile: Drawer-Navigation */}
      <CaseSidebarDrawer
        isOpen={sidebar.isOpen}
        onClose={sidebar.close}
        caseId={caseId}
        debtorName={debtorName}
        caseNumber={caseNumber}
        status={status}
        pendingOrderCount={pendingOrderCount}
      />

      {/* Desktop-Sidebar + Content */}
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        {/* Desktop Sidebar (ab lg sichtbar) */}
        <div className="hidden lg:block sticky top-14 self-start" style={{ zIndex: "var(--z-sidebar)" }}>
          <CaseSidebar
            caseId={caseId}
            debtorName={debtorName}
            caseNumber={caseNumber}
            status={status}
            pendingOrderCount={pendingOrderCount}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
