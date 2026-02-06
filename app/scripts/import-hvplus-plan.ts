/**
 * Import-Script: HVPlus PLAN-Daten (überarbeitet)
 *
 * Importiert PLAN-Daten aus:
 * - Liquiditätsplanung_HVPlus_20260114_versendet.json
 *
 * Korrekturen gegenüber alter Version:
 * 1. Doppelzählung behoben: "insolvenzspezifische Auszahlungen" (Summenzeile)
 *    wird NICHT mehr importiert → nur deren "davon"-Detailzeilen
 * 2. estateAllocation korrekt gesetzt (NEUMASSE/ALTMASSE statt null)
 * 3. allocationSource + allocationNote für Audit-Trail
 * 4. reviewStatus = UNREVIEWED (statt CONFIRMED)
 *
 * Werte sind in T€ (Tausend Euro) → Umrechnung in Cents: * 1000 * 100
 *
 * Ausführung: cd app && npx tsx scripts/import-hvplus-plan.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

// =============================================================================
// CONFIGURATION
// =============================================================================

const CASE_NUMBER = '70d IN 362/25';
const DRY_RUN = false; // Set to true for preview only

// JSON-Quelldatei
const CASES_ROOT = '/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases';
const PLAN_JSON_PATH = `${CASES_ROOT}/Hausärztliche Versorgung PLUS eG/03-classified/PLAN/Liquiditätsplanung_HVPlus_20260114_versendet.json`;

// Spalten-Mapping: Index → Monat (0-basiert)
// Spalte 0: leer, Spalte 1: Zeilenname, Spalte 2: Summe, Spalte 3+: Monate
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
  locationKey: 'Velbert' | 'Uckerath' | 'Eitorf' | null;
  counterpartyKey: 'KV' | 'HZV' | 'PVS' | null;
  estateAllocation: 'NEUMASSE' | 'ALTMASSE';
  allocationSource: string;
  allocationNote: string;
}

const ROW_MAPPING: Record<string, RowMapping> = {
  // === NEUMASSE-EINNAHMEN: Umsatz aus Fortführungsbetrieb (9 Zeilen) ===
  'davon HZV Uckerath': {
    category: 'HZV', locationKey: 'Uckerath', counterpartyKey: 'HZV',
    estateAllocation: 'NEUMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Neumasse: Umsatz aus Fortführungsbetrieb nach Insolvenz',
  },
  'davon HZV Velbert': {
    category: 'HZV', locationKey: 'Velbert', counterpartyKey: 'HZV',
    estateAllocation: 'NEUMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Neumasse: Umsatz aus Fortführungsbetrieb nach Insolvenz',
  },
  'davon HZV Eitorf': {
    category: 'HZV', locationKey: 'Eitorf', counterpartyKey: 'HZV',
    estateAllocation: 'NEUMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Neumasse: Umsatz aus Fortführungsbetrieb nach Insolvenz',
  },
  'davon KV Uckerath': {
    category: 'KV', locationKey: 'Uckerath', counterpartyKey: 'KV',
    estateAllocation: 'NEUMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Neumasse: Umsatz aus Fortführungsbetrieb nach Insolvenz',
  },
  'davon KV Velbert': {
    category: 'KV', locationKey: 'Velbert', counterpartyKey: 'KV',
    estateAllocation: 'NEUMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Neumasse: Umsatz aus Fortführungsbetrieb nach Insolvenz',
  },
  'davon KV Eitorf': {
    category: 'KV', locationKey: 'Eitorf', counterpartyKey: 'KV',
    estateAllocation: 'NEUMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Neumasse: Umsatz aus Fortführungsbetrieb nach Insolvenz',
  },
  'davon PVS Uckerath': {
    category: 'PVS', locationKey: 'Uckerath', counterpartyKey: 'PVS',
    estateAllocation: 'NEUMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Neumasse: Umsatz aus Fortführungsbetrieb nach Insolvenz',
  },
  'davon PVS Velbert': {
    category: 'PVS', locationKey: 'Velbert', counterpartyKey: 'PVS',
    estateAllocation: 'NEUMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Neumasse: Umsatz aus Fortführungsbetrieb nach Insolvenz',
  },
  'davon PVS Eitorf': {
    category: 'PVS', locationKey: 'Eitorf', counterpartyKey: 'PVS',
    estateAllocation: 'NEUMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Neumasse: Umsatz aus Fortführungsbetrieb nach Insolvenz',
  },

  // === ALTMASSE-EINNAHMEN: Forderungen aus Leistung vor 29.10.2025 (6 Zeilen) ===
  'davon aus Velbert KVNO': {
    category: 'ALTFORDERUNG_KV', locationKey: 'Velbert', counterpartyKey: 'KV',
    estateAllocation: 'ALTMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Altmasse: Forderung aus Leistung vor 29.10.2025',
  },
  'davon aus Velbert PVS': {
    category: 'ALTFORDERUNG_PVS', locationKey: 'Velbert', counterpartyKey: 'PVS',
    estateAllocation: 'ALTMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Altmasse: Forderung aus Leistung vor 29.10.2025',
  },
  'davon aus Velbert HZV': {
    category: 'ALTFORDERUNG_HZV', locationKey: 'Velbert', counterpartyKey: 'HZV',
    estateAllocation: 'ALTMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Altmasse: Forderung aus Leistung vor 29.10.2025',
  },
  'davon aus Uckerath + Eitorf KVNO': {
    category: 'ALTFORDERUNG_KV', locationKey: 'Uckerath', counterpartyKey: 'KV',
    estateAllocation: 'ALTMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Altmasse: Forderung aus Leistung vor 29.10.2025',
  },
  'davon aus Uckerath + Eitorf PVS': {
    category: 'ALTFORDERUNG_PVS', locationKey: 'Uckerath', counterpartyKey: 'PVS',
    estateAllocation: 'ALTMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Altmasse: Forderung aus Leistung vor 29.10.2025',
  },
  'davon aus Uckerath + Eitorf HZV': {
    category: 'ALTFORDERUNG_HZV', locationKey: 'Uckerath', counterpartyKey: 'HZV',
    estateAllocation: 'ALTMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Altmasse: Forderung aus Leistung vor 29.10.2025',
  },

  // === AUSZAHLUNGEN: Kosten Fortführung (4 Zeilen) ===
  'Personalaufwand': {
    category: 'PERSONAL', locationKey: null, counterpartyKey: null,
    estateAllocation: 'NEUMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Neumasse: Personalkosten Fortführung',
  },
  'davon Betriebskosten Velbert': {
    category: 'BETRIEBSKOSTEN', locationKey: 'Velbert', counterpartyKey: null,
    estateAllocation: 'NEUMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Neumasse: Betriebskosten Fortführung',
  },
  'davon Betriebskosten Uckerath': {
    category: 'BETRIEBSKOSTEN', locationKey: 'Uckerath', counterpartyKey: null,
    estateAllocation: 'NEUMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Neumasse: Betriebskosten Fortführung',
  },
  'davon Betriebskosten Eitorf': {
    category: 'BETRIEBSKOSTEN', locationKey: 'Eitorf', counterpartyKey: null,
    estateAllocation: 'NEUMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Neumasse: Betriebskosten Fortführung',
  },

  // === INSOLVENZSPEZIFISCH (4 Zeilen) ===
  // "insolvenzspezifische Einzahlungen" hat KEINE Detailzeilen → direkt importieren
  'insolvenzspezifische Einzahlungen': {
    category: 'INSO_EINZAHLUNG', locationKey: null, counterpartyKey: null,
    estateAllocation: 'NEUMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Neumasse: Insolvenzspezifische Einzahlung',
  },
  // "insolvenzspezifische Auszahlungen" ist SUMMENZEILE → wird NICHT importiert (in SKIP_ROWS)
  // Nur die "davon"-Detailzeilen:
  'davon Rückzahlung Insolvenzgeld Okt 25': {
    category: 'INSO_RUECKZAHLUNG', locationKey: null, counterpartyKey: null,
    estateAllocation: 'NEUMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Neumasse: Rückzahlung Insolvenzgeld an Agentur für Arbeit',
  },
  'davon Vorfinanzierung Insolvenzgeld': {
    category: 'INSO_VORFINANZIERUNG', locationKey: null, counterpartyKey: null,
    estateAllocation: 'NEUMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Neumasse: Vorfinanzierung Insolvenzgeld',
  },
  'davon Sachaufnahme': {
    category: 'INSO_SACHAUFNAHME', locationKey: null, counterpartyKey: null,
    estateAllocation: 'NEUMASSE', allocationSource: 'VERTRAGSREGEL',
    allocationNote: 'Neumasse: Sachaufnahme durch Insolvenzverwalter',
  },
};

// Zeilen die NICHT importiert werden (Summenzeilen, Header)
const SKIP_ROWS = [
  'Umsatz',
  'Altforderungen',
  'Summe Einzahlungen',
  'Betriebliche Auszahlungen',
  'insolvenzspezifische Auszahlungen', // SUMMENZEILE → nur Detailzeilen importieren
  'Liquiditätsplanung HVPlus per 03.11.2025 | in T€',
  'T€',
];

// =============================================================================
// MAIN IMPORT FUNCTION
// =============================================================================

async function importPlanData() {
  console.log('='.repeat(60));
  console.log('IMPORT: HVPlus PLAN-Daten (überarbeitet)');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log('='.repeat(60));

  // 1. Load JSON
  console.log(`\n1. Lade JSON: ${PLAN_JSON_PATH}`);

  if (!fs.existsSync(PLAN_JSON_PATH)) {
    console.error(`   FEHLER: Datei nicht gefunden: ${PLAN_JSON_PATH}`);
    process.exit(1);
  }

  const jsonData = JSON.parse(fs.readFileSync(PLAN_JSON_PATH, 'utf-8'));
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
    console.log(`   ${existingCount} Einträge mit dieser Quelle existieren bereits.`);
    console.log('   Überspringe Import um Duplikate zu vermeiden.');
    console.log('   Zum erneuten Import: Erst clean-slate-hvplus.ts ausführen.');
    process.exit(0);
  }

  // 4. Process rows
  console.log('\n4. Verarbeite Zeilen...');
  console.log(`   Mapping: ${Object.keys(ROW_MAPPING).length} Zeilentypen definiert`);
  console.log(`   Skip: ${SKIP_ROWS.length} Summenzeilen`);

  const stats = {
    rowsProcessed: 0,
    rowsSkipped: 0,
    rowsUnmapped: 0,
    entriesCreated: 0,
    zeroValuesSkipped: 0,
    byCategory: {} as Record<string, number>,
    byEstateAllocation: {} as Record<string, number>,
    totalInflowCents: BigInt(0),
    totalOutflowCents: BigInt(0),
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
        console.log(`   Keine Zuordnung für: "${rowName}"`);
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

      // Track stats
      stats.byCategory[mapping.category] = (stats.byCategory[mapping.category] || 0) + 1;
      stats.byEstateAllocation[mapping.estateAllocation] = (stats.byEstateAllocation[mapping.estateAllocation] || 0) + 1;

      if (amountCents > 0) {
        stats.totalInflowCents += BigInt(amountCents);
      } else {
        stats.totalOutflowCents += BigInt(amountCents);
      }

      if (DRY_RUN) {
        if (stats.entriesCreated < 15) {
          console.log(
            `   [PREVIEW] ${month.date.toISOString().slice(0, 10)} | ` +
              `${(valueNum * 1000).toFixed(0).padStart(10)} € | ` +
              `${mapping.category.padEnd(20)} | ` +
              `${(mapping.locationKey || '-').padEnd(10)} | ` +
              `${mapping.estateAllocation}`
          );
        }
        stats.entriesCreated++;
      } else {
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
            categoryTag: mapping.category,
            estateAllocation: mapping.estateAllocation,
            estateRatio: null,
            allocationSource: mapping.allocationSource,
            allocationNote: mapping.allocationNote,
            importSource: 'Liquiditätsplanung 20260114',
            importRowNumber: rowIndex + 1,
            reviewStatus: 'UNREVIEWED',
            createdBy: 'import-hvplus-plan',
          },
        });
        stats.entriesCreated++;
      }
    }
  }

  // 5. Summary
  const inflowTEUR = Number(stats.totalInflowCents) / 100 / 1000;
  const outflowTEUR = Number(stats.totalOutflowCents) / 100 / 1000;
  const saldoTEUR = inflowTEUR + outflowTEUR;

  console.log('\n' + '='.repeat(60));
  console.log('IMPORT ABGESCHLOSSEN');
  console.log('='.repeat(60));
  console.log(`
Zeilen verarbeitet:      ${stats.rowsProcessed}
Zeilen übersprungen:     ${stats.rowsSkipped}
Zeilen ohne Mapping:     ${stats.rowsUnmapped}
Null-Werte übersprungen: ${stats.zeroValuesSkipped}

Einträge erstellt:       ${stats.entriesCreated}

Nach Kategorie:
${Object.entries(stats.byCategory)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([cat, count]) => `  ${cat.padEnd(25)}: ${count}`)
  .join('\n')}

Nach Estate-Allocation:
${Object.entries(stats.byEstateAllocation)
  .map(([alloc, count]) => `  ${alloc.padEnd(25)}: ${count}`)
  .join('\n')}

Summenprüfung:
  Einzahlungen:  ${inflowTEUR.toFixed(1)} T€
  Auszahlungen:  ${outflowTEUR.toFixed(1)} T€
  Saldo:         ${saldoTEUR.toFixed(1)} T€
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
