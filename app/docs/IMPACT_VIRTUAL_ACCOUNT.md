# Impact-Analyse: Virtuelles Konto Implementation

**Erstellt:** 2026-02-09
**Kontext:** Pre-Refactoring für "Insolvenzmasse (Pre-ISK)" virtuelles Konto
**Baseline:** Commit `eb0ec5b` - Pre-Refactoring Backup

---

## 1. Executive Summary

### Scope

**Ziel:** Einführung eines virtuellen Kontos "Insolvenzmasse (Pre-ISK)" für Oktober 2025

**Anforderungen:**
1. Virtuelles Konto für Pre-ISK Phase (Oktober 2025)
2. Auskehrungen an ISK-Konten (November/Dezember)
3. Liqui-Tabelle: 5 Konten → 3 Konten (virtuell + 2 ISKs)
4. BankAccountsTab: Neue Struktur (ISK oben, Schuldner unten, Flussdiagramm)

**Betroffene Bereiche:**
- ✅ Schema (3 neue Felder)
- ✅ Business Logic (2 Funktionen erweitert)
- ✅ API-Layer (2 Endpoints angepasst)
- ✅ UI-Components (1 Komponente umgebaut)
- ✅ Data-Migration (Oktober-Entries + Auskehrungen)

---

## 2. Schema-Changes

### 2.1 BankAccount Model

**Datei:** `prisma/schema.prisma`

```prisma
model BankAccount {
  // ... existing fields

  // === NEU: Temporale & Virtuelle Konten ===
  isVirtual   Boolean   @default(false)  // Virtuelles Konto (konsolidiert)
  validFrom   DateTime?                  // Ab wann gilt dieses Konto?
  validUntil  DateTime?                  // Bis wann gilt dieses Konto?

  // ... rest
}
```

**Neue Felder:**

| Feld | Typ | Default | Nullable | Beschreibung |
|------|-----|---------|----------|--------------|
| `isVirtual` | Boolean | `false` | Nein | Markiert virtuelles Konto (nicht real) |
| `validFrom` | DateTime | `NULL` | Ja | Konto gilt ab diesem Datum |
| `validUntil` | DateTime | `NULL` | Ja | Konto gilt bis zu diesem Datum |

**Validierungs-Regeln:**
- Falls `isVirtual = true`: MUSS `validFrom` UND `validUntil` haben
- Falls `isVirtual = false`: `validFrom`/`validUntil` OPTIONAL (für ISK-Eröffnungsdatum)

---

### 2.2 Migration Script

```sql
-- Add new columns to BankAccount
ALTER TABLE bank_accounts ADD COLUMN isVirtual INTEGER DEFAULT 0 NOT NULL;  -- SQLite: Boolean = Integer
ALTER TABLE bank_accounts ADD COLUMN validFrom TEXT;  -- SQLite: DateTime = TEXT (ISO-8601)
ALTER TABLE bank_accounts ADD COLUMN validUntil TEXT;

-- Create virtual account for HVPlus case
INSERT INTO bank_accounts (
  id,
  caseId,
  accountName,
  bankName,
  isVirtual,
  validFrom,
  validUntil,
  status,
  openingBalanceCents,
  displayOrder,
  createdAt,
  createdBy
) VALUES (
  'ba-virtual-pre-isk',
  (SELECT id FROM cases WHERE caseNumber LIKE '%362/25%'),
  'Insolvenzmasse (Pre-ISK)',
  'Konsolidiert',
  1,  -- isVirtual = true
  '2025-10-29T00:00:00.000Z',  -- validFrom
  '2025-11-30T23:59:59.999Z',  -- validUntil
  'available',
  0,  -- openingBalanceCents = 0 (Start bei Null!)
  -1, -- displayOrder (zeige zuerst)
  datetime('now'),
  'system'
);
```

**⚠️ ACHTUNG:** SQLite-spezifisch!
Für Turso (Production) müssen Datums-Werte ISO-8601 Strings sein.

---

## 3. Business Logic Changes

### 3.1 calculateBankAccountBalances()

**Datei:** `/src/lib/bank-accounts/calculate-balances.ts`

**Änderung:** KEINE
**Grund:** Funktioniert bereits korrekt - virtuelles Konto ist auch ein BankAccount

