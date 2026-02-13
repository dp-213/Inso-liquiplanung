import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/cases/[id]/plan/assumptions - Get all planning assumptions for a case
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId } = await params;

    // Case-Level: Direkt über caseId abfragen
    const assumptions = await prisma.planningAssumption.findMany({
      where: { caseId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      assumptions,
    });
  } catch (error) {
    console.error("Error fetching planning assumptions:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Planungsannahmen" },
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
    const { id: assumptionId, title, source, description, status, linkedModule, linkedEntityId } = body;

    // Validate required fields
    if (!title || !source || !description) {
      return NextResponse.json(
        { error: "Pflichtfelder: title, source, description" },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ["ANNAHME", "VERIFIZIERT", "WIDERLEGT"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status muss einer der folgenden Werte sein: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    if (assumptionId) {
      // Update existing
      const assumption = await prisma.planningAssumption.update({
        where: { id: assumptionId },
        data: {
          title: title.trim(),
          source: source.trim(),
          description: description.trim(),
          status: status || "ANNAHME",
          linkedModule: linkedModule || null,
          linkedEntityId: linkedEntityId || null,
          updatedBy: session.username,
        },
      });
      return NextResponse.json({ success: true, assumption });
    } else {
      // Create new
      const assumption = await prisma.planningAssumption.create({
        data: {
          caseId,
          title: title.trim(),
          source: source.trim(),
          description: description.trim(),
          status: status || "ANNAHME",
          linkedModule: linkedModule || null,
          linkedEntityId: linkedEntityId || null,
          createdBy: session.username,
          updatedBy: session.username,
        },
      });
      return NextResponse.json({ success: true, assumption }, { status: 201 });
    }
  } catch (error) {
    console.error("Error saving planning assumption:", error);
    return NextResponse.json(
      { error: "Fehler beim Speichern der Planungsannahme" },
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

    // Verify the assumption belongs to this case
    const assumption = await prisma.planningAssumption.findUnique({
      where: { id: assumptionId },
    });

    if (!assumption) {
      return NextResponse.json(
        { error: "Planungsannahme nicht gefunden" },
        { status: 404 }
      );
    }

    if (assumption.caseId !== caseId) {
      return NextResponse.json(
        { error: "Planungsannahme gehört nicht zu diesem Fall" },
        { status: 403 }
      );
    }

    await prisma.planningAssumption.delete({
      where: { id: assumptionId },
    });

    return NextResponse.json({
      success: true,
      message: "Planungsannahme gelöscht",
    });
  } catch (error) {
    console.error("Error deleting planning assumption:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen der Planungsannahme" },
      { status: 500 }
    );
  }
}
