/**
 * Klassifikation der Pre-Insolvency-Entries:
 * 1. Prüfe fehlende Counterparties
 * 2. Ergänze Patterns
 * 3. Re-Run Matching
 * 4. Zeige Ergebnis mit Samples für manuelle Verifikation
 *
 * Ausführung: cd app && npx tsx scripts/classify-pre-insolvency.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CASE_NUMBER = '70d IN 362/25';

// =====================================================================
// NEUE COUNTERPARTIES (existieren noch nicht im System)
// =====================================================================
const NEW_COUNTERPARTIES = [
  { name: 'Circle K Deutschland', matchPattern: '(Circle K|Circle.*K.*Deutschland)', type: 'SUPPLIER' },
  { name: 'medatixx GmbH & Co. KG', matchPattern: '(medatixx)', type: 'SUPPLIER' },
  { name: 'B&S IT-Solutions GmbH', matchPattern: '(B&S IT|B&S.*IT)', type: 'SUPPLIER' },
  { name: 'Kostrowa Gebäudereinigung', matchPattern: '(Kostrowa)', type: 'SUPPLIER' },
  { name: 'BUHL-DATA-SERVICE GmbH', matchPattern: '(BUHL.?DATA|BUHL DATA)', type: 'SUPPLIER' },
  { name: 'Böttcher AG', matchPattern: '(B(ö|oe|o)ttcher)', type: 'SUPPLIER' },
  { name: 'Getränkeautomatenservice Odendahl', matchPattern: '(Getränkeautomat|Odendahl)', type: 'SUPPLIER' },
  { name: 'Robin Husch (Reinigung)', matchPattern: '(Robin Husch)', type: 'SUPPLIER' },
  { name: 'HEK Hanseatische Krankenkasse', matchPattern: '(HEK.*Hanseatische|Hanseatische.*Krankenkasse)', type: 'AUTHORITY' },
  { name: 'BKK firmus', matchPattern: '(BKK firmus|BKK.*firmus)', type: 'AUTHORITY' },
  { name: 'Ludger Hegemann (Haustechnik)', matchPattern: '(Ludger Hegemann|Hegemann)', type: 'SUPPLIER' },
  { name: 'BGW (Berufsgenossenschaft)', matchPattern: '(BGW|Berufsgenossenschaft)', type: 'AUTHORITY' },
  { name: 'Swiss Life LV', matchPattern: '(Swiss Life)', type: 'SUPPLIER' },
  { name: 'Provinzial Versicherung', matchPattern: '(Provinzial)', type: 'SUPPLIER' },
  { name: 'Raiffeisen Eitorf', matchPattern: '(Raiffeisen)', type: 'SUPPLIER' },
  { name: 'IEM GmbH', matchPattern: '(IEM GmbH|IEM.*GmbH)', type: 'SUPPLIER' },
  { name: 'Delta Kopiersysteme GmbH', matchPattern: '(Delta Kopier|Delta.*Kopier)', type: 'SUPPLIER' },
  { name: 'Pump Gianna (Eitorf)', matchPattern: '(Pump Gianna|Pump.*Gianna)', type: 'SUPPLIER' },
  { name: 'Andreas Schiffer Dienstleistungen', matchPattern: '(Andreas Schiffer|Schiffer Dienstleistung)', type: 'SUPPLIER' },
  { name: 'Fenner Computer', matchPattern: '(Fenner Computer|Fenner.*Computer)', type: 'SUPPLIER' },
  { name: 'GP Dres. Merx und Reese', matchPattern: '(Merx.*Reese|Dres.*Merx)', type: 'SUPPLIER' },
  { name: 'Pro bAV Pensionskasse AG', matchPattern: '(Pro bAV|Pro.*bAV|Pensionskasse)', type: 'SUPPLIER' },
  { name: 'MSGmbH', matchPattern: '(MSGmbH|MS GmbH)', type: 'SUPPLIER' },
  { name: 'Karina Beyer (Mitarbeiterin)', matchPattern: '(Karina Beyer)', type: 'OTHER' },
  { name: 'Patrick Fitzon', matchPattern: '(Patrick Fitzon|Fitzon)', type: 'SUPPLIER' },
  { name: 'HyGES', matchPattern: '(HyGES|Wasseruntersuchung)', type: 'SUPPLIER' },
  { name: 'Heinz-Werner Peters (Vertreter)', matchPattern: '(Heinz.Werner Peters)', type: 'OTHER' },
  { name: 'Dr. Thomas Beyer', matchPattern: '(Dr.*Thomas Beyer|Thomas Beyer)', type: 'OTHER' },
  { name: 'Dr. Manfred Imbert', matchPattern: '(Dr.*Imbert|Manfred Imbert|Imbert)', type: 'OTHER' },
  { name: 'Anke Reinshagen (Mitarbeiterin)', matchPattern: '(Anke Reinshagen|Reinshagen)', type: 'OTHER' },
];

// =====================================================================
// PATTERN-UPDATES für bestehende Counterparties
// =====================================================================
const PATTERN_UPDATES: Record<string, string> = {
  // IKK: aktuelles Pattern zu restriktiv
  'IKK classic': '(IKK.*classic|IKK classic)',
  // PRONOVA: aktuelles Pattern zu restriktiv
  'PRONOVA BKK': '(PRONOVA|PRONOVA BKK)',
  // SEJ: fehlt komplett
  'SEJ GmbH': '(SEJ GmbH|SEJ.*SB.*Gesellschaft)',
  // GEHAMED: fehlt
  'GEHAMED GmbH': '(GEHAMED)',
  // Stempel4you: fehlt
  'Stempel4you': '(Stempel4you|Stempel.?4.?you)',
  // Sparkasse HRV: Darlehen/Rate fehlt
  'Sparkasse HRV': '(Sparkasse.*HRV|Sparkasse.*Hilden|Sparkasse.*Ratingen|Sparkasse.*Velbert|Darl.*Leistung.*6036)',
  // Rundfunk: fehlt
  'Rundfunk ARD, ZDF, DRadio': '(Rundfunk|ARD.*ZDF|rundfunkbeitrag)',
  // KV Nordrhein: Umlaut-Problem - "Kassenarztliche" ohne ä
  'KV Nordrhein': '(KV|Kassenärzt|Kassenarzt|KVNO|Kassenärztliche|Kassenarztliche)',
  // Kreis Mettmann: Pattern muss auch Note matchen (Name-Feld)
  'Kreis Mettmann Gesundheitsamt': '(Kreis Mettmann|ANWEISUNG VOM.*OHNE RE\\.NR\\. 42)',
};

// =====================================================================
// MAIN
// =====================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Pre-Insolvency Classification: Pattern-Verbesserung');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const hvCase = await prisma.case.findFirst({ where: { caseNumber: CASE_NUMBER } });
  if (!hvCase) throw new Error('Case nicht gefunden');
  const caseId = hvCase.id;

  // ─────────────────────────────────────────────
  // PHASE 1: Neue Counterparties anlegen
  // ─────────────────────────────────────────────
  console.log('=== PHASE 1: Neue Counterparties anlegen ===\n');

  let created = 0;
  for (const cp of NEW_COUNTERPARTIES) {
    // Prüfe ob schon existiert (Name-basiert)
    const existing = await prisma.counterparty.findFirst({
      where: { caseId, name: { contains: cp.name.split(' ')[0] } }
    });

    if (existing) {
      // Nur Pattern updaten wenn leer
      if (!existing.matchPattern && cp.matchPattern) {
        await prisma.counterparty.update({
          where: { id: existing.id },
          data: { matchPattern: cp.matchPattern }
        });
        console.log('  ✏️  Pattern ergänzt: ' + existing.name + ' → ' + cp.matchPattern);
      } else {
        console.log('  ⏭️  Existiert: ' + existing.name);
      }
    } else {
      await prisma.counterparty.create({
        data: {
          caseId,
          name: cp.name,
          matchPattern: cp.matchPattern,
          type: cp.type,
          createdBy: 'classify-pre-insolvency',
        }
      });
      console.log('  ✅ Neu: ' + cp.name + ' → ' + cp.matchPattern);
      created++;
    }
  }
  console.log('\n' + created + ' neue Counterparties angelegt\n');

  // ─────────────────────────────────────────────
  // PHASE 2: Bestehende Patterns aktualisieren
  // ─────────────────────────────────────────────
  console.log('=== PHASE 2: Bestehende Patterns aktualisieren ===\n');

  let updated = 0;
  for (const [nameSearch, newPattern] of Object.entries(PATTERN_UPDATES)) {
    const cp = await prisma.counterparty.findFirst({
      where: { caseId, name: { contains: nameSearch.split(' ')[0] } }
    });

    if (cp) {
      const oldPattern = cp.matchPattern || '(keines)';
      await prisma.counterparty.update({
        where: { id: cp.id },
        data: { matchPattern: newPattern }
      });
      console.log('  ✏️  ' + cp.name);
      console.log('      Alt: ' + oldPattern);
      console.log('      Neu: ' + newPattern);
      updated++;
    } else {
      console.log('  ⚠️  Nicht gefunden: ' + nameSearch);
    }
  }
  console.log('\n' + updated + ' Patterns aktualisiert\n');

  // ─────────────────────────────────────────────
  // PHASE 3: Vorschläge löschen und neu matchen
  // ─────────────────────────────────────────────
  console.log('=== PHASE 3: Re-Run Counterparty Matching ===\n');

  // Alle Pre-Insolvency Vorschläge zurücksetzen
  await prisma.ledgerEntry.updateMany({
    where: { caseId, allocationSource: 'PRE_INSOLVENCY' },
    data: { suggestedCounterpartyId: null, suggestedReason: null }
  });
  console.log('  Alle Pre-Insolvency-Vorschläge zurückgesetzt\n');

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

          if (!matchStats[cp.name]) matchStats[cp.name] = { count: 0, samples: [] };
          matchStats[cp.name].count++;
          if (matchStats[cp.name].samples.length < 3) {
            matchStats[cp.name].samples.push({
              desc: entry.description.slice(0, 80),
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

    if (!found) {
      unmatched++;
      if (unmatchedEntries.length < 50) {
        unmatchedEntries.push({
          desc: entry.description.slice(0, 80),
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

  // Top Matches mit Samples für manuelle Prüfung
  const sorted = Object.entries(matchStats).sort((a, b) => b[1].count - a[1].count);

  console.log('=== MATCHES MIT SAMPLES (für manuelle Verifikation) ===\n');
  for (const [name, data] of sorted) {
    console.log('📌 ' + name + ' (' + data.count + ' Entries)');
    for (const s of data.samples) {
      const amount = s.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 });
      console.log('   ' + amount.padStart(12) + ' EUR | ' + s.desc);
      if (s.note) console.log('   ' + ' '.repeat(12) + '     Note: ' + s.note.slice(0, 60));
    }
    console.log('');
  }

  // Unmatched
  console.log('=== UNMATCHED (' + unmatched + ' Entries) ===\n');
  for (const e of unmatchedEntries.slice(0, 30)) {
    const amount = e.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 });
    console.log('  ' + amount.padStart(12) + ' EUR | ' + e.desc);
    if (e.note) console.log('  ' + ' '.repeat(12) + '     Note: ' + (e.note || '').slice(0, 60));
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error('Fehler:', e); process.exit(1); });
