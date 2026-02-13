# Architektur-Entscheidungen

Dieses Dokument dokumentiert wichtige Architektur- und Design-Entscheidungen.

---

## ADR-065: Dashboard-Übersicht von 6 auf 3 Sektionen + Bereinigte Liquidität als Hero

**Datum:** 13. Februar 2026
**Status:** Akzeptiert

### Problem

1. **End-Liquidität ~220K EUR zu hoch:** Altforderungen (~253K) flossen als Einzahlungen in die Planung, aber die Rückzahlung an die Banken (Globalzession) fehlte als Auszahlung. Die Massekredit-Berechnung existierte bereits (`calculate-massekredit.ts`), war aber nicht in die Dashboard-API integriert.
2. **Übersicht überladen (6 Sektionen):** KPI-Karten + DataSourceLegend (volle Karte) + RollingForecastChart + WaterfallChart + RollingForecastTable + LiquidityTable. Zu viele Informationen für einen 5-Minuten-Blick.
3. **Irreführende KPIs:** „Aktueller Stand" zeigte 0 EUR (Plan startet bei 0), „Tiefster Stand" war ebenfalls 0 EUR (verglich gegen Opening Balance).

### Entscheidung

1. **Bereinigte Liquidität als Hero-Zahl:** End-Liquidität MINUS Netto-Bankforderungen (nach Fortführungsbeitrag + USt). Dynamisch berechnet aus bestehender Massekredit-Engine, keine Hardcodes.
2. **ExecutiveSummary 3-Spalten:** Kontostand aktuell (Banksaldo) | Tiefster Stand (niedrigster Closing Balance) | Bereinigte Prognose (Hero). Klar getrennte Kontexte.
3. **Übersicht auf 3 Sektionen reduziert:** ExecutiveSummary + DataSourceLegend (compact) + RollingForecastChart. WaterfallChart → Vergleich-Tab, Tabellen → eigene Tabs.
4. **Dünner Wrapper statt Logik-Duplikation:** `dashboard-massekredit-summary.ts` ruft bestehende `loadBankMassekreditInputs()` + `calculateCaseMassekreditSummary()` auf.
5. **Parallel in Promise.all:** Massekredit-Berechnung läuft parallel zu LedgerEntry-Count + BankBalances. Keine zusätzliche API-Latenz.

### Begründung

- Der IV will eine einzige Zahl: „Wie viel bleibt nach Rückzahlung der Banken?" Alles andere ist Kontext.
- WaterfallChart und Tabellen sind Analyse-Tools, kein Executive Summary.
- Massekredit-Berechnung war bereits implementiert und getestet – nur die Dashboard-Integration fehlte.
- Graceful Fallback: Fälle ohne BankAgreements zeigen einfach den End-Bestand ohne Bereinigung.

### Konsequenzen

- Neue Fälle mit BankAgreements bekommen automatisch die bereinigte Ansicht
- Fälle ohne BankAgreements zeigen „Prognose Planungsende" statt „Bereinigte Prognose"
- External/Share-View zeigt WaterfallChart als Fallback (kein API-Zugang für RollingForecast)
- minCash vergleicht nur Closing Balances (Opening Balance = 0 wäre irreführend)

### Relevante Dateien

- `app/src/lib/credit/dashboard-massekredit-summary.ts` — Shared Helper
- `app/src/components/dashboard/ExecutiveSummary.tsx` — 3-Spalten-KPI
- `app/src/components/dashboard/UnifiedCaseDashboard.tsx` — Vereinfachte Übersicht
- `app/src/types/dashboard.ts` — `MassekreditSummaryData` Interface

---

## ADR-064: Business-Logic-Seiten dynamisch aus DB + Case-Config-Registry

**Datum:** 13. Februar 2026
**Status:** Akzeptiert

### Problem

Beide Business-Logic-Seiten (Dashboard-Tab `BusinessLogicContent.tsx` und Admin-Seite `business-logic/page.tsx`) enthielten alle Werte als hardcoded Strings im JSX. Bei Änderungen im realen Verfahren (z.B. apoBank-Massekreditvertrag im Januar 2026 vereinbart) wurde das UI nie aktualisiert. Konkrete Fehler: apoBank als „KEINE Vereinbarung", HZV mit KV-Regel (1/3:2/3 statt 28/31:3/31), nur SPK-Massekredit statt beide Banken, Fortführungsbeitrag von Netto statt Brutto.

### Entscheidung

1. **Business-Context API** (`/api/cases/[id]/business-context`): Aggregiert ALLE Stammdaten in einem Request (7 parallele Prisma-Queries + Case-Config). Keine Ledger-Berechnungen — nur Konfiguration.
2. **Case-Config-Registry** (`/lib/cases/registry.ts`): Mappt `caseNumber` auf Config-Bundle (Settlers, Legal References). Settlement-Rules kommen aus fallspezifischer `config.ts` (nicht aus DB).
3. **Types als Kontrakt** (`/lib/types/business-context.ts`): Saubere TypeScript-Interfaces für die API-Response. BigInt als String serialisiert.
4. **Beide Seiten refactored**: Laden alle Daten dynamisch. Neue Fälle brauchen nur DB-Daten + optional `config.ts` für Settlement-Rules.

### Begründung

- Settlement-Rules bleiben in `config.ts` statt DB, weil sie fachlich komplex sind (Split-Ratios, Rechtsgrundlagen, Fallback-Regeln) und sich selten ändern
- Stammdaten (Banken, Standorte, Mitarbeiter, IVNotes) kommen aus DB, weil sie über Admin-UI gepflegt werden
- Ein aggregierter Endpoint statt vieler Einzelaufrufe: Performance + Einfachheit
- Keine Ledger-Queries im Business-Context: Trennung von Stammdaten und Berechnungen

### Konsequenzen

- Neue Fälle: `config.ts` anlegen + in Registry registrieren, UI funktioniert automatisch
- Fälle ohne Registry-Eintrag: Settlement-Sektionen werden ausgeblendet, Rest funktioniert
- Massekredit-Berechnung bleibt im separaten `/api/cases/[id]/massekredit` Endpoint

### Relevante Dateien

- `app/src/lib/types/business-context.ts` — Response-Types
- `app/src/lib/cases/registry.ts` — Case-Config-Registry
- `app/src/app/api/cases/[id]/business-context/route.ts` — API-Endpoint
- `app/src/components/business-logic/BusinessLogicContent.tsx` — Dashboard-Tab
- `app/src/app/admin/cases/[id]/business-logic/page.tsx` — Admin-Seite

---

## ADR-063: DELTA-Perspektive immer NEUMASSE + NEUTRAL-Filter

**Datum:** 13. Februar 2026
**Status:** Akzeptiert

### Kontext

Drei fachliche Fehler im Standort-Vergleich (v2.52.0):
1. NEUTRAL-Entries (Auskehrungen, interne Kontoüberträge, 126K EUR) wurden bei positiven Beträgen als Revenue gezählt.
2. DELTA nutzte das POST-Ergebnis mit dem aktuellen Estate-Filter. Bei „GESAMT" enthielt DELTA Altforderungen – unfairer Vergleich.
3. Info-Banner waren ungenau: DELTA zeigte nicht, dass nur NEUMASSE verglichen wird; PRE zeigte nicht die Datenlage.

### Entscheidung

1. **NEUTRAL-Filter global:** `legalBucket: { not: "NEUTRAL" }` in der Location Compare API WHERE-Clause. Gilt für BEIDE Perspektiven. MASSE, ABSONDERUNG, UNKNOWN bleiben drin.

2. **DELTA immer NEUMASSE via Konstante:** `const DELTA_ESTATE_FILTER = "NEUMASSE" as const` – nie aus dem UI-State abgeleitet. Eigener `deltaPostRawData` State mit separatem useEffect. Optimierung: Wenn POST bereits mit NEUMASSE geladen ist, wird kein Extra-Fetch gemacht.

3. **Präzise Banner:** DELTA zeigt „ISK-Neumasse – laufender Betrieb (Y Mon.)", PRE zeigt „Geschäftskonten-Daten (X Mon.)".

### Begründung

- **Neumasse ist leistungszeitbezogen, nicht kontobezogen.** DELTA misst operative Tragfähigkeit → nur NEUMASSE ist sinnvoll.
- **NEUTRAL-Entries sind kein Ertrag.** Auskehrungen zwischen eigenen Konten sind Geldverschiebungen, keine wirtschaftliche Leistung.
- **Defensive Konstante statt State-Ableitung:** Verhindert, dass spätere UI-Refactors versehentlich den DELTA-Filter korrumpieren.
- **ABSONDERUNG existiert aktuell nicht in den Daten.** Wird bei Bedarf später ergänzt.

### Konsequenzen

- Standort-Revenue-Zahlen sinken (NEUTRAL rausgefiltert) – fachlich korrekt
- DELTA zeigt immer NEUMASSE, auch wenn POST auf GESAMT steht – gewünscht
- 1 zusätzlicher API-Call wenn POST nicht auf NEUMASSE steht (Optimierung greift im Default-Case)
- ADR-062 (Perspektiven-Modell) bleibt gültig, wird um diesen ADR ergänzt

---

## ADR-062: Standort-Vergleich Perspektiven-Modell (accountType + perspective)

**Datum:** 13. Februar 2026
**Status:** Akzeptiert

### Kontext

Der Standort-Vergleich mischte ISK-Daten (post-insolvency) mit Geschäftskonten-Daten (pre-insolvency) in einer Ansicht. Das ist fachlich unsauber: Ein IV will wissen (a) ob Standorte im Verfahren tragfähig sind, (b) wie die Lage vor Insolvenz war, und (c) was sich verändert hat.

### Entscheidung

1. **`accountType` auf BankAccount** (ISK | GESCHAEFT) als semantische Klassifikation. Initial abgeleitet aus `isLiquidityRelevant`, aber eigenständiges Konzept (isLiquidityRelevant steuert Matrix-Einbeziehung, accountType klassifiziert den Kontotyp).

2. **`perspective` Query-Parameter** (POST | PRE) auf der Location Compare API. POST filtert auf ISK-Konten + NULL-bankAccountId (operative Entries). PRE filtert strikt auf Geschäftskonten. Estate-Filter nur bei POST aktiv.

3. **Client-seitige Delta-Berechnung** statt separatem DELTA-Endpoint. Client ruft POST und PRE parallel ab, berechnet Ø/Monat-Deltas lokal. Unterschiedliche Monatsanzahlen werden korrekt berücksichtigt.

### Begründung

- **accountType statt Bank-Name-Matching:** Explizites Feld ist robuster als String-Matching auf Bankname/IBAN. Neue Bankkonten werden einmal klassifiziert.
- **perspective statt getrennte Endpoints:** Ein Endpoint mit Parameter ist einfacher zu warten. Gleiche Aggregationslogik, nur anderer Daten-Scope.
- **Client-seitiger Delta:** Kein zusätzlicher API-Call nötig, flexibles UI (Toggle zwischen 3 Perspektiven), keine Server-Last für Delta-Berechnung.

### Konsequenzen

- Turso-Migration nötig (einmalig): `ALTER TABLE + UPDATE`
- Seed-Daten müssen accountType setzen
- Delta-Perspektive zeigt immer Ø/Monat (keine ViewMode/Estate-Toggle)
- PRE-Perspektive zeigt Info-Banner über ggf. unkategorisierte Geschäftskonten-Daten

---

## ADR-061: Estate-Filter im IST/PLAN-Vergleich server-seitig

**Datum:** 13. Februar 2026
**Status:** Akzeptiert

### Kontext

Die Liquiditätsmatrix hat einen Estate-Filter (Gesamt/Alt/Neu/Unklar), der **client-seitig** funktioniert: Zeilen werden nach Row-ID gefiltert (z.B. `altforderung_*` ausblenden). Der IST/PLAN-Vergleich hat keine benannten Zeilen – er aggregiert Perioden-Buckets direkt aus LedgerEntries.

### Entscheidung

Estate-Filter im IST/PLAN-Vergleich wird **server-seitig** angewandt:
- Filterung auf `estateAllocation` in der API-Route
- PLAN-Entries werden immer behalten (Estate-Allocation ist nur für IST relevant)
- MIXED-Entries erscheinen in beiden Sichten (Alt und Neu)
- UNKLAR-Filter fängt auch `null`-Werte ab

### Begründung

Client-seitiger Filter ist nicht möglich, weil die Aggregation (Inflows/Outflows pro Periode) bereits in der API passiert. Die API müsste entweder alle Entries einzeln zurückgeben (zu groß) oder pro Estate-Variante eigene Aggregationen berechnen (unnötig komplex). Server-seitiger Filter vor der Aggregation ist die einfachste und korrekteste Lösung.

### Konsequenzen

- Estate-Filter löst einen neuen API-Request aus (statt client-seitiger Toggle)
- Dafür: Korrekte Aggregation garantiert, keine redundanten Daten im Response
- Konsistenz mit Matrix-Filter: Gleiche Button-Labels, gleiches UX-Verhalten

---

## ADR-060: Legacy-Dashboard-Code entfernen

**Datum:** 13. Februar 2026
**Status:** Akzeptiert

### Kontext

Nach dem Umbau auf `UnifiedCaseDashboard` (v2.29.0) und `ForecastSpreadsheet` (v2.31.0) existierten zwei parallele Dashboard-Systeme:
- **ALT:** `ConfigurableDashboard` + `EditableCategoryTable` (CashflowCategory/Line/PeriodValue UI)
- **NEU:** `UnifiedCaseDashboard` + LedgerEntry-Aggregation + ForecastAssumptions

Das alte System war seit Wochen vollständig ersetzt, aber ~8.800 Zeilen toter Code existierten noch.

### Entscheidung

Alle 26 Legacy-Dateien löschen:
- 2 Seiten (`dashboard/page.tsx`, `config/page.tsx`)
- 10 Legacy-Komponenten (ConfigurableDashboard, EditableCategoryTable, PlanStructureManager, etc.)
- 4 verwaiste Komponenten (CustomerAccessManager, ShareLinksManager, LineageViewer)
- 6 API-Routen (plan/categories, plan/lines, plan/values, plan/opening-balance)
- 4 Library-Dateien (lib/case-dashboard/)
- 1 Barrel Export

### Begründung

- **Kein aktiver Code importiert** eine der gelöschten Dateien (per Grep verifiziert)
- Sidebar-Links waren bereits entfernt
- Toter Code erhöht Verwirrung und Build-Größe
- CashflowCategory/Line/PeriodValue **Prisma-Modelle bleiben erhalten** (werden von `/api/calculate`, Share-API und Customer-API genutzt)

### Konsequenzen

- ~8.800 Zeilen weniger Code
- `/admin/cases/[id]/config` und `/admin/cases/[id]/dashboard` existieren nicht mehr als Routen
- 6 API-Endpunkte weniger
- `lib/case-dashboard/` existiert nicht mehr

---

## ADR-059: System Health Panel als eigene Route

**Datum:** 13. Februar 2026
**Status:** Akzeptiert

### Kontext

Diagnose- und Konfigurationsinformationen waren über 5+ Seiten verstreut: DataQualityBanner auf dem Dashboard, AggregationStatusBanner, Import-Historie auf der Ingestion-Seite, Share-Link-Status auf der Freigaben-Seite. Ein Admin musste mehrere Seiten besuchen um den Gesamtzustand eines Falls zu verstehen.

