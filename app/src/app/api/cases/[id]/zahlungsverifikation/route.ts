import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * GET /api/cases/[id]/zahlungsverifikation
 *
 * SOLL/IST-Abgleich: PLAN-Werte (LedgerEntries valueType=PLAN) vs. IST-Werte (LedgerEntries valueType=IST)
 * pro Planungsperiode (Woche oder Monat).
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
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
        cutoffDate: true,
      },
    });

    if (!caseData) {
      return NextResponse.json(
        { success: false, error: "Fall nicht gefunden" },
        { status: 404 }
      );
    }

    // Aktiven LiquidityPlan laden (nur Perioden-Struktur, keine PeriodValues)
    const plan = await prisma.liquidityPlan.findFirst({
      where: { caseId: id, isActive: true },
    });

    if (!plan) {
      return NextResponse.json({
        success: true,
        available: false,
        message: "Kein aktiver Liquiditätsplan vorhanden. Bitte zuerst einen Plan anlegen.",
        data: null,
      });
    }

    // Perioden berechnen
    const planStart = new Date(plan.planStartDate);
    const periods: { index: number; label: string; start: Date; end: Date }[] = [];

    for (let i = 0; i < plan.periodCount; i++) {
      let start: Date;
      let end: Date;
      let label: string;

      if (plan.periodType === "MONTHLY") {
        start = new Date(planStart.getFullYear(), planStart.getMonth() + i, 1);
        end = new Date(planStart.getFullYear(), planStart.getMonth() + i + 1, 0, 23, 59, 59, 999);
        const monthNames = [
          "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
          "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"
        ];
        label = `${monthNames[start.getMonth()]} ${start.getFullYear()}`;
      } else {
        // WEEKLY
        start = new Date(planStart);
        start.setDate(start.getDate() + i * 7);
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        label = `KW ${getISOWeek(start)}/${start.getFullYear()}`;
      }

      periods.push({ index: i, label, start, end });
    }

    // Alle LedgerEntries laden (IST + PLAN)
    // NOTE: Date filter applied in JS (Turso adapter date comparison bug)
    const planEnd = periods[periods.length - 1]?.end;
    const allEntries = await prisma.ledgerEntry.findMany({
      where: {
        caseId: id,
        valueType: { in: ["IST", "PLAN"] },
      },
      select: {
        transactionDate: true,
        amountCents: true,
        valueType: true,
      },
    });

    const filteredEntries = allEntries.filter((e) => {
      if (e.transactionDate < planStart) return false;
      if (planEnd && e.transactionDate > planEnd) return false;
      return true;
    });

    // PLAN- und IST-Werte pro Periode aggregieren
    const planByPeriod: Record<number, { inflows: bigint; outflows: bigint }> = {};
    const istByPeriod: Record<number, { inflows: bigint; outflows: bigint }> = {};
    for (let i = 0; i < plan.periodCount; i++) {
      planByPeriod[i] = { inflows: BigInt(0), outflows: BigInt(0) };
      istByPeriod[i] = { inflows: BigInt(0), outflows: BigInt(0) };
    }

    for (const entry of filteredEntries) {
      const entryDate = new Date(entry.transactionDate);
      // Finde passende Periode
      for (const period of periods) {
        if (entryDate >= period.start && entryDate <= period.end) {
          const target = entry.valueType === "PLAN" ? planByPeriod : istByPeriod;
          if (entry.amountCents >= 0) {
            target[period.index].inflows += entry.amountCents;
          } else {
            target[period.index].outflows += entry.amountCents;
          }
          break;
        }
      }
    }

    // Perioden-Daten zusammenbauen
    let totalPlan = BigInt(0);
    let totalIst = BigInt(0);

    const periodResults = periods.map((period) => {
      const planData = planByPeriod[period.index];
      const istData = istByPeriod[period.index];

      const planNet = planData.inflows + planData.outflows;
      const istNet = istData.inflows + istData.outflows;
      const deviation = istNet - planNet;

      totalPlan += planNet;
      totalIst += istNet;

      // Abweichung in Prozent (gegen Plan-Wert)
      let deviationPercent = 0;
      if (planNet !== BigInt(0)) {
        deviationPercent = Number((deviation * BigInt(10000)) / planNet) / 100;
      }

      // Ampel: <5% grün, 5-15% gelb, >15% rot
      const absPercent = Math.abs(deviationPercent);
      let status: "green" | "yellow" | "red" | "neutral";
      if (planNet === BigInt(0) && istNet === BigInt(0)) {
        status = "neutral";
      } else if (absPercent < 5) {
        status = "green";
      } else if (absPercent < 15) {
        status = "yellow";
      } else {
        status = "red";
      }

      // Hat diese Periode IST-Daten?
      const hasIstData = istData.inflows !== BigInt(0) || istData.outflows !== BigInt(0);

      return {
        index: period.index,
        label: period.label,
        startDate: period.start.toISOString(),
        endDate: period.end.toISOString(),
        plan: {
          inflows: planData.inflows.toString(),
          outflows: planData.outflows.toString(),
          net: planNet.toString(),
        },
        ist: {
          inflows: istData.inflows.toString(),
          outflows: istData.outflows.toString(),
          net: istNet.toString(),
        },
        deviation: deviation.toString(),
        deviationPercent: Math.round(deviationPercent * 100) / 100,
        status,
        hasIstData,
      };
    });

    const totalDeviation = totalIst - totalPlan;
    let totalDeviationPercent = 0;
    if (totalPlan !== BigInt(0)) {
      totalDeviationPercent = Number((totalDeviation * BigInt(10000)) / totalPlan) / 100;
    }

    const absTotal = Math.abs(totalDeviationPercent);
    let totalStatus: "green" | "yellow" | "red" | "neutral";
    if (totalPlan === BigInt(0) && totalIst === BigInt(0)) {
      totalStatus = "neutral";
    } else if (absTotal < 5) {
      totalStatus = "green";
    } else if (absTotal < 15) {
      totalStatus = "yellow";
    } else {
      totalStatus = "red";
    }

    return NextResponse.json({
      success: true,
      available: true,
      data: {
        plan: {
          id: plan.id,
          name: plan.name,
          periodType: plan.periodType,
          periodCount: plan.periodCount,
          planStartDate: plan.planStartDate.toISOString(),
        },
        summary: {
          totalPlan: totalPlan.toString(),
          totalIst: totalIst.toString(),
          totalDeviation: totalDeviation.toString(),
          totalDeviationPercent: Math.round(totalDeviationPercent * 100) / 100,
          totalStatus,
          periodsWithIst: periodResults.filter((p) => p.hasIstData).length,
          periodsTotal: periodResults.length,
        },
        periods: periodResults,
      },
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

/** ISO-Kalenderwoche berechnen */
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
