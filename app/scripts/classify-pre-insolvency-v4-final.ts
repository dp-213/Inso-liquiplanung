/**
 * Classification v4 (Final): Restliche 5% per Kategorie zuweisen
 *
 * 1. Privatpatient*innen: Pattern erweitern für ALLE Patientenzahlungsformate
 * 2. Bankgebühren & Zinsen: Bankkontokosten, Zinsen, Avalprovisionen
 * 3. Sonstige kleine Lieferanten/Vertreter per breiterem Pattern
 *
 * Ausführung: cd app && npx tsx scripts/classify-pre-insolvency-v4-final.ts
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const CASE_NUMBER = '70d IN 362/25';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Pre-Insolvency Classification v4 (Final): Kategorie-Zuordnung');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const hvCase = await prisma.case.findFirst({ where: { caseNumber: CASE_NUMBER } });
  if (hvCase === null) throw new Error('Case nicht gefunden');
  const caseId = hvCase.id;

  // ─────────────────────────────────────────────
  // 1. Privatpatient*innen Pattern erweitern
  // ─────────────────────────────────────────────
  console.log('=== 1. Privatpatient*innen Pattern erweitern ===\n');

  const privpat = await prisma.counterparty.findFirst({
    where: { caseId, name: { contains: 'Privatpatient' } }
  });
  if (privpat) {
    // Altes Pattern: (PQ\d{2}[/-]|PA\d{2}[/-]|Patienten.?ID|Pat\.?ID|Patient.?Nr|...)
    // Neues Pattern: + Rechnungsformate + R2025/ + RNr + ReNr + Überweisungsgutschrift-Patterns
    const newPattern = [
      'PQ\\d{2}[/-]',           // PQ25/123
      'PA\\d{2}[/-]',           // PA25/99
      'Patienten.?ID',          // Patienten-ID, PatientenID
      'Pat\\.?ID',              // Pat.ID, PatID
      'Patient.?Nr',            // Patient-Nr, PatientNr
      'Patienten.?Nr',          // Patienten-Nr
      'Patient.*ID.*\\d',       // Patient ID 1234
      'Patiente-ID',            // Patiente-ID (Tippfehler in Daten)
      'R2025/\\d{2}\\.\\d+',    // R2025/02.00000021 (Velbert Privatabr.)
      'R2025/\\d+',             // R2025/04.00000027
      'RNr\\.?\\s',             // RNr. / RNr
      'ReNr\\.?\\s',            // ReNr. / ReNr
      'Re\\.-Nr\\.?',           // Re.-Nr.
      'R-Nr\\.?',               // R-Nr.
      'RE-NR',                  // RE-NR:
      'Rechnungsnummer',        // Rechnungsnummer:
      'Rechnung\\s+Nr',         // Rechnung Nr.
      'RECHN\\s*\\.\\s*PQ',     // RECHN . PQ25
      'REN\\s+\\d+',            // REN 1305
      'Rechnungsnr',            // Rechnungsnr
      'Attestkosten',           // Attestkosten
      'Arztberichte',           // ARZTBERICHTE
    ].join('|');

    await prisma.counterparty.update({
      where: { id: privpat.id },
      data: { matchPattern: '(' + newPattern + ')' }
    });
    console.log('  Pattern erweitert: ' + privpat.name);
    console.log('  Neues Pattern umfasst ' + newPattern.split('|').length + ' Varianten');
  }

  // ─────────────────────────────────────────────
  // 2. Bankgebühren & Zinsen
  // ─────────────────────────────────────────────
  console.log('\n=== 2. Bankgebühren & Zinsen ===\n');

  const bankFees = await prisma.counterparty.findFirst({
    where: { caseId, name: 'Bankgebühren & Zinsen' }
  });

  const bankFeesPattern = '(Zinsbelastung|Rechnung Aval|Avalprovisionen|Kontoführung|Abschlussposten|ABSCHLUSSBUCHUNG)';

  if (bankFees) {
    await prisma.counterparty.update({
      where: { id: bankFees.id },
      data: { matchPattern: bankFeesPattern }
    });
    console.log('  Existiert, Pattern aktualisiert');
  } else {
    await prisma.counterparty.create({
      data: {
        caseId,
        name: 'Bankgebühren & Zinsen',
        matchPattern: bankFeesPattern,
        type: 'OTHER',
        createdBy: 'classify-v4',
      }
    });
    console.log('  NEU angelegt: Bankgebühren & Zinsen');
  }

  // ─────────────────────────────────────────────
  // 3. Weitere fehlende Patterns
  // ─────────────────────────────────────────────
  console.log('\n=== 3. Fehlende Patterns ergänzen ===\n');

  const additions: Array<{ exactName: string; matchPattern: string; type: string }> = [
    // Württembergische Versicherung
    { exactName: 'Württembergische Versicherung', matchPattern: '(Württembergische|Wuerttembergische)', type: 'SUPPLIER' },
    // PKV Institut
    { exactName: 'PKV Institut', matchPattern: '(PKV Institut|PKV.*Institut)', type: 'SUPPLIER' },
    // Thomas van Suntum (Arzt Velbert)
    { exactName: 'Thomas van Suntum (Arzt Velbert)', matchPattern: '(van Suntum)', type: 'OTHER' },
    // Ana-Maria Iordache (Mitarbeiterin)
    { exactName: 'Ana-Maria Iordache (Mitarbeiterin)', matchPattern: '(Iordache)', type: 'OTHER' },
    // Dimetokali Fatma (Mitarbeiterin)
    { exactName: 'Dimetokali Fatma (Mitarbeiterin)', matchPattern: '(Dimetokali)', type: 'OTHER' },
  ];

  for (const a of additions) {
    const existing = await prisma.counterparty.findFirst({
      where: { caseId, name: a.exactName }
    });
    if (existing) {
      console.log('  OK: ' + a.exactName);
    } else {
      await prisma.counterparty.create({
        data: { caseId, name: a.exactName, matchPattern: a.matchPattern, type: a.type, createdBy: 'classify-v4' }
      });
      console.log('  NEU: ' + a.exactName);
    }
  }

  // ─────────────────────────────────────────────
  // 4. Re-Run Classification
  // ─────────────────────────────────────────────
  console.log('\n=== 4. Re-Run Classification ===\n');

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
  console.log('  ' + entries.length + ' Entries zu klassifizieren\n');

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
            data: {
              suggestedCounterpartyId: cp.id,
              suggestedReason: 'Pattern: ' + cp.name
            }
          });
          matchStats[cp.name] = (matchStats[cp.name] || 0) + 1;
          matched++;
          found = true;
          break;
        }
      } catch {
        // Skip
      }
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

  // ERGEBNIS
  const pct = Math.round(matched / entries.length * 100);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('ERGEBNIS: ' + matched + '/' + entries.length + ' (' + pct + '%) klassifiziert');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Matches kompakt
  const sorted = Object.entries(matchStats).sort((a, b) => b[1] - a[1]);
  console.log('=== MATCHES ===\n');
  for (const [name, count] of sorted) {
    console.log(count.toString().padStart(4) + 'x | ' + name);
  }

  // Alle unmatched (sollten wenige sein)
  console.log('\n=== UNMATCHED (' + unmatched + ') - VOLLSTÄNDIG ===\n');
  for (const e of unmatchedEntries) {
    const amount = e.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 });
    console.log('  ' + amount.padStart(14) + ' EUR | ' + e.desc);
    if (e.note) console.log('  ' + ' '.repeat(14) + '     Note: ' + (e.note || '').slice(0, 60));
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error('Fehler:', e); process.exit(1); });
