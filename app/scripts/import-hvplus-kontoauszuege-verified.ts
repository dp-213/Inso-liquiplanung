/**
 * Import-Script: HVPlus IST-Daten aus verifizierten Kontoauszügen
 *
 * Importiert alle *_VERIFIED.json Dateien aus /02-extracted/
 *
 * Datenquellen (19 JSONs mit 0 ct Differenz):
 * - apoBank Uckerath: Okt, Nov, Jan
 * - apoBank HVPLUS: Okt, Jan
 * - Sparkasse Velbert: Okt, Nov, Jan
 * - ISK Uckerath: Nov, Dez, Jan
 * - ISK Velbert: Dez, Jan
 *
 * Ausführung: cd app && npx tsx scripts/import-hvplus-kontoauszuege-verified.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// =============================================================================
// CONFIGURATION
// =============================================================================

const CASE_NUMBER = '70d IN 362/25';
const DRY_RUN = false; // Set to true for preview only

const CASES_ROOT = '/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases';
const EXTRACTED_DIR = `${CASES_ROOT}/Hausärztliche Versorgung PLUS eG/02-extracted`;

// =============================================================================
// TYPES
// =============================================================================

interface BankStatementJSON {
  account: {
    name: string;
    iban: string;
  };
  period: {
    month: string;
    startDate: string;
    endDate: string;
  };
  transactions: Array<{
    date: string;
    valueDate?: string;
    amount: number;
    description: string;
    counterparty?: string;
    type: 'CREDIT' | 'DEBIT';
  }>;
  verification: {
    differenceCents: number;
    status: 'PASS' | 'FAIL';
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function euroToCents(euro: number): bigint {
  return BigInt(Math.round(euro * 100));
}

async function findBankAccountByIban(iban: string, accountName: string, caseId: string): Promise<string | null> {
  // Try exact IBAN match first
  const normalized = iban.replace(/\s/g, '');
  let account = await prisma.bankAccount.findFirst({
    where: {
      caseId,
      iban: normalized,
    },
  });

  // Fallback: match by last 10 digits of IBAN (account number)
  if (!account && normalized.length > 10) {
    const accountNumber = normalized.slice(-10);
    account = await prisma.bankAccount.findFirst({
      where: {
        caseId,
        iban: { contains: accountNumber },
      },
    });
  }

  // Fallback: match by account name
  if (!account) {
    account = await prisma.bankAccount.findFirst({
      where: {
        caseId,
        accountName: { contains: accountName.split(' ')[0] },
      },
    });
  }

  return account?.id || null;
}

// =============================================================================
// MAIN IMPORT FUNCTION
// =============================================================================

async function importBankStatement(filePath: string, caseId: string) {
  const fileName = path.basename(filePath);
  console.log(`\n📄 ${fileName}`);

  const data: BankStatementJSON = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Validation
  if (data.verification.status !== 'PASS' || data.verification.differenceCents !== 0) {
    console.log(`   ⚠️  SKIPPED: status=${data.verification.status}, diff=${data.verification.differenceCents} ct`);
    return { imported: 0, skipped: data.transactions.length };
  }

  console.log(`   ✓ Verified: ${data.transactions.length} transactions, 0 ct difference`);

  // Get Bank Account
  const bankAccountId = await findBankAccountByIban(data.account.iban, data.account.name, caseId);
  if (!bankAccountId) {
    console.log(`   ⚠️  SKIPPED: Bank account not found for ${data.account.name} / ${data.account.iban}`);
    return { imported: 0, skipped: data.transactions.length };
  }

  console.log(`   ✓ Bank: ${data.account.name} → ${bankAccountId}`);

  // Import Transactions
  let imported = 0;
  let skipped = 0;

  for (const tx of data.transactions) {
    const amountCents = euroToCents(tx.amount);
    const txDate = new Date(tx.date);

    // Check for duplicates
    const existing = await prisma.ledgerEntry.findFirst({
      where: {
        caseId,
        bankAccountId,
        transactionDate: txDate,
        amountCents,
        description: tx.description,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    if (!DRY_RUN) {
      await prisma.ledgerEntry.create({
        data: {
          caseId,
          transactionDate: txDate,
          amountCents,
          description: tx.description.slice(0, 500),
          note: tx.counterparty || null,

          // Steuerungsdimensionen
          valueType: 'IST',
          legalBucket: 'MASSE', // Default - wird durch Classification Engine angepasst

          // Dimensionen (erstmal leer - Classification Engine füllt Vorschläge)
          bankAccountId,
          counterpartyId: null,
          locationId: null,
          categoryTag: null,

          // Estate Allocation (wird durch Split-Engine bestimmt)
          estateAllocation: null,
          estateRatio: null,

          // Governance
          reviewStatus: 'UNREVIEWED',
          allocationSource: 'BANK_STATEMENT',
          allocationNote: `Imported from ${data.account.name} ${data.period.month}`,

          // Import-Metadaten
          importSource: fileName,
          createdBy: 'import-hvplus-kontoauszuege-verified',
        },
      });
    }

    imported++;
  }

  console.log(`   → Imported: ${imported}, Skipped: ${skipped}`);
  return { imported, skipped };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('HVPlus Kontoauszüge Import (VERIFIED JSONs)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (preview)' : 'LIVE IMPORT'}`);
  console.log('');

  // Get Case
  const hvplusCase = await prisma.case.findFirst({
    where: { caseNumber: CASE_NUMBER },
  });

  if (!hvplusCase) {
    throw new Error(`Case not found: ${CASE_NUMBER}`);
  }

  console.log(`✓ Case: ${hvplusCase.debtorName} (${hvplusCase.caseNumber})`);

  // Get all VERIFIED.json files
  const files = fs
    .readdirSync(EXTRACTED_DIR)
    .filter((f) => f.endsWith('_VERIFIED.json'))
    .sort();

  console.log(`✓ Found ${files.length} verified JSON files`);

  // Import
  let totalImported = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const filePath = path.join(EXTRACTED_DIR, file);
    const result = await importBankStatement(filePath, hvplusCase.id);
    totalImported += result.imported;
    totalSkipped += result.skipped;
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`✓ SUMMARY: Imported ${totalImported}, Skipped ${totalSkipped}`);
  console.log('═══════════════════════════════════════════════════════════════');

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN - No data written');
    console.log('   Set DRY_RUN = false to import');
  } else {
    console.log('\n🎉 Import completed!');
    console.log('\nNext steps:');
    console.log('1. Run Classification Engine to suggest categoryId, counterpartyId, locationId');
    console.log('2. Review and confirm classifications');
    console.log('3. Run Split Engine to determine estateAllocation (ALT/NEU)');
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
