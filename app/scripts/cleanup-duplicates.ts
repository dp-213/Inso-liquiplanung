/**
 * Bereinigt Duplikate in den IST-Daten
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== DUPLIKAT-BEREINIGUNG ===\n');

  const entries = await prisma.ledgerEntry.findMany({
    where: { valueType: 'IST' },
    select: { id: true, transactionDate: true, amountCents: true, description: true, importSource: true },
    orderBy: [{ transactionDate: 'desc' }, { amountCents: 'desc' }]
  });

  console.log('Gesamte IST-Einträge:', entries.length);

  // Gruppiere nach Datum+Betrag
  const groups = new Map<string, typeof entries>();
  for (const e of entries) {
    const key = new Date(e.transactionDate).toISOString().slice(0, 10) + '_' + e.amountCents.toString();
    const group = groups.get(key) || [];
    group.push(e);
    groups.set(key, group);
  }

  // Finde echte Duplikate
  const toDelete: string[] = [];
  let dupeCount = 0;

  for (const [key, items] of groups) {
    if (items.length > 1) {
      // Prüfe ob verschiedene Quellen
      const sources = new Set(items.map(i => i.importSource || 'unknown'));

      if (sources.size > 1) {
        dupeCount++;
        // Verschiedene Quellen - das ist ein echtes Duplikat
        // Priorität: Oktober-PDFs > ISK-Datei > Rest
        const sorted = items.sort((a, b) => {
          const aScore = getSourcePriority(a.importSource || '');
          const bScore = getSourcePriority(b.importSource || '');
          return bScore - aScore;
        });

        // Behalte ersten (höchste Priorität), lösche Rest
        for (let i = 1; i < sorted.length; i++) {
          toDelete.push(sorted[i].id);
        }
      } else if (items.length > 1) {
        // Gleiche Quelle aber mehrfach - auch Duplikate
        // Behalte nur einen
        for (let i = 1; i < items.length; i++) {
          toDelete.push(items[i].id);
        }
      }
    }
  }

  console.log('Duplikate gefunden:', toDelete.length);
  console.log('Betroffene Datums-Betrag-Kombinationen:', dupeCount);

  if (toDelete.length > 0) {
    // Zeige Beispiele
    console.log('\nBeispiele der zu löschenden Einträge:');
    const examples = entries.filter(e => toDelete.includes(e.id)).slice(0, 10);
    for (const ex of examples) {
      console.log(`  ${new Date(ex.transactionDate).toISOString().slice(0, 10)} | ${(Number(ex.amountCents) / 100).toFixed(2).padStart(10)}€ | ${(ex.importSource || '').slice(0, 45)}`);
    }

    // Lösche Duplikate
    const deleted = await prisma.ledgerEntry.deleteMany({
      where: { id: { in: toDelete } }
    });
    console.log('\nGelöscht:', deleted.count, 'Duplikate');
  }

  // Zeige neue Statistik
  console.log('\n=== NACH BEREINIGUNG ===');
  const remaining = await prisma.ledgerEntry.count({ where: { valueType: 'IST' } });
  console.log('Verbleibende IST-Einträge:', remaining);
}

function getSourcePriority(source: string): number {
  // Höhere Zahl = höhere Priorität
  if (source.includes('Oktober') && source.includes('Kontoauszug')) return 100;
  if (source.includes('_DE13.pdf') || source.includes('_DE83.pdf')) return 100;
  if (source.includes('November') && source.includes('Kontoauszug')) return 90;
  if (source.includes('HVPlus Einzahlungen ISK')) return 80;
  if (source.includes('Kontoauszug')) return 70;
  return 50;
}

main().catch(console.error).finally(() => prisma.$disconnect());
