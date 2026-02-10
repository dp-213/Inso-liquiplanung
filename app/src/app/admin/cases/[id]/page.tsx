import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import CaseCalculationPreview from "@/components/admin/CaseCalculationPreview";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getCaseData(id: string) {
  const caseData = await prisma.case.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, company: true } },
      plans: {
        where: { isActive: true },
        include: {
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
          categories: {
            include: {
              lines: {
                include: {
                  periodValues: true,
                },
                orderBy: { displayOrder: "asc" },
              },
            },
            orderBy: { displayOrder: "asc" },
          },
        },
      },
      ingestionJobs: {
        orderBy: { startedAt: "desc" },
        take: 5,
      },
    },
  });

  return caseData;
}

export default async function CaseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const caseData = await getCaseData(id);

  if (!caseData) {
    notFound();
  }

  const plan = caseData.plans[0];
  const latestVersion = plan?.versions[0];

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "PRELIMINARY": return "Vorläufig";
      case "OPENED": return "Eröffnet";
      case "CLOSED": return "Geschlossen";
      default: return status;
    }
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case "PRELIMINARY": return "badge-warning";
      case "OPENED": return "badge-success";
      case "CLOSED": return "badge-neutral";
      default: return "badge-info";
    }
  };

  return (
    <div className="space-y-6">
      {/* Case Header */}
      <div className="admin-card p-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              {caseData.debtorName}
            </h1>
            <span className={`badge ${getStatusBadgeClass(caseData.status)}`}>
              {getStatusLabel(caseData.status)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--secondary)]">
            <span>Aktenzeichen: {caseData.caseNumber}</span>
            <span>Gericht: {caseData.courtName}</span>
            <span>Kunde: {caseData.owner.name}{caseData.owner.company && ` (${caseData.owner.company})`}</span>
          </div>
          <div className="mt-2 text-sm text-[var(--muted)]">
            {caseData.filingDate && (
              <span>Antragsdatum: {new Date(caseData.filingDate).toLocaleDateString("de-DE")}</span>
            )}
            {caseData.openingDate && (
              <span className="ml-4">Eröffnung: {new Date(caseData.openingDate).toLocaleDateString("de-DE")}</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Plan Status */}
          <div className="admin-card p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Liquiditätsplan</h2>

            {plan ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-[var(--muted)]">Planname</p>
                    <p className="font-medium text-[var(--foreground)]">{plan.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-[var(--muted)]">Version</p>
                    <p className="font-medium text-[var(--foreground)]">
                      {latestVersion ? `v${latestVersion.versionNumber}` : "Keine Version"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-[var(--muted)]">Planungsart</p>
                    <p className="font-medium text-[var(--foreground)]">
                      {plan.periodCount || 13} {(plan.periodType || "WEEKLY") === "MONTHLY" ? "Monate" : "Wochen"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-[var(--muted)]">Planstart</p>
                    <p className="font-medium text-[var(--foreground)]">
                      {new Date(plan.planStartDate).toLocaleDateString("de-DE")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-[var(--muted)]">Letzte Aktualisierung</p>
                    <p className="font-medium text-[var(--foreground)]">
                      {latestVersion
                        ? new Date(latestVersion.snapshotDate).toLocaleDateString("de-DE")
                        : "-"}
                    </p>
                  </div>
                </div>

                {latestVersion && (
                  <div className="pt-4 border-t border-[var(--border)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[var(--muted)]">Eröffnungssaldo</p>
                        <p className="text-xl font-bold text-[var(--foreground)]">
                          {(Number(latestVersion.openingBalanceCents) / 100).toLocaleString("de-DE", {
                            style: "currency",
                            currency: "EUR",
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-[var(--muted)]">Daten-Hash</p>
                        <p className="font-mono text-xs text-[var(--secondary)]">
                          {latestVersion.dataHash.substring(0, 16)}...
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <CaseCalculationPreview caseId={id} />
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-[var(--muted)] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-[var(--muted)]">Kein aktiver Liquiditätsplan vorhanden</p>
                <Link
                  href={`/admin/cases/${id}/ingestion`}
                  className="btn-primary mt-4 inline-flex items-center"
                >
                  Daten importieren
                </Link>
              </div>
            )}
          </div>

          {/* Recent Ingestion Jobs */}
          <div className="admin-card">
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Import-Historie</h2>
              <Link
                href={`/admin/cases/${id}/ingestion`}
                className="text-sm text-[var(--primary)] hover:underline"
              >
                Alle anzeigen
              </Link>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {caseData.ingestionJobs.length > 0 ? (
                caseData.ingestionJobs.map((job) => (
                  <div key={job.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[var(--foreground)]">{job.fileName}</p>
                        <p className="text-sm text-[var(--muted)]">
                          {new Date(job.startedAt).toLocaleString("de-DE")}
                        </p>
                      </div>
                      <span className={`badge ${
                        job.status === "COMMITTED" ? "badge-success" :
                        job.status === "READY" ? "badge-info" :
                        job.status === "REVIEW" ? "badge-warning" :
                        job.status === "QUARANTINED" ? "badge-danger" :
                        "badge-neutral"
                      }`}>
                        {job.status === "COMMITTED" ? "Übernommen" :
                         job.status === "READY" ? "Bereit" :
                         job.status === "REVIEW" ? "Zur Prüfung" :
                         job.status === "QUARANTINED" ? "Problem" :
                         job.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-8 text-center text-[var(--muted)]">
                  Keine Importvorgänge vorhanden
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="lg:col-span-1 space-y-6">
          <div className="admin-card p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Zugang</h2>
            <div className="space-y-3">
              <Link
                href={`/admin/cases/${id}/freigaben`}
                className="flex items-center justify-between p-3 rounded-md border border-[var(--border)] hover:bg-gray-50 dark:hover:bg-[var(--card)]/80 transition-colors"
              >
                <div>
                  <p className="font-medium text-[var(--foreground)]">Externe Freigaben</p>
                  <p className="text-sm text-[var(--muted)]">Zugriffslinks verwalten</p>
                </div>
                <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href={`/admin/cases/${id}/kundenzugaenge`}
                className="flex items-center justify-between p-3 rounded-md border border-[var(--border)] hover:bg-gray-50 dark:hover:bg-[var(--card)]/80 transition-colors"
              >
                <div>
                  <p className="font-medium text-[var(--foreground)]">Kundenzugänge</p>
                  <p className="text-sm text-[var(--muted)]">Kunden-Zugriffsrechte verwalten</p>
                </div>
                <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
