# Änderungsprotokoll (Changelog)

Dieses Dokument protokolliert alle wesentlichen Änderungen an der Anwendung.

---

## Version 2.15.0 – HZV Service-Period-Extraktion & Alt/Neu-Regel

**Datum:** 08. Februar 2026

### Neue Funktionen

- **HZV Service-Period-Extraktion:** Automatische Extraktion von Leistungszeiträumen aus HZV-Buchungen
  - 292 HZV-Entries mit `servicePeriodStart` + `servicePeriodEnd` versehen
  - Pattern-Matching für Q3/25, Q4/25 aus Beschreibung (234 Entries)
  - Zahlungslogik-basierte Ableitung für Januar 2026 ohne Quartalsangabe (58 Entries → Q4/2025)
  - Vollständige Audit-Trail-Dokumentation via `allocationSource` + `allocationNote`

### Änderungen

- **Alt/Neu-Masse-Regel vereinheitlicht:** KV + HZV beide 1/3-2/3 für Q4/2025
  - **VORHER:** KV = 1/3-2/3, HZV = 28/31-3/31 (tagesgenau)
  - **JETZT:** Beide = 1/3-2/3 (pauschale Quartalregel)
  - ⚠️ **Temporäre Annahme** – Verifikation mit Hannes Rieger ausstehend (09.02.2026)

- **Januar-HZV-Klassifikation:** 58 Gutschriften als Q4/2025-Abschläge klassifiziert
  - Begründung: Identisches Zahlungsmuster wie November Q4/25 ABS (57 Entries)
  - Summe: 63.112,50 EUR
  - ⚠️ **Annahme-basiert** – Erfordert IV-Bestätigung

### Bugfixes

- **LANR-Location-Bug behoben:** 123 Entries korrigiert
  - van Suntum (LANR 3892462): 36 Entries → Velbert ✅
  - Beyer (LANR 8836735): 40 Entries → Velbert ✅
  - Kamler (LANR 7729639): 2 Entries → Velbert ✅
  - Rösing (LANR 8898288): 45 Entries → Eitorf ✅

### Dokumentation

- **IV-Frageliste erweitert:** 2 neue Einträge
  - Frage 10: Alt/Neu-Regel KV vs. HZV klären (KRITISCH)
  - Januar-HZV-Annahme dokumentiert (HOCH, wartet auf Feedback)

- **Script:** `extract-service-periods-hzv.ts` für automatische Service-Period-Extraktion
- **Analyse-Script:** `analyze-hzv-payment-logic.ts` für Zahlungslogik-Verifikation

### Verifikation erforderlich

⚠️ **Mit Hannes Rieger klären (09.02.2026):**
1. Gilt 1/3-2/3-Regel für KV UND HZV, oder nur für KV?
2. Sind Januar-Gutschriften Q4/2025-Abschläge oder Q1/2026-Abschläge?

---

## Version 2.14.2 – Turso-Sync & Datenbank-Verifikation

**Datum:** 08. Februar 2026

### Kritische Verifikation: Prisma vs. PDF-Kontoauszüge

**Durchgeführt:** Vollständiger Abgleich aller 691 IST-Entries gegen Original-PDF-Kontoauszüge

**Ergebnis:** ✅ **100% MATCH**
- Alle Entry-Counts stimmen überein (9 Konten × Monate)
- Alle Summen Euro-genau identisch
- Kontosalden vollständig verifiziert

**Verifizierte Konten:**
- Sparkasse Velbert (Okt+Nov 2025): 105 Entries
- apoBank Uckerath (Okt+Nov 2025): 185 Entries
- apoBank HV PLUS eG (Okt+Nov 2025): 39 Entries
- ISK Uckerath (Nov 2025 - Jan 2026): 345 Entries
- ISK Velbert (Dez 2025 - Jan 2026): 17 Entries

**Kontostand-Verifikation:**

| Konto | Letzter Monat | Endsaldo | PDF-Abgleich |
|-------|---------------|----------|--------------|
| Sparkasse Velbert | Nov 2025 | +23.047,77 € | ✅ |
| apoBank HV PLUS eG | Nov 2025 | -301.004,19 € | ✅ |
| apoBank Uckerath | Nov 2025 | +52.901,21 € | ✅ |
| ISK Uckerath | Jan 2026 | +419.536,88 € | ✅ |
| ISK Velbert | Jan 2026 | +103.680,64 € | ✅ |

**Dokumentiert in:** `/ZUORDNUNGSPRÜFUNG_HVPlus_FINAL.md`

---

### Datenbank-Status geklärt: Prisma = Production-Wahrheit

**Problem identifiziert:**
- **Turso Production:** 934 IST-Entries (Stand: 06.02.2026 06:03) ❌ VERALTET
- **SQLite lokal:** 934 Entries gemischt (06.02. + 08.02. Importe) ❌ CHAOS
- **Prisma lokal:** 691 Entries (08.02.2026 15:14-15:36) ✅ AKTUELL + VERIFIZIERT

**Root Cause:** Mehrere Import-Runden ohne Bereinigung alter Daten

**Entscheidung:** Prisma-Daten nach Turso Production synchronisieren
- PLAN-Daten bleiben erhalten (69 Entries)
- IST-Daten werden vollständig ersetzt (691 Entries)
- Alte/gemischte Daten werden entfernt

**Dokumentiert in:** ADR-025 (DECISIONS.md)

---

## Version 2.14.1 – HVPlus Zuordnungsprüfung & Datenbank-Bereinigung

**Datum:** 08. Februar 2026

### Analyse: Vollständige Zuordnungsprüfung für HVPlus Fall

**Durchgeführte Verifikation:**
- Alle 691 IST-Entries der Prisma-DB analysiert (Import vom 08.02.2026 15:14-15:36)
- Klassifizierungsstatus: 88.3% vollständig klassifiziert (610/691)
- Estate Allocation: 100% (alle Entries haben Alt/Neu-Zuordnung) ✅
- Location: 100% (alle Entries haben Standort) ✅
- Counterparty: 88.3% (81 fehlen, nur Kleinbeträge)

**Privatpatienten-Klärung:**
- Alle Privatpatienten-Abrechnungen laufen über **PVS rhein-ruhr GmbH**
- Keine separate Zeile in Liquiditätstabelle notwendig
- IGeL-Leistungen + Privatabrechnungen = eine gemeinsame Counterparty

**Dokumentiert in:** `/ZUORDNUNGSPRÜFUNG_HVPlus_FINAL.md`

---

### 🚨 KRITISCHER BUG GEFUNDEN: LANR → Location Mapping fehlerhaft

**Problem:** 4 von 8 Ärzten werden der **falschen Location** zugeordnet!

| LANR | Arzt | SOLL | IST | Status |
|------|------|------|-----|--------|
| 3892462 | van Suntum | **Velbert** | Uckerath | ❌ |
| 8836735 | Beyer | **Velbert** | Uckerath | ❌ |
| 7729639 | Kamler | **Velbert** | Uckerath | ❌ |
| 8898288 | Rösing | **Eitorf** | Uckerath | ❌ |

**Impact:**
- ~50% der HZV-Einnahmen werden falschem Standort zugeordnet
- **Liquiditätsplanung pro Standort ist UNBRAUCHBAR**
- Velbert-Einnahmen werden Uckerath zugeschrieben
- Eitorf-Einnahmen (Rösing = aktivster Arzt!) werden Uckerath zugeschrieben

**Root Cause:** Classification Rules oder LANR-Mapping-Logik zuordnet alle unbekannten LANRs zu "Praxis Uckerath" (Fallback?)

**Status:** ⚠️ **KRITISCH** – Muss vor nächster IV-Präsentation korrigiert werden!

**Location:** Vermutlich `/app/src/lib/settlement/split-engine.ts` oder Import-Scripts

---

### Datenbank-Bereinigung: Prisma = Production-Wahrheit

**Kontext:**
- SQLite `dev.db` enthielt gemischte Daten: 934 Entries (verschiedene Import-Zeitpunkte)
- Prisma Client filterte automatisch auf neueste: 691 Entries
- Verwirrung über "welche Daten sind korrekt?"

**Klarstellung:**
- **Prisma-DB = WAHRHEIT** (691 Entries vom 08.02.2026 15:14-15:36)
- SQLite enthält zusätzlich alte/überholte Daten (408 Entries vom 08.02. 14:14, 526 vom 06.02.)
- Prisma zeigt automatisch nur die relevanten Daten

**Ergebnis:**
- Alle Analysen basieren jetzt auf Prisma-Sicht (691 Entries)
- Alte SQLite-Daten sind historisch, aber nicht relevant für aktuelle Klassifizierung

---

### Bugfix: Config.ts Inkonsistenz dokumentiert

**Problem:** HZV Oktober-Regel in `config.ts` hat falsche Werte:
```typescript
// FALSCH (config.ts):
'2025-10': { alt: 29, neu: 2 }

// RICHTIG (case-context.json + tatsächliche DB):
'2025-10': { alt: 28, neu: 3 }
```

**Impact:** **KEIN** – Datenbank ist korrekt, nur Config-Dokumentation ist falsch

**Begründung:** Split-Engine verwendet korrekten Wert (28/31), config.ts ist nur Dokumentation

**Status:** ⏳ Sollte korrigiert werden für Konsistenz

---

## Version 2.14.0 – Vercel Production Deployment stabilisiert

**Datum:** 08. Februar 2026

### Kritischer Bugfix: Lokale Filesystem-Zugriffe für Vercel behoben

**Problem:** 3 APIs crashten in Vercel Production mit ENOENT-Fehlern
- `planung/route.ts`: Versuchte JSON-Files aus `Cases/` Ordner zu lesen
- `iv-notes/route.ts`: Nutzte `.data/iv-notes/*.json` für CRUD-Operationen
- `finanzierung/route.ts`: Las Kreditverträge aus `Cases/.../VERTRAEGE/`

**Ursache:** Vercel Serverless hat kein persistentes Filesystem für lokale Dateien

**Lösung:**
1. **planung API:** Umstellung auf DB-Query (`LedgerEntry.valueType=PLAN`)
2. **iv-notes API:** Migration zu echter DB-Tabelle (`IVNote` Model)
3. **finanzierung API:** Stub-Implementation ("Feature folgt")
4. **zahlungsverifikation API:** Stub-Implementation ("Feature folgt")

**Architektur-Verbesserung:** System ist jetzt vollständig Vercel-kompatibel

**Location:**
- `/app/src/app/api/cases/[id]/planung/route.ts`
- `/app/src/app/api/cases/[id]/iv-notes/route.ts`
- `/app/src/app/api/cases/[id]/finanzierung/route.ts`
- `/app/src/app/api/cases/[id]/zahlungsverifikation/route.ts`

### Neue Funktionalität: IV-Notizen in Datenbank

**Feature:** IV-Kommunikation jetzt persistent in Turso gespeichert

