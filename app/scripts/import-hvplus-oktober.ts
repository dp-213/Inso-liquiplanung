/**
 * Import: Oktober 2025 Kontoauszüge (Velbert + Uckerath)
 *
 * Datenquelle:
 * - 10_Oktober_25_MVZVelbert.json (88 Buchungen, Sparkasse)
 * - 10_Oktober_25_MVZUckerath.json (139 Buchungen, apoBank)
 *
 * Alt/Neu-Zuordnung Regeln (Stichtag 29.10.2025):
 * - HZV Q3/25-3 = ALTMASSE (Leistungszeitraum Jul-Sep 2025)
 * - KV Q4/25 Rate 1 = MIXED (1/3 Alt für Okt, 2/3 Neu für Nov+Dez)
 * - KV Q3/25 Nachzahlung = ALTMASSE
 * - KV Q2/25 Restzahlung = ALTMASSE
 * - Kosten vor 29.10. = ALTMASSE (Leistung vor Stichtag)
 * - Kosten ab 29.10. = UNKLAR (Leistungsdatum unbekannt)
 * - PVS = UNKLAR (Behandlungsdatum aus Buchung nicht ableitbar)
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();
const CASE_NUMBER = '70d IN 362/25';
const CASES_ROOT = '/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases';
const VELBERT_JSON = CASES_ROOT + '/Hausärztliche Versorgung PLUS eG/02-extracted/10_Oktober_25_MVZVelbert.json';
const UCKERATH_JSON = CASES_ROOT + '/Hausärztliche Versorgung PLUS eG/02-extracted/10_Oktober_25_MVZUckerath.json';

// LANR → Arzt + Standort Mapping
const ARZT_MAP: Record<string, { name: string; standort: 'Velbert' | 'Uckerath' }> = {
  '3892462': { name: 'Dr. Thomas van Suntum', standort: 'Velbert' },
  '8836735': { name: 'Dr. Thomas Beyer', standort: 'Velbert' },
  '7729639': { name: 'Dr. Martina Kamler', standort: 'Velbert' },
  '8898288': { name: 'Dr. Rösing', standort: 'Uckerath' }, // Eitorf = Uckerath
  '1445587': { name: 'Dr. Kathrin Binas', standort: 'Uckerath' },
  '1203618': { name: 'Dr. Annette Schweitzer', standort: 'Uckerath' },
  '3243603': { name: 'Anja Fischer', standort: 'Uckerath' },
  '4652451': { name: 'Verena Ludwig', standort: 'Uckerath' },
};

const STICHTAG = new Date('2025-10-29');

interface Transaction {
  date: string;
  counterparty: string;
  description: string;
  amount: number;
  category: string;
  lanr?: string;
  haevgid?: string;
  quarter?: string;
  abschlag?: number;
  kk?: string;
  type?: string;
  rateNr?: number;
}

interface KontoauszugData {
  sourceFile: string;
  account: { bank: string; iban: string };
  transactions: Transaction[];
}

/**
 * Bestimme Estate Allocation basierend auf Kategorie und Leistungszeitraum
 */
