/**
 * Classification v3: Gezielte Fixes für verbleibende Probleme
 *
 * 1. ALLE Landeshauptkasse NRW Instanzen fixen (nicht nur erste)
 * 2. ALLE Techniker Krankenkasse Instanzen fixen
 * 3. BKK firmus per Exact-Name-Match anlegen
 * 4. Fehlende Counterparties gezielt anlegen (exakte Prüfung)
 * 5. Nordrheinische Ärzteversorgung Pattern prüfen/setzen
 * 6. Re-Run Classification
 *
 * Ausführung: cd app && npx tsx scripts/classify-pre-insolvency-v3-fixes.ts
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const CASE_NUMBER = '70d IN 362/25';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Pre-Insolvency Classification v3: Gezielte Fixes');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const hvCase = await prisma.case.findFirst({ where: { caseNumber: CASE_NUMBER } });
  if (hvCase === null) throw new Error('Case nicht gefunden');
  const caseId = hvCase.id;

  // ─────────────────────────────────────────────
  // FIX 1: ALLE Landeshauptkasse NRW Instanzen fixen
  // ─────────────────────────────────────────────
  console.log('=== FIX 1: Alle Landeshauptkasse NRW Instanzen ===\n');
  const lhks = await prisma.counterparty.findMany({
    where: { caseId, name: { contains: 'Landeshauptkasse' } }
  });
  console.log('  Gefunden: ' + lhks.length + ' Instanzen');
  for (const lhk of lhks) {
    console.log('  - ' + lhk.name + ' | Pattern: ' + (lhk.matchPattern || 'NULL'));
    if (lhk.matchPattern !== '(Landeshauptkasse)') {
      await prisma.counterparty.update({
        where: { id: lhk.id },
        data: { matchPattern: '(Landeshauptkasse)' }
      });
      console.log('    -> GEFIXT auf: (Landeshauptkasse)');
    }
  }

  // ─────────────────────────────────────────────
  // FIX 2: ALLE Techniker Krankenkasse Instanzen fixen
  // ─────────────────────────────────────────────
  console.log('\n=== FIX 2: Alle Techniker Krankenkasse Instanzen ===\n');
  const tks = await prisma.counterparty.findMany({
    where: { caseId, name: { contains: 'Techniker' } }
  });
  console.log('  Gefunden: ' + tks.length + ' Instanzen');
  for (const tk of tks) {
    console.log('  - ' + tk.name + ' | Pattern: ' + (tk.matchPattern || 'NULL'));
    const newPattern = '(Techniker Krankenkasse|Techniker.*Krankenkasse|TK.Beleg)';
    if (tk.matchPattern !== newPattern) {
      await prisma.counterparty.update({
        where: { id: tk.id },
        data: { matchPattern: newPattern }
      });
      console.log('    -> GEFIXT auf: ' + newPattern);
    }
  }

  // ─────────────────────────────────────────────
  // FIX 3: BKK firmus per exaktem Namen anlegen
  // ─────────────────────────────────────────────
  console.log('\n=== FIX 3: BKK firmus ===\n');
  const bkkFirmus = await prisma.counterparty.findFirst({
    where: { caseId, name: 'BKK firmus' }
  });
  if (bkkFirmus) {
    console.log('  Existiert bereits: ' + bkkFirmus.name + ' | Pattern: ' + (bkkFirmus.matchPattern || 'NULL'));
    if (bkkFirmus.matchPattern === null) {
      await prisma.counterparty.update({
        where: { id: bkkFirmus.id },
        data: { matchPattern: '(BKK firmus|BKK.*firmus)' }
      });
      console.log('  -> Pattern gesetzt');
    }
  } else {
    await prisma.counterparty.create({
      data: { caseId, name: 'BKK firmus', matchPattern: '(BKK firmus|BKK.*firmus)', type: 'AUTHORITY', createdBy: 'classify-v3' }
    });
    console.log('  NEU angelegt: BKK firmus');
  }

  // ─────────────────────────────────────────────
  // FIX 4: Nordrheinische Ärzteversorgung Pattern prüfen
  // ─────────────────────────────────────────────
  console.log('\n=== FIX 4: Nordrheinische Ärzteversorgung ===\n');
  const naev = await prisma.counterparty.findFirst({
    where: { caseId, name: { contains: 'Nordrheinische' } }
  });
  if (naev) {
    console.log('  Existiert: ' + naev.name + ' | Pattern: ' + (naev.matchPattern || 'NULL'));
    const naevPattern = '(Nordrheinische.*Aerzteversorg|Nordrheinische.*Ärzteversorg|Aerzteversorg)';
    if (naev.matchPattern !== naevPattern) {
      await prisma.counterparty.update({
        where: { id: naev.id },
        data: { matchPattern: naevPattern }
      });
      console.log('  -> Pattern aktualisiert: ' + naevPattern);
    }
  } else {
    await prisma.counterparty.create({
      data: { caseId, name: 'Nordrheinische Ärzteversorgung', matchPattern: '(Nordrheinische.*Aerzteversorg|Nordrheinische.*Ärzteversorg|Aerzteversorg)', type: 'AUTHORITY', createdBy: 'classify-v3' }
    });
    console.log('  NEU angelegt');
  }

  // ─────────────────────────────────────────────
  // FIX 5: Fehlende Counterparties (exakte Prüfung)
  // ─────────────────────────────────────────────
  console.log('\n=== FIX 5: Fehlende Counterparties ===\n');

  const missing: Array<{ exactName: string; matchPattern: string; type: string }> = [
    // Dr. Thomas Beyer (eigene Counterparty, nicht Dr. Kamler!)
    { exactName: 'Dr. Thomas Beyer', matchPattern: '(Dr\\.?\\s*Thomas Beyer|Thomas Beyer)', type: 'OTHER' },
    // Dr. Manfred Imbert
    { exactName: 'Dr. Manfred Imbert', matchPattern: '(Manfred Imbert|Imbert)', type: 'OTHER' },
    // Anke Reinshagen
    { exactName: 'Anke Reinshagen (Mitarbeiterin)', matchPattern: '(Anke Reinshagen|Reinshagen)', type: 'OTHER' },
    // Dr. med. W. Küster
    { exactName: 'Dr. med. W. Küster (Vertreter)', matchPattern: '(Kuester|Küster)', type: 'OTHER' },
    // Dr. med. Helena Catterfeld
    { exactName: 'Dr. med. Helena Catterfeld', matchPattern: '(Catterfeld)', type: 'OTHER' },
    // Dr. Schweitzer
    { exactName: 'Dr. Schweitzer (Uckerath)', matchPattern: '(Schweitzer)', type: 'OTHER' },
    // AG Bonn Zahlstelle
    { exactName: 'AG Bonn Zahlstelle', matchPattern: '(AG Bonn.*Zahlstelle)', type: 'AUTHORITY' },
    // 3er GMP (Praxisgemeinschaft)
    { exactName: '3er GMP (Praxisgemeinschaft)', matchPattern: '(3er GMP|3er.*GMP)', type: 'OTHER' },
    // 5er PG (Praxisgemeinschaft)
    { exactName: '5er PG (Praxisgemeinschaft)', matchPattern: '(5er PG|5er.*PG)', type: 'OTHER' },
    // Peter Reinemer (Vertreter)
    { exactName: 'Peter Reinemer (Vertreter)', matchPattern: '(Reinemer|Peter Reinemer)', type: 'OTHER' },
    // AP Kälte & Klima
    { exactName: 'AP Kälte & Klima', matchPattern: '(AP Kälte|AP Kaelte|AP K.lte)', type: 'SUPPLIER' },
    // Klarna / eBay
    { exactName: 'Klarna Bank (eBay)', matchPattern: '(Klarna|eBay)', type: 'SUPPLIER' },
    // T2Med GmbH
    { exactName: 'T2Med GmbH', matchPattern: '(T2med|T2Med)', type: 'SUPPLIER' },
    // mediDOK
    { exactName: 'mediDOK Software', matchPattern: '(mediDOK)', type: 'SUPPLIER' },
    // D.O.C. Consulting (nur wenn noch kein Pattern)
    // GEDAKO GmbH
    { exactName: 'GEDAKO GmbH', matchPattern: '(GEDAKO)', type: 'SUPPLIER' },
    // Adler Apotheke
    { exactName: 'Adler Apotheke', matchPattern: '(Adler Apotheke)', type: 'SUPPLIER' },
    // ARAG Krankenversicherung
    { exactName: 'ARAG Krankenversicherung', matchPattern: '(ARAG)', type: 'AUTHORITY' },
    // DEVK
    { exactName: 'DEVK', matchPattern: '(DEVK)', type: 'AUTHORITY' },
    // ERGO Vorsorge
    { exactName: 'ERGO Vorsorge', matchPattern: '(ERGO)', type: 'AUTHORITY' },
    // HANSEMERKUR
    { exactName: 'HanseMerkur Versicherung', matchPattern: '(HANSEMERKUR|HanseMerkur)', type: 'AUTHORITY' },
    // COSMOS Lebensversicherung
    { exactName: 'COSMOS Lebensversicherung', matchPattern: '(COSMOS)', type: 'AUTHORITY' },
    // LVR (Landschaftsverband Rheinland)
    { exactName: 'LVR', matchPattern: '(\\bLVR\\b)', type: 'AUTHORITY' },
    // Diverse Vertreter
    { exactName: 'Dr. Lothar Frentzen (Vertreter)', matchPattern: '(Frentzen)', type: 'OTHER' },
    { exactName: 'Dr. Schlegtendal (Vertreter)', matchPattern: '(Schlegtendal)', type: 'OTHER' },
    { exactName: 'Nabih El Alaoui (Vertreter)', matchPattern: '(Nabih.*Alaoui|El Alaoui)', type: 'OTHER' },
    { exactName: 'Dr. Knoche-Walter', matchPattern: '(Knoche.Walter)', type: 'OTHER' },
    { exactName: 'Dr. med. Karim Zayed (Vertreter)', matchPattern: '(Karim Zayed|Zayed)', type: 'OTHER' },
    { exactName: 'Dr. Johannes Grohmann (Vertreter)', matchPattern: '(Grohmann)', type: 'OTHER' },
    { exactName: 'Dr. Jörg Ruff (Vertreter)', matchPattern: '(Jörg Ruff|Ruff)', type: 'OTHER' },
    // Stadtkasse Wuppertal
    { exactName: 'Stadtkasse Wuppertal', matchPattern: '(STADTKASSE WUPPERTAL)', type: 'AUTHORITY' },
    // Stadt Essen
    { exactName: 'Stadt Essen', matchPattern: '(STADT ESSEN)', type: 'AUTHORITY' },
    // Beerdigungsinstitut Velleuer
    { exactName: 'Beerdigungsinstitut Velleuer', matchPattern: '(Velleuer|Beerdigungsinstitut)', type: 'SUPPLIER' },
    // Kristin Kraus (Mitarbeiterin)
    { exactName: 'Kristin Kraus (Mitarbeiterin)', matchPattern: '(Kristin Kraus|Kraus Kristin)', type: 'OTHER' },
  ];

  let createdCount = 0;
  for (const m of missing) {
    const existing = await prisma.counterparty.findFirst({
      where: { caseId, name: m.exactName }
    });

    if (existing) {
      // Prüfe ob Pattern gesetzt
      if (existing.matchPattern === null || existing.matchPattern === '') {
        await prisma.counterparty.update({
          where: { id: existing.id },
          data: { matchPattern: m.matchPattern }
        });
        console.log('  PATTERN: ' + existing.name + ' -> ' + m.matchPattern);
      } else {
        console.log('  OK: ' + existing.name + ' (Pattern: ' + existing.matchPattern + ')');
      }
    } else {
      await prisma.counterparty.create({
        data: { caseId, name: m.exactName, matchPattern: m.matchPattern, type: m.type, createdBy: 'classify-v3' }
      });
      console.log('  NEU: ' + m.exactName + ' -> ' + m.matchPattern);
      createdCount++;
    }
  }
  console.log('\n  ' + createdCount + ' neue Counterparties angelegt');

  // ─────────────────────────────────────────────
  // FIX 6: Sonstige Pattern-Fixes
  // ─────────────────────────────────────────────
  console.log('\n=== FIX 6: Sonstige Pattern-Fixes ===\n');

  // Zurich: Auch "Zurich Deutscher Herold" und FirmenSchutz
  const zurich = await prisma.counterparty.findFirst({
    where: { caseId, name: { contains: 'Zurich' } }
  });
  if (zurich) {
    const newPattern = '(Zurich.*Insurance|Zurich.*Herold|FirmenSchutz.Police)';
    await prisma.counterparty.update({
      where: { id: zurich.id },
      data: { matchPattern: newPattern }
    });
    console.log('  Zurich: ' + newPattern);
  }

  // D.O.C.: Pattern aktualisieren um auch "D.O.C. Ges. für med." zu matchen
  const docs = await prisma.counterparty.findMany({
    where: { caseId, name: { contains: 'D.O.C' } }
  });
  for (const doc of docs) {
    const newPattern = '(D\\.O\\.C\\.|DOC Ges|D\\.O\\.C)';
    await prisma.counterparty.update({
      where: { id: doc.id },
      data: { matchPattern: newPattern }
    });
    console.log('  D.O.C.: ' + doc.name + ' -> ' + newPattern);
  }

  // SHP: Pattern setzen
  const shp = await prisma.counterparty.findFirst({
    where: { caseId, name: { contains: 'SHP' } }
  });
  if (shp) {
    const shpPattern = shp.matchPattern || 'NULL';
    if (shpPattern === 'NULL' || shpPattern.length < 3) {
      await prisma.counterparty.update({
        where: { id: shp.id },
        data: { matchPattern: '(SHP\\d{2}|\\bSHP\\b)' }
      });
      console.log('  SHP: Pattern gesetzt');
    } else {
      console.log('  SHP: Pattern existiert: ' + shpPattern);
    }
  }

  // SPS Germany: Pattern setzen
  const sps = await prisma.counterparty.findFirst({
    where: { caseId, name: { contains: 'SPS Germany' } }
  });
  if (sps) {
    if (sps.matchPattern === null || sps.matchPattern === '') {
      await prisma.counterparty.update({
        where: { id: sps.id },
        data: { matchPattern: '(SPS Germany|SPS.*Germany)' }
      });
      console.log('  SPS Germany: Pattern gesetzt');
    } else {
      console.log('  SPS Germany: Pattern existiert: ' + sps.matchPattern);
    }
  }

  // Shop Apotheke: Pattern setzen
  const shopApo = await prisma.counterparty.findFirst({
    where: { caseId, name: { contains: 'Shop Apotheke' } }
  });
  if (shopApo) {
    if (shopApo.matchPattern === null || shopApo.matchPattern === '') {
      await prisma.counterparty.update({
        where: { id: shopApo.id },
        data: { matchPattern: '(Shop Apotheke)' }
      });
      console.log('  Shop Apotheke: Pattern gesetzt');
    } else {
      console.log('  Shop Apotheke: Pattern existiert: ' + shopApo.matchPattern);
    }
  }

  // medisign: Pattern setzen
  const medisign = await prisma.counterparty.findFirst({
    where: { caseId, name: { contains: 'medisign' } }
  });
  if (medisign) {
    if (medisign.matchPattern === null || medisign.matchPattern === '') {
      await prisma.counterparty.update({
        where: { id: medisign.id },
        data: { matchPattern: '(medisign)' }
      });
      console.log('  medisign: Pattern gesetzt');
    } else {
      console.log('  medisign: Pattern existiert: ' + medisign.matchPattern);
    }
  }

  // KRAVAG: Pattern setzen
  const kravag = await prisma.counterparty.findFirst({
    where: { caseId, name: { contains: 'KRAVAG' } }
  });
  if (kravag) {
    if (kravag.matchPattern === null || kravag.matchPattern === '') {
      await prisma.counterparty.update({
        where: { id: kravag.id },
        data: { matchPattern: '(KRAVAG)' }
      });
      console.log('  KRAVAG: Pattern gesetzt');
    } else {
      console.log('  KRAVAG: Pattern existiert: ' + kravag.matchPattern);
    }
  }

  // Behördenverlag: Pattern setzen
  const bv = await prisma.counterparty.findFirst({
    where: { caseId, name: { contains: 'Behördenverlag' } }
  });
  if (bv) {
    if (bv.matchPattern === null || bv.matchPattern === '') {
      await prisma.counterparty.update({
        where: { id: bv.id },
        data: { matchPattern: '(Behördenverlag|Jüngling)' }
      });
      console.log('  Behördenverlag: Pattern gesetzt');
    } else {
      console.log('  Behördenverlag: Pattern existiert: ' + bv.matchPattern);
    }
  }

  // Agentur Geiger: Eigene Counterparty
  const geiger = await prisma.counterparty.findFirst({
    where: { caseId, name: 'Agentur Geiger' }
  });
  if (geiger === null) {
    await prisma.counterparty.create({
      data: { caseId, name: 'Agentur Geiger', matchPattern: '(Agentur Geiger)', type: 'SUPPLIER', createdBy: 'classify-v3' }
    });
    console.log('  Agentur Geiger: NEU angelegt');
  }

  // GGEW: Pattern erweitern um "Elektrizitatswerk" (ohne ä)
  const ggew = await prisma.counterparty.findFirst({
    where: { caseId, name: { contains: 'GGEW' } }
  });
  if (ggew) {
    const newPattern = '(GGEW|Gruppen-Gas.*Elektrizitätswerk|Gruppen-Gas.*Elektrizitatswerk)';
    await prisma.counterparty.update({
      where: { id: ggew.id },
      data: { matchPattern: newPattern }
    });
    console.log('  GGEW: Pattern erweitert für Umlaut-Variante');
  }

  // ─────────────────────────────────────────────
  // PHASE D: Re-Run Counterparty Matching
  // ─────────────────────────────────────────────
  console.log('\n=== Re-Run Classification ===\n');

  await prisma.ledgerEntry.updateMany({
    where: { caseId, allocationSource: 'PRE_INSOLVENCY' },
    data: { suggestedCounterpartyId: null, suggestedReason: null }
  });

  const counterparties = await prisma.counterparty.findMany({
    where: { caseId, matchPattern: { not: null } },
    orderBy: { displayOrder: 'asc' }
  });
  console.log('  ' + counterparties.length + ' Counterparty-Patterns geladen');

  const entries = await prisma.ledgerEntry.findMany({
    where: { caseId, allocationSource: 'PRE_INSOLVENCY' }
  });
  console.log('  ' + entries.length + ' Pre-Insolvency-Entries zu klassifizieren\n');

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

  // ERGEBNIS
  const pct = Math.round(matched / entries.length * 100);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('ERGEBNIS: ' + matched + '/' + entries.length + ' (' + pct + '%) klassifiziert');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Alle Matches kompakt
  const sorted = Object.entries(matchStats).sort((a, b) => b[1] - a[1]);
  console.log('=== MATCHES ===\n');
  for (const [name, count] of sorted) {
    console.log(count.toString().padStart(4) + 'x | ' + name);
  }

  // Unmatched gruppiert
  console.log('\n=== UNMATCHED (' + unmatched + ') ===\n');
  const unmatchedByNote: Record<string, number> = {};
  for (const e of unmatchedEntries) {
    const key = e.note || '(kein Note)';
    unmatchedByNote[key] = (unmatchedByNote[key] || 0) + 1;
  }
  const unmSorted = Object.entries(unmatchedByNote).sort((a, b) => b[1] - a[1]);
  for (const [note, count] of unmSorted.slice(0, 30)) {
    console.log(count.toString().padStart(4) + 'x | ' + note);
  }

  if (unmSorted.length > 30) {
    console.log('  ... und ' + (unmSorted.length - 30) + ' weitere Einzeleinträge');
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error('Fehler:', e); process.exit(1); });
