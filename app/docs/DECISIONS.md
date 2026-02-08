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

## ADR-008: BankAccount.locationId für Standort-Zuordnung

**Datum:** 08. Februar 2026
**Status:** Akzeptiert

### Kontext

Opening Balance und Cashflows müssen standort-spezifisch aggregiert werden können (Scope-Filter: GLOBAL, VELBERT, UCKERATH_EITORF). Ohne explizite BankAccount→Location-Zuordnung war dies nur über komplexe LedgerEntry-Queries möglich.

### Entscheidung

BankAccount erhält optionales `locationId`-Feld:
- Standort-spezifische Konten (z.B. "Geschäftskonto MVZ Velbert") → `locationId = "loc-haevg-velbert"`
- Zentrale Konten (z.B. "HV PLUS eG Konto") → `locationId = "loc-hvplus-gesellschaft"`

### Begründung

- **Explizit:** Klare Zuordnung ohne Ableitung aus LedgerEntries
- **Deterministisch:** Jedes BankAccount hat genau eine Location
- **Opening Balance:** Kann direkt per `SUM(openingBalanceCents) WHERE locationId IN (...)` berechnet werden
- **Performance:** Keine komplexen Joins für Scope-Filter nötig

### Konsequenzen

- Opening Balance wird scope-aware berechnet
- LocationId für LedgerEntries kann aus BankAccount abgeleitet werden (Strategie 1)
- Zentrale Konten benötigen eigene Location "Gesellschaft"
- Migration: Alle existierenden BankAccounts müssen locationId gesetzt bekommen

---

## ADR-009: JavaScript RegExp statt Perl-Syntax für Counterparty-Patterns

**Datum:** 08. Februar 2026
**Status:** Akzeptiert

### Kontext

Counterparty-Patterns verwendeten ursprünglich `(?i)`-Prefix für Case-Insensitivity (Perl-Syntax). JavaScript RegExp unterstützt diese Syntax nicht und wirft `SyntaxError: Invalid group`.

### Entscheidung

Alle Patterns verwenden JavaScript RegExp mit `i`-Flag:
```typescript
new RegExp(pattern, 'i')  // ✅ Korrekt
// NICHT: /(?i)pattern/   // ❌ Invalid in JavaScript
```

### Begründung

- **Runtime-Fehler vermeiden:** `(?i)` wirft Exception
- **Standard-Konvention:** JavaScript RegExp-Flags sind gut dokumentiert
- **Konsistenz:** Alle Patterns einheitlich

### Konsequenzen

- Alle existierenden Patterns mit `(?i)` mussten korrigiert werden
- Classification Engine testet Patterns auf Gültigkeit vor Verwendung

---

## ADR-010: Suggested-Fields für Classification Proposals

**Datum:** 08. Februar 2026
**Status:** Erweitert (ursprünglich ADR-002)

### Kontext

Classification Engine schlägt Dimensionen vor (counterpartyId, locationId). User muss diese explizit akzeptieren. Bei Bulk-Operations (100+ Einträge) ist einzelnes Akzeptieren ineffizient.

### Entscheidung

**Zwei Akzeptanz-Modi:**
1. **Einzeln:** UI zeigt Vorschlag + Accept/Reject-Buttons
2. **Bulk:** Script kopiert `suggested*` → finale Felder für alle Entries mit `WHERE counterpartyId IS NULL AND suggestedCounterpartyId IS NOT NULL`

### Begründung

- **Effizienz:** Bulk-Accept spart Zeit bei offensichtlichen Zuordnungen
- **Kontrolle:** User entscheidet pro Batch
- **Auditierbarkeit:** Suggested-Felder bleiben erhalten (History)

### Konsequenzen

- `bulk-accept-suggestions.ts` Script erstellt
- UI kann optional Bulk-Accept-Button anbieten
- Suggested-Felder werden NICHT überschrieben (nur einmal gesetzt)

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

## ADR-011: Dashboard-Komponenten nutzen IST-Daten statt PLAN-Kategorien

**Datum:** 08. Februar 2026
**Status:** Akzeptiert

### Kontext

Ursprünglich basierten Dashboard-Komponenten (Revenue, Estate-Übersicht) auf `data.calculation.categories`, die aus PLAN-Kategorien abgeleitet wurden. Mit dem Umstieg auf LedgerEntry als Single Source of Truth enthielten diese Komponenten veraltete/falsche Daten.

**Problem:**
- Revenue-Tab zeigte PLAN-Einnahmen statt IST-Einnahmen
- Estate-Tab (Masseübersicht) nutzte PLAN-Kategorien, die kein `estateAllocation` oder `estateRatio` hatten
- Scope-Filter (GLOBAL/VELBERT/UCKERATH) wurde ignoriert
- MIXED-Einträge (z.B. KV Q4 mit 2/3 Neu) wurden nicht korrekt aufgeteilt

### Entscheidung

Alle Dashboard-Komponenten laden Daten direkt aus LedgerEntries via dedizierte APIs:
1. **Revenue-Tab:** `/api/cases/[id]/ledger/revenue` mit `scope` Parameter
2. **Estate-Tab:** `/api/cases/[id]/ledger/estate-summary` mit `scope` Parameter
3. **Aggregationsfunktionen:** `aggregateByCounterparty()`, `aggregateEstateAllocation()` arbeiten auf LedgerEntries

### Begründung

- **Korrektheit:** IST-Daten aus LedgerEntries sind die Wahrheit
- **Estate Allocation:** Nur LedgerEntries haben `estateRatio` für MIXED-Buchungen
- **Scope-Aware:** Location-Filter funktioniert nur auf LedgerEntries (`locationId`)
- **Konsistenz:** Alle Dashboard-Tabs zeigen dieselbe Datenquelle

### Konsequenzen

- `data.calculation.categories` wird nicht mehr für Revenue/Estate verwendet
- Frontend lädt Daten per `useEffect()` + fetch statt `useMemo()` + props
- Loading States nötig (Spinner während API-Aufruf)
- Estate-Tab zeigt keine Detail-Listen mehr (nur Summen + Links zum Ledger)

---

## ADR-012: Scope-Filter für alle Dashboard-Tabs