function determineEstateAllocation(tx: Transaction): {
  allocation: string | null;
  ratio: number | null;
  source: string;
  note: string;
} {
  const category = tx.category;
  const transDate = new Date(tx.date);

  // HZV Q3/25 = 100% ALTMASSE (Leistung Jul-Sep 2025)
  if (category === 'HZV' && tx.quarter === 'Q3/2025') {
    return {
      allocation: 'ALTMASSE',
      ratio: 1.0,
      source: 'LEISTUNGSZEITRAUM',
      note: 'HZV Q3/25 Abschlag 3: Leistung Jul-Sep 2025 (komplett vor Stichtag)',
    };
  }

  // HZV Q4/25-1 würde Oktober-Leistung sein = MIXED (28/31 Alt)
  // Aber Q4/25-1 wird erst im November gezahlt, nicht in Oktober!
  // In Oktober sehen wir nur Q3/25-3

  // KV Q4/25 Rate 1 = MIXED (1/3 Alt Okt, 2/3 Neu Nov+Dez)
  if (category === 'KV' && tx.quarter === 'Q4/2025' && tx.rateNr === 1) {
    return {
      allocation: 'MIXED',
      ratio: 1/3, // 1/3 Altmasse (Oktober-Anteil)
      source: 'MASSEKREDITVERTRAG',
      note: 'KV Q4/25 Rate 1: 1/3 Alt (Okt), 2/3 Neu (Nov+Dez)',
    };
  }

  // KV Q3/25 Nachzahlung = ALTMASSE
  if (category === 'KV' && tx.quarter === 'Q3/2025') {
    return {
      allocation: 'ALTMASSE',
      ratio: 1.0,
      source: 'LEISTUNGSZEITRAUM',
      note: 'KV Q3/25 Nachzahlung: Leistung Jul-Sep 2025',
    };
  }

  // KV Q2/25 Restzahlung = ALTMASSE
  if (category === 'KV' && tx.quarter === 'Q2/2025') {
    return {
      allocation: 'ALTMASSE',
      ratio: 1.0,
      source: 'LEISTUNGSZEITRAUM',
      note: 'KV Q2/25 Restzahlung: Leistung Apr-Jun 2025',
    };
  }

  // KV Zuschuss = UNKLAR (Zuordnung unklar)
  if (category === 'KV' && tx.type === 'ZUSCHUSS') {
    return {
      allocation: null,
      ratio: null,
      source: 'UNKLAR',
      note: 'KV Zuschuss: Keine eindeutige Zuordnung möglich',
    };
  }

  // PVS = UNKLAR (Behandlungsdatum nicht aus Buchung ableitbar)
  if (category === 'PVS') {
    return {
      allocation: null,
      ratio: null,
      source: 'UNKLAR',
      note: 'PVS: Behandlungsdatum aus Kontoauszug nicht ableitbar',
    };
  }

  // Oktober ist VOR Stichtag (29.10.) - alle Betriebskosten könnten für Leistungen VOR Stichtag sein
  // ABER: Wir können das Leistungsdatum nicht aus der Buchung ablesen
  // Konservativ: UNKLAR setzen
  if (category === 'KOSTEN' || category === 'MIETE' || category === 'STROM') {
    // Buchungsdatum = Zahlungsdatum, NICHT Leistungsdatum!
    return {
      allocation: null,
      ratio: null,
      source: 'UNKLAR',
      note: 'Kosten: Leistungszeitraum aus Buchung nicht eindeutig ableitbar',
    };
  }

  // SOZIALABGABEN
  if (category === 'SOZIALABGABEN') {
    // Oktober Beiträge = Leistung Oktober = MIXED (28/31 Alt, 3/31 Neu)
    if (tx.description.includes('10/25') || tx.description.includes('1025')) {
      return {
        allocation: 'MIXED',
        ratio: 28/31,
        source: 'LEISTUNGSZEITRAUM',
        note: 'Sozialabgaben Okt 25: 28/31 Alt (vor Stichtag), 3/31 Neu',
      };
    }
    // September Beiträge = ALTMASSE
    if (tx.description.includes('09/25') || tx.description.includes('0925')) {
      return {
        allocation: 'ALTMASSE',
        ratio: 1.0,
        source: 'LEISTUNGSZEITRAUM',
        note: 'Sozialabgaben Sep 25: komplett vor Stichtag',
      };
    }
  }

  // GUTACHTEN - meist für Leistungen vor Stichtag
  if (category === 'GUTACHTEN') {
    // Gutachten im Oktober gezahlt - Leistung vermutlich vorher
    return {
      allocation: null,
      ratio: null,
      source: 'UNKLAR',
      note: 'Gutachten: Leistungsdatum aus Buchung nicht eindeutig ableitbar',
    };
  }

  // INTERN (Überträge zwischen Konten) = NEUTRAL
  if (category === 'INTERN') {
    return {
      allocation: null,
      ratio: null,
      source: 'NEUTRAL',
      note: 'Interne Umbuchung: Keine Alt/Neu-Zuordnung relevant',
    };
  }

  // Default: UNKLAR
  return {
    allocation: null,
    ratio: null,
    source: 'UNKLAR',
    note: 'Automatische Zuordnung nicht möglich',
  };
}