Check 6 (Gegenparteien ohne Match-Pattern) war im DataQualityBanner platziert, ist aber ein Konfigurations-Thema, kein Datenqualitäts-Problem.

### Alternativen betrachtet

1. **Hilfe-Seite erweitern:** Verworfen – Hilfe ist für End-User (IV), nicht für System-Diagnose. Keine Tab-Struktur, keine API-Calls.
2. **Dashboard-Tab hinzufügen:** Verworfen – Dashboard ist bereits komplex. System-Status ist orthogonal zum Inhalt.
3. **Eigene Route `/system`:** Gewählt – ermöglicht Auto-Refresh, Action-Buttons, klare Trennung.

### Entscheidung

- Eigene Route `/admin/cases/[id]/system` als Client Component
- Kein neuer API-Endpoint – nutzt 5 bestehende APIs parallel (`data-quality`, `validate-consistency`, `aggregation?stats=true`, `import-jobs`, `share`)
- Check 6 aus DataQualityBanner entfernt, Summen im Banner nur für Checks 1–5
- Auto-Refresh alle 30 Sekunden
- Sidebar-Link im Bottom-Bereich (neben "Fall bearbeiten")

### Konsequenzen

- **Positiv:** Zentraler Überblick über Fall-Gesundheit, Check 6 an semantisch korrekter Stelle
- **Positiv:** Kein neuer API-Endpoint, minimale Backend-Änderungen
- **Negativ:** 5 parallele API-Calls beim Laden (akzeptabel, da APIs leichtgewichtig)
- **Offen:** Bei Bedarf weitere Checks/Sektionen ergänzbar (z.B. Classification Rules, Turso-Sync-Status)

### Folgemaßnahme: Bereinigung redundanter Anzeigen

Nach Einführung des System Health Panels wurden alle redundanten Diagnose-Anzeigen entfernt:
- `DataQualityBanner.tsx` gelöscht (war auf Dashboard)
- `DataQualityPanel.tsx` gelöscht (war Block 1 auf Berechnungsannahmen)
- `AggregationStatusBanner.tsx` gelöscht (verwaist)

**Regel für die Zukunft:** System-Diagnose (Datenqualität, Checks, Aggregation, Import-Status, Share-Links) wird ausschließlich im System Health Panel angezeigt. Keine Duplikation auf anderen Seiten. Neue Diagnose-Features gehören in `/system`, nicht in Dashboard oder andere Tabs.

---

## ADR-058: Berechnungsannahmen-Tab – 3-Block-Architektur

**Datum:** 13. Februar 2026
**Status:** Akzeptiert

### Kontext

Der ehemalige "Prämissen"-Tab mischte drei verschiedene Dinge:
1. **Systemstatus** (Datenbasis, Entry-Counts) – ändert sich automatisch, sollte nie manuell gepflegt werden
2. **Falldokumentation** (Sparkasse-Vertrag, apoBank-Risiko) – gehört zum Case, nicht zum Plan
3. **Berechnungsannahmen** (Forecast-Parameter) – gehört zur Prognose-Engine

Das Modell `PlanningAssumption` war Plan-gebunden (`planId` + `categoryName` Unique-Constraint), obwohl Annahmen fallweit gelten. `riskLevel` (low/medium/high) war ein generisches Risikolevel ohne fachliche Aussagekraft.

### Entscheidung

Redesign in 3 klar getrennte Blöcke auf einem Tab "Berechnungsannahmen":

**Block 1 – Datenqualität (auto):** Live-Metriken aus DB (IST/PLAN-Count, Confirmed%, Estate-Breakdown). Neuer API-Endpoint `/api/cases/[id]/data-quality`. Nie manuell editierbar.

**Block 2 – Planungsannahmen (Dokumentation):** `PlanningAssumption` refactored auf Case-Level (`caseId` statt `planId`). Neue Felder: `title` (statt `categoryName`), `status` (ANNAHME/VERIFIZIERT/WIDERLEGT statt riskLevel), `linkedModule` (dynamischer Link zu Stammdaten-Modul).

**Block 3 – Prognose-Annahmen (Berechnung):** `ForecastAssumption` erweitert um Methodik (method, baseReferencePeriod) und quantitatives Risiko (riskProbability 0.0–1.0, riskImpactCents, riskComment). Read-only im Tab, editierbar im Prognose-Editor.

### Begründung

1. **Systemstatus ≠ Annahme:** Entry-Counts und Confirmed% ändern sich ständig – sie als Prämisse zu speichern ist per Definition veraltet.
2. **Case-Level statt Plan-Level:** Annahmen wie "apoBank verweigert Vereinbarung" gelten für den ganzen Fall, nicht für einen spezifischen Plan.
3. **Dynamische Links statt Duplikation:** `linkedModule: "banken"` verweist auf `/banken-sicherungsrechte`, wo die Daten gepflegt werden. Keine Kopie.
4. **Quantitatives Risiko:** `riskProbability` + `riskImpactCents` ermöglicht echte Sensitivitätsanalyse statt vager "medium"-Labels.

### Konsequenzen

- **Migration:** 11 bestehende PlanningAssumptions auf neue Felder migriert (Turso + lokal)
- **Alte Spalten:** `categoryName` und `riskLevel` bleiben in Turso-Schema (SQLite kann keine Spalten droppen), werden aber nicht mehr gelesen
- **Breaking Change:** Alle APIs liefern jetzt `title`/`status` statt `categoryName`/`riskLevel`
- **Portal:** Zeigt Block 2 + Block 3 (mit `visibilityScope: "EXTERN"` Filter)

---

## ADR-057: Check 6 – Gegenparteien ohne Match-Pattern

**Datum:** 13. Februar 2026
**Status:** Akzeptiert

### Kontext

Check 4 (Pattern-Match-Validierung) war fast nutzlos: 555 von 580 Entries wurden übersprungen, weil nur 3 von ~30 Counterparties ein `matchPattern` hatten. 7 Entries waren falsch `cp-privatpatienten` zugewiesen (D.O.C., mediDOK, united-domains), ohne dass ein Check das erkennen konnte.

### Entscheidung

Neuer Check 6 „Gegenparteien ohne Match-Pattern" mit Entry-Count-Schwelle ≥ 5:
- Nur CPs mit 5+ IST-Entries (ohne interne Transfers) werden gewarnt
- One-off-CPs (< 5 Entries) werden bewusst ignoriert
- Deep-Link auf Counterparties-Seite mit `?filter=NO_PATTERN`
- `entryId`-Feld nutzt `cp:`-Prefix (ist kein LedgerEntry, sondern Counterparty)

### Begründung

1. **Schwellwert vermeidet Rauschen:** ~55 CPs haben 1-4 Entries – Patternisierung für diese wäre Overengineering.
2. **Sichtbarkeit statt Zwang:** Check macht Pattern-Lücken sichtbar, erzwingt aber keine automatische Patternisierung.
3. **Kreislauf:** Check 6 senkt Pattern-Lücken → Check 4 wird effektiver → Fehlzuordnungen werden erkannt.

### Konsequenzen

- CPs mit 5+ Entries ohne Pattern erscheinen als Warnung im Dashboard
- Nach Pattern-Ergänzung: Check 4 Skipped sinkt, Check 6 Warnings sinken
- Bei neuen Fällen: CPs die über UI/Scripts erstellt werden, starten ohne Pattern – Check 6 warnt automatisch ab 5 Entries

---

## ADR-056: Lokale ↔ Turso Synchronisations-Pflicht

**Datum:** 13. Februar 2026
**Status:** Akzeptiert

### Kontext

Über mehrere Wochen entstand eine stille Datendrift zwischen lokaler SQLite-Entwicklungsdatenbank und Turso-Production:
- 47 ISK-Zahlbeleg-Entries (Frau Dupke, 12.02.2026) nur lokal importiert, nie synchronisiert
- 56 PaymentBreakdownItems + 18 Sources nur lokal
- 91 Vor-Insolvenz-Counterparties (von Scripts erzeugt) nur lokal, mit 200 Entry-Referenzen via `suggestedCounterpartyId`
- 2 IV-Notizen, 1 Share-Link nur lokal

Der Drift wurde erst entdeckt, als ein Entry-Count-Abgleich (3425 lokal vs. 3378 Turso) auffiel. Ohne diesen manuellen Check wäre der Drift unbemerkt geblieben.

### Entscheidung

**Neue Pflicht-Regel:** Nach jedem Daten-Import oder Script-Ausführung, die Daten in die lokale DB schreibt, MUSS ein Abgleich mit Turso erfolgen. Checkliste:

1. **Sofort nach Import/Script:** `SELECT COUNT(*) FROM ledger_entries WHERE valueType='IST'` auf beiden DBs vergleichen
2. **Vor jedem Deploy:** Kurzer Tabellen-Count-Abgleich (ledger_entries, counterparties, payment_breakdown_items)
3. **Sync-Richtung:** Lokal → Turso (lokale DB ist Entwicklungs-Wahrheit für Imports)
4. **Werkzeug:** `sqlite3 dev.db ".mode insert" "SELECT * FROM table WHERE ..."` → `turso db shell` pipen

### Begründung

1. **Daten sind die heilige Kuh:** Cent-genaue Korrektheit ist Kernversprechen der Anwendung.
2. **Stiller Drift ist gefährlicher als lauter Fehler:** Die App funktioniert mit veralteten Turso-Daten scheinbar normal.
3. **Kein automatischer Sync gewünscht:** Bidirektionaler Sync ist komplex und fehleranfällig. Expliziter, manueller Sync mit Verifikation ist sicherer.

### Konsequenzen

- Jeder Import hat jetzt einen expliziten „Turso-Sync"-Schritt
- CLAUDE.md „Häufige Fehler" enthält Warnung
- Bei Diskrepanz: Sofort klären, nie ignorieren
- Langfristig: Automatischen Count-Check in CI/CD oder Dashboard einbauen

---

## ADR-055: Ledger Fast-Path (DB-Pagination + Aggregate-Stats)

**Datum:** 13. Februar 2026
**Status:** Akzeptiert

### Kontext

Die Ledger-Route lud bei jedem Request ALLE LedgerEntries (3.378 bei HVPlus), auch wenn nur eine Seite (50 Entries) angezeigt wurde. Ursache: Der Turso-Adapter-Bug bei Prisma-Date-Filtern (ADR-046) erzwang JS-seitige Filterung, was DB-Pagination unmöglich machte – auch wenn gar kein Datumsfilter aktiv war.

### Entscheidung

Zwei getrennte Pfade in der Ledger-API:

1. **Fast-Path (ohne Datumsfilter):** DB-seitige Pagination (`skip`/`take`) + 3 parallele Aggregate-Queries (`totalCount`, `amountSum`, `reviewStatusCounts`). Das ist der Normalfall beim Seitenaufruf.
2. **Fallback (mit Datumsfilter):** Alle Entries laden, in JS filtern, dann in JS paginieren – wie bisher, wegen Turso-Adapter-Bug.

Zusätzlich: Dimensions (Bankkonten, Gegenparteien, Standorte) werden in die Ledger-Response eingebettet, statt als separate API-Calls geladen.

### Begründung

1. **Proportionale Lösung:** Der Turso-Bug betrifft nur Date-Filter. Bei allen anderen Filtern (Counterparty, BankAccount, ValueType, etc.) funktioniert Prisma WHERE korrekt → DB-Pagination möglich.
2. **80/20-Optimierung:** ~80% der Ledger-Aufrufe haben keinen Datumsfilter. Der Fast-Path deckt den Normalfall ab.
3. **Parallele Aggregate-Queries:** `totalCount`, `amountSum` und `reviewStatusCounts` laufen als 3 separate Prisma-Queries parallel, statt alle Entries zu laden und in JS zu aggregieren.
4. **Dimensions-Embedding:** Spart 3 API-Roundtrips beim Seitenaufruf (7→4 Calls). Stammdaten ändern sich selten und sind klein.

### Konsequenzen

- Ledger-Seitenaufruf: 1 schwere Query (alle 3.378 Entries) → 5 leichte parallele Queries
- Frontend: `fetchData` aufgeteilt in statische Daten (Mount) und dynamische Entries (Filter). 400ms Debounce auf Filter-Änderungen.
- Fallback-Pfad bleibt für Datumsfilter bis Turso-Adapter-Bug gefixt

---

## ADR-054: Vercel Functions Region = fra1 (Frankfurt)

**Datum:** 13. Februar 2026
**Status:** Akzeptiert

### Kontext

Vercel Functions liefen in der Default-Region `iad1` (Washington, US East). Die Turso-Datenbank liegt in `aws-eu-west-1` (Frankfurt). Jede DB-Query hatte ~100ms transatlantische Latenz. Bei 8 Queries pro Ledger-Request = ~800ms verschwendete Netzwerkzeit.

### Entscheidung

`vercel.json` mit `"regions": ["fra1"]` konfiguriert. Alle Serverless Functions laufen jetzt in Frankfurt, am selben Standort wie die Turso-DB.

### Begründung

1. **Messbare Verbesserung:** Warm-Start Ledger-Request: 3.2s → 1.2s (~60% schneller).
2. **Kein Trade-Off für unsere Nutzer:** Alle Nutzer (Insolvenzverwalter, Berater) sitzen in Deutschland. Nähe zum User UND zur DB.
3. **Minimaler Eingriff:** Eine Zeile in `vercel.json`, kein Code-Change.

### Konsequenzen

- Alle API-Routen laufen in Frankfurt
- DB-Roundtrip: ~100ms → <5ms
- Bei internationalen Nutzern (unwahrscheinlich) wäre Latenz höher

---

## ADR-053: Automatische Datenqualitäts-Checks als Dashboard-Banner

**Datum:** 12. Februar 2026
**Status:** Akzeptiert

### Kontext

In der manuellen Datenprüfung wurden drei Kategorien von Inkonsistenzen gefunden:
1. 12 KV-Entries mit `counterpartyId` aber ohne `categoryTag` → Altforderungen-Zeile in Matrix leer
2. 2 Entries fälschlich als KV klassifiziert (PKV Institut, ADAC) weil Regex `(KV|KVNO|Kassenärztliche)` zu breit
3. 5 KV-Entries mit falschem `estateAllocation` (Quartal nicht korrekt berücksichtigt)

Kein System erkannte diese Probleme proaktiv – sie wurden erst zufällig bei der Matrix-Prüfung entdeckt.

### Entscheidung

Automatische, deterministische Konsistenzprüfung mit 5 Checks:

1. **counterpartyId ↔ categoryTag** (Fehler): `COUNTERPARTY_TAG_MAP` definiert erwarteten Tag pro Counterparty
2. **categoryTag ohne Counterparty** (Warnung): Inverse Prüfung
3. **estateAllocation ↔ Leistungszeitraum** (Fehler): Quartal-basierte Validierung gegen `case.openingDate`, nur für `QUARTAL_CHECK_TAGS = ['KV']`
4. **Pattern-Match-Validierung** (Warnung): Entry-Beschreibung gegen Counterparty-`matchPattern` (manuelle Zuordnung ist legitim)
5. **Verwaiste Dimensionen** (Fehler): Alle referenzierten IDs müssen in Stammdaten existieren

UI: `DataQualityBanner` auf Case-Dashboard (rot/amber/hidden), nach Vorbild `UnklarRiskBanner`.

### Begründung

