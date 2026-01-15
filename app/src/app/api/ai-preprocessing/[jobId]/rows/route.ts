import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/ai-preprocessing/[jobId]/rows - Get all rows for a job
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
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const fileId = searchParams.get("fileId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: Record<string, unknown> = { jobId };
    if (status) where.status = status;
    if (fileId) where.fileId = fileId;

    const [rows, total] = await Promise.all([
      prisma.aiPreprocessingRow.findMany({
        where,
        include: {
          file: {
            select: {
              fileName: true,
            },
          },
        },
        orderBy: [{ status: "asc" }, { confidenceScore: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.aiPreprocessingRow.count({ where }),
    ]);

    // Parse JSON fields
    const parsedRows = rows.map((row) => ({
      id: row.id,
      jobId: row.jobId,
      fileId: row.fileId,
      fileName: row.file.fileName,
      sourceLocation: row.sourceLocation,
      rawData: JSON.parse(row.rawData),
      aiSuggestion: JSON.parse(row.aiSuggestion),
      aiExplanation: row.aiExplanation,
      confidenceScore: row.confidenceScore,
      confidenceDetails: row.confidenceDetails
        ? JSON.parse(row.confidenceDetails)
        : [],
      status: row.status,
      humanEdits: row.humanEdits ? JSON.parse(row.humanEdits) : null,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt?.toISOString(),
      rejectionReason: row.rejectionReason,
    }));

    return NextResponse.json({
      rows: parsedRows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching AI preprocessing rows:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Zeilen" },
      { status: 500 }
    );
  }
}

// POST /api/ai-preprocessing/[jobId]/rows - Review multiple rows
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
    const body = await request.json();
    const { reviews } = body as {
      reviews: Array<{
        rowId: string;
        action: "APPROVE" | "REJECT" | "MODIFY" | "UNCLEAR";
        edits?: Record<string, unknown>;
        reason?: string;
      }>;
    };

    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      return NextResponse.json(
        { error: "Keine Bewertungen angegeben" },
        { status: 400 }
      );
    }

    // Verify job exists and is in review status
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
        { error: "Vorgang ist nicht im Pruefungs-Status" },
        { status: 400 }
      );
    }

    // Process each review
    const results = [];
    for (const review of reviews) {
      const row = await prisma.aiPreprocessingRow.findUnique({
        where: { id: review.rowId },
      });

      if (!row || row.jobId !== jobId) {
        results.push({ rowId: review.rowId, success: false, error: "Zeile nicht gefunden" });
        continue;
      }

      let newStatus: string;
      switch (review.action) {
        case "APPROVE":
          newStatus = "APPROVED";
          break;
        case "REJECT":
          newStatus = "REJECTED";
          break;
        case "MODIFY":
          newStatus = "MODIFIED";
          break;
        case "UNCLEAR":
          newStatus = "UNCLEAR";
          break;
        default:
          results.push({ rowId: review.rowId, success: false, error: "Ungueltige Aktion" });
          continue;
      }

      await prisma.aiPreprocessingRow.update({
        where: { id: review.rowId },
        data: {
          status: newStatus,
          humanEdits: review.edits ? JSON.stringify(review.edits) : null,
          rejectionReason: review.reason || null,
          reviewedBy: session.username,
          reviewedAt: new Date(),
        },
      });

      // Log the review action
      await prisma.aiPreprocessingLog.create({
        data: {
          jobId,
          action: review.action,
          details: JSON.stringify({
            rowId: review.rowId,
            edits: review.edits,
            reason: review.reason,
          }),
          userId: session.username,
        },
      });

      results.push({ rowId: review.rowId, success: true, newStatus });
    }

    // Check if all rows have been reviewed
    const pendingCount = await prisma.aiPreprocessingRow.count({
      where: { jobId, status: "PENDING" },
    });

    const unclearCount = await prisma.aiPreprocessingRow.count({
      where: { jobId, status: "UNCLEAR" },
    });

    return NextResponse.json({
      results,
      remainingPending: pendingCount,
      unclearCount,
      allReviewed: pendingCount === 0,
    });
  } catch (error) {
    console.error("Error reviewing AI preprocessing rows:", error);
    return NextResponse.json(
      { error: "Fehler beim Bewerten der Zeilen" },
      { status: 500 }
    );
  }
}
