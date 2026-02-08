import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';
const casePath = '/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases/Hausärztliche Versorgung PLUS eG/02-extracted';

async function verifyAgainstPDFs() {
  console.log('=== VERIFIKATION: Prisma vs. PDF-Kontoauszüge ===\n');

  const verifications = [
    { file: 'Sparkasse_Velbert_2025-10_VERIFIED.json', konto: 'Sparkasse Velbert', monat: '2025-10' },
    { file: 'Sparkasse_Velbert_2025-11_VERIFIED.json', konto: 'Sparkasse Velbert', monat: '2025-11' },
    { file: 'apoBank_Uckerath_2025-10_VERIFIED.json', konto: 'apoBank Uckerath', monat: '2025-10' },
    { file: 'apoBank_Uckerath_2025-11_VERIFIED.json', konto: 'apoBank Uckerath', monat: '2025-11' },
    { file: 'ISK_Uckerath_2025-11_VERIFIED.json', konto: 'ISK Uckerath', monat: '2025-11' },
    { file: 'ISK_Uckerath_2025-12_VERIFIED.json', konto: 'ISK Uckerath', monat: '2025-12' },
    { file: 'ISK_Uckerath_2026-01_VERIFIED.json', konto: 'ISK Uckerath', monat: '2026-01' },
    { file: 'ISK_Velbert_2025-12_VERIFIED.json', konto: 'ISK Velbert', monat: '2025-12' },
    { file: 'ISK_Velbert_2026-01_VERIFIED.json', konto: 'ISK Velbert', monat: '2026-01' },
  ];

  for (const v of verifications) {
    const filePath = `${casePath}/${v.file}`;

    try {
      const content = readFileSync(filePath, 'utf-8');
      const pdfData = JSON.parse(content);

      let pdfEntries = [];
      let pdfMeta = null;

      if (Array.isArray(pdfData)) {
        pdfEntries = pdfData;
      } else if (pdfData.transactions) {
        pdfEntries = pdfData.transactions;
        pdfMeta = pdfData.metadata || pdfData.summary;
      }

      console.log(`\n## ${v.konto} - ${v.monat}`);
      console.log(`PDF-File: ${v.file}`);
      console.log(`PDF-Einträge: ${pdfEntries.length}`);

      if (pdfMeta) {
        console.log(`PDF Anfangssaldo: ${pdfMeta.opening_balance || pdfMeta.anfangssaldo || '?'} EUR`);
        console.log(`PDF Endsaldo: ${pdfMeta.closing_balance || pdfMeta.endsaldo || '?'} EUR`);
      }

      // Berechne Summe aus PDF
      let pdfIncome = 0;
      let pdfExpenses = 0;

      for (const entry of pdfEntries) {
        const amount = parseFloat(entry.amount || entry.betrag || 0);
        if (amount > 0) {
          pdfIncome += amount;
        } else {
          pdfExpenses += amount;
        }
      }

      console.log(`PDF Summe Einnahmen: ${pdfIncome.toFixed(2)} EUR`);
      console.log(`PDF Summe Ausgaben: ${pdfExpenses.toFixed(2)} EUR`);
      console.log(`PDF Netto: ${(pdfIncome + pdfExpenses).toFixed(2)} EUR`);

      console.log(`\n→ Vergleich mit Prisma folgt...`);

    } catch (error) {
      console.log(`\n## ${v.konto} - ${v.monat}`);
      console.log(`❌ Fehler: ${(error as Error).message}`);
    }
  }

  await prisma.$disconnect();
}

verifyAgainstPDFs().catch(console.error);
