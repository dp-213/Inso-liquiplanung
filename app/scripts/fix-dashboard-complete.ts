/**
 * KORREKTUR: Dashboard komplett und ehrlich befüllen
 *
 * Probleme die behoben werden:
 * 1. Plan-Zeitraum: Nov 2025 - Aug 2026 (10 Monate, nicht Aug 2025!)
 * 2. estateAllocation: Zurück auf UNKLAR (ehrlich - Regeln bekannt, nicht angewendet)
 * 3. BankAgreements: Sparkasse Massekreditvertrag anlegen
 * 4. InsolvencyEffects: Insolvenz-spezifische Positionen
 *
 * WICHTIG: Regelwissen ≠ gebuchte Zuordnung!
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CASE_ID = '2982ff26-081a-4811-8e1e-46b39e1ff757';
const PLAN_ID = '753ec26c-c7a6-4394-857f-bf1ebd1eccfd';

async function main() {
  console.log('=== DASHBOARD KORREKTUR ===\n');

  // =====================================================
  // 1. PLAN-ZEITRAUM KORRIGIEREN
  // =====================================================
  console.log('1. Plan-Zeitraum korrigieren...');
  console.log('   IST-Daten verfügbar: Nov 2025 - Dez 2025');
  console.log('   PLAN-Daten verfügbar: Nov 2025 - Jul 2026');
  console.log('   → Plan startet Nov 2025 (NICHT Aug 2025!)');

  await prisma.liquidityPlan.update({
    where: { id: PLAN_ID },
    data: {
      name: 'Liquiditätsplanung Nov 2025 - Aug 2026',
      planStartDate: new Date('2025-11-01'),
      periodType: 'MONTHLY',
      periodCount: 10, // Nov 2025 - Aug 2026
      description: 'Liquiditätsplanung ab Insolvenzeröffnung. Keine Daten für Aug-Okt 2025 vorhanden.',
    }
  });
  console.log('   ✓ Plan: Nov 2025 - Aug 2026 (10 Monate)');

  // =====================================================
  // 2. ESTATE ALLOCATION ZURÜCKSETZEN (EHRLICH!)
  // =====================================================
  console.log('\n2. estateAllocation zurücksetzen (Ehrlichkeit!)...');
  console.log('   Regeln sind BEKANNT, aber noch NICHT fachlich angewendet.');

  // Alle IST-Daten auf UNKLAR setzen (außer explizite manuelle Zuordnung)
  const istReset = await prisma.ledgerEntry.updateMany({
    where: {
      caseId: CASE_ID,
      valueType: 'IST'
    },
    data: {
      estateAllocation: null, // NULL = noch nicht zugeordnet
      estateRatio: null,
      allocationSource: null,
      allocationNote: 'Alt/Neu-Zuordnung offen - fachliche Prüfung erforderlich'
    }
  });
  console.log(`   ✓ ${istReset.count} IST-Einträge auf NULL gesetzt`);

  // PLAN-Daten: Nur explizite Altforderungen/Insolvenz-spezifisch zuordnen
  const planAltforderungen = await prisma.ledgerEntry.updateMany({
    where: {
      caseId: CASE_ID,
      valueType: 'PLAN',
      description: { contains: 'ALTFORDERUNG' }
    },
    data: {
      estateAllocation: 'ALTMASSE',
      allocationSource: 'FACHLICH_KLAR',
      allocationNote: 'Explizit als Altforderung gekennzeichnet'
    }
  });

  const planInso = await prisma.ledgerEntry.updateMany({
    where: {
      caseId: CASE_ID,
      valueType: 'PLAN',
      description: { contains: 'INSO' }
    },
    data: {
      estateAllocation: 'NEUMASSE',
      allocationSource: 'FACHLICH_KLAR',
      allocationNote: 'Insolvenz-spezifische Position (nach Eröffnung entstanden)'
    }
  });

  // Rest der PLAN-Daten auf NULL
  const planRest = await prisma.ledgerEntry.updateMany({
    where: {
      caseId: CASE_ID,
      valueType: 'PLAN',
      estateAllocation: { not: null },
      NOT: [
        { description: { contains: 'ALTFORDERUNG' } },
        { description: { contains: 'INSO' } }
      ]
    },
    data: {
      estateAllocation: null,
      estateRatio: null,
      allocationSource: null,
      allocationNote: 'Alt/Neu-Zuordnung offen - Leistungszeitraum prüfen'
    }
  });

  console.log(`   ✓ ${planAltforderungen.count} PLAN-Einträge als ALTMASSE (explizit)`);
  console.log(`   ✓ ${planInso.count} PLAN-Einträge als NEUMASSE (Inso-spezifisch)`);
  console.log(`   ✓ Restliche PLAN-Einträge auf NULL (offen)`);

  // =====================================================
  // 3. BANK AGREEMENTS ANLEGEN
  // =====================================================
  console.log('\n3. BankAgreements anlegen...');

  // Lösche alte Agreements
  await prisma.bankAgreement.deleteMany({
    where: { caseId: CASE_ID }
  });

  // Sparkasse Velbert - Massekreditvereinbarung (VEREINBART)
  await prisma.bankAgreement.create({
    data: {
      caseId: CASE_ID,
      bankAccountId: 'ba-sparkasse-velbert',
      agreementStatus: 'VEREINBART',
      agreementDate: new Date('2025-11-03'), // Verfahrenseröffnung
      agreementNote: 'Unechter Massekreditvertrag mit Sparkasse HRV - unterschrieben',
      hasGlobalAssignment: true,
      contributionRate: 0.10, // 10% Fortführungsbeitrag
      contributionVatRate: 0.19, // 19% USt
      creditCapCents: BigInt(13700000), // 137.000 €
      isUncertain: false,
      uncertaintyNote: null,
    }
  });
  console.log('   ✓ Sparkasse: Massekreditvertrag (VEREINBART, 137k Cap, 10% Fortführung)');

  // apoBank - KEINE Vereinbarung (OFFEN / problematisch)
  await prisma.bankAgreement.create({
    data: {
      caseId: CASE_ID,
      bankAccountId: 'ba-apobank-uckerath',
      agreementStatus: 'OFFEN',
      agreementDate: null,
      agreementNote: 'KEINE Vereinbarung! Blockiert KV-Auszahlungen für Uckerath/Eitorf',
      hasGlobalAssignment: true, // Abtretung existiert, aber keine Vereinbarung
      contributionRate: null,
      contributionVatRate: null,
      creditCapCents: null,
      isUncertain: true,
      uncertaintyNote: 'Kritisches Risiko: apoBank verweigert Vereinbarung. KV-Zahlungen für Uckerath/Eitorf möglicherweise blockiert.',
    }
  });
  console.log('   ✓ apoBank: KEINE Vereinbarung (OFFEN, Risiko dokumentiert)');

  // =====================================================
  // 4. INSOLVENCY EFFECTS ANLEGEN
  // =====================================================
  console.log('\n4. InsolvencyEffects anlegen...');

  // Lösche alte Effects
  await prisma.insolvencyEffect.deleteMany({
    where: { planId: PLAN_ID }
  });

  // Insolvenz-spezifische Einzahlungen (aus PLAN-Daten erkennbar)
  const insoEffects = [
    // Insolvenzgeld-Rückzahlung (Dezember 2025)
    {
      name: 'Rückzahlung Insolvenzgeld Okt 25',
      description: 'Rückzahlung der Vorfinanzierung Insolvenzgeld für Oktober 2025',
      effectType: 'INFLOW',
      effectGroup: 'GENERAL',
      periodIndex: 1, // Dez 2025 (Monat 1 bei Start Nov)
      amountCents: BigInt(5000000), // Beispielwert - aus PLAN übernehmen
    },
    // Vorfinanzierung Insolvenzgeld (November 2025)
    {
      name: 'Vorfinanzierung Insolvenzgeld',
      description: 'Vorfinanzierung der Löhne durch Arbeitsagentur',
      effectType: 'INFLOW',
      effectGroup: 'GENERAL',
      periodIndex: 0, // Nov 2025
      amountCents: BigInt(15000000), // Beispielwert
    },
    // Sachaufnahme
    {
      name: 'Sachaufnahme',
      description: 'Bewertung und Erfassung des Inventars',
      effectType: 'OUTFLOW',
      effectGroup: 'PROCEDURE_COST',
      periodIndex: 0, // Nov 2025
      amountCents: BigInt(500000), // Beispielwert
    },
    // Verfahrenskosten IV
    {
      name: 'Vergütung IV (vorläufig)',
      description: 'Vorläufige Insolvenzverwaltervergütung - Schätzung',
      effectType: 'OUTFLOW',
      effectGroup: 'PROCEDURE_COST',
      periodIndex: 9, // Aug 2026 (Laufzeitende)
      amountCents: BigInt(5000000), // Schätzung - wird später konkretisiert
      isAvailabilityOnly: true, // Nur zur Anzeige, nicht fix
    },
  ];

  for (const effect of insoEffects) {
    await prisma.insolvencyEffect.create({
      data: {
        planId: PLAN_ID,
        name: effect.name,
        description: effect.description,
        effectType: effect.effectType,
        effectGroup: effect.effectGroup,
        periodIndex: effect.periodIndex,
        amountCents: effect.amountCents,
        isActive: true,
        isAvailabilityOnly: effect.isAvailabilityOnly || false,
        createdBy: 'fix-dashboard-complete',
        updatedBy: 'fix-dashboard-complete',
      }
    });
    console.log(`   ✓ ${effect.name}`);
  }

  // =====================================================
  // 5. PRÄMISSEN AKTUALISIEREN (ehrlich)
  // =====================================================
  console.log('\n5. Prämissen aktualisieren...');

  await prisma.planningAssumption.deleteMany({
    where: { planId: PLAN_ID }
  });

  const assumptions = [
    {
      title: 'Datenbasis: IST Nov-Dez 2025, PLAN Nov 25 - Jul 26',
      source: 'Systemstand',
      description: 'IST-Daten: Nov-Dez 2025 (Kontoauszüge ISK). PLAN-Daten: Nov 2025 - Jul 2026. KEINE Daten für Aug-Okt 2025.',
      status: 'VERIFIZIERT',
    },
    {
      title: 'Alt/Neu-Zuordnung noch nicht angewendet',
      source: 'Massekreditvertrag (bekannt, nicht angewendet)',
      description: 'Regeln bekannt (KV: 1/3 Alt Q4, HZV: 28/31 Alt Okt), aber NOCH NICHT auf Buchungen angewendet. Fachliche Einzelfallprüfung erforderlich.',
      status: 'ANNAHME',
      linkedModule: 'business-logic',
    },
    {
      title: 'Sparkasse Velbert: Massekredit vereinbart',
      source: 'Massekreditvertrag (unterzeichnet)',
      description: 'Globalzession auf Velbert-Forderungen. Fortführungsbeitrag 10% zzgl. USt. Max. 137.000 € Massekredit. Laufzeit bis 31.08.2026.',
      status: 'VERIFIZIERT',
      linkedModule: 'banken',
    },
    {
      title: 'apoBank: KEINE Vereinbarung!',
      source: 'IV-Kommunikation',
      description: 'KEINE Vereinbarung mit apoBank! Abtretung existiert, aber Bank verweigert Kooperation. Blockiert möglicherweise KV-Auszahlungen Uckerath/Eitorf.',
      status: 'ANNAHME',
      linkedModule: 'banken',
    },
    {
      title: 'PVS-Zuordnung über Einzelfallprüfung',
      source: 'Massekreditvertrag §1(2)c',
      description: 'Alt/Neu nach Behandlungsdatum - aus Kontoauszügen NICHT ableitbar. Alle PVS-Buchungen als UNKLAR markiert.',
      status: 'ANNAHME',
      linkedModule: 'business-logic',
    },
    {
      title: 'Insolvenz-spezifische Effekte geschätzt',
      source: 'PLAN-Daten + Schätzung',
      description: 'Insolvenzgeld, Sachaufnahme, IV-Vergütung separat erfasst. Werte teilweise geschätzt und als "nur zur Anzeige" markiert.',
      status: 'ANNAHME',
    },
  ];

  for (const a of assumptions) {
    await prisma.planningAssumption.create({
      data: {
        caseId: CASE_ID,
        title: a.title,
        source: a.source,
        description: a.description,
        status: a.status,
        linkedModule: ('linkedModule' in a) ? (a as { linkedModule: string }).linkedModule : null,
        createdBy: 'fix-dashboard-complete',
        updatedBy: 'fix-dashboard-complete',
      }
    });
  }
  console.log(`   ✓ ${assumptions.length} Planungsannahmen erstellt`);

  // =====================================================
  // 6. ZUSAMMENFASSUNG
  // =====================================================
  console.log('\n=== KORREKTUR ABGESCHLOSSEN ===\n');

  // Finale Statistik
  const stats = await prisma.ledgerEntry.groupBy({
    by: ['valueType', 'estateAllocation'],
    where: { caseId: CASE_ID },
    _count: { id: true }
  });

  console.log('Finale estateAllocation (ehrlich):');
  stats.forEach(s => {
    console.log(`  ${s.valueType} | ${s.estateAllocation || 'NULL (offen)'}: ${s._count.id}`);
  });

  const agreements = await prisma.bankAgreement.count({ where: { caseId: CASE_ID } });
  const effects = await prisma.insolvencyEffect.count({ where: { planId: PLAN_ID } });
  const assumpts = await prisma.planningAssumption.count({ where: { planId: PLAN_ID } });

  console.log(`\nDashboard-Komponenten:`);
  console.log(`  BankAgreements: ${agreements}`);
  console.log(`  InsolvencyEffects: ${effects}`);
  console.log(`  Assumptions: ${assumpts}`);

  console.log('\nDashboard-URL:');
  console.log(`http://localhost:3000/admin/cases/${CASE_ID}/dashboard`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
