import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { suggestCategoryTags } from '@/lib/classification/engine';

// =============================================================================
// POST /api/cases/[id]/ledger/suggest-category-tags
// Berechnet categoryTag-Vorschläge für Entries ohne Zuordnung
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId } = await params;

    // Verify case exists
    const caseEntity = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseEntity) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    // Optional: spezifische entryIds
    let entryIds: string[] | undefined;
    try {
      const body = await request.json();
      if (body.entryIds && Array.isArray(body.entryIds)) {
        entryIds = body.entryIds;
      }
    } catch {
      // Kein Body oder kein JSON -- alle Entries verarbeiten
    }

    const result = await suggestCategoryTags(prisma, caseId, entryIds);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error suggesting category tags:', error);
    return NextResponse.json(
      { error: 'Fehler beim Berechnen der Kategorie-Vorschläge' },
      { status: 500 }
    );
  }
}
