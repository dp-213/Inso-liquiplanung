/**
 * Sanity Check: Alt/Neu-Allokation für HAEVG PLUS eG
 *
 * Testet die Split-Engine mit Beispielbuchungen gemäß Plan.
 *
 * Ausführung:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/sanity-check-allocation.ts
 *
 * Oder als ESM:
 *   npx tsx scripts/sanity-check-allocation.ts
 */

import { Decimal } from "@prisma/client/runtime/library";
import {
  determineEstateAllocation,
  splitAmountByAllocation,
  calculatePeriodProrata,
} from "../src/lib/settlement/split-engine";
import {
  HAEVG_CONFIG,
  HAEVG_SETTLERS,
  getQuarterKey,
  getMonthKey,
} from "../src/lib/cases/haevg-plus/config";
import { AllocationSource, EstateAllocation } from "../src/lib/types/allocation";

// =============================================================================
// TEST DATA: Beispielbuchungen aus dem Plan
// =============================================================================

interface TestEntry {
  id: string;
  datum: string;
  beschreibung: string;
  betragCents: bigint;
  abrechner: "kv" | "hzv" | "pvs";
  bank: "sparkasse" | "apobank";
  serviceDate?: string;
  servicePeriodStart?: string;
  servicePeriodEnd?: string;
  expectedAllocation: string;
  expectedSource: string;
}

const TEST_ENTRIES: TestEntry[] = [
  {
    id: "1",
    datum: "2026-01-15",
    beschreibung: "KV Q4/25 Restzahlung",
    betragCents: BigInt(5000000), // 50.000 €
    abrechner: "kv",
    bank: "sparkasse",
    expectedAllocation: "MIXED (1/3-2/3)",
    expectedSource: "VERTRAGSREGEL",
  },
  {
    id: "2",
    datum: "2025-12-10",
    beschreibung: "HZV November",
    betragCents: BigInt(800000), // 8.000 €
    abrechner: "hzv",
    bank: "sparkasse",
    // HZV: Zahlung für November (nach Stichtag) → NEUMASSE
    expectedAllocation: "NEUMASSE",
    expectedSource: "VORMONAT_LOGIK",
  },
  {
    id: "3",
    datum: "2025-11-20",
    beschreibung: "HZV Oktober",
    betragCents: BigInt(800000), // 8.000 €
    abrechner: "hzv",
    bank: "sparkasse",
    // HZV: Zahlung für Oktober (29/31 vor Stichtag) → MIXED
    expectedAllocation: "MIXED (29/31)",
    expectedSource: "PERIOD_PRORATA",
  },
  {
    id: "4",
    datum: "2025-12-05",
    beschreibung: "PVS Abrechnung ohne serviceDate",
    betragCents: BigInt(350000), // 3.500 €
    abrechner: "pvs",
    bank: "apobank",
    // PVS ohne serviceDate → UNKLAR
    expectedAllocation: "UNKLAR",
    expectedSource: "UNKLAR",
  },
  {
    id: "5",
    datum: "2025-10-15",
    beschreibung: "KV Q3/25 Restzahlung",
    betragCents: BigInt(4500000), // 45.000 €
    abrechner: "kv",
    bank: "sparkasse",
    // Q3 vollständig vor Stichtag → ALTMASSE
    expectedAllocation: "ALTMASSE",
    expectedSource: "VERTRAGSREGEL",
  },
  {
    id: "6",
    datum: "2025-11-28",
    beschreibung: "PVS mit serviceDate",
    betragCents: BigInt(280000), // 2.800 €
    abrechner: "pvs",
    bank: "apobank",
    serviceDate: "2025-10-15", // Leistung vor Stichtag
    expectedAllocation: "ALTMASSE",
    expectedSource: "SERVICE_DATE_RULE",
  },
];

// =============================================================================
// TEST RUNNER
// =============================================================================

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCents(cents: bigint): string {
  const euros = Number(cents) / 100;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(euros);
}

function getPeriodKeyForEntry(entry: TestEntry): string | undefined {
  const transactionDate = new Date(entry.datum);

  if (entry.abrechner === "kv") {
    // Für KV: Q4 2025 bezieht sich auf Zahlungsdatum im Januar 2026
    // Die Zahlung im Januar 2026 ist für Q4 2025
    if (transactionDate >= new Date("2026-01-01") && transactionDate < new Date("2026-04-01")) {
      return "Q4_2025";
    }
    if (transactionDate >= new Date("2025-10-01") && transactionDate < new Date("2026-01-01")) {
      return "Q3_2025";
    }
    return getQuarterKey(transactionDate);
  }

  if (entry.abrechner === "hzv") {
    // Für HZV: Vormonat-Logik - Zahlung im Dezember ist für November
    const serviceMonth = new Date(transactionDate);
    serviceMonth.setMonth(serviceMonth.getMonth() - 1);
    return getMonthKey(serviceMonth);
  }

  return undefined;
}

