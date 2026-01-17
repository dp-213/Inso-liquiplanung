import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import ShareLinksManager from "@/components/admin/ShareLinksManager";
import CustomerAccessManager from "@/components/admin/CustomerAccessManager";
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
      shareLinks: {
        orderBy: { createdAt: "desc" },
      },
      ingestionJobs: {
        orderBy: { startedAt: "desc" },
        take: 5,
      },
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
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-[var(--muted)]">
        <Link href="/admin/cases" className="hover:text-[var(--primary)]">
          Fälle
        </Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[var(--foreground)]">{caseData.debtorName}</span>
      </div>

      {/* Case Header */}
      <div className="admin-card p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
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

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/cases/${id}/edit`}
              className="btn-secondary flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Bearbeiten
            </Link>
            <Link
              href={`/admin/cases/${id}/config`}
              className="btn-secondary flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Konfiguration
            </Link>
            <Link
              href={`/admin/cases/${id}/ingestion`}
              className="btn-secondary flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Daten importieren
            </Link>
            <Link
              href={`/admin/cases/${id}/dashboard`}
              className="btn-secondary flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Dashboard
            </Link>
            <Link
              href={`/admin/cases/${id}/assumptions`}
              className="btn-secondary flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Prämissen
            </Link>
            <Link
              href={`/admin/cases/${id}/insolvency-effects`}
              className="btn-secondary flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
              Insolvenzeffekte
            </Link>
            <Link
              href={`/admin/cases/${id}/bank-accounts`}
              className="btn-secondary flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Bankenspiegel
            </Link>
            {caseData.shareLinks.filter(l => l.isActive).length > 0 && (
              <a
                href={`/view/${caseData.shareLinks.find(l => l.isActive)?.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Externe Ansicht
              </a>
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

        {/* Share Links and Customer Access Management */}
        <div className="lg:col-span-1 space-y-6">
          <ShareLinksManager caseId={id} initialLinks={caseData.shareLinks} />
          <CustomerAccessManager caseId={id} initialAccess={caseData.customerAccess} />
        </div>
      </div>
    </div>
  );
}
