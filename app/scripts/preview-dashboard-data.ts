/**
 * Preview Dashboard Data - zeigt was das Dashboard anzeigen würde
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const caseId = "2982ff26-081a-4811-8e1e-46b39e1ff757";

  const entries = await prisma.ledgerEntry.findMany({
    where: { caseId, valueType: 'IST' },
    include: { location: true },
    orderBy: { transactionDate: 'desc' }
  });

  let totalInflows = BigInt(0);
  let totalOutflows = BigInt(0);

  const byLocation: Record<string, { name: string; ein: bigint; aus: bigint; count: number }> = {};
  const byMonth: Record<string, { ein: bigint; aus: bigint; count: number }> = {};

  for (const e of entries) {
    const locId = e.locationId || '_none';
    const locName = e.location?.name || 'Ohne Standort';

    if (byLocation[locId] === undefined) {
      byLocation[locId] = { name: locName, ein: BigInt(0), aus: BigInt(0), count: 0 };
    }

    const month = new Date(e.transactionDate).toISOString().slice(0, 7);
    if (byMonth[month] === undefined) {
      byMonth[month] = { ein: BigInt(0), aus: BigInt(0), count: 0 };
    }

    if (e.amountCents >= 0) {
      totalInflows += e.amountCents;
      byLocation[locId].ein += e.amountCents;
      byMonth[month].ein += e.amountCents;
    } else {
      totalOutflows += e.amountCents;
      byLocation[locId].aus += e.amountCents;
      byMonth[month].aus += e.amountCents;
    }
    byLocation[locId].count++;
    byMonth[month].count++;
  }

  console.log('=== KONTOBEWEGUNGEN DASHBOARD PREVIEW ===\n');
  console.log('SUMMARY:');
  console.log('  Buchungen:', entries.length);
  console.log('  Einzahlungen:', (Number(totalInflows) / 100).toLocaleString('de-DE'), '€');
  console.log('  Auszahlungen:', (Number(totalOutflows) / 100).toLocaleString('de-DE'), '€');
  console.log('  Netto:', (Number(totalInflows + totalOutflows) / 100).toLocaleString('de-DE'), '€');

  console.log('\nNACH MONAT:');
  for (const [month, data] of Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(
      '  ' + month + ': ' + data.count + ' Buchungen | +' +
      (Number(data.ein) / 100).toLocaleString('de-DE') + '€ / ' +
      (Number(data.aus) / 100).toLocaleString('de-DE') + '€'
    );
  }

  console.log('\nNACH STANDORT:');
  for (const [, data] of Object.entries(byLocation)
    .filter(([, d]) => d.count > 0)
    .sort((a, b) => b[1].count - a[1].count)) {
    console.log(
      '  ' + data.name + ': ' + data.count + ' Buchungen | +' +
      (Number(data.ein) / 100).toLocaleString('de-DE') + '€ / ' +
      (Number(data.aus) / 100).toLocaleString('de-DE') + '€'
    );
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
