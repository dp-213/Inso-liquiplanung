/**
 * Classification v5 (FINAL): Letzte Lücken schließen
 * - HEK Krankenkasse: Counterparty anlegen
 * - Privatpatient Pattern: "PQ 25", "PQ25 ", "PUE", "PAZ", "rg \d+" etc.
 * - Bankgebühren: Zinszahlung, Bereitstellungsprovision, KFW
 * - PKV Institut, Agentur Geiger, etc.
 *
 * Ausführung: cd app && npx tsx scripts/classify-pre-insolvency-v5-final.ts
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const CASE_NUMBER = '70d IN 362/25';

async function ensureCounterparty(caseId: string, name: string, pattern: string, type: string) {
  const existing = await prisma.counterparty.findFirst({ where: { caseId, name } });
  if (existing) {
    if (existing.matchPattern !== pattern) {
      await prisma.counterparty.update({ where: { id: existing.id }, data: { matchPattern: pattern } });
      console.log('  UPD: ' + name + ' -> ' + pattern);
    } else {
      console.log('  OK:  ' + name);
    }
    return;
  }
  await prisma.counterparty.create({
    data: { caseId, name, matchPattern: pattern, type, createdBy: 'classify-v5' }
  });
  console.log('  NEU: ' + name + ' -> ' + pattern);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Pre-Insolvency Classification v5 (FINAL)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const hvCase = await prisma.case.findFirst({ where: { caseNumber: CASE_NUMBER } });
  if (hvCase === null) throw new Error('Case nicht gefunden');
  const caseId = hvCase.id;

  // ── 1. HEK Hanseatische Krankenkasse ──
  console.log('=== 1. Fehlende Counterparties ===\n');
  await ensureCounterparty(caseId, 'HEK Hanseatische Krankenkasse', '(HEK.*Hanseatische|Hanseatische.*Krankenkasse|HEK.*Krankenkasse)', 'AUTHORITY');
  await ensureCounterparty(caseId, 'Agentur Geiger', '(Agentur Geiger)', 'SUPPLIER');
  await ensureCounterparty(caseId, 'PKV Institut', '(PKV Institut|PKV.*Institut)', 'SUPPLIER');
  await ensureCounterparty(caseId, 'IHK Köln', '(IHK Köln|IHK K.ln)', 'AUTHORITY');
  await ensureCounterparty(caseId, 'Bundesanzeiger Verlag GmbH', '(Bundesanzeiger)', 'AUTHORITY');
  await ensureCounterparty(caseId, 'Genoverband e.V.', '(Genoverband)', 'AUTHORITY');
  await ensureCounterparty(caseId, 'PP Business Protection GmbH', '(PP Business|D&O Versicherung)', 'SUPPLIER');
  await ensureCounterparty(caseId, 'Rechtsanwalt Lammertz', '(Lammertz)', 'SUPPLIER');
  await ensureCounterparty(caseId, 'Pega Elektronik', '(Pega Elektronik)', 'SUPPLIER');
  await ensureCounterparty(caseId, 'united-domains GmbH', '(united-domains|united.domains)', 'SUPPLIER');
  await ensureCounterparty(caseId, 'Kasse Gemeinde Eitorf', '(Gemeinde Eitorf|Verwarngeld)', 'AUTHORITY');
  await ensureCounterparty(caseId, 'Dr. Oliver Funken', '(Oliver Funken|Funken)', 'OTHER');
  await ensureCounterparty(caseId, 'Pablo Manuel Helbing (Vertreter)', '(Helbing|Pablo.*Helbing)', 'OTHER');
  await ensureCounterparty(caseId, 'A. Rahim Ekhlas (Vertreter)', '(Ekhlas)', 'OTHER');
  await ensureCounterparty(caseId, 'Dr. Barbara Herzner', '(Herzner)', 'OTHER');
  await ensureCounterparty(caseId, 'Zahra Shiri (Vertreter)', '(Zahra Shiri|Shiri)', 'OTHER');
  await ensureCounterparty(caseId, 'Elektro Wirtz', '(Elektro Wirtz)', 'SUPPLIER');
  await ensureCounterparty(caseId, 'Ampere AG', '(Ampere)', 'SUPPLIER');
  await ensureCounterparty(caseId, 'LVM Versicherung', '(\\bLVM\\b)', 'AUTHORITY');
  await ensureCounterparty(caseId, 'SIGNAL IDUNA', '(SIGNAL IDUNA)', 'AUTHORITY');
  await ensureCounterparty(caseId, 'Continentale Versicherung', '(Continentale)', 'AUTHORITY');

  // ── 2. Privatpatient*innen: Pattern massiv erweitern ──
  console.log('\n=== 2. Privatpatient*innen Pattern erweitern ===\n');
  const privpat = await prisma.counterparty.findFirst({
    where: { caseId, name: { contains: 'Privatpatient' } }
  });
  if (privpat) {
    const newPattern = [
      // Exakte Rechnungsformate
      'PQ\\d{2}[/\\- ]',        // PQ25/ PQ25- PQ25 (Leerzeichen!)
      'PQ \\d{2}[/\\- ]',       // PQ 25/
      'PA\\d{2}[/\\- ]',        // PA25/
      'PA \\d{2}[/\\- ]',       // PA 25/
      'PUE \\d{2}',             // PUE 25
      'PAZ\\+',                 // PAZ+310
      // IDs
      'Patienten.?ID',
      'Pat\\.?ID',
      'Pat\\.?\\-?ID',
      'Patient.?Nr',
      'Patienten.?Nr',
      'P.ID \\d',               // P-ID 1234
      'Patiente-ID',
      // Rechnungsformate (MVZ Velbert)
      'R2025/\\d',
      'R2025/\\d{2}\\.\\d+',
      // Rechnungsformate (allgemein)
      'Rechnungsnummer',
      'Rechnungs.Nr',
      'RECHNUNGS NR',
      'Rechnung Nr',
      'Rechnung \\d+',
      'RNr\\.?\\s',
      'ReNr\\.?\\s',
      'Re\\.-Nr',
      'R-Nr',
      'RE-NR',
      'RECHN.*PQ',
      'RE PQ',
      'REN\\s+\\d',
      'Rechnungsnr',
      'Rg\\.?\\s+PQ',           // Rg. PQ25
      'RNO PQ',                 // RNO PQ25307
      'rg \\d+',                // rg 24
      'Rg\\.-Nr\\.?\\s+\\d',    // Rg.-Nr. 28464
      'RECH\\.NR',              // RECH.NR.20
      'Rechnung 28\\d{3}',      // Rechnung 28428 (Velbert Nummernkreis)
      'RG 28\\d{3}',            // RG 28375
      // Sonstige
      'Attestkosten',
      'Arztberichte',
      'Akupunktur',
      'Blutuntersuchung',
      'Todesbescheinigung',     // wird auch von Bestattung gefangen, aber schadet nicht
      'Todesschein',
      'palliativmedizin',
    ].join('|');

    await prisma.counterparty.update({
      where: { id: privpat.id },
      data: { matchPattern: '(' + newPattern + ')' }
    });
    console.log('  Pattern erweitert auf ' + newPattern.split('|').length + ' Varianten');
  }

  // ── 3. Bankgebühren & Zinsen: Pattern erweitern ──
  console.log('\n=== 3. Bankgebühren & Zinsen Pattern erweitern ===\n');
  const bankFees = await prisma.counterparty.findFirst({
    where: { caseId, name: 'Bankgebühren & Zinsen' }
  });
  if (bankFees) {
    const newPattern = '(Zinsbelastung|Zinszahlung|Bereitstellungsprovision|Rechnung Aval|Avalprovisionen|Kontoführung|Abschlussposten|ABSCHLUSSBUCHUNG|KFW per)';
    await prisma.counterparty.update({
      where: { id: bankFees.id },
      data: { matchPattern: newPattern }
    });
    console.log('  Pattern erweitert');
  }

  // ── 4. hkk: unmatched wegen Format ohne "Beitraege" ──
  console.log('\n=== 4. Sonstige Pattern-Fixes ===\n');
  const hkk = await prisma.counterparty.findFirst({
    where: { caseId, name: { contains: 'hkk' } }
  });
  if (hkk) {
    await prisma.counterparty.update({
      where: { id: hkk.id },
      data: { matchPattern: '(hkk.*Beitraege|hkk.*Krankenkasse|\\bhkk\\b)' }
    });
    console.log('  hkk: Pattern erweitert');
  }

  // Ruhr-Universität Bochum → DRV/Gutachten-Kategorie
  // Diverse Echtzeitüberweisungen ohne Referenz → schwer zu matchen, aber egal

  // ── 5. Re-Run Classification ──
  console.log('\n=== 5. Re-Run Classification ===\n');

  await prisma.ledgerEntry.updateMany({
    where: { caseId, allocationSource: 'PRE_INSOLVENCY' },
    data: { suggestedCounterpartyId: null, suggestedReason: null }
  });

  const counterparties = await prisma.counterparty.findMany({
    where: { caseId, matchPattern: { not: null } },
    orderBy: { displayOrder: 'asc' }
  });
  console.log('  ' + counterparties.length + ' Patterns geladen');

  const entries = await prisma.ledgerEntry.findMany({
    where: { caseId, allocationSource: 'PRE_INSOLVENCY' }
  });
  console.log('  ' + entries.length + ' Entries\n');

  let matched = 0;
  let unmatched = 0;
  const matchStats: Record<string, number> = {};
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
            data: { suggestedCounterpartyId: cp.id, suggestedReason: 'Pattern: ' + cp.name }
          });
          matchStats[cp.name] = (matchStats[cp.name] || 0) + 1;
          matched++;
          found = true;
          break;
        }
      } catch { /* skip */ }
    }

    if (found === false) {
      unmatched++;
      unmatchedEntries.push({
        desc: entry.description.slice(0, 100),
        note: entry.note,
        amount: Number(entry.amountCents) / 100
      });
    }
  }

  const pct = ((matched / entries.length) * 100).toFixed(1);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('ERGEBNIS: ' + matched + '/' + entries.length + ' (' + pct + '%) klassifiziert');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Matches
  const sorted = Object.entries(matchStats).sort((a, b) => b[1] - a[1]);
  console.log('=== MATCHES (Top 30) ===\n');
  for (const [name, count] of sorted.slice(0, 30)) {
    console.log(count.toString().padStart(4) + 'x | ' + name);
  }
  console.log('  ... und ' + (sorted.length - 30) + ' weitere');

  // Unmatched
  console.log('\n=== VERBLEIBENDE UNMATCHED (' + unmatched + ') ===\n');
  for (const e of unmatchedEntries) {
    const amount = e.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 });
    console.log('  ' + amount.padStart(14) + ' EUR | ' + e.desc.slice(0, 80));
    if (e.note) console.log('  ' + ' '.repeat(14) + '     Note: ' + (e.note || '').slice(0, 60));
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error('Fehler:', e); process.exit(1); });
