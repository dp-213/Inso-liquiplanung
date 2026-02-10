# Plan: Liqui-Matrix Verbesserungen

**Datum:** 09. Februar 2026
**Status:** Zur Genehmigung
**Umfang:** Inhaltliche + UI/UX Verbesserungen

---

## 🔍 Analyse: Identifizierte Probleme

### Problem 1: Personalaufwendungen in Okt/Dez 25 - Alt/Neu unklar

**Aktueller Stand:**
- Oktober Personal: 3x ALTMASSE (-5.225 EUR), 2x NEUMASSE (-2.821 EUR)
- Dezember Personal: 11x NEUMASSE (-27.339 EUR)
- **Zuordnung:** AUTO_CALCULATED (Transaktionsdatum-Regel)

**Problem:**
- Gehalt am 01.10.2025 ausgezahlt → ALTMASSE (vor 29.10) ✓ KORREKT
- ABER: Beschreibung sagt "Abrechnung 09/2025" → Gehalt FÜR September
- **Korrekte Logik:** Personalkosten sollten nach **Leistungsmonat** (serviceDate) aufgeteilt werden
- Gehalt für September → 100% ALTMASSE ✓
- Gehalt für Oktober → Nach Tagesgenauigkeit (1-28.10 = Alt, 29-31.10 = Neu)

**Lösung:**
- serviceDate aus Beschreibung extrahieren ("Abrechnung 09/2025" → serviceDate = September)
- Split-Engine mit SERVICE_DATE_RULE anwenden

---

### Problem 2: Sozialabgaben-Stornos verzerren Matrix

**Aktueller Stand:**
- Oktober Sozialabgaben NEUMASSE: +9.312,63 EUR (POSITIV!)
- Das sind Rückbuchungen von fehlerhaften Beiträgen am 29.10, korrigiert am 30.10

**Problem:**
- In Liqui-Matrix erscheinen Sozialabgaben als EINNAHME (positiv) statt Ausgabe
- Verwirrt User: "Warum haben wir Einnahmen aus Sozialabgaben?"

**Lösung:**
- Storno-Erkennung: Positive Beträge bei SOZIALABGABEN = Korrekturen
- Entweder:
  - Option A: Mit negativen Beträgen verrechnen (Netto-Darstellung)
  - Option B: Separate Zeile "Korrekturen Sozialabgaben" (Transparenz)
- **Empfehlung:** Option A (Netto), aber im Detail-Drill-Down sichtbar

---

### Problem 3: Auszahlungen aus Altforderungen fehlen

**Aktueller Stand:**
- Liqui-Matrix zeigt nur "Cashflow aus operativem Geschäft"
- KEINE separate Kategorie für "Auszahlungen aus Altforderungen"

**Insolvenz-Kontext:**
- Altforderungen = Forderungen aus Leistungen VOR Insolvenz
- Zahlungseingang NACH Insolvenz-Eröffnung → Einnahme für Altmasse
- Diese müssen GETRENNT ausgewiesen werden von Neumasse-Einnahmen

**Benötigte Struktur:**
```
EINNAHMEN
├── Einzahlungen Neumasse
│   ├── HZV-Einnahmen (Neumasse-Anteil)
│   ├── KV-Einnahmen (Neumasse-Anteil)
│   └── PVS-Einnahmen (Neumasse-Anteil)
├── Einzahlungen Altmasse (ALTFORDERUNGEN)
│   ├── HZV-Einnahmen (Altmasse-Anteil)
│   ├── KV-Einnahmen (Altmasse-Anteil)
│   └── PVS-Einnahmen (Altmasse-Anteil)
└── Sonstige Einnahmen
```

**Zusätzlich: Standort-Toggle**
- Bei Altforderungen: Nach Standort aufschlüsselbar (Velbert, Uckerath, Eitorf)
- Wichtig für Insolvenzverwalter: Welcher Standort generiert welche Altforderungen?

---

### Problem 4: AUSGABEN ohne Alt/Neu-Split

**Aktueller Stand:**
- Personalaufwendungen: Gemischt Alt/Neu, aber nicht getrennt ausgewiesen
- Betriebskosten: Gemischt Alt/Neu, aber nicht getrennt ausgewiesen

**Insolvenz-Kontext:**
- Ausgaben für ALTMASSE-Leistungen (z.B. Gehalt für September) → Altmasse-Verbindlichkeit
- Ausgaben für NEUMASSE-Leistungen (z.B. Gehalt für November) → Neumasse-Verbindlichkeit

