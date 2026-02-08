import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

interface CreditLine {
  creditor: string;
  contractType: string;
  contractNumber?: string;
  contractDate?: string;
  principal: number;
  interestRate: number;
  interestType: string;
  startDate?: string;
  maturityDate?: string;
  repaymentType: string;
  monthlyPayment?: number | null;
  monthlyInterest?: number | null;
  monthlyPrincipal?: number | null;
  collateral: string[];
  status: string;
  statusNote?: string;
  sourceFile: string;
}

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

    const caseName = caseData.debtorName;
    const caseDir = join(process.cwd(), "..", "Cases", caseName);
    const extractedDir = join(caseDir, "02-extracted");

    const creditLines: CreditLine[] = [];

    // 1. Massekredit laden (IMMER vorhanden)
    const massekreditPath = join(
      caseDir,
      "03-classified",
      "VERTRAEGE",
      "Massekreditvertrag_SPK.json"
    );

    if (existsSync(massekreditPath)) {
      const massekreditData = JSON.parse(
        readFileSync(massekreditPath, "utf-8")
      );

      const monthlyInterest =
        (massekreditData.massekredit.maxBetrag * 0.1) / 12; // 10% Fee approximiert als Zinsen

      creditLines.push({
        creditor: massekreditData.vertragsparteien.kreditgeber,
        contractType: "Massekredit",
        contractDate: massekreditData.documentDate,
        principal: massekreditData.massekredit.maxBetrag,
        interestRate: 10.0, // 10% Fortführungsbeitrag
        interestType: "FEE_BASED",
        maturityDate: massekreditData.massekredit.laufzeitende,
        repaymentType: "ENDFÄLLIG",
        monthlyPayment: null,
        monthlyInterest: monthlyInterest,
        monthlyPrincipal: 0,
        collateral: massekreditData.sicherheiten.map(
          (s: any) => `${s.typ} ${s.umfang} (${s.datum})`
        ),
        status: "ACTIVE",
        statusNote: `Fortführungsbeitrag: ${massekreditData.massekredit.fortfuehrungsbeitrag}`,
        sourceFile: massekreditData.sourceFile,
      });
    }

    // 2. Extrahierte Kreditverträge laden (falls vorhanden)
    if (existsSync(extractedDir)) {
      const files = readdirSync(extractedDir);
      const creditFiles = files.filter(
        (f) =>
          (f.startsWith("ApoBank_Darlehen") ||
            f.startsWith("Sparkasse_Darlehen") ||
            f.startsWith("SHP_Darlehen")) &&
          f.endsWith(".json") &&
          !f.includes("TEMPLATE")
      );

      for (const file of creditFiles) {
        try {
          const filePath = join(extractedDir, file);
          const creditData = JSON.parse(readFileSync(filePath, "utf-8"));

          // Nur hinzufügen wenn nicht Template-Felder vorhanden
          if (!creditData._ANLEITUNG) {
            creditLines.push(creditData);
          }
        } catch (err) {
          console.error(`Fehler beim Laden von ${file}:`, err);
        }
      }
    }

    // 3. Aggregierte Statistiken berechnen
    const totalDebt = creditLines.reduce((sum, cl) => sum + cl.principal, 0);
    const monthlyInterest = creditLines.reduce(
      (sum, cl) => sum + (cl.monthlyInterest || 0),
      0
    );
    const monthlyPrincipal = creditLines.reduce(
      (sum, cl) => sum + (cl.monthlyPrincipal || 0),
      0
    );

    const byCreditor: Record<
      string,
      { count: number; totalPrincipal: number; monthlyPayment: number }
    > = {};

    creditLines.forEach((cl) => {
      if (!byCreditor[cl.creditor]) {
        byCreditor[cl.creditor] = {
          count: 0,
          totalPrincipal: 0,
          monthlyPayment: 0,
        };
      }
      byCreditor[cl.creditor].count++;
      byCreditor[cl.creditor].totalPrincipal += cl.principal;
      byCreditor[cl.creditor].monthlyPayment +=
        (cl.monthlyInterest || 0) + (cl.monthlyPrincipal || 0);
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalDebt,
        monthlyInterest,
        monthlyPrincipal,
        monthlyTotal: monthlyInterest + monthlyPrincipal,
        creditorCount: Object.keys(byCreditor).length,
        contractCount: creditLines.length,
        byCreditor,
      },
      creditLines: creditLines.sort(
        (a, b) => b.principal - a.principal // Größte zuerst
      ),
    });
  } catch (error) {
    console.error("Fehler beim Laden der Finanzierungsdaten:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Fehler beim Laden der Finanzierungsdaten",
      },
      { status: 500 }
    );
  }
}
