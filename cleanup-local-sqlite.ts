/**
 * SQLite-Bereinigung: Alte IST-Daten entfernen, PLAN behalten
 *
 * Ziel: dev.db auf denselben Stand wie Turso bringen
 * - PLAN-Daten behalten (69 Entries)
 * - IST-Daten: Nur die 691 verifizierten Entries behalten
 * - Alte/gemischte IST-Daten entfernen
 */

import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';

const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';
const dbPath = './dev.db';

async function cleanupLocalSQLite() {
  console.log('=== SQLite-Bereinigung: Alte IST-Daten entfernen ===\n');

  // 1. Prisma-Client für Abfragen
  const prisma = new PrismaClient();

  // 2. SQLite direkt für Löschung
  const db = Database(dbPath);

  // 3. Zähle VORHER
  console.log('## 1. Status VORHER\n');

  const countsBefore = db.prepare(`
    SELECT valueType, COUNT(*) as count
    FROM ledger_entries
    WHERE caseId = ?
    GROUP BY valueType
  `).all(caseId);

  for (const row of countsBefore as any[]) {
    console.log(`   ${row.valueType}: ${row.count} Entries`);
  }

  // 4. Hole die 691 verifizierten IST-Entry-IDs aus Prisma
  console.log('\n## 2. Verifizierte IST-Entries identifizieren\n');

  const verifiedIstEntries = await prisma.ledgerEntry.findMany({
    where: { caseId, valueType: 'IST' },
    select: { id: true }
  });

  console.log(`   Verifizierte IST-Entries (Prisma): ${verifiedIstEntries.length}`);

  if (verifiedIstEntries.length !== 691) {
    throw new Error(`Erwartete 691 IST-Entries, gefunden: ${verifiedIstEntries.length}`);
  }

  const verifiedIds = verifiedIstEntries.map(e => e.id);

  // 5. Zähle IST-Entries in SQLite VORHER
  const sqliteIstCountBefore = db.prepare(`
    SELECT COUNT(*) as count
    FROM ledger_entries
    WHERE caseId = ? AND valueType = 'IST'
  `).get(caseId) as any;

  console.log(`   IST-Entries in SQLite (VORHER): ${sqliteIstCountBefore.count}`);

  // 6. Lösche ALLE IST-Entries (werden gleich neu eingefügt)
  console.log('\n## 3. Alte IST-Daten löschen\n');

  const deleteResult = db.prepare(`
    DELETE FROM ledger_entries
    WHERE caseId = ? AND valueType = 'IST'
  `).run(caseId);

  console.log(`   Gelöscht: ${deleteResult.changes} IST-Entries`);

  // 7. Füge die 691 verifizierten Entries wieder ein
  console.log('\n## 4. Verifizierte IST-Entries zurückschreiben\n');

  const verifiedEntries = await prisma.ledgerEntry.findMany({
    where: { caseId, valueType: 'IST' }
  });

  const insertStmt = db.prepare(`
    INSERT INTO ledger_entries (
      id, caseId, valueType, transactionDate, amountCents, description,
      bankAccountId, counterpartyId, locationId, categoryTag,
      legalBucket, estateAllocation, estateRatio, allocationSource, allocationNote,
      serviceDate, servicePeriodStart, servicePeriodEnd,
      reviewStatus, suggestedLegalBucket, suggestedCounterpartyId,
      suggestedLocationId, openingBalanceCents, closingBalanceCents,
      importJobId, sourceEffectId, parentEntryId, transferPartnerEntryId,
      createdAt, createdBy, updatedAt, updatedBy
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((entries: any[]) => {
    for (const entry of entries) {
      insertStmt.run(
        entry.id,
        entry.caseId,
        entry.valueType,
        entry.transactionDate.getTime(),
        Number(entry.amountCents),
        entry.description,
        entry.bankAccountId,
        entry.counterpartyId,
        entry.locationId,
        entry.categoryTag,
        entry.legalBucket,
        entry.estateAllocation,
        entry.estateRatio,
        entry.allocationSource,
        entry.allocationNote,
        entry.serviceDate ? entry.serviceDate.getTime() : null,
        entry.servicePeriodStart ? entry.servicePeriodStart.getTime() : null,
        entry.servicePeriodEnd ? entry.servicePeriodEnd.getTime() : null,
        entry.reviewStatus,
        entry.suggestedLegalBucket,
        entry.suggestedCounterpartyId,
        entry.suggestedLocationId,
        entry.openingBalanceCents ? Number(entry.openingBalanceCents) : null,
        entry.closingBalanceCents ? Number(entry.closingBalanceCents) : null,
        entry.importJobId,
        entry.sourceEffectId,
        entry.parentEntryId,
        entry.transferPartnerEntryId,
        entry.createdAt.getTime(),
        entry.createdBy,
        entry.updatedAt.getTime(),
        entry.updatedBy
      );
    }
  });

  insertMany(verifiedEntries);

  console.log(`   ✅ ${verifiedEntries.length} IST-Entries zurückgeschrieben`);

  // 8. Verify NACHHER
  console.log('\n## 5. Status NACHHER\n');

  const countsAfter = db.prepare(`
    SELECT valueType, COUNT(*) as count
    FROM ledger_entries
    WHERE caseId = ?
    GROUP BY valueType
  `).all(caseId);

  for (const row of countsAfter as any[]) {
    console.log(`   ${row.valueType}: ${row.count} Entries`);
  }

  // Verify
  const istCountAfter = countsAfter.find((r: any) => r.valueType === 'IST')?.count || 0;
  const planCountAfter = countsAfter.find((r: any) => r.valueType === 'PLAN')?.count || 0;

  if (istCountAfter !== 691) {
    throw new Error(`IST-Count falsch! Erwartet: 691, Ist: ${istCountAfter}`);
  }

  if (planCountAfter !== 69) {
    throw new Error(`PLAN-Count falsch! Erwartet: 69, Ist: ${planCountAfter}`);
  }

  console.log('\n✅ SQLite-Bereinigung ERFOLGREICH!\n');
  console.log(`   PLAN: 69 Entries (unverändert) ✅`);
  console.log(`   IST: 691 Entries (verifiziert) ✅`);

  db.close();
  await prisma.$disconnect();
}

cleanupLocalSQLite().catch((error) => {
  console.error('\n❌ FEHLER bei SQLite-Bereinigung:');
  console.error(error);
  process.exit(1);
});