**Benötigte Struktur:**
```
AUSGABEN
├── Auszahlungen Neumasse
│   ├── Personalaufwand (Neumasse)
│   ├── Sozialabgaben (Neumasse)
│   └── Betriebskosten (Neumasse)
├── Auszahlungen Altmasse (ALTVERBINDLICHKEITEN)
│   ├── Personalaufwand (Altmasse)
│   ├── Sozialabgaben (Altmasse)
│   └── Betriebskosten (Altmasse)
└── Insolvenzspezifische Kosten (immer Neumasse)
    ├── Darlehens-Tilgung
    ├── Verfahrenskosten
    └── Steuern
```

---

### Problem 5: UI - Positionen nicht ein-/ausklappbar

**Aktueller Stand:**
- "Zahlungsmittelbestand am Anfang der Periode" zeigt Konten-Details
- ABER: Keine Toggle-Funktion für andere Kategorien

**Gewünschte Funktionalität:**
- Alle Hauptkategorien sollten ein-/ausklappbar sein:
  - "Einzahlungen Neumasse" → Zeigt HZV, KV, PVS
  - "Einzahlungen Altmasse" → Zeigt HZV (Alt), KV (Alt), PVS (Alt)
  - "Personalaufwendungen" → Zeigt Gehälter, Sozialabgaben
  - etc.

**Technisch:**
- Hierarchische Zeilen-Struktur in matrix-config.ts
- `isCollapsible: true` Flag
- State-Management für expanded/collapsed

---

### Problem 6: UI - "Zahlungsmittelbestand Ende" ohne Konten-Details

**Aktueller Stand:**
- "Zahlungsmittelbestand am Anfang" zeigt: ISK Velbert, ISK Uckerath, Sparkasse, apoBank
- "Zahlungsmittelbestand am Ende" zeigt: NUR Gesamtsumme, KEINE Konten

**Problem:**
- User will sehen: Wie viel liegt auf welchem Konto am Periodenende?
- Wichtig für Liquiditätsplanung: Massekredit-Konto vs. operative Konten

**Lösung:**
- Gleiche Konten-Aufschlüsselung wie bei "Anfang der Periode"
- Berechnung: Anfangsbestand + Cashflow = Endbestand (pro Konto)

---

## 📋 Lösungsplan

### Phase 1: Daten-Bereinigung (INHALTLICH)

#### 1.1 Service-Date-Extraktion für Personal
```typescript
// Beispiel-Beschreibungen:
// "Steinmetzler Tatjana Alice Lohn - Gehalt Abrechnung 09/2025"
// → serviceDate = 2025-09-01

const PERSONAL_SERVICE_DATE_PATTERN = /Abrechnung\s+(\d{2})\/(\d{4})/;

function extractServiceDateFromPersonal(description: string): Date | null {
  const match = description.match(PERSONAL_SERVICE_DATE_PATTERN);
  if (match) {
    const month = parseInt(match[1]);
    const year = parseInt(match[2]);
    return new Date(year, month - 1, 1); // Erster Tag des Monats
  }
  return null;
}
```

**SQL-Update für betroffene Entries:**
- Nur PERSONAL-Entries mit "Abrechnung XX/YYYY" in Beschreibung
- serviceDate setzen, dann Split-Engine neu durchlaufen

#### 1.2 Sozialabgaben Service-Date
- Sozialabgaben haben meist "BEITRAG MMYY" in Beschreibung
- Beispiel: "BEITRAG 1025" → serviceDate = 2025-10-01
- Gleiche Logik wie Personal

#### 1.3 Split-Engine für Personal/Sozialabgaben
- Nach serviceDate statt transactionDate splitten
- Gehalt für September → 100% ALTMASSE
- Gehalt für Oktober → Tagesgenau (1-28.10 = Alt, 29-31.10 = Neu)

---

### Phase 2: Matrix-Konfiguration (STRUKTUR)

#### 2.1 Neue Hauptkategorien definieren

```typescript
// Neue Blocks
export const MATRIX_BLOCKS = {
  // Bestehend
  CASH_IN: 'CASH_IN',
  CASH_OUT_OPERATIVE: 'CASH_OUT_OPERATIVE',
  CASH_OUT_INSOLVENCY: 'CASH_OUT_INSOLVENCY',

  // NEU
  CASH_IN_NEUMASSE: 'CASH_IN_NEUMASSE',           // Einzahlungen Neumasse
  CASH_IN_ALTMASSE: 'CASH_IN_ALTMASSE',           // Einzahlungen Altmasse (Altforderungen)
  CASH_OUT_NEUMASSE: 'CASH_OUT_NEUMASSE',         // Auszahlungen Neumasse
  CASH_OUT_ALTMASSE: 'CASH_OUT_ALTMASSE',         // Auszahlungen Altmasse (Altverbindlichkeiten)
};
```

