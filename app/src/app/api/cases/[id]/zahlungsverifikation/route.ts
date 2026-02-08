import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Auth-Check
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    // Case abrufen
    const caseData = await prisma.case.findUnique({
      where: { id },
      select: {
        id: true,
        caseNumber: true,
        debtorName: true,
      },
    });

    if (!caseData) {
      return NextResponse.json(
        { success: false, error: "Fall nicht gefunden" },
        { status: 404 }
      );
    }

    // Verifikationsdaten aus Case-Ordner laden
    const caseName = caseData.debtorName;
    const verificationPath = join(
      process.cwd(),
      "..",
      "Cases",
      caseName,
      "06-review",
      "Zahlungsverifikation_Nov2025-Jan2026.json"
    );

    if (!existsSync(verificationPath)) {
      // Noch keine Verifikation vorhanden
      return NextResponse.json({
        success: true,
        available: false,
        message: "Zahlungsverifikation noch nicht durchgeführt",
      });
    }

    // JSON laden
    const verificationData = JSON.parse(
      readFileSync(verificationPath, "utf-8")
    );

    return NextResponse.json({
      success: true,
      available: true,
      data: verificationData,
    });
  } catch (error) {
    console.error("Fehler beim Laden der Zahlungsverifikation:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Fehler beim Laden der Verifikationsdaten",
      },
      { status: 500 }
    );
  }
}
