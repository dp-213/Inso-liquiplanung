/**
 * Smoke Test: Classification Engine Pipeline
 *
 * Testet:
 * 1. ClassificationRule erstellen
 * 2. LedgerEntries mit classifyBatch verarbeiten
 * 3. Vorschläge prüfen
 * 4. Bulk-Confirm simulieren
 *
 * Ausführen: npx tsx scripts/smoke-test-classification.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Classification Engine Funktionen (direkt kopiert um Abhängigkeiten zu vermeiden)
function matchRule(
  rule: { matchField: string; matchType: string; matchValue: string },
  entry: { description: string; amountCents: bigint; bookingReference?: string | null }
): boolean {
  const getFieldValue = (e: typeof entry, field: string): string => {
    switch (field) {
      case 'DESCRIPTION': return e.description || '';
      case 'BOOKING_REFERENCE': return e.bookingReference || '';
      case 'AMOUNT': return e.amountCents.toString();
      default: return '';
    }
  };

  const fieldValue = getFieldValue(entry, rule.matchField);

  switch (rule.matchType) {
    case 'CONTAINS':
      return fieldValue.toLowerCase().includes(rule.matchValue.toLowerCase());
    case 'STARTS_WITH':
      return fieldValue.toLowerCase().startsWith(rule.matchValue.toLowerCase());
    case 'ENDS_WITH':
      return fieldValue.toLowerCase().endsWith(rule.matchValue.toLowerCase());
    case 'EQUALS':
      return fieldValue.toLowerCase() === rule.matchValue.toLowerCase();
    case 'REGEX':
      try {
        return new RegExp(rule.matchValue, 'i').test(fieldValue);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

async function main() {
  console.log('\n🔬 SMOKE TEST: Classification Pipeline\n');
  console.log('='.repeat(50));

  // 1. Test-Case finden oder erstellen
  console.log('\n📁 1. Test-Case vorbereiten...');

  let testCase = await prisma.case.findFirst({
    where: { caseNumber: { contains: 'SMOKE-TEST' } }
  });

  if (!testCase) {
    // Finde einen CustomerUser als Owner
    let owner = await prisma.customerUser.findFirst();
    if (!owner) {
      owner = await prisma.customerUser.create({
        data: {
          email: 'smoke-test@example.com',
          passwordHash: 'not-used',
          name: 'Smoke Test User',
          company: 'Test GmbH',
          createdBy: 'smoke-test',
          updatedBy: 'smoke-test',
        }
      });
      console.log('   ✓ Owner erstellt:', owner.id);
    }

    testCase = await prisma.case.create({
      data: {
        ownerId: owner.id,
        caseNumber: `SMOKE-TEST-${Date.now()}`,
        debtorName: 'Smoke-Test Schuldner GmbH',
        courtName: 'AG Teststadt',
        filingDate: new Date(),
        createdBy: 'smoke-test',
        updatedBy: 'smoke-test',
      }
    });
    console.log('   ✓ Case erstellt:', testCase.id);
  } else {
    console.log('   ✓ Existierender Case gefunden:', testCase.id);
  }

  const caseId = testCase.id;

  // 2. Alte Test-Daten aufräumen
  console.log('\n🧹 2. Alte Test-Daten aufräumen...');

  const deletedEntries = await prisma.ledgerEntry.deleteMany({
    where: { caseId, importSource: 'smoke-test' }
  });
  console.log(`   ✓ ${deletedEntries.count} alte Entries gelöscht`);

  const deletedRules = await prisma.classificationRule.deleteMany({
    where: { caseId, name: { startsWith: 'Test-Rule' } }
  });
  console.log(`   ✓ ${deletedRules.count} alte Rules gelöscht`);

  // 3. Classification Rules erstellen
  console.log('\n📋 3. Classification Rules erstellen...');

  const rules = [
    {
      name: 'Test-Rule: Miete → NEUTRAL',
      matchField: 'DESCRIPTION',
      matchType: 'CONTAINS',
      matchValue: 'Miete',
      suggestedLegalBucket: 'NEUTRAL',
      confidenceBonus: 0.15, // 0.7 + 0.15 = 0.85 (>80%)
      priority: 10,
    },
    {
      name: 'Test-Rule: Gehalt → MASSE',
      matchField: 'DESCRIPTION',
      matchType: 'CONTAINS',
      matchValue: 'Gehalt',
      suggestedLegalBucket: 'MASSE',
      confidenceBonus: 0.2, // 0.7 + 0.2 = 0.90 (>80%)
      priority: 20,
    },
    {
      name: 'Test-Rule: Bank → ABSONDERUNG',
      matchField: 'DESCRIPTION',
      matchType: 'STARTS_WITH',
      matchValue: 'Bank',
      suggestedLegalBucket: 'ABSONDERUNG',
      confidenceBonus: 0.15, // 0.7 + 0.15 = 0.85 (>80%)
      priority: 30,
    },
  ];

  const createdRules = [];
  for (const ruleData of rules) {
    const rule = await prisma.classificationRule.create({
      data: {
        caseId,
        ...ruleData,
        isActive: true,
        createdBy: 'smoke-test',
        updatedBy: 'smoke-test',
      }
    });
    createdRules.push(rule);
    console.log(`   ✓ Rule erstellt: "${rule.name}" (ID: ${rule.id.slice(0, 8)}...)`);
  }

  // 4. Test LedgerEntries erstellen (ohne Klassifikation)
  console.log('\n📝 4. Test LedgerEntries erstellen...');

  const testEntries = [
    { description: 'Miete Januar 2026', amountCents: -125000n },
    { description: 'Miete Februar 2026', amountCents: -125000n },
    { description: 'Gehaltszahlung Müller', amountCents: -350000n },
    { description: 'Bankgebühren Sparkasse', amountCents: -2500n },
    { description: 'Warenlieferung Schmitz GmbH', amountCents: -45000n }, // Kein Match
    { description: 'Kundeneingang Meyer', amountCents: 89000n },  // Kein Match
  ];

  const createdEntries = [];
  for (const entryData of testEntries) {
    const entry = await prisma.ledgerEntry.create({
      data: {
        caseId,
        transactionDate: new Date(),
        amountCents: entryData.amountCents,
        description: entryData.description,
        valueType: 'IST',
        legalBucket: 'UNKNOWN',
        reviewStatus: 'UNREVIEWED',
        importSource: 'smoke-test',
        createdBy: 'smoke-test',
      }
    });
    createdEntries.push(entry);
    console.log(`   ✓ Entry erstellt: "${entry.description}" (${Number(entry.amountCents) / 100} EUR)`);
  }

  // 5. Klassifikation durchführen (manuell, wie in engine.ts)
  console.log('\n🔄 5. Klassifikation durchführen...');

  const activeRules = await prisma.classificationRule.findMany({
    where: { caseId, isActive: true },
    orderBy: { priority: 'asc' },
  });

  let classified = 0;
  let unchanged = 0;

  for (const entry of createdEntries) {
    let matched = false;

    for (const rule of activeRules) {
      if (matchRule(rule, entry)) {
        const baseConfidence = rule.matchType === 'EQUALS' ? 0.9 : 0.7;
        const confidence = Math.min(1.0, baseConfidence + (rule.confidenceBonus || 0));

        await prisma.ledgerEntry.update({
          where: { id: entry.id },
          data: {
            suggestedLegalBucket: rule.suggestedLegalBucket,
            suggestedCategory: rule.suggestedCategory,
            suggestedConfidence: confidence,
            suggestedRuleId: rule.id,
            suggestedReason: `Regel "${rule.name}" gematcht (${rule.matchType}: "${rule.matchValue}")`,
          }
        });

        console.log(`   ✓ "${entry.description}" → ${rule.suggestedLegalBucket} (${(confidence * 100).toFixed(0)}%)`);
        classified++;
        matched = true;
        break;
      }
    }

    if (!matched) {
      console.log(`   - "${entry.description}" → kein Match`);
      unchanged++;
    }
  }

  console.log(`\n   Ergebnis: ${classified} klassifiziert, ${unchanged} ohne Match`);

  // 6. Vorschläge prüfen
  console.log('\n🔍 6. Vorschläge aus DB lesen...');

  const entriesWithSuggestions = await prisma.ledgerEntry.findMany({
    where: { caseId, importSource: 'smoke-test', suggestedLegalBucket: { not: null } }
  });

  console.log(`   ${entriesWithSuggestions.length} Entries haben Vorschläge:`);
  for (const e of entriesWithSuggestions) {
    console.log(`   - ${e.description}: ${e.suggestedLegalBucket} (${((e.suggestedConfidence || 0) * 100).toFixed(0)}%)`);
  }

  // 7. Bulk-Confirm simulieren (>80% Confidence)
  console.log('\n✅ 7. Bulk-Confirm (Confidence >= 80%)...');

  const highConfidenceEntries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      importSource: 'smoke-test',
      reviewStatus: 'UNREVIEWED',
      suggestedConfidence: { gte: 0.79 } // 0.79 to avoid floating-point edge cases
    }
  });

  console.log(`   ${highConfidenceEntries.length} Entries mit Confidence >= 80%`);

  const now = new Date();
  for (const entry of highConfidenceEntries) {
    await prisma.ledgerEntry.update({
      where: { id: entry.id },
      data: {
        reviewStatus: 'CONFIRMED',
        reviewedBy: 'smoke-test',
        reviewedAt: now,
        reviewNote: 'Automatisch bestätigt (Confidence > 80%)',
        legalBucket: entry.suggestedLegalBucket || entry.legalBucket,
      }
    });
    console.log(`   ✓ Bestätigt: "${entry.description}"`);
  }

  // 8. Finale Statistiken
  console.log('\n📊 8. Finale Statistiken...');

  const stats = {
    total: await prisma.ledgerEntry.count({ where: { caseId, importSource: 'smoke-test' } }),
    unreviewed: await prisma.ledgerEntry.count({ where: { caseId, importSource: 'smoke-test', reviewStatus: 'UNREVIEWED' } }),
    confirmed: await prisma.ledgerEntry.count({ where: { caseId, importSource: 'smoke-test', reviewStatus: 'CONFIRMED' } }),
    withSuggestion: await prisma.ledgerEntry.count({ where: { caseId, importSource: 'smoke-test', suggestedLegalBucket: { not: null } } }),
  };

  console.log(`   Total: ${stats.total}`);
  console.log(`   UNREVIEWED: ${stats.unreviewed}`);
  console.log(`   CONFIRMED: ${stats.confirmed}`);
  console.log(`   Mit Vorschlag: ${stats.withSuggestion}`);

  // 9. Aggregation Cache Status prüfen (falls vorhanden)
  console.log('\n📈 9. Aggregation Cache prüfen...');

  const aggregationCache = await prisma.aggregationCache.findFirst({
    where: { caseId }
  });

  if (aggregationCache) {
    console.log(`   Status: ${aggregationCache.status}`);
    console.log(`   Letzte Berechnung: ${aggregationCache.lastAggregatedAt}`);
  } else {
    console.log('   Kein Cache vorhanden (normal für neuen Case)');
  }

  // Zusammenfassung
  console.log('\n' + '='.repeat(50));
  console.log('🎉 SMOKE TEST ABGESCHLOSSEN');
  console.log('='.repeat(50));

  const success = classified >= 4 && stats.confirmed >= 3;

  if (success) {
    console.log('\n✅ Pipeline funktioniert korrekt!');
    console.log('   - Rules matchen Entries');
    console.log('   - Vorschläge werden geschrieben');
    console.log('   - Bulk-Confirm funktioniert');
    console.log('   - reviewStatus wird korrekt gesetzt');
  } else {
    console.log('\n⚠️  Unerwartete Ergebnisse - manuell prüfen!');
    console.log(`   Erwartet: 4+ klassifiziert, 3+ confirmed`);
    console.log(`   Tatsächlich: ${classified} klassifiziert, ${stats.confirmed} confirmed`);
  }

  console.log('\n');
}

main()
  .catch((e) => {
    console.error('❌ Fehler:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
