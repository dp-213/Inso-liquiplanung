import prisma from "@/lib/db";
import Link from "next/link";

interface CaseWithRelations {
  id: string;
  caseNumber: string;
  debtorName: string;
  status: string;
  updatedAt: Date;
  project: { name: string };
  plans: { versions: { versionNumber: number }[] }[];
  shareLinks: { id: string }[];
}

async function getCases(): Promise<{ cases: CaseWithRelations[]; dbError: boolean }> {
  try {
    const cases = await prisma.case.findMany({
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
        shareLinks: {
          where: { isActive: true },
          select: { id: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return { cases, dbError: false };
  } catch (error) {
    console.error("Database error:", error);
    return { cases: [], dbError: true };
  }
}

export default async function CasesListPage() {
  const { cases, dbError } = await getCases();

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Fälle</h1>
          <p className="text-[var(--secondary)] mt-1">Alle Insolvenzverfahren verwalten</p>
        </div>
        <Link href="/admin/cases/new" className="btn-primary">
          Neuen Fall anlegen
        </Link>
      </div>

      {dbError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            Datenbank nicht verfügbar. Für den produktiven Einsatz wird eine Cloud-Datenbank benötigt.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Gesamt</p>
          <p className="text-2xl font-bold text-[var(--foreground)]">{cases.length}</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Eröffnet</p>
          <p className="text-2xl font-bold text-[var(--success)]">
            {cases.filter((c) => c.status === "OPENED").length}
          </p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Vorläufig</p>
          <p className="text-2xl font-bold text-[var(--warning)]">
            {cases.filter((c) => c.status === "PRELIMINARY").length}
          </p>
        </div>
      </div>

      {/* Cases Table */}
      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Schuldner</th>
              <th>Aktenzeichen</th>
              <th>Projekt</th>
              <th>Status</th>
              <th>Plan</th>
              <th>Freigaben</th>
              <th>Aktualisiert</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cases.map((caseItem) => {
              const activePlan = caseItem.plans[0];
              const latestVersion = activePlan?.versions[0];
              const activeShareLinks = caseItem.shareLinks.length;

              return (
                <tr key={caseItem.id}>
                  <td>
                    <Link
                      href={`/admin/cases/${caseItem.id}`}
                      className="font-medium text-[var(--foreground)] hover:text-[var(--primary)]"
                    >
                      {caseItem.debtorName}
                    </Link>
                  </td>
                  <td className="text-[var(--secondary)]">{caseItem.caseNumber}</td>
                  <td className="text-[var(--secondary)]">{caseItem.project.name}</td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(caseItem.status)}`}>
                      {getStatusLabel(caseItem.status)}
                    </span>
                  </td>
                  <td>
                    {activePlan ? (
                      <span className="text-sm text-[var(--foreground)]">
                        v{latestVersion?.versionNumber || 0}
                      </span>
                    ) : (
                      <span className="text-sm text-[var(--muted)]">-</span>
                    )}
                  </td>
                  <td>
                    {activeShareLinks > 0 ? (
                      <span className="badge badge-info">{activeShareLinks} aktiv</span>
                    ) : (
                      <span className="text-sm text-[var(--muted)]">-</span>
                    )}
                  </td>
                  <td className="text-sm text-[var(--muted)]">
                    {new Date(caseItem.updatedAt).toLocaleDateString("de-DE")}
                  </td>
                  <td>
                    <Link
                      href={`/admin/cases/${caseItem.id}`}
                      className="text-[var(--primary)] hover:underline text-sm"
                    >
                      Öffnen
                    </Link>
                  </td>
                </tr>
              );
            })}
            {cases.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-[var(--muted)]">
                  Keine Fälle vorhanden. Erstellen Sie Ihren ersten Fall.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
