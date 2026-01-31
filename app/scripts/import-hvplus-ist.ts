/**
 * Import-Script: HVPlus IST-Daten
 *
 * Importiert IST-Daten aus:
 * - Kopie von HVPlus Einzahlungen ISK 03.11.2025 bis 31.12.2025.json
 *
 * WICHTIG - Fachliche Regel für Alt/Neu-Zuordnung:
 * - Maßgeblich ist AUSSCHLIESSLICH die Forderungsentstehung (Leistungsdatum)
 * - NICHT das Buchungsdatum!
 * - estateAllocation=null wie in Turso Production (Alt/Neu unbestimmt)
 * - Vorschläge nur über suggested* Felder (Phase C Rules)
 *
 * LANR-Extraktion: Aus Transaktionsinformation, NUR wenn HAEVGID/LANR explizit enthalten
 *
 * Ausführung: npx tsx scripts/import-hvplus-ist.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// =============================================================================
// CONFIGURATION
// =============================================================================

const CASE_NUMBER = '70d IN 362/25'; // Turso Production Case-Nummer
const CUTOFF_DATE = new Date('2025-10-29');
const DRY_RUN = false; // Set to true for preview only

// JSON-Quelldatei (absoluter Pfad zum Cases-Verzeichnis)
const CASES_ROOT = '/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases';
const IST_JSON_PATH = `${CASES_ROOT}/Hausärztliche Versorgung PLUS eG/02-extracted/Kopie von HVPlus Einzahlungen ISK 03.11.2025 bis 31.12.2025.json`;

// =============================================================================
// LANR → ARZT MAPPING (aus LANR und hvg nummer.png)
// =============================================================================

interface ArztMapping {
  name: string;
  haevgId: string;
  standort: 'Velbert' | 'Uckerath' | 'Eitorf';
}

const LANR_MAP: Record<string, ArztMapping> = {
  '3892462': { name: 'Dr. Thomas van Suntum', haevgId: '055425', standort: 'Velbert' },
  '8836735': { name: 'Dr. Thomas Beyer', haevgId: '067026', standort: 'Velbert' },
  '7729639': { name: 'Dr. Martina Kamler', haevgId: '083974', standort: 'Velbert' },
  '8898288': { name: 'Dr. Rösing', haevgId: '036131', standort: 'Eitorf' },
  '1445587': { name: 'Dr. Kathrin Binas', haevgId: '132025', standort: 'Uckerath' },
  '1203618': { name: 'Dr. Annette Schweitzer', haevgId: '132049', standort: 'Uckerath' },
  '3243603': { name: 'Anja Fischer', haevgId: '132052', standort: 'Uckerath' },
  '4652451': { name: 'Verena Ludwig', haevgId: '132064', standort: 'Uckerath' },
};

// =============================================================================
// SERVICE-DATE-HINWEISE (NUR als Vorschläge, KEINE automatische Zuordnung!)
// =============================================================================

interface ServiceDateHint {
  suggestedServiceDateRule: string | null;
  hintNote: string;
}

/**
 * Gibt Hinweis auf mögliche Leistungsperiode (NUR als Vorschlag!)
 * WICHTIG: Setzt KEINE estateAllocation - das muss manuell erfolgen!
 */