**Datum:** 08. Februar 2026
**Status:** Akzeptiert

### Kontext

Dashboard hatte globalen Scope-Toggle (GLOBAL/VELBERT/UCKERATH), aber manche Tabs ignorierten diesen Filter. Dies führte zu Inkonsistenzen und Verwirrung.

**Bisheriges Verhalten:**
- Revenue-Tab: Ignorierte Scope, wurde bei Standort-Ansicht ausgeblendet
- Estate-Tab: Ignorierte Scope, zeigte immer globale Summen
- Banks-Tab: Zeigt absichtlich ALLE Konten (Scope wäre irreführend)

### Entscheidung

**Scope-Aware Tabs:**
- Liquiditätstabelle: ✅ Bereits implementiert
- Revenue-Tab: ✅ Jetzt scope-aware
- Estate-Tab: ✅ Jetzt scope-aware
- Rolling Forecast: ✅ Bereits implementiert

**Scope-Unaware Tabs (absichtlich):**
- Banks-Tab: Zeigt ALLE Bankkonten (Scope-Filter wäre irreführend für Bank-Übersicht)
- Security-Tab: Zeigt ALLE Sicherungsrechte

### Begründung

- **Konsistenz:** User erwartet, dass Scope-Toggle alle Tabs beeinflusst
- **Transparenz:** Tabs ohne Scope-Support werden ausgeblendet bei Standort-Ansicht
- **Sinnhaftigkeit:** Bankkonto-Übersicht soll immer vollständig sein (unabhängig von Location-Filter)

### Konsequenzen

- `tabsWithoutScopeSupport` Set definiert Ausnahmen
- Scope-Parameter wird an alle relevanten APIs übergeben
- Frontend: `useEffect` Dependencies enthalten `scope` für Re-Fetch bei Änderung
- API-Routen: `scope` Query-Parameter standardisiert

---

## ADR-013: IST-Vorrang in Ledger-Aggregation

**Datum:** 08. Februar 2026
**Status:** Akzeptiert

### Kontext

Dashboard summierte IST + PLAN für dieselbe Periode, was zu Doppelzählungen führte. Bei HVPlus Case: +327K Fehler (Dez 2025 + Jan 2026 hatte beide IST und PLAN).

**Problem:**
- Dez 2025: IST -3.321 € + PLAN +343.003 € = +339.682 € (falsch)
- Jan 2026: IST -47.901 € + PLAN +35.397 € = -12.504 € (falsch)
- Total: 874.129 € (falsch) statt 502.742 € (korrekt)

### Entscheidung

IST-Daten haben Vorrang vor PLAN-Daten **auf Perioden-Ebene**:
- Wenn für Periode N IST-Einträge existieren → PLAN-Einträge für Periode N ignorieren
- Wenn für Periode N keine IST-Einträge → PLAN-Einträge verwenden

**Implementierung:**
1. Gruppiere LedgerEntries nach `periodIndex` + `valueType`
2. Für jede Periode: Checke ob IST vorhanden
3. Wenn ja: Nur IST-Entries in Aggregation, PLAN verwerfen
4. Logging: Anzahl ignorierter PLAN-Entries

### Begründung

- **Semantik:** IST = Realität (Bankbewegungen), PLAN = Vorhersage
- **Fachlich korrekt:** Sobald IST-Daten vorliegen, ist PLAN obsolet
- **Einfachheit:** Perioden-basierte Entscheidung (kein komplexes Matching nötig)
- **Transparent:** Log-Ausgabe zeigt verdrängte PLAN-Entries

**Nicht gewählt:**
- ❌ Entry-basiertes Matching (zu komplex: Was ist "dieselbe Buchung"?)
- ❌ PLAN-Daten löschen (würden für Vergleiche fehlen)
- ❌ Beide zeigen + UI-Toggle (verwirrt User)

### Konsequenzen

**Positiv:**
- Dashboard-Zahlen korrekt
- Keine manuellen Workarounds mehr (PLAN-Daten löschen)
- IST/PLAN-Vergleich weiterhin möglich (PLAN-Daten bleiben in DB)

**Neutral:**
- PLAN-Entries bleiben in DB (für Soll/Ist-Vergleich)
- Log-Ausgabe informiert über ignorierte Entries

**Performance:**
- Einmalige Gruppierung nach periodIndex (O(n))
- Vernachlässigbare Mehrkosten

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

## ADR-012: ServiceDate-Regeln für Alt/Neu-Zuordnung

**Datum:** 24. Januar 2026
**Status:** Akzeptiert

### Kontext

Die Split-Engine benötigt ein `serviceDate` (Leistungsdatum), um Buchungen der Alt- oder Neumasse zuzuordnen. Viele Buchungstypen folgen festen Mustern:
- HZV-Monatsabschläge → Leistung = Zahlungsmonat
- KV-Quartalsabrechnungen → Leistung = Vorquartal
- Laufende Kosten → Leistung = Zahlungsmonat

Bisher: 242 IST-Einträge hatten keine `estateAllocation`, weil `serviceDate` fehlte.

### Entscheidung

ClassificationRules können `assignServiceDateRule` mit einem von drei Regel-Typen setzen:

1. **SAME_MONTH:** Leistungsdatum = 15. des Zahlungsmonats
2. **VORMONAT:** Leistungsdatum = 15. des Vormonats (HZV-Logik)
3. **PREVIOUS_QUARTER:** Leistungszeitraum = komplettes Vorquartal

Die Classification Engine berechnet aus `transactionDate` + Regel das konkrete Datum und speichert es als Vorschlag (`suggestedServiceDate` / `suggestedServicePeriodStart/End`).

### Begründung

- **Effizienz:** 329 Einträge wurden mit einem Bulk-Accept klassifiziert
- **Determinismus:** Regel + Buchungsdatum = eindeutiges Ergebnis
- **Revisionssprache:** Jede Zuordnung dokumentiert die angewandte Regel
- **Nur Vorschläge:** User muss explizit bestätigen (keine Auto-Commits)

### Konsequenzen

- `ClassificationRule.assignServiceDateRule` als neues Feld
- `calculateServiceDate()` Funktion in Classification Engine
- Bulk-Accept-API um `applyServiceDateSuggestions` erweitert
- Preview-Modal zeigt alle Vorschläge vor Übernahme

