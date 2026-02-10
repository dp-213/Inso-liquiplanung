# TODO: Offene Features & Verbesserungen

## P0 - Kritisch

### Scope-Support für RevenueTable + BankAccountsTab

**Status:** Quick-Fix implementiert (Tabs werden ausgeblendet bei Scope != GLOBAL)

**Problem:**
- RevenueTable und BankAccountsTab respektieren den Scope-Toggle nicht
- Quick-Fix: Tabs werden ausgeblendet wenn Scope != GLOBAL

**Betroffene Komponenten:**
1. **RevenueTable** (`/components/dashboard/RevenueTable.tsx`) - braucht `scope`-Parameter
2. **BankAccountsTab** (`/components/dashboard/BankAccountsTab.tsx`) - braucht Filterung nach locationId

**Betroffene API-Routes:**
1. `/api/cases/[id]/ledger/revenue/route.ts` - Scope-Parameter lesen + filtern
2. `/api/cases/[id]/bank-accounts/route.ts` - Scope-Parameter lesen + filtern

**Kritikalität:** Mittel (Quick-Fix verhindert falsche Darstellung)

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

---

## P1 - Wichtig

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

**Status:** Phase 1 implementiert (v2.21.0), Phase 2 geplant

**Offene Erweiterungen:**
1. **Email-Benachrichtigungen:** Resend-Integration – IV bei neuer Anfrage, Einreicher bei Genehmigung/Ablehnung benachrichtigen
2. **Multi-File-Upload:** Mehrere Belege pro Anfrage
3. **Portal-Navigation aktivieren:** Freigaben-Link im Kundenportal einschalten (aktuell admin-only)
4. **Rate-Limiting:** Submit-API gegen Missbrauch absichern
5. **Bestellstatus-Tracking:** Nach Genehmigung: "Bestellt" → "Geliefert" → "Bezahlt"

---

## P2 - Nice-to-have

### Planung-Seite migrieren

**Status:** Zeigt aktuell Placeholder. PLAN-Entries über Ledger einsehbar.

### Finanzierung-Seite implementieren

**Status:** Placeholder. Massekreditvertrag und Darlehens-Details noch nicht in DB.

### Zahlungsverifikation (SOLL vs. IST)

**Status:** Placeholder. SOLL-IST-Vergleich noch nicht implementiert.

---

**Letzte Aktualisierung:** 2026-02-10 (v2.22.0)

