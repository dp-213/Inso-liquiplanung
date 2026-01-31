/**
 * Import: ISK-Kontoauszüge (BW-Bank) Dezember 2025 + Januar 2026
 *
 * Datenquelle:
 * - ISK_Uckerath_2025-12.json (144 Buchungen)
 * - ISK_Uckerath_2026-01.json (26 Buchungen)
 * - ISK_Velbert_2025-12.json (8 Buchungen)
 * - ISK_Velbert_2026-01.json (3 Buchungen)
 *
 * Besonderheit:
 * - ISK = Insolvenzsonderkonto (alle Zahlungen nach Verfahrenseröffnung)
 * - Uckerath-ISK erhält ALLE HZV-Zahlungen (auch Velbert-Ärzte!)
 * - Velbert-ISK erhält nur Sparkasse-Auskehrungen
 *
 * Alt/Neu-Zuordnung:
 * - Dezember ist komplett NACH Stichtag (29.10.2025) → Default NEUMASSE
 * - HZV Q3/25 REST = ALTMASSE (Leistung vor Stichtag)
 * - HZV Q4/25 = MIXED (Oktober-Anteil teilweise Alt)
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const CASE_NUMBER = '70d IN 362/25';
const CASES_ROOT = '/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases';
const EXTRACTED_DIR = path.join(CASES_ROOT, 'Hausärztliche Versorgung PLUS eG/02-extracted');

const STICHTAG = new Date('2025-10-29');

interface Transaction {
  date: string;
  valueDate: string;
  amount: number;
  description: string;
  counterparty: string | null;
  category: string;
  iskAccount: string;
  iskName: string;
  sourceFile: string;
  lanr?: string;
  haevgid?: string;
  arzt?: string;
  standort?: string;
}

interface IskData {
  sourceFile: string;
  extractedAt: string;
  account: { name: string; kontonummer: string; iban: string };
  period: { month: string };
  summary: { transactionCount: number; totalInflows: number; totalOutflows: number };
  transactions: Transaction[];
}

// LANR → Standort für Alt/Neu-Zuordnung
const LANR_STANDORT: Record<string, string> = {
  '3892462': 'Velbert',
  '8836735': 'Velbert',
  '7729639': 'Velbert',
  '8898288': 'Eitorf',
  '1445587': 'Uckerath',
  '1203618': 'Uckerath',
  '3243603': 'Uckerath',
  '4652451': 'Uckerath',
};

/**
 * Bestimme Estate Allocation für ISK-Buchungen
 */
function determineEstateAllocation(tx: Transaction): {
  allocation: string | null;
  ratio: number | null;
  source: string;
  note: string;
} {
  const desc = tx.description.toLowerCase();
  const category = tx.category;

  // Sammelüberweisungen = NEUMASSE (Verfahrenskosten nach Insolvenz)
  if (category === 'SAMMELUEBERWEISUNG') {
    return {
      allocation: 'NEUMASSE',
      ratio: 1.0,
      source: 'VERFAHRENSKOSTEN',
      note: 'Sammelüberweisung: Kosten nach Insolvenzeröffnung',
    };
  }

  // Auskehrung Sparkasse = NEUTRAL (interne Umbuchung)
  if (category === 'AUSKEHRUNG_SPK') {
    return {
      allocation: null,
      ratio: null,
      source: 'NEUTRAL',
      note: 'Auskehrung Sparkasse: Interne Umbuchung gem. Massekreditvereinbarung',
    };
  }

  // HZV mit Q3/25 im Text = ALTMASSE (Restzahlung für Leistung vor Stichtag)
  if (category === 'HZV' && desc.includes('q3/25')) {
    return {
      allocation: 'ALTMASSE',
      ratio: 1.0,
      source: 'LEISTUNGSZEITRAUM',
      note: 'HZV Q3/25 REST: Leistung komplett vor Stichtag',
    };
  }

  // HZV mit Q4/25 = MIXED (Oktober teilweise Alt, Nov+Dez Neu)
  if (category === 'HZV' && (desc.includes('q4/25') || desc.includes('4/2025'))) {
    // Dezember-Zahlung für November-Leistung = NEUMASSE
    if (desc.includes('abschlag') || desc.includes('rate')) {
      return {
        allocation: 'NEUMASSE',
        ratio: 1.0,
        source: 'LEISTUNGSZEITRAUM',
        note: 'HZV Q4/25 Abschlag: Leistung November = nach Stichtag',
      };
    }
    // Sonst MIXED
    return {
      allocation: 'MIXED',
      ratio: 0.67, // 2/3 Neumasse
      source: 'MASSEKREDITVERTRAG',
      note: 'HZV Q4/25: 1/3 Oktober (teils Alt), 2/3 Nov+Dez (Neu)',
    };
  }

  // PVS = UNKLAR (Behandlungsdatum nicht ableitbar)
  if (category === 'PVS') {
    return {
      allocation: null,
      ratio: null,
      source: 'UNKLAR',
      note: 'PVS: Behandlungsdatum aus Kontoauszug nicht ableitbar',
    };
  }

  // Gutachten = UNKLAR (müsste man einzeln prüfen)
  if (category === 'GUTACHTEN') {
    return {
      allocation: null,
      ratio: null,
      source: 'UNKLAR',
      note: 'Gutachten: Leistungsdatum nicht eindeutig ableitbar',
    };
  }

  // Sonstige = UNKLAR
  return {
    allocation: null,
    ratio: null,
    source: 'UNKLAR',
    note: 'Automatische Zuordnung nicht möglich',
  };
}

