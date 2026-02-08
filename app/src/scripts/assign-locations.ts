import prisma from '../lib/db';

/**
 * Weist locationId zu allen IST-Einträgen basierend auf:
 * 1. BankAccountId → Location (aus bank_accounts.locationId)
 * 2. LANR (aus description) → Location
 */
async function assignLocations() {
  const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

  // STRATEGIE 1: Aus BankAccountId
  console.log('\n=== STRATEGIE 1: LocationId aus BankAccountId ===\n');

  // Lade alle IST-Einträge ohne locationId
  const entriesWithoutLocation = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      locationId: null,
    },
    include: {
      bankAccount: {
        select: { locationId: true, accountName: true },
      },
    },
  });

  console.log(`${entriesWithoutLocation.length} Einträge ohne locationId gefunden`);

  let fromBankAccount = 0;

  for (const entry of entriesWithoutLocation) {
    if (entry.bankAccount?.locationId) {
      await prisma.ledgerEntry.update({
        where: { id: entry.id },
        data: {
          suggestedLocationId: entry.bankAccount.locationId,
          suggestedReason: entry.suggestedReason
            ? `${entry.suggestedReason} | Location aus BankAccount "${entry.bankAccount.accountName}"`
            : `Location aus BankAccount "${entry.bankAccount.accountName}"`,
        },
      });
      fromBankAccount++;
    }
  }

  console.log(`✓ ${fromBankAccount} Einträge: locationId aus BankAccount zugeordnet\n`);

  // STRATEGIE 2: Aus LANR (für HZV-Zahlungen)
  console.log('=== STRATEGIE 2: LocationId aus LANR ===\n');

  const lanrMapping: Record<string, { location: string; arzt: string }> = {
    '3892462': { location: 'loc-haevg-velbert', arzt: 'van Suntum' },
    '8836735': { location: 'loc-haevg-velbert', arzt: 'Beyer' },
    // Uckerath/Eitorf - UNKLAR, da im lanr-mapping.json nicht eindeutig
    // Setze erstmal auf Uckerath (Standard)
    '1445587': { location: 'loc-haevg-uckerath', arzt: 'UNBEKANNT (LANR 1445587)' },
    '8898288': { location: 'loc-haevg-uckerath', arzt: 'UNBEKANNT (LANR 8898288)' },
    '1203618': { location: 'loc-haevg-uckerath', arzt: 'UNBEKANNT (LANR 1203618)' },
    '3243603': { location: 'loc-haevg-uckerath', arzt: 'UNBEKANNT (LANR 3243603)' },
    '4652451': { location: 'loc-haevg-uckerath', arzt: 'UNBEKANNT (LANR 4652451)' },
  };

  const entriesStillWithoutLocation = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      suggestedLocationId: null,
    },
    select: { id: true, description: true, suggestedReason: true },
  });

  let fromLANR = 0;

  for (const entry of entriesStillWithoutLocation) {
    // Suche LANR in description
    for (const [lanr, { location, arzt }] of Object.entries(lanrMapping)) {
      if (entry.description.includes(lanr)) {
        await prisma.ledgerEntry.update({
          where: { id: entry.id },
          data: {
            suggestedLocationId: location,
            suggestedReason: entry.suggestedReason
              ? `${entry.suggestedReason} | Location aus LANR ${lanr} (${arzt})`
              : `Location aus LANR ${lanr} (${arzt})`,
          },
        });
        fromLANR++;
        break;
      }
    }
  }

  console.log(`✓ ${fromLANR} Einträge: locationId aus LANR zugeordnet\n`);

  // Statistik
  const stats = await prisma.ledgerEntry.groupBy({
    by: ['suggestedLocationId'],
    where: {
      caseId,
      valueType: 'IST',
      suggestedLocationId: { not: null },
    },
    _count: true,
  });

  console.log('=== STATISTIK: LocationId-Vorschläge ===\n');
  for (const group of stats) {
    const location = await prisma.location.findUnique({
      where: { id: group.suggestedLocationId! },
      select: { name: true },
    });
    console.log(`${location?.name || group.suggestedLocationId}: ${group._count} Einträge`);
  }

  // Verbleibende ohne Location
  const remaining = await prisma.ledgerEntry.count({
    where: {
      caseId,
      valueType: 'IST',
      suggestedLocationId: null,
    },
  });

  console.log(`\nVerbleibend ohne Location: ${remaining} Einträge`);

  await prisma.$disconnect();
}

assignLocations().catch(console.error);
