/**
 * v6: Letzte 21 Entries fixen (99.2% → ~100%)
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const hvCase = await prisma.case.findFirst({ where: { caseNumber: '70d IN 362/25' } });
  if (hvCase === null) throw new Error('Case nicht gefunden');
  const caseId = hvCase.id;

  console.log('=== Letzte Fixes ===\n');

  // HV PLUS: "Betriebsmittelkredit" zum Pattern hinzufügen
  const hvplus = await prisma.counterparty.findFirst({
    where: { caseId, name: { contains: 'HV PLUS eG (interne' } }
  });
  if (hvplus) {
    await prisma.counterparty.update({
      where: { id: hvplus.id },
      data: { matchPattern: '(Übertrag|Umbuchung|Auslage.*HV PLUS|Auslage.*MVZ Uckerath|Auslage.*MVZ Velbert|Betriebsmittelkredit)' }
    });
    console.log('  HV PLUS: +Betriebsmittelkredit');
  }

  // Sammelüberweisung: "(kein Text)" mit Note "Mehrere" hinzufügen
  const sammel = await prisma.counterparty.findFirst({
    where: { caseId, name: { contains: 'Sammelüberweisung' } }
  });
  if (sammel) {
    await prisma.counterparty.update({
      where: { id: sammel.id },
      data: { matchPattern: '(SAMMELÜBERWEISUNG|Belastung Sammelzahlung|ANZAHL \\d+|EBICS.*DFÜ.*Umsätze|\\(kein Text\\))' }
    });
    console.log('  Sammelüberweisung: +(kein Text)');
  }

  // Gutschrift Echtzeitüberw. ohne Referenz → Privatpatient (sind alles kleine Beträge von Patienten)
  // Diese haben nur "Gutschrift Echtzeitüberw.;" als Desc und nur einen Namen im Note
  // Statt Pattern können wir sie manuell zuweisen

  // Bestattung: auch "Arz u. Söhne Beerdigungsinst." und "RgNr. 28xxx"
  const bestattung = await prisma.counterparty.findFirst({
    where: { caseId, name: { contains: 'Bestattungshaus Schottes' } }
  });
  if (bestattung) {
    await prisma.counterparty.update({
      where: { id: bestattung.id },
      data: { matchPattern: '(Bestattung|Todesbescheinigung|Trauerfall|Beerdigungsinst|T\\.-Schein)' }
    });
    console.log('  Bestattung: +Beerdigungsinst, T.-Schein');
  }

  // Re-Run
  console.log('\n=== Re-Run ===\n');
  await prisma.ledgerEntry.updateMany({
    where: { caseId, allocationSource: 'PRE_INSOLVENCY' },
    data: { suggestedCounterpartyId: null, suggestedReason: null }
  });

  const counterparties = await prisma.counterparty.findMany({
    where: { caseId, matchPattern: { not: null } },
    orderBy: { displayOrder: 'asc' }
  });

  const entries = await prisma.ledgerEntry.findMany({
    where: { caseId, allocationSource: 'PRE_INSOLVENCY' }
  });

  let matched = 0;
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
          matched++;
          found = true;
          break;
        }
      } catch { /* skip */ }
    }

    if (found === false) {
      unmatchedEntries.push({
        desc: entry.description.slice(0, 100),
        note: entry.note,
        amount: Number(entry.amountCents) / 100
      });
    }
  }

  const pct = ((matched / entries.length) * 100).toFixed(1);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('ERGEBNIS: ' + matched + '/' + entries.length + ' (' + pct + '%)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('UNMATCHED (' + unmatchedEntries.length + '):\n');
  for (const e of unmatchedEntries) {
    const amount = e.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 });
    console.log('  ' + amount.padStart(14) + ' EUR | ' + e.desc.slice(0, 80));
    if (e.note) console.log('  ' + ' '.repeat(14) + '     Note: ' + (e.note || '').slice(0, 60));
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error('Fehler:', e); process.exit(1); });