/**
 * Bestimme Location basierend auf LANR oder ISK-Konto
 */
function determineLocation(tx: Transaction, locationMap: Record<string, string>): string | null {
  // Wenn LANR vorhanden und Standort bekannt
  if (tx.standort) {
    const standort = tx.standort;
    if (standort === 'Eitorf') {
      return locationMap['Uckerath'] || locationMap['Praxis Uckerath'] || null;
    }
    return locationMap[standort] || locationMap[`Praxis ${standort}`] || null;
  }

  // Velbert ISK = Velbert Standort
  if (tx.iskAccount === '400080228') {
    return locationMap['Velbert'] || locationMap['Praxis Velbert'] || null;
  }

  // Uckerath ISK ohne LANR = könnte beides sein
  // Für Sammelüberweisungen: meist Uckerath
  if (tx.category === 'SAMMELUEBERWEISUNG') {
    return locationMap['Uckerath'] || locationMap['Praxis Uckerath'] || null;
  }

  return null;
}

async function importJsonFile(
  jsonPath: string,
  hvCase: { id: string },
  locationMap: Record<string, string>,
  counterpartyMap: Record<string, string>
): Promise<{ imported: number; skipped: number; errors: number }> {
  const data: IskData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  console.log('\n--- Import:', data.sourceFile, '---');
  console.log('Zeitraum:', data.period.month);
  console.log('Transaktionen:', data.transactions.length);
  console.log('Einnahmen:', data.summary.totalInflows.toLocaleString('de-DE'), '€');
  console.log('Ausgaben:', data.summary.totalOutflows.toLocaleString('de-DE'), '€');

  // Check for existing imports from this source
  const existingCount = await prisma.ledgerEntry.count({
    where: {
      caseId: hvCase.id,
      importSource: { contains: data.sourceFile.replace('.json', '') }
    }
  });

  if (existingCount > 0) {
    console.log(`WARNUNG: ${existingCount} Einträge aus dieser Quelle bereits vorhanden`);
    console.log('Überspringe Duplikate...');
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < data.transactions.length; i++) {
    const tx = data.transactions[i];

    if (tx.amount === 0) continue;

    // Parse date from DD.MM.YYYY format
    const [day, month, year] = tx.date.split('.');
    const transactionDate = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
    const amountCents = Math.round(tx.amount * 100);

    // Check for duplicate using importSource + row number (unique per PDF)
    const importSourceKey = `${data.sourceFile}:${tx.sourceFile}`;
    const existingEntry = await prisma.ledgerEntry.findFirst({
      where: {
        caseId: hvCase.id,
        importSource: importSourceKey,
        importRowNumber: i + 1
      }
    });

    if (existingEntry) {
      skipped++;
      continue;
    }

    // Estate Allocation
    const estate = determineEstateAllocation(tx);

    // Location
    const locationId = determineLocation(tx, locationMap);

    // Counterparty
    let counterpartyId: string | null = null;
    if (tx.category === 'HZV') {
      counterpartyId = counterpartyMap['HAVG'] || counterpartyMap['HAVG (HZV)'] || null;
    } else if (tx.category === 'PVS') {
      counterpartyId = counterpartyMap['PVS rhein-ruhr'] || null;
    } else if (tx.category === 'KV') {
      counterpartyId = counterpartyMap['KV Nordrhein'] || counterpartyMap['KVNO'] || null;
    }

    // Legal Bucket
    let legalBucket = 'MASSE';
    if (estate.source === 'NEUTRAL') {
      legalBucket = 'NEUTRAL';
    }

    try {
      await prisma.ledgerEntry.create({
        data: {
          caseId: hvCase.id,
          transactionDate,
          amountCents: BigInt(amountCents),
          description: tx.description.substring(0, 500),
          valueType: 'IST',
          legalBucket,
          locationId,
          counterpartyId,
          bankAccountId: null,
          estateAllocation: estate.allocation,
          estateRatio: estate.ratio,
          allocationSource: estate.source,
          allocationNote: estate.note,
          importSource: `${data.sourceFile}:${tx.sourceFile}`,
          importRowNumber: i + 1,
          reviewStatus: 'UNREVIEWED',
          createdBy: 'import-isk-data',
        }
      });
      imported++;
    } catch (error) {
      console.error(`  Fehler bei Zeile ${i + 1}:`, error);
      errors++;
    }
  }

  console.log(`Importiert: ${imported}, Übersprungen: ${skipped}, Fehler: ${errors}`);
  return { imported, skipped, errors };
}

