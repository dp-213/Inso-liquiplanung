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

// DELETE /api/cases/[id] - Delete case (soft delete by default, hard delete with ?hardDelete=true)
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
    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get("hardDelete") === "true";
    const confirmDelete = searchParams.get("confirm");

    if (hardDelete) {
      // Require confirmation for hard delete
      if (confirmDelete !== "PERMANENTLY_DELETE") {
        return NextResponse.json(
          { error: "Bestätigung erforderlich: confirm=PERMANENTLY_DELETE" },
          { status: 400 }
        );
      }

      // Hard delete - remove all related data
      await prisma.$transaction(async (tx) => {
        // Get all plans for this case
        const plans = await tx.liquidityPlan.findMany({
          where: { caseId: id },
          select: { id: true },
        });
        const planIds = plans.map((p) => p.id);

        // Get all categories for these plans
        const categories = await tx.cashflowCategory.findMany({
          where: { planId: { in: planIds } },
          select: { id: true },
        });
        const categoryIds = categories.map((c) => c.id);

        // Get all lines for these categories
        const lines = await tx.cashflowLine.findMany({
          where: { categoryId: { in: categoryIds } },
          select: { id: true },
        });
        const lineIds = lines.map((l) => l.id);

        // Delete in order (deepest first)
        await tx.periodValue.deleteMany({
          where: { lineId: { in: lineIds } },
        });
        await tx.cashflowLine.deleteMany({
          where: { categoryId: { in: categoryIds } },
        });
        await tx.cashflowCategory.deleteMany({
          where: { planId: { in: planIds } },
        });
        await tx.liquidityPlanVersion.deleteMany({
          where: { planId: { in: planIds } },
        });
        await tx.liquidityPlan.deleteMany({
          where: { caseId: id },
        });

        // Delete other related entities
        await tx.customerCaseAccess.deleteMany({
          where: { caseId: id },
        });
        await tx.shareLink.deleteMany({
          where: { caseId: id },
        });
        await tx.caseConfiguration.deleteMany({
          where: { caseId: id },
        });
        await tx.ingestionJob.deleteMany({
          where: { caseId: id },
        });
        await tx.aiPreprocessingJob.deleteMany({
          where: { caseId: id },
        });

        // Finally delete the case
        await tx.case.delete({
          where: { id },
        });
      });

      return NextResponse.json({ success: true, deleted: true });
    }

    // Soft delete: archive the case
    await prisma.case.update({
      where: { id },
      data: {
        status: "CLOSED",
        updatedBy: session.username,
      },
    });

    return NextResponse.json({ success: true, archived: true });
  } catch (error) {
    console.error("Error deleting case:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des Falls" },
      { status: 500 }
    );
  }
}
