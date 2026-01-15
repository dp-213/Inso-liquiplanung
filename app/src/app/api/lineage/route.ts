import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/lineage - Get lineage for a value
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const valueId = searchParams.get("valueId");
    const lineId = searchParams.get("lineId");
    const weekOffset = searchParams.get("weekOffset");
    const valueType = searchParams.get("valueType");

    if (!valueId && !lineId) {
      return NextResponse.json(
        { error: "valueId oder lineId erforderlich" },
        { status: 400 }
      );
    }

    // Find the weekly value
    let weeklyValue;
    if (valueId) {
      weeklyValue = await prisma.weeklyValue.findUnique({
        where: { id: valueId },
        include: {
          line: {
            include: {
              category: true,
            },
          },
        },
      });
    } else if (lineId && weekOffset !== null && valueType) {
      weeklyValue = await prisma.weeklyValue.findUnique({
        where: {
          lineId_weekOffset_valueType: {
            lineId,
            weekOffset: parseInt(weekOffset),
            valueType,
          },
        },
        include: {
          line: {
            include: {
              category: true,
            },
          },
        },
      });
    }

    if (!weeklyValue) {
      return NextResponse.json(
        { error: "Wert nicht gefunden" },
        { status: 404 }
      );
    }

    // Build lineage entries
    const lineage: Array<{
      stage: string;
      timestamp: string;
      data: Record<string, unknown>;
      actor?: string;
      action?: string;
    }> = [];

    // Try to find related ingestion data through staged entries
    // This is a simplified version - in production, you'd have proper commit_action tracking
    const stagedEntries = await prisma.stagedCashflowEntry.findMany({
      where: {
        lineName: weeklyValue.line.name,
        weekOffset: weeklyValue.weekOffset,
        valueType: weeklyValue.valueType,
        status: "COMMITTED",
      },
      include: {
        sourceRecord: {
          include: {
            job: true,
            transformations: true,
          },
        },
      },
      orderBy: {
        reviewedAt: "desc",
      },
      take: 1,
    });

    if (stagedEntries.length > 0) {
      const stagedEntry = stagedEntries[0];
      const record = stagedEntry.sourceRecord;
      const job = record.job;

      // 1. Raw File
      lineage.push({
        stage: "RAW_FILE",
        timestamp: job.startedAt.toISOString(),
        data: {
          fileName: job.fileName,
          fileHash: job.fileHashSha256,
          fileSizeBytes: job.fileSizeBytes.toString(),
          sourceType: job.sourceType,
        },
        actor: job.createdBy,
        action: "Hochgeladen",
      });

      // 2. Parsed Record
      lineage.push({
        stage: "PARSED_RECORD",
        timestamp: job.startedAt.toISOString(),
        data: JSON.parse(record.rawData),
        action: `Zeile ${record.rowNumber}`,
      });

      // 3. Transformations
      for (const transformation of record.transformations) {
        lineage.push({
          stage: "TRANSFORMATION",
          timestamp: transformation.timestamp.toISOString(),
          data: {
            sourceField: transformation.sourceField,
            sourceValue: transformation.sourceValue,
            targetField: transformation.targetField,
            targetValue: transformation.targetValue,
            transformationType: transformation.transformationType,
          },
        });
      }

      // 4. Staged Entry
      lineage.push({
        stage: "STAGED_ENTRY",
        timestamp: job.startedAt.toISOString(),
        data: {
          categoryName: stagedEntry.targetCategoryName,
          flowType: stagedEntry.targetCategoryFlowType,
          estateType: stagedEntry.targetCategoryEstateType,
          lineName: stagedEntry.lineName,
          weekOffset: stagedEntry.weekOffset,
          amountCents: stagedEntry.amountCents.toString(),
          confidenceScore: stagedEntry.confidenceScore,
        },
      });

      // 5. Review (if reviewed)
      if (stagedEntry.reviewedAt) {
        lineage.push({
          stage: "REVIEW",
          timestamp: stagedEntry.reviewedAt.toISOString(),
          data: {
            action: stagedEntry.reviewAction,
            note: stagedEntry.reviewNote,
            requiresReview: stagedEntry.requiresReview,
            reviewReason: stagedEntry.reviewReason,
          },
          actor: stagedEntry.reviewedBy || undefined,
          action: stagedEntry.reviewAction || undefined,
        });
      }

      // 6. Committed
      if (job.completedAt) {
        lineage.push({
          stage: "COMMITTED",
          timestamp: job.completedAt.toISOString(),
          data: {
            actionType: "CREATE",
            targetId: weeklyValue.id,
            targetType: "WeeklyValue",
          },
          actor: job.createdBy,
          action: "Uebernommen",
        });
      }
    } else {
      // If no ingestion lineage, show manual creation
      lineage.push({
        stage: "COMMITTED",
        timestamp: weeklyValue.createdAt.toISOString(),
        data: {
          actionType: "MANUAL",
          targetId: weeklyValue.id,
          targetType: "WeeklyValue",
        },
        actor: weeklyValue.createdBy,
        action: "Manuell erstellt",
      });
    }

    // Check for updates
    if (weeklyValue.updatedAt > weeklyValue.createdAt) {
      lineage.push({
        stage: "COMMITTED",
        timestamp: weeklyValue.updatedAt.toISOString(),
        data: {
          actionType: "UPDATE",
          targetId: weeklyValue.id,
          targetType: "WeeklyValue",
        },
        actor: weeklyValue.updatedBy,
        action: "Aktualisiert",
      });
    }

    return NextResponse.json({
      valueId: weeklyValue.id,
      lineId: weeklyValue.lineId,
      lineName: weeklyValue.line.name,
      categoryName: weeklyValue.line.category.name,
      weekOffset: weeklyValue.weekOffset,
      valueType: weeklyValue.valueType,
      amountCents: weeklyValue.amountCents.toString(),
      lineage,
    });
  } catch (error) {
    console.error("Error fetching lineage:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Herkunftsdaten" },
      { status: 500 }
    );
  }
}
