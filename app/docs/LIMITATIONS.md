# Bekannte Einschränkungen

Dieses Dokument listet bekannte Einschränkungen und bewusste Nicht-Implementierungen.

---

## Architektur-Einschränkungen

### Keine Echtzeit-Synchronisation

Änderungen werden nicht in Echtzeit zwischen Browsern synchronisiert.
**Workaround:** Browser-Refresh.

### Kein Offline-Modus

Die Anwendung funktioniert nur mit Internetverbindung.
**Workaround:** PDF-Export für Offline-Ansicht.

### Keine Multi-Tenancy auf DB-Ebene

Alle Kunden teilen eine Datenbank. Trennung erfolgt per `caseId`/`customerId`.

---

## Datenbank-Einschränkungen

### Prisma/Turso: Keine Date-Vergleiche in WHERE-Klauseln

`@prisma/adapter-libsql` v6.19.2 generiert fehlerhafte SQL für Date-Vergleiche auf Turso. `transactionDate: { gte: new Date(), lte: new Date() }` gibt immer 0 Ergebnisse zurück.
**Workaround:** Date-Filter in JavaScript statt in Prisma WHERE (ADR-046). Betrifft 7+ Stellen, markiert mit `// NOTE: Date filter applied in JS (Turso adapter date comparison bug)`.
**Rückbau:** Bei Prisma v7.x oder Adapter-Fix prüfen. `grep -r "Turso adapter date comparison bug"` findet alle Stellen.

---

## Funktionale Einschränkungen

### Keine Währungsumrechnung

Alle Beträge in EUR. Deutsche Insolvenzverfahren sind EUR-basiert.

### Classification Engine filtert nach reviewStatus

`matchCounterpartyPatterns()` matched nur Entries mit `reviewStatus = 'UNREVIEWED'`. Bestätigte Entries werden übersprungen.
**Workaround:** Explizite Entry-IDs übergeben.

### suggestCategoryTags() schlägt nur Parent-Tags vor

Für Entries die über COUNTERPARTY_ID auf eine Zeile mit mehreren CATEGORY_TAGs matchen (z.B. `cash_out_betriebskosten`), wird immer der ERSTE Tag vorgeschlagen (BETRIEBSKOSTEN). Feinere Tags (KOMMUNIKATION, BUERO_IT, LEASING) erfordern manuelle Anpassung nach Accept.
**Workaround:** Nach Bulk-Accept gezielt Sub-Tags über Ledger-Detail-Seite setzen.

### Privatpatienten-Rechnungen ohne einheitliches Format

~60 Privatpatienten-Rechnungen mit sehr unterschiedlichen Formaten. Ein einzelnes Pattern würde False Positives erzeugen.
**Workaround:** Sammel-Counterparty "Privatpatient*innen" + manuelle Klassifikation.

### Zahlbeleg-Aufschlüsselung: Bank-Mapping hardcodiert

`BANK_ACCOUNT_MAPPING` in `breakdown/route.ts` kennt nur BW-Bank ISK-Konten (Uckerath + Velbert). Neue Bankkonten müssen manuell ergänzt werden.
**Betrifft:** Nur den Zahlbeleg-Upload; Splitting selbst ist bank-agnostisch.

### Sammelüberweisungen: 28 ohne Split auf ISK-Konten

28 Sammelüberweisungen auf ISK-Konten (Dez + Jan) haben keine Children und landen im Matrix-FALLBACK „Sonstige Auszahlungen" (-195K EUR). 9 davon haben UPLOADED Zahlbelege (Split-Workflow noch nicht getriggert), ~19 haben noch keine Zahlbelege.
**Workaround:** Zahlbelege vom IV nachliefern, über PaymentBreakdownPanel hochladen und splitten.

### 22 ISK-Entries ohne Counterparty

22 ISK-Entries (Patientenzahlungen, Befundberichte) ohne zugewiesene Counterparty-ID. Total ~1.051 EUR, landen im FALLBACK „Sonstige Einzahlungen". Counterparty-Zuweisung über `matchCounterpartyPatterns()` oder manuell nötig.
**Impact:** Gering (Kleinstbeträge, korrekt im Fallback).

### IST-Vorrang ist nicht umkehrbar

Wenn IST-Daten für eine Periode existieren, werden PLAN-Daten automatisch ignoriert (nicht löschbar).
**Workaround:** IST/PLAN-Vergleichs-Tab zeigt beide Werte nebeneinander.

### Keine automatische PLAN-Löschung bei IST-Import