function extractServiceDateHint(
  description: string,
  counterpartyType: 'HZV' | 'KV' | 'PVS' | 'SONSTIGE'
): ServiceDateHint {
  // HZV: Vormonat-Logik als Hinweis
  if (counterpartyType === 'HZV') {
    const q3Match = description.match(/Q3\/25|Q3-25|Q3 25/i);
    const q4Match = description.match(/Q4\/25|Q4-25|Q4 25/i);
    const restMatch = description.match(/REST\s*Q(\d)\/25/i);

    if (q3Match || (restMatch && restMatch[1] === '3')) {
      return {
        suggestedServiceDateRule: 'PREVIOUS_QUARTER',
        hintNote: 'HZV Q3/2025: Leistungszeitraum Jul-Sep 2025 (vor Stichtag)',
      };
    }

    if (q4Match || (restMatch && restMatch[1] === '4')) {
      return {
        suggestedServiceDateRule: 'PREVIOUS_QUARTER',
        hintNote: 'HZV Q4/2025: Leistungszeitraum Okt-Dez 2025 (anteilig vor/nach Stichtag)',
      };
    }

    // Allgemeiner Hinweis: HZV = Vormonat-Logik
    return {
      suggestedServiceDateRule: 'VORMONAT',
      hintNote: 'HZV: Zahlung bezieht sich auf Vormonat (Vormonat-Logik)',
    };
  }

  // KV: Quartalslogik als Hinweis
  if (counterpartyType === 'KV') {
    const q3Match = description.match(/Q3\/25|Q3-25|Q3 25/i);
    const q4Match = description.match(/Q4\/25|Q4-25|Q4 25/i);

    if (q3Match) {
      return {
        suggestedServiceDateRule: 'PREVIOUS_QUARTER',
        hintNote: 'KV Q3/2025: Leistungszeitraum Jul-Sep 2025 (vor Stichtag)',
      };
    }

    if (q4Match) {
      return {
        suggestedServiceDateRule: 'PREVIOUS_QUARTER',
        hintNote: 'KV Q4/2025: Vertragsregel 1/3 Alt, 2/3 Neu anwendbar',
      };
    }
  }

  // PVS: Behandlungsdatum erforderlich
  if (counterpartyType === 'PVS') {
    return {
      suggestedServiceDateRule: null,
      hintNote: 'PVS: Behandlungsdatum für Alt/Neu erforderlich',
    };
  }

  // Sonstige: Kein Hinweis
  return {
    suggestedServiceDateRule: null,
    hintNote: 'Kein Leistungsdatum erkennbar',
  };
}

/**
 * Erkennt Abrechnungsstelle aus Beschreibung
 */
function detectCounterpartyType(description: string, debtorName: string): 'HZV' | 'KV' | 'PVS' | 'SONSTIGE' {
  const desc = description.toUpperCase();
  const debtor = debtorName.toUpperCase();

  if (desc.includes('HAVG') || desc.includes('HZV') || debtor.includes('HAVG')) {
    return 'HZV';
  }
  if (desc.includes('KVNO') || desc.includes('KASSENÄRZTLICHE')) {
    return 'KV';
  }
  if (desc.includes('PVS') || debtor.includes('PVS RHEIN-RUHR')) {
    return 'PVS';
  }
  return 'SONSTIGE';
}

/**
 * Extrahiert LANR aus Transaktionsinformation
 * Format: "HAEVGID XXXXX LANR XXXXXXX ..."
 */
function extractLanr(description: string): string | null {
  // Pattern: LANR gefolgt von 7-stelliger Nummer
  const match = description.match(/LANR\s*(\d{7})/i);
  return match ? match[1] : null;
}

/**
 * Extrahiert HAEVGID aus Transaktionsinformation
 */
function extractHaevgId(description: string): string | null {
  const match = description.match(/HAEVGID\s*(\d{5,6})/i);
  return match ? match[1] : null;
}

// =============================================================================
// MAIN IMPORT FUNCTION
// =============================================================================

