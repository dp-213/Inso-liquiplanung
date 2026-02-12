import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import CombinedAccessManager from "@/components/admin/CombinedAccessManager";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FreigabenPage({ params }: PageProps) {
  const { id } = await params;

  const caseData = await prisma.case.findUnique({
    where: { id },
    select: {
      id: true,
      debtorName: true,
      caseNumber: true,
      shareLinks: {
        orderBy: { createdAt: "desc" },
      },
      customerAccess: {
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              slug: true,
              company: true,
              isActive: true,
              lastLoginAt: true,
              loginCount: true,
              phone: true,
            },
          },
        },
        orderBy: { grantedAt: "desc" },
      },
    },
  });

  if (!caseData) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="admin-card p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
          Freigaben
        </h1>
        <p className="text-sm text-[var(--secondary)]">
          Kundenzugänge und externe Links für {caseData.debtorName} verwalten
        </p>
      </div>

      <CombinedAccessManager
        caseId={id}
        caseNumber={caseData.caseNumber}
        debtorName={caseData.debtorName}
        initialAccess={caseData.customerAccess}
        initialLinks={caseData.shareLinks}
      />
    </div>
  );
}
