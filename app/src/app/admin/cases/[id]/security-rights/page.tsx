import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getCaseWithSecurityRights(caseId: string) {
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      caseNumber: true,
      debtorName: true,
      bankAccounts: {
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  return caseData;
}

export default async function SecurityRightsPage({ params }: PageProps) {
  const { id } = await params;
  const caseData = await getCaseWithSecurityRights(id);

  if (!caseData) {
    notFound();
  }

  // Separate accounts with and without security holders
  const securedAccounts = caseData.bankAccounts.filter(a => a.securityHolder);
  const unsecuredAccounts = caseData.bankAccounts.filter(a => !a.securityHolder);

  // Calculate totals
  const totalBalanceCents = caseData.bankAccounts.reduce((sum, a) => sum + BigInt(a.balanceCents), BigInt(0));
  const totalAvailableCents = caseData.bankAccounts.reduce((sum, a) => sum + BigInt(a.availableCents), BigInt(0));
  const securedBalanceCents = securedAccounts.reduce((sum, a) => sum + BigInt(a.balanceCents), BigInt(0));
  const unsecuredBalanceCents = unsecuredAccounts.reduce((sum, a) => sum + BigInt(a.balanceCents), BigInt(0));

  const formatCurrency = (cents: bigint) => {
    return (Number(cents) / 100).toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "available":
        return <span className="badge badge-success">Verfügbar</span>;
      case "blocked":
        return <span className="badge badge-danger">Gesperrt</span>;
      case "restricted":
        return <span className="badge badge-warning">Eingeschränkt</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
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
        <Link href={`/admin/cases/${id}`} className="hover:text-[var(--primary)]">
          {caseData.debtorName}
        </Link>
        <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[var(--foreground)]">Sicherungsrechte</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Sicherungsrechte</h1>
          <p className="text-[var(--secondary)] mt-1">
            Übersicht über Sicherungsrechte und Verfügbarkeiten
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/admin/cases/${id}`} className="btn-secondary">
            Zurück zum Fall
          </Link>
          <Link href={`/admin/cases/${id}/bank-accounts`} className="btn-primary flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Bankkonten bearbeiten
          </Link>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Gesamtguthaben</p>
          <p className="text-xl font-bold text-[var(--foreground)]">{formatCurrency(totalBalanceCents)}</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Verfügbare Mittel</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalAvailableCents)}</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Besichert</p>
          <p className="text-xl font-bold text-orange-600">{formatCurrency(securedBalanceCents)}</p>
          <p className="text-xs text-[var(--muted)]">{securedAccounts.length} Konto(en)</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Unbesichert</p>
          <p className="text-xl font-bold text-[var(--foreground)]">{formatCurrency(unsecuredBalanceCents)}</p>
          <p className="text-xs text-[var(--muted)]">{unsecuredAccounts.length} Konto(en)</p>
        </div>
      </div>

      {/* Secured Accounts */}
      <div className="admin-card">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)] flex items-center">
            <svg className="w-5 h-5 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Besicherte Konten ({securedAccounts.length})
          </h2>
        </div>

        {securedAccounts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Bank / Konto</th>
                  <th>IBAN</th>
                  <th>Sicherungsnehmer</th>
                  <th className="text-right">Guthaben</th>
                  <th className="text-right">Verfügbar</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {securedAccounts.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <div>
                        <p className="font-medium text-[var(--foreground)]">{account.bankName}</p>
                        <p className="text-sm text-[var(--muted)]">{account.accountName}</p>
                      </div>
                    </td>
                    <td className="font-mono text-sm">{account.iban || "-"}</td>
                    <td>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        {account.securityHolder}
                      </span>
                    </td>
                    <td className="text-right font-medium">{formatCurrency(BigInt(account.balanceCents))}</td>
                    <td className="text-right font-medium text-green-600">{formatCurrency(BigInt(account.availableCents))}</td>
                    <td>{getStatusBadge(account.status)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold bg-orange-50">
                  <td colSpan={3}>Summe besichert</td>
                  <td className="text-right">{formatCurrency(securedBalanceCents)}</td>
                  <td className="text-right text-green-600">
                    {formatCurrency(securedAccounts.reduce((sum, a) => sum + BigInt(a.availableCents), BigInt(0)))}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-[var(--muted)]">
            <svg className="w-12 h-12 mx-auto mb-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p>Keine besicherten Konten vorhanden</p>
            <p className="text-sm mt-1">
              Sicherungsnehmer können in der{" "}
              <Link href={`/admin/cases/${id}/bank-accounts`} className="text-[var(--primary)] hover:underline">
                Bankkonten-Verwaltung
              </Link>{" "}
              hinterlegt werden.
            </p>
          </div>
        )}
      </div>

      {/* Unsecured Accounts */}
      <div className="admin-card">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)] flex items-center">
            <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Unbesicherte Konten ({unsecuredAccounts.length})
          </h2>
        </div>

        {unsecuredAccounts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Bank / Konto</th>
                  <th>IBAN</th>
                  <th className="text-right">Guthaben</th>
                  <th className="text-right">Verfügbar</th>
                  <th>Status</th>
                  <th>Notizen</th>
                </tr>
              </thead>
              <tbody>
                {unsecuredAccounts.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <div>
                        <p className="font-medium text-[var(--foreground)]">{account.bankName}</p>
                        <p className="text-sm text-[var(--muted)]">{account.accountName}</p>
                      </div>
                    </td>
                    <td className="font-mono text-sm">{account.iban || "-"}</td>
                    <td className="text-right font-medium">{formatCurrency(BigInt(account.balanceCents))}</td>
                    <td className="text-right font-medium text-green-600">{formatCurrency(BigInt(account.availableCents))}</td>
                    <td>{getStatusBadge(account.status)}</td>
                    <td className="text-sm text-[var(--muted)] max-w-xs truncate">{account.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold bg-green-50">
                  <td colSpan={2}>Summe unbesichert</td>
                  <td className="text-right">{formatCurrency(unsecuredBalanceCents)}</td>
                  <td className="text-right text-green-600">
                    {formatCurrency(unsecuredAccounts.reduce((sum, a) => sum + BigInt(a.availableCents), BigInt(0)))}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-[var(--muted)]">
            <p>Keine unbesicherten Konten vorhanden</p>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="admin-card p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium">Hinweis zu Sicherungsrechten</p>
            <ul className="mt-1 list-disc list-inside space-y-1">
              <li>Besicherte Konten unterliegen Absonderungsrechten (§§ 49 ff. InsO)</li>
              <li>Die Verfügbarkeit kann durch Globalzessionen, Pfandrechte oder AGB-Pfandrechte eingeschränkt sein</li>
              <li>Sicherungsnehmer werden in der Bankkonten-Verwaltung gepflegt</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