async function importIstData() {
  console.log('='.repeat(60));
  console.log('IMPORT: HVPlus IST-Daten');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log('='.repeat(60));

  // 1. Load JSON
  const jsonPath = IST_JSON_PATH; // Absoluter Pfad
  console.log(`\n1. Lade JSON: ${jsonPath}`);

  if (!fs.existsSync(jsonPath)) {
    console.error(`   FEHLER: Datei nicht gefunden: ${jsonPath}`);
    process.exit(1);
  }

  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  console.log(`   Sheets: ${Object.keys(jsonData.sheets).join(', ')}`);

  // 2. Find Case
  console.log('\n2. Suche Case...');
  const hvplusCase = await prisma.case.findFirst({
    where: { caseNumber: CASE_NUMBER },
    include: {
      locations: true,
      counterparties: true,
      bankAccounts: true,
    },
  });

  if (!hvplusCase) {
    console.error(`   FEHLER: Case ${CASE_NUMBER} nicht gefunden. Bitte zuerst seed-hvplus.ts ausführen.`);
    process.exit(1);
  }
  console.log(`   Case: ${hvplusCase.debtorName} (${hvplusCase.id})`);

  // Build lookup maps
  const locationByName: Record<string, string> = {};
  for (const loc of hvplusCase.locations) {
    locationByName[loc.shortName || loc.name] = loc.id;
    if (loc.name.includes('Uckerath')) {
      locationByName['Uckerath'] = loc.id;
      locationByName['Eitorf'] = loc.id; // Eitorf → Uckerath
    }
    if (loc.name === 'Velbert' || loc.shortName === 'VEL') {
      locationByName['Velbert'] = loc.id;
    }
  }

  const counterpartyByLanr: Record<string, string> = {};
  const counterpartyByType: Record<string, string> = {};
  for (const cp of hvplusCase.counterparties) {
    // Ärzte haben LANR in matchPattern, role: ARZT in notes
    if (cp.matchPattern && cp.notes?.includes('"role":"ARZT"')) {
      counterpartyByLanr[cp.matchPattern] = cp.id;
    }
    // Abrechnungsstellen haben isTopPayer: true
    if (cp.isTopPayer && cp.shortName) {
      counterpartyByType[cp.shortName] = cp.id;
    }
  }

  const bankAccountByIban: Record<string, string> = {};
  for (const ba of hvplusCase.bankAccounts) {
    if (ba.iban) {
      // Normalize IBAN (remove spaces)
      const normalizedIban = ba.iban.replace(/\s/g, '');
      bankAccountByIban[normalizedIban] = ba.id;
    }
  }

  // Determine bank by sheet name
  const sheetToBankAccount: Record<string, string | null> = {
    'Konto Uckerath': bankAccountByIban['DE91600501010400080156'] || null,
    'Konto Velbert': bankAccountByIban['DE87600501010400080228'] || null,
  };

  // 3. Check for existing entries
  console.log('\n3. Prüfe existierende Einträge...');
  const existingCount = await prisma.ledgerEntry.count({
    where: {
      caseId: hvplusCase.id,
      importSource: { contains: 'Kopie von HVPlus Einzahlungen ISK' },
    },
  });

  if (existingCount > 0) {
    console.log(`   ⚠️  ${existingCount} Einträge mit dieser Quelle existieren bereits.`);
    console.log('   Überspringe Import um Duplikate zu vermeiden.');
    console.log('   Zum erneuten Import: DELETE FROM ledger_entries WHERE importSource LIKE "%Kopie von HVPlus%"');
    process.exit(0);
  }

  // 4. Process sheets
  console.log('\n4. Verarbeite Sheets...');

  const stats = {
    total: 0,
    created: 0,
    skipped: 0,
    byType: { HZV: 0, KV: 0, PVS: 0, SONSTIGE: 0 } as Record<string, number>,
    withHint: 0, // Anzahl Einträge mit suggestedServiceDateRule
    lanrMatched: 0,
    lanrUnmatched: 0,
  };

  for (const [sheetName, sheet] of Object.entries(jsonData.sheets) as [string, { preview_rows: unknown[][] }][]) {
    console.log(`\n   Sheet: ${sheetName}`);
    const rows = sheet.preview_rows;

    // Skip header row
    const dataRows = rows.slice(1);
    const bankAccountId = sheetToBankAccount[sheetName];

    if (!bankAccountId) {
      console.log(`   ⚠️  Kein BankAccount für Sheet "${sheetName}" gefunden`);
    }

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      stats.total++;

      // Parse row: [Kontoname, Datum, Valuta, Transaktionsinformation, Betrag, Whg, Kategorie, Creditor, Debtor]
      const [
        kontoname,
        datumStr,
        valutaStr,
        transaktionsinformation,
        betragStr,
        _whg,
        _kategorie,
        creditorName,
        debtorName,
      ] = row as string[];

      // Parse date
      let transactionDate: Date;
      try {
        transactionDate = new Date(datumStr);
        if (isNaN(transactionDate.getTime())) {
          console.log(`   ⚠️  Ungültiges Datum: ${datumStr} (Zeile ${i + 2})`);
          stats.skipped++;
          continue;
        }
      } catch {
        stats.skipped++;
        continue;
      }

      // Parse amount
      const betrag = parseFloat(String(betragStr).replace(',', '.'));
      if (isNaN(betrag)) {
        stats.skipped++;
        continue;
      }
      const amountCents = Math.round(betrag * 100);

      // Skip zero amounts
      if (amountCents === 0) {
        stats.skipped++;
        continue;
      }

      // Extract LANR and determine counterparty
      const description = String(transaktionsinformation || '');
      const lanr = extractLanr(description);
      const haevgId = extractHaevgId(description);
      const counterpartyType = detectCounterpartyType(description, String(debtorName || ''));

      let counterpartyId: string | null = null;
      let locationId: string | null = null;

      // LANR-basierte Zuordnung (nur wenn explizit vorhanden)
      if (lanr && LANR_MAP[lanr]) {
        const mapping = LANR_MAP[lanr];
        counterpartyId = counterpartyByLanr[lanr] || null;
        locationId = locationByName[mapping.standort] || null;
        stats.lanrMatched++;
      } else if (lanr) {
        // LANR gefunden aber nicht in Mapping
        stats.lanrUnmatched++;
        console.log(`   ⚠️  Unbekannte LANR: ${lanr} (Zeile ${i + 2})`);
      }

      // Fallback: Abrechnungsstelle als Counterparty
      if (!counterpartyId && counterpartyType !== 'SONSTIGE') {
        const settlerKey = counterpartyType === 'HZV' ? 'HAVG' : counterpartyType;
        counterpartyId = counterpartyByType[settlerKey] || null;
      }

      // Fallback: Location aus Kontoname
      if (!locationId) {
        if (kontoname?.includes('Uckerath') || sheetName.includes('Uckerath')) {
          locationId = locationByName['Uckerath'] || null;
        } else if (kontoname?.includes('Velbert') || sheetName.includes('Velbert')) {
          locationId = locationByName['Velbert'] || null;
        }
      }

      // Service-Date-Hinweis extrahieren (NUR als Vorschlag, KEINE automatische Zuordnung!)
      const hint = extractServiceDateHint(description, counterpartyType);

      // WICHTIG: estateAllocation=null wie in Turso Production
      // Alt/Neu kann nur mit echtem Leistungsdatum bestimmt werden
      const estateAllocation = null;
      const allocationSource = null;
      const allocationNote = hint.hintNote || null;

      stats.byType[counterpartyType]++;
      if (hint.suggestedServiceDateRule) {
        stats.withHint++;
      }

      if (DRY_RUN) {
        // Preview mode
        if (i < 5) {
          console.log(
            `   [PREVIEW] ${transactionDate.toISOString().slice(0, 10)} | ` +
              `${betrag.toFixed(2).padStart(10)} € | ` +
              `${counterpartyType.padEnd(8)} | ` +
              `${(estateAllocation || 'UNKLAR').padEnd(8)} | ` +
              `LANR: ${lanr || '-'}`
          );
        }
      } else {
        // Create LedgerEntry mit UNKLAR als Default
        await prisma.ledgerEntry.create({
          data: {
            caseId: hvplusCase.id,
            transactionDate,
            amountCents: BigInt(amountCents),
            description: description.slice(0, 500), // Truncate long descriptions
            valueType: 'IST',
            legalBucket: 'MASSE',
            bankAccountId,
            counterpartyId,
            locationId,
            // KEINE automatische Alt/Neu-Zuordnung!
            estateAllocation,
            estateRatio: null,
            allocationSource,
            allocationNote,
            // Hinweise nur als suggested* (Phase C Rules können diese auswerten)
            suggestedServiceDateRule: hint.suggestedServiceDateRule,
            importSource: 'Kopie von HVPlus Einzahlungen ISK 03.11.-31.12.2025',
            importRowNumber: i + 2,
            reviewStatus: 'UNREVIEWED',
            createdBy: 'import-hvplus-ist',
          },
        });
        stats.created++;
      }
    }
  }

  // 5. Summary
  console.log('\n' + '='.repeat(60));
  console.log('IMPORT ABGESCHLOSSEN');
  console.log('='.repeat(60));
  console.log(`
Gesamt verarbeitet: ${stats.total}
Erstellt:           ${stats.created}
Übersprungen:       ${stats.skipped}

Nach Typ:
  HZV:              ${stats.byType.HZV}
  KV:               ${stats.byType.KV}
  PVS:              ${stats.byType.PVS}
  Sonstige:         ${stats.byType.SONSTIGE}

Alle ${stats.created} Einträge haben estateAllocation=null (wie Turso Production)
  Mit ServiceDate-Hinweis: ${stats.withHint}

LANR-Matching:
  Zugeordnet:       ${stats.lanrMatched}
  Nicht zugeordnet: ${stats.lanrUnmatched}
`);
}

// =============================================================================
// EXECUTE
// =============================================================================

importIstData()
  .catch((e) => {
    console.error('Import failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
