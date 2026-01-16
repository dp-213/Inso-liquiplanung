import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// PUT /api/cases/[id]/plan/values - Update a single period value
export async function PUT(
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
    const { lineId, periodIndex, valueType, amountCents } = body;

    // Validate required fields
    if (!lineId || periodIndex === undefined || !valueType || amountCents === undefined) {
      return NextResponse.json(
        { error: "Fehlende Felder: lineId, periodIndex, valueType, amountCents erforderlich" },
        { status: 400 }
      );
    }

    // Validate valueType
    if (!["IST", "PLAN"].includes(valueType)) {
      return NextResponse.json(
        { error: "valueType muss IST oder PLAN sein" },
        { status: 400 }
      );
    }

    // Verify line exists and belongs to this case
    const line = await prisma.cashflowLine.findUnique({
      where: { id: lineId },
      include: {
        category: {
          include: {
            plan: {
              include: {
                case: true,
              },
            },
          },
        },
      },
    });

    if (!line) {
      return NextResponse.json(
        { error: "Zeile nicht gefunden" },
        { status: 404 }
      );
    }

    if (line.category.plan.case.id !== caseId) {
      return NextResponse.json(
        { error: "Zeile gehoert nicht zu diesem Fall" },
        { status: 403 }
      );
    }

    // Check periodIndex is within plan bounds
    const periodCount = line.category.plan.periodCount;
    if (periodIndex < 0 || periodIndex >= periodCount) {
      return NextResponse.json(
        { error: `periodIndex muss zwischen 0 und ${periodCount - 1} liegen` },
        { status: 400 }
      );
    }

    // Upsert the period value
    const updatedValue = await prisma.periodValue.upsert({
      where: {
        lineId_periodIndex_valueType: {
          lineId,
          periodIndex,
          valueType,
        },
      },
      update: {
        amountCents: BigInt(amountCents),
        updatedBy: session.username,
        updatedAt: new Date(),
      },
      create: {
        lineId,
        periodIndex,
        valueType,
        amountCents: BigInt(amountCents),
        createdBy: session.username,
        updatedBy: session.username,
      },
    });

    return NextResponse.json({
      success: true,
      value: {
        id: updatedValue.id,
        lineId: updatedValue.lineId,
        periodIndex: updatedValue.periodIndex,
        valueType: updatedValue.valueType,
        amountCents: updatedValue.amountCents.toString(),
      },
    });
  } catch (error) {
    console.error("Error updating period value:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Werts" },
      { status: 500 }
    );
  }
}

// PATCH /api/cases/[id]/plan/values - Bulk update multiple values
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
    const { updates } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: "updates Array erforderlich" },
        { status: 400 }
      );
    }

    // Process all updates in a transaction
    const results = await prisma.$transaction(
      updates.map((update: { lineId: string; periodIndex: number; valueType: string; amountCents: number }) =>
        prisma.periodValue.upsert({
          where: {
            lineId_periodIndex_valueType: {
              lineId: update.lineId,
              periodIndex: update.periodIndex,
              valueType: update.valueType,
            },
          },
          update: {
            amountCents: BigInt(update.amountCents),
            updatedBy: session.username,
            updatedAt: new Date(),
          },
          create: {
            lineId: update.lineId,
            periodIndex: update.periodIndex,
            valueType: update.valueType,
            amountCents: BigInt(update.amountCents),
            createdBy: session.username,
            updatedBy: session.username,
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      updatedCount: results.length,
    });
  } catch (error) {
    console.error("Error bulk updating period values:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren der Werte" },
      { status: 500 }
    );
  }
}
