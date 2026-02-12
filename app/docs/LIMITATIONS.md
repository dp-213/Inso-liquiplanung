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

## Funktionale Einschränkungen

### Keine Währungsumrechnung

Alle Beträge in EUR. Deutsche Insolvenzverfahren sind EUR-basiert.

### Classification Engine filtert nach reviewStatus

`matchCounterpartyPatterns()` matched nur Entries mit `reviewStatus = 'UNREVIEWED'`. Bestätigte Entries werden übersprungen.
**Workaround:** Explizite Entry-IDs übergeben.

### Privatpatienten-Rechnungen ohne einheitliches Format

~60 Privatpatienten-Rechnungen mit sehr unterschiedlichen Formaten. Ein einzelnes Pattern würde False Positives erzeugen.
**Workaround:** Sammel-Counterparty "Privatpatient*innen" + manuelle Klassifikation.

### Sammelüberweisungen ohne Einzelaufschlüsselung

29 Sammelüberweisungen (179K EUR) ohne Details zu Empfängern/Zwecken.
**Workaround:** Details von IV/Buchhalterin nachliefern.

### IST-Vorrang ist nicht umkehrbar

Wenn IST-Daten für eine Periode existieren, werden PLAN-Daten automatisch ignoriert (nicht löschbar).
**Workaround:** IST/PLAN-Vergleichs-Tab zeigt beide Werte nebeneinander.

### Keine automatische PLAN-Löschung bei IST-Import

PLAN-Daten bleiben bewusst für Vergleich und Audit erhalten.

### Keine Teilbeträge bei Dimensionen

Ein LedgerEntry kann nur einer Gegenpartei/einem Bankkonto zugeordnet werden.
**Workaround:** Separate Entries für verschiedene Dimensionen.

### Forecast-Modul in Entwicklung

Vorwärtsgerichtete Liquiditätsprognose als separates Modul (Schema + Sidebar-Link vorhanden, Logik in Entwicklung).
**Aktuell:** Manuelle PLAN-Werte über Freie Planung.

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
**Status:** Bekannt, niedrige Priorität. Portal-spezifische Seiten und Navigation sind bereits migriert.

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

---

## Frontend-Einschränkungen

### Planung-Seite noch nicht migriert

`/admin/cases/[id]/planung` zeigt Placeholder. PLAN-Entries über Ledger einsehbar.

### Zahlungsverifikation: Kein Drill-Down pro Kategorie

SOLL/IST-Abgleich zeigt nur aggregierte Netto-Werte pro Periode. Aufschlüsselung nach einzelnen CashflowCategories oder Einnahmen/Ausgaben getrennt ist nicht verfügbar.
**Workaround:** Ledger-Detailansicht mit Zeitraumfilter nutzen.

### Eingeschränkte Standort-Ansicht

Bei Scope != GLOBAL werden Revenue- und Banks-Tabs ausgeblendet (kein Scope-Support).

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

---

**Letzte Aktualisierung:** 2026-02-12 (v2.27.0)
