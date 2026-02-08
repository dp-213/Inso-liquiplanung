import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // HVPlus spezifischer Pfad zur korrigierten Planungsdatei
    const planungPath = path.join(
      process.cwd(),
      "..",
      "Cases",
      "Hausärztliche Versorgung PLUS eG",
      "03-classified",
      "PLAN",
      "Liquiditaetsplanung_Korrigiert_2026-02-08.json"
    );

    // Datei lesen
    const fileContent = await fs.readFile(planungPath, "utf-8");
    const planungData = JSON.parse(fileContent);

    return NextResponse.json({
      success: true,
      data: planungData,
    });
  } catch (error) {
    console.error("Fehler beim Laden der Planung:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Planung konnte nicht geladen werden",
      },
      { status: 500 }
    );
  }
}
