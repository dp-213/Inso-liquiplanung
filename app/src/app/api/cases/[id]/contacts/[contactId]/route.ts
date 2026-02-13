import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * PUT /api/cases/[id]/contacts/[contactId]
 * Kontakt aktualisieren
 */
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

    const { role, name, organization, email, phone, notes, displayOrder } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name erforderlich" }, { status: 400 });
    }

    const contact = await prisma.caseContact.update({
      where: { id: contactId, caseId },
      data: {
        role,
        name: name.trim(),
        organization: organization || null,
        email: email || null,
        phone: phone || null,
        notes: notes || null,
        displayOrder: displayOrder ?? 0,
      },
    });

    return NextResponse.json({
      contact: {
        id: contact.id,
        role: contact.role,
        name: contact.name,
        organization: contact.organization,
        email: contact.email,
        phone: contact.phone,
        notes: contact.notes,
        displayOrder: contact.displayOrder,
      },
    });
  } catch (error) {
    console.error("Error updating contact:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Kontakts" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cases/[id]/contacts/[contactId]
 * Kontakt löschen
 */
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

    await prisma.caseContact.delete({
      where: { id: contactId, caseId },
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
