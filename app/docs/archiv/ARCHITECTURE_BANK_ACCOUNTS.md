# Architektur-Dokumentation: BankAccounts & Rolling Forecast

**Erstellt:** 2026-02-09
**Kontext:** Pre-Refactoring Analyse für "Virtuelles Konto (Pre-ISK)" Implementation
**Status:** Architektur-Snapshot vor Änderungen

---

## 1. Übersicht

### Aktueller Stand

Das System verwaltet Liquiditätsplanungen für Insolvenzfälle mit:
- **BankAccounts:** Bankkonten mit Opening Balances
- **LedgerEntries:** Buchungen (IST + PLAN) als Single Source of Truth
- **Rolling Forecast:** Perioden-basierte Balance-Berechnung
- **Location-Scopes:** Standort-spezifische Filterung (Velbert, Uckerath/Eitorf)

### Kern-Prinzipien

1. **Opening Balance + IST-Ledger = Current Balance**
2. **Perioden-basiert:** WEEKLY (Kalenderwochen) oder MONTHLY (Monate)
3. **Scope-aware:** GLOBAL oder standort-spezifisch
4. **Frozen Balances:** Wenn keine IST-Daten, wird letzte Balance eingefroren

---

## 2. Datenmodell (Prisma Schema)

### 2.1 BankAccount

```prisma
model BankAccount {
  id                  String   @id @default(uuid())
  caseId              String
  locationId          String?  // Optional - null = zentrales Konto
  bankName            String   // z.B. "Sparkasse HRV"
  accountName         String   // z.B. "Geschäftskonto MVZ Velbert"
  iban                String?
  openingBalanceCents BigInt   @default(0)  // ⚠️ KRITISCH für Rolling Forecast
  securityHolder      String?  // z.B. "Globalzession Bank XY"
  status              String   @default("available")  // available, blocked, restricted, secured, disputed
  notes               String?
  displayOrder        Int      @default(0)
  createdAt           DateTime @default(now())
  createdBy           String
  updatedAt           DateTime @updatedAt
  updatedBy           String?

  // Relations
  case              Case           @relation(...)
  location          Location?      @relation(...)
  ledgerEntries     LedgerEntry[]  // ⚠️ KRITISCH: Alle Buchungen für dieses Konto
  bankAgreements    BankAgreement[]

  @@index([caseId])
  @@index([locationId])
}
```

**Wichtige Felder:**
- `openingBalanceCents`: Start-Balance VOR allen Ledger-Buchungen
- `locationId`: Zuordnung zu Standort (null = zentral)
- `status`: Steuert, ob Konto als "available" gezählt wird

**Was FEHLT (für virtuelles Konto):**
- ❌ `isVirtual: Boolean` - Flag für virtuelle Konten
- ❌ `validFrom: DateTime` - Ab wann gilt dieses Konto?
- ❌ `validUntil: DateTime` - Bis wann gilt dieses Konto?

---

### 2.2 LedgerEntry

```prisma
model LedgerEntry {
  id              String   @id
  caseId          String
  bankAccountId   String   // ⚠️ KRITISCH: Zuordnung zu BankAccount
  transactionDate DateTime // ⚠️ KRITISCH: Für Perioden-Zuordnung
  amountCents     BigInt   // Positiv = Einzahlung, Negativ = Auszahlung
  valueType       String   // IST, PLAN
  description     String
  counterpartyId  String?
  locationId      String?
  legalBucket     String   // MASSE, ABSONDERUNG, NEUTRAL
  estateAllocation String  // ALTMASSE, NEUMASSE, MIXED, UNKLAR
  reviewStatus    String   // UNREVIEWED, CONFIRMED, ADJUSTED
  // ... weitere Felder
}
```

**Wichtig für Balance-Berechnung:**
- `bankAccountId`: Zuordnung zu Konto
- `transactionDate`: Welche Periode?
- `valueType`: IST oder PLAN
- `amountCents`: Betrag (positiv/negativ)