---

## ADR-013: Standortspezifische Liquiditätssicht via Scope-Filter

**Datum:** 24. Januar 2026
**Status:** Akzeptiert

### Kontext

Der IV (Insolvenzverwalter) wünscht sich standortspezifische Liquiditätssichten:
- Velbert als Standalone-Einheit
- Uckerath/Eitorf als zusammengefasste Einheit
- Zentrale Verfahrenskosten sollen in Standort-Sichten nicht erscheinen

Die bestehende Liquiditätstabelle soll unverändert bleiben (gleiche Zeilen, Perioden, Berechnung).

### Entscheidung

1. **Scope als Filter VOR der Aggregation:** Der Scope-Filter (`filterEntriesByScope()`) wird auf LedgerEntries angewandt, BEVOR sie in Perioden aggregiert werden.

2. **Keine separate Tabelle:** Die gleiche Tabelle wird mit gefiltertem Datenbestand gerendert.

3. **Zentrale Kosten explizit definiert:** `isCentralProcedureCost()` identifiziert insolvenzspezifische Kosten ohne Standortbezug.

4. **Scope-spezifische Zeilen:** Via `visibleInScopes` können Zeilen nur in bestimmten Scopes erscheinen (z.B. Velbert-Personaldetails).

### Begründung

**Warum Filter vor Aggregation?**
- Öffnungs-/Endbestände müssen konsistent sein
- Keine nachträgliche UI-Filterung, die Summen verfälscht
- Einfache Implementierung: Ein Filterschritt, danach normale Berechnung

**Warum keine separate Tabelle?**
- DRY-Prinzip: Gleiche Berechnungslogik
- Konsistente Darstellung
- Weniger Wartungsaufwand

**Warum zentrale Kosten explizit?**
- Entries ohne `locationId` sind nicht automatisch "zentral"
- `ABSONDERUNG` ist typischerweise zentral
- Pattern-Match als Fallback für insolvenzspezifische Beschreibungen

### Konsequenzen

- **Positiv:** IV erhält exakt gewünschte Standort-Sichten
- **Positiv:** Keine Duplizierung von Logik
- **Negativ:** Zentrale Kosten-Patterns müssen bei neuen Kostenarten erweitert werden
- **Negativ:** Scope-spezifische Zeilen müssen in Konfiguration gepflegt werden

---

## ADR-015: Turso Production Database als Prisma-kompatible DB

**Datum:** 07. Februar 2026
**Status:** Akzeptiert

### Kontext

Die ursprüngliche Turso-DB (`inso-liquiplanung`) hatte Schema-Inkompatibilitäten:
- `INTEGER` statt `BIGINT` für Cent-Beträge
- `TEXT` statt `DATETIME` für Datumsfelder
- Fehlende oder falsche Constraints

Dies führte zu:
- Prisma Client-Fehlern ("Invalid URL", "no such column")
- 500-Fehler bei allen API-Calls
- Deployment-Blockern

### Entscheidung

1. **Neue Production DB:** `inso-liquiplanung-v2` mit vollständig synchronem Schema
2. **Vollständige Datenmigration:** Alle 1.317 Ledger-Einträge migriert
3. **Schema-Export von lokaler SQLite:** Lokale Dev-DB als Schema-Source of Truth
4. **Type-Mapping:**
   - SQLite `BIGINT` → Turso `BIGINT` (nicht INTEGER)
   - SQLite `DATETIME` → Turso `DATETIME` (nicht TEXT)

### Begründung

**Warum neue DB statt ALTER TABLE?**
- Constraints (Primary Keys, Foreign Keys) können nicht nachträglich geändert werden
- Risiko von Inkonsistenzen bei schrittweiser Migration
- Sauberer Neustart mit garantiert korrektem Schema

**Warum lokale DB als Source?**
- Prisma generiert lokal korrekte SQLite-Schemas
- `prisma db push` stellt sicher, dass Schema 100% mit Prisma-Modell übereinstimmt
- Lokale Tests funktionieren → Production-Schema ist identisch

**Warum Vollmigration statt inkrementell?**
- Datenmenge überschaubar (< 2 MB)
- Keine Downtime-Anforderung (kann kurz offline sein)
- Garantierte Atomarität (alles oder nichts)

### Konsequenzen

**Positiv:**
- Prisma Client funktioniert fehlerfrei
- Konsistente Type-Definition lokal/production
- Keine Schema-Drift mehr möglich

**Negativ:**
- Alte DB muss manuell gelöscht werden (oder als Backup behalten)
- Environment Variables mussten neu gesetzt werden
- Vercel-Deployment-Trigger nötig (kein Auto-Deploy)

**Lessons Learned:**
- Environment Variables mit `printf` setzen (nicht `echo` → Newline-Problem)
- Turso-CLI-Schema-Export funktioniert, aber Constraints müssen manuell nachgearbeitet werden
- Bei Schema-Änderungen: Immer Force-Rebuild auf Vercel (Prisma Client Cache)

---

## ADR-014: Dashboard-Konsistenz via einheitliche Filter

**Datum:** 24. Januar 2026
**Status:** Akzeptiert

### Kontext

Analyse der Dashboard-Tabs ergab kritische Inkonsistenzen:

| Tab | reviewStatus-Filter | Estate-Trennung | Scope |
|-----|---------------------|-----------------|-------|
| Übersicht | CONFIRMED, ADJUSTED | ✅ Alt/Neu/Unklar | ❌ Nein |
| Liquiditätstabelle | **≠ REJECTED** (inkl. UNREVIEWED!) | ✅ Optional | ✅ Ja |
| Standorte | CONFIRMED, ADJUSTED | ❌ KEINE! | Implizit |

**Problem:** IV sieht in der Liquiditätstabelle ungeprüfte Daten, in der Übersicht nicht.

### Entscheidung

1. **reviewStatus-Toggle statt automatischer Filterung:**
   - Default: Nur geprüfte Buchungen (CONFIRMED + ADJUSTED)
   - Admin kann "inkl. ungeprüfte" aktivieren → zeigt alles außer REJECTED
   - Warnung-Banner wenn ungeprüfte enthalten sind

