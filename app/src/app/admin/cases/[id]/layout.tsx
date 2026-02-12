import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import CaseLayoutClient from "./CaseLayoutClient";

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
    <CaseLayoutClient
      caseId={caseData.id}
      debtorName={caseData.debtorName}
      caseNumber={caseData.caseNumber}
      status={caseData.status}
      pendingOrderCount={pendingOrderCount}
    >
      {children}
    </CaseLayoutClient>
  );
}
