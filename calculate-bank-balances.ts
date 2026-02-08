import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

async function calculateBankBalances() {
  console.log('=== KONTOSALDEN AUS PRISMA (691 Entries) ===\n');

  // Hole alle Bank Accounts
  const accounts = await prisma.bankAccount.findMany({
    where: { caseId },
    include: { location: { select: { name: true } } },
    orderBy: { accountName: 'asc' }
  });

  console.log(`Gefundene Konten: ${accounts.length}\n`);

  for (const account of accounts) {
    console.log(`\n## ${account.accountName} (${account.location?.name || 'Kein Standort'})`);
    console.log(`Bank: ${account.bankName || 'N/A'}`);
    console.log(`IBAN: ${account.iban || 'N/A'}\n`);

    // Gruppiere nach Monat
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        caseId,
        valueType: 'IST',
        bankAccountId: account.id
      },
      orderBy: { transactionDate: 'asc' }
    });

    if (entries.length === 0) {
      console.log('   Keine Transaktionen\n');
      continue;
    }

    // Gruppiere nach Monat
    const byMonth: Record<string, typeof entries> = {};
    for (const entry of entries) {
      const date = new Date(entry.transactionDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[monthKey]) byMonth[monthKey] = [];
      byMonth[monthKey].push(entry);
    }

    // Berechne Salden
    const months = Object.keys(byMonth).sort();
    let runningBalance = 0;

    console.log('Monat       | Anfang EUR | Einnahmen EUR | Ausgaben EUR | Ende EUR   | Anzahl');
    console.log('------------|------------|---------------|--------------|------------|-------');

    for (const month of months) {
      const monthEntries = byMonth[month];
      const openingBalance = runningBalance;

      let income = 0;
      let expenses = 0;

      for (const entry of monthEntries) {
        const amount = Number(entry.amountCents) / 100;
        if (amount > 0) {
          income += amount;
        } else {
          expenses += amount;
        }
        runningBalance += amount;
      }

      console.log(
        `${month}    | ${String(openingBalance.toFixed(2)).padStart(10)} | ` +
        `${String(income.toFixed(2)).padStart(13)} | ` +
        `${String(expenses.toFixed(2)).padStart(12)} | ` +
        `${String(runningBalance.toFixed(2)).padStart(10)} | ${monthEntries.length}`
      );
    }

    // Erste und letzte Transaktion
    const firstDate = new Date(entries[0].transactionDate).toISOString().split('T')[0];
    const lastDate = new Date(entries[entries.length - 1].transactionDate).toISOString().split('T')[0];

    console.log(`\nErste Transaktion: ${firstDate}`);
    console.log(`Letzte Transaktion: ${lastDate}`);
    console.log(`Gesamt Transaktionen: ${entries.length}`);
  }

  await prisma.$disconnect();
}

calculateBankBalances().catch(console.error);
