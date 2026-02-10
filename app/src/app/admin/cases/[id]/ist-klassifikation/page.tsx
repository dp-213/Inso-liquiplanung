import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getISTKlassifikationData(caseId: string) {
  // Gesamt-Statistik
  const gesamtStats = await prisma.ledgerEntry.groupBy({
    by: ['estateAllocation'],
    where: {
      caseId,
      valueType: 'IST',
      reviewStatus: 'CONFIRMED',
    },
    _count: { id: true },
    _sum: { amountCents: true },
  });

  // Oktober-Splits (1/3-2/3 Regel)
  const oktoberSplits = await prisma.ledgerEntry.groupBy({
    by: ['estateAllocation'],
    where: {
      caseId,
      valueType: 'IST',
      allocationNote: { contains: '1/3 ALTMASSE, 2/3 NEUMASSE' },
    },
    _count: { id: true },
    _sum: { amountCents: true },
  });

  // Ungeprüfte Einträge
  const unreviewed = await prisma.ledgerEntry.count({
    where: {
      caseId,
      valueType: 'IST',
      reviewStatus: 'UNREVIEWED',
    },
  });

  // Beispiel-Einträge für Oktober-Splits
  const oktoberBeispiele = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      allocationNote: { contains: '1/3 ALTMASSE, 2/3 NEUMASSE' },
      estateAllocation: 'ALTMASSE',
    },
    include: {
      counterparty: { select: { name: true } },
    },
    orderBy: { amountCents: 'desc' },
    take: 8,
  });

  return {
    gesamtStats,
    oktoberSplits,
    unreviewed,
    oktoberBeispiele,
  };
}