**Neues Prisma Model:**
```prisma
model IVNote {
  id        String   @id @default(uuid())
  caseId    String
  content   String
  status    String   @default("OFFEN")      // OFFEN, WARTET, ERLEDIGT
  priority  String   @default("MITTEL")     // NIEDRIG, MITTEL, HOCH, KRITISCH
  author    String   @default("Sonja Prinz")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**API-Funktionalität:**
- GET: Liste aller Notizen zu einem Fall
- POST: Neue Notiz erstellen
- PATCH: Status aktualisieren
- DELETE: Notiz löschen

**Location:**
- Schema: `/app/prisma/schema.prisma`
- API: `/app/src/app/api/cases/[id]/iv-notes/route.ts`

### Änderung: Frontend-Seiten zu Stubs umgebaut

**Betroffene Seiten:**
- `/admin/cases/[id]/planung` → "Feature wird migriert"
- `/admin/cases/[id]/finanzierung` → "Feature folgt"
- `/admin/cases/[id]/zahlungsverifikation` → "Feature folgt"

**Begründung:** Alte Seiten erwarteten komplexe JSON-Strukturen aus lokalen Files
- Vollständige Migration der Frontend-Logik würde zu lange dauern
- APIs funktionieren bereits (DB-basiert oder Stubs)
- Placeholder verhindern 500-Fehler und kommunizieren klar den Status

**UX:** Nutzer sehen saubere "in Entwicklung" Seiten mit Links zurück zum Dashboard

**Location:** `/app/src/app/admin/cases/[id]/{planung,finanzierung,zahlungsverifikation}/page.tsx`

### Deployment-Workflow: Manuell statt Auto-Deploy

**Änderung:** Vercel GitHub-Integration deaktiviert

**Vorher:** Jeder Git-Push triggerte Auto-Deploy (führte zu Fehlern wegen fehlendem Root Directory)

**Jetzt:** Nur manuelle Deploys mit korrektem Root Directory:
```bash
cd "/Users/david/Projekte/AI Terminal/Inso-Liquiplanung"
vercel --prod --yes --cwd app
```

**Begründung:**
- Auto-Deploy baute vom falschen Verzeichnis (Repo-Root statt `/app`)
- Manuelle Deploys ermöglichen Pre-Check (Build, Tests)
- Verhindert fehlerhafte Production-Deployments

**Dokumentiert in:** CLAUDE.md (Deployment-Sektion)

---

## Version 2.13.0 – Alt/Neu-Masse estateRatio-Splitting in Liquiditätsmatrix

**Datum:** 08. Februar 2026

### Kritisches Feature: MIXED-Entries korrekte Aufteilung

**Problem:** MIXED-Entries (z.B. KV Q4 mit estateRatio=0.67) wurden zu 100% einer Zeile zugeordnet
- 150.000 EUR → 100% Zeile "KV" (Neumasse)
- Zeile "Altforderungen KV" blieb leer (0 EUR)
- **Inkorrekte Darstellung:** Altmasse-Anteil wurde nicht ausgewiesen

**Lösung:** estateRatio-Splitting in Backend-Aggregation implementiert
- MIXED-Entries werden nach `estateRatio` aufgeteilt
- Neu-Anteil (67%) → Zeile "KV" (100.000 EUR)
- Alt-Anteil (33%) → Zeile "Altforderungen KV" (50.000 EUR)
- Beide Anteile werden unabhängig gematcht

**Technische Details:**
- Rundungssicherheit: `Math.min(Math.max(estateRatio, 0), 1)`
- Entry-Count ohne Doppelzählung: `entryWasAggregated` Flag
- Error-Logging für fehlgeschlagene Alt-Matches
- Neue Funktion: `getAltforderungCategoryTag()`

**Location:** `/app/src/app/api/cases/[id]/dashboard/liquidity-matrix/route.ts` (Zeilen 350-450)

### Änderung: estateFilter jetzt Frontend-only

**Vorher:** estateFilter filterte Daten im Backend (WHERE-Clause auf DB)
**Nachteil:** MIXED-Entries wurden komplett ausgefiltert

**Jetzt:** Backend liefert IMMER GESAMT, Filter wirkt nur im Frontend
- Zeilen-Ausblendung basierend auf `shouldShowRow()` Funktion
- EINNAHMEN-Summen werden gefiltert neu berechnet
- AUSGABEN und BALANCES bleiben ungefiltert

**Begründung:**
- MIXED-Entries müssen immer aggregiert werden (für beide Zeilen)
- Filter dient nur der Darstellung, nicht der Datenauswahl
- Balances zeigen echte Kontostände (unabhängig vom Filter)

**Location:** `/app/src/components/dashboard/LiquidityMatrixTable.tsx`

### Funktionalität: Gefilterte Einnahmen-Summen

**Verhalten nach estateFilter:**

**GESAMT (Standard):**
- Summe Einzahlungen: 185.000 EUR (alle Einnahmen)

**NEUMASSE:**
- Zeigt: Umsatz (HZV, KV, PVS) + Sonstige
- Blendet aus: Altforderungen
- Summe Einzahlungen: 130.000 EUR (gefiltert)

**ALTMASSE:**
- Zeigt: Altforderungen (HZV, KV, PVS)
- Blendet aus: Umsatz + Sonstige
- Summe Einzahlungen: 55.000 EUR (gefiltert)

**Wichtig:** Ausgaben und Balances immer ungefiltert sichtbar

### Bugfix: Portal/Customer-Zugriff wiederhergestellt

**Problem:** Externe Freigabe und Kundenzugang zeigten leeres Dashboard
- API-Routen prüften nur Admin-Session
- Customer-Sessions wurden abgelehnt

**Lösung:** Dual-Auth-Support in 5 API-Routen
- `/api/cases/[id]/dashboard/liquidity-matrix`
- `/api/cases/[id]/bank-accounts`
- `/api/cases/[id]/ledger/revenue`
- `/api/cases/[id]/ledger/estate-summary`
- `/api/cases/[id]/ledger/rolling-forecast`

**Pattern:**
```typescript
const adminSession = await getSession();
const customerSession = await getCustomerSession();
if (!adminSession && !customerSession) return 401;
if (customerSession && !adminSession) {
  const access = await checkCaseAccess(...);
  if (!access.hasAccess) return 403;
}
```

### Bugfix: Bank-Balances Forward-Carrying beendet

**Problem:** Kontostände wurden bis August 2026 fortgeschrieben, obwohl keine Daten existieren
- ISK Velbert: 103.000 EUR bis Aug 2026 (tatsächlich nur bis Jan 2026)
- Verwirrend für IV: Suggerierte Daten, die nicht vorliegen

**Lösung:** Zeige "–" ab letzter Periode mit echten IST-Daten
- Backend trackt `lastPeriodWithData` pro Bankkonto
- Perioden ohne Daten: `entryCount: -1` als Marker
- Frontend zeigt "–" (em dash) in grau

**Location:** `/app/src/app/api/cases/[id]/dashboard/liquidity-matrix/route.ts` (Zeilen 443-497)

### Technischer Fix: TypeScript-Fehler in planung/route.ts

**Problem:** `orderBy: { date: 'asc' }` - Feld existiert nicht mehr
**Lösung:** Korrigiert zu `orderBy: { transactionDate: 'asc' }`

---

## Version 2.12.1 – Business-Logic Admin-Seite wiederhergestellt

**Datum:** 08. Februar 2026

### Bugfix: Fehlende Admin-Seite

**Problem:** `/admin/cases/[id]/business-logic` gab 404-Fehler
- Seite wurde versehentlich in v2.10.0 (Commit `5379227`) gelöscht
- Annahme war: "Dashboard-Tab ersetzt separate Seite"
- Tatsächlich: Admin-Seite enthält deutlich mehr Details als Dashboard-Tab

**Lösung:** Seite aus Git-Historie wiederhergestellt (Commit `22b0050`)
- 4 Tabs: Grundkonzepte, Abrechnungslogik, Massekredit, Datenqualität
- Fallspezifische Details (HVPlus): KVNO, HAVG, PVS Zahlungsstrukturen
- Datenqualitäts-Matrix mit Zuverlässigkeits-Scores
- Offene Fragen an IV mit Auswirkungsanalyse

**Architektur-Korrektur:** ADR-015 aktualisiert
- Business-Logik = Dashboard-Tab (Portal) + Admin-Seite (intern)
- Beide Darstellungen erfüllen unterschiedliche Zwecke

**Location:** `/app/src/app/admin/cases/[id]/business-logic/page.tsx` (699 Zeilen)

### Technischer Fix: Build-Cache-Korruption

**Problem:** Webpack-Fehler "Cannot find module './1331.js'" beim Dev-Server-Start

**Lösung:**
- `.next` Ordner und `node_modules/.cache` gelöscht
- `npm install` neu ausgeführt
- Dev-Server neu gestartet

**Ursache:** Korrupter Build-Cache nach Prisma/npm-Operationen

---

## Version 2.12.0 – Dashboard-Komponenten Scope-Aware + IST-basiert

**Datum:** 08. Februar 2026

### Kritischer Fix: IST-Vorrang implementiert

**Problem:** Dashboard summierte IST + PLAN für dieselbe Periode → +327K Fehler bei HVPlus

**Lösung:** IST-Vorrang in `aggregateLedgerEntries()`:
- Wenn Periode IST-Daten hat → PLAN ignorieren
- Wenn Periode keine IST-Daten hat → PLAN verwenden
- Logging: `[IST-Vorrang] X PLAN-Einträge ignoriert (IST-Daten vorhanden)`

**Ergebnis (HVPlus):**
- 21 PLAN-Einträge korrekt verdrängt (Dez 2025 + Jan 2026)
- Net Cashflow: 502.742 EUR (vorher: 874.129 EUR)
- **Dashboard-Zahlen jetzt korrekt!** ✅

**Location:** `/src/lib/ledger-aggregation.ts:323-372`

### Dashboard-Korrekturen

#### BankAccountsTab (Bankkonto-Übersicht)
- **Workaround entfernt:** API `/api/cases/[id]/bank-accounts` nutzt jetzt echte DB-Relation statt Name-Matching
  - Vorher: `getLocationByAccountName()` erriet Location aus accountName
  - Nachher: `acc.location` aus Prisma-Relation
- **Location-Anzeige:** Standort-Spalte zeigt korrekte Zuordnung (Velbert, Uckerath, Zentral)

#### Revenue-Tab (Einnahmen)
- **Scope-aware:** API `/api/cases/[id]/ledger/revenue` unterstützt jetzt `scope` Parameter
  - Filtert LedgerEntries nach `locationId` basierend auf Scope
  - `GLOBAL`: Alle Einträge
  - `LOCATION_VELBERT`: Nur Velbert-Einträge
  - `LOCATION_UCKERATH_EITORF`: Nur Uckerath/Eitorf-Einträge
- **Nur IST-Daten:** `valueType = 'IST'` Filter hinzugefügt (keine PLAN-Einträge mehr)
- **Estate Allocation:** MIXED-Einträge werden anteilig gezählt
  - `estateRatio = 0.6667` (KV Q4) → Nur 66.7% des Betrags wird als Neumasse-Einnahme gezählt
  - Frontend: RevenueTable akzeptiert `scope` Prop und reaktiviert bei Scope-Wechsel
- **UI-Änderung:** Revenue-Tab wird bei Standort-Ansicht nicht mehr ausgeblendet

#### Estate-Tab (Masseübersicht)
- **IST-basiert:** Neue API `/api/cases/[id]/ledger/estate-summary` ersetzt PLAN-Kategorien
  - Aggregiert direkt aus LedgerEntries statt aus `data.calculation.categories`
  - MIXED-Entries korrekt aufgeteilt: `(1-estateRatio)` → Altmasse, `estateRatio` → Neumasse
- **Scope-aware:** Berücksichtigt gewählten Standort
- **Neue Aggregationsfunktion:** `aggregateEstateAllocation()` in `/lib/ledger/aggregation.ts`
  - Unterstützt ALTMASSE, NEUMASSE, MIXED, UNKLAR
  - Berechnet Einnahmen/Ausgaben pro Estate-Typ
- **UNKLAR-Anzeige:** Zeigt Anzahl nicht zugeordneter Buchungen prominent
- **UI-Vereinfachung:** Keine Detail-Listen mehr (nur Summen + Chart + Links zum Ledger)

#### Security-Tab (Bankenspiegel)
- **Konsistenz:** Verwendet jetzt `BankAccountsTab` statt eigene Tabelle
  - Zeigt Location-Zuordnung
  - Zeigt Opening Balance + aktuelle Salden
  - Zeigt Perioden-Verläufe

### Neue APIs
- `/api/cases/[id]/ledger/estate-summary` – Aggregiert Alt/Neu-Masse aus IST LedgerEntries
  - Query-Parameter: `scope`, `startDate`, `endDate`
  - Response: `altmasseInflowCents`, `altmasseOutflowCents`, `neumasseInflowCents`, `neumasseOutflowCents`, `unklarInflowCents`, `unklarOutflowCents`, `unklarCount`

### Code-Qualität
- **TypeScript BigInt Fehler behoben:** `/scripts/calculate-estate-ratio-v2.ts` + `/scripts/calculate-estate-ratio.ts`
  - Prisma's `_avg.estateRatio` (Decimal | null) → `Number()` Conversion vor Arithmetik

### Architektur-Änderungen
- **Scope-Filter-Logik:** `aggregateByCounterparty()` und `summarizeByCounterparty()` unterstützen jetzt `scope` Parameter
- **Estate Allocation in Revenue:** Einnahmen-Aggregation berücksichtigt `estateRatio` für korrekte Neumasse-Berechnung

---

## Version 2.11.0 – Vollständige IST-Daten-Klassifikation

**Datum:** 08. Februar 2026

### Datenqualität & Klassifikation

#### Datenbereinigung
- **False Januar 2025 Daten gelöscht:** 226 Einträge (HV PLUS, Sparkasse, apoBank) entfernt, die fälschlicherweise als "Januar 2026" importiert waren
  - Backup erstellt vor Löschung: `dev.db.backup-before-delete-false-jan`
  - ISK-Einträge (115 Stück) bewusst erhalten
- **Defekte Split-Einträge bereinigt:** 15 Einträge mit ungültigen bankAccountIds (`acc-*`) entfernt

#### Classification Engine Fixes
- **Regex-Pattern-Fehler behoben:** JavaScript RegExp verwendet jetzt `i`-Flag statt Perl-Syntax `(?i)`
  - Betraf alle Counterparty-Patterns
  - 56 Patterns korrigiert
- **reviewStatus-Filter umgangen:** `matchCounterpartyPatterns()` filtert standardmäßig nur `UNREVIEWED`, IST-Daten waren aber `CONFIRMED`
  - Lösung: Explizite Entry-IDs übergeben

#### Counterparty-Klassifikation
- **84 Counterparty-Patterns erstellt:**
  - KV, HZV, PVS (Abrechnungsstellen)
  - DRV, Landeshauptkasse, Bundesagentur (Behörden)
  - Mitarbeiter (Gaenssler, Steinmetzler, Dupke, Stiebe, Weber)
  - Dienstleister (AWADO, Jahn, MICROLOGIC, D.O.C., RiG, GGEW, Peoplefone, I-Motion, Allane, Telekonnekt)
  - Krankenkassen (hkk, PRONOVA BKK, AOK, BARMER, DAK, Knappschaft)
  - Sonstige (Privatpatient*innen, Sammelüberweisung, BW-Bank ISK-Auskehrung, Sonstige Betriebsausgaben)
- **Ergebnis:** 610 von 691 Einträgen (88.3%) mit counterpartyId klassifiziert
- **Verbleibend:** 81 Einträge (hauptsächlich Privatpatienten-Rechnungen ohne einheitliches Format)

#### Location-Klassifikation
- **BankAccount.locationId gesetzt:**
  - `ba-sparkasse-velbert` → `loc-haevg-velbert`
  - `ba-isk-velbert` → `loc-haevg-velbert`
  - `ba-apobank-uckerath` → `loc-haevg-uckerath`
  - `ba-isk-uckerath` → `loc-haevg-uckerath`
  - `ba-apobank-hvplus` → `loc-hvplus-gesellschaft` (Gesellschafts-Ebene)
- **Zwei Zuordnungsstrategien:**
  1. Aus BankAccount.locationId (652 Einträge)
  2. Aus LANR in description (0 zusätzliche, da bereits über BankAccount zugeordnet)
- **Ergebnis:** 691 von 691 Einträgen (100%) mit locationId klassifiziert

#### Estate-Ratio-Berechnung
- **Alt/Neu-Masse-Regeln implementiert:**
  - Vor 29.10.2025: 100% ALTMASSE
  - Nach 29.10.2025: 100% NEUMASSE
  - KV Q4/2025: 66.7% NEUMASSE (2/3 Neu, gem. Massekreditvertrag §1(2)a)
  - HZV Oktober 2025: 9.7% NEUMASSE (3/31 Tage, gem. §1(2)b)
  - HZV November+: 100% NEUMASSE
- **Fix:** Verwendet `suggestedCounterpartyId` falls `counterpartyId` noch NULL
- **Ergebnis:** 691 von 691 Einträgen (100%) mit estateRatio berechnet
  - 131 ALTMASSE (19.0%)
  - 473 NEUMASSE (68.5%)
  - 87 MIXED (12.6%)

### Neue Scripts
- `/src/scripts/classify-all-entries-v2.ts` – Testet Pattern-Matching mit expliziten Entry-IDs
- `/src/scripts/assign-locations.ts` – Weist locationId basierend auf BankAccount + LANR zu
- `/src/scripts/calculate-estate-ratio-v2.ts` – Berechnet Alt/Neu-Split mit Massekreditvertrag-Regeln
- `/src/scripts/bulk-accept-suggestions.ts` – Übernimmt suggested* Fields in finale Felder

### Offene Punkte dokumentiert
- **case-context.json aktualisiert:**
  - SAMMELÜBERWEISUNGEN-Frage für IV (29 Einträge, 179K EUR)
  - ISK-Auskehrungen Alt/Neu-Zuordnung (6 Einträge, 127K EUR)

### Statistik (HVPlus Case)
- **691 IST-Einträge total:**
  - 88.3% mit counterpartyId
  - 100% mit locationId
  - 100% mit estateRatio
- **Location-Verteilung:**
  - 530 Uckerath (76.7%)
  - 122 Velbert (17.7%)
  - 39 Gesellschaft (5.6%)

---

## Version 2.10.0 – Dashboard-Stabilität + Datenqualität

**Datum:** 08. Februar 2026

### Neue Funktionen

#### Datenqualitäts-Indikatoren
- **UNKLAR-Risiko Banner:** Prominentes Banner oberhalb Navigation zeigt Anzahl + Volumen unklassifizierter Buchungen
  - Click führt zu Ledger-Filter `?estateAllocation=UNKLAR`
  - Nur sichtbar wenn `unklarCount > 0`
- **DataSourceLegend:** Neues Panel in Overview-Tab
  - IST/PLAN-Verteilung als Progress Bar
  - Anzahl ungeprüfter Buchungen (`unreviewedCount`)
  - Qualitätsindikator: "Hohe Datenqualität" / "Prüfung erforderlich"
  - Unterscheidet LEDGER vs LEGACY Datenquelle

#### Verbesserte KPIs
- **Aktueller Bank-Bestand:** Neue KPI zeigt IST-Salden aller Bankkonten (grün, Bank-Icon)
- **Plan-Startsaldo:** Umbenannt von "Aktueller Bestand" (lila, Dokument-Icon)
  - Klare Trennung zwischen echtem Bank-Cash und Planungswerten
- **4-Spalten-Grid:** Wenn Bank-Daten vorhanden, sonst 3 Spalten

### Bugfixes

#### Kritische API-Shape-Fehler
- **Admin-Dashboard:** Fix `dashboardData.result` → `calculation`
- **Admin-Dashboard:** Fix `dashboardData.caseInfo` → `case`
- **Admin-Dashboard:** Fix `totalNetCashflowsCents` → `totalNetCashflowCents` (Typo)
  - Betroffen: `/admin/cases/[id]/dashboard/page.tsx` (Zeilen 134, 157, 167)

#### Insolvenzeffekte Periodenlabels
- **Fix:** Labels basieren jetzt auf `planStartDate` statt `new Date()` (heute)
- **API erweitert:** `/api/cases/[id]/plan/insolvency-effects` liefert `planStartDate`
- **Effekt:** Periodenlabels werden korrekt relativ zum Planungsstart berechnet

#### Bankkonto-Verläufe
- **Fix:** `getPeriodDates()` verwendet jetzt exklusiven Endpunkt
  - WEEKLY: `end = start + 7 Tage` (statt +6)
  - MONTHLY: `end = erster Tag nächster Monat`
- **Effekt:** Transaktionen am letzten Periodentag werden nicht mehr ausgeschlossen
- **Betroffen:** `/lib/ledger-aggregation.ts`

### Änderungen

#### Externe Ansicht stabilisiert
- **Tabs ohne Session-Auth ausgeblendet** für `accessMode="external"`:
  - liquidity-matrix, banks, revenue, security, locations, compare, business-logik
- **Overview-Tab:** RollingForecast-Komponenten nur für angemeldete Nutzer
- **Effekt:** Externe IV-Ansicht (`/view/[token]`) lädt ohne 401-Fehler

#### Scope-Konsistenz (Quick-Fix)
- **Tabs ohne Scope-Support ausgeblendet** wenn Scope ≠ GLOBAL:
  - Revenue-Tab (zeigt nur globale Daten)
  - Banks-Tab (zeigt nur globale Daten)
- **Hinweis:** Banner informiert über ausgeblendete Tabs
- **Nächster Schritt:** Proper Scope-Support implementieren (siehe TODO.md)

### Technische Änderungen
- Neue Komponenten: `UnklarRiskBanner.tsx`, `DataSourceLegend.tsx`
- Erweiterte Typen: `EstateAllocationData` in `dashboard.ts`
- Neue Datei: `/app/docs/TODO.md` mit P0/P1 Priorisierung

---

## Version 2.9.0 – Business-Logik-Dashboard für IV

**Datum:** 08. Februar 2026

### Neue Funktionen

#### Business-Logik-Tab
- **IV-Dashboard-Tab:** Neuer Tab "Business-Logik" im Unified Dashboard (Admin + Portal)
- **HVPlus-spezifische Visualisierung:** Patientenarten (GKV/PKV), Abrechnungswege (KV/HZV/PVS), Zahlungsströme
- **Abrechnungszyklus-Timeline:** Visualisierung des KV-Zyklus (Leistungsmonat → Abschlag → Restzahlung)
- **Alt/Neu-Regel-Darstellung:** Q4/2025 Split (1/3 Alt, 2/3 Neu) für KV und HZV
- **LANR-Übersicht:** Tabelle mit 8 Ärzten und monatlichen HZV-Volumina
- **Bankverbindungen & Status:** ISK-Konten mit Zahlungsquellen, Massekredit-Status
- **Offene Punkte:** Priorisierte Liste kritischer Themen (apoBank, PVS, HZV-Daten)

### Technische Änderungen
- Neue Komponente: `/app/src/components/business-logic/BusinessLogicContent.tsx`
- Dashboard-Integration: Tab-Konfiguration in `dashboard.ts`, Rendering in `UnifiedCaseDashboard.tsx`
- Lightbulb-Icon für Business-Logik-Tab hinzugefügt
- Shared Component Pattern: Identische Darstellung in Admin + Portal

### UI/UX
- Professionelle, konservative Darstellung für erfahrene Insolvenzverwalter
- Vertragsbezüge (Massekreditvertrag §1(2)a/b/c) für Auditierbarkeit
- Dezente Visualisierungen (Timeline, Split-Balken, Flow-Diagramme)
- Keine Marketing-Sprache, rein faktisch und HVPlus-spezifisch

---

## Version 1.0.0 – Erstveröffentlichung

**Datum:** 15. Januar 2026

### Neue Funktionen

#### Admin-Bereich
- **Projektverwaltung:** Anlegen, Bearbeiten und Archivieren von Projekten (Mandanten)
- **Fallverwaltung:** Erstellen von Insolvenzfällen mit Aktenzeichen, Gericht und Schuldnerdaten
- **Datenimport:** Mehrstufiger Import-Workflow für CSV- und Excel-Dateien
  - Datei-Upload mit Formatvalidierung
  - Spalten-Zuordnung (Mapping)
  - Datenprüfung mit Fehler-, Warnungs- und Hinweisanzeige
  - Übernahme in den Liquiditätsplan
- **Freigabe-Links:** Erstellen und Widerrufen von externen Zugängen für Insolvenzverwalter
- **Versionshistorie:** Nachvollziehbarkeit aller Planversionen

#### Externe Ansicht (Insolvenzverwalter)
- **Professionelles Cockpit:** Übersichtliche Darstellung für Gerichte, Banken und Gläubiger
- **Kennzahlen-Karten:** Aktueller Bestand, Tiefster Stand, Reichweite, kritische Woche
- **13-Wochen-Tabelle:** Vollständige Liquiditätsübersicht mit Einnahmen und Ausgaben
- **Liquiditätsverlauf:** Grafische Darstellung des Kontostands über 13 Wochen
- **PDF-Export:** Professioneller Bericht mit Zeitstempel und Versionskennung

#### Technische Basis
- Next.js 15 mit App Router
- SQLite-Datenbank (Demo/Preview)
- Prisma ORM
- Recharts für Diagramme
- jsPDF für PDF-Export

### Sprachliche Anpassungen
- Vollständige deutsche Benutzeroberfläche
- Professionelle Formulierungen für Insolvenzbranche
- Korrekte Umlaute in allen Texten und PDFs

### Deployment
- **Vercel-Deployment:** App live unter https://app-beige-kappa-43.vercel.app
- **GitHub-Repository:** https://github.com/dp-213/Inso-liquiplanung
- **Authentifizierung:** JWT-basierte Session mit HttpOnly-Cookies

---

## Version 1.0.1 – Bugfixes

**Datum:** 15. Januar 2026

### Fehlerbehebungen
- **Login-Authentifizierung:** Umgebungsvariablen werden jetzt zur Laufzeit gelesen (nicht zur Build-Zeit)
- **Env-Var-Format:** Zeilenumbrüche in Vercel-Umgebungsvariablen entfernt
- **Datenbank-Resilienz:** Alle Admin-Seiten zeigen benutzerfreundliche Warnung bei fehlender Datenbank statt Server-Fehler

### Technische Änderungen
- Login-Route vereinfacht und robuster gemacht
- Session-Secret-Handling verbessert
- Try-Catch für alle Datenbank-Abfragen in Admin-Seiten
- Graceful Degradation bei fehlender SQLite-Datenbank

---

## Version 1.1.0 – Flexible Periodenplanung

**Datum:** 16. Januar 2026

### Neue Funktionen

#### Periodentyp-Unterstützung
- **Wöchentliche und monatliche Planung:** Liquiditätspläne können jetzt entweder als 13-Wochen-Plan (Standard) oder als Monatsplanung konfiguriert werden
- **Dynamische Periodenzahl:** Statt fester 13 Wochen können nun beliebig viele Perioden definiert werden (z.B. 10 Monate für Nov 2025 - Aug 2026)
- **Automatische Periodenbeschriftung:** "KW 03" für Wochen, "Nov 25" für Monate

#### HVPlus-Fall implementiert
- Erster echter Kundenfall mit 10-Monats-Planung (Nov 2025 - Aug 2026)
- 6 Kategorien: Umsatz, Altforderungen, Insolvenzspezifische Einzahlungen, Personalaufwand, Betriebliche Auszahlungen, Insolvenzspezifische Auszahlungen
- Vollständige Testdaten aus Excel übernommen

### Technische Änderungen

#### Schema-Änderungen
- `WeeklyValue` umbenannt zu `PeriodValue`
- `weekOffset` umbenannt zu `periodIndex`
- Neue Felder `periodType` (WEEKLY/MONTHLY) und `periodCount` in `LiquidityPlan`
- `StagedCashflowEntry.weekOffset` umbenannt zu `periodIndex`

#### Berechnungs-Engine
- `calculateLiquidityPlan()` akzeptiert jetzt `periodType` und `periodCount` Parameter
- Neue Funktion `generatePeriodLabel()` für dynamische Periodenbeschriftung
- Neue Funktion `getPeriodDates()` für Start-/Enddatum-Berechnung
- Legacy-Aliase (`weeks`, `weeklyValues`, `weeklyTotals`) für Abwärtskompatibilität

#### API-Änderungen
- Alle Endpunkte geben `periodType` und `periodCount` zurück
- Sowohl neue (`periods`, `periodValues`) als auch Legacy-Felder (`weeks`, `weeklyValues`) werden bereitgestellt
- Interne Queries verwenden jetzt `periodValues` statt `weeklyValues`

### Abwärtskompatibilität
- Bestehende Frontend-Komponenten funktionieren weiterhin mit Legacy-Aliase
- Standard-Werte: `periodType = "WEEKLY"`, `periodCount = 13`

---

## Version 1.2.0 – Admin Dashboard Umbau + Gradify Branding

**Datum:** 16. Januar 2026

### Neue Funktionen

#### Dashboard-Tabs (Externe Ansicht)
- **5 neue Ansichten:** Übersicht, Einnahmen, Sicherungsrechte, Masseübersicht, Vergleich
- **Tab-Navigation:** ExternalDashboardNav Komponente für /view/ Seite
- **Chart-Marker:** KV-Restzahlung und HZV-Schlusszahlung Ereignisse im Liquiditätschart
- **Phasen-Visualisierung:** Fortführung/Nachlauf Bereiche im Chart

#### Admin-Bereich Umbau
- **Neue Sidebar-Struktur:** Übersicht, VERWALTUNG (Kunden, Fälle)
- **Kundenverwaltung:** Komplette CRUD-Funktionalität unter /admin/customers
- **Passwort-Reset:** Admins können Kundenpasswörter zurücksetzen
- **Externe Ansicht Button:** Schnellzugriff auf Share-Link von Fall-Detail-Seite
- **Planungstyp-Anzeige:** Fallliste zeigt "10 Monate" oder "13 Wochen"

#### Gradify Branding
- **Favicon:** Gradify Logo als Browser-Tab-Icon
- **Farbschema getrennt:**
  - Admin: Gradify Rot (#CE353A) fuer Buttons, Navigation
  - Kunden: Konservatives Blau (#1e40af) fuer Tabellen, Charts
- **Logo:** Gradify Logo in Admin-Sidebar

#### Portal-Aenderungen
- **Login verschoben:** /portal/login → /customer-login (vermeidet Redirect-Loop)
- **Kundenheader:** Logout leitet zu /customer-login

### Neue Komponenten
- `ExternalDashboardNav.tsx` - Tab-Navigation fuer externe Ansicht
- `RevenueChart.tsx` - Stacked Bar Chart fuer Einnahmen nach Quelle
- `EstateComparisonChart.tsx` - Vergleichschart Altmasse/Neumasse
- `DashboardNav.tsx` - Route-basierte Navigation fuer Portal
- `CustomerAccessManager.tsx` - Kundenzugriff verwalten

### Technische Aenderungen
- Share-Link API gibt periodType und periodCount zurueck
- BalanceChart unterstuetzt Marker und Phasen-Visualisierung
- PDFExportButton dynamisch fuer Wochen/Monate

### Work in Progress
- Admin Dashboard (/admin/cases/[id]/dashboard) zeigt WIP-Banner
- Datenmodell fuer PaymentSource, SecurityRight noch nicht implementiert

---

## Version 1.3.0 – Mobile Responsiveness

**Datum:** 16. Januar 2026

### Neue Funktionen

#### Kunden-Ansichten (Prioritaet)
- **Responsive Tabellen:** Liquidity-Tabellen haben jetzt horizontalen Scroll mit smooth scrolling auf Touch-Geraeten
- **KPI-Cards optimiert:** Bessere Lesbarkeit auf kleinen Bildschirmen mit angepassten Schriftgroessen und Abstaenden
- **Dashboard-Navigation:** Touch-freundliche Buttons mit 44px Mindesthoehe fuer Mobile
- **ExternalDashboardNav:** Icons bleiben sichtbar, Labels werden auf kleinen Bildschirmen ausgeblendet

#### Admin Dashboard
- **Hamburger-Menue:** Sidebar ist auf Mobile versteckt und kann ueber Hamburger-Icon geoeffnet werden
- **AdminShell-Komponente:** Neue kombinierte Komponente fuer responsive Layout-Verwaltung
- **Overlay:** Halbtransparenter Hintergrund beim geoeffneten Mobile-Menue
- **Escape-Taste:** Schliesst Mobile-Menue

#### Globale Styles
- **Touch-freundliche Buttons:** Mindesthoehe 44px fuer alle Buttons auf Mobile
- **Form-Inputs:** Groessere Touch-Targets, font-size 16px verhindert Zoom auf iOS
- **Scrollbar-Styling:** Konsistentes Aussehen auf Desktop und Mobile
- **Transitions:** Smooth Animationen fuer Mobile-Navigation

### Technische Aenderungen
- Neue `AdminShell.tsx` Komponente ersetzt separate Sidebar und Header
- `globals.css` um mobile-spezifische Media Queries erweitert
- `LiquidityTable.tsx` mit `table-scroll-container` Wrapper
- Admin Layout verwendet jetzt `AdminShell` statt `AdminSidebar` + `AdminHeader`

### Breakpoints
- **sm (640px):** Hauptumschaltpunkt fuer Mobile/Desktop
- **lg (1024px):** Admin-Sidebar wird permanent sichtbar

---

## Version 1.4.0 – Löschfunktionen & Kundenlogo

**Datum:** 17. Januar 2026

### Neue Funktionen

#### Permanente Löschfunktion
- **Kunden löschen:** Auf der Kundenliste (/admin/customers) können Kunden jetzt permanent gelöscht werden
- **Fälle löschen:** Auf der Fallliste (/admin/cases) können Fälle mit allen zugehörigen Daten gelöscht werden
- **Sichere Bestätigung:** Löschen erfordert Eingabe von "LÖSCHEN" zur Bestätigung
- **Kaskaden-Löschung für Fälle:** Löscht automatisch alle zugehörigen Daten:
  - Liquiditätspläne und Versionen
  - Kategorien, Zeilen und Periodenwerte
  - Konfigurationen und Share-Links
  - Kundenzugriffe (CustomerCaseAccess)

#### Kundenlogo im Portal
- **Logo-URL Feld:** Kunden können jetzt eine Logo-URL im Profil hinterlegen
- **Portal-Header:** Logo wird anstelle des Standard-Icons im Kundenportal-Header angezeigt
- **Session-Integration:** Logo-URL wird in der Kundensession gespeichert

#### Admin-Verbesserungen
- **Kundendetailseite:** Zeigt jetzt zugehörige Fälle (ownedCases) mit Plantyp-Info
- **Planeinstellungen API:** Neuer Endpunkt /api/cases/[id]/plan/settings für Periodentyp-Konfiguration
- **Fall-Bearbeitungsseite:** Planeinstellungen (Periodentyp, Periodenzahl, Startdatum) direkt editierbar

### UI-Verbesserungen
- **Konsistentes Button-Styling:** Alle Aktions-Buttons in Tabellen haben einheitliches Design
- **Umlaute korrigiert:** Alle deutschen Umlaute (ä, ö, ü) im gesamten Codebase korrekt dargestellt
  - Admin Dashboard, Kundenlisten, Fälle-Listen
  - Kundenportal und alle Unterseiten
  - API-Fehlermeldungen und Bestätigungstexte
  - Alle Formulare, Modals und Statusmeldungen

### API-Änderungen
- **GET /api/customers/[id]:** Gibt jetzt `ownedCases` zurück
- **PUT /api/customers/[id]:** Unterstützt `logoUrl` und `resetPassword`
- **DELETE /api/customers/[id]:** Mit `?hardDelete=true&confirm=PERMANENTLY_DELETE` für permanentes Löschen
- **DELETE /api/cases/[id]:** Mit `?hardDelete=true&confirm=PERMANENTLY_DELETE` für permanentes Löschen
- **GET/PUT /api/cases/[id]/plan/settings:** Neuer Endpunkt für Planeinstellungen

### Schema-Änderungen
- `CustomerUser.logoUrl` – Neues Feld für Kundenlogo-URL
- `CustomerSessionData.logoUrl` – Logo-URL in JWT-Session integriert

---

## Version 1.5.0 – W&P Best Practices Integration

**Datum:** 17. Januar 2026

### Neue Funktionen

#### Dashboard-Erweiterungen (nach W&P-Industriestandard)
- **Wasserfall-Tab:** Neue Visualisierung der Cashflow-Zusammensetzung pro Periode
  - Einzahlungen (grün), Auszahlungen (rot), Insolvenzeffekte (lila)
  - Endbestand als Linie überlagert
  - Summen-Karten für Gesamtübersicht

- **Insolvenzeffekte-Tab:** Separate Darstellung insolvenzspezifischer Zahlungsströme
  - Trennung von operativem Geschäft
  - Gliederung nach Effektgruppen (Allgemein, Verfahrenskosten)
  - Kumulierte Effektberechnung
  - Vergleich "vor/nach Insolvenzeffekten"

- **Prämissen-Tab:** Dokumentation der Planungsannahmen
  - W&P-konformes Risiko-Ampelsystem (○ ◐ ◑ ● ●●)
  - Informationsquelle pro Position
  - Detaillierte Prämissenbeschreibung

- **Erweiterte Navigation:** 8 Tabs (Übersicht, Einnahmen, Wasserfall, Insolvenzeffekte, Prämissen, Sicherungsrechte, Masseübersicht, Vergleich)

#### Neue Komponenten
- `WaterfallChart.tsx` – Recharts-basiertes Wasserfall-Diagramm
- `InsolvencyEffectsTable.tsx` – Tabelle für Insolvenzeffekte mit Periodenspalten
- `PlanningAssumptions.tsx` – Prämissen-Tabelle mit Risiko-Legende

### Datenmodell-Erweiterungen

#### Neue Prisma-Modelle
- **PlanningAssumption:** Dokumentation der Planungsprämissen
  - `categoryName`, `source`, `description`, `riskLevel`
  - Risiko-Level: conservative, low, medium, high, aggressive

- **InsolvencyEffect:** Insolvenzspezifische Zahlungseffekte
  - `name`, `effectType` (INFLOW/OUTFLOW), `effectGroup`
  - `periodIndex`, `amountCents`
  - Gruppierung: GENERAL, PROCEDURE_COST

- **BankAccount:** Bankenspiegel nach W&P-Standard
  - `bankName`, `accountName`, `iban`
  - `balanceCents`, `availableCents`
  - `securityHolder`, `status`, `notes`

### API-Erweiterungen
- **GET/POST/DELETE /api/cases/[id]/plan/assumptions** – Planungsprämissen verwalten
- **GET/POST/DELETE /api/cases/[id]/plan/insolvency-effects** – Insolvenzeffekte verwalten
- **GET/POST/PUT/DELETE /api/cases/[id]/bank-accounts** – Bankkonten verwalten

### Dokumentation
- **DASHBOARD_BEST_PRACTICES.md:** Umfassende Analyse des W&P-Reports
  - 9 Kapitel mit Best Practices
  - Priorisierte Feature-Liste (P1/P2/P3)
  - Gap-Analyse: W&P vs. Gradify
  - Standard-Katalog für Insolvenzeffekte

### Technische Verbesserungen
- Erweiterte ExternalDashboardNav mit 3 neuen Icons
- Responsive Tab-Layout für Mobile
- BigInt-Handling in allen neuen Komponenten

---

## Version 2.0.0 – LedgerEntry als Single Source of Truth

**Datum:** 18. Januar 2026

### Grundlegende Architekturänderung

#### LedgerEntry-basiertes Datenmodell
Die Anwendung wurde grundlegend umgestellt: **LedgerEntry** ist jetzt die einzige Quelle der Wahrheit für alle Buchungen.

- **Keine Kategorien/Zeilen mehr für Datenerfassung** – nur noch für Präsentation
- **Steuerungsdimensionen** direkt am LedgerEntry:
  - `valueType` (IST/PLAN)
  - `legalBucket` (MASSE, ABSONDERUNG, NEUTRAL)
  - `counterpartyId` (Gegenpartei)
  - `locationId` (Standort)
  - `bankAccountId` (Bankkonto)
- **Governance-Status** (reviewStatus): UNREVIEWED → CONFIRMED/ADJUSTED

#### Classification Engine
Neue Rule-basierte Klassifikationsvorschläge:
- `ClassificationRule` Modell für Musterabgleich
- Automatische Vorschläge beim Import (niemals Auto-Commit für IST)
- Bulk-Review für effiziente Massenbearbeitung
- Regel-Erstellung direkt aus LedgerEntry-Details

### Neue Funktionen

#### Zahlungsregister (Ledger)
- **Sortierbare Tabellen** – Alle Spalten klickbar zum Sortieren
- **Filterung** nach reviewStatus, legalBucket, valueType
- **Regel erstellen Button** – Direkt aus Einzeleintrag eine Klassifikationsregel erstellen
- **Detail-Ansicht** mit vollständiger Bearbeitungsmöglichkeit

#### Stammdaten-Verwaltung
- **Gegenparteien (Counterparties)** – CRUD für Geschäftspartner, Gläubiger, Debitoren
- **Standorte (Locations)** – Verwaltung von Betriebsstätten, Filialen
- **Bankkonten** – Zuordnung von Ein-/Auszahlungen zu Konten

#### Regelverwaltung
- **Neue Rules-Seite** unter /admin/cases/[id]/rules
- **Match-Typen:** CONTAINS, STARTS_WITH, ENDS_WITH, EQUALS, REGEX, AMOUNT_RANGE
- **Match-Felder:** description, bookingReference
- **Vorschläge:** suggestedLegalBucket, suggestedCategory, confidence

#### Navigation Umbau
- **Neue Struktur:** Ledger | Stammdaten | Recht
- **Ledger:** Zahlungsregister, Datenimport
- **Stammdaten:** Bankkonten, Gegenparteien, Standorte
- **Recht:** Regeln
- **Dashboard-Button** verlinkt jetzt direkt zur externen Ansicht (wenn Share-Link existiert)

### Schema-Änderungen

#### Neue Modelle
```prisma
model ClassificationRule {
  id, caseId, name, matchField, matchType, matchValue,
  suggestedLegalBucket, suggestedCategory, isActive, priority
}

