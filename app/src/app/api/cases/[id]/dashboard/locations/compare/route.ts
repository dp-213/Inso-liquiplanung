import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { EXCLUDE_SPLIT_PARENTS } from "@/lib/ledger/types";

type EstateFilter = "GESAMT" | "NEUMASSE" | "ALTMASSE";
type Perspective = "POST" | "PRE";

// CategoryTag → Einnahmen-Kategorie
const REVENUE_TAG_MAP: Record<string, "kv" | "hzv" | "pvs"> = {
  KV: "kv",
  ALTFORDERUNG_KV: "kv",
  HZV: "hzv",
  ALTFORDERUNG_HZV: "hzv",
  PVS: "pvs",
  ALTFORDERUNG_PVS: "pvs",
};

// CategoryTag → Kosten-Kategorie
const COST_TAG_MAP: Record<string, "personal" | "betriebskosten"> = {
  PERSONAL: "personal",
  SOZIALABGABEN: "personal",
  BETRIEBSKOSTEN: "betriebskosten",
};

function getYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function computeCoverageBps(revenueCents: bigint, costsCents: bigint): number {
  if (costsCents === 0n) return revenueCents > 0n ? 10000 : 0;
  return Number((revenueCents * 10000n) / costsCents);
}

function emptyRevenue() {
  return { kv: 0n, hzv: 0n, pvs: 0n, other: 0n };
}

function emptyCosts() {
  return { personal: 0n, betriebskosten: 0n, other: 0n };
}

function serializeRevenue(r: ReturnType<typeof emptyRevenue>) {
  return {
    kv: r.kv.toString(),
    hzv: r.hzv.toString(),
    pvs: r.pvs.toString(),
    other: r.other.toString(),
  };
}

function serializeCosts(c: ReturnType<typeof emptyCosts>) {
  return {
    personal: c.personal.toString(),
    betriebskosten: c.betriebskosten.toString(),
    other: c.other.toString(),
  };
}