2. **Globaler Scope-State im Dashboard:**
   - Scope-Toggle im Dashboard-Header (über den Tabs)
   - Scope gilt für alle Tabs (aktuell: Liquiditätstabelle, KPIs)
   - Controlled Components: Child-Komponenten erhalten scope als Prop

3. **Estate-Trennung in Locations:**
   - API liefert `estateBreakdown` pro Standort
   - Viability-Check pro Estate möglich

### Begründung

**Warum Toggle statt Automatik?**
- Admin entscheidet bewusst, ob vorläufige Zahlen gezeigt werden
- Warnung macht Unsicherheit explizit
- Keine versteckten Unterschiede zwischen Ansichten

**Warum globaler Scope-State?**
- Vermeidet inkonsistente Filterung zwischen Tabs
- User muss Scope nur einmal wählen
- Tabs zeigen konsistente Zahlen für gleichen Scope

**Warum zwei Aggregationsfunktionen beibehalten?**
- `/lib/ledger-aggregation.ts`: Einfache Dashboard-Aggregation
- `/lib/ledger/aggregation.ts`: Spezialisierte Funktionen (Rolling Forecast, Cache, etc.)
- Unterschiedliche Zwecke, keine echte Duplizierung

### Konsequenzen

- **Positiv:** IV erhält konsistente Zahlen über alle Tabs
- **Positiv:** Explizite Kontrolle über Datenqualität (geprüft vs. vorläufig)
- **Negativ:** Mehr State-Management im Dashboard
- **Negativ:** Alle Consumer müssen scope unterstützen

---

## ADR-015: IST-Vorrang-Logik

**Datum:** 25. Januar 2026
**Status:** Akzeptiert

### Kontext

In der Liquiditätsmatrix wurden Perioden mit IST-Daten und PLAN-Daten als "MIXED" angezeigt. Die Werte wurden addiert, was zu falschen Zahlen führte:
- November/Dezember hatten reale Bankbewegungen (IST)
- Aber auch noch alte PLAN-Werte für denselben Zeitraum
- Badge zeigte "MIXED", Summen waren doppelt

**User-Feedback:** "Wenn die Bankbewegungen da sind, ist das Realität. Planung interessiert mich nur noch historisch."

### Entscheidung

**IST hat Vorrang vor PLAN.** Wenn für eine Periode IST-Daten existieren, werden PLAN-Daten für diese Periode bei der Aggregation ignoriert.

1. **Voranalyse:** Ermittle alle Perioden mit mindestens einer IST-Buchung
2. **Aggregation:** PLAN-Entries für diese Perioden überspringen
3. **Tracking:** `planIgnoredCount` zählt übersprungene PLAN-Buchungen
4. **UI-Feedback:** Grünes Info-Banner zeigt Anzahl ersetzter PLAN-Buchungen

### Begründung

**Warum ignorieren statt filtern?**
- PLAN-Buchungen bleiben in der DB erhalten (wichtig für Audit)
- Nur die Anzeige/Aggregation wird angepasst
- Separater IST/PLAN-Vergleichs-Tab kann weiterhin beide zeigen

**Warum pro Periode, nicht pro Zeile?**
- Wenn eine Periode IST-Daten hat, gilt die ganze Periode als "real"
- Vermeidet Komplexität beim Matching einzelner Zeilen
- Entspricht dem echten Planungsprozess: Periode für Periode wird IST ersetzt

### Konsequenzen

- **Positiv:** Badges zeigen "IST" statt irreführendem "MIXED"
- **Positiv:** Zahlen in der Matrix entsprechen der Realität
- **Positiv:** Keine Doppelzählung von PLAN + IST
- **Negativ:** PLAN-Werte nicht mehr direkt sichtbar (benötigt Vergleichs-View)
- **Offen:** Echter IST/PLAN-Vergleichs-Tab als nächster Schritt geplant

---

## ADR-016: Berechnete Kontostände statt manueller Eingabe

**Datum:** 5. Februar 2026
**Status:** Akzeptiert

### Kontext

`BankAccount.balanceCents` und `BankAccount.availableCents` waren manuelle Eingabefelder. Da Kontoauszüge als IST-Buchungen im Ledger liegen (mit `bankAccountId`), wurden Kontostände doppelt gepflegt — manuell im Bankenspiegel und implizit durch Ledger-Buchungen. Das war fehleranfällig und widersprach dem Prinzip "LedgerEntry als Single Source of Truth".

### Entscheidung

Kontostände werden berechnet:

```
currentBalanceCents = openingBalanceCents + SUM(IST-LedgerEntries.amountCents WHERE bankAccountId = X)
```

- **`openingBalanceCents`** — einmaliger Anfangssaldo (manuell, vor allen Ledger-Buchungen)
- **`currentBalanceCents`** — berechnet, nie gespeichert
- **"Liquide Mittel"** — Summe aller `currentBalanceCents` für Konten mit `status !== 'blocked'`
- **`balanceCents` / `availableCents`** — entfernt

### Begründung

- **Single Source of Truth:** Ledger-Buchungen bestimmen den Saldo, nicht manuelle Eingaben
- **Automatisch aktuell:** Import neuer Kontoauszüge → Saldo aktualisiert sich sofort
- **Keine Doppelpflege:** Kein Risiko, dass manueller Saldo und Ledger-Daten divergieren
- **Performant:** Eine gruppierte SUM-Query über 4-8 Konten, trivial schnell

### Deployment-Checkliste

**VOR dem Deployment auf Turso:**

```sql
-- 1. Neue Spalte anlegen (mit Default)
ALTER TABLE bank_accounts ADD COLUMN openingBalanceCents INTEGER NOT NULL DEFAULT 0;

-- 2. Bestehende Salden als Anfangssaldo übernehmen
UPDATE bank_accounts SET openingBalanceCents = balanceCents;
```

**Hinweis:** `balanceCents` und `availableCents` bleiben als Ghost-Columns in Turso (SQLite kann keine Spalten droppen). Prisma ignoriert sie, da sie nicht mehr im Schema stehen.

**NACH dem SQL:**
- `vercel --prod` deployen
- Verifizieren: Bankenspiegel zeigt Salden, Dashboard lädt korrekt

