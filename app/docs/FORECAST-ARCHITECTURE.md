# Architekturkonzept: Liquiditätsprognose-Modul

**Version:** 0.1.0 (Entwurf)
**Stand:** 12. Februar 2026
**Autor:** Architektur-Team (David Padilla / Claude)
**Status:** ENTWURF -- Zur Abstimmung mit Beratung und IV

---

## Inhaltsverzeichnis

1. [Fachliches Architekturkonzept](#1-fachliches-architekturkonzept)
2. [Datenmodell-Vorschlag](#2-datenmodell-vorschlag)
3. [Berechnungslogik](#3-berechnungslogik-konzeptionell)
4. [Szenario-Logik](#4-szenario-logik)
5. [UX-Konzept](#5-ux-konzept)
6. [Beispielrechnung HVPlus](#6-beispielrechnung-hvplus-okt-2025--aug-2026)
7. [Fehlerquellen und Absicherung](#7-fehlerquellen-und-absicherung)

---

## 1. Fachliches Architekturkonzept

### 1.1 Ausgangslage

Das System verfügt bereits über eine funktionierende **Liquiditätsmatrix** (IDW S11-konform, 4 Blöcke, Multi-Scope), die als Controlling-Instrument IST- und PLAN-Daten aggregiert. Diese Matrix ist rückblickend: Sie zeigt, was passiert ist (IST) und was ursprünglich geplant war (PLAN), mit IST-Vorrang.

Was fehlt, ist ein **vorwärtsgerichtetes Prognose-Modul**, das:

- Auf dem letzten verfügbaren IST-Stand aufsetzt
- Zukunftsmonate auf Basis **expliziter, editierbarer Annahmen** berechnet
- Verschiedene Szenarien (Base, Downside, Upside) nebeneinander stellt
- Jede Zahl bis zur zugrunde liegenden Annahme nachvollziehbar macht

### 1.2 Klare Trennung: Matrix vs. Forecast

| Dimension | Liquiditätsmatrix (IST/PLAN) | Liquiditätsprognose (Forecast) |
|-----------|------------------------------|-------------------------------|
| **Zeitrichtung** | Rückblickend + aktuelle Planung | Vorwärtsgerichtet |
| **Datenquelle** | LedgerEntries (IST + PLAN) | IST-Closing + ForecastAssumptions |
| **Zweck** | Controlling (Was ist passiert?) | Steuerung (Was wird passieren?) |
| **Granularität** | Einzelbuchung (LedgerEntry) | Aggregierte Annahmen je Kategorie/Periode |
| **Veränderbarkeit** | IST = unveränderlich; PLAN = importiert | Annahmen frei editierbar, versioniert |
| **Szenarien** | Keine (1 Sicht) | 3 Szenarien (Base, Downside, Upside) |
| **Audit-Trail** | LedgerEntry + LedgerAuditLog | ForecastAssumption-Versionen |
| **IDW S11** | Primäres Berichtsinstrument | Ergänzendes Planungsinstrument |

**Grundsatz:** Die Matrix bleibt das Primärinstrument. Die Prognose ist ein Planungswerkzeug, das der Beraterin und dem IV hilft, fundierte Entscheidungen zu treffen. Beide Instrumente teilen sich die IST-Datenbasis (LedgerEntries), aber die Prognose berechnet Zukunftswerte aus Annahmen, nicht aus Einzelbuchungen.

### 1.3 Architektonische Einordnung

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER                                 │
│                                                                             │
│   ┌─────────────────┐  ┌───────────────────────┐  ┌────────────────────┐   │
│   │ Liquiditäts-    │  │ Prognose-Modul        │  │ Szenario-          │   │
│   │ matrix (Tab)    │  │ (Tab: Forecast)       │  │ Vergleich (Tab)    │   │
│   └────────┬────────┘  └───────────┬───────────┘  └─────────┬──────────┘   │
└────────────┼───────────────────────┼───────────────────────────────────────┘
             │                       │                         │
             v                       v                         v
┌────────────────────┐  ┌──────────────────────────────────────────────────┐
│  aggregateEntries  │  │            FORECAST ENGINE                        │
│  (bestehend)       │  │                                                    │
│                    │  │  forecastEngine()   scenarioEngine()              │
│  Matrix-Config     │  │  - Liest IST-Closing     - Multipliziert Base-   │
│  Matching-Engine   │  │  - Iteriert Perioden       Annahmen mit Szenario-│
│  Estate-Splitting  │  │  - Wendet Annahmen an      Modifikatoren         │
│                    │  │  - Berechnet Kredit/                              │
│                    │  │    Headroom                                        │
│                    │  │  - Deterministisch,                                │
│                    │  │    auditierbar                                     │
└────────┬───────────┘  └───────────────────────┬──────────────────────────┘
         │                                      │
         v                                      v
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SHARED DATA LAYER                                     │
│                                                                               │
│   LedgerEntry (IST)  ──>  IST-Closing-Balance (letzte IST-Periode)          │
│   BankAgreement      ──>  Kreditlinie, Fortführungsbeitrag                  │
│   InsolvencyEffect   ──>  Rückstellungen (isAvailabilityOnly)               │
│   ForecastAssumption ──>  Annahmen je Kategorie/Periode (NEU)               │
│   ForecastScenario   ──>  Szenario-Modifikatoren (NEU)                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.4 Abgrenzung und Wiederverwendbarkeit

**Was wiederverwendet wird (aus der bestehenden Matrix):**

- `LedgerEntry` als IST-Datenquelle
- `BankAgreement` für Kreditlinie und Fortführungsbeitrag
- `InsolvencyEffect` (isAvailabilityOnly) für Rückstellungen
- `MatrixBlockConfig` und `MatrixRowConfig` als Kategoriestruktur der Anzeige
- `getPeriodIndex()` und Perioden-Hilfsfunktionen
- `aggregateEntries()` im Modus `traceMode=false` für IST-Perioden-Aggregation

**Was NEU ist (Forecast-spezifisch):**

- `ForecastAssumption` -- einzelne, versionierte Annahme
- `ForecastScenario` -- Szenario-Definition mit Modifikatoren
- `ForecastResult` -- berechnetes Periodenergebnis mit Audit-Trail
- `forecastEngine()` -- deterministische Berechnungsfunktion
- `scenarioEngine()` -- wendet Szenario-Modifikatoren auf Base-Annahmen an

**Was NICHT geteilt wird:**

- Die Forecast-Engine schreibt KEINE LedgerEntries (kein Seiteneffekt auf IST-Daten)
- Die Matrix-Aggregation wird NICHT verändert (kein Risiko für bestehendes Controlling)
- Forecast-Annahmen sind KEINE PlanningAssumptions (das bestehende Modell ist nur Metadaten/Dokumentation)

### 1.5 Case-Agnostik

Die Architektur ist fallunabhängig. Fallspezifische Konfiguration wird durch zwei Mechanismen erreicht:

1. **ForecastCategoryConfig** -- Definiert die Einnahmen-/Ausgaben-Kategorien pro Fall (analog zur `MatrixRowConfig`). Jeder Fall hat seine eigene Kategoriestruktur (HVPlus: HZV, KV, PVS; ein Handwerksbetrieb: Aufträge, Warenverkauf, etc.).

2. **Assumption-Typen** -- Die Struktur einer Annahme (Basisbetrag, Wachstumsfaktor, saisonaler Effekt, Einmaleffekt) ist generisch. Die konkreten Werte sind fallspezifisch und werden vom User eingegeben.

Es gibt **keine HVPlus-spezifische Logik** in der Forecast-Engine.

---

## 2. Datenmodell-Vorschlag

### 2.1 Entity-Relationship-Übersicht

```
Case (1) ──────── (n) ForecastScenario
  │                        │
  │                        │ (1)
  │                        │
  │                  (n) ForecastAssumption ──── (n) ForecastAssumptionVersion
  │                        │
  │                        │
  │                  (n) ForecastResult
  │                        │
  │                  (n) ForecastPeriod
  │
  └──── LiquidityPlan (bestehend, unverändert)
  └──── BankAgreement (bestehend, lesend genutzt)
  └──── InsolvencyEffect (bestehend, lesend genutzt)
```

### 2.2 ForecastScenario

Definiert ein benanntes Szenario mit globalen Modifikatoren.

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | String (UUID) | Ja | Primärschlüssel |
| `caseId` | String (FK) | Ja | Zugehöriger Fall |
| `name` | String | Ja | z.B. "Base Case", "Downside", "Upside" |
| `description` | String | Nein | Freitext-Beschreibung des Szenarios |
| `scenarioType` | Enum | Ja | `BASE`, `DOWNSIDE`, `UPSIDE`, `CUSTOM` |
| `isActive` | Boolean | Ja | Nur aktive Szenarien werden berechnet |
| `isLocked` | Boolean | Ja | Gesperrte Szenarien sind nicht editierbar (Snapshot) |
| `lockedAt` | DateTime | Nein | Zeitpunkt der Sperrung |
| `lockedBy` | String | Nein | Wer hat gesperrt |
| `lockedReason` | String | Nein | z.B. "Eingereicht bei IV am 15.02.2026" |
| `periodType` | String | Ja | `WEEKLY` oder `MONTHLY` (aus LiquidityPlan) |
| `periodCount` | Int | Ja | Anzahl Perioden (aus LiquidityPlan) |
| `planStartDate` | DateTime | Ja | Beginn des Planungszeitraums |
| `istCutoffPeriodIndex` | Int | Ja | Letzte Periode mit IST-Daten (0-basiert) |
| `openingBalanceCents` | BigInt | Ja | IST-Closing der letzten IST-Periode |
| `openingBalanceSource` | String | Ja | z.B. "IST-Closing Jan 2026 aus Matrix" |
| `creditLineCents` | BigInt | Ja | Verfügbare Kreditlinie (aus BankAgreement) |
| `creditLineSource` | String | Ja | z.B. "Sparkasse HRV, vereinbart" |
| `reservesTotalCents` | BigInt | Ja | Rückstellungen (aus InsolvencyEffect) |
| `createdAt` | DateTime | Ja | Erstellungszeitpunkt |
| `createdBy` | String | Ja | Ersteller |
| `updatedAt` | DateTime | Ja | Letzte Änderung |

**Constraints:**
- Pro Case maximal 1 Szenario vom Typ `BASE` (darf nicht gelöscht werden)
- `DOWNSIDE` und `UPSIDE` sind optional
- `CUSTOM` erlaubt beliebig viele weitere Szenarien
- `istCutoffPeriodIndex` bestimmt, ab welcher Periode die Forecast-Berechnung einsetzt

### 2.3 ForecastAssumption

Einzelne, versionierte Annahme für eine Kategorie.

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | String (UUID) | Ja | Primärschlüssel |
| `scenarioId` | String (FK) | Ja | Zugehöriges Szenario |
| `caseId` | String (FK) | Ja | Zugehöriger Fall (Redundanz fuer Index) |
| `categoryKey` | String | Ja | Schlüssel der Einnahmen-/Ausgaben-Kategorie (z.B. "HZV", "PERSONAL", "MIETE") |
| `categoryLabel` | String | Ja | Anzeigename (z.B. "HZV Uckerath") |
| `flowType` | Enum | Ja | `INFLOW` oder `OUTFLOW` |
| `assumptionType` | Enum | Ja | `RUN_RATE`, `FIXED`, `ONE_TIME`, `PERCENTAGE_OF_REVENUE` |
| `baseAmountCents` | BigInt | Ja | Basisbetrag in Cent |
| `baseAmountSource` | String | Ja | Quellenangabe (z.B. "Durchschnitt IST Nov-Jan: 40.000 EUR/Monat") |
| `baseAmountNote` | String | Nein | Erklärung/Herleitung des Basisbetrags |
| `growthFactorPercent` | Decimal | Nein | Wachstums-/Rückgangsfaktor in % pro Periode (z.B. -5.0 = 5% Rückgang) |
| `seasonalProfile` | String (JSON) | Nein | JSON-Array mit 12 Monatsfaktoren, z.B. [1.0, 1.0, 1.3, 1.0, ...] |
| `locationId` | String (FK) | Nein | Standort-Zuordnung (optional) |
| `startPeriodIndex` | Int | Ja | Erste Periode, in der diese Annahme wirkt (0-basiert) |
| `endPeriodIndex` | Int | Ja | Letzte Periode (inklusiv), in der diese Annahme wirkt |
| `isActive` | Boolean | Ja | Deaktivierte Annahmen werden ignoriert |
| `sortOrder` | Int | Ja | Reihenfolge in der Anzeige |
| `version` | Int | Ja | Aktuelle Version (inkrementiert bei Änderung) |
| `createdAt` | DateTime | Ja | Erstellungszeitpunkt |
| `createdBy` | String | Ja | Ersteller |
| `updatedAt` | DateTime | Ja | Letzte Änderung |
| `updatedBy` | String | Nein | Letzter Bearbeiter |

**Assumption-Typen im Detail:**

| Typ | Beschreibung | Formel pro Periode |
|-----|-------------|-------------------|
| `RUN_RATE` | Laufender Monatsbetrag mit optionalem Wachstum und Saisonalität | `baseAmount * (1 + growth)^n * seasonal[m]` |
| `FIXED` | Fester Betrag, konstant über alle Perioden | `baseAmount` |
| `ONE_TIME` | Einmalige Zahlung in einer bestimmten Periode | `baseAmount` (nur in Startperiode) |
| `PERCENTAGE_OF_REVENUE` | Prozentsatz vom Umsatz (z.B. Fortführungsbeitrag 10%) | `sum(INFLOW) * baseAmountCents / 10000` |

### 2.4 ForecastAssumptionVersion

Unveränderlicher Snapshot einer Annahme bei jeder Änderung.

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | String (UUID) | Ja | Primärschlüssel |
| `assumptionId` | String (FK) | Ja | Zugehörige Annahme |
| `versionNumber` | Int | Ja | Versionsnummer (aufsteigend) |
| `snapshotData` | String (JSON) | Ja | Vollständiger Zustand zum Zeitpunkt der Änderung |
| `changeReason` | String | Ja | Pflicht-Begründung der Änderung |
| `changedFields` | String (JSON) | Ja | Welche Felder geändert wurden |
| `createdAt` | DateTime | Ja | Zeitpunkt der Versionserstellung |
| `createdBy` | String | Ja | Wer hat geändert |

**Constraints:**
- Jede Änderung an einer ForecastAssumption erzeugt automatisch eine neue Version
- changeReason ist Pflicht (Audit-Trail)
- Versionen sind unveränderlich (immutable)

### 2.5 ForecastPeriod

Berechnetes Ergebnis für eine einzelne Periode.

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | String (UUID) | Ja | Primärschlüssel |
| `scenarioId` | String (FK) | Ja | Zugehöriges Szenario |
| `periodIndex` | Int | Ja | 0-basierter Periodenindex |
| `periodLabel` | String | Ja | z.B. "Feb 26", "Mrz 26" |
| `periodStartDate` | DateTime | Ja | Periodenanfang |
| `periodEndDate` | DateTime | Ja | Periodenende |
| `dataSource` | Enum | Ja | `IST`, `FORECAST`, `MIXED` |
| `openingBalanceCents` | BigInt | Ja | Eröffnungssaldo |
| `cashInTotalCents` | BigInt | Ja | Summe Einzahlungen |
| `cashOutTotalCents` | BigInt | Ja | Summe Auszahlungen |
| `netCashflowCents` | BigInt | Ja | Ein - Aus |
| `closingBalanceCents` | BigInt | Ja | Opening + Net Cashflow |
| `creditLineAvailableCents` | BigInt | Ja | Verfügbare Kreditlinie |
| `headroomCents` | BigInt | Ja | Closing + Kreditlinie |
| `headroomAfterReservesCents` | BigInt | Ja | Headroom - Rückstellungen |
| `lineItemsJson` | String (JSON) | Ja | Detailaufschlüsselung aller Zeilen |
| `calculationTraceJson` | String (JSON) | Ja | Vollständiger Berechnungsnachweis |
| `calculatedAt` | DateTime | Ja | Berechnungszeitpunkt |

**Constraints:**
- `closingBalanceCents = openingBalanceCents + netCashflowCents`
- `netCashflowCents = cashInTotalCents + cashOutTotalCents` (Auszahlungen sind negativ)
- `headroomCents = closingBalanceCents + creditLineAvailableCents`
- Jede Neuberechnung ersetzt alle ForecastPeriods des Szenarios (keine partielle Aktualisierung)

### 2.6 ForecastResult

Zusammenfassung eines vollständigen Forecast-Laufs.

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | String (UUID) | Ja | Primärschlüssel |
| `scenarioId` | String (FK) | Ja | Zugehöriges Szenario |
| `calculatedAt` | DateTime | Ja | Berechnungszeitpunkt |
| `calculatedBy` | String | Ja | Wer hat berechnet |
| `periodCount` | Int | Ja | Anzahl berechneter Perioden |
| `istPeriodCount` | Int | Ja | Davon IST-Perioden |
| `forecastPeriodCount` | Int | Ja | Davon Prognose-Perioden |
| `assumptionCount` | Int | Ja | Anzahl aktiver Annahmen |
| `assumptionHashSha256` | String | Ja | Hash aller Annahmen (Reproduzierbarkeit) |
| `minHeadroomCents` | BigInt | Ja | Niedrigster Headroom im gesamten Zeitraum |
| `minHeadroomPeriodIndex` | Int | Ja | Periode mit niedrigstem Headroom |
| `finalClosingBalanceCents` | BigInt | Ja | Schlusssaldo letzte Periode |
| `isValid` | Boolean | Ja | False bei Berechnungsfehlern |
| `validationNotes` | String | Nein | Warnungen/Fehler |

### 2.7 Prisma-Schema (Vorschlag)

```prisma
model ForecastScenario {
  id                      String    @id @default(uuid())
  caseId                  String
  name                    String
  description             String?
  scenarioType            String    // BASE, DOWNSIDE, UPSIDE, CUSTOM
  isActive                Boolean   @default(true)
  isLocked                Boolean   @default(false)
  lockedAt                DateTime?
  lockedBy                String?
  lockedReason            String?
  periodType              String    // WEEKLY, MONTHLY
  periodCount             Int
  planStartDate           DateTime
  istCutoffPeriodIndex    Int       // Letzte IST-Periode
  openingBalanceCents     BigInt
  openingBalanceSource    String
  creditLineCents         BigInt
  creditLineSource        String
  reservesTotalCents      BigInt
  createdAt               DateTime  @default(now())
  createdBy               String
  updatedAt               DateTime  @updatedAt

  case        Case                  @relation(fields: [caseId], references: [id], onDelete: Cascade)
  assumptions ForecastAssumption[]
  periods     ForecastPeriod[]
  results     ForecastResult[]

  @@index([caseId])
  @@index([caseId, scenarioType])
  @@map("forecast_scenarios")
}

model ForecastAssumption {
  id                    String    @id @default(uuid())
  scenarioId            String
  caseId                String
  categoryKey           String
  categoryLabel         String
  flowType              String    // INFLOW, OUTFLOW
  assumptionType        String    // RUN_RATE, FIXED, ONE_TIME, PERCENTAGE_OF_REVENUE
  baseAmountCents       BigInt
  baseAmountSource      String
  baseAmountNote        String?
  growthFactorPercent   Decimal?
  seasonalProfile       String?   // JSON
  locationId            String?
  startPeriodIndex      Int
  endPeriodIndex        Int
  isActive              Boolean   @default(true)
  sortOrder             Int       @default(0)
  version               Int       @default(1)
  createdAt             DateTime  @default(now())
  createdBy             String
  updatedAt             DateTime  @updatedAt
  updatedBy             String?

  scenario  ForecastScenario          @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  versions  ForecastAssumptionVersion[]

  @@index([scenarioId])
  @@index([caseId, categoryKey])
  @@map("forecast_assumptions")
}

model ForecastAssumptionVersion {
  id              String    @id @default(uuid())
  assumptionId    String
  versionNumber   Int
  snapshotData    String    // JSON
  changeReason    String
  changedFields   String    // JSON
  createdAt       DateTime  @default(now())
  createdBy       String

  assumption ForecastAssumption @relation(fields: [assumptionId], references: [id], onDelete: Cascade)

  @@unique([assumptionId, versionNumber])
  @@index([assumptionId])
  @@map("forecast_assumption_versions")
}

model ForecastPeriod {
  id                          String    @id @default(uuid())
  scenarioId                  String
  periodIndex                 Int
  periodLabel                 String
  periodStartDate             DateTime
  periodEndDate               DateTime
  dataSource                  String    // IST, FORECAST, MIXED
  openingBalanceCents         BigInt
  cashInTotalCents            BigInt
  cashOutTotalCents           BigInt
  netCashflowCents            BigInt
  closingBalanceCents         BigInt
  creditLineAvailableCents    BigInt
  headroomCents               BigInt
  headroomAfterReservesCents  BigInt
  lineItemsJson               String    // JSON
  calculationTraceJson        String    // JSON
  calculatedAt                DateTime  @default(now())

  scenario ForecastScenario @relation(fields: [scenarioId], references: [id], onDelete: Cascade)

  @@unique([scenarioId, periodIndex])
  @@index([scenarioId])
  @@map("forecast_periods")
}

model ForecastResult {
  id                        String    @id @default(uuid())
  scenarioId                String
  calculatedAt              DateTime  @default(now())
  calculatedBy              String
  periodCount               Int
  istPeriodCount            Int
  forecastPeriodCount       Int
  assumptionCount           Int
  assumptionHashSha256      String
  minHeadroomCents          BigInt
  minHeadroomPeriodIndex    Int
  finalClosingBalanceCents  BigInt
  isValid                   Boolean
  validationNotes           String?

  scenario ForecastScenario @relation(fields: [scenarioId], references: [id], onDelete: Cascade)

  @@index([scenarioId])
  @@index([scenarioId, calculatedAt])
  @@map("forecast_results")
}
```

---

## 3. Berechnungslogik (konzeptionell)

### 3.1 Berechnungsablauf

Die Forecast-Engine arbeitet als reine Funktion: gleiche Eingaben = gleiche Ausgaben.

```
forecastEngine(scenario, assumptions) → ForecastPeriod[]
```

**Schritt-für-Schritt:**

#### Schritt 1: IST-Perioden übernehmen

Für alle Perioden `p` mit `p <= istCutoffPeriodIndex`:

1. Lese IST-Daten aus der bestehenden Matrix-Aggregation (`aggregateEntries()`)
2. Übernehme die tatsächlichen Werte unverändert
3. Setze `dataSource = 'IST'`
4. Der Closing-Balance der letzten IST-Periode wird zum Opening-Balance der ersten Forecast-Periode

**Wichtig:** Die IST-Daten werden NICHT aus den ForecastAssumptions berechnet, sondern direkt aus der Matrix-Engine gelesen. Dies stellt sicher, dass IST immer Vorrang hat und die Forecast-Engine die Realität nicht verfälscht.

#### Schritt 2: IST-Closing als Startpunkt

```
openingBalance[istCutoff + 1] = closingBalance[istCutoff]
```

Dieser Wert wird im `ForecastScenario.openingBalanceCents` gespeichert und ist bei jeder Neuberechnung nachvollziehbar.

#### Schritt 3: Forecast-Perioden berechnen

Für jede Periode `p` mit `p > istCutoffPeriodIndex`:

```
1. openingBalance[p] = closingBalance[p-1]

2. cashIn[p] = SUM( forecastAmount(assumption, p) )
                     für alle aktiven INFLOW-Annahmen
                     mit startPeriodIndex <= p <= endPeriodIndex

3. cashOut[p] = SUM( forecastAmount(assumption, p) )
                     für alle aktiven OUTFLOW-Annahmen
                     mit startPeriodIndex <= p <= endPeriodIndex

4. netCashflow[p] = cashIn[p] + cashOut[p]
                     (cashOut ist negativ, daher Addition)

5. closingBalance[p] = openingBalance[p] + netCashflow[p]

6. headroom[p] = closingBalance[p] + creditLineCents

7. headroomAfterReserves[p] = headroom[p] - reservesTotalCents
```

#### Schritt 4: Einzelannahme berechnen (`forecastAmount`)

```typescript
function forecastAmount(assumption: ForecastAssumption, periodIndex: number): bigint {
  // Prüfe ob Annahme in dieser Periode aktiv
  if (periodIndex < assumption.startPeriodIndex) return 0n;
  if (periodIndex > assumption.endPeriodIndex) return 0n;
  if (!assumption.isActive) return 0n;

  const base = assumption.baseAmountCents;

  switch (assumption.assumptionType) {
    case 'RUN_RATE': {
      // Periodennummer relativ zum Start der Annahme
      const n = periodIndex - assumption.startPeriodIndex;

      // Wachstumsfaktor (kumulativ)
      const growth = assumption.growthFactorPercent
        ? Math.pow(1 + Number(assumption.growthFactorPercent) / 100, n)
        : 1.0;

      // Saisonaler Faktor (Monat der Periode)
      const monthIndex = getMonthOfPeriod(periodIndex, planStartDate);
      const seasonal = assumption.seasonalProfile
        ? JSON.parse(assumption.seasonalProfile)[monthIndex] ?? 1.0
        : 1.0;

      return BigInt(Math.round(Number(base) * growth * seasonal));
    }

    case 'FIXED':
      return base;

    case 'ONE_TIME':
      // Nur in der Startperiode
      return periodIndex === assumption.startPeriodIndex ? base : 0n;

    case 'PERCENTAGE_OF_REVENUE':
      // Wird in einem zweiten Durchlauf berechnet (nach allen INFLOW-Annahmen)
      // base = Prozentsatz * 100 (z.B. 1000 = 10%)
      return 0n; // Platzhalter, siehe Schritt 5
  }
}
```

#### Schritt 5: Umsatzabhängige Kosten (zweiter Durchlauf)

Nach der Berechnung aller RUN_RATE/FIXED/ONE_TIME-Annahmen:

```
Für jede PERCENTAGE_OF_REVENUE-Annahme:
  amount[p] = cashIn[p] * baseAmountCents / 10000
              (baseAmountCents = 1000 bedeutet 10.00%)
```

Typischer Anwendungsfall: Fortführungsbeitrag (10% zzgl. USt der eingezogenen Forderungen).

#### Schritt 6: Massekredit-Auslastung

```
kreditInanspruchnahme[p] = max(0, -closingBalance[p])
kreditHeadroom[p] = creditLineCents - kreditInanspruchnahme[p]
```

Wenn `closingBalance[p] < 0`, wird die Kreditlinie beansprucht. Der Headroom zeigt, wie viel Kreditlinie noch verfügbar ist.

**Kein automatischer Kreditlimiten-Bruch:** Wenn `headroom[p] < 0`, wird dies als Warnung angezeigt, aber die Berechnung läuft weiter. Die Engine optimiert nicht -- sie zeigt die Realität der Annahmen.

### 3.2 IST-Vorrang: Interaktion mit bestehenden Daten

Die Forecast-Engine respektiert das IST-Vorrang-Prinzip des Gesamtsystems:

```
┌────────────────────────────────────────────────────────────────┐
│  Periode:   Okt  Nov  Dez  Jan  Feb  Mrz  Apr  Mai  Jun  Jul  Aug  │
│  Quelle:    IST  IST  IST  IST  FC   FC   FC   FC   FC   FC   FC   │
│                               ↑                                     │
│                        istCutoffPeriodIndex = 3                     │
└────────────────────────────────────────────────────────────────┘
```

**Wenn neue IST-Daten importiert werden:**

1. User importiert Februar-IST-Daten
2. System erkennt: `istCutoffPeriodIndex` kann auf 4 erhöht werden
3. User bestätigt Aktualisierung des Szenarios
4. Neuberechnung: Feb wird IST, Mrz-Aug werden Forecast
5. Opening Balance für Mrz wird aus neuem Feb-IST-Closing übernommen

Dieser Prozess ist **explizit, nicht automatisch**. Der User muss die Aktualisierung auslösen.

### 3.3 Determinismus-Garantie

Jede Berechnung ist vollständig reproduzierbar durch:

1. **Eingabe-Hash:** SHA-256 über alle aktiven Annahmen, Szenario-Parameter und IST-Closing
2. **Berechnung-Trace:** Jede `ForecastPeriod` enthält `calculationTraceJson` mit dem vollständigen Rechenweg
3. **Versions-Referenz:** Jede Annahme referenziert ihre exakte Version

Gleicher Hash = gleiches Ergebnis. Immer.

---

## 4. Szenario-Logik

### 4.1 Drei Standard-Szenarien

| Szenario | Beschreibung | Typische Modifikation |
|----------|-------------|----------------------|
| **Base** | Realistische Einschätzung | Annahmen basierend auf IST-Durchschnitt und bestätigten Verträgen |
| **Downside** | Pessimistisches Szenario | Umsatz -10..20%, Kosten +5..10%, Einmaleffekte negativ |
| **Upside** | Optimistisches Szenario | Umsatz +5..10%, Kosten -5%, schnellere Forderungseinziehung |

### 4.2 Szenario-Erstellung

**Variante A: Kopie mit Modifikatoren (empfohlen)**

1. Base-Szenario wird zuerst erstellt (alle Annahmen manuell eingegeben)
2. Downside/Upside werden als Kopie des Base erstellt
3. Auf jede Annahme wird ein Szenario-Modifikator angewendet

```typescript
interface ScenarioModifier {
  categoryKey: string;        // z.B. "HZV" oder "*" für alle
  flowType: 'INFLOW' | 'OUTFLOW' | '*';
  adjustmentType: 'PERCENTAGE' | 'ABSOLUTE';
  adjustmentValue: number;    // z.B. -10 für -10%
  note: string;               // z.B. "Umsatzrückgang durch Ärzteabwanderung"
}
```

**Beispiel Downside-Modifikatoren:**

```
categoryKey: "HZV"     | adjustment: -15%  | note: "Risiko Arzt-Kündigung Eitorf"
categoryKey: "KV"      | adjustment: -10%  | note: "Leistungsrückgang"
categoryKey: "PVS"     | adjustment: -20%  | note: "Privatpatienten-Rückgang"
categoryKey: "PERSONAL"| adjustment: +5%   | note: "Überstunden durch Engpässe"
```

**Variante B: Unabhängige Annahmen**

Alternativ kann jedes Szenario eigene Annahmen haben, die nicht vom Base abgeleitet sind. Dies ist sinnvoll, wenn sich Szenarien strukturell unterscheiden (z.B. Upside enthält Praxisverkauf, Base nicht).

### 4.3 Versionierung und Nachvollziehbarkeit

Jede Änderung an einer Annahme erzwingt:

1. Erstellung einer `ForecastAssumptionVersion` (unveränderlich)
2. Pflicht-Angabe eines `changeReason`
3. Automatische Neuberechnung des Szenarios

**Audit-Fragen, die das System beantworten kann:**

- "Wann wurde die HZV-Annahme zuletzt geändert?" -- `ForecastAssumptionVersion.createdAt`
- "Warum wurde der Personalaufwand erhöht?" -- `ForecastAssumptionVersion.changeReason`
- "Wie sah die Prognose vor der Änderung aus?" -- Alte `ForecastResult` + alte Annahmen-Version
- "Auf welchen IST-Daten basiert diese Prognose?" -- `ForecastScenario.openingBalanceSource`

### 4.4 Szenario-Sperrung

Wenn ein Szenario dem IV zur Abstimmung vorgelegt wird:

1. User sperrt das Szenario (`isLocked = true`, `lockedReason = "Eingereicht bei IV am 15.02.2026"`)
2. Annahmen können nicht mehr geändert werden
3. Neuberechnung ist blockiert
4. Eine Kopie des gesperrten Szenarios kann erstellt werden, um Änderungen vorzunehmen

Dies schützt die Revisionssicherheit: Was dem IV vorgelegt wurde, bleibt unverändert.

---

## 5. UX-Konzept

### 5.1 Ansichten-Übersicht

Die Prognose wird als eigener Tab im Dashboard integriert (neben Liquiditätsmatrix, IST/PLAN-Vergleich, etc.).

```
Dashboard-Tabs:
┌──────────────────┬───────────────┬──────────────┬─────────────────┐
│ Liquiditätstab.  │ Prognose      │ Vergleich    │ Business-Logik  │
│ (Matrix)         │ (NEU)         │ (IST/PLAN)   │                 │
└──────────────────┴───────────────┴──────────────┴─────────────────┘
```

### 5.2 Tab: Prognose

#### A) Szenario-Auswahl und Kopfbereich

```
┌─────────────────────────────────────────────────────────────────────┐
│  Liquiditätsprognose                                                 │
│                                                                       │
│  Szenario: [Base Case ▼]  [Downside ▼]  [+ Neues Szenario]         │
│                                                                       │
│  IST-Daten bis: Januar 2026 (3 Perioden)                            │
│  Prognose ab: Februar 2026 (7 Perioden)                             │
│  Opening Balance: 89.775 EUR (IST-Closing Jan 26)                   │
│  Kreditlinie: 237.000 EUR (Sparkasse 137K + apoBank 100K)          │
│                                                                       │
│  Letzte Berechnung: 12.02.2026 14:30 | [Neu berechnen]             │
└─────────────────────────────────────────────────────────────────────┘
```

#### B) Forecast-Tabelle

Darstellung analog zur Liquiditätsmatrix, aber mit farblicher Unterscheidung IST vs. Forecast:

```
┌────────────────────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│                        │ Nov 25  │ Dez 25  │ Jan 26  │ Feb 26  │ Mrz 26  │
│                        │  IST    │  IST    │  IST    │ PROGNOSE│ PROGNOSE│
├────────────────────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ I. Eröffnungssaldo     │    0    │ +48.633 │+397.253 │+89.775  │+136.805 │
├────────────────────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ II. Einzahlungen       │         │         │         │         │         │
│   HZV                  │    0    │ 210.000 │ 70.000  │ 70.000  │ 210.000 │
│   KV                   │ 26.067  │  19.067 │ 53.400  │ 53.400  │ 35.600  │
│   PVS                  │    0    │    0    │ 10.000  │ 10.000  │ 10.000  │
│   Altforderungen       │ 22.567  │ 168.186 │ 30.000  │    0    │ 22.567  │
│   Sonstige             │    0    │    0    │    0    │ 11.000  │    0    │
│ = Summe Einzahlungen   │ 48.633  │ 397.253 │ 163.400 │ 144.400 │ 278.167 │
├────────────────────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ III. Auszahlungen      │         │         │         │         │         │
│   Personal             │    0    │    0    │    0    │ -62.000 │ -62.000 │
│   Betriebskosten       │ -20.250 │ -34.750 │ -34.750 │ -34.750 │ -34.750 │
│   Steuern              │    0    │    0    │    0    │    0    │    0    │
│   Insolvenzspezifisch  │    0    │ -19.500 │-107.553 │    0    │    0    │
│ = Summe Auszahlungen   │ -20.250 │ -54.250 │-142.303 │ -96.750 │ -96.750 │
├────────────────────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ IV. Liquidität         │         │         │         │         │         │
│   Netto-Cashflow       │ +28.383 │+343.003 │ +21.097 │ +47.650 │+181.417 │
│   Closing Balance      │ +28.383 │+391.636 │+412.733 │+137.425 │+318.842 │
│   + Kreditlinie        │+237.000 │+237.000 │+237.000 │+237.000 │+237.000 │
│   = Headroom           │+265.383 │+628.636 │+649.733 │+374.425 │+555.842 │
│   − Rückstellungen     │ -50.000 │ -50.000 │ -50.000 │ -50.000 │ -50.000 │
│   = Headroom (netto)   │+215.383 │+578.636 │+599.733 │+324.425 │+505.842 │
└────────────────────────┴─────────┴─────────┴─────────┴─────────┴─────────┘

Legende:
  ██ IST (Hintergrund grau)    ░░ PROGNOSE (Hintergrund blau-hell)
```

#### C) Drill-Down (Klick auf eine Zelle)

Wenn der User auf eine Forecast-Zelle klickt, öffnet sich ein Explanation-Panel:

```
┌─────────────────────────────────────────────────────────────────────┐
│  HZV | Februar 2026 | PROGNOSE                                      │
│                                                                       │
│  Betrag: 70.000 EUR                                                  │
│                                                                       │
│  Herleitung:                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ Annahme: HZV Uckerath                                          │ │
│  │ Typ: RUN_RATE (laufender Monatsbetrag)                        │ │
│  │ Basis: 40.000 EUR/Monat                                       │ │
│  │ Quelle: "Durchschnitt IST Dez 25 + Jan 26"                   │ │
│  │ Wachstum: 0%                                                   │ │
│  │ Saisonalität: Faktor 1.0 (Februar)                            │ │
│  │ → Ergebnis: 40.000 EUR                                        │ │
│  │ Version: 1 (erstellt 12.02.2026, Sonja Prinz)                │ │
│  ├─────────────────────────────────────────────────────────────────┤ │
│  │ Annahme: HZV Velbert                                           │ │
│  │ Typ: RUN_RATE                                                  │ │
│  │ Basis: 30.000 EUR/Monat                                       │ │
│  │ Quelle: "Durchschnitt IST Dez 25 + Jan 26"                   │ │
│  │ → Ergebnis: 30.000 EUR                                        │ │
│  ├─────────────────────────────────────────────────────────────────┤ │
│  │ = Summe: 70.000 EUR                                            │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  [Annahme bearbeiten]  [Versionshistorie]                            │
└─────────────────────────────────────────────────────────────────────┘
```

Wenn der User auf eine IST-Zelle klickt, wird stattdessen die bestehende Explain-Cell-Logik der Matrix angezeigt (LedgerEntry-Traces).

#### D) Szenario-Vergleichstabelle

Separater Unter-Tab oder Toggle, der alle Szenarien nebeneinander zeigt:

```
┌────────────────────┬────────────────┬────────────────┬────────────────┐
│                    │    Base Case   │   Downside     │    Upside      │
├────────────────────┼────────────────┼────────────────┼────────────────┤
│ Σ Einzahlungen     │  1.267.686 EUR │  1.077.533 EUR │  1.394.455 EUR │
│ Σ Auszahlungen     │   -884.323 EUR │   -928.539 EUR │   -840.107 EUR │
│ Σ Netto            │   +383.363 EUR │   +148.994 EUR │   +554.348 EUR │
│ Closing Aug 26     │   +383.363 EUR │   +148.994 EUR │   +554.348 EUR │
│ Min. Headroom      │   +265.383 EUR │    +85.994 EUR │   +391.348 EUR │
│ Min. Headroom (P.) │     Nov 25     │     Apr 26     │     Nov 25     │
├────────────────────┼────────────────┼────────────────┼────────────────┤
│ Bewertung          │   ✅ Stabil    │  ⚠️ Eng        │  ✅ Komfortabel│
└────────────────────┴────────────────┴────────────────┴────────────────┘
```

### 5.3 Annahmen-Editor

Eigene Ansicht zur Pflege aller Annahmen eines Szenarios.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Annahmen bearbeiten | Base Case                                     │
│                                                                       │
│  EINZAHLUNGEN                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ + HZV Uckerath     │ RUN_RATE │ 40.000 EUR/Mo │ Wachst.: 0%  │ │
│  │   Quelle: Durchschnitt IST Dez-Jan                            │ │
│  │   Gültig: Feb 26 – Apr 26 (Perioden 4-6)                     │ │
│  │   [Bearbeiten] [Deaktivieren] [Versionshistorie]              │ │
│  ├─────────────────────────────────────────────────────────────────┤ │
│  │ + HZV Velbert      │ RUN_RATE │ 30.000 EUR/Mo │ Wachst.: 0%  │ │
│  │   Quelle: Durchschnitt IST Dez-Jan                            │ │
│  ├─────────────────────────────────────────────────────────────────┤ │
│  │ + KV Uckerath      │ RUN_RATE │ 14.300 EUR/Mo │ Saisonal     │ │
│  │   Quelle: Quartalssatz 28.600 EUR / 2 Monate                 │ │
│  │   Saisonal: Quartalsmonate x1.3, andere x1.0                 │ │
│  ├─────────────────────────────────────────────────────────────────┤ │
│  │ + Inso-Einzahlung  │ ONE_TIME │ 11.000 EUR    │ Per. 3 (Feb) │ │
│  │   Quelle: Vereinbarter Zuschuss gem. Massekreditvertrag       │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  AUSZAHLUNGEN                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ − Personalaufwand  │ FIXED    │ -62.000 EUR/Mo│              │ │
│  │ − Betriebskosten   │ FIXED    │ -34.750 EUR/Mo│              │ │
│  │ − Fortführungsb.   │ % UMSATZ │ 10% + USt     │              │ │
│  │ − Rückz. InsoGeld  │ ONE_TIME │ -107.553 EUR  │ Per. 2 (Jan) │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  [+ Neue Annahme hinzufügen]                                        │
│  [Szenario sperren]  [Kopie erstellen]  [Neu berechnen]            │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.4 Annahmen-Übersicht (Audit-Sicht)

Kompakte Übersicht aller Annahmen als Druckversion / PDF-Export:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ANNAHMEN-NACHWEIS                                                   │
│  Szenario: Base Case | Stand: 12.02.2026 | Version: 3              │
│                                                                       │
│  #  Kategorie          Typ       Betrag      Quelle                 │
│  ── ───────────────── ────────── ─────────── ──────────────────────  │
│  1  HZV Uckerath      RUN_RATE  40.000/Mo   IST-Durchschnitt       │
│  2  HZV Velbert       RUN_RATE  30.000/Mo   IST-Durchschnitt       │
│  3  KV Uckerath       RUN_RATE  14.300/Mo   Quartal / 2            │
│  4  KV Velbert        RUN_RATE  39.100/Mo   KV-Bescheid Q4/25     │
│  5  PVS gesamt        RUN_RATE  10.000/Mo   IST-Durchschnitt       │
│  6  Altforderungen    Individuell  253.320   OP-Liste 05.01.26     │
│  7  Personalaufwand   FIXED     -62.000/Mo  Lohn-Journal Jan 26   │
│  8  Betriebskosten    FIXED     -34.750/Mo  IST-Durchschnitt       │
│  9  Fortführungsb.    % UMSATZ  10% + USt   Massekreditvertrag     │
│ 10  Rückz. InsoGeld   ONE_TIME  -107.553    BA-Bescheid            │
│                                                                       │
│  PARAMETER                                                           │
│  IST-Stichtag:      31. Januar 2026                                 │
│  Opening Balance:   89.775 EUR                                      │
│  Kreditlinie:       237.000 EUR (Sparkasse 137K + apoBank 100K)    │
│  Rückstellungen:    50.000 EUR (Worst-Case)                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Beispielrechnung HVPlus (Okt 2025 -- Aug 2026)

### 6.1 Rahmendaten

| Parameter | Wert | Quelle |
|-----------|------|--------|
| Planungszeitraum | Nov 2025 -- Aug 2026 (10 Monate) | LiquidityPlan.periodCount=10, MONTHLY |
| IST verfügbar bis | Januar 2026 (Perioden 0-2) | Matrix-Daten |
| Forecast ab | Februar 2026 (Perioden 3-9) | |
| Opening Balance (Feb) | 89.775 EUR | IST-Closing Jan 2026 (*) |
| Kreditlinie | 237.000 EUR | Sparkasse 137K (vereinbart) + apoBank 100K (vereinbart) |
| Rückstellungen | 50.000 EUR | InsolvencyEffect (Worst-Case) |

(*) Hinweis: Der Opening-Balance-Wert ist ein Platzhalter. Der tatsächliche Wert muss aus dem IST-Closing der Matrix-Aggregation übernommen werden, sobald alle Januar-Daten vollständig importiert sind.

### 6.2 Annahmen (Base Case)

Abgeleitet aus `Liquiditätsplanung_HVPlus_20260114_versendet.xlsx`, `case-context.json` und IST-Daten.

#### Einzahlungen

| # | Kategorie | Typ | Basis/Monat | Quelle | Perioden |
|---|-----------|-----|-------------|--------|----------|
| E1 | HZV Uckerath | RUN_RATE | 40.000 | IST-Durchschnitt + Saisonalität | Feb-Apr |
| E2 | HZV Velbert | RUN_RATE | 30.000 | IST-Durchschnitt + Saisonalität | Feb-Apr |
| E3 | KV Uckerath | RUN_RATE | 14.300 | Quartalssatz 28.600 / 2 | Feb-Apr, Jun (+Restzahlung) |
| E4 | KV Velbert | RUN_RATE | 39.100 | KV-Bescheid Q4/25 | Feb-Apr |
| E5 | KV Eitorf | RUN_RATE | 14.300 | Wie Uckerath (BSNR-basiert) | Feb-Apr |
| E6 | PVS gesamt | RUN_RATE | 10.000 | Velbert 7.500 + Uckerath/Eitorf geschätzt 2.500 | Feb-Apr |
| E7 | Altforderungen KV | Individuell | (s.u.) | OP-Debitorenliste + Q4-Regel | Dez-Apr |
| E8 | Altforderungen HZV | Individuell | (s.u.) | HAVG-Abrechnung | Dez |
| E9 | Altforderungen PVS | Individuell | (s.u.) | PVS-Aufstellung | Dez |
| E10 | Inso-Einzahlung | ONE_TIME | 11.000 | Massekreditvereinbarung | Mrz |
| E11 | KV Velbert Restz. | ONE_TIME | 59.100 | Q1/26 Restzahlung (39.100 + 20.000) | Jul |
| E12 | KV Uckerath Restz. | ONE_TIME | 19.300 | Q4/25 Restzahlung | Jun |

#### Auszahlungen

| # | Kategorie | Typ | Basis/Monat | Quelle | Perioden |
|---|-----------|-----|-------------|--------|----------|
| A1 | Personalaufwand | FIXED | -62.000 | AN-Liste: Brutto + Sozialabg. (~185K/Quartal -> ~62K/Monat) | Feb-Apr |
| A2 | Betriebskosten Velbert | FIXED | -14.000 | IST-Durchschnitt | Nov-Apr |
| A3 | Betriebskosten Uckerath | FIXED | -13.500 | IST-Durchschnitt | Nov-Apr |
| A4 | Betriebskosten Eitorf | FIXED | -7.250 | IST-Durchschnitt | Nov-Apr |
| A5 | Rückzahlung InsoGeld | ONE_TIME | -107.553 | BA-Bescheid | Jan |
| A6 | Vorfinanzierung InsoGeld | ONE_TIME | -17.500 | Vereinbarung | Dez |
| A7 | Sachaufnahme | ONE_TIME | -2.000 | Standard-Pauschale | Dez |
| A8 | Fortführungsbeitrag Sparkasse | % UMSATZ | 10% + USt | Massekreditvertrag | Feb-Aug |
| A9 | Fortführungsbeitrag apoBank | % UMSATZ | 10% + USt | Massekreditvertrag apoBank | Feb-Aug |

### 6.3 Szenario-Modifikatoren

| Kategorie | Base | Downside | Upside |
|-----------|------|----------|--------|
| HZV Einnahmen | 0% | -15% | +5% |
| KV Einnahmen | 0% | -10% | +5% |
| PVS Einnahmen | 0% | -20% | +10% |
| Altforderungen | 0% | -10% | 0% |
| Personalaufwand | 0% | +5% | -5% |
| Betriebskosten | 0% | +5% | -5% |
| Insolvenzkosten | 0% | +10% | 0% |

### 6.4 Forecast-Tabelle (Base Case, T EUR)

Perioden: Nov 25 (0) bis Aug 26 (9). IST-Perioden: 0-2 (Nov-Jan). Forecast: 3-9 (Feb-Aug).

| Zeile | Nov 25 | Dez 25 | Jan 26 | Feb 26 | Mrz 26 | Apr 26 | Mai 26 | Jun 26 | Jul 26 | Aug 26 |
|-------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|
| | IST | IST | IST | FC | FC | FC | FC | FC | FC | FC |
| **Eröffnungssaldo** | 0 | 28 | 371 | 90 | 137 | 319 | 419 | 419 | 458 | 517 |
| **Einzahlungen** | | | | | | | | | | |
| HZV | 0 | 210 | 70 | 70 | 210 | 70 | 0 | 0 | 0 | 0 |
| KV | 26 | 19 | 54 | 54 | 36 | 17 | 0 | 39 | 59 | 0 |
| PVS | 0 | 0 | 10 | 10 | 10 | 0 | 0 | 0 | 0 | 0 |
| Altforderungen | 23 | 168 | 30 | 0 | 23 | 10 | 0 | 0 | 0 | 0 |
| Sonstige/Inso | 0 | 0 | 0 | 11 | 0 | 0 | 0 | 0 | 0 | 0 |
| **Σ Einzahlungen** | **49** | **397** | **164** | **145** | **279** | **97** | **0** | **39** | **59** | **0** |
| **Auszahlungen** | | | | | | | | | | |
| Personal | 0 | 0 | 0 | -62 | -62 | -62 | 0 | 0 | 0 | 0 |
| Betriebskosten | -20 | -35 | -35 | -35 | -35 | -35 | 0 | 0 | 0 | 0 |
| Steuern | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Inso-Auszahlungen | 0 | -20 | -108 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Fortführungsbeitrag | 0 | 0 | 0 | -1 | -3 | -1 | 0 | 0 | -1 | 0 |
| **Σ Auszahlungen** | **-20** | **-55** | **-143** | **-98** | **-100** | **-98** | **0** | **0** | **-1** | **0** |
| **Netto-Cashflow** | **+28** | **+343** | **+21** | **+47** | **+179** | **-1** | **0** | **+39** | **+59** | **0** |
| **Closing Balance** | **28** | **371** | **392** | **137** | **316** | **316** | **316** | **355** | **414** | **414** |
| + Kreditlinie | 237 | 237 | 237 | 237 | 237 | 237 | 237 | 237 | 237 | 237 |
| = Headroom | 265 | 608 | 629 | 374 | 553 | 553 | 553 | 592 | 651 | 651 |
| - Rückstellungen | -50 | -50 | -50 | -50 | -50 | -50 | -50 | -50 | -50 | -50 |
| **= Headroom netto** | **215** | **558** | **579** | **324** | **503** | **503** | **503** | **542** | **601** | **601** |

### 6.5 Szenario-Vergleich (Kurzfassung, T EUR)

| Kennzahl | Base | Downside | Upside |
|----------|------|----------|--------|
| Σ Einzahlungen (Forecast) | 619 | 524 | 661 |
| Σ Auszahlungen (Forecast) | -297 | -312 | -282 |
| Netto Cashflow (Forecast) | +323 | +212 | +379 |
| Closing Balance Aug 26 | +414 | +303 | +470 |
| Min. Headroom (netto) | +215 (Nov) | +104 (Nov) | +233 (Nov) |
| Kreditlinie ausreichend | Ja | Ja | Ja |

**Bewertung:**

- **Base:** Stabile Liquiditätslage. Kreditlinie wird nicht benötigt. Schlusssaldo komfortabel.
- **Downside:** Selbst bei -15% HZV und -10% KV bleibt die Liquidität positiv. Kreditlinie bietet zusätzlichen Puffer. Engste Stelle im November (Hochlaufphase).
- **Upside:** Zusätzlicher Puffer durch höhere Einnahmen. Kaum Unterschied zu Base bei Kosten.

### 6.6 Hinweise zur Beispielrechnung

1. **IST-Werte sind Platzhalter.** Die tatsächlichen IST-Werte müssen aus der Matrix-Aggregation übernommen werden. Die hier gezeigten IST-Werte basieren auf der IV-Liquiditätsplanung, nicht auf vollständig importierten LedgerEntries.

2. **Altforderungen enden.** Ab Mai 2026 sind keine Altforderungen mehr geplant. Dies ist realistisch, da der Grossteil der Altforderungen bis Q1/2026 eingeht.

3. **Praxisbetrieb endet Q1/2026.** Die Planung zeigt ab Mai leere Monate, weil die Praxisübergabe an Übernehmer für Ende Q1/2026 geplant ist. Danach nur noch Restzahlungen (KV-Quartalsabrechnungen).

4. **Fortführungsbeitrag vereinfacht.** Die tatsächliche Berechnung (10% der eingezogenen Altforderungen zzgl. 19% USt) wird im Forecast durch die `PERCENTAGE_OF_REVENUE`-Logik abgebildet. Die hier gezeigten Werte sind gerundet.

5. **Rückstellungen sind konservativ.** Der Wert von 50.000 EUR ist ein Platzhalter. Die tatsächliche Höhe muss mit dem IV abgestimmt werden.

---

## 7. Fehlerquellen und Absicherung

### 7.1 Übersicht Fehlerquellen

| # | Fehlerquelle | Auswirkung | Absicherung |
|---|-------------|------------|-------------|
| F1 | **Falscher Opening Balance** | Gesamte Prognose verschoben | Opening Balance wird aus Matrix-IST-Closing übernommen (nicht manuell eingetippt). Quelle wird gespeichert und angezeigt. |
| F2 | **Veraltete IST-Daten** | IST-Cutoff zu früh, Forecast basiert auf altem Stand | System zeigt prominent: "IST-Daten bis: [Datum]". User muss bewusst aktualisieren. |
| F3 | **Doppelzählung IST + Forecast** | Betrag doppelt in Summe | IST-Perioden werden aus Matrix übernommen, Forecast-Perioden aus Annahmen. Strikte Trennung durch `istCutoffPeriodIndex`. Keine Überlappung möglich. |
| F4 | **Annahme vergessen** | Zeile fehlt in Forecast | Vergleich der Forecast-Summe mit Matrix-PLAN-Summe als Plausibilitätscheck. Warnung bei grosser Abweichung. |
| F5 | **Annahme doppelt** | Zeile doppelt in Forecast | `categoryKey` + `locationId` + `scenarioId` muss eindeutig sein (DB-Constraint). |
| F6 | **Falscher Annahme-Typ** | Einmaleffekt als Run-Rate (oder umgekehrt) | Annahme-Typ wird im UI erklärt. ONE_TIME-Annahmen zeigen deutlich: "Nur in Periode X". |
| F7 | **Kreditlinie überschätzt** | Headroom zu optimistisch | Kreditlinie wird aus `BankAgreement` (Status=VEREINBART) gelesen. Nur vertraglich bestätigte Kreditlinien werden berücksichtigt. |
| F8 | **Szenario-Modifikatoren kumulieren unerwartet** | Downside unrealistisch pessimistisch/optimistisch | Jeder Modifikator wird einzeln ausgewiesen. Szenario-Vergleich macht Unterschiede transparent. |
| F9 | **Rundungsfehler akkumulieren** | Centgenauigkeit geht verloren | Alle Berechnungen in Cent (BigInt). Rundung nur bei Anzeige. |
| F10 | **Annahme geändert, aber Szenario nicht neu berechnet** | Anzeige veraltet | Jede Annahmenänderung markiert das Szenario als "stale". UI zeigt: "Annahmen geändert -- Neuberechnung erforderlich". |
| F11 | **Saisonales Profil falsch konfiguriert** | HZV-Quartalsschlusszahlung fehlt | Saisonale Profile werden in der Anzeige visualisiert (Balkendiagramm). User sieht sofort, ob Monate ungleichmässig verteilt sind. |
| F12 | **IST-Import ändert Closing Balance** | Forecast-Basis verschiebt sich | Bei IST-Import wird geprüft, ob sich der Closing Balance ändert. Wenn ja: Warnung "IST-Daten aktualisiert -- Forecast-Szenarien müssen aktualisiert werden". |
| F13 | **Percentage-of-Revenue auf falsche Basis** | Fortführungsbeitrag falsch berechnet | `PERCENTAGE_OF_REVENUE` berechnet sich IMMER auf Basis der Einzahlungen derselben Periode. Die Formel wird im Berechnungs-Trace vollständig dokumentiert. |

### 7.2 Präventive Massnahmen

#### A) Automatische Plausibilitätsprüfungen

Bei jeder Neuberechnung:

1. **Balance-Konsistenz:** `closing[p] == opening[p] + net[p]` für alle Perioden
2. **Kein negativer Headroom ohne Warnung:** Wenn `headroomAfterReserves < 0` in irgendeiner Periode
3. **Vergleich mit Matrix-PLAN:** Abweichung Forecast vs. PLAN > 20% erzeugt Warnung
4. **Perioden-Lücken:** Prüfung ob Forecast-Perioden lückenlos vom IST-Cutoff bis zum Ende reichen

#### B) Pflicht-Dokumentation

- Jede Annahme hat ein Pflichtfeld `baseAmountSource` (Quellenangabe)
- Jede Änderung erfordert `changeReason`
- Jede Szenario-Sperrung erfordert `lockedReason`

#### C) Unveränderlichkeit

- IST-Perioden im Forecast sind read-only (keine manuelle Überschreibung möglich)
- Gesperrte Szenarien können nicht editiert werden
- Annahmen-Versionen sind immutable

#### D) Transparenz

- Jede Zelle erklärt sich selbst (Drill-Down)
- Kein "Black Box"-Effekt: Die Formel ist sichtbar
- Szenario-Vergleich zeigt Unterschiede
- Berechnungs-Trace (JSON) ist vollständig exportierbar

### 7.3 Abgrenzung: Was die Forecast-Engine NICHT tut

| Feature | Status | Begründung |
|---------|--------|------------|
| Automatische Trendextrapolation | **NEIN** | Kein AI, keine Heuristik. Jede Annahme wird explizit eingegeben. |
| Monte-Carlo-Simulation | **NEIN** (zukunftsfähig) | Architektur unterstützt Erweiterung, aber V1 hat keine Wahrscheinlichkeiten. |
| Automatische Szenario-Generierung | **NEIN** | Szenarien werden vom User definiert. |
| Cashflow-Optimierung | **NEIN** | Die Engine zeigt, was die Annahmen ergeben. Sie optimiert nicht. |
| Automatischer IST-Import-Trigger | **NEIN** | IST-Aktualisierung ist ein bewusster, manueller Schritt. |
| Prognose auf Einzelbuchungsebene | **NEIN** | Forecast arbeitet auf Kategorieebene, nicht auf Buchungsebene. |

---

## Anhang A: Glossar

| Begriff | Bedeutung im Forecast-Kontext |
|---------|-------------------------------|
| **IST** | Tatsächliche Bankbewegung (aus LedgerEntry, valueType=IST) |
| **PLAN** | Ursprüngliche Planung (aus LedgerEntry, valueType=PLAN) -- wird vom Forecast unabhängig gehalten |
| **Forecast** | Prognostizierter Wert auf Basis expliziter Annahmen |
| **Base Case** | Realistisches Szenario (wahrscheinlichster Verlauf) |
| **Headroom** | Closing Balance + verfügbare Kreditlinie |
| **IST-Cutoff** | Letzte Periode mit vollständigen IST-Daten |
| **Run-Rate** | Laufender Monatsbetrag (mit optionalem Wachstum/Saisonalität) |
| **Fortführungsbeitrag** | 10% (zzgl. USt) der eingezogenen Altforderungen, an die absonderungsberechtigte Bank |

## Anhang B: Erweiterungspfad

Die Architektur ist zukunftsfähig für folgende Erweiterungen (nicht Teil von V1):

1. **Sensitivitätsanalyse:** "Was passiert, wenn HZV um X% sinkt?" -- Slider-basierte Parametervariation
2. **Monte-Carlo-Simulation:** Wahrscheinlichkeitsverteilungen statt Punktwerte für Annahmen
3. **Automatische Annahmen-Initialisierung:** Vorschlag von Base-Annahmen basierend auf IST-Durchschnitt (User muss bestätigen)
4. **PDF-Export:** Forecast-Tabelle + Annahmen-Nachweis als gerichtsfähiges Dokument
5. **Historische Forecasts:** Vergleich "Was haben wir im Januar prognostiziert vs. was ist eingetreten"
6. **Wöchentliche Granularität:** `periodType=WEEKLY` für Forecast (erfordert wöchentliche Annahmen)

## Anhang C: Nächste Schritte

1. **Abstimmung** dieses Konzepts mit Sonja Prinz (Beraterin) und ggf. Hannes Rieger (IV)
2. **Validierung** der Annahmen-Struktur anhand eines zweiten Falls (Case-Agnostik prüfen)
3. **Entscheidung** über Variante A vs. B der Szenario-Erstellung (Kopie vs. unabhängig)
4. **Priorisierung:** Was ist MVP (Minimum Viable Product)?
   - MVP-Vorschlag: Base-Szenario + Annahmen-Editor + Forecast-Tabelle
   - Phase 2: Downside/Upside + Szenario-Vergleich
   - Phase 3: Drill-Down + PDF-Export
5. **Datenbank-Migration** planen (neue Tabellen auf Turso)
