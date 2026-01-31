/**
 * Import: November 2025 Kontoauszüge (Velbert + Uckerath)
 *
 * Datenquelle:
 * - 11_November_25_MVZVelbert.json (17 Buchungen, Sparkasse)
 * - 11_November_25_MVZUckerath.json (43 Buchungen, apoBank)
 *
 * Besonderheit November:
 * - apoBank Uckerath wird geschlossen → Mehrere Umbuchungen auf ISK
 * - November ist komplett NACH Stichtag (29.10.2025)
 *
 * Alt/Neu-Zuordnung Regeln:
 * - Kosten November = NEUMASSE (Leistung nach Stichtag)
 * - KV Q4/25 Rate 2 = MIXED (2/3 Neu für Nov+Dez, 1/3 Alt für Okt)
 * - PVS = UNKLAR (Behandlungsdatum aus Buchung nicht ableitbar)
 * - DRV Befundberichte = NEUMASSE (wenn Datum nach 29.10.)
 * - Interne Umbuchungen = NEUTRAL
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();
const CASE_NUMBER = '70d IN 362/25';
const CASES_ROOT = '/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases';
const VELBERT_JSON = CASES_ROOT + '/Hausärztliche Versorgung PLUS eG/02-extracted/11_November_25_MVZVelbert.json';
const UCKERATH_JSON = CASES_ROOT + '/Hausärztliche Versorgung PLUS eG/02-extracted/11_November_25_MVZUckerath.json';

const STICHTAG = new Date('2025-10-29');

interface Transaction {
  date: string;
  counterparty: string;
  description: string;
  amount: number;
  category: string;
  quarter?: string;
  rateNr?: number;
  type?: string;
  note?: string;
}

interface KontoauszugData {
  sourceFile: string;
  account: { bank: string; iban?: string };
  transactions: Transaction[];
}

/**
 * Bestimme Estate Allocation für November
 * November ist komplett NACH Stichtag → Default ist NEUMASSE
 */
