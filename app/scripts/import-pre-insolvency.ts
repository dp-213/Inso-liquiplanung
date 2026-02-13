/**
 * Import-Script: Pre-Insolvency IST-Daten (Jan–Sep 2025) aus Excel-Kontoauszügen
 *
 * Importiert Transaktionsdaten DIREKT aus Excel (kein Zwischenformat).
 * Diese Daten dienen als historische Planungsgrundlage.
 *
 * Datenquellen (3 Excel-Dateien):
 * - Sparkasse HRV Velbert:  17 Spalten, Sheets: Januar25–September25
 * - apoBank Uckerath:        5/6 Spalten (Format wechselt ab Sep), Sheets: Jan25–Sept25
 * - apoBank HVPLUS:          5/6 Spalten (Format wechselt ab Sep), Sheets: Jan25–Sept25
 *
 * Markierung: allocationSource = 'PRE_INSOLVENCY'
 *
 * Ausführung: cd app && npx tsx scripts/import-pre-insolvency.ts
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

// =============================================================================
// CONFIGURATION
// =============================================================================

const CASE_NUMBER = '70d IN 362/25';
const DRY_RUN = false; // LIVE IMPORT
const INSOLVENCY_DATE = new Date('2025-10-01'); // Alles VOR Oktober importieren

const CASES_ROOT = '/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases';
const DATA_DIR = `${CASES_ROOT}/Hausärztliche Versorgung PLUS eG/01-raw/Datenraum/Hausärztliche Versorgung PLUS eG - DR/02 Hausärztliche Versorgung PLUS eG - Buchhaltung/Geschäftskonten Schuldner`;

// Sheets die importiert werden (nur Jan–Sep)
const PRE_INSOLVENCY_SHEETS: Record<string, string[]> = {
  sparkasse: ['Januar25', 'Februar25', 'März25', 'April25', 'Mai25', 'Juni25', 'Juli25', 'August25', 'September25'],
  apobank_uckerath: ['Jan25', 'Feb25', 'März25', 'April25', 'Mai25', 'Juni25', 'Juli25', 'August25', 'Sept25'],
  apobank_hvplus: ['Jan25', 'Feb25', 'März25', 'April25', 'Mai25', 'Juni25', 'Juli25', 'Aug25', 'Sept25'],
};

// Excel-Dateien
const EXCEL_FILES = {
  sparkasse: {
    path: `${DATA_DIR}/Sparkasse HRV/Kontoauszug_MVZVelbert_Jan_bis_Oktober2025.xlsx`,
    label: 'Sparkasse HRV (Velbert)',
    iban: 'DE83334500000034379768',
  },
  apobank_uckerath: {
    path: `${DATA_DIR}/ApoBank/Kontoauszug_MVZUckerath_Jan_bis_Okt25.xlsx`,
    label: 'apoBank MVZ Uckerath',
    iban: 'DE13300606010078818923',
  },
  apobank_hvplus: {
    path: `${DATA_DIR}/ApoBank/Kontoauszüge_HVPLUS_Jan_bis_Okt25.xlsx`,
    label: 'apoBank HVPLUS',
    iban: 'DE88300606010028818923',
  },
};

// =============================================================================
// TYPES
// =============================================================================

interface ParsedTransaction {
  date: Date;
  amount: number; // Euro (positiv = Einnahme, negativ = Ausgabe)
  description: string;
  counterparty: string | null;
  counterpartyIban: string | null;
  saldo: number | null; // Laufender Saldo (für Verifikation)
}

interface ImportResult {
  bank: string;
  sheet: string;
  total: number;
  imported: number;
  skipped: number;
  filtered: number; // Rausgefiltert (z.B. Datum >= Oktober)
}

// =============================================================================
// EXCEL PARSING
// =============================================================================

function parseSparkasseRow(row: Record<string, unknown>): ParsedTransaction | null {
  const buchungstag = row['Buchungstag'];
  const betrag = row['Betrag'];
  const verwendungszweck = row['Verwendungszweck'];
  const buchungstext = row['Buchungstext'];
  const begName = row['Beguenstigter/Zahlungspflichtiger'];
  const iban = row['Kontonummer/IBAN'];

  if (buchungstag === null || buchungstag === undefined || betrag === null || betrag === undefined) return null;

  const date = excelDateToJS(buchungstag);
  if (!date) return null;

  const amount = typeof betrag === 'number' ? betrag : parseFloat(String(betrag).replace(',', '.'));
  if (isNaN(amount)) return null;

  // Beschreibung: Buchungstext + Verwendungszweck kombinieren
  const parts = [buchungstext, verwendungszweck].filter(Boolean);
  const description = parts.join(' | ').slice(0, 500);

  return {
    date,
    amount,
    description,
    counterparty: begName ? String(begName).trim() : null,
    counterpartyIban: iban ? String(iban).trim() : null,
    saldo: null, // Sparkasse Excel hat keinen laufenden Saldo
  };
}

function parseApoBankRow(row: Record<string, unknown>): ParsedTransaction | null {
  const datum = row['Datum'];
  const name = row['Name'];
  // Format wechselt ab September: "Text" → "Verwendungszweck"
  const text = row['Text'] || row['Verwendungszweck'];
  const betrag = row['Betrag (EUR)'];
  const saldo = row['Saldo (EUR)'];

  if (datum === null || datum === undefined || betrag === null || betrag === undefined) return null;

  const date = excelDateToJS(datum);
  if (!date) return null;

  const amount = typeof betrag === 'number' ? betrag : parseFloat(String(betrag).replace(',', '.'));
  if (isNaN(amount)) return null;

  const saldoValue = saldo !== null && saldo !== undefined
    ? (typeof saldo === 'number' ? saldo : parseFloat(String(saldo).replace(',', '.')))
    : null;

  const description = text ? String(text).trim().slice(0, 500) : '(kein Text)';

  return {
    date,
    amount,
    description,
    counterparty: name ? String(name).trim().replace(/\n/g, ' ') : null,
    counterpartyIban: null, // Bei apoBank ist IBAN im Text eingebettet
    saldo: saldoValue,
  };
}

function excelDateToJS(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(value);
    return new Date(date.y, date.m - 1, date.d);
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function euroToCents(euro: number): bigint {
  return BigInt(Math.round(euro * 100));
}

// =============================================================================
// BANK ACCOUNT LOOKUP
// =============================================================================

async function findBankAccountByIban(iban: string, caseId: string): Promise<string | null> {
  const normalized = iban.replace(/\s/g, '');
  const account = await prisma.bankAccount.findFirst({
    where: {
      caseId,
      iban: normalized,
    },
  });

  if (!account) {
    // Fallback: letzte 10 Zeichen (Kontonummer)
    const accountNumber = normalized.slice(-10);
    const fallback = await prisma.bankAccount.findFirst({
      where: {
        caseId,
        iban: { contains: accountNumber },
      },
    });
    return fallback?.id || null;
  }

  return account.id;
}

// =============================================================================
// IMPORT LOGIC
// =============================================================================

async function importExcelFile(
  bankKey: keyof typeof EXCEL_FILES,
  caseId: string,
): Promise<ImportResult[]> {
  const config = EXCEL_FILES[bankKey];
  const sheets = PRE_INSOLVENCY_SHEETS[bankKey];
  const results: ImportResult[] = [];

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 ${config.label}`);
  console.log(`   ${config.path.split('/').pop()}`);
  console.log(`${'═'.repeat(60)}`);

  // Bank Account auflösen
  const bankAccountId = await findBankAccountByIban(config.iban, caseId);
  if (!bankAccountId) {
    console.log(`   ❌ Bank Account nicht gefunden für IBAN ${config.iban}`);
    return results;
  }
  console.log(`   ✓ Bank Account: ${bankAccountId}`);

  // Excel laden
  const workbook = XLSX.readFile(config.path, { cellDates: true });

  for (const sheetName of sheets) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      console.log(`   ⚠️  Sheet "${sheetName}" nicht gefunden`);
      continue;
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
    console.log(`\n   📋 ${sheetName}: ${rows.length} Zeilen`);

    let imported = 0;
    let skipped = 0;
    let filtered = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Parse je nach Bank-Format
      const tx = bankKey === 'sparkasse'
        ? parseSparkasseRow(row)
        : parseApoBankRow(row);

      if (!tx) {
        filtered++;
        continue;
      }

      // Nur Transaktionen VOR Oktober 2025
      if (tx.date >= INSOLVENCY_DATE) {
        filtered++;
        continue;
      }

      // Duplikat-Check (Triple-Match)
      const existing = await prisma.ledgerEntry.findFirst({
        where: {
          bankAccountId,
          transactionDate: tx.date,
          amountCents: euroToCents(tx.amount),
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      if (!DRY_RUN) {
        await prisma.ledgerEntry.create({
          data: {
            caseId,
            transactionDate: tx.date,
            amountCents: euroToCents(tx.amount),
            description: tx.description,
            note: tx.counterparty || null,

            // Steuerungsdimensionen
            valueType: 'IST',
            legalBucket: 'MASSE',

            // Dimensionen
            bankAccountId,
            counterpartyId: null,
            locationId: null,
            categoryTag: null,

            // Pre-Insolvency: Keine Alt/Neu-Zuordnung
            estateAllocation: null,
            estateRatio: null,

            // Revisionssprache
            allocationSource: 'PRE_INSOLVENCY',
            allocationNote: `Pre-Insolvency: Transaktion vor Eröffnung (29.10.2025). Quelle: ${config.label} ${sheetName}`,

            // Governance
            reviewStatus: 'UNREVIEWED',

            // Import-Metadaten
            importSource: `PRE_INSOLVENCY_${bankKey}_${sheetName}`,
            importRowNumber: i + 1,
            createdBy: 'import-pre-insolvency',
          },
        });
      }

      imported++;
    }

    const result: ImportResult = {
      bank: config.label,
      sheet: sheetName,
      total: rows.length,
      imported,
      skipped,
      filtered,
    };
    results.push(result);

    console.log(`      → Importiert: ${imported}, Duplikate: ${skipped}, Gefiltert: ${filtered}`);
  }

  return results;
}

// =============================================================================
// VERIFICATION
// =============================================================================

function printSummary(allResults: ImportResult[]) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('ZUSAMMENFASSUNG');
  console.log(`${'═'.repeat(60)}\n`);

  // Pro Bank
  const banks = [...new Set(allResults.map(r => r.bank))];
  for (const bank of banks) {
    const bankResults = allResults.filter(r => r.bank === bank);
    const totalImported = bankResults.reduce((s, r) => s + r.imported, 0);
    const totalSkipped = bankResults.reduce((s, r) => s + r.skipped, 0);
    const totalFiltered = bankResults.reduce((s, r) => s + r.filtered, 0);

    console.log(`${bank}:`);
    console.log(`  Monate: ${bankResults.length}`);
    console.log(`  Importiert: ${totalImported}`);
    console.log(`  Duplikate: ${totalSkipped}`);
    console.log(`  Gefiltert: ${totalFiltered}`);
    console.log('');
  }

  // Gesamt
  const totalImported = allResults.reduce((s, r) => s + r.imported, 0);
  const totalSkipped = allResults.reduce((s, r) => s + r.skipped, 0);
  console.log(`GESAMT: ${totalImported} importiert, ${totalSkipped} Duplikate`);
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Pre-Insolvency Import: HVPlus Jan–Sep 2025');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Modus: ${DRY_RUN ? '🔍 DRY RUN (nur Preview)' : '🚀 LIVE IMPORT'}`);
  console.log(`Zeitraum: Januar 2025 – September 2025`);
  console.log(`Markierung: allocationSource = PRE_INSOLVENCY`);
  console.log('');

  // Case finden
  const hvplusCase = await prisma.case.findFirst({
    where: { caseNumber: CASE_NUMBER },
  });

  if (!hvplusCase) {
    throw new Error(`Case nicht gefunden: ${CASE_NUMBER}`);
  }

  console.log(`✓ Case: ${hvplusCase.debtorName} (${hvplusCase.caseNumber})`);

  // Bestehende Pre-Insolvency-Entries zählen
  const existingPreInsolvency = await prisma.ledgerEntry.count({
    where: {
      caseId: hvplusCase.id,
      allocationSource: 'PRE_INSOLVENCY',
    },
  });
  console.log(`✓ Bestehende Pre-Insolvency-Entries: ${existingPreInsolvency}`);

  // Alle 3 Excel-Dateien importieren
  const allResults: ImportResult[] = [];

  for (const bankKey of Object.keys(EXCEL_FILES) as (keyof typeof EXCEL_FILES)[]) {
    const results = await importExcelFile(bankKey, hvplusCase.id);
    allResults.push(...results);
  }

  // Zusammenfassung
  printSummary(allResults);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN – keine Daten geschrieben!');
    console.log('   Zum Importieren: DRY_RUN = false setzen und erneut ausführen');
  } else {
    console.log('\n✅ Import abgeschlossen!');
    console.log('\nNächste Schritte:');
    console.log('1. Classification Engine laufen lassen (Counterparty-Erkennung)');
    console.log('2. Monatliche Zusammenfassung für Planungsgrundlage erstellen');
  }
}

main()
  .catch((e) => {
    console.error('Fehler:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
