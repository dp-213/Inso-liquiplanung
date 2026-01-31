/**
 * Fix estateAllocation - Korrekte Alt/Neu-Masse Zuordnung
 *
 * Basierend auf case-context.json Regeln:
 * - Stichtag: 29.10.2025
 * - HZV Oktober 2025: 28/31 Alt, 3/31 Neu (Stichtag 29.10.)
 * - HZV ab November 2025: 100% Neumasse
 * - KV Q4/2025: 1/3 Alt (Okt), 2/3 Neu (Nov+Dez)
 * - KV Q3/2025 und früher: 100% Altmasse
 *
 * HZV Abschlag-Logik:
 * - Q4/25-1 (Nov-Zahlung) = Okt-Leistung = MIXED (28/31 Alt)
 * - Q4/25-2 (Dez-Zahlung) = Nov-Leistung = NEUMASSE
 * - Q4/25-3 (Jan-Zahlung) = Dez-Leistung = NEUMASSE
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CASE_ID = '2982ff26-081a-4811-8e1e-46b39e1ff757';

// Stichtag für Alt/Neu-Masse: 29.10.2025
const STICHTAG = new Date('2025-10-29');

async function main() {
  console.log('=== FIX ESTATE ALLOCATION ===\n');

  const entries = await prisma.ledgerEntry.findMany({
    where: { caseId: CASE_ID }
  });

  let stats = { altmasse: 0, neumasse: 0, mixed: 0, unklar: 0 };

  for (const entry of entries) {
    const desc = entry.description.toUpperCase();
    const transDate = new Date(entry.transactionDate);

    let estateAllocation: string | null = null;
    let estateRatio: number | null = null;
    let allocationSource: string | null = null;
    let allocationNote: string | null = null;

    // ===================================================
    // IST-DATEN
    // ===================================================
    if (entry.valueType === 'IST') {

      // --- HZV Abschläge: Q[1-4]/[Jahr]-[Abschlag] ---
      const hzvMatch = desc.match(/HZV\s+ABS\.?\s*Q([1-4])\/(\d{2})-(\d)/i);
      if (hzvMatch) {
        const quarter = parseInt(hzvMatch[1]);
        const year = 2000 + parseInt(hzvMatch[2]);
        const abschlag = parseInt(hzvMatch[3]);

        // Leistungsmonat berechnen:
        // Abschlag 1 = 1. Monat des Vorquartals
        // Abschlag 2 = 2. Monat des Vorquartals
        // Abschlag 3 = 3. Monat des Vorquartals
        // (Korrektur: HZV zahlt für Vormonat, Abschläge sind quartalsweise)

        // Q4/25-1 (Nov) = Oktober 2025 Leistung
        // Q4/25-2 (Dez) = November 2025 Leistung
        // Q4/25-3 (Jan) = Dezember 2025 Leistung
        const leistungsMonat = (quarter - 1) * 3 + abschlag - 1; // 0-basiert

        // Für Q4/25: Abschlag 1 = Okt (Monat 9), Abschlag 2 = Nov (Monat 10), Abschlag 3 = Dez (Monat 11)
        // Leistungsmonat für Q4: (4-1)*3 + abschlag - 1 = 9, 10, 11

        const leistungsDate = new Date(year, leistungsMonat, 15);

        if (quarter === 4 && year === 2025 && abschlag === 1) {
          // Oktober 2025: MIXED (28/31 Alt, 3/31 Neu)
          estateAllocation = 'MIXED';
          estateRatio = 28 / 31; // ~90% Altmasse
          allocationSource = 'MASSEKREDITVERTRAG';
          allocationNote = 'HZV Okt 2025: 28/31 Alt, 3/31 Neu (Stichtag 29.10.)';
        } else if (leistungsDate < STICHTAG) {
          estateAllocation = 'ALTMASSE';
          allocationSource = 'LEISTUNGSDATUM';
          allocationNote = `HZV Q${quarter}/${year}-${abschlag}: Leistung vor Stichtag`;
        } else {
          estateAllocation = 'NEUMASSE';
          allocationSource = 'LEISTUNGSDATUM';
          allocationNote = `HZV Q${quarter}/${year}-${abschlag}: Leistung nach Stichtag`;
        }
      }

      // --- HZV Schlusszahlung: SCHLUSS Q3/25 oder ähnlich ---
      const hzvSchlussMatch = desc.match(/SCHLUSS\.?\s*Q([1-4])\/(\d{2})/i);
      if (hzvSchlussMatch && !estateAllocation) {
        const quarter = parseInt(hzvSchlussMatch[1]);
        const year = 2000 + parseInt(hzvSchlussMatch[2]);
        const quarterEnd = new Date(year, quarter * 3, 0);

        if (quarterEnd < STICHTAG) {
          estateAllocation = 'ALTMASSE';
          allocationSource = 'LEISTUNGSDATUM';
          allocationNote = `HZV Schluss Q${quarter}/${year}: komplett vor Stichtag`;
        } else if (quarter === 4 && year === 2025) {
          // Q4/25 Schlusszahlung: teilweise Alt, teilweise Neu
          estateAllocation = 'MIXED';
          estateRatio = 1 / 3; // ~33% Alt (Oktober-Anteil)
          allocationSource = 'MASSEKREDITVERTRAG';
          allocationNote = 'HZV Schluss Q4/25: anteilig Okt=Alt, Nov+Dez=Neu';
        } else {
          estateAllocation = 'NEUMASSE';
          allocationSource = 'LEISTUNGSDATUM';
          allocationNote = `HZV Schluss Q${quarter}/${year}: nach Stichtag`;
        }
      }

      // --- HAVG ohne spezifisches Quartal (aus Kontoauszug HZV) ---
      if (!estateAllocation && (desc.includes('HAVG') || desc.includes('HZV'))) {
        // Prüfe Transaktionsdatum
        if (transDate.getMonth() === 10 && transDate.getFullYear() === 2025) {
          // November 2025 Zahlung = Oktober Leistung
          estateAllocation = 'MIXED';
          estateRatio = 28 / 31;
          allocationSource = 'VORMONAT_LOGIK';
          allocationNote = 'HZV Nov-Zahlung = Okt-Leistung: 28/31 Alt';
        } else if (transDate < new Date('2025-11-01')) {
          estateAllocation = 'ALTMASSE';
          allocationSource = 'VORMONAT_LOGIK';
          allocationNote = 'HZV vor November = Leistung vor Oktober';
        } else {
          estateAllocation = 'NEUMASSE';
          allocationSource = 'VORMONAT_LOGIK';
          allocationNote = 'HZV ab Dezember = Leistung ab November';
        }
      }

      // --- KV/KVNO ---
      if (!estateAllocation && (desc.includes('KV') || desc.includes('KVNO'))) {
        const kvMatch = desc.match(/Q([1-4])\/(\d{2})/);
        if (kvMatch) {
          const quarter = parseInt(kvMatch[1]);
          const year = 2000 + parseInt(kvMatch[2]);

          if (quarter <= 3 && year === 2025) {
            estateAllocation = 'ALTMASSE';
            allocationSource = 'LEISTUNGSDATUM';
            allocationNote = `KV Q${quarter}/${year}: komplett vor Stichtag`;
          } else if (quarter === 4 && year === 2025) {
            estateAllocation = 'MIXED';
            estateRatio = 1 / 3; // 1/3 Alt (Okt), 2/3 Neu (Nov+Dez)
            allocationSource = 'MASSEKREDITVERTRAG';
            allocationNote = 'KV Q4/25: 1/3 Alt (Okt), 2/3 Neu (Nov+Dez)';
          } else {
            estateAllocation = 'NEUMASSE';
            allocationSource = 'LEISTUNGSDATUM';
            allocationNote = `KV Q${quarter}/${year}: nach Stichtag`;
          }
        }
      }

      // --- PVS (Privatliquidation) ---
      if (!estateAllocation && (desc.includes('PVS') || desc.includes('PRIVAT'))) {
        estateAllocation = 'UNKLAR';
        allocationSource = 'MANUELL_PRUEFEN';
        allocationNote = 'PVS: Behandlungsdatum nicht aus Buchung ableitbar';
      }

      // --- Sparkasse Übertrag ---
      if (!estateAllocation && desc.includes('SPARKASSE')) {
        // Sparkasse-Überträge sind meist Massekreditvereinbarung
        estateAllocation = 'UNKLAR';
        allocationSource = 'MANUELL_PRUEFEN';
        allocationNote = 'Sparkasse-Übertrag: Herkunft prüfen';
      }
    }

    // ===================================================
    // PLAN-DATEN
    // ===================================================
    if (entry.valueType === 'PLAN') {
      const descLower = entry.description.toLowerCase();

      // Altforderungen explizit
      if (descLower.includes('altforderung')) {
        estateAllocation = 'ALTMASSE';
        allocationSource = 'FACHLICH_KLAR';
        allocationNote = 'Explizit als Altforderung gekennzeichnet';
      }
      // Insolvenz-spezifisch
      else if (descLower.includes('inso') || descLower.includes('insolvenz')) {
        estateAllocation = 'NEUMASSE';
        allocationSource = 'FACHLICH_KLAR';
        allocationNote = 'Insolvenz-spezifisch (nach Eröffnung)';
      }
      // ANNAHME mit Leistungszeitraum
      else if (descLower.includes('annahme')) {
        // Prüfe Transaktionsdatum
        if (transDate < STICHTAG) {
          estateAllocation = 'ALTMASSE';
          allocationSource = 'LEISTUNGSDATUM';
          allocationNote = 'PLAN für Zeitraum vor Stichtag';
        } else if (transDate.getMonth() === 9 && transDate.getFullYear() === 2025) {
          // Oktober 2025: MIXED
          estateAllocation = 'MIXED';
          estateRatio = 28 / 31;
          allocationSource = 'LEISTUNGSDATUM';
          allocationNote = 'PLAN Okt 2025: 28/31 Alt (Stichtag 29.10.)';
        } else {
          estateAllocation = 'NEUMASSE';
          allocationSource = 'LEISTUNGSDATUM';
          allocationNote = 'PLAN für Zeitraum nach Stichtag';
        }
      }
      // PLAN ohne Annahme-Keyword
      else if (transDate >= STICHTAG) {
        estateAllocation = 'NEUMASSE';
        allocationSource = 'LEISTUNGSDATUM';
        allocationNote = 'PLAN nach Stichtag';
      } else {
        estateAllocation = 'ALTMASSE';
        allocationSource = 'LEISTUNGSDATUM';
        allocationNote = 'PLAN vor Stichtag';
      }
    }

    // ===================================================
    // Fallback
    // ===================================================
    if (!estateAllocation) {
      estateAllocation = 'UNKLAR';
      allocationSource = 'KEINE_REGEL';
      allocationNote = 'Keine automatische Zuordnung möglich';
    }

    // Update
    await prisma.ledgerEntry.update({
      where: { id: entry.id },
      data: {
        estateAllocation,
        estateRatio,
        allocationSource,
        allocationNote,
      }
    });

    // Stats
    if (estateAllocation === 'ALTMASSE') stats.altmasse++;
    else if (estateAllocation === 'NEUMASSE') stats.neumasse++;
    else if (estateAllocation === 'MIXED') stats.mixed++;
    else stats.unklar++;
  }

  console.log('Estate Allocation Ergebnis:');
  console.log(`  ALTMASSE: ${stats.altmasse}`);
  console.log(`  NEUMASSE: ${stats.neumasse}`);
  console.log(`  MIXED: ${stats.mixed}`);
  console.log(`  UNKLAR: ${stats.unklar}`);

  // Detaillierte Aufschlüsselung
  console.log('\nNach Quelle:');
  const bySource = await prisma.ledgerEntry.groupBy({
    by: ['allocationSource', 'estateAllocation'],
    where: { caseId: CASE_ID },
    _count: { id: true }
  });
  bySource.forEach(s => {
    console.log(`  ${s.allocationSource || 'NULL'} → ${s.estateAllocation}: ${s._count.id}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
