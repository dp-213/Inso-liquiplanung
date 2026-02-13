import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getOrderSteps } from "@/lib/approval-engine";

interface RouteProps {
  params: Promise<{
    id: string; // caseId
    orderId: string;
  }>;
}

// GET – Alle ApprovalSteps einer Order
export async function GET(_req: NextRequest, { params }: RouteProps) {
  try {
    const session = await requireAuth().catch(() => null);
    const { id: caseId, orderId } = await params;

    if (!session?.isAdmin) {
      const { getCustomerSession, checkCaseAccess } = await import("@/lib/customer-auth");
      const customerSession = await getCustomerSession();
      if (!customerSession) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });

      const access = await checkCaseAccess(customerSession.customerId, caseId);
      if (!access.hasAccess) return NextResponse.json({ error: "Zugriff verweigert" }, { status: 403 });
    }

    const steps = await getOrderSteps(orderId);

    const serialized = JSON.parse(
      JSON.stringify(steps, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("[Order Steps GET]", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
