# Implementierungsplan: Virtuelles Konto "Insolvenzmasse (Pre-ISK)"

**Erstellt:** 2026-02-09
**Baseline:** Commit `eb0ec5b` - Pre-Refactoring Backup
**Geschätzte Dauer:** 6-8 Stunden (inkl. Testing)

---

## Übersicht

### Phasen

```
Phase A: Schema & Foundation     [~1h]
  ├─ A1: Schema erweitern
  ├─ A2: Migration-Script (SQLite)
  ├─ A3: Seed-Data
  └─ A4: Prisma generate & db push

Phase B: Business Logic          [~1.5h]
  ├─ B1: getActiveAccountsForPeriod()
  ├─ B2: Erweitere BankAccounts-API
  └─ B3: Unit-Tests

Phase C: Data Migration          [~1h]
  ├─ C1: Oktober-Entries umhängen
  ├─ C2: Auskehrungen buchen
  └─ C3: Schuldner-Konten Status

Phase D: UI-Components           [~2h]
  ├─ D1: FlowDiagram Component
  ├─ D2: BankAccountsTab umbauen
  └─ D3: E2E-Tests

Phase E: Integration & Testing   [~1.5h]
  ├─ E1: Lokale End-to-End-Verifikation
  ├─ E2: Build-Test
  └─ E3: Manuelle Smoke-Tests

Phase F: Production-Rollout      [~1h]
  ├─ F1: Turso-Migration vorbereiten
  ├─ F2: Production-Deployment
  └─ F3: Post-Deployment-Verifikation
```

---

## PHASE A: Schema & Foundation

### A1: Schema erweitern

**Datei:** `app/prisma/schema.prisma`

**Änderung:**
```prisma
model BankAccount {
  id              String   @id @default(uuid())
  caseId          String
  locationId      String?
  bankName        String
  accountName     String
  iban            String?
  openingBalanceCents BigInt   @default(0)
  securityHolder  String?
  status          String   @default("available")
  notes           String?
  displayOrder    Int      @default(0)

  // === NEU: Temporale & Virtuelle Konten ===
  isVirtual       Boolean  @default(false)  // Virtuelles Konto (konsolidiert)
  validFrom       DateTime?                 // Ab wann gilt dieses Konto?
  validUntil      DateTime?                 // Bis wann gilt dieses Konto?

  createdAt       DateTime @default(now())
  createdBy       String
  updatedAt       DateTime @updatedAt
  updatedBy       String?

  case Case @relation(fields: [caseId], references: [id], onDelete: Cascade)
  location Location? @relation(fields: [locationId], references: [id])
  ledgerEntries LedgerEntry[]
  bankAgreements BankAgreement[]

  @@index([caseId])
  @@index([locationId])
  @@map("bank_accounts")
}
```

**Commit:**
```bash
git add prisma/schema.prisma
git commit -m "schema: Add temporal & virtual account support to BankAccount

- isVirtual: Boolean flag for virtual accounts
- validFrom/validUntil: DateTime range for temporal validity

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### A2: Migration-Script (SQLite Lokal)

**Datei:** `app/migrations/001_add_virtual_accounts.sql` (NEU)

```sql
-- Migration: Add temporal & virtual account support
-- Date: 2026-02-09
-- Database: SQLite (local dev)

-- Add columns to bank_accounts
ALTER TABLE bank_accounts ADD COLUMN isVirtual INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE bank_accounts ADD COLUMN validFrom TEXT;
ALTER TABLE bank_accounts ADD COLUMN validUntil TEXT;

-- Verify structure
SELECT sql FROM sqlite_master WHERE name = 'bank_accounts';
```

**Ausführen:**
```bash
cd app
npx prisma db push --accept-data-loss
npx prisma generate
```

**Erwartetes Ergebnis:**
```
✔ Generated Prisma Client
The database is now in sync with the Prisma schema.
```

**Rollback:**
```sql
-- Falls nötig:
ALTER TABLE bank_accounts DROP COLUMN isVirtual;
ALTER TABLE bank_accounts DROP COLUMN validFrom;
ALTER TABLE bank_accounts DROP COLUMN validUntil;
```

---

### A3: Seed-Data (Virtuelles Konto anlegen)

**Datei:** `app/scripts/seed-virtual-account.ts` (NEU)

```typescript
import prisma from "../src/lib/db";

