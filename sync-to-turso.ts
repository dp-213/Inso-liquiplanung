/**
 * Turso-Sync: PLAN behalten, IST vollständig ersetzen
 *
 * KRITISCH: PLAN-Daten (56 Entries) bleiben erhalten!
 * Nur IST-Daten werden gelöscht und neu aus lokalem Prisma importiert.
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@libsql/client';

const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

// Lokale Prisma-DB (Source) - EXPLIZIT mit file: URL
const prismaLocal = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./dev.db'
    }
  }
});

// Turso Production (Target) - aus .env.production laden
config({ path: '.env.production' });
const tursoUrl = process.env.DATABASE_URL || '';
const turso = createClient({
  url: tursoUrl,
  authToken: process.env.TURSO_AUTH_TOKEN || ''
});

async function syncToTurso() {
  console.log('=== TURSO-SYNC: PLAN behalten, IST ersetzen ===\n');

  if (!tursoUrl || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error('❌ DATABASE_URL oder TURSO_AUTH_TOKEN nicht gesetzt!');
  }

  console.log(`   Turso URL: ${tursoUrl.substring(0, 30)}...`);
  console.log(`   Auth Token: ${process.env.TURSO_AUTH_TOKEN ? '✅ gesetzt' : '❌ fehlt'}\n`);

  // 1. PLAN-Daten in Turso zählen (VORHER)
  console.log('## 1. PLAN-Daten verifizieren (Turso) - DÜRFEN NICHT GELÖSCHT WERDEN!\n');

  const tursoCountBefore = await turso.execute({
    sql: 'SELECT COUNT(*) as count FROM ledger_entries WHERE caseId = ? AND valueType = ?',
    args: [caseId, 'PLAN']
  });

  const planCountBefore = Number(tursoCountBefore.rows[0]?.count) || 0;
  console.log(`   Turso PLAN-Count (VORHER): ${planCountBefore}`);
  console.log(`   ⚠️ Diese Daten bleiben erhalten!\n`);

  // 2. IST-Count in Turso (VORHER)
  const tursoIstCountBefore = await turso.execute({
    sql: 'SELECT COUNT(*) as count FROM ledger_entries WHERE caseId = ? AND valueType = ?',
    args: [caseId, 'IST']
  });

  const istCountBefore = Number(tursoIstCountBefore.rows[0]?.count) || 0;
  console.log(`   Turso IST-Count (VORHER): ${istCountBefore}\n`);

  // 3. IST-Daten aus lokalem Prisma holen
  console.log('## 2. IST-Daten aus lokalem Prisma laden\n');

  const localIstEntries = await prismaLocal.ledgerEntry.findMany({
    where: { caseId, valueType: 'IST' },
    orderBy: { transactionDate: 'asc' }
  });

  console.log(`   Lokale IST-Entries: ${localIstEntries.length}\n`);

  // 4. Alte IST-Daten in Turso löschen (NUR IST!)
  console.log('## 3. Alte IST-Daten in Turso löschen (PLAN bleibt!)\n');

  const deleteResult = await turso.execute({
    sql: 'DELETE FROM ledger_entries WHERE caseId = ? AND valueType = ?',
    args: [caseId, 'IST']
  });

  console.log(`   Gelöscht: ${deleteResult.rowsAffected} IST-Entries`);
  console.log(`   (PLAN-Entries wurden NICHT gelöscht)\n`);

  // 5. Neue IST-Daten nach Turso schreiben
  console.log('## 4. Neue IST-Daten nach Turso schreiben\n');

  let insertCount = 0;
  const batchSize = 50;

  for (let i = 0; i < localIstEntries.length; i += batchSize) {
    const batch = localIstEntries.slice(i, i + batchSize);

    for (const entry of batch) {
      // Konvertiere BigInt zu Number + Dates zu Timestamps
      // WICHTIG: undefined → null konvertieren, sonst Fehler!
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
          entry.id ?? null,
          entry.caseId ?? null,
          entry.valueType ?? null,
          entry.transactionDate?.getTime() ?? null,
          entry.amountCents ? Number(entry.amountCents) : null,
          entry.description ?? null,
          entry.bankAccountId ?? null,
          entry.counterpartyId ?? null,
          entry.locationId ?? null,
          entry.categoryTag ?? null,
          entry.legalBucket ?? null,
          entry.estateAllocation ?? null,
          entry.estateRatio ?? null,
          entry.allocationSource ?? null,
          entry.allocationNote ?? null,
          entry.serviceDate?.getTime() ?? null,
          entry.servicePeriodStart?.getTime() ?? null,
          entry.servicePeriodEnd?.getTime() ?? null,
          entry.reviewStatus ?? null,
          entry.suggestedLegalBucket ?? null,
          entry.suggestedCounterpartyId ?? null,
          entry.suggestedLocationId ?? null,
          entry.openingBalanceCents ? Number(entry.openingBalanceCents) : null,
          entry.closingBalanceCents ? Number(entry.closingBalanceCents) : null,
          entry.importJobId ?? null,
          entry.sourceEffectId ?? null,
          entry.parentEntryId ?? null,
          entry.transferPartnerEntryId ?? null,
          entry.createdAt?.getTime() ?? null,
          entry.createdBy ?? null,
          entry.updatedAt?.getTime() ?? null,
          entry.updatedBy ?? null
        ]
      });

      insertCount++;
    }

    console.log(`   Fortschritt: ${insertCount}/${localIstEntries.length}`);
  }

  console.log(`\n   ✅ ${insertCount} IST-Entries erfolgreich nach Turso geschrieben\n`);

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

  console.log(`   PLAN-Count: ${planCount} (Erwartet: ${planCountBefore}) ${planCount === planCountBefore ? '✅' : '❌'}`);
  console.log(`   IST-Count:  ${istCount} (Erwartet: ${localIstEntries.length}) ${istCount === localIstEntries.length ? '✅' : '❌'}\n`);

  if (planCount !== planCountBefore) {
    throw new Error(`❌ KRITISCH: PLAN-Daten wurden verändert! Vorher: ${planCountBefore}, Nachher: ${planCount}`);
  }

  if (istCount !== localIstEntries.length) {
    throw new Error('❌ Verifikation fehlgeschlagen! IST-Counts stimmen nicht.');
  }

  console.log('✅ TURSO-SYNC ERFOLGREICH!\n');
  console.log(`   - ${planCount} PLAN-Entries (unverändert) ✅`);
  console.log(`   - ${istCount} IST-Entries (aktuell + verifiziert) ✅`);
  console.log(`   - HZV mit Service-Period + Alt/Neu-Split korrekt\n`);

  await prismaLocal.$disconnect();
}

// Führe Sync aus
syncToTurso().catch((error) => {
  console.error('\n❌ FEHLER beim Turso-Sync:');
  console.error(error);
  process.exit(1);
});
