# TODO: Offene Features & Verbesserungen

## P0 - Kritisch

### ~~Scope-Support für RevenueTable~~ + BankAccountsTab

**Status:** RevenueTable ERLEDIGT (v2.29.0), BankAccountsTab offen

**RevenueTable:** ✅ Scope-Filter implementiert. `RevenueTabContent` übergibt `scope` an Revenue-API, Chart und Tabelle filtern korrekt nach Standort.

**BankAccountsTab:** Noch offen – wird bei Scope != GLOBAL ausgeblendet.

**Betroffene Komponente:**
- **BankAccountsTab** (`/components/dashboard/BankAccountsTab.tsx`) - braucht Filterung nach locationId

**Betroffene API-Route:**
- `/api/cases/[id]/bank-accounts/route.ts` - Scope-Parameter lesen + filtern

**Kritikalität:** Niedrig (Quick-Fix verhindert falsche Darstellung)

---

### Virtuelles Konto "Insolvenzmasse (Pre-ISK)"

**Status:** Analysiert, Implementierungsplan vorhanden
**Dokumentation:** `docs/archiv/PLAN_VIRTUAL_ACCOUNT.md`, `docs/archiv/IMPACT_VIRTUAL_ACCOUNT.md`

**Ziel:** Virtuelles Konto für Pre-ISK-Phase (Oktober 2025) einführen, das alle Schuldner-Konten konsolidiert.

---

### LANR-Location-Mapping korrigieren (HVPlus)

**Status:** Bug identifiziert, nicht behoben

**Problem:** 4 von 8 Ärzten falschem Standort zugeordnet (alle zu Uckerath statt Velbert/Eitorf).

**Impact:** ~50% der HZV-Einnahmen am falschen Standort, Standort-Analyse unbrauchbar.

---

### ~~Bank-spezifische Zeilen in Liqui-Matrix zeigen 0 EUR~~ ERLEDIGT 2026-02-09

Bankkonten-Details (Opening/Closing Balance pro Bank) bewusst aus Liquidity Matrix entfernt (ADR-030). Bankkonten-Tab im Dashboard zeigt diese Informationen.

---

### categoryTags nach Import ausführen

**Status:** Pflicht-Regel eingeführt (ADR-028), muss bei jedem Import beachtet werden

### Sammelüberweisungen splitten (28 auf ISK)

**Status:** 9 mit UPLOADED Zahlbelegen (Split-Workflow triggern), ~19 warten auf Zahlbelege vom IV

**Impact:** -195K EUR in FALLBACK „Sonstige Auszahlungen". Nach Split landen Einzelposten in korrekten Matrix-Zeilen.

---

## P1 - Wichtig

### Automatischer Turso-Sync-Check im Dashboard

**Status:** Offen (ADR-056)

**Problem:** Lokale Imports/Scripts schreiben nur in SQLite. Turso-Sync muss manuell erfolgen. Stiller Drift wird erst bei manuellem Count-Vergleich entdeckt.

**Ziel:** Dashboard-Widget oder API-Check der automatisch Entry-Counts zwischen letztem bekannten Turso-Stand und aktuellem Stand vergleicht. Bei Drift: Warnung im Admin-Dashboard.

**Priorität:** Mittel – manuelle Regel (CLAUDE.md) reicht kurzfristig, automatisch wäre langfristig sicherer.

---

### Refactoring: Service Layer für API-Routen

**Status:** ZURÜCKGESTELLT
**Dokumentation:** `docs/TODO_REFACTORING.md`

**Ziel:** API-Routen in testbare Services aufteilen. Teilweise begonnen: Aggregationslogik aus `liquidity-matrix/route.ts` nach `lib/liquidity-matrix/aggregate.ts` extrahiert (v2.18.0).

---

### Fehlende Dezember-Kontoauszüge (HVPlus)

**Status:** Teilweise gelöst – ISK-Daten vollständig, Geschäftskonten offen

ISK-Einzahlungsliste (Nov-Dez 2025) vom IV erhalten und verifiziert: 247 Entries, 100% deckungsgleich mit DB. Fehlend bleiben: Sparkasse HRV, apoBank HVPlus, apoBank Uckerath (Geschäftskonten).

---

### ~~Cases/HVPlus/ Legacy-Ordner konsolidieren~~ ERLEDIGT 2026-02-10

Legacy-Ordner aufgelöst: 4 unique Dateien nach `01-raw/` verschoben, 2 ältere Versionen mit `_V1-legacy` Suffix behalten, 1 identisches Duplikat + 2 Temp-Dateien entfernt, Ordner gelöscht.

---

