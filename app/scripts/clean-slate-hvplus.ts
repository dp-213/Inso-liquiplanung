/**
 * Clean-Slate-Script: HVPlus Ledger-Daten löschen
 *
 * Löscht für den Case "70d IN 362/25":
 * - Alle LedgerAuditLog-Einträge (FK auf LedgerEntry)
 * - Alle LedgerEntry-Einträge
 *
 * NICHT gelöscht:
 * - Case, Locations, Counterparties, BankAccounts, LiquidityPlan, ClassificationRules
 *
 * Ausführung: cd app && npx tsx scripts/clean-slate-hvplus.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CASE_NUMBER = '70d IN 362/25';

async function cleanSlate() {
  console.log('='.repeat(60));
  console.log('CLEAN SLATE: HVPlus Ledger-Daten löschen');
  console.log('='.repeat(60));

  // 1. Case finden
  console.log('\n1. Suche Case...');
  const hvplusCase = await prisma.case.findFirst({
    where: { caseNumber: CASE_NUMBER },
  });

  if (!hvplusCase) {
    console.error(`   FEHLER: Case ${CASE_NUMBER} nicht gefunden.`);
    process.exit(1);
  }
  console.log(`   Case: ${hvplusCase.debtorName} (${hvplusCase.id})`);

  // 2. Zählen was gelöscht wird
  console.log('\n2. Zähle existierende Einträge...');
  const auditLogCount = await prisma.ledgerAuditLog.count({
    where: { caseId: hvplusCase.id },
  });
  const ledgerEntryCount = await prisma.ledgerEntry.count({
    where: { caseId: hvplusCase.id },
  });

  console.log(`   LedgerAuditLog: ${auditLogCount} Einträge`);
  console.log(`   LedgerEntry:    ${ledgerEntryCount} Einträge`);

  if (ledgerEntryCount === 0 && auditLogCount === 0) {
    console.log('\n   Keine Einträge vorhanden. Nichts zu löschen.');
    return;
  }

  // 3. Löschen: Zuerst AuditLogs (FK-Abhängigkeit), dann LedgerEntries
  console.log('\n3. Lösche Daten...');

  const deletedAuditLogs = await prisma.ledgerAuditLog.deleteMany({
    where: { caseId: hvplusCase.id },
  });
  console.log(`   LedgerAuditLog gelöscht: ${deletedAuditLogs.count}`);

  const deletedEntries = await prisma.ledgerEntry.deleteMany({
    where: { caseId: hvplusCase.id },
  });
  console.log(`   LedgerEntry gelöscht:    ${deletedEntries.count}`);

  // 4. Verifizierung
  console.log('\n4. Verifizierung...');
  const remainingEntries = await prisma.ledgerEntry.count({
    where: { caseId: hvplusCase.id },
  });
  const remainingLogs = await prisma.ledgerAuditLog.count({
    where: { caseId: hvplusCase.id },
  });

  console.log(`   Verbleibende LedgerEntries: ${remainingEntries}`);
  console.log(`   Verbleibende AuditLogs:     ${remainingLogs}`);

  if (remainingEntries === 0 && remainingLogs === 0) {
    console.log('\n   CLEAN SLATE erfolgreich. Alle Ledger-Daten gelöscht.');
  } else {
    console.error('\n   WARNUNG: Es verbleiben noch Einträge!');
  }

  // 5. Stammdaten-Übersicht (nicht gelöscht)
  console.log('\n5. Stammdaten (erhalten):');
  const locations = await prisma.location.count({ where: { caseId: hvplusCase.id } });
  const counterparties = await prisma.counterparty.count({ where: { caseId: hvplusCase.id } });
  const bankAccounts = await prisma.bankAccount.count({ where: { caseId: hvplusCase.id } });
  const rules = await prisma.classificationRule.count({ where: { caseId: hvplusCase.id } });

  console.log(`   Locations:           ${locations}`);
  console.log(`   Counterparties:      ${counterparties}`);
  console.log(`   BankAccounts:        ${bankAccounts}`);
  console.log(`   ClassificationRules: ${rules}`);

  console.log('\n' + '='.repeat(60));
  console.log('FERTIG');
  console.log('='.repeat(60));
}

cleanSlate()
  .catch((e) => {
    console.error('Clean-Slate fehlgeschlagen:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
