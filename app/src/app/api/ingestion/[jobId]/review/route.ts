import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/ingestion/[jobId]/review - Get items requiring review
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

    const reviewItems = await prisma.stagedCashflowEntry.findMany({
      where: {
        jobId,
        requiresReview: true,
        status: "STAGED",
      },
      include: {
        sourceRecord: {
          select: {
            rowNumber: true,
            rawData: true,
          },
        },
      },
      orderBy: { periodIndex: "asc" },
    });

    const serializedItems = reviewItems.map((item) => ({
      ...item,
      amountCents: item.amountCents.toString(),
      sourceRecord: {
        ...item.sourceRecord,
        rawData: JSON.parse(item.sourceRecord.rawData),
      },
    }));

    return NextResponse.json(serializedItems);
  } catch (error) {
    console.error("Error fetching review items:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der zu pruefenden Eintraege" },
      { status: 500 }
    );
  }
}

// POST /api/ingestion/[jobId]/review - Process review action
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
    const { entryId, action, modifiedData } = body as {
      entryId: string;
      action: "APPROVE" | "MODIFY" | "REJECT";
      modifiedData?: {
        lineName?: string;
        periodIndex?: number;
        amountCents?: string;
        targetCategoryName?: string;
        targetCategoryFlowType?: string;
        targetCategoryEstateType?: string;
      };
    };

    if (!entryId || !action) {
      return NextResponse.json(
        { error: "Eintrag-ID und Aktion erforderlich" },
        { status: 400 }
      );
    }

    const entry = await prisma.stagedCashflowEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      return NextResponse.json(
        { error: "Eintrag nicht gefunden" },
        { status: 404 }
      );
    }

    if (entry.jobId !== jobId) {
      return NextResponse.json(
        { error: "Eintrag gehoert nicht zu diesem Import" },
        { status: 400 }
      );
    }

    // Update the entry based on action
    if (action === "APPROVE") {
      await prisma.stagedCashflowEntry.update({
        where: { id: entryId },
        data: {
          status: "REVIEWED",
          reviewAction: "APPROVE",
          reviewedBy: session.username,
          reviewedAt: new Date(),
        },
      });
    } else if (action === "REJECT") {
      await prisma.stagedCashflowEntry.update({
        where: { id: entryId },
        data: {
          status: "REJECTED",
          reviewAction: "REJECT",
          reviewedBy: session.username,
          reviewedAt: new Date(),
        },
      });
    } else if (action === "MODIFY" && modifiedData) {
      await prisma.stagedCashflowEntry.update({
        where: { id: entryId },
        data: {
          ...(modifiedData.lineName && { lineName: modifiedData.lineName }),
          ...(modifiedData.periodIndex !== undefined && { periodIndex: modifiedData.periodIndex }),
          ...(modifiedData.amountCents && { amountCents: BigInt(modifiedData.amountCents) }),
          ...(modifiedData.targetCategoryName && { targetCategoryName: modifiedData.targetCategoryName }),
          ...(modifiedData.targetCategoryFlowType && { targetCategoryFlowType: modifiedData.targetCategoryFlowType }),
          ...(modifiedData.targetCategoryEstateType && { targetCategoryEstateType: modifiedData.targetCategoryEstateType }),
          status: "REVIEWED",
          reviewAction: "MODIFY",
          reviewedBy: session.username,
          reviewedAt: new Date(),
        },
      });
    }

    // Check if all review items are processed
    const remainingReviews = await prisma.stagedCashflowEntry.count({
      where: {
        jobId,
        requiresReview: true,
        status: "STAGED",
      },
    });

    if (remainingReviews === 0) {
      // Update job status to READY
      await prisma.ingestionJob.update({
        where: { id: jobId },
        data: { status: "READY" },
      });
    }

    return NextResponse.json({
      success: true,
      remainingReviews,
    });
  } catch (error) {
    console.error("Error processing review:", error);
    return NextResponse.json(
      { error: "Fehler bei der Verarbeitung der Pruefung" },
      { status: 500 }
    );
  }
}

// PUT /api/ingestion/[jobId]/review - Bulk approve/reject
export async function PUT(
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
    const { action } = body as { action: "APPROVE_ALL" | "REJECT_ALL" };

    if (action === "APPROVE_ALL") {
      await prisma.stagedCashflowEntry.updateMany({
        where: {
          jobId,
          requiresReview: true,
          status: "STAGED",
        },
        data: {
          status: "REVIEWED",
          reviewAction: "APPROVE",
          reviewedBy: session.username,
          reviewedAt: new Date(),
        },
      });

      await prisma.ingestionJob.update({
        where: { id: jobId },
        data: { status: "READY" },
      });
    } else if (action === "REJECT_ALL") {
      await prisma.stagedCashflowEntry.updateMany({
        where: {
          jobId,
          requiresReview: true,
          status: "STAGED",
        },
        data: {
          status: "REJECTED",
          reviewAction: "REJECT",
          reviewedBy: session.username,
          reviewedAt: new Date(),
        },
      });

      await prisma.ingestionJob.update({
        where: { id: jobId },
        data: { status: "READY" },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error bulk processing:", error);
    return NextResponse.json(
      { error: "Fehler bei der Massenverarbeitung" },
      { status: 500 }
    );
  }
}
