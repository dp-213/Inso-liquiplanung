/**
 * Verify ISK import completeness - compare JSON vs Database
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const EXTRACTED_DIR = '/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases/Hausärztliche Versorgung PLUS eG/02-extracted';

interface JsonSummary {
  file: string;
  transactionCount: number;
  totalInflows: number;
  totalOutflows: number;
}

async function verify() {
  const hvCase = await prisma.case.findFirst({ where: { caseNumber: '70d IN 362/25' } });
  if (!hvCase) {
    console.log('Case nicht gefunden!');
    return;
  }

  console.log('=== VOLLSTÄNDIGKEITS-CHECK: JSON vs. Datenbank ===\n');

  const jsonFiles = [
    'ISK_Uckerath_2025-12.json',
    'ISK_Uckerath_2026-01.json',
    'ISK_Velbert_2025-12.json',
    'ISK_Velbert_2026-01.json',
  ];

  let allMatch = true;

  for (const file of jsonFiles) {
    const filePath = path.join(EXTRACTED_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // JSON totals
    const jsonCount = data.summary.transactionCount;
    const jsonInflows = data.summary.totalInflows;
    const jsonOutflows = data.summary.totalOutflows;

    // Database totals for this source
    const dbEntries = await prisma.ledgerEntry.findMany({
      where: {
        caseId: hvCase.id,
        importSource: { startsWith: file }
      }
    });

    const dbCount = dbEntries.length;
    let dbInflows = BigInt(0);
    let dbOutflows = BigInt(0);

    for (const e of dbEntries) {
      if (e.amountCents >= 0) dbInflows += e.amountCents;
      else dbOutflows += e.amountCents;
    }

    const dbInflowsEur = Number(dbInflows) / 100;
    const dbOutflowsEur = Number(dbOutflows) / 100;

    // Compare
    const countMatch = jsonCount === dbCount;
    const inflowsMatch = Math.abs(jsonInflows - dbInflowsEur) < 0.01;
    const outflowsMatch = Math.abs(jsonOutflows - dbOutflowsEur) < 0.01;

    console.log(`--- ${file} ---`);
    console.log(`Anzahl:    JSON=${jsonCount}, DB=${dbCount} ${countMatch ? '✅' : '❌ DIFFERENZ: ' + (jsonCount - dbCount)}`);
    console.log(`Einnahmen: JSON=${jsonInflows.toFixed(2)}, DB=${dbInflowsEur.toFixed(2)} ${inflowsMatch ? '✅' : '❌'}`);
    console.log(`Ausgaben:  JSON=${jsonOutflows.toFixed(2)}, DB=${dbOutflowsEur.toFixed(2)} ${outflowsMatch ? '✅' : '❌'}`);

    if (!countMatch) {
      allMatch = false;
      // Find missing transactions
      console.log('\n  FEHLENDE BUCHUNGEN:');
      for (const tx of data.transactions) {
        const [day, month, year] = tx.date.split('.');
        const txDate = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
        const amountCents = Math.round(tx.amount * 100);

        const exists = await prisma.ledgerEntry.findFirst({
          where: {
            caseId: hvCase.id,
            transactionDate: txDate,
            amountCents: BigInt(amountCents),
            description: { contains: tx.description.substring(0, 30) }
          }
        });

        if (!exists) {
          console.log(`  - ${tx.date} | ${tx.amount.toFixed(2)}€ | ${tx.description.substring(0, 50)}`);
        }
      }
    }

    if (!inflowsMatch || !outflowsMatch) {
      allMatch = false;
    }

    console.log('');
  }

  // Also check for any duplicate entries
  console.log('--- DUPLIKAT-CHECK ---');
  const allISK = await prisma.ledgerEntry.findMany({
    where: {
      caseId: hvCase.id,
      importSource: { contains: 'ISK_' },
      transactionDate: { gte: new Date('2025-12-01'), lt: new Date('2026-02-01') }
    },
    orderBy: [{ transactionDate: 'asc' }, { amountCents: 'desc' }]
  });

  // Group by date+amount+description to find duplicates
  const seen = new Map<string, number>();
  for (const e of allISK) {
    const key = `${e.transactionDate.toISOString()}|${e.amountCents}|${e.description.substring(0, 50)}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  }

  let dupCount = 0;
  for (const [key, count] of seen.entries()) {
    if (count > 1) {
      console.log(`  DUPLIKAT (${count}x): ${key.substring(0, 80)}`);
      dupCount++;
    }
  }

  if (dupCount === 0) {
    console.log('  Keine Duplikate gefunden ✅');
  }

  console.log('\n=== FAZIT ===');
  if (allMatch) {
    console.log('✅ ALLE BUCHUNGEN VOLLSTÄNDIG - Salden stimmen überein!');
  } else {
    console.log('❌ DIFFERENZEN GEFUNDEN - Bitte prüfen!');
  }
}

verify().catch(console.error).finally(() => prisma.$disconnect());
