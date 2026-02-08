/**
 * FIX: LANR → Location Mapping korrigieren
 *
 * Problem: 4 von 8 Ärzten sind falsch zugeordnet (alle → Uckerath)
 * Lösung: SQL UPDATE für die betroffenen LANRs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

// Location-IDs aus Prisma
const LOCATIONS = {
  velbert: '', // wird geladen
  uckerath: '',
  eitorf: ''
};

async function fixLanrLocations() {
  console.log('=== FIX: LANR → Location Mapping ===\n');

  // 1. Lade Location-IDs
  console.log('## 1. Location-IDs laden\n');

  const locations = await prisma.location.findMany({
    where: { caseId }
  });

  for (const loc of locations) {
    if (loc.name.includes('Velbert')) LOCATIONS.velbert = loc.id;
    if (loc.name.includes('Uckerath')) LOCATIONS.uckerath = loc.id;
    if (loc.name.includes('Eitorf')) LOCATIONS.eitorf = loc.id;
  }

  console.log(`   Velbert: ${LOCATIONS.velbert}`);
  console.log(`   Uckerath: ${LOCATIONS.uckerath}`);
  console.log(`   Eitorf: ${LOCATIONS.eitorf}`);

  if (!LOCATIONS.velbert || !LOCATIONS.uckerath || !LOCATIONS.eitorf) {
    throw new Error('Location-IDs konnten nicht geladen werden!');
  }

  // 2. Prüfe Status VORHER
  console.log('\n## 2. Status VORHER\n');

  const lanrMappings = [
    { lanr: '3892462', arzt: 'van Suntum', soll: 'Velbert', locationId: LOCATIONS.velbert },
    { lanr: '8836735', arzt: 'Beyer', soll: 'Velbert', locationId: LOCATIONS.velbert },
    { lanr: '7729639', arzt: 'Kamler', soll: 'Velbert', locationId: LOCATIONS.velbert },
    { lanr: '8898288', arzt: 'Rösing', soll: 'Eitorf', locationId: LOCATIONS.eitorf }
  ];

  for (const mapping of lanrMappings) {
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        caseId,
        valueType: 'IST',
        description: { contains: `LANR ${mapping.lanr}` }
      },
      include: {
        location: { select: { name: true } }
      },
      take: 1
    });

    if (entries.length > 0) {
      const currentLoc = entries[0].location?.name || 'NULL';
      const isCorrect = currentLoc.includes(mapping.soll);
      console.log(`   LANR ${mapping.lanr} (${mapping.arzt}): ${currentLoc} ${isCorrect ? '✅' : '❌'}`);
    }
  }

  // 3. Korrigiere Locations
  console.log('\n## 3. Locations korrigieren\n');

  let totalUpdated = 0;

  for (const mapping of lanrMappings) {
    const result = await prisma.ledgerEntry.updateMany({
      where: {
        caseId,
        valueType: 'IST',
        description: { contains: `LANR ${mapping.lanr}` }
      },
      data: {
        locationId: mapping.locationId
      }
    });

    console.log(`   LANR ${mapping.lanr} (${mapping.arzt} → ${mapping.soll}): ${result.count} Entries aktualisiert`);
    totalUpdated += result.count;
  }

  console.log(`\n   Gesamt aktualisiert: ${totalUpdated} Entries`);

  // 4. Verifiziere NACHHER
  console.log('\n## 4. Verifikation NACHHER\n');

  for (const mapping of lanrMappings) {
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        caseId,
        valueType: 'IST',
        description: { contains: `LANR ${mapping.lanr}` }
      },
      include: {
        location: { select: { name: true } }
      },
      take: 1
    });

    if (entries.length > 0) {
      const currentLoc = entries[0].location?.name || 'NULL';
      const isCorrect = currentLoc.includes(mapping.soll);
      console.log(`   LANR ${mapping.lanr} (${mapping.arzt}): ${currentLoc} ${isCorrect ? '✅' : '❌'}`);

      if (!isCorrect) {
        throw new Error(`Verifikation fehlgeschlagen für LANR ${mapping.lanr}!`);
      }
    }
  }

  // 5. Standort-Verteilung prüfen
  console.log('\n## 5. Standort-Verteilung NACHHER\n');

  const locationDist = await prisma.ledgerEntry.groupBy({
    by: ['locationId'],
    where: { caseId, valueType: 'IST' },
    _count: true
  });

  for (const dist of locationDist) {
    const loc = locations.find(l => l.id === dist.locationId);
    console.log(`   ${loc?.name || 'NULL'}: ${dist._count} Entries`);
  }

  console.log('\n✅ LANR-Locations erfolgreich korrigiert!\n');

  await prisma.$disconnect();
}

fixLanrLocations().catch((error) => {
  console.error('\n❌ FEHLER beim LANR-Fix:');
  console.error(error);
  process.exit(1);
});
