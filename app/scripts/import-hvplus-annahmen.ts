/**
 * Import: Standort-Prognosen (Annahmen) für HVPlus
 *
 * Quellen:
 * - Annahme_Einnahmen_bis_Juni26.json (Uckerath + Velbert Prognosen)
 * - Velbert_Annahme_Einnahmen_bis_31.03.2026.json (aktualisierte Velbert-Daten)
 *
 * Diese Daten sind PLAN-Daten mit Standort- und Kategorie-Auflösung.
 * Wir importieren aus "Stand 20.01.2026_Velbert" da dieser aktueller ist.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();
const CASE_NUMBER = '70d IN 362/25';
const CASES_ROOT = '/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases';

// Quell-Dateien
const ANNAHME_PATH = CASES_ROOT + '/Hausärztliche Versorgung PLUS eG/02-extracted/Annahme_Einnahmen_bis_Juni26.json';
const VELBERT_PATH = CASES_ROOT + '/Hausärztliche Versorgung PLUS eG/02-extracted/Velbert_Annahme_Einnahmen_bis_31.03.2026.json';

interface ParsedEntry {
  transactionDate: Date;
  amountCents: number;
  description: string;
  locationKey: string;
  counterpartyKey: 'HAVG' | 'KVNO' | 'PVS' | null;
  category: string;
}

async function main() {
  console.log('=== IMPORT: HVPlus Standort-Prognosen (Annahmen) ===\n');

  // Find case
  const hvCase = await prisma.case.findFirst({ where: { caseNumber: CASE_NUMBER } });
  if (!hvCase) { console.error('Case nicht gefunden!'); return; }
  console.log('Case:', hvCase.debtorName);

  // Get locations
  const locations = await prisma.location.findMany({ where: { caseId: hvCase.id } });
  const locMap: Record<string, string> = {};
  locations.forEach(l => { locMap[l.shortName || l.name] = l.id; });
  console.log('Locations:', Object.keys(locMap).join(', '));

  // Get counterparties
  const counterparties = await prisma.counterparty.findMany({ where: { caseId: hvCase.id } });
  const cpMap: Record<string, string> = {};
  counterparties.forEach(cp => { if (cp.shortName) cpMap[cp.shortName] = cp.id; });
  console.log('Counterparties:', Object.keys(cpMap).join(', '));

  // Check for existing imports
  const existingAnnahme = await prisma.ledgerEntry.count({
    where: { caseId: hvCase.id, importSource: { startsWith: 'Annahme_Einnahmen' } }
  });
  const existingVelbert = await prisma.ledgerEntry.count({
    where: { caseId: hvCase.id, importSource: { startsWith: 'Velbert_Annahme' } }
  });

  if (existingAnnahme > 0 || existingVelbert > 0) {
    console.log('\nBEREITS IMPORTIERT:');
    if (existingAnnahme > 0) console.log('  - Annahme_Einnahmen:', existingAnnahme, 'Einträge');
    if (existingVelbert > 0) console.log('  - Velbert_Annahme:', existingVelbert, 'Einträge');
    console.log('\nÜberspringe Import um Duplikate zu vermeiden.');
    return;
  }

  const entries: ParsedEntry[] = [];

  // =====================================================
  // 1. Parse Uckerath-Daten aus Annahme_Einnahmen
  // =====================================================
  console.log('\n1. Parse Uckerath-Prognosen...');
  const annahmeData = JSON.parse(fs.readFileSync(ANNAHME_PATH, 'utf-8'));
  const annahmeRows = annahmeData.sheets['Tabelle1'].preview_rows as string[][];

  let currentStandort: string | null = null;
  for (let i = 0; i < annahmeRows.length; i++) {
    const row = annahmeRows[i];

    // Detect Standort header
    if (row[1] === 'Uckerath' || row[1] === 'Velbert') {
      currentStandort = row[1];
      continue;
    }

    // Skip header rows and summary
    if (!row[2] || row[2] === 'Gesamt' || row[2].includes('Annahme')) continue;

    // Only process Uckerath data from this file (Velbert comes from updated file)
    if (currentStandort !== 'Uckerath') continue;

    // Parse date
    const dateStr = String(row[2]).trim();
    let transactionDate: Date | null = null;

    if (dateStr.includes('00:00:00')) {
      transactionDate = new Date(dateStr.replace(' 00:00:00', ''));
    } else if (dateStr.includes('Mitte Jan')) {
      transactionDate = new Date('2026-01-15');
    } else if (dateStr.includes('Mitte April')) {
      transactionDate = new Date('2026-04-15');
    } else if (dateStr.includes('Mitte Jul')) {
      transactionDate = new Date('2026-07-15');
    }

    if (!transactionDate) continue;

    // HZV (column 3)
    const hzv = parseFloat(String(row[3] || '0').replace(',', '.'));
    if (hzv > 0) {
      const zahlungFuer = String(row[4] || '').trim();
      entries.push({
        transactionDate,
        amountCents: Math.round(hzv * 100),
        description: `ANNAHME HZV Uckerath${zahlungFuer ? ' (' + zahlungFuer + ')' : ''}`,
        locationKey: 'Uckerath',
        counterpartyKey: 'HAVG',
        category: 'HZV'
      });
    }

    // KV (column 5)
    const kv = parseFloat(String(row[5] || '0').replace(',', '.'));
    if (kv > 0) {
      const zahlungFuer = String(row[6] || '').trim();
      entries.push({
        transactionDate,
        amountCents: Math.round(kv * 100),
        description: `ANNAHME KV Uckerath${zahlungFuer ? ' (' + zahlungFuer + ')' : ''}`,
        locationKey: 'Uckerath',
        counterpartyKey: 'KVNO',
        category: 'KV'
      });
    }

    // PVS (column 7)
    const pvs = parseFloat(String(row[7] || '0').replace(',', '.'));
    if (pvs > 0) {
      const zahlungFuer = String(row[8] || '').trim();
      entries.push({
        transactionDate,
        amountCents: Math.round(pvs * 100),
        description: `ANNAHME PVS Uckerath${zahlungFuer ? ' (' + zahlungFuer + ')' : ''}`,
        locationKey: 'Uckerath',
        counterpartyKey: 'PVS',
        category: 'PVS'
      });
    }
  }
  console.log('   Uckerath-Einträge:', entries.length);

  // =====================================================
  // 2. Parse Velbert-Daten aus aktualisierter Datei
  // =====================================================
  console.log('\n2. Parse Velbert-Prognosen (Stand 20.01.2026)...');
  const velvertData = JSON.parse(fs.readFileSync(VELBERT_PATH, 'utf-8'));
  const velvertRows = velvertData.sheets['Stand 20.01.2026_Velbert'].preview_rows as string[][];

  const uckerathCount = entries.length;

  for (let i = 1; i < velvertRows.length; i++) {
    const row = velvertRows[i];

    // Skip empty, summary or header rows
    if (!row[1] || row[1] === '' || String(row[1]).includes('Gesamt') || String(row[1]).includes('Q')) continue;

    const dateStr = String(row[1]).trim();
    let transactionDate: Date | null = null;
    let dateNote = '';

    if (dateStr.includes('00:00:00')) {
      transactionDate = new Date(dateStr.replace(' 00:00:00', ''));
    } else if (dateStr.includes('Schlusszahlung Q3-2025 Mitte Dez')) {
      transactionDate = new Date('2025-12-15');
      dateNote = 'HZV Schlusszahlung Q3-2025';
    } else if (dateStr.includes('Mitte Jan')) {
      transactionDate = new Date('2026-01-15');
      dateNote = 'KVNO Restzahlung Q3/25';
    } else if (dateStr.includes('Schlusszahlung Q4-2025 Mitte März')) {
      transactionDate = new Date('2026-03-15');
      dateNote = 'HZV Schlusszahlung Q4-2025';
    } else if (dateStr.includes('Mitte April')) {
      transactionDate = new Date('2026-04-15');
      dateNote = 'KVNO Restzahlung Q4/2025';
    } else if (dateStr.includes('Schlusszahlung Q1-2026 Mitte Juni')) {
      transactionDate = new Date('2026-06-15');
      dateNote = 'HZV Schlusszahlung Q1-2026';
    } else if (dateStr.includes('Mitte Juli')) {
      transactionDate = new Date('2026-07-15');
      dateNote = 'KVNO Restzahlung Q1-2026';
    }

    if (!transactionDate) continue;

    // HZV (column 2)
    const hzv = parseFloat(String(row[2] || '0').replace(',', '.'));
    if (hzv !== 0) { // Allow negative values
      entries.push({
        transactionDate,
        amountCents: Math.round(hzv * 100),
        description: `ANNAHME HZV Velbert${dateNote ? ' (' + dateNote + ')' : ''}`,
        locationKey: 'Velbert',
        counterpartyKey: 'HAVG',
        category: 'HZV'
      });
    }

    // KV (column 3)
    const kv = parseFloat(String(row[3] || '0').replace(',', '.'));
    if (kv !== 0) { // Allow negative values
      entries.push({
        transactionDate,
        amountCents: Math.round(kv * 100),
        description: `ANNAHME KV Velbert${dateNote ? ' (' + dateNote + ')' : ''}`,
        locationKey: 'Velbert',
        counterpartyKey: 'KVNO',
        category: 'KV'
      });
    }

    // PVS (column 4)
    const pvs = parseFloat(String(row[4] || '0').replace(',', '.'));
    if (pvs > 0) {
      entries.push({
        transactionDate,
        amountCents: Math.round(pvs * 100),
        description: `ANNAHME PVS Velbert`,
        locationKey: 'Velbert',
        counterpartyKey: 'PVS',
        category: 'PVS'
      });
    }
  }
  console.log('   Velbert-Einträge:', entries.length - uckerathCount);

  // =====================================================
  // 3. Create LedgerEntries
  // =====================================================
  console.log('\n3. Erstelle LedgerEntries...');

  let created = 0;
  for (const entry of entries) {
    const locationId = locMap[entry.locationKey] || null;
    const counterpartyId = entry.counterpartyKey ? cpMap[entry.counterpartyKey] : null;

    await prisma.ledgerEntry.create({
      data: {
        caseId: hvCase.id,
        transactionDate: entry.transactionDate,
        amountCents: BigInt(entry.amountCents),
        description: entry.description,
        valueType: 'PLAN', // Annahmen sind PLAN-Daten
        legalBucket: 'MASSE',
        locationId,
        counterpartyId,
        estateAllocation: null, // Wie Turso Production
        importSource: entry.locationKey === 'Uckerath'
          ? 'Annahme_Einnahmen_bis_Juni26'
          : 'Velbert_Annahme_20260120',
        importRowNumber: created + 1,
        reviewStatus: 'UNREVIEWED', // Annahmen müssen noch bestätigt werden
        createdBy: 'import-hvplus-annahmen',
      }
    });
    created++;
  }

  // Summary
  console.log('\n=== IMPORT ABGESCHLOSSEN ===');
  console.log('Importiert:', created, 'Annahme-Buchungen');

  // Breakdown by location
  const byLocation: Record<string, number> = {};
  entries.forEach(e => {
    byLocation[e.locationKey] = (byLocation[e.locationKey] || 0) + 1;
  });
  console.log('\nNach Standort:');
  Object.entries(byLocation).forEach(([loc, count]) => {
    console.log(`  ${loc}: ${count}`);
  });

  // Breakdown by category
  const byCategory: Record<string, number> = {};
  entries.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + 1;
  });
  console.log('\nNach Kategorie:');
  Object.entries(byCategory).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