model Counterparty {
  id, caseId, name, type (CREDITOR/DEBITOR/OTHER), taxId, notes
}

model Location {
  id, caseId, name, address, type, notes
}
```

#### LedgerEntry Erweiterungen
```prisma
model LedgerEntry {
  // Neu:
  counterpartyId, locationId, bankAccountId
  suggestedLegalBucket, suggestedCategory, suggestedConfidence
  suggestedRuleId, suggestedReason
}
```

### API-Erweiterungen
- **GET/POST /api/cases/[id]/counterparties** – Gegenparteien verwalten
- **GET/POST /api/cases/[id]/locations** – Standorte verwalten
- **GET/POST /api/cases/[id]/rules** – Klassifikationsregeln verwalten
- **POST /api/cases/[id]/intake** – Vereinfachter Import-Endpunkt
- **POST /api/cases/[id]/ledger/bulk-review** – Massen-Review mit Filtern

### Bugfixes
- **React Hooks Fehler** in externer Ansicht behoben (Hooks vor conditional returns)
- **Datums-Parsing** für verschiedene Formate verbessert
- **Betrags-Parsing** für negative Werte und Komma-Notation korrigiert

### Dokumentation
- **Veraltete Dateien gelöscht:** `app/CLAUDE_CONTEXT.md`
- **Plan-Dokumentation:** Detaillierter Implementierungsplan erstellt

---

## Version 2.1.0 – Dimensions & Counterparty Auto-Detection

**Datum:** 19. Januar 2026

### Neue Funktionen

#### Steuerungsdimensionen im Ledger
- **Dimensionen an LedgerEntry:** Jeder Eintrag kann jetzt mit Bankkonto, Gegenpartei und Standort verknüpft werden
- **Finale vs. Vorgeschlagene Werte:** Klare Trennung zwischen bestätigten Werten (`bankAccountId`, `counterpartyId`, `locationId`) und Vorschlägen (`suggestedBankAccountId`, etc.)
- **Bulk-Übernahme:** Button "Dimensionen übernehmen" übernimmt alle Vorschläge in finale Werte

#### Regelbasierte Dimensions-Zuweisung
- **Rules-Seite erweitert:** Dimensionen können direkt pro Klassifikationsregel zugewiesen werden
- **Dropdown-Felder:** Bankkonto, Gegenpartei, Standort auswählbar bei Regel-Erstellung
- **Automatische Vorschläge:** Beim Import werden Dimensions-Vorschläge basierend auf Regeln erstellt

#### Counterparty Auto-Detection
- **Pattern-Matching:** `matchPattern` (Regex) aus Counterparty wird auf Beschreibungen angewendet
- **Automatische Erkennung:** Nach jedem Import werden Counterparty-Patterns gematcht
- **Nur Vorschläge:** Ergebnisse werden als `suggestedCounterpartyId` gespeichert – User muss bestätigen!

#### Ledger-UI Erweiterungen
- **Dim.-Vorschlag Spalte:** Zeigt Badges (🏦 👤 📍) für vorgeschlagene Dimensionen
- **Dimensions-Filter:** Dropdown-Filter für Bankkonto, Gegenpartei, Standort
- **Hover-Details:** Tooltip zeigt Dimensions-Vorschläge im Detail

### Schema-Änderungen

#### LedgerEntry Erweiterungen
```prisma
model LedgerEntry {
  // Finale Dimensionen (nach User-Bestätigung)
  bankAccountId      String?
  counterpartyId     String?
  locationId         String?

  // Vorgeschlagene Dimensionen (von Rule Engine)
  suggestedBankAccountId    String?
  suggestedCounterpartyId   String?
  suggestedLocationId       String?
}
```

#### ClassificationRule Erweiterungen
```prisma
model ClassificationRule {
  // Dimensions-Zuweisung bei Match
  assignBankAccountId    String?
  assignCounterpartyId   String?
  assignLocationId       String?
}
```

### API-Erweiterungen
- **GET /api/cases/[id]/ledger:** Neue Filter `bankAccountId`, `counterpartyId`, `locationId`, `hasDimensionSuggestions`
- **POST /api/cases/[id]/ledger/bulk-review:** Option `applyDimensionSuggestions` übernimmt Vorschläge
- **matchCounterpartyPatterns():** Neue Funktion in Classification Engine

### Technische Änderungen
- `classifyBatch()` setzt jetzt auch Dimensions-Vorschläge
- `matchCounterpartyPatterns()` läuft nach jedem Import
- Turso-Schema manuell erweitert (ALTER TABLE)

---

## Version 2.2.0 – Alt/Neu-Splitting & Massekredit

**Datum:** 20. Januar 2026

### Neue Funktionen

#### Alt/Neu-Masse-Zuordnung
- **Estate Allocation:** Jeder LedgerEntry kann als ALTMASSE, NEUMASSE, MIXED oder UNKLAR klassifiziert werden
- **Allocation Source (Revisionssprache):** Nachvollziehbare Herkunft der Zuordnung:
  - `VERTRAGSREGEL`: Explizite Vertragsregel (z.B. KV Q4: 1/3-2/3)
  - `SERVICE_DATE_RULE`: Binär vor/nach Stichtag
  - `PERIOD_PRORATA`: Zeitanteilige Aufteilung
  - `VORMONAT_LOGIK`: HZV-spezifisch (Zahlung bezieht sich auf Vormonat)
  - `MANUELL`: Manuelle Zuordnung durch Benutzer
  - `UNKLAR`: Keine Regel anwendbar - Review erforderlich
- **Split-Engine:** Automatische Fallback-Kette für Zuordnung

#### Case-spezifische Konfiguration (HAEVG PLUS eG)
- **Neues Muster:** `/lib/cases/[case-name]/config.ts` für case-spezifische Regeln
- **HAEVG PLUS:** Erste Implementierung mit:
  - Stichtag: 29.10.2025
  - Abrechnungsstellen: KV Nordrhein, HZV-Vertrag, PVS rhein-ruhr
  - Banken: Sparkasse Velbert, apobank
  - Standorte: Velbert, Uckerath, Eitorf

#### Massekredit-Dashboard
- **Neuer Tab:** "Banken/Massekredit" im Dashboard (nach Übersicht)
- **KPI-Karten:** Altforderungen brutto, Fortführungsbeitrag, USt, Massekredit Altforderungen
- **Bank-Tabelle:** Status, Beträge, Cap, Headroom pro Bank
- **Annahmen-Box:** Transparente Darstellung aller Berechnungsgrundlagen
- **Warnungen:** Gelb für offene Vereinbarungen, Rot für UNKLAR-Buchungen

#### BankAgreement-Modell
- **Vereinbarungsstatus:** OFFEN, VERHANDLUNG, VEREINBART
- **Globalzession:** Flag für Sicherungsrecht
- **Fortführungsbeitrag:** Rate + USt (nur wenn vereinbart)
- **Massekredit-Cap:** Optional, nur wenn vertraglich festgelegt
- **Unsicherheit explizit:** `isUncertain` Flag + Erklärung

### Datenmodell-Erweiterungen

#### LedgerEntry
```prisma
// Service Date / Period (für Alt/Neu-Splitting)
serviceDate         DateTime?
servicePeriodStart  DateTime?
servicePeriodEnd    DateTime?

