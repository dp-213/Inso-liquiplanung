import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * GET /api/cases/[id]/iv-notes
 * Lade alle IV-Notizen für einen Fall
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

    // Prüfe ob Case existiert
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true },
    });

    if (!caseData) {
      return NextResponse.json({ error: "Fall nicht gefunden" }, { status: 404 });
    }

    // Lade Notizen aus Datenbank
    const notes = await prisma.iVNote.findMany({
      where: { caseId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      notes: notes.map(n => ({
        id: n.id,
        content: n.content,
        status: n.status,
        priority: n.priority,
        author: n.author,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
      }))
    });
  } catch (error: any) {
    console.error("Error loading IV notes:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Notizen" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cases/[id]/iv-notes
 * Erstelle neue IV-Notiz
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

    const { content, priority, status } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Inhalt erforderlich" }, { status: 400 });
    }

    // Erstelle neue Notiz in DB
    const newNote = await prisma.iVNote.create({
      data: {
        caseId,
        content: content.trim(),
        priority: priority || "MITTEL",
        status: status || "OFFEN",
        author: "Sonja Prinz", // Hardcoded - Sonja ist Interface zu IV
      },
    });

    return NextResponse.json({
      note: {
        id: newNote.id,
        content: newNote.content,
        status: newNote.status,
        priority: newNote.priority,
        author: newNote.author,
        createdAt: newNote.createdAt.toISOString(),
        updatedAt: newNote.updatedAt.toISOString(),
      }
    });
  } catch (error: any) {
    console.error("Error creating IV note:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Notiz" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/cases/[id]/iv-notes
 * Update Status einer Notiz
 */
export async function PATCH(
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
    const { noteId, status } = body;

    if (!noteId || !status) {
      return NextResponse.json({ error: "noteId und status erforderlich" }, { status: 400 });
    }

    // Update Notiz
    const updatedNote = await prisma.iVNote.update({
      where: {
        id: noteId,
        caseId, // Sicherheit: Nur Notizen für diesen Case
      },
      data: {
        status,
      },
    });

    return NextResponse.json({
      note: {
        id: updatedNote.id,
        content: updatedNote.content,
        status: updatedNote.status,
        priority: updatedNote.priority,
        author: updatedNote.author,
        createdAt: updatedNote.createdAt.toISOString(),
        updatedAt: updatedNote.updatedAt.toISOString(),
      }
    });
  } catch (error: any) {
    console.error("Error updating IV note:", error);
    return NextResponse.json(
      { error: "Fehler beim Update der Notiz" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cases/[id]/iv-notes?noteId=xxx
 * Lösche eine Notiz
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId } = await params;
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("noteId");

    if (!noteId) {
      return NextResponse.json({ error: "noteId erforderlich" }, { status: 400 });
    }

    // Lösche Notiz (mit Sicherheits-Check auf caseId)
    await prisma.iVNote.delete({
      where: {
        id: noteId,
        caseId, // Sicherheit: Nur Notizen für diesen Case
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting IV note:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen der Notiz" },
      { status: 500 }
    );
  }
}
