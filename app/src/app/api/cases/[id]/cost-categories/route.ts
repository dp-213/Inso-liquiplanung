import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/cases/[id]/cost-categories - Alle Kostenarten eines Falls abrufen
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
        costCategories: {
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    if (!caseData) {
      return NextResponse.json(
        { error: "Fall nicht gefunden" },
        { status: 404 }
      );
    }

    // BigInt-Serialisierung
    const serialized = JSON.parse(
      JSON.stringify(caseData.costCategories, (_, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return NextResponse.json({
      caseId: caseData.id,
      costCategories: serialized,
    });
  } catch (error) {
    console.error("Error fetching cost categories:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Kostenarten" },
      { status: 500 }
    );
  }
}

// POST /api/cases/[id]/cost-categories - Neue Kostenart erstellen
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
    const { name, shortName, description, budgetCents, categoryTag, isActive } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name ist erforderlich" },
        { status: 400 }
      );
    }

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseData) {
      return NextResponse.json(
        { error: "Fall nicht gefunden" },
        { status: 404 }
      );
    }

    const costCategory = await prisma.costCategory.create({
      data: {
        caseId,
        name: name.trim(),
        shortName: shortName?.trim() || null,
        description: description?.trim() || null,
        budgetCents: budgetCents ? BigInt(budgetCents) : null,
        categoryTag: categoryTag || null,
        isActive: isActive !== false,
      },
    });

    const serialized = JSON.parse(
      JSON.stringify(costCategory, (_, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return NextResponse.json(serialized, { status: 201 });
  } catch (error) {
    console.error("Error creating cost category:", error);
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Eine Kostenart mit diesem Namen existiert bereits" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Kostenart" },
      { status: 500 }
    );
  }
}