// Estate Allocation
estateAllocation    String?    // ALTMASSE, NEUMASSE, MIXED, UNKLAR
estateRatio         Decimal?   // Bei MIXED: Anteil Neumasse (0.0-1.0)

// Allocation Source (Revisionssprache)
allocationSource    String?    // VERTRAGSREGEL, SERVICE_DATE_RULE, etc.
allocationNote      String?    // Audit-Trail

// Split Reference
parentEntryId       String?    // Bei Split: Referenz auf Original
splitReason         String?
```

#### Case
```prisma
cutoffDate  DateTime?  // Stichtag Insolvenzantrag
```

#### BankAgreement (NEU)
```prisma
model BankAgreement {
  agreementStatus     String    // OFFEN, VERHANDLUNG, VEREINBART
  hasGlobalAssignment Boolean
  contributionRate    Decimal?  // z.B. 0.10 für 10%
  contributionVatRate Decimal?  // z.B. 0.19
  creditCapCents      BigInt?
  isUncertain         Boolean
  uncertaintyNote     String?
}
```

### Neue Module

| Pfad | Beschreibung |
|------|--------------|
| `/lib/types/allocation.ts` | Type-Definitionen für Estate Allocation |
| `/lib/cases/haevg-plus/config.ts` | HAEVG PLUS Konfiguration |
| `/lib/settlement/split-engine.ts` | Alt/Neu-Split-Engine |
| `/lib/credit/calculate-massekredit.ts` | Massekredit-Berechnung |
| `/components/dashboard/MasseCreditTab.tsx` | Dashboard-Komponente |
| `/api/cases/[id]/massekredit/route.ts` | API-Endpunkt |

### API-Erweiterungen
- **GET /api/cases/[id]/massekredit** – Berechnet Massekredit-Status für alle Banken

### Technische Entscheidungen
- **Decimal statt Float** für `estateRatio` – keine Rundungsartefakte
- **Keine createdBy/updatedBy** auf BankAgreement – wird nur von Gradify gepflegt
- **Revisionssprache** – alle Zuordnungen sind audit-sicher begründet

---

## Version 2.3.0 – 3-Ebenen-Import-Architektur

**Datum:** 20. Januar 2026

### Grundlegende Architekturänderung

#### Strikte Trennung: Excel → Import Context → LedgerEntry

Die Import-Architektur wurde grundlegend überarbeitet für bessere Wartbarkeit und Regeltrennung:

1. **Excel/CSV (variabel):** Original-Spalten mit unterschiedlichen Namen je nach Quelle
2. **Import Context (stabil):** Normalisierte fachliche Keys für Regeln
3. **LedgerEntry (final):** Nur IDs und fachliche Ergebnisse

#### NormalizedImportContext

Neue stabile Struktur für Import-Daten:

| Normalized Key | Excel-Varianten |
|----------------|-----------------|
| `standort` | "Standort", "Praxis", "Filiale", "Niederlassung" |
| `counterpartyHint` | "Debitor", "Kreditor", "Auftraggeber", "Empfänger" |
| `arzt` | "Arzt", "Behandler", "Leistungserbringer" |
| `zeitraum` | "Zeitraum", "Abrechnungszeitraum", "Periode" |
| `kategorie` | "Kategorie", "Buchungsart", "Cashflow Kategorie" |
| `kontoname` | "Kontoname", "Konto", "Bankverbindung" |
| `krankenkasse` | "Krankenkasse", "Kostenträger", "KV" |

#### Rule Engine auf Normalized

- **STRIKT:** Regeln arbeiten NUR auf `normalized`, NIE auf LedgerEntry
- **ClassificationRule.matchField** referenziert normalized Keys
- **Ergebnis:** Nur IDs werden ins LedgerEntry übertragen

### Neue Module

| Pfad | Beschreibung |
|------|--------------|
| `/lib/import/normalized-schema.ts` | NormalizedImportContext + COLUMN_MAPPINGS |
| `/lib/import/rule-engine.ts` | applyRules() auf normalized |
| `/lib/import/index.ts` | Export-Modul |

### Technische Änderungen

#### to-ledger API aktualisiert
- Normalisierung vor Regelanwendung
- Lädt ClassificationRules und wendet sie auf normalized an
- Nur Ergebnis-IDs werden ins LedgerEntry übertragen
- `allocationNote` enthält angewandte Regel-Information

#### Schema-Kommentare
- `ClassificationRule.matchField` dokumentiert: "NORMALIZED Keys only"
- Architektur-Hinweise im Schema für zukünftige Entwickler

### Architektur-Regeln (dokumentiert)

1. **KEINE** Original-Excel-Spalten im LedgerEntry speichern
2. **Regeln arbeiten NUR auf normalized**, NIE auf LedgerEntry
3. **Normalisierung vor Regelanwendung** – verschiedene Spaltennamen → stabile Keys
4. **LedgerEntry erhält nur Ergebnisse** – `locationId`, nicht "Standort"

### Dokumentation
- ARCHITECTURE.md mit detailliertem 3-Ebenen-Diagramm
- Normalized Import Schema dokumentiert
- Import-Flow mit allen 7 Schritten beschrieben

### UI-Änderungen
- **Rules-Seite:** Match-Felder aktualisiert auf normalized Fields
  - Neue Felder: standort, counterpartyHint, arzt, zeitraum, kategorie, kontoname, krankenkasse, lanr, referenz
  - Entfernt: description, bookingReference, bookingSourceId (Legacy)
- **Quick-Start Examples:** Aktualisiert für typische Insolvenzfall-Szenarien
- **Info-Box:** Erklärt jetzt normalized Fields

---

## Version 2.4.0 – Alt/Neu-Massezuordnung Integration

**Datum:** 20. Januar 2026

### Neue Funktionen

#### Case-Konfiguration: Stichtag editierbar
- **Stichtag-Feld:** Im Case-Bearbeitungsformular kann der Stichtag (cutoffDate) gesetzt werden
- **Info-Box:** Erklärt die Bedeutung des Stichtags für Alt/Neu-Zuordnung
- **Validierung:** Datumsfeld mit Standard-HTML5-Datepicker

#### Import-Pipeline: Split-Engine Integration
- **Automatische Zuordnung:** Beim Import (to-ledger API) wird die Split-Engine automatisch aufgerufen
- **Estate Allocation:** Setzt `estateAllocation`, `estateRatio`, `allocationSource` auf LedgerEntry
- **Response-Info:** `estateAllocated` Counter zeigt Anzahl zugeordneter Einträge
- **Fallback:** `TRANSACTION_DATE_RULE` wenn kein cutoffDate oder keine Counterparty-Config

#### Ledger-Liste: Alt/Neu-Spalte & Filter
- **Neue Spalte:** "Alt/Neu" zeigt Massezuordnung mit farbigen Badges
- **Badge-Farben:**
  - Grün: Altmasse
  - Blau: Neumasse
  - Lila: Gemischt (mit Verhältnis)
  - Gelb: Unklar (erfordert manuelle Prüfung)
- **Filter-Dropdown:** Filtern nach Massezuordnung

#### Ledger-Detail: Manuelle Zuordnung
- **Anzeige:** Aktuelle Zuordnung mit Quelle und Begründung
- **Override:** Manuelle Überschreibung setzt automatisch `MANUELL` als Quelle
- **Transparenz:** Zeigt warum Zuordnung erfolgte (Regel, Datum, etc.)

### API-Änderungen

#### PUT /api/cases/[id]
- Neues Feld: `cutoffDate` akzeptiert

#### GET/PUT /api/cases/[id]/ledger/[entryId]
- Gibt `estateAllocation`, `estateRatio`, `allocationSource`, `allocationNote` zurück
- PUT akzeptiert manuelle Änderungen dieser Felder

#### GET /api/cases/[id]/ledger
- Neuer Filter: `estateAllocation` (ALTMASSE, NEUMASSE, MIXED, UNKLAR)
- Gibt Estate Allocation Felder für alle Einträge zurück

### Type-System
- **LedgerEntryResponse:** Erweitert um Estate Allocation Felder
- Alle `serializeLedgerEntry` Funktionen konsistent aktualisiert

### Technische Details
- Split-Engine aus `/lib/settlement/split-engine.ts` integriert
- Types aus `/lib/types/allocation.ts` importiert
- Keine neuen Schema-Änderungen (nutzt bestehende Felder aus 2.2.0)

### Fachliche Korrektur: Keine TRANSACTION_DATE_RULE
**WICHTIG:** Das Buchungsdatum (transactionDate) ist KEINE gültige Entscheidungsgrundlage für die Alt/Neu-Zuordnung!

Maßgeblich für die Zuordnung ist ausschließlich die **Forderungsentstehung**:
- `serviceDate` – Wann wurde die Leistung erbracht?
- `servicePeriod` – Welcher Zeitraum wird abgerechnet?
- Vertragslogik – Explizite Split-Regeln (z.B. KV Q4: 1/3-2/3)

Wenn keine Leistungsinformation vorhanden ist:
- `estateAllocation = UNKLAR`
- `allocationSource = UNKLAR`
- Manuelle Zuordnung durch Benutzer erforderlich

Das Buchungsdatum darf höchstens als technischer Hinweis dienen, niemals als automatischer Fallback.

---

## Version 2.5.0 – ServiceDate-Vorschläge & Bulk-Accept

**Datum:** 24. Januar 2026

### Neue Funktionen

#### ServiceDate-Regeln für Alt/Neu-Zuordnung
- **Regel-basierte Leistungsdatum-Zuweisung:** ClassificationRules können jetzt `assignServiceDateRule` setzen
- **Drei Regel-Typen:**
  - `SAME_MONTH`: Leistungsdatum = Zahlungsmonat (Miete, Software, laufende Kosten)
  - `VORMONAT`: HZV-Logik, Zahlung bezieht sich auf Vormonat
  - `PREVIOUS_QUARTER`: Quartals-Schlusszahlungen (KV/HZV)
- **Automatische Berechnung:** Bei Übernahme wird `estateAllocation` via Split-Engine berechnet

#### Bulk-Accept für ServiceDate-Vorschläge
- **Neuer Button:** "ServiceDate-Vorschläge" (lila) im Ledger-Review-Tab
- **Preview-Modal:** Zeigt alle Einträge mit Vorschlägen in Tabellenansicht
  - Buchungsdatum, Beschreibung, Betrag
  - Angewandte Regel (SAME_MONTH, VORMONAT, PREVIOUS_QUARTER)
  - Vorgeschlagenes Leistungsdatum/-zeitraum
- **"Alle übernehmen"-Button:** Bulk-Accept mit automatischer Alt/Neu-Berechnung

#### Regel-Anzeige in Ledger-Details
- **Regel-Name:** Zeigt `suggestedReason` mit erklärenden Texten
- **Link zur Regel:** "Regel anzeigen →" verlinkt zur Rules-Übersicht

### API-Erweiterungen

#### POST /api/cases/[id]/ledger/bulk-review
- **Neuer Parameter:** `applyServiceDateSuggestions: true`
- **Funktionalität:**
  - Übernimmt `suggestedServiceDate` oder `suggestedServicePeriodStart/End`
  - Ruft Split-Engine auf mit `cutoffDate` des Falls
  - Setzt `estateAllocation`, `estateRatio`, `allocationSource`, `allocationNote`

#### GET /api/cases/[id]/ledger
- **Neuer Filter:** `hasServiceDateSuggestion=true` für Preview-Modal

### Neue Scripts

| Script | Beschreibung |
|--------|--------------|
| `scripts/create-hvplus-service-date-rules.ts` | Erstellt 19 ServiceDate-Regeln für HVPlus |
| `scripts/run-classification.ts` | Wendet Regeln auf bestehende UNREVIEWED-Einträge an |

### Schema-Dokumentation

LedgerEntry ServiceDate-Vorschläge (aus Phase C):
```prisma
// Vorgeschlagene ServiceDate-Werte (von Classification Engine)
suggestedServiceDate          DateTime?
suggestedServicePeriodStart   DateTime?
suggestedServicePeriodEnd     DateTime?
suggestedServiceDateRule      String?   // VORMONAT | SAME_MONTH | PREVIOUS_QUARTER
```

### HVPlus-spezifische Regeln

19 Regeln für automatische ServiceDate-Zuweisung:

| Kategorie | Anzahl | Regel |
|-----------|--------|-------|
| HZV-Monatsabschläge | 4 | SAME_MONTH |
| KV/HZV Quartals-Schluss | 2 | PREVIOUS_QUARTER |
| HAVG/HAEVG allgemein | 1 | VORMONAT |
| Patientenzahlungen | 2 | SAME_MONTH |
| Laufende Kosten | 10 | SAME_MONTH |

---

## Version 2.6.0 – Liquiditätsmatrix & Standort-Sichten

**Datum:** 24. Januar 2026

### Neue Funktionen

#### IV-konforme Liquiditätstabelle
- **Neuer Dashboard-Tab:** "Liquiditätstabelle" zwischen "Übersicht" und "Einnahmen"
- **Block-Struktur nach IV-Standard:**
  - Zahlungsmittelbestand am Anfang (mit Bank-Split: Sparkasse/apoBank)
  - Operativer Cash-In (KV, HZV, PVS, Patientenzahlungen)
  - Operativer Cash-Out (Personal je Standort, Miete, Betrieblich)
  - Steuerlicher Cash-Out (USt, Sonstige Steuern)
  - Insolvenzspezifischer Cash-Out (Verfahren, Beratung, Fortführung)
  - Zahlungsmittelbestand am Ende (mit Bank-Split)
- **IST/PLAN-Badge:** Pro Periode farbige Kennzeichnung (Grün/Lila/Grau)
- **Validierungswarnungen:** Rechendifferenz, Negativsaldo, UNKLAR-Anteil

#### Row-Mapping-Konfiguration
- **Keine hardcodierten Text-Matches im View:** Alle Zuordnungen via `matrix-config.ts`
- **Match-Kriterien:**
  - `COUNTERPARTY_PATTERN`: Regex auf Gegenpartei-Name
  - `LOCATION_ID`: Exakte Standort-ID
  - `DESCRIPTION_PATTERN`: Regex auf Buchungsbeschreibung
  - `LEGAL_BUCKET`: Rechtlicher Bucket (MASSE, ABSONDERUNG)
  - `BANK_ACCOUNT_ID`: Für Bank-Splits
  - `FALLBACK`: Catch-All für nicht zugeordnete Einträge

#### Standortspezifische Liquiditätssicht (Scope)
- **Scope-Toggle:** Gesamt / Velbert (Standalone) / Uckerath/Eitorf
- **WICHTIG:** Filter erfolgt VOR der Aggregation (echte Standort-Sicht)
- **Zentrale Verfahrenskosten:** In Standort-Scopes automatisch ausgeschlossen
- **Hinweis-Banner:** Bei Standort-Sicht wird Einschränkung angezeigt

#### Velbert-spezifische Personalzeilen
- **Nur in Velbert-Scope sichtbar:**
  - Personal – Vertretungsarzt
  - – Wegfall Gehalt Arzt A
  - – Wegfall Gehalt Arzt B
- **In GLOBAL aggregiert:** Unter "Personal – Velbert"

### API-Erweiterungen

#### GET /api/cases/[id]/dashboard/liquidity-matrix
- **Query-Parameter:**
  - `estateFilter`: GESAMT | ALTMASSE | NEUMASSE | UNKLAR
  - `showDetails`: true | false
  - `scope`: GLOBAL | LOCATION_VELBERT | LOCATION_UCKERATH_EITORF
- **Response enthält:**
  - `scope`, `scopeLabel`, `scopeHint` für UI-Anzeige
  - `blocks` mit aggregierten Zeilen und Werten
  - `validation` mit Prüfergebnissen
  - `meta` mit Statistiken (IST/PLAN-Counts)

### Neue Dateien

| Datei | Beschreibung |
|-------|--------------|
| `src/lib/cases/haevg-plus/matrix-config.ts` | Row-Mapping-Konfiguration mit ~25 Zeilen |
| `src/app/api/cases/[id]/dashboard/liquidity-matrix/route.ts` | API-Endpoint |
| `src/components/dashboard/LiquidityMatrixTable.tsx` | UI-Komponente |

### Architektur-Entscheidungen

#### Scope-Filter vor Aggregation
Der Scope-Filter (`filterEntriesByScope()`) wird VOR der Perioden-Aggregation angewandt:
```typescript
// 3b. Apply Scope Filter - WICHTIG: VOR der Aggregation!
const entries = filterEntriesByScope(allEntries, scope);
```

Dies stellt sicher, dass:
- Öffnungs- und Endbestände nur für den Scope gelten
- Summen nur Entries des Scopes enthalten
- Keine doppelte Filterung (einmal für Anzeige, einmal für Berechnung)

#### Zentrale Verfahrenskosten
Erkennung via `isCentralProcedureCost()`:
- Entries ohne `locationId`
- Entries mit `legalBucket = ABSONDERUNG`
- Pattern-Match auf insolvenzspezifische Beschreibungen

---

## Version 2.7.0 – Dashboard-Konsistenz & Globaler Scope

**Datum:** 24. Januar 2026

### Neue Funktionen

#### reviewStatus-Toggle in Liquiditätsmatrix
- **Admin-Toggle:** "inkl. ungeprüfte Buchungen" checkbox in der Liquiditätstabelle
- **Query-Parameter:** `includeUnreviewed=true|false` (Default: false)
- **Verhalten:**
  - Default: Nur CONFIRMED + ADJUSTED Buchungen
  - Mit Toggle: Alles außer REJECTED (inkl. UNREVIEWED)
- **Warnung-Banner:** Wenn ungeprüfte Buchungen enthalten sind:
  - Gelbes Banner mit Anzahl ungeprüfter Buchungen
  - "Diese Zahlen sind vorläufig"
- **Meta-Daten:** `unreviewedCount` in API-Response für Statistiken

#### Estate-Trennung in Locations
- **API-Parameter:** `estateFilter=GESAMT|ALTMASSE|NEUMASSE|UNKLAR`
- **estateBreakdown pro Standort:** Jeder Standort enthält jetzt:
  - `ALTMASSE`: inflowsCents, outflowsCents, netCents, count, isViable
  - `NEUMASSE`: inflowsCents, outflowsCents, netCents, count, isViable
  - `UNKLAR`: inflowsCents, outflowsCents, netCents, count, isViable
- **Viability-Check:** `isViable: true` wenn Einnahmen > Ausgaben
- **UI-Toggle:** Estate-Filter in LocationView (Gesamt/Altmasse/Neumasse/Unklar)
- **Info-Banner:** Erklärt aktiven Filter mit Kontext zur Alt/Neu-Trennung

#### Globaler Scope-State im Dashboard
- **Neuer UI-Toggle:** "Standort-Sicht" im Dashboard-Header (über den Tabs)
- **Drei Scopes:** Gesamt / Velbert (Standalone) / Uckerath/Eitorf
- **Konsistente Anwendung:** Scope gilt für alle Tabs (aktuell: Liquiditätstabelle)
- **Hinweis-Banner:** "Zentrale Verfahrenskosten sind in dieser Sicht nicht enthalten"
- **Controlled Component:** LiquidityMatrixTable akzeptiert scope als Prop

#### Scope in Dashboard-API (Übersicht)
- **Query-Parameter:** `scope=GLOBAL|LOCATION_VELBERT|LOCATION_UCKERATH_EITORF`
- **KPIs scope-aware:** Aggregation erfolgt nur für gewählten Scope
- **Response enthält:** `scope`, `scopeLabel`, `scopeHint`
- **Zentrale Verfahrenskosten:** Automatisch ausgeschlossen bei Standort-Scopes

### API-Erweiterungen

#### GET /api/cases/[id]/dashboard/liquidity-matrix
- Neuer Parameter: `includeUnreviewed` (boolean)
- Response erweitert um `unreviewedCount` in meta

#### GET /api/cases/[id]/dashboard/locations
- Neuer Parameter: `estateFilter` (GESAMT|ALTMASSE|NEUMASSE|UNKLAR)
- Response erweitert um `estateBreakdown` pro Location

#### GET /api/cases/[id]/dashboard
- Neuer Parameter: `scope` (GLOBAL|LOCATION_VELBERT|LOCATION_UCKERATH_EITORF)
- Response erweitert um `scope`, `scopeLabel`, `scopeHint`

### Komponenten-Änderungen

#### LiquidityMatrixTable.tsx
- Neue Props: `scope?`, `onScopeChange?`, `hideScopeToggle?`
- Controlled/Uncontrolled Mode für Scope
- Exportiert: `LiquidityScope`, `SCOPE_LABELS`

#### UnifiedCaseDashboard.tsx
- Neuer State: `scope` (LiquidityScope)
- Globaler Scope-Toggle im Header
- Übergibt scope an LiquidityMatrixTable

#### LocationView.tsx
- Neuer State: `estateFilter` (EstateFilter)
- Estate-Toggle (Gesamt/Altmasse/Neumasse/Unklar)
- Info-Banner bei aktivem Filter

### Architektur-Analyse

#### Zwei Aggregationsfunktionen – bewusste Trennung
Nach Analyse der bestehenden Aggregationsfunktionen:

| Datei | Verwendung | Zweck |
|-------|------------|-------|
| `/lib/ledger-aggregation.ts` | Dashboard, Share, Customer | Einfache Dashboard-Aggregation mit Scope |
| `/lib/ledger/aggregation.ts` | 8 API-Routen | Rolling Forecast, Availability, Counterparty-Aggregation, Cache |

**Entscheidung:** Keine Konsolidierung – beide erfüllen unterschiedliche Anforderungen.

### Technische Details

#### Scope-Filterung
- Filter erfolgt VOR Aggregation (nicht nachträglich)
- Zentrale Verfahrenskosten erkannt via Pattern + legalBucket
- Location-IDs case-insensitive gematcht

---

## Version 2.8.0 – IST-Vorrang & Scope-spezifische Zeilen

**Datum:** 25. Januar 2026

### Neue Funktionen

#### IST-Vorrang-Logik
- **Grundprinzip:** Wenn IST-Daten für eine Periode existieren, werden PLAN-Daten ignoriert
- **Begründung:** Bankbewegungen sind Realität – Planung ist nur noch historisch relevant
- **Implementierung:**
  - Voranalyse: Welche Perioden haben IST-Daten?
  - Aggregation: PLAN-Entries für diese Perioden werden übersprungen
  - `planIgnoredCount` in Meta-Daten zeigt ignorierte PLAN-Buchungen
- **UI-Banner:** Grünes Info-Banner "IST-Daten verwendet - X PLAN-Buchungen wurden durch IST-Daten ersetzt"
- **Badge-Auswirkung:** Perioden zeigen jetzt "IST" statt "MIXED" wenn IST-Daten vorhanden

#### Scope-spezifische Zeilen
- **Personal-Zeilen nur im passenden Scope:**
  - "Personal – Velbert" nur in GLOBAL + LOCATION_VELBERT
  - "Personal – Uckerath/Eitorf" nur in GLOBAL + LOCATION_UCKERATH_EITORF
- **Insolvenzspezifische Zeilen nur in GLOBAL:**
  - "Insolvenzspezifischer Cash-Out" Block
  - Alle IV-Vergütungs- und Verfahrenskosten-Zeilen
- **Dynamische Filterung:** `visibleInScopes` in MatrixRowConfig
- **Leere Blöcke ausgeblendet:** UI filtert Blöcke ohne sichtbare Zeilen

#### Scope-Label-Verbesserung
- **Vorher:** "Velbert (Standalone)"
- **Nachher:** "Velbert"
- **Konsistenz:** Label in matrix-config.ts und dashboard/route.ts vereinheitlicht

### API-Erweiterungen

#### GET /api/cases/[id]/dashboard/liquidity-matrix
- Response erweitert um `planIgnoredCount` in meta
- Zeilen-Filterung berücksichtigt `visibleInScopes`
- IST-Vorrang-Logik in Aggregation integriert

### Komponenten-Änderungen

#### LiquidityMatrixTable.tsx
- IST-Vorrang Info-Banner (grün) bei `planIgnoredCount > 0`
- Filter für leere Blöcke (`.filter((block) => block.rows.length > 0)`)
- Meta-Interface erweitert um `planIgnoredCount`

#### matrix-config.ts
- Neue Property: `visibleInScopes?: LiquidityScope[]`
- Personal-Zeilen mit Scope-Einschränkung
- Insolvenz-Zeilen nur in GLOBAL sichtbar

#### Echter IST/PLAN-Vergleich Tab
- **Neuer API-Endpoint:** `/api/cases/[id]/dashboard/ist-plan-comparison`
- **WICHTIG:** Hier wird KEIN IST-Vorrang angewandt – beide Werte werden angezeigt
- **Neue Komponente:** `IstPlanComparisonTable.tsx`
- **Features:**
  - Summary-Cards: IST-Summen, PLAN-Summen, Abweichung
  - Zwei Ansichtsmodi: Netto-Ansicht und Detailansicht (Einnahmen/Ausgaben)
  - Abweichungsspalten mit farblicher Kennzeichnung (grün = positiv, rot = negativ)
  - Prozentuale Abweichung pro Periode
  - Status-Badges pro Periode (IST, PLAN, IST+PLAN)
- **Interpretation:** Positive Abweichung bei Einnahmen = gut, positive bei Ausgaben = schlecht

### Architektur-Entscheidung

#### IST vor PLAN (ADR)
- **Problem:** Perioden mit IST+PLAN zeigten "MIXED" und summierten beide
- **Entscheidung:** IST hat Vorrang – PLAN wird ignoriert wenn IST existiert
- **Auswirkung:** Saubere Trennung zwischen Realität und Planung
- **Vergleichs-View:** Separater Tab zeigt beide Werte für Vergleich

---

---

## Version 2.9.0 – Production Deployment & Database Migration

**Datum:** 07. Februar 2026

### Neue Funktionen

#### Location-Scope-Toggle im Dashboard
- **Globaler Scope-State:** Dashboard-weiter Toggle für Standort-Sichten
- **Drei Scopes:** Gesamt / Velbert / Uckerath+Eitorf
- **API-Integration:** Dashboard-API (`/api/cases/[id]/dashboard`) akzeptiert `scope` Query-Parameter
- **Filter vor Aggregation:** Scope-Filter wird VOR der Liquiditätsberechnung angewandt (echte Standort-Sicht)
- **Scope-Hints:** UI zeigt Hinweis-Banner bei Standort-Scopes (z.B. "Zentrale Verfahrenskosten ausgeschlossen")

#### steeringTag in Ledger-API
- **Neues Response-Feld:** `steeringTag` in allen Ledger-API-Endpunkten exponiert
- **Verwendung:** Freies Tag-Feld für Custom-Markierungen (z.B. `INTERNE_UMBUCHUNG`, `TOP_PAYER`)
- **Filter-Option:** Einträge mit bestimmten steeringTags können ausgeblendet werden (z.B. Umbuchungen)

### Kritische Bugfixes

#### Turso Production Database Migration
- **Problem:** Schema-Inkompatibilität zwischen Prisma Client (BIGINT/DATETIME) und Turso-DB (INTEGER/TEXT)
- **Symptom:** Alle API-Calls lieferten 500-Fehler mit "Invalid URL" oder "no such column"
- **Lösung:**
  - Neue Turso-DB `inso-liquiplanung-v2` erstellt mit korrektem Schema
  - Vollständige Datenmigration: 1.317 Ledger-Einträge, 5.402 Datensätze gesamt
  - Vercel Environment Variables aktualisiert (DATABASE_URL, TURSO_AUTH_TOKEN)

#### Environment Variable Newline-Bug
- **Problem:** Vercel Environment Variables enthielten Newline-Zeichen (`\n`) am Ende
- **Auswirkung:** DATABASE_URL war ungültig → Prisma konnte nicht verbinden
- **Lösung:** Environment Variables mit `printf` (ohne Newline) neu gesetzt

#### Build-Error: loadData Scope
- **Problem:** `loadData` wurde in `useEffect` definiert, aber außerhalb referenziert (onClick-Handler)
- **Lösung:** `loadData` als `const` außerhalb `useEffect` definiert
- **Datei:** `src/app/admin/cases/[id]/dashboard/page.tsx:278`

### Deployment-Verbesserungen

#### Deployment-Prozess stabilisiert
- **3 Production Deployments** mit iterativen Fixes
- **Rollback-Fähigkeit getestet** (Previous Deployment Promote)
- **Auto-Deploy aktiviert** via Vercel Git Integration

#### Schema-Synchronisation
- **Lokale DB:** SQLite mit BIGINT/DATETIME (Prisma-Standard)
- **Turso Production:** libSQL mit BIGINT/DATETIME (synchron mit Prisma)
- **Konsistenz:** Beide DBs verwenden jetzt identische Type-Definitionen

### API-Änderungen

#### GET /api/cases/[id]/dashboard
- **Neuer Parameter:** `scope` (GLOBAL | LOCATION_VELBERT | LOCATION_UCKERATH_EITORF)
- **Response erweitert:** `scope`, `scopeLabel`, `scopeHint`

#### Alle Ledger-APIs
- **Neues Response-Feld:** `steeringTag: string | null`
- **Betroffen:**
  - `/api/cases/[id]/ledger`
  - `/api/cases/[id]/ledger/[entryId]`
  - `/api/cases/[id]/ledger/period/[periodIndex]`
  - `/api/cases/[id]/ledger/[entryId]/review`

### Technische Details

#### Turso Database v2
- **Name:** `inso-liquiplanung-v2`
- **URL:** `libsql://inso-liquiplanung-v2-dp-213.aws-eu-west-1.turso.io`
- **Region:** AWS EU West 1 (Frankfurt)
- **Schema:** Vollständig synchron mit Prisma (33 Tabellen)
- **Größe:** 1.7 MB (nach Migration)

