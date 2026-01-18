import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string; counterpartyId: string }>;
}

// GET /api/cases/[id]/counterparties/[counterpartyId] - Einzelne Gegenpartei abrufen
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId, counterpartyId } = await params;

    const counterparty = await prisma.counterparty.findFirst({
      where: { id: counterpartyId, caseId },
    });

    if (!counterparty) {
      return NextResponse.json(
        { error: "Gegenpartei nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json(counterparty);
  } catch (error) {
    console.error("Error fetching counterparty:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Gegenpartei" },
      { status: 500 }
    );
  }
}

// PUT /api/cases/[id]/counterparties/[counterpartyId] - Gegenpartei aktualisieren
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId, counterpartyId } = await params;
    const body = await request.json();
    const { name, shortName, type, matchPattern, isTopPayer, notes } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name ist erforderlich" },
        { status: 400 }
      );
    }

    // Prüfen ob Gegenpartei existiert und zum Case gehört
    const existing = await prisma.counterparty.findFirst({
      where: { id: counterpartyId, caseId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Gegenpartei nicht gefunden" },
        { status: 404 }
      );
    }

    const counterparty = await prisma.counterparty.update({
      where: { id: counterpartyId },
      data: {
        name: name.trim(),
        shortName: shortName?.trim() || null,
        type: type || null,
        matchPattern: matchPattern?.trim() || null,
        isTopPayer: isTopPayer || false,
        notes: notes?.trim() || null,
      },
    });

    return NextResponse.json(counterparty);
  } catch (error) {
    console.error("Error updating counterparty:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren der Gegenpartei" },
      { status: 500 }
    );
  }
}

// DELETE /api/cases/[id]/counterparties/[counterpartyId] - Gegenpartei löschen
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId, counterpartyId } = await params;

    // Prüfen ob Gegenpartei existiert und zum Case gehört
    const existing = await prisma.counterparty.findFirst({
      where: { id: counterpartyId, caseId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Gegenpartei nicht gefunden" },
        { status: 404 }
      );
    }

    await prisma.counterparty.delete({
      where: { id: counterpartyId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting counterparty:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen der Gegenpartei" },
      { status: 500 }
    );
  }
}
