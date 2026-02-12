import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string; creditorId: string }>;
}

// PUT /api/cases/[id]/creditors/[creditorId] - Kreditor aktualisieren
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId, creditorId } = await params;
    const body = await request.json();
    const { name, shortName, iban, taxId, category, defaultCostCategoryId, notes } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name ist erforderlich" },
        { status: 400 }
      );
    }

    const existing = await prisma.creditor.findFirst({
      where: { id: creditorId, caseId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Kreditor nicht gefunden" },
        { status: 404 }
      );
    }

    const creditor = await prisma.creditor.update({
      where: { id: creditorId },
      data: {
        name: name.trim(),
        shortName: shortName?.trim() || null,
        iban: iban?.trim() || null,
        taxId: taxId?.trim() || null,
        category: category || null,
        defaultCostCategoryId: defaultCostCategoryId || null,
        notes: notes?.trim() || null,
      },
    });

    return NextResponse.json(creditor);
  } catch (error) {
    console.error("Error updating creditor:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Kreditors" },
      { status: 500 }
    );
  }
}

// DELETE /api/cases/[id]/creditors/[creditorId] - Kreditor löschen
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId, creditorId } = await params;

    const existing = await prisma.creditor.findFirst({
      where: { id: creditorId, caseId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Kreditor nicht gefunden" },
        { status: 404 }
      );
    }

    await prisma.creditor.delete({
      where: { id: creditorId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting creditor:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des Kreditors" },
      { status: 500 }
    );
  }
}
