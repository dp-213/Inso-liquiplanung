import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/cases/[id]/plan/assumptions - Get all planning assumptions for a case
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

    // Get the active plan for the case
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        plans: {
          where: { isActive: true },
          include: {
            assumptions: {
              orderBy: { categoryName: "asc" },
            },
          },
          take: 1,
        },
      },
    });

    if (!caseData) {
      return NextResponse.json(
        { error: "Fall nicht gefunden" },
        { status: 404 }
      );
    }

    const activePlan = caseData.plans[0];
    if (!activePlan) {
      return NextResponse.json(
        { error: "Kein aktiver Plan gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      planId: activePlan.id,
      assumptions: activePlan.assumptions,
    });
  } catch (error) {
    console.error("Error fetching planning assumptions:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Planungsprämissen" },
      { status: 500 }
    );
  }
}

// POST /api/cases/[id]/plan/assumptions - Create or update a planning assumption
export async function POST(
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
    const { categoryName, source, description, riskLevel } = body;

    // Validate required fields
    if (!categoryName || !source || !description || !riskLevel) {
      return NextResponse.json(
        { error: "Alle Felder sind erforderlich: categoryName, source, description, riskLevel" },
        { status: 400 }
      );
    }

    // Validate riskLevel
    const validRiskLevels = ["conservative", "low", "medium", "high", "aggressive"];
    if (!validRiskLevels.includes(riskLevel)) {
      return NextResponse.json(
        { error: `riskLevel muss einer der folgenden Werte sein: ${validRiskLevels.join(", ")}` },
        { status: 400 }
      );
    }

    // Get the active plan for the case
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        plans: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!caseData) {
      return NextResponse.json(
        { error: "Fall nicht gefunden" },
        { status: 404 }
      );
    }

    const activePlan = caseData.plans[0];
    if (!activePlan) {
      return NextResponse.json(
        { error: "Kein aktiver Plan gefunden" },
        { status: 404 }
      );
    }

    // Upsert the assumption (create or update based on planId + categoryName)
    const assumption = await prisma.planningAssumption.upsert({
      where: {
        planId_categoryName: {
          planId: activePlan.id,
          categoryName,
        },
      },
      create: {
        planId: activePlan.id,
        categoryName,
        source: source.trim(),
        description: description.trim(),
        riskLevel,
        createdBy: session.username,
        updatedBy: session.username,
      },
      update: {
        source: source.trim(),
        description: description.trim(),
        riskLevel,
        updatedBy: session.username,
      },
    });

    return NextResponse.json({
      success: true,
      assumption,
    });
  } catch (error) {
    console.error("Error saving planning assumption:", error);
    return NextResponse.json(
      { error: "Fehler beim Speichern der Planungsprämisse" },
      { status: 500 }
    );
  }
}

// DELETE /api/cases/[id]/plan/assumptions - Delete a planning assumption
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId } = await params;
    const { searchParams } = new URL(request.url);
    const assumptionId = searchParams.get("assumptionId");

    if (!assumptionId) {
      return NextResponse.json(
        { error: "assumptionId ist erforderlich" },
        { status: 400 }
      );
    }

    // Verify the assumption belongs to an active plan of this case
    const assumption = await prisma.planningAssumption.findUnique({
      where: { id: assumptionId },
      include: {
        plan: {
          select: { caseId: true, isActive: true },
        },
      },
    });

    if (!assumption) {
      return NextResponse.json(
        { error: "Planungsprämisse nicht gefunden" },
        { status: 404 }
      );
    }

    if (assumption.plan.caseId !== caseId || !assumption.plan.isActive) {
      return NextResponse.json(
        { error: "Planungsprämisse gehört nicht zu diesem Fall" },
        { status: 403 }
      );
    }

    await prisma.planningAssumption.delete({
      where: { id: assumptionId },
    });

    return NextResponse.json({
      success: true,
      message: "Planungsprämisse gelöscht",
    });
  } catch (error) {
    console.error("Error deleting planning assumption:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen der Planungsprämisse" },
      { status: 500 }
    );
  }
}