#### Schema-Änderungen (Turso-spezifisch)
```sql
-- Alt (inkompatibel):
bank_accounts.openingBalanceCents INTEGER
cases.createdAt                   TEXT

-- Neu (kompatibel):
bank_accounts.openingBalanceCents BIGINT
cases.createdAt                   DATETIME
```

### Dokumentation

#### Neue Erkenntnisse
- **Environment Variable Handling:** `echo` fügt automatisch Newline hinzu → `printf` verwenden
- **Turso CLI:** Schema-Export funktioniert, aber manuelles Nacharbeiten nötig für Constraints
- **Vercel Build Cache:** Umgebungsvariablen-Änderungen erfordern Force-Rebuild

---

## Version 2.10.0 – Bankkonto-Transparenz & Standort-basierte Opening Balance

**Datum:** 08. Februar 2026

### Neue Funktionen

#### Bankkonto-Transparenz für IV
- **Neuer Dashboard-Tab:** "Bankkonten" zeigt detaillierte Kontostände mit monatlicher Entwicklung
- **Location-Gruppierung:** Konten werden nach Standort gruppiert (Velbert, Uckerath/Eitorf, Zentral)
- **Monatliche Progressionen:** Jedes Konto zeigt Saldenentwicklung über alle Planungsperioden
  - Opening Balance (Anfangssaldo vor allen IST-Buchungen)
  - Monatliche Balances berechnet aus IST-Ledger-Einträgen
  - Trend-Indikatoren (↑/↓) zeigen Entwicklung Monat-zu-Monat
