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
  const [caseData, pendingOrderCount] = await Promise.all([
    prisma.case.findUnique({
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
    }),
    prisma.order.count({
      where: { caseId: id, status: "PENDING" },
    }),
  ]);

  return { caseData, pendingOrderCount };
}

export default async function CaseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { caseData, pendingOrderCount } = await getCaseData(id);

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

          {/* Aktionsbuttons - strukturiert nach Bereichen */}
          <div className="flex gap-2">
            <Link
              href={`/admin/cases/${id}/edit`}
              className="btn-secondary flex items-center"
              title="Fall bearbeiten"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </Link>
            <Link
              href={`/admin/cases/${id}/results`}
              className="btn-primary flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation nach Bereichen (MECE) */}
      <div className="admin-card p-4">
        <div className="flex flex-wrap gap-4 lg:gap-6">
          {/* TRANSAKTIONEN */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Transaktionen</span>
            <div className="flex gap-1">
              <Link
                href={`/admin/cases/${id}/ledger`}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Zahlungsregister
              </Link>
              <Link
                href={`/admin/cases/${id}/ingestion`}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Import
              </Link>
              <Link
                href={`/admin/cases/${id}/ledger?tab=review`}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Review
              </Link>
              <Link
                href={`/admin/cases/${id}/kontobewegungen`}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                IST
              </Link>
              <Link
                href={`/admin/cases/${id}/orders`}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 relative"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Freigaben
                {pendingOrderCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1 rounded-full text-xs font-bold bg-red-500 text-white">
                    {pendingOrderCount}
                  </span>
                )}
              </Link>
            </div>
          </div>

          <div className="border-l border-[var(--border)]" />

          {/* DIMENSIONEN */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Dimensionen</span>
            <div className="flex gap-1">
              <Link
                href={`/admin/cases/${id}/bank-accounts`}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Bankkonten
              </Link>
              <Link
                href={`/admin/cases/${id}/counterparties`}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Gegenparteien
              </Link>
              <Link
                href={`/admin/cases/${id}/locations`}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Standorte
              </Link>
            </div>
          </div>

          <div className="border-l border-[var(--border)]" />

          {/* VERFAHREN & RECHTE */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Verfahren</span>
            <div className="flex gap-1">
              <Link
                href={`/admin/cases/${id}/insolvency-effects`}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
                Insolvenzeffekte
              </Link>
              <Link
                href={`/admin/cases/${id}/security-rights`}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Sicherungsrechte
              </Link>
            </div>
          </div>

          <div className="border-l border-[var(--border)]" />

          {/* PLANUNG & ANNAHMEN */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Planung</span>
            <div className="flex gap-1">
              <Link
                href={`/admin/cases/${id}/assumptions`}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Prämissen
              </Link>
              <Link
                href={`/admin/cases/${id}/planung`}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center bg-blue-50 border-blue-300 hover:bg-blue-100"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                Planung (Datenraum)
              </Link>
              <Link
                href={`/admin/cases/${id}/results`}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Liquiditätsplan
              </Link>
              <Link
                href={`/admin/cases/${id}/business-logic`}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center hover:bg-[var(--accent)] transition-colors"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Business-Logik
              </Link>
            </div>
          </div>

          <div className="border-l border-[var(--border)]" />

          {/* ANALYSE */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Analyse</span>
            <div className="flex gap-1">
              <Link
                href={`/admin/cases/${id}/ist-klassifikation`}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                IST-Klassifikation
              </Link>
              <Link
                href={`/admin/cases/${id}/zahlungsverifikation`}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Zahlungsverifikation
              </Link>
              <Link
                href={`/admin/cases/${id}/iv-kommunikation`}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center bg-yellow-50 border-yellow-300 hover:bg-yellow-100"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                IV-Kommunikation
              </Link>
            </div>
          </div>

          <div className="border-l border-[var(--border)]" />

          {/* FINANZIERUNG */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Finanzierung</span>
            <div className="flex gap-1">
              <Link
                href={`/admin/cases/${id}/finanzierung`}
                className="btn-secondary text-sm py-1.5 px-3 flex items-center"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Kreditlinien
              </Link>
            </div>
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
