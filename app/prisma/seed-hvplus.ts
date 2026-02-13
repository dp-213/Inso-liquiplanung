/**
 * Seed-Script: HVPlus Dashboard - Phase 1
 *
 * Erstellt Case, Locations, BankAccounts, Counterparties (8 Ärzte + Abrechnungsstellen)
 * und LiquidityPlan mit offenen Lücken.
 *
 * LANR-Quelle: LANR und hvg nummer.png (8 Ärzte, explizites Mapping)
 *
 * WICHTIG:
 * - Setzt SEED_OWNER_EMAIL Env-Variable für Case-Owner
 * - Counterparty.type muss PAYER/SUPPLIER/AUTHORITY/OTHER sein (Schema-Constraint!)
 * - BSNR wird in notes gespeichert, nicht in costCenter
 * - isTopPayer nur für Abrechnungsstellen, nicht für Ärzte
 *
 * Ausführung: SEED_OWNER_EMAIL=admin@example.com npx tsx prisma/seed-hvplus.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// =============================================================================
// CASE CONFIGURATION (angepasst an Turso Production)
// =============================================================================

const CASE_NUMBER = '70d IN 362/25'; // Turso Production Case-Nummer
const DEBTOR_NAME = 'Hausärztliche Versorgung PLUS eG';
const COURT_NAME = 'AG Köln';
const FILING_DATE = new Date('2025-10-29');
const CUTOFF_DATE = new Date('2025-10-29');
const CASE_STATUS = 'OPENED'; // Turso Production Status

// planStartDate = erster voller Monat nach Insolvenzantrag (03.11.2025)
// Perioden sind Monate, IST-Daten beginnen ab 03.11.
const PLAN_START_DATE = new Date('2025-11-01');

// =============================================================================
// LOCATIONS (3 separate wie in Turso Production)
// =============================================================================

const LOCATIONS = [
  { name: 'Praxis Velbert', shortName: 'Velbert', notes: JSON.stringify({ bsnr: '243202000' }) },
  { name: 'Praxis Uckerath', shortName: 'Uckerath', notes: JSON.stringify({ bsnr: '273203300' }) },
  { name: 'Zweigstelle Eitorf', shortName: 'Eitorf', notes: JSON.stringify({ bsnr: '273203300' }) },
];

// =============================================================================
// ÄRZTE (aus LANR und hvg nummer.png - 8 Ärzte!)
// =============================================================================

interface ArztConfig {
  name: string;
  lanr: string;
  haevgId: string;
  standort: 'Velbert' | 'Uckerath' | 'Eitorf';
}

const AERZTE: ArztConfig[] = [
  // Velbert (3 Ärzte)
  { name: 'Dr. Thomas van Suntum', lanr: '3892462', haevgId: '055425', standort: 'Velbert' },
  { name: 'Dr. Thomas Beyer', lanr: '8836735', haevgId: '067026', standort: 'Velbert' },
  { name: 'Dr. Martina Kamler', lanr: '7729639', haevgId: '083974', standort: 'Velbert' },
  // Eitorf (1 Arzt - läuft über Uckerath)
  { name: 'Dr. Rösing', lanr: '8898288', haevgId: '036131', standort: 'Eitorf' },
  // Uckerath (4 Ärzte)
  { name: 'Dr. Kathrin Binas', lanr: '1445587', haevgId: '132025', standort: 'Uckerath' },
  { name: 'Dr. Annette Schweitzer', lanr: '1203618', haevgId: '132049', standort: 'Uckerath' },
  { name: 'Anja Fischer', lanr: '3243603', haevgId: '132052', standort: 'Uckerath' },
  { name: 'Verena Ludwig', lanr: '4652451', haevgId: '132064', standort: 'Uckerath' },
];

// =============================================================================
// ABRECHNUNGSSTELLEN (Namen wie in Turso Production)
// =============================================================================

const SETTLERS = [
  { name: 'KV Nordrhein', shortName: 'KVNO', type: 'PAYER', matchPattern: '(\\bKV\\b|KVNO|Kassenärztliche)' },
  { name: 'HZV-Vertrag', shortName: 'HAVG', type: 'PAYER', matchPattern: 'HAVG|HZV|Hausarzt' },
  { name: 'PVS rhein-ruhr', shortName: 'PVS', type: 'PAYER', matchPattern: 'PVS|Privatabrechnung' },
];

// =============================================================================
// BANKKONTEN (ISK) - locationKey angepasst an neue shortNames
// =============================================================================

const BANK_ACCOUNTS = [
  {
    name: 'ISK Uckerath',
    iban: 'DE91600501010400080156',
    bankName: 'BW Bank',
    accountType: 'ISK',
    locationKey: 'Uckerath',
  },
  {
    name: 'ISK Velbert',
    iban: 'DE87600501010400080228',
    bankName: 'BW Bank',
    accountType: 'ISK',
    locationKey: 'Velbert',
  },
];

// =============================================================================
// OFFENE LÜCKEN (PlanningAssumptions)
// riskLevel gem. Schema: conservative, low, medium, high, aggressive
// =============================================================================

const PLANNING_GAPS = [
  {
    title: 'Dauerschuldverhältnisse noch zu analysieren',
    source: 'Datenraum - noch zu analysieren',
    description:
      'Laufende Kosten (Miete, Strom, etc.) noch nicht aus Datenraum extrahiert. Quelle: Aufstellung Dauerschuldverhältnisse.xlsx',
    status: 'ANNAHME',
  },
  {
    title: 'Pre-Insolvency IST-Daten fehlen',
    source: 'Sparkasse/apoBank Jan-Okt 2025',
    description:
      'Sparkasse/ApoBank Jan-Okt 2025 für Vergleich noch nicht importiert. Für IST vs PLAN Abweichungsanalyse erforderlich.',
    status: 'ANNAHME',
  },
  {
    title: 'apoBank Vereinbarung ausstehend',
    source: 'Verhandlungen laufend',
    description:
      'KEINE Vereinbarung mit apoBank - KV-Zahlungen für Uckerath/Eitorf evtl. blockiert. Status: Verhandlungen laufen.',
    status: 'ANNAHME',
    linkedModule: 'banken',
  },
  {
    title: 'Dr. Martina Kamler in IST-Daten verifizieren',
    source: 'LANR und hvg nummer.png',
    description:
      'Neu identifiziert aus LANR-Liste (Velbert, LANR 7729639) - in IST-Daten verifizieren ob HZV-Zahlungen eingehen.',
    status: 'ANNAHME',
    linkedModule: 'personal',
  },
];

// =============================================================================
// MAIN SEED FUNCTION
// =============================================================================

async function seed() {
  console.log('='.repeat(60));
  console.log('SEED: HVPlus Dashboard - Phase 1');
  console.log('='.repeat(60));

  // 1. Find existing owner (KEIN Erstellen von Auth-Usern!)
  console.log('\n1. Suche Owner-User...');
  const ownerEmail = process.env.SEED_OWNER_EMAIL;

  if (!ownerEmail) {
    console.error('   FEHLER: SEED_OWNER_EMAIL nicht gesetzt!');
    console.error('   Ausführung: SEED_OWNER_EMAIL=admin@example.com npx tsx prisma/seed-hvplus.ts');
    console.error('   Oder: Existierenden CustomerUser verwenden');
    process.exit(1);
  }

  let ownerUser = await prisma.customerUser.findFirst({
    where: { email: ownerEmail },
  });

  if (!ownerUser) {
    // Fallback: ersten aktiven CustomerUser nehmen
    console.log(`   User ${ownerEmail} nicht gefunden, suche ersten aktiven User...`);
    ownerUser = await prisma.customerUser.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  if (!ownerUser) {
    console.error('   FEHLER: Kein aktiver CustomerUser gefunden!');
    console.error('   Bitte zuerst einen CustomerUser anlegen.');
    process.exit(1);
  }
  console.log(`   Owner-User: ${ownerUser.email} (${ownerUser.id})`);

  // 2. Create or update Case
  console.log('\n2. Erstelle/Update Case...');
  const hvplusCase = await prisma.case.upsert({
    where: { caseNumber: CASE_NUMBER },
    update: {
      debtorName: DEBTOR_NAME,
      courtName: COURT_NAME,
      filingDate: FILING_DATE,
      cutoffDate: CUTOFF_DATE,
      updatedBy: 'seed-hvplus',
    },
    create: {
      caseNumber: CASE_NUMBER,
      debtorName: DEBTOR_NAME,
      courtName: COURT_NAME,
      filingDate: FILING_DATE,
      cutoffDate: CUTOFF_DATE,
      status: CASE_STATUS, // OPENED wie in Turso Production
      ownerId: ownerUser.id,
      createdBy: 'seed-hvplus',
      updatedBy: 'seed-hvplus',
    },
  });
  console.log(`   Case: ${hvplusCase.debtorName} (${hvplusCase.id})`);

  // 3. Create Locations (BSNR in notes, nicht costCenter)
  console.log('\n3. Erstelle Locations...');
  const locationMap: Record<string, string> = {};

  for (const loc of LOCATIONS) {
    const existingLocation = await prisma.location.findFirst({
      where: { caseId: hvplusCase.id, shortName: loc.shortName },
    });

    if (existingLocation) {
      locationMap[loc.shortName] = existingLocation.id;
      console.log(`   [EXISTS] ${loc.name} (${existingLocation.id})`);
    } else {
      const newLocation = await prisma.location.create({
        data: {
          caseId: hvplusCase.id,
          name: loc.name,
          shortName: loc.shortName,
          notes: loc.notes, // BSNR in notes JSON statt costCenter
          createdBy: 'seed-hvplus',
        },
      });
      locationMap[loc.shortName] = newLocation.id;
      console.log(`   [CREATED] ${loc.name} (${newLocation.id})`);
    }
  }

  // Map standort to location (angepasst an neue shortNames)
  const standortToLocation: Record<string, string> = {
    Velbert: locationMap['Velbert'],
    Uckerath: locationMap['Uckerath'],
    Eitorf: locationMap['Eitorf'],
  };

  // 4. Create BankAccounts
  console.log('\n4. Erstelle BankAccounts...');
  const bankAccountMap: Record<string, string> = {};

  for (const bank of BANK_ACCOUNTS) {
    const existingBank = await prisma.bankAccount.findFirst({
      where: { caseId: hvplusCase.id, iban: bank.iban },
    });

    if (existingBank) {
      bankAccountMap[bank.locationKey] = existingBank.id;
      console.log(`   [EXISTS] ${bank.name} (${existingBank.id})`);
    } else {
      const newBank = await prisma.bankAccount.create({
        data: {
          caseId: hvplusCase.id,
          bankName: bank.bankName,
          accountName: bank.name,
          iban: bank.iban,
          openingBalanceCents: BigInt(0),
          status: 'available',
          createdBy: 'seed-hvplus',
          updatedBy: 'seed-hvplus',
        },
      });
      bankAccountMap[bank.locationKey] = newBank.id;
      console.log(`   [CREATED] ${bank.name} (${newBank.id})`);
    }
  }

  // 5. ÄRZTE DEAKTIVIERT - Production hat keine Ärzte als Counterparties
  // Falls später gewünscht, hier aktivieren und AERZTE-Konstante wieder einbinden
  console.log('\n5. Ärzte als Counterparties: ÜBERSPRUNGEN (nicht in Production)');
  const arztMap: Record<string, string> = {};
  // standortToLocation wird für späteren Gebrauch behalten
  void standortToLocation;

  // 6. Create Counterparties - Abrechnungsstellen (type: PAYER, isTopPayer: true)
  console.log('\n6. Erstelle Abrechnungsstellen als Counterparties...');
  const settlerMap: Record<string, string> = {};

  for (const settler of SETTLERS) {
    const existingSettler = await prisma.counterparty.findFirst({
      where: {
        caseId: hvplusCase.id,
        shortName: settler.shortName,
        type: settler.type,
      },
    });

    if (existingSettler) {
      settlerMap[settler.shortName] = existingSettler.id;
      console.log(`   [EXISTS] ${settler.name}`);
    } else {
      const newSettler = await prisma.counterparty.create({
        data: {
          caseId: hvplusCase.id,
          name: settler.name,
          shortName: settler.shortName,
          type: settler.type, // PAYER gem. Schema
          matchPattern: settler.matchPattern, // Für Auto-Matching
          isTopPayer: true, // NUR Abrechnungsstellen als TopPayer
          createdBy: 'seed-hvplus',
        },
      });
      settlerMap[settler.shortName] = newSettler.id;
      console.log(`   [CREATED] ${settler.name}`);
    }
  }

  // 7. Create LiquidityPlan
  // planStartDate = 01.11.2025 (erster voller Monat, IST-Daten beginnen 03.11.)
  console.log('\n7. Erstelle LiquidityPlan...');
  let hvplusPlan = await prisma.liquidityPlan.findFirst({
    where: { caseId: hvplusCase.id, isActive: true },
  });

  if (hvplusPlan) {
    console.log(`   [EXISTS] ${hvplusPlan.name} (${hvplusPlan.id})`);
  } else {
    hvplusPlan = await prisma.liquidityPlan.create({
      data: {
        caseId: hvplusCase.id,
        name: 'Liquiditätsplanung 2026',
        description: 'HVPlus Liquiditätsplanung ab Insolvenz (03.11.2025). Perioden = Monate, IST beginnt 03.11.',
        planStartDate: PLAN_START_DATE, // 01.11.2025
        periodType: 'MONTHLY',
        periodCount: 10,
        isActive: true,
        createdBy: 'seed-hvplus',
        updatedBy: 'seed-hvplus',
      },
    });
    console.log(`   [CREATED] ${hvplusPlan.name} (${hvplusPlan.id})`);
  }

  // 8. Create PlanningAssumptions (Case-Level)
  console.log('\n8. Erstelle Planungsannahmen (PlanningAssumptions)...');

  for (const gap of PLANNING_GAPS) {
    const existingGap = await prisma.planningAssumption.findFirst({
      where: {
        caseId: hvplusCase.id,
        title: gap.title,
      },
    });

    if (existingGap) {
      console.log(`   [EXISTS] ${gap.title}`);
    } else {
      await prisma.planningAssumption.create({
        data: {
          caseId: hvplusCase.id,
          title: gap.title,
          source: gap.source,
          description: gap.description,
          status: gap.status,
          linkedModule: ('linkedModule' in gap) ? (gap as { linkedModule: string }).linkedModule : null,
          createdBy: 'seed-hvplus',
          updatedBy: 'seed-hvplus',
        },
      });
      console.log(`   [CREATED] ${gap.title}`);
    }
  }

  // 9. Summary
  console.log('\n' + '='.repeat(60));
  console.log('SEED ABGESCHLOSSEN (Struktur wie Turso Production)');
  console.log('='.repeat(60));
  console.log(`
Case:           ${hvplusCase.caseNumber} (Status: ${CASE_STATUS})
Locations:      ${Object.keys(locationMap).length} (Velbert, Uckerath, Eitorf)
BankAccounts:   ${Object.keys(bankAccountMap).length}
Counterparties: ${Object.keys(settlerMap).length} (nur Abrechnungsstellen)
LiquidityPlan:  ${hvplusPlan.name}
Lücken:         ${PLANNING_GAPS.length}
`);

  // Export IDs for use in import scripts
  console.log('\n--- IDs für Import-Scripts ---');
  console.log(`CASE_ID="${hvplusCase.id}"`);
  console.log(`PLAN_ID="${hvplusPlan.id}"`);
  console.log(`LOCATION_VELBERT="${locationMap['Velbert']}"`);
  console.log(`LOCATION_UCKERATH="${locationMap['Uckerath']}"`);
  console.log(`LOCATION_EITORF="${locationMap['Eitorf']}"`);
  console.log(`BANK_VELBERT="${bankAccountMap['Velbert']}"`);
  console.log(`BANK_UCKERATH="${bankAccountMap['Uckerath']}"`);
}

// =============================================================================
// EXECUTE
// =============================================================================

seed()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
