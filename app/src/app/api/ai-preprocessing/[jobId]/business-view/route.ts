import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  INFLOW_CATEGORIES,
  OUTFLOW_CATEGORIES,
  INFLOW_CATEGORY_LABELS,
  OUTFLOW_CATEGORY_LABELS,
  UNCERTAINTY_LEVELS,
  type InflowCategory,
  type OutflowCategory,
  type UncertaintyLevel,
  type CategoryAggregation,
  type BusinessLevelView,
  calculateOverallUncertainty,
  getWeekLabel,
} from "@/lib/ai-preprocessing/insolvency-categories";

interface ParsedRow {
  id: string;
  fileId: string;
  fileName: string;
  sourceLocation: string;
  status: string;
  aiSuggestion: {
    amount?: number;
    isInflow?: boolean;
    category?: string;
    weekOffset?: number;
    estateType?: string;
    valueType?: string;
    isRecurring?: boolean;
    categoryReasoning?: string;
    estateTypeReasoning?: string;
    categoryUncertainty?: UncertaintyLevel;
    amountUncertainty?: UncertaintyLevel;
    weekUncertainty?: UncertaintyLevel;
    uncertaintyExplanation?: string;
    lineName?: string;
    description?: string;
  };
  aiExplanation: string;
  confidenceScore: number;
  humanEdits?: Record<string, unknown>;
}