function runSanityCheck(): void {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("SANITY CHECK: Alt/Neu-Allokation für HAEVG PLUS eG");
  console.log("Stichtag:", formatDate(HAEVG_CONFIG.cutoffDate));
  console.log("═══════════════════════════════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  for (const entry of TEST_ENTRIES) {
    const transactionDate = new Date(entry.datum);
    const serviceDate = entry.serviceDate ? new Date(entry.serviceDate) : undefined;
    const servicePeriodStart = entry.servicePeriodStart ? new Date(entry.servicePeriodStart) : undefined;
    const servicePeriodEnd = entry.servicePeriodEnd ? new Date(entry.servicePeriodEnd) : undefined;

    const counterpartyConfig = HAEVG_SETTLERS[entry.abrechner];
    const periodKey = getPeriodKeyForEntry(entry);

    const result = determineEstateAllocation(
      {
        transactionDate,
        serviceDate: serviceDate ?? null,
        servicePeriodStart: servicePeriodStart ?? null,
        servicePeriodEnd: servicePeriodEnd ?? null,
      },
      counterpartyConfig,
      HAEVG_CONFIG.cutoffDate,
      periodKey
    );

    // Berechne Split-Beträge
    const split = splitAmountByAllocation(entry.betragCents, result);

    // Prüfe Ergebnis
    const allocationMatch =
      entry.expectedAllocation.includes(result.estateAllocation) ||
      (entry.expectedAllocation === "MIXED (1/3-2/3)" && result.estateAllocation === "MIXED") ||
      (entry.expectedAllocation === "MIXED (29/31)" && result.estateAllocation === "MIXED");
    const sourceMatch = result.allocationSource === entry.expectedSource;
    const success = allocationMatch && sourceMatch;

    if (success) {
      passed++;
    } else {
      failed++;
    }

    // Output
    console.log(`─────────────────────────────────────────────────────────────────`);
    console.log(`#${entry.id}: ${entry.beschreibung}`);
    console.log(`   Datum: ${formatDate(transactionDate)} | Betrag: ${formatCents(entry.betragCents)}`);
    console.log(`   Abrechner: ${counterpartyConfig?.name || entry.abrechner} | Bank: ${entry.bank}`);
    if (serviceDate) {
      console.log(`   ServiceDate: ${formatDate(serviceDate)}`);
    }
    console.log(`   PeriodKey: ${periodKey || "-"}`);
    console.log("");
    console.log(`   → Allokation: ${result.estateAllocation}`);
    if (result.estateRatio) {
      console.log(`   → Ratio (Neu): ${result.estateRatio.toString()}`);
    }
    console.log(`   → Quelle: ${result.allocationSource}`);
    console.log(`   → Note: ${result.allocationNote}`);
    console.log(`   → Review nötig: ${result.requiresManualReview ? "JA" : "Nein"}`);
    console.log("");
    console.log(`   Split: Alt ${formatCents(split.altAmountCents)} | Neu ${formatCents(split.neuAmountCents)}`);
    console.log("");
    console.log(`   Erwartet: ${entry.expectedAllocation} / ${entry.expectedSource}`);
    console.log(`   Status: ${success ? "✅ PASSED" : "❌ FAILED"}`);
    if (!allocationMatch) {
      console.log(`      ⚠️ Allokation stimmt nicht überein!`);
    }
    if (!sourceMatch) {
      console.log(`      ⚠️ Quelle stimmt nicht überein!`);
    }
  }

  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`ERGEBNIS: ${passed}/${TEST_ENTRIES.length} Tests bestanden`);
  if (failed > 0) {
    console.log(`⚠️  ${failed} Tests fehlgeschlagen`);
  } else {
    console.log(`✅ Alle Tests bestanden!`);
  }
  console.log(`═══════════════════════════════════════════════════════════════\n`);

  // Ausgabetabelle wie im Plan
  console.log("\n📋 ZUSAMMENFASSUNG (wie im Plan):\n");
  console.log("| # | Datum | Beschreibung | Betrag | Abrechner | Bank | Allokation | Quelle | Note |");
  console.log("|---|-------|--------------|--------|-----------|------|------------|--------|------|");

  for (const entry of TEST_ENTRIES) {
    const transactionDate = new Date(entry.datum);
    const serviceDate = entry.serviceDate ? new Date(entry.serviceDate) : undefined;
    const counterpartyConfig = HAEVG_SETTLERS[entry.abrechner];
    const periodKey = getPeriodKeyForEntry(entry);

    const result = determineEstateAllocation(
      {
        transactionDate,
        serviceDate: serviceDate ?? null,
        servicePeriodStart: null,
        servicePeriodEnd: null,
      },
      counterpartyConfig,
      HAEVG_CONFIG.cutoffDate,
      periodKey
    );

    const allocationDisplay = result.estateRatio
      ? `${result.estateAllocation} (${new Decimal(1).minus(result.estateRatio).toFixed(2)}/${result.estateRatio.toFixed(2)})`
      : result.estateAllocation;

    console.log(
      `| ${entry.id} | ${formatDate(transactionDate)} | ${entry.beschreibung} | ${formatCents(entry.betragCents)} | ${counterpartyConfig?.name || entry.abrechner} | ${entry.bank} | ${allocationDisplay} | ${result.allocationSource} | ${result.allocationNote.substring(0, 40)}... |`
    );
  }
}

// Run
runSanityCheck();