1. **Case-spezifische Config:** `COUNTERPARTY_TAG_MAP` liegt in `matrix-config.ts` (bereits case-spezifisch). Jeder neue Fall bekommt seine eigene Map.
2. **Deterministisch:** Keine Heuristiken, kein AI – reiner Regelabgleich gegen definierte Erwartungen.
3. **Severity-Trennung:** Echte Fehler (Tag-Mismatch, falsche Masse-Zuordnung) vs. Warnungen (Pattern-Abweichung = manuelle Zuordnung möglich).
4. **Leistungszeitraum-Priorität:** `servicePeriodStart` > `serviceDate` > Beschreibung-Regex (Fallback). Entries ohne bestimmbares Quartal werden als „skipped" gezählt, nicht als Fehler.
5. **MIXED-Status:** Bei Quartal das Eröffnungsdatum enthält: Nur Status MIXED prüfen, Ratio nicht validieren (vertraglich, nicht geometrisch berechenbar).
6. **KV-Pattern-Fix:** `\bKV\b` statt `KV` verhindert False Positives auf „PKV", „KV624910". Angewendet in matrix-config, seed-hvplus, lokaler DB und Turso.

### Konsequenzen

- Dashboard zeigt proaktiv Datenqualitätsprobleme
- Neue Fälle brauchen eigene `COUNTERPARTY_TAG_MAP` in ihrer matrix-config
- API-Response begrenzt auf max. 20 Items pro Check (Performance)
- UTC-sichere Datumsvergleiche für Quartal-Berechnung

---

## ADR-052: Geschäftskonten-Analyse filtert über isLiquidityRelevant statt allocationSource

**Datum:** 12. Februar 2026
**Status:** Akzeptiert

### Kontext

Die Vorinsolvenz-Analyse (v1) filterte LedgerEntries per `allocationSource: 'PRE_INSOLVENCY'`. Dies erfasste nur Entries, die explizit als vorinsolvenzlich markiert waren – Oktober- und November-Buchungen auf denselben Geschäftskonten mit anderem `allocationSource` fehlten.

### Entscheidung

Statt `allocationSource` wird über `bankAccountId` gefiltert: Alle Entries von Bankkonten mit `isLiquidityRelevant=false` (= Geschäftskonten, keine ISK) werden einbezogen. Die Seite wurde in „Geschäftskonten-Analyse" umbenannt.

Zusätzlich: Rand-Monate mit <5 Entries werden automatisch getrimmt (z.B. 2 Dez-2024-Ausreißer).

### Begründung

1. **Konsistenz:** `isLiquidityRelevant` ist die kanonische Trennung zwischen ISK (Massekonten) und Geschäftskonten. Diese Trennung existiert bereits in der IST-Kontobewegungen-Seite.
2. **Vollständigkeit:** Okt+Nov 2025 haben 260+69 Entries auf Geschäftskonten – alles relevante operative Buchungen, unabhängig von `allocationSource`.
3. **Location-Mapping:** `bankAccountId → bankAccount.locationId` liefert die Standort-Zuordnung, da `locationId` auf Entries selbst NULL ist.

### Konsequenzen

- Analyse zeigt jetzt alle Geschäftskonten-Buchungen (Jan–Nov 2025 für HVPlus)
- Location-Aufschlüsselung funktioniert über BankAccount-Relation (keine Schema-Änderung nötig)
- Sidebar-Link heißt „Geschäftskonten" statt „Vorinsolvenz"

---

## ADR-051: FALLDATEN-Sektion als Infrastruktur für fallspezifische Stammdaten

**Datum:** 12. Februar 2026
**Status:** Akzeptiert

### Kontext

Bei der Analyse von DATEV-Lohnjournalen (HVPlus) wurden 44 Mitarbeiter mit monatlichen Gehaltsdaten extrahiert. Diese Daten passen nicht in die bestehenden Sidebar-Sektionen (STAMMDATEN = systemweite Konfiguration, VERFAHREN = insolvenzrechtliche Aspekte). Gleichzeitig sind „Banken & Sicherungsrechte" und „Finanzierung" thematisch eher Falldaten als Verfahrensaspekte.

### Entscheidung

Neue Sidebar-Sektion **FALLDATEN** zwischen STAMMDATEN und VERFAHREN:
- **Personal** (Mitarbeiter + Gehaltsdaten) — NEU
- **Kontakte** (Ansprechpartner) — NEU
- **Banken & Sicherungsrechte** — verschoben aus VERFAHREN
- **Finanzierung** — in Sidebar aufgenommen (existierte als Page)

Drei neue Prisma-Modelle: `Employee`, `EmployeeSalaryMonth`, `CaseContact`.

### Begründung

1. **Klar abgegrenzt:** STAMMDATEN = Bankkonten/Gegenparteien/Standorte (konfigurativ). FALLDATEN = fallspezifische Informationen (Personal, Kontakte, Finanzierungsstruktur). VERFAHREN = insolvenzrechtliche Aspekte (Insolvenzeffekte).
2. **Erweiterbar:** FALLDATEN kann zukünftig um Verträge, Mietverträge, Versicherungen etc. ergänzt werden.
3. **Employee-Modell mit SalaryMonths:** Monatsgehälter als separate Tabelle statt JSON-Blob ermöglicht Aggregation und Filterung auf DB-Ebene.
4. **CaseContact statt allgemeinem Contact:** Case-gebunden (nicht global), da Ansprechpartner pro Verfahren variieren.

### Konsequenzen

- Sidebar hat jetzt 7 Sektionen (DATEN, STAMMDATEN, FALLDATEN, VERFAHREN, PLANUNG, ANALYSE, ZUGANG)
- VERFAHREN enthält nur noch „Insolvenzeffekte" (könnte langfristig mit FALLDATEN zusammengeführt werden)
- Turso-Migration für 3 neue Tabellen + 5 Indexes ausgeführt

---

## ADR-050: Dark Mode via CSS-Variablen + Globale Tailwind-Overrides

**Datum:** 12. Februar 2026
**Status:** Akzeptiert

### Kontext

Die App verwendet ~57 Dateien mit hardcoded `bg-white` und ~115 Stellen mit `bg-gray-*`/`bg-slate-*` Tailwind-Klassen. Ein vollständiges Refactoring aller Dateien zu CSS-Variablen wäre unverhältnismäßig aufwändig.

### Entscheidung

**Hybrid-Ansatz:** CSS-Variablen-System + globale Dark-Mode-Overrides.

1. **Alle Design-Tokens als CSS-Variablen** in `:root` (Light) und `[data-theme="dark"]` (Dark)
2. **globals.css Klassen** (.admin-card, .btn-*, .input-field, etc.) nutzen Variablen → schalten automatisch
3. **Globale Overrides** fangen hardcoded Tailwind-Klassen ab:
   ```css
   [data-theme="dark"] .bg-white { background-color: var(--card) !important; }
   [data-theme="dark"] .bg-gray-50 { background-color: var(--accent) !important; }
   ```
4. **Anti-Flash-Script** im `<head>` setzt `data-theme` vor dem ersten Render
5. **ThemeProvider** (React Context) + localStorage für Persistenz

### Begründung

- **Pragmatisch:** 0 Dateien anfassen vs. 57+ Dateien refactoren
- **Wartbar:** Neue Komponenten nutzen automatisch CSS-Variablen
- **Kein Flash:** Inline-Script vor React-Hydration
- **3 Modi:** Light / Dark / System (OS-Preference)

### Konsequenzen

- `!important` in Overrides kann Spezifitäts-Konflikte erzeugen
- Neue Tailwind-Farben (z.B. `bg-indigo-50`) müssen ggf. manuell ergänzt werden
- Print-Styles sind hardcoded Light (korrekt)

### Relevante Dateien

- `src/app/globals.css` – Design-Tokens Light + Dark + Overrides
- `src/components/ThemeProvider.tsx` – React Context + localStorage
- `src/components/ThemeToggle.tsx` – 3-Stufen-Toggle (Light/Dark/System)
- `src/app/layout.tsx` – Anti-Flash-Script + ThemeProvider

---

## ADR-051: Plattform-Rebranding von "Inso-Liquiplanung" zu "Gradify Cases"

**Datum:** 12. Februar 2026
**Status:** Akzeptiert

### Kontext

`cases.gradify.de` soll langfristig eine Vielzahl von Cases der Unternehmensberatung abdecken, nicht nur Insolvenz-Liquiditätsplanung. Der bisherige Name "Inso-Liquiplanung" war:
1. Zu eng (nur IV)
2. Unprofessionell für externe Präsentation (WhatsApp-Preview, LinkedIn)
3. Nicht skalierbar auf zukünftige Case-Typen

### Entscheidung

- **Titel:** "Gradify Cases | Structured Case Management"
- **Beschreibung:** "Structured Case Management Platform"
- **Sprache:** Englisch für Branding/Meta-Tags, Deutsch für UI-Texte

### Begründung

- **Skalierbar:** "Cases" ist generisch genug für IV, Restrukturierung, etc.
- **International:** Englisches Branding wirkt professioneller
- **Konsistent:** "Gradify Cases" als Brand überall gleich (Header, Login, OG-Tags)

### Konsequenzen

- Alle Meta-Tags, Header, Login-Seiten, OG-Image auf "Gradify Cases" aktualisiert
- WhatsApp/LinkedIn-Preview zeigt jetzt professionelles Branding + Bild
- UI-Texte bleiben Deutsch (Zielgruppe: deutsche IV)

---

## ADR-049: Nachhaltige Klassifikation über COUNTERPARTY_ID-Matches in Matrix-Config

**Datum:** 12. Februar 2026
**Status:** Akzeptiert

### Kontext

Die Classification Engine (`suggestCategoryTags()`) konnte IST-Entries nur über `CATEGORY_TAG` (Stage 1, für PLAN), `COUNTERPARTY_PATTERN`, `DESCRIPTION_PATTERN` und `FALLBACK` zuordnen. ~50 Counterparties (Krankenkassen, DRV, Mitarbeiter, IT-Dienstleister, Vermieter etc.) hatten keine passenden Pattern-Matches. Manuelle SQL-Klassifikation (MANUAL_BATCH) war nötig – nicht nachhaltig und bei Re-Import verloren.

Zusätzlich: Sub-Zeilen mit `parentRowId` (z.B. `cash_out_personal_sozial` für SOZIALABGABEN) waren durch den Filter `!row.parentRowId` in `findMatchingRowWithTrace()` unerreichbar. Krankenkassen-Outflows landeten in `cash_out_betriebskosten` statt `cash_out_personal_sozial`.

### Entscheidung

1. **COUNTERPARTY_ID als Match-Typ nutzen** – Exakte Matches auf bekannte Counterparty-IDs direkt in den Matrix-Zeilen-Definitionen. ~50 IDs auf 9 Zeilen verteilt.
2. **parentRowId-Filter entfernen** – Standort-Sub-Rows (leere matches) werden durch `row.matches.length > 0` gefiltert. Sub-Kategorie-Rows mit eigenen Matches sind jetzt erreichbar.
3. **Duale Zuordnung über flowType** – Gleiche Counterparty-ID kann in INFLOW-Zeile (z.B. EINNAHME_SONSTIGE) UND OUTFLOW-Zeile (z.B. SOZIALABGABEN) stehen. Engine filtert über `row.flowType`.

### Begründung

- Config-only Änderung: keine Code-Änderung in der Engine nötig (bis auf den Filter-Fix)
- Nachhaltig: Neue Counterparties werden einmal in matrix-config.ts ergänzt → Pipeline erledigt den Rest
- Zweistufiges Matching bleibt intakt: PLAN-Daten nutzen CATEGORY_TAG (Stage 1), IST-Daten nutzen COUNTERPARTY_ID (Stage 2)
- FALLBACK fängt weiterhin unbekannte Entries auf

### Konsequenzen

- Bei neuen Counterparties: COUNTERPARTY_ID in passende Matrix-Zeile eintragen
- `suggestCategoryTags()` schlägt jetzt den ERSTEN CATEGORY_TAG der gematchten Zeile vor (z.B. BETRIEBSKOSTEN für alle Betriebskosten-Subtypen)
- Sub-Zeilen-Tags (SOZIALABGABEN, ALTVERBINDLICHKEIT_*) sind jetzt direkt vorschlagbar

---

## ADR-048: Mobile Case-Navigation – Server/Client Split + Drawer

**Datum:** 12. Februar 2026
**Status:** Akzeptiert

### Kontext

Das Admin-Dashboard war auf Mobile/Tablet (< 1024px) unbenutzbar: Die Case-Sidebar mit 25+ Navigationslinks war `hidden lg:block` und es gab keinen alternativen Zugang. Insolvenzverwalter und Berater müssen auch unterwegs auf Fall-Daten zugreifen können.

### Entscheidung

1. **Server/Client Split im CaseLayout.** `layout.tsx` bleibt Server Component (Prisma-Fetch), neuer `CaseLayoutClient.tsx` als Client Component für Drawer-State. Vermeidet „use client" auf der Server-Layout-Ebene.
2. **Drawer statt Bottom-Tab-Bar.** Slide-in-Drawer von links mit bestehender `CaseSidebar` (via `className` Prop). Kein Redesign der Navigation nötig, identische Struktur auf Desktop und Mobile.
3. **useMobileSidebar als zentraler Hook.** State-Management, ESC-Key, Route-Change-Close und iOS-Safari-Scroll-Lock (`position: fixed` + `scrollY` Restore) in einem Hook.
4. **CSS-Transitions statt Animation-Library.** `transition-transform` + `transition-opacity` für Drawer und Backdrop. Kein Framer Motion oder ähnliches nötig.
5. **Z-Index als CSS Custom Properties.** Konsistentes Layering-System (`--z-sidebar`, `--z-drawer`, `--z-modal`) statt Magic Numbers.

### Begründung

- Server/Client Split ist Next.js Best Practice – Server Components für Data-Fetching, Client Components für Interaktivität
- Drawer wiederverwendet die bestehende Sidebar → kein doppeltes Navigation-Maintenance
- CSS-only Animationen sind performanter und brauchen keine zusätzliche Dependency
- Z-Index-System verhindert zukünftige Layer-Konflikte

### Konsequenzen

- CaseLayout hat jetzt 2 Dateien statt 1 (`layout.tsx` + `CaseLayoutClient.tsx`)
- `CaseSidebar` akzeptiert optionales `className` Prop (Breaking Change bei externer Nutzung – gibt es nicht)
- Alle neuen Mobile-Elemente sind `lg:hidden`, Desktop-Verhalten bleibt identisch

---

## ADR-047: Creditor und CostCategory als separate Entities

**Datum:** 12. Februar 2026
**Status:** Akzeptiert

### Kontext

Aus dem Lirex-Feature-Abgleich ergaben sich drei Must-Haves: Kreditoren als Entity, Kostenarten pro Fall, Freigabe-Schwellwerte. Die zentrale Design-Frage war: Sollen Kreditoren (Ausgaben-Partner) und Counterparties (Einnahmen-Partner) zusammengelegt werden?

### Entscheidung

1. **Creditor ist eine SEPARATE Entity** von Counterparty. Counterparty = Einnahmen-Partner (KV, HZV, PVS) mit `matchPattern` für Auto-Klassifikation. Creditor = Ausgaben-Partner (Lieferanten, Behörden) mit IBAN, USt-ID, Kategorie.
2. **CostCategory existiert PARALLEL zu categoryTag.** categoryTag ist tief in die Liquiditätsmatrix integriert (12 feste Werte). CostCategory ist für Ausgaben-Planung/Freigaben, optional mit categoryTag-Mapping.
3. **Order.creditor (String) BLEIBT erhalten** als Freitext-Fallback für Token-basierte externe Submissions. Neues `creditorId` FK ist optional.
4. **Auto-Approve erstellt LedgerEntry atomar** – auch kleine Beträge tauchen in der Liquiditätsplanung auf. Schwellwert `<=` (bis einschließlich).