### Konsequenzen

- **Positiv:** Kontostände sind immer konsistent mit Ledger-Daten
- **Positiv:** Weniger manuelle Pflege
- **Positiv:** "Verfügbar"-Spalte entfällt (war de facto immer gleich oder unklar)
- **Negativ:** `openingBalanceCents` muss einmalig korrekt gesetzt werden
- **Negativ:** Ghost-Columns in Turso (kosmetisch, kein funktionales Problem)

---

## ADR-017: Prisma locationId-Workaround (Temporär)

**Datum:** 08. Februar 2026
**Status:** Akzeptiert (Temporäre Lösung)

### Kontext

Nach der Schema-Erweiterung von `BankAccount` um `locationId` sollte Prisma Client diese Spalte automatisch lesen. Trotz mehrfacher Versuche gab Prisma `locationId: null` zurück:

**Durchgeführte Maßnahmen (alle erfolglos):**
- `npx prisma generate` (mehrfach)
- Cache-Löschen: `.next`, `.turso`, `node_modules/.prisma`
- Vollständiges Neuerstellen des Prisma Clients
- Kill aller Node-Prozesse
- Server-Neustart

**Verifikation der Datenbank:**
```sql
SELECT accountName, locationId FROM bank_accounts;
-- ISK Velbert|loc-haevg-velbert  ✓ Daten sind vorhanden
-- ISK Uckerath|loc-haevg-uckerath ✓
```

**Prisma-Abfrage:**
```typescript
const accounts = await prisma.bankAccount.findMany({
  include: { location: true }
});
// accounts[0].locationId === null  ✗ Trotz korrekter Daten!
```

### Entscheidung

**Temporärer Workaround:** Manuelle Location-Erkennung basierend auf `accountName`-Pattern:

```typescript
const getLocationByAccountName = (accountName: string) => {
  if (accountName.toLowerCase().includes("velbert")) {
    return { id: "loc-haevg-velbert", name: "Praxis Velbert" };
  }
  if (accountName.toLowerCase().includes("uckerath")) {
    return { id: "loc-haevg-uckerath", name: "Praxis Uckerath" };
  }
  return null; // Zentrale Konten
};
```

**Anwendung:** In `/api/cases/[id]/bank-accounts/route.ts` Zeilen 162-171

### Begründung

**Warum Workaround statt weitere Debugging-Versuche?**
- User-Feedback: "ne man. das kann doch nciht schwer sein!!" (Frustration)
- Zeitbudget vs. Nutzen: Feature-Funktionalität ist wichtiger als perfekte Technik
- Lokaler Scope: Problem betrifft nur HVPlus-Fall (5 Konten, eindeutige Namen)
- Revisionssprache: Zuordnung ist nachvollziehbar und dokumentiert

**Warum nicht Schema-Änderung?**
- Schema ist nachweislich korrekt (DB zeigt Daten)
- Problem liegt im Prisma Client Layer (Modul-Caching?)

### Konsequenzen

**Positiv:**
- Feature funktioniert sofort
- User kann weiterarbeiten
- Eindeutige Zuordnung für HVPlus-Fall

**Negativ:**
- Nicht skalierbar (neue Fälle mit ähnlichen Namen würden fehlschlagen)
- Hardcoded Business-Logik in API-Layer (nicht ideal)
- Prisma-Bug bleibt ungelöst

**Nächste Schritte:**
1. Bei nächstem Prisma-Major-Update erneut testen
2. Issue bei Prisma melden mit Reproduktions-Case
3. Bei neuen Fällen: Prüfen ob Problem weiterhin besteht

**Rollback-Plan:**
- Wenn Prisma-Fix verfügbar: Workaround entfernen, `acc.location` direkt verwenden
- Code-Marker: `// WORKAROUND: Prisma gibt locationId nicht zurück`

---

## ADR-018: ISK-Konten gehören in Liquiditätsplanung

**Datum:** 08. Februar 2026
**Status:** Akzeptiert

### Kontext

Frage vom User: "ist es üblich, dass IV konten (bw konten in unserem fall) in eine IV liqui planung gehören?"

**ISK (Insolvenz-Sonderkonto):**
- BW-Bank-Konten speziell für Insolvenzverfahren
- Werden nach Insolvenz-Eröffnung angelegt
- Alle verfahrensbezogenen Zahlungen laufen hierüber

**HVPlus-Fall konkret:**
- ISK Velbert: Neu seit Dezember 2025, erhält alle KV/HZV/PVS-Zahlungen für Velbert
- ISK Uckerath: Neu seit November 2025, erhält ALLE HZV-Zahlungen (inkl. Velbert!)
- Alte Konten: Sparkasse Velbert (Massekredit), apoBank (teils gesperrt)

**Rechtliche Unsicherheit:**
- Gehören ISK-Konten überhaupt zur Insolvenzmasse?
- Oder sind sie nur "Durchlaufposten" ohne Bilanzrelevanz?

### Entscheidung

**JA, ISK-Konten gehören in die Liquiditätsplanung.**

Alle 5 Bankkonten des HVPlus-Falls werden einzeln im Dashboard dargestellt:
1. ISK Velbert (BW-Bank)
2. ISK Uckerath (BW-Bank)
3. Geschäftskonto MVZ Velbert (Sparkasse HRV)
4. MVZ Uckerath (apoBank)
5. HV PLUS eG (apoBank, zentral)

### Begründung

**Rechtliche Grundlage (BGH-Rechtsprechung):**
- ISK ist **Teil der Insolvenzmasse** (nicht Anderkonto des Verwalters)
- BGH: Insolvenzverwalter darf nur ISK nutzen, nicht eigenes Anderkonto
- Alle auf dem ISK befindlichen Mittel gehören zur Masse
- Verwendung ist durch InsO geregelt

**Fachliche Gründe:**
- **Vollständige Liquiditätssicht:** IV muss ALLE verfügbaren Mittel kennen
- **Massekredit-Berechnung:** ISK-Guthaben fließen in Headroom-Berechnung ein
- **Transparenz für Gericht/Gläubiger:** Alle Konten müssen nachvollziehbar sein
- **Zahlungsverkehr läuft hierüber:** ISK ist nicht "neutral", sondern operativ relevant

