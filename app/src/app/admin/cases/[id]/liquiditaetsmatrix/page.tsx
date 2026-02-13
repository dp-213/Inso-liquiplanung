"use client";

import { useParams } from "next/navigation";
import LiquidityMatrixTable from "@/components/dashboard/LiquidityMatrixTable";

export default function LiquiditaetsmatrixPage() {
  const params = useParams();
  const rawId = params.id;
  const caseId = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!caseId) return null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">Liquiditätstabelle</h1>
        <p className="text-sm text-[var(--secondary)] mt-1">
          Liquiditätsmatrix mit IST/PLAN-Darstellung
        </p>
      </div>
      <LiquidityMatrixTable caseId={caseId} />
    </div>
  );
}
