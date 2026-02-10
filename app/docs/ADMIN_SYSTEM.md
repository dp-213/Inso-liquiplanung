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
   - [4.2 Konfiguration](#42-konfiguration)
   - [4.3 Datenimport](#43-datenimport)
   - [4.4 Dashboard](#44-dashboard)
   - [4.5 Prämissen](#45-prämissen)
   - [4.6 Insolvenzeffekte](#46-insolvenzeffekte)
   - [4.7 Bankenspiegel](#47-bankenspiegel)
   - [4.8 Zahlungsregister (Ledger)](#48-zahlungsregister-ledger)
   - [4.9 Steuerungsdimensionen](#49-steuerungsdimensionen-ledgerentry)
   - [4.10 Planungsart (Horizont)](#410-planungsart-horizont)
   - [4.11 Externe Ansicht](#411-externe-ansicht)
   - [4.12 Freigaben (Orders)](#412-freigaben-orders)
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
    │       ├── PlanningAssumption (Planungsprämissen)
    │       └── InsolvencyEffect (Insolvenzeffekte)
    │
    ├── LedgerEntry (Zahlungsregister) ← SINGLE SOURCE OF TRUTH
    ├── BankAccount (Bankenspiegel)
    ├── IngestionJob (Import-Vorgänge)
    ├── ShareLink (Externe Links)
    ├── Order (Bestell-/Zahlfreigaben)
    ├── CompanyToken (Externe Zugangs-Tokens)
    └── CaseConfiguration (Dashboard-Konfiguration)
```

---

## 2. Kunden (CustomerUser)

**Pfad:** `/admin/customers`

### Was wird erfasst?

| Feld | Pflicht | Beschreibung | Warum? |
|------|---------|--------------|--------|
| `name` | ✅ | Vollständiger Name | Identifikation im System |
| `email` | ✅ | E-Mail-Adresse (unique) | Login-Kennung fürs Kundenportal |
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
│  [Bearbeiten] [Konfiguration] [Datenimport] [Dashboard]    │
│  [Prämissen] [Insolvenzeffekte] [Bankenspiegel]            │
│  [Zahlungsregister] [Freigaben (Badge)] [Externe Ansicht]   │
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

### 4.2 Konfiguration

**Pfad:** `/admin/cases/[id]/config`

#### Funktion
Steuert die **Präsentation** des Dashboards – NICHT die Berechnung.

#### Konfigurations-Tabs

**1. Kategorien**
- Sichtbarkeit von Einzahlungs-/Auszahlungskategorien
- Reihenfolge per Drag & Drop
- Umbenennung (Labels)
- Hervorhebung (Emphasized)

**2. Anzeige**
- Tabelleneinstellungen (Wochennummern, Datumsbereiche, etc.)
- Aggregationen (Zwischensummen, laufender Saldo)
- KPIs (Mindestliquidität, Gesamteinnahmen, etc.)
- Ansichtsvarianten (intern vs. extern)

**3. Diagramme**
- Welche Charts sichtbar
- Standard-Diagramm
- Legende, Datenbeschriftungen

**4. Styling**
- Firmenname, Logo-URL
- Primär- und Akzentfarben
- Fußzeile

**5. PDF-Texte**
- Rechtliche Vorbemerkungen
- Datenquellen
- Vorbemerkungen zur Liquiditätsplanung
- Vollständigkeitserklärung
- Vertraulichkeitshinweis

**6. Erweitert**
- Benutzerdefinierte Titel
- Metadaten, Notizen
- Raw JSON (read-only)

#### Datenmodell-Wirkung
```
CaseConfiguration {
  caseId: string
  configType: "DASHBOARD_CONFIG"
  configData: JSON (CaseDashboardConfig)
}
```

#### Wichtig
> Konfiguration ändert **nur die Darstellung**, nie die Berechnungslogik. Die Calculation Engine ist immutabel.

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

#### Funktion
Interaktive Ansicht der Liquiditätsplanung.

#### Datenquellen
- **PeriodValue:** Aggregierte Wochenwerte (aus LedgerEntry abgeleitet)
- **InsolvencyEffect:** Insolvenzspezifische Effekte
- **BankAccount:** Liquide Mittel (Eröffnungssaldo)
- **CaseConfiguration:** Präsentationseinstellungen

#### Berechnungslogik (immutabel)

```
Pro Woche (periodIndex 0-12):

Einzahlungen
  - Kategorie 1 (INFLOW, ALTMASSE)
  - Kategorie 2 (INFLOW, NEUMASSE)
  = Summe Einzahlungen

Auszahlungen
  - Kategorie 3 (OUTFLOW, ALTMASSE)
  - Kategorie 4 (OUTFLOW, NEUMASSE)
  = Summe Auszahlungen

Cashflow (vor Insolvenzeffekten) = Einzahlungen - Auszahlungen

Insolvenzeffekte
  + Anfechtungen
  - Verfahrenskosten
  = Summe Insolvenzeffekte

Cashflow (nach Insolvenzeffekten) = Cashflow + Insolvenzeffekte

Endbestand = Anfangsbestand + Cashflow

→ Endbestand Woche n = Anfangsbestand Woche n+1
```

#### Ansichten
- IST-Werte: Tatsächliche Zahlungen (vergangene Wochen)
- PLAN-Werte: Prognostizierte Zahlungen (zukünftige Wochen)
- Vergleich IST/PLAN mit Abweichungen

---

### 4.5 Prämissen

**Pfad:** `/admin/cases/[id]/assumptions`

#### Funktion
Dokumentation der Planungsannahmen nach W&P-Standard.

#### Erfasste Daten

| Feld | Beschreibung | Beispiel |
|------|--------------|----------|
| `categoryName` | Zugeordnete Kategorie | "Forderungseinzug" |
| `source` | Datenquelle | "OP-Debitorenliste zum 05.01.2026" |
| `description` | Ausführliche Beschreibung | "Einzugsquote 60% auf Basis historischer Daten" |
| `riskLevel` | Risikobewertung | conservative, low, medium, high, aggressive |

#### Warum?
- **Nachvollziehbarkeit:** Wie kam die Prognose zustande?
- **Audit-Sicherheit:** Welche Daten wurden verwendet?
- **Risikobewertung:** Wie belastbar ist die Annahme?
- **W&P-Standard:** Branchenübliche Dokumentation

#### Datenmodell

```prisma
model PlanningAssumption {
  id            String   @id @default(uuid())
  planId        String
  categoryName  String
  source        String
  description   String
  riskLevel     String   // conservative, low, medium, high, aggressive

  plan LiquidityPlan @relation(...)
  @@unique([planId, categoryName])
}
```

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
  id              String   @id @default(uuid())
  caseId          String
  bankName        String
  accountName     String
  iban            String?
  balanceCents    BigInt
  availableCents  BigInt
  securityHolder  String?
  status          String   // available, blocked, restricted
  notes           String?

  case Case @relation(...)
}
```

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
- **Gegenparteien:** `/admin/cases/[id]/counterparties`
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
  creditor            String
  description         String
  notes               String?
  documentName        String?
  documentMimeType    String?
  documentSizeBytes   BigInt?
  documentContent     String?   // Base64-encoded
  status              String    @default("PENDING")  // PENDING | APPROVED | REJECTED
  approvedAmountCents BigInt?   // Wenn IV anderen Betrag genehmigt
  approvedAt          DateTime?
  approvedBy          String?
  rejectedAt          DateTime?
  rejectionReason     String?
  ledgerEntryId       String?   @unique
  createdAt           DateTime  @default(now())

  case        Case         @relation(...)
  ledgerEntry LedgerEntry? @relation(...)
  @@index([caseId])
  @@index([caseId, status])
}

model CompanyToken {
  id        String   @id @default(uuid())
  caseId    String
  token     String   @unique
  label     String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  case Case @relation(...)
  @@index([caseId])
}
```

#### UI-Komponenten

| Komponente | Pfad | Funktion |
|------------|------|----------|
| **OrderList** | `admin/cases/[id]/orders/OrderList.tsx` | Freigabeliste mit Filter (Typ) und Sort (Datum/Betrag/Gläubiger) |
| **ApprovalModal** | `admin/cases/[id]/orders/ApprovalModal.tsx` | Genehmigung mit optionalem abweichendem Betrag |
| **RejectionModal** | `admin/cases/[id]/orders/RejectionModal.tsx` | Ablehnung mit Pflicht-Begründung |
| **CompanyTokenManager** | `admin/cases/[id]/orders/CompanyTokenManager.tsx` | Token erstellen/deaktivieren |
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
}
```

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

### Konfiguration
- `GET /api/cases/[id]/config` - Dashboard-Konfiguration
- `PUT /api/cases/[id]/config` - Konfiguration speichern
- `DELETE /api/cases/[id]/config` - Auf Standard zurücksetzen

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
- `GET /api/cases/[id]/plan/categories` - Kategorien + Lines
- `GET /api/cases/[id]/assumptions` - Prämissen
- `GET /api/cases/[id]/insolvency-effects` - Insolvenzeffekte
- `GET /api/cases/[id]/bank-accounts` - Bankenspiegel

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
