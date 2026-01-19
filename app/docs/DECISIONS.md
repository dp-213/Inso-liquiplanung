# Architektur-Entscheidungen

Dieses Dokument dokumentiert wichtige Architektur- und Design-Entscheidungen.

---

## ADR-001: LedgerEntry als Single Source of Truth

**Datum:** 18. Januar 2026
**Status:** Akzeptiert

### Kontext

Ursprünglich hatte das System eine hierarchische Struktur: LiquidityPlan → Categories → Lines → WeeklyValues. Diese Struktur war für manuelle Planungseingabe gedacht, passte aber nicht zum Hauptanwendungsfall: Import von Bankdaten und nachträgliche Klassifikation.

### Entscheidung

LedgerEntry ist die einzige Quelle der Wahrheit für alle Buchungen. Jeder Zahlungsein-/ausgang ist genau ein LedgerEntry mit allen relevanten Attributen direkt am Entry.

### Begründung

- **Flexibilität:** Entries können vor, während und nach der Klassifikation existieren
- **Audit-Trail:** Jeder Entry hat eigene Governance-Felder (reviewStatus, reviewedBy, etc.)
- **Import-first:** Passt zum Workflow "Import → Review → Classify"
- **Lineage:** Jeder Entry trägt seine Herkunft (importSource, importRowNumber)

### Konsequenzen

- Kategorien/Zeilen existieren nur noch für Präsentation (gruppierte Ansicht)
- Aggregationen werden on-demand berechnet
- Alte Modelle (WeeklyValue, CashflowLine) werden nicht mehr für neue Daten verwendet

---

## ADR-002: Vorschläge statt Auto-Commit

**Datum:** 18. Januar 2026
**Status:** Akzeptiert

### Kontext

Die Rule Engine könnte theoretisch automatisch Klassifikationen vornehmen. Bei IST-Werten (echten Bankbuchungen) ist dies jedoch rechtlich problematisch.

### Entscheidung

Die Rule Engine erstellt nur Vorschläge (`suggested*`-Felder). User muss explizit bestätigen oder anpassen.

### Begründung

- **Auditierbarkeit:** Jede Klassifikation ist nachvollziehbar von einem User bestätigt
- **Haftung:** User trägt Verantwortung für finale Klassifikation
- **Transparenz:** Klare Trennung zwischen "Vorschlag des Systems" und "Entscheidung des Users"

### Konsequenzen

- Zwei Feld-Sets: `suggested*` (Vorschläge) und finale Felder (bestätigt)
- Review-Workflow erforderlich für alle importierten Daten
- Bulk-Review-Funktionen nötig für Effizienz

---

## ADR-003: Dimensions-Architektur

**Datum:** 19. Januar 2026
**Status:** Akzeptiert

### Kontext

Buchungen müssen nach verschiedenen Dimensionen auswertbar sein: Bankkonto, Gegenpartei, Standort. Diese Dimensionen können durch Regeln vorgeschlagen oder manuell zugewiesen werden.

### Entscheidung

Dimensionen existieren als Stammdaten (BankAccount, Counterparty, Location) und werden per ID am LedgerEntry referenziert. Sowohl finale Werte als auch Vorschläge werden gespeichert.

```
LedgerEntry:
  bankAccountId          # Finale Zuweisung
  suggestedBankAccountId # Vorschlag von Rule Engine
```

### Begründung

- **Normalisierung:** Stammdaten werden zentral gepflegt
- **Flexibilität:** Regeln können Dimensionen vorschlagen
- **Transparenz:** User sieht Vorschlag und kann übernehmen oder ändern

### Konsequenzen

- Stammdaten-Verwaltung erforderlich
- Rules können `assign*`-Felder setzen
- UI muss Vorschläge visualisieren und Übernahme ermöglichen

---

## ADR-004: Counterparty Auto-Detection

**Datum:** 19. Januar 2026
**Status:** Akzeptiert

### Kontext

Gegenparteien (Lieferanten, Kunden) erscheinen oft mit erkennbaren Mustern in Buchungsbeschreibungen (z.B. "REWE", "Vodafone").

