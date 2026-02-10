import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import CustomerAccessManager from "@/components/admin/CustomerAccessManager";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function KundenzugaengePage({ params }: PageProps) {
  const { id } = await params;

  const caseData = await prisma.case.findUnique({
    where: { id },
    select: {
      id: true,
      debtorName: true,
      customerAccess: {
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              company: true,
              isActive: true,
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
          Kundenzugänge
        </h1>
        <p className="text-sm text-[var(--secondary)]">
          Kundenzugänge für {caseData.debtorName} verwalten
        </p>
      </div>

      <CustomerAccessManager caseId={id} initialAccess={caseData.customerAccess} />
    </div>
  );
}
