import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  INFLOW_CATEGORIES,
  OUTFLOW_CATEGORIES,
  AI_INSOLVENCY_CONTEXT,
} from "@/lib/ai-preprocessing/insolvency-categories";

interface CategoryValidationRequest {
  category: string;
  flowType: "INFLOW" | "OUTFLOW";
  action: "APPROVE" | "REJECT";
  rejectionReason?: string;
  correctionCategory?: string;
  correctionExplanation?: string;
}

// POST /api/ai-preprocessing/[jobId]/validate-category - Validate/reject an entire category
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { jobId } = await params;
    const body: CategoryValidationRequest = await request.json();
    const { category, flowType, action, rejectionReason, correctionCategory, correctionExplanation } = body;

    // Validate category exists
    const validCategories = flowType === "INFLOW" ? INFLOW_CATEGORIES : OUTFLOW_CATEGORIES;
    if (!(category in validCategories)) {
      return NextResponse.json(
        { error: `Ungueltige Kategorie: ${category}` },
        { status: 400 }
      );
    }

    // Get job
    const job = await prisma.aiPreprocessingJob.findUnique({
      where: { id: jobId },
      include: { case: true },
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

    // Get all rows for this category
    const allRows = await prisma.aiPreprocessingRow.findMany({
      where: { jobId },
    });

    // Filter rows by category (need to parse JSON)
    const categoryRows = allRows.filter((row) => {
      try {
        const suggestion = JSON.parse(row.aiSuggestion);
        return (
          suggestion.category === category &&
          suggestion.isInflow === (flowType === "INFLOW")
        );
      } catch {
        return false;
      }
    });

    if (categoryRows.length === 0) {
      return NextResponse.json(
        { error: "Keine Zeilen in dieser Kategorie gefunden" },
        { status: 404 }
      );
    }

    if (action === "APPROVE") {
      // Approve all pending rows in this category
      const pendingRows = categoryRows.filter((r) => r.status === "PENDING");

      for (const row of pendingRows) {
        await prisma.aiPreprocessingRow.update({
          where: { id: row.id },
          data: {
            status: "APPROVED",
            reviewedBy: session.username,
            reviewedAt: new Date(),
          },
        });
      }

      // Log the action
      await prisma.aiPreprocessingLog.create({
        data: {
          jobId,
          action: "APPROVE",
          details: JSON.stringify({
            type: "CATEGORY_APPROVAL",
            category,
            flowType,
            approvedCount: pendingRows.length,
          }),
          userId: session.username,
        },
      });

      return NextResponse.json({
        success: true,
        approvedCount: pendingRows.length,
        message: `${pendingRows.length} Positionen in Kategorie "${category}" genehmigt`,
      });
    } else if (action === "REJECT") {
      // Reject requires a reason
      if (!rejectionReason) {
        return NextResponse.json(
          { error: "Ablehnungsgrund erforderlich" },
          { status: 400 }
        );
      }

      // If correction category is provided, reprocess with AI
      if (correctionCategory) {
        // Validate correction category
        if (!(correctionCategory in validCategories)) {
          return NextResponse.json(
            { error: `Ungueltige Korrektur-Kategorie: ${correctionCategory}` },
            { status: 400 }
          );
        }

        // Check for API key to determine if we can reprocess
        const apiKey = process.env.ANTHROPIC_API_KEY;

        if (apiKey) {
          // Reprocess rows with correction context
          await reprocessCategoryWithAI(
            apiKey,
            job,
            categoryRows,
            category,
            correctionCategory,
            correctionExplanation || rejectionReason
          );
        } else {
          // Demo mode - manually update to new category
          for (const row of categoryRows) {
            const suggestion = JSON.parse(row.aiSuggestion);
            suggestion.category = correctionCategory;
            suggestion.categoryReasoning = `Manuell korrigiert von ${category}: ${rejectionReason}`;
            suggestion.categoryUncertainty = "WAHRSCHEINLICH";

            await prisma.aiPreprocessingRow.update({
              where: { id: row.id },
              data: {
                aiSuggestion: JSON.stringify(suggestion),
                aiExplanation: `Kategorie korrigiert von "${category}" zu "${correctionCategory}": ${rejectionReason}`,
                status: "PENDING",
                humanEdits: JSON.stringify({
                  originalCategory: category,
                  correctedCategory: correctionCategory,
                  reason: rejectionReason,
                }),
                reviewedBy: null,
                reviewedAt: null,
                rejectionReason: null,
              },
            });
          }
        }

        // Log the correction
        await prisma.aiPreprocessingLog.create({
          data: {
            jobId,
            action: "AI_REPROCESS",
            details: JSON.stringify({
              type: "CATEGORY_CORRECTION",
              originalCategory: category,
              correctedCategory: correctionCategory,
              flowType,
              affectedCount: categoryRows.length,
              reason: rejectionReason,
            }),
            userId: session.username,
          },
        });

        return NextResponse.json({
          success: true,
          reprocessedCount: categoryRows.length,
          message: `${categoryRows.length} Positionen zur Korrektur zurueckgesetzt (${category} -> ${correctionCategory})`,
        });
      } else {
        // Just reject without correction
        for (const row of categoryRows) {
          await prisma.aiPreprocessingRow.update({
            where: { id: row.id },
            data: {
              status: "REJECTED",
              rejectionReason,
              reviewedBy: session.username,
              reviewedAt: new Date(),
            },
          });
        }

        // Log the rejection
        await prisma.aiPreprocessingLog.create({
          data: {
            jobId,
            action: "REJECT",
            details: JSON.stringify({
              type: "CATEGORY_REJECTION",
              category,
              flowType,
              rejectedCount: categoryRows.length,
              reason: rejectionReason,
            }),
            userId: session.username,
          },
        });

        return NextResponse.json({
          success: true,
          rejectedCount: categoryRows.length,
          message: `${categoryRows.length} Positionen in Kategorie "${category}" abgelehnt`,
        });
      }
    }

    return NextResponse.json(
      { error: "Ungueltige Aktion" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error validating category:", error);
    return NextResponse.json(
      { error: "Fehler bei der Kategorievalidierung" },
      { status: 500 }
    );
  }
}

async function reprocessCategoryWithAI(
  apiKey: string,
  job: { id: string; case: { debtorName: string } },
  rows: Array<{ id: string; aiSuggestion: string; rawData: string; sourceLocation: string }>,
  originalCategory: string,
  targetCategory: string,
  correctionExplanation: string
) {
  for (const row of rows) {
    const rawData = JSON.parse(row.rawData);
    const currentSuggestion = JSON.parse(row.aiSuggestion);

    const prompt = `Du bist ein Experte fuer Insolvenzbuchhaltung.

Ein Benutzer hat die Kategorisierung korrigiert:
- Original-Kategorie: ${originalCategory}
- Korrigierte Kategorie: ${targetCategory}
- Begruendung: "${correctionExplanation}"

${AI_INSOLVENCY_CONTEXT}

Originaldaten:
${JSON.stringify(rawData, null, 2)}

Vorherige Interpretation:
${JSON.stringify(currentSuggestion, null, 2)}

Bitte analysiere die Daten erneut unter Beruecksichtigung der Korrektur.
Die Kategorie sollte "${targetCategory}" sein (wie vom Benutzer korrigiert).

Gib eine JSON-Antwort:
{
  "suggestion": {
    "amount": <betrag>,
    "isInflow": <true/false>,
    "category": "${targetCategory}",
    "weekOffset": <0-12>,
    "estateType": "<ALTMASSE | NEUMASSE | NICHT_ZUORDENBAR>",
    "valueType": "<IST | PLAN | UNSICHER>",
    "isRecurring": <true/false>,
    "lineName": "<positionsname>",
    "categoryReasoning": "<PFLICHT: Warum diese Kategorie jetzt korrekt ist>",
    "estateTypeReasoning": "<PFLICHT: Alt/Neu Begruendung>",
    "categoryUncertainty": "SICHER",
    "amountUncertainty": "<SICHER | WAHRSCHEINLICH | UNSICHER>",
    "weekUncertainty": "<SICHER | WAHRSCHEINLICH | UNSICHER>"
  },
  "explanation": "<Erklaerung unter Beruecksichtigung der Korrektur>"
}`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (response.ok) {
        const claudeResponse = await response.json();
        const content = claudeResponse.content?.[0]?.text;

        if (content) {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);

            await prisma.aiPreprocessingRow.update({
              where: { id: row.id },
              data: {
                aiSuggestion: JSON.stringify(parsed.suggestion || {}),
                aiExplanation:
                  parsed.explanation ||
                  `Kategorie korrigiert von "${originalCategory}" zu "${targetCategory}"`,
                confidenceScore: 0.8, // Higher confidence after human correction
                status: "PENDING",
                humanEdits: JSON.stringify({
                  originalCategory,
                  correctedCategory: targetCategory,
                  reason: correctionExplanation,
                }),
                reviewedBy: null,
                reviewedAt: null,
                rejectionReason: null,
              },
            });
            continue;
          }
        }
      }

      // Fallback if API fails
      currentSuggestion.category = targetCategory;
      currentSuggestion.categoryReasoning = `Manuell korrigiert: ${correctionExplanation}`;
      currentSuggestion.categoryUncertainty = "WAHRSCHEINLICH";

      await prisma.aiPreprocessingRow.update({
        where: { id: row.id },
        data: {
          aiSuggestion: JSON.stringify(currentSuggestion),
          aiExplanation: `Kategorie korrigiert (API-Fehler, manuelle Anpassung): ${correctionExplanation}`,
          status: "PENDING",
          humanEdits: JSON.stringify({
            originalCategory,
            correctedCategory: targetCategory,
            reason: correctionExplanation,
          }),
          reviewedBy: null,
          reviewedAt: null,
          rejectionReason: null,
        },
      });
    } catch (error) {
      console.error("Error reprocessing row:", row.id, error);

      // Fallback
      currentSuggestion.category = targetCategory;
      currentSuggestion.categoryReasoning = `Manuell korrigiert: ${correctionExplanation}`;

      await prisma.aiPreprocessingRow.update({
        where: { id: row.id },
        data: {
          aiSuggestion: JSON.stringify(currentSuggestion),
          aiExplanation: `Kategorie manuell korrigiert: ${correctionExplanation}`,
          status: "PENDING",
          humanEdits: JSON.stringify({
            originalCategory,
            correctedCategory: targetCategory,
            reason: correctionExplanation,
          }),
          reviewedBy: null,
          reviewedAt: null,
          rejectionReason: null,
        },
      });
    }
  }
}
