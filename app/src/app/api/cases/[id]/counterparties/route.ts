import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/cases/[id]/counterparties - Alle Gegenparteien eines Falls abrufen
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
        counterparties: {
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
      counterparties: caseData.counterparties,
    });
  } catch (error) {
    console.error("Error fetching counterparties:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Gegenparteien" },
      { status: 500 }
    );
  }
}

// POST /api/cases/[id]/counterparties - Neue Gegenpartei erstellen
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
    const { name, shortName, type, matchPattern, isTopPayer } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name ist erforderlich" },
        { status: 400 }
      );
    }

    // Case prüfen
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseData) {
      return NextResponse.json(
        { error: "Fall nicht gefunden" },
        { status: 404 }
      );
    }

    const counterparty = await prisma.counterparty.create({
      data: {
        caseId,
        name: name.trim(),
        shortName: shortName?.trim() || null,
        type: type || null,
        matchPattern: matchPattern?.trim() || null,
        isTopPayer: isTopPayer || false,
        createdBy: session.username,
      },
    });

    return NextResponse.json(counterparty, { status: 201 });
  } catch (error) {
    console.error("Error creating counterparty:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Gegenpartei" },
      { status: 500 }
    );
  }
}