async function main() {
  console.log('=== IMPORT: ISK-Daten Dezember 2025 + Januar 2026 ===');
  console.log('Stichtag Alt/Neu-Masse:', STICHTAG.toISOString().split('T')[0]);

  // Find case
  const hvCase = await prisma.case.findFirst({ where: { caseNumber: CASE_NUMBER } });
  if (!hvCase) {
    console.error('Case nicht gefunden:', CASE_NUMBER);
    return;
  }
  console.log('\nCase:', hvCase.debtorName);

  // Get locations
  const locations = await prisma.location.findMany({ where: { caseId: hvCase.id } });
  const locationMap: Record<string, string> = {};
  locations.forEach(l => {
    locationMap[l.name] = l.id;
    if (l.shortName) locationMap[l.shortName] = l.id;
  });
  console.log('Locations:', Object.keys(locationMap).join(', '));

  // Get counterparties
  const counterparties = await prisma.counterparty.findMany({ where: { caseId: hvCase.id } });
  const counterpartyMap: Record<string, string> = {};
  counterparties.forEach(c => { counterpartyMap[c.name] = c.id; });
  console.log('Counterparties:', Object.keys(counterpartyMap).join(', '));

  // Delete old ISK imports for Dec/Jan to avoid duplicates
  console.log('\n--- Bereinige alte ISK-Importe ---');
  const deleted = await prisma.ledgerEntry.deleteMany({
    where: {
      caseId: hvCase.id,
      valueType: 'IST',
      transactionDate: {
        gte: new Date('2025-12-01'),
        lt: new Date('2026-02-01')
      },
      importSource: {
        contains: 'ISK_'
      }
    }
  });
  console.log('Gelöscht:', deleted.count, 'alte ISK-Einträge');

  // Also delete old Excel-based imports for Dec/Jan
  const deletedExcel = await prisma.ledgerEntry.deleteMany({
    where: {
      caseId: hvCase.id,
      valueType: 'IST',
      transactionDate: {
        gte: new Date('2025-12-01'),
        lt: new Date('2026-02-01')
      },
      importSource: {
        contains: 'HVPlus Einzahlungen'
      }
    }
  });
  console.log('Gelöscht:', deletedExcel.count, 'alte Excel-Einträge');

  // Files to import
  const jsonFiles = [
    'ISK_Uckerath_2025-12.json',
    'ISK_Uckerath_2026-01.json',
    'ISK_Velbert_2025-12.json',
    'ISK_Velbert_2026-01.json',
  ];

  const results: Record<string, { imported: number; skipped: number; errors: number }> = {};

  for (const file of jsonFiles) {
    const filePath = path.join(EXTRACTED_DIR, file);
    if (fs.existsSync(filePath)) {
      results[file] = await importJsonFile(filePath, hvCase, locationMap, counterpartyMap);
    } else {
      console.log(`\nDatei nicht gefunden: ${file}`);
    }
  }

  // Summary
  console.log('\n=== ZUSAMMENFASSUNG ===');
  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  for (const [file, result] of Object.entries(results)) {
    console.log(`${file}: ${result.imported} importiert, ${result.skipped} übersprungen`);
    totalImported += result.imported;
    totalSkipped += result.skipped;
    totalErrors += result.errors;
  }
  console.log(`\nGESAMT: ${totalImported} importiert, ${totalSkipped} übersprungen, ${totalErrors} Fehler`);

  // Verify by month
  console.log('\n=== VERIFIZIERUNG ===');

  for (const month of ['2025-12', '2026-01']) {
    const [year, mon] = month.split('-');
    const startDate = new Date(`${year}-${mon}-01`);
    const endDate = new Date(Number(year), Number(mon), 0); // Last day of month

    const entries = await prisma.ledgerEntry.findMany({
      where: {
        caseId: hvCase.id,
        valueType: 'IST',
        transactionDate: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    let totalIn = BigInt(0);
    let totalOut = BigInt(0);
    for (const e of entries) {
      if (e.amountCents >= 0) totalIn += e.amountCents;
      else totalOut += e.amountCents;
    }

    console.log(`\n${month}:`);
    console.log(`  Buchungen: ${entries.length}`);
    console.log(`  Einnahmen: ${(Number(totalIn) / 100).toLocaleString('de-DE')} €`);
    console.log(`  Ausgaben: ${(Number(totalOut) / 100).toLocaleString('de-DE')} €`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
