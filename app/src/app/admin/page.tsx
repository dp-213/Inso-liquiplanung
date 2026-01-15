import prisma from "@/lib/db";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  status: string;
  _count: { cases: number };
}

interface Case {
  id: string;
  caseNumber: string;
  debtorName: string;
  status: string;
  project: { name: string };
  plans: { versions: { versionNumber: number }[] }[];
}

interface IngestionJob {
  id: string;
  fileName: string;
  status: string;
  caseId: string;
  case: { caseNumber: string; debtorName: string };
}

async function getDashboardStats(): Promise<{
  projects: Project[];
  cases: Case[];
  recentJobs: IngestionJob[];
  dbError: boolean;
}> {
  try {
    const [projects, cases, recentJobs] = await Promise.all([
      prisma.project.findMany({
        where: { status: "ACTIVE" },
        include: {
          _count: { select: { cases: true } },
        },
      }),
      prisma.case.findMany({
        include: {
          project: { select: { name: true } },
          plans: {
            where: { isActive: true },
            include: {
              versions: {
                orderBy: { versionNumber: "desc" },
                take: 1,
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      prisma.ingestionJob.findMany({
        where: {
          status: { in: ["REVIEW", "QUARANTINED", "READY"] },
        },
        include: {
          case: { select: { caseNumber: true, debtorName: true } },
        },
        orderBy: { startedAt: "desc" },
        take: 5,
      }),
    ]);

    return { projects, cases, recentJobs, dbError: false };
  } catch (error) {
    console.error("Database error:", error);
    return { projects: [], cases: [], recentJobs: [], dbError: true };
  }
}

export default async function AdminDashboard() {
  const { projects, cases, recentJobs, dbError } = await getDashboardStats();

  const totalCases = cases.length;
  const preliminaryCases = cases.filter((c) => c.status === "PRELIMINARY").length;
  const openedCases = cases.filter((c) => c.status === "OPENED").length;
  const pendingJobs = recentJobs.filter((j) => j.status === "REVIEW" || j.status === "QUARANTINED").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Übersicht</h1>
        <p className="text-[var(--secondary)] mt-1">Willkommen im Liquiditäts-Kontrollcockpit</p>
      </div>

      {dbError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Datenbank nicht verfügbar</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Die Datenbank ist noch nicht eingerichtet. Für den produktiven Einsatz wird eine Cloud-Datenbank (z.B. Turso) benötigt.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="admin-card p-6">
          <div className="text-sm font-medium text-[var(--secondary)] uppercase tracking-wide">
            Projekte
          </div>
          <div className="mt-2 text-3xl font-bold text-[var(--foreground)]">
            {projects.length}
          </div>
          <Link href="/admin/projects" className="mt-3 text-sm text-[var(--primary)] hover:underline inline-flex items-center">
            Alle anzeigen
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="admin-card p-6">
          <div className="text-sm font-medium text-[var(--secondary)] uppercase tracking-wide">
            Aktive Fälle
          </div>
          <div className="mt-2 text-3xl font-bold text-[var(--foreground)]">
            {openedCases}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            {preliminaryCases} vorläufig
          </div>
        </div>

        <div className="admin-card p-6">
          <div className="text-sm font-medium text-[var(--secondary)] uppercase tracking-wide">
            Gesamt Fälle
          </div>
          <div className="mt-2 text-3xl font-bold text-[var(--foreground)]">
            {totalCases}
          </div>
          <Link href="/admin/cases" className="mt-3 text-sm text-[var(--primary)] hover:underline inline-flex items-center">
            Alle Fälle
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="admin-card p-6">
          <div className="text-sm font-medium text-[var(--secondary)] uppercase tracking-wide">
            Offene Imports
          </div>
          <div className="mt-2 text-3xl font-bold text-[var(--foreground)]">
            {pendingJobs}
          </div>
          {pendingJobs > 0 && (
            <div className="mt-1 text-sm text-[var(--warning)]">
              Zur Prüfung
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Cases */}
        <div className="admin-card">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Aktuelle Fälle</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {cases.slice(0, 5).map((caseItem) => (
              <Link
                key={caseItem.id}
                href={`/admin/cases/${caseItem.id}`}
                className="block px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-[var(--foreground)]">{caseItem.debtorName}</div>
                    <div className="text-sm text-[var(--secondary)]">
                      {caseItem.caseNumber} | {caseItem.project.name}
                    </div>
                  </div>
                  <span className={`badge ${
                    caseItem.status === "OPENED" ? "badge-success" :
                    caseItem.status === "PRELIMINARY" ? "badge-warning" :
                    "badge-neutral"
                  }`}>
                    {caseItem.status === "OPENED" ? "Eröffnet" :
                     caseItem.status === "PRELIMINARY" ? "Vorläufig" :
                     "Geschlossen"}
                  </span>
                </div>
              </Link>
            ))}
            {cases.length === 0 && (
              <div className="px-6 py-8 text-center text-[var(--muted)]">
                Noch keine Fälle vorhanden
              </div>
            )}
          </div>
        </div>

        {/* Pending Jobs */}
        <div className="admin-card">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Import-Aktivität</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {recentJobs.map((job) => (
              <Link
                key={job.id}
                href={`/admin/cases/${job.caseId}/ingestion?job=${job.id}`}
                className="block px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-[var(--foreground)]">{job.fileName}</div>
                    <div className="text-sm text-[var(--secondary)]">
                      {job.case.debtorName} ({job.case.caseNumber})
                    </div>
                  </div>
                  <span className={`badge ${
                    job.status === "READY" ? "badge-success" :
                    job.status === "REVIEW" ? "badge-warning" :
                    job.status === "QUARANTINED" ? "badge-danger" :
                    "badge-info"
                  }`}>
                    {job.status === "READY" ? "Bereit" :
                     job.status === "REVIEW" ? "Zur Prüfung" :
                     job.status === "QUARANTINED" ? "Problem" :
                     job.status}
                  </span>
                </div>
              </Link>
            ))}
            {recentJobs.length === 0 && (
              <div className="px-6 py-8 text-center text-[var(--muted)]">
                Keine offenen Importvorgänge
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Schnellaktionen</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/projects?new=true" className="btn-primary">
            Neues Projekt erstellen
          </Link>
          <Link href="/admin/cases?new=true" className="btn-secondary">
            Neuen Fall anlegen
          </Link>
        </div>
      </div>
    </div>
  );
}