### Freigabe-Modul: Phase 2

**Status:** Phase 1 implementiert (v2.21.0), Lirex Must-Haves umgesetzt (v2.34.0), Phase 2 teilweise offen

**Erledigt (v2.34.0):**
- ~~**Kreditoren-Stammdaten:**~~ Entity `Creditor` mit CRUD-Seite, optional bei Orders
- ~~**Kostenarten pro Fall:**~~ Entity `CostCategory` mit Budget + categoryTag-Mapping
- ~~**Auto-Freigabe-Schwellwert:**~~ `Case.approvalThresholdCents`, atomare LedgerEntry-Erstellung
- ~~**Portal-Navigation aktivieren:**~~ Freigaben-Link im Kundenportal aktiv (v2.27.0 DashboardNav)

**Offene Erweiterungen:**
1. **Email-Benachrichtigungen:** Resend-Integration – IV bei neuer Anfrage, Einreicher bei Genehmigung/Ablehnung benachrichtigen
2. **Multi-File-Upload:** Mehrere Belege pro Anfrage
3. **Rate-Limiting:** Submit-API gegen Missbrauch absichern
4. **Bestellstatus-Tracking:** Nach Genehmigung: "Bestellt" → "Geliefert" → "Bezahlt"
5. **Mehrstufige Schwellwerte:** Verschiedene Genehmiger pro Betragsstufe (Lirex-Vorbild)
6. **Budget-Warnungen:** CostCategory.budgetCents als Warnung bei Überschreitung nutzen

---

## P2 - Nice-to-have

### Planung-Seite migrieren

**Status:** Zeigt aktuell Placeholder. PLAN-Entries über Ledger einsehbar.

### ~~Finanzierung-Seite implementieren~~ ERLEDIGT 2026-02-10

Redirect auf `/banken-sicherungsrechte` mit Bankenspiegel, Sicherungsrechte und Massekredit-Status (v2.24.0).

### ~~Zahlungsverifikation (SOLL vs. IST)~~ ERLEDIGT 2026-02-12

SOLL/IST-Abgleich implementiert mit Ampelsystem (v2.25.0). PLAN vs. IST pro Periode, Zusammenfassung + Perioden-Tabelle.

---

### Dark Mode: Hardcodierte Farben in Dashboard-Tabs

**Status:** Identifiziert, nicht behoben

**Problem:** `MasseCreditTab.tsx` und `BankAccountsTab.tsx` verwenden hardcodierte Tailwind-Farben (z.B. `bg-green-100 text-green-800`) ohne `dark:`-Varianten. Status-Badges, KPI-Cards und Warning-Banner sind im Dark Mode schlecht lesbar.

**Betroffene Komponenten:**
1. `MasseCreditTab.tsx` – Status-Badges, KPI-Cards, Warning/Error-Banner
2. `BankAccountsTab.tsx` – STATUS_COLORS, Gradient-Header, Perioden-Tabelle

**Kritikalität:** Niedrig (funktional korrekt, nur visuell suboptimal im Dark Mode)

---

### ~~Portal Security-Tab: Echte Daten statt Demo-Daten~~ ERLEDIGT 2026-02-12

Neue kombinierte Seite `/portal/banken-sicherungsrechte` mit echten Bankdaten aus Customer-API. Alte Routen `/finanzierung` und `/security` redirecten. Navigation synchronisiert mit Admin-Dashboard (v2.27.0).

---

### Dark Mode: Externe Komponenten (Tabellen, Charts)

**Status:** Identifiziert, niedrige Priorität

**Problem:** `InsolvencyEffectsTable`, `PlanningAssumptions`, `LiquidityTable` und Chart-Tooltips verwenden noch `bg-white`/`bg-gray-50`. Portal-Seiten und Navigation sind bereits auf CSS-Variablen migriert.

---

### Subdomain-Automatisierung

**Status:** Manueller Workflow, funktioniert

Aktuell muss pro Kunde manuell `vercel domains add slug.cases.gradify.de` ausgeführt werden. Bei >10 Kunden auf Vercel API-Automatisierung umsteigen.

---

## P3 - Irgendwann

### Empty States mit Wegweiser

**Status:** Idee, zurückgestellt bis Seiten stabil

Leere Seiten (z.B. Zahlungsregister ohne Entries, Prognose ohne Annahmen) zeigen aktuell leere Tabellen. Stattdessen: Schöner Empty State mit Erklärung + Link zum nächsten Schritt. Erst umsetzen wenn die Kernseiten nicht mehr ständig umgebaut werden.

---

**Letzte Aktualisierung:** 2026-02-13 (v2.52.0)