function determineEstateAllocation(tx: Transaction): {
  allocation: string | null;
  ratio: number | null;
  source: string;
  note: string;
} {
  const category = tx.category;

  // Interne Umbuchungen = NEUTRAL (keine Alt/Neu-Relevanz)
  if (category === 'INTERN') {
    return {
      allocation: null,
      ratio: null,
      source: 'NEUTRAL',
      note: 'Interne Umbuchung: Keine Alt/Neu-Zuordnung relevant',
    };
  }

  // KV Q4/25 Rate 2 = MIXED (wie Rate 1)
  // Q4 hat 3 Monate: Okt (28/31 Alt), Nov (100% Neu), Dez (100% Neu)
  // Vereinfacht: 1/3 Okt-Anteil * 28/31 = ca. 30% Alt, 70% Neu
  if (category === 'KV' && tx.quarter === 'Q4/2025') {
    return {
      allocation: 'MIXED',
      ratio: 0.7, // 70% Neumasse
      source: 'MASSEKREDITVERTRAG',
      note: 'KV Q4/25 Rate 2: Okt-Anteil teilweise Alt, Nov+Dez-Anteil 100% Neu',
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

  // Gutachten/DRV - November-Zahlung für meist Oktober-Leistung
  // Viele Befundberichte haben Datum im Oktober → ALTMASSE
  if (category === 'GUTACHTEN') {
    // Check description for date hints
    const desc = tx.description.toLowerCase();
    if (desc.includes('10.2025') || desc.includes('okt') || desc.includes('september') || desc.includes('09.2025')) {
      return {
        allocation: 'ALTMASSE',
        ratio: 1.0,
        source: 'LEISTUNGSZEITRAUM',
        note: 'Gutachten: Leistungsdatum vor Stichtag erkennbar',
      };
    }
    // Wenn November-Datum erkennbar
    if (desc.includes('11.2025') || desc.includes('nov')) {
      return {
        allocation: 'NEUMASSE',
        ratio: 1.0,
        source: 'LEISTUNGSZEITRAUM',
        note: 'Gutachten: Leistungsdatum nach Stichtag erkennbar',
      };
    }
    // Sonst UNKLAR
    return {
      allocation: null,
      ratio: null,
      source: 'UNKLAR',
      note: 'Gutachten: Leistungsdatum nicht eindeutig ableitbar',
    };
  }

  // Miete November = NEUMASSE (Nutzung nach Stichtag)
  if (category === 'MIETE') {
    return {
      allocation: 'NEUMASSE',
      ratio: 1.0,
      source: 'LEISTUNGSZEITRAUM',
      note: 'Miete November: Nutzung komplett nach Stichtag',
    };
  }

  // Strom/Kosten November = NEUMASSE (Verbrauch nach Stichtag)
  if (category === 'STROM' || category === 'KOSTEN') {
    return {
      allocation: 'NEUMASSE',
      ratio: 1.0,
      source: 'LEISTUNGSZEITRAUM',
      note: 'Betriebskosten November: Leistung nach Stichtag',
    };
  }

  // Sonstige Einnahmen = UNKLAR
  if (category === 'SONSTIGE_EINNAHME') {
    return {
      allocation: null,
      ratio: null,
      source: 'UNKLAR',
      note: 'Sonstige Einnahme: Zuordnung nicht eindeutig',
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
  sourceFileName: string
) {
  const data: KontoauszugData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const sourceFile = data.sourceFile;

  console.log('\n--- Import:', sourceFile, '---');
  console.log('Bank:', data.account.bank);
  console.log('Transaktionen:', data.transactions.length);

  // Check for existing imports
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

    // Estate Allocation
    const estate = determineEstateAllocation(tx);

    // Counterparty
    let counterpartyId: string | null = null;
    if (tx.category === 'KV') {
      counterpartyId = counterpartyMap['KV Nordrhein'] || counterpartyMap['KVNO'] || null;
    } else if (tx.category === 'PVS') {
      counterpartyId = counterpartyMap['PVS rhein-ruhr'] || null;
    }

    // Legal Bucket
    const legalBucket = tx.category === 'INTERN' ? 'NEUTRAL' : 'MASSE';

    await prisma.ledgerEntry.create({
      data: {
        caseId: hvCase.id,
        transactionDate,
        amountCents: BigInt(amountCents),
        description: tx.description,
        valueType: 'IST',
        legalBucket,
        locationId: defaultLocationId,
        counterpartyId,
        bankAccountId: null,
        estateAllocation: estate.allocation,
        estateRatio: estate.ratio,
        allocationSource: estate.source,
        allocationNote: estate.note,
        importSource: sourceFile,
        importRowNumber: i + 1,
        reviewStatus: 'UNREVIEWED',
        createdBy: 'import-hvplus-november',
      }
    });
    imported++;
  }

  console.log('Importiert:', imported);
  return { imported, skipped: 0 };
}

async function main() {
  console.log('=== IMPORT: November 2025 Kontoauszüge ===');
  console.log('Stichtag Alt/Neu-Masse:', STICHTAG.toISOString().split('T')[0]);
  console.log('November ist komplett NACH Stichtag → Default NEUMASSE');

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

  // Lösche alte November-Daten aus ISK-Quelle (unvollständig)
  console.log('\n--- Bereinige alte November-Daten ---');
  const deleted = await prisma.ledgerEntry.deleteMany({
    where: {
      caseId: hvCase.id,
      valueType: 'IST',
      transactionDate: {
        gte: new Date('2025-11-01'),
        lt: new Date('2025-12-01')
      },
      importSource: {
        not: {
          contains: 'November_25_MVZ'
        }
      }
    }
  });
  console.log('Gelöscht:', deleted.count, 'alte November-Einträge aus ISK-Quelle');

  // Import Velbert
  const velResult = await importKontoauszug(
    VELBERT_JSON,
    hvCase,
    locMap,
    counterpartyMap,
    locMap['Praxis Velbert'] || locMap['Velbert'] || '',
    '11_November_25_Kontoauszug_MVZVelbert_DE83.pdf'
  );

  // Import Uckerath
  const uckResult = await importKontoauszug(
    UCKERATH_JSON,
    hvCase,
    locMap,
    counterpartyMap,
    locMap['Praxis Uckerath'] || locMap['Uckerath'] || '',
    '11_November_25_MVZUckerath_Kontoauszug_DE13.pdf'
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
      transactionDate: {
        gte: new Date('2025-11-01'),
        lt: new Date('2025-12-01')
      },
      valueType: 'IST'
    },
    _count: { id: true },
    _sum: { amountCents: true }
  });

  console.log('\nEstate Allocation (November):');
  stats.forEach(s => {
    const sumEur = Number(s._sum.amountCents || 0) / 100;
    console.log(`  ${s.estateAllocation || 'UNKLAR'}: ${s._count.id} Buchungen (${sumEur.toLocaleString('de-DE')} EUR)`);
  });

  // Verify totals
  console.log('\n=== VERIFIZIERUNG ===');
  const novEntries = await prisma.ledgerEntry.findMany({
    where: {
      caseId: hvCase.id,
      valueType: 'IST',
      transactionDate: {
        gte: new Date('2025-11-01'),
        lt: new Date('2025-12-01')
      }
    },
    include: { location: true }
  });

  const byLoc: Record<string, { count: number, ein: bigint, aus: bigint }> = {};
  for (const e of novEntries) {
    const loc = e.location?.name || 'Ohne';
    if (!byLoc[loc]) byLoc[loc] = { count: 0, ein: BigInt(0), aus: BigInt(0) };
    byLoc[loc].count++;
    if (e.amountCents >= 0) byLoc[loc].ein += e.amountCents;
    else byLoc[loc].aus += e.amountCents;
  }

  for (const [loc, data] of Object.entries(byLoc)) {
    console.log(`${loc}: ${data.count} Buchungen | +${(Number(data.ein)/100).toLocaleString('de-DE')}€ | ${(Number(data.aus)/100).toLocaleString('de-DE')}€`);
  }

  // SOLL-Werte
  console.log('\nSOLL (aus JSONs):');
  console.log('  Velbert: 17 Buchungen | +39.600,51€ | -4.457,50€');
  console.log('  Uckerath: 43 Buchungen | +10.954,41€ | -33.783,53€');
}

main().catch(console.error).finally(() => prisma.$disconnect());
