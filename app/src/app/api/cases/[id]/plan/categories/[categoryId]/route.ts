import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// PUT /api/cases/[id]/plan/categories/[categoryId] - Update category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId, categoryId } = await params;
    const body = await request.json();
    const { name, flowType, estateType, displayOrder } = body;

    // Verify category belongs to this case
    const category = await prisma.cashflowCategory.findUnique({
      where: { id: categoryId },
      include: {
        plan: {
          include: { case: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Kategorie nicht gefunden" },
        { status: 404 }
      );
    }

    if (category.plan.case.id !== caseId) {
      return NextResponse.json(
        { error: "Kategorie gehoert nicht zu diesem Fall" },
        { status: 403 }
      );
    }

    // Update the category
    const updatedCategory = await prisma.cashflowCategory.update({
      where: { id: categoryId },
      data: {
        ...(name && { name: name.trim() }),
        ...(flowType && { flowType }),
        ...(estateType && { estateType }),
        ...(displayOrder !== undefined && { displayOrder }),
      },
    });

    return NextResponse.json({
      success: true,
      category: updatedCategory,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren der Kategorie" },
      { status: 500 }
    );
  }
}

// DELETE /api/cases/[id]/plan/categories/[categoryId] - Delete category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId, categoryId } = await params;

    // Verify category belongs to this case
    const category = await prisma.cashflowCategory.findUnique({
      where: { id: categoryId },
      include: {
        plan: {
          include: { case: true },
        },
        lines: {
          include: {
            periodValues: true,
          },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Kategorie nicht gefunden" },
        { status: 404 }
      );
    }

    if (category.plan.case.id !== caseId) {
      return NextResponse.json(
        { error: "Kategorie gehoert nicht zu diesem Fall" },
        { status: 403 }
      );
    }

    // Check if category has lines with values
    const hasValues = category.lines.some((line) => line.periodValues.length > 0);
    if (hasValues) {
      return NextResponse.json(
        { error: "Kategorie kann nicht geloescht werden - enthaelt noch Werte. Loeschen Sie zuerst die Zeilen." },
        { status: 400 }
      );
    }

    // Delete all lines first (even if empty), then the category
    await prisma.$transaction([
      prisma.cashflowLine.deleteMany({
        where: { categoryId },
      }),
      prisma.cashflowCategory.delete({
        where: { id: categoryId },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { error: "Fehler beim Loeschen der Kategorie" },
      { status: 500 }
    );
  }
}