PLAN-Daten bleiben bewusst für Vergleich und Audit erhalten.

### Keine Teilbeträge bei Dimensionen

Ein LedgerEntry kann nur einer Gegenpartei/einem Bankkonto zugeordnet werden.
**Workaround:** Separate Entries für verschiedene Dimensionen.

---

## HVPlus-Fall: Offene Punkte

### Januar-HZV-Klassifikation basiert auf Annahme

58 HZV-Gutschriften im Januar 2026 ohne Quartalsangabe wurden als Q4/2025-Abschläge klassifiziert (annahme-basiert).
**Status:** Verifikation mit IV ausstehend.
**Dokumentiert in:** ADR-027

### Fehlende Dezember-Kontoauszüge

3 von 5 Bankkonten ohne Dezember-Daten (Sparkasse, apoBank HVPlus, apoBank Uckerath). ISK-Einzahlungsliste (Nov-Dez) liegt jetzt vor und deckt ISK-Seite ab.
**Status:** Offene Datenanforderung an IV für Geschäftskonten-Auszüge.

### Portal: Externe Komponenten noch mit hardcodierten Farben

Tabellen-Komponenten (`InsolvencyEffectsTable`, `PlanningAssumptions`, `LiquidityTable`) und Chart-Tooltips verwenden noch `bg-white`/`bg-gray-50` statt CSS-Variablen.
**Status:** Bekannt, niedrige Priorität. Portal-Standalone-Seiten (revenue, estate, etc.) wurden in v2.29.0 eliminiert – nur noch `UnifiedCaseDashboard`.

## Freigabe-Modul (Orders)

### Base64-Dokumentenspeicherung begrenzt skalierbar

Belege werden als Base64 direkt in der Datenbank gespeichert. Bei vielen großen Dokumenten kann dies die DB-Größe erheblich erhöhen.
**Limit:** ~10MB pro Dokument, Turso-Limits beachten.
**Langfristig:** Bei >500 Dokumenten pro Fall auf S3/R2 migrieren.

### Kein Rate-Limiting auf Submit-API

Das externe Einreichungsformular (`/api/company/orders`) hat kein Rate-Limiting. Theoretisch können unbegrenzt Anfragen eingereicht werden.
**Workaround:** Token deaktivieren bei Missbrauch.

### Keine Email-Benachrichtigungen

Weder der IV noch die einreichende Partei werden über Statusänderungen benachrichtigt.
**Phase 2:** Resend-Integration für Benachrichtigungen.

### Kein Multi-File-Upload

Pro Anfrage kann nur ein Beleg hochgeladen werden.
**Phase 2:** Mehrere Belege pro Anfrage.

### Portal-Freigaben nur über Direktlink

Die Freigaben-Seite (`/portal/cases/[id]/orders`) ist in der DashboardNav verlinkt, aber als Phase-1-Feature primär für admin-gesteuerte Nutzung vorgesehen.

## Subdomain-Einschränkungen

### Manuelle Domain-Freischaltung pro Kunde

Jeder Kunden-Slug erfordert manuelle Freischaltung in Vercel (`vercel domains add slug.cases.gradify.de`). Keine automatische Provisionierung.
**Langfristig:** Vercel API-Automatisierung bei >10 Kunden.

### Slug nicht nachträglich änderbar

Slug wird bei Kundenerstellung gesetzt. Änderung erfordert manuellen DB-Update + Vercel Domain-Update.
**Workaround:** Neuen Slug anlegen, alten in Vercel entfernen.

### Subdomain-Login nur mit Slug

Kunden ohne Slug können nicht über eine individuelle Subdomain zugreifen. Login weiterhin über `cases.gradify.de/customer-login`.

---

## Frontend-Einschränkungen

### Planung-Seite noch nicht migriert

`/admin/cases/[id]/planung` zeigt Placeholder. PLAN-Entries über Ledger einsehbar.

### Geschäftskonten-Analyse: Unklassifizierte Entries nicht nach Standort filterbar

Bei aktivem Standort-Filter werden unklassifizierte Entries komplett ausgeblendet, da ihnen keine Location-Zuordnung möglich ist (kein `locationId` auf Entry-Ebene, und ohne Counterparty kann kein Location-Bezug hergestellt werden).
**Workaround:** Standort-Filter deaktivieren um unklassifizierte Entries zu sehen.

### Datenqualitäts-Checks: Case-spezifische Konfiguration erforderlich

