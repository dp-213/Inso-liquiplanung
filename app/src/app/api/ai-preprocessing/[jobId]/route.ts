import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/ai-preprocessing/[jobId] - Get job details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;

    const job = await prisma.aiPreprocessingJob.findUnique({
      where: { id: jobId },
      include: {
        case: {
          select: {
            id: true,
            caseNumber: true,
            debtorName: true,
          },
        },
        files: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            fileSizeBytes: true,
            status: true,
            errorMessage: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            rows: true,
            logs: true,
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

    // Get row statistics
    const rowStats = await prisma.aiPreprocessingRow.groupBy({
      by: ["status"],
      where: { jobId },
      _count: { status: true },
    });

    const stats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      modified: 0,
      unclear: 0,
      total: 0,
    };

    for (const stat of rowStats) {
      stats.total += stat._count.status;
      switch (stat.status) {
        case "PENDING":
          stats.pending = stat._count.status;
          break;
        case "APPROVED":
          stats.approved = stat._count.status;
          break;
        case "REJECTED":
          stats.rejected = stat._count.status;
          break;
        case "MODIFIED":
          stats.modified = stat._count.status;
          break;
        case "UNCLEAR":
          stats.unclear = stat._count.status;
          break;
      }
    }

    // Get recent logs
    const logs = await prisma.aiPreprocessingLog.findMany({
      where: { jobId },
      orderBy: { timestamp: "desc" },
      take: 20,
    });

    return NextResponse.json({
      ...job,
      files: job.files.map((f) => ({
        ...f,
        fileSizeBytes: f.fileSizeBytes.toString(),
      })),
      rowStats: stats,
      logs,
    });
  } catch (error) {
    console.error("Error fetching AI preprocessing job:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Aufbereitungsvorgangs" },
      { status: 500 }
    );
  }
}

// DELETE /api/ai-preprocessing/[jobId] - Delete a job
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;

    const job = await prisma.aiPreprocessingJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Aufbereitungsvorgang nicht gefunden" },
        { status: 404 }
      );
    }

    // Only allow deletion of non-committed jobs
    if (job.status === "COMMITTED") {
      return NextResponse.json(
        { error: "Uebernommene Vorgaenge koennen nicht geloescht werden" },
        { status: 400 }
      );
    }

    await prisma.aiPreprocessingJob.delete({
      where: { id: jobId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting AI preprocessing job:", error);
    return NextResponse.json(
      { error: "Fehler beim Loeschen des Aufbereitungsvorgangs" },
      { status: 500 }
    );
  }
}
