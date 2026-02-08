/**
 * Turso-Sync Script - PLAN behalten, IST ersetzen
 *
 * Workflow:
 * 1. Backup Turso erstellen (manuell via CLI)
 * 2. PLAN-Daten sichern (Count verifizieren)
 * 3. Alle IST-Daten löschen
 * 4. 691 verifizierte IST-Entries importieren
 * 5. Verify: PLAN = 69, IST = 691
 *
 * WICHTIG: Dieses Script liest aus LOKALER dev.db (Prisma)
 * und schreibt nach TURSO Production!
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@libsql/client';

const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

// Lokale Prisma-DB (Source)
const prismaLocal = new PrismaClient({
  datasources: { db: { url: 'file:./dev.db' } }
});

// Turso Production (Target)
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://inso-liquiplanung-v2-dp-213.aws-eu-west-1.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN || ''
});

async function syncToTurso() {
  console.log('=== TURSO-SYNC: PLAN behalten, IST ersetzen ===\n');

  // 1. PLAN-Daten in Turso zählen (VORHER)
  console.log('## 1. PLAN-Daten verifizieren (Turso)\n');

  const tursoCountBefore = await turso.execute({
    sql: 'SELECT COUNT(*) as count FROM ledger_entries WHERE caseId = ? AND valueType = ?',
    args: [caseId, 'PLAN']
  });

  const planCountBefore = tursoCountBefore.rows[0]?.count as number;
  console.log(`   Turso PLAN-Count (VORHER): ${planCountBefore}`);

  if (planCountBefore !== 69) {
    console.log(`   ⚠️ WARNING: Erwartete 69 PLAN-Entries, gefunden: ${planCountBefore}`);
    console.log(`   Fortfahren? (Ctrl+C zum Abbrechen, Enter zum Fortfahren)`);
    // await new Promise(resolve => process.stdin.once('data', resolve));
  }

  // 2. IST-Daten aus lokalem Prisma holen
  console.log('\n## 2. IST-Daten aus lokalem Prisma laden\n');

  const localIstEntries = await prismaLocal.ledgerEntry.findMany({
    where: { caseId, valueType: 'IST' },
    orderBy: { transactionDate: 'asc' }
  });

  console.log(`   Lokale IST-Entries: ${localIstEntries.length}`);

  if (localIstEntries.length !== 691) {
    throw new Error(`Erwartete 691 IST-Entries, gefunden: ${localIstEntries.length}`);
  }

  // 3. Alte IST-Daten in Turso löschen
  console.log('\n## 3. Alte IST-Daten in Turso löschen\n');

  const deleteResult = await turso.execute({
    sql: 'DELETE FROM ledger_entries WHERE caseId = ? AND valueType = ?',
    args: [caseId, 'IST']
  });

  console.log(`   Gelöscht: ${deleteResult.rowsAffected} IST-Entries`);

  // 4. Neue IST-Daten nach Turso schreiben
  console.log('\n## 4. Neue IST-Daten nach Turso schreiben\n');

  let insertCount = 0;
  const batchSize = 50;

  for (let i = 0; i < localIstEntries.length; i += batchSize) {
    const batch = localIstEntries.slice(i, i + batchSize);

    for (const entry of batch) {
      // Konvertiere BigInt zu Number für libsql
      const entryData = {
        ...entry,
        amountCents: Number(entry.amountCents),
        openingBalanceCents: entry.openingBalanceCents ? Number(entry.openingBalanceCents) : null,
        transactionDate: entry.transactionDate.getTime(),
        serviceDate: entry.serviceDate ? entry.serviceDate.getTime() : null,
        servicePeriodStart: entry.servicePeriodStart ? entry.servicePeriodStart.getTime() : null,
        servicePeriodEnd: entry.servicePeriodEnd ? entry.servicePeriodEnd.getTime() : null,
        createdAt: entry.createdAt.getTime(),
        updatedAt: entry.updatedAt.getTime()
      };

      await turso.execute({
        sql: `INSERT INTO ledger_entries (
          id, caseId, valueType, transactionDate, amountCents, description,
          bankAccountId, counterpartyId, locationId, categoryTag,
          legalBucket, estateAllocation, estateRatio, allocationSource, allocationNote,
          serviceDate, servicePeriodStart, servicePeriodEnd,
          reviewStatus, suggestedLegalBucket, suggestedCounterpartyId,
          suggestedLocationId, openingBalanceCents, closingBalanceCents,
          importJobId, sourceEffectId, parentEntryId, transferPartnerEntryId,
          createdAt, createdBy, updatedAt, updatedBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          entryData.id,
          entryData.caseId,
          entryData.valueType,
          entryData.transactionDate,
          entryData.amountCents,
          entryData.description,
          entryData.bankAccountId,
          entryData.counterpartyId,
          entryData.locationId,
          entryData.categoryTag,
          entryData.legalBucket,
          entryData.estateAllocation,
          entryData.estateRatio,
          entryData.allocationSource,
          entryData.allocationNote,
          entryData.serviceDate,
          entryData.servicePeriodStart,
          entryData.servicePeriodEnd,
          entryData.reviewStatus,
          entryData.suggestedLegalBucket,
          entryData.suggestedCounterpartyId,
          entryData.suggestedLocationId,
          entryData.openingBalanceCents,
          entryData.closingBalanceCents,
          entryData.importJobId,
          entryData.sourceEffectId,
          entryData.parentEntryId,
          entryData.transferPartnerEntryId,
          entryData.createdAt,
          entryData.createdBy,
          entryData.updatedAt,
          entryData.updatedBy
        ]
      });

      insertCount++;
    }

    console.log(`   Fortschritt: ${insertCount}/${localIstEntries.length}`);
  }

  console.log(`   ✅ ${insertCount} IST-Entries erfolgreich nach Turso geschrieben`);

  // 5. Verify: Zähle PLAN und IST in Turso (NACHHER)
  console.log('\n## 5. Verifikation (Turso NACHHER)\n');

  const planCountAfter = await turso.execute({
    sql: 'SELECT COUNT(*) as count FROM ledger_entries WHERE caseId = ? AND valueType = ?',
    args: [caseId, 'PLAN']
  });

  const istCountAfter = await turso.execute({
    sql: 'SELECT COUNT(*) as count FROM ledger_entries WHERE caseId = ? AND valueType = ?',
    args: [caseId, 'IST']
  });

  const planCount = planCountAfter.rows[0]?.count as number;
  const istCount = istCountAfter.rows[0]?.count as number;

  console.log(`   PLAN-Count: ${planCount} (Erwartet: 69) ${planCount === 69 ? '✅' : '❌'}`);
  console.log(`   IST-Count:  ${istCount} (Erwartet: 691) ${istCount === 691 ? '✅' : '❌'}`);

  if (planCount !== 69 || istCount !== 691) {
    throw new Error('Verifikation fehlgeschlagen! Counts stimmen nicht.');
  }

  console.log('\n✅ TURSO-SYNC ERFOLGREICH!\n');

  await prismaLocal.$disconnect();
}

// Führe Sync aus
syncToTurso().catch((error) => {
  console.error('\n❌ FEHLER beim Turso-Sync:');
  console.error(error);
  process.exit(1);
});
