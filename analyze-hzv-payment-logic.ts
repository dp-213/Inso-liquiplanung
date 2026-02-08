/**
 * Analysiere HZV-Zahlungslogik
 *
 * Ziel: Aus Zahlungsdatum + Krankenkasse die Service-Period ableiten
 *
 * Hypothese: Zahlung M = Leistung M-1 (oder M-2, etc.)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

function extractQuarterFromDescription(description: string): string | null {
  const quarterPattern = /Q([1-4])\/(\d{2})/i;
  const match = description.match(quarterPattern);

  if (match) {
    return `Q${match[1]}/20${match[2]}`;
  }

  return null;
}

function extractKrankenkasse(description: string): string | null {
  // Extrahiere Krankenkassen-Kürzel
  const patterns = [
    /AOK\s+NO/i,
    /TK\s+HZV/i,
    /BKK\s+NO/i,
    /IKKCL\s+BUND/i,
    /KBS\s+NO/i,
    /LKK\s+NO/i,
    /EK\s+NO/i,
    /SPECTRUMK/i,
    /BAHN\s+BKK/i
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  return null;
}

function extractZahlungstyp(description: string): string | null {
  if (description.includes('REST')) return 'REST (Nachzahlung)';
  if (description.includes('ABS')) return 'ABS (Abschlag)';
  return 'UNBEKANNT';
}

async function analyzePaymentLogic() {
  console.log('=== HZV-ZAHLUNGSLOGIK ANALYSE ===\n');

  // 1. Alle HZV-Entries mit Quartalsangabe laden
  const hzvEntries = await prisma.ledgerEntry.findMany({
    where: {
      caseId,
      valueType: 'IST',
      OR: [
        { description: { contains: 'HZV' } },
        { description: { contains: 'HÄVG' } },
        { description: { contains: 'HAEVG' } }
      ],
      amountCents: { gt: 0 } // Nur Einnahmen
    },
    orderBy: { transactionDate: 'asc' },
    select: {
      transactionDate: true,
      amountCents: true,
      description: true
    }
  });

  console.log(`📊 Gefundene HZV-Einnahmen: ${hzvEntries.length}\n`);

  // 2. Extrahiere Zahlungslogik
  console.log('## Zahlungslogik-Analyse\n');

  const zahlungslogik: Array<{
    zahlungsdatum: string;
    zahlungsmonat: string;
    quarter: string | null;
    krankenkasse: string | null;
    zahlungstyp: string | null;
    amount: number;
    description: string;
  }> = [];

  for (const entry of hzvEntries) {
    const quarter = extractQuarterFromDescription(entry.description);
    const krankenkasse = extractKrankenkasse(entry.description);
    const zahlungstyp = extractZahlungstyp(entry.description);

    zahlungslogik.push({
      zahlungsdatum: entry.transactionDate.toISOString().substring(0, 10),
      zahlungsmonat: entry.transactionDate.toISOString().substring(0, 7),
      quarter,
      krankenkasse,
      zahlungstyp,
      amount: Number(entry.amountCents) / 100,
      description: entry.description.substring(0, 80)
    });
  }

  // 3. Gruppiere nach Zahlungsmonat + Krankenkasse + Quarter
  console.log('## Zahlungsmonat → Leistungsquartal\n');

  const mapping = new Map<string, Set<string>>();

  for (const zl of zahlungslogik) {
    if (zl.quarter && zl.krankenkasse) {
      const key = `${zl.zahlungsmonat} | ${zl.krankenkasse}`;
      if (!mapping.has(key)) {
        mapping.set(key, new Set());
      }
      mapping.get(key)!.add(zl.quarter);
    }
  }

  const sortedMapping = Array.from(mapping.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  for (const [key, quarters] of sortedMapping) {
    const quartersStr = Array.from(quarters).join(', ');
    console.log(`   ${key} → ${quartersStr}`);
  }

  // 4. Prüfe Januar-Gutschriften (ohne Quartalsangabe)
  console.log('\n## Januar-Gutschriften (ohne Quarter)\n');

  const januarGutschriften = zahlungslogik.filter(zl =>
    zl.zahlungsmonat === '2026-01' && !zl.quarter
  );

  console.log(`   Anzahl: ${januarGutschriften.length}`);
  console.log(`   Summe: ${januarGutschriften.reduce((sum, zl) => sum + zl.amount, 0).toFixed(2)} EUR\n`);

  // Gruppiere nach Krankenkasse
  const byKrankenkasse = new Map<string, number>();
  for (const zl of januarGutschriften) {
    const kk = zl.krankenkasse || 'UNBEKANNT';
    byKrankenkasse.set(kk, (byKrankenkasse.get(kk) || 0) + zl.amount);
  }

  console.log('   Verteilung nach Krankenkasse:\n');
  for (const [kk, amount] of Array.from(byKrankenkasse.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`      ${kk.padEnd(20)} | ${amount.toFixed(2).padStart(10)} EUR`);
  }

  // 5. Hypothese: Januar-Zahlungen = Q4/2025 oder Q1/2026?
  console.log('\n## Hypothese-Prüfung: Januar-Zahlungen\n');

  console.log('   Bekannte Zahlungsmuster:');
  console.log('   - Oktober-Zahlungen → Q3/2025 (REST = Nachzahlung)');
  console.log('   - November-Zahlungen → Q3/2025 (REST), Q4/2025 (ABS)');
  console.log('   - Dezember-Zahlungen → ??? (nicht in Daten)');
  console.log('   - Januar-Zahlungen → ??? (OHNE Quartalsangabe)\n');

  console.log('   📋 Beispiele Januar-Gutschriften:\n');
  for (const zl of januarGutschriften.slice(0, 10)) {
    console.log(`      ${zl.zahlungsdatum} | ${zl.amount.toFixed(2).padStart(10)} EUR | ${zl.krankenkasse?.padEnd(15)} | ${zl.description}`);
  }

  // 6. Prüfe: Gibt es ähnliche Muster?
  console.log('\n## Pattern-Vergleich\n');

  const novemberQ4 = zahlungslogik.filter(zl =>
    zl.zahlungsmonat.startsWith('2025-11') && zl.quarter === 'Q4/2025'
  );

  console.log(`   November Q4/2025 (ABS): ${novemberQ4.length} Entries`);
  console.log(`   Januar ohne Quarter: ${januarGutschriften.length} Entries`);
  console.log(`\n   💡 HYPOTHESE: Januar-Gutschriften sind vermutlich Q4/2025-Abschläge (Fortsetzung)\n`);

  await prisma.$disconnect();
}

analyzePaymentLogic().catch(console.error);
