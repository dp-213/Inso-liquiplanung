/**
 * Import-Script: HVPlus PLAN-Daten
 *
 * Importiert PLAN-Daten aus:
 * - Liquiditätsplanung_HVPlus_20260114_versendet.json
 *
 * WICHTIG - Alt/Neu-Zuordnung für PLAN:
 * - Reguläre Einnahmen (HZV/KV/PVS) → UNKLAR (Leistungsdatum unbekannt)
 * - "Altforderungen" → ALTMASSE (explizit so benannt)
 * - "Insolvenzspezifisch" → NEUMASSE (per Definition nach Insolvenz entstanden)
 * - Kosten → UNKLAR (Leistungsdatum unbekannt)
 *
 * Werte sind in T€ (Tausend Euro) → Umrechnung in Cents: * 1000 * 100
 *
 * Ausführung: npx tsx scripts/import-hvplus-plan.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// =============================================================================
// CONFIGURATION
// =============================================================================

const CASE_NUMBER = '70d IN 362/25'; // Turso Production Case-Nummer
const DRY_RUN = false; // Set to true for preview only

// JSON-Quelldatei (absoluter Pfad zum Cases-Verzeichnis)
const CASES_ROOT = '/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases';
const PLAN_JSON_PATH = `${CASES_ROOT}/Hausärztliche Versorgung PLUS eG/02-extracted/Liquiditätsplanung_HVPlus_20260114_versendet.json`;

// Spalten-Mapping: Index → Monat (0-basiert ab Spalte 3)
// Spalte 0: leer, Spalte 1: Zeilenname, Spalte 2: Summe, Spalte 3: Nov 2025, ...
const MONTH_COLUMNS = [
  { index: 3, date: new Date('2025-11-30') },
  { index: 4, date: new Date('2025-12-31') },
  { index: 5, date: new Date('2026-01-31') },
  { index: 6, date: new Date('2026-02-28') },
  { index: 7, date: new Date('2026-03-31') },
  { index: 8, date: new Date('2026-04-30') },
  { index: 9, date: new Date('2026-05-31') },
  { index: 10, date: new Date('2026-06-30') },
  { index: 11, date: new Date('2026-07-31') },
  { index: 12, date: new Date('2026-08-31') },
];

// =============================================================================
// ZEILEN-MAPPING: Zeilenname → Kategorie + Location + EstateAllocation
// =============================================================================

interface RowMapping {
  category: string;
  locationKey: 'Velbert' | 'Uckerath' | 'Eitorf' | null; // angepasst an Turso Production
  counterpartyKey: 'KVNO' | 'HAVG' | 'PVS' | null;
  // estateAllocation = null wie in Turso Production (alle Werte ignoriert)
  isSubRow: boolean; // "davon"-Zeilen → nur diese importieren, Summenzeilen überspringen
}

// ROW_MAPPING: Vereinfacht für Turso Production (estateAllocation = null)
const ROW_MAPPING: Record<string, RowMapping> = {
  // === EINNAHMEN: Reguläre Umsätze ===
  'davon HZV Uckerath': { category: 'HZV', locationKey: 'Uckerath', counterpartyKey: 'HAVG', isSubRow: true },
  'davon HZV Velbert': { category: 'HZV', locationKey: 'Velbert', counterpartyKey: 'HAVG', isSubRow: true },
  'davon HZV Eitorf': { category: 'HZV', locationKey: 'Eitorf', counterpartyKey: 'HAVG', isSubRow: true },
  'davon KV Uckerath': { category: 'KV', locationKey: 'Uckerath', counterpartyKey: 'KVNO', isSubRow: true },
  'davon KV Velbert': { category: 'KV', locationKey: 'Velbert', counterpartyKey: 'KVNO', isSubRow: true },
  'davon KV Eitorf': { category: 'KV', locationKey: 'Eitorf', counterpartyKey: 'KVNO', isSubRow: true },
  'davon PVS Uckerath': { category: 'PVS', locationKey: 'Uckerath', counterpartyKey: 'PVS', isSubRow: true },
  'davon PVS Velbert': { category: 'PVS', locationKey: 'Velbert', counterpartyKey: 'PVS', isSubRow: true },
  'davon PVS Eitorf': { category: 'PVS', locationKey: 'Eitorf', counterpartyKey: 'PVS', isSubRow: true },

  // === ALTFORDERUNGEN ===
  'davon aus Velbert KVNO': { category: 'ALTFORDERUNG_KV', locationKey: 'Velbert', counterpartyKey: 'KVNO', isSubRow: true },
  'davon aus Velbert PVS': { category: 'ALTFORDERUNG_PVS', locationKey: 'Velbert', counterpartyKey: 'PVS', isSubRow: true },
  'davon aus Velbert HZV': { category: 'ALTFORDERUNG_HZV', locationKey: 'Velbert', counterpartyKey: 'HAVG', isSubRow: true },
  'davon aus Uckerath + Eitorf KVNO': { category: 'ALTFORDERUNG_KV', locationKey: 'Uckerath', counterpartyKey: 'KVNO', isSubRow: true },
  'davon aus Uckerath + Eitorf PVS': { category: 'ALTFORDERUNG_PVS', locationKey: 'Uckerath', counterpartyKey: 'PVS', isSubRow: true },
  'davon aus Uckerath + Eitorf HZV': { category: 'ALTFORDERUNG_HZV', locationKey: 'Uckerath', counterpartyKey: 'HAVG', isSubRow: true },

  // === INSOLVENZSPEZIFISCH ===
  'insolvenzspezifische Einzahlungen': { category: 'INSO_EINZAHLUNG', locationKey: null, counterpartyKey: null, isSubRow: false },
  'insolvenzspezifische Auszahlungen': { category: 'INSO_AUSZAHLUNG', locationKey: null, counterpartyKey: null, isSubRow: false },
  'davon Rückzahlung Insolvenzgeld Okt 25': { category: 'INSO_RUECKZAHLUNG', locationKey: null, counterpartyKey: null, isSubRow: true },
  'davon Vorfinanzierung Insolvenzgeld': { category: 'INSO_VORFINANZIERUNG', locationKey: null, counterpartyKey: null, isSubRow: true },
  'davon Sachaufnahme': { category: 'INSO_SACHAUFNAHME', locationKey: null, counterpartyKey: null, isSubRow: true },

  // === KOSTEN ===
  'Personalaufwand': { category: 'PERSONAL', locationKey: null, counterpartyKey: null, isSubRow: false },
  'davon Betriebskosten Velbert': { category: 'BETRIEBSKOSTEN', locationKey: 'Velbert', counterpartyKey: null, isSubRow: true },
  'davon Betriebskosten Uckerath': { category: 'BETRIEBSKOSTEN', locationKey: 'Uckerath', counterpartyKey: null, isSubRow: true },
  'davon Betriebskosten Eitorf': { category: 'BETRIEBSKOSTEN', locationKey: 'Eitorf', counterpartyKey: null, isSubRow: true },
};

// Zeilen die NICHT importiert werden (Summenzeilen, Header)
const SKIP_ROWS = [
  'Umsatz',
  'Altforderungen',
  'Summe Einzahlungen',
  'Betriebliche Auszahlungen',
  'Liquiditätsplanung HVPlus per 03.11.2025 | in T€',
  'T€',
];

// =============================================================================
// MAIN IMPORT FUNCTION
// =============================================================================

async function importPlanData() {
  console.log('='.repeat(60));
  console.log('IMPORT: HVPlus PLAN-Daten');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log('='.repeat(60));

  // 1. Load JSON
  const jsonPath = PLAN_JSON_PATH; // Absoluter Pfad
  console.log(`\n1. Lade JSON: ${jsonPath}`);

  if (!fs.existsSync(jsonPath)) {
    console.error(`   FEHLER: Datei nicht gefunden: ${jsonPath}`);
    process.exit(1);
  }

  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const sheet = jsonData.sheets['Tabelle_Monat_HVPlus'];

  if (!sheet) {
    console.error('   FEHLER: Sheet "Tabelle_Monat_HVPlus" nicht gefunden');
    process.exit(1);
  }
  console.log(`   Zeilen: ${sheet.preview_rows.length}`);

  // 2. Find Case
  console.log('\n2. Suche Case...');
  const hvplusCase = await prisma.case.findFirst({
    where: { caseNumber: CASE_NUMBER },
    include: {
      locations: true,
      counterparties: true,
    },
  });

  if (!hvplusCase) {
    console.error(`   FEHLER: Case ${CASE_NUMBER} nicht gefunden. Bitte zuerst seed-hvplus.ts ausführen.`);
    process.exit(1);
  }
  console.log(`   Case: ${hvplusCase.debtorName} (${hvplusCase.id})`);

  // Build lookup maps
  const locationMap: Record<string, string> = {};
  for (const loc of hvplusCase.locations) {
    if (loc.shortName) {
      locationMap[loc.shortName] = loc.id;
    }
  }

  const counterpartyMap: Record<string, string> = {};
  for (const cp of hvplusCase.counterparties) {
    if (cp.isTopPayer && cp.shortName) {
      counterpartyMap[cp.shortName] = cp.id;
    }
  }

  console.log(`   Locations: ${Object.keys(locationMap).join(', ')}`);
  console.log(`   Counterparties: ${Object.keys(counterpartyMap).join(', ')}`);

  // 3. Check for existing entries
  console.log('\n3. Prüfe existierende Einträge...');
  const existingCount = await prisma.ledgerEntry.count({
    where: {
      caseId: hvplusCase.id,
      importSource: { contains: 'Liquiditätsplanung 20260114' },
    },
  });

  if (existingCount > 0) {
    console.log(`   ⚠️  ${existingCount} Einträge mit dieser Quelle existieren bereits.`);
    console.log('   Überspringe Import um Duplikate zu vermeiden.');
    console.log('   Zum erneuten Import: DELETE FROM ledger_entries WHERE importSource LIKE "%Liquiditätsplanung 20260114%"');
    process.exit(0);
  }

  // 4. Process rows
  console.log('\n4. Verarbeite Zeilen...');

  const stats = {
    rowsProcessed: 0,
    rowsSkipped: 0,
    rowsUnmapped: 0,
    entriesCreated: 0,
    zeroValuesSkipped: 0,
    byCategory: {} as Record<string, number>,
  };

  const rows = sheet.preview_rows as unknown[][];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const rowName = String(row[1] || '').trim();

    // Skip empty or header rows
    if (!rowName || SKIP_ROWS.includes(rowName)) {
      stats.rowsSkipped++;
      continue;
    }

    // Check if we have a mapping for this row
    const mapping = ROW_MAPPING[rowName];
    if (!mapping) {
      if (rowName && !rowName.startsWith('Summe')) {
        stats.rowsUnmapped++;
        console.log(`   ⚠️  Keine Zuordnung für: "${rowName}"`);
      }
      continue;
    }

    stats.rowsProcessed++;

    // Process each month column
    for (const month of MONTH_COLUMNS) {
      const valueRaw = row[month.index];
      const valueNum = parseFloat(String(valueRaw || '0').replace(',', '.'));

      // Skip zero values
      if (valueNum === 0 || isNaN(valueNum)) {
        stats.zeroValuesSkipped++;
        continue;
      }

      // Convert T€ to cents: * 1000 (T€ → €) * 100 (€ → cents)
      const amountCents = Math.round(valueNum * 1000 * 100);

      // Resolve location and counterparty IDs
      const locationId = mapping.locationKey ? locationMap[mapping.locationKey] || null : null;
      const counterpartyId = mapping.counterpartyKey ? counterpartyMap[mapping.counterpartyKey] || null : null;

      // Track stats (estateAllocation = null wie in Turso Production)
      stats.byCategory[mapping.category] = (stats.byCategory[mapping.category] || 0) + 1;

      if (DRY_RUN) {
        if (stats.entriesCreated < 10) {
          console.log(
            `   [PREVIEW] ${month.date.toISOString().slice(0, 10)} | ` +
              `${(valueNum * 1000).toFixed(0).padStart(10)} € | ` +
              `${mapping.category.padEnd(20)} | ` +
              `${mapping.locationKey || '-'}`
          );
        }
        stats.entriesCreated++;
      } else {
        // Create LedgerEntry (estateAllocation = null wie Turso Production)
        await prisma.ledgerEntry.create({
          data: {
            caseId: hvplusCase.id,
            transactionDate: month.date,
            amountCents: BigInt(amountCents),
            description: `PLAN: ${rowName}`,
            valueType: 'PLAN',
            legalBucket: 'MASSE',
            locationId,
            counterpartyId,
            estateAllocation: null, // Turso Production = null
            estateRatio: null,
            allocationSource: null,
            allocationNote: null,
            importSource: 'Liquiditätsplanung 20260114',
            importRowNumber: rowIndex + 1,
            reviewStatus: 'CONFIRMED', // PLAN-Daten sind bereits geprüft
            createdBy: 'import-hvplus-plan',
          },
        });
        stats.entriesCreated++;
      }
    }
  }

  // 5. Summary
  console.log('\n' + '='.repeat(60));
  console.log('IMPORT ABGESCHLOSSEN');
  console.log('='.repeat(60));
  console.log(`
Zeilen verarbeitet:     ${stats.rowsProcessed}
Zeilen übersprungen:    ${stats.rowsSkipped}
Zeilen ohne Mapping:    ${stats.rowsUnmapped}
Null-Werte übersprungen: ${stats.zeroValuesSkipped}

Einträge erstellt:      ${stats.entriesCreated}
(estateAllocation = null wie Turso Production)

Nach Kategorie:
${Object.entries(stats.byCategory)
  .map(([cat, count]) => `  ${cat.padEnd(20)}: ${count}`)
  .join('\n')}
`);
}

// =============================================================================
// EXECUTE
// =============================================================================

importPlanData()
  .catch((e) => {
    console.error('Import failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
