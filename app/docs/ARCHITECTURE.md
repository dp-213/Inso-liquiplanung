# System-Architektur

**Version:** 2.1.0
**Stand:** 19. Januar 2026

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

### Classification Rule

```prisma
model ClassificationRule {
  id           String  @id @default(cuid())
  caseId       String
  name         String

  // Matching
  matchField   String  // description | bookingReference | amountCents
  matchType    String  // CONTAINS | STARTS_WITH | ENDS_WITH | EQUALS | REGEX | AMOUNT_RANGE
  matchValue   String

  // Vorschläge bei Match
  suggestedLegalBucket  String?
  suggestedCategory     String?

  // Dimensions-Zuweisung bei Match
  assignBankAccountId   String?
  assignCounterpartyId  String?
  assignLocationId      String?

  // Steuerung
  priority        Int     @default(100)
  confidenceBonus Float   @default(0)
  isActive        Boolean @default(true)
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

### Import-Flow

```
1. UPLOAD
   CSV/Excel hochladen → IngestionJob erstellen

2. PARSE
   Datei parsen → IngestionRecord pro Zeile

3. MAP
   Spalten-Mapping → Werte extrahieren

4. VALIDATE
   Datum/Betrag prüfen → Fehler sammeln

5. CREATE LEDGER ENTRIES
   LedgerEntry erstellen mit:
   - reviewStatus = UNREVIEWED
   - legalBucket = UNKNOWN
   - Alle suggested* = null

6. CLASSIFY
   classifyBatch() ausführen:
   - Rules matchen → Vorschläge setzen
   - matchCounterpartyPatterns() → Gegenpartei-Vorschläge

7. REVIEW (Manual)
   User prüft Vorschläge:
   - Bestätigt → reviewStatus = CONFIRMED
   - Anpasst → reviewStatus = ADJUSTED
   - Übernimmt Dimensionen → bankAccountId etc.

8. AGGREGATE
   markAggregationStale() → Neuberechnung triggern
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
│       └── calculation-engine.ts     # Berechnungen
├── prisma/
│   └── schema.prisma                 # Datenbank-Schema
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
