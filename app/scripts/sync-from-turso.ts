/**
 * Kopiert den HVPlus Case von Turso nach lokal (exakte Kopie)
 */
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

// Turso Client
const tursoAdapter = new PrismaLibSQL({
  url: process.env.DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});
const turso = new PrismaClient({ adapter: tursoAdapter });

// Local Client (absolute path)
const local = new PrismaClient({
  datasources: { db: { url: 'file:/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/app/prisma/dev.db' } }
});

const CASE_NUMBER = '70d IN 362/25';

async function main() {
  console.log('=== SYNC VON TURSO NACH LOKAL ===\n');
  
  // 1. Hole Case von Turso
  console.log('1. Lade Case von Turso...');
  const tursoCase = await turso.case.findFirst({
    where: { caseNumber: CASE_NUMBER },
    include: {
      locations: true,
      counterparties: true,
      bankAccounts: true,
      plans: { include: { assumptions: true } },
      ledgerEntries: true,
    }
  });
  
  if (!tursoCase) {
    console.error('Case nicht auf Turso gefunden!');
    return;
  }
  
  console.log('   Gefunden:', tursoCase.debtorName);
  console.log('   Locations:', tursoCase.locations.length);
  console.log('   Counterparties:', tursoCase.counterparties.length);
  console.log('   LedgerEntries:', tursoCase.ledgerEntries.length);
  
  // 2. Lösche lokalen Case falls vorhanden
  console.log('\n2. Lösche lokalen Case...');
  const localCase = await local.case.findFirst({ where: { caseNumber: CASE_NUMBER } });
  if (localCase) {
    await local.ledgerEntry.deleteMany({ where: { caseId: localCase.id } });
    await local.planningAssumption.deleteMany({ 
      where: { plan: { caseId: localCase.id } } 
    });
    await local.liquidityPlan.deleteMany({ where: { caseId: localCase.id } });
    await local.counterparty.deleteMany({ where: { caseId: localCase.id } });
    await local.bankAccount.deleteMany({ where: { caseId: localCase.id } });
    await local.location.deleteMany({ where: { caseId: localCase.id } });
    await local.case.delete({ where: { id: localCase.id } });
    console.log('   Gelöscht');
  } else {
    console.log('   Kein lokaler Case vorhanden');
  }
  
  // 3. Finde lokalen Owner
  const owner = await local.customerUser.findFirst({ where: { isActive: true } });
  if (!owner) {
    console.error('Kein aktiver CustomerUser lokal!');
    return;
  }
  
  // 4. Erstelle Case lokal (mit gleicher ID wie Turso!)
  console.log('\n3. Erstelle Case lokal...');
  const newCase = await local.case.create({
    data: {
      id: tursoCase.id, // Gleiche ID!
      caseNumber: tursoCase.caseNumber,
      debtorName: tursoCase.debtorName,
      courtName: tursoCase.courtName,
      filingDate: tursoCase.filingDate,
      cutoffDate: tursoCase.cutoffDate,
      status: tursoCase.status,
      ownerId: owner.id,
      createdBy: tursoCase.createdBy,
      updatedBy: tursoCase.updatedBy,
      createdAt: tursoCase.createdAt,
      updatedAt: tursoCase.updatedAt,
    }
  });
  console.log('   Case ID:', newCase.id);
  
  // 5. Kopiere Locations
  console.log('\n4. Kopiere Locations...');
  for (const loc of tursoCase.locations) {
    await local.location.create({
      data: {
        id: loc.id,
        caseId: newCase.id,
        name: loc.name,
        shortName: loc.shortName,
        notes: loc.notes,
        createdBy: loc.createdBy,
        createdAt: loc.createdAt,
      }
    });
    console.log('   ', loc.name);
  }
  
  // 6. Kopiere Counterparties
  console.log('\n5. Kopiere Counterparties...');
  for (const cp of tursoCase.counterparties) {
    await local.counterparty.create({
      data: {
        id: cp.id,
        caseId: newCase.id,
        name: cp.name,
        shortName: cp.shortName,
        type: cp.type,
        matchPattern: cp.matchPattern,
        notes: cp.notes,
        isTopPayer: cp.isTopPayer,
        createdBy: cp.createdBy,
        createdAt: cp.createdAt,
      }
    });
    console.log('   ', cp.name);
  }
  
  // 7. Kopiere BankAccounts
  console.log('\n6. Kopiere BankAccounts...');
  for (const ba of tursoCase.bankAccounts) {
    await local.bankAccount.create({
      data: {
        id: ba.id,
        caseId: newCase.id,
        bankName: ba.bankName,
        accountName: ba.accountName,
        iban: ba.iban,
        openingBalanceCents: ba.openingBalanceCents,
        status: ba.status,
        createdBy: ba.createdBy,
        updatedBy: ba.updatedBy,
        createdAt: ba.createdAt,
        updatedAt: ba.updatedAt,
      }
    });
    console.log('   ', ba.accountName || ba.bankName);
  }
  
  // 8. Kopiere LiquidityPlans + Assumptions
  console.log('\n7. Kopiere LiquidityPlans...');
  for (const plan of tursoCase.plans) {
    await local.liquidityPlan.create({
      data: {
        id: plan.id,
        caseId: newCase.id,
        name: plan.name,
        description: plan.description,
        planStartDate: plan.planStartDate,
        periodType: plan.periodType,
        periodCount: plan.periodCount,
        isActive: plan.isActive,
        createdBy: plan.createdBy,
        updatedBy: plan.updatedBy,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      }
    });
    console.log('   ', plan.name);
    
    for (const ass of plan.assumptions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = ass as any;
      await local.planningAssumption.create({
        data: {
          id: a.id,
          caseId: tursoCase.id,
          planId: plan.id,
          title: a.title || a.categoryName || 'Unbekannt',
          source: a.source,
          description: a.description,
          status: a.status || 'ANNAHME',
          linkedModule: a.linkedModule || null,
          linkedEntityId: a.linkedEntityId || null,
          createdBy: a.createdBy,
          updatedBy: a.updatedBy,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        }
      });
    }
    console.log('     Assumptions:', plan.assumptions.length);
  }
  
  // 9. Kopiere LedgerEntries
  console.log('\n8. Kopiere LedgerEntries...');
  let count = 0;
  for (const entry of tursoCase.ledgerEntries) {
    await local.ledgerEntry.create({
      data: {
        id: entry.id,
        caseId: newCase.id,
        transactionDate: entry.transactionDate,
        amountCents: entry.amountCents,
        description: entry.description,
        valueType: entry.valueType,
        legalBucket: entry.legalBucket,
        bankAccountId: entry.bankAccountId,
        counterpartyId: entry.counterpartyId,
        locationId: entry.locationId,
        estateAllocation: entry.estateAllocation,
        estateRatio: entry.estateRatio,
        allocationSource: entry.allocationSource,
        allocationNote: entry.allocationNote,
        importSource: entry.importSource,
        importRowNumber: entry.importRowNumber,
        reviewStatus: entry.reviewStatus,
        createdBy: entry.createdBy,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }
    });
    count++;
  }
  console.log('   Kopiert:', count);
  
  console.log('\n=== SYNC ABGESCHLOSSEN ===');
  console.log('Case ID:', newCase.id);
  console.log('Dashboard: http://localhost:3000/admin/cases/' + newCase.id + '/dashboard');
}

main()
  .catch(console.error)
  .finally(async () => {
    await turso.$disconnect();
    await local.$disconnect();
  });