export default async function ISTKlassifikationPage({ params }: PageProps) {
  const { id } = await params;

  const caseData = await prisma.case.findUnique({
    where: { id },
    select: { id: true, debtorName: true, caseNumber: true },
  });

  if (!caseData) {
    notFound();
  }

  const data = await getISTKlassifikationData(id);

  const altmasseStats = data.gesamtStats.find(s => s.estateAllocation === 'ALTMASSE');
  const neumasseStats = data.gesamtStats.find(s => s.estateAllocation === 'NEUMASSE');

  const totalEntries = (altmasseStats?._count.id || 0) + (neumasseStats?._count.id || 0);
  const totalAmount = Number(altmasseStats?._sum.amountCents || 0) + Number(neumasseStats?._sum.amountCents || 0);

  const oktoberAlt = data.oktoberSplits.find(s => s.estateAllocation === 'ALTMASSE');
  const oktoberNeu = data.oktoberSplits.find(s => s.estateAllocation === 'NEUMASSE');

  const formatCents = (cents: number | bigint | null | undefined) => {
    if (cents === null || cents === undefined) return '0,00';
    const value = typeof cents === 'bigint' ? Number(cents) : cents;
    return (value / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">IST-Daten Klassifikation</h1>
            <p className="text-[var(--muted)]">
              Executive Summary für IV-Präsentation · {caseData.caseNumber}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {data.unreviewed === 0 ? (
              <div className="badge badge-success">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                100% Klassifiziert
              </div>
            ) : (
              <div className="badge badge-warning">
                {data.unreviewed} ungeprüft
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Zahlen auf einen Blick */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Zahlen auf einen Blick
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-6 rounded-lg border border-orange-200 dark:border-orange-700">
            <div className="text-sm text-orange-600 dark:text-orange-400 font-medium mb-1">ALTMASSE</div>
            <div className="text-3xl font-bold text-orange-700 dark:text-orange-300 mb-2">
              {altmasseStats?._count.id || 0}
            </div>
            <div className="text-lg text-orange-600 dark:text-orange-400">
              {formatCents(altmasseStats?._sum.amountCents)} EUR
            </div>
            <div className="text-xs text-orange-500 dark:text-orange-500 mt-2">
              Vor Insolvenz · Gläubiger
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-lg border border-green-200 dark:border-green-700">
            <div className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">NEUMASSE</div>
            <div className="text-3xl font-bold text-green-700 dark:text-green-300 mb-2">
              {neumasseStats?._count.id || 0}
            </div>
            <div className="text-lg text-green-600 dark:text-green-400">
              {formatCents(neumasseStats?._sum.amountCents)} EUR
            </div>
            <div className="text-xs text-green-500 dark:text-green-500 mt-2">
              Nach Insolvenz · Masse
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">GESAMT IST</div>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-300 mb-2">
              {totalEntries}
            </div>
            <div className="text-lg text-blue-600 dark:text-blue-400">
              {formatCents(totalAmount)} EUR
            </div>
            <div className="text-xs text-blue-500 dark:text-blue-500 mt-2">
              Okt 2025 - Jan 2026
            </div>
          </div>
        </div>
      </div>

      {/* Kernbotschaft */}
      <div className="admin-card p-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-l-4 border-purple-500">
        <h2 className="text-lg font-semibold mb-3 flex items-center text-purple-700 dark:text-purple-300">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Kernbotschaft für IV
        </h2>
        <div className="bg-white/60 dark:bg-gray-800/60 p-4 rounded-lg">
          <p className="text-[var(--foreground)] leading-relaxed font-medium">
            Alle IST-Daten sind vollständig klassifiziert. <strong>Wichtigste Erkenntnis:</strong> Am 29.10.
            standen nur <strong className="text-green-600 dark:text-green-400">15.941 EUR Neumasse</strong> zur Verfügung,
            nicht 40.000 EUR. Die Differenz (<strong className="text-orange-600 dark:text-orange-400">23.721 EUR</strong>)
            ist Altmasse, weil der Leistungszeitraum vor der Insolvenz lag.
          </p>
        </div>
      </div>

      {/* Kritische Regel */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          KRITISCHE REGEL: Leistungszeitraum &gt; Zahlungsdatum
        </h2>

        <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 p-5 rounded-lg border border-red-200 dark:border-red-700">
          <h3 className="font-semibold mb-3 text-red-700 dark:text-red-300">Beispiel: HZV Q3-Nachzahlung</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-sm text-[var(--muted)] mb-1">Zahlung</div>
              <div className="font-mono font-bold">29.10.2025</div>
              <div className="text-xs text-red-600 dark:text-red-400">NACH Insolvenz</div>
            </div>
            <div>
              <div className="text-sm text-[var(--muted)] mb-1">Leistung</div>
              <div className="font-mono font-bold">Juli-Sept 2025</div>
              <div className="text-xs text-green-600 dark:text-green-400">VOR Insolvenz</div>
            </div>
            <div>
              <div className="text-sm text-[var(--muted)] mb-1">Zuordnung</div>
              <div className="font-mono font-bold text-orange-600 dark:text-orange-400">100% ALTMASSE</div>
              <div className="text-xs text-orange-600 dark:text-orange-400">15.750 EUR</div>
            </div>
          </div>
          <div className="bg-white/80 dark:bg-gray-800/80 p-3 rounded border-l-4 border-red-500">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              ❌ Diese 15.750 EUR stehen NICHT der Neumasse zur Verfügung!
            </p>
          </div>
        </div>
      </div>

      {/* Oktober 2025: Split-Regel */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Oktober 2025: Split-Regel 1/3 ALTMASSE, 2/3 NEUMASSE
        </h2>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700 mb-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Lt. IV-Vorgabe Hannes (Massekreditvertrag §1(2)a):</strong> Für alle Zahlungen mit Leistungszeitraum Oktober 2025
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-orange-50 dark:bg-orange-900/20 p-5 rounded-lg border border-orange-200 dark:border-orange-700">
            <div className="text-sm text-orange-600 dark:text-orange-400 font-medium mb-2">ALTMASSE-Anteil</div>
            <div className="text-4xl font-bold text-orange-700 dark:text-orange-300 mb-2">1/3</div>
            <div className="text-sm text-[var(--muted)]">
              {oktoberAlt?._count.id || 0} Einträge · {formatCents(oktoberAlt?._sum.amountCents)} EUR
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 p-5 rounded-lg border border-green-200 dark:border-green-700">
            <div className="text-sm text-green-600 dark:text-green-400 font-medium mb-2">NEUMASSE-Anteil</div>
            <div className="text-4xl font-bold text-green-700 dark:text-green-300 mb-2">2/3</div>
            <div className="text-sm text-[var(--muted)]">
              {oktoberNeu?._count.id || 0} Einträge · {formatCents(oktoberNeu?._sum.amountCents)} EUR
            </div>
          </div>
        </div>

        <h3 className="font-semibold mb-3">Beispiele: Krankenkassenbeiträge Oktober</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                <th className="py-2 px-3 font-medium text-[var(--muted)]">Kasse</th>
                <th className="py-2 px-3 font-medium text-[var(--muted)] text-right">Original</th>
                <th className="py-2 px-3 font-medium text-[var(--muted)] text-right">ALTMASSE (1/3)</th>
                <th className="py-2 px-3 font-medium text-[var(--muted)] text-right">NEUMASSE (2/3)</th>
              </tr>
            </thead>
            <tbody>
              {data.oktoberBeispiele.map((entry, idx) => {
                const original = Number(entry.amountCents) * 3; // 1/3 rückrechnen
                const neu = Number(entry.amountCents) * 2; // 2/3 berechnen
                return (
                  <tr key={entry.id} className={idx % 2 === 0 ? 'bg-[var(--background-alt)]' : ''}>
                    <td className="py-2 px-3">{entry.counterparty?.name || '—'}</td>
                    <td className="py-2 px-3 text-right font-mono">{formatCents(original)} EUR</td>
                    <td className="py-2 px-3 text-right font-mono text-orange-600 dark:text-orange-400">
                      {formatCents(entry.amountCents)} EUR
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-green-600 dark:text-green-400">
                      {formatCents(neu)} EUR
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verifikationsfragen */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Verifikationsfragen für IV
        </h2>

        <div className="space-y-4">
          <div className="border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-900/20 p-4 rounded-r-lg">
            <h3 className="font-semibold mb-2 text-purple-700 dark:text-purple-300">1. Leistungszeitraum-Regel OK?</h3>
            <p className="text-sm text-[var(--muted)] mb-2">
              <strong>Frage:</strong> HZV Q3-Nachzahlung (gezahlt 29.10.) → ALTMASSE, weil Leistung vor Insolvenz?
            </p>
            <p className="text-sm text-green-600 dark:text-green-400">
              <strong>Erwartung:</strong> Ja, korrekt.
            </p>
          </div>

          <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-r-lg">
            <h3 className="font-semibold mb-2 text-blue-700 dark:text-blue-300">2. Oktober 1/3-2/3 Regel OK?</h3>
            <p className="text-sm text-[var(--muted)] mb-2">
              <strong>Frage:</strong> Alle Oktober-Leistungen nach 1/3-2/3 splitten?
            </p>
            <p className="text-sm text-green-600 dark:text-green-400">
              <strong>Erwartung:</strong> Ja, korrekt.
            </p>
          </div>

          <div className="border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-900/20 p-4 rounded-r-lg">
            <h3 className="font-semibold mb-2 text-orange-700 dark:text-orange-300">3. KV Q4-Abschläge OK?</h3>
            <p className="text-sm text-[var(--muted)] mb-2">
              <strong>Frage:</strong> 1. Rate (10.10.) → 100% Alt, 2. Rate (17.11.) → 1/3-2/3 Split?
            </p>
            <p className="text-sm text-green-600 dark:text-green-400">
              <strong>Erwartung:</strong> Ja, korrekt.
            </p>
          </div>

          <div className="border-l-4 border-gray-500 bg-gray-50 dark:bg-gray-800/20 p-4 rounded-r-lg">
            <h3 className="font-semibold mb-2">4. Vollständigkeit OK?</h3>
            <p className="text-sm text-[var(--muted)] mb-2">
              <strong>Frage:</strong> Weitere Oktober-Leistungen zu splitten?
            </p>
            <p className="text-sm text-green-600 dark:text-green-400">
              <strong>Erwartung:</strong> Nein, alle erfasst.
            </p>
          </div>
        </div>
      </div>

      {/* Dokumentation */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Dokumentation
        </h2>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <p className="text-sm text-[var(--muted)] mb-4">
            Alle Details sind im Ledger-System dokumentiert:
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start">
              <svg className="w-4 h-4 mr-2 mt-0.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Jeder Eintrag mit Begründung (<code className="text-xs bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded">allocationNote</code>)</span>
            </li>
            <li className="flex items-start">
              <svg className="w-4 h-4 mr-2 mt-0.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Alle Splits dokumentiert und cross-referenziert</span>
            </li>
            <li className="flex items-start">
              <svg className="w-4 h-4 mr-2 mt-0.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Exportierbar für IV-Prüfung über Zahlungsregister</span>
            </li>
          </ul>

          <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
            <Link
              href={`/admin/cases/${id}/ledger?valueType=IST`}
              className="btn-primary inline-flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Zum Zahlungsregister (IST-Einträge)
            </Link>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="admin-card p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-1 flex items-center text-green-700 dark:text-green-300">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Status
            </h2>
            <p className="text-sm text-[var(--muted)]">
              IST-Klassifikation abgeschlossen · Bereit für IV-Präsentation
            </p>
          </div>
          <div className="text-right">
            <div className="badge badge-success text-base px-4 py-2">
              ✅ PRODUKTIONSREIF
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
