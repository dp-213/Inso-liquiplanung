import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// POST /api/ai-preprocessing/[jobId]/reprocess - Request AI re-processing with corrections
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
    const { rowIds, correctionText } = body as {
      rowIds: string[];
      correctionText: string;
    };

    if (!rowIds || rowIds.length === 0) {
      return NextResponse.json(
        { error: "Keine Zeilen ausgewaehlt" },
        { status: 400 }
      );
    }

    if (!correctionText || correctionText.trim().length === 0) {
      return NextResponse.json(
        { error: "Bitte beschreiben Sie das Problem" },
        { status: 400 }
      );
    }

    // Get job
    const job = await prisma.aiPreprocessingJob.findUnique({
      where: { id: jobId },
      include: {
        case: true,
      },
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

    // Get the rows to reprocess
    const rows = await prisma.aiPreprocessingRow.findMany({
      where: {
        id: { in: rowIds },
        jobId,
      },
      include: {
        file: true,
      },
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Keine gueltigen Zeilen gefunden" },
        { status: 400 }
      );
    }

    // Update job status to CORRECTION
    await prisma.aiPreprocessingJob.update({
      where: { id: jobId },
      data: {
        status: "CORRECTION",
        iterationCount: { increment: 1 },
      },
    });

    // Log the correction request
    await prisma.aiPreprocessingLog.create({
      data: {
        jobId,
        action: "AI_REPROCESS",
        details: JSON.stringify({
          rowCount: rows.length,
          rowIds,
          correctionText,
          iteration: job.iterationCount + 1,
        }),
        userId: session.username,
      },
    });

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Demo mode - just reset the rows to pending with updated explanation
      for (const row of rows) {
        const currentSuggestion = JSON.parse(row.aiSuggestion);
        await prisma.aiPreprocessingRow.update({
          where: { id: row.id },
          data: {
            status: "PENDING",
            aiExplanation: `Korrektur angefordert: "${correctionText}" - Bitte manuell pruefen. (Demo-Modus)`,
            humanEdits: null,
            reviewedBy: null,
            reviewedAt: null,
            rejectionReason: null,
          },
        });
      }

      await prisma.aiPreprocessingJob.update({
        where: { id: jobId },
        data: { status: "REVIEW" },
      });

      return NextResponse.json({
        success: true,
        reprocessedCount: rows.length,
        message: "Demo-Modus: Zeilen zum erneuten Pruefen zurueckgesetzt",
      });
    }

    // Call Claude API with correction context
    try {
      for (const row of rows) {
        const rawData = JSON.parse(row.rawData);
        const currentSuggestion = JSON.parse(row.aiSuggestion);

        const prompt = `Du bist ein Assistent fuer die Analyse von Finanzdaten im Kontext eines Insolvenzverfahrens.

Ein Benutzer hat Feedback zu deiner vorherigen Analyse gegeben:
"${correctionText}"

Vorherige Interpretation:
${JSON.stringify(currentSuggestion, null, 2)}

Originaldaten aus ${row.file.fileName}, ${row.sourceLocation}:
${JSON.stringify(rawData, null, 2)}

Bitte analysiere die Daten erneut unter Beruecksichtigung des Feedbacks.

Gib eine JSON-Antwort mit folgender Struktur:
{
  "suggestion": {
    "date": "<datum falls erkennbar>",
    "weekOffset": <0-12 falls berechenbar>,
    "amount": <betrag als Zahl>,
    "amountRaw": "<originaler Betrag-String>",
    "isInflow": <true/false>,
    "category": "<vorgeschlagene Kategorie>",
    "lineName": "<vorgeschlagener Positionsname>",
    "estateType": "<ALTMASSE oder NEUMASSE>",
    "valueType": "<IST oder PLAN>",
    "description": "<zusaetzliche Beschreibung>"
  },
  "explanation": "<Erklaerung warum so interpretiert, unter Beruecksichtigung des Feedbacks>",
  "confidence": <0.0-1.0>,
  "fieldConfidences": [
    {"field": "amount", "confidence": 0.9, "reason": "Korrigiert basierend auf Feedback"}
  ]
}

WICHTIG:
- Beruecksichtige das Benutzer-Feedback in deiner Analyse
- Erklaere, wie du das Feedback angewendet hast
- Bei Unsicherheit, setze niedrige Konfidenz`;

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
              messages: [
                {
                  role: "user",
                  content: prompt,
                },
              ],
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
                      `Erneut analysiert basierend auf Feedback: "${correctionText}"`,
                    confidenceScore: parsed.confidence || 0.5,
                    confidenceDetails: JSON.stringify(parsed.fieldConfidences || []),
                    status: "PENDING",
                    humanEdits: null,
                    reviewedBy: null,
                    reviewedAt: null,
                    rejectionReason: null,
                  },
                });

                continue;
              }
            }
          }

          // If API call failed, fall back to simple reset
          await prisma.aiPreprocessingRow.update({
            where: { id: row.id },
            data: {
              status: "PENDING",
              aiExplanation: `Korrektur angefordert: "${correctionText}" - KI-Analyse fehlgeschlagen, bitte manuell pruefen.`,
              humanEdits: null,
              reviewedBy: null,
              reviewedAt: null,
              rejectionReason: null,
            },
          });
        } catch (apiError) {
          console.error("Claude API error for row:", row.id, apiError);
          // Fall back to simple reset
          await prisma.aiPreprocessingRow.update({
            where: { id: row.id },
            data: {
              status: "PENDING",
              aiExplanation: `Korrektur angefordert: "${correctionText}" - Fehler bei KI-Analyse, bitte manuell pruefen.`,
              humanEdits: null,
              reviewedBy: null,
              reviewedAt: null,
              rejectionReason: null,
            },
          });
        }
      }
    } catch (error) {
      console.error("Error during reprocessing:", error);
    }

    // Update job status back to REVIEW
    await prisma.aiPreprocessingJob.update({
      where: { id: jobId },
      data: { status: "REVIEW" },
    });

    return NextResponse.json({
      success: true,
      reprocessedCount: rows.length,
      message: "Zeilen wurden erneut analysiert",
    });
  } catch (error) {
    console.error("Error reprocessing rows:", error);
    return NextResponse.json(
      { error: "Fehler bei der erneuten Verarbeitung" },
      { status: 500 }
    );
  }
}