**Test:** ✅ Mit virtuellem Konto testen

---

### 3.2 Rolling Forecast (Bank-Accounts-API)

**Datei:** `/src/app/api/cases/[id]/bank-accounts/route.ts`

**Änderung:** `getActiveAccountsForPeriod()` Funktion hinzufügen

**NEU:**
```typescript
function getActiveAccountsForPeriod(
  accounts: BankAccount[],
  periodStart: Date,
  periodEnd: Date
): BankAccount[] {
  return accounts.filter(acc => {
    // Virtuelle Konten: Nur in ihrem Gültigkeitszeitraum
    if (acc.isVirtual && acc.validFrom && acc.validUntil) {
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
    return true;
  });
}
```

**Verwendung:**
```typescript
for (let i = 0; i < periodCount; i++) {
  const { start, end } = getPeriodDates(periodType, i, planStartDate);
  const activeAccounts = getActiveAccountsForPeriod(accounts, start, end);  // ← NEU

  // Berechne Balances nur für aktive Konten
  // ...
}
```

**Breaking Change:** ❌ NEIN (nur Erweiterung)

---

### 3.3 calculateOpeningBalanceByScope()

**Datei:** `/src/lib/bank-accounts/calculate-balances.ts`

**Änderung:** Virtuelles Konto MUSS in GLOBAL scope einbezogen werden

**VORHER:**
```typescript
if (scope === "GLOBAL") {
  const accounts = await prisma.bankAccount.findMany({
    where: { caseId },
    select: { openingBalanceCents: true },
  });
  return accounts.reduce((sum, acc) => sum + acc.openingBalanceCents, BigInt(0));
}
```

**NACHHER:**
```typescript
if (scope === "GLOBAL") {
  const accounts = await prisma.bankAccount.findMany({
    where: { caseId },
    select: { openingBalanceCents: true, isVirtual: true },  // ← isVirtual laden
  });
  // Virtuelles Konto wird normal mitgezählt (ist ja Teil der Insolvenzmasse)
  return accounts.reduce((sum, acc) => sum + acc.openingBalanceCents, BigInt(0));
}
```

**Breaking Change:** ❌ NEIN (nur Erweiterung)

---

## 4. API-Layer Changes

### 4.1 Dashboard-API

**Datei:** `/src/app/api/cases/[id]/dashboard/route.ts`

**Änderung:** MINIMAL
**Grund:** Opening Balance kommt aus `calculateOpeningBalanceByScope()`, das bereits angepasst wurde

**Test:** ✅ Mit virtuellem Konto + Auskehrungen testen

---

### 4.2 Bank-Accounts-API

**Datei:** `/src/app/api/cases/[id]/bank-accounts/route.ts`

**Änderung:** `getActiveAccountsForPeriod()` verwenden (siehe 3.2)

**VORHER (Zeile 79-85):**
```typescript
const accounts = await prisma.bankAccount.findMany({
  where: { caseId },
  include: { location: { select: { id: true, name: true } } },
  orderBy: { displayOrder: "asc" },
});
```

**NACHHER:**
```typescript
const accounts = await prisma.bankAccount.findMany({
  where: { caseId },
  include: { location: { select: { id: true, name: true } } },
  orderBy: { displayOrder: "asc" },
});

// ← Keine Änderung hier, Filterung erfolgt in Loop (getActiveAccountsForPeriod)
```

**Breaking Change:** ❌ NEIN

---

## 5. UI-Component Changes

### 5.1 LiquidityTable

**Datei:** `/src/components/external/LiquidityTable.tsx`

**Änderung:** ❌ KEINE
**Grund:** Zeigt nur aggregierte Zahlen, nicht die Konten

**Auswirkung:** Automatisch 3 statt 5 Konten (kommt aus API-Daten)

---

### 5.2 BankAccountsTab

**Datei:** `/src/components/dashboard/BankAccountsTab.tsx`

**Änderung:** ✅ **KOMPLETT UMGEBAUT**

**VORHER:** Gruppierung nach Location (Velbert, Uckerath/Eitorf, Zentral)

**NACHHER:** Neue Struktur