#### 2.2 Zeilen-Hierarchie mit Collapsible

```typescript
interface MatrixRowConfig {
  id: string;
  label: string;
  block: string;
  order: number;

  // Hierarchie
  isSubRow: boolean;
  isSummary: boolean;
  isCollapsible: boolean;       // NEU: Kann ein-/ausgeklappt werden
  parentId?: string;            // NEU: Eltern-Zeile (für Hierarchie)
  level: number;                // NEU: 0=Hauptkategorie, 1=Unterkategorie, 2=Detail

  // Matching
  matches: MatchRule[];

  // Visibility
  visibleInScopes: string[];
  defaultCollapsed?: boolean;   // NEU: Standard eingeklappt?
}
```

**Beispiel:**
```typescript
{
  id: 'cash_in_neumasse',
  label: 'Einzahlungen Neumasse',
  block: 'CASH_IN_NEUMASSE',
  level: 0,
  isCollapsible: true,
  defaultCollapsed: false,
  children: ['cash_in_neumasse_hzv', 'cash_in_neumasse_kv', 'cash_in_neumasse_pvs']
},
{
  id: 'cash_in_neumasse_hzv',
  label: 'HZV-Einnahmen (Neumasse)',
  parentId: 'cash_in_neumasse',
  level: 1,
  matches: [
    { type: 'CATEGORY_TAG', value: 'HZV' },
    { type: 'ESTATE_ALLOCATION', value: 'NEUMASSE' }
  ]
}
```

#### 2.3 Standort-Toggle für Altforderungen

```typescript
{
  id: 'cash_in_altmasse_hzv',
  label: 'HZV-Einnahmen (Altmasse)',
  parentId: 'cash_in_altmasse',
  level: 1,
  isCollapsible: true,
  locationSplittable: true,      // NEU: Nach Standort aufteilbar
  children: ['cash_in_altmasse_hzv_velbert', 'cash_in_altmasse_hzv_uckerath', 'cash_in_altmasse_hzv_eitorf']
}
```

---

### Phase 3: UI-Komponente (UX)

#### 3.1 Collapsible Rows

**Komponente:** `LiquidityMatrixTable.tsx`

**State:**
```typescript
const [collapsedRows, setCollapsedRows] = useState<Set<string>>(new Set());

function toggleRow(rowId: string) {
  setCollapsedRows(prev => {
    const next = new Set(prev);
    if (next.has(rowId)) {
      next.delete(rowId);
    } else {
      next.add(rowId);
    }
    return next;
  });
}
```

**Render:**
```tsx
{row.isCollapsible && (
  <button
    onClick={() => toggleRow(row.id)}
    className="mr-2"
  >
    {collapsedRows.has(row.id) ? '▶' : '▼'}
  </button>
)}
```

**Zeilen-Filterung:**
```typescript
const visibleRows = allRows.filter(row => {
  if (!row.parentId) return true; // Hauptzeilen immer sichtbar
  return !collapsedRows.has(row.parentId); // Unterzeilen nur wenn Eltern nicht collapsed
});
```

#### 3.2 Zahlungsmittelbestand Ende - Konten-Details

**Aktuell:**
```typescript
{
  id: 'cash_end',
  label: 'Zahlungsmittelbestand am Ende der Periode',
  calculation: 'BALANCE_END',  // Nur Gesamtsumme
}
```

**NEU:**
```typescript
{
  id: 'cash_end',
  label: 'Zahlungsmittelbestand am Ende der Periode',
  calculation: 'BALANCE_END',
  isCollapsible: true,
  children: [
    'cash_end_isk_velbert',
    'cash_end_isk_uckerath',
    'cash_end_sparkasse',
    'cash_end_apobank'
  ]
},
{
  id: 'cash_end_isk_velbert',
  label: 'ISK Velbert (BW-Bank)',
  parentId: 'cash_end',
  level: 1,
  matches: [{ type: 'BANK_ACCOUNT', value: 'isk-velbert' }],
  calculation: 'BALANCE_END_BY_ACCOUNT'
}
```

**Berechnung:**
```typescript
function calculateEndBalanceByAccount(accountId: string, periodIndex: number): number {
  const startBalance = getStartBalanceForAccount(accountId, periodIndex);
  const periodCashflow = getCashflowForAccount(accountId, periodIndex);
  return startBalance + periodCashflow;
}
```

---

## 🎯 Umsetzungs-Reihenfolge

