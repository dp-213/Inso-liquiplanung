# System-Architektur

**Version:** 2.2.0
**Stand:** 20. Januar 2026

---

## Übersicht

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ADMIN DASHBOARD                              │
│                         /admin/*                                     │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│   │  Fälle   │  │  Ledger  │  │  Rules   │  │Stammdaten│           │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
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
│                      (Aggregation Layer)                            │
│                                                                      │
│   - Aggregiert LedgerEntries nach Dimensionen                      │
│   - Berechnet Liquiditätsübersicht (13 Wochen/Monate)              │
│   - Deterministisch, auditierbar, unveränderlich                   │
└─────────────────────────────────────────────────────────────────────┘
           │
           v
┌─────────────────────────────────────────────────────────────────────┐
│                     EXTERNE ANSICHT                                  │
│                     /view/[token]                                    │
│                     /portal/*                                        │
│                                                                      │
│   Read-Only Dashboards für Insolvenzverwalter                       │
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
│   └── sanity-check-allocation.ts    # Alt/Neu-Allokation testen
└── docs/                             # Dokumentation
    ├── CHANGELOG.md
    ├── ARCHITECTURE.md               # Diese Datei
    ├── DECISIONS.md
    └── LIMITATIONS.md
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
