/**
 * Korrigiert die Bankkonten-Anfangsbestände basierend auf den echten Kontoauszügen.
 *
 * Quellen:
 * - ISK: Erste Kontoauszüge (Anfangssaldo 0,00 EUR)
 * - Sparkasse HRV: Oktober-Kontoauszug (Schlusssaldo 31.10.2025)
 * - apoBank: Oktober-Kontoauszüge (Schlusssaldo 31.10.2025)
 * - Kassen: E-Mail Frau Dupke vom 06.11.2025
 *
 * Dokumentation: 02-extracted/buchhaltung-directory-map.json
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CASE_NUMBER = '70d IN 362/25';

async function main() {
  const cas = await prisma.case.findFirst({ where: { caseNumber: CASE_NUMBER } });
  if (!cas) {
    console.error('Case nicht gefunden:', CASE_NUMBER);
    return;
  }
  console.log('Case:', cas.id, cas.debtorName);
  console.log('');

  // 1. ISK Velbert: openingBalance = 0 (Konto eröffnet 05.12.2025, Anfangssaldo 0)
  await prisma.bankAccount.update({
    where: { id: 'ba-isk-velbert' },
    data: { openingBalanceCents: BigInt(0) }
  });
  console.log('ISK Velbert: openingBalanceCents = 0 (war 89.775,00 — falscher Snapshot-Wert)');

  // 2. ISK Uckerath: openingBalance = 0 (Konto eröffnet 13.11.2025, Anfangssaldo 0)
  await prisma.bankAccount.update({
    where: { id: 'ba-isk-uckerath' },
    data: { openingBalanceCents: BigInt(0) }
  });
  console.log('ISK Uckerath: openingBalanceCents = 0 (war 389.444,00 — falscher Snapshot-Wert)');

  // 3. Sparkasse HRV: Schlusssaldo 31.10.2025 = 24.970,61 EUR
  await prisma.bankAccount.update({
    where: { id: 'ba-sparkasse-velbert' },
    data: {
      openingBalanceCents: BigInt(2497061),
      iban: 'DE83334500000034379768',
      accountName: 'Geschäftskonto MVZ Velbert'
    }
  });
  console.log('Sparkasse HRV: openingBalanceCents = 2.497.061 (24.970,61 EUR) + IBAN gesetzt');

  // 4. apoBank MVZ Uckerath (#78818923): Schlusssaldo 31.10.2025 = 23.514,27 EUR
  await prisma.bankAccount.update({
    where: { id: 'ba-apobank-uckerath' },
    data: {
      openingBalanceCents: BigInt(2351427),
      iban: 'DE13300606010078818923',
      accountName: 'MVZ Uckerath (Konto #78818923)'
    }
  });
  console.log('apoBank Uckerath: openingBalanceCents = 2.351.427 (23.514,27 EUR) + IBAN + Name korrigiert');

  // 5. NEUES KONTO: apoBank HV PLUS eG (#28818923)
  //    Schlusssaldo 31.10.2025 = -287.372,10 EUR (negativ durch Sondertilgungen)
  const existing = await prisma.bankAccount.findUnique({ where: { id: 'ba-apobank-hvplus' } });
  if (existing) {
    await prisma.bankAccount.update({
      where: { id: 'ba-apobank-hvplus' },
      data: {
        openingBalanceCents: BigInt(-28737210),
        iban: 'DE88300606010028818923',
        accountName: 'HV PLUS eG (Konto #28818923)',
        status: 'SECURED',
        securityHolder: 'apoBank'
      }
    });
    console.log('apoBank HV PLUS: aktualisiert');
  } else {
    await prisma.bankAccount.create({
      data: {
        id: 'ba-apobank-hvplus',
        caseId: cas.id,
        bankName: 'Deutsche Apotheker- und Ärztebank',
        accountName: 'HV PLUS eG (Konto #28818923)',
        iban: 'DE88300606010028818923',
        openingBalanceCents: BigInt(-28737210),
        status: 'SECURED',
        securityHolder: 'apoBank',
        createdBy: 'system',
        updatedBy: 'system'
      }
    });
    console.log('apoBank HV PLUS: NEU angelegt (-287.372,10 EUR, SECURED)');
  }

  // Verifizierung
  console.log('\n=== VERIFIZIERUNG ===');
  const accounts = await prisma.bankAccount.findMany({
    where: { caseId: cas.id },
    orderBy: { createdAt: 'asc' }
  });

  let totalActive = BigInt(0);
  let totalAll = BigInt(0);

  for (const a of accounts) {
    const cents = a.openingBalanceCents;
    const eur = Number(cents) / 100;
    const formatted = eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    console.log(`  ${a.id}: ${a.accountName}`);
    console.log(`    Anfangssaldo: ${formatted} EUR | Status: ${a.status} | IBAN: ${a.iban || '-'}`);
    totalAll += cents;
    if (a.status === 'ACTIVE') {
      totalActive += cents;
    }
  }

  console.log(`\nGesamt (alle Konten): ${(Number(totalAll) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })} EUR`);
  console.log(`Gesamt (nur ACTIVE):  ${(Number(totalActive) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })} EUR`);
  console.log('\nFertig.');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
