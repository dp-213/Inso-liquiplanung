import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/cases/[id]/creditors - Alle Kreditoren eines Falls abrufen
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
        creditors: {
          include: {
            defaultCostCategory: {
              select: { id: true, name: true, shortName: true },
            },
          },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!caseData) {
      return NextResponse.json(
        { error: "Fall nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      caseId: caseData.id,
      creditors: caseData.creditors,
    });
  } catch (error) {
    console.error("Error fetching creditors:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Kreditoren" },
      { status: 500 }
    );
  }
}

// POST /api/cases/[id]/creditors - Neuen Kreditor erstellen
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
    const { name, shortName, iban, taxId, category, defaultCostCategoryId, notes } = body;

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

    const creditor = await prisma.creditor.create({
      data: {
        caseId,
        name: name.trim(),
        shortName: shortName?.trim() || null,
        iban: iban?.trim() || null,
        taxId: taxId?.trim() || null,
        category: category || null,
        defaultCostCategoryId: defaultCostCategoryId || null,
        notes: notes?.trim() || null,
      },
    });

    return NextResponse.json(creditor, { status: 201 });
  } catch (error) {
    console.error("Error creating creditor:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Kreditors" },
      { status: 500 }
    );
  }
}
