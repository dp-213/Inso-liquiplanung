/**
 * ISK BW-Bank PDF-Extraktion mit Zero-Toleranz Saldoprüfung
 *
 * Liest alle Tages-PDFs eines Monats, extrahiert Transaktionen,
 * verifiziert Anfangs- + Endsaldo gegen PDF-Werte.
 *
 * Speichert JSON NUR wenn Saldodifferenz = 0 Cent.
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const CASES_ROOT = '/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases';

interface Transaction {
  date: string;
  valueDate: string;
  amount: number;
  counterparty: string;
  description: string;
  category?: string;
  lanr?: string;
  [key: string]: any;
}

interface ExtractionResult {
  sourceFiles: string[];
  extractedAt: string;
  account: {
    name: string;
    kontonummer: string;
    iban: string;
    bank: string;
  };
  period: {
    month: string;
    from: string;
    to: string;
  };
  verification: {
    openingBalanceFromPDF: number;
    closingBalanceFromPDF: number;
    calculatedClosing: number;
    differenceEUR: number;
    differenceCents: number;
    status: 'PASS' | 'FAIL';
  };
  summary: {
    transactionCount: number;
    totalInflows: number;
    totalOutflows: number;
    netChange: number;
  };
  transactions: Transaction[];
}

/**
 * Extrahiert IST-Transaktionen aus ISK-PDF mit Claude
 */
async function extractTransactionsFromPDF(pdfPath: string): Promise<{
  transactions: Transaction[];
  anfangssaldo?: number;
  endsaldo?: number;
  date?: string;
}> {
  console.log(`  Extrahiere: ${path.basename(pdfPath)}`);

  const prompt = `Lies dieses BW-Bank ISK-Kontoauszug-PDF und extrahiere:

1. **Anfangssaldo**: Der "Anfangssaldo" Betrag in EUR (obere Box)
2. **Endsaldo**: Der "Endsaldo" Betrag in EUR (obere Box)
3. **Kontoauszugsdatum**: Das Datum aus "Kontoauszugsdatum" (Format: DD.MM.YYYY)
4. **Alle Transaktionen**: Jede Zeile in der Tabelle mit:
   - Datum (aus "Datum" Spalte, Format DD.MM.YYYY)
   - Valuta (aus "Valuta" Spalte, Format DD.MM.YYYY)
   - Betrag in EUR (aus "Umsatz EUR" Spalte - positiv für Haben/Einnahmen, negativ für Soll/Ausgaben)
   - Buchungsinformationen (kompletter Text aus "Buchungsinformationen" Spalte)
   - Gegenpartei (Name aus Buchungsinformationen, falls erkennbar)

**WICHTIG für Beträge:**
- "Summe Haben" = positive Beträge (Einnahmen)
- "Summe Soll" = negative Beträge (Ausgaben)
- Wenn "Summe Soll" angegeben ist, MUSS der Betrag negativ sein!

Gib JSON zurück:
\`\`\`json
{
  "anfangssaldo": 123456.78,
  "endsaldo": 234567.89,
  "date": "15.11.2025",
  "transactions": [
    {
      "date": "13.11.2025",
      "valueDate": "13.11.2025",
      "amount": 123.45,
      "description": "GUTSCHRIFT ÜBERWEISUNG ...",
      "counterparty": "HAVG Hausärztliche Vertragsgemeinschaft AG"
    }
  ]
}
\`\`\``;

  // Temporäres File für Claude-Ausgabe
  const tempFile = `/tmp/extract-isk-${Date.now()}.json`;

  try {
    // Claude via CLI aufrufen (verwendet Read-Tool für PDF)
    const cmd = `claude -m sonnet -p '${prompt.replace(/'/g, "'\\''")}' -f '${pdfPath}' > '${tempFile}'`;
    execSync(cmd, { stdio: 'pipe' });

    const output = fs.readFileSync(tempFile, 'utf8');
    fs.unlinkSync(tempFile);

    // JSON aus Output extrahieren (kann Markdown-Wrapping haben)
    const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/) || output.match(/({[\s\S]*})/);
    if (!jsonMatch) {
      throw new Error('Keine JSON-Daten in Claude-Ausgabe gefunden');
    }

    const data = JSON.parse(jsonMatch[1]);
    return data;
  } catch (error) {
    console.error(`  FEHLER bei ${path.basename(pdfPath)}: ${error}`);
    throw error;
  }
}