### Entscheidung

Counterparty-Entitäten haben ein optionales `matchPattern` (Regex). Nach jedem Import wird `matchCounterpartyPatterns()` ausgeführt, das Beschreibungen gegen Patterns matcht und `suggestedCounterpartyId` setzt.

### Begründung

- **Automatisierung:** Häufige Gegenparteien werden automatisch erkannt
- **Nur Vorschläge:** Kein Auto-Commit, User muss bestätigen
- **Einfach:** Regex ist verständlich und auditierbar

### Konsequenzen

- `matchPattern`-Feld an Counterparty
- `matchCounterpartyPatterns()`-Funktion in Classification Engine
- Wird nach `classifyBatch()` aufgerufen

---

## ADR-005: Turso als Produktionsdatenbank

**Datum:** 17. Januar 2026
**Status:** Akzeptiert

### Kontext

Für lokale Entwicklung wird SQLite verwendet. Für Production brauchen wir eine skalierbare, Edge-kompatible Datenbank.

### Entscheidung

Turso (libSQL) für Production, SQLite für lokale Entwicklung. Prisma-Schema bleibt `provider = "sqlite"`, Runtime-Adapter wechselt basierend auf URL.

### Begründung

- **Kompatibilität:** libSQL ist SQLite-kompatibel
- **Edge:** Turso funktioniert auf Vercel Edge
- **Einfachheit:** Gleicher SQL-Dialekt lokal und in Production

### Konsequenzen

- Schema-Änderungen müssen manuell per SQL auf Turso angewendet werden (ALTER TABLE)
- `prisma db push` funktioniert nicht mit Turso-URL
- db.ts enthält Adapter-Logik für beide Modi

---

## ADR-006: Deutsche Sprache durchgängig

**Datum:** 15. Januar 2026
**Status:** Akzeptiert

### Kontext

Die Anwendung wird von deutschen Insolvenzverwaltern genutzt. Alle rechtlichen Begriffe sind deutsch.

### Entscheidung

Alle UI-Texte, Fehlermeldungen, Dokumentation und API-Responses sind auf Deutsch. Code (Variablen, Funktionen) bleibt englisch.

### Begründung

- **Zielgruppe:** Deutsche Insolvenzverwalter
- **Rechtliche Begriffe:** "Masse", "Absonderung" haben keine guten Übersetzungen
- **Professionalität:** Konsistente Sprache

### Konsequenzen

- Alle Labels, Buttons, Meldungen auf Deutsch
- Echte Umlaute (ä, ö, ü), keine Ersatzschreibweisen
- Code-Kommentare können deutsch oder englisch sein

---

## ADR-007: Keine KI in Berechnungen

**Datum:** 15. Januar 2026
**Status:** Akzeptiert

### Kontext

KI-Modelle könnten theoretisch Cashflows vorhersagen oder automatisch klassifizieren.

### Entscheidung

Keine KI, ML oder Heuristiken in der Berechnungs- oder Klassifikationslogik. Rule Engine nutzt nur explizite, konfigurierte Regeln.

### Begründung

- **Determinismus:** Gleiche Eingaben = Gleiche Ausgaben (gerichtsfest)
- **Auditierbarkeit:** Jede Klassifikation ist auf eine konkrete Regel zurückführbar
- **Haftung:** Keine "Black Box"-Entscheidungen

### Konsequenzen

- Rule Engine nur mit CONTAINS, STARTS_WITH, REGEX etc.
- Keine "intelligenten" Vorschläge
- AI-Preprocessing nur für Datenaufbereitung (OCR, Parsing), nicht für Entscheidungen

---

## Template für neue Entscheidungen

```markdown
## ADR-XXX: [Titel]

**Datum:** [Datum]
**Status:** Vorgeschlagen | Akzeptiert | Abgelehnt | Ersetzt durch ADR-YYY

### Kontext

[Warum ist diese Entscheidung nötig?]

### Entscheidung

[Was wurde entschieden?]

### Begründung

[Warum diese Option und nicht die Alternativen?]

### Konsequenzen

[Was folgt aus dieser Entscheidung?]
```
