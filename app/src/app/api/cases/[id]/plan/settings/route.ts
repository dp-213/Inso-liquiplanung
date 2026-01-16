import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/cases/[id]/plan/settings - Get plan settings
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
          select: {
            id: true,
            name: true,
            periodType: true,
            periodCount: true,
            planStartDate: true,
            description: true,
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
      name: activePlan.name,
      periodType: activePlan.periodType,
      periodCount: activePlan.periodCount,
      planStartDate: activePlan.planStartDate,
      description: activePlan.description,
    });
  } catch (error) {
    console.error("Error fetching plan settings:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Planeinstellungen" },
      { status: 500 }
    );
  }
}

// PUT /api/cases/[id]/plan/settings - Update plan settings
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
    const { name, periodType, periodCount, planStartDate, description } = body;

    // Get active plan
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

    // Validate periodType
    if (periodType && !["WEEKLY", "MONTHLY"].includes(periodType)) {
      return NextResponse.json(
        { error: "periodType muss WEEKLY oder MONTHLY sein" },
        { status: 400 }
      );
    }

    // Validate periodCount
    if (periodCount !== undefined && (periodCount < 1 || periodCount > 52)) {
      return NextResponse.json(
        { error: "periodCount muss zwischen 1 und 52 liegen" },
        { status: 400 }
      );
    }

    // Update plan
    const updatedPlan = await prisma.liquidityPlan.update({
      where: { id: activePlan.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(periodType && { periodType }),
        ...(periodCount !== undefined && { periodCount }),
        ...(planStartDate && { planStartDate: new Date(planStartDate) }),
        ...(description !== undefined && { description: description?.trim() || null }),
        updatedBy: session.username,
      },
    });

    return NextResponse.json({
      success: true,
      plan: {
        id: updatedPlan.id,
        name: updatedPlan.name,
        periodType: updatedPlan.periodType,
        periodCount: updatedPlan.periodCount,
        planStartDate: updatedPlan.planStartDate,
        description: updatedPlan.description,
      },
    });
  } catch (error) {
    console.error("Error updating plan settings:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren der Planeinstellungen" },
      { status: 500 }
    );
  }
}
