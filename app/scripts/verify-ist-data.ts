/**
 * Verifiziert IST-Daten gegen Quell-JSONs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const entries = await prisma.ledgerEntry.findMany({
    where: { valueType: 'IST' },
    include: { location: true }
  });

  console.log('=== VERIFIZIERUNG IST-DATEN ===\n');
  console.log('Gesamt-Einträge:', entries.length);

  // Nach Monat
  const byMonth: Record<string, { ein: bigint; aus: bigint; count: number }> = {};
  for (const e of entries) {
    const month = new Date(e.transactionDate).toISOString().slice(0, 7);
    if (byMonth[month] === undefined) {
      byMonth[month] = { ein: BigInt(0), aus: BigInt(0), count: 0 };
    }
    if (e.amountCents >= 0) byMonth[month].ein += e.amountCents;
    else byMonth[month].aus += e.amountCents;
    byMonth[month].count++;
  }

  console.log('\nNach Monat:');
  console.log('  Monat    | Anzahl |    Einzahlungen |    Auszahlungen |          Netto');
  console.log('  ---------|--------|-----------------|-----------------|---------------');
  for (const month of Object.keys(byMonth).sort()) {
    const d = byMonth[month];
    console.log(
      `  ${month} | ${String(d.count).padStart(6)} | ${(Number(d.ein) / 100).toLocaleString('de-DE').padStart(15)}€ | ${(Number(d.aus) / 100).toLocaleString('de-DE').padStart(15)}€ | ${(Number(d.ein + d.aus) / 100).toLocaleString('de-DE').padStart(13)}€`
    );
  }

  // Oktober Detail nach Standort
  console.log('\n--- OKTOBER Detail (nach Standort) ---');
  const oktEntries = entries.filter((e) => new Date(e.transactionDate).toISOString().startsWith('2025-10'));

  const byLoc: Record<string, { ein: bigint; aus: bigint; count: number }> = {};
  for (const e of oktEntries) {
    const loc = e.location?.name || 'Ohne';
    if (byLoc[loc] === undefined) {
      byLoc[loc] = { ein: BigInt(0), aus: BigInt(0), count: 0 };
    }
    if (e.amountCents >= 0) byLoc[loc].ein += e.amountCents;
    else byLoc[loc].aus += e.amountCents;
    byLoc[loc].count++;
  }

  for (const [loc, d] of Object.entries(byLoc)) {
    console.log(
      `  ${loc.padEnd(20)}: ${String(d.count).padStart(3)} | +${(Number(d.ein) / 100).toLocaleString('de-DE').padStart(12)}€ | ${(Number(d.aus) / 100).toLocaleString('de-DE').padStart(12)}€`
    );
  }

  // SOLL-Werte aus JSON-Dateien
  console.log('\n=== SOLL-IST Vergleich OKTOBER ===');
  console.log('SOLL (aus JSON):');
  console.log('  Velbert:  87 Buchungen | +99.560,54€ | -111.350,54€ | Netto: -11.790,00€');
  console.log('  Uckerath: 142 Buchungen | +156.567,15€ | -80.893,82€ | Netto: 75.673,33€');

  const velbert = byLoc['Praxis Velbert'];
  const uckerath = byLoc['Praxis Uckerath'];

  console.log('\nIST (aus DB):');
  if (velbert) {
    console.log(
      `  Velbert:  ${velbert.count} Buchungen | +${(Number(velbert.ein) / 100).toLocaleString('de-DE')}€ | ${(Number(velbert.aus) / 100).toLocaleString('de-DE')}€ | Netto: ${(Number(velbert.ein + velbert.aus) / 100).toLocaleString('de-DE')}€`
    );
  }
  if (uckerath) {
    console.log(
      `  Uckerath: ${uckerath.count} Buchungen | +${(Number(uckerath.ein) / 100).toLocaleString('de-DE')}€ | ${(Number(uckerath.aus) / 100).toLocaleString('de-DE')}€ | Netto: ${(Number(uckerath.ein + uckerath.aus) / 100).toLocaleString('de-DE')}€`
    );
  }

  // Vergleich
  const velOk = velbert && velbert.count === 87;
  const uckOk = uckerath && uckerath.count === 142;
  console.log('\nStatus:');
  console.log(`  Velbert:  ${velOk ? '✅ OK' : '❌ FEHLER'}`);
  console.log(`  Uckerath: ${uckOk ? '✅ OK' : '❌ FEHLER'}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
