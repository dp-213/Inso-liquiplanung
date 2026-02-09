"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * REDIRECT: /admin/cases/[id]/planung → /admin/cases/[id]/results
 *
 * Die Planungsseite wurde zur Results-Seite konsolidiert, da beide
 * denselben Inhalt zeigen (UnifiedCaseDashboard).
 */
export default function PlanungRedirect() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.id;
  const caseId = Array.isArray(rawId) ? rawId[0] : rawId;

  useEffect(() => {
    if (caseId) {
      router.replace(`/admin/cases/${caseId}/results`);
    }
  }, [caseId, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}
