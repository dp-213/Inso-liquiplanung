import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/cases/[id]/contacts/[contactId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId, contactId } = await params;

    const contact = await prisma.caseContact.findUnique({
      where: { id: contactId },
    });

    if (!contact || contact.caseId !== caseId) {
      return NextResponse.json(
        { error: "Kontakt nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Error fetching contact:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Kontakts" },
      { status: 500 }
    );
  }
}

// PUT /api/cases/[id]/contacts/[contactId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId, contactId } = await params;
    const body = await request.json();

    const existing = await prisma.caseContact.findUnique({
      where: { id: contactId },
    });

    if (!existing || existing.caseId !== caseId) {
      return NextResponse.json(
        { error: "Kontakt nicht gefunden" },
        { status: 404 }
      );
    }

    const { role, name, organization, email, phone, notes, displayOrder } = body;

    const updated = await prisma.caseContact.update({
      where: { id: contactId },
      data: {
        role: role?.trim() || existing.role,
        name: name?.trim() || existing.name,
        organization: organization !== undefined ? (organization?.trim() || null) : undefined,
        email: email !== undefined ? (email?.trim() || null) : undefined,
        phone: phone !== undefined ? (phone?.trim() || null) : undefined,
        notes: notes !== undefined ? (notes?.trim() || null) : undefined,
        displayOrder: displayOrder !== undefined ? displayOrder : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating contact:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Kontakts" },
      { status: 500 }
    );
  }
}

// DELETE /api/cases/[id]/contacts/[contactId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId, contactId } = await params;

    const contact = await prisma.caseContact.findUnique({
      where: { id: contactId },
    });

    if (!contact || contact.caseId !== caseId) {
      return NextResponse.json(
        { error: "Kontakt nicht gefunden" },
        { status: 404 }
      );
    }

    await prisma.caseContact.delete({
      where: { id: contactId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting contact:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des Kontakts" },
      { status: 500 }
    );
  }
}
