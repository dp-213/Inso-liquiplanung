import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

interface IVNote {
  id: string;
  content: string;
  status: "OFFEN" | "WARTET" | "ERLEDIGT";
  priority: "NIEDRIG" | "MITTEL" | "HOCH" | "KRITISCH";
  createdAt: string;
  updatedAt: string;
  author: string;
}

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

    // Lade Case um zu prüfen ob es existiert
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true },
    });

    if (!caseData) {
      return NextResponse.json({ error: "Fall nicht gefunden" }, { status: 404 });
    }

    // Lade Notizen aus separater Tabelle (oder aus File-Storage)
    // WORKAROUND: Nutze File-System da kein Schema vorhanden
    const fs = await import("fs/promises");
    const path = await import("path");
    const notesDir = path.join(process.cwd(), ".data", "iv-notes");
    const notesFile = path.join(notesDir, `${caseId}.json`);

    let notes: IVNote[] = [];

    try {
      await fs.mkdir(notesDir, { recursive: true });
      const content = await fs.readFile(notesFile, "utf-8");
      notes = JSON.parse(content);
    } catch (err) {
      // Datei existiert noch nicht - leeres Array
      notes = [];
    }

    // Sortiere nach Erstellungsdatum (neueste zuerst)
    notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ notes });
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

    // Erstelle neue Notiz
    const newNote: IVNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: content.trim(),
      priority: priority || "MITTEL",
      status: status || "OFFEN",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: "Sonja Prinz", // Hardcoded da Sonja einziges Interface zu IV
    };

    // Speichere in File
    const fs = await import("fs/promises");
    const path = await import("path");
    const notesDir = path.join(process.cwd(), ".data", "iv-notes");
    const notesFile = path.join(notesDir, `${caseId}.json`);

    await fs.mkdir(notesDir, { recursive: true });

    let notes: IVNote[] = [];
    try {
      const content = await fs.readFile(notesFile, "utf-8");
      notes = JSON.parse(content);
    } catch {
      notes = [];
    }

    notes.push(newNote);
    await fs.writeFile(notesFile, JSON.stringify(notes, null, 2), "utf-8");

    return NextResponse.json({ note: newNote });
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

    // Lade Notizen
    const fs = await import("fs/promises");
    const path = await import("path");
    const notesDir = path.join(process.cwd(), ".data", "iv-notes");
    const notesFile = path.join(notesDir, `${caseId}.json`);

    let notes: IVNote[] = [];
    try {
      const content = await fs.readFile(notesFile, "utf-8");
      notes = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "Notizen nicht gefunden" }, { status: 404 });
    }

    // Finde und update Notiz
    const noteIndex = notes.findIndex(n => n.id === noteId);
    if (noteIndex === -1) {
      return NextResponse.json({ error: "Notiz nicht gefunden" }, { status: 404 });
    }

    notes[noteIndex].status = status;
    notes[noteIndex].updatedAt = new Date().toISOString();

    await fs.writeFile(notesFile, JSON.stringify(notes, null, 2), "utf-8");

    return NextResponse.json({ note: notes[noteIndex] });
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

    // Lade Notizen
    const fs = await import("fs/promises");
    const path = await import("path");
    const notesDir = path.join(process.cwd(), ".data", "iv-notes");
    const notesFile = path.join(notesDir, `${caseId}.json`);

    let notes: IVNote[] = [];
    try {
      const content = await fs.readFile(notesFile, "utf-8");
      notes = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "Notizen nicht gefunden" }, { status: 404 });
    }

    // Entferne Notiz
    const filteredNotes = notes.filter(n => n.id !== noteId);

    if (filteredNotes.length === notes.length) {
      return NextResponse.json({ error: "Notiz nicht gefunden" }, { status: 404 });
    }

    await fs.writeFile(notesFile, JSON.stringify(filteredNotes, null, 2), "utf-8");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting IV note:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen der Notiz" },
      { status: 500 }
    );
  }
}