### Begründung

- Counterparty und Creditor haben unterschiedliche Felder, Workflows und Semantik
- Zusammenlegen würde beide Konzepte verwässern und die bestehende Klassifikations-Engine verkomplizieren
- CostCategory als paralleles System vermeidet Breaking Changes an der Liquiditätsmatrix
- Freitext-Fallback für Creditor erlaubt einfache externe Submissions ohne Stammdaten-Pflicht

### Konsequenzen

- Zwei Entity-Typen für „Geschäftspartner" (kann verwirrend sein)
- CostCategory-Budget ist informativ, nicht enforced (keine Warnungen bei Überschreitung)
- Auto-Approve-LedgerEntry hat feste Werte: PLAN, MASSE, NEUMASSE (nicht konfigurierbar)

---

## ADR-046: Turso Date-Filter-Workaround (JS statt Prisma WHERE)

**Datum:** 12. Februar 2026
**Status:** Akzeptiert (temporärer Workaround)

### Kontext

Revenue-Tab auf Production zeigte „Keine Einnahmen" trotz 535 Entries in Turso. Diagnose ergab: `@prisma/adapter-libsql` v6.19.2 generiert fehlerhafte SQL-Vergleiche für Date-Objekte. Turso speichert DateTime als INTEGER (Millisekunden seit Epoch), der Adapter vergleicht jedoch als Strings. Ergebnis: `transactionDate >= '2025-08-12T...'` matcht nie gegen INT-Werte.

**Beweis:** `count({ where: { transactionDate: { gte, lte } } })` → 0, aber `count({})` auf gleichen Daten → 535.

### Entscheidung

1. **Date-Filter aus allen Prisma WHERE-Klauseln entfernen** wo DateTime-Vergleiche auf Turso fehlschlagen
2. **JS-Post-Filter statt DB-Filter:** Alle Entries ohne Date-Filter fetchen, dann in JavaScript filtern
3. **Pagination in JS** für die Haupt-Ledger-Route (vorher Prisma `take`/`skip`, jetzt `Array.slice()`)
4. **Kommentar-Convention:** Jede betroffene Stelle bekommt den Kommentar `// NOTE: Date filter applied in JS (Turso adapter date comparison bug)`

### Begründung

- Adapter-Bug liegt außerhalb unserer Kontrolle (Prisma-seitiges Problem)
- Die Datenmenge ist klein genug (~700 Entries pro Case) für JS-Filterung
- Korrektheit hat Vorrang vor Performance
- Der Workaround ist lokalisiert und leicht rückgängig zu machen

### Konsequenzen

- **Performance:** Alle Entries werden geladen statt nur gefilterte → bei aktueller Datenmenge (<1000 Entries) irrelevant
- **Wartung:** Bei Prisma/Adapter-Update (v7.x) prüfen ob Bug gefixt, dann Workaround rückbauen
- **Konsistenz:** Alle 7+ Stellen mit Date-Filtern müssen den Workaround nutzen – neue Date-Filter in Prisma-Queries sind auf Turso verboten
- **Suchbar:** `grep -r "Turso adapter date comparison bug"` findet alle betroffenen Stellen

---

## ADR-045: Zahlbeleg-Aufschlüsselung als persistierter, wiederkehrender Workflow

**Datum:** 12. Februar 2026
**Status:** Akzeptiert

### Kontext

Sammelüberweisungen (BW-Bank ISK) fassen mehrere Einzelzahlungen zusammen. Im Ledger erscheinen sie als ein Betrag (z.B. -4.993,48 EUR) ohne Empfänger-Details. Für gerichtsfeste Alt/Neu-Zuordnung und Standort-Aggregation müssen die Einzelposten sichtbar sein. Die ISK-Zahlbelege (PDFs) liefern diese Details: Empfänger, IBAN, Betrag, Verwendungszweck.

**Bisheriger Ansatz (verworfen):** Textarea-JSON-Processing im Ledger – einmaliger Hack ohne Persistenz, nicht wiederholbar.

### Entscheidung

1. **Persistierte Datenstruktur:** `PaymentBreakdownSource` (= 1 Zahlbeleg) + `PaymentBreakdownItem` (= 1 Einzelposten). Eigenständige Tabellen, kein neues Feld auf LedgerEntry.
2. **Zwei-Stufen-Workflow:** Upload & Persistierung → Separater, idempotenter Split. Kein Auto-Split bei Upload.
3. **Matching-Kriterien:** caseId + bankAccountId + amountCents (negiert) + transactionDate ±3 Tage + description enthält „SAMMEL". Fallback: Ohne SAMMEL-Keyword wenn Betrag+Datum passen.
4. **Bank-Account-Mapping:** Hardcodiert in `BANK_ACCOUNT_MAPPING` (BW-Bank #400080156 → `ba-isk-uckerath`, #400080228 → `ba-isk-velbert`).
5. **Traceability:** `PaymentBreakdownItem.createdLedgerEntryId` → Child, `PaymentBreakdownSource.matchedLedgerEntryId` → Parent, `splitReason` = „Zahlbeleg PRM2VN, Posten 3/8", Audit-Log mit `breakdownSourceId`.
6. **Summenvalidierung:** Σ Items === |Parent.amountCents| (BigInt-exakt). Invarianten-Test: Aktive Summe === Root-Summe.

### Begründung

- Textarea-JSON ist nicht auditierbar und nicht wiederholbar. Persistierte Sources ermöglichen Nachvollziehbarkeit.
- Zwei Stufen ermöglichen Review zwischen Upload (Matching prüfen) und Split (irreversible Aktion).
- ±3 Tage Toleranz nötig, weil Ausführungsdatum (Zahlbeleg) und Buchungsdatum (Kontoauszug) abweichen können.
- Hardcodiertes Bank-Mapping reicht für den aktuellen Fall; bei neuen Fällen erweiterbar.

### Konsequenzen

- 2 neue Prisma-Modelle, 2 neue API-Routen, 1 neue UI-Komponente
- Zahlbelege müssen als JSON vorliegen (manuell aus PDFs extrahiert und verifiziert, ADR-042)
- Bank-Mapping muss bei neuen Banken manuell erweitert werden
- Workflow ist monatlich wiederholbar: Neue Zahlbelege hochladen → Match prüfen → Split ausführen

---

## ADR-044: Forecast-Tab – Unified Spreadsheet mit Derived State

**Datum:** 12. Februar 2026
**Status:** Akzeptiert

### Kontext

Der Forecast-Tab hatte zwei getrennte Ansichten: eine readonly Prognose-Tabelle und einen separaten Annahmen-Editor mit 8-Felder-Modal. Für 39 Annahmen (HVPlus-Fall) bedeutete das 39× Modal öffnen → 8 Felder ausfüllen → speichern. Periodenauswahl war numerisch ("Periode 2" statt "Dez 2025"), Auswirkungen erst nach Tab-Wechsel sichtbar.

### Entscheidung

1. **Unified Spreadsheet:** Eine Tabelle zeigt IST-Daten und PROGNOSE-Annahmen zusammen. Annahmen sind editierbare Zeilen, Prognose-Werte sind klickbare Zellen.
2. **Inline Quick-Add (4 Felder):** Bezeichnung, Typ, Betrag, Quelle. `flowType` ergibt sich aus dem Block (Einzahlungen/Auszahlungen), `categoryKey` wird automatisch generiert, Perioden-Range ist Default gesamte Prognose.
3. **Detail-Drawer statt Modal:** SlideOver von rechts für erweiterte Felder (20% der Fälle: Wachstumsfaktor, Perioden-Range, Notiz).
4. **SpreadsheetCell-Pattern:** Zentraler `doSave()` mit boolean Return. `skipBlurRef` verhindert Doppel-Save bei Tab. `previousValueRef` für Einmal-Undo.
5. **Derived State für Drawer:** `drawerAssumptionId` als State, `drawerAssumption` abgeleitet aus `assumptions.find()`. Verhindert Stale-Bug nach Toggle/Refresh.
6. **Debounced Parallel Refresh:** `Promise.all([fetchAssumptions(), calculate()])` mit 300ms Debounce und Stale-Counter.

### Begründung

- 39 Annahmen × 8-Felder-Modal = unzumutbar. Inline-Edit mit 4 Feldern + Enter-Bulk-Modus ist 10× schneller.
- Separate State für Drawer-Objekt wird stale nach `refresh()` – Derived State löst das elegant.
- Tab-Navigation muss sequentiell sein: erst Save, dann bei Erfolg navigieren, bei Fehler in Zelle bleiben.

### Konsequenzen

- 8 fokussierte Komponenten statt 1 monolithischer 1.274-Zeilen-Datei
- API-Routes, Forecast-Engine und Prisma-Schema unverändert
- Dashboard-Integration (RollingForecastTable) unberührt

---

## ADR-043: Portal-Konsolidierung – Ein Dashboard statt Standalone-Seiten

**Datum:** 12. Februar 2026
**Status:** Akzeptiert

### Kontext

Das Kundenportal hatte zwei konkurrierende Navigations-Systeme:
- **System A (Legacy):** 4 Standalone-Seiten (revenue, estate, banken-sicherungsrechte, compare) mit eigener `DashboardNav`, eigenen Typen, teils hardcodierten Daten
- **System B (Aktuell):** `UnifiedCaseDashboard` auf `/portal/cases/[id]/` mit internen Tabs, echten API-Daten, Scope-Filter

Beide Systeme waren parallel erreichbar, was zu Verwirrung führte: Standalone-Seiten zeigten teilweise veraltete/andere Daten als das Dashboard.

### Entscheidung

1. **Alle 6 Standalone-Routen** (revenue, estate, banken-sicherungsrechte, compare, finanzierung, security) durch `redirect()` auf `/portal/cases/${id}` ersetzen
2. **Dead Code entfernen:** `DashboardNav`, `ExternalDashboardNav`, `RevenueChart` löschen
3. **Einnahmen-Tab** umbauen: Gruppierung nach `categoryTag` statt `counterpartyName`, neuer Stacked BarChart
4. **Shared Aggregation:** `groupByCategoryTag()` als Single Source of Truth für Chart und Tabelle
5. **Kein neuer API-Endpoint:** Bestehende Revenue-API minimal um `categoryTag` erweitern

### Begründung

- Ein einziger Einstiegspunkt eliminiert Daten-Inkonsistenzen zwischen Legacy- und neuem System
- `categoryTag` ist die fachlich korrekte Gruppierungsdimension (HZV, KV, PVS = Geschäftskategorien), während `counterpartyName` zu granular ist (z.B. „HAEVG Velbert" vs. „HAEVG Uckerath" sind beide HZV)
- Shared Helper verhindert Zahlen-Abweichungen zwischen Chart und Tabelle

### Konsequenzen

- Alte Bookmarks auf `/portal/cases/[id]/revenue` etc. funktionieren weiterhin (Redirect)
- `orders/page.tsx` und `berechnungsgrundlagen/page.tsx` bleiben als Standalone (Server Component bzw. statischer Content)
- Revenue-Tab zeigt max 5+1 Serien (Top-5 nach Betrag + „Sonstige")

---

## ADR-042: Pflicht-Validierung bei AI-extrahierten PDF-Daten

**Datum:** 12. Februar 2026
**Status:** Akzeptiert

### Kontext

Ein vorheriger AI-Extraktionsversuch der ISK-Zahlbelege (Postenlisten SEPA CCT/CIP) erzeugte eine JSON-Datei mit **100% fabrizierten IBANs** und zahlreichen falschen Beträgen/Empfängernamen. Das Problem wurde erst bei systematischer PDF-by-PDF-Einzelprüfung entdeckt. Die AI hatte plausibel aussehende, aber komplett erfundene IBANs generiert.

### Entscheidung

**Jede AI-basierte Datenextraktion aus PDFs MUSS manuell validiert werden:**

1. **Einzelprüfung:** Jedes Quelldokument einzeln gegen extrahierte Daten prüfen (Cent-genau, Zeichen-genau)
2. **Summenprüfung:** Einzelposten-Summen gegen Gesamtbeträge der Zahlbelege verifizieren
3. **IBAN-Cross-Check:** Wiederkehrende IBANs über mehrere Dokumente hinweg auf Konsistenz prüfen
4. **Automatisierte Nachvalidierung:** Python/Script-basierte Prüfung der JSON-Integrität (Summen, IBAN-Format, Anzahl)
5. **Validierungsmethode dokumentieren:** JSON-Metadata muss `validierungsmethode` und `letzte_validierung` enthalten

### Begründung

- AI-Modelle halluzinieren regelmäßig bei strukturierten Daten (IBANs, Kontonummern, Rechnungsnummern)
- Halluzinierte Daten sind oft syntaktisch korrekt (richtige Länge, richtiges Format) aber semantisch falsch
- Im Insolvenzkontext sind falsche Zahlungsdaten besonders kritisch (Fehlüberweisungen, falsche Massezuordnung)
- Die 18 validierten Zahlbelege zeigten: 38 unique IBANs, alle 22 Zeichen DE-Format, aber 100% der Original-IBANs waren Halluzinationen

### Konsequenzen

- Höherer Zeitaufwand bei Datenextraktion (jedes PDF muss einzeln gelesen werden)
- Dafür 100% Datenqualität bei finanziellen Quelldaten
- Template für `Zahlbelege_Vollstaendig.json` dient als Referenzformat für künftige Extraktionen

---

## ADR-041: EXCLUDE_SPLIT_PARENTS – Sammelüberweisungs-Splitting

**Datum:** 12. Februar 2026
**Status:** Akzeptiert

### Kontext

Sammelüberweisungen (z.B. eine KV-Zahlung über 50.000 EUR) müssen in Einzelposten aufgespalten werden (je Standort/Arzt), um korrekte Alt/Neu-Zuordnungen und Standort-Aggregationen zu ermöglichen. Dabei darf der Parent-Betrag nicht doppelt gezählt werden.

### Entscheidung

**A) Zentrale Prisma-WHERE-Bedingung:**
- `EXCLUDE_SPLIT_PARENTS = { splitChildren: { none: {} } }` als wiederverwendbare Konstante in `lib/ledger/types.ts`.
- Logik: Ein Entry ohne Children ist „aktiv" (normale Buchung oder Child). Ein Entry MIT Children ist „aufgelöst" (Split-Parent) und wird aus Aggregationen ausgeschlossen.

**B) Flächendeckende Integration:**
- Filter in allen 12 Aggregations-Dateien eingebaut: Dashboard-APIs, Massekredit, Banksalden, Forecast, Standorte, Kontobewegungen.
- NICHT verwendet für: Ledger-Ansicht (zeigt alles), Hash-Berechnung, Classification Engine, Audit-Queries.

**C) Schreibschutz für Split-Parents:**
- PUT auf Ledger-Entries mit Children verbietet `amountCents`, `transactionDate`, `bankAccountId` Änderungen.
- Erst Aufspaltung rückgängig machen (UNSPLIT), dann Parent bearbeiten.

