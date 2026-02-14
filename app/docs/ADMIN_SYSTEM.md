# Admin-System: Vollständige Dokumentation

**Inso-Liquiplanung** – Liquiditätsplanungs-Software für Insolvenzverwalter

> Diese Dokumentation beschreibt das gesamte Admin-Dashboard, die Datenmodelle und deren Zusammenhänge.

---

## Inhaltsverzeichnis

1. [Systemübersicht](#1-systemübersicht)
2. [Kunden (CustomerUser)](#2-kunden-customeruser)
3. [Fälle (Cases)](#3-fälle-cases)
4. [Case Admin Dashboard](#4-case-admin-dashboard)
   - [4.1 Bearbeiten](#41-bearbeiten)
   - [~~4.2 Konfiguration~~](#42-konfiguration) *(entfernt v2.47.0)*
   - [4.3 Datenimport](#43-datenimport)
   - [~~4.4 Dashboard~~](#44-dashboard) *(entfernt v2.47.0)*
   - [4.5 Berechnungsannahmen](#45-berechnungsannahmen)
   - [4.6 Insolvenzeffekte](#46-insolvenzeffekte)
   - [4.7 Bankenspiegel](#47-bankenspiegel)
   - [4.7b Banken & Sicherungsrechte](#47b-banken--sicherungsrechte)
   - [4.7c IST-Kontobewegungen](#47c-ist-kontobewegungen)
   - [4.7d Zahlungsverifikation (SOLL/IST)](#47d-zahlungsverifikation-sollist)
   - [4.8 Zahlungsregister (Ledger)](#48-zahlungsregister-ledger)
   - [4.9 Steuerungsdimensionen](#49-steuerungsdimensionen-ledgerentry)
   - [4.10 Planungsart (Horizont)](#410-planungsart-horizont)
   - [4.11 Externe Ansicht](#411-externe-ansicht)
   - [4.12 Freigaben (Orders)](#412-freigaben-orders)
   - [4.13 Freigaben – Kundenzugänge & Externe Links](#413-freigaben--kundenzugänge--externe-links-v2280)
   - [4.14 Prognose (Forecast)](#414-prognose-forecast)
   - [4.15 Sammelüberweisungs-Splitting](#415-sammelüberweisungs-splitting)
   - [4.16 Personal (Mitarbeiter)](#416-personal-mitarbeiter-v2390)
   - [4.17 Kontakte (Ansprechpartner)](#417-kontakte-ansprechpartner-v2390)
   - [4.18 Geschäftskonten-Analyse](#418-geschäftskonten-analyse-v2410)
   - [4.19 Performance / Ergebnisrechnung](#419-performance--ergebnisrechnung-v2560)
   - [4.20 Datenqualitäts-Checks](#420-datenqualitäts-checks-v2420)
   - [4.21 System Health Panel](#421-system-health-panel-v2460)
5. [Datenmodell-Diagramm](#5-datenmodell-diagramm)
6. [Datenfluss: Import bis Anzeige](#6-datenfluss-import-bis-anzeige)

---

## 1. Systemübersicht

### Akteure und Rollen

| Akteur | Beschreibung | Zugang |
|--------|--------------|--------|
| **Admin** (Wir) | Interne Berater, die das System betreiben | `/admin/*` |
| **Kunde** (CustomerUser) | Insolvenzverwalter, unsere Mandanten | `/portal/*` |
| **Extern** | Dritte mit temporärem Lesezugriff | `/view/[token]` |

### Datenmodell-Hierarchie

```
CustomerUser (Insolvenzverwalter)
    ↓ owns
Case (Insolvenzverfahren)
    ↓ has
    ├── LiquidityPlan (Liquiditätsplan)
    │       ↓ contains
    │       ├── CashflowCategory (Einzahlungen/Auszahlungen)
    │       │       ↓ contains
    │       │       └── CashflowLine (Position)
    │       │               ↓ contains
    │       │               └── PeriodValue (Wochenwerte) ← DERIVED CACHE
    │       ├── PlanningAssumption (Berechnungsannahmen, Case-Level)
    │       └── InsolvencyEffect (Insolvenzeffekte)
    │
    ├── LedgerEntry (Zahlungsregister) ← SINGLE SOURCE OF TRUTH
    ├── BankAccount (Bankenspiegel)
    ├── IngestionJob (Import-Vorgänge)
    ├── ShareLink (Externe Links)
    ├── Order (Bestell-/Zahlfreigaben)
    │       ↓ has (bei Chain-Modus)
    │       └── ApprovalStep (Revisionssichere Freigabe-Schritte)
    ├── ApprovalRule (Freigabestufen-Definition) ← NEU v2.58.0
    ├── CompanyToken (Externe Zugangs-Tokens)
    ├── CaseConfiguration (Dashboard-Konfiguration) ← LEGACY, keine UI seit v2.47.0
    ├── Employee (Mitarbeiter) ← NEU v2.39.0
    │       ↓ has
    │       └── EmployeeSalaryMonth (Monatliche Gehaltsdaten)
    └── CaseContact (Ansprechpartner) ← NEU v2.39.0
```

---

## 2. Kunden (CustomerUser)

**Pfad:** `/admin/customers`

### Was wird erfasst?

| Feld | Pflicht | Beschreibung | Warum? |
|------|---------|--------------|--------|
| `name` | ✅ | Vollständiger Name | Identifikation im System |
| `email` | ✅ | E-Mail-Adresse (unique) | Login-Kennung fürs Kundenportal |
| `slug` | ❌ | Subdomain-Slug (unique) | Individuelle URL: `slug.cases.gradify.de` |
| `company` | ❌ | Kanzlei/Firmenname | Branding in Berichten |
| `phone` | ❌ | Telefonnummer | Kontaktaufnahme |
| `passwordHash` | Auto | Verschlüsseltes Passwort | Authentifizierung |
| `isActive` | Auto | Aktivstatus | Zugriffskontrolle |

### Warum diese Datenaufnahme?

1. **Login-System:** Kunden loggen sich mit E-Mail/Passwort ins Kundenportal ein
2. **Fallzuordnung:** Jeder Fall hat genau einen Eigentümer (Owner)
3. **Audit-Trail:** Wer hat wann welchen Fall eingesehen?
4. **Branding:** Firmenname kann in PDFs erscheinen

### Funktionen im Admin

| Aktion | Beschreibung |
|--------|--------------|
| **Neu anlegen** | Erstellt Kunde + generiert temporäres Passwort |
| **Passwort zurücksetzen** | Generiert neues temporäres Passwort |
| **Deaktivieren** | Widerruft alle Zugriffsrechte |
| **Aktivieren** | Stellt Zugriff wieder her |
| **Löschen** | Permanentes Löschen (mit LÖSCHEN-Bestätigung) |

### Datenmodell

```prisma
model CustomerUser {
  id                String    @id @default(uuid())
  email             String    @unique
  slug              String?   @unique  // "anchor" → anchor.cases.gradify.de
  passwordHash      String
  name              String
  company           String?
  phone             String?
  isActive          Boolean   @default(true)
  lastLoginAt       DateTime?
  loginCount        Int       @default(0)

  ownedCases        Case[]    @relation("OwnedCases")
  caseAccess        CustomerCaseAccess[]
  sessions          CustomerSession[]
  auditLogs         CustomerAuditLog[]
}
```

---

## 3. Fälle (Cases)

**Pfad:** `/admin/cases`

### Was wird bei einem neuen Fall erfasst?

| Feld | Pflicht | Beschreibung | Warum? |
|------|---------|--------------|--------|
| `caseNumber` | ✅ | Aktenzeichen (unique) | Eindeutige Identifikation beim Gericht |
| `debtorName` | ✅ | Name des Schuldners | Hauptidentifikator des Falls |
| `courtName` | ✅ | Zuständiges Gericht | Rechtliche Zuordnung |
| `filingDate` | ✅ | Antragsdatum | Stichtag für Berechnungen |
| `openingDate` | ❌ | Eröffnungsdatum | Unterscheidung vorläufig/eröffnet |
| `ownerId` | ✅ | Zugeordneter Kunde | Eigentümer des Falls |
| `status` | Auto | PRELIMINARY/OPENED/CLOSED | Verfahrensphase |

### Warum diese Felder?

1. **Aktenzeichen:** Standardisierte Identifikation (z.B. "123 IN 456/26")
2. **Schuldnername:** Primäre Bezeichnung in allen Ansichten
3. **Gericht:** Rechtliche Zuordnung, wichtig für Berichte
4. **Antragsdatum:** Stichtag für 13-Wochen-Planung
5. **Eröffnungsdatum:** Trennung Altmasse/Neumasse
6. **Status:**
   - `PRELIMINARY`: Vorläufige Insolvenzverwaltung
   - `OPENED`: Verfahren eröffnet
   - `CLOSED`: Verfahren abgeschlossen

### Automatisch erstellte Relationen

Bei Erstellung eines Falls wird automatisch erstellt:
- **LiquidityPlan** mit 13 Wochen ab Antragsdatum
- **LiquidityPlanVersion** v1 mit Eröffnungssaldo 0

### Datenmodell

```prisma
model Case {
  id          String    @id @default(uuid())
  ownerId     String
  caseNumber  String    @unique
  debtorName  String
  courtName   String
  openingDate DateTime?
  filingDate  DateTime
  status      String    @default("PRELIMINARY")

  owner               CustomerUser          @relation("OwnedCases")
  plans               LiquidityPlan[]
  ledgerEntries       LedgerEntry[]
  bankAccounts        BankAccount[]
  ingestionJobs       IngestionJob[]
  shareLinks          ShareLink[]
  configurations      CaseConfiguration[]
  customerAccess      CustomerCaseAccess[]
}
```

---

## 4. Case Admin Dashboard

**Pfad:** `/admin/cases/[id]`

Das Dashboard zeigt alle Funktionen für einen Fall:

```
┌─────────────────────────────────────────────────────────────┐
│  DATEN: [Zahlungsregister] [Import] [Bestellfreigaben]      │
│  STAMMDATEN: [Bankkonten] [Gegenparteien] [Standorte]      │
│  VERFAHREN: [Insolvenzeffekte] [Banken & Sicherungsrechte] │
│  ZUGANG: [Freigaben] [Externe Ansicht]                     │
└─────────────────────────────────────────────────────────────┘
```

---

### 4.1 Bearbeiten

**Pfad:** `/admin/cases/[id]/edit`

#### Funktion
Änderung der Stammdaten eines Falls.

#### Editierbare Felder
- Aktenzeichen (Validierung: unique)
- Schuldnername
- Gericht
- Antragsdatum
- Eröffnungsdatum
- Status

#### Datenmodell-Wirkung
```
PUT /api/cases/[id]
→ Case.caseNumber, debtorName, courtName, filingDate, openingDate, status
```

---

### ~~4.2 Konfiguration~~ ENTFERNT (v2.47.0)

**Ehemaliger Pfad:** `/admin/cases/[id]/config`

> **Gelöscht in v2.47.0 (ADR-060).** Die Config-Seite steuerte die Präsentation des alten `ConfigurableDashboard`, das seit v2.29.0 durch `UnifiedCaseDashboard` ersetzt ist. Seite, API-Route (`/api/cases/[id]/config`) und alle zugehörigen Komponenten wurden entfernt.

---

### 4.3 Datenimport

**Pfad:** `/admin/cases/[id]/ingestion`

#### Funktion
Import von Cashflow-Daten aus CSV/Excel in den Fall.

#### Import-Flow im Detail

```
┌──────────────────────────────────────────────────────────────────┐
│                         IMPORT-PIPELINE                          │
└──────────────────────────────────────────────────────────────────┘

1. UPLOAD
   ├── Datei hochladen (CSV/Excel)
   ├── SHA-256 Hash berechnen
   └── IngestionJob mit Status: CREATED

2. PARSING
   ├── Zeilen einlesen → IngestionRecord
   ├── Rohwerte in JSON speichern (rawData)
   └── Status: STAGING

3. MAPPING
   ├── Benutzer wählt Mapping (Spalte → Feld)
   ├── Kategorie-Zuordnung (flowType, estateType)
   └── Status: MAPPED

4. NORMALISIERUNG
   ├── Datumsformat konvertieren
   ├── Beträge in Cents umrechnen
   ├── StagedCashflowEntry erstellen
   └── Status: READY oder REVIEW

5. REVIEW (optional)
   ├── Einträge mit niedriger Confidence prüfen
   ├── Manuelle Korrekturen
   └── Status: REVIEWED

6. COMMIT
   ├── LedgerEntry erstellen (Single Source of Truth)
   ├── PeriodValue erstellen/aktualisieren (Cache)
   ├── Kategorien/Lines bei Bedarf anlegen
   └── Status: COMMITTED
```

#### Status-Übersicht

| Status | Bedeutung | Nächste Aktion |
|--------|-----------|----------------|
| CREATED | Job angelegt | Parsing starten |
| STAGING | Zeilen eingelesen | Mapping definieren |
| MAPPED | Spalten zugeordnet | Normalisieren |
| READY | Bereit zum Import | Commit |
| REVIEW | Manuelle Prüfung nötig | Review |
| COMMITTED | Erfolgreich übernommen | Fertig |
| QUARANTINED | Probleme erkannt | Untersuchen |
| REJECTED | Abgelehnt | - |

#### Datenmodell-Kette

```
IngestionJob (1)
    ↓
IngestionRecord (n) - Rohzeilen
    ↓
StagedCashflowEntry (n) - Normalisierte Einträge
    ↓ [COMMIT]
LedgerEntry (n) - Transaction-Level Wahrheit
    ↓ [AGGREGATION]
PeriodValue (n) - Aggregierte Wochenwerte (Cache)
```

#### Was beim Commit passiert

```typescript
// Für jeden StagedCashflowEntry:

// 1. LedgerEntry erstellen (an Case gebunden)
await tx.ledgerEntry.create({
  caseId: job.caseId,
  transactionDate: entry.originalDate || calculateFromPeriodIndex(),
  amountCents: flowType === 'OUTFLOW' ? -amount : amount,
  description: entry.lineName,
  valueType: entry.valueType,  // IST oder PLAN
  legalBucket: 'UNKNOWN',
  importSource: `${job.fileName} (Zeile ${entry.rowNumber})`,
  importJobId: job.id,
  // ... weitere Audit-Felder
});

// 2. PeriodValue erstellen/aktualisieren (Cache für Dashboard)
await tx.periodValue.upsert({
  lineId: line.id,
  periodIndex: entry.periodIndex,
  valueType: entry.valueType,
  amountCents: entry.amountCents,
});
```

---

### 4.4 Dashboard

**Pfad:** `/admin/cases/[id]/dashboard`

Zeigt das `UnifiedCaseDashboard` mit `accessMode="admin"` – identisch mit der Kundenansicht. Nutzt LedgerEntry-Aggregation über `/api/cases/[id]/dashboard`.

> **Historie:** In v2.47.0 (ADR-060) wurde das alte `ConfigurableDashboard` gelöscht. In v2.51.0 wurde `/dashboard` als neue Route wiederhergestellt (vorher unter `/results`). `/results` leitet per Redirect auf `/dashboard` weiter.
>
> Zugehörige Legacy API-Routen gelöscht: `plan/categories`, `plan/lines`, `plan/values`, `plan/opening-balance`.

---

### 4.5 Berechnungsannahmen

**Pfad:** `/admin/cases/[id]/assumptions`
**Version:** v2.45.0 (vorher: "Prämissen")

#### Funktion
3-Block-Architektur für Berechnungsgrundlagen (ADR-058):

**Block 1 – Datenqualität (auto, read-only)**
Live-Kennzahlen direkt aus der DB. Nie manuell editierbar.

| Kennzahl | Beschreibung |
|----------|--------------|
| IST-Entries | Anzahl + Confirmed-Prozent |
| PLAN-Entries | Anzahl + abgedeckte Monate |
| Estate-Breakdown | ALTMASSE / NEUMASSE / MIXED / UNKLAR |
| Bankkonten | Anzahl aktiver Konten |
| Gegenpartei-Abdeckung | Prozent mit zugeordneter Counterparty |

**Block 2 – Planungsannahmen (Case-Level Dokumentation)**

| Feld | Beschreibung | Beispiel |
|------|--------------|----------|
| `title` | Freier Titel der Annahme | "Fortführung aller Praxen bis Q1/2026" |
| `source` | Datenquelle/Beleg | "IV-Gespräch 09.02.2026" |
| `description` | Ausführliche Beschreibung | "Massekredit Sparkasse sichert Liquidität" |
| `status` | Belastbarkeit | ANNAHME, VERIFIZIERT, WIDERLEGT |
| `linkedModule` | Link zu Stammdaten-Modul | "banken", "personal", "business-logic" |

**Block 3 – Prognose-Annahmen (read-only, aus Forecast)**
ForecastAssumptions gruppiert nach INFLOW/OUTFLOW mit Methodik und Risiko.

| Feld | Beschreibung |
|------|--------------|
| `method` | Herleitung des Betrags |
| `baseReferencePeriod` | Referenzzeitraum (z.B. "IST Dez 2025 – Jan 2026") |
| `riskProbability` | Abweichungswahrscheinlichkeit (0.0–1.0) |
| `riskImpactCents` | EUR-Auswirkung bei Eintritt |
| `riskComment` | Qualitative Risikobegründung |

#### Datenmodell

```prisma
model PlanningAssumption {
  id             String    @id @default(uuid())
  caseId         String    // Case-Level (nicht Plan-Level!)
  planId         String?   // Legacy, optional
  title          String    // Freier Titel
  source         String
  description    String
  status         String    @default("ANNAHME") // ANNAHME | VERIFIZIERT | WIDERLEGT
  linkedModule   String?   // "banken", "personal", "business-logic"
  linkedEntityId String?
  lastReviewedAt DateTime?

  case Case @relation(...)
  @@index([caseId])
}
```

#### API-Endpoints

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/cases/[id]/data-quality` | GET | Block 1: Live-Metriken |
| `/api/cases/[id]/plan/assumptions` | GET/POST/DELETE | Block 2: CRUD |
| `/api/cases/[id]/forecast/assumptions` | GET | Block 3: Read-only |

---

### 4.6 Insolvenzeffekte

**Pfad:** `/admin/cases/[id]/insolvency-effects`

#### Funktion
Erfassung insolvenzspezifischer Zahlungseffekte, getrennt vom operativen Cashflow.

#### Typische Effekte

| Effekt | Typ | Beispiel |
|--------|-----|----------|
| Anfechtung SV-Beiträge | INFLOW | +50.000 € in KW 5 |
| Anfechtung Lieferanten | INFLOW | +120.000 € in KW 8 |
| Halteprämien | OUTFLOW | -25.000 € in KW 3 |
| Verfahrenskosten | OUTFLOW | -15.000 € in KW 1-13 |
| Rechtsanwaltskosten | OUTFLOW | -8.000 € in KW 4 |

#### Warum separate Erfassung?
1. **Transparenz:** "Cashflow vor/nach Insolvenzeffekten"
2. **Vergleichbarkeit:** Operatives Geschäft isoliert betrachten
3. **Verfahrenskosten:** Separate Gruppe für Gerichts- und Verwaltungskosten
4. **W&P-Standard:** Branchenübliche Darstellung

#### Datenmodell

```prisma
model InsolvencyEffect {
  id            String   @id @default(uuid())
  planId        String
  name          String      // "Anfechtung SV-Beiträge"
  description   String?
  effectType    String      // INFLOW, OUTFLOW
  effectGroup   String      // GENERAL, PROCEDURE_COST
  periodIndex   Int         // 0-12
  amountCents   BigInt
  isActive      Boolean

  plan LiquidityPlan @relation(...)
}
```

---

### 4.7 Bankenspiegel

**Pfad:** `/admin/cases/[id]/bank-accounts`

#### Funktion
Übersicht aller Bankkonten des Schuldners nach W&P-Standard.

#### Erfasste Daten

| Feld | Beschreibung |
|------|--------------|
| `bankName` | Name der Bank (z.B. "Sparkasse") |
| `accountName` | Kontobezeichnung (z.B. "Geschäftskonto") |
| `iban` | IBAN |
| `balanceCents` | Gesamtguthaben |
| `availableCents` | Verfügbare liquide Mittel |
| `securityHolder` | Sicherungsrechte (z.B. "Globalzession Bank XY") |
| `status` | available, blocked, restricted |
| `notes` | Anmerkungen |

#### Warum?
- **Eröffnungssaldo:** Summe = Anfangsliquidität
- **Verfügbarkeit:** Nicht alle Mittel sind frei verfügbar
- **Sicherheiten:** Absonderungsrechte dokumentieren
- **Vollständigkeit:** Alle Konten des Schuldners erfassen

#### Datenmodell

```prisma
model BankAccount {
  id                  String   @id @default(uuid())
  caseId              String
  bankName            String
  accountName         String
  iban                String?
  balanceCents        BigInt
  availableCents      BigInt
  securityHolder      String?
  accountType         String   @default("GESCHAEFT")  // ISK | GESCHAEFT (v2.52.0)
  isLiquidityRelevant Boolean  @default(false)
  status              String   // available, blocked, restricted
  notes               String?

  case Case @relation(...)
}
```

---

### 4.7b Banken & Sicherungsrechte

**Pfad:** `/admin/cases/[id]/banken-sicherungsrechte`

#### Funktion
Zusammengefasste Ansicht aller Bankkonten, Sicherungsvereinbarungen und Massekredit-Berechnungen. Ersetzt die alten Tabs „Sicherungsrechte" und „Kreditlinien" (ADR-036).

#### Drei-Ebenen-Trennung
- **Liquidität** (Matrix) = Cashflows und Periodenbalances
- **Masse** (Masseübersicht) = Alt/Neu-Zuordnung
- **Banken-Sicherung** (dieser Tab) = Kontenstruktur, Vereinbarungen, Massekredit

#### Sektionen

**A) Bankenspiegel**
Tabelle aller Konten mit Typ-Badge (ISK/Gläubigerkonto), Sicherungsnehmer und Status. Keine Saldo-KPIs.

**B) Sicherungsrechte & Vereinbarungen**
Daten aus Massekredit-API (`/api/cases/[id]/massekredit`):
- Globalzession (Ja/Nein)
- Fortführungsbeitrag (Satz + Betrag)
- Status-Badges: VEREINBART (grün), VERHANDLUNG (gelb), OFFEN (rot)
- Unsicherheits-Hinweise bei `isUncertain=true`

**C) Massekredit-Status**
Pro-Bank-Berechnungskarten:
- Altforderungen brutto → Fortführungsbeitrag → USt → Massekredit
- Headroom mit Fortschrittsbalken und Ampelfarben (>50% grün, 20-50% gelb, <20% rot)
- UNKLAR-Warning wenn Buchungen ohne Alt/Neu-Zuordnung existieren

#### APIs

| Endpunkt | Zweck |
|----------|-------|
| `GET /api/cases/[id]/bank-accounts` | Kontoliste (inkl. `isLiquidityRelevant`, `securityHolder`) |
| `GET /api/cases/[id]/massekredit` | Massekredit-Berechnung (kann 404 sein wenn keine BankAgreements) |

#### Navigation

- Sidebar: VERFAHREN → „Banken & Sicherungsrechte"
- Alte Routes `/security-rights` und `/finanzierung` redirecten hierher

---

### 4.7c IST-Kontobewegungen

**Pfad:** `/admin/cases/[id]/kontobewegungen`

#### Funktion
Übersicht aller IST-Buchungen (LedgerEntries mit `valueType=IST`) mit drei Gruppierungsansichten.

#### Tab-Toggle

| Tab | Standard | Beschreibung |
|-----|----------|--------------|
| **Nach Kontentyp** | DEFAULT | ISK vs. Gläubigerkonten (via `BankAccount.isLiquidityRelevant`) |
| **Nach Monat** | | Monatliche Aggregation |
| **Nach Standort** | | Gruppierung nach Location |

#### Tab: Nach Kontentyp

Zwei Sektionen:
- **Insolvenz-Sonderkonten (ISK):** Operative Massekonten (`isLiquidityRelevant=true`). Pro Konto: Name, Bank, IBAN, Einzahlungen/Auszahlungen/Netto, expandierbare Transaktionsliste.
- **Gläubigerkonten:** Nicht-ISK-Konten (`isLiquidityRelevant=false`). Gleiche Darstellung.
- **Ohne Bankkonto:** Entries ohne `bankAccountId`-Zuordnung (falls vorhanden).

#### API

| Endpunkt | Zweck |
|----------|-------|
| `GET /api/cases/[id]/kontobewegungen` | IST-Entries mit Gruppierungen (byAccountType, byLocation, byMonth) |

**Response-Struktur:**
```json
{
  "summary": { "totalCount", "totalInflows", "totalOutflows", "netAmount" },
  "byAccountType": {
    "isk": [{ "accountId", "accountName", "bankName", "iban", "inflows", "outflows", "entries" }],
    "glaeubigerkonten": [...],
    "ohneBankkonto": { ... } | null,
    "iskTotal": { "inflows", "outflows", "count" },
    "glaeubigerTotal": { "inflows", "outflows", "count" }
  },
  "byLocation": [...],
  "byMonth": [...]
}
```

---

### 4.7d Zahlungsverifikation (SOLL/IST)

**Pfad:** `/admin/cases/[id]/zahlungsverifikation`

#### Funktion
Vergleicht PLAN-Werte (aus PeriodValues über CashflowCategories) mit IST-Werten (aus LedgerEntries) pro Planungsperiode.

#### Voraussetzung
Aktiver LiquidityPlan muss existieren. Ohne Plan zeigt die Seite einen Hinweis.

#### Zusammenfassung (3 Kacheln)
- **PLAN gesamt:** Summe aller PLAN-Nettowerte über alle Perioden
- **IST gesamt:** Summe aller IST-Nettowerte über alle Perioden
- **Abweichung:** Differenz mit Ampelfarbe und Prozentangabe

#### Perioden-Tabelle
Pro Periode: PLAN-Netto, IST-Netto, Abweichung (absolut + %), Ampel-Status.

#### Ampelsystem

| Abweichung | Farbe | Status |
|------------|-------|--------|
| < 5% | Grün | Im Plan |
| 5–15% | Gelb | Abweichung |
| > 15% | Rot | Kritisch |

Perioden ohne IST-Daten werden ausgegraut mit „Keine Daten" angezeigt.

#### API

| Endpunkt | Zweck |
|----------|-------|
| `GET /api/cases/[id]/zahlungsverifikation` | PLAN vs. IST pro Periode |

**Response-Struktur:**
```json
{
  "available": true,
  "data": {
    "plan": { "id", "name", "periodType", "periodCount", "planStartDate" },
    "summary": { "totalPlan", "totalIst", "totalDeviation", "totalDeviationPercent", "totalStatus" },
    "periods": [{
      "label", "plan": { "net" }, "ist": { "net" },
      "deviation", "deviationPercent", "status", "hasIstData"
    }]
  }
}
```

**Berechnung:**
- PLAN: PeriodValues aggregiert über CashflowCategories (Inflows positiv, Outflows negiert)
- IST: LedgerEntries nach Periodendatumsbereichen gruppiert (signierte amountCents)
- Perioden: Aus `LiquidityPlan.periodType` + `periodCount` + `planStartDate` berechnet

---

### 4.8 Zahlungsregister (Ledger)

**Pfad:** `/admin/cases/[id]/ledger`

#### Funktion
Transaktionsbasiertes Zahlungsregister – die **Single Source of Truth** für alle Cashflows.

#### Konzept

```
┌────────────────────────────────────────────────────────────────┐
│  LedgerEntry = Einzelne Zahlung (Transaction-Level)            │
│  PeriodValue = Aggregierte Wochenwerte (Derived Cache)         │
└────────────────────────────────────────────────────────────────┘

Wichtig:
- LedgerEntry ist am CASE gebunden (nicht am Plan!)
- Cash-Wahrheit bleibt bestehen, auch wenn Pläne wechseln
- PeriodValue kann jederzeit aus LedgerEntries neu berechnet werden
```

#### Erfasste Daten pro LedgerEntry

| Feld | Beschreibung |
|------|--------------|
| `transactionDate` | Original-Zahlungsdatum |
| `amountCents` | Betrag (+ = Einzahlung, - = Auszahlung) |
| `description` | Beschreibung |
| `valueType` | IST oder PLAN |
| `legalBucket` | MASSE, ABSONDERUNG, NEUTRAL, UNKNOWN |
| `importSource` | Herkunft (z.B. "OP-Liste vom 05.01.2026") |
| `bookingSource` | BANK_ACCOUNT, CASH_REGISTER, ERP, MANUAL |

#### Filteroptionen

- Nach Werttyp (IST/PLAN)
- Nach Rechtsstatus (Masse/Absonderung/etc.)
- Nach Zeitraum (von/bis)
- Nach Buchungsquelle

#### Statistiken

- Anzahl Einträge (gesamt, IST, PLAN)
- Summen (Einzahlungen, Auszahlungen, Netto)

#### Warum dieses Design?

1. **Audit-Trail:** Jede einzelne Zahlung nachvollziehbar
2. **Drill-Down:** Von Wochensumme zu Einzeltransaktionen
3. **Flexibilität:** Pläne können wechseln, Daten bleiben
4. **Rebuild:** PeriodValues jederzeit neu berechenbar

#### Datenmodell

```prisma
model LedgerEntry {
  id                String   @id @default(uuid())
  caseId            String   // An Case, nicht Plan!

  // Kern
  transactionDate   DateTime
  amountCents       BigInt   // + = Einzahlung, - = Auszahlung
  description       String
  valueType         String   // IST, PLAN

  // Rechtsstatus
  legalBucket       String   // MASSE, ABSONDERUNG, NEUTRAL, UNKNOWN

  // Import-Herkunft (Audit)
  importSource      String?
  importJobId       String?
  importFileHash    String?
  importRowNumber   Int?

  // Buchungsquelle (fachlich)
  bookingSource     String?  // BANK_ACCOUNT, CASH_REGISTER, ERP, MANUAL
  bookingSourceId   String?  // z.B. IBAN
  bookingReference  String?  // Rechnungsnummer

  case Case @relation(...)
}
```

---

### 4.9 Steuerungsdimensionen (LedgerEntry)

**Erweiterte Kategorisierung von Buchungen**

#### Was sind Steuerungsdimensionen?

Steuerungsdimensionen ermöglichen es, jeden LedgerEntry zusätzlich zu seiner Kategorie nach weiteren Kriterien zu klassifizieren. Dies erlaubt detaillierte Auswertungen nach:

| Dimension | Modell | Beispiel | Nutzen |
|-----------|--------|----------|--------|
| **Bankkonto** | `BankAccount` | "Sparkasse Geschäftskonto DE89..." | Liquidität pro Konto verfolgen |
| **Gegenpartei** | `Counterparty` | "HAEVG Rechenzentrum" | Top-Zahler identifizieren |
| **Standort** | `Location` | "Praxis Uckerath" | Kosten pro Betriebsstätte |
| **Freitext-Tag** | `steeringTag` | "Projekt-A" | Flexible Zusatzkategorisierung |

#### Felder am LedgerEntry

```prisma
model LedgerEntry {
  // ... Kernfelder ...

  // Steuerungsdimensionen (alle optional)
  bankAccountId   String?       // FK zu BankAccount
  counterpartyId  String?       // FK zu Counterparty
  locationId      String?       // FK zu Location
  steeringTag     String?       // Freies Textfeld für flexible Tags

  // Relationen
  bankAccount     BankAccount?  @relation(...)
  counterparty    Counterparty? @relation(...)
  location        Location?     @relation(...)
}
```

#### Wann werden Steuerungsdimensionen gesetzt?

1. **Beim Import:** Bankkonto optional vorauswählbar
2. **Im Review:** Manuell pro Eintrag zuweisbar
3. **Per Klassifikationsregel:** Automatisch basierend auf Mustern
4. **Per CategoryTag-Vorschlag:** `suggestCategoryTags()` matched Entries über COUNTERPARTY_ID, COUNTERPARTY_PATTERN oder DESCRIPTION_PATTERN gegen matrix-config Zeilen (ADR-049)

#### Beispiel: Auswertung nach Gegenpartei

```
Gegenpartei         | Einzahlungen (IST) | % Anteil
--------------------|--------------------|---------
HAEVG Rechenzentrum | 125.000 EUR        | 42%
KV Nordrhein        |  85.000 EUR        | 28%
PVS rhein-ruhr      |  45.000 EUR        | 15%
Andere              |  45.000 EUR        | 15%
```

#### Stammdatenpflege

- **Bankkonten:** `/admin/cases/[id]/bank-accounts`
- **Gegenparteien:** `/admin/cases/[id]/counterparties` (Einnahmen-Partner: KV, HZV, PVS)
- **Kreditoren:** `/admin/cases/[id]/creditors` (Ausgaben-Partner: Lieferanten, Dienstleister, Behörden)
- **Kostenarten:** `/admin/cases/[id]/cost-categories` (Budget, categoryTag-Mapping)
- **Standorte:** `/admin/cases/[id]/locations`

---

### 4.10 Planungsart (Horizont)

**Pfad:** `/admin/cases/[id]/edit` → Abschnitt "Planeinstellungen"

#### Was ist die Planungsart?

Die Planungsart definiert den **zeitlichen Horizont** und die **Granularität** des Liquiditätsplans:

| Einstellung | Optionen | Standard | Auswirkung |
|-------------|----------|----------|------------|
| **periodType** | WEEKLY, MONTHLY | WEEKLY | Periodenlänge |
| **periodCount** | 1-52 | 13 | Anzahl Perioden |
| **planStartDate** | Datum | Antragsdatum | Beginn des Plans |

#### Industriestandard: 13-Wochen-Plan

Der **13-Wochen-Liquiditätsplan** ist der Industriestandard in der deutschen Insolvenzpraxis:

- **Wöchentliche Granularität:** Jede Woche separat ausgewiesen
- **3-Monats-Horizont:** ~13 Wochen = 1 Quartal
- **Rollierend:** Wird wöchentlich fortgeschrieben

#### Alternative: Monatsplanung

Für längerfristige Szenarien (z.B. Sanierungspläne):

- periodType = MONTHLY
- periodCount = 12 (1 Jahr) oder 24 (2 Jahre)

#### Wo wird die Planungsart angezeigt?

- **Case-Übersicht:** Zeigt "13 Wochen" oder "12 Monate"
- **Dashboard:** Spaltenanzahl entspricht periodCount
- **PDF-Export:** Überschrift enthält Planungshorizont

---

### 4.11 Externe Ansicht

**Pfad:** `/view/[token]`

#### Funktion
Read-only Zugriff für Dritte (Gläubigerausschuss, Gericht, etc.)

#### Share-Link erstellen

1. Fall öffnen → "Share-Links verwalten"
2. Bezeichnung eingeben (z.B. "Gläubigerausschuss 01/2026")
3. Optional: Ablaufdatum setzen
4. Link generieren → Token-basierte URL

#### Funktionen der externen Ansicht

- Dashboard-Übersicht (read-only)
- PDF-Export
- Keine Bearbeitungsmöglichkeiten

#### Zugriffskontrolle

| Feld | Beschreibung |
|------|--------------|
| `token` | Zufälliger Zugriffsschlüssel (in URL) |
| `label` | Beschreibung des Links |
| `expiresAt` | Optional: Ablaufdatum |
| `isActive` | Aktiv/Deaktiviert |
| `accessCount` | Wie oft aufgerufen |
| `lastAccessAt` | Letzter Zugriff |

#### Datenmodell

```prisma
model ShareLink {
  id           String    @id @default(uuid())
  caseId       String
  token        String    @unique
  label        String
  expiresAt    DateTime?
  isActive     Boolean   @default(true)
  accessCount  Int       @default(0)
  lastAccessAt DateTime?

  case Case @relation(...)
}
```

---

### 4.12 Freigaben (Orders)

**Pfad:** `/admin/cases/[id]/orders`

#### Funktion
Bestell- und Zahlfreigabe für laufende Insolvenzverfahren. Externes Personal (Buchhaltung, Unternehmen) reicht Anfragen ein, IV prüft und genehmigt/lehnt ab.

#### Zwei Freigabetypen

| Typ | Zeitpunkt | Beleg | Ergebnis bei Genehmigung |
|-----|-----------|-------|--------------------------|
| **BESTELLUNG** | Vor dem Kauf | Angebot/KVA (optional) | PLAN-LedgerEntry (erwartete Auszahlung) |
| **ZAHLUNG** | Rechnung liegt vor | Rechnung (empfohlen) | PLAN-LedgerEntry (freigegebene Zahlung) |

#### Workflow

```
Buchhaltung/Unternehmen          System              IV (Insolvenzverwalter)
        |                           |                        |
        |-- /submit/[token] ------->|                        |
        |   Anfrage + Beleg         |                        |
        |                           |-- Badge (Zähler) ----->|
        |                           |                        |
        |                           |<-- Prüft Beleg --------|
        |                           |<-- Genehmigt/Ablehnt --|
        |                           |                        |
        |                           |-- PLAN LedgerEntry --->|
        |                           |   (Liquiditätsplanung) |
```

#### Datenmodell

```prisma
model Order {
  id                  String    @id @default(uuid())
  caseId              String
  type                String    @default("ZAHLUNG")  // BESTELLUNG | ZAHLUNG
  requestDate         DateTime  @default(now())
  invoiceDate         DateTime
  amountCents         BigInt
  creditor            String    // Freitext-Fallback (immer gesetzt)
  creditorId          String?   // FK auf Creditor-Stammdaten (optional)
  costCategoryId      String?   // FK auf Kostenart (optional)
  description         String
  notes               String?
  documentName        String?
  documentMimeType    String?
  documentSizeBytes   BigInt?
  documentContent     String?   // Base64-encoded
  status              String    @default("PENDING")  // PENDING | APPROVED | REJECTED | AUTO_APPROVED
  approvedAmountCents BigInt?   // Wenn IV anderen Betrag genehmigt
  approvedAt          DateTime?
  approvedBy          String?
  rejectedAt          DateTime?
  rejectionReason     String?
  ledgerEntryId       String?   @unique
  createdAt           DateTime  @default(now())

  case         Case          @relation(...)
  ledgerEntry  LedgerEntry?  @relation(...)
  creditorRef  Creditor?     @relation(..., onDelete: SetNull)
  costCategory CostCategory? @relation(..., onDelete: SetNull)
  @@index([caseId])
  @@index([caseId, status])
}

model CompanyToken {
  id          String   @id @default(uuid())
  caseId      String
  token       String   @unique
  label       String
  notifyEmail String?  // Email für Rückmeldungen (Digest, Ablehnungen)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  case   Case    @relation(...)
  orders Order[] // Eingereichte Orders über diesen Token
  @@index([caseId])
}
```

#### UI-Komponenten

| Komponente | Pfad | Funktion |
|------------|------|----------|
| **OrderList** | `admin/cases/[id]/orders/OrderList.tsx` | Freigabeliste mit Filter (Typ) und Sort (Datum/Betrag/Gläubiger) |
| **ApprovalModal** | `admin/cases/[id]/orders/ApprovalModal.tsx` | Genehmigung mit optionalem abweichendem Betrag |
| **RejectionModal** | `admin/cases/[id]/orders/RejectionModal.tsx` | Ablehnung mit Pflicht-Begründung |
| **CompanyTokenManager** | `admin/cases/[id]/orders/CompanyTokenManager.tsx` | Token erstellen/deaktivieren, Email hinterlegen |
| **OrderSubmissionForm** | `submit/[token]/OrderSubmissionForm.tsx` | Externes Einreichungsformular |

#### Bei Genehmigung: LedgerEntry-Erstellung

```typescript
// Automatisch erstellter PLAN-LedgerEntry:
{
  valueType: "PLAN",
  legalBucket: "MASSE",
  estateAllocation: "NEUMASSE",
  amountCents: -absAmount,  // Immer negativ (Auszahlung)
  description: `Freigabe: ${order.creditor} – ${order.description}`,
  transactionDate: order.invoiceDate,
  bookingReference: `ORDER-${order.id.slice(0, 8)}`,
  note: `Freigegebene ${typeLabel} ...`,
}
```

#### Mehrstufige Freigabekette (v2.58.0)

Pro Case können Freigabestufen (`ApprovalRule`) konfiguriert werden. Bei Order-Einreichung werden die aktiven Rules als revisionssichere `ApprovalStep`-Snapshots fixiert.

```
ApprovalRule (pro Case konfiguriert)
    ↓ generiert bei Einreichung
ApprovalStep (pro Order, revisionssicher)
    ↓ sequenziell abgearbeitet
Order.status = APPROVED (erst nach letzter Stufe)
```

##### Datenmodell

```prisma
model ApprovalRule {
  id             String   @id @default(uuid())
  caseId         String
  roleName       String   // Freitext: "IV", "Sachwalter", "Investor"
  customerId     String   // FK → CustomerUser (wer muss freigeben)
  thresholdCents BigInt   // Ab welchem Betrag greift diese Stufe
  sequence       Int      // Reihenfolge: 1, 2, 3...
  isRequired     Boolean  @default(true)
  isActive       Boolean  @default(true)

  @@unique([caseId, sequence])
}

model ApprovalStep {
  id                   String    @id @default(uuid())
  orderId              String
  approvalRuleId       String
  roleNameSnapshot     String    // Snapshot zum Zeitpunkt der Erstellung
  thresholdSnapshot    BigInt
  sequenceSnapshot     Int
  approverNameSnapshot String
  status               String    @default("PENDING") // PENDING | APPROVED | REJECTED | SKIPPED
  decidedAt            DateTime?
  decidedBy            String?
  comment              String?

  @@unique([orderId, approvalRuleId])
}
```

##### Ablauf

| Schritt | Aktion | Status |
|---------|--------|--------|
| 1. Einreichung | `createApprovalSteps()` generiert Steps basierend auf Betrag + aktiven Rules | Steps: PENDING |
| 2. Stufe N genehmigt | `processApproval()` setzt Step auf APPROVED, prüft ob weitere Steps | Order bleibt PENDING |
| 3. Letzte Stufe | Alle required Steps APPROVED → Order = APPROVED + LedgerEntry | Order: APPROVED |
| 4. Ablehnung | `processRejection()` → Step REJECTED, weitere Steps SKIPPED | Order: REJECTED |

##### Sicherheitsprüfungen

- Nur zugewiesener Approver oder Admin kann freigeben
- Inaktive Rules werden mit 409 abgewiesen
- Steps müssen sequenziell abgearbeitet werden (kein Überspringen)
- Chain ist fixiert: Spätere Rule-Änderungen betreffen nur neue Orders

##### Konfiguration

**Pfad:** `/admin/cases/[id]/edit` → Abschnitt "Freigabekette"

- Tabelle mit Stufen: Rolle | Person (Dropdown) | Ab Betrag | Pflicht
- Hinzufügen/Löschen von Stufen
- Validierung: sequence einzigartig, threshold aufsteigend mit sequence

##### API

| Endpoint | Methode | Funktion |
|----------|---------|----------|
| `/api/cases/[id]/approval-rules` | GET | Alle Rules laden |
| `/api/cases/[id]/approval-rules` | POST | Neue Rule erstellen |
| `/api/cases/[id]/approval-rules` | PUT | Rule aktualisieren |
| `/api/cases/[id]/approval-rules` | DELETE | Rule deaktivieren (Soft-Delete) |
| `/api/cases/[id]/orders/[orderId]/steps` | GET | Steps einer Order laden |

##### Backward-Kompatibilität

Cases ohne ApprovalRules nutzen weiterhin den Legacy-Modus (jeder Admin/Customer kann direkt freigeben).

#### Auto-Freigabe (v2.34.0)

Wenn `Case.approvalThresholdCents` gesetzt ist, werden Orders **bis einschließlich** dem Schwellwert automatisch freigegeben:

| Bedingung | Ergebnis |
|-----------|----------|
| `amountCents <= approvalThresholdCents` | Status: `AUTO_APPROVED`, LedgerEntry sofort erstellt |
| `amountCents > approvalThresholdCents` | Status: `PENDING`, manuelle Prüfung erforderlich |
| `approvalThresholdCents = null` | Immer manuell |

**Konfiguration:** `/admin/cases/[id]/edit` → Abschnitt "Freigabe-Einstellungen"

**Technisch:** Atomare `$transaction` erstellt Order + LedgerEntry + bookingReference in einem Schritt. LedgerEntry-Werte: `PLAN, MASSE, NEUMASSE, bookingSource: MANUAL`.

#### Email-Benachrichtigungen (v2.59.0)

Automatische Email-Benachrichtigungen bei Freigabe-Events via Resend.

##### Architektur: Sofort + Digest

| Event | Kanal | Empfänger | Template |
|-------|-------|-----------|----------|
| Neue Einreichung | Sofort | Erster Approver (Chain) / Case-Owner (Legacy) | `newOrderEmail` |
| Chain: Nächste Stufe | Sofort | Nächster Approver | `chainNextStepEmail` |
| Ablehnung | Sofort | Einreicher (`CompanyToken.notifyEmail`) | `orderRejectedEmail` |
| Genehmigung(en) | Digest (30 Min) | Einreicher (`CompanyToken.notifyEmail`) | `approvedDigestEmail` |
| Überfällig (> 3 Tage) | Digest (30 Min) | Zuständiger Approver | `pendingReminderEmail` |

##### Einreicher-Tracking

`Order.companyTokenId` speichert welcher CompanyToken die Order eingereicht hat. Bei Genehmigung/Ablehnung wird gezielt `CompanyToken.notifyEmail` verwendet – kein Broadcast an alle Tokens.

##### Idempotenz

- `Order.approvalDigestSentAt`: Wird nach Digest-Versand gesetzt. Cron-Query: `status IN (APPROVED, AUTO_APPROVED) AND approvalDigestSentAt IS NULL`.
- `Order.reminderSentAt`: Wird nach Reminder-Versand gesetzt. Max. 1 Reminder pro Order.

##### Feature-Flag

`EMAIL_ENABLED=true` (Production) / fehlt (lokal = deaktiviert). Kill-Switch: Variable auf `false` setzen → sofort keine Emails mehr.

##### Dateien

| Datei | Funktion |
|-------|----------|
| `lib/email.ts` | `sendEmail()` mit Feature-Flag + Structured Logging |
| `lib/email-templates.ts` | 5 HTML-Templates (Inline-CSS, Mobile-kompatibel) |
| `api/cron/order-notifications/route.ts` | Cron-Endpunkt (CRON_SECRET-geschützt) |

##### ENV-Variablen

| Variable | Beschreibung |
|----------|-------------|
| `RESEND_API_KEY` | Resend API Key (Domain: updates.gradify.de) |
| `EMAIL_ENABLED` | `true` in Production |
| `CRON_SECRET` | Authentifizierung für Cron-Route |

#### Kreditoren & Kostenarten (v2.34.0)

```prisma
model Creditor {
  id                    String @id
  caseId                String
  name                  String
  shortName             String?
  iban                  String?
  taxId                 String?
  category              String?  // LIEFERANT | DIENSTLEISTER | BEHOERDE | SONSTIGE
  defaultCostCategoryId String?  // FK auf CostCategory
  notes                 String?
  case                  Case @relation(onDelete: Cascade)
}

model CostCategory {
  id           String  @id
  caseId       String
  name         String
  shortName    String?
  budgetCents  BigInt?   // Informatives Monatsbudget
  categoryTag  String?   // Mapping auf Liquiditätsmatrix-Tags
  isActive     Boolean @default(true)
  case         Case @relation(onDelete: Cascade)
  @@unique([caseId, name])
}
```

**Design-Entscheidung:** Creditor ≠ Counterparty (ADR-047). Counterparty = Einnahmen-Partner, Creditor = Ausgaben-Partner.

---

### 4.13 Freigaben – Kundenzugänge & Externe Links (v2.28.0)

**Pfad:** `/admin/cases/[id]/freigaben`

#### Funktion
Kombinierte Verwaltung aller Zugangsarten zu einem Fall in einer einzigen Seite. Ersetzt die getrennten Seiten „Externe Freigaben" und „Kundenzugänge" (ADR-040).

#### Zwei Tabs

| Tab | Inhalt | API |
|-----|--------|-----|
| **Kundenzugänge** | Kunden mit Portal-Zugang zu diesem Fall | `/api/cases/[id]/customers` |
| **Externe Links** | Token-basierte Share-Links (read-only) | `/api/cases/[id]/share-links` |

#### „Fall freigeben"-Flow

**Schritt 1: Kunde auswählen oder anlegen**
- Dropdown mit bestehenden Kunden (die noch keinen Zugriff haben)
- ODER: Inline-Formular für neuen Kunden (Name, E-Mail, Unternehmen, Slug)
- Slug-Live-Validierung mit URL-Preview (`slug.cases.gradify.de`)

**Schritt 2: Einladungstext kopieren**
Nach erfolgreicher Freigabe zeigt Modal kopierbaren Text:
```
Ihre Zugangsdaten für die Liquiditätsplanung:
URL: https://anchor.cases.gradify.de
E-Mail: rieger@anchor-rechtsanwaelte.de
Passwort: xY3k9mP2...
Fall: Hausärztliche Versorgung PLUS eG (70d IN 362/25)
```

- Passwort nur bei neuem Kunden sichtbar
- URL nutzt Subdomain falls Slug vorhanden, sonst Fallback auf `cases.gradify.de/customer-login`

#### Subdomain-Einrichtung pro Kunde

Bei neuem Kunden mit Slug:
1. Slug wird in DB gespeichert (unique)
2. Domain in Vercel freischalten: `cd app && vercel domains add slug.cases.gradify.de`
3. SSL wird automatisch provisioniert
4. Middleware routet Subdomain auf Portal-Pfade

#### Komponente

**`CombinedAccessManager`** (`/components/admin/CombinedAccessManager.tsx`):
- Tabs: Kundenzugänge / Externe Links
- Grant-Flow-Modal mit Inline-Kundenerstellung
- InlineError/InlineSuccess statt `alert()`
- ConfirmDialog statt `confirm()`
- Loading-States bei allen async-Operationen

#### API-Endpunkte

| Endpunkt | Methode | Zweck |
|----------|---------|-------|
| `/api/cases/[id]/customers` | GET | Kunden mit Zugriff auflisten |
| `/api/cases/[id]/customers` | POST | Zugriff vergeben (inkl. Reaktivierung) |
| `/api/cases/[id]/customers?accessId=...` | DELETE | Zugriff widerrufen |
| `/api/customers` | POST | Neuen Kunden anlegen (mit Slug) |
| `/api/customers/check-slug` | GET | Slug-Verfügbarkeit prüfen |

---

### 4.14 Prognose (Forecast)

**Pfad:** `/admin/cases/[id]/forecast`

#### Funktion
Vorwärtsgerichtete Liquiditätsprognose mit Annahmen-Editor. Erzeugt PROGNOSE-Werte für zukünftige Perioden, die automatisch ins Dashboard (Rolling Forecast) einfließen.

#### Konzept

```
IST-Daten (Vergangenheit)     +     Annahmen (Zukunft)
        │                                  │
        └──────── Forecast Engine ─────────┘
                        │
                  Rolling Forecast
              (IST + PROGNOSE kombiniert)
```

#### Szenario-Verwaltung

Ein Fall kann mehrere Szenarien haben (BASE, DOWNSIDE, UPSIDE, CUSTOM). Nur das aktive Szenario fließt ins Dashboard.

| Feld | Beschreibung |
|------|--------------|
| `name` | Szenarioname (z.B. „Basisszenario") |
| `scenarioType` | BASE, DOWNSIDE, UPSIDE, CUSTOM |
| `periodType` | WEEKLY oder MONTHLY (aus LiquidityPlan) |
| `periodCount` | Anzahl Perioden |
| `openingBalanceCents` | Echter Kontostand (IST-Closing der letzten IST-Periode) |
| `reservesTotalCents` | Rückstellungen für Headroom-Berechnung |
| `isLocked` | Sperr-Mechanismus für abgeschlossene Szenarien |

#### Annahmen-Editor

Pro Annahme:

| Feld | Beschreibung | Beispiel |
|------|--------------|----------|
| `categoryKey` | Technischer Schlüssel | `HZV_UCKERATH` |
| `categoryLabel` | Anzeigename | „HZV Uckerath" |
| `flowType` | INFLOW / OUTFLOW | INFLOW |
| `assumptionType` | RUN_RATE, FIXED, ONE_TIME, PERCENTAGE_OF_REVENUE | RUN_RATE |
| `baseAmountCents` | Betrag pro Periode | 1500000 (15.000 EUR) |
| `baseAmountSource` | Quellenangabe (Pflicht) | „Durchschnitt Nov-Jan" |
| `growthFactorPercent` | Wachstum pro Periode | -5.0 (5% Rückgang) |
| `startPeriodIndex` / `endPeriodIndex` | Gültigkeitszeitraum | 3 bis 10 |
| `isActive` | Toggle | true/false |

#### Berechnung (Forecast Engine)

```typescript
// lib/forecast/engine.ts
// Pro Periode: Alle aktiven Annahmen summieren
for (assumption of activeAssumptions) {
  if (period >= start && period <= end) {
    amount = baseAmount * (1 + growthFactor)^(period - start)
    if (seasonal) amount *= seasonalProfile[month]
    periodCashflows[period] += amount
  }
}
// Closing Balance = Opening + Σ Cashflows
// Headroom = Closing + Kreditlinie - Rückstellungen
```

#### Dashboard-Integration

- **RollingForecastChart:** IST (grün) + PROGNOSE (blau gestrichelt) + Headroom-Linie
- **RollingForecastTable:** Jede Periode mit Quelle-Badge (IST/PROGNOSE/PLAN)
- **Portal-Kontext:** Admin-Links („Annahmen bearbeiten") ausgeblendet, nur Text-Badge sichtbar

#### APIs

| Endpunkt | Methode | Zweck |
|----------|---------|-------|
| `/api/cases/[id]/forecast/scenarios` | GET/POST/PUT | Szenarien verwalten |
| `/api/cases/[id]/forecast/assumptions` | GET/POST/PUT/DELETE | Annahmen CRUD |
| `/api/cases/[id]/forecast/calculate` | GET | Berechnung ausführen |

#### Datenmodell

```prisma
model ForecastScenario {
  id                      String    @id @default(uuid())
  caseId                  String
  name                    String
  scenarioType            String    @default("BASE")
  isActive                Boolean   @default(true)
  isLocked                Boolean   @default(false)
  periodType              String    // WEEKLY, MONTHLY
  periodCount             Int
  planStartDate           DateTime
  openingBalanceCents     BigInt
  openingBalanceSource    String
  reservesTotalCents      BigInt    @default(0)

  assumptions ForecastAssumption[]
  @@map("forecast_scenarios")
}

model ForecastAssumption {
  id                    String    @id @default(uuid())
  scenarioId            String
  caseId                String
  categoryKey           String
  categoryLabel         String
  flowType              String    // INFLOW, OUTFLOW
  assumptionType        String    // RUN_RATE, FIXED, ONE_TIME
  baseAmountCents       BigInt
  baseAmountSource      String
  growthFactorPercent   Decimal?
  seasonalProfile       String?   // JSON
  startPeriodIndex      Int
  endPeriodIndex        Int
  isActive              Boolean   @default(true)

  @@map("forecast_assumptions")
}
```

---

### 4.15 Sammelüberweisungs-Splitting

**Konzept:**
Sammelüberweisungen (z.B. eine KV-Quartalszahlung) werden in Einzelposten aufgespalten, um korrekte Alt/Neu-Zuordnungen und Standort-Aggregationen zu ermöglichen.

**Datenmodell:**
- Ein `LedgerEntry` kann über `parentEntryId` auf einen Parent verweisen (Self-Relation).
- Die Relation `splitChildren` zeigt alle Children eines Parents.
- Ein Parent mit mindestens einem Child gilt als „aufgelöst" (Split-Parent).

**Filter-Mechanismus:**
```typescript
// In lib/ledger/types.ts
export const EXCLUDE_SPLIT_PARENTS = {
  splitChildren: { none: {} },
} as const;

// Verwendung in allen Aggregations-Queries:
const entries = await prisma.ledgerEntry.findMany({
  where: { caseId, valueType: 'IST', ...EXCLUDE_SPLIT_PARENTS },
});
```

**Integrierte Dateien (12):**
- `lib/ledger/aggregation.ts` (7 Queries)
- `lib/ledger-aggregation.ts`
- `lib/credit/calculate-massekredit.ts`
- `lib/forecast/load-and-calculate.ts`
- API-Routes: `bank-accounts`, `ist-plan-comparison`, `liquidity-matrix`, `locations`, `kontobewegungen`, `massekredit`

**Schreibschutz:**
- PUT auf Entries mit Children verbietet Änderungen an `amountCents`, `transactionDate`, `bankAccountId`.
- Fehlermeldung: „Erst Aufspaltung rückgängig machen."

**Audit-Actions:** `SPLIT` (Aufgespalten), `UNSPLIT` (Zusammengeführt)

**NICHT gefiltert:** Ledger-Ansicht (zeigt alles), Classification Engine, Audit-Trail, Hash-Berechnung.

**API-Endpunkte (Manuelles Splitting):**

| Endpunkt | Methode | Beschreibung |
|----------|---------|--------------|
| `/ledger/[entryId]/split` | POST | Entry in Einzelposten aufspalten (Body: `children[]` mit Beträgen) |
| `/ledger/[entryId]/unsplit` | POST | Aufspaltung rückgängig machen (Children löschen, Parent reaktivieren) |
| `/ledger/validate-splits` | GET | Konsistenz aller Splits prüfen (Betrags-Summen, verwaiste Children) |

**Ledger GET-Response erweitert:**
- `isBatchParent: boolean` – Hat der Entry Children?
- `splitChildren: Array` – Zusammenfassung der Children (id, Beschreibung, Betrag, Counterparty, Location)
- `parentEntryId: string | null` – Verweis auf Parent (bei Children)

#### Zahlbeleg-Aufschlüsselung (v2.32.0)

**Wiederkehrender Workflow** für das Splitting von Sammelüberweisungen anhand von PDF-verifizierten Zahlbelegen.

**Datenmodell:**
- `PaymentBreakdownSource` – Ein Zahlbeleg mit Matching-Status auf LedgerEntry
- `PaymentBreakdownItem` – Einzelposten innerhalb eines Zahlbelegs (Empfänger, IBAN, Betrag, Verwendungszweck)

**Workflow:**
```
1. JSON hochladen (PaymentBreakdownPanel)
   → POST /api/cases/[id]/ledger/breakdown
   → Sources + Items persistiert, automatisch gematcht

2. Matching prüfen (in der UI aufklappbar)
   → Status-Badges: UPLOADED (kein Match), MATCHED (bereit), SPLIT (erledigt), ERROR

3. Split ausführen (Button "Splits ausführen")
   → POST /api/cases/[id]/ledger/breakdown/split
   → Children im Ledger erstellt, Invarianten-Test, Audit-Log
```

**Matching-Kriterien:** caseId + bankAccountId + amountCents (negiert) + transactionDate ±3 Tage + description enthält „SAMMEL"

**Bank-Account-Mapping** (hardcodiert in `breakdown/route.ts`):
- `BW-Bank #400080156 (ISK) Uckerath` → `ba-isk-uckerath`
- `BW-Bank #400080228 (ISK) Velbert` → `ba-isk-velbert`

**Idempotenz:**
- Upload: Gleiche `referenceNumber` wird übersprungen (Duplikat-Check)
- Split: Sources mit Status `SPLIT` werden übersprungen

**Sicherheitschecks pro Split:**
- Σ Items === |Parent.amountCents| (BigInt-exakt, cent-genau)
- Parent hat keine existierenden Children
- Parent ist selbst kein Child (keine rekursiven Splits)
- Absoluter Invarianten-Test: Aktive Summe === Root-Summe

**API-Endpunkte (Zahlbeleg-Workflow):**

| Endpunkt | Methode | Beschreibung |
|----------|---------|--------------|
| `/ledger/breakdown` | GET | Status aller PaymentBreakdownSources mit Items |
| `/ledger/breakdown` | POST | Upload & Match (Body: `{ zahlbelege: [...], sourceFileName? }`) |
| `/ledger/breakdown/split` | POST | Idempotenter Split (Body: `{ sourceIds?, dryRun? }`) |

**UI-Komponente:** `PaymentBreakdownPanel` – Aufklappbares Panel in der Ledger-Seite (über der Entry-Liste), mit Datei-Upload, Status-Badges und aufklappbaren Einzelposten-Details.

**Traceability:**
- `PaymentBreakdownItem.createdLedgerEntryId` → erzeugter Child-LedgerEntry
- `PaymentBreakdownSource.matchedLedgerEntryId` → gematchter Parent-LedgerEntry
- Child-Entry: `splitReason` = „Zahlbeleg PRM2VN, Posten 3/8"
- Audit-Log: `fieldChanges.breakdownSourceId` verweist auf Source

---

### 4.16 Personal (Mitarbeiter) (v2.39.0)

**Pfad:** `/admin/cases/[id]/personal`
**Sidebar-Sektion:** FALLDATEN
**API:** `/api/cases/[id]/employees` + `/api/cases/[id]/employees/[employeeId]`

#### Datenmodell

| Modell | Felder | Beschreibung |
|--------|--------|--------------|
| **Employee** | personnelNumber, lastName, firstName, role, lanr, locationId, svNumber, taxId, isActive, notes | Mitarbeiter-Stammdaten mit Standort-Zuordnung |
| **EmployeeSalaryMonth** | employeeId, year, month, grossSalaryCents, netSalaryCents, employerCostsCents | Monatliche Gehaltsdaten (Steuerbrutto, Netto, AG-Kosten) |

#### Features

| Feature | Beschreibung |
|---------|--------------|
| **Gehaltsspalten** | Dynamische Spalten pro verfügbarem Monat (Okt 25, Nov 25, ...) |
| **Summenzeile** | Gesamt-Steuerbrutto pro Monat über alle gefilterten Mitarbeiter |
| **AG-Kosten-Schätzung** | Automatische Berechnung mit Pauschalwert 23% |
| **Standort-Filter** | Dropdown zum Filtern nach Location |
| **Aktiv-Filter** | Nur aktive / alle / nur inaktive Mitarbeiter |
| **LANR-Warnung** | Gelbes Badge „fehlt" bei Ärzten ohne Lebenslange Arztnummer |
| **CRUD** | Anlegen, Bearbeiten, Löschen von Mitarbeitern via Inline-Formular |

#### API-Besonderheiten

- **POST** unterstützt Nested Create: `salaryMonths[]` wird direkt mit angelegt
- **PUT** unterstützt Salary-Upsert: Bestehende Monatsgehälter werden aktualisiert, neue angelegt
- **BigInt-Serialisierung:** `grossSalaryCents` wird als String serialisiert (JSON BigInt)

---

### 4.17 Kontakte (Ansprechpartner) (v2.39.0)

**Pfad:** `/admin/cases/[id]/kontakte`
**Sidebar-Sektion:** FALLDATEN
**API:** `/api/cases/[id]/contacts` + `/api/cases/[id]/contacts/[contactId]`

#### Datenmodell

| Feld | Pflicht | Beschreibung |
|------|---------|--------------|
| `role` | ✅ | IV, BERATER, BUCHHALTUNG, RECHTSANWALT, GESCHAEFTSFUEHRUNG, SONSTIGE |
| `name` | ✅ | Name der Kontaktperson |
| `organization` | ❌ | Kanzlei, Firma, etc. |
| `email` | ❌ | E-Mail (klickbar als mailto-Link) |
| `phone` | ❌ | Telefon (klickbar als tel-Link) |
| `notes` | ❌ | Freitext-Notizen |
| `displayOrder` | Auto | Sortierreihenfolge |

#### Rollen-Badges

| Rolle | Farbe |
|-------|-------|
| IV (Insolvenzverwalter) | Blau |
| Berater | Grün |
| Buchhaltung | Lila |
| Rechtsanwalt | Amber |
| Geschäftsführung | Indigo |
| Sonstige | Grau |

---

### 4.18 Geschäftskonten-Analyse (v2.41.0)

**Pfad:** `/admin/cases/[id]/vorinsolvenz-analyse`
**Sidebar-Sektion:** ANALYSE → „Geschäftskonten"
**API:** `GET /api/cases/[id]/vorinsolvenz-analyse`

#### Funktion

Monatliche Cashflow-Analyse aller Geschäftskonten (Bankkonten mit `isLiquidityRelevant=false`) im LiquidityMatrix-Style. Zeigt Einnahmen und Ausgaben pro Counterparty mit Location-Drill-Down.

#### UI-Struktur (LiquidityMatrix-Style)

| Block | Farbe | Inhalt |
|-------|-------|--------|
| **Einnahmen** | Grün (`bg-green-50`) | Alle Counterparties mit positivem Netto |
| **Ausgaben** | Rot (`bg-red-50`) | Alle Counterparties mit negativem Netto |
| **Netto** | Blau (`bg-blue-50`) | Netto-Cashflow pro Monat |

#### Features

| Feature | Beschreibung |
|---------|--------------|
| **Aufklappbare Zeilen** | `▶` Toggle pro Counterparty → „davon {Standort}"-Kindzeilen |
| **Standort-Filter** | Toggle-Buttons filtern alle Daten nach Location (client-seitig via `useMemo`) |
| **CSV-Export** | Semicolon-separiert mit BOM für deutsches Excel |
| **Trend-Pfeile** | ▲/▼ bei >30% Abweichung vom Zeilendurchschnitt (min. 10 EUR) |
| **Insolvenz-Trennlinie** | Orange Border zwischen vor-/nach-Insolvenz-Monaten |
| **Ø/Monat-Spalte** | Durchschnittswert pro Zeile |
| **Sticky erste Spalte** | Position-Spalte bleibt beim horizontalen Scrollen fixiert |
| **Rand-Monate-Trimming** | Monate mit <5 Entries am Rand werden API-seitig entfernt |

#### API-Response

```json
{
  "summary": {
    "totalCount": 2631,
    "classifiedCount": 2500,
    "totalInflowsCents": "...",
    "totalOutflowsCents": "...",
    "netCents": "...",
    "avgMonthlyInflowsCents": "...",
    "avgMonthlyOutflowsCents": "...",
    "months": ["2025-01", "2025-02", ...]
  },
  "counterpartyMonthly": [{
    "counterpartyId": "...",
    "counterpartyName": "HAEVG",
    "counterpartyType": "ZAHLER",
    "flowType": "INFLOW",
    "totalCents": "...",
    "matchCount": 42,
    "monthly": { "2025-01": "...", "2025-02": "..." },
    "byLocation": [{
      "locationId": "loc-velbert",
      "locationName": "Praxis Velbert",
      "totalCents": "...",
      "monthly": { "2025-01": "...", "2025-02": "..." }
    }]
  }],
  "monthlySummary": [...],
  "byBankAccount": [...],
  "unclassified": [...],
  "locations": [{ "id": "loc-velbert", "name": "Praxis Velbert" }],
  "insolvencyMonth": "2025-10"
}
```

#### Datenquelle

Alle LedgerEntries von Bankkonten mit `isLiquidityRelevant=false` (Geschäftskonten). Location-Zuordnung über `bankAccountId → bankAccount.locationId`. Kein Schema-spezifischer Filter (`allocationSource` wird ignoriert).

---

### 4.19 Performance / Ergebnisrechnung (v2.56.0)

**Pfad:** `/admin/cases/[id]/performance`
**Sidebar-Sektion:** ANALYSE → „Performance (GuV)"
**API:** `GET /api/cases/[id]/performance?allocationMethod=NONE|REVENUE_SHARE|HEADCOUNT_SHARE&includeUnreviewed=false`

#### Funktion

Periodisierte Ergebnisrechnung (GuV-light) pro Standort und Monat. Beantwortet die IV-Kernfrage: „Trägt sich ein Standort wirtschaftlich?"

#### Architektur

Eigenes Modul `lib/performance-engine/` mit:
- **Erlöse nach Leistungsmonat** (nicht Zahlungsdatum): SERVICE_PERIOD → SERVICE_DATE → TRANSACTION_DATE
- **Personal aus EmployeeSalaryMonth** (nicht Bankbuchungen)
- **P&L-Gruppen:** REVENUE, PERSONNEL_COST, FIXED_COST, OTHER_COST
- **Zentraler Kostenblock** (ohne locationId) + optionale Umlage

#### UI-Struktur

| Sektion | Inhalt |
|---------|--------|
| **Header** | Titel, IST-Abdeckung Progress-Bar, Umlagen-Toggle (Segmented Control), Ungeprüfte-Checkbox |
| **KPI-Karten** | 4 Cards: Gesamterlöse, Gesamtkosten, Deckungsbeitrag, Ø Marge (responsive grid) |
| **DB-Trend-Chart** | Recharts ComposedChart: Gruppierte Bars pro Standort + Marge-Linie + Null-Referenzlinie |
| **Standort-Tabs** | Pill-Buttons mit Status-Dots (grün/rot/grau). Wechselt KPIs + Tabelle |
| **P&L-Tabelle** | `.liquidity-table` mit aufklappbaren Gruppen, IST/PLAN/MIX Badges, Gesamt-Spalte |
| **Datenqualität** | Aufklappbar: 8 Statistik-Boxes + Warnungen |

#### Controls

| Control | Auswirkung |
|---------|------------|
| **Umlagen-Toggle** | NONE / REVENUE_SHARE / HEADCOUNT_SHARE — Re-Fetch bei Wechsel |
| **Ungeprüfte** | Checkbox — bezieht unreviewed Entries ein, Re-Fetch |
| **Standort-Tabs** | Client-seitig — KPIs und Tabelle wechseln ohne Re-Fetch |
| **Gruppen-Toggle** | Aufklappen/Zuklappen der P&L-Gruppen in der Tabelle |

---

### 4.20 Datenqualitäts-Checks (v2.42.0, aktualisiert v2.46.0)

**API:** `GET /api/cases/[id]/validate-consistency`
**Anzeige:** Ausschließlich im **System Health Panel** (`/admin/cases/[id]/system`, Sektion B)

> **Architektur-Regel (ADR-059):** Seit v2.46.0 werden Datenqualitäts-Checks NICHT mehr auf dem Dashboard oder anderen Seiten angezeigt. Das System Health Panel ist der einzige Ort für System-Diagnose. Die ehemaligen Komponenten `DataQualityBanner.tsx` und `DataQualityPanel.tsx` wurden gelöscht.

#### Funktion

Automatische Konsistenzprüfung aller IST-LedgerEntries eines Falls. Erkennt Inkonsistenzen zwischen Dimensionen (Counterparty ↔ Tag, Estate ↔ Quartal, Pattern ↔ Beschreibung) und verwaiste Referenzen.

#### 6 Checks

| # | Check | Severity | Beschreibung |
|---|-------|----------|--------------|
| 1 | Gegenpartei ↔ Kategorie-Tag | Fehler | Entries mit bekannter CP müssen erwarteten categoryTag haben (`COUNTERPARTY_TAG_MAP`) |
| 2 | Tag ohne Gegenpartei | Warnung | Entries mit categoryTag (KV/HZV/PVS) sollten passende CP zugewiesen haben |
| 3 | estateAllocation ↔ Quartal | Fehler | Alt/Neu-Zuordnung muss zum Leistungszeitraum passen (nur KV). Priorität: servicePeriodStart > serviceDate > Beschreibung-Regex |
| 4 | Pattern-Match | Warnung | Buchungstext sollte zum matchPattern der zugewiesenen CP passen (manuelle Zuordnung = legitim) |
| 5 | Verwaiste Dimensionen | Fehler | Alle referenzierten Location/BankAccount/Counterparty-IDs müssen in Stammdaten existieren |
| 6 | Gegenparteien ohne Pattern | Warnung | CPs mit 5+ Buchungen ohne matchPattern (v2.44.0) |

#### Konfiguration (case-spezifisch)

In `lib/cases/haevg-plus/matrix-config.ts`:

```typescript
export const COUNTERPARTY_TAG_MAP: Record<string, string> = {
  'cp-haevg-kv': 'KV',
  'cp-kreiskasse-rhein-sieg': 'KV',
  'cp-haevg-hzv': 'HZV',
  'cp-haevg-pvs': 'PVS',
};

export const QUARTAL_CHECK_TAGS = ['KV'];

export function getExpectedEstateAllocation(
  servicePeriodStart: Date,
  openingDate: Date
): QuartalEstateRule { ... }
```

#### Darstellung im System Health Panel

| Zustand | Darstellung |
|---------|-------------|
| Alle Checks bestanden | Grüne Tags, kompakt zusammengefasst |
| Fehlgeschlagene Checks | Aufklappbar mit Detail-Items und Deep-Links |
| API-Fehler | Fehlermeldung mit Retry-Möglichkeit |
| Sortierung | Fehler zuerst, dann Warnungen, dann OK |

#### API-Response

```json
{
  "caseId": "...",
  "validatedAt": "2026-02-12T...",
  "allPassed": false,
  "summary": { "errors": 1, "warnings": 2, "passed": 2, "skipped": 3 },
  "checks": {
    "counterpartyTagConsistency": { "id": "...", "title": "...", "severity": "error", "passed": false, "checked": 45, "failed": 3, "skipped": 0, "items": [...] },
    "tagWithoutCounterparty": { ... },
    "estateAllocationQuarter": { ... },
    "patternMatchValidation": { ... },
    "orphanedDimensions": { ... }
  }
}
```

Max. 20 Items pro Check in der Response (`totalItems` zeigt Gesamtzahl).

---

### 4.21 System Health Panel (v2.46.0)

**Pfad:** `/admin/cases/[id]/system`
**Komponente:** `app/src/app/admin/cases/[id]/system/page.tsx`

#### Funktion

Zentrales Diagnose-Dashboard für Admins. Konsolidiert Informationen aus 5 bestehenden APIs auf einer Seite mit Auto-Refresh (30s).

#### 3 Sektionen

**A) Daten-Übersicht**
4 Metriken-Karten in einer Reihe:

| Karte | Quelle | Farblogik |
|-------|--------|-----------|
| IST-Buchungen | `data-quality` → totalIST, dateRange | – |
| Review-Status | `data-quality` → confirmedPct | ≥80% grün, ≥50% amber, sonst rot |
| Gegenpartei-Zuordnung | `data-quality` → counterpartyPct | ≥80% grün, sonst amber |
| Alt/Neu-Verteilung | `data-quality` → estateBreakdown | UNKLAR > 0 → rot |

**B) Konfigurationsprüfung**
Alle 6 Konsistenz-Checks aus `validate-consistency`. Unterschied zum Dashboard-Banner:
- Zeigt **alle 6 Checks** (Dashboard zeigt nur 1–5)
- Aufklappbare Details pro Check mit Items und Deep-Links
- Bestandene Checks kompakt als grüne Tags zusammengefasst

**C) System-Status**
3 Unterblöcke:

| Block | Quelle | Features |
|-------|--------|----------|
| Aggregation | `aggregation?stats=true` | Status-Badge (CURRENT/STALE/REBUILDING), "Jetzt aktualisieren"-Button |
| Importe | `import-jobs` | Letzter Import (Quelle, Datum, Entries, Summe), Link zu Import-Seite |
| Freigaben | `share` | Aktive/Inaktive/Abgelaufene Links, letzter Zugriff |

#### Verwendete APIs (kein neuer Endpoint)

| API | Felder |
|-----|--------|
| `GET /api/cases/[id]/data-quality` | totalIST, confirmedPct, counterpartyPct, estateBreakdown, dateRange |
| `GET /api/cases/[id]/validate-consistency` | Alle 6 Checks inkl. Check 6 |
| `GET /api/cases/[id]/aggregation?stats=true` | status, pendingChanges, lastAggregatedAt, activePlanName |
| `GET /api/cases/[id]/import-jobs` | importJobs Array mit Quelle/Counts/Summen |
| `GET /api/cases/[id]/share` | ShareLink Array mit isActive, expiresAt, accessCount |

#### Sidebar-Integration

"System"-Link im Bottom-Bereich der CaseSidebar, zwischen "Fall bearbeiten" und "Hilfe". Schild-Icon.

---

## 5. Datenmodell-Diagramm

```
┌──────────────────┐
│  CustomerUser    │
│  (Insolvenz-     │
│   verwalter)     │
└────────┬─────────┘
         │ owns
         ▼
┌──────────────────┐
│      Case        │
│ (Insolvenz-      │
│  verfahren)      │
└────────┬─────────┘
         │
    ┌────┴────┬────────────┬───────────────┬──────────────┐
    ▼         ▼            ▼               ▼              ▼
┌────────┐ ┌─────────┐ ┌───────────┐ ┌──────────┐ ┌───────────┐
│Liquidity│ │ Ledger  │ │  Bank     │ │Ingestion │ │ Share     │
│  Plan   │ │ Entry   │ │ Account   │ │   Job    │ │  Link     │
└────┬────┘ │ (SSOT)  │ │(Banken-   │ │(Import)  │ │(Externe   │
     │      └─────────┘ │ spiegel)  │ └────┬─────┘ │ Ansicht)  │
     │                  └───────────┘      │       └───────────┘
     │                                     ▼
     ▼                              ┌─────────────┐
┌──────────────┐                    │ Ingestion   │
│  Cashflow    │                    │   Record    │
│  Category    │                    └──────┬──────┘
└──────┬───────┘                           │
       │                                   ▼
       ▼                            ┌─────────────┐
┌──────────────┐                    │   Staged    │
│  Cashflow    │                    │  Cashflow   │
│    Line      │                    │   Entry     │
└──────┬───────┘                    └─────────────┘
       │
       ▼
┌──────────────┐
│ Period Value │  ← Aggregierter Cache
│ (pro Woche)  │     (aus LedgerEntry abgeleitet)
└──────────────┘


Zusätzlich am Plan hängend:
┌──────────────┐    ┌──────────────┐
│  Planning    │    │ Insolvency   │
│ Assumption   │    │   Effect     │
└──────────────┘    └──────────────┘
```

---

## 6. Datenfluss: Import bis Anzeige

### Kompletter Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      1. DATEN-IMPORT                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
     ┌─────────────────────────────────────────────────┐
     │  CSV/Excel-Datei hochladen                      │
     │  → IngestionJob (Status: CREATED)               │
     └─────────────────────────────────────────────────┘
                              │
                              ▼
     ┌─────────────────────────────────────────────────┐
     │  Zeilen parsen                                   │
     │  → IngestionRecord[] (Rohwerte als JSON)        │
     │  Status: STAGING                                 │
     └─────────────────────────────────────────────────┘
                              │
                              ▼
     ┌─────────────────────────────────────────────────┐
     │  Mapping definieren                              │
     │  → Spalten zu Feldern zuordnen                  │
     │  → Kategorien zuweisen (INFLOW/OUTFLOW, etc.)   │
     │  Status: MAPPED                                  │
     └─────────────────────────────────────────────────┘
                              │
                              ▼
     ┌─────────────────────────────────────────────────┐
     │  Normalisieren                                   │
     │  → StagedCashflowEntry[] erstellen              │
     │  → Beträge in Cents, Daten validiert            │
     │  Status: READY                                   │
     └─────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      2. COMMIT                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┴────────────────────┐
         ▼                                         ▼
┌─────────────────────┐               ┌─────────────────────┐
│    LedgerEntry      │               │    PeriodValue      │
│  (Transaction-      │  ─ ─ ─ ─ ─ ▶  │  (Aggregierter      │
│   Level Wahrheit)   │   Aggregation │   Wochen-Cache)     │
│                     │               │                     │
│  • caseId           │               │  • lineId           │
│  • transactionDate  │               │  • periodIndex      │
│  • amountCents      │               │  • valueType        │
│  • valueType        │               │  • amountCents      │
│  • legalBucket      │               │                     │
│  • importSource     │               └─────────────────────┘
└─────────────────────┘                          │
                                                 │
┌─────────────────────────────────────────────────────────────────┐
│                      3. DASHBOARD                                │
└─────────────────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
                              ┌─────────────────────────────────┐
                              │  Calculation Engine              │
                              │  (liest PeriodValue)             │
                              │                                  │
                              │  + InsolvencyEffects             │
                              │  + BankAccounts (Eröffnungssaldo)│
                              │  + CaseConfiguration (Anzeige)   │
                              └─────────────────────────────────┘
                                                 │
                                                 ▼
                              ┌─────────────────────────────────┐
                              │  Dashboard / PDF Export          │
                              │  (Präsentation gemäß Config)     │
                              └─────────────────────────────────┘
```

### Wichtige Konzepte

| Konzept | Beschreibung |
|---------|--------------|
| **Single Source of Truth** | LedgerEntry enthält alle Einzeltransaktionen |
| **Derived Cache** | PeriodValue ist aggregierte Sicht, kann neu berechnet werden |
| **Case-Bound** | LedgerEntry hängt am Case, nicht am Plan |
| **Immutable Calculation** | Berechnungslogik wird nie durch Config geändert |
| **13-Wochen-Horizont** | Branchenstandard, nicht konfigurierbar |

---

## API-Endpunkte Übersicht

### Kunden
- `GET /api/customers` - Liste aller Kunden
- `POST /api/customers` - Neuen Kunden anlegen
- `GET /api/customers/[id]` - Kundendetails
- `PUT /api/customers/[id]` - Kunde aktualisieren
- `DELETE /api/customers/[id]` - Kunde deaktivieren/löschen

### Fälle
- `GET /api/cases` - Liste aller Fälle
- `POST /api/cases` - Neuen Fall anlegen
- `GET /api/cases/[id]` - Falldetails
- `PUT /api/cases/[id]` - Fall aktualisieren
- `DELETE /api/cases/[id]` - Fall archivieren/löschen

### ~~Konfiguration~~ ENTFERNT (v2.47.0)
- ~~`GET /api/cases/[id]/config`~~ - Gelöscht (ADR-060)
- ~~`PUT /api/cases/[id]/config`~~ - Gelöscht (ADR-060)
- ~~`DELETE /api/cases/[id]/config`~~ - Gelöscht (ADR-060)

### Import
- `POST /api/ingestion` - Datei hochladen
- `GET /api/ingestion/[jobId]` - Job-Status
- `POST /api/ingestion/[jobId]/map` - Mapping anwenden
- `POST /api/ingestion/[jobId]/commit` - Daten übernehmen

### Ledger
- `GET /api/cases/[id]/ledger` - Alle LedgerEntries
- `POST /api/cases/[id]/ledger` - Manueller Eintrag
- `PUT /api/cases/[id]/ledger/[entryId]` - Eintrag bearbeiten
- `DELETE /api/cases/[id]/ledger/[entryId]` - Eintrag löschen

### Dashboard-Daten
- `GET /api/cases/[id]/dashboard` - Berechnete Daten
- ~~`GET /api/cases/[id]/plan/categories`~~ - Gelöscht (v2.47.0, ADR-060)
- `GET /api/cases/[id]/data-quality` - Datenqualitäts-Metriken (Block 1)
- `GET/POST/DELETE /api/cases/[id]/plan/assumptions` - Berechnungsannahmen (Block 2)
- `GET /api/cases/[id]/forecast/assumptions` - Prognose-Annahmen (Block 3)
- `GET /api/cases/[id]/insolvency-effects` - Insolvenzeffekte
- `GET /api/cases/[id]/bank-accounts` - Bankenspiegel
- `GET /api/cases/[id]/business-context` - Geschäftskontext (Stammdaten, Bankvereinbarungen, Abrechnungsregeln, Kontakte, offene Punkte)

### Liquiditätsmatrix
- `GET /api/cases/[id]/dashboard/liquidity-matrix` - Berechnete Matrix-Daten
- `GET /api/cases/[id]/matrix/explain-cell` - Zellen-Erklärung (Drill-Down)
  - Parameter: `rowId`, `periodIndex`, `scope`, `includeUnreviewed`
  - Response: 4-Ebenen-Erklärung (Zusammenfassung, Zuordnungsregeln, Rechenweg, Einzelbuchungen)
  - Nutzt dieselbe Aggregationslogik wie die Matrix-API (`lib/liquidity-matrix/aggregate.ts`)

### Freigaben (Orders)
- `POST /api/company/orders` - Anfrage einreichen (Token-Auth, FormData mit Datei-Upload)
- `GET /api/cases/[id]/orders/[orderId]/document` - Beleg herunterladen (Admin/Customer)
- `POST /api/cases/[id]/orders/[orderId]/approve` - Genehmigen mit optionalem Betrag (Admin/Customer)
- `POST /api/cases/[id]/orders/[orderId]/reject` - Ablehnen mit Begründung (Admin/Customer)
- `GET /api/cases/[id]/tokens` - Token-Liste
- `POST /api/cases/[id]/tokens` - Token erstellen
- `DELETE /api/cases/[id]/tokens/[tokenId]` - Token deaktivieren

### Share-Links
- `GET /api/cases/[id]/share-links` - Alle Links
- `POST /api/cases/[id]/share-links` - Neuen Link erstellen
- `DELETE /api/cases/[id]/share-links/[linkId]` - Link deaktivieren

---

*Dokumentation erstellt: 18.01.2026*
