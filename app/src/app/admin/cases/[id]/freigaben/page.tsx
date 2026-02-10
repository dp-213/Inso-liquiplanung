import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import ShareLinksManager from "@/components/admin/ShareLinksManager";

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
      shareLinks: {
        orderBy: { createdAt: "desc" },
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
          Externe Freigaben
        </h1>
        <p className="text-sm text-[var(--secondary)]">
          Externe Zugriffslinks für {caseData.debtorName} verwalten
        </p>
      </div>

      <ShareLinksManager caseId={id} initialLinks={caseData.shareLinks} />
    </div>
  );
}
