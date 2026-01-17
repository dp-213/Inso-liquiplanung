import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

// POST /api/ingestion/[jobId]/commit - Commit staged data to core schema
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;

    // Get job with staged entries
    const job = await prisma.ingestionJob.findUnique({
      where: { id: jobId },
      include: {
        case: {
          include: {
            plans: {
              where: { isActive: true },
              include: {
                categories: {
                  include: {
                    lines: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Importvorgang nicht gefunden" },
        { status: 404 }
      );
    }

    if (job.status !== "READY") {
      return NextResponse.json(
        { error: "Import ist nicht bereit zum Übernehmen" },
        { status: 400 }
      );
    }

    const plan = job.case.plans[0];
    if (!plan) {
      return NextResponse.json(
        { error: "Kein aktiver Plan gefunden" },
        { status: 400 }
      );
    }

    // Get staged entries that are ready to commit
    const stagedEntries = await prisma.stagedCashflowEntry.findMany({
      where: {
        jobId,
        status: { in: ["STAGED", "REVIEWED"] },
      },
    });

    if (stagedEntries.length === 0) {
      return NextResponse.json(
        { error: "Keine Einträge zum Übernehmen" },
        { status: 400 }
      );
    }

    // Commit in a transaction
    const result = await prisma.$transaction(async (tx) => {
      let createdLines = 0;
      let createdValues = 0;
      let updatedValues = 0;

      for (const entry of stagedEntries) {
        // Find or create category
        let category = plan.categories.find(
          (c) =>
            c.name === entry.targetCategoryName &&
            c.flowType === entry.targetCategoryFlowType &&
            c.estateType === entry.targetCategoryEstateType
        );

        if (!category) {
          // Create new category
          const maxOrder = Math.max(...plan.categories.map((c) => c.displayOrder), 0);
          const newCategory = await tx.cashflowCategory.create({
            data: {
              planId: plan.id,
              name: entry.targetCategoryName,
              flowType: entry.targetCategoryFlowType,
              estateType: entry.targetCategoryEstateType,
              displayOrder: maxOrder + 1,
              isSystem: false,
              createdBy: session.username,
            },
          });
          const categoryWithLines = { ...newCategory, lines: [] as typeof plan.categories[0]["lines"] };
          plan.categories.push(categoryWithLines);
          category = categoryWithLines;
        }

        // Find or create line
        const categoryWithLines = plan.categories.find((c) => c.id === category!.id)!;
        let line = categoryWithLines.lines.find(
          (l) => l.name.toLowerCase() === entry.lineName.toLowerCase()
        );

        if (!line) {
          // Create new line
          const maxOrder = Math.max(...categoryWithLines.lines.map((l) => l.displayOrder), 0);
          line = await tx.cashflowLine.create({
            data: {
              categoryId: category.id,
              name: entry.lineName,
              displayOrder: maxOrder + 1,
              createdBy: session.username,
              updatedBy: session.username,
            },
          });
          categoryWithLines.lines.push(line);
          createdLines++;
        }

        // Create or update period value
        const existingValue = await tx.periodValue.findUnique({
          where: {
            lineId_periodIndex_valueType: {
              lineId: line.id,
              periodIndex: entry.periodIndex,
              valueType: entry.valueType,
            },
          },
        });

        if (existingValue) {
          // Update existing value
          await tx.periodValue.update({
            where: { id: existingValue.id },
            data: {
              amountCents: entry.amountCents,
              note: entry.note,
              updatedBy: session.username,
            },
          });
          updatedValues++;
        } else {
          // Create new value
          await tx.periodValue.create({
            data: {
              lineId: line.id,
              periodIndex: entry.periodIndex,
              valueType: entry.valueType,
              amountCents: entry.amountCents,
              note: entry.note,
              createdBy: session.username,
              updatedBy: session.username,
            },
          });
          createdValues++;
        }

        // Update staged entry status
        await tx.stagedCashflowEntry.update({
          where: { id: entry.id },
          data: { status: "COMMITTED" },
        });
      }

      return {
        createdLines,
        createdValues,
        updatedValues,
      };
    });

    // Update job status
    await prisma.ingestionJob.update({
      where: { id: jobId },
      data: {
        status: "COMMITTED",
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      ...result,
      totalEntries: stagedEntries.length,
    });
  } catch (error) {
    console.error("Error committing data:", error);
    return NextResponse.json(
      { error: "Fehler beim Übernehmen der Daten" },
      { status: 500 }
    );
  }
}
