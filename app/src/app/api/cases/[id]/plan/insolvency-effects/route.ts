import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/cases/[id]/plan/insolvency-effects - Get all insolvency effects for a case
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
            insolvencyEffects: {
              where: { isActive: true },
              orderBy: [
                { effectGroup: "asc" },
                { name: "asc" },
                { periodIndex: "asc" },
              ],
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

    // Group effects by name for easier display
    const effectsByName = activePlan.insolvencyEffects.reduce((acc, effect) => {
      const key = effect.name;
      if (!acc[key]) {
        acc[key] = {
          name: effect.name,
          description: effect.description,
          effectType: effect.effectType,
          effectGroup: effect.effectGroup,
          periods: [],
        };
      }
      acc[key].periods.push({
        id: effect.id,
        periodIndex: effect.periodIndex,
        amountCents: effect.amountCents.toString(),
      });
      return acc;
    }, {} as Record<string, {
      name: string;
      description: string | null;
      effectType: string;
      effectGroup: string;
      periods: { id: string; periodIndex: number; amountCents: string }[];
    }>);

    return NextResponse.json({
      planId: activePlan.id,
      periodType: activePlan.periodType,
      periodCount: activePlan.periodCount,
      effects: Object.values(effectsByName),
      rawEffects: activePlan.insolvencyEffects.map((e) => ({
        ...e,
        amountCents: e.amountCents.toString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching insolvency effects:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Insolvenzeffekte" },
      { status: 500 }
    );
  }
}

// POST /api/cases/[id]/plan/insolvency-effects - Create or update an insolvency effect
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
    const { name, description, effectType, effectGroup, periodIndex, amountCents, effectId } = body;

    // Validate required fields
    if (!name || effectType === undefined || periodIndex === undefined || amountCents === undefined) {
      return NextResponse.json(
        { error: "Erforderliche Felder: name, effectType, periodIndex, amountCents" },
        { status: 400 }
      );
    }

    // Validate effectType
    if (!["INFLOW", "OUTFLOW"].includes(effectType)) {
      return NextResponse.json(
        { error: "effectType muss INFLOW oder OUTFLOW sein" },
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

    // Validate periodIndex
    if (periodIndex < 0 || periodIndex >= activePlan.periodCount) {
      return NextResponse.json(
        { error: `periodIndex muss zwischen 0 und ${activePlan.periodCount - 1} liegen` },
        { status: 400 }
      );
    }

    let effect;
    if (effectId) {
      // Update existing effect
      effect = await prisma.insolvencyEffect.update({
        where: { id: effectId },
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          effectType,
          effectGroup: effectGroup || "GENERAL",
          periodIndex,
          amountCents: BigInt(amountCents),
          updatedBy: session.username,
        },
      });
    } else {
      // Create new effect
      effect = await prisma.insolvencyEffect.create({
        data: {
          planId: activePlan.id,
          name: name.trim(),
          description: description?.trim() || null,
          effectType,
          effectGroup: effectGroup || "GENERAL",
          periodIndex,
          amountCents: BigInt(amountCents),
          createdBy: session.username,
          updatedBy: session.username,
        },
      });
    }

    return NextResponse.json({
      success: true,
      effect: {
        ...effect,
        amountCents: effect.amountCents.toString(),
      },
    });
  } catch (error) {
    console.error("Error saving insolvency effect:", error);
    return NextResponse.json(
      { error: "Fehler beim Speichern des Insolvenzeffekts" },
      { status: 500 }
    );
  }
}

// DELETE /api/cases/[id]/plan/insolvency-effects - Delete an insolvency effect
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
    const effectId = searchParams.get("effectId");

    if (!effectId) {
      return NextResponse.json(
        { error: "effectId ist erforderlich" },
        { status: 400 }
      );
    }

    // Verify the effect belongs to an active plan of this case
    const effect = await prisma.insolvencyEffect.findUnique({
      where: { id: effectId },
      include: {
        plan: {
          select: { caseId: true, isActive: true },
        },
      },
    });

    if (!effect) {
      return NextResponse.json(
        { error: "Insolvenzeffekt nicht gefunden" },
        { status: 404 }
      );
    }

    if (effect.plan.caseId !== caseId || !effect.plan.isActive) {
      return NextResponse.json(
        { error: "Insolvenzeffekt gehört nicht zu diesem Fall" },
        { status: 403 }
      );
    }

    await prisma.insolvencyEffect.delete({
      where: { id: effectId },
    });

    return NextResponse.json({
      success: true,
      message: "Insolvenzeffekt gelöscht",
    });
  } catch (error) {
    console.error("Error deleting insolvency effect:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des Insolvenzeffekts" },
      { status: 500 }
    );
  }
}