async function seedVirtualAccount() {
  console.log("🌱 Seeding virtual account for HVPlus case...");

  // Find HVPlus case
  const hvPlusCase = await prisma.case.findFirst({
    where: { caseNumber: { contains: "362/25" } },
  });

  if (!hvPlusCase) {
    throw new Error("HVPlus case not found!");
  }

  console.log(`Found case: ${hvPlusCase.debtorName} (${hvPlusCase.id})`);

  // Create virtual account
  const virtualAccount = await prisma.bankAccount.create({
    data: {
      id: "ba-virtual-pre-isk",
      caseId: hvPlusCase.id,
      accountName: "Insolvenzmasse (Pre-ISK)",
      bankName: "Konsolidiert",
      isVirtual: true,
      validFrom: new Date("2025-10-29T00:00:00.000Z"),
      validUntil: new Date("2025-11-30T23:59:59.999Z"),
      status: "available",
      openingBalanceCents: BigInt(0),  // ✅ Start bei Null!
      displayOrder: -1,  // Zeige zuerst
      notes: "Virtuelles Konto - konsolidiert alle Schuldner-Konten vor ISK-Eröffnung (29.10 - 30.11.2025)",
      createdBy: "system",
      createdAt: new Date(),
    },
  });

  console.log(`✅ Virtual account created: ${virtualAccount.accountName}`);
  console.log(`   Valid from: ${virtualAccount.validFrom}`);
  console.log(`   Valid until: ${virtualAccount.validUntil}`);
  console.log(`   Opening balance: ${virtualAccount.openingBalanceCents} cents`);
}

seedVirtualAccount()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Ausführen:**
```bash
cd app
npx tsx scripts/seed-virtual-account.ts
```

**Erwartetes Ergebnis:**
```
🌱 Seeding virtual account for HVPlus case...
Found case: Hausärztliche Versorgung PLUS eG (2982ff26-081a-4811-8e1e-46b39e1ff757)
✅ Virtual account created: Insolvenzmasse (Pre-ISK)
   Valid from: 2025-10-29T00:00:00.000Z
   Valid until: 2025-11-30T23:59:59.999Z
   Opening balance: 0 cents
```

**Validierung:**
```bash
sqlite3 app/dev.db "SELECT accountName, isVirtual, validFrom, validUntil, openingBalanceCents/100 FROM bank_accounts WHERE isVirtual = 1;"
```

**Commit:**
```bash
git add scripts/seed-virtual-account.ts migrations/001_add_virtual_accounts.sql
git commit -m "data: Add virtual account seed script

Creates 'Insolvenzmasse (Pre-ISK)' virtual account for HVPlus case
- Valid period: 29.10.2025 - 30.11.2025
- Opening balance: 0 EUR (Start bei Null Prinzip)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### A4: Prisma Generate & Verify

```bash
cd app
npx prisma generate
npm run build  # Verifikation dass TypeScript kompiliert
```

**Erwartetes Ergebnis:**
```
✔ Generated Prisma Client
✔ Compiled successfully
```

---

## PHASE B: Business Logic

### B1: getActiveAccountsForPeriod()

**Datei:** `app/src/lib/bank-accounts/temporal-accounts.ts` (NEU)

```typescript
import type { BankAccount } from "@prisma/client";

/**
 * Filtert BankAccounts basierend auf temporaler Gültigkeit.
 *
 * Logik:
 * - Virtuelle Konten: Nur wenn Periode in [validFrom, validUntil]
 * - ISK-Konten mit validFrom: Nur ab validFrom
 * - Legacy-Konten ohne validFrom: Immer aktiv
 *
 * @param accounts - Alle BankAccounts
 * @param periodStart - Start der Periode
 * @param periodEnd - Ende der Periode (optional, nicht verwendet)
 * @returns Gefilterte Liste aktiver Konten
 */
export function getActiveAccountsForPeriod(
  accounts: BankAccount[],
  periodStart: Date,
  periodEnd?: Date
): BankAccount[] {
  return accounts.filter((acc) => {
    // Virtuelle Konten: Nur in ihrem Gültigkeitszeitraum
    if (acc.isVirtual) {
      if (!acc.validFrom || !acc.validUntil) {
        console.warn(`Virtual account ${acc.accountName} missing validFrom/validUntil!`);
        return false;
      }
      const validFrom = new Date(acc.validFrom);
      const validUntil = new Date(acc.validUntil);
      return periodStart >= validFrom && periodStart <= validUntil;
    }

    // ISK-Konten: Ab Eröffnungsdatum
    if (acc.validFrom) {
      const validFrom = new Date(acc.validFrom);
      return periodStart >= validFrom;
    }

    // Legacy: Konten ohne validFrom sind immer aktiv
    // (z.B. alte Schuldner-Konten für historische Daten)
    return true;
  });
}

/**
 * Prüft, ob ein BankAccount in einer gegebenen Periode aktiv ist.
 */
