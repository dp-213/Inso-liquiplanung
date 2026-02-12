# System-Architektur

**Version:** 2.26.0
**Stand:** 12. Februar 2026

---

## Übersicht

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ADMIN DASHBOARD                              │
│                         /admin/*                                     │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐│
│   │  Fälle   │  │  Ledger  │  │  Rules   │  │Stammdaten│  │Freigab.││
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘│
└────────┼─────────────┼─────────────┼─────────────┼──────────────────┘
         │             │             │             │
         v             v             v             v
┌─────────────────────────────────────────────────────────────────────┐
│                           API LAYER                                  │
│                           /api/*                                     │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│   │   Intake     │  │   Ledger     │  │Classification│             │
│   │   API        │  │   API        │  │   Engine     │             │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
└──────────┼─────────────────┼─────────────────┼──────────────────────┘
           │                 │                 │
           v                 v                 v
┌─────────────────────────────────────────────────────────────────────┐
│                        LEDGER ENTRY                                  │
│                   (Single Source of Truth)                          │
│                                                                      │
│   Jede Buchung ist ein LedgerEntry mit:                            │
│   - Betrag, Datum, Beschreibung                                     │
│   - Steuerungsdimensionen (valueType, legalBucket)                 │
│   - Dimensionen (bankAccount, counterparty, location)              │
│   - Governance (reviewStatus, audit trail)                         │
│   - Klassifikations-Vorschläge (suggested*)                        │
└─────────────────────────────────────────────────────────────────────┘
           │
           v
┌─────────────────────────────────────────────────────────────────────┐
│                      CALCULATION ENGINE                              │
│                      (Shared Aggregation Layer)                     │
│                                                                      │
│   lib/liquidity-matrix/aggregate.ts                                │
│   - Aggregiert LedgerEntries nach Dimensionen                      │
│   - traceMode=false → Matrix-API (nur Zahlen)                     │
│   - traceMode=true  → Explain-Cell-API (Zahlen + EntryTrace[])    │
│                                                                      │
│   lib/liquidity-matrix/explain.ts                                  │
│   - Baut 4-Ebenen-Erklärung aus Trace-Daten                       │
│   - Liest Beschreibungen aus matrix-config.ts (ADR-031)            │
│   - Deterministisch, auditierbar, unveränderlich                   │
└─────────────────────────────────────────────────────────────────────┘
           │
           v
┌─────────────────────────────────────────────────────────────────────┐
│                     EXTERNE ANSICHT                                  │
│                     /view/[token]                                    │
│                     /portal/*                                        │
│                     /submit/[token] (Freigabe-Formular)             │
│                                                                      │
│   Read-Only Dashboards für Insolvenzverwalter                       │
│   + Einreichungsformular für Bestell-/Zahlfreigaben                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Kern-Datenmodell

### LedgerEntry (Single Source of Truth)

```prisma
model LedgerEntry {
  id                String   @id @default(cuid())
  caseId            String

  // Kern-Daten
  transactionDate   DateTime
  amountCents       BigInt
  description       String
  note              String?

  // Steuerungsdimensionen
  valueType         String   // IST | PLAN
  legalBucket       String   // MASSE | ABSONDERUNG | NEUTRAL | UNKNOWN

  // === SERVICE DATE / PERIOD (für Alt/Neu-Splitting) ===
  serviceDate         DateTime?  // Leistungsdatum
  servicePeriodStart  DateTime?  // Beginn Leistungszeitraum
  servicePeriodEnd    DateTime?  // Ende Leistungszeitraum

  // === ESTATE ALLOCATION (Alt/Neu-Masse) ===
  estateAllocation    String?    // ALTMASSE | NEUMASSE | MIXED | UNKLAR
  estateRatio         Decimal?   // Bei MIXED: Anteil Neumasse (0.0-1.0)

  // === ALLOCATION SOURCE (Revisionssprache) ===
  allocationSource    String?    // VERTRAGSREGEL | SERVICE_DATE_RULE | etc.
  allocationNote      String?    // Audit-Trail

  // === SPLIT REFERENCE ===
  parentEntryId       String?    // Bei Split: Referenz auf Original
  splitReason         String?

  // Dimensionen (finale Werte)
  bankAccountId     String?
  counterpartyId    String?
  locationId        String?

  // Klassifikations-Vorschläge (von Rule Engine)
  suggestedLegalBucket      String?
  suggestedCategory         String?
  suggestedConfidence       Float?
  suggestedRuleId           String?
  suggestedReason           String?
  suggestedBankAccountId    String?
  suggestedCounterpartyId   String?
  suggestedLocationId       String?

  // ServiceDate-Vorschläge (Phase C - für Alt/Neu-Zuordnung)
  suggestedServiceDate          DateTime?
  suggestedServicePeriodStart   DateTime?
  suggestedServicePeriodEnd     DateTime?
  suggestedServiceDateRule      String?   // VORMONAT | SAME_MONTH | PREVIOUS_QUARTER

  // Governance
  reviewStatus      String   // UNREVIEWED | CONFIRMED | ADJUSTED
  reviewedBy        String?
  reviewedAt        DateTime?
  reviewNote        String?

  // Import-Herkunft (Lineage)
  importSource      String?
  importJobId       String?
  importFileHash    String?
  importRowNumber   Int?

  // Audit
  createdAt         DateTime @default(now())
  createdBy         String
  updatedAt         DateTime @updatedAt
}
```

### BankAgreement (Bankvereinbarungen)

```prisma
model BankAgreement {
  id                  String    @id
  caseId              String
  bankAccountId       String

  // Status
  agreementStatus     String    // OFFEN | VERHANDLUNG | VEREINBART
  agreementDate       DateTime?
  agreementNote       String?

  // Globalzession
  hasGlobalAssignment Boolean   @default(false)

  // Fortführungsbeitrag (nur wenn vereinbart!)
  contributionRate    Decimal?  // z.B. 0.10 für 10%
  contributionVatRate Decimal?  // z.B. 0.19

  // Massekredit-Cap (nur wenn vertraglich festgelegt!)
  creditCapCents      BigInt?

  // Unsicherheit explizit markieren
  isUncertain         Boolean   @default(true)
  uncertaintyNote     String?
}
```

### Classification Rule

**WICHTIG: Regeln arbeiten auf ImportContext.normalized, NICHT auf LedgerEntry!**

```prisma
model ClassificationRule {
  id           String  @id @default(cuid())
  caseId       String
  name         String

  // Matching auf NORMALIZED Fields (nicht auf LedgerEntry!)
  matchField   String  // NORMALIZED: bezeichnung | standort | counterpartyHint | arzt | kategorie | etc.
  matchType    String  // CONTAINS | STARTS_WITH | ENDS_WITH | EQUALS | REGEX | AMOUNT_RANGE
  matchValue   String

  // Zuweisung bei Match (diese Werte gehen ins LedgerEntry)
  suggestedLegalBucket  String?
  assignBankAccountId   String?
  assignCounterpartyId  String?
  assignLocationId      String?

  // ServiceDate-Regel (Phase C - für Alt/Neu-Zuordnung)
  assignServiceDateRule String?  // VORMONAT | SAME_MONTH | PREVIOUS_QUARTER

  // Steuerung
  priority        Int     @default(100)  // Niedrigere Zahl = höhere Priorität
  confidenceBonus Float   @default(0)
  isActive        Boolean @default(true)
}
```

**Beispiel-Regeln:**

```typescript
// Regel: Wenn standort = "Velbert" → Standort + Bankkonto zuweisen
{
  matchField: 'standort',       // normalized Key!
  matchType: 'EQUALS',
  matchValue: 'Velbert',
  assignLocationId: 'uuid-velbert',
  assignBankAccountId: 'uuid-sparkasse'
}

// Regel: Wenn counterpartyHint enthält "KV" → Gegenpartei zuweisen
{
  matchField: 'counterpartyHint',  // normalized Key!
  matchType: 'CONTAINS',
  matchValue: 'KV',
  assignCounterpartyId: 'uuid-kv-nordrhein'
}
```

### Stammdaten

```prisma
model BankAccount {
  id        String  @id @default(cuid())
  caseId    String
  name      String
  iban      String?
  bankName  String?
}

model Counterparty {
  id           String  @id @default(cuid())
  caseId       String
  name         String
  type         String  // CREDITOR | DEBITOR | OTHER
  matchPattern String? // Regex für Auto-Detection
}

model Location {
  id      String  @id @default(cuid())
  caseId  String
  name    String
  address String?
}
```

---

## Datenfluss

### Import-Architektur (3-Ebenen-Trennung)

**WICHTIG: Strikte Trennung zwischen Import-Kontext und LedgerEntry!**

```
┌─────────────────────────────────────────────────────────────────┐
│                     EXCEL / CSV DATEI                           │
│  Spalten variieren: "Standort", "Praxis", "Filiale", etc.      │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Upload
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                     IMPORT CONTEXT                              │
│                     (temporär, review-bezogen)                  │
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────────────┐           │
│  │ raw             │    │ normalized               │           │
│  │ (original Excel)│ →  │ (stabile fachliche Keys) │           │
│  │ "Standort"="Vel"│    │ standort = "Velbert"     │           │
│  │ "Praxis"="..."  │    │ counterpartyHint = "KV"  │           │
│  └─────────────────┘    └──────────────────────────┘           │
│                                    │                            │
│                         ┌──────────↓─────────┐                  │
│                         │   REGEL-ENGINE     │                  │
│                         │   arbeitet NUR     │                  │
│                         │   auf normalized   │                  │
│                         └────────┬───────────┘                  │
│                                  │                              │
│                         Ergebnis: locationId, bankAccountId,    │
│                         counterpartyId, legalBucket             │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Commit (nur IDs!)
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                     LEDGER ENTRY                                │
│                     (fachliches Ergebnis)                       │
│                                                                 │
│  NUR fachliche Werte:                                          │
│  - locationId, bankAccountId, counterpartyId                   │
│  - estateAllocation, allocationSource, allocationNote          │
│  - KEINE Excel-Spalten, KEINE Rohdaten                         │
│                                                                 │
│  → Stabil, revisionssicher, fachlich sauber                    │
└─────────────────────────────────────────────────────────────────┘
```

#### Architektur-Regeln (STRIKT!)

1. **KEINE Original-Excel-Spalten im Ledger speichern**
   - LedgerEntry bleibt fachliches Zielmodell
   - Keine Felder wie `rawStandort`, `excelColumnX`

2. **Regeln arbeiten NUR auf normalized, NIE auf LedgerEntry**
   - `ClassificationRule.matchField` referenziert normalized Keys
   - Erlaubt: `standort`, `counterpartyHint`, `bezeichnung`, `arzt`, etc.
   - Siehe: `/lib/import/normalized-schema.ts`

3. **Normalisierung vor Regelanwendung**
   - Unterschiedliche Excel-Spalten werden auf stabile Keys gemappt
   - "Standort", "Praxis", "Filiale" → `standort`
   - "Debitor", "Auftraggeber", "Kreditor" → `counterpartyHint`

4. **LedgerEntry erhält nur Ergebnisse**
   - `locationId` (nicht "Standort")
   - `bankAccountId` (nicht "Konto")
   - `allocationNote` für Audit-Trail

### Normalized Import Schema

```typescript
// /lib/import/normalized-schema.ts
interface NormalizedImportContext {
  // Core (immer vorhanden)
  datum: string;
  betrag: number;
  bezeichnung: string;

  // Dimensionen (aus variablen Excel-Spalten gemappt)
  standort?: string;          // ← "Standort", "Praxis", "Filiale"
  counterpartyHint?: string;  // ← "Debitor", "Auftraggeber", "Kreditor"
  arzt?: string;              // ← "Arzt", "Behandler"
  zeitraum?: string;          // ← "Zeitraum", "Abrechnungszeitraum"
  kategorie?: string;         // ← "Kategorie", "Buchungsart"
  kontoname?: string;         // ← "Kontoname", "Konto"
  krankenkasse?: string;      // ← "Krankenkasse", "Kostenträger"
}
```

### Import-Flow (Detailliert)

```
1. UPLOAD
   CSV/Excel hochladen → IngestionJob erstellen

2. PARSE
   Datei parsen → IngestionRecord pro Zeile (mit rawData)

3. NORMALIZE
   normalizeImportData(rawData) → NormalizedImportContext
   - Variable Spaltennamen → stabile Keys
   - Automatisches Mapping + manuelle Überschreibungen

4. APPLY RULES
   applyRules(normalized, rules) → ClassificationResult
   - Regeln matchen auf normalized Fields
   - Ergebnis: assignLocationId, assignBankAccountId, etc.

5. CREATE LEDGER ENTRY
   Nur Ergebnisse übertragen:
   - locationId = ruleResult.assignLocationId
   - bankAccountId = ruleResult.assignBankAccountId
   - allocationNote = "Regel: Standort Velbert"
   - KEINE raw Data!

6. REVIEW (Manual)
   User prüft im Import/Review UI:
   - Sieht: Excel-Spalten + normalized + Regel-Vorschläge
   - Bestätigt/Anpasst Zuordnungen
   - Im Ledger sichtbar: nur fachliches Ergebnis

7. AGGREGATE
   markAggregationStale() → Neuberechnung
```

### Review-Flow

```
LedgerEntry (UNREVIEWED)
        │
        ├─── suggestedLegalBucket = "MASSE"
        ├─── suggestedCounterpartyId = "cp_123"
        │
        v
    [User Review]
        │
        ├─── Bestätigen → legalBucket = "MASSE", reviewStatus = "CONFIRMED"
        ├─── Anpassen → legalBucket = "NEUTRAL", reviewStatus = "ADJUSTED"
        └─── Dimensionen übernehmen → counterpartyId = "cp_123"
```

---

## API-Struktur

### Ledger APIs

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/cases/[id]/ledger` | GET | Alle LedgerEntries (mit Filtern) |
| `/api/cases/[id]/ledger` | POST | Neuen Eintrag erstellen |
| `/api/cases/[id]/ledger/[entryId]` | GET/PUT/DELETE | Einzelner Eintrag |
| `/api/cases/[id]/ledger/bulk-review` | POST | Massen-Review |
| `/api/cases/[id]/intake` | POST | Vereinfachter Import |

### Stammdaten APIs

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/cases/[id]/bank-accounts` | GET/POST | Bankkonten |
| `/api/cases/[id]/counterparties` | GET/POST | Gegenparteien |
| `/api/cases/[id]/locations` | GET/POST | Standorte |

### Analyse APIs

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/cases/[id]/kontobewegungen` | GET | IST-Buchungen gruppiert nach Kontentyp/Standort/Monat |
| `/api/cases/[id]/zahlungsverifikation` | GET | SOLL/IST-Abgleich pro Planungsperiode mit Ampel |

### Klassifikation APIs

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/cases/[id]/rules` | GET/POST | Klassifikationsregeln |
| `/api/cases/[id]/classify` | POST | Manuell neu klassifizieren |

---

## Verzeichnisstruktur

```
/app
├── src/
│   ├── app/
│   │   ├── admin/                    # Admin-Dashboard
│   │   │   ├── cases/[id]/
│   │   │   │   ├── ledger/           # Zahlungsregister
│   │   │   │   ├── rules/            # Klassifikationsregeln
│   │   │   │   ├── bank-accounts/    # Bankkonten
│   │   │   │   ├── counterparties/   # Gegenparteien
│   │   │   │   ├── kontobewegungen/ # IST-Daten nach Kontentyp/Monat/Standort
│   │   │   │   ├── zahlungsverifikation/ # SOLL/IST-Abgleich
│   │   │   │   └── locations/        # Standorte
│   │   │   └── ...
│   │   ├── portal/                   # Kundenportal
│   │   ├── view/                     # Externe Ansicht
│   │   └── api/                      # API-Routen
│   │       └── cases/[id]/
│   │           ├── ledger/
│   │           ├── intake/
│   │           ├── rules/
│   │           └── ...
│   ├── components/                   # React-Komponenten
│   └── lib/
│       ├── db.ts                     # Prisma Client
│       ├── auth.ts                   # Session-Handling
│       ├── ledger/                   # Ledger-Logik
│       │   └── aggregation.ts
│       ├── classification/           # Rule Engine
│       │   ├── engine.ts
│       │   └── types.ts
│       ├── types/                    # Zentrale Type-Definitionen
│       │   └── allocation.ts         # Estate Allocation, AllocationSource
│       ├── cases/                    # Case-spezifische Konfigurationen
│       │   └── haevg-plus/           # HAEVG PLUS eG
│       │       └── config.ts         # Abrechnungsstellen, Banken, Split-Regeln
│       ├── settlement/               # Settlement-Logik
│       │   └── split-engine.ts       # Alt/Neu-Splitting
│       ├── credit/                   # Massekredit-Logik
│       │   └── calculate-massekredit.ts
│       └── calculation-engine.ts     # Berechnungen
├── prisma/
│   └── schema.prisma                 # Datenbank-Schema
├── scripts/                          # Utility-Skripte
│   ├── sanity-check-allocation.ts    # Alt/Neu-Allokation testen
│   ├── create-hvplus-service-date-rules.ts  # ServiceDate-Regeln erstellen
│   └── run-classification.ts         # Klassifikation auf Einträge anwenden
└── docs/                             # Dokumentation
    ├── CHANGELOG.md                  # Versionshistorie
    ├── ARCHITECTURE.md               # Diese Datei
    ├── DECISIONS.md                  # ADRs (Architektur-Entscheidungen)
    ├── LIMITATIONS.md                # Bekannte Einschränkungen
    ├── TODO.md                       # Offene Features + Bugs
    ├── TODO_REFACTORING.md           # Refactoring-Plan (zurückgestellt)
    ├── ADMIN_SYSTEM.md               # Vollständige Admin-Doku
    ├── DASHBOARD_BEST_PRACTICES.md   # W&P-Report Analyse
    └── archiv/                       # Archivierte One-Off-Docs
        └── INDEX.md                  # Inhaltsverzeichnis
```

---

## Technologie-Stack

| Komponente | Technologie | Version |
|------------|-------------|---------|
| Framework | Next.js | 15+ (App Router) |
| Sprache | TypeScript | 5+ |
| Datenbank | Turso (libSQL) | - |
| ORM | Prisma | 6+ |
| UI | Tailwind CSS | 4+ |
| Charts | Recharts | 2+ |
| Deployment | Vercel | - |

---

## Kernprinzipien

1. **LedgerEntry als Single Source of Truth**
   - Alle Buchungen sind LedgerEntries
   - Keine separate Kategorien/Zeilen-Hierarchie für Datenerfassung
   - Kategorien nur für Präsentation

2. **Vorschläge statt Auto-Commit**
   - Rule Engine erstellt nur Vorschläge (suggested*)
   - User muss explizit bestätigen
   - IST-Werte werden niemals automatisch committed

3. **Deterministische Berechnungen**
   - Keine KI, keine Heuristiken, keine Vorhersagen
   - Gleiche Eingaben = Gleiche Ausgaben
   - Auditierbar für Gerichte

4. **Immutable Calculation Engine**
   - Präsentationsschicht ändert nie Berechnungslogik
   - Calculation Engine ist "Black Box"
   - Konfiguration nur für Darstellung

5. **IST vor PLAN (IST-Vorrang)**
   - Wenn IST-Daten für eine Periode existieren, werden PLAN-Daten ignoriert
   - Bankbewegungen sind Realität – Planung ist nur historisch relevant
   - Vergleich zwischen IST und PLAN in separatem Tab

---

## IST/PLAN-Datenmodell

### valueType: Die fundamentale Unterscheidung

Jeder `LedgerEntry` hat ein `valueType`-Feld, das angibt ob es sich um reale oder geplante Daten handelt:

| valueType | Bedeutung | Quelle | Beispiel |
|-----------|-----------|--------|----------|
| **IST** | Reale Bankbewegung | Kontoauszug, Zahlungseingang | "KV-Zahlung 15.000€ am 15.11." |
| **PLAN** | Geplanter Wert | Prognose, Budget | "Erwartete KV-Zahlung ~15.000€ Nov" |

### Wann IST, wann PLAN?

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATENQUELLEN                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  KONTOAUSZUG / BANKBEWEGUNGEN              PLANUNGSTABELLE       │
│  ─────────────────────────────             ──────────────────    │
│  - Tatsächliche Zahlungen                  - Erwartete Werte     │
│  - Mit Buchungsdatum                       - Pro Periode         │
│  - Exakte Beträge                          - Geschätzte Beträge  │
│                                                                  │
│           │                                       │              │
│           │ valueType = IST                       │ valueType =  │
│           │                                       │ PLAN         │
│           v                                       v              │
│      ┌─────────────────────────────────────────────────┐        │
│      │              LEDGER ENTRY                        │        │
│      │         (Single Source of Truth)                 │        │
│      └─────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### IST-Vorrang-Logik (Dashboard)

**Problem:** Was passiert, wenn für eine Periode sowohl IST als auch PLAN existiert?

**Lösung:** IST hat Vorrang!

```typescript
// Voranalyse: Welche Perioden haben IST-Daten?
const periodsWithIst = new Set<number>();
for (const entry of entries) {
  if (entry.valueType === 'IST') {
    periodsWithIst.add(getPeriodIndex(entry.transactionDate));
  }
}

// Aggregation: PLAN ignorieren wenn IST existiert
for (const entry of entries) {
  if (entry.valueType === 'PLAN' && periodsWithIst.has(periodIdx)) {
    planIgnoredCount++;
    continue;  // PLAN-Entry überspringen
  }
  // ... normale Aggregation
}
```

**Auswirkungen:**

| Daten in Periode | Angezeigte Quelle | Badge |
|------------------|-------------------|-------|
| Nur PLAN | PLAN-Werte | "PLAN" |
| Nur IST | IST-Werte | "IST" |
| IST + PLAN | Nur IST-Werte | "IST" |

### Dashboard-Ansichten

| Ansicht | IST-Vorrang? | Verwendung |
|---------|--------------|------------|
| **Liquiditätstabelle** | ✅ Ja | Zeigt aktuelle Realität |
| **Rolling Forecast** | ✅ Ja | IST für Vergangenheit, PLAN für Zukunft |
| **IST/PLAN-Vergleich** | ❌ Nein | Zeigt beide Werte nebeneinander |
| **Business-Logik** | ➖ N/A | Fallspezifische Vertragsregeln, Zahlungslogik |

#### Business-Logik-Tab

**Zweck:** Fallspezifische Business-Logik für Insolvenzverwalter visualisieren

**Komponente:** `/components/business-logic/BusinessLogicContent.tsx`

**Integration:** Tab im Unified Dashboard (Admin + Portal)

**Inhalt (am Beispiel HVPlus):**
- Patientenarten & Abrechnungswege (GKV: KV+HZV, PKV: PVS)
- Abrechnungszyklen mit Timelines (KV: Leistung → Abschlag 80% → Rest 20%)
- Alt/Neu-Regeln mit visuellen Split-Balken (Q4/2025: 1/3 Alt, 2/3 Neu)
- Zahlungsströme zu ISK-Konten (Velbert vs. Uckerath)
- LANR-Übersicht (Ärzte mit HZV-Volumina)
- Bankverbindungen & Massekredit-Status
- Offene Punkte mit Priorisierung

**Design-Prinzipien:**
- Konservativ, faktisch, vertrauenserweckend (kein Marketing-Stil)
- Fallspezifisch (keine generischen InsO-Erklärungen)
- Vertragsbezüge für Auditierbarkeit (z.B. "Massekreditvertrag §1(2)a")
- Dezente Visualisierungen (Timeline, Flow, Split-Balken)

### IST/PLAN-Vergleich (separater Tab)

Der Vergleichs-Tab zeigt BEIDE Werte, ohne IST-Vorrang:

```
┌────────┬──────────────┬──────────────┬──────────────┐
│ Periode│ IST Netto    │ PLAN Netto   │ Abweichung   │
├────────┼──────────────┼──────────────┼──────────────┤
│ Nov 25 │  +45.000 €   │  +42.000 €   │   +3.000 €   │
│ Dez 25 │  +38.000 €   │  +40.000 €   │   -2.000 €   │
│ Jan 26 │      -       │  +35.000 €   │      -       │
└────────┴──────────────┴──────────────┴──────────────┘
```

**Interpretation:**
- **Positive Abweichung bei Einnahmen:** Mehr eingenommen als geplant ✅
- **Negative Abweichung bei Einnahmen:** Weniger eingenommen als geplant ⚠️
- **Positive Abweichung bei Ausgaben:** Mehr ausgegeben als geplant ⚠️
- **Negative Abweichung bei Ausgaben:** Weniger ausgegeben als geplant ✅

---

## Dateneingabe-Richtlinien

### WICHTIG: valueType richtig setzen!

| Datenquelle | valueType | Beispiele |
|-------------|-----------|-----------|
| **Kontoauszug** | `IST` | Bankbewegungen, Zahlungseingänge, Abbuchungen |
| **Kassenexport** | `IST` | Tatsächliche Bareinnahmen/-ausgaben |
| **Planung/Budget** | `PLAN` | Erwartete Zahlungen, Prognosen |
| **Hochrechnung** | `PLAN` | Geschätzte zukünftige Werte |

### Import-Checkliste

Beim Datenimport immer prüfen:

1. **[ ] valueType korrekt?**
   - Kontoauszug → `IST`
   - Planung/Prognose → `PLAN`

2. **[ ] Datum korrekt?**
   - IST: Tatsächliches Buchungsdatum
   - PLAN: Erwartetes Zahlungsdatum (Periodenmitte oder -anfang)

3. **[ ] Keine Doppelungen?**
   - IST und PLAN für denselben Vorgang? → PLAN löschen wenn IST kommt
   - Oder: IST-Vorrang-Logik nutzt automatisch nur IST

4. **[ ] reviewStatus beachten?**
   - Default: `UNREVIEWED`
   - Erst nach Prüfung: `CONFIRMED` oder `ADJUSTED`
   - Dashboard (Default): Nur `CONFIRMED` + `ADJUSTED` anzeigen

### Typische Import-Szenarien

**Szenario 1: Monatsweise Planung + Kontoauszug**
```
1. Import PLAN-Daten für alle Monate (Jan-Dez)
2. Import IST-Daten aus Kontoauszug (Jan-Mrz)
3. Dashboard zeigt:
   - Jan-Mrz: IST-Werte (PLAN ignoriert)
   - Apr-Dez: PLAN-Werte
4. Vergleichs-Tab zeigt: IST vs PLAN für Jan-Mrz
```

**Szenario 2: Laufende Aktualisierung**
```
1. Bereits: IST für Nov, Dez + PLAN für Jan-Aug
2. Neuer Kontoauszug: IST für Januar
3. Import IST für Januar
4. Dashboard:
   - Nov-Jan: IST (automatisch, durch IST-Vorrang)
   - Feb-Aug: PLAN
```

**Szenario 3: Korrektur der Planung**
```
1. Bereits: PLAN für alle Monate
2. Erkenntnis: Q1-Planung war zu optimistisch
3. Optionen:
   a) PLAN-Einträge anpassen (reviewStatus = ADJUSTED)
   b) Neue Version des Plans erstellen
   c) Abweichung im Vergleichs-Tab dokumentieren
```