---

## 3. Berechnungslogik

### 3.1 Bank Account Balance Calculation

**Datei:** `/src/lib/bank-accounts/calculate-balances.ts`

```typescript
export async function calculateBankAccountBalances(
  caseId: string,
  bankAccounts: { id: string; openingBalanceCents: bigint; status: string }[]
): Promise<CaseBankBalances>
```

**Logik:**
```
Für jedes BankAccount:
  1. Lade alle LedgerEntries mit valueType=IST
  2. Summiere: ledgerSum = SUM(amountCents)
  3. Berechne: currentBalance = openingBalance + ledgerSum
  4. Falls status !== "blocked": addiere zu totalAvailable
```

**Output:**
```typescript
{
  balances: Map<accountId, { openingBalanceCents, ledgerSumCents, currentBalanceCents }>,
  totalBalanceCents: bigint,
  totalAvailableCents: bigint  // Nur nicht-gesperrte Konten
}
```

---

### 3.2 Rolling Forecast (Perioden-basiert)

**Datei:** `/src/app/api/cases/[id]/bank-accounts/route.ts` (Zeile 128-171)

```typescript
// Für jedes BankAccount und jede Periode:
let runningBalance = account.openingBalanceCents;  // START

for (let i = 0; i < periodCount; i++) {
  const { start, end } = getPeriodDates(periodType, i, planStartDate);

  // Frozen-Balance-Check
  if (lastIstDate && start > lastIstDate) {
    periods.push({
      balanceCents: runningBalance,  // EINGEFROREN!
      isFrozen: true,
      lastUpdateDate: lastIstDate.toISOString(),
    });
    continue;
  }

  // Summiere IST-Entries in dieser Periode
  const periodSum = ledgerEntries
    .filter(e => e.bankAccountId === account.id && entryDate in [start, end))
    .reduce((sum, e) => sum + e.amountCents, BigInt(0));

  runningBalance += periodSum;  // Akkumuliere

  periods.push({
    periodIndex: i,
    periodLabel: generatePeriodLabel(periodType, i, planStartDate),
    balanceCents: runningBalance,
    isFrozen: false,
  });
}
```

**Frozen-Balance-Logik:**
- Wenn Periode NACH letztem IST-Datum liegt → Balance "einfrieren"
- Zeigt letzten bekannten Stand (verhindert künstliche Hochrechnung)

---

### 3.3 Perioden-Berechnung

**Datei:** `/src/lib/ledger-aggregation.ts`

```typescript
export function getPeriodDates(
  periodType: PeriodType,
  periodIndex: number,
  planStartDate: Date
): { start: Date; end: Date }
```

**Logik:**
- **WEEKLY:** `start = planStartDate + (periodIndex * 7 Tage)`
- **MONTHLY:** `start = planStartDate.setMonth(+periodIndex)`

```typescript
export function generatePeriodLabel(
  periodType: PeriodType,
  periodIndex: number,
  startDate: Date
): string
```

**Output:**
- **WEEKLY:** `"KW 44"`, `"KW 45"`, ...
- **MONTHLY:** `"Okt 25"`, `"Nov 25"`, ...

---

## 4. API-Layer

### 4.1 Dashboard-API

**Endpoint:** `GET /api/cases/[id]/dashboard?scope=GLOBAL`

**Query-Parameter:**
- `scope`: GLOBAL | LOCATION_VELBERT | LOCATION_UCKERATH_EITORF

**Ablauf:**
1. Lade Case + aktiver Plan + LedgerEntries
2. Berechne `openingBalanceCents` BY SCOPE (scope-aware!)
3. Falls LedgerEntries vorhanden:
   - `aggregateLedgerEntries()` → gruppiert nach Perioden
   - `convertToLegacyFormat()` → für Frontend-Kompatibilität
4. Falls keine LedgerEntries:
   - `calculateLiquidityPlan()` → alte Logik (CashflowCategory/Line)

