import prisma from '../lib/db';

/**
 * Bulk-Accept: Übernimmt suggestedCounterpartyId und suggestedLocationId
 * in die finalen Felder counterpartyId und locationId
 */
async function bulkAcceptSuggestions() {
  const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

  console.log('\n=== BULK-ACCEPT: Suggestions → Final ===\n');

  // SCHRITT 1: CounterpartyId
  console.log('SCHRITT 1: Akzeptiere suggestedCounterpartyId...\n');

  const withCPSuggestion = await prisma.ledgerEntry.count({
    where: {
      caseId,
      valueType: 'IST',
      suggestedCounterpartyId: { not: null },
      counterpartyId: null, // Noch nicht akzeptiert
    },
  });

  console.log(`${withCPSuggestion} Einträge mit Counterparty-Vorschlag`);

  const cpUpdated = await prisma.ledgerEntry.updateMany({
    where: {
      caseId,
      valueType: 'IST',
      suggestedCounterpartyId: { not: null },
      counterpartyId: null,
    },
    data: {
      // Kopiere suggestedCounterpartyId nach counterpartyId
      // HINWEIS: SQL-Update nötig, da Prisma keine Feld-zu-Feld-Kopie unterstützt
    },
  });

  console.log(`✓ ${cpUpdated.count} Counterparty-Vorschläge übernommen\n`);

  // SCHRITT 2: LocationId (via SQL, da Prisma kein Feld-zu-Feld unterstützt)
  console.log('SCHRITT 2: Akzeptiere suggestedLocationId...\n');

  const withLocSuggestion = await prisma.ledgerEntry.count({
    where: {
      caseId,
      valueType: 'IST',
      suggestedLocationId: { not: null },
      locationId: null,
    },
  });

  console.log(`${withLocSuggestion} Einträge mit Location-Vorschlag`);

  // SQL-Update (Prisma unterstützt kein SET field = other_field)
  await prisma.$executeRawUnsafe(`
    UPDATE ledger_entries
    SET counterpartyId = suggestedCounterpartyId,
        locationId = suggestedLocationId
    WHERE caseId = '${caseId}'
      AND valueType = 'IST'
      AND (suggestedCounterpartyId IS NOT NULL OR suggestedLocationId IS NOT NULL)
      AND (counterpartyId IS NULL OR locationId IS NULL);
  `);

  console.log(`✓ Alle Vorschläge übernommen\n`);

  // STATISTIK
  const stats = {
    withCounterparty: await prisma.ledgerEntry.count({
      where: { caseId, valueType: 'IST', counterpartyId: { not: null } },
    }),
    withLocation: await prisma.ledgerEntry.count({
      where: { caseId, valueType: 'IST', locationId: { not: null } },
    }),
    total: await prisma.ledgerEntry.count({
      where: { caseId, valueType: 'IST' },
    }),
  };

  console.log('=== FINALE STATISTIK ===\n');
  console.log(`Total IST-Einträge:       ${stats.total}`);
  console.log(`Mit counterpartyId:       ${stats.withCounterparty} (${((stats.withCounterparty / stats.total) * 100).toFixed(1)}%)`);
  console.log(`Mit locationId:           ${stats.withLocation} (${((stats.withLocation / stats.total) * 100).toFixed(1)}%)`);

  const withEstateRatio = await prisma.ledgerEntry.count({
    where: { caseId, valueType: 'IST', estateRatio: { not: null } },
  });
  console.log(`Mit estateRatio:          ${withEstateRatio} (${((withEstateRatio / stats.total) * 100).toFixed(1)}%)`);

  // Gruppierung nach Location
  console.log('\n=== NACH LOCATION ===\n');
  const byLocation = await prisma.ledgerEntry.groupBy({
    by: ['locationId'],
    where: { caseId, valueType: 'IST' },
    _count: true,
  });

  for (const group of byLocation) {
    if (group.locationId) {
      const loc = await prisma.location.findUnique({
        where: { id: group.locationId },
        select: { name: true },
      });
      console.log(`${loc?.name}: ${group._count} Einträge`);
    } else {
      console.log(`OHNE Location: ${group._count} Einträge`);
    }
  }

  await prisma.$disconnect();
}

bulkAcceptSuggestions().catch(console.error);
