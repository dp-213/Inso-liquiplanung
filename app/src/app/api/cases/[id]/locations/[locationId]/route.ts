import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string; locationId: string }>;
}

// GET /api/cases/[id]/locations/[locationId] - Einzelnen Standort abrufen
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId, locationId } = await params;

    const location = await prisma.location.findFirst({
      where: { id: locationId, caseId },
    });

    if (!location) {
      return NextResponse.json(
        { error: "Standort nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json(location);
  } catch (error) {
    console.error("Error fetching location:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Standorts" },
      { status: 500 }
    );
  }
}

// PUT /api/cases/[id]/locations/[locationId] - Standort aktualisieren
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId, locationId } = await params;
    const body = await request.json();
    const { name, shortName, address, costCenter, notes } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name ist erforderlich" },
        { status: 400 }
      );
    }

    // Prüfen ob Standort existiert und zum Case gehört
    const existing = await prisma.location.findFirst({
      where: { id: locationId, caseId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Standort nicht gefunden" },
        { status: 404 }
      );
    }

    const location = await prisma.location.update({
      where: { id: locationId },
      data: {
        name: name.trim(),
        shortName: shortName?.trim() || null,
        address: address?.trim() || null,
        costCenter: costCenter?.trim() || null,
        notes: notes?.trim() || null,
      },
    });

    return NextResponse.json(location);
  } catch (error) {
    console.error("Error updating location:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Standorts" },
      { status: 500 }
    );
  }
}

// DELETE /api/cases/[id]/locations/[locationId] - Standort löschen
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId, locationId } = await params;

    // Prüfen ob Standort existiert und zum Case gehört
    const existing = await prisma.location.findFirst({
      where: { id: locationId, caseId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Standort nicht gefunden" },
        { status: 404 }
      );
    }

    await prisma.location.delete({
      where: { id: locationId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting location:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des Standorts" },
      { status: 500 }
    );
  }
}
