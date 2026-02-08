import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * GET /api/cases/[id]/dashboard/locations/[locationId]
 *
 * Liefert detaillierte P&L-Daten für einen einzelnen Standort.
 * Für die IV-Frage: "Kann Velbert alleine weitergeführt werden?"
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; locationId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const { id: caseId, locationId } = await params;

    // Get location
    const location = await prisma.location.findFirst({
      where: { id: locationId, caseId },
    });

    if (!location) {
      return NextResponse.json({ error: "Standort nicht gefunden" }, { status: 404 });
    }

    // Get all entries for this location, grouped by counterparty
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        caseId,
        locationId,
        reviewStatus: { in: ["CONFIRMED", "ADJUSTED"] },
      },
      include: {
        counterparty: { select: { name: true, type: true } },
      },
      orderBy: { transactionDate: "desc" },
    });

    // Categorize entries by source (KV, HZV, PVS, etc.) for revenues
    // and by type (Personnel, Rent, Utilities, Other) for costs
    const revenues: Record<string, { cents: bigint; entries: typeof entries }> = {
      kv: { cents: BigInt(0), entries: [] },
      hzv: { cents: BigInt(0), entries: [] },
      pvs: { cents: BigInt(0), entries: [] },
      other: { cents: BigInt(0), entries: [] },
    };

    const costs: Record<string, { cents: bigint; entries: typeof entries }> = {
      personnel: { cents: BigInt(0), entries: [] },
      rent: { cents: BigInt(0), entries: [] },
      utilities: { cents: BigInt(0), entries: [] },
      other: { cents: BigInt(0), entries: [] },
    };

    for (const entry of entries) {
      const amount = entry.amountCents;
      const desc = entry.description.toLowerCase();
      const cpType = entry.counterparty?.type?.toLowerCase() || "";
      const cpName = entry.counterparty?.name?.toLowerCase() || "";

      if (amount > BigInt(0)) {
        // Revenue
        if (desc.includes("kv") || cpName.includes("kv") || cpType === "kv") {
          revenues.kv.cents += amount;
          revenues.kv.entries.push(entry);
        } else if (desc.includes("hzv") || cpName.includes("hzv") || desc.includes("hausarzt") || cpType === "hzv") {
          revenues.hzv.cents += amount;
          revenues.hzv.entries.push(entry);
        } else if (desc.includes("pvs") || desc.includes("privat") || cpName.includes("pvs") || cpType === "pvs") {
          revenues.pvs.cents += amount;
          revenues.pvs.entries.push(entry);
        } else {
          revenues.other.cents += amount;
          revenues.other.entries.push(entry);
        }
      } else {
        // Cost (make positive for display)
        const absAmount = -amount;
        if (desc.includes("gehalt") || desc.includes("lohn") || desc.includes("personal") || cpType === "personnel") {
          costs.personnel.cents += absAmount;
          costs.personnel.entries.push(entry);
        } else if (desc.includes("miete") || desc.includes("pacht")) {
          costs.rent.cents += absAmount;
          costs.rent.entries.push(entry);
        } else if (desc.includes("strom") || desc.includes("gas") || desc.includes("heizung") || desc.includes("wasser")) {
          costs.utilities.cents += absAmount;
          costs.utilities.entries.push(entry);
        } else {
          costs.other.cents += absAmount;
          costs.other.entries.push(entry);
        }
      }
    }

    const totalRevenue = Object.values(revenues).reduce((sum, r) => sum + r.cents, BigInt(0));
    const totalCosts = Object.values(costs).reduce((sum, c) => sum + c.cents, BigInt(0));
    const netResult = totalRevenue - totalCosts;

    // Determine period range from entries
    const dates = entries.map((e) => e.transactionDate);
    const periodStart = dates.length > 0
      ? new Date(Math.min(...dates.map((d) => d.getTime())))
      : new Date();
    const periodEnd = dates.length > 0
      ? new Date(Math.max(...dates.map((d) => d.getTime())))
      : new Date();

    return NextResponse.json({
      locationId: location.id,
      locationName: location.name,
      address: location.address,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      entryCount: entries.length,

      revenues: {
        kv: { cents: revenues.kv.cents.toString(), count: revenues.kv.entries.length },
        hzv: { cents: revenues.hzv.cents.toString(), count: revenues.hzv.entries.length },
        pvs: { cents: revenues.pvs.cents.toString(), count: revenues.pvs.entries.length },
        other: { cents: revenues.other.cents.toString(), count: revenues.other.entries.length },
        total: totalRevenue.toString(),
      },

      costs: {
        personnel: { cents: costs.personnel.cents.toString(), count: costs.personnel.entries.length },
        rent: { cents: costs.rent.cents.toString(), count: costs.rent.entries.length },
        utilities: { cents: costs.utilities.cents.toString(), count: costs.utilities.entries.length },
        other: { cents: costs.other.cents.toString(), count: costs.other.entries.length },
        total: totalCosts.toString(),
      },

      netResult: netResult.toString(),
      isViable: netResult >= BigInt(0),

      // TODO: Personnel changes from separate source
      personnelChanges: [],
    });
  } catch (error) {
    console.error("Error fetching location detail:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Standort-Details" },
      { status: 500 }
    );
  }
}