**Praktische Argumentation:**
- ISK Uckerath hat 658 Transaktionen (höchste Aktivität aller Konten!)
- Über ISK laufen die meisten Einnahmen (KV, HZV, PVS)
- Ohne ISK-Konten wäre Liquiditätsplanung unvollständig

### Konsequenzen

**Positiv:**
- IV hat vollständige Übersicht über alle Mittel
- Liquiditätsplanung ist vollständig und prüfungssicher
- Massekredit-Headroom korrekt berechnet
- Keine "versteckten" Guthaben

**Negativ:**
- Mehr Konten in der Darstellung (5 statt 3)
- UI muss Konten aufklappbar machen (zu viele Zeilen)

**Umsetzung:**
- Bankkonto-Tab zeigt alle 5 Konten einzeln
- Liquiditätsmatrix erhält 5 Bank-spezifische Zeilen (aufklappbar)
- Kontext-Informationen erklären ISK-Besonderheiten

**Dokumentation:**
- `ACCOUNT_CONTEXT` in BankAccountsTab.tsx dokumentiert Verwendungszweck
- Case-Notes für Sonja erklären rechtliche Grundlage

---

## ADR-019: Incident Response für Datenqualitätsprobleme

**Datum:** 08. Februar 2026
**Status:** Akzeptiert

### Kontext

Am 08.02.2026 entdeckte der User ein katastrophales Datenqualitätsproblem:
- ISK Uckerath Liquiditätstabelle: 802K EUR
- ISK Uckerath Bankkonto-Sicht: 930K EUR
- PDF Kontoauszug (Januar Endsaldo): 419K EUR

**User-Reaktion:** "WHAT THE FUCK !!? das nimmt mir legliche konfidenz in irgendwas was du hier gemacht hast!"

**Root Cause:** 658 LedgerEntries in Datenbank, aber nur 303 einzigartige Buchungen. 355 Duplikate durch doppelten Import aus unterschiedlich benannten JSON-Dateien.

### Entscheidung

**Strukturierter Incident-Response-Prozess** mit strengen Regeln:

1. **SOFORT-STOPP:** Keine weiteren Änderungen an Daten
2. **Vollständige Dokumentation VOR jeder Aktion:**
   - `DATA_QUALITY_INCIDENT_[Datum].md` mit Executive Summary
   - `IMPORT_PIPELINE_ANALYSIS_[Datum].md` für Root Cause
   - `CLEANUP_PLAN_[Datum].md` für Bereinigungsstrategie
3. **Backup VOR jeder Löschung:**
   - SQLite `.backup` Befehl
   - Backup-Pfad dokumentieren
   - Rollback-Anleitung bereitstellen
4. **Schrittweise Bereinigung mit User-Freigabe:**
   - Jede Löschung als separate Stufe dokumentieren
   - User muss EXPLIZIT zustimmen ("du löscht nichts ohne mein einverständnis")
   - Nach jeder Stufe: Verifikation gegen Original-Quellen (PDFs)
5. **Vollständige Traceability:**
   - Jede gelöschte Zeile ist nachvollziehbar
   - SQL-Statements in Doku festhalten
   - Before/After-Zahlen dokumentieren
6. **Post-Incident Documentation:**
   - CHANGELOG.md Update
   - LIMITATIONS.md Update (schwache Duplikat-Erkennung)
   - Lessons Learned dokumentieren

### Begründung

**Warum so strenge Prozesse?**
- **Vertrauensverlust:** User hat explizit Vertrauen in System verloren
- **Rechtliche Konsequenzen:** Falsche Liquiditätszahlen können Insolvenzverfahren gefährden
- **Revisionssprache:** Jede Aktion muss nachvollziehbar und begründet sein
- **Keine Experimente:** Bei Datenverlust-Risiko nur dokumentierte, geprüfte Schritte

**Warum Backup vor JEDER Löschung?**
- SQL-Fehler können katastrophale Folgen haben (677 Entries gelöscht statt 18!)
- Rollback muss in < 1 Minute möglich sein
- SQLite `.backup` ist schnell (7.4 MB in Sekunden)

**Warum User-Freigabe für jeden Schritt?**
- User trägt letztendlich Verantwortung
- Transparenz schafft Vertrauen zurück
- Keine "überraschenden" Datenänderungen

### Konsequenzen

**Positiv:**
- Incident wurde erfolgreich behoben (303 saubere Entries, 0 Duplikate)
- User-Vertrauen durch Transparenz teilweise wiederhergestellt
- Dokumentation dient als Vorlage für zukünftige Incidents
- Rollback-Capability wurde demonstriert (fehlerhafte Löschung erfolgreich rückgängig gemacht)

**Negativ:**
- Zeitaufwändig: 4 Dokumentationsdateien + 4 Bereinigungsstufen
- Manuelle Prozesse: Keine automatische Duplikat-Erkennung
- Vertrauensschaden: User wird zukünftig skeptischer sein

**Lessons Learned:**
1. **Import-Pipeline-Schwächen:**
   - Keine File-Hash-Prüfung
   - Kein `ingestion_jobs` Tracking
   - Schwache Description-based Duplikat-Erkennung
   - Ad-hoc-Scripts statt offizieller Pipeline

2. **Verifikation MUSS vor Freigabe:**
   - Niemals Daten als "fertig" markieren ohne Abgleich mit Original-Quelle (PDF)
   - Duplikat-Check gehört in Standard-Verifikation
   - Summenbildung über alle Perioden prüfen

3. **DELETE-Statements IMMER mit WHERE-Clause auf äußerster Ebene:**
   - `DELETE FROM ledger_entries WHERE id NOT IN (...)` ist gefährlich
   - Korrekt: `DELETE FROM ledger_entries WHERE bankAccountId = X AND id NOT IN (...)`
   - Vor Ausführung: DRY-RUN mit `SELECT COUNT(*)` simulieren

4. **Dokumentation ist keine Zeitverschwendung:**
   - User-Vertrauen hängt von Transparenz ab
   - Dokumentation ermöglichte erfolgreiche Bereinigung
   - Incident-Reports sind Revisionsnachweis

