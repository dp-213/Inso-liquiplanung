/**
 * Check HZV-Zahlungen: Auf welchem Konto gehen sie ein?
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== HZV-ZAHLUNGEN ANALYSE ===\n');

  // Alle HZV-Zahlungen finden
  const hzvEntries = await prisma.ledgerEntry.findMany({
    where: {
      OR: [
        { description: { contains: 'HZV' } },
        { description: { contains: 'hzv' } },
        { description: { contains: 'HAVG' } },
        { description: { contains: 'havg' } },
        { description: { contains: 'Hausarzt' } },
      ]
    },
    include: {
      bankAccount: true,
      location: true,
    },
    orderBy: {
      transactionDate: 'asc'
    }
  });

  console.log(`Gefunden: ${hzvEntries.length} HZV-Zahlungen\n`);

  // Gruppiere nach Bank Account
  const byAccount: Record<string, any[]> = {};

  for (const entry of hzvEntries) {
    const accountName = entry.bankAccount?.accountName || 'OHNE_KONTO';
    if (!byAccount[accountName]) {
      byAccount[accountName] = [];
    }
    byAccount[accountName].push(entry);
  }

  // Ausgabe
  for (const [accountName, entries] of Object.entries(byAccount)) {
    console.log(`\n=== ${accountName} (${entries.length} Buchungen) ===`);

    // Zeige erste 5 Beispiele
    entries.slice(0, 5).forEach(e => {
      const date = new Date(e.transactionDate).toISOString().split('T')[0];
      const amount = Number(e.amountCents) / 100;
      const location = e.location?.name || 'OHNE_STANDORT';
      console.log(`  ${date} | ${amount.toFixed(2).padStart(10)} € | ${location.padEnd(10)} | ${e.description.substring(0, 60)}`);
    });

    if (entries.length > 5) {
      console.log(`  ... und ${entries.length - 5} weitere`);
    }
  }

  // Spezifische Analyse: Velbert-Ärzte
  console.log('\n\n=== VELBERT-ÄRZTE ===');
  const velbertDoctors = ['van Suntum', 'Beyer', 'Kamler'];

  for (const doctor of velbertDoctors) {
    const entries = hzvEntries.filter(e =>
      e.description.toLowerCase().includes(doctor.toLowerCase())
    );

    if (entries.length > 0) {
      console.log(`\n${doctor}: ${entries.length} Zahlungen`);
      const accounts = new Set(entries.map(e => e.bankAccount?.accountName || 'OHNE_KONTO'));
      console.log(`  Konten: ${Array.from(accounts).join(', ')}`);

      // Zeige erste 3 Beispiele
      entries.slice(0, 3).forEach(e => {
        const date = new Date(e.transactionDate).toISOString().split('T')[0];
        const amount = Number(e.amountCents) / 100;
        const account = e.bankAccount?.accountName || 'OHNE';
        console.log(`    ${date} | ${amount.toFixed(2).padStart(10)} € | ${account}`);
      });
    } else {
      console.log(`\n${doctor}: KEINE Zahlungen gefunden`);
    }
  }

  console.log('\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