**D) Audit-Trail:**
- Neue Audit-Actions SPLIT und UNSPLIT für lückenlose Nachvollziehbarkeit.

### Begründung

- Zentrale Konstante statt verstreuter Filter-Logik vermeidet Inkonsistenzen.
- Parent-Entries bleiben erhalten (nicht gelöscht) → Audit-Trail bleibt vollständig.
- Schreibschutz verhindert inkonsistente Zustände (Parent-Betrag ≠ Summe Children).

### Konsequenzen

- Alle Aggregations-Queries müssen `...EXCLUDE_SPLIT_PARENTS` einbinden.
- Neue Aggregations-APIs müssen den Filter ebenfalls verwenden.
- Ledger-Ansicht zeigt weiterhin alle Entries (auch Parents) zur manuellen Kontrolle.

---

## ADR-040: Kunden-Freigabe-UX & Subdomain-Routing

**Datum:** 12. Februar 2026
**Status:** Akzeptiert

### Kontext

Die Kunden-Freigabe war auf drei Seiten verteilt: Kundenverwaltung (`/customers`), Kundenzugänge (`/kundenzugaenge`) und Externe Links (`/freigaben`). Das Anlegen eines Kunden und das Vergeben von Fallzugriff waren getrennte Workflows ohne kopierbaren Einladungstext. Alle Kunden teilten sich `cases.gradify.de/portal` ohne individuelles Branding.

### Entscheidung

**A) Kombinierte Freigaben-Seite:**
- ShareLinks und CustomerCaseAccess in einer Seite (`/freigaben`) mit Tab-Ansicht zusammengeführt.
- Neuer `CombinedAccessManager` mit „Fall freigeben"-Flow: Kunde auswählen/anlegen + Zugriff vergeben + Einladungstext kopieren — alles in einem Modal.
- Sidebar: „Freigaben" (Orders) → „Bestellfreigaben", „Externe Freigaben" + „Kundenzugänge" → „Freigaben".

**B) Subdomain-System:**
- `slug`-Feld auf `CustomerUser` (unique, nullable).
- Next.js Middleware erkennt Subdomains (`anchor.cases.gradify.de`) und setzt `x-tenant-slug` Header.
- URL-Rewrites: `/` → `/portal`, `/login` → `/customer-login`, `/cases/...` → `/portal/cases/...`.
- Cookie-Domain `.cases.gradify.de` für cross-subdomain Session-Sharing.
- Wildcard DNS CNAME bei IONOS, pro-Kunde Domain-Freischaltung in Vercel.

**C) UX-Verbesserungen:**
- Alle `alert()` → InlineError-Komponente, alle `confirm()` → ConfirmDialog-Modal.
- Passwort-Generierung: 14 Zeichen aus lesbarem Zeichensatz (keine ambiguösen Zeichen).
- Slug-Input mit Live-Validierung und URL-Preview.

### Begründung

- Ein-Seite-Workflow reduziert Klicks von ~8 auf ~3 für eine Kundenfreigabe.
- Kopierbarer Einladungstext mit Passwort vermeidet fehleranfällige manuelle Kommunikation.
- Subdomains ermöglichen professionelles Kunden-Branding ohne separate Deployments.
- Middleware-Ansatz hält Portal-Code unverändert — nur Pfad-Rewrites.
- InlineError/ConfirmDialog verbessern UX erheblich gegenüber nativen Browser-Dialogen.

### Konsequenzen

- Pro Kunde muss eine Domain in Vercel manuell hinzugefügt werden (`vercel domains add`).
- Bestehende Kunden ohne Slug nutzen weiterhin `cases.gradify.de/customer-login`.
- Alte Route `/kundenzugaenge` redirected auf `/freigaben`.
- Wildcard DNS routet ALLE Subdomains zu Vercel — nur konfigurierte werden served.

---

## ADR-039: Portal – Finanzierung + Sicherungsrechte zusammenführen

**Datum:** 12. Februar 2026
**Status:** Akzeptiert

### Kontext

Das Kundenportal hatte zwei getrennte Seiten: "Finanzierung" (rief Admin-STUB-API auf, zeigte nichts) und "Sicherungsrechte" (zeigte Platzhalter-Text). Im Admin-Dashboard wurden diese bereits in v2.24.0 zu "Banken & Sicherungsrechte" zusammengeführt.

Zusätzlich verwendeten Portal-Seiten hardcodierte Tailwind-Farben (`bg-white`, `bg-gray-50`, `text-gray-900`) statt CSS-Variablen, was Dark-Mode-Inkompatibilität verursachte.

### Entscheidung

1. **Neue kombinierte Seite** `/portal/cases/[id]/banken-sicherungsrechte` erstellt, die echte Bankdaten aus der Customer-API (`/api/customer/cases/[id]`) nutzt.
2. **Alte Routen** `/finanzierung` und `/security` auf neue Seite redirecten (kein 404 für Bookmarks).
3. **DashboardNav**: Zwei Nav-Items zu einem zusammengeführt ("Banken & Sicherungsrechte").
4. **CSS-Variablen** durchgängig in Portal-Seiten und Shared-Komponenten eingesetzt.

### Begründung

- Admin und Portal sollten konsistente Navigation haben.
- Customer-API liefert bereits vollständige Bankdaten — kein separater API-Endpoint nötig.
- STUB-API `/api/cases/[id]/finanzierung` mit Admin-Auth im Portal-Kontext war ein Fehler (falsche Session-Prüfung).
- CSS-Variablen statt hardcodierte Farben ermöglichen zukünftigen Dark-Mode.

### Konsequenzen

- Alte URLs funktionieren weiterhin (Redirect).
- Finanzierung-STUB-API bleibt bestehen (wird ggf. in Zukunft für Admin-Kreditlinien genutzt).
- Externe Tabellen-Komponenten haben noch hardcodierte Farben (separates TODO, niedrige Priorität).

---

## ADR-038: apoBank Massekreditvertrag-Update & HZV-Split-Korrektur

**Datum:** 12. Februar 2026
**Status:** Akzeptiert

### Kontext

Gründlicher Abgleich von case-context.json (Ground Truth aus Originaldokumenten) gegen Dashboard-Daten, Code-Konfiguration und Datenbank ergab drei kritische Diskrepanzen:

1. **apoBank Massekreditvertrag:** In case-context.json seit 20.01.2026 als unterschrieben dokumentiert (Status: ERHALTEN_UND_ANALYSIERT), aber in DB und config.ts noch als OFFEN hinterlegt.
2. **HZV Oktober Split:** case-context.json und Premise prem-003 bestätigen 28/31 Alt, 3/31 Neu. Code hatte 29/31 Alt, 2/31 Neu (Stichtag 29.10. fälschlich als Altmasse-Tag gezählt).
3. **Massekredit API ohne Auth:** Sensible Finanzdaten (Bankvereinbarungen, Kreditlimits) waren ohne Authentifizierung abrufbar.

### Entscheidung

**A) apoBank:** DB und config.ts auf VEREINBART aktualisiert mit: `contributionRate=0.1`, `contributionVatRate=0.19`, `creditCapCents=10000000` (100K EUR). Turso-Migration durchgeführt.

**B) HZV Oktober:** VERTRAGSREGEL in config.ts korrigiert auf `altRatio=28/31`, `neuRatio=3/31`. AllocationSource von PERIOD_PRORATA auf VERTRAGSREGEL geändert (ist vertragliche Vorgabe gem. §1(2)b, nicht reine Berechnung).

**C) Massekredit API:** `getSession()`-Check hinzugefügt.

### Begründung

- case-context.json ist die akkumulierte Wissensbasis aus Originaldokumenten und hat Vorrang vor Code-Konfiguration
- Der Eröffnungstag (29.10.) gehört nach §27 InsO zur Neumasse – die dynamische `calculatePeriodProrata` berechnet dies korrekt (exklusiv Cutoff), aber die hardcodierte VERTRAGSREGEL hatte Priorität und überschrieb das korrekte Ergebnis
- API-Endpunkte mit Finanzdaten müssen immer authentifiziert sein

### Konsequenzen

- Massekredit-Dashboard zeigt jetzt korrekte Werte für beide Banken
- HZV-Zahlungen für Oktober werden korrekt mit 3/31 Neumasse berechnet statt 2/31
- Alle sensiblen API-Endpunkte sind authentifiziert

---

## ADR-037: Defensives Alt-Tag-Mapping & ABSONDERUNG-Match-Bereinigung

**Datum:** 12. Februar 2026
**Status:** Akzeptiert

### Kontext

Code-Audit der Matrix-Pipeline ergab zwei defensiv relevante Befunde:

1. **Fehlende Alt-Mappings:** `getAltforderungCategoryTag()` hatte keine Mappings für insolvenzspezifische Tags (`STEUERN`, `VERFAHRENSKOSTEN`, `DARLEHEN_TILGUNG`, `INSO_RUECKZAHLUNG`, `INSO_VORFINANZIERUNG`, `INSO_SACHAUFNAHME`). Bei MIXED-Buchungen mit diesen Tags ging der Alt-Anteil stillschweigend verloren (Mapping → `null` → voller Betrag in Neumasse).

2. **Zu breiter ABSONDERUNG-Match:** `cash_out_inso_verfahrenskosten` enthielt `{ type: 'LEGAL_BUCKET', value: 'ABSONDERUNG' }`, was ALLE Absonderungsbuchungen in "Verfahrenskosten" routete — auch Bankentilgungen, die dort nicht hingehören.

### Entscheidung

**A)** 6 neue Mappings in `getAltforderungCategoryTag()`:
- `STEUERN` → `ALTVERBINDLICHKEIT_STEUERN`
- `VERFAHRENSKOSTEN` → `ALTVERBINDLICHKEIT_VERFAHRENSKOSTEN`
- `DARLEHEN_TILGUNG` → `ALTVERBINDLICHKEIT_DARLEHEN`
- `INSO_RUECKZAHLUNG` / `INSO_VORFINANZIERUNG` / `INSO_SACHAUFNAHME` → `ALTVERBINDLICHKEIT_INSO`

**B)** LEGAL_BUCKET-Match aus `cash_out_inso_verfahrenskosten` entfernt. CATEGORY_TAG + DESCRIPTION_PATTERN genügen.

### Begründung

- Beide Änderungen sind defensiv: Aktuell existieren keine MIXED-Entries mit diesen Tags, daher ändern sich keine Matrix-Werte
- Die Alt-Tags haben noch keine eigenen Matrix-Zeilen → Fallback `cash_out_operative_sonstige` greift, was besser ist als Datenverlust
- ABSONDERUNG sollte nicht pauschal in Verfahrenskosten landen (z.B. Sparkasse-Absonderungstilgung ≠ Verfahrenskosten)

### Konsequenzen

- Keine Verhaltensänderung bei aktuellen Daten
- Zukünftige MIXED-Buchungen mit insolvenzspezifischen Tags verlieren keinen Alt-Anteil mehr
- Absonderungsbuchungen ohne passenden CATEGORY_TAG oder DESCRIPTION_PATTERN landen korrekt im Fallback

---

## ADR-036: Drei-Ebenen-Trennung – Banken & Sicherungsrechte als eigener Tab

**Datum:** 10. Februar 2026
**Status:** Akzeptiert

### Kontext

Das Admin-Dashboard vermischte drei konzeptionell verschiedene Ebenen:
1. **Liquidität** (Matrix) – Cashflows und Periodenbalances
2. **Masse** (Masseübersicht) – Alt/Neu-Zuordnung, Estate Summary
3. **Banken-Sicherung** – Kontenstruktur, Globalzessionen, Massekredit-Headroom

Der alte „Sicherungsrechte"-Tab zeigte einen Bankenspiegel mit Saldo-KPIs (Ebenenvermischung), der „Kreditlinien"-Tab war ein leerer Placeholder, und die bestehende Massekredit-API wurde nirgends genutzt.

### Entscheidung

Zusammenführung zu einem neuen Tab „Banken & Sicherungsrechte" mit drei Sektionen:
- **Bankenspiegel:** Kontenstruktur (ISK vs. Gläubigerkonto), KEINE Salden
- **Sicherungsrechte & Vereinbarungen:** Tabelle aus Massekredit-API (`perBank`)
- **Massekredit-Status:** Berechnungskarten mit Headroom-Ampel

Alte Tabs (`/security-rights`, `/finanzierung`) leiten per `redirect()` auf die neue Route weiter. FINANZIERUNG-Sektion aus der Sidebar entfernt.

### Begründung

- **Separation of Concerns:** Salden gehören in die Liquiditätsmatrix, nicht in den Bankenspiegel
- **Kein Feature-Verlust:** Alle Informationen sind verfügbar, nur klarer strukturiert
- **Massekredit-API war ungenutzt:** Investment in API-Entwicklung wird jetzt realisiert
- **Redirects statt Löschung:** Keine Breaking Changes für bestehende Bookmarks

### Konsequenzen

- Portal-Tabs (`/portal/cases/[id]/security`, `/portal/cases/[id]/finanzierung`) bleiben unverändert
- Dashboard-Panel-Types (`security-rights` in `types/dashboard.ts`) bleiben unverändert
- bank-accounts API rückwärtskompatibel erweitert (neue Felder `isLiquidityRelevant`, `securityHolder`)

---

## ADR-034: Liquiditätsmatrix = nur ISK-Konten (isLiquidityRelevant)

**Datum:** 10. Februar 2026
**Status:** Akzeptiert

### Kontext

Die Liquiditätsmatrix zeigte 747 Entries, davon 329 von Nicht-ISK-Konten (apoBank-Gläubigerkonto, Sparkasse-Geschäftskonto). Zwei Sondertilgungen (-292K EUR) verzerrten die Matrix massiv. Viele Nicht-ISK-Entries sind aber legitime Übergangsbuchungen (ISK Uckerath erst ab 13.11., ISK Velbert ab 05.12.).

### Entscheidung

Neues Boolean-Feld `isLiquidityRelevant` auf `BankAccount`. Die Matrix-API filtert: nur Entries von Konten mit `isLiquidityRelevant=true`, Entries ohne Bankzuordnung (`bankAccountId=null`), und PLAN-Entries. Aktuell: ISK Velbert und ISK Uckerath = true, alle anderen = false.

### Begründung

- Pauschales Ausfiltern aller Nicht-ISK-Entries wäre falsch (44% aller Entries!)
- Stattdessen: Saubere Steuerung über DB-Flag pro Konto
- Matrix = verfügbare Masse (ISK). Ledger = vollständige Wahrheit (alle Konten)
- Orthogonal zur Darlehens-Korrektur (die auch im Ledger nötig ist)

### Konsequenzen

- Matrix zeigt ~418 statt 747 Entries
- Gläubigerkonto-Buchungen nur im Ledger sichtbar, nicht in Matrix
- Bei neuen Bankkonten muss `isLiquidityRelevant` explizit gesetzt werden

---

## ADR-035: Q4-Umsatzregel nicht auf Darlehenstilgungen anwendbar

**Datum:** 10. Februar 2026
**Status:** Akzeptiert

### Kontext

8 Darlehens-Entries (Gesellschafterdarlehen SHP) vom apoBank-Gläubigerkonto hatten `estateAllocation=MIXED` mit 67% Neu-Anteil. Die Q4-Regel (1/3 Alt, 2/3 Neu) war irrtümlich auf Darlehenstilgungen angewendet worden.

### Entscheidung