**Zukünftige Verbesserungen:**
- Robuste Duplikat-Erkennung über `(bankAccountId, transactionDate, amountCents)` Triple
- File-Hash-Tracking in `ingestion_jobs`
- Automatische Verifikation gegen Summen aus JSON-Metadaten
- Pre-Import Dry-Run mit Duplikat-Warnung

---

## ADR-020: Clean Slate Re-Import als Standard-Bereinigungsstrategie

**Datum:** 08. Februar 2026
**Status:** Akzeptiert

### Kontext

Nach dem ISK Uckerath Duplikate-Incident wurden zwei Bereinigungsstrategien getestet:

**V1-Versuch: Selektive Duplikat-Bereinigung**
- Cross-File Duplikate löschen (November V2, Dezember V1 Duplikate, Januar V1)
- File-internal Duplikates löschen (gleicher Tag + Betrag innerhalb derselben Datei)
- **Ergebnis:** 18 legitime Transaktionen verloren (303 statt 321 Entries)
- **Grund:** Transaktionen mit gleichem Datum + Betrag sind nicht zwingend Duplikate

**V2-Versuch: Clean Slate Re-Import**
- DELETE alle Entries für betroffenes Bankkonto
- Re-Import aus VERIFIED JSONs (differenceCents: 0)
- **Ergebnis:** 345 Entries, exakt wie in JSONs, Closing Balance korrekt

### Entscheidung

**Bei VERIFIED Datenquellen: Clean Slate Re-Import statt selektive Bereinigung.**

1. **DELETE:** Alle betroffenen Entries löschen
2. **Re-Import:** Aus verifizierten Quelldateien neu importieren
3. **Verifikation:** Anzahl + Closing Balance gegen Original-Quelle prüfen

### Begründung

**Warum Clean Slate besser ist:**
- **Garantierte Korrektheit:** JSON-Metadaten definieren erwartetes Ergebnis (transactionCount, closingBalance)
- **Keine verlorenen Transaktionen:** Alle Daten kommen aus verifizierter Quelle
- **Einfacher:** Kein komplexes Duplikat-Matching nötig
- **Auditierbar:** Klare Quelle für jeden Entry (importSource)

**Warum selektive Bereinigung riskant ist:**
- **Falsche Annahmen:** Gleicher Tag + Betrag ≠ Duplikat (z.B. HZV-Abrechnungen)
- **Komplexe Logik:** Matching-Regeln können fehlschlagen
- **Nicht deterministisch:** Welcher Entry wird behalten, welcher gelöscht?
- **Schwer zu verifizieren:** Woher wissen wir, dass wir nichts verloren haben?

**Warum nur bei VERIFIED Quellen:**
- VERIFIED bedeutet: `differenceCents: 0` und `status: PASS`
- Diese JSONs wurden gegen PDF-Kontoauszüge geprüft
- Opening + Transaktionen = Closing (verifiziert)
- JSONs sind "Single Source of Truth"

### Konsequenzen

**Positiv:**
- Null-Fehler-Risiko bei Bereinigung
- User-Vertrauen durch Transparenz
- Klare Verifikationskriterien (Anzahl + Summe)
- Wiederholbar und deterministisch

**Negativ:**
- Alle Entries verlieren ihre IDs (neue IDs bei Re-Import)
- Bestehende Klassifikationen gehen verloren (reviewStatus, categoryTag, etc.)
- Bei nicht-VERIFIED Quellen nicht anwendbar

**Mitigation für Klassifikations-Verlust:**
- Re-Import nur für UNREVIEWED Daten (ISK Uckerath war noch nicht klassifiziert)
- Bei klassifizierten Daten: Klassifikation exportieren, Re-Import, Klassifikation re-applizieren

### Workflow-Vorlage

```bash
# 1. Backup ZUERST
sqlite3 dev.db ".backup '/tmp/backup-$(date +%Y%m%d-%H%M%S).db'"

# 2. Verifikation: Prüfe JSON-Metadaten
jq '.verification' source.json
# Erwartung: differenceCents: 0, status: PASS

# 3. DELETE betroffene Entries
DELETE FROM ledger_entries WHERE bankAccountId = 'xxx';

# 4. Re-Import aus VERIFIED JSON
# (Import-Mechanismus je nach Fall)

# 5. Verifikation gegen JSON
SELECT COUNT(*) FROM ledger_entries WHERE bankAccountId = 'xxx';
-- Erwartung: transactionCount aus JSON

SELECT SUM(amountCents) / 100.0 FROM ledger_entries WHERE bankAccountId = 'xxx';
-- Erwartung: closingBalanceFromPDF aus JSON
```

### Anwendungsfälle

**Wann Clean Slate verwenden:**
- ✅ VERIFIED JSONs vorhanden (differenceCents: 0)
- ✅ Daten sind UNREVIEWED (keine Klassifikation verloren)
- ✅ Duplikate-Problem bei einem abgrenzbaren Bereich (z.B. ein BankAccount, ein Monat)
- ✅ User fordert Null-Fehler-Toleranz

**Wann NICHT Clean Slate verwenden:**
- ❌ Keine VERIFIED Quelle verfügbar
- ❌ Daten sind bereits klassifiziert (CONFIRMED/ADJUSTED)
- ❌ Problem betrifft viele Bereiche gleichzeitig
- ❌ Quelle hat bekannte Fehler (differenceCents ≠ 0)

---

## ADR-015: Tab-basierte Business-Logik-Darstellung

**Datum:** 08. Februar 2026
**Status:** ~~Akzeptiert~~ → **KORRIGIERT** (08. Februar 2026)

### Kontext

Insolvenzverwalter benötigen schnellen Zugriff auf fallspezifische Business-Logik (Zahlungsregeln, Vertragsdetails, Abrechnungswege). Diese Information muss sowohl im internen Admin-Dashboard als auch im externen Portal identisch verfügbar sein.

### Entscheidung (KORRIGIERT)

**Business-Logik hat ZWEI Darstellungen:**

1. **Dashboard-Tab** (`BusinessLogicContent.tsx` im Unified Dashboard)
   - Für IV-Portal und externe Share-Links
   - Kompakte, übersichtliche Darstellung
   - Integriert in Dashboard-Navigation