`COUNTERPARTY_TAG_MAP` und `QUARTAL_CHECK_TAGS` liegen in der case-spezifischen `matrix-config.ts`. Jeder neue Fall muss seine eigene Map pflegen. Ohne Map laufen Check 1–3 leer (= „allPassed", keine Fehler erkannt).
**Workaround:** Beim Onboarding neuer Fälle `COUNTERPARTY_TAG_MAP` in der matrix-config anlegen.

### Datenqualitäts-Checks: Check 6 Schwellwert ist global

Check 6 (Gegenparteien ohne Match-Pattern) nutzt eine feste Schwelle von 5 Entries. CPs mit 1-4 Entries werden nie gewarnt, auch wenn sie falsch zugeordnet sind. Die Schwelle ist nicht pro Fall konfigurierbar.
**Workaround:** Manuell CPs mit <5 Entries prüfen, wenn Verdacht auf Fehlzuordnung besteht.

### Keine automatische Lokal↔Turso Synchronisierung

Daten-Imports und Script-Ausführungen schreiben nur in die lokale SQLite-DB. Der Sync zu Turso-Production muss manuell erfolgen. Es gibt keine automatische Drift-Erkennung.
**Workaround:** Nach jedem Import/Script: Entry-Count-Abgleich zwischen lokaler DB und Turso (ADR-056). Langfristig automatisierten Check im Dashboard einbauen.

### Datenqualitäts-Checks: Check 3 nur für KV-Buchungen

estateAllocation-Quartal-Check gilt nur für `categoryTag = 'KV'`. HZV und PVS haben andere Abrechnungsregeln (Vormonat bzw. Behandlungsdatum), die nicht durch einfache Quartal-Logik validierbar sind.
**Status:** Bewusste Einschränkung, HZV/PVS-Checks bei Bedarf ergänzen.

### Zahlungsverifikation: Kein Drill-Down pro Kategorie

SOLL/IST-Abgleich zeigt nur aggregierte Netto-Werte pro Periode. Aufschlüsselung nach einzelnen CashflowCategories oder Einnahmen/Ausgaben getrennt ist nicht verfügbar.
**Workaround:** Ledger-Detailansicht mit Zeitraumfilter nutzen.

### Eingeschränkte Standort-Ansicht

Bei Scope != GLOBAL wird der Banks-Tab ausgeblendet (kein Scope-Support). Revenue-Tab unterstützt Scope-Filter seit v2.29.0.

---

## Import-Einschränkungen

### Keine automatische Bankformat-Erkennung

User muss Spalten-Mapping manuell konfigurieren.

### Schwache Duplikat-Erkennung im Import-Script

Nur exakte String-Übereinstimmung bei Description. Variationen führen zu Duplikaten.
**Zukünftig:** Robuste Prüfung über `(bankAccountId + transactionDate + amountCents)`.

### Maximale Dateigröße ~10MB

Vercel Serverless-Limit.

---

## Entwicklungs-Einschränkungen

### Localhost Dev-Server instabil bei parallelen Prozessen

Mehrere `npm run dev` Prozesse gleichzeitig → "Internal Server Error".
**Fix:** `pkill -f "next dev"` und neu starten.

### Analyse-Scripts dürfen nicht in /app liegen

Next.js kompiliert alle `.ts` in `/app`. Scripts ins Repository-Root legen.

### Webpack Build-Cache-Korruption

Nach Prisma-Operationen kann `.next` Cache korrupt werden.
**Fix:** `rm -rf .next node_modules/.cache && npm install && npm run dev`

---

## Sicherheits-Einschränkungen

### Keine 2FA

### Keine Passwort-Komplexitätsregeln

Admin generiert Passwörter, User können nicht ändern.

### Kein Impressum / Datenschutzerklärung

Rechtlich Pflicht sobald Kunden-Portal öffentlich erreichbar. Rechtstexte müssen vom Anwalt/Generator erstellt werden.

### Dark Mode: Nicht alle Komponenten pixel-perfekt

Globale CSS-Overrides decken ~95% der UI ab. Einige externe Komponenten (Chart-Tooltips, InsolvencyEffectsTable, PlanningAssumptions) können noch hardcoded Light-Mode-Farben enthalten.
**Workaround:** Betroffene Stellen bei Bedarf einzeln anpassen.

---

## Performance-Einschränkungen

### Große Ledger-Ansichten

Bei >1000 Entries kann die Ansicht langsam werden. Filter verwenden.

### Aggregations-Cache

Aggregationen werden bei jeder Änderung neu berechnet (kein inkrementelles Update).

---

## Gelöste Einschränkungen (Archiv)

### ~~IST-Vorrang bei parallelen IST/PLAN-Daten~~ GELÖST 2026-02-08

IST-Vorrang in `aggregateLedgerEntries()` implementiert. 21 PLAN-Einträge korrekt verdrängt, -327K EUR Überdeckung eliminiert.

### ~~Gemischte Datenbank-Zeitstempel~~ GELÖST 2026-02-08

691 IST-Entries gegen PDF-Kontoauszüge verifiziert. Alle Kontosalden Euro-genau korrekt.

### ~~Prisma Client locationId null~~ GELÖST 2026-02-08

API nutzt jetzt echte DB-Relation statt Name-Matching Workaround.

### ~~categoryTags fehlen nach Import~~ GELÖST 2026-02-08

Pflicht-Regel ADR-028 eingeführt: Classification MUSS bei jedem Import erfolgen.

### ~~Bank-spezifische Zeilen in Liqui-Matrix zeigen 0 EUR~~ GELÖST 2026-02-09

Bankkonten-Details bewusst aus Liquidity Matrix entfernt (ADR-030). Bankkonten-Tab im Dashboard zeigt diese Informationen.

### ~~Finanzierung-Seite nicht implementiert~~ GELÖST 2026-02-10

Redirect auf `/banken-sicherungsrechte` (v2.24.0). Bankenspiegel, Sicherungsrechte und Massekredit-Status dort zusammengefasst.

### ~~Zahlungsverifikation nicht implementiert~~ GELÖST 2026-02-12

SOLL/IST-Abgleich mit Ampelsystem implementiert (v2.25.0). PLAN vs. IST pro Periode mit Abweichungsanalyse.

### ~~Portal Security-Tab zeigt Demo-Daten~~ GELÖST 2026-02-12

Neue kombinierte Seite `/portal/cases/[id]/banken-sicherungsrechte` ersetzt Demo-Daten mit echten Bankdaten aus Customer-API (v2.27.0).

### ~~Portal-Navigation inkonsistent mit Admin~~ GELÖST 2026-02-12

"Finanzierung" + "Sicherungsrechte" zu "Banken & Sicherungsrechte" zusammengeführt. Alte Routen redirecten (v2.27.0).

### ~~Forecast-Modul in Entwicklung~~ GELÖST 2026-02-12

Prognose-Modul vollständig implementiert (v2.28.0): Szenarien, Annahmen-Editor, Forecast Engine mit Dashboard-Integration. Turso-Tabellen (`forecast_scenarios`, `forecast_assumptions`) erstellt. UX-Redesign in v2.31.0: Unified Spreadsheet mit Inline-Edit, Quick-Add und Detail-Drawer (ADR-044).

### ~~Portal: Zwei konkurrierende Navigations-Systeme~~ GELÖST 2026-02-12

Standalone-Portal-Seiten (revenue, estate, banken-sicherungsrechte, compare) mit Legacy-`DashboardNav` durch Redirects auf `UnifiedCaseDashboard` ersetzt. Dead Code gelöscht (v2.29.0, ADR-043).

### ~~Revenue-Tab nur nach Counterparty gruppiert~~ GELÖST 2026-02-12

Einnahmen-Tabelle und neuer Trend-Chart gruppieren jetzt nach `categoryTag` (HZV, KV, PVS etc.) statt nach `counterpartyName`. Shared Helper `groupByCategoryTag()` als Single Source of Truth (v2.29.0).

---

### ~~Debug-Routes öffentlich erreichbar~~ GELÖST 2026-02-12

`/api/debug/db` und `/api/debug/cases` waren ohne Auth-Check öffentlich zugänglich. Jetzt mit `getSession().isAdmin`-Prüfung abgesichert (v2.38.0).

### ~~Demo-Zugangsdaten auf Login-Seite~~ GELÖST 2026-02-12

Klartext-Credentials (`admin / Liqui2026`) von der Admin-Login-Seite entfernt (v2.38.0).

### ~~Kein Dark Mode~~ GELÖST 2026-02-12

Vollständiger Dark Mode mit System-Preference-Erkennung und manuellem Toggle implementiert (v2.38.0, ADR-050).

### ~~Unprofessionelles Branding~~ GELÖST 2026-02-12

Rebranding zu "Gradify Cases | Structured Case Management" mit OG-Image für Social-Previews (v2.38.0, ADR-051).

---

**Letzte Aktualisierung:** 2026-02-13 (v2.47.0)