```tsx
<div className="space-y-8">
  {/* 1. Header mit Summary */}
  <SummaryCard />

  {/* 2. ISK-Konten (Verfügbar) */}
  <Section title="ISK-Konten (Verfügbar)">
    {accounts
      .filter(a => a.accountName.startsWith("ISK"))
      .map(acc => <AccountCard key={acc.id} account={acc} />)}
  </Section>

  {/* 3. Flussdiagramm */}
  <FlowDiagram />

  {/* 4. Schuldner-Konten (Gesichert/Geschlossen) */}
  <Section title="Schuldner-Konten (Gesichert/Geschlossen)">
    {accounts
      .filter(a => a.status === "secured" || a.status === "closed")
      .map(acc => <AccountCard key={acc.id} account={acc} />)}
  </Section>

  {/* 5. Legende */}
  <Legend />
</div>
```

**Neue Komponente: FlowDiagram**

```tsx
function FlowDiagram() {
  return (
    <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
      <h3>Kontenverlauf (Oktober - Dezember 2025)</h3>
      <div className="mt-4">
        {/* Visuelles Flussdiagramm */}
        <div className="flex items-center gap-4">
          <Box>Schuldner-Konten<br/>(Sparkasse, apoBank)<br/>Oktober</Box>
          <Arrow />
          <Box>Virtuelles Konto<br/>"Insolvenzmasse"<br/>47k EUR</Box>
          <Arrow />
          <Box>ISK-Konten<br/>(ISK Velbert + Uckerath)<br/>Ab Nov/Dez</Box>
        </div>
      </div>
    </div>
  );
}
```

**Breaking Change:** ✅ **JA** (UI komplett anders)
**Rollback:** Möglich (alte Komponente bleibt in Git)

---

## 6. Data Migration

### 6.1 Oktober-Entries umhängen

**Aktuell:** Oktober-Buchungen liegen auf Sparkasse/apoBank

**Neu:** Müssen auf virtuelles Konto umgehängt werden

```sql
-- Finde alle Oktober-LedgerEntries
SELECT id, description, amountCents, bankAccountId
FROM ledger_entries
WHERE caseId = (SELECT id FROM cases WHERE caseNumber LIKE '%362/25%')
  AND transactionDate >= '2025-10-29T00:00:00.000Z'
  AND transactionDate < '2025-11-01T00:00:00.000Z';

-- Update: Hänge an virtuelles Konto
UPDATE ledger_entries
SET bankAccountId = 'ba-virtual-pre-isk',
    note = COALESCE(note, '') || ' [Ursprünglich: ' ||
           (SELECT accountName FROM bank_accounts WHERE id = ledger_entries.bankAccountId) || ']'
WHERE id IN (SELECT id FROM ... -- siehe oben);
```

**⚠️ RISIKO:** Datenverlust, wenn Update fehlschlägt
**Mitigation:** Backup VOR Migration, Transaction mit Rollback

---

### 6.2 Auskehrungen buchen

**November 2025:** Virtuelles Konto → ISK Uckerath (13.11.2025)

```sql
-- Auskehrung vom virtuellen Konto (Ausgang)
INSERT INTO ledger_entries (
  id, caseId, bankAccountId, transactionDate,
  description, amountCents, valueType, legalBucket,
  estateAllocation, reviewStatus, createdBy
) VALUES (
  'le-virt-to-uck-out',
  (SELECT id FROM cases WHERE caseNumber LIKE '%362/25%'),
  'ba-virtual-pre-isk',  -- Virtuelles Konto
  '2025-11-13T00:00:00.000Z',
  'Auskehrung an ISK Uckerath',
  -2200000,  -- -22.000 EUR (NEGATIV = Ausgang)
  'IST',
  'NEUTRAL',
  'MIXED',  -- Enthält Alt+Neu
  'CONFIRMED',
  'system'
);

-- Auskehrung an ISK Uckerath (Eingang)
INSERT INTO ledger_entries (
  id, caseId, bankAccountId, transactionDate,
  description, amountCents, valueType, legalBucket,
  estateAllocation, reviewStatus, createdBy
) VALUES (
  'le-virt-to-uck-in',
  (SELECT id FROM cases WHERE caseNumber LIKE '%362/25%'),
  (SELECT id FROM bank_accounts WHERE accountName = 'ISK Uckerath'),
  '2025-11-13T00:00:00.000Z',
  'Transfer von Insolvenzmasse (Pre-ISK)',
  2200000,  -- +22.000 EUR (POSITIV = Eingang)
  'IST',
  'NEUTRAL',
  'MIXED',
  'CONFIRMED',
  'system'
);
```

