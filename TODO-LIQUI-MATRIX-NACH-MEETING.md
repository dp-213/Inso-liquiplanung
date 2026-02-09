# TODO: Liqui-Matrix - Nach IV-Meeting

**Erstellt:** 09. Februar 2026
**Status:** Für nach Meeting mit IV
**Priorität:** Mittel-Hoch

---

## ⏳ Offene Aufgaben (NACH Meeting)

### 1. Service-Date-Extraktion für Personal/Sozialabgaben

**Problem:**
- Gehalt für September (ausgezahlt 01.10) ist aktuell ALTMASSE (korrekt nach Transaktionsdatum)
- ABER: Sollte explizit serviceDate = September haben für Nachvollziehbarkeit

**Aufgabe:**
- Pattern-Matching: "Abrechnung 09/2025" → serviceDate = 2025-09-01
- Pattern-Matching: "BEITRAG 1025" → serviceDate = 2025-10-01
- Split-Engine mit SERVICE_DATE_RULE statt AUTO_CALCULATED
- Lokal + Turso aktualisieren

**Aufwand:** 1-2 Stunden (inkl. Verifikation)

**Script:**
```typescript
// /app/scripts/extract-service-dates-personal.ts
const PERSONAL_PATTERN = /Abrechnung\s+(\d{2})\/(\d{4})/;
const SOZIALABGABEN_PATTERN = /BEITRAG\s+(\d{2})(\d{2})/;
```

---

### 2. Alt/Neu-Split in Matrix-Struktur

**Problem:**
- Einnahmen/Ausgaben sind gemischt Alt/Neu
- IV braucht klare Trennung für Insolvenz-Reporting

**Aufgabe:**
- Neue Blocks: CASH_IN_NEUMASSE, CASH_IN_ALTMASSE, CASH_OUT_NEUMASSE, CASH_OUT_ALTMASSE
- Matrix-Config umstrukturieren:
  ```
  ▼ EINZAHLUNGEN NEUMASSE
    ├── HZV (Neumasse)
    ├── KV (Neumasse)
    └── PVS (Neumasse)

  ▼ EINZAHLUNGEN ALTMASSE (Altforderungen)
    ├── HZV (Altmasse)
    ├── KV (Altmasse)
    └── PVS (Altmasse)

  ▼ AUSZAHLUNGEN NEUMASSE
    ├── Personalaufwand (Neumasse)
    ├── Sozialabgaben (Neumasse)
    └── Betriebskosten (Neumasse)

  ▼ AUSZAHLUNGEN ALTMASSE (Altverbindlichkeiten)
    ├── Personalaufwand (Altmasse)
    ├── Sozialabgaben (Altmasse)
    └── Betriebskosten (Altmasse)
  ```

**Aufwand:** 3-4 Stunden (große Änderung)

**Dateien:**
- `/app/src/lib/cases/haevg-plus/matrix-config.ts` (komplette Umstrukturierung)
- `/app/src/components/dashboard/LiquidityMatrixTable.tsx` (Rendering-Logik)

---

### 3. Standort-Toggle für Altforderungen

**Problem:**
- IV will sehen: Welcher Standort (Velbert, Uckerath, Eitorf) generiert welche Altforderungen?

**Aufgabe:**
- Bei "Einzahlungen Altmasse" → Collapsible nach Standort
- Beispiel:
  ```
  ▼ HZV-Einnahmen (Altmasse)
    ├── Standort Velbert: XXX EUR
    ├── Standort Uckerath: XXX EUR
    └── Standort Eitorf: XXX EUR
  ```

**Aufwand:** 2 Stunden

**Technisch:**
- `locationSplittable: true` Flag in matrix-config
- Filter nach `locationId` bei Aggregation
- UI: Zusätzliche Hierarchie-Ebene

---

### 4. Sozialabgaben-Stornos behandeln

**Problem:**
- Oktober SOZIALABGABEN NEUMASSE: +9.312,63 EUR (positiv = Rückbuchungen)
- Erscheint als Einnahme statt Ausgabe

**Optionen:**
- **A:** Netto-Darstellung (Stornos von Ausgaben abziehen)
- **B:** Separate Zeile "Korrekturen Sozialabgaben"

**Entscheidung:** Noch offen (nach IV-Feedback)

**Aufwand:** 1 Stunde (je nach Option)

---

### 5. Hierarchie-Ebenen für alle Kategorien

**Problem:**
- Nur Zahlungsmittelbestand ist aktuell collapsible
- Alle Hauptkategorien sollten ein-/ausklappbar sein

**Aufgabe:**
- Alle Kategorien mit Unterkategorien collapsible machen:
  - Personalaufwendungen → Gehälter, Sozialabgaben
  - Betriebskosten → Miete, Strom, Kommunikation, etc.
  - Einnahmen → HZV, KV, PVS, Sonstige

**Aufwand:** 2 Stunden

**Technisch:**
- Erweitere collapsible-Logik auf alle Zeilen
- `level`, `parentId`, `isCollapsible` Felder für alle Rows

---

## 📊 Prioritäten-Reihenfolge (Empfehlung)

1. **PRIO 1:** Alt/Neu-Split in Matrix (kritisch für Insolvenz-Reporting)
2. **PRIO 2:** Service-Date-Extraktion (Datenqualität)
3. **PRIO 3:** Standort-Toggle (Detail-Analyse)
4. **PRIO 4:** Sozialabgaben-Stornos (falls IV-Feedback negativ)
5. **PRIO 5:** Vollständige Hierarchie (Nice-to-have)

---

## 🎯 Nach IV-Meeting zu klären

- [ ] Alt/Neu-Split: Ist die Struktur so OK?
- [ ] Standort-Details: Braucht IV das wirklich?
- [ ] Sozialabgaben-Stornos: Netto oder separate Zeile?
- [ ] Default Collapsed: Welche Kategorien sollen eingeklappt sein?
- [ ] Weitere Anforderungen vom IV?

---

## 📝 Notizen

- Detaillierter Plan: `/PLAN-LIQUI-MATRIX-VERBESSERUNGEN.md`
- Alle Scripts/Code-Snippets sind im Plan dokumentiert
- Vor Umsetzung: Backup der Datenbank erstellen!
