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
    const ownerId = searchParams.get("ownerId");

    const cases = await prisma.case.findMany({
      where: ownerId ? { ownerId } : undefined,
      include: {
        owner: {
          select: { id: true, name: true, email: true, company: true },
        },
        plans: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            periodType: true,
            periodCount: true,
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
        shareLinks: {
          where: { isActive: true },
          select: { id: true },
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
      { error: "Fehler beim Laden der Fälle" },
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
    const { ownerId, caseNumber, debtorName, courtName, filingDate, openingDate, status, customerIds } = body;

    if (!ownerId || !caseNumber || !debtorName || !courtName || !filingDate) {
      return NextResponse.json(
        { error: "Alle Pflichtfelder müssen ausgefuellt werden" },
        { status: 400 }
      );
    }

    // Verify owner exists
    const owner = await prisma.customerUser.findUnique({
      where: { id: ownerId },
    });

    if (!owner) {
      return NextResponse.json(
        { error: "Kunde nicht gefunden" },
        { status: 404 }
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
      const createdCase = await tx.case.create({
        data: {
          ownerId,
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

      if (!createdCase) {
        throw new Error("Fall wurde erstellt, konnte aber nicht gefunden werden");
      }

      // Create default liquidity plan
      const planStartDate = getCurrentMonday();
      const plan = await tx.liquidityPlan.create({
        data: {
          caseId: createdCase.id,
          name: "Hauptplan",
          description: "Automatisch erstellter Liquiditätsplan",
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

      // Create customer access for additional customers (beyond owner)
      if (customerIds && Array.isArray(customerIds) && customerIds.length > 0) {
        for (const customerId of customerIds) {
          // Don't create duplicate access for the owner
          if (customerId !== ownerId) {
            await tx.customerCaseAccess.create({
              data: {
                customerId,
                caseId: createdCase.id,
                accessLevel: "VIEW",
                grantedBy: session.username,
              },
            });
          }
        }
      }

      return createdCase;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating case:", error);

    // Mehr Details für Debugging
    const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler";
    const errorDetails = error instanceof Error && error.stack ? error.stack.split("\n").slice(0, 3).join(" | ") : "";

    return NextResponse.json(
      {
        error: `Fehler beim Erstellen des Falls: ${errorMessage}`,
        details: errorDetails
      },
      { status: 500 }
    );
  }
}
