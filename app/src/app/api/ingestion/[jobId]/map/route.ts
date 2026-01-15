import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { parseGermanEuroToCents } from "@/lib/calculation-engine";
import {
  parseDate,
  dateToWeekOffset,
  parseDecimalToCents,
} from "@/lib/ingestion/transformations";

interface FieldMapping {
  sourceField: string;
  targetField: string;
  transformationType?: string;
}

interface CategoryMapping {
  sourceValue: string;
  categoryName: string;
  flowType: "INFLOW" | "OUTFLOW";
  estateType: "ALTMASSE" | "NEUMASSE";
}

// POST /api/ingestion/[jobId]/map - Apply mapping to records
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
    const {
      fieldMappings,
      categoryMappings,
      valueTypeField,
      planStartDate,
      dateFormat = "DD.MM.YYYY",
      decimalSeparator = ",",
      thousandsSeparator = ".",
      defaultValueType = "PLAN",
      defaultCategory,
    } = body as {
      fieldMappings: FieldMapping[];
      categoryMappings: CategoryMapping[];
      valueTypeField?: string;
      planStartDate: string;
      dateFormat?: string;
      decimalSeparator?: string;
      thousandsSeparator?: string;
      defaultValueType?: "IST" | "PLAN";
      defaultCategory?: {
        categoryName: string;
        flowType: "INFLOW" | "OUTFLOW";
        estateType: "ALTMASSE" | "NEUMASSE";
      };
    };

    // Get job with records
    const job = await prisma.ingestionJob.findUnique({
      where: { id: jobId },
      include: {
        case: {
          include: {
            plans: {
              where: { isActive: true },
            },
          },
        },
        records: {
          orderBy: { rowNumber: "asc" },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Importvorgang nicht gefunden" },
        { status: 404 }
      );
    }

    const plan = job.case.plans[0];
    if (!plan) {
      return NextResponse.json(
        { error: "Kein aktiver Plan gefunden" },
        { status: 400 }
      );
    }

    const planStart = new Date(planStartDate);
    let errorCount = 0;
    let warningCount = 0;
    let quarantinedCount = 0;

    const stagedEntries: Array<{
      sourceRecordId: string;
      targetCategoryName: string;
      targetCategoryFlowType: string;
      targetCategoryEstateType: string;
      lineName: string;
      weekOffset: number;
      valueType: string;
      amountCents: bigint;
      originalAmountRaw: string;
      requiresReview: boolean;
      reviewReason: string | null;
      reviewReasonCode: string | null;
    }> = [];

    // Delete existing staged entries for this job (for re-run)
    await prisma.stagedCashflowEntry.deleteMany({
      where: { jobId },
    });

    // Delete existing transformations
    await prisma.fieldTransformation.deleteMany({
      where: {
        record: {
          jobId,
        },
      },
    });

    // Process each record
    for (const record of job.records) {
      const rawData = JSON.parse(record.rawData) as Record<string, string>;
      const mappedData: Record<string, unknown> = {};
      const errors: string[] = [];
      const warnings: string[] = [];
      const transformations: Array<{
        sourceField: string;
        sourceValue: string;
        targetField: string;
        targetValue: string;
        transformationType: string;
      }> = [];

      // Apply field mappings with transformations
      for (const mapping of fieldMappings) {
        const sourceValue = rawData[mapping.sourceField];
        const transformType = mapping.transformationType || "DIRECT";

        if (sourceValue !== undefined && sourceValue !== "") {
          let targetValue: unknown = sourceValue;

          switch (transformType) {
            case "DIRECT":
            case "RENAME":
              targetValue = sourceValue;
              break;

            case "DATE_TO_WEEK_OFFSET":
              // Will be processed later
              targetValue = sourceValue;
              break;

            case "DECIMAL_TO_CENTS":
              // Will be processed later
              targetValue = sourceValue;
              break;

            default:
              targetValue = sourceValue;
          }

          mappedData[mapping.targetField] = targetValue;

          // Record transformation
          transformations.push({
            sourceField: mapping.sourceField,
            sourceValue: sourceValue,
            targetField: mapping.targetField,
            targetValue: String(targetValue),
            transformationType: transformType,
          });
        }
      }

      // Extract required fields based on target field names
      const dateValue = (mappedData["date"] || mappedData["week_offset"]) as string;
      const amountValue = (mappedData["amount_cents"] || mappedData["amount"]) as string;
      const descriptionValue =
        (mappedData["line_name"] as string) ||
        (mappedData["description"] as string) ||
        rawData["beschreibung"] ||
        rawData["verwendungszweck"] ||
        rawData["text"] ||
        `Zeile ${record.rowNumber}`;
      const categoryValue = mappedData["category"] as string;

      // Validate and convert date to week offset
      let weekOffset: number | null = null;
      if (dateValue) {
        try {
          const date = parseDate(dateValue, dateFormat);

          if (date && !isNaN(date.getTime())) {
            const result = dateToWeekOffset(date, planStart);
            if (result) {
              weekOffset = result.weekOffset;
              if (result.isOutOfRange) {
                warnings.push(
                  `Datum liegt ausserhalb des 13-Wochen-Zeitraums, wurde auf Woche ${weekOffset} begrenzt`
                );
              }
            }
          } else {
            errors.push(`Ungültiges Datumsformat: ${dateValue} (erwartet: ${dateFormat})`);
          }
        } catch {
          errors.push(`Datum konnte nicht verarbeitet werden: ${dateValue}`);
        }
      } else {
        errors.push("Kein Datum gefunden");
      }

      // Validate and convert amount
      let amountCents: bigint | null = null;
      if (amountValue) {
        // Try with configured separators first
        amountCents = parseDecimalToCents(amountValue, decimalSeparator, thousandsSeparator);

        // Fallback to German format parser
        if (amountCents === null) {
          amountCents = parseGermanEuroToCents(amountValue);
        }

        if (amountCents === null) {
          errors.push(`Ungültiger Betrag: ${amountValue}`);
        }
      } else {
        errors.push("Kein Betrag gefunden");
      }

      // Determine category through mappings
      let targetCategory: {
        categoryName: string;
        flowType: "INFLOW" | "OUTFLOW";
        estateType: "ALTMASSE" | "NEUMASSE";
      } | null = null;

      // First check category mappings by searching in description/raw data
      if (categoryMappings.length > 0) {
        const searchText = (categoryValue || descriptionValue || "").toLowerCase();
        for (const catMapping of categoryMappings) {
          if (
            catMapping.sourceValue &&
            searchText.includes(catMapping.sourceValue.toLowerCase())
          ) {
            targetCategory = {
              categoryName: catMapping.categoryName,
              flowType: catMapping.flowType,
              estateType: catMapping.estateType,
            };
            break;
          }
        }
      }

      // Determine flow type from amount if not mapped
      if (!targetCategory && amountCents !== null) {
        if (defaultCategory) {
          // Use default but adjust flow type based on sign
          const isInflow = amountCents >= 0;
          targetCategory = {
            categoryName: isInflow
              ? defaultCategory.flowType === "INFLOW"
                ? defaultCategory.categoryName
                : "Umsatzerloese"
              : defaultCategory.flowType === "OUTFLOW"
              ? defaultCategory.categoryName
              : "Sonstige Auszahlungen Neu",
            flowType: isInflow ? "INFLOW" : "OUTFLOW",
            estateType: defaultCategory.estateType,
          };
          warnings.push(`Kategorie automatisch zugewiesen: ${targetCategory.categoryName}`);
        } else {
          // Auto-assign based on sign
          const isInflow = amountCents >= 0;
          targetCategory = {
            categoryName: isInflow ? "Umsatzerloese" : "Sonstige Auszahlungen Neu",
            flowType: isInflow ? "INFLOW" : "OUTFLOW",
            estateType: "NEUMASSE",
          };
          warnings.push(`Kategorie automatisch zugewiesen: ${targetCategory.categoryName}`);
        }
      }

      // Determine value type
      let valueType: "IST" | "PLAN" = defaultValueType;
      if (valueTypeField && rawData[valueTypeField]) {
        const vtValue = rawData[valueTypeField].toLowerCase();
        if (vtValue.includes("ist") || vtValue.includes("actual")) {
          valueType = "IST";
        } else if (vtValue.includes("plan") || vtValue.includes("forecast")) {
          valueType = "PLAN";
        }
      }

      // Determine quality tier
      let qualityTier: string;
      if (errors.length > 0) {
        qualityTier = "TIER_3_QUARANTINED";
        quarantinedCount++;
      } else if (warnings.length > 0) {
        qualityTier = "TIER_2_REVIEWABLE";
      } else {
        qualityTier = "TIER_1_VALID";
      }

      // Update record with mapped data
      await prisma.ingestionRecord.update({
        where: { id: record.id },
        data: {
          mappedData: JSON.stringify(mappedData),
          validationErrors: errors.length > 0 ? JSON.stringify(errors) : null,
          validationWarnings: warnings.length > 0 ? JSON.stringify(warnings) : null,
          status: errors.length > 0 ? "QUARANTINED" : warnings.length > 0 ? "REVIEW" : "READY",
          qualityTier,
        },
      });

      // Save field transformations for lineage
      for (const transform of transformations) {
        await prisma.fieldTransformation.create({
          data: {
            recordId: record.id,
            sourceField: transform.sourceField,
            sourceValue: transform.sourceValue,
            targetField: transform.targetField,
            targetValue: transform.targetValue,
            transformationType: transform.transformationType,
          },
        });
      }

      errorCount += errors.length;
      warningCount += warnings.length;

      // Create staged entry if valid (no errors)
      if (weekOffset !== null && amountCents !== null && targetCategory && errors.length === 0) {
        const reviewReasonCode = warnings.length > 0
          ? warnings.some((w) => w.includes("Zeitraum"))
            ? "DATE_OUTSIDE_RANGE"
            : warnings.some((w) => w.includes("automatisch"))
            ? "CATEGORY_AUTO_ASSIGNED"
            : null
          : null;

        stagedEntries.push({
          sourceRecordId: record.id,
          targetCategoryName: targetCategory.categoryName,
          targetCategoryFlowType: targetCategory.flowType,
          targetCategoryEstateType: targetCategory.estateType,
          lineName: descriptionValue.substring(0, 255), // Limit length
          weekOffset,
          valueType,
          amountCents: amountCents < 0 ? -amountCents : amountCents, // Store as positive
          originalAmountRaw: amountValue,
          requiresReview: warnings.length > 0,
          reviewReason: warnings.length > 0 ? warnings.join("; ") : null,
          reviewReasonCode,
        });
      }
    }

    // Create staged entries
    for (const entry of stagedEntries) {
      await prisma.stagedCashflowEntry.create({
        data: {
          jobId,
          sourceRecordId: entry.sourceRecordId,
          targetCategoryName: entry.targetCategoryName,
          targetCategoryFlowType: entry.targetCategoryFlowType,
          targetCategoryEstateType: entry.targetCategoryEstateType,
          lineName: entry.lineName,
          weekOffset: entry.weekOffset,
          valueType: entry.valueType,
          amountCents: entry.amountCents,
          originalAmountRaw: entry.originalAmountRaw,
          requiresReview: entry.requiresReview,
          reviewReason: entry.reviewReason,
          reviewReasonCode: entry.reviewReasonCode,
          status: "STAGED",
        },
      });
    }

    // Determine final job status
    const hasReviewable = stagedEntries.some((e) => e.requiresReview);
    const finalStatus =
      quarantinedCount > 0 && stagedEntries.length === 0
        ? "QUARANTINED"
        : hasReviewable
        ? "REVIEW"
        : "READY";

    // Update job status with quality metrics
    const totalRecords = job.records.length;
    const qualityScore =
      totalRecords > 0 ? ((stagedEntries.length / totalRecords) * 100) : 0;

    await prisma.ingestionJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        errorCount,
        warningCount,
        quarantinedCount,
        recordCountNormalized: stagedEntries.length,
        qualityScore,
      },
    });

    return NextResponse.json({
      success: true,
      totalRecords,
      stagedCount: stagedEntries.length,
      errorCount,
      warningCount,
      quarantinedCount,
      qualityScore: Math.round(qualityScore),
      status: finalStatus,
    });
  } catch (error) {
    console.error("Error mapping records:", error);
    return NextResponse.json(
      { error: "Fehler beim Zuordnen der Daten" },
      { status: 500 }
    );
  }
}

// PUT /api/ingestion/[jobId]/map - Re-run mapping with new configuration
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  // Re-run uses the same logic as POST
  return POST(request, { params });
}
