import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/ingestion/[jobId] - Get job details with records
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

    const job = await prisma.ingestionJob.findUnique({
      where: { id: jobId },
      include: {
        case: {
          select: {
            caseNumber: true,
            debtorName: true,
          },
        },
        records: {
          orderBy: { rowNumber: "asc" },
          include: {
            stagedEntries: true,
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

    // Calculate review stats
    const reviewableCount = job.records.filter(
      (r) => r.stagedEntries.some((e) => e.requiresReview && e.status === "STAGED")
    ).length;

    const serializedJob = {
      ...job,
      fileSizeBytes: job.fileSizeBytes.toString(),
      reviewableCount,
      records: job.records.map((r) => ({
        ...r,
        rawData: JSON.parse(r.rawData),
        mappedData: r.mappedData ? JSON.parse(r.mappedData) : null,
        normalizedData: r.normalizedData ? JSON.parse(r.normalizedData) : null,
        validationErrors: r.validationErrors ? JSON.parse(r.validationErrors) : null,
        validationWarnings: r.validationWarnings ? JSON.parse(r.validationWarnings) : null,
        stagedEntries: r.stagedEntries.map((e) => ({
          ...e,
          amountCents: e.amountCents.toString(),
        })),
      })),
    };

    return NextResponse.json(serializedJob);
  } catch (error) {
    console.error("Error fetching job:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Importvorgangs" },
      { status: 500 }
    );
  }
}

// DELETE /api/ingestion/[jobId] - Cancel/delete job
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

    const job = await prisma.ingestionJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Importvorgang nicht gefunden" },
        { status: 404 }
      );
    }

    if (job.status === "COMMITTED") {
      return NextResponse.json(
        { error: "Ein abgeschlossener Import kann nicht geloescht werden" },
        { status: 400 }
      );
    }

    // Delete the job and all related records (cascade)
    await prisma.ingestionJob.delete({
      where: { id: jobId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting job:", error);
    return NextResponse.json(
      { error: "Fehler beim Loeschen des Importvorgangs" },
      { status: 500 }
    );
  }
}
