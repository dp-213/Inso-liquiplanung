import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/cases/[id]/contacts - Alle Ansprechpartner eines Falls abrufen
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
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({
      caseId,
      contacts,
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Kontakte" },
      { status: 500 }
    );
  }
}

// POST /api/cases/[id]/contacts - Neuen Kontakt erstellen
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

    if (!name?.trim() || !role?.trim()) {
      return NextResponse.json(
        { error: "Name und Rolle sind erforderlich" },
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

    const contact = await prisma.caseContact.create({
      data: {
        caseId,
        role: role.trim(),
        name: name.trim(),
        organization: organization?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        notes: notes?.trim() || null,
        displayOrder: displayOrder ?? 0,
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("Error creating contact:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Kontakts" },
      { status: 500 }
    );
  }
}
