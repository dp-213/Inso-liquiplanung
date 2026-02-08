"use client";

import Link from "next/link";
import { EstateAllocationData } from "@/types/dashboard";

interface UnklarRiskBannerProps {
  caseId: string;
  estateAllocation: EstateAllocationData;
}

export default function UnklarRiskBanner({ caseId, estateAllocation }: UnklarRiskBannerProps) {
  const { unklarCount, totalUnklarInflowsCents, totalUnklarOutflowsCents } = estateAllocation;

  // Nur anzeigen, wenn UNKLAR-Buchungen existieren
  if (unklarCount === 0) {
    return null;
  }

  // Berechne Gesamtvolumen (absolut)
  const totalUnklarCents = BigInt(totalUnklarInflowsCents) + BigInt(totalUnklarOutflowsCents);
  const totalUnklarEuros = Number(totalUnklarCents) / 100;

  // Formatiere Betrag
  const formatCurrency = (euros: number): string => {
    return euros.toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  return (
    <Link
      href={`/admin/cases/${caseId}/ledger?estateAllocation=UNKLAR`}
      className="block no-print"
    >
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer">
        <div className="flex items-start gap-3">
          {/* Warning Icon */}
          <div className="flex-shrink-0">
            <svg
              className="w-6 h-6 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-amber-800">
                Alt/Neu-Zuordnung unvollständig
              </h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-200 text-amber-900">
                {unklarCount} {unklarCount === 1 ? "Buchung" : "Buchungen"}
              </span>
            </div>
            <p className="mt-1 text-sm text-amber-700">
              <strong>{formatCurrency(totalUnklarEuros)}</strong> an Zahlungsströmen sind noch nicht als Altmasse oder Neumasse klassifiziert.
              {" "}
              <span className="underline font-medium">Jetzt prüfen →</span>
            </p>
          </div>

          {/* Arrow Icon */}
          <div className="flex-shrink-0">
            <svg
              className="w-5 h-5 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}
