import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { calculateDataHash, PeriodValueInput } from "@/lib/calculation-engine";

// PUT /api/cases/[id]/plan/opening-balance - Update opening balance
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId } = await params;
    const body = await request.json();
    const { openingBalanceCents } = body;

    if (openingBalanceCents === undefined) {
      return NextResponse.json(
        { error: "openingBalanceCents erforderlich" },
        { status: 400 }
      );
    }

    // Get the active plan for this case
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        plans: {
          where: { isActive: true },
          include: {
            versions: {
              orderBy: { versionNumber: "desc" },
              take: 1,
            },
            categories: {
              include: {
                lines: {
                  include: {
                    periodValues: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!caseData) {
      return NextResponse.json(
        { error: "Fall nicht gefunden" },
        { status: 404 }
      );
    }

    const plan = caseData.plans[0];
    if (!plan) {
      return NextResponse.json(
        { error: "Kein aktiver Plan gefunden" },
        { status: 404 }
      );
    }

    // Calculate new data hash
    const periodValues: PeriodValueInput[] = plan.categories.flatMap((cat) =>
      cat.lines.flatMap((line) =>
        line.periodValues.map((pv) => ({
          lineId: line.id,
          periodIndex: pv.periodIndex,
          valueType: pv.valueType as "IST" | "PLAN",
          amountCents: BigInt(pv.amountCents),
        }))
      )
    );

    const dataHash = calculateDataHash(
      BigInt(openingBalanceCents),
      periodValues
    );

    // Get new version number
    const newVersionNumber = (plan.versions[0]?.versionNumber ?? 0) + 1;

    // Create new version with updated opening balance
    const newVersion = await prisma.liquidityPlanVersion.create({
      data: {
        planId: plan.id,
        versionNumber: newVersionNumber,
        snapshotReason: "Eroeffnungssaldo geaendert",
        openingBalanceCents: BigInt(openingBalanceCents),
        dataHash,
        createdBy: session.username,
      },
    });

    return NextResponse.json({
      success: true,
      version: {
        id: newVersion.id,
        versionNumber: newVersion.versionNumber,
        openingBalanceCents: newVersion.openingBalanceCents.toString(),
      },
    });
  } catch (error) {
    console.error("Error updating opening balance:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Eroeffnungssaldos" },
      { status: 500 }
    );
  }
}

// GET /api/cases/[id]/plan/opening-balance - Get current opening balance
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId } = await params;

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        plans: {
          where: { isActive: true },
          include: {
            versions: {
              orderBy: { versionNumber: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!caseData || !caseData.plans[0]) {
      return NextResponse.json(
        { error: "Fall oder Plan nicht gefunden" },
        { status: 404 }
      );
    }

    const latestVersion = caseData.plans[0].versions[0];
    const openingBalanceCents = latestVersion
      ? latestVersion.openingBalanceCents.toString()
      : "0";

    return NextResponse.json({
      openingBalanceCents,
      versionNumber: latestVersion?.versionNumber ?? 0,
    });
  } catch (error) {
    console.error("Error fetching opening balance:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Eroeffnungssaldos" },
      { status: 500 }
    );
  }
}
