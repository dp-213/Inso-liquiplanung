import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  COUNTERPARTY_TAG_MAP,
  ADDITIONAL_TAG_COUNTERPARTIES,
  QUARTAL_CHECK_TAGS,
  getExpectedEstateAllocation,
} from "@/lib/cases/haevg-plus/matrix-config";

// =============================================================================
// Types
// =============================================================================

interface CheckItem {
  entryId: string;
  description: string;
  [key: string]: unknown;
}

interface CheckResult {
  id: string;
  title: string;
  severity: "error" | "warning";
  passed: boolean;
  checked: number;
  failed: number;
  skipped: number;
  totalItems: number;
  shownItems: number;
  items: CheckItem[];
  description: string;
}

const MAX_ITEMS = 20;

// =============================================================================
// Quarter-Parsing aus Beschreibung (Fallback)
// =============================================================================

function parseQuarterFromDescription(
  description: string
): { quarter: number; year: number } | null {
  const safeDesc = description.substring(0, 500);

  // RATE 1/2025, ABSCHL 4/2025
  const rateMatch = safeDesc.match(/(?:RATE|ABSCHL)\s+(\d)\/(\d{2,4})/i);
  if (rateMatch) {
    const q = parseInt(rateMatch[1]);
    let y = parseInt(rateMatch[2]);
    if (y < 100) y += 2000;
    if (q >= 1 && q <= 4) return { quarter: q, year: y };
  }

  // Q4/2025, Q1 2025
  const qMatch = safeDesc.match(/Q(\d)\/?[\s]?(\d{4})/i);
  if (qMatch) {
    const q = parseInt(qMatch[1]);
    const y = parseInt(qMatch[2]);
    if (q >= 1 && q <= 4) return { quarter: q, year: y };
  }

  return null;
}

function quarterToDate(quarter: number, year: number): Date {
  const month = (quarter - 1) * 3; // Q1=0, Q2=3, Q3=6, Q4=9
  // UTC um Zeitzonen-Mismatch mit ISO-Strings aus der DB zu vermeiden
  return new Date(Date.UTC(year, month, 1));
}

