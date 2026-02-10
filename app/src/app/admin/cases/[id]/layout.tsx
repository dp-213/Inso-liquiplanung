import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import CaseSidebar from "@/components/admin/CaseSidebar";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

async function getCaseBasics(id: string) {
  const [caseData, pendingOrderCount] = await Promise.all([
    prisma.case.findUnique({
      where: { id },
      select: {
        id: true,
        debtorName: true,
        caseNumber: true,
        status: true,
      },
    }),
    prisma.order.count({
      where: { caseId: id, status: "PENDING" },
    }),
  ]);
  return { caseData, pendingOrderCount };
}

export default async function CaseLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const { caseData, pendingOrderCount } = await getCaseBasics(id);

  if (!caseData) {
    notFound();
  }

  return (
    <div className="-m-4 sm:-m-6 flex min-h-[calc(100vh-3.5rem)]">
      {/* Case Sidebar - hidden on mobile */}
      <div className="hidden lg:block sticky top-14">
        <CaseSidebar
          caseId={caseData.id}
          debtorName={caseData.debtorName}
          caseNumber={caseData.caseNumber}
          status={caseData.status}
          pendingOrderCount={pendingOrderCount}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 p-4 sm:p-6">
        {children}
      </div>
    </div>
  );
}