export function isAccountActiveInPeriod(
  account: BankAccount,
  periodStart: Date
): boolean {
  return getActiveAccountsForPeriod([account], periodStart).length > 0;
}
```

**Unit-Tests:** `app/__tests__/lib/bank-accounts/temporal-accounts.test.ts` (NEU)

```typescript
import { describe, it, expect } from "@jest/globals";
import { getActiveAccountsForPeriod, isAccountActiveInPeriod } from "@/lib/bank-accounts/temporal-accounts";
import type { BankAccount } from "@prisma/client";

const createMockAccount = (overrides: Partial<BankAccount>): BankAccount => ({
  id: "test-id",
  caseId: "test-case",
  locationId: null,
  bankName: "Test Bank",
  accountName: "Test Account",
  iban: null,
  openingBalanceCents: BigInt(0),
  securityHolder: null,
  status: "available",
  notes: null,
  displayOrder: 0,
  isVirtual: false,
  validFrom: null,
  validUntil: null,
  createdAt: new Date(),
  createdBy: "system",
  updatedAt: new Date(),
  updatedBy: null,
  ...overrides,
});

describe("getActiveAccountsForPeriod", () => {
  it("should return virtual account during its valid period", () => {
    const virtualAccount = createMockAccount({
      accountName: "Virtual Pre-ISK",
      isVirtual: true,
      validFrom: new Date("2025-10-29"),
      validUntil: new Date("2025-11-30"),
    });

    const octoberStart = new Date("2025-10-29");
    const result = getActiveAccountsForPeriod([virtualAccount], octoberStart);

    expect(result).toHaveLength(1);
    expect(result[0].accountName).toBe("Virtual Pre-ISK");
  });

  it("should exclude virtual account after its valid period", () => {
    const virtualAccount = createMockAccount({
      accountName: "Virtual Pre-ISK",
      isVirtual: true,
      validFrom: new Date("2025-10-29"),
      validUntil: new Date("2025-11-30"),
    });

    const decemberStart = new Date("2025-12-01");
    const result = getActiveAccountsForPeriod([virtualAccount], decemberStart);

    expect(result).toHaveLength(0);
  });

  it("should return ISK account after its opening date", () => {
    const iskAccount = createMockAccount({
      accountName: "ISK Uckerath",
      isVirtual: false,
      validFrom: new Date("2025-11-13"),
    });

    const novemberStart = new Date("2025-11-15");
    const result = getActiveAccountsForPeriod([iskAccount], novemberStart);

    expect(result).toHaveLength(1);
  });

  it("should exclude ISK account before its opening date", () => {
    const iskAccount = createMockAccount({
      accountName: "ISK Uckerath",
      isVirtual: false,
      validFrom: new Date("2025-11-13"),
    });

    const octoberStart = new Date("2025-10-29");
    const result = getActiveAccountsForPeriod([iskAccount], octoberStart);

    expect(result).toHaveLength(0);
  });

  it("should handle transition month (November)", () => {
    const virtualAccount = createMockAccount({
      id: "virt-1",
      accountName: "Virtual Pre-ISK",
      isVirtual: true,
      validFrom: new Date("2025-10-29"),
      validUntil: new Date("2025-11-30"),
    });

    const iskUckerath = createMockAccount({
      id: "isk-uck",
      accountName: "ISK Uckerath",
      validFrom: new Date("2025-11-13"),
    });

    const iskVelbert = createMockAccount({
      id: "isk-vel",
      accountName: "ISK Velbert",
      validFrom: new Date("2025-12-05"),
    });

    const novemberStart = new Date("2025-11-01");
    const result = getActiveAccountsForPeriod(
      [virtualAccount, iskUckerath, iskVelbert],
      novemberStart
    );

    // November: Virtual + ISK Uckerath (ISK Velbert noch nicht)
    expect(result).toHaveLength(2);
    expect(result.map(a => a.accountName)).toContain("Virtual Pre-ISK");
    expect(result.map(a => a.accountName)).toContain("ISK Uckerath");
    expect(result.map(a => a.accountName)).not.toContain("ISK Velbert");
  });

  it("should return legacy accounts without validFrom", () => {
    const legacyAccount = createMockAccount({
      accountName: "Sparkasse Velbert",
      isVirtual: false,
      validFrom: null,
    });

    const anyDate = new Date("2025-12-15");
    const result = getActiveAccountsForPeriod([legacyAccount], anyDate);

    expect(result).toHaveLength(1);
  });
});