Manuelle Korrektur aller 8 Entries: `categoryTag=DARLEHEN_TILGUNG`, `estateAllocation=ALTMASSE` (100%), `allocationSource=MANUAL_CORRECTION`.

### Begründung

- Q4-Umsatzregel aus Massekreditvertrag §1(2) gilt explizit nur für **Umsatzerlöse** (KV/HZV/PVS)
- Gesellschafterdarlehen sind vorinsolvenzliche Verbindlichkeiten = per Definition 100% Altmasse
- Automatische Zuordnung hatte keinen Kontext über Buchungstyp (Darlehen vs. Umsatz)

### Konsequenzen

- Sonstige Auszahlungen Oktober massiv korrigiert (~292K weniger)
- Ähnliche manuelle Korrekturen bei neuen Darlehens-Entries nötig
- Langfristig: Classification Rule für Darlehenstilgungen anlegen

---

## ADR-033: IV-Excel als Counterparty-Zuordnungsquelle

**Datum:** 10. Februar 2026
**Status:** Akzeptiert

### Kontext

Die ISK-Einzahlungsliste vom IV (Excel) enthält Creditor/Debtor-Felder, die in den Kontoauszügen (unsere Import-Quelle) nicht als separate Felder vorliegen. 28 von 247 ISK-Entries hatten keine Counterparty-Zuordnung.

### Entscheidung

Creditor/Debtor-Namen aus der IV-Excel werden als Quelle für Counterparty-Zuordnungen genutzt:
- Matching gegen bestehende Counterparties (Name + matchPattern)
- Bei Bedarf neue Counterparties anlegen (hier: Landesoberkasse NRW)
- Jede Zuordnung wird manuell plausibilisiert (kein Auto-Commit)

### Begründung

- Die Excel ist „die Wahrheit vom IV" – offizielle Einzahlungsliste
- Creditor/Debtor-Namen sind strukturiert und zuverlässiger als Pattern-Matching auf Freitext-Beschreibungen
- Einmalige Aktion pro ISK-Periode, kein laufender Prozess

### Konsequenzen

- ISK Nov-Dez Counterparty-Abdeckung: 89% → 100%
- Neue Counterparty `Landesoberkasse NRW (Beihilfe)` für Beihilfe-Zahlungen (Typ BEHÖRDE)
- Bei künftigen ISK-Perioden gleichen Workflow wiederholen

---

## ADR-032: Bestell- & Zahlfreigabe-Modul

**Datum:** 10. Februar 2026
**Status:** Akzeptiert

### Kontext

Insolvenzverwalter verwenden aktuell Excel-Bestelllisten, um Bestellungen und Zahlungen während des laufenden Verfahrens freizugeben. Bei größeren Fällen mit Warengeschäft ist die Nachvollziehbarkeit problematisch (Feedback IV Hannes Rieger, 09.02.2026).

### Entscheidung

**A: Zwei Freigabetypen**
- **BESTELLUNG:** Vor dem Kauf – Budget-Genehmigung. Erzeugt PLAN-LedgerEntry mit erwartetem Zahlungsdatum.
- **ZAHLUNG:** Rechnung liegt vor – Zahlungsfreigabe. Erzeugt PLAN-LedgerEntry mit Rechnungsdatum.

**B: Token-basierter externer Zugang**
- CompanyToken-Modell für unauthentifizierten Zugang zum Einreichungsformular (`/submit/[token]`)
- Kein Login nötig für Buchhaltung/Unternehmen – nur den Link teilen
- Token kann vom Admin deaktiviert werden

**C: Base64-Dokumentenspeicherung**
- Belege (PDF, JPG, PNG bis 10MB) werden als Base64 in der `orders`-Tabelle gespeichert
- Kein externer Speicher (S3, etc.) nötig – alles in einer Datenbank
- Trade-off: Einfachheit vs. Skalierbarkeit (für <100 Dokumente pro Fall ausreichend)

**D: Automatische LedgerEntry-Erstellung**
- Genehmigte Anfragen erzeugen automatisch einen PLAN-LedgerEntry
- `legalBucket: "MASSE"` (Masseverbindlichkeit)
- `estateAllocation: "NEUMASSE"` (im laufenden Verfahren = Neumasse)
- `amountCents`: Immer negativ (Auszahlung), Absolutwert des genehmigten Betrags
- IV kann optional einen abweichenden Betrag genehmigen

**E: Admin-only Sichtbarkeit (Phase 1)**
- Portal-Seite existiert, ist aber NICHT in der Kunden-Navigation verlinkt
- Erst wenn Feature stabil: Navigation im Kundenportal einschalten

### Begründung

- **Nachvollziehbarkeit:** Jede Anfrage dokumentiert mit Zeitstempel, Beleg, Genehmiger
- **Integration:** Freigegebene Beträge fließen automatisch in die Liquiditätsplanung
- **Einfachheit:** Kein Login für externe Nutzer, Token-Link reicht
- **Base64 statt S3:** Turso/SQLite kann Base64 speichern, kein Cloud-Setup nötig

### Konsequenzen

- Dokumentenspeicherung begrenzt (~10MB pro Beleg, Turso-Limits beachten)
- Keine Email-Benachrichtigungen (Phase 2 mit Resend)
- Kein Multi-File-Upload (Phase 2)
- Portal-Integration muss manuell aktiviert werden (Navigation-Link einschalten)

---

## ADR-031: Selbstbeschreibende Matching-Regeln (A+B+C)

**Datum:** 10. Februar 2026
**Status:** Akzeptiert

### Kontext

Die Zellerklärung (Explain-Cell) brauchte menschenlesbare Beschreibungen der Matching-Regeln. Erste Implementierung nutzte eine separate Übersetzungstabelle (`MATCH_TYPE_LABELS`) in `explain.ts`, die Match-Typen wie `COUNTERPARTY_PATTERN` in Labels wie "Gegenpartei-Muster" übersetzte.

**Problem:** Drei getrennte Wissensquellen ohne Verbindung:
1. `matrix-config.ts` – Die Regeln selbst (Typ + Value)
2. `explain.ts` – Hardcodierte Label-Maps (fragile Übersetzungsschicht)
3. LedgerEntry DB-Felder – `allocationSource`, `categoryTagSource`

Neue Match-Typen oder Zeilen erforderten Änderungen an zwei Stellen (Config + Label-Map). Die Label-Map konnte veralten ohne dass es auffällt.

### Entscheidung

**Drei Maßnahmen (A+B+C):**

**A: Typ-Erweiterungen**
- `MatrixRowMatch.description` – Menschenlesbare Beschreibung pro Matching-Regel
- `MatrixRowConfig.matchDescription` – Gesamtbeschreibung was die Zeile erfasst
- `MatchResult.matchDescription` – Wird von `findMatchingRowWithTrace()` befüllt

**B: Config trägt eigene Beschreibungen**
- Alle ~26 Daten-Zeilen in `HVPLUS_MATRIX_ROWS` mit Beschreibungen versehen
- Beschreibungen fachlich formuliert (z.B. "Einnahmen der Kassenärztlichen Vereinigung")

**C: explain.ts wird zum Leser**
- `MATCH_TYPE_LABELS` entfernt
- Alle Funktionen lesen Beschreibungen aus Config/MatchResult statt selbst zu übersetzen
- `ALLOCATION_SOURCE_LABELS` und `TAG_SOURCE_LABELS` bleiben (übersetzen DB-Felder, nicht Config)

### Begründung

**Single Source of Truth:** Regeln und ihre Beschreibungen leben am selben Ort.
**Skalierbarkeit:** Neue Zeilen/Regeln nur an einer Stelle pflegen.
**Determinismus:** Beschreibungen sind Teil der Config, nicht generiert.

### Konsequenzen

- Neue Zeilen MÜSSEN `matchDescription` und `matches[].description` angeben
- `explain.ts` hat keinen eigenen Wissensbestand über Regel-Labels mehr
- Fallback bei fehlender description: `"${match.type} = '${match.value}'"` (technisch, aber funktional)

---

## ADR-030: Bankkonten-Details aus Liquidity Matrix entfernt

**Datum:** 09. Februar 2026
**Status:** Akzeptiert

### Kontext

Liquidity Matrix zeigte einzelne Bankkonten-Zeilen (ISK Velbert, Sparkasse, apoBank, etc.) aufgeklappt unter "Zahlungsmittelbestand".

**Problem:**
- Redundanz: BankAccountsTab zeigt bereits alle Konten mit Details
- Keine fachliche Verknüpfung: Einzelne Konten hängen nicht an Cashflow-Kategorien
- Verwirrend: Zwei Stellen zeigen Kontostände (Matrix + Bankenspiegel)
- Unnötige Komplexität: ~150 Zeilen Code für Bank-Schleife und Balance-Berechnung

### Entscheidung

**Einzelne Bankkonten-Zeilen komplett aus Liquidity Matrix entfernt:**

1. **Config:** 10 Detail-Zeilen entfernt (5 Opening Balance + 5 Closing Balance)
2. **Route:** Bank-Schleife und Bank-spezifische Balance-Berechnung entfernt
3. **Behalten:** Summary-Zeilen (Anfangsbestand gesamt, Endbestand gesamt)
4. **Balance-Berechnung:** Vereinfacht zu `Opening + Cash In + Cash Out`

### Begründung

**Separation of Concerns:**
- **Liquidity Matrix:** Cashflow-Kategorien (HZV, KV, PVS, Personalkosten, etc.)
- **BankAccountsTab:** Kontenstände und -entwicklung

**Vorteile:**
- Klarere Darstellung (nur Kategorien)
- Weniger Code (~150 Zeilen entfernt)
- Keine Redundanz mehr
- Einfachere Wartung

### Konsequenzen

**Geänderte Dateien:**
- `/app/src/lib/cases/haevg-plus/matrix-config.ts` (10 Zeilen entfernt, 2 Kommentare)
- `/app/src/app/api/cases/[id]/dashboard/liquidity-matrix/route.ts` (~150 Zeilen vereinfacht)

**Entfernte DB-Abfrage:**
- `allBankLedgerEntries` Query nicht mehr nötig (nur für Detail-Zeilen verwendet)

**Frontend-Änderung:**
- Liquidity Matrix zeigt keine aufgeklappten Konten mehr
- Nur noch "Zahlungsmittelbestand am Anfang/Ende" als Summe

---

## ADR-029: Liquiditätsplanung startet bei 0 EUR (keine Opening Balance)

**Datum:** 09. Februar 2026
**Status:** Akzeptiert

### Kontext

Liquiditätsplanung für Insolvenzverfahren muss Zahlungsfähigkeit über Planungszeitraum prognostizieren.

**Problem:**
- System berechnete Opening Balance aus BankAccount-Daten
- Fachlich inkorrekt: Liquiditätsplanung ist Cashflow-Prognose, keine Vermögensaufstellung
- Oktober 2025 (HVPlus): ISK-Konten existierten noch nicht, Buchungen auf Schuldner-Konten
- Verwirrung: "Warum zeigt Dashboard andere Zahlen als Bankenspiegel?"

**Verworfene Lösung:**
- Virtuelles BankAccount "Insolvenzmasse (Pre-ISK)" mit temporaler Logik (`isVirtual`, `validFrom`, `validUntil`)
- Nach externer Architektur-Review als overengineered und konzeptionell falsch verworfen
- Grund: Vermischung von "Kontensicht" (Bank-Realität) mit "Liquiditätsplanung" (Cashflow-Berechnung)

### Entscheidung

**Dashboard zeigt reine Cashflow-Planung, startet immer bei 0 EUR:**

1. **Backend:** `openingBalanceCents = BigInt(0)` hart-kodiert in Dashboard-API
2. **Frontend:** Automatische Anzeige "Anfangsbestand: 0 €" (keine Code-Änderung nötig)
3. **PDF-Export:** Erklärender Text "Liquidity-Plan startet bei: 0 € (Cashflow-basierte Planung)"
4. **BankAccountsTab:** Bleibt unverändert, zeigt reale Opening Balances der Konten

### Begründung

**Fachliche Korrektheit:**
- Liquiditätsplanung dient der Steuerung zukünftiger Zahlungsfähigkeit
- Muss unabhängig von historischen Kontoständen sein
- Reale Kontostände sind Informationsobjekte, keine Planungsparameter
- Oktober-IST-Buchungen werden als Cashflows der ersten Periode erfasst

**Separation of Concerns:**
- **Dashboard/LiquidityTable:** Reine Cashflow-Planung (IST + PLAN), startet bei 0 EUR
- **BankAccountsTab (Bankenspiegel):** Separate Sicht auf Bank-Realität mit echten Opening Balances

**Architektonische Vorteile:**
- Keine Schema-Änderungen nötig (kein `isVirtual`, `validFrom`, `validUntil`)
- Keine virtuellen BankAccount-Entities
- Keine Migration-Scripts
- Ermöglicht zukünftige Features (Szenarien, Plan-Versionen, Sensitivitäten)

### Konsequenzen

**Geänderte Dateien (Planning APIs):**
- `/app/src/app/api/cases/[id]/dashboard/route.ts` (Zeile 110-115) - Admin Dashboard
- `/app/src/app/api/cases/[id]/dashboard/liquidity-matrix/route.ts` (Zeile 541) - Liquidity Matrix (aufgeklappt)
- `/app/src/app/api/cases/[id]/ledger/rolling-forecast/route.ts` (Zeile 88) - Rolling Forecast
- `/app/src/app/api/customer/cases/[id]/route.ts` (Zeile 131) - Customer Portal Dashboard
- `/app/src/app/api/share/[token]/route.ts` (Zeile 141) - Share-Link Dashboard
- `/app/src/components/external/PDFExportButton.tsx` (Zeile 594) - PDF-Export-Text

**Keine Änderungen:**
- Prisma Schema (keine neuen Felder)
- BankAccountsTab (bleibt unverändert - zeigt echte Kontostände)
- LiquidityTable Component (funktioniert out-of-the-box mit 0 EUR)
- `/app/src/app/api/cases/[id]/bank-accounts/route.ts` (bleibt bei `account.openingBalanceCents`)

**Archiv:**
- `ARCHITECTURE_BANK_ACCOUNTS.md`, `IMPACT_VIRTUAL_ACCOUNT.md`, `PLAN_VIRTUAL_ACCOUNT.md` bleiben als Dokumentation des verworfenen Ansatzes erhalten

---

## ADR-028: Bulk-Classification mit Audit-Trail statt manueller Einzelprüfung

**Datum:** 09. Februar 2026
**Status:** Akzeptiert

### Kontext

Version 2.16.0 identifizierte ein kritisches Problem:
- **Alle 691 IST-Entries hatten categoryTag = NULL**
- Liqui-Matrix zeigte 0 für Altforderungen (Daten waren da: 184.963,96 EUR)
- Classification Engine wurde nie auf manuell importierte Daten angewandt

Zwei Ansätze standen zur Wahl:
1. **Manuelle Einzelprüfung:** Jeden Eintrag einzeln klassifizieren und bestätigen
2. **Bulk-Classification:** Pattern-basierte Klassifizierung mit anschließender Stichprobenprüfung

### Entscheidung

**Pattern-basierte Bulk-Classification mit vollständigem Audit-Trail:**

