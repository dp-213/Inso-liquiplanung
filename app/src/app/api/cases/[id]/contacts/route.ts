import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * GET /api/cases/[id]/contacts
 * Lade alle Kontakte für einen Fall
 */
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

    const contacts = await prisma.caseContact.findMany({
      where: { caseId },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({
      contacts: contacts.map((c) => ({
        id: c.id,
        role: c.role,
        name: c.name,
        organization: c.organization,
        email: c.email,
        phone: c.phone,
        notes: c.notes,
        displayOrder: c.displayOrder,
      })),
    });
  } catch (error) {
    console.error("Error loading contacts:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Kontakte" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cases/[id]/contacts
 * Neuen Kontakt anlegen
 */
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

    const { role, name, organization, email, phone, notes, displayOrder } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name erforderlich" }, { status: 400 });
    }

    if (!role) {
      return NextResponse.json({ error: "Rolle erforderlich" }, { status: 400 });
    }

    const contact = await prisma.caseContact.create({
      data: {
        caseId,
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
    console.error("Error creating contact:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Kontakts" },
      { status: 500 }
    );
  }
}
