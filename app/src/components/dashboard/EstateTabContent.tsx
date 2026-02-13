"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatCurrency } from "@/types/dashboard";
import EstateComparisonChart from "@/components/external/EstateComparisonChart";

interface EstateData {
  altmasseInflowTotal: bigint;
  altmasseOutflowTotal: bigint;
  neumasseInflowTotal: bigint;
  neumasseOutflowTotal: bigint;
  unklarInflowTotal: bigint;
  unklarOutflowTotal: bigint;
  unklarCount: number;
}

interface EstateTabContentProps {
  caseId: string;
  scope: string;
}

export default function EstateTabContent({ caseId, scope }: EstateTabContentProps) {
  const [estateData, setEstateData] = useState<EstateData | null>(null);
  const [loading, setLoading] = useState(true);

  const formatCurrencyFn = useCallback((cents: bigint | string): string => {
    return formatCurrency(cents);
  }, []);

  useEffect(() => {
    if (!caseId) return;

    let cancelled = false;
    setLoading(true);

    async function fetchEstateData() {
      try {
        const res = await fetch(`/api/cases/${caseId}/ledger/estate-summary?scope=${scope}`, {
          credentials: 'include',
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setEstateData({
            altmasseInflowTotal: BigInt(data.altmasseInflowCents),
            altmasseOutflowTotal: BigInt(data.altmasseOutflowCents),
            neumasseInflowTotal: BigInt(data.neumasseInflowCents),
            neumasseOutflowTotal: BigInt(data.neumasseOutflowCents),
            unklarInflowTotal: BigInt(data.unklarInflowCents),
            unklarOutflowTotal: BigInt(data.unklarOutflowCents),
            unklarCount: data.unklarCount,
          });
        }
      } catch (error) {
        console.error('Fehler beim Laden der Estate-Daten:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchEstateData();
    return () => { cancelled = true; };
  }, [caseId, scope]);

  if (loading || !estateData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-[var(--secondary)]">Lade Estate-Daten...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Links zu Detail-Listen (Backup Pages) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href={`/admin/cases/${caseId}/ledger?estateAllocation=ALTMASSE`}
          className="admin-card p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="font-medium">Altmasse</span>
          </div>
          <p className="text-sm text-[var(--secondary)]">
            Alle Buchungen vor Insolvenzeröffnung ansehen →
          </p>
        </Link>

        <Link
          href={`/admin/cases/${caseId}/ledger?estateAllocation=NEUMASSE`}
          className="admin-card p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="font-medium">Neumasse</span>
          </div>
          <p className="text-sm text-[var(--secondary)]">
            Alle Buchungen nach Insolvenzeröffnung ansehen →
          </p>
        </Link>

        {/* UNKLAR - prominent, mit Warnung */}
        {estateData.unklarCount > 0 && (
          <Link
            href={`/admin/cases/${caseId}/ledger?estateAllocation=UNKLAR`}
            className="admin-card p-4 hover:shadow-md transition-shadow border-l-4 border-amber-500 bg-amber-50"
          >
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium text-amber-800">{estateData.unklarCount} nicht zugeordnet</span>
            </div>
            <p className="text-sm text-amber-700">
              Buchungen ohne Alt/Neu-Zuordnung prüfen →
            </p>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Gesamteinnahmen</div>
          <div className="text-2xl font-bold text-green-600">{formatCurrencyFn(estateData.altmasseInflowTotal + estateData.neumasseInflowTotal)}</div>
        </div>
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Gesamtausgaben</div>
          <div className="text-2xl font-bold text-red-600">-{formatCurrencyFn(estateData.altmasseOutflowTotal + estateData.neumasseOutflowTotal)}</div>
        </div>
        <div className="admin-card p-4">
          <div className="text-sm text-[var(--secondary)]">Netto-Zufluss</div>
          <div className="text-2xl font-bold text-[var(--foreground)]">{formatCurrencyFn((estateData.altmasseInflowTotal + estateData.neumasseInflowTotal) - (estateData.altmasseOutflowTotal + estateData.neumasseOutflowTotal))}</div>
        </div>
      </div>

      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Altmasse vs Neumasse Vergleich</h2>
        <EstateComparisonChart altmasseInflows={estateData.altmasseInflowTotal} altmasseOutflows={estateData.altmasseOutflowTotal} neumasseInflows={estateData.neumasseInflowTotal} neumasseOutflows={estateData.neumasseOutflowTotal} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Altmasse */}
        <div className="admin-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Altmasse</h2>
          </div>
          <p className="text-sm text-[var(--secondary)] mb-4">Vor Insolvenzeröffnung entstanden (inkl. anteilige MIXED-Buchungen)</p>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-3 bg-green-50 rounded">
              <div className="text-xs text-[var(--secondary)] mb-1">Einnahmen</div>
              <div className="text-lg font-semibold text-green-600">{formatCurrencyFn(estateData.altmasseInflowTotal)}</div>
            </div>
            <div className="p-3 bg-red-50 rounded">
              <div className="text-xs text-[var(--secondary)] mb-1">Ausgaben</div>
              <div className="text-lg font-semibold text-red-600">{formatCurrencyFn(estateData.altmasseOutflowTotal)}</div>
            </div>
          </div>
          <div className={`mt-4 p-3 rounded-lg ${estateData.altmasseInflowTotal >= estateData.altmasseOutflowTotal ? "bg-green-600" : "bg-red-600"} text-white`}>
            <div className="flex justify-between"><span>Netto Altmasse</span><span className="font-bold">{formatCurrencyFn(estateData.altmasseInflowTotal - estateData.altmasseOutflowTotal)}</span></div>
          </div>
        </div>

        {/* Neumasse */}
        <div className="admin-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Neumasse</h2>
          </div>
          <p className="text-sm text-[var(--secondary)] mb-4">Nach Insolvenzeröffnung entstanden (inkl. anteilige MIXED-Buchungen)</p>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-3 bg-green-50 rounded">
              <div className="text-xs text-[var(--secondary)] mb-1">Einnahmen</div>
              <div className="text-lg font-semibold text-green-600">{formatCurrencyFn(estateData.neumasseInflowTotal)}</div>
            </div>
            <div className="p-3 bg-red-50 rounded">
              <div className="text-xs text-[var(--secondary)] mb-1">Ausgaben</div>
              <div className="text-lg font-semibold text-red-600">{formatCurrencyFn(estateData.neumasseOutflowTotal)}</div>
            </div>
          </div>
          <div className={`mt-4 p-3 rounded-lg ${estateData.neumasseInflowTotal >= estateData.neumasseOutflowTotal ? "bg-green-600" : "bg-red-600"} text-white`}>
            <div className="flex justify-between"><span>Netto Neumasse</span><span className="font-bold">{formatCurrencyFn(estateData.neumasseInflowTotal - estateData.neumasseOutflowTotal)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