1. **Bucket-Analyse:** Entries nach Description-Patterns gruppieren
2. **18 categoryTags definieren:** HZV, KV, PVS, EINNAHME_SONSTIGE, etc.
3. **SQL-Bulk-Updates:** Pro categoryTag alle matchenden Entries auf einmal klassifizieren
4. **Audit-Trail sicherstellen:** Jeder Entry erhält:
   - `categoryTag` – Die zugewiesene Kategorie
   - `categoryTagSource = 'AUTO'` – Kennzeichnung als automatisch klassifiziert
   - `categoryTagNote` – Pattern-Beschreibung (z.B. "Klassifiziert via Pattern: TK/AOK/BARMER/...")
5. **Stichprobenprüfung:** User prüft erste 20 Entries, dann Buckets

### Begründung

**Warum Bulk-Classification?**
- **Effizienz:** 691 Entries statt Wochen in 2 Stunden klassifiziert
- **Konsistenz:** Identische Patterns erhalten identische Klassifikation
- **Nachvollziehbarkeit:** categoryTagNote dokumentiert WARUM klassifiziert wurde
- **Revidierbarkeit:** categoryTagSource='AUTO' kennzeichnet automatische Klassifikation
- **Skalierbarkeit:** Bei zukünftigen Importen können dieselben Patterns wiederverwendet werden

**Warum nicht manuell?**
- 691 Einzelprüfungen nicht praktikabel
- Inkonsistenzen durch Ermüdung wahrscheinlich
- Keine systematische Dokumentation der Klassifizierungslogik
- Nicht wiederholbar bei Daten-Korrektur

**Warum vollständiger Audit-Trail?**
- Insolvenzverfahren erfordern vollständige Nachvollziehbarkeit
- Bei Prüfung durch Gericht/Gläubiger muss jede Zahl herleitbar sein
- Fehlersuche: Falsche Klassifikation kann auf Pattern zurückverfolgt werden

### Konsequenzen

**Positiv:**
- 691 Entries in 2 Stunden klassifiziert (statt Wochen)
- 100% Audit-Trail: Jede Klassifikation ist nachvollziehbar
- Liqui-Matrix zeigt jetzt korrekte Werte für alle Kategorien
- Pattern-Library für zukünftige Imports etabliert
- Fehler-Identifikation (Sarah Wolf INTERN_TRANSFER) durch systematische Analyse

**Negativ:**
- Initiale Bucket-Analyse erfordert Domain-Wissen
- Pattern-Matching kann Edge-Cases übersehen (→ Stichprobenprüfung erforderlich)

**Lessons Learned:**
- **INTERN_TRANSFER Abweichung:** -65.395 EUR statt ~0 EUR führte zur Entdeckung von Sarah Wolf IV-Honorar-Fehlklassifikation
- **3-Ebenen-Clustering:** Detail-Tags (DB) → Clustering (Präsentation) → Aggregation (Matrix) etabliert

**Zukünftige Verbesserung:**
- Classification Rules in DB speichern für automatische Klassifikation bei Import
- Pattern-Matching-Engine als wiederverwendbare Komponente

---

## ADR-027: Deployment-Strategie - Code vs. Daten vs. Dokumentation

**Datum:** 09. Februar 2026
**Status:** Akzeptiert

### Kontext

Bei der Vorbereitung des Deployments von Version 2.15.0 wurde festgestellt:
- **Dokumentation** (CHANGELOG, DECISIONS, LIMITATIONS) hatte lokale Änderungen
- **Daten** (Service Periods, LANR-Korrekturen) waren BEREITS in Turso synchronisiert
- **Code** (src/lib, src/app, src/components) war UNVERÄNDERT

Frage: Soll ein vollständiger Vercel-Deploy gemacht werden, obwohl nur Dokumentation geändert wurde?

### Entscheidung

**Gestaffelte Deployment-Strategie** basierend auf Art der Änderung:

| Art der Änderung | Git Push | Vercel Deploy | Turso-Migration |
|------------------|----------|---------------|-----------------|
| **Nur Dokumentation** | ✅ Ja | ❌ Nein | ❌ Nein |
| **Nur Daten (lokal)** | Optional | ❌ Nein | ✅ Ja |
| **Code-Änderungen** | ✅ Ja | ✅ Ja | Bei Schema-Änderung |
| **Schema-Änderungen** | ✅ Ja | ✅ Ja | ✅ VOR Deploy |

**Vercel Deploy erfolgt NUR bei:**
- Änderungen in `src/app`, `src/lib`, `src/components`
- Änderungen in `prisma/schema.prisma`
- Änderungen in `package.json` Dependencies
- Änderungen in `next.config.ts`

### Begründung

**Warum gestaffelt?**
1. **Effizienz:** Unnötige Rebuilds vermeiden (spart Zeit + Ressourcen)
2. **Stabilität:** Weniger Deployments = weniger Downtime-Risiko
3. **Klarheit:** Explizite Entscheidung, was deployed werden muss
4. **Kosten:** Vercel Build-Minuten sparen

**Warum nicht immer deployen?**
- Dokumentation ist nur für Repository/GitHub relevant
- Production läuft bereits mit aktuellem Code
- Rebuild dauert 2+ Minuten + Downtime
- Kein funktionaler Mehrwert für User

### Konsequenzen

**Positiv:**
- Schnellere Doku-Updates (nur Git Push statt 2 Min Deploy)
- Klarere Trennung zwischen Code und Daten
- Weniger unnötige Production-Deployments

**Negativ:**
- Vercel-deployed Code und GitHub-Dokumentation können kurzzeitig auseinanderlaufen
- Erfordert bewusste Entscheidung vor jedem Push

**Monitoring:**
- Git Diff prüfen: `git diff --name-only | grep -E "^src/|^prisma/schema"`
- Bei Unsicherheit: Lieber deployen als riskieren

---

## ADR-026: Service-Period-Extraktion über Datenbereinigung

**Datum:** 08. Februar 2026
**Status:** Akzeptiert

### Kontext

Bei der Klassifizierungsprüfung von 292 HZV-Entries wurde festgestellt, dass **ALLE** `servicePeriodStart` = NULL hatten. Dadurch konnte die Split-Engine die Alt/Neu-Masse-Regel nicht korrekt anwenden:

- Alle 292 HZV-Entries hatten pauschal `estateRatio = 0.0968` (3/31 Neu)
- Das ist nur für Oktober-HZV korrekt, aber NICHT für Q3-Nachzahlungen oder Q4-Abschläge
- Q3-Nachzahlungen (Juli/Aug/Sep) müssten **100% ALTMASSE** sein
- Die Service-Period stand IN der Beschreibung (`Q3/25`, `Q4/25`), aber nicht in den dedizierten Feldern

### Entscheidung

**Option 1: Service-Period aus Beschreibung extrahieren und Felder befüllen**

Statt die Split-Engine anzupassen, bereinigen wir die Daten:
1. Pattern-Matching für `Q1/YY`, `Q2/YY`, `Q3/YY`, `Q4/YY` in Beschreibung
2. `servicePeriodStart` + `servicePeriodEnd` setzen
3. Split-Engine NEU durchlaufen lassen mit korrekten Service-Periods
4. Vollständiger Audit-Trail via `allocationSource` + `allocationNote`

**Abgelehnte Alternativen:**
- **Option 2:** Split-Engine anpassen, um aus Beschreibung zu lesen → Verletzt Immutability, technische Schuld
- **Option 3:** Service-Period manuell setzen → Nicht skalierbar, fehleranfällig

### Begründung

**Warum Option 1?**
1. **Data Quality First:** Datenbank-Felder sollten strukturiert und vollständig sein
2. **Immutability der Split-Engine:** Keine Workarounds in Berechnungslogik
3. **Revisionsfreundlich:** Audit-Trail dokumentiert Herkunft jeder Zahl
4. **One-Time-Fix:** Behebt sofort alle 292 Entries, zukünftige Importe korrigieren wir über Pipeline

**Warum nicht Option 2?**
- Macht Split-Engine komplex (Fallback-Logik: erst Feld, dann Beschreibung parsen)
- Verletzt "Single Source of Truth" (Felder vs. Beschreibung)
- Technische Schuld, die uns dauerhaft verfolgt

### Konsequenzen

**Positiv:**
- ✅ 292 HZV-Entries mit korrekten Service-Periods
- ✅ Q3-Nachzahlungen → 100% ALTMASSE (korrekt!)
- ✅ Q4-Abschläge → 1/3 Alt, 2/3 Neu
- ✅ Split-Engine bleibt immutable und sauber
- ✅ Audit-Trail vollständig nachvollziehbar

**Negativ:**
- ⚠️ Import-Pipeline muss verbessert werden (zukünftige HZV-Importe)
- ⚠️ 58 Januar-Gutschriften basieren auf Annahme (siehe ADR-027)

### Implementierung

**Script:** `extract-service-periods-hzv.ts`
```typescript
// Pattern: Q3/25 → 2025-07-01 bis 2025-09-30
// Pattern: Q4/25 → 2025-10-01 bis 2025-12-31
// SONDERFALL: Januar 2026 HZV ABS ohne Quarter → Q4/25 (Zahlungslogik)
```

**Ergebnis:**
- 234 Entries via Beschreibung extrahiert
- 58 Entries via Zahlungslogik abgeleitet (siehe ADR-027)
- 0 Entries ohne Service-Period

---

## ADR-027: Januar-HZV-Klassifikation als Q4/2025-Abschläge

**Datum:** 08. Februar 2026
**Status:** Akzeptiert (mit Vorbehalt)

### Kontext

Bei der Service-Period-Extraktion wurden 58 HZV-Gutschriften im Januar 2026 identifiziert, die **KEINE Quartalsangabe** in der Beschreibung haben:

**Beispiel:**
```
GUTSCHRIFT ÜBERWEISUNG HAEVGID 132025 LANR 1445587 AOK NO HZV ABS
```

**Problem:** Keine explizite Quartalsangabe (`Q1/26`, `Q4/25`, etc.)

**Summe:** 63.112,50 EUR (signifikant!)

### Entscheidung

**Januar-Gutschriften werden als Q4/2025-Abschläge klassifiziert** (Fortsetzung der November-Abschläge)

**Service-Period:**
- `servicePeriodStart`: 2025-10-01
- `servicePeriodEnd`: 2025-12-31
- `allocationSource`: `SERVICE_PERIOD_EXTRACTION_PAYMENT_LOGIC`
- `allocationNote`: "Januar 2026 HZV ABS ohne Quartalsangabe → Q4/2025 abgeleitet aus Zahlungslogik-Analyse"

### Begründung

**Systematische Zahlungslogik-Analyse ergab:**

| Zahlungsmonat | Leistungsquartal | Typ | Anzahl |
|---------------|------------------|-----|--------|
| Oktober 2025 | Q3/2025 | REST (Nachzahlung) | Alle KKs |
| November 2025 | Q4/2025 | **ABS (Abschlag)** | **57 Entries** |
| Januar 2026 | OHNE Angabe | **ABS (Abschlag)** | **58 Entries** |

**Beweise für Q4/2025:**
1. **Anzahl identisch:** 57 vs. 58 Entries (fast gleich!)
2. **Alle markiert als "HZV ABS"** (Abschlag, nicht Nachzahlung)
3. **Krankenkassen identisch:** AOK NO, TK, EK NO, BKK NO, etc.
4. **Zeitliche Kontinuität:** November → Januar = laufende Q4-Abschläge
5. **Kein Q1-Indikator:** Für Q1/2026 würde man `Q1/26` in Beschreibung erwarten

**Abgelehnte Alternative Hypothese:**
Januar-Gutschriften sind Q1/2026-Abschläge → UNWAHRSCHEINLICH, da:
- Q1/2026 wäre ungewöhnlich früh (14.01. für Q1-Leistungen)
- Alle bisherigen Abschläge hatten explizite Quartalsangabe
- Würde etabliertes Muster brechen

### Konsequenzen

**Positiv:**
- ✅ 100% Service-Period-Coverage (292/292 HZV-Entries)
- ✅ Konsistente Alt/Neu-Aufteilung: Q4/2025 = 1/3 Alt, 2/3 Neu
- ✅ Systematisch aus vorhandenen Daten abgeleitet (nicht geraten)

**Negativ:**
- ⚠️ **ANNAHME-BASIERT** – Erfordert Verifikation mit Hannes Rieger
- ⚠️ Falls falsch: Service-Period manuell korrigieren + Split-Engine neu laufen lassen

### Verifikation erforderlich

**MIT HANNES KLÄREN (09.02.2026):**
- [ ] Sind Januar-Gutschriften tatsächlich Q4/2025-Abschläge?
- [ ] Oder doch Q1/2026-Abschläge?
- [ ] Gibt es eine Systematik, warum die Quartalsangabe fehlt?

**FALLS FALSCH:** Korrekturs cript vorbereitet, Split-Engine erneut ausführen

**Quelle:** Zahlungslogik-Analyse (`analyze-hzv-payment-logic.ts`)
**Betroffene Entries:** 58 von 292 HZV-Einnahmen (19.7%)

---

## ADR-025: Turso-Sync-Strategie - PLAN behalten, IST ersetzen

**Datum:** 08. Februar 2026
**Status:** Akzeptiert

### Kontext

Nach Verifikation der lokalen Datenbank stellte sich heraus:
- **Prisma lokal:** 691 IST-Entries (08.02.2026 15:14-15:36) - ✅ 100% verifiziert gegen PDFs
- **Turso Production:** 934 IST-Entries (06.02.2026 06:03) - ❌ Veraltet (2 Tage alt)
- **SQLite direkt:** 934 Entries gemischt - ❌ Enthält Alt-Daten aus mehreren Import-Runden

**Problem:** Wie synchronisieren wir die verifizierten 691 Entries nach Turso, ohne PLAN-Daten (69 Entries) zu verlieren?

### Entscheidung

**Selektiver Sync: PLAN behalten, IST vollständig ersetzen**

```sql
-- 1. PLAN-Daten sichern (behalten)
-- 2. Alle IST-Daten löschen (valueType='IST')
-- 3. Verifizierte 691 IST-Entries aus Prisma neu importieren
-- 4. PLAN-Daten bleiben unangetastet
```

**Workflow:**
1. Backup von Turso erstellen
2. DELETE FROM ledger_entries WHERE caseId='...' AND valueType='IST'
3. INSERT neue 691 IST-Entries aus Prisma
4. Verify: PLAN-Count = 69 (unverändert), IST-Count = 691 (neu)

### Begründung

**Warum nicht alles löschen und neu importieren?**
- PLAN-Daten (69 Entries) sind manuell erstellt und validiert
- Keine Import-Scripts für PLAN-Daten vorhanden
- Risiko von Datenverlust

**Warum IST komplett ersetzen statt mergen?**
- Alte IST-Daten (934) sind gemischt aus mehreren Import-Runden
- Duplikat-Erkennung ist unsicher (nur Description-Match)
- Sauberer Cut: Verifizierte 691 Entries sind Single Source of Truth
- **100% PDF-verifiziert:** Alle Kontosalden stimmen Euro-genau

**Warum nicht inkrementell updaten?**
- Zu komplex (welche Entries sind veraltet? welche neu?)
- Fehleranfällig bei mixed Timestamps
- Full-Replace ist deterministisch und nachvollziehbar

### Konsequenzen

**Positiv:**
- ✅ Production hat verifizierte, saubere Daten
- ✅ PLAN-Daten bleiben erhalten
- ✅ Kein Duplikat-Chaos mehr
- ✅ Klare Datenherkunft (alle IST-Entries vom 08.02.2026 15:14-15:36)