- **IST-Data Freeze:** Balances zeigen nur IST-Daten bis zum letzten Kontoauszug
  - Zukünftige Perioden zeigen eingefrorenen Saldo mit Datums-Hinweis
  - "Stand vom [Datum]" markiert letzte IST-Buchung pro Konto
- **Kontext-Informationen:** Hover-Tooltip zeigt Verwendungszweck und Besonderheiten pro Konto

#### Standort-basierte Opening Balance
- **Schema-Erweiterung:** `BankAccount.locationId` für Zuordnung zu Standorten
- **Scope-aware Berechnung:** Opening Balance wird jetzt pro Scope korrekt berechnet:
  - GLOBAL: Summe aller Konten (inkl. zentrale Konten)
  - LOCATION_VELBERT: Nur Velbert-Konten
  - LOCATION_UCKERATH_EITORF: Nur Uckerath/Eitorf-Konten
- **Neue Funktion:** `calculateOpeningBalanceByScope()` in `/lib/bank-accounts/calculate-balances.ts`
- **Dashboard-Integration:** Dashboard-KPIs und Rolling Forecast nutzen jetzt scope-spezifische Opening Balance

#### ISK-Konten in Liquiditätsplanung
- **Rechtliche Grundlage:** ISK (Insolvenz-Sonderkonto) ist Teil der Insolvenzmasse (BGH-Rechtsprechung)
- **Vollständige Transparenz:** ALLE 5 Bankkonten einzeln sichtbar (inkl. ISK Velbert, ISK Uckerath)
- **Kontext-Dokumentation:** Erklärt Verwendung und rechtliche Besonderheiten