**Analog für ISK Velbert** (05.12.2025, 25.000 EUR)

**Validierung:** Virtuelles Konto Closing Balance = 0 EUR nach Auskehrungen ✓

---

### 6.3 Schuldner-Konten Status updaten

```sql
-- Markiere alte Konten als SECURED/CLOSED
UPDATE bank_accounts
SET status = 'secured',
    notes = 'Gesichert durch Massekreditvertrag - nicht verfügbar für Masse'
WHERE caseId = (SELECT id FROM cases WHERE caseNumber LIKE '%362/25%')
  AND accountName IN ('Geschäftskonto MVZ Velbert', 'HV PLUS eG (Zentrale)');

UPDATE bank_accounts
SET status = 'closed',
    notes = 'Geschlossen im November 2025'
WHERE caseId = (SELECT id FROM cases WHERE caseNumber LIKE '%362/25%')
  AND accountName = 'MVZ Uckerath (Betriebskonto)';
```

---

## 7. Testing Strategy

### 7.1 Unit-Tests

**Neu zu erstellen:**

```typescript
// __tests__/lib/bank-accounts/calculate-balances.test.ts
describe("calculateBankAccountBalances with virtual accounts", () => {
  it("should include virtual account in total balance", async () => {
    // Test: Virtuelles Konto wird mitgezählt
  });

  it("should exclude virtual account after validUntil", async () => {
    // Test: Virtuelles Konto nach validUntil nicht mehr aktiv
  });
});

// __tests__/lib/bank-accounts/temporal-accounts.test.ts
describe("getActiveAccountsForPeriod", () => {
  it("should return only virtual account for October", () => {
    // Test: Oktober → nur virtuelles Konto
  });

  it("should return ISK accounts for December", () => {
    // Test: Dezember → nur ISK-Konten
  });

  it("should handle transition month (November)", () => {
    // Test: November → virtuelles Konto + ISK Uckerath
  });
});
```

---

### 7.2 Integration-Tests

```typescript
// __tests__/api/cases/bank-accounts.test.ts
describe("GET /api/cases/[id]/bank-accounts with virtual account", () => {
  it("should return 3 accounts for HVPlus case", async () => {
    const response = await fetch("/api/cases/hvplus/bank-accounts");
    expect(response.accounts).toHaveLength(3);
    expect(response.accounts.map(a => a.accountName)).toEqual([
      "Insolvenzmasse (Pre-ISK)",
      "ISK Velbert",
      "ISK Uckerath",
    ]);
  });

  it("should show frozen balance for October periods", async () => {
    // Test: Frozen-Balance für virtuelles Konto in späteren Perioden
  });
});
```

---

### 7.3 E2E-Tests (Screenshot)

```typescript
// __tests__/e2e/bank-accounts-tab.spec.ts
test("BankAccountsTab should show new structure", async ({ page }) => {
  await page.goto("/admin/cases/hvplus/results");
  await page.click('text="Konten"');  // Tab wechseln

  // Prüfe: ISK-Konten-Section vorhanden
  await expect(page.locator('h3:has-text("ISK-Konten")')).toBeVisible();

  // Prüfe: Flussdiagramm vorhanden
  await expect(page.locator('text="Kontenverlauf"')).toBeVisible();

  // Prüfe: Schuldner-Konten-Section vorhanden
  await expect(page.locator('h3:has-text("Schuldner-Konten")')).toBeVisible();

  // Screenshot
  await page.screenshot({ path: "screenshots/bank-accounts-new.png" });
});
```

---

## 8. Rollback-Strategy

### 8.1 Schema-Rollback

```sql
-- Remove new columns
ALTER TABLE bank_accounts DROP COLUMN isVirtual;
ALTER TABLE bank_accounts DROP COLUMN validFrom;
ALTER TABLE bank_accounts DROP COLUMN validUntil;

-- Delete virtual account
DELETE FROM bank_accounts WHERE id = 'ba-virtual-pre-isk';
```

### 8.2 Data-Rollback

