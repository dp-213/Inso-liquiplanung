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

## ADR-008: InsolvencyEffects → LedgerEntry Transfer

**Datum:** 19. Januar 2026
**Status:** Akzeptiert

### Kontext

InsolvencyEffects waren ursprünglich als separate PLAN-Werte konzipiert, die nur zur Anzeige dienten ("vor/nach Insolvenzeffekten"). In der Praxis sind Insolvenzeffekte jedoch **echte zahlungswirksame Ereignisse**:

- Verfahrenskosten
- Masseverbindlichkeiten
- Halteprämien
- Anfechtungsrückflüsse
- Kündigungen/Mietreduktionen

Diese MÜSSEN in die operative Liquiditätsplanung einfließen können.

### Entscheidung

InsolvencyEffects können idempotent in PLAN-LedgerEntries überführt werden:

1. **Lineage via `sourceEffectId`**: Jeder abgeleitete LedgerEntry referenziert seinen Ursprungs-Effekt
2. **Idempotente Überführung**: Bei erneuter Ausführung werden bestehende Entries gelöscht und neu erstellt (DELETE + CREATE)
3. **Kein Duplikat-Risiko**: Harte Ersetzung statt weicher Update-Logik

```
InsolvencyEffect (Erfassung)
        │
        └── [In Planung überführen] → Erzeugt PLAN-LedgerEntries
                                      mit sourceEffectId (Lineage)

Effekt-Änderung → Deterministisches Update der abgeleiteten Entries
```

### Sonderfall: Unechte Massekredite

`isAvailabilityOnly = true` markiert Effekte, die **nicht automatisch transferiert** werden:
- Primär: Verfügbarkeits-Overlay (zeigt potenzielle Mittel)
- Nur bei tatsächlicher Auszahlung/Valutierung → manueller PLAN-Entry

### Begründung

- **Operative Integration**: Insolvenzeffekte sind echte Zahlungswirkungen, keine Szenarien
- **Auditierbarkeit**: Lineage über `sourceEffectId` macht Herkunft nachvollziehbar
- **Determinismus**: Idempotente Überführung verhindert Duplikate
- **Flexibilität**: User entscheidet, welche Effekte in die Planung fließen

### Konsequenzen

- Neue Felder: `LedgerEntry.sourceEffectId`, `InsolvencyEffect.isAvailabilityOnly`
- Neue Transfer-Engine: `src/lib/effects/transfer-engine.ts`
- Neue API: `POST /api/cases/[id]/effects/transfer`
- UI: Checkboxes + "In Planung überführen"-Button

---

## ADR-009: Case-spezifische Konfiguration

**Datum:** 20. Januar 2026
**Status:** Akzeptiert

### Kontext

Verschiedene Insolvenzfälle haben unterschiedliche Abrechnungsstellen (KV, HZV, PVS), Banken und Vertragsregeln für Alt/Neu-Splitting. Diese Regeln sind case-spezifisch und können nicht generisch abgebildet werden.

### Entscheidung

Case-spezifische Konfigurationen werden in `/lib/cases/[case-name]/config.ts` abgelegt:

```
/lib/cases/
├── haevg-plus/
│   ├── config.ts    # Abrechnungsstellen, Banken, Split-Regeln
│   └── index.ts     # Exports
└── [weitere-cases]/
```

### Begründung

- **Modellgetrieben:** Jeder Case hat seine eigene "Wahrheit"
- **Typsicherheit:** TypeScript-Konfiguration statt JSON/YAML
- **Versionierbar:** Änderungen sind im Git-History nachvollziehbar
- **Testbar:** Sanity-Checks pro Case möglich

### Konsequenzen

- Für jeden neuen Case wird ein Verzeichnis angelegt
- Änderungen an Vertragsregeln erfordern Code-Deployment
- Keine Runtime-Konfiguration durch User (bewusst)

---

## ADR-010: Alt/Neu-Splitting mit Fallback-Kette

**Datum:** 20. Januar 2026
**Status:** Akzeptiert

### Kontext

Buchungen müssen für Revision nachvollziehbar der Alt- oder Neumasse zugeordnet werden. Die Herkunft der Zuordnung (Revisionssprache) muss dokumentiert sein.

### Entscheidung

Die Split-Engine verwendet eine deterministische Fallback-Kette:

1. **VERTRAGSREGEL** – Explizite Vertragsregel (z.B. KV Q4: 1/3-2/3)
2. **SERVICE_DATE_RULE** – serviceDate vorhanden → binär vor/nach Stichtag
3. **PERIOD_PRORATA** – servicePeriod vorhanden → zeitanteilige Aufteilung
4. **VORMONAT_LOGIK** – HZV-spezifisch: Zahlung bezieht sich auf Vormonat
5. **UNKLAR** – Keine Regel anwendbar → manuelle Prüfung erforderlich

Jede Zuordnung wird mit `allocationSource` und `allocationNote` dokumentiert.

### Begründung

- **Revisionssprache:** Jede Zuordnung ist begründet und nachvollziehbar
- **Hierarchie:** Explizite Regeln haben Vorrang vor automatischer Berechnung
- **Transparenz:** UNKLAR-Status macht offene Fragen sichtbar
- **Keine stillen Annahmen:** Wenn keine Regel greift → UNKLAR (nicht stillschweigend Altmasse)

### Konsequenzen

- `estateAllocation`, `allocationSource`, `allocationNote` an LedgerEntry
- `estateRatio` als Decimal (nicht Float) für Präzision
- UNKLAR-Buchungen werden im Dashboard rot markiert

---

## ADR-011: Keine User-Attribution auf BankAgreement

**Datum:** 20. Januar 2026
**Status:** Akzeptiert

### Kontext

BankAgreements erfassen Vereinbarungen mit Banken (Globalzession, Fortführungsbeitrag, etc.). Die Frage war, ob `createdBy` und `updatedBy` Felder benötigt werden.

### Entscheidung

BankAgreement hat KEINE `createdBy`/`updatedBy` Felder. Nur `createdAt`/`updatedAt` für technisches Tracking.

### Begründung

- **Gradify-only:** BankAgreements werden ausschließlich von Gradify (uns) gepflegt, nicht kollaborativ
- **Kein fachlicher Mehrwert:** Es gibt keine User-Zuordnung, die Revision benötigt
- **Technische Einfachheit:** Seeds, Imports und API-Calls ohne User-Context funktionieren problemlos
- **Audit erfolgt anders:** Über `allocationSource`/`allocationNote` auf LedgerEntry und `LedgerAuditLog`

### Konsequenzen

- BankAgreement kann ohne User-Context erstellt/aktualisiert werden
- Keine Komplexität bei Seed-Skripten oder automatischen Importen

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
