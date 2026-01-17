import { NextResponse } from "next/server";
import { getCustomerSession, getAccessibleCases } from "@/lib/customer-auth";

export async function GET() {
  try {
    const session = await getCustomerSession();

    if (!session) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const accessibleCases = await getAccessibleCases(session.customerId);

    const cases = accessibleCases.map((record) => ({
      id: record.case.id,
      caseNumber: record.case.caseNumber,
      debtorName: record.case.debtorName,
      courtName: record.case.courtName,
      status: record.case.status,
      ownerName: record.case.owner.name,
      ownerCompany: record.case.owner.company,
      accessLevel: record.accessLevel,
      isOwner: record.isOwner,
      grantedAt: record.grantedAt.toISOString(),
      hasPlan: record.case.plans.length > 0,
      latestVersion: record.case.plans[0]?.versions[0]?.versionNumber ?? null,
    }));

    return NextResponse.json({ cases });
  } catch (error) {
    console.error("Error fetching customer cases:", error);
    return NextResponse.json(
      { error: "Fälle konnten nicht geladen werden" },
      { status: 500 }
    );
  }
}