```sql
-- Restore Oktober-Entries zu Schuldner-Konten
UPDATE ledger_entries
SET bankAccountId = (
  -- Extract original bankAccountId from note
  -- "[Ursprünglich: Sparkasse Velbert]" → ba-sparkasse-velbert
),
    note = REPLACE(note, ' [Ursprünglich: ...]', '')
WHERE note LIKE '%Ursprünglich:%';

-- Delete Auskehrungs-Entries
DELETE FROM ledger_entries WHERE id IN (
  'le-virt-to-uck-out', 'le-virt-to-uck-in',
  'le-virt-to-vel-out', 'le-virt-to-vel-in'
);
```

### 8.3 Code-Rollback

```bash
git revert <commit-hash>
# ODER
git reset --hard eb0ec5b  # Zurück zu Backup-Stand
```

---

## 9. Risk Assessment

### 9.1 Technische Risiken

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Daten-Migration fehlschlägt | Mittel | HOCH | Transaction + Rollback-Script |
| Frozen-Balance falsch | Niedrig | Mittel | Unit-Tests + manuelle Verifikation |
| BankAccountsTab UI-Bug | Mittel | Niedrig | E2E-Tests + Rollback möglich |
| Turso vs SQLite Diff | Hoch | Mittel | Beide DBs testen vor Rollout |

### 9.2 Fachliche Risiken

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Oktober-Zahlen falsch | Niedrig | HOCH | Manuelle Validierung mit IV-Daten |
| Auskehrungs-Beträge falsch | Mittel | HOCH | Berechnung dokumentieren + prüfen |
| Virtuelles Konto verwirrt User | Niedrig | Mittel | Gute UI-Erklärung (Flussdiagramm) |

---

## 10. Success Criteria

### 10.1 Funktionale Kriterien

- ✅ Liqui-Tabelle zeigt 3 Konten (virtuell + 2 ISKs)
- ✅ BankAccountsTab zeigt neue Struktur (ISK oben, Schuldner unten)
- ✅ Virtuelles Konto October Closing Balance = Summe Auskehrungen
- ✅ ISK-Konten Opening Balances = 0 EUR
- ✅ Alle Oktober-Zahlen identisch mit Vorher (nur Konten-Zuordnung ändert sich)

### 10.2 Technische Kriterien

- ✅ Alle Tests bestehen (Unit, Integration, E2E)
- ✅ Build erfolgreich (npm run build)
- ✅ Schema-Migration erfolgreich (lokal + Turso)
- ✅ Keine TypeScript-Fehler
- ✅ Performance: Keine spürbare Verlangsamung

### 10.3 Dokumentations-Kriterien

- ✅ ARCHITECTURE_BANK_ACCOUNTS.md aktualisiert
- ✅ CHANGELOG.md mit Änderungen
- ✅ case-context.json mit virtuellen Konten dokumentiert
- ✅ Migration-Script dokumentiert

---

## 11. Betroffene Dateien (Übersicht)

### Schema & Migrations

- ✅ `prisma/schema.prisma` - 3 neue Felder
- ✅ `migrations/YYYYMMDD_add_virtual_accounts.sql` - NEU

### Business Logic

- ✅ `/src/lib/bank-accounts/calculate-balances.ts` - Minimal erweitert
- ✅ `/src/app/api/cases/[id]/bank-accounts/route.ts` - `getActiveAccountsForPeriod()`

### UI Components

- ✅ `/src/components/dashboard/BankAccountsTab.tsx` - KOMPLETT UMGEBAUT
- ✅ `/src/components/dashboard/FlowDiagram.tsx` - NEU

### Tests

- ✅ `__tests__/lib/bank-accounts/*.test.ts` - NEU (mind. 3 Files)
- ✅ `__tests__/api/cases/bank-accounts.test.ts` - NEU
- ✅ `__tests__/e2e/bank-accounts-tab.spec.ts` - NEU

### Dokumentation

- ✅ `docs/ARCHITECTURE_BANK_ACCOUNTS.md` - Aktualisiert
- ✅ `docs/CHANGELOG.md` - Neuer Eintrag
- ✅ `Cases/HVPlus/case-context.json` - Virtuelles Konto dokumentiert

**GESAMT:** ~15 Dateien betroffen (5 geändert, 10 neu)

---

**Nächster Schritt:** Implementierungsplan erstellen
