/**
 * Import: 2025-11-19_Kontoauszug.json - HZV-Einzelbuchungen
 * 66 Einträge mit LANR, Arzt, Standort, Krankenkasse
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();
const CASE_NUMBER = '70d IN 362/25';
const CASES_ROOT = '/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases';
const JSON_PATH = CASES_ROOT + '/Hausärztliche Versorgung PLUS eG/02-extracted/2025-11-19_Kontoauszug.json';

async function main() {
  console.log('=== IMPORT: HZV-Kontoauszug Nov 2025 ===\n');
  
  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
  const sheet = data.sheets['HVPlus Export EInzahlungen'];
  const rows = sheet.preview_rows as string[][];
  
  console.log('Zeilen:', rows.length - 1);
  
  // Find case
  const hvCase = await prisma.case.findFirst({ where: { caseNumber: CASE_NUMBER } });
  if (!hvCase) { console.error('Case nicht gefunden!'); return; }
  console.log('Case:', hvCase.debtorName);
  
  // Get locations
  const locations = await prisma.location.findMany({ where: { caseId: hvCase.id } });
  const locMap: Record<string, string> = {};
  locations.forEach(l => { locMap[l.shortName || l.name] = l.id; });
  console.log('Locations:', Object.keys(locMap).join(', '));
  
  // Get HZV counterparty
  const hzv = await prisma.counterparty.findFirst({ 
    where: { caseId: hvCase.id, name: { contains: 'HZV' } }
  });
  
  // Check existing entries to avoid duplicates
  const existing = await prisma.ledgerEntry.count({
    where: { caseId: hvCase.id, importSource: '2025-11-19_Kontoauszug' }
  });
  if (existing > 0) {
    console.log('BEREITS IMPORTIERT:', existing, 'Einträge');
    return;
  }
  
  let created = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const datum = row[1]; // Datum
    const lanr = row[4];  // LANR
    const arzt = row[5];  // Arzt
    const standort = row[6]; // Standort
    const kk = row[7];    // Krankenkasse
    const zeitraum = row[8]; // Zeitraum
    const betrag = parseFloat(String(row[9]).replace(',', '.')) || 0;
    
    if (!datum || betrag === 0) continue;
    
    const transactionDate = new Date(datum.replace(' 00:00:00', ''));
    const amountCents = Math.round(betrag * 100);
    const locationId = locMap[standort] || locMap['Uckerath'] || null;
    
    await prisma.ledgerEntry.create({
      data: {
        caseId: hvCase.id,
        transactionDate,
        amountCents: BigInt(amountCents),
        description: 'HZV ' + kk + ' ' + zeitraum + ' - ' + arzt + ' (LANR ' + lanr + ')',
        valueType: 'IST',
        legalBucket: 'MASSE',
        locationId,
        counterpartyId: hzv?.id || null,
        estateAllocation: null,
        importSource: '2025-11-19_Kontoauszug',
        importRowNumber: i,
        reviewStatus: 'UNREVIEWED',
        createdBy: 'import-hvplus-kontoauszug',
      }
    });
    created++;
  }
  
  console.log('\nImportiert:', created, 'HZV-Buchungen');
}

main().catch(console.error).finally(() => prisma.$disconnect());