/**
 * Extrahiert einen kompletten ISK-Monat
 */
async function extractISKMonth(
  pdfDirectory: string,
  accountName: string,
  kontonummer: string,
  iban: string,
  outputPath: string
): Promise<void> {
  console.log(`\n=== EXTRAKTION ${accountName} ===`);
  console.log(`Verzeichnis: ${pdfDirectory}`);

  // Alle Tages-PDFs finden und sortieren
  const subdirs = fs.readdirSync(pdfDirectory, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^\d{2}\.\d{2}\.\d{4}$/.test(d.name))
    .sort((a, b) => {
      const [dayA, monthA, yearA] = a.name.split('.').map(Number);
      const [dayB, monthB, yearB] = b.name.split('.').map(Number);
      const dateA = new Date(yearA, monthA - 1, dayA);
      const dateB = new Date(yearB, monthB - 1, dayB);
      return dateA.getTime() - dateB.getTime();
    });

  if (subdirs.length === 0) {
    throw new Error('Keine Tages-Verzeichnisse gefunden');
  }

  console.log(`Gefunden: ${subdirs.length} Tages-Auszüge`);

  // PDFs pro Tag finden
  const pdfPaths: string[] = [];
  for (const dir of subdirs) {
    const dayPath = path.join(pdfDirectory, dir.name);
    const pdfs = fs.readdirSync(dayPath)
      .filter(f => f.endsWith('.pdf'))
      .map(f => path.join(dayPath, f));

    if (pdfs.length === 0) {
      console.warn(`  Warnung: Kein PDF in ${dir.name}`);
      continue;
    }

    pdfPaths.push(pdfs[0]); // Erstes PDF des Tages
  }

  console.log(`Zu verarbeiten: ${pdfPaths.length} PDFs\n`);

  // Extrahiere alle PDFs
  const allTransactions: Transaction[] = [];
  let openingBalance: number | undefined;
  let closingBalance: number | undefined;
  let firstDate: string | undefined;
  let lastDate: string | undefined;

  for (let i = 0; i < pdfPaths.length; i++) {
    const pdfPath = pdfPaths[i];
    const result = await extractTransactionsFromPDF(pdfPath);

    // Anfangssaldo nur vom ersten PDF
    if (i === 0) {
      openingBalance = result.anfangssaldo;
      firstDate = result.date;
      console.log(`  → Anfangssaldo: ${openingBalance?.toFixed(2)} EUR`);
    }

    // Endsaldo nur vom letzten PDF
    if (i === pdfPaths.length - 1) {
      closingBalance = result.endsaldo;
      lastDate = result.date;
      console.log(`  → Endsaldo: ${closingBalance?.toFixed(2)} EUR`);
    }

    // Transaktionen sammeln
    if (result.transactions && result.transactions.length > 0) {
      allTransactions.push(...result.transactions);
      console.log(`  → ${result.transactions.length} Transaktionen`);
    } else {
      console.log(`  → Keine Transaktionen`);
    }
  }

  if (openingBalance === undefined || closingBalance === undefined) {
    throw new Error('Anfangs- oder Endsaldo konnte nicht extrahiert werden');
  }

  console.log(`\n=== SALDOPRÜFUNG ===`);
  console.log(`Anfangssaldo (PDF): ${openingBalance.toFixed(2)} EUR`);
  console.log(`Endsaldo (PDF):     ${closingBalance.toFixed(2)} EUR`);
  console.log(`Transaktionen:      ${allTransactions.length}`);

  // Cent-genaue Berechnung
  const openingCents = Math.round(openingBalance * 100);
  const closingCents = Math.round(closingBalance * 100);

  let sumCents = 0;
  let inflowCents = 0;
  let outflowCents = 0;

  for (const tx of allTransactions) {
    const cents = Math.round(tx.amount * 100);
    sumCents += cents;
    if (cents > 0) inflowCents += cents;
    else outflowCents += cents;
  }

  const calculatedClosingCents = openingCents + sumCents;
  const diffCents = calculatedClosingCents - closingCents;

  console.log(`\nEinnahmen:  ${(inflowCents / 100).toFixed(2)} EUR`);
  console.log(`Ausgaben:   ${(outflowCents / 100).toFixed(2)} EUR`);
  console.log(`Netto:      ${(sumCents / 100).toFixed(2)} EUR`);
  console.log(`\nBerechnet:  ${(calculatedClosingCents / 100).toFixed(2)} EUR`);
  console.log(`Erwartet:   ${(closingCents / 100).toFixed(2)} EUR`);
  console.log(`DIFFERENZ:  ${(diffCents / 100).toFixed(2)} EUR (${diffCents} Cent)`);

  const status = diffCents === 0 ? 'PASS' : 'FAIL';
  console.log(`STATUS:     ${status} ${status === 'PASS' ? '✓' : '✗'}`);

  if (status === 'FAIL') {
    throw new Error(`Saldoprüfung fehlgeschlagen: ${diffCents} Cent Differenz. JSON wird NICHT gespeichert.`);
  }

  // Periode ermitteln
  const [day1, month1, year1] = firstDate!.split('.').map(Number);
  const [day2, month2, year2] = lastDate!.split('.').map(Number);
  const periodMonth = `${year1}-${String(month1).padStart(2, '0')}`;
  const periodFrom = `${year1}-${String(month1).padStart(2, '0')}-${String(day1).padStart(2, '0')}`;
  const periodTo = `${year2}-${String(month2).padStart(2, '0')}-${String(day2).padStart(2, '0')}`;

  // JSON erstellen
  const result: ExtractionResult = {
    sourceFiles: pdfPaths.map(p => path.basename(path.dirname(p)) + '/' + path.basename(p)),
    extractedAt: new Date().toISOString(),
    account: {
      name: accountName,
      kontonummer,
      iban,
      bank: 'BW Bank'
    },
    period: {
      month: periodMonth,
      from: periodFrom,
      to: periodTo
    },
    verification: {
      openingBalanceFromPDF: openingBalance,
      closingBalanceFromPDF: closingBalance,
      calculatedClosing: calculatedClosingCents / 100,
      differenceEUR: diffCents / 100,
      differenceCents: diffCents,
      status
    },
    summary: {
      transactionCount: allTransactions.length,
      totalInflows: inflowCents / 100,
      totalOutflows: outflowCents / 100,
      netChange: sumCents / 100
    },
    transactions: allTransactions
  };

  // JSON speichern
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\n✓ JSON gespeichert: ${outputPath}`);
}

// MAIN
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 5) {
    console.error('Usage: npx tsx extract-isk-month.ts <pdf-dir> <accountName> <kontonummer> <iban> <output-json>');
    process.exit(1);
  }

  const [pdfDir, accountName, kontonummer, iban, outputPath] = args;

  try {
    await extractISKMonth(pdfDir, accountName, kontonummer, iban, outputPath);
    console.log('\n✓✓✓ EXTRAKTION ERFOLGREICH ✓✓✓');
  } catch (error) {
    console.error('\n✗✗✗ EXTRAKTION FEHLGESCHLAGEN ✗✗✗');
    console.error(error);
    process.exit(1);
  }
}

main();
