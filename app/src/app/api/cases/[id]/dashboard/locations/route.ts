import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

type EstateFilter = "GESAMT" | "ALTMASSE" | "NEUMASSE" | "UNKLAR";

/**
 * GET /api/cases/[id]/dashboard/locations
 *
 * Liefert eine Übersicht aller Standorte mit P&L-Daten.
 * Für die IV-Frage: "Kann Velbert alleine weitergeführt werden?"
 *
 * Query-Parameter:
 * - estateFilter: GESAMT | ALTMASSE | NEUMASSE | UNKLAR (Default: GESAMT)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const { id: caseId } = await params;
    const { searchParams } = new URL(request.url);
    const estateFilterParam = searchParams.get("estateFilter") || "GESAMT";
    const estateFilter: EstateFilter = ["GESAMT", "ALTMASSE", "NEUMASSE", "UNKLAR"].includes(estateFilterParam)
      ? (estateFilterParam as EstateFilter)
      : "GESAMT";

    // Verify case exists
    const caseExists = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true },
    });

    if (!caseExists) {
      return NextResponse.json({ error: "Fall nicht gefunden" }, { status: 404 });
    }

    // Get all locations for this case
    const locations = await prisma.location.findMany({
      where: { caseId },
      select: {
        id: true,
        name: true,
        address: true,
      },
    });

    // Build estate filter for query
    const estateWhere: Record<string, unknown> = {};
    if (estateFilter !== "GESAMT") {
      estateWhere.estateAllocation = estateFilter;
    }

    // Get aggregated data per location
    const locationSummaries = await Promise.all(
      locations.map(async (location) => {
        // Get ledger entries for this location, grouped by estateAllocation
        const entries = await prisma.ledgerEntry.groupBy({
          by: ["estateAllocation"],
          where: {
            caseId,
            locationId: location.id,
            reviewStatus: { in: ["CONFIRMED", "ADJUSTED"] },
            ...estateWhere,
          },
          _sum: {
            amountCents: true,
          },
          _count: {
            id: true,
          },
        });

        // Calculate totals
        let totalInflows = BigInt(0);
        let totalOutflows = BigInt(0);
        let totalCount = 0;

        // Estate-specific breakdowns
        const estateBreakdown = {
          ALTMASSE: { inflows: BigInt(0), outflows: BigInt(0), count: 0 },
          NEUMASSE: { inflows: BigInt(0), outflows: BigInt(0), count: 0 },
          UNKLAR: { inflows: BigInt(0), outflows: BigInt(0), count: 0 },
        };

        // Get raw entries to split inflows/outflows per estate
        const rawEntries = await prisma.ledgerEntry.findMany({
          where: {
            caseId,
            locationId: location.id,
            reviewStatus: { in: ["CONFIRMED", "ADJUSTED"] },
            ...estateWhere,
          },
          select: {
            amountCents: true,
            estateAllocation: true,
          },
        });

        for (const entry of rawEntries) {
          const amount = entry.amountCents;
          const estate = entry.estateAllocation as keyof typeof estateBreakdown | null;
          totalCount++;

          if (amount >= BigInt(0)) {
            totalInflows += amount;
            if (estate && estate in estateBreakdown) {
              estateBreakdown[estate].inflows += amount;
              estateBreakdown[estate].count++;
            }
          } else {
            totalOutflows += BigInt(-1) * amount;
            if (estate && estate in estateBreakdown) {
              estateBreakdown[estate].outflows += BigInt(-1) * amount;
              estateBreakdown[estate].count++;
            }
          }
        }

        return {
          id: location.id,
          name: location.name,
          address: location.address,
          inflowsCents: totalInflows.toString(),
          outflowsCents: totalOutflows.toString(),
          netCents: (totalInflows - totalOutflows).toString(),
          entryCount: totalCount,
          isViable: totalInflows > totalOutflows,
          // Estate-Breakdown für detaillierte Analyse
          estateBreakdown: {
            ALTMASSE: {
              inflowsCents: estateBreakdown.ALTMASSE.inflows.toString(),
              outflowsCents: estateBreakdown.ALTMASSE.outflows.toString(),
              netCents: (estateBreakdown.ALTMASSE.inflows - estateBreakdown.ALTMASSE.outflows).toString(),
              count: estateBreakdown.ALTMASSE.count,
              isViable: estateBreakdown.ALTMASSE.inflows > estateBreakdown.ALTMASSE.outflows,
            },
            NEUMASSE: {
              inflowsCents: estateBreakdown.NEUMASSE.inflows.toString(),
              outflowsCents: estateBreakdown.NEUMASSE.outflows.toString(),
              netCents: (estateBreakdown.NEUMASSE.inflows - estateBreakdown.NEUMASSE.outflows).toString(),
              count: estateBreakdown.NEUMASSE.count,
              isViable: estateBreakdown.NEUMASSE.inflows > estateBreakdown.NEUMASSE.outflows,
            },
            UNKLAR: {
              inflowsCents: estateBreakdown.UNKLAR.inflows.toString(),
              outflowsCents: estateBreakdown.UNKLAR.outflows.toString(),
              netCents: (estateBreakdown.UNKLAR.inflows - estateBreakdown.UNKLAR.outflows).toString(),
              count: estateBreakdown.UNKLAR.count,
              isViable: estateBreakdown.UNKLAR.inflows > estateBreakdown.UNKLAR.outflows,
            },
          },
        };
      })
    );

    // Sort by net result descending
    locationSummaries.sort((a, b) =>
      Number(BigInt(b.netCents) - BigInt(a.netCents))
    );

    return NextResponse.json({
      locations: locationSummaries,
      totalLocations: locations.length,
      estateFilter,
    });
  } catch (error) {
    console.error("Error fetching location summary:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Standort-Daten" },
      { status: 500 }
    );
  }
}
