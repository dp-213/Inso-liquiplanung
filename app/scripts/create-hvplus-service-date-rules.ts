/**
 * Script: HVPlus ServiceDate-Regeln erstellen
 *
 * Erstellt ClassificationRules für automatische ServiceDate-Zuweisung.
 * Die Split-Engine nutzt serviceDate für die Alt/Neu-Masse-Berechnung.
 *
 * Regel-Typen:
 * - SAME_MONTH: Zahlung = Leistungsmonat (Abschläge, Miete, laufende Kosten)
 * - VORMONAT: Zahlung bezieht sich auf Vormonat (HZV-Logik)
 * - PREVIOUS_QUARTER: Zahlung bezieht sich auf Vorquartal (KV-Schlusszahlungen)
 *
 * Ausführung: npx tsx scripts/create-hvplus-service-date-rules.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// =============================================================================
// CONFIGURATION
// =============================================================================

const CASE_NUMBER = '70d IN 362/25'; // Turso Production Case-Nummer
const DRY_RUN = false; // Set to true for preview only
const CREATED_BY = 'create-hvplus-service-date-rules';

// =============================================================================
// REGEL-DEFINITIONEN
// =============================================================================

interface RuleDefinition {
  name: string;
  description: string;
  matchField: 'description' | 'bookingReference' | 'bookingSource' | 'bookingSourceId';
  matchType: 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'REGEX' | 'EQUALS';
  matchValue: string;
  assignServiceDateRule: 'VORMONAT' | 'SAME_MONTH' | 'PREVIOUS_QUARTER';
  priority: number;
}

const RULES: RuleDefinition[] = [
  // =============================================================================
  // HZV MONATLICHE ABSCHLÄGE (SAME_MONTH)
  // =============================================================================
  {
    name: 'HZV TK/KKH/HEK/hkk - Monatsabschlag',
    description: 'HZV-Abschläge TK, KKH, HEK, hkk am 15. des Monats = Leistung gleicher Monat',
    matchField: 'description',
    matchType: 'REGEX',
    matchValue: '(TK|KKH|HEK|hkk).*(Abschlag|Zahlung|HZV)',
    assignServiceDateRule: 'SAME_MONTH',
    priority: 10,
  },
  {
    name: 'HZV AOK/DAK/Barmer/GWQ - Monatsabschlag',
    description: 'HZV-Abschläge AOK, DAK, Barmer, GWQ am 28. des Monats = Leistung gleicher Monat',
    matchField: 'description',
    matchType: 'REGEX',
    matchValue: '(AOK|DAK|Barmer|GWQ|BARMER).*(Abschlag|Zahlung|HZV)',
    assignServiceDateRule: 'SAME_MONTH',
    priority: 10,
  },
  {
    name: 'HZV IKK/LKK - Monatsabschlag',
    description: 'HZV-Abschläge IKK, LKK am 15. des Monats = Leistung gleicher Monat',
    matchField: 'description',
    matchType: 'REGEX',
    matchValue: '(IKK|LKK).*(Abschlag|Zahlung|HZV)',
    assignServiceDateRule: 'SAME_MONTH',
    priority: 10,
  },
  {
    name: 'HZV spectrumK/Knappschaft - Monatsabschlag',
    description: 'HZV-Abschläge spectrumK, Knappschaft am 15. des Monats',
    matchField: 'description',
    matchType: 'REGEX',
    matchValue: '(spectrumK|Knappschaft|KNAPPSCHAFT).*(Abschlag|Zahlung|HZV)',
    assignServiceDateRule: 'SAME_MONTH',
    priority: 10,
  },

  // =============================================================================
  // HZV/KV QUARTALS-SCHLUSSZAHLUNGEN (PREVIOUS_QUARTER)
  // =============================================================================
  {
    name: 'HZV/KV Quartals-Schlusszahlung',
    description: 'HZV/KV Schlusszahlung für Vorquartal',
    matchField: 'description',
    matchType: 'REGEX',
    matchValue: '(Schlusszahlung|Quartalsabrechnung|REST\\s*Q\\d|Q\\d.*REST)',
    assignServiceDateRule: 'PREVIOUS_QUARTER',
    priority: 5,
  },
  {
    name: 'KV Nordrhein Abrechnung',
    description: 'KVNO Quartalsabrechnungen = Vorquartal',
    matchField: 'description',
    matchType: 'REGEX',
    matchValue: '(KVNO|KV\\s*Nordrhein|Kassenärztliche).*(Q\\d|Quartal)',
    assignServiceDateRule: 'PREVIOUS_QUARTER',
    priority: 5,
  },

  // =============================================================================
  // HAVG/HAEVG ALLGEMEIN (VORMONAT als Fallback)
  // =============================================================================
  {
    name: 'HAVG/HAEVG - Vormonat-Logik',
    description: 'HAVG/HAEVG Zahlungen ohne explizites Quartal = Vormonat-Logik',
    matchField: 'description',
    matchType: 'REGEX',
    matchValue: '(HAVG|HAEVG|HAEVGID)',
    assignServiceDateRule: 'VORMONAT',
    priority: 50, // Niedrigere Priorität als spezifische Regeln
  },

  // =============================================================================
  // PATIENTENZAHLUNGEN (SAME_MONTH)
  // =============================================================================
  {
    name: 'Patientenzahlung - Anweisung',
    description: 'Überweisungen von Patienten/Direktzahler',
    matchField: 'description',
    matchType: 'REGEX',
    matchValue: '(ANWEISUNG VOM|Überweisung Patient|Zuzahlung)',
    assignServiceDateRule: 'SAME_MONTH',
    priority: 30,
  },
  {
    name: 'PVS Privatabrechnung',
    description: 'PVS Privatabrechnungen - Behandlung im gleichen Monat',
    matchField: 'description',
    matchType: 'REGEX',
    matchValue: '(PVS|Privatabrechnung|Privatpatient)',
    assignServiceDateRule: 'SAME_MONTH',
    priority: 30,
  },

  // =============================================================================
  // LAUFENDE KOSTEN (SAME_MONTH)
  // =============================================================================
  {
    name: 'Miete/Raumkosten',
    description: 'Miet- und Raumkosten = Leistung im Zahlungsmonat',
    matchField: 'description',
    matchType: 'REGEX',
    matchValue: '(Miete|Kaltmiete|Warmmiete|Raumkosten|Nebenkosten)',
    assignServiceDateRule: 'SAME_MONTH',
    priority: 40,
  },
  {
    name: 'Software/IT-Wartung',
    description: 'Software-Lizenzen und IT-Wartung = Monatsbezug',
    matchField: 'description',
    matchType: 'REGEX',
    matchValue: '(Software|Wartungsvertrag|PegaMed|EDV|IT-Service|Lizenz)',
    assignServiceDateRule: 'SAME_MONTH',
    priority: 40,
  },
  {
    name: 'Telefon/Kommunikation',
    description: 'Telefon- und Kommunikationskosten = Monatsbezug',
    matchField: 'description',
    matchType: 'REGEX',
    matchValue: '(Festnetz|Telefon|Aldi\\s*Talk|Mobilfunk|Internet|DSL)',
    assignServiceDateRule: 'SAME_MONTH',
    priority: 40,
  },
  {
    name: 'Versicherungen',
    description: 'Versicherungsbeiträge = Monatsbezug',
    matchField: 'description',
    matchType: 'REGEX',
    matchValue: '(Versicherung|Haftpflicht|Berufshaftpflicht|BG)',
    assignServiceDateRule: 'SAME_MONTH',
    priority: 40,
  },
  {
    name: 'Personalkosten/Löhne',
    description: 'Löhne und Gehälter = Leistung im Zahlungsmonat',
    matchField: 'description',
    matchType: 'REGEX',
    matchValue: '(Lohn|Gehalt|Personal|Mitarbeiter)',
    assignServiceDateRule: 'SAME_MONTH',
    priority: 40,
  },
  {
    name: 'Sozialversicherung',
    description: 'Sozialversicherungsbeiträge = Monatsbezug',
    matchField: 'description',
    matchType: 'REGEX',
    matchValue: '(SV-Beitrag|Sozialversicherung|Krankenkasse.*Arbeitgeber|KK-Beitrag)',
    assignServiceDateRule: 'SAME_MONTH',
    priority: 40,
  },
  {
    name: 'Steuerberater/Buchhaltung',
    description: 'Steuerberater und Buchhaltungskosten = Monatsbezug',
    matchField: 'description',
    matchType: 'REGEX',
    matchValue: '(Steuerberater|Buchhaltung|Lohnabrechnung|DATEV)',
    assignServiceDateRule: 'SAME_MONTH',
    priority: 40,
  },
  {
    name: 'Energie/Strom/Gas',
    description: 'Energiekosten = Monatsbezug',
    matchField: 'description',
    matchType: 'REGEX',
    matchValue: '(Strom|Gas|Energie|Stadtwerke|EnBW|RWE)',
    assignServiceDateRule: 'SAME_MONTH',
    priority: 40,
  },
  {
    name: 'Abfall/Entsorgung',
    description: 'Entsorgungskosten = Monatsbezug',
    matchField: 'description',
    matchType: 'REGEX',
    matchValue: '(Abfall|Entsorgung|Müll|AWB|Remondis)',
    assignServiceDateRule: 'SAME_MONTH',
    priority: 40,
  },
  {
    name: 'Praxisbedarf/Material',
    description: 'Praxisbedarf und Material = Monatsbezug',
    matchField: 'description',
    matchType: 'REGEX',
    matchValue: '(Praxisbedarf|Material|Medikamente|Labor)',
    assignServiceDateRule: 'SAME_MONTH',
    priority: 40,
  },
];

// =============================================================================
// MAIN FUNCTION
// =============================================================================

async function createServiceDateRules() {
  console.log('='.repeat(60));
  console.log('CREATE: HVPlus ServiceDate-Regeln');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log('='.repeat(60));

  // 1. Find Case
  console.log('\n1. Suche Case...');
  const hvplusCase = await prisma.case.findFirst({
    where: { caseNumber: CASE_NUMBER },
  });

  if (!hvplusCase) {
    console.error(`   FEHLER: Case ${CASE_NUMBER} nicht gefunden.`);
    process.exit(1);
  }
  console.log(`   Case: ${hvplusCase.debtorName} (${hvplusCase.id})`);

  // 2. Check existing rules
  console.log('\n2. Prüfe existierende Regeln...');
  const existingRules = await prisma.classificationRule.findMany({
    where: {
      caseId: hvplusCase.id,
      assignServiceDateRule: { not: null },
    },
  });

  if (existingRules.length > 0) {
    console.log(`   ⚠️  ${existingRules.length} ServiceDate-Regeln existieren bereits:`);
    for (const rule of existingRules) {
      console.log(`      - ${rule.name} (${rule.assignServiceDateRule})`);
    }
    console.log('\n   Fortfahren und fehlende Regeln hinzufügen...');
  }

  // Build map of existing rule names for deduplication
  const existingNames = new Set(existingRules.map(r => r.name));

  // 3. Create rules
  console.log('\n3. Erstelle Regeln...');

  const stats = {
    created: 0,
    skipped: 0,
    errors: 0,
  };

  for (const ruleDef of RULES) {
    if (existingNames.has(ruleDef.name)) {
      console.log(`   ⏭️  Übersprungen (existiert): ${ruleDef.name}`);
      stats.skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`   [PREVIEW] ${ruleDef.name}`);
      console.log(`             Match: ${ruleDef.matchField} ${ruleDef.matchType} "${ruleDef.matchValue}"`);
      console.log(`             Rule: ${ruleDef.assignServiceDateRule}`);
      stats.created++;
      continue;
    }

    try {
      await prisma.classificationRule.create({
        data: {
          caseId: hvplusCase.id,
          name: ruleDef.name,
          isActive: true,
          priority: ruleDef.priority,
          matchField: ruleDef.matchField,
          matchType: ruleDef.matchType,
          matchValue: ruleDef.matchValue,
          assignServiceDateRule: ruleDef.assignServiceDateRule,
          createdBy: CREATED_BY,
          updatedBy: CREATED_BY,
        },
      });
      console.log(`   ✅ Erstellt: ${ruleDef.name} (${ruleDef.assignServiceDateRule})`);
      stats.created++;
    } catch (error) {
      console.error(`   ❌ Fehler bei ${ruleDef.name}:`, error);
      stats.errors++;
    }
  }

  // 4. Summary
  console.log('\n' + '='.repeat(60));
  console.log('ZUSAMMENFASSUNG');
  console.log('='.repeat(60));
  console.log(`
Erstellt:           ${stats.created}
Übersprungen:       ${stats.skipped}
Fehler:             ${stats.errors}

Nächste Schritte:
1. Regeln in Admin UI prüfen: /admin/cases/${hvplusCase.id}/rules
2. Klassifikation neu laufen lassen (Reclassify-Button)
3. ServiceDate-Vorschläge im Ledger übernehmen
`);

  // 5. Show total rules count
  const totalRules = await prisma.classificationRule.count({
    where: { caseId: hvplusCase.id },
  });
  const serviceDateRules = await prisma.classificationRule.count({
    where: { caseId: hvplusCase.id, assignServiceDateRule: { not: null } },
  });

  console.log(`Gesamt-Regeln im Fall: ${totalRules}`);
  console.log(`Davon mit ServiceDate: ${serviceDateRules}`);
}

// =============================================================================
// EXECUTE
// =============================================================================

createServiceDateRules()
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
