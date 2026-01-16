import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/cases/[id] - Get single case with full details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const caseData = await prisma.case.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true, company: true } },
        plans: {
          include: {
            versions: {
              orderBy: { versionNumber: "desc" },
            },
            categories: {
              include: {
                lines: {
                  include: {
                    periodValues: true,
                  },
                  orderBy: { displayOrder: "asc" },
                },
              },
              orderBy: { displayOrder: "asc" },
            },
          },
        },
        ingestionJobs: {
          orderBy: { startedAt: "desc" },
          take: 10,
        },
        shareLinks: {
          orderBy: { createdAt: "desc" },
        },
        configurations: true,
      },
    });

    if (!caseData) {
      return NextResponse.json(
        { error: "Fall nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json(caseData);
  } catch (error) {
    console.error("Error fetching case:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Falls" },
      { status: 500 }
    );
  }
}

// PUT /api/cases/[id] - Update case
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { caseNumber, debtorName, courtName, filingDate, openingDate, status } = body;

    // Check if case number is being changed and already exists
    if (caseNumber) {
      const existingCase = await prisma.case.findFirst({
        where: {
          caseNumber,
          NOT: { id },
        },
      });

      if (existingCase) {
        return NextResponse.json(
          { error: "Aktenzeichen existiert bereits" },
          { status: 400 }
        );
      }
    }

    const updatedCase = await prisma.case.update({
      where: { id },
      data: {
        ...(caseNumber && { caseNumber: caseNumber.trim() }),
        ...(debtorName && { debtorName: debtorName.trim() }),
        ...(courtName && { courtName: courtName.trim() }),
        ...(filingDate && { filingDate: new Date(filingDate) }),
        ...(openingDate !== undefined && {
          openingDate: openingDate ? new Date(openingDate) : null,
        }),
        ...(status && { status }),
        updatedBy: session.username,
      },
    });

    return NextResponse.json(updatedCase);
  } catch (error) {
    console.error("Error updating case:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Falls" },
      { status: 500 }
    );
  }
}

// DELETE /api/cases/[id] - Delete case (soft delete / archive)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Archive the case instead of deleting
    await prisma.case.update({
      where: { id },
      data: {
        status: "CLOSED",
        updatedBy: session.username,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error archiving case:", error);
    return NextResponse.json(
      { error: "Fehler beim Archivieren des Falls" },
      { status: 500 }
    );
  }
}
