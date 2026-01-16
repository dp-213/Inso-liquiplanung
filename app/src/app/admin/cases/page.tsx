import Link from "next/link";

interface CaseWithRelations {
  id: string;
  caseNumber: string;
  debtorName: string;
  status: string;
  updatedAt: Date;
  owner: { id: string; name: string; email: string; company: string | null };
  plans: {
    periodType: string | null;
    periodCount: number | null;
    versions: { versionNumber: number }[]
  }[];
  shareLinks: { id: string }[];
}

async function getCases(): Promise<{ cases: CaseWithRelations[]; dbError: boolean; errorMessage?: string }> {
  console.log("[getCases] Function called");

  try {
    // Dynamic import to catch initialization errors
    console.log("[getCases] Importing prisma...");
    const { default: prisma } = await import("@/lib/db");
    console.log("[getCases] Prisma imported successfully");

    console.log("[getCases] Starting database query...");
    const cases = await prisma.case.findMany({
      include: {
        owner: { select: { id: true, name: true, email: true, company: true } },
        plans: {
          where: { isActive: true },
          select: {
            periodType: true,
            periodCount: true,
            versions: {
              orderBy: { versionNumber: "desc" },
              take: 1,
              select: { versionNumber: true },
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

    console.log(`[getCases] Successfully loaded ${cases.length} cases`);
    return { cases, dbError: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[getCases] Error:", errorMessage);
    console.error("[getCases] Stack:", errorStack);
    return { cases: [], dbError: true, errorMessage };
  }
}

export default async function CasesListPage() {
  console.log("[CasesListPage] Starting page render");

  let pageData: { cases: CaseWithRelations[]; dbError: boolean; errorMessage?: string };
  try {
    pageData = await getCases();
    console.log("[CasesListPage] getCases returned:", {
      caseCount: pageData.cases.length,
      dbError: pageData.dbError
    });
  } catch (e) {
    console.error("[CasesListPage] Error calling getCases:", e);
    pageData = { cases: [], dbError: true, errorMessage: String(e) };
  }

  const { cases, dbError, errorMessage } = pageData;

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
            Datenbank nicht verfuegbar. Fuer den produktiven Einsatz wird eine Cloud-Datenbank benoetigt.
          </p>
          {errorMessage && (
            <p className="text-xs text-yellow-600 mt-2 font-mono">
              Fehler: {errorMessage}
            </p>
          )}
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
              <th>Kunde</th>
              <th>Status</th>
              <th>Planungsart</th>
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
                  <td>
                    <Link
                      href={`/admin/customers/${caseItem.owner.id}`}
                      className="text-[var(--secondary)] hover:text-[var(--primary)]"
                    >
                      {caseItem.owner.name}
                      {caseItem.owner.company && (
                        <span className="text-xs text-[var(--muted)] ml-1">({caseItem.owner.company})</span>
                      )}
                    </Link>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(caseItem.status)}`}>
                      {getStatusLabel(caseItem.status)}
                    </span>
                  </td>
                  <td>
                    {activePlan ? (
                      <div className="text-sm">
                        <span className="text-[var(--foreground)]">
                          {activePlan.periodCount || 13} {(activePlan.periodType || "WEEKLY") === "MONTHLY" ? "Monate" : "Wochen"}
                        </span>
                        <span className="text-[var(--muted)] ml-1 text-xs">
                          (v{latestVersion?.versionNumber || 0})
                        </span>
                      </div>
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