**Response:**
```typescript
{
  case: { caseNumber, debtorName, ... },
  plan: { periodType, periodCount, planStartDate, ... },
  calculation: {
    openingBalanceCents: string,
    periods: Array<{
      periodIndex: number,
      periodLabel: string,
      openingBalanceCents: string,
      totalInflowsCents: string,
      totalOutflowsCents: string,
      netCashflowCents: string,
      closingBalanceCents: string,
      inflowsAltmasseCents: string,
      inflowsNeumasseCents: string,
      // ...
    }>,
    categories: Array<{ categoryName, flowType, periodTotals, lines, ... }>,
    // ...
  },
  estateAllocation: { totalAltmasseInflowsCents, ... },
  // ...
}
```

---

### 4.2 Bank-Accounts-API

**Endpoint:** `GET /api/cases/[id]/bank-accounts`

**Ablauf:**
1. Lade BankAccounts mit Location-Relation
2. Lade ALLE IST-LedgerEntries für Case
3. Für jedes Konto:
   - `calculateBankAccountBalances()` → currentBalance
   - Rolling Forecast über alle Perioden
   - Frozen-Balance-Check
4. Gruppiere nach Location

**Response:**
```typescript
{
  accounts: Array<{
    id: string,
    bankName: string,
    accountName: string,
    iban: string | null,
    status: string,
    location: { id, name } | null,
    openingBalanceCents: string,
    ledgerSumCents: string,
    currentBalanceCents: string,
    periods: Array<{
      periodIndex: number,
      periodLabel: string,
      balanceCents: string,
      isFrozen?: boolean,
      lastUpdateDate?: string,
    }>,
  }>,
  summary: {
    totalBalanceCents: string,
    totalAvailableCents: string,
    accountCount: number,
  },
  planInfo: { periodType, periodCount },
}
```

---

## 5. UI-Komponenten

### 5.1 LiquidityTable

**Datei:** `/src/components/external/LiquidityTable.tsx`

**Props:**
```typescript
{
  weeks: Week[],  // Perioden
  categories: Category[],
  openingBalance: bigint,
  showLineItems?: boolean,
  compact?: boolean,
  periodSources?: ("IST" | "PLAN" | "MIXED")[],
}
```

**Struktur:**
```
┌────────────────────┬──────┬──────┬──────┬───────┐
│ Position           │ W1   │ W2   │ W3   │ Summe │
├────────────────────┼──────┼──────┼──────┼───────┤
│ Anfangsbestand     │  0 € │ 47k €│ 89k €│   -   │
│ Einzahlungen       │ 75k €│ 95k €│120k €│ 290k €│
│ Auszahlungen       │-28k €│-53k €│-94k €│-175k €│
│ Netto-Cashflow     │ 47k €│ 42k €│ 26k €│ 115k €│
│ Endbestand         │ 47k €│ 89k €│115k €│ 115k €│
└────────────────────┴──────┴──────┴──────┴───────┘
```

**Wichtig:**
- Zeigt NICHT die Konten (nur aggregierte Zahlen)
- Categories sind nach flowType gruppiert (INFLOW/OUTFLOW)
- ändert sich NICHT beim Refactoring (nur die Datenquelle!)

---

### 5.2 BankAccountsTab

**Datei:** `/src/components/dashboard/BankAccountsTab.tsx`

**Ablauf:**
1. Fetch `/api/cases/[id]/bank-accounts`
2. Gruppiere Accounts nach Location:
   ```typescript
   accountsByLocation: Record<"Velbert" | "Uckerath/Eitorf" | "Zentral", BankAccountDetail[]>
   ```
3. Für jedes Konto: Horizontale Perioden-Tabelle

