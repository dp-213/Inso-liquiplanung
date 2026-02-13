/**
 * Classification v2: Fixes false positives + adds missing patterns
 *
 * Probleme aus v1:
 * 1. Privatpatient*innen Pattern zu breit (fängt Pensionskasse)
 * 2. Landeshauptkasse NRW Pattern enthält "Techniker" (fängt TK)
 * 3. Dreilindenapotheke hat HEK-Pattern statt Apotheke-Pattern
 * 4. DAK-Gesundheit Pattern zu breit (fängt GEDAKO)
 * 5. PVS rhein-ruhr "Privat" zu breit
 * 6. BKK firmus, Rundfunk, diverse Lieferanten fehlen
 *
 * Ausführung: cd app && npx tsx scripts/classify-pre-insolvency-v2.ts
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const CASE_NUMBER = '70d IN 362/25';

// =====================================================================
// PHASE A: FALSE POSITIVE PATTERN-FIXES
// =====================================================================
const PATTERN_FIXES: Array<{
  nameContains: string;
  newPattern: string;
  reason: string;
}> = [
  {
    nameContains: 'Privatpatient',
    // Alt: (Rechnungsnr|RG|Re Nr|Rechn nr) - VIEL zu breit
    // Neu: Spezifisch für PQ/PA Rechnungsnummern + Patienten-Keywords
    newPattern: '(PQ\\d{2}[/-]|PA\\d{2}[/-]|Patienten.?ID|Pat\\.?ID|Patient.?Nr|Patienten.?Nr|Patient.*ID.*\\d|Patiente-ID)',
    reason: 'Fix: Altes Pattern fing Nordrheinische Ärzteversorgung und andere Non-Patient-Entries'
  },
  {
    nameContains: 'Landeshauptkasse',
    // Alt: (Techniker|TK\s|Landeshauptkasse...) - fängt TK-Beiträge
    // Neu: Nur Landeshauptkasse
    newPattern: '(Landeshauptkasse)',
    reason: 'Fix: Altes Pattern enthielt Techniker|TK und fing falsch 89 TK-Entries'
  },
  {
    nameContains: 'Dreilindenapotheke',
    // Alt: (HEK.*Hanseatische|Hanseatische.*Krankenkasse) - KOMPLETT FALSCH
    // Neu: Apotheke-Pattern
    newPattern: '(Dreilindenapotheke|Dreilinden.Apotheke)',
    reason: 'Fix: Hatte versehentlich HEK-Krankenkasse-Pattern bekommen'
  },
  {
    nameContains: 'DAK-Gesundheit',
    // Alt: (DAK) - fängt GEDAKO
    // Neu: Spezifischer
    newPattern: '(DAK-Gesundheit|DAK Gesundheit|\\bDAK\\b)',
    reason: 'Fix: Altes Pattern (DAK) fing GEDAKO GmbH als False Positive'
  },
  {
    nameContains: 'PVS rhein-ruhr',
    // Alt: (PVS|Privat|rhein.?ruhr) - "Privat" zu breit
    // Neu: Spezifischer
    newPattern: '(PVS.*rhein|PVS.*ruhr|PVS GmbH|Privatabrechnung)',
    reason: 'Fix: "Privat" im Pattern fing alles mit Privat, inkl. Privatpatienten'
  },
];

// =====================================================================
// PHASE B: NEUE COUNTERPARTIES
// =====================================================================
const NEW_COUNTERPARTIES: Array<{
  name: string;
  matchPattern: string;
  type: string;
}> = [
  // Krankenkasse die nicht erstellt wurde (BKK firmus)
  { name: 'BKK firmus', matchPattern: '(BKK firmus|BKK.*firmus)', type: 'AUTHORITY' },
  // HEK Hanseatische Krankenkasse (eigene Counterparty, da Dreilindenapotheke das Pattern hatte)
  { name: 'HEK Hanseatische Krankenkasse', matchPattern: '(HEK.*Hanseatische|Hanseatische.*Krankenkasse|HEK.*Krankenkasse)', type: 'AUTHORITY' },
  // Rundfunk (existierte nicht als Counterparty)
  { name: 'Rundfunk ARD/ZDF/DRadio', matchPattern: '(Rundfunk|ARD.*ZDF|Deutschlandradio|rundfunkbeitrag|Beitragsnr.*\\d{9})', type: 'AUTHORITY' },
  // Ditscheid (Mitarbeiter)
  { name: 'Ditscheid Dieter (Mitarbeiter)', matchPattern: '(Ditscheid)', type: 'OTHER' },
  // HDI Global SE (Versicherung)
  { name: 'HDI Global SE', matchPattern: '(HDI Global|HDI.*Haftpflicht)', type: 'SUPPLIER' },
  // KRAVAG Versicherung
  { name: 'KRAVAG Versicherung', matchPattern: '(KRAVAG)', type: 'SUPPLIER' },
  // Schwäbisch Hall Bausparkasse
  { name: 'Schwäbisch Hall Bausparkasse', matchPattern: '(Schwaebisch Hall|Schwäbisch Hall)', type: 'SUPPLIER' },
  // AG Bonn Zahlstelle (Gerichtskosten)
  { name: 'AG Bonn Zahlstelle', matchPattern: '(AG Bonn Zahlstelle|AG Bonn.*Zahlstelle)', type: 'AUTHORITY' },
  // Ärztekammer Nordrhein
  { name: 'Ärztekammer Nordrhein', matchPattern: '(Ärztekammer|Aerztekammer)', type: 'AUTHORITY' },
  // Dialog Versicherung
  { name: 'Dialog Versicherung', matchPattern: '(Dialog.*Versicherung|GEWERBEVERS)', type: 'SUPPLIER' },
  // Grenke AG (Leasing)
  { name: 'Grenke AG', matchPattern: '(Grenke)', type: 'SUPPLIER' },
  // Löwenapotheke Eitorf
  { name: 'Löwenapotheke Eitorf', matchPattern: '(Löwenapotheke|Loewenapotheke)', type: 'SUPPLIER' },
  // celano GmbH
  { name: 'celano GmbH', matchPattern: '(celano)', type: 'SUPPLIER' },
  // Behördenverlag Jüngling
  { name: 'Behördenverlag Jüngling', matchPattern: '(Behördenverlag|Jüngling)', type: 'SUPPLIER' },
  // Fairtoner
  { name: 'Fairtoner', matchPattern: '(Fairtoner)', type: 'SUPPLIER' },
  // SHP Fortbildung
  { name: 'SHP (Fortbildung)', matchPattern: '(SHP\\d{2}|SHP)', type: 'SUPPLIER' },
  // BFS health finance
  { name: 'BFS health finance GmbH', matchPattern: '(BFS health|BFS.Nr|BFS.*finance)', type: 'SUPPLIER' },
  // 7days (Kittel/Berufskleidung)
  { name: '7days (Berufskleidung)', matchPattern: '(7days|7 days)', type: 'SUPPLIER' },
  // medisign
  { name: 'medisign', matchPattern: '(medisign)', type: 'SUPPLIER' },
  // Agentur Geiger
  { name: 'Agentur Geiger', matchPattern: '(Agentur Geiger)', type: 'SUPPLIER' },
  // Dr. med. W. Kuester (Vertreter)
  { name: 'Dr. med. W. Küster (Vertreter)', matchPattern: '(Kuester|Küster)', type: 'OTHER' },
  // Jakob Gerstner (Vertreter)
  { name: 'Jakob Gerstner (Vertreter)', matchPattern: '(Jakob Gerstner|Gerstner)', type: 'OTHER' },
  // Catterfeld Dr. med. Helena
  { name: 'Dr. med. Helena Catterfeld', matchPattern: '(Catterfeld)', type: 'OTHER' },
  // Franz A. Gänßler (= Gaenssler, aber andere Schreibweise)
  { name: 'Nordrheinische Ärzteversorgung', matchPattern: '(Nordrheinische.*Aerzteversorg|Nordrheinische.*Ärzteversorg|Aerzteversorg)', type: 'AUTHORITY' },
  // Shop Apotheke
  { name: 'Shop Apotheke (Marketplace)', matchPattern: '(Shop Apotheke)', type: 'SUPPLIER' },
  // OTTO Payments
  { name: 'OTTO Payments GmbH', matchPattern: '(OTTO Payments|OTTO.*Payments)', type: 'SUPPLIER' },
  // AP Kälte & Klima
  { name: 'AP Kälte & Klima', matchPattern: '(AP Kälte|AP K.lte)', type: 'SUPPLIER' },
  // Frank med (Apotheke/Medizin)
  { name: 'Frank med', matchPattern: '(Frank med)', type: 'SUPPLIER' },
  // SPS Germany
  { name: 'SPS Germany GmbH', matchPattern: '(SPS Germany)', type: 'SUPPLIER' },
  // ACTINEO GmbH
  { name: 'ACTINEO GmbH', matchPattern: '(ACTINEO)', type: 'SUPPLIER' },
  // Zurich Insurance
  { name: 'Zurich Insurance', matchPattern: '(Zurich Insurance|Zurich.*Versicherung)', type: 'SUPPLIER' },
  // Proxalto Lebensversicherung
  { name: 'Proxalto Lebensversicherung', matchPattern: '(Proxalto)', type: 'SUPPLIER' },
  // Erb und Wenzl
  { name: 'Erb und Wenzl GmbH', matchPattern: '(Erb und Wenzl|Erb.*Wenzl)', type: 'SUPPLIER' },
  // HIZ (Sonografie-Miete)
  { name: 'HIZ (Sonografie-Miete)', matchPattern: '(HIZ.*Miete|Mietvertrag.*Sonog)', type: 'SUPPLIER' },
  // T. Balde (Vertreter)
  { name: 'T. Balde (Vertreter)', matchPattern: '(T\\. Balde|Balde)', type: 'OTHER' },
  // Schweitzer Dr. med. (Uckerath)
  { name: 'Dr. Schweitzer (Uckerath)', matchPattern: '(Schweitzer)', type: 'OTHER' },
  // Fischer Anja (Uckerath)
  { name: 'Fischer Anja (Mitarbeiter)', matchPattern: '(Fischer Anja)', type: 'OTHER' },
  // Gabriele Erker (Mitarbeiterin)
  { name: 'Gabriele Erker (Mitarbeiter)', matchPattern: '(Gabriele Erker|Erker)', type: 'OTHER' },
];

// =====================================================================
// PHASE C: PATTERN-ERWEITERUNGEN für bestehende Counterparties
// =====================================================================
const PATTERN_EXTENSIONS: Array<{
  nameContains: string;
  newPattern: string;
  reason: string;
}> = [
  {
    // Rösing Eitorf: "Roesing" (ohne ö) fehlt im Pattern
    nameContains: 'Dr. Klaus Wilhelm Rösing',
    newPattern: '(Rösing|Roesing|Klaus.*Rösing|Klaus.*Roesing)',
    reason: 'apoBank schreibt "Roesing" statt "Rösing"'
  },
  {
    // HV PLUS interne Umbuchungen: "Auslage" fehlt
    nameContains: 'HV PLUS eG (interne',
    newPattern: '(Übertrag|Umbuchung|Auslage.*HV PLUS|Auslage.*MVZ Uckerath|Auslage.*MVZ Velbert)',
    reason: 'Interne Überweisungen mit "Auslage für" wurden nicht erkannt'
  },
  {
    // Gaenssler/Gänßler: unterschiedliche Schreibweisen
    nameContains: 'Gaenssler',
    newPattern: '(Gaenssler|Gänßler|Gaenßler|Franz.*Gaenssler|Franz.*Gänßler)',
    reason: 'Franz A. Gänßler vs. Gaenssler Franz Adalbert'
  },
  {
    // Techniker Krankenkasse: Pattern braucht Update
    nameContains: 'Techniker Krankenkasse',
    newPattern: '(Techniker Krankenkasse|Techniker.*Krankenkasse|TK.Beleg)',
    reason: 'Altes Pattern war identisch mit Landeshauptkasse NRW, jetzt spezifischer'
  },
  {
    // Sammelüberweisung: "ANZAHL" und "EBICS/DFÜ" Pattern hinzufügen
    nameContains: 'Sammelüberweisung',
    newPattern: '(SAMMELÜBERWEISUNG|Belastung Sammelzahlung|ANZAHL \\d+|EBICS.*DFÜ.*Umsätze)',
    reason: 'Sammelüberweisungen und EBICS-Zahlläufe erkennen'
  },
  {
    // Bestattungshaus: auch "Todesbescheinigung" erkennen
    nameContains: 'Bestattungshaus Schottes',
    newPattern: '(Bestattung|Todesbescheinigung|Trauerfall)',
    reason: 'Auch Todesbescheinigungen gehören zu Bestattungs-Payments'
  },
  {
    // Steuerverwaltung NRW: auch Stnr-Pattern
    nameContains: 'Steuerverwaltung NRW',
    newPattern: '(Finanzamt|Steuerverwaltung|Stnr \\d{3}/\\d{4})',
    reason: 'Steuernummer-Pattern für Sparkasse-Entries'
  },
  {
    // KEM Essen-Mitte
    nameContains: 'KV Nordrhein',
    // Keep current pattern, it's working
    newPattern: '(KV Nordrhein|KV-Nordrhein|KVNO|Kassenärzt|Kassenarzt|Kassenärztliche|Kassenarztliche)',
    reason: 'KV allein zu breit entfernt, spezifischer auf KV Nordrhein'
  },
];

// =====================================================================
// MAIN
// =====================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Pre-Insolvency Classification v2: False-Positive-Fixes + Neue Patterns');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const hvCase = await prisma.case.findFirst({ where: { caseNumber: CASE_NUMBER } });
  if (hvCase === null) throw new Error('Case nicht gefunden');
  const caseId = hvCase.id;

  // ─────────────────────────────────────────────
  // PHASE A: False Positive Pattern-Fixes
  // ─────────────────────────────────────────────
  console.log('=== PHASE A: False Positive Pattern-Fixes ===\n');

  for (const fix of PATTERN_FIXES) {
    const cp = await prisma.counterparty.findFirst({
      where: { caseId, name: { contains: fix.nameContains } }
    });

    if (cp) {
      const oldPattern = cp.matchPattern || '(keines)';
      await prisma.counterparty.update({
        where: { id: cp.id },
        data: { matchPattern: fix.newPattern }
      });
      console.log('  FIX ' + cp.name);
      console.log('      Alt: ' + oldPattern);
      console.log('      Neu: ' + fix.newPattern);
      console.log('      Grund: ' + fix.reason);
      console.log('');
    } else {
      console.log('  NICHT GEFUNDEN: ' + fix.nameContains);
    }
  }

  // ─────────────────────────────────────────────
  // PHASE B: Neue Counterparties anlegen
  // ─────────────────────────────────────────────
  console.log('\n=== PHASE B: Neue Counterparties anlegen ===\n');

  let created = 0;
  for (const cp of NEW_COUNTERPARTIES) {
    // Exakte Namenssuche (erster Teil)
    const searchTerm = cp.name.split(' ')[0];
    const existing = await prisma.counterparty.findFirst({
      where: { caseId, name: { contains: searchTerm } }
    });

    if (existing) {
      console.log('  SKIP: ' + cp.name + ' (existiert als: ' + existing.name + ')');
    } else {
      await prisma.counterparty.create({
        data: {
          caseId,
          name: cp.name,
          matchPattern: cp.matchPattern,
          type: cp.type,
          createdBy: 'classify-pre-insolvency-v2',
        }
      });
      console.log('  NEU: ' + cp.name + ' -> ' + cp.matchPattern);
      created++;
    }
  }
  console.log('\n  ' + created + ' neue Counterparties angelegt');

  // ─────────────────────────────────────────────
  // PHASE C: Pattern-Erweiterungen
  // ─────────────────────────────────────────────
  console.log('\n=== PHASE C: Pattern-Erweiterungen ===\n');

  let extended = 0;
  for (const ext of PATTERN_EXTENSIONS) {
    const cp = await prisma.counterparty.findFirst({
      where: { caseId, name: { contains: ext.nameContains } }
    });

    if (cp) {
      const oldPattern = cp.matchPattern || '(keines)';
      await prisma.counterparty.update({
        where: { id: cp.id },
        data: { matchPattern: ext.newPattern }
      });
      console.log('  EXT ' + cp.name);
      console.log('      Alt: ' + oldPattern);
      console.log('      Neu: ' + ext.newPattern);
      console.log('      Grund: ' + ext.reason);
      console.log('');
      extended++;
    } else {
      console.log('  NICHT GEFUNDEN: ' + ext.nameContains);
    }
  }
  console.log('  ' + extended + ' Patterns erweitert');

  // ─────────────────────────────────────────────
  // PHASE D: Re-Run Counterparty Matching
  // ─────────────────────────────────────────────
  console.log('\n=== PHASE D: Re-Run Counterparty Matching ===\n');

  // Alle Pre-Insolvency Vorschläge zurücksetzen
  await prisma.ledgerEntry.updateMany({
    where: { caseId, allocationSource: 'PRE_INSOLVENCY' },
    data: { suggestedCounterpartyId: null, suggestedReason: null }
  });
  console.log('  Alle Pre-Insolvency-Vorschläge zurückgesetzt');

  // Alle Counterparties mit Patterns laden
  const counterparties = await prisma.counterparty.findMany({
    where: { caseId, matchPattern: { not: null } },
    orderBy: { displayOrder: 'asc' }
  });
  console.log('  ' + counterparties.length + ' Counterparty-Patterns geladen');

  // Alle Pre-Insolvency Entries laden
  const entries = await prisma.ledgerEntry.findMany({
    where: { caseId, allocationSource: 'PRE_INSOLVENCY' }
  });
  console.log('  ' + entries.length + ' Pre-Insolvency-Entries zu klassifizieren\n');

  let matched = 0;
  let unmatched = 0;
  const matchStats: Record<string, { count: number; samples: Array<{ desc: string; note: string | null; amount: number }> }> = {};
  const unmatchedEntries: Array<{ desc: string; note: string | null; amount: number }> = [];

  for (const entry of entries) {
    let found = false;
    const descAndNote = entry.description + (entry.note ? ' ' + entry.note : '');

    for (const cp of counterparties) {
      try {
        const regex = new RegExp(cp.matchPattern as string, 'i');
        if (regex.test(descAndNote)) {
          await prisma.ledgerEntry.update({
            where: { id: entry.id },
            data: {
              suggestedCounterpartyId: cp.id,
              suggestedReason: 'Pattern: ' + cp.name
            }
          });

          if (matchStats[cp.name] === undefined) matchStats[cp.name] = { count: 0, samples: [] };
          matchStats[cp.name].count++;
          if (matchStats[cp.name].samples.length < 2) {
            matchStats[cp.name].samples.push({
              desc: entry.description.slice(0, 90),
              note: entry.note,
              amount: Number(entry.amountCents) / 100
            });
          }
          matched++;
          found = true;
          break;
        }
      } catch {
        // Regex-Fehler ignorieren
      }
    }

    if (found === false) {
      unmatched++;
      if (unmatchedEntries.length < 80) {
        unmatchedEntries.push({
          desc: entry.description.slice(0, 90),
          note: entry.note,
          amount: Number(entry.amountCents) / 100
        });
      }
    }
  }

  // ─────────────────────────────────────────────
  // ERGEBNIS
  // ─────────────────────────────────────────────
  const pct = Math.round(matched / entries.length * 100);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('ERGEBNIS: ' + matched + '/' + entries.length + ' (' + pct + '%) klassifiziert');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Top Matches mit Samples
  const sorted = Object.entries(matchStats).sort((a, b) => b[1].count - a[1].count);

  console.log('=== TOP MATCHES ===\n');
  for (const [name, data] of sorted.slice(0, 20)) {
    console.log(data.count.toString().padStart(4) + 'x | ' + name);
    for (const s of data.samples) {
      const amount = s.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 });
      console.log('      ' + amount.padStart(12) + ' EUR | ' + s.desc.slice(0, 70));
      if (s.note) console.log('      ' + ' '.repeat(12) + '     Note: ' + s.note.slice(0, 50));
    }
  }

  // Alle Matches (kompakt)
  console.log('\n=== ALLE MATCHES (kompakt) ===\n');
  for (const [name, data] of sorted) {
    console.log(data.count.toString().padStart(4) + 'x | ' + name);
  }

  // Unmatched gruppiert nach Note
  console.log('\n=== UNMATCHED (' + unmatched + ' Entries) ===\n');
  const unmatchedByNote: Record<string, { count: number; samples: string[] }> = {};
  for (const e of unmatchedEntries) {
    const key = e.note || '(kein Note)';
    if (unmatchedByNote[key] === undefined) unmatchedByNote[key] = { count: 0, samples: [] };
    unmatchedByNote[key].count++;
    if (unmatchedByNote[key].samples.length < 1) {
      const amount = e.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 });
      unmatchedByNote[key].samples.push(amount.padStart(12) + ' EUR | ' + e.desc.slice(0, 70));
    }
  }
  const unmatchedSorted = Object.entries(unmatchedByNote).sort((a, b) => b[1].count - a[1].count);
  for (const [note, data] of unmatchedSorted) {
    console.log(data.count.toString().padStart(4) + 'x | ' + note);
    for (const s of data.samples) {
      console.log('      ' + s);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error('Fehler:', e); process.exit(1); });
