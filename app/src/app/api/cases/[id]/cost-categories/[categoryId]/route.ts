import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string; categoryId: string }>;
}

// PUT /api/cases/[id]/cost-categories/[categoryId] - Kostenart aktualisieren
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId, categoryId } = await params;
    const body = await request.json();
    const { name, shortName, description, budgetCents, categoryTag, isActive } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name ist erforderlich" },
        { status: 400 }
      );
    }

    const existing = await prisma.costCategory.findFirst({
      where: { id: categoryId, caseId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Kostenart nicht gefunden" },
        { status: 404 }
      );
    }

    const costCategory = await prisma.costCategory.update({
      where: { id: categoryId },
      data: {
        name: name.trim(),
        shortName: shortName?.trim() || null,
        description: description?.trim() || null,
        budgetCents: budgetCents !== undefined ? (budgetCents ? BigInt(budgetCents) : null) : existing.budgetCents,
        categoryTag: categoryTag !== undefined ? (categoryTag || null) : existing.categoryTag,
        isActive: isActive !== undefined ? isActive : existing.isActive,
      },
    });

    const serialized = JSON.parse(
      JSON.stringify(costCategory, (_, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Error updating cost category:", error);
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Eine Kostenart mit diesem Namen existiert bereits" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren der Kostenart" },
      { status: 500 }
    );
  }
}

// DELETE /api/cases/[id]/cost-categories/[categoryId] - Kostenart löschen
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId, categoryId } = await params;

    const existing = await prisma.costCategory.findFirst({
      where: { id: categoryId, caseId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Kostenart nicht gefunden" },
        { status: 404 }
      );
    }

    await prisma.costCategory.delete({
      where: { id: categoryId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting cost category:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen der Kostenart" },
      { status: 500 }
    );
  }
}