// GET /api/ai-preprocessing/[jobId]/business-view - Get aggregated business-level view
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { jobId } = await params;

    // Get job with case info
    const job = await prisma.aiPreprocessingJob.findUnique({
      where: { id: jobId },
      include: {
        case: {
          select: {
            id: true,
            caseNumber: true,
            debtorName: true,
            filingDate: true,
          },
        },
        files: {
          select: {
            id: true,
            fileName: true,
            documentType: true,
            documentTypeExplanation: true,
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

    // Get all rows for this job
    const rows = await prisma.aiPreprocessingRow.findMany({
      where: { jobId },
      include: {
        file: {
          select: {
            fileName: true,
          },
        },
      },
    });

    // Parse rows and build aggregations
    const parsedRows: ParsedRow[] = rows.map((row) => ({
      id: row.id,
      fileId: row.fileId,
      fileName: row.file.fileName,
      sourceLocation: row.sourceLocation,
      status: row.status,
      aiSuggestion: JSON.parse(row.aiSuggestion),
      aiExplanation: row.aiExplanation || "",
      confidenceScore: row.confidenceScore,
      humanEdits: row.humanEdits ? JSON.parse(row.humanEdits) : undefined,
    }));

    // Build inflow aggregations
    const inflowCategories = buildCategoryAggregations(
      parsedRows.filter((r) => r.aiSuggestion.isInflow === true),
      "INFLOW",
      job.case.filingDate
    );

    // Build outflow aggregations
    const outflowCategories = buildCategoryAggregations(
      parsedRows.filter((r) => r.aiSuggestion.isInflow === false),
      "OUTFLOW",
      job.case.filingDate
    );

    // Calculate weekly totals for inflows
    const inflowWeeklyTotals = calculateWeeklyTotals(
      parsedRows.filter((r) => r.aiSuggestion.isInflow === true)
    );

    // Calculate weekly totals for outflows
    const outflowWeeklyTotals = calculateWeeklyTotals(
      parsedRows.filter((r) => r.aiSuggestion.isInflow === false)
    );

    // Count statistics
    const totalDerivedEntries = parsedRows.length;
    const approvedEntries = parsedRows.filter(
      (r) => r.status === "APPROVED" || r.status === "MODIFIED"
    ).length;
    const pendingEntries = parsedRows.filter((r) => r.status === "PENDING").length;
    const rejectedEntries = parsedRows.filter((r) => r.status === "REJECTED").length;
    const uncertainEntries = parsedRows.filter((r) => {
      const s = r.aiSuggestion;
      return (
        s.categoryUncertainty === "UNSICHER" ||
        s.categoryUncertainty === "UNBEKANNT" ||
        s.amountUncertainty === "UNSICHER" ||
        s.amountUncertainty === "UNBEKANNT" ||
        s.weekUncertainty === "UNSICHER" ||
        s.weekUncertainty === "UNBEKANNT"
      );
    }).length;

    // Build warnings
    const warnings = buildWarnings(parsedRows);

    // Build source file summary
    const sourceFiles = job.files.map((file) => {
      const fileRows = parsedRows.filter((r) => r.fileId === file.id);
      return {
        fileId: file.id,
        fileName: file.fileName,
        documentType: file.documentType,
        documentTypeExplanation: file.documentTypeExplanation,
        derivedEntryCount: fileRows.length,
        uncertaintyCount: fileRows.filter((r) => {
          const s = r.aiSuggestion;
          return (
            s.categoryUncertainty === "UNSICHER" ||
            s.categoryUncertainty === "UNBEKANNT"
          );
        }).length,
      };
    });

    // Determine overall validation status
    let overallValidationStatus: "PENDING" | "PARTIAL" | "APPROVED" = "PENDING";
    if (pendingEntries === 0 && rejectedEntries === 0 && approvedEntries > 0) {
      overallValidationStatus = "APPROVED";
    } else if (approvedEntries > 0) {
      overallValidationStatus = "PARTIAL";
    }

    const businessView: BusinessLevelView = {
      jobId: job.id,
      caseId: job.case.id,
      caseNumber: job.case.caseNumber,
      debtorName: job.case.debtorName,
      planStartDate: job.case.filingDate.toISOString(),
      weekCount: 13,
      inflows: {
        categories: inflowCategories,
        weeklyTotals: inflowWeeklyTotals,
        grandTotal: inflowWeeklyTotals.reduce((a, b) => a + b, 0),
        uncertainCount: parsedRows.filter(
          (r) =>
            r.aiSuggestion.isInflow === true &&
            (r.aiSuggestion.categoryUncertainty === "UNSICHER" ||
              r.aiSuggestion.categoryUncertainty === "UNBEKANNT")
        ).length,
      },
      outflows: {
        categories: outflowCategories,
        weeklyTotals: outflowWeeklyTotals,
        grandTotal: outflowWeeklyTotals.reduce((a, b) => a + b, 0),
        uncertainCount: parsedRows.filter(
          (r) =>
            r.aiSuggestion.isInflow === false &&
            (r.aiSuggestion.categoryUncertainty === "UNSICHER" ||
              r.aiSuggestion.categoryUncertainty === "UNBEKANNT")
        ).length,
      },
      overallValidationStatus,
      totalDerivedEntries,
      approvedEntries,
      pendingEntries,
      rejectedEntries,
      uncertainEntries,
      warnings,
      sourceFiles,
    };

    return NextResponse.json(businessView);
  } catch (error) {
    console.error("Error building business view:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Geschaeftsansicht" },
      { status: 500 }
    );
  }
}

// AI-Preprocessing Vorschau: periodCount wird hier als Default 13 verwendet,
// da die Vorschau vor der Plan-Zuordnung stattfindet.
const AI_PREVIEW_PERIOD_COUNT = 13;

function buildCategoryAggregations(
  rows: ParsedRow[],
  flowType: "INFLOW" | "OUTFLOW",
  startDate: Date
): CategoryAggregation[] {
  const categories =
    flowType === "INFLOW"
      ? Object.keys(INFLOW_CATEGORIES)
      : Object.keys(OUTFLOW_CATEGORIES);

  const labels =
    flowType === "INFLOW" ? INFLOW_CATEGORY_LABELS : OUTFLOW_CATEGORY_LABELS;

  return categories.map((category) => {
    const categoryRows = rows.filter(
      (r) => r.aiSuggestion.category === category
    );

    // Build weekly breakdown
    const weeklyTotals: CategoryAggregation["weeklyTotals"] = [];
    for (let week = 0; week < AI_PREVIEW_PERIOD_COUNT; week++) {
      const weekRows = categoryRows.filter(
        (r) => r.aiSuggestion.weekOffset === week
      );
      const amountCents = weekRows.reduce(
        (sum, r) => sum + Math.round((r.aiSuggestion.amount || 0) * 100),
        0
      );
      const hasUncertainty = weekRows.some(
        (r) =>
          r.aiSuggestion.categoryUncertainty === "UNSICHER" ||
          r.aiSuggestion.categoryUncertainty === "UNBEKANNT" ||
          r.aiSuggestion.weekUncertainty === "UNSICHER" ||
          r.aiSuggestion.weekUncertainty === "UNBEKANNT"
      );

      weeklyTotals.push({
        weekOffset: week,
        weekLabel: getWeekLabel(week, startDate),
        amountCents,
        entryCount: weekRows.length,
        hasUncertainty,
      });
    }

    // Calculate totals
    const totalAmountCents = weeklyTotals.reduce((sum, w) => sum + w.amountCents, 0);
    const totalEntryCount = categoryRows.length;

    // Count uncertain entries
    const uncertainEntryCount = categoryRows.filter(
      (r) =>
        r.aiSuggestion.categoryUncertainty === "UNSICHER" ||
        r.aiSuggestion.categoryUncertainty === "UNBEKANNT"
    ).length;

    // Calculate validation status
    const approvedCount = categoryRows.filter(
      (r) => r.status === "APPROVED" || r.status === "MODIFIED"
    ).length;
    const pendingCount = categoryRows.filter((r) => r.status === "PENDING").length;
    const rejectedCount = categoryRows.filter((r) => r.status === "REJECTED").length;

    let validationStatus: "PENDING" | "PARTIAL" | "APPROVED" | "REJECTED" =
      "PENDING";
    if (totalEntryCount === 0) {
      validationStatus = "APPROVED"; // Empty category is considered approved
    } else if (rejectedCount === totalEntryCount) {
      validationStatus = "REJECTED";
    } else if (pendingCount === 0 && rejectedCount === 0) {
      validationStatus = "APPROVED";
    } else if (approvedCount > 0) {
      validationStatus = "PARTIAL";
    }

    // Collect source files
    const sourceFiles = [...new Set(categoryRows.map((r) => r.fileName))];

    return {
      category: category as InflowCategory | OutflowCategory,
      categoryLabel: labels[category as keyof typeof labels] || category,
      flowType,
      weeklyTotals,
      totalAmountCents,
      totalEntryCount,
      uncertainEntryCount,
      uncertaintyPercentage:
        totalEntryCount > 0
          ? Math.round((uncertainEntryCount / totalEntryCount) * 100)
          : 0,
      validationStatus,
      approvedCount,
      pendingCount,
      rejectedCount,
      sourceFiles,
    };
  });
}

function calculateWeeklyTotals(rows: ParsedRow[]): number[] {
  const totals: number[] = Array(AI_PREVIEW_PERIOD_COUNT).fill(0);
  for (const row of rows) {
    const week = row.aiSuggestion.weekOffset;
    if (week !== undefined && week >= 0 && week < AI_PREVIEW_PERIOD_COUNT) {
      totals[week] += Math.round((row.aiSuggestion.amount || 0) * 100);
    }
  }
  return totals;
}

function buildWarnings(
  rows: ParsedRow[]
): BusinessLevelView["warnings"] {
  const warnings: BusinessLevelView["warnings"] = [];

  // Check for uncertain categories
  const uncertainCategoryRows = rows.filter(
    (r) =>
      r.aiSuggestion.categoryUncertainty === "UNSICHER" ||
      r.aiSuggestion.categoryUncertainty === "UNBEKANNT"
  );
  if (uncertainCategoryRows.length > 0) {
    warnings.push({
      type: "UNCERTAIN_CATEGORY",
      message: `${uncertainCategoryRows.length} Positionen haben unsichere Kategoriezuordnung`,
      affectedEntryIds: uncertainCategoryRows.map((r) => r.id),
      severity: "WARNING",
    });
  }

  // Check for uncertain amounts
  const uncertainAmountRows = rows.filter(
    (r) =>
      r.aiSuggestion.amountUncertainty === "UNSICHER" ||
      r.aiSuggestion.amountUncertainty === "UNBEKANNT"
  );
  if (uncertainAmountRows.length > 0) {
    warnings.push({
      type: "UNCERTAIN_AMOUNT",
      message: `${uncertainAmountRows.length} Positionen haben unsichere Betraege`,
      affectedEntryIds: uncertainAmountRows.map((r) => r.id),
      severity: "WARNING",
    });
  }

  // Check for uncertain weeks
  const uncertainWeekRows = rows.filter(
    (r) =>
      r.aiSuggestion.weekUncertainty === "UNSICHER" ||
      r.aiSuggestion.weekUncertainty === "UNBEKANNT"
  );
  if (uncertainWeekRows.length > 0) {
    warnings.push({
      type: "UNCERTAIN_WEEK",
      message: `${uncertainWeekRows.length} Positionen haben unsichere Wochenzuordnung`,
      affectedEntryIds: uncertainWeekRows.map((r) => r.id),
      severity: "WARNING",
    });
  }

  // Check for missing categories
  const missingCategoryRows = rows.filter(
    (r) => !r.aiSuggestion.category
  );
  if (missingCategoryRows.length > 0) {
    warnings.push({
      type: "MISSING_DATA",
      message: `${missingCategoryRows.length} Positionen ohne Kategoriezuordnung`,
      affectedEntryIds: missingCategoryRows.map((r) => r.id),
      severity: "ERROR",
    });
  }

  // Check for missing amounts
  const missingAmountRows = rows.filter(
    (r) => r.aiSuggestion.amount === undefined || r.aiSuggestion.amount === null
  );
  if (missingAmountRows.length > 0) {
    warnings.push({
      type: "MISSING_DATA",
      message: `${missingAmountRows.length} Positionen ohne Betrag`,
      affectedEntryIds: missingAmountRows.map((r) => r.id),
      severity: "ERROR",
    });
  }

  return warnings;
}
