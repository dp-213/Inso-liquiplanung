/**
 * Fügt IV-Frage zur Alt/Neu-Regel direkt in DB hinzu
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

const question = `## Alt/Neu-Masse-Zuordnung: HZV-Regel klären

**STATUS:** ⚠️ WIDERSPRÜCHLICHE INFORMATIONEN

**HINTERGRUND:**
Laut Massekreditvertrag gibt es unterschiedliche Regelungen für die Alt/Neu-Masse-Aufteilung:

**a) KV-Einnahmen Q4/2025:**
- Massekreditvertrag §1(2)a: **1/3 ALTMASSE, 2/3 NEUMASSE**

**b) HZV-Einnahmen Oktober:**
- Massekreditvertrag §1(2)b: **28/31 ALTMASSE, 3/31 NEUMASSE**
- Begründung: Tagesgenaue Aufteilung (1.-28. Oktober = Alt, 29.-31. Oktober = Neu)

**🔴 KRITISCHE FRAGE:**
**Gilt die 1/3-2/3-Regel NUR für KV oder auch für HZV?**

**MÖGLICHE SZENARIEN:**
- **A:** KV = 1/3-2/3, HZV = 28/31-3/31 (wie aktuell dokumentiert)
- **B:** BEIDE (KV + HZV) = 1/3-2/3 (pauschale Regel für Q4/2025)

**AUSWIRKUNG:**
- Wir haben aktuell 292 HZV-Einträge in den IST-Daten
- Unterschiedliche Regeln führen zu unterschiedlichen Alt/Neu-Verteilungen
- Dies beeinflusst die Masse-Bilanz und damit die Planungssicherheit

**BENÖTIGT:**
- [ ] Klärung mit Hannes Rieger: Welche Regel gilt für HZV?
- [ ] Original Massekreditvertrag §1(2)b prüfen (exakte Formulierung)
- [ ] Falls tagesgenau: Gilt 28/31-3/31 nur für Oktober oder auch für gesamtes Q4?
- [ ] Falls pauschal: Gilt 1/3-2/3 für alle Einnahmen (KV + HZV + PVS)?

**TEMPORÄRE ANNAHME:**
Bis zur Klärung verwenden wir **Szenario B: 1/3-2/3 für alle Q4-Einnahmen** (einfacher und konsistenter).

**TERMIN:** Mit Hannes besprechen (09.02.2026)

**QUELLE:** Analyse der HZV-Klassifikation vom 08.02.2026`;

async function addIVQuestion() {
  console.log('=== IV-FRAGE ZUR ALT/NEU-REGEL HINZUFÜGEN ===\n');

  const note = await prisma.iVNote.create({
    data: {
      id: randomUUID(),
      caseId,
      content: question,
      status: 'OFFEN',
      priority: 'KRITISCH',
      author: 'System (Claude)',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  console.log('✅ IV-Frage erfolgreich in Datenbank hinzugefügt!\n');
  console.log(`   Note ID: ${note.id}`);
  console.log(`   Priorität: ${note.priority}`);
  console.log(`   Status: ${note.status}`);
  console.log(`   Erstellt: ${note.createdAt.toLocaleString('de-DE')}`);
  console.log(`\n📋 Siehe Admin-Seite: /admin/cases/${caseId}/iv-kommunikation\n`);

  await prisma.$disconnect();
}

addIVQuestion().catch((error) => {
  console.error('❌ Fehler beim Hinzufügen der IV-Frage:');
  console.error(error);
  process.exit(1);
});