describe("isAccountActiveInPeriod", () => {
  it("should return true for active account", () => {
    const account = createMockAccount({
      isVirtual: true,
      validFrom: new Date("2025-10-29"),
      validUntil: new Date("2025-11-30"),
    });

    expect(isAccountActiveInPeriod(account, new Date("2025-10-29"))).toBe(true);
  });

  it("should return false for inactive account", () => {
    const account = createMockAccount({
      isVirtual: true,
      validFrom: new Date("2025-10-29"),
      validUntil: new Date("2025-11-30"),
    });

    expect(isAccountActiveInPeriod(account, new Date("2025-12-15"))).toBe(false);
  });
});
```

**Tests ausführen:**
```bash
cd app
npm test -- temporal-accounts.test.ts
```

**Commit:**
```bash
git add src/lib/bank-accounts/temporal-accounts.ts __tests__/lib/bank-accounts/temporal-accounts.test.ts
git commit -m "feat: Add temporal account filtering logic

- getActiveAccountsForPeriod(): Filters accounts by validity period
- Supports virtual accounts (validFrom + validUntil)
- Supports ISK accounts (validFrom only)
- Legacy accounts always active

Tests: 7 test cases covering all scenarios

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### B2: Erweitere BankAccounts-API

**Datei:** `app/src/app/api/cases/[id]/bank-accounts/route.ts`

**Änderung:** Import hinzufügen + Verwendung in Loop

```typescript
// OBEN hinzufügen:
import { getActiveAccountsForPeriod } from "@/lib/bank-accounts/temporal-accounts";

// IN GET-Handler (Zeile 128-171 ersetzen):
// Berechne Perioden-Verläufe pro Konto
const accountPeriods = new Map<string, Array<{...}>>();

for (const account of accounts) {
  const periods: Array<{...}> = [];
  let runningBalance = account.openingBalanceCents;
  const lastIstDate = lastIstDatePerAccount.get(account.id);

  for (let i = 0; i < periodCount; i++) {
    const { start, end } = getPeriodDates(periodType, i, planStartDate);
    const periodLabel = generatePeriodLabel(periodType, i, planStartDate);

    // ⚠️ NEU: Prüfe ob Konto in dieser Periode aktiv ist
    const activeAccounts = getActiveAccountsForPeriod([account], start, end);
    if (activeAccounts.length === 0) {
      // Konto ist in dieser Periode NICHT aktiv → überspringen
      continue;
    }

    // Frozen-Balance-Check (wie vorher)
    if (lastIstDate && start > lastIstDate) {
      periods.push({
        periodIndex: i,
        periodLabel,
        balanceCents: runningBalance,
        isFrozen: true,
        lastUpdateDate: lastIstDate.toISOString(),
      });
      continue;
    }

    // Summiere Entries (wie vorher)
    const periodSum = ledgerEntries
      .filter((e) => {
        if (e.bankAccountId !== account.id) return false;
        const entryDate = new Date(e.transactionDate);
        return entryDate >= start && entryDate < end;
      })
      .reduce((sum, e) => sum + e.amountCents, BigInt(0));

    runningBalance += periodSum;

    periods.push({
      periodIndex: i,
      periodLabel,
      balanceCents: runningBalance,
      isFrozen: false,
    });
  }

  accountPeriods.set(account.id, periods);
}
```

**Erwartetes Verhalten:**
- **Oktober:** Nur virtuelles Konto hat Perioden-Daten
- **November:** Virtuelles Konto + ISK Uckerath (ISK Velbert noch nicht)
- **Dezember:** Nur ISK-Konten (virtuelles Konto ausgelaufen)

**Commit:**
```bash
git add src/app/api/cases/[id]/bank-accounts/route.ts
git commit -m "feat: Add temporal account filtering to BankAccounts API

Uses getActiveAccountsForPeriod() to filter accounts per period.
Virtual account only shown during valid period (Oct 29 - Nov 30).

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## PHASE C: Data Migration

### C1: Oktober-Entries umhängen

**Datei:** `app/scripts/migrate-october-entries.ts` (NEU)

```typescript
import prisma from "../src/lib/db";

