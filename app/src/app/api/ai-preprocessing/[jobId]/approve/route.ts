import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// POST /api/ai-preprocessing/[jobId]/approve - Mark job as approved and ready for commit
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

    // Get job
    const job = await prisma.aiPreprocessingJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Aufbereitungsvorgang nicht gefunden" },
        { status: 404 }
      );
    }

    if (!["REVIEW", "CORRECTION"].includes(job.status)) {
      return NextResponse.json(
        { error: "Vorgang ist nicht im Prüfungs-Status" },
        { status: 400 }
      );
    }

    // Check that there are no pending rows
    const pendingCount = await prisma.aiPreprocessingRow.count({
      where: { jobId, status: "PENDING" },
    });

    if (pendingCount > 0) {
      return NextResponse.json(
        { error: `Es gibt noch ${pendingCount} offene Zeilen zur Prüfung` },
        { status: 400 }
      );
    }

    // Check that there are approved/modified rows
    const approvedCount = await prisma.aiPreprocessingRow.count({
      where: { jobId, status: { in: ["APPROVED", "MODIFIED"] } },
    });

    if (approvedCount === 0) {
      return NextResponse.json(
        { error: "Keine genehmigten Zeilen vorhanden" },
        { status: 400 }
      );
    }

    // Update job status to APPROVED
    await prisma.aiPreprocessingJob.update({
      where: { id: jobId },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedBy: session.username,
      },
    });

    // Log the approval
    await prisma.aiPreprocessingLog.create({
      data: {
        jobId,
        action: "APPROVE",
        details: JSON.stringify({
          approvedRows: approvedCount,
          approvedBy: session.username,
        }),
        userId: session.username,
      },
    });

    return NextResponse.json({
      success: true,
      approvedRows: approvedCount,
    });
  } catch (error) {
    console.error("Error approving AI preprocessing job:", error);
    return NextResponse.json(
      { error: "Fehler bei der Freigabe" },
      { status: 500 }
    );
  }
}
