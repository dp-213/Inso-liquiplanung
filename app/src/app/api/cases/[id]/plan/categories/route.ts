import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/cases/[id]/plan/categories - Get all categories for case's active plan
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
            categories: {
              include: {
                lines: {
                  orderBy: { displayOrder: "asc" },
                },
              },
              orderBy: { displayOrder: "asc" },
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

    return NextResponse.json({
      categories: caseData.plans[0].categories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Kategorien" },
      { status: 500 }
    );
  }
}

// POST /api/cases/[id]/plan/categories - Create new category
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
    const { name, flowType, estateType, displayOrder } = body;

    // Validate required fields
    if (!name || !flowType || !estateType) {
      return NextResponse.json(
        { error: "name, flowType und estateType erforderlich" },
        { status: 400 }
      );
    }

    // Validate enums
    if (!["INFLOW", "OUTFLOW"].includes(flowType)) {
      return NextResponse.json(
        { error: "flowType muss INFLOW oder OUTFLOW sein" },
        { status: 400 }
      );
    }

    if (!["ALTMASSE", "NEUMASSE"].includes(estateType)) {
      return NextResponse.json(
        { error: "estateType muss ALTMASSE oder NEUMASSE sein" },
        { status: 400 }
      );
    }

    // Get the active plan
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        plans: {
          where: { isActive: true },
          include: {
            categories: {
              orderBy: { displayOrder: "desc" },
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

    const plan = caseData.plans[0];
    const maxOrder = plan.categories[0]?.displayOrder ?? 0;

    // Create the category
    const category = await prisma.cashflowCategory.create({
      data: {
        planId: plan.id,
        name: name.trim(),
        flowType,
        estateType,
        displayOrder: displayOrder ?? maxOrder + 1,
        isSystem: false,
        createdBy: session.username,
      },
    });

    return NextResponse.json({
      success: true,
      category,
    });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Kategorie" },
      { status: 500 }
    );
  }
}

// PATCH /api/cases/[id]/plan/categories - Reorder categories
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await params; // Consume params even if not used
    const body = await request.json();
    const { categories } = body;

    if (!Array.isArray(categories)) {
      return NextResponse.json(
        { error: "categories Array erforderlich" },
        { status: 400 }
      );
    }

    // Update all display orders in a transaction
    await prisma.$transaction(
      categories.map((cat: { id: string; displayOrder: number }) =>
        prisma.cashflowCategory.update({
          where: { id: cat.id },
          data: { displayOrder: cat.displayOrder },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering categories:", error);
    return NextResponse.json(
      { error: "Fehler beim Neuordnen der Kategorien" },
      { status: 500 }
    );
  }
}