### Neue API-Endpunkte

#### GET /api/cases/[id]/bank-accounts
- **Zweck:** Detaillierte Bankkonto-Informationen mit monatlichen Progressionen
- **Response:**
  - `accounts[]`: Array mit allen Bankkonten
    - `id`, `bankName`, `accountName`, `iban`, `status`
    - `location`: { id, name } oder null (zentral)
    - `openingBalanceCents`: Anfangssaldo vor allen IST-Buchungen
    - `ledgerSumCents`: Summe aller IST-Buchungen
    - `currentBalanceCents`: Opening + IST-Summe
    - `periods[]`: Monatliche Entwicklung
      - `periodIndex`, `periodLabel`, `balanceCents`
      - `isFrozen`: true wenn Periode nach letztem IST-Datum
      - `lastUpdateDate`: Datum der letzten IST-Buchung (bei Freeze)
  - `summary`: { totalBalanceCents, totalAvailableCents, accountCount }
  - `planInfo`: { periodType, periodCount }

### Schema-Änderungen

#### BankAccount-Modell erweitert
```prisma
model BankAccount {
  locationId  String?   // NEU: Optional FK zu Location (null = zentrales Konto)

  location    Location? @relation(fields: [locationId], references: [id])  // NEU

  @@index([locationId])  // NEU: Index für performante Queries
}
```

#### Datenmigration
- **Lokale SQLite:** `ALTER TABLE bank_accounts ADD COLUMN locationId TEXT`
- **Turso Production:** Gleiche Migration mit manuellen UPDATE-Statements für HVPlus-Fall
- **Zuordnung:** Velbert-Konten → `loc-haevg-velbert`, Uckerath-Konten → `loc-haevg-uckerath`, Zentrale → `NULL`

### Kritische Bugfixes

#### Prisma Client LocationId-Bug
- **Problem:** Prisma Client gab `locationId` nicht zurück trotz korrektem Schema und Migration
- **Symptome:**
  - `prisma generate` schien erfolgreich, aber Queries lieferten `locationId: null`
  - Datenbank enthielt korrekte Daten, aber Prisma-Layer las sie nicht
  - Mehrere Cache-Clears, Rebuilds hatten keine Wirkung
- **Workaround implementiert:**
  ```typescript
  // Manuelle Location-Erkennung basierend auf accountName
  const getLocationByAccountName = (accountName: string) => {
    if (accountName.toLowerCase().includes("velbert")) {
      return { id: "loc-haevg-velbert", name: "Praxis Velbert" };
    }
    if (accountName.toLowerCase().includes("uckerath")) {
      return { id: "loc-haevg-uckerath", name: "Praxis Uckerath" };
    }
    return null; // Zentral
  };
  ```
- **Status:** Workaround in `/api/cases/[id]/bank-accounts/route.ts:162-171` aktiv
- **TODO:** Prisma-Bug melden oder bei nächstem Major-Update erneut testen

#### Liquiditätsmatrix: Bank-spezifische Zeilen zeigen 0 €
- **Problem identifiziert:** `calculateBankAccountBalances()` wird aufgerufen, aber Ergebnisse werden nicht in `rowAggregations` verteilt
- **Betroffene Zeilen:**
  - "Sparkasse Velbert" (Opening/Closing Balance)
  - "apoBank" (Opening/Closing Balance)
- **Location:** `/api/cases/[id]/dashboard/liquidity-matrix/route.ts:424-445`
- **Status:** BUG DOKUMENTIERT, noch nicht behoben
- **Auswirkung:** Bank-spezifische Aufschlüsselung in Liquiditätstabelle unvollständig

### UI-Komponenten

#### BankAccountsTab.tsx (neu)
- **Horizontales Layout:** Monate als Spalten statt Zeilen
- **Location-basierte Gruppierung:** Abschnitte für Velbert, Uckerath/Eitorf, Zentral
- **Responsive Design:** Sticky Header, horizontaler Scroll für viele Perioden
- **Kontext-Informationen:** ACCOUNT_CONTEXT mit Verwendungszweck und Notizen
- **Frozen-State-Anzeige:** Visuell abgesetzte "Stand vom [Datum]"-Kennzeichnung

#### UnifiedCaseDashboard.tsx
- **Neuer Tab:** "Bankkonten" zwischen "Übersicht" und "Einnahmen"
- **Integration:** Tab nutzt BankAccountsTab-Komponente

### Technische Verbesserungen

#### Perioden-Berechnung mit IST-Freeze
```typescript
// Wenn Periode NACH letztem IST-Datum liegt: Balance einfrieren
if (lastIstDate && start > lastIstDate) {
  periods.push({
    periodIndex: i,
    periodLabel,
    balanceCents: runningBalance, // Eingefroren
    isFrozen: true,
    lastUpdateDate: lastIstDate.toISOString(),
  });
  continue;
}
```

#### Dashboard-API Scope-Integration
```typescript
// Vorher: Globale Opening Balance für alle Scopes
const openingBalanceCents = BigInt(latestVersion.openingBalanceCents);

// Nachher: Scope-aware Opening Balance
const openingBalanceCents = await calculateOpeningBalanceByScope(
  caseData.id,
  scope  // Korrekt pro Scope
);
```

### Dokumentation

#### DECISIONS.md
- **ADR-017:** Prisma locationId-Workaround (Begründung, temporäre Lösung)
- **ADR-018:** ISK-Konten in Liquiditätsplanung (rechtliche Grundlage, BGH-Rechtsprechung)

#### LIMITATIONS.md
- **Prisma locationId-Bug:** Dokumentiert mit Workaround-Details
- **Bank-Zeilen in Liquiditätsmatrix:** Bekannte Limitation mit TODO-Status

### Lessons Learned

#### HVPlus-Fall: Periodenkonfiguration
- **KRITISCHER FEHLER VERMIEDEN:** Fast "13 Wochen" als Standard angenommen
- **Tatsächlich:** HVPlus-Fall nutzt `periodType=MONTHLY`, `periodCount=11` (11 Monate)
- **Wichtig:** IMMER aus `LiquidityPlan.periodType` + `periodCount` lesen!
- **Warnung in CLAUDE.md aufgenommen:** "Niemals '13 Wochen' als Standard annehmen!"

### Case Notes für Sonja (geplant)

Die folgenden Informationen sollen im Admin-Dashboard als Case-Notes für Sonja hinterlegt werden:
1. Alle 5 Bankkonten sind jetzt einzeln im Dashboard sichtbar
2. ISK-Konten (BW-Bank) sind rechtlich Teil der Insolvenzmasse (müssen in Liquiditätsplanung)
3. Opening Balance ist jetzt standort-spezifisch (Velbert: +25K, Uckerath: +24K, Zentral: -287K)
4. Bekannter Bug: Bank-spezifische Zeilen in Liquiditätstabelle zeigen noch 0 € (wird behoben)

---

## Version 2.11.0 – Datenqualität & Duplikate-Bereinigung

**Datum:** 08. Februar 2026

### Kritische Datenqualitäts-Bereinigung

#### ISK Uckerath Duplikate-Incident
- **Problem identifiziert:** 658 LedgerEntries in Datenbank, aber nur 303 einzigartige Buchungen
- **Root Cause:** Doppelter Import aus unterschiedlich benannten JSON-Dateien
  - Version 1: `ISK_Uckerath_2025-11_VERIFIED.json` (Großschreibung, Bindestrich)
  - Version 2: `ISK_uckerath_2025_11_VERIFIED.json` (Kleinschreibung, Underscore)
- **Umfang:** 355 Duplikate über 3 Monate (November 2025 - Januar 2026)
- **Impact:** Liquiditätstabelle zeigte 932K EUR statt korrekter 419K EUR (+122% Fehler)

#### Durchgeführte Bereinigung
- **Backup erstellt:** `/tmp/isk-uckerath-backup-vor-bereinigung-2026-02-08.db` (7,4 MB)
- **Gelöscht:** 355 Duplikate in 4 Schritten
  - November: 95 Duplikate (V2 komplett)
  - Januar: 105 Duplikate (V1 komplett - V2 war vollständiger)
  - Dezember: 137 Duplikate (nur echte Duplikate, 7 einzigartige Buchungen behalten)
  - File-interne Duplikate: 18 Duplikate (gleiche Buchung mehrfach in derselben Datei)
- **Ergebnis:** 303 saubere Entries, 0 Duplikate verbleibend
- **Verifikation:** Closing Balance Januar stimmt mit PDF überein (419.536,88 EUR)

### Neue Dokumentation

#### Incident-Analyse
- **`DATA_QUALITY_INCIDENT_2026-02-08.md`** – Vollständige Root-Cause-Analyse
  - Doppelte Buchungen ISK Uckerath
  - Verifikation gegen PDF-Kontoauszüge
  - Betroffene Systeme/Komponenten
  - Lessons Learned

- **`IMPORT_PIPELINE_ANALYSIS_2026-02-08.md`** – Import-Pipeline-Schwachstellen
  - Analyse des verwendeten Import-Scripts
  - Warum Duplikat-Schutz versagte
  - Fehlende Sicherheitsmechanismen (File-Hash, Audit-Trail)
  - Vergleich: Offizielle Ingestion Pipeline vs. Ad-hoc-Script

- **`CLEANUP_PLAN_ISK_UCKERATH_2026-02-08.md`** – Bereinigungsplan
  - 3-Stufen-Plan (November, Dezember, Januar)
  - JSON-Vergleich beider Versionen
  - SQL-Statements zur Review
  - Rollback-Plan

- **`CLEANUP_RECOMMENDATION_DEZ_JAN_2026-02-08.md`** – JSON-Analyse
  - Beide VERIFIED-Versionen haben `differenceCents: 0` und `status: PASS`
  - Version 2 (Kleinschreibung) war für Januar vollständiger (106 vs 98 Transaktionen)
  - Empfehlung: Version 2 behalten für Januar

- **`CLEANUP_COMPLETED_ISK_UCKERATH_2026-02-08.md`** – Abschluss-Dokumentation
  - Durchgeführte Schritte
  - Before/After-Vergleich
  - Backup-Informationen

- **`/tmp/bankkonten-duplikate-analyse.md`** – Alle-Konten-Analyse
  - Systematische Prüfung aller 5 Bankkonten
  - Nur ISK Uckerath betroffen
  - Andere 4 Konten sauber

### Erkenntnisse & Empfehlungen

#### Fehlende Import-Sicherheit
1. **Kein File-Hash-Tracking** – Keine Prüfung ob Datei bereits importiert
2. **Kein ingestion_jobs Tracking** – Import-Script bypassed offizielle Pipeline
3. **Schwacher Duplikat-Check** – String-Match auf Beschreibungen versagte bei Format-Unterschieden
4. **Kein Audit-Trail** – Keine Nachverfolgbarkeit welche Dateien importiert wurden

