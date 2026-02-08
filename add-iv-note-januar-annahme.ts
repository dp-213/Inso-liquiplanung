/**
 * IV-Notiz: Januar-HZV-Gutschriften Klassifikations-Annahme
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

const note = `## Januar-HZV-Gutschriften: Klassifikations-Annahme

**DATUM:** 08.02.2026
**STATUS:** Umgesetzt (mit Annahme, Verifikation ausstehend)

---

### SACHVERHALT

Bei der Service-Period-Extraktion für HZV-Einnahmen wurden **58 Gutschriften im Januar 2026** identifiziert, die **KEINE Quartalsangabe** in der Beschreibung haben.

**Beispiele:**
- \`GUTSCHRIFT ÜBERWEISUNG HAEVGID 132025 LANR 1445587 AOK NO HZV ABS\`
- \`GUTSCHRIFT ÜBERWEISUNG HAEVGID 067026 LANR 8836735 TK HZV ABS\`

**Summe:** 63.112,50 EUR (signifikant!)

---

### ZAHLUNGSLOGIK-ANALYSE

Durch systematische Analyse der vorhandenen HZV-Daten wurde folgendes Muster erkannt:

| Zahlungsmonat | Leistungsquartal | Typ | Anzahl Entries |
|---------------|------------------|-----|----------------|
| Oktober 2025 | Q3/2025 | REST (Nachzahlung) | Alle KKs |
| November 2025 | Q4/2025 | ABS (Abschlag) | 57 Entries |
| November 2025 | Q3/2025 | REST (Nachzahlung) | Teilweise |
| Dezember 2025 | Q4/2025 + Q3/2025 | Mix | Verschiedene |
| **Januar 2026** | **OHNE Angabe** | **ABS (Abschlag)** | **58 Entries** |

---

### ANNAHME (mit Begründung)

**ANNAHME:** Januar-Gutschriften sind **Q4/2025-Abschläge** (Fortsetzung der November-Abschläge)

**BEGRÜNDUNG:**

1. **Anzahl identisch:** November Q4/25 ABS = 57 Entries, Januar ohne Quarter = 58 Entries
2. **Alle markiert als "HZV ABS"** (Abschlag, nicht Nachzahlung)
3. **Krankenkassen identisch:** AOK NO, TK, EK NO, BKK NO, SPECTRUMK, etc.
4. **Zeitliche Kontinuität:** November → Dezember → Januar = laufende Q4-Abschläge
5. **Kein Q1-Indikator:** Für Q1/2026 würde man "Q1/26" erwarten (wie bei Q3, Q4)

**ALTERNATIVE HYPOTHESE (verworfen):**
Januar-Gutschriften sind Q1/2026-Abschläge → UNWAHRSCHEINLICH, da:
- Q1/2026 wäre ungewöhnlich früh (14.01. für Q1-Leistungen)
- Alle bisherigen Abschläge hatten Quartalsangabe (Q3/25, Q4/25)
- Muster würde brechen

---

### UMSETZUNG

**Service-Period gesetzt auf:**
- \`servicePeriodStart\`: 2025-10-01
- \`servicePeriodEnd\`: 2025-12-31
- \`allocationSource\`: "SERVICE_PERIOD_EXTRACTION_PAYMENT_LOGIC"
- \`allocationNote\`: "Januar 2026 HZV ABS ohne Quartalsangabe → Q4/2025 abgeleitet aus Zahlungslogik-Analyse"

**Alt/Neu-Masse-Aufteilung:**
- Q4/2025 → **1/3 ALTMASSE, 2/3 NEUMASSE**
- \`estateRatio = 0.6667\`

---

### VERIFIKATION ERFORDERLICH

**MIT HANNES KLÄREN (09.02.2026):**
- [ ] Sind Januar-Gutschriften tatsächlich Q4/2025-Abschläge?
- [ ] Oder doch Q1/2026-Abschläge?
- [ ] Gibt es eine Systematik, warum die Quartalsangabe fehlt?

**FALLS FALSCH:** Service-Period manuell korrigieren + Split-Engine neu laufen lassen

---

**QUELLE:** Zahlungslogik-Analyse vom 08.02.2026
**SCRIPT:** \`analyze-hzv-payment-logic.ts\`
**BETROFFENE ENTRIES:** 58 von 295 HZV-Einnahmen (19.7%)`;

async function addNote() {
  console.log('=== IV-NOTIZ: Januar-HZV-Annahme hinzufügen ===\n');

  const ivNote = await prisma.iVNote.create({
    data: {
      id: randomUUID(),
      caseId,
      content: note,
      status: 'WARTET',
      priority: 'HOCH',
      author: 'System (Claude)',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  console.log('✅ IV-Notiz erfolgreich erstellt!\n');
  console.log(`   Note ID: ${ivNote.id}`);
  console.log(`   Priorität: HOCH 🟠`);
  console.log(`   Status: WARTET (auf Hannes-Feedback)\n`);

  await prisma.$disconnect();
}

addNote().catch(console.error);
