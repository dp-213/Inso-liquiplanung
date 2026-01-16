import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { AiCashflowSuggestion } from "@/lib/ai-preprocessing/types";

// POST /api/ai-preprocessing/[jobId]/commit - Convert approved data to canonical format
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

    // Get job with case and plan info
    const job = await prisma.aiPreprocessingJob.findUnique({
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
        { error: "Aufbereitungsvorgang nicht gefunden" },
        { status: 404 }
      );
    }

    if (job.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Vorgang ist nicht freigegeben" },
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

    // Get approved rows
    const approvedRows = await prisma.aiPreprocessingRow.findMany({
      where: {
        jobId,
        status: { in: ["APPROVED", "MODIFIED"] },
      },
      include: {
        file: true,
      },
    });

    if (approvedRows.length === 0) {
      return NextResponse.json(
        { error: "Keine genehmigten Zeilen vorhanden" },
        { status: 400 }
      );
    }

    // Create an ingestion job to track this import
    const ingestionJob = await prisma.ingestionJob.create({
      data: {
        caseId: job.caseId,
        planId: plan.id,
        sourceType: "AI_PREPROCESSED",
        fileName: `KI-Aufbereitung ${new Date().toISOString()}`,
        fileHashSha256: `ai-preprocess-${jobId}`,
        fileSizeBytes: BigInt(0),
        status: "READY",
        recordCountRaw: approvedRows.length,
        recordCountValid: approvedRows.length,
        createdBy: session.username,
      },
    });

    // Convert rows to staged entries
    const stagedEntries = [];
    for (const row of approvedRows) {
      // Get the final values (human edits override AI suggestion)
      const aiSuggestion: AiCashflowSuggestion = JSON.parse(row.aiSuggestion);
      const humanEdits: Partial<AiCashflowSuggestion> | null = row.humanEdits
        ? JSON.parse(row.humanEdits)
        : null;

      const finalValues = {
        ...aiSuggestion,
        ...(humanEdits || {}),
      };

      // Skip rows without essential data
      if (finalValues.amount === undefined || finalValues.lineName === undefined) {
        continue;
      }

      // Convert amount to cents
      const amountCents = BigInt(Math.round((finalValues.amount || 0) * 100));

      // Determine flow type
      const flowType = finalValues.isInflow === false ? "OUTFLOW" : "INFLOW";

      // Create staged entry
      const stagedEntry = await prisma.stagedCashflowEntry.create({
        data: {
          jobId: ingestionJob.id,
          sourceRecordId: row.id, // Reference to AI row
          targetCategoryName: finalValues.category || "Sonstiges",
          targetCategoryFlowType: flowType,
          targetCategoryEstateType: finalValues.estateType || "NEUMASSE",
          lineName: finalValues.lineName,
          lineDescription: finalValues.description || null,
          periodIndex: finalValues.weekOffset ?? 0,
          valueType: finalValues.valueType || "IST",
          amountCents: flowType === "OUTFLOW" ? -amountCents : amountCents,
          originalAmountRaw: finalValues.amountRaw || String(finalValues.amount),
          note: `Aus KI-Aufbereitung: ${row.file.fileName} (${row.sourceLocation})`,
          confidenceScore: row.confidenceScore,
          requiresReview: false,
          status: "REVIEWED",
          reviewedBy: session.username,
          reviewedAt: new Date(),
          reviewAction: "APPROVE",
        },
      });

      stagedEntries.push(stagedEntry);
    }

    // Update ingestion job
    await prisma.ingestionJob.update({
      where: { id: ingestionJob.id },
      data: {
        recordCountNormalized: stagedEntries.length,
        qualityScore: 100,
      },
    });

    // Log the commit
    await prisma.aiPreprocessingLog.create({
      data: {
        jobId,
        action: "COMMIT",
        details: JSON.stringify({
          ingestionJobId: ingestionJob.id,
          stagedEntries: stagedEntries.length,
          committedBy: session.username,
        }),
        userId: session.username,
      },
    });

    // Update AI preprocessing job status
    await prisma.aiPreprocessingJob.update({
      where: { id: jobId },
      data: {
        status: "COMMITTED",
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      ingestionJobId: ingestionJob.id,
      stagedEntries: stagedEntries.length,
      message: `${stagedEntries.length} Eintraege wurden in die Staging-Tabelle uebertragen. Gehen Sie zum Daten-Import, um die Daten endgueltig zu uebernehmen.`,
    });
  } catch (error) {
    console.error("Error committing AI preprocessing job:", error);
    return NextResponse.json(
      { error: "Fehler beim Uebertragen der Daten" },
      { status: 500 }
    );
  }
}