**Negativ:**
- ⚠️ Historische Import-Zeitstempel gehen verloren (irrelevant für Business)
- ⚠️ Alte IST-Daten (falls unterschiedlich) werden überschrieben (OK, da veraltet)

**Risiko-Mitigation:**
- Turso-Backup VOR Sync
- Verify-Script NACH Sync (Count-Check, Summen-Check)
- Rollback-Plan dokumentiert

### Implementierung

**Script:** `sync-to-turso.ts`
```typescript
// 1. Backup Turso
// 2. DELETE IST für Case
// 3. INSERT 691 verifizierte Entries
// 4. Verify Counts
```

**Verifizierung:**
- IST-Count: 691 (neu)
- PLAN-Count: 69 (unverändert)
- Kontosalden-Check gegen PDFs

---

## ADR-024: Prisma Client als Single Source of Truth

**Datum:** 08. Februar 2026
**Status:** Akzeptiert

### Kontext

Bei der Zuordnungsprüfung für HVPlus Fall stellten wir fest, dass SQLite-Direktabfragen andere Ergebnisse lieferten als Prisma Client:
- **SQLite direkt:** 934 IST-Entries, 408 ohne estateAllocation
- **Prisma Client:** 691 IST-Entries, 0 ohne estateAllocation

**Ursache:** Die lokale `dev.db` enthält Daten aus mehreren Import-Runden (06.02., 08.02. 14:14, 08.02. 15:14). Prisma filtert automatisch auf die relevanten/neuesten Entries.

### Entscheidung

**Prisma Client ist die Single Source of Truth für alle Analysen und Dashboards.**

- ✅ Alle Business-Logik nutzt Prisma
- ✅ Alle Analysen basieren auf Prisma-Sicht
- ✅ Dashboard-APIs nutzen Prisma
- ❌ SQLite-Direktabfragen nur für Debugging

### Begründung

**Konsistenz:**
- Prisma-Sicht ist identisch zwischen Entwicklung (dev.db) und Production (Turso)
- Verhindert Diskrepanzen zwischen lokalen Analysen und Live-System

**Sicherheit:**
- Prisma validiert Datentypen (BigInt für amountCents, DateTime-Handling)
- SQL-Injection-Schutz durch Parametrisierung
- Type-Safety durch TypeScript-Generierung

**Wartbarkeit:**
- Eine Abfrage-Schnittstelle statt zwei
- Schema-Änderungen propagieren automatisch via `prisma generate`
- Klare Verantwortlichkeiten (Prisma = Business-Logik, SQLite = Speicher)

### Konsequenzen

**Positiv:**
- ✅ Keine Verwirrung mehr über "welche Daten sind korrekt"
- ✅ Analysen sind Production-nah (gleiche Filter/Logik)
- ✅ Type-Safety verhindert Runtime-Fehler

**Negativ:**
- ⚠️ Prisma-Overhead bei einfachen Queries (minimal, <5ms)
- ⚠️ Debugging erfordert Prisma-Logging (`log: ['query']`)

**Regel für Team:**
```typescript
// ✅ RICHTIG: Prisma verwenden
const entries = await prisma.ledgerEntry.findMany({ ... });

// ❌ FALSCH: Direkter SQLite-Zugriff (nur für Debugging)
sqlite3 dev.db "SELECT * FROM ledger_entries WHERE ..."
```

---

## ADR-022: Datenbank-First Architektur für Vercel Production

**Datum:** 08. Februar 2026
**Status:** Akzeptiert

### Kontext

Vercel Serverless Functions haben kein persistentes Filesystem. Jeder Request läuft in einem neuen Container ohne Zugriff auf lokale Dateien (außer im Build-Output).

**Bisheriges Problem:** APIs versuchten, Case-Daten aus lokalem `Cases/` Ordner zu lesen:
- `planung/route.ts`: `fs.readFile(..."/Cases/HVPlus/.../Planung.json")`
- `iv-notes/route.ts`: `fs.readFile(...".data/iv-notes/*.json")`
- `finanzierung/route.ts`: `fs.readFile(..."/Cases/.../VERTRAEGE/")`

**Fehler in Production:** ENOENT (File not found)

### Entscheidung

**Alle persistenten Daten MÜSSEN in Turso-Datenbank gespeichert werden.**

APIs dürfen NICHT auf lokale Dateien zugreifen (außer statische Assets im `/public` Ordner).

**3 Kategorien von Daten:**

1. **Strukturierte Case-Daten** → Turso DB (LedgerEntry, IVNote, etc.)
2. **Feature noch nicht implementiert** → Stub-Response
3. **Statische Dokumentation** → `/public` Ordner (falls nötig)

### Begründung

**Technisch:**
- Vercel = Serverless = Kein Filesystem
- Turso ist schnell genug für alle Queries (<100ms typisch)
- Prisma ORM abstrahiert DB-Zugriff sauber

**Fachlich:**
- Datenbank ist Single Source of Truth
- Audit-Trail durch DB-Logging
- Concurrent-Access ohne File-Locking

### Konsequenzen

**Positiv:**
- ✅ System vollständig Vercel-kompatibel
- ✅ Keine ENOENT-Fehler mehr in Production
- ✅ Skalierbar (Turso Edge Distribution)
- ✅ Atomic Operations (DB Transactions)

**Negativ:**
- ⚠️ Migration von File-basierten Features nötig
- ⚠️ Turso-Kosten steigen mit Datenmenge (aktuell: vernachlässigbar)

**Noch zu migrieren:**
- Finanzierungsdaten (Massekreditvertrag, Darlehen)
- Zahlungsverifikation (SOLL vs. IST Analysen)

**Implementiert:**
- IVNote-Tabelle für IV-Kommunikation
- Planung nutzt LedgerEntry.valueType=PLAN

---

## ADR-023: Manuelle Deployments statt GitHub Auto-Deploy

**Datum:** 08. Februar 2026
**Status:** Akzeptiert

### Kontext

Vercel kann automatisch bei jedem Git-Push deployen (GitHub-Integration).

**Problem:** Auto-Deploy baute vom falschen Verzeichnis:
- Git-Repo-Root: `/` (enthält auch `/Cases`, `/docs`)
- Next.js-App: `/app` (enthält `package.json`, `next.config.ts`)
- Auto-Deploy erwartete `package.json` im Root
- Fehler: "No Next.js version detected"

### Entscheidung

**GitHub-Integration deaktiviert. Nur manuelle Deployments erlaubt.**

**Deployment-Command:**
```bash
cd "/Users/david/Projekte/AI Terminal/Inso-Liquiplanung"
vercel --prod --yes --cwd app
```

**Root Directory:** `app/` (explizit via `--cwd` Parameter)

### Begründung

**Technisch:**
- Mono-Repo-Struktur: App ist in `/app` Subdirectory
- Vercel Project Settings "Root Directory" wurde nicht richtig übernommen bei Auto-Deploy
- Manueller Deploy mit `--cwd` Parameter funktioniert zuverlässig

**Workflow:**
- Pre-Deployment Checks möglich (Build, Tests lokal)
- Bewusste Entscheidung vor jedem Deploy
- Verhindert versehentliche Broken Deploys

### Konsequenzen

**Positiv:**
- ✅ Deployments sind kontrolliert und reproduzierbar
- ✅ Kein "removed 541 packages" Fehler mehr
- ✅ Build-Logs zeigen korrektes Verzeichnis

**Negativ:**
- ⚠️ Kein automatisches Preview-Deployment bei PRs
- ⚠️ Team muss manuell deployen (aktuell: kein Problem, 1 Developer)

**Alternative (falls Auto-Deploy gewünscht):**
- Vercel Project Settings → "Root Directory" auf `app` setzen
- Dann würde auch Auto-Deploy funktionieren

---

## ADR-020: estateRatio-Splitting in Liquiditätsmatrix

**Datum:** 08. Februar 2026
**Status:** Akzeptiert

### Kontext

MIXED-Entries (z.B. KV-Quartalsabrechnungen) enthalten Anteile von Altmasse UND Neumasse im Verhältnis `estateRatio`. Beispiel: KV Q4/2025 mit estateRatio=0.67 bedeutet 67% Neumasse (Nov+Dez), 33% Altmasse (Okt).

**Bisheriges Verhalten:** Entry wurde zu 100% einer Zeile zugeordnet (basierend auf categoryTag), der andere Anteil ging verloren.

**Problem:** IV-unzulässige Darstellung - Altmasse-Anteile wurden nicht ausgewiesen.

### Entscheidung

MIXED-Entries werden im Backend während der Aggregation aufgeteilt:
1. Berechne Neu-Anteil: `amount * estateRatio`
2. Berechne Alt-Anteil: `amount * (1 - estateRatio)`
3. Matche BEIDE Anteile unabhängig:
   - Neu-Anteil → Neumasse-Zeile (z.B. "KV")
   - Alt-Anteil → Altmasse-Zeile (z.B. "Altforderungen KV")

### Begründung

**Fachlich:**
- Massekreditverträge definieren Alt/Neu-Zuordnung explizit
- IV benötigt getrennte Ausweisung für Massekredit-Verwaltung
- Aufsichtsbehörden prüfen korrekte Alt/Neu-Trennung

**Technisch:**
- estateRatio ist bereits am LedgerEntry vorhanden
- Aufteilung während Aggregation (nicht bei Speicherung) → Entry bleibt atomar
- Dual-Matching ermöglicht flexible Zeilen-Konfiguration

### Konsequenzen

**Positiv:**
- ✅ Korrekte IV-Darstellung gemäß Massekreditvertrag
- ✅ Summe(Neu-Zeilen) + Summe(Alt-Zeilen) = GESAMT stimmt
- ✅ Entry-Count korrekt (1 Entry = 1 Count, nicht 2)

**Negativ:**
- ⚠️ Komplexere Aggregations-Logik
- ⚠️ Neue Funktion `getAltforderungCategoryTag()` nötig

**Implementierung:**
- Backend: `/app/src/app/api/cases/[id]/dashboard/liquidity-matrix/route.ts`
- Helper: `/app/src/lib/cases/haevg-plus/matrix-config.ts`

---

## ADR-021: estateFilter als Frontend-only Filter

**Datum:** 08. Februar 2026
**Status:** Akzeptiert

### Kontext

**Bisheriges Verhalten:** estateFilter wurde im Backend als WHERE-Clause angewendet:
```typescript
where: { estateAllocation: 'ALTMASSE' }  // Filtert DB-Abfrage
```

**Problem:** MIXED-Entries wurden komplett ausgefiltert, da `estateAllocation='MIXED'` weder 'ALTMASSE' noch 'NEUMASSE' ist.

### Entscheidung

estateFilter wirkt NUR im Frontend (Zeilen-Ausblendung):
- Backend liefert IMMER GESAMT (alle Entries)
- Frontend blendet Zeilen aus basierend auf `shouldShowRow()`
- EINNAHMEN-Summen werden gefiltert neu berechnet
- AUSGABEN und BALANCES bleiben ungefiltert

### Begründung

**Fachlich:**
- MIXED-Entries müssen IMMER aggregiert werden (für beide Zeilen)
- estateFilter ist Darstellungs-Präferenz, keine Datenauswahl
- Balances zeigen echte Kontostände (unabhängig vom Filter)

**Technisch:**
- estateRatio-Splitting benötigt alle Entries
- Frontend kann flexibel filtern ohne Backend-Änderung
- Performance: Aggregation nur einmal (nicht pro Filter)

### Konsequenzen

**Positiv:**
- ✅ MIXED-Entries korrekt aufgeteilt
- ✅ Konsistente Darstellung über alle Filter
- ✅ Balances immer korrekt (ungefiltert)

**Negativ:**
- ⚠️ Frontend muss Block-Summen neu berechnen

**Filter-Verhalten:**

| Filter | Zeigt EINNAHMEN | Zeigt AUSGABEN | Zeigt BALANCES | Summe Einzahlungen |
|--------|----------------|----------------|----------------|-------------------|
| GESAMT | Alle | Alle | Alle | 185k (ungefiltert) |
| NEUMASSE | Nur Umsatz + Sonstige | Alle | Alle | 130k (gefiltert) |
| ALTMASSE | Nur Altforderungen | Alle | Alle | 55k (gefiltert) |

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

---

## ADR-028: Classification MUSS bei jedem Import erfolgen

**Datum:** 09. Februar 2026
**Status:** Akzeptiert

### Kontext

Nach erfolgreichem Turso-Sync (691 IST-Entries) wurde festgestellt:
- **Alle categoryTags sind NULL** → Liqui-Matrix zeigt 0 für Altforderungen
- **ALTMASSE-Daten sind vorhanden:** 184.963,96 EUR (119 HZV + 4 PVS + 127 Sonstige)
- **Ursache:** Classification Engine wurde nie ausgeführt

**Wie konnte das passieren?**
- Daten wurden "manuell" importiert (Code im Sparring, nicht via Import-Engine)
- Annahme war: "Import = Done"
- **FALSCH:** Import allein reicht nicht!

**Das System IST gut designed:**
```
1. Classification Engine → Erstellt suggestedCategoryTag
2. Bulk-Review API → Übernimmt Vorschläge
3. Audit-Trail → Dokumentiert Änderungen
```

**Aber:** Engine wurde nie getriggert!

### Entscheidung

**PFLICHT-REGEL: Import OHNE Classification ist unvollständig!**

**Neuer Standard-Workflow (egal wie importiert wird):**
```
1. Import (CSV/Excel/Code) → Schreibt LedgerEntries
2. Classification → Erstellt suggested* Felder  ⭐ PFLICHT
3. Review → Admin akzeptiert/korrigiert
4. Commit → Übernimmt in finale Felder
```

**Konkret für HVPlus (Nacharbeit erforderlich):**
- Alle 691 IST-Entries müssen klassifiziert werden
- Bulk-Review mit Preview
- categoryTags übernehmen
- Audit-Trail vollständig dokumentieren

### Begründung

**Warum ist Classification kritisch?**
1. **Liqui-Matrix funktioniert nicht:** Filtert nach categoryTag → zeigt 0 statt echte Daten
2. **Alt/Neu-Trennung unklar:** Ohne Tags keine saubere Trennung in Matrix
3. **Datenqualität:** Unklassifizierte Daten = unbrauchbare Daten

**Warum IMMER, egal wie importiert?**
- Import-Engine, manueller Code, Excel-Upload - egal!
- Classification ist TEIL des Imports, nicht optional
- Verhindert zukünftige "categoryTag = NULL"-Probleme

### Konsequenzen

**Sofort:**
- HVPlus: 691 Entries klassifizieren (Interactive Review mit User)
- Classification Rules erweitern basierend auf Learnings

**Langfristig:**
- **Import-Hooks:** Auto-Classify bei `ledgerEntry.create()`
- **Admin-UI:** "Klassifikation & Bulk-Accept" Seite
- **Dokumentation:** Import-Checkliste mit Classification als Pflichtschritt

**Audit-Trail:**
- Jede Classification muss nachvollziehbar sein
- `categoryTagSource`: IMPORT | AUTO | MANUELL
- `categoryTagNote`: Begründung (z.B. "Übernommen: HZV (COUNTERPARTY_PATTERN)")
- Alle Änderungen in `ledger_audit_logs`

### Relevante Dateien

- `/lib/classification/engine.ts` - Classification Logic
- `/api/cases/[id]/ledger/bulk-review/route.ts` - Bulk-Accept API
- `/app/docs/ARCHITECTURE.md` - Import-Workflow aktualisieren