async function migrateOctoberEntries() {
  console.log("📦 Migrating Oktober entries to virtual account...");

  // Find HVPlus case
  const hvPlusCase = await prisma.case.findFirst({
    where: { caseNumber: { contains: "362/25" } },
  });

  if (!hvPlusCase) {
    throw new Error("HVPlus case not found!");
  }

  // Find virtual account
  const virtualAccount = await prisma.bankAccount.findUnique({
    where: { id: "ba-virtual-pre-isk" },
  });

  if (!virtualAccount) {
    throw new Error("Virtual account not found! Run seed-virtual-account first.");
  }

  // Find all Schuldner-Konten
  const schuldnerAccounts = await prisma.bankAccount.findMany({
    where: {
      caseId: hvPlusCase.id,
      OR: [
        { accountName: { contains: "Sparkasse" } },
        { accountName: { contains: "apoBank" } },
      ],
    },
  });

  console.log(`Found ${schuldnerAccounts.length} Schuldner accounts:`);
  schuldnerAccounts.forEach(a => console.log(`  - ${a.accountName} (${a.id})`));

  // Find Oktober LedgerEntries (29.10 - 31.10.2025)
  const octoberEntries = await prisma.ledgerEntry.findMany({
    where: {
      caseId: hvPlusCase.id,
      transactionDate: {
        gte: new Date("2025-10-29T00:00:00.000Z"),
        lt: new Date("2025-11-01T00:00:00.000Z"),
      },
      bankAccountId: { in: schuldnerAccounts.map(a => a.id) },
    },
    include: {
      bankAccount: { select: { accountName: true } },
    },
  });

  console.log(`\nFound ${octoberEntries.length} Oktober entries to migrate:`);
  octoberEntries.forEach(e => {
    console.log(`  - ${e.transactionDate.toISOString().split('T')[0]}: ${e.description} (${Number(e.amountCents)/100}€) from ${e.bankAccount?.accountName}`);
  });

  // Confirm migration
  console.log(`\n⚠️  This will update ${octoberEntries.length} LedgerEntries!`);
  console.log("Press Ctrl+C to abort, or wait 5 seconds...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Migrate in transaction
  const result = await prisma.$transaction(async (tx) => {
    let updated = 0;

    for (const entry of octoberEntries) {
      const originalAccount = entry.bankAccount?.accountName || "unknown";

      await tx.ledgerEntry.update({
        where: { id: entry.id },
        data: {
          bankAccountId: virtualAccount.id,
          note: entry.note
            ? `${entry.note} [Ursprünglich: ${originalAccount}]`
            : `[Ursprünglich: ${originalAccount}]`,
        },
      });

      updated++;
    }

    return updated;
  });

  console.log(`\n✅ Migrated ${result} entries to virtual account!`);

  // Verify
  const virtualEntries = await prisma.ledgerEntry.count({
    where: {
      bankAccountId: virtualAccount.id,
      transactionDate: {
        gte: new Date("2025-10-29T00:00:00.000Z"),
        lt: new Date("2025-11-01T00:00:00.000Z"),
      },
    },
  });

  console.log(`Verification: Virtual account has ${virtualEntries} Oktober entries ✓`);
}

migrateOctoberEntries()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Ausführen:**
```bash
cd app
npx tsx scripts/migrate-october-entries.ts
```

**Erwartetes Ergebnis:**
```
📦 Migrating Oktober entries to virtual account...
Found 3 Schuldner accounts:
  - Geschäftskonto MVZ Velbert (ba-sparkasse-velbert)
  - MVZ Uckerath (Betriebskonto) (ba-apobank-uckerath)
  - HV PLUS eG (Zentrale) (ba-apobank-hvplus)

Found 47 Oktober entries to migrate:
  - 2025-10-30: KV-Abschlag Oktober (50000€) from Geschäftskonto MVZ Velbert
  - ...

⚠️  This will update 47 LedgerEntries!
Press Ctrl+C to abort, or wait 5 seconds...

✅ Migrated 47 entries to virtual account!
Verification: Virtual account has 47 Oktober entries ✓
```

**Rollback-Script:** `app/scripts/rollback-october-entries.ts`

```typescript
// Extract original account from note "[Ursprünglich: Sparkasse Velbert]"
// Update bankAccountId zurück
```

---

### C2: Auskehrungen buchen

**Datei:** `app/scripts/create-auskehrungen.ts` (NEU)

```typescript
import prisma from "../src/lib/db";

async function createAuskehrungen() {
  console.log("💸 Creating Auskehrungen (virtual → ISK)...");

  // Calculate virtual account October closing balance
  const virtualAccount = await prisma.bankAccount.findUnique({
    where: { id: "ba-virtual-pre-isk" },
    include: {
      ledgerEntries: {
        where: {
          transactionDate: {
            gte: new Date("2025-10-29T00:00:00.000Z"),
            lt: new Date("2025-11-01T00:00:00.000Z"),
          },
        },
      },
    },
  });

  if (!virtualAccount) {
    throw new Error("Virtual account not found!");
  }

  const closingBalance = virtualAccount.ledgerEntries.reduce(
    (sum, e) => sum + e.amountCents,
    virtualAccount.openingBalanceCents
  );

  console.log(`Virtual account Oktober closing balance: ${Number(closingBalance)/100}€`);

  // Split: ~47% Uckerath, ~53% Velbert (example - adjust based on real data!)
  const toUckerath = closingBalance * BigInt(47) / BigInt(100);
  const toVelbert = closingBalance - toUckerath;

  console.log(`Auskehrung an ISK Uckerath: ${Number(toUckerath)/100}€`);
  console.log(`Auskehrung an ISK Velbert: ${Number(toVelbert)/100}€`);

  // Find ISK accounts
  const iskUckerath = await prisma.bankAccount.findFirst({
    where: { accountName: "ISK Uckerath" },
  });
  const iskVelbert = await prisma.bankAccount.findFirst({
    where: { accountName: "ISK Velbert" },
  });

  if (!iskUckerath || !iskVelbert) {
    throw new Error("ISK accounts not found!");
  }

  // Create Auskehrungs-Entries in transaction
  await prisma.$transaction([
    // Virtual → ISK Uckerath (Ausgang)
    prisma.ledgerEntry.create({
      data: {
        id: "le-virt-to-uck-out",
        caseId: virtualAccount.caseId,
        bankAccountId: virtualAccount.id,
        transactionDate: new Date("2025-11-13T00:00:00.000Z"),
        description: "Auskehrung an ISK Uckerath",
        amountCents: -toUckerath,  // NEGATIV
        valueType: "IST",
        legalBucket: "NEUTRAL",
        estateAllocation: "MIXED",
        reviewStatus: "CONFIRMED",
        createdBy: "system",
        steeringTag: "INTERNE_UMBUCHUNG",  // ← Wichtig: Wird in Liqui-Tabelle ausgeblendet!
      },
    }),
    // ISK Uckerath (Eingang)
    prisma.ledgerEntry.create({
      data: {
        id: "le-virt-to-uck-in",
        caseId: virtualAccount.caseId,
        bankAccountId: iskUckerath.id,
        transactionDate: new Date("2025-11-13T00:00:00.000Z"),
        description: "Transfer von Insolvenzmasse (Pre-ISK)",
        amountCents: toUckerath,  // POSITIV
        valueType: "IST",
        legalBucket: "NEUTRAL",
        estateAllocation: "MIXED",
        reviewStatus: "CONFIRMED",
        createdBy: "system",
        steeringTag: "INTERNE_UMBUCHUNG",
      },
    }),
    // Virtual → ISK Velbert (Ausgang)
    prisma.ledgerEntry.create({
      data: {
        id: "le-virt-to-vel-out",
        caseId: virtualAccount.caseId,
        bankAccountId: virtualAccount.id,
        transactionDate: new Date("2025-12-05T00:00:00.000Z"),
        description: "Auskehrung an ISK Velbert",
        amountCents: -toVelbert,
        valueType: "IST",
        legalBucket: "NEUTRAL",
        estateAllocation: "MIXED",
        reviewStatus: "CONFIRMED",
        createdBy: "system",
        steeringTag: "INTERNE_UMBUCHUNG",
      },
    }),
    // ISK Velbert (Eingang)
    prisma.ledgerEntry.create({
      data: {
        id: "le-virt-to-vel-in",
        caseId: virtualAccount.caseId,
        bankAccountId: iskVelbert.id,
        transactionDate: new Date("2025-12-05T00:00:00.000Z"),
        description: "Transfer von Insolvenzmasse (Pre-ISK)",
        amountCents: toVelbert,
        valueType: "IST",
        legalBucket: "NEUTRAL",
        estateAllocation: "MIXED",
        reviewStatus: "CONFIRMED",
        createdBy: "system",
        steeringTag: "INTERNE_UMBUCHUNG",
      },
    }),
  ]);

  console.log("✅ Auskehrungen created!");

  // Verify: Virtual account should be neutral now
  const allVirtualEntries = await prisma.ledgerEntry.findMany({
    where: { bankAccountId: virtualAccount.id },
  });

  const finalBalance = allVirtualEntries.reduce(
    (sum, e) => sum + e.amountCents,
    virtualAccount.openingBalanceCents
  );

  console.log(`Virtual account final balance: ${Number(finalBalance)/100}€ (should be ~0)`);

  if (finalBalance !== BigInt(0)) {
    console.warn("⚠️  WARNING: Virtual account not neutral! Check Auskehrungen.");
  }
}

createAuskehrungen()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Ausführen:**
```bash
cd app
npx tsx scripts/create-auskehrungen.ts
```

**⚠️ WICHTIG:** `steeringTag: "INTERNE_UMBUCHUNG"` sorgt dafür, dass die Auskehrungen in der Liqui-Tabelle NICHT als Einnahmen/Ausgaben gezeigt werden (werden ausgefiltert in `aggregateLedgerEntries`).

---

### C3: Schuldner-Konten Status updaten

**Datei:** `app/scripts/update-schuldner-status.ts` (NEU)

```typescript
import prisma from "../src/lib/db";

async function updateSchuldnerStatus() {
  console.log("🔒 Updating Schuldner account status...");

  const hvPlusCase = await prisma.case.findFirst({
    where: { caseNumber: { contains: "362/25" } },
  });

  if (!hvPlusCase) {
    throw new Error("HVPlus case not found!");
  }

  // Update Sparkasse + apoBank HV PLUS → SECURED
  await prisma.bankAccount.updateMany({
    where: {
      caseId: hvPlusCase.id,
      accountName: {
        in: ["Geschäftskonto MVZ Velbert", "HV PLUS eG (Zentrale)"],
      },
    },
    data: {
      status: "secured",
      notes: "Gesichert durch Massekreditvertrag - nicht verfügbar für Masse",
    },
  });

  // Update apoBank Uckerath → CLOSED
  await prisma.bankAccount.updateMany({
    where: {
      caseId: hvPlusCase.id,
      accountName: "MVZ Uckerath (Betriebskonto)",
    },
    data: {
      status: "closed",
      notes: "Geschlossen im November 2025",
    },
  });

  console.log("✅ Schuldner accounts updated!");

  // Verify
  const accounts = await prisma.bankAccount.findMany({
    where: { caseId: hvPlusCase.id },
    select: { accountName: true, status: true },
  });

  console.log("\nCurrent account status:");
  accounts.forEach(a => console.log(`  - ${a.accountName}: ${a.status}`));
}

updateSchuldnerStatus()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Commit:**
```bash
git add scripts/migrate-october-entries.ts scripts/create-auskehrungen.ts scripts/update-schuldner-status.ts
git commit -m "data: Add migration scripts for virtual account

- migrate-october-entries: Move Oct entries to virtual account
- create-auskehrungen: Create transfers virtual → ISK
- update-schuldner-status: Mark old accounts as secured/closed

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## PHASE D: UI-Components

### D1: FlowDiagram Component

**Datei:** `app/src/components/dashboard/FlowDiagram.tsx` (NEU)

```typescript
"use client";

export default function FlowDiagram() {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        💡 Kontenverlauf (Oktober - Dezember 2025)
      </h3>

      <div className="flex items-center justify-center gap-4 flex-wrap">
        {/* Box 1: Schuldner-Konten */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 min-w-[200px]">
          <div className="text-sm font-semibold text-gray-700 mb-2">Oktober 2025</div>
          <div className="text-xs text-gray-600">Schuldner-Konten</div>
          <div className="text-xs text-gray-500 mt-1">
            • Sparkasse Velbert<br />
            • apoBank Uckerath
          </div>
        </div>

        {/* Arrow */}
        <div className="flex flex-col items-center">
          <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <span className="text-xs text-gray-500 mt-1">Konsolidierung</span>
        </div>

        {/* Box 2: Virtuelles Konto */}
        <div className="bg-amber-50 rounded-lg p-4 shadow-sm border-2 border-amber-300 min-w-[200px]">
          <div className="text-sm font-semibold text-amber-800 mb-2">Okt - Nov 2025</div>
          <div className="text-xs font-bold text-amber-700">Virtuelles Konto</div>
          <div className="text-xs text-amber-600 mt-1">
            "Insolvenzmasse (Pre-ISK)"
          </div>
          <div className="text-lg font-bold text-amber-900 mt-2">47.000 €</div>
        </div>

        {/* Arrow */}
        <div className="flex flex-col items-center">
          <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <span className="text-xs text-gray-500 mt-1">Auskehrung</span>
        </div>

        {/* Box 3: ISK-Konten */}
        <div className="bg-green-50 rounded-lg p-4 shadow-sm border-2 border-green-300 min-w-[200px]">
          <div className="text-sm font-semibold text-green-800 mb-2">Ab Nov/Dez 2025</div>
          <div className="text-xs font-bold text-green-700">ISK-Konten</div>
          <div className="text-xs text-green-600 mt-1">
            • ISK Velbert (ab Dez)<br />
            • ISK Uckerath (ab Nov)
          </div>
        </div>
      </div>

      {/* Legende */}
      <div className="mt-6 pt-4 border-t border-blue-200">
        <div className="text-xs text-gray-600">
          <strong>Hinweis:</strong> Das virtuelle Konto "Insolvenzmasse (Pre-ISK)" konsolidiert alle
          Oktober-Zahlungen. Im November/Dezember wurden die Salden auf die ISK-Konten ausgekehrt.
          Ab Dezember existiert nur noch die ISK-Phase.
        </div>
      </div>
    </div>
  );
}
```

---

### D2: BankAccountsTab umbauen

**Datei:** `app/src/components/dashboard/BankAccountsTab.tsx`

**Komplette Umstrukturierung** (zu lang für hier - Kern-Änderungen):

```typescript
// VORHER (Zeile 152-179): Gruppierung nach Location
const accountsByLocation: Record<string, BankAccountDetail[]> = {};
// ... Location-basierte Gruppierung

// NACHHER: Gruppierung nach Status
const iskAccounts = data.accounts.filter(a => a.accountName.startsWith("ISK") || a.accountName.includes("Insolvenzmasse"));
const schuldnerAccounts = data.accounts.filter(a => a.status === "secured" || a.status === "closed");

// Neue Struktur:
return (
  <div className="space-y-8">
    {/* Header mit Summary */}
    <SummaryCard ... />

    {/* ISK-Konten Section */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
        🏦 ISK-Konten (Verfügbar)
      </h2>
      {iskAccounts.map(acc => <AccountCard key={acc.id} account={acc} />)}
    </div>

    {/* Flussdiagramm */}
    <FlowDiagram />

    {/* Schuldner-Konten Section */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
        🔒 Schuldner-Konten (Gesichert/Geschlossen)
      </h2>
      {schuldnerAccounts.map(acc => <AccountCard key={acc.id} account={acc} />)}
    </div>

    {/* Legende */}
    <Legend />
  </div>
);
```

**Commit:**
```bash
git add src/components/dashboard/FlowDiagram.tsx src/components/dashboard/BankAccountsTab.tsx
git commit -m "feat: Redesign BankAccountsTab with virtual account support

- New structure: ISK accounts top, Schuldner accounts bottom
- FlowDiagram shows virtual account flow (Oct → Nov → ISKs)
- Removed location-based grouping, now status-based

Breaking Change: UI completely different from before

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### D3: E2E-Tests

```bash
cd app
npm test -- --testNamePattern="BankAccountsTab"
```

---

## PHASE E: Integration & Testing

### E1: Lokale End-to-End-Verifikation

```bash
cd app
npm run dev
```

**Manuell testen:**
1. Öffne `http://localhost:3000/admin/cases/hvplus/results`
2. Klicke auf Tab "Konten"
3. Prüfe:
   - ✅ ISK-Konten oben (ISK Velbert + ISK Uckerath + Virtuelles Konto?)
   - ✅ Flussdiagramm sichtbar
   - ✅ Schuldner-Konten unten (secured/closed)
4. Klicke auf Tab "Dashboard"
5. Prüfe Liqui-Tabelle:
   - ✅ Oktober: Nur virtuelles Konto aktiv?
   - ✅ November: Übergang sichtbar?
   - ✅ Dezember: Nur ISKs?

---

### E2: Build-Test

```bash
cd app
npm run build
```

**Erwartung:** ✅ Keine Fehler

---

### E3: Smoke-Tests

Manuelle Checkliste:
- ✅ Dashboard lädt
- ✅ Konten-Tab zeigt neue Struktur
- ✅ Liqui-Tabelle zeigt 3 Konten
- ✅ Zahlen stimmen (Opening/Closing Balances)

---

## PHASE F: Production-Rollout

### F1: Turso-Migration vorbereiten

**Datei:** `app/migrations/turso/001_add_virtual_accounts.sql`

```sql
-- Turso-spezifisch (libSQL)
ALTER TABLE bank_accounts ADD COLUMN isVirtual INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE bank_accounts ADD COLUMN validFrom TEXT;
ALTER TABLE bank_accounts ADD COLUMN validUntil TEXT;
```

**Ausführen via Turso CLI:**
```bash
turso db shell inso-liquiplanung-v2 < migrations/turso/001_add_virtual_accounts.sql
```

**Dann:** Seed + Migration-Scripts ausführen (analog zu lokal)

---

### F2: Production-Deployment

```bash
cd "/Users/david/Projekte/AI Terminal/Inso-Liquiplanung"
vercel --prod --yes --cwd app
```

---

### F3: Post-Deployment-Verifikation

```bash
curl https://cases.gradify.de/api/cases/hvplus/bank-accounts | jq '.accounts | length'
# Erwartung: 3 (virtuell + 2 ISKs)
```

---

## Rollback-Plan

Falls kritischer Fehler in Production:

```bash
# 1. Code-Rollback
git revert HEAD
git push origin main
vercel --prod --yes --cwd app

# 2. Datenbank-Rollback
turso db shell inso-liquiplanung-v2 < scripts/rollback-october-entries.sql

# 3. Verifikation
# Prüfe ob alte Version läuft
```

---

**FERTIG! Dokumentation komplett.**

**Nächster Schritt:** Review mit David → Dann starten wir mit Phase A!