/**
 * GET /api/cases/[id]/dashboard/locations/compare
 *
 * Standort-Vergleichsdaten mit monatlicher Aufschlüsselung.
 * Für die IV-Kernfrage: "Fortführung welcher Standorte ist wirtschaftlich vertretbar?"
 *
 * Query-Parameter:
 * - estateFilter: GESAMT | NEUMASSE | ALTMASSE (Default: NEUMASSE)
 * - perspective: POST | PRE (Default: POST)
 *   POST = ISK-Konten (post-insolvency), Estate-Filter aktiv
 *   PRE  = Geschäftskonten (pre-insolvency), Estate-Filter ignoriert (GESAMT)
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
    const estateFilterParam = searchParams.get("estateFilter") || "NEUMASSE";
    const estateFilter: EstateFilter = ["GESAMT", "NEUMASSE", "ALTMASSE"].includes(estateFilterParam)
      ? (estateFilterParam as EstateFilter)
      : "NEUMASSE";

    const perspectiveParam = searchParams.get("perspective") || "POST";
    const perspective: Perspective = perspectiveParam === "PRE" ? "PRE" : "POST";

    // Verify case exists
    const caseExists = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true },
    });
    if (!caseExists) {
      return NextResponse.json({ error: "Fall nicht gefunden" }, { status: 404 });
    }

    // Load bank accounts and determine which types exist
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { caseId },
      select: { id: true, accountType: true },
    });

    const iskAccountIds = bankAccounts.filter((ba) => ba.accountType === "ISK").map((ba) => ba.id);
    const geschaeftAccountIds = bankAccounts.filter((ba) => ba.accountType === "GESCHAEFT").map((ba) => ba.id);

    const meta = {
      hasIskAccounts: iskAccountIds.length > 0,
      hasGeschaeftskonten: geschaeftAccountIds.length > 0,
    };

    // Get all locations
    const locations = await prisma.location.findMany({
      where: { caseId },
      select: { id: true, name: true, shortName: true, displayOrder: true },
      orderBy: { displayOrder: "asc" },
    });

    // Build WHERE clause based on perspective
    // POST: ISK accounts OR no bankAccount (null = operativ)
    // PRE:  Geschäftskonten only (strict, null excluded)
    const bankAccountWhere: Record<string, unknown> = {};
    if (perspective === "POST") {
      if (iskAccountIds.length > 0) {
        bankAccountWhere.OR = [
          { bankAccountId: { in: iskAccountIds } },
          { bankAccountId: null },
        ];
      }
      // If no ISK accounts, don't filter by bankAccount (show all including null)
    } else {
      // PRE: strict Geschäftskonten only
      if (geschaeftAccountIds.length > 0) {
        bankAccountWhere.bankAccountId = { in: geschaeftAccountIds };
      } else {
        // No Geschäftskonten → return empty
        return NextResponse.json({
          locations: [],
          unassigned: { count: 0, totalCents: "0" },
          monthLabels: [],
          estateFilter,
          perspective,
          meta,
        });
      }
    }

    // Estate filter: only active for POST perspective
    const estateWhere: Record<string, unknown> = {};
    if (perspective === "POST" && estateFilter !== "GESAMT") {
      estateWhere.estateAllocation = estateFilter;
    }

    // Fetch entries (NEUTRAL = Auskehrungen/interne Überträge ausschließen)
    const allEntries = await prisma.ledgerEntry.findMany({
      where: {
        caseId,
        valueType: "IST",
        legalBucket: { not: "NEUTRAL" },
        ...EXCLUDE_SPLIT_PARENTS,
        reviewStatus: { in: ["CONFIRMED", "ADJUSTED"] },
        ...estateWhere,
        ...bankAccountWhere,
      },
      select: {
        amountCents: true,
        transactionDate: true,
        locationId: true,
        categoryTag: true,
      },
    });

    // Partition: assigned vs unassigned (no locationId)
    const assignedEntries = allEntries.filter((e) => e.locationId !== null);
    const unassignedEntries = allEntries.filter((e) => e.locationId === null);

    // Collect all months
    const monthSet = new Set<string>();

    // Build per-location accumulator
    type LocAcc = {
      totalRevenue: ReturnType<typeof emptyRevenue>;
      totalCosts: ReturnType<typeof emptyCosts>;
      entryCount: number;
      months: Map<string, { revenue: ReturnType<typeof emptyRevenue>; costs: ReturnType<typeof emptyCosts> }>;
    };

    const locAccMap = new Map<string, LocAcc>();
    for (const loc of locations) {
      locAccMap.set(loc.id, {
        totalRevenue: emptyRevenue(),
        totalCosts: emptyCosts(),
        entryCount: 0,
        months: new Map(),
      });
    }

    // Classify and accumulate entries
    for (const entry of assignedEntries) {
      const acc = locAccMap.get(entry.locationId!);
      if (!acc) continue; // location not found (shouldn't happen)

      acc.entryCount++;
      const amount = entry.amountCents;
      const tag = entry.categoryTag;
      const ym = getYearMonth(new Date(entry.transactionDate));
      monthSet.add(ym);

      // Get or create month bucket
      if (!acc.months.has(ym)) {
        acc.months.set(ym, { revenue: emptyRevenue(), costs: emptyCosts() });
      }
      const monthBucket = acc.months.get(ym)!;

      if (amount >= 0n) {
        // Revenue
        const revCat = tag ? REVENUE_TAG_MAP[tag] : undefined;
        const key = revCat || "other";
        acc.totalRevenue[key] += amount;
        monthBucket.revenue[key] += amount;
      } else {
        // Cost (store as positive)
        const absAmount = -amount;
        const costCat = tag ? COST_TAG_MAP[tag] : undefined;
        const key = costCat || "other";
        acc.totalCosts[key] += absAmount;
        monthBucket.costs[key] += absAmount;
      }
    }

    // Get employee counts per location
    const employees = await prisma.employee.findMany({
      where: { caseId, isActive: true },
      select: { locationId: true, role: true },
    });

    const employeeMap = new Map<string, { total: number; doctors: number }>();
    for (const emp of employees) {
      if (!emp.locationId) continue;
      if (!employeeMap.has(emp.locationId)) {
        employeeMap.set(emp.locationId, { total: 0, doctors: 0 });
      }
      const ec = employeeMap.get(emp.locationId)!;
      ec.total++;
      const role = (emp.role || "").toLowerCase();
      if (role.includes("arzt") || role.includes("ärztin") || role === "arzt in wb") {
        ec.doctors++;
      }
    }

    // Sort months chronologically
    const monthLabels = Array.from(monthSet).sort();

    // Build response
    const locationResults = locations.map((loc) => {
      const acc = locAccMap.get(loc.id)!;
      const rev = acc.totalRevenue;
      const costs = acc.totalCosts;
      const totalRev = rev.kv + rev.hzv + rev.pvs + rev.other;
      const totalCost = costs.personal + costs.betriebskosten + costs.other;
      const net = totalRev - totalCost;
      const coverageBps = computeCoverageBps(totalRev, totalCost);
      const empData = employeeMap.get(loc.id) || { total: 0, doctors: 0 };

      // Build monthly data
      const months: Record<string, unknown> = {};
      for (const ym of monthLabels) {
        const mb = acc.months.get(ym);
        if (mb) {
          const mRev = mb.revenue.kv + mb.revenue.hzv + mb.revenue.pvs + mb.revenue.other;
          const mCost = mb.costs.personal + mb.costs.betriebskosten + mb.costs.other;
          months[ym] = {
            revenueCents: mRev.toString(),
            costsCents: mCost.toString(),
            netCents: (mRev - mCost).toString(),
            coverageBps: computeCoverageBps(mRev, mCost),
            revenue: serializeRevenue(mb.revenue),
            costs: serializeCosts(mb.costs),
          };
        } else {
          months[ym] = {
            revenueCents: "0",
            costsCents: "0",
            netCents: "0",
            coverageBps: 0,
            revenue: serializeRevenue(emptyRevenue()),
            costs: serializeCosts(emptyCosts()),
          };
        }
      }

      return {
        id: loc.id,
        name: loc.name,
        shortName: loc.shortName,
        totals: {
          revenueCents: totalRev.toString(),
          costsCents: totalCost.toString(),
          netCents: net.toString(),
          coverageBps,
          entryCount: acc.entryCount,
        },
        revenue: serializeRevenue(rev),
        costs: serializeCosts(costs),
        months,
        employees: empData,
      };
    });

    // Unassigned entries summary
    let unassignedTotal = 0n;
    for (const e of unassignedEntries) {
      unassignedTotal += e.amountCents;
    }

    return NextResponse.json({
      locations: locationResults,
      unassigned: {
        count: unassignedEntries.length,
        totalCents: unassignedTotal.toString(),
      },
      monthLabels,
      estateFilter,
      perspective,
      meta,
    });
  } catch (error) {
    console.error("Error fetching location compare data:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Standort-Vergleichsdaten" },
      { status: 500 }
    );
  }
}