// =============================================================================
// GET /api/cases/[id]/validate-consistency
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId } = await params;

    // Lade Case mit openingDate
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, openingDate: true, cutoffDate: true },
    });

    if (!caseData) {
      return NextResponse.json({ error: "Fall nicht gefunden" }, { status: 404 });
    }

    // Lade alle IST-LedgerEntries für diesen Fall
    const entries = await prisma.ledgerEntry.findMany({
      where: { caseId, valueType: "IST" },
      select: {
        id: true,
        description: true,
        counterpartyId: true,
        categoryTag: true,
        estateAllocation: true,
        estateRatio: true,
        locationId: true,
        bankAccountId: true,
        serviceDate: true,
        servicePeriodStart: true,
        servicePeriodEnd: true,
        transferPartnerEntryId: true,
      },
    });

    // Lade Counterparties für Pattern-Check
    const counterparties = await prisma.counterparty.findMany({
      where: { caseId },
      select: { id: true, name: true, matchPattern: true },
    });

    const counterpartyMap = new Map(counterparties.map(cp => [cp.id, cp]));

    // Invertierung: TAG → erwartete CounterpartyIds (inkl. ADDITIONAL_TAG_COUNTERPARTIES)
    const tagCounterpartyMap: Record<string, string[]> = {};
    for (const [cpId, tag] of Object.entries(COUNTERPARTY_TAG_MAP)) {
      if (!tagCounterpartyMap[tag]) tagCounterpartyMap[tag] = [];
      tagCounterpartyMap[tag].push(cpId);
    }
    for (const [tag, cpIds] of Object.entries(ADDITIONAL_TAG_COUNTERPARTIES)) {
      if (!tagCounterpartyMap[tag]) tagCounterpartyMap[tag] = [];
      tagCounterpartyMap[tag].push(...cpIds);
    }

    // =======================================================================
    // Check 1: counterpartyId ↔ categoryTag
    // =======================================================================
    const check1Items: CheckItem[] = [];
    const cpTagKeys = Object.keys(COUNTERPARTY_TAG_MAP);
    const check1Entries = entries.filter(e => e.counterpartyId && cpTagKeys.includes(e.counterpartyId));

    for (const entry of check1Entries) {
      const expectedTag = COUNTERPARTY_TAG_MAP[entry.counterpartyId!];
      if (entry.categoryTag !== expectedTag) {
        check1Items.push({
          entryId: entry.id,
          description: entry.description.substring(0, 200),
          counterpartyId: entry.counterpartyId!,
          expectedTag,
          actualTag: entry.categoryTag || "(leer)",
        });
      }
    }

    const check1: CheckResult = {
      id: "counterpartyTagConsistency",
      title: "Gegenpartei ↔ Kategorie-Tag",
      severity: "error",
      passed: check1Items.length === 0,
      checked: check1Entries.length,
      failed: check1Items.length,
      skipped: 0,
      totalItems: check1Items.length,
      shownItems: Math.min(check1Items.length, MAX_ITEMS),
      items: check1Items.slice(0, MAX_ITEMS),
      description: "Prüft ob Buchungen mit bekannter Gegenpartei den erwarteten Kategorie-Tag haben.",
    };

    // =======================================================================
    // Check 2: categoryTag ohne passenden counterpartyId
    // =======================================================================
    const check2Items: CheckItem[] = [];
    const relevantTags = Object.keys(tagCounterpartyMap);
    const check2Entries = entries.filter(
      e => e.categoryTag && relevantTags.includes(e.categoryTag)
    );

    for (const entry of check2Entries) {
      const expectedCps = tagCounterpartyMap[entry.categoryTag!];
      if (!entry.counterpartyId || !expectedCps.includes(entry.counterpartyId)) {
        check2Items.push({
          entryId: entry.id,
          description: entry.description.substring(0, 200),
          categoryTag: entry.categoryTag!,
          actualCounterpartyId: entry.counterpartyId || "(leer)",
        });
      }
    }

    const check2: CheckResult = {
      id: "tagWithoutCounterparty",
      title: "Kategorie-Tag ohne passende Gegenpartei",
      severity: "warning",
      passed: check2Items.length === 0,
      checked: check2Entries.length,
      failed: check2Items.length,
      skipped: 0,
      totalItems: check2Items.length,
      shownItems: Math.min(check2Items.length, MAX_ITEMS),
      items: check2Items.slice(0, MAX_ITEMS),
      description: "Prüft ob Buchungen mit Kategorie-Tag (KV/HZV/PVS) auch die passende Gegenpartei zugewiesen haben.",
    };

    // =======================================================================
    // Check 3: estateAllocation ↔ Leistungszeitraum (nur KV)
    // =======================================================================
    const openingDate = caseData.openingDate
      ? new Date(caseData.openingDate)
      : caseData.cutoffDate
        ? new Date(caseData.cutoffDate)
        : null;

    const check3Items: CheckItem[] = [];
    let check3Skipped = 0;
    const check3Entries = entries.filter(
      e => e.categoryTag && QUARTAL_CHECK_TAGS.includes(e.categoryTag) && e.estateAllocation
    );

    if (!openingDate) {
      // Kein Eröffnungsdatum → alle als übersprungen zählen
      check3Skipped = check3Entries.length;
    }

    if (openingDate) {
      for (const entry of check3Entries) {
        // Priorität: servicePeriodStart > serviceDate > Beschreibung
        let servicePeriod: Date | null = null;
        let source: "field" | "description" | "skipped" = "skipped";

        if (entry.servicePeriodStart) {
          servicePeriod = new Date(entry.servicePeriodStart);
          source = "field";
        } else if (entry.serviceDate) {
          servicePeriod = new Date(entry.serviceDate);
          source = "field";
        } else {
          const parsed = parseQuarterFromDescription(entry.description);
          if (parsed) {
            servicePeriod = quarterToDate(parsed.quarter, parsed.year);
            source = "description";
          }
        }

        if (!servicePeriod) {
          check3Skipped++;
          continue;
        }

        const expected = getExpectedEstateAllocation(servicePeriod, openingDate);

        // Bei MIXED: Nur prüfen ob Status MIXED ist
        if (expected.expectedAllocation === "MIXED") {
          if (entry.estateAllocation !== "MIXED") {
            check3Items.push({
              entryId: entry.id,
              description: entry.description.substring(0, 200),
              expectedAllocation: "MIXED",
              actualAllocation: entry.estateAllocation!,
              actualRatio: entry.estateRatio ? Number(entry.estateRatio) : null,
              source,
            });
          }
        } else {
          // ALTMASSE oder NEUMASSE: Exakter Vergleich
          if (entry.estateAllocation !== expected.expectedAllocation) {
            check3Items.push({
              entryId: entry.id,
              description: entry.description.substring(0, 200),
              expectedAllocation: expected.expectedAllocation,
              actualAllocation: entry.estateAllocation!,
              actualRatio: entry.estateRatio ? Number(entry.estateRatio) : null,
              source,
            });
          }
        }
      }
    }

    const check3: CheckResult = {
      id: "estateAllocationQuarter",
      title: "estateAllocation ↔ Leistungszeitraum",
      severity: "error",
      passed: check3Items.length === 0,
      checked: check3Entries.length - check3Skipped,
      failed: check3Items.length,
      skipped: check3Skipped,
      totalItems: check3Items.length,
      shownItems: Math.min(check3Items.length, MAX_ITEMS),
      items: check3Items.slice(0, MAX_ITEMS),
      description: openingDate
        ? "Prüft ob die Alt/Neu-Zuordnung zum Leistungszeitraum passt (nur KV-Buchungen)."
        : "Übersprungen: Kein Eröffnungsdatum am Fall hinterlegt.",
    };

    // =======================================================================
    // Check 4: Pattern-Match-Validierung
    // =======================================================================
    const check4Items: CheckItem[] = [];
    let check4Skipped = 0;
    const check4Entries = entries.filter(e => e.counterpartyId);

    for (const entry of check4Entries) {
      const cp = counterpartyMap.get(entry.counterpartyId!);
      if (!cp || !cp.matchPattern) {
        check4Skipped++;
        continue;
      }

      try {
        const regex = new RegExp(cp.matchPattern, "i");
        const safeDesc = entry.description.substring(0, 500);
        if (!regex.test(safeDesc)) {
          check4Items.push({
            entryId: entry.id,
            description: entry.description.substring(0, 200),
            counterpartyName: cp.name,
            matchPattern: cp.matchPattern,
          });
        }
      } catch {
        // Ungültiges Pattern → überspringen
        check4Skipped++;
      }
    }

    const check4: CheckResult = {
      id: "patternMatchValidation",
      title: "Pattern-Match-Validierung",
      severity: "warning",
      passed: check4Items.length === 0,
      checked: check4Entries.length - check4Skipped,
      failed: check4Items.length,
      skipped: check4Skipped,
      totalItems: check4Items.length,
      shownItems: Math.min(check4Items.length, MAX_ITEMS),
      items: check4Items.slice(0, MAX_ITEMS),
      description: "Prüft ob Buchungstexte zum Pattern der zugewiesenen Gegenpartei passen (manuelle Zuordnung ist legitim).",
    };

    // =======================================================================
    // Check 5: Verwaiste Dimensionen
    // =======================================================================
    const check5Items: CheckItem[] = [];

    // Distinct IDs aus Entries
    const usedLocationIds = new Set<string>();
    const usedBankAccountIds = new Set<string>();
    const usedCounterpartyIds = new Set<string>();

    for (const entry of entries) {
      if (entry.locationId) usedLocationIds.add(entry.locationId);
      if (entry.bankAccountId) usedBankAccountIds.add(entry.bankAccountId);
      if (entry.counterpartyId) usedCounterpartyIds.add(entry.counterpartyId);
    }

    // Prüfe Locations
    if (usedLocationIds.size > 0) {
      const existingLocations = await prisma.location.findMany({
        where: { caseId, id: { in: [...usedLocationIds] } },
        select: { id: true },
      });
      const existingLocationIds = new Set(existingLocations.map(l => l.id));
      for (const locId of usedLocationIds) {
        if (!existingLocationIds.has(locId)) {
          const count = entries.filter(e => e.locationId === locId).length;
          check5Items.push({
            entryId: locId,
            description: `Standort-ID „${locId}" wird von ${count} Buchungen referenziert, existiert aber nicht.`,
            dimension: "locationId",
            orphanedId: locId,
            usedByCount: count,
          });
        }
      }
    }

    // Prüfe BankAccounts
    if (usedBankAccountIds.size > 0) {
      const existingBankAccounts = await prisma.bankAccount.findMany({
        where: { caseId, id: { in: [...usedBankAccountIds] } },
        select: { id: true },
      });
      const existingBaIds = new Set(existingBankAccounts.map(b => b.id));
      for (const baId of usedBankAccountIds) {
        if (!existingBaIds.has(baId)) {
          const count = entries.filter(e => e.bankAccountId === baId).length;
          check5Items.push({
            entryId: baId,
            description: `Bankkonto-ID „${baId}" wird von ${count} Buchungen referenziert, existiert aber nicht.`,
            dimension: "bankAccountId",
            orphanedId: baId,
            usedByCount: count,
          });
        }
      }
    }

    // Prüfe Counterparties (nutze bereits geladene counterpartyMap)
    for (const cpId of usedCounterpartyIds) {
      if (!counterpartyMap.has(cpId)) {
        const count = entries.filter(e => e.counterpartyId === cpId).length;
        check5Items.push({
          entryId: cpId,
          description: `Gegenpartei-ID „${cpId}" wird von ${count} Buchungen referenziert, existiert aber nicht.`,
          dimension: "counterpartyId",
          orphanedId: cpId,
          usedByCount: count,
        });
      }
    }

    const check5: CheckResult = {
      id: "orphanedDimensions",
      title: "Verwaiste Dimensionen",
      severity: "error",
      passed: check5Items.length === 0,
      checked: usedLocationIds.size + usedBankAccountIds.size + usedCounterpartyIds.size,
      failed: check5Items.length,
      skipped: 0,
      totalItems: check5Items.length,
      shownItems: Math.min(check5Items.length, MAX_ITEMS),
      items: check5Items.slice(0, MAX_ITEMS),
      description: "Prüft ob alle referenzierten Standorte, Bankkonten und Gegenparteien in den Stammdaten existieren.",
    };

    // =======================================================================
    // Check 6: Gegenparteien ohne Match-Pattern
    // =======================================================================
    const MIN_ENTRIES_FOR_PATTERN = 5;
    const check6Items: CheckItem[] = [];

    // Zähle IST-Entries pro CP (ohne interne Transfers)
    const cpEntryCounts = new Map<string, number>();
    for (const entry of entries) {
      if (entry.counterpartyId && !entry.transferPartnerEntryId) {
        cpEntryCounts.set(entry.counterpartyId, (cpEntryCounts.get(entry.counterpartyId) || 0) + 1);
      }
    }

    // Finde CPs mit >= 5 Entries aber ohne Pattern
    let check6AboveThreshold = 0;
    let check6BelowThreshold = 0;
    for (const [cpId, count] of cpEntryCounts) {
      if (count < MIN_ENTRIES_FOR_PATTERN) {
        check6BelowThreshold++;
        continue;
      }
      check6AboveThreshold++;
      const cp = counterpartyMap.get(cpId);
      if (cp && !cp.matchPattern) {
        check6Items.push({
          entryId: `cp:${cpId}`,
          description: `„${cp.name}" – ${count} Buchungen ohne Match-Pattern`,
          counterpartyName: cp.name,
          counterpartyId: cpId,
          entryCount: count,
        });
      }
    }

    check6Items.sort((a, b) => (b.entryCount as number) - (a.entryCount as number));

    const check6: CheckResult = {
      id: "counterpartiesWithoutPattern",
      title: "Gegenparteien ohne Match-Pattern",
      severity: "warning",
      passed: check6Items.length === 0,
      checked: check6AboveThreshold,
      failed: check6Items.length,
      skipped: check6BelowThreshold,
      totalItems: check6Items.length,
      shownItems: Math.min(check6Items.length, MAX_ITEMS),
      items: check6Items.slice(0, MAX_ITEMS),
      description: `Gegenparteien mit ${MIN_ENTRIES_FOR_PATTERN}+ Buchungen sollten ein Match-Pattern haben (für automatische Validierung).`,
    };

    // =======================================================================
    // Zusammenfassung
    // =======================================================================
    const checks = {
      counterpartyTagConsistency: check1,
      tagWithoutCounterparty: check2,
      estateAllocationQuarter: check3,
      patternMatchValidation: check4,
      orphanedDimensions: check5,
      counterpartiesWithoutPattern: check6,
    };

    const errors = Object.values(checks).filter(c => c.severity === "error" && !c.passed).length;
    const warnings = Object.values(checks).filter(c => c.severity === "warning" && !c.passed).length;
    const passed = Object.values(checks).filter(c => c.passed).length;
    const totalSkipped = Object.values(checks).reduce((sum, c) => sum + c.skipped, 0);

    return NextResponse.json({
      caseId,
      validatedAt: new Date().toISOString(),
      allPassed: errors === 0 && warnings === 0,
      summary: { errors, warnings, passed, skipped: totalSkipped },
      checks,
    });
  } catch (error) {
    console.error("Fehler bei Konsistenzprüfung:", error);
    return NextResponse.json(
      { error: "Interner Fehler bei der Konsistenzprüfung" },
      { status: 500 }
    );
  }
}