**Gruppierungs-Logik (Zeile 152-179):**
```typescript
if (!acc.location) {
  locationKey = "Zentral";
} else {
  const locName = acc.location.name.toLowerCase();
  if (locName.includes("velbert")) locationKey = "Velbert";
  else if (locName.includes("uckerath") || locName.includes("eitorf")) locationKey = "Uckerath/Eitorf";
  else locationKey = "Zentral";
}
```

**⚠️ Hier muss für virtuelles Konto angepasst werden:**
- Neue Struktur: ISK-Konten oben, Schuldner-Konten unten
- Kein Location-Grouping mehr, sondern Status-Grouping

---

## 6. Kritische Abhängigkeiten

### 6.1 Schema-Abhängigkeiten

```
BankAccount
  ↓
  ├─ Case (FK: caseId)
  ├─ Location (FK: locationId) - Optional
  ├─ LedgerEntry[] (Reverse: bankAccountId)
  └─ BankAgreement[] (Reverse: bankAccountId)
```

### 6.2 Berechnungs-Abhängigkeiten

```
calculateBankAccountBalances()
  ↓
  ├─ Liest: BankAccount.openingBalanceCents
  ├─ Aggregiert: LedgerEntry WHERE valueType=IST
  └─ Output: currentBalanceCents, totalAvailableCents
```

```
Rolling Forecast (Bank-Accounts-API)
  ↓
  ├─ getPeriodDates() - Berechnet Perioden-Grenzen
  ├─ generatePeriodLabel() - Erstellt Labels (KW/Monat)
  ├─ Filter: LedgerEntry WHERE transactionDate in [start, end)
  └─ Frozen-Balance-Check: Falls Periode > lastIstDate
```

---

## 7. Aktuelle Limitationen

### 7.1 Keine temporalen Konten

❌ **Problem:** Konten existieren IMMER für alle Perioden
✅ **Lösung:** `validFrom` / `validUntil` Felder

### 7.2 Keine virtuellen Konten

❌ **Problem:** Alle Konten sind "real" (Bank-Konten)
✅ **Lösung:** `isVirtual` Flag

### 7.3 Location-basierte Gruppierung

❌ **Problem:** BankAccountsTab gruppiert nach Location
✅ **Lösung:** Neue Gruppierung nach Status (ISK vs Schuldner)

---

## 8. Test-Abdeckung

### Bestehende Tests

❌ **KEINE Tests gefunden** für:
- `calculateBankAccountBalances()`
- Rolling Forecast Logik
- Frozen-Balance-Mechanismus
- BankAccountsTab Gruppierung

⚠️ **RISIKO:** Refactoring ohne Tests ist gefährlich!

### Benötigte Tests (für Refactoring)

1. **Unit-Tests:**
   - `calculateBankAccountBalances()` mit virtuellen Konten
   - `getPeriodDates()` / `generatePeriodLabel()`
   - Frozen-Balance-Logik

2. **Integration-Tests:**
   - Bank-Accounts-API mit virtuellen Konten
   - Dashboard-API mit scope + virtuellen Konten

3. **E2E-Tests:**
   - BankAccountsTab Rendering (ISK oben, Schuldner unten)
   - LiquidityTable mit 3 statt 5 Konten

---

## 9. Zusammenfassung

### Architektur-Stärken ✅

1. **Saubere Trennung:** BankAccount (Struktur) vs LedgerEntry (Daten)
2. **Scope-aware:** GLOBAL / Location-spezifisch funktioniert gut
3. **Rolling Forecast:** Mathematisch korrekt implementiert
4. **Frozen Balances:** Intelligent (verhindert künstliche Hochrechnung)

### Verbesserungsbedarf ⚠️

1. **Temporale Konten:** Fehlt (brauchen `validFrom`/`validUntil`)
2. **Virtuelle Konten:** Fehlt (`isVirtual` Flag)
3. **Tests:** Fehlen komplett
4. **Gruppierung:** Location-basiert → muss auf Status-basiert umgestellt werden

---

**Nächste Schritte:** Impact-Analyse + Implementierungsplan
