import prisma from "@/lib/db";
import Link from "next/link";

interface Case {
  id: string;
  caseNumber: string;
  debtorName: string;
  status: string;
  owner: { id: string; name: string; company: string | null };
  plans: { versions: { versionNumber: number }[] }[];
  customerAccess: { id: string }[];
  shareLinks: { id: string; isActive: boolean }[];
}

interface Customer {
  id: string;
  name: string;
  email: string;
  company: string | null;
  isActive: boolean;
  _count: { ownedCases: number; caseAccess: number };
}

async function getDashboardStats(): Promise<{
  cases: Case[];
  customers: Customer[];
  dbError: boolean;
}> {
  try {
    const [cases, customers] = await Promise.all([
      prisma.case.findMany({
        include: {
          owner: { select: { id: true, name: true, company: true } },
          plans: {
            where: { isActive: true },
            include: {
              versions: {
                orderBy: { versionNumber: "desc" },
                take: 1,
              },
            },
          },
          customerAccess: {
            where: { isActive: true },
            select: { id: true },
          },
          shareLinks: {
            where: { isActive: true },
            select: { id: true, isActive: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      prisma.customerUser.findMany({
        where: { isActive: true },
        include: {
          _count: { select: { ownedCases: true, caseAccess: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return { cases, customers, dbError: false };
  } catch (error) {
    console.error("Database error:", error);
    return { cases: [], customers: [], dbError: true };
  }
}

export default async function AdminDashboard() {
  const { cases, customers, dbError } = await getDashboardStats();

  const totalCases = cases.length;
  const casesWithCustomers = cases.filter((c) => c.customerAccess.length > 0).length;
  const casesWithShareLinks = cases.filter((c) => c.shareLinks.length > 0).length;
  const totalCustomers = customers.length;

  // Determine onboarding state
  const hasCustomers = customers.length > 0;
  const hasCases = cases.length > 0;
  const hasAccessConfigured = casesWithCustomers > 0 || casesWithShareLinks > 0;

  // Calculate workflow progress (simplified: Customer -> Case -> Access)
  const workflowSteps = [
    { done: hasCustomers, label: "Kunde anlegen" },
    { done: hasCases, label: "Fall anlegen" },
    { done: hasAccessConfigured, label: "Zugriff vergeben" },
  ];
  const completedSteps = workflowSteps.filter((s) => s.done).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Uebersicht</h1>
        <p className="text-[var(--secondary)] mt-1">Liquiditaetsplanung fuer Insolvenzverfahren verwalten</p>
      </div>

      {dbError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Datenbank nicht verfuegbar</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Die Datenbank ist noch nicht eingerichtet.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Getting Started / Workflow Guide */}
      {completedSteps < 3 && (
        <div className="admin-card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)] flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Erste Schritte
              </h2>
              <p className="text-sm text-[var(--secondary)] mt-1">
                Folgen Sie diesen Schritten, um Ihr erstes Kunden-Dashboard einzurichten
              </p>
            </div>
            <span className="text-sm font-medium text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
              {completedSteps}/3 erledigt
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1: Customer */}
            <div className={`relative p-4 rounded-lg border-2 transition-all ${hasCustomers ? "bg-green-50 border-green-300" : "bg-white border-gray-200 hover:border-blue-300"}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${hasCustomers ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600"}`}>
                  {hasCustomers ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : "1"}
                </div>
                <span className="font-medium text-[var(--foreground)]">Kunde</span>
              </div>
              <p className="text-xs text-[var(--secondary)] mb-3">
                Erstellen Sie einen Kundenzugang (Insolvenzverwalter)
              </p>
              {!hasCustomers && (
                <Link href="/admin/customers" className="text-xs text-blue-600 hover:underline font-medium">
                  Kunde anlegen →
                </Link>
              )}
            </div>

            {/* Step 2: Case */}
            <div className={`relative p-4 rounded-lg border-2 transition-all ${hasCases ? "bg-green-50 border-green-300" : hasCustomers ? "bg-white border-gray-200 hover:border-blue-300" : "bg-gray-50 border-gray-100 opacity-60"}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${hasCases ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600"}`}>
                  {hasCases ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : "2"}
                </div>
                <span className="font-medium text-[var(--foreground)]">Fall anlegen</span>
              </div>
              <p className="text-xs text-[var(--secondary)] mb-3">
                Legen Sie einen Insolvenzfall fuer einen Kunden an
              </p>
              {hasCustomers && !hasCases && (
                <Link href="/admin/cases/new" className="text-xs text-blue-600 hover:underline font-medium">
                  Fall anlegen →
                </Link>
              )}
            </div>

            {/* Step 3: Access */}
            <div className={`relative p-4 rounded-lg border-2 transition-all ${hasAccessConfigured ? "bg-green-50 border-green-300" : hasCases ? "bg-white border-gray-200 hover:border-blue-300" : "bg-gray-50 border-gray-100 opacity-60"}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${hasAccessConfigured ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600"}`}>
                  {hasAccessConfigured ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : "3"}
                </div>
                <span className="font-medium text-[var(--foreground)]">Zugriff</span>
              </div>
              <p className="text-xs text-[var(--secondary)] mb-3">
                Teilen Sie Faelle mit weiteren Kunden (optional)
              </p>
              {hasCases && !hasAccessConfigured && cases[0] && (
                <Link href={`/admin/cases/${cases[0].id}`} className="text-xs text-blue-600 hover:underline font-medium">
                  Zugriff verwalten →
                </Link>
              )}
            </div>
          </div>

          {completedSteps === 3 && (
            <div className="mt-4 p-3 bg-green-100 rounded-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-green-800 font-medium">
                Einrichtung abgeschlossen! Ihre Kunden koennen sich nun unter /customer-login anmelden.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/admin/cases" className="admin-card p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[var(--secondary)] uppercase tracking-wide">
                Faelle
              </div>
              <div className="mt-2 text-3xl font-bold text-[var(--foreground)]">
                {totalCases}
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 text-sm text-[var(--primary)] font-medium inline-flex items-center">
            Alle anzeigen
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <Link href="/admin/customers" className="admin-card p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[var(--secondary)] uppercase tracking-wide">
                Kunden
              </div>
              <div className="mt-2 text-3xl font-bold text-[var(--foreground)]">
                {totalCustomers}
              </div>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 text-sm text-[var(--primary)] font-medium inline-flex items-center">
            Verwalten
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <div className="admin-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[var(--secondary)] uppercase tracking-wide">
                Mit Zugriff
              </div>
              <div className="mt-2 text-3xl font-bold text-[var(--success)]">
                {casesWithCustomers}
              </div>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            Faelle mit geteiltem Zugang
          </div>
        </div>

        <div className="admin-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[var(--secondary)] uppercase tracking-wide">
                Share-Links
              </div>
              <div className="mt-2 text-3xl font-bold text-[var(--foreground)]">
                {casesWithShareLinks}
              </div>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            Faelle mit aktivem Link
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Cases with Status */}
        <div className="admin-card">
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Aktuelle Faelle</h2>
            <Link href="/admin/cases/new" className="text-sm text-[var(--primary)] hover:underline">
              + Neuer Fall
            </Link>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {cases.slice(0, 5).map((caseItem) => {
              const hasAccess = caseItem.customerAccess.length > 0 || caseItem.shareLinks.length > 0;
              return (
                <Link
                  key={caseItem.id}
                  href={`/admin/cases/${caseItem.id}`}
                  className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[var(--foreground)] truncate">{caseItem.debtorName}</div>
                      <div className="text-sm text-[var(--secondary)]">
                        {caseItem.caseNumber} | {caseItem.owner.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {hasAccess ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Geteilt
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--muted)] bg-gray-100 px-2 py-1 rounded">
                          Nur Besitzer
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
            {cases.length === 0 && (
              <div className="px-6 py-8 text-center">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="text-[var(--muted)] mb-3">Noch keine Faelle vorhanden</p>
                {hasCustomers ? (
                  <Link href="/admin/cases/new" className="btn-primary text-sm">
                    Ersten Fall anlegen
                  </Link>
                ) : (
                  <Link href="/admin/customers" className="btn-primary text-sm">
                    Zuerst Kunde anlegen
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Customers Overview */}
        <div className="admin-card">
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Kunden</h2>
            <Link href="/admin/customers" className="text-sm text-[var(--primary)] hover:underline">
              + Neuer Kunde
            </Link>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {customers.slice(0, 5).map((customer) => (
              <Link
                key={customer.id}
                href={`/admin/customers/${customer.id}`}
                className="block px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-[var(--foreground)]">{customer.name}</div>
                    <div className="text-sm text-[var(--secondary)]">
                      {customer.email}
                      {customer.company && ` | ${customer.company}`}
                    </div>
                  </div>
                  <span className="text-sm text-[var(--muted)] bg-gray-100 px-2 py-1 rounded">
                    {customer._count.ownedCases} {customer._count.ownedCases === 1 ? "Fall" : "Faelle"}
                  </span>
                </div>
              </Link>
            ))}
            {customers.length === 0 && (
              <div className="px-6 py-8 text-center">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <p className="text-[var(--muted)] mb-3">Noch keine Kunden angelegt</p>
                <Link href="/admin/customers" className="btn-primary text-sm">
                  Ersten Kunden anlegen
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Portal Info */}
      {hasCases && (
        <div className="admin-card p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-[var(--foreground)]">Kundenportal</h3>
              <p className="text-sm text-[var(--secondary)] mt-1">
                Ihre Kunden (Insolvenzverwalter) koennen sich unter folgender URL anmelden, um ihre Faelle einzusehen:
              </p>
              <div className="mt-3 flex items-center gap-3">
                <code className="text-sm bg-white px-3 py-2 rounded border border-green-200 text-green-800">
                  {process.env.NEXT_PUBLIC_APP_URL || "https://ihre-domain.de"}/customer-login
                </code>
                <Link
                  href="/customer-login"
                  target="_blank"
                  className="text-sm text-green-600 hover:underline font-medium"
                >
                  Oeffnen →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
