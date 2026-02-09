/**
 * Check HZV-Zahlungen: Auf welchem Konto gehen sie ein?
 * Direkte SQL-Query um Schema-Probleme zu vermeiden
 */
import Database from 'better-sqlite3';

const db = new Database('./dev.db');

// Alle HZV-Zahlungen mit Bank-Konto
const query = `
SELECT
  le.transactionDate,
  le.description,
  le.amountCents,
  ba.accountName as bankAccountName,
  l.name as locationName
FROM ledger_entries le
LEFT JOIN bank_accounts ba ON le.bankAccountId = ba.id
LEFT JOIN locations l ON le.locationId = l.id
WHERE
  le.description LIKE '%HZV%'
  OR le.description LIKE '%hzv%'
  OR le.description LIKE '%HAVG%'
  OR le.description LIKE '%havg%'
  OR le.description LIKE '%Hausarzt%'
ORDER BY le.transactionDate ASC
`;

const hzvEntries = db.prepare(query).all() as any[];

console.log('=== HZV-ZAHLUNGEN ANALYSE ===\n');
console.log(`Gefunden: ${hzvEntries.length} HZV-Zahlungen\n`);

// Gruppiere nach Bank Account
const byAccount: Record<string, any[]> = {};

for (const entry of hzvEntries) {
  const accountName = entry.bankAccountName || 'OHNE_KONTO';
  if (!byAccount[accountName]) {
    byAccount[accountName] = [];
  }
  byAccount[accountName].push(entry);
}

// Ausgabe
for (const [accountName, entries] of Object.entries(byAccount)) {
  console.log(`\n=== ${accountName} (${entries.length} Buchungen) ===`);

  // Zeige erste 5 Beispiele
  entries.slice(0, 5).forEach((e: any) => {
    const date = e.transactionDate.split('T')[0];
    const amount = Number(e.amountCents) / 100;
    const location = e.locationName || 'OHNE_STANDORT';
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
  const entries = hzvEntries.filter((e: any) =>
    e.description.toLowerCase().includes(doctor.toLowerCase())
  );

  if (entries.length > 0) {
    console.log(`\n${doctor}: ${entries.length} Zahlungen`);
    const accounts = new Set(entries.map((e: any) => e.bankAccountName || 'OHNE_KONTO'));
    console.log(`  Konten: ${Array.from(accounts).join(', ')}`);

    // Zeige erste 3 Beispiele
    entries.slice(0, 3).forEach((e: any) => {
      const date = e.transactionDate.split('T')[0];
      const amount = Number(e.amountCents) / 100;
      const account = e.bankAccountName || 'OHNE';
      console.log(`    ${date} | ${amount.toFixed(2).padStart(10)} € | ${account}`);
    });
  } else {
    console.log(`\n${doctor}: KEINE Zahlungen gefunden`);
  }
}

// Zusammenfassung: ISK Velbert vs ISK Uckerath
console.log('\n\n=== ZUSAMMENFASSUNG ===');
const iskVelbert = hzvEntries.filter((e: any) => e.bankAccountName === 'ISK Velbert');
const iskUckerath = hzvEntries.filter((e: any) => e.bankAccountName === 'ISK Uckerath');

console.log(`ISK Velbert: ${iskVelbert.length} HZV-Zahlungen`);
console.log(`ISK Uckerath: ${iskUckerath.length} HZV-Zahlungen`);

// Zeige, welche Standorte auf ISK Uckerath sind
if (iskUckerath.length > 0) {
  const locations = new Set(iskUckerath.map((e: any) => e.locationName || 'OHNE'));
  console.log(`\nStandorte auf ISK Uckerath: ${Array.from(locations).join(', ')}`);
}

if (iskVelbert.length > 0) {
  const locations = new Set(iskVelbert.map((e: any) => e.locationName || 'OHNE'));
  console.log(`Standorte auf ISK Velbert: ${Array.from(locations).join(', ')}`);
}

db.close();