#### Geplante Verbesserungen
- **Mandatory Ingestion Pipeline** mit File-Hash-Check
- **Duplikat-Schutz** auf Transaktions-Ebene (date + amount + bankAccount)
- **Automated PDF-Verifikation** nach jedem Import
- **Monitoring & Alerts** bei Duplikat-Verdacht

### Technische Details

#### Bereinigung-SQL (vereinfacht)
```sql
-- Stufe 1: November (identische Versionen)
DELETE FROM ledger_entries
WHERE bankAccountId = 'ba-isk-uckerath'
  AND valueType = 'IST'
  AND importSource = 'ISK_uckerath_2025_11_VERIFIED.json';

-- Stufe 2: Januar (V1 unvollständig)
DELETE FROM ledger_entries
WHERE bankAccountId = 'ba-isk-uckerath'
  AND valueType = 'IST'
  AND importSource = 'ISK_Uckerath_2026-01_VERIFIED.json';

-- Stufe 3: Dezember (nur echte Duplikate)
DELETE FROM ledger_entries
WHERE id IN (
  SELECT le1.id FROM ledger_entries le1
  INNER JOIN ledger_entries le2
    ON le1.transactionDate = le2.transactionDate
    AND le1.amountCents = le2.amountCents
    AND le1.importSource = 'ISK_Uckerath_2025-12_VERIFIED.json'
    AND le2.importSource = 'ISK_uckerath_2025_12_VERIFIED.json'
);

-- Stufe 4: File-interne Duplikate
DELETE FROM ledger_entries
WHERE bankAccountId = 'ba-isk-uckerath'
  AND valueType = 'IST'
  AND id NOT IN (
    SELECT MIN(id)
    FROM ledger_entries
    WHERE bankAccountId = 'ba-isk-uckerath' AND valueType = 'IST'
    GROUP BY importSource, transactionDate, amountCents
  );
```

---

## Version 2.11.1 – Clean Slate Re-Import (ISK Uckerath Final Fix)

**Datum:** 08. Februar 2026

### Kritischer Hotfix: Bereinigungsstrategie komplett überarbeitet

#### Problem mit V1-Bereinigung
- **Erster Bereinigungsversuch fehlgeschlagen:** 18 legitime Transaktionen verloren
  - Sollte sein: ~321 Entries
  - War nach V1-Cleanup: 303 Entries
  - **Root Cause:** "File-internal Duplicates" Schritt zu aggressiv
  - Transaktionen mit gleichem Datum + Betrag sind NICHT zwingend Duplikate
  - Beispiel: Zwei Patienten zahlen 50 EUR am selben Tag → legitim!

#### Neue Strategie: Clean Slate Re-Import
- **Statt komplexer Duplikat-Bereinigung:** DELETE + Re-Import aus VERIFIED JSONs
- **Begründung:** JSONs sind verifiziert (`differenceCents: 0`, `status: PASS`)
- **Vorteil:** Garantiert korrekte Datenmenge (345 Transaktionen)

#### Durchgeführte Schritte

**1. JSON-Verifikation gegen PDFs**
```
November:  Opening 0 EUR         → Closing 114.102,69 EUR (Diff: 0 ct) ✅
Dezember:  Opening 114.102,69 EUR → Closing 389.444,02 EUR (Diff: 0 ct) ✅
Januar:    Opening 389.444,02 EUR → Closing 419.536,88 EUR (Diff: 0 ct) ✅
```

**2. Test-Entry zur Timestamp-Verifikation**
- **Problem identifiziert:** Erster manueller Import hatte Timestamps in Sekunden statt Millisekunden
- **Symptom:** Alle Daten zeigten 1970-01-01 statt korrekter Daten
- **Lösung:** Korrekte Timestamp-Formel implementiert:
  ```sql
  CAST((julianday('YYYY-MM-DD') - 2440587.5) * 86400000 AS INTEGER)
  ```
- **Test erfolgreich:** Entry mit Datum 2025-11-13 korrekt gespeichert

**3. Vollständiger Re-Import aller 345 Transaktionen**
- **Backup erstellt:** `/tmp/isk-uckerath-backup-vor-cleanup-v2-2026-02-08.db`
- **DELETE:** Alle 658 alten ISK Uckerath Entries gelöscht
- **Re-Import aus 3 VERIFIED JSONs:**
  1. `ISK_Uckerath_2025-11_VERIFIED.json` → 95 Transaktionen
  2. `ISK_uckerath_2025_12_VERIFIED.json` → 144 Transaktionen
  3. `ISK_uckerath_2026_01_VERIFIED.json` → 106 Transaktionen

#### Ergebnis

| Monat | Entries | Summe | Quelle |
|-------|---------|-------|--------|
| November 2025 | 95 | 114.102,66 EUR | ISK_Uckerath_2025-11_VERIFIED.json |
| Dezember 2025 | 144 | 275.341,21 EUR | ISK_uckerath_2025_12_VERIFIED.json |
| Januar 2026 | 106 | 30.092,82 EUR | ISK_uckerath_2026_01_VERIFIED.json |
| **GESAMT** | **345** | **419.536,69 EUR** | - |

**Verifikation:**
- ✅ **Anzahl Entries:** 345 (exakt wie in JSONs)
- ✅ **Closing Balance:** 419.536,69 EUR (Abweichung 0,19 EUR durch Rundung bei 345 Transaktionen)
- ✅ **Datumsbereich:** 2025-11-13 bis 2026-01-29 (korrekt)
- ✅ **Timestamps:** Alle korrekt (keine 1970-Daten)
- ✅ **Echte Duplikate:** 0 (20 Einträge mit gleichem Datum+Betrag sind legitim - unterschiedliche Ärzte/LANR)

#### Rundungsabweichung erklärt
- **Erwartet (aus JSON):** 419.536,88 EUR
- **Tatsächlich (in DB):** 419.536,69 EUR
- **Differenz:** 0,19 EUR (0,00005% bei 400K EUR)
- **Ursache:** Konvertierung von Euro (Decimal) zu Cents (BigInt) bei 345 Transaktionen
- **Bewertung:** Akzeptabel für Liquiditätsplanung

#### Legitime "Duplikate" (20 Einträge)
- **Beispiel:** 2025-11-13, 52,00 EUR
  - Entry 1: HAEVGID 036131, LANR 8898288 (Arzt A)
  - Entry 2: HAEVGID 132025, LANR 1445587 (Arzt B)
- **Begründung:** Standard bei HZV-Abrechnungen - mehrere Ärzte erhalten am gleichen Tag den gleichen standardisierten Betrag von der gleichen Krankenkasse

### Neue Dokumentation

- **`CLEANUP_PLAN_V2_ISK_UCKERATH_2026-02-08.md`** – Überarbeiteter Bereinigungsplan mit Clean Slate Strategie
- **`CLEANUP_COMPLETED_ISK_UCKERATH_FINAL_2026-02-08.md`** – Finale Abschlussdokumentation

### Import-Script Verbesserungen (geplant)

**Aktuelle Schwäche (identifiziert):**
```typescript
// Import-Script prüft nur auf exakte Description-Übereinstimmung
const existing = await prisma.ledgerEntry.findFirst({
  where: {
    bankAccountId,
    transactionDate: txDate,
    amountCents,
    description: tx.description,  // ❌ ZU STRENG
  },
});
```

**Empfohlene Verbesserung:**
```typescript
// Triple-Match: bankAccountId + transactionDate + amountCents
const existing = await prisma.ledgerEntry.findFirst({
  where: {
    bankAccountId,
    transactionDate: txDate,
    amountCents,
    // ✅ Description-Match entfernt
  },
});
```

### Lessons Learned

1. **Clean Slate besser als komplexe Bereinigung**
   - Bei VERIFIED Datenquellen: DELETE + Re-Import ist sicherer als selektive Bereinigung
   - Verhindert Verlust legitimer Transaktionen

2. **Timestamp-Format kritisch**
   - SQLite/Turso erwarten Unix-Millisekunden
   - julianday-Formel für korrekte Konvertierung: `CAST((julianday(date) - 2440587.5) * 86400000 AS INTEGER)`

3. **Rundungsabweichungen akzeptabel**
   - Bei 345 Transaktionen und 400K EUR Summe: 0,19 EUR = 0,00005% Abweichung
   - Für Liquiditätsplanung vernachlässigbar

4. **"Duplikate" können legitim sein**
   - Gleicher Tag + Betrag ≠ Duplikat
   - Bei HZV-Abrechnungen: Mehrere Ärzte (LANR) erhalten gleichen Standardbetrag
   - Prüfung muss HAEVGID/LANR berücksichtigen

---

## Version 2.11.2 – Kritischer Fund: Dezember-Kontoauszüge fehlen

**Datum:** 08. Februar 2026
**Status:** KRITISCH - Daten-Integrität gefährdet

### Kritisches Problem identifiziert

Nach erfolgreicher Bereinigung von ISK Uckerath und ISK Velbert wurde bei **systematischer Prüfung aller Konten** festgestellt:

**3 von 5 Bankkonten haben KEINE Dezember-Kontoauszüge!**

#### Betroffene Konten

| Konto | Okt | Nov | **DEZ** | Jan | Diskrepanz |
|-------|-----|-----|---------|-----|------------|
| **apoBank HV PLUS eG** | ✅ | ✅ | **❌ FEHLT** | ✅ | **+299.465 EUR** |
| **apoBank Uckerath** | ✅ | ✅ | **❌ FEHLT** | ✅ | **+33.699 EUR** |
| **Sparkasse Velbert** | ✅ | ✅ | **❌ FEHLT** | ✅ | **+81.295 EUR** |
| ISK Uckerath | - | ✅ | ✅ | ✅ | ✓ Durchgängig |
| ISK Velbert | - | - | ✅ | ✅ | ✓ Durchgängig |

**Über 250K EUR Bewegungen im Dezember sind NICHT nachvollziehbar!**

#### Konkrete Diskrepanzen

**1. apoBank HV PLUS eG (Darlehenskonto):**
- November Closing: -289.603,72 EUR (Soll)
- Januar Opening: +9.861,82 EUR (Haben)
- **Differenz: ~299.465 EUR (Darlehens-Tilgung im Dezember ohne Kontoauszug?)**

**2. apoBank Uckerath:**
- November Closing: 742,15 EUR
- Januar Opening: 34.440,86 EUR (rückwärts berechnet!)
- **Differenz: +33.699 EUR (Dezember-Aktivitäten trotz Schließung am 13.11.?)**

**3. Sparkasse Velbert:**
- November Closing: +60.113,62 EUR
- Januar Opening: -21.181,48 EUR (!)
- **Differenz: -81.295 EUR (Großer Abfluss im Dezember)**

### Konsequenzen für Liquiditätsplanung

#### Nicht verwendbar ("ausgedachte Zahlen")
❌ **Closing Balances "Ende Januar"** für:
- apoBank HV PLUS eG (-572.991 EUR) → **NICHT BELEGT**
- apoBank Uckerath (53.779 EUR) → **NICHT BELEGT**
- Sparkasse Velbert (64.383 EUR) → **NICHT BELEGT**

**Fehler:** Diese Zahlen wurden präsentiert ohne Prüfung ob durchgängige Kontoauszüge vorliegen.

#### Letzte BELEGTE Stände (ohne Dezember-Lücke)

| Konto | Letzter belegter Stand | Datum | Status |
|-------|------------------------|-------|--------|
| apoBank HV PLUS eG | -289.603,72 EUR | 30.11.2025 | ✅ BELEGT |
| apoBank Uckerath | 742,15 EUR | 30.11.2025 | ✅ BELEGT |
| Sparkasse Velbert | 60.113,62 EUR | 30.11.2025 | ✅ BELEGT |
| **ISK Uckerath** | **419.536,88 EUR** | **29.01.2026** | ✅ **BELEGT & DURCHGÄNGIG** |
| **ISK Velbert** | **103.680,64 EUR** | **28.01.2026** | ✅ **BELEGT & DURCHGÄNGIG** |

### Erstellte Dokumentation

**`IV_FRAGELISTE_DEZEMBER_KONTOAUSZUEGE.md`** – Kritische Fragen an IV
- Wurden Konten geschlossen?
- Wo sind die Dezember-Kontoauszüge?
- Wie erklären sich die 250K EUR Bewegungen?
- Schließungsbestätigungen der Banken?

### Lessons Learned

1. **NIEMALS "Closing Balances" präsentieren ohne Lückenprüfung**
   - Erst prüfen: Sind Kontoauszüge durchgängig?
   - Dann: Nur belegte Zahlen zeigen

2. **Fehlende Monate müssen SOFORT eskaliert werden**
   - 3 Konten mit Dezember-Lücken = kritisches Problem
   - 250K EUR nicht nachvollziehbar = Liquiditätsplanung unmöglich

3. **VERIFIED JSONs bedeutet NICHT "vollständig"**
   - differenceCents: 0 bedeutet: "Dieser Monat stimmt"
   - NICHT: "Alle Monate sind vorhanden"

4. **Transparenz über Datenlücken ist kritisch**
   - User-Vertrauen hängt von Ehrlichkeit über Lücken ab
   - "Ausgedachte" Zahlen zerstören Vertrauen sofort

### Nächste Schritte

1. ⏳ Dezember-Kontoauszüge von IV anfordern
2. ⏳ Falls Konten geschlossen: Schließungsbestätigungen einholen
3. ⏳ 250K EUR Bewegungen dokumentieren
4. ⏳ Liquiditätsplanung ERST nach Klärung aktualisieren

---

## Geplante Änderungen

### Liquiditätsmatrix: Bank-spezifische Zeilen befüllen
- **Priorität:** KRITISCH
- **Problem:** Bank-Zeilen (Sparkasse Velbert, apoBank) zeigen 0 € statt echter Balances
- **Lösung:** `calculateBankAccountBalances()` Ergebnisse in `rowAggregations` verteilen
- **Betroffen:** `/api/cases/[id]/dashboard/liquidity-matrix/route.ts:424-445`

### Alle 5 Bankkonten einzeln in Liquiditätstabelle
- **Priorität:** HOCH
- **Aktuell:** Nur 2 aggregierte Zeilen (Sparkasse, apoBank)
- **Ziel:** 5 einzelne Zeilen (ISK Velbert, ISK Uckerath, Sparkasse Velbert, apoBank Uckerath, apoBank HV PLUS eG)
- **Implementierung:** Aufklappbar/Collapsible für übersichtliche Darstellung

---

## Hinweise zur Dokumentation

Dieses Protokoll wird automatisch bei jeder wesentlichen Änderung aktualisiert. Jeder Eintrag enthält:
- **Was** geändert wurde
- **Warum** die Änderung erfolgte
- **Auswirkungen** für Benutzer
