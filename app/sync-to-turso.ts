/**
 * Turso-Sync: PLAN behalten, IST vollständig ersetzen
 *
 * ALLE 56 Spalten der ledger_entries Tabelle werden synchronisiert.
 * PLAN-Daten bleiben in Turso erhalten, nur IST wird ersetzt.
 *
 * Fehlende Felder im alten Script (29 von 56):
 *   note, splitReason, importSource, importFileHash, importRowNumber,
 *   bookingSource, bookingSourceId, bookingReference, steeringTag,
 *   categoryTagSource, categoryTagNote, suggestedCategoryTag,
 *   suggestedCategoryTagReason, reviewedBy, reviewedAt, reviewNote,
 *   changeReason, previousAmountCents, suggestedCategory,
 *   suggestedConfidence, suggestedRuleId, suggestedReason,
 *   suggestedBankAccountId, suggestedServiceDate,
 *   suggestedServicePeriodStart, suggestedServicePeriodEnd,
 *   suggestedServiceDateRule
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@libsql/client';

const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

// Turso Production (Target) - ZUERST laden, BEVOR PrismaClient initialisiert wird
// (dotenv überschreibt sonst DATABASE_URL)
config({ path: '/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/app/.env.production' });

// Lokale Prisma-DB (Source) - absoluter Pfad, um Auflösungsprobleme zu vermeiden
const prismaLocal = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/app/prisma/dev.db'
    }
  }
});
const tursoUrl = 'libsql://inso-liquiplanung-v2-dp-213.aws-eu-west-1.turso.io';
const turso = createClient({
  url: tursoUrl,
  authToken: process.env.TURSO_AUTH_TOKEN || ''
});

/** Konvertiert Date → Unix-Timestamp (ms) oder null */
function dateToMs(d: Date | null | undefined): number | null {
  return d ? d.getTime() : null;
}

/** Konvertiert BigInt → Number oder null */
function bigIntToNum(b: bigint | null | undefined): number | null {
  return b != null ? Number(b) : null;
}

/** Konvertiert Decimal → Number oder null */
function decimalToNum(d: any): number | null {
  if (d == null) return null;
  return typeof d === 'number' ? d : Number(d);
}

/** null-safe: undefined → null */
function n(val: any): any {
  return val ?? null;
}