### Schritt 1: Daten-Bereinigung (PRIO 1)
1. ✅ Service-Date-Extraktion Script schreiben
2. ✅ PERSONAL + SOZIALABGABEN Service-Dates setzen
3. ✅ Split-Engine neu durchlaufen lassen
4. ✅ Lokal + Turso synchronisieren
5. ✅ Verifikation: Personal Okt korrekt aufgeteilt?

### Schritt 2: Matrix-Config erweitern (PRIO 2)
1. ✅ Neue Blocks definieren (CASH_IN_NEUMASSE, CASH_IN_ALTMASSE, etc.)
2. ✅ Zeilen-Hierarchie mit level + parentId
3. ✅ isCollapsible + locationSplittable Flags
4. ✅ Alle Zeilen neu strukturieren (Alt/Neu-Split)

### Schritt 3: UI-Komponente anpassen (PRIO 3)
1. ✅ Collapsible Rows State + Toggle-Funktion
2. ✅ Hierarchische Zeilen-Filterung
3. ✅ Zahlungsmittelbestand Ende mit Konten-Details
4. ✅ Standort-Toggle für Altforderungen
5. ✅ Responsive Design (Mobile-Ansicht)

### Schritt 4: Testing & Deployment (PRIO 4)
1. ✅ Manuelle Tests: Alle Collapse/Expand-Funktionen
2. ✅ Zahlen-Verifikation: Summen korrekt?
3. ✅ Build-Test
4. ✅ Production Deployment
5. ✅ User-Test mit Insolvenzverwalter

---

## 📊 Erwartete Ergebnisse

### Vorher:
```
EINNAHMEN
├── HZV: 460.191,88 EUR (gemischt Alt/Neu)
├── KV: 157.112,38 EUR (gemischt Alt/Neu)
└── PVS: 51.025,14 EUR (gemischt Alt/Neu)

AUSGABEN
├── Personalaufwand: -187.410,24 EUR (gemischt Alt/Neu)
└── Sozialabgaben: -4.605,74 EUR (gemischt Alt/Neu)
```

### Nachher:
```
▼ EINZAHLUNGEN NEUMASSE
  ├── HZV (Neumasse): XXX EUR
  ├── KV (Neumasse): XXX EUR
  └── PVS (Neumasse): XXX EUR

▼ EINZAHLUNGEN ALTMASSE (Altforderungen)
  ▶ HZV (Altmasse): XXX EUR
    ├── Standort Velbert: XXX EUR
    ├── Standort Uckerath: XXX EUR
    └── Standort Eitorf: XXX EUR
  ├── KV (Altmasse): XXX EUR
  └── PVS (Altmasse): XXX EUR

▼ AUSZAHLUNGEN NEUMASSE
  ├── Personalaufwand (Neumasse): XXX EUR
  ├── Sozialabgaben (Neumasse): XXX EUR
  └── Betriebskosten (Neumasse): XXX EUR

▼ AUSZAHLUNGEN ALTMASSE (Altverbindlichkeiten)
  ├── Personalaufwand (Altmasse): XXX EUR
  ├── Sozialabgaben (Altmasse): XXX EUR
  └── Betriebskosten (Altmasse): XXX EUR

▼ ZAHLUNGSMITTELBESTAND AM ENDE DER PERIODE
  ├── ISK Velbert: XXX EUR
  ├── ISK Uckerath: XXX EUR
  ├── Sparkasse HRV: XXX EUR
  └── apoBank: XXX EUR
```

---

## ⚠️ Risiken & Offene Fragen

### Risiken:
1. **Service-Date-Extraktion fehlerhaft** → Stichproben-Prüfung erforderlich
2. **Split-Engine-Änderungen ändern alle Zahlen** → Vollständige Verifikation nötig
3. **UI-Komplexität** → Kann verwirrend werden, wenn zu tief verschachtelt

### Offene Fragen:
1. **Sozialabgaben-Stornos:** Netto-Darstellung oder separate Zeile?
2. **Standort-Toggle:** Nur für Altforderungen oder auch für Neumasse?
3. **Default Collapsed:** Welche Kategorien sollen standardmäßig eingeklappt sein?
4. **Mobile-Ansicht:** Hierarchie auf kleinen Bildschirmen?

---

## ✅ Freigabe erforderlich

Bitte vor Umsetzung prüfen:
- [ ] Struktur EINZAHLUNGEN NEUMASSE / ALTMASSE OK?
- [ ] Struktur AUSZAHLUNGEN NEUMASSE / ALTMASSE OK?
- [ ] Standort-Toggle nur für Altforderungen oder auch Neumasse?
- [ ] Service-Date-Extraktion für Personal/Sozialabgaben durchführen?
- [ ] Zahlungsmittelbestand Ende mit Konten-Details OK?
