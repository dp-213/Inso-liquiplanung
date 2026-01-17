import { NextResponse } from "next/server";
import {
  getCustomerSession,
  getAccessibleCases,
} from "@/lib/customer-auth";

// GET /api/customer/cases - List all cases the customer can access
export async function GET() {
  try {
    const session = await getCustomerSession();

    if (!session) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const accessibleCases = await getAccessibleCases(session.customerId);

    // Transform to clean response format
    const cases = accessibleCases.map((access) => ({
      id: access.case.id,
      caseNumber: access.case.caseNumber,
      debtorName: access.case.debtorName,
      courtName: access.case.courtName,
      status: access.case.status,
      ownerName: access.case.owner.name,
      ownerCompany: access.case.owner.company,
      accessLevel: access.accessLevel,
      isOwner: access.isOwner,
      grantedAt: access.grantedAt,
      hasPlan: access.case.plans.length > 0,
      latestVersion: access.case.plans[0]?.versions[0]?.versionNumber ?? null,
    }));

    return NextResponse.json({ cases });
  } catch (error) {
    console.error("Error fetching customer cases:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Fälle" },
      { status: 500 }
    );
  }
}
