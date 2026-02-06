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
