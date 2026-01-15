import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { STANDARD_CATEGORIES, getCurrentMonday } from "@/lib/calculation-engine";

// GET /api/cases - List all cases
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    const cases = await prisma.case.findMany({
      where: projectId ? { projectId } : undefined,
      include: {
        project: {
          select: { name: true },
        },
        plans: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            versions: {
              orderBy: { versionNumber: "desc" },
              take: 1,
              select: {
                versionNumber: true,
                snapshotDate: true,
              },
            },
          },
        },
        _count: {
          select: {
            ingestionJobs: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(cases);
  } catch (error) {
    console.error("Error fetching cases:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Faelle" },
      { status: 500 }
    );
  }
}

// POST /api/cases - Create a new case
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, caseNumber, debtorName, courtName, filingDate, openingDate, status } = body;

    if (!projectId || !caseNumber || !debtorName || !courtName || !filingDate) {
      return NextResponse.json(
        { error: "Alle Pflichtfelder muessen ausgefuellt werden" },
        { status: 400 }
      );
    }

    // Check if case number already exists
    const existingCase = await prisma.case.findUnique({
      where: { caseNumber },
    });

    if (existingCase) {
      return NextResponse.json(
        { error: "Aktenzeichen existiert bereits" },
        { status: 400 }
      );
    }

    // Create case with default plan and categories in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the case
      const newCase = await tx.case.create({
        data: {
          projectId,
          caseNumber: caseNumber.trim(),
          debtorName: debtorName.trim(),
          courtName: courtName.trim(),
          filingDate: new Date(filingDate),
          openingDate: openingDate ? new Date(openingDate) : null,
          status: status || "PRELIMINARY",
          createdBy: session.username,
          updatedBy: session.username,
        },
      });

      // Create default liquidity plan
      const planStartDate = getCurrentMonday();
      const plan = await tx.liquidityPlan.create({
        data: {
          caseId: newCase.id,
          name: "Hauptplan",
          description: "Automatisch erstellter Liquiditaetsplan",
          planStartDate,
          isActive: true,
          createdBy: session.username,
          updatedBy: session.username,
        },
      });

      // Create standard categories
      for (const cat of STANDARD_CATEGORIES) {
        await tx.cashflowCategory.create({
          data: {
            id: uuidv4(),
            planId: plan.id,
            name: cat.name,
            flowType: cat.flowType,
            estateType: cat.estateType,
            displayOrder: cat.displayOrder,
            isSystem: true,
            createdBy: session.username,
          },
        });
      }

      return newCase;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating case:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Falls" },
      { status: 500 }
    );
  }
}
