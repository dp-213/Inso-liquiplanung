import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// PUT /api/cases/[id]/plan/lines/[lineId] - Update line
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId, lineId } = await params;
    const body = await request.json();
    const { name, description, displayOrder, categoryId } = body;

    // Verify line belongs to this case
    const line = await prisma.cashflowLine.findUnique({
      where: { id: lineId },
      include: {
        category: {
          include: {
            plan: {
              include: { case: true },
            },
          },
        },
      },
    });

    if (!line) {
      return NextResponse.json(
        { error: "Zeile nicht gefunden" },
        { status: 404 }
      );
    }

    if (line.category.plan.case.id !== caseId) {
      return NextResponse.json(
        { error: "Zeile gehoert nicht zu diesem Fall" },
        { status: 403 }
      );
    }

    // Update the line
    const updatedLine = await prisma.cashflowLine.update({
      where: { id: lineId },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(displayOrder !== undefined && { displayOrder }),
        ...(categoryId && { categoryId }),
        updatedBy: session.username,
      },
    });

    return NextResponse.json({
      success: true,
      line: updatedLine,
    });
  } catch (error) {
    console.error("Error updating line:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren der Zeile" },
      { status: 500 }
    );
  }
}

// DELETE /api/cases/[id]/plan/lines/[lineId] - Delete line (including all values)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId, lineId } = await params;

    // Verify line belongs to this case
    const line = await prisma.cashflowLine.findUnique({
      where: { id: lineId },
      include: {
        category: {
          include: {
            plan: {
              include: { case: true },
            },
          },
        },
      },
    });

    if (!line) {
      return NextResponse.json(
        { error: "Zeile nicht gefunden" },
        { status: 404 }
      );
    }

    if (line.category.plan.case.id !== caseId) {
      return NextResponse.json(
        { error: "Zeile gehoert nicht zu diesem Fall" },
        { status: 403 }
      );
    }

    // Delete line (cascade will delete period values due to onDelete: Cascade in schema)
    await prisma.cashflowLine.delete({
      where: { id: lineId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting line:", error);
    return NextResponse.json(
      { error: "Fehler beim Loeschen der Zeile" },
      { status: 500 }
    );
  }
}