2. **Separate Admin-Seite** (`/admin/cases/[id]/business-logic/page.tsx`)
   - Nur für internes Admin-Dashboard
   - Detaillierte, umfassende Dokumentation mit 4 Tabs:
     - Grundkonzepte (Einnahmen vs. Einzahlungen, IST vs. PLAN, Alt/Neu-Masse)
     - Abrechnungslogik (HZV, KV, PVS Zahlungsstrukturen mit Beispielen)
     - Massekredit (Fortführungsbeitrag-Berechnung, Auswirkung auf Liquidität)
     - Datenqualität (Status-Matrix, offene Fragen an IV)

### Begründung

**Warum BEIDES notwendig ist:**
- **Dashboard-Tab:** IV braucht schnellen Kontext während der Dashboard-Nutzung
- **Admin-Seite:** Berater brauchen umfassende Dokumentation für Fall-Einarbeitung und IV-Kommunikation
- **Nicht redundant:** Admin-Seite enthält deutlich mehr Details (Berechnungsbeispiele, Datenqualitäts-Matrix, offene Fragen)

**Fehler in ursprünglicher ADR:**
- Admin-Seite wurde versehentlich in Commit `5379227` gelöscht
- Annahme war falsch: "Tab ersetzt separate Seite vollständig"
- Tatsächlich: Unterschiedliche Zielgruppen und Use-Cases

### Konsequenzen

- **Positiv:** IV-Portal bleibt schlank, Admin-Dashboard behält Detailtiefe
- **Positiv:** `BusinessLogicContent.tsx` ist weiterhin shared component
- **Wartung:** Admin-Seite muss bei Fall-spezifischen Änderungen aktualisiert werden
- **Standard:** Business-Logik-Dokumentation = Dashboard-Tab (Portal) + Admin-Seite (intern)

---

## ADR-016: HVPlus-spezifische vs. generische Business-Logik

**Datum:** 08. Februar 2026
**Status:** Akzeptiert

### Kontext

Business-Logik-Tab sollte IV bei Verständnis der Zahlungslogik helfen. Frage: Generische InsO-Erklärungen oder fallspezifische Details?

### Entscheidung

Business-Logik-Tab ist **fallspezifisch**, nicht generisch. Für HVPlus: Konkrete Abrechnungsstellen (KVNO, HAVG, PVS), echte Banken (Sparkasse HRV, apoBank), Massekreditvertrag §1(2) Details.

### Begründung

- **Zielgruppe:** Erfahrene Insolvenzverwalter kennen InsO-Grundlagen
- **Vertrauensbildung:** Konkrete Vertragsreferenzen wirken professioneller als allgemeine Erklärungen
- **Actionable:** IV kann direkt mit echten Kontakten/Verträgen arbeiten
- **Kein Marketing:** Faktisch, konservativ, ohne Versprechungen

**Abgelehnte Alternative:** Generische Erklärungen wie "Was ist Altmasse/Neumasse" wären:
- Beleidigend für erfahrene IV ("brauchen wir BWLer sicher keinem alten Inso-Rechtsanwalt erklären")
- Weniger vertrauenserweckend
- Nicht direkt nutzbar

### Konsequenzen

- **Pro Fall:** Jeder Fall braucht eigene Business-Logik-Komponente
- **Template-Ansatz:** `BusinessLogicContent.tsx` kann als Template für andere Fälle dienen
- **Wartung:** Updates bei Vertragsänderungen nötig
- **Qualität:** Höhere Qualität durch Fallspezifität

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

---

## ADR-025: Scope-Konsistenz durch Tab-Filterung (Quick-Fix)

**Datum:** 08. Februar 2026
**Status:** Akzeptiert (Temporär, bis Proper Scope-Support implementiert)

### Kontext

Standort-Toggle (Scope: GLOBAL / LOCATION_VELBERT / LOCATION_UCKERATH_EITORF) wird in verschiedenen Dashboard-Tabs unterschiedlich unterstützt:
- LiquidityMatrixTable: ✅ Scope-Support
- RollingForecastChart: ✅ Scope-Support
- RevenueTable: ❌ Zeigt immer globale Daten
- BankAccountsTab: ❌ Zeigt immer alle Konten

Dies führt zu Inkonsistenz: Nutzer sieht in Matrix nur Velbert-Zahlen, in Revenue aber globale Zahlen → Verwirrung.

### Entscheidung

Quick-Fix: Tabs ohne Scope-Support werden ausgeblendet, wenn Scope ≠ GLOBAL.

```typescript
const tabsWithoutScopeSupport = new Set(["revenue", "banks"]);

if (scope !== "GLOBAL" && tabsWithoutScopeSupport.has(tab.id)) {
  return false; // Tab ausblenden
}
```

Nutzer sieht Banner: "Standort-Ansicht: Einnahmen/Banken-Tabs ausgeblendet (zeigen nur globale Daten)"

### Begründung

**Warum Quick-Fix statt Proper Scope-Support?**
- ✅ Verhindert sofort inkonsistente Zahlen
- ✅ System bleibt nutzbar und konsistent
- ✅ Pragmatisch: 5 Min vs 45 Min
- ✅ Kein Risiko falscher Interpretationen

**Warum nicht einfach ignorieren?**
- ❌ Verwirrung untergräbt Vertrauen in Zahlen
- ❌ IV könnte falsche Schlüsse ziehen
- ❌ Professionelles Tool darf keine inkonsistenten Daten zeigen

### Konsequenzen

**Kurzfristig:**
- Weniger Features in Standort-Ansicht (nur Matrix + Forecast)
- Aber: Alle sichtbaren Zahlen sind konsistent

**Nächster Schritt:**
- Proper Scope-Support für RevenueTable + BankAccountsTab implementieren (siehe TODO.md)
- API-Routes erweitern: `?scope=...` Parameter
- Komponenten erweitern: `scope` Prop
- Quick-Fix entfernen

**Dateien betroffen:**
- `/app/src/components/dashboard/UnifiedCaseDashboard.tsx` (Tab-Filter-Logik)
- `/app/docs/TODO.md` (Proper Scope-Support dokumentiert)
