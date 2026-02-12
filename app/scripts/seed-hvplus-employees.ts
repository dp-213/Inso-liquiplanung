/**
 * Seed-Script: HVPlus Mitarbeiter aus Lohnjournalen importieren
 *
 * Quelle: Cases/Hausärztliche Versorgung PLUS eG/02-extracted/Personal_Lohnjournale_Okt-Dez_2025.json
 * 44 Mitarbeiter, 3 Monate (Okt–Dez 2025), 4 Standorte
 *
 * Ausführung: cd app && npx tsx scripts/seed-hvplus-employees.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const CASE_ID = '2982ff26-081a-4811-8e1e-46b39e1ff757';

const LOCATION_MAP: Record<string, string> = {
  hvplusZentrale: 'loc-hvplus-gesellschaft',
  uckerath: 'loc-haevg-uckerath',
  eitorf: 'loc-haevg-eitorf',
  velbert: 'loc-haevg-velbert',
};

// Standorte die importiert werden (keine Aggregat-Sektionen)
const STANDORT_KEYS = ['hvplusZentrale', 'uckerath', 'eitorf', 'velbert'];

interface MitarbeiterJSON {
  persNr: string;
  name: string;
  vorname: string;
  funktion: string;
  geburtsdatum?: string;
  adresse?: string;
  eintritt?: string;
  austritt?: string;
  svNummer?: string;
  steuerID?: string;
  lanr?: string;
  steuerbrutto: Record<string, number | null>;
  besonderheiten?: string;
}

function parseAddress(adresse: string | undefined): {
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
} {
  if (!adresse) return { street: null, houseNumber: null, postalCode: null, city: null };

  // Format: "Straße Hausnummer, PLZ Ort"
  const commaIdx = adresse.indexOf(',');
  if (commaIdx === -1) return { street: adresse, houseNumber: null, postalCode: null, city: null };

  const streetPart = adresse.substring(0, commaIdx).trim();
  const cityPart = adresse.substring(commaIdx + 1).trim();

  // Straße und Hausnummer trennen (letztes Wort/Zahl nach letztem Leerzeichen)
  const streetMatch = streetPart.match(/^(.+?)\s+(\d+\S*)$/);
  const street = streetMatch ? streetMatch[1] : streetPart;
  const houseNumber = streetMatch ? streetMatch[2] : null;

  // PLZ und Ort trennen
  const cityMatch = cityPart.match(/^(\d{5})\s+(.+)$/);
  const postalCode = cityMatch ? cityMatch[1] : null;
  const city = cityMatch ? cityMatch[2] : cityPart;

  return { street, houseNumber, postalCode, city };
}

function normalizeRole(funktion: string): string {
  // Entferne "(vermutet)" Suffix
  let role = funktion.replace(/\s*\(vermutet.*?\)/g, '').trim();
  // Entferne "(Faktor ...)" Suffix
  role = role.replace(/\s*\(Faktor.*?\)/g, '').trim();
  return role;
}

function eurToCents(eurValue: number): bigint {
  return BigInt(Math.round(eurValue * 100));
}

function toISO(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  // Format: "2025-10-29" → "2025-10-29T00:00:00.000Z"
  return `${dateStr}T00:00:00.000Z`;
}

async function main() {
  const jsonPath = path.resolve(
    __dirname,
    '../../Cases/Hausärztliche Versorgung PLUS eG/02-extracted/Personal_Lohnjournale_Okt-Dez_2025.json'
  );

  if (!fs.existsSync(jsonPath)) {
    console.error('JSON-Datei nicht gefunden:', jsonPath);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  // Prüfe ob Case existiert
  const hvCase = await prisma.case.findUnique({ where: { id: CASE_ID } });
  if (!hvCase) {
    console.error('Case nicht gefunden:', CASE_ID);
    process.exit(1);
  }
  console.log(`Case: ${hvCase.debtorName} (${hvCase.id})`);

  // Prüfe ob Locations existieren
  for (const [key, locId] of Object.entries(LOCATION_MAP)) {
    const loc = await prisma.location.findUnique({ where: { id: locId } });
    if (!loc) {
      console.error(`Location nicht gefunden: ${locId} (${key})`);
      process.exit(1);
    }
    console.log(`  Location: ${loc.name} → ${locId}`);
  }

  // Prüfe ob bereits Mitarbeiter existieren
  const existing = await prisma.employee.count({ where: { caseId: CASE_ID } });
  if (existing > 0) {
    console.log(`\n⚠️  Es existieren bereits ${existing} Mitarbeiter für diesen Fall.`);
    console.log('   Überspringe Import (keine Duplikate erzeugen).');
    console.log('   Zum Neu-Import: erst alle löschen, dann Script erneut ausführen.');
    await prisma.$disconnect();
    return;
  }

  let totalEmployees = 0;
  let totalSalaryMonths = 0;
  let skipped = 0;

  for (const standortKey of STANDORT_KEYS) {
    const standort = data.standorte[standortKey];
    if (!standort?.mitarbeiter) {
      console.warn(`Kein Mitarbeiter-Array für ${standortKey}`);
      continue;
    }

    const locationId = LOCATION_MAP[standortKey];
    console.log(`\n--- ${standort.bezeichnung || standortKey} (${standort.mitarbeiter.length} Mitarbeiter) ---`);

    for (const ma of standort.mitarbeiter as MitarbeiterJSON[]) {
      // Skip Sammelposition
      if (ma.persNr === '06500' || ma.name === '(Sammelposition)') {
        console.log(`  SKIP: ${ma.persNr} ${ma.name} (Sammelposition)`);
        skipped++;
        continue;
      }

      const address = parseAddress(ma.adresse);
      const role = normalizeRole(ma.funktion);

      // isActive: false wenn austritt in der Vergangenheit
      let isActive = true;
      if (ma.austritt) {
        const exitDate = new Date(ma.austritt);
        isActive = exitDate > new Date();
      }

      const employee = await prisma.employee.create({
        data: {
          caseId: CASE_ID,
          personnelNumber: ma.persNr,
          lastName: ma.name,
          firstName: ma.vorname,
          role,
          lanr: ma.lanr || null,
          locationId,
          svNumber: ma.svNummer || null,
          taxId: ma.steuerID || null,
          dateOfBirth: toISO(ma.geburtsdatum) ? new Date(toISO(ma.geburtsdatum)!) : null,
          entryDate: toISO(ma.eintritt) ? new Date(toISO(ma.eintritt)!) : null,
          street: address.street,
          houseNumber: address.houseNumber,
          postalCode: address.postalCode,
          city: address.city,
          isActive,
          notes: ma.besonderheiten || null,
        },
      });

      totalEmployees++;

      // Gehaltsdaten einfügen
      if (ma.steuerbrutto) {
        for (const [monthKey, eurValue] of Object.entries(ma.steuerbrutto)) {
          if (eurValue === null || eurValue === undefined) continue;

          const [yearStr, monthStr] = monthKey.split('-');
          const year = parseInt(yearStr);
          const month = parseInt(monthStr);

          await prisma.employeeSalaryMonth.create({
            data: {
              employeeId: employee.id,
              year,
              month,
              grossSalaryCents: eurToCents(eurValue),
            },
          });

          totalSalaryMonths++;
        }
      }

      const salaryInfo = ma.steuerbrutto
        ? Object.values(ma.steuerbrutto).filter(v => v !== null).length + ' Monate'
        : 'keine Gehaltsdaten';
      console.log(`  ✓ ${ma.persNr} ${ma.name}, ${ma.vorname} (${role}) – ${salaryInfo}`);
    }
  }

  console.log('\n=== ZUSAMMENFASSUNG ===');
  console.log(`Mitarbeiter importiert: ${totalEmployees}`);
  console.log(`Gehalts-Monate importiert: ${totalSalaryMonths}`);
  console.log(`Übersprungen: ${skipped}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Fehler:', e);
  prisma.$disconnect();
  process.exit(1);
});
