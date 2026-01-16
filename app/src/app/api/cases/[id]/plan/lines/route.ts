import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// POST /api/cases/[id]/plan/lines - Create new line
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
    const { categoryId, name, description, displayOrder } = body;

    // Validate required fields
    if (!categoryId || !name) {
      return NextResponse.json(
        { error: "categoryId und name erforderlich" },
        { status: 400 }
      );
    }

    // Verify category belongs to this case
    const category = await prisma.cashflowCategory.findUnique({
      where: { id: categoryId },
      include: {
        plan: {
          include: { case: true },
        },
        lines: {
          orderBy: { displayOrder: "desc" },
          take: 1,
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

    const maxOrder = category.lines[0]?.displayOrder ?? 0;

    // Create the line
    const line = await prisma.cashflowLine.create({
      data: {
        categoryId,
        name: name.trim(),
        description: description?.trim() || null,
        displayOrder: displayOrder ?? maxOrder + 1,
        isLocked: false,
        createdBy: session.username,
        updatedBy: session.username,
      },
    });

    return NextResponse.json({
      success: true,
      line,
    });
  } catch (error) {
    console.error("Error creating line:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Zeile" },
      { status: 500 }
    );
  }
}

// PATCH /api/cases/[id]/plan/lines - Reorder lines
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await params;
    const body = await request.json();
    const { lines } = body;

    if (!Array.isArray(lines)) {
      return NextResponse.json(
        { error: "lines Array erforderlich" },
        { status: 400 }
      );
    }

    // Update all display orders in a transaction
    await prisma.$transaction(
      lines.map((line: { id: string; displayOrder: number; categoryId?: string }) =>
        prisma.cashflowLine.update({
          where: { id: line.id },
          data: {
            displayOrder: line.displayOrder,
            ...(line.categoryId && { categoryId: line.categoryId }),
            updatedBy: session.username,
          },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering lines:", error);
    return NextResponse.json(
      { error: "Fehler beim Neuordnen der Zeilen" },
      { status: 500 }
    );
  }
}