async function importKontoauszug(
  jsonPath: string,
  hvCase: { id: string },
  locMap: Record<string, string>,
  counterpartyMap: Record<string, string>,
  defaultLocationId: string,
  bankAccountId: string | null
) {
  const data: KontoauszugData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const sourceFile = data.sourceFile;

  console.log('\n--- Import:', sourceFile, '---');
  console.log('Bank:', data.account.bank);
  console.log('Transaktionen:', data.transactions.length);

  // Check for duplicates
  const existing = await prisma.ledgerEntry.count({
    where: { caseId: hvCase.id, importSource: sourceFile }
  });
  if (existing > 0) {
    console.log('BEREITS IMPORTIERT:', existing, 'Einträge - ÜBERSPRUNGEN');
    return { imported: 0, skipped: existing };
  }

  let imported = 0;
  for (let i = 0; i < data.transactions.length; i++) {
    const tx = data.transactions[i];

    if (tx.amount === 0) continue;

    const transactionDate = new Date(tx.date);
    const amountCents = Math.round(tx.amount * 100);

    // Location: aus LANR oder default
    let locationId = defaultLocationId;
    if (tx.lanr && ARZT_MAP[tx.lanr]) {
      locationId = locMap[ARZT_MAP[tx.lanr].standort] || defaultLocationId;
    }

    // Counterparty
    let counterpartyId: string | null = null;
    if (tx.category === 'HZV') {
      counterpartyId = counterpartyMap['HAVG (HZV)'] || counterpartyMap['HZV'] || null;
    } else if (tx.category === 'KV') {
      counterpartyId = counterpartyMap['KVNO'] || counterpartyMap['KV'] || null;
    } else if (tx.category === 'PVS') {
      counterpartyId = counterpartyMap['PVS rhein-ruhr'] || counterpartyMap['PVS'] || null;
    }

    // Estate Allocation
    const estate = determineEstateAllocation(tx);

    await prisma.ledgerEntry.create({
      data: {
        caseId: hvCase.id,
        transactionDate,
        amountCents: BigInt(amountCents),
        description: tx.description,
        valueType: 'IST',
        legalBucket: tx.category === 'INTERN' ? 'NEUTRAL' : 'MASSE',
        locationId,
        counterpartyId,
        bankAccountId,
        estateAllocation: estate.allocation,
        estateRatio: estate.ratio,
        allocationSource: estate.source,
        allocationNote: estate.note,
        importSource: sourceFile,
        importRowNumber: i + 1,
        reviewStatus: 'UNREVIEWED',
        createdBy: 'import-hvplus-oktober',
      }
    });
    imported++;
  }

  console.log('Importiert:', imported);
  return { imported, skipped: 0 };
}

async function main() {
  console.log('=== IMPORT: Oktober 2025 Kontoauszüge ===');
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
  const locMap: Record<string, string> = {};
  locations.forEach(l => {
    locMap[l.name] = l.id;
    if (l.shortName) locMap[l.shortName] = l.id;
  });
  console.log('Locations:', Object.keys(locMap).join(', '));

  // Get counterparties
  const counterparties = await prisma.counterparty.findMany({ where: { caseId: hvCase.id } });
  const counterpartyMap: Record<string, string> = {};
  counterparties.forEach(c => { counterpartyMap[c.name] = c.id; });
  console.log('Counterparties:', Object.keys(counterpartyMap).join(', '));

  // Get bank accounts (may not exist yet)
  const bankAccounts = await prisma.bankAccount.findMany({ where: { caseId: hvCase.id } });
  console.log('BankAccounts:', bankAccounts.map(b => b.accountName).join(', ') || '(keine)');
  const velbert = bankAccounts.find(b => b.accountName?.includes('Velbert') || b.bankName?.includes('Sparkasse'));
  const uckerath = bankAccounts.find(b => b.accountName?.includes('Uckerath') || b.bankName?.includes('apoBank'));

  // Import Velbert
  const velResult = await importKontoauszug(
    VELBERT_JSON,
    hvCase,
    locMap,
    counterpartyMap,
    locMap['Velbert'] || locMap['VEL'] || '',
    velbert?.id || null
  );

  // Import Uckerath
  const uckResult = await importKontoauszug(
    UCKERATH_JSON,
    hvCase,
    locMap,
    counterpartyMap,
    locMap['Uckerath'] || locMap['UCK'] || locMap['Uckerath + Eitorf'] || '',
    uckerath?.id || null
  );

  console.log('\n=== ZUSAMMENFASSUNG ===');
  console.log('Velbert:', velResult.imported, 'importiert,', velResult.skipped, 'übersprungen');
  console.log('Uckerath:', uckResult.imported, 'importiert,', uckResult.skipped, 'übersprungen');
  console.log('Gesamt:', velResult.imported + uckResult.imported, 'neue Buchungen');

  // Estate Allocation Statistik
  const stats = await prisma.ledgerEntry.groupBy({
    by: ['estateAllocation'],
    where: {
      caseId: hvCase.id,
      importSource: { in: ['10_Oktober_25_Kontoauszug_MVZVelbert_DE83.pdf', '10_Oktober_25_MVZUckerath_Kontoauszug_DE13.pdf'] }
    },
    _count: { id: true },
    _sum: { amountCents: true }
  });

  console.log('\nEstate Allocation (Oktober):');
  stats.forEach(s => {
    const sumEur = Number(s._sum.amountCents || 0) / 100;
    console.log(`  ${s.estateAllocation || 'UNKLAR'}: ${s._count.id} Buchungen (${sumEur.toLocaleString('de-DE')} EUR)`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