async function syncToTurso() {
  console.log('=== TURSO-SYNC: PLAN behalten, IST ersetzen (ALLE 56 Spalten) ===\n');

  if (!tursoUrl || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error('DATABASE_URL oder TURSO_AUTH_TOKEN nicht gesetzt!');
  }

  console.log(`   Turso URL: ${tursoUrl.substring(0, 40)}...`);
  console.log(`   Auth Token: ${process.env.TURSO_AUTH_TOKEN ? 'gesetzt' : 'fehlt'}\n`);

  // 1. PLAN-Daten in Turso zählen (VORHER)
  console.log('## 1. PLAN-Daten verifizieren (Turso) - werden NICHT gelöscht!\n');

  const tursoCountBefore = await turso.execute({
    sql: 'SELECT COUNT(*) as count FROM ledger_entries WHERE caseId = ? AND valueType = ?',
    args: [caseId, 'PLAN']
  });
  const planCountBefore = Number(tursoCountBefore.rows[0]?.count) || 0;
  console.log(`   Turso PLAN-Count (VORHER): ${planCountBefore}\n`);

  // 2. IST-Count in Turso (VORHER)
  const tursoIstBefore = await turso.execute({
    sql: 'SELECT COUNT(*) as count FROM ledger_entries WHERE caseId = ? AND valueType = ?',
    args: [caseId, 'IST']
  });
  const istCountBefore = Number(tursoIstBefore.rows[0]?.count) || 0;
  console.log(`   Turso IST-Count (VORHER): ${istCountBefore}\n`);

  // 3. IST-Daten aus lokalem Prisma holen
  console.log('## 2. IST-Daten aus lokalem Prisma laden\n');

  const localIstEntries = await prismaLocal.ledgerEntry.findMany({
    where: { caseId, valueType: 'IST' },
    orderBy: { transactionDate: 'asc' }
  });
  console.log(`   Lokale IST-Entries: ${localIstEntries.length}\n`);

  // Stichprobe: importSource/bookingSource prüfen
  const withImportSource = localIstEntries.filter(e => e.importSource).length;
  const withBookingSource = localIstEntries.filter(e => e.bookingSource).length;
  const withBookingRef = localIstEntries.filter(e => e.bookingReference).length;
  console.log(`   Mit importSource: ${withImportSource}/${localIstEntries.length}`);
  console.log(`   Mit bookingSource: ${withBookingSource}/${localIstEntries.length}`);
  console.log(`   Mit bookingReference: ${withBookingRef}/${localIstEntries.length}\n`);

  // 4. Alte IST-Daten in Turso löschen (NUR IST!)
  console.log('## 3. Alte IST-Daten in Turso löschen (PLAN bleibt!)\n');

  const deleteResult = await turso.execute({
    sql: 'DELETE FROM ledger_entries WHERE caseId = ? AND valueType = ?',
    args: [caseId, 'IST']
  });
  console.log(`   Gelöscht: ${deleteResult.rowsAffected} IST-Entries\n`);

  // 5. Neue IST-Daten nach Turso schreiben - ALLE 56 Spalten
  console.log('## 4. Neue IST-Daten nach Turso schreiben (56 Spalten)\n');

  let insertCount = 0;
  const batchSize = 50;

  for (let i = 0; i < localIstEntries.length; i += batchSize) {
    const batch = localIstEntries.slice(i, i + batchSize);

    for (const entry of batch) {
      try {
        await turso.execute({
          sql: `INSERT INTO ledger_entries (
            id, caseId, transactionDate, amountCents, description, note,
            valueType, legalBucket,
            serviceDate, servicePeriodStart, servicePeriodEnd,
            estateAllocation, estateRatio,
            allocationSource, allocationNote,
            parentEntryId, splitReason,
            importSource, importJobId, importFileHash, importRowNumber,
            bookingSource, bookingSourceId, bookingReference,
            bankAccountId, counterpartyId, locationId, steeringTag,
            reviewStatus, reviewedBy, reviewedAt, reviewNote,
            changeReason, previousAmountCents,
            suggestedLegalBucket, suggestedCategory, suggestedConfidence,
            suggestedRuleId, suggestedReason,
            suggestedBankAccountId, suggestedCounterpartyId, suggestedLocationId,
            sourceEffectId,
            createdAt, createdBy, updatedAt,
            suggestedServiceDate, suggestedServiceDateRule,
            suggestedServicePeriodEnd, suggestedServicePeriodStart,
            categoryTag, categoryTagNote, categoryTagSource,
            suggestedCategoryTag, suggestedCategoryTagReason,
            transferPartnerEntryId
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?,
            ?, ?,
            ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?,
            ?, ?, ?,
            ?,
            ?, ?, ?,
            ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?,
            ?
          )`,
          args: [
            n(entry.id), n(entry.caseId), dateToMs(entry.transactionDate),
            bigIntToNum(entry.amountCents), n(entry.description), n(entry.note),
            n(entry.valueType), n(entry.legalBucket),
            dateToMs(entry.serviceDate), dateToMs(entry.servicePeriodStart), dateToMs(entry.servicePeriodEnd),
            n(entry.estateAllocation), decimalToNum(entry.estateRatio),
            n(entry.allocationSource), n(entry.allocationNote),
            n(entry.parentEntryId), n(entry.splitReason),
            n(entry.importSource), n(entry.importJobId), n(entry.importFileHash), n(entry.importRowNumber),
            n(entry.bookingSource), n(entry.bookingSourceId), n(entry.bookingReference),
            n(entry.bankAccountId), n(entry.counterpartyId), n(entry.locationId), n(entry.steeringTag),
            n(entry.reviewStatus), n(entry.reviewedBy), dateToMs(entry.reviewedAt), n(entry.reviewNote),
            n(entry.changeReason), bigIntToNum(entry.previousAmountCents),
            n(entry.suggestedLegalBucket), n(entry.suggestedCategory), n(entry.suggestedConfidence),
            n(entry.suggestedRuleId), n(entry.suggestedReason),
            n(entry.suggestedBankAccountId), n(entry.suggestedCounterpartyId), n(entry.suggestedLocationId),
            n(entry.sourceEffectId),
            dateToMs(entry.createdAt), n(entry.createdBy), dateToMs(entry.updatedAt),
            dateToMs(entry.suggestedServiceDate), n(entry.suggestedServiceDateRule),
            dateToMs(entry.suggestedServicePeriodEnd), dateToMs(entry.suggestedServicePeriodStart),
            n(entry.categoryTag), n(entry.categoryTagNote), n(entry.categoryTagSource),
            n(entry.suggestedCategoryTag), n(entry.suggestedCategoryTagReason),
            n(entry.transferPartnerEntryId)
          ]
        });
        insertCount++;
      } catch (error) {
        console.error(`\nFEHLER bei Entry ${insertCount + 1}: ${entry.id}`);
        console.error('   Description:', entry.description?.substring(0, 100));
        console.error('   BankAccountId:', entry.bankAccountId);
        throw error;
      }
    }

    console.log(`   Fortschritt: ${insertCount}/${localIstEntries.length}`);
  }

  console.log(`\n   ${insertCount} IST-Entries erfolgreich nach Turso geschrieben\n`);

  // 6. Verify: Zähle PLAN und IST in Turso (NACHHER)
  console.log('## 5. Verifikation (Turso NACHHER)\n');

  const planCountAfter = await turso.execute({
    sql: 'SELECT COUNT(*) as count FROM ledger_entries WHERE caseId = ? AND valueType = ?',
    args: [caseId, 'PLAN']
  });
  const istCountAfter = await turso.execute({
    sql: 'SELECT COUNT(*) as count FROM ledger_entries WHERE caseId = ? AND valueType = ?',
    args: [caseId, 'IST']
  });

  const planCount = Number(planCountAfter.rows[0]?.count) || 0;
  const istCount = Number(istCountAfter.rows[0]?.count) || 0;

  console.log(`   PLAN-Count: ${planCount} (Erwartet: ${planCountBefore}) ${planCount === planCountBefore ? 'OK' : 'FEHLER'}`);
  console.log(`   IST-Count:  ${istCount} (Erwartet: ${localIstEntries.length}) ${istCount === localIstEntries.length ? 'OK' : 'FEHLER'}\n`);

  if (planCount !== planCountBefore) {
    throw new Error(`KRITISCH: PLAN-Daten wurden verändert! Vorher: ${planCountBefore}, Nachher: ${planCount}`);
  }

  if (istCount !== localIstEntries.length) {
    throw new Error('Verifikation fehlgeschlagen! IST-Counts stimmen nicht.');
  }

  // 7. Stichprobe: importSource in Turso prüfen
  console.log('## 6. Stichprobe: Neue Felder in Turso\n');

  const sampleCheck = await turso.execute({
    sql: `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN importSource IS NOT NULL THEN 1 ELSE 0 END) as withImportSource,
      SUM(CASE WHEN bookingSource IS NOT NULL THEN 1 ELSE 0 END) as withBookingSource,
      SUM(CASE WHEN bookingReference IS NOT NULL THEN 1 ELSE 0 END) as withBookingRef,
      SUM(CASE WHEN categoryTag IS NOT NULL THEN 1 ELSE 0 END) as withCategoryTag
    FROM ledger_entries WHERE caseId = ? AND valueType = ?`,
    args: [caseId, 'IST']
  });

  const row = sampleCheck.rows[0];
  console.log(`   Total IST:         ${row?.total}`);
  console.log(`   Mit importSource:  ${row?.withImportSource}`);
  console.log(`   Mit bookingSource: ${row?.withBookingSource}`);
  console.log(`   Mit bookingRef:    ${row?.withBookingRef}`);
  console.log(`   Mit categoryTag:   ${row?.withCategoryTag}\n`);

  console.log('TURSO-SYNC ERFOLGREICH!\n');
  console.log(`   - ${planCount} PLAN-Entries (unverändert)`);
  console.log(`   - ${istCount} IST-Entries (alle 56 Spalten synchronisiert)`);
  console.log(`   - Audit-Trail vollständig: importSource + bookingSource + bookingReference\n`);

  await prismaLocal.$disconnect();
}

syncToTurso().catch((error) => {
  console.error('\nFEHLER beim Turso-Sync:');
  console.error(error);
  process.exit(1);
});
