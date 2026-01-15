# Canonical Domain Model and Calculation Specification
## 13-Week Insolvency Liquidity Planning Engine

**Version:** 1.0.0
**Status:** Authoritative Reference
**Last Updated:** 2026-01-15

---

## Table of Contents

1. [Overview](#1-overview)
2. [Core Domain Concepts](#2-core-domain-concepts)
3. [Canonical Data Model](#3-canonical-data-model)
4. [Calculation Specification](#4-calculation-specification)
5. [Edge Cases and Test Scenarios](#5-edge-cases-and-test-scenarios)
6. [Appendices](#appendices)

---

## 1. Overview

### 1.1 Purpose

This document defines the authoritative specification for a deterministic 13-week liquidity planning engine for German insolvency proceedings. It serves as the single source of truth for:

- Data structures and their constraints
- Calculation logic and formulas
- Validation rules and business constraints
- Test scenarios and expected behaviors

### 1.2 Design Principles

| Principle | Description |
|-----------|-------------|
| **Determinism** | Given identical inputs, the engine MUST produce identical outputs. No randomness, no heuristics, no AI. |
| **Auditability** | Every calculation must be traceable and explainable to a court. |
| **Simplicity** | Minimal viable complexity. No features beyond liquidity calculation and display. |
| **Correctness** | Mathematical precision with explicit rounding rules. |
| **Safety** | Input validation and constraints prevent misuse. |

### 1.3 Scope

**In Scope:**
- 13-week rolling liquidity forecast with weekly granularity
- IST (actual) vs PLAN (planned) value separation
- Altmasse (old estate) vs Neumasse (new estate) separation
- Cash inflows and outflows by category
- Running liquidity balance calculation
- Version history and audit trail

**Out of Scope:**
- Daily granularity (optional future enhancement)
- Predictions, forecasts, or AI-assisted planning
- Legal interpretations or recommendations
- Integration with banking systems
- Multi-currency support (EUR only)

---

## 2. Core Domain Concepts

### 2.1 Glossary

| Term | German | Definition |
|------|--------|------------|
| Liquidity Plan | Liquiditaetsplan | 13-week forecast of cash inflows and outflows |
| Week | Kalenderwoche (KW) | ISO 8601 calendar week, the primary time unit |
| IST | IST (Actual) | Confirmed, realized values based on bank statements or verified transactions |
| PLAN | PLAN (Planned) | Projected values based on estimates, contracts, or expectations |
| Altmasse | Old Estate | Assets and liabilities existing before insolvency opening (Eroeffnung) |
| Neumasse | New Estate | Assets and liabilities arising after insolvency opening |
| Inflow | Einzahlung | Cash received into the insolvency estate |
| Outflow | Auszahlung | Cash paid out from the insolvency estate |
| Opening Balance | Anfangsbestand | Liquidity at the start of a period |
| Closing Balance | Endbestand | Liquidity at the end of a period |
| Insolvency Case | Insolvenzverfahren | The legal proceeding this plan belongs to |

### 2.2 Time Model

```
Planning Horizon: 13 weeks (rolling)
Week Definition: ISO 8601 (Monday to Sunday)
Week Numbering: YYYY-Www (e.g., 2026-W03)
Rolling Behavior: Week 1 is always the current week at plan generation time
```

### 2.3 Value Classification Matrix

|                | **Altmasse** | **Neumasse** |
|----------------|--------------|--------------|
| **IST**        | Confirmed old estate transactions | Confirmed new estate transactions |
| **PLAN**       | Expected old estate transactions | Expected new estate transactions |

All four quadrants must be tracked separately and can be aggregated for reporting.

---

## 3. Canonical Data Model

### 3.1 Entity Relationship Overview

```
InsolvencyCase (1) ----< (N) LiquidityPlan
LiquidityPlan  (1) ----< (N) LiquidityPlanVersion
LiquidityPlan  (1) ----< (N) CashflowCategory
CashflowCategory (1) ----< (N) CashflowLine
CashflowLine   (1) ----< (13) WeeklyValue
```

### 3.2 Entity: InsolvencyCase

The root entity representing a single insolvency proceeding.

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `id` | UUID | Yes | Primary key, immutable | Unique identifier |
| `case_number` | String(50) | Yes | Unique, non-empty, alphanumeric with hyphens | Court-assigned case number (e.g., "123 IN 456/26") |
| `debtor_name` | String(255) | Yes | Non-empty | Name of the debtor entity |
| `court_name` | String(255) | Yes | Non-empty | Name of the insolvency court |
| `opening_date` | Date | No | Must be valid date if provided | Date of insolvency opening (null if preliminary) |
| `filing_date` | Date | Yes | Must be valid date, <= today | Date of insolvency filing |
| `currency` | String(3) | Yes | Must be "EUR" | Currency code (only EUR supported) |
| `status` | Enum | Yes | One of: PRELIMINARY, OPENED, CLOSED | Current case status |
| `created_at` | Timestamp | Yes | Auto-generated, immutable | Creation timestamp (UTC) |
| `created_by` | String(255) | Yes | Non-empty | User who created the record |
| `updated_at` | Timestamp | Yes | Auto-updated | Last modification timestamp (UTC) |
| `updated_by` | String(255) | Yes | Non-empty | User who last modified the record |

**Validation Rules:**
1. `filing_date` <= `opening_date` (if `opening_date` is set)
2. `opening_date` must be set if `status` = OPENED
3. `case_number` format should match German court case number patterns

### 3.3 Entity: LiquidityPlan

A liquidity plan instance belonging to a case.

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `id` | UUID | Yes | Primary key, immutable | Unique identifier |
| `case_id` | UUID | Yes | Foreign key to InsolvencyCase | Parent case reference |
| `name` | String(255) | Yes | Non-empty | Human-readable plan name |
| `description` | String(2000) | No | Max 2000 chars | Optional description |
| `plan_start_date` | Date | Yes | Must be a Monday | First day of Week 1 |
| `is_active` | Boolean | Yes | Default: true | Whether this is the active plan for the case |
| `created_at` | Timestamp | Yes | Auto-generated, immutable | Creation timestamp (UTC) |
| `created_by` | String(255) | Yes | Non-empty | User who created the record |
| `updated_at` | Timestamp | Yes | Auto-updated | Last modification timestamp (UTC) |
| `updated_by` | String(255) | Yes | Non-empty | User who last modified the record |

**Validation Rules:**
1. `plan_start_date` must be a Monday (ISO weekday 1)
2. Only one plan per case may have `is_active` = true
3. Plan cannot be deleted if it has any versions

### 3.4 Entity: LiquidityPlanVersion

Immutable snapshot of a plan at a point in time.

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `id` | UUID | Yes | Primary key, immutable | Unique identifier |
| `plan_id` | UUID | Yes | Foreign key to LiquidityPlan | Parent plan reference |
| `version_number` | Integer | Yes | >= 1, unique per plan, sequential | Version sequence number |
| `snapshot_date` | Timestamp | Yes | Auto-generated, immutable | When this version was created (UTC) |
| `snapshot_reason` | String(500) | Yes | Non-empty | Reason for creating this version |
| `opening_balance_cents` | BigInt | Yes | No constraints | Opening balance in euro cents |
| `data_hash` | String(64) | Yes | SHA-256 hex | Hash of all cashflow data for integrity verification |
| `created_by` | String(255) | Yes | Non-empty | User who created the version |

**Validation Rules:**
1. `version_number` must be exactly previous max + 1 for the plan
2. Versions are immutable - no updates allowed
3. `data_hash` must be recalculated and verified on read

### 3.5 Entity: CashflowCategory

Categories for grouping cashflow lines.

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `id` | UUID | Yes | Primary key, immutable | Unique identifier |
| `plan_id` | UUID | Yes | Foreign key to LiquidityPlan | Parent plan reference |
| `name` | String(255) | Yes | Non-empty | Category name |
| `flow_type` | Enum | Yes | One of: INFLOW, OUTFLOW | Whether this is income or expense |
| `estate_type` | Enum | Yes | One of: ALTMASSE, NEUMASSE | Old or new estate classification |
| `display_order` | Integer | Yes | >= 0 | Sort order for display |
| `is_system` | Boolean | Yes | Default: false | Whether this is a system-defined category |
| `created_at` | Timestamp | Yes | Auto-generated | Creation timestamp (UTC) |
| `created_by` | String(255) | Yes | Non-empty | User who created the record |

**Validation Rules:**
1. Combination of (`plan_id`, `name`, `flow_type`, `estate_type`) must be unique
2. System categories cannot be deleted or renamed
3. `display_order` should be unique within (`plan_id`, `flow_type`, `estate_type`)

**Standard Categories (System-Defined):**

| Name | Flow Type | Estate Type | Description |
|------|-----------|-------------|-------------|
| Forderungseinzuege | INFLOW | ALTMASSE | Collection of pre-existing receivables |
| Anlagenverkaeufe | INFLOW | ALTMASSE | Sale of pre-existing assets |
| Sonstige Einzahlungen Alt | INFLOW | ALTMASSE | Other old estate inflows |
| Umsatzerloese | INFLOW | NEUMASSE | Revenue from ongoing operations |
| Sonstige Einzahlungen Neu | INFLOW | NEUMASSE | Other new estate inflows |
| Loehne und Gehaelter | OUTFLOW | NEUMASSE | Wages and salaries |
| Sozialversicherung | OUTFLOW | NEUMASSE | Social security contributions |
| Miete und Nebenkosten | OUTFLOW | NEUMASSE | Rent and utilities |
| Material und Waren | OUTFLOW | NEUMASSE | Materials and goods |
| Sonstige Auszahlungen Neu | OUTFLOW | NEUMASSE | Other new estate outflows |
| Altmasseverbindlichkeiten | OUTFLOW | ALTMASSE | Old estate liabilities |
| Sonstige Auszahlungen Alt | OUTFLOW | ALTMASSE | Other old estate outflows |

### 3.6 Entity: CashflowLine

Individual line items within a category.

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `id` | UUID | Yes | Primary key, immutable | Unique identifier |
| `category_id` | UUID | Yes | Foreign key to CashflowCategory | Parent category reference |
| `name` | String(255) | Yes | Non-empty | Line item name |
| `description` | String(1000) | No | Max 1000 chars | Optional description |
| `display_order` | Integer | Yes | >= 0 | Sort order within category |
| `is_locked` | Boolean | Yes | Default: false | Whether values can be edited |
| `created_at` | Timestamp | Yes | Auto-generated | Creation timestamp (UTC) |
| `created_by` | String(255) | Yes | Non-empty | User who created the record |
| `updated_at` | Timestamp | Yes | Auto-updated | Last modification timestamp (UTC) |
| `updated_by` | String(255) | Yes | Non-empty | User who last modified the record |

**Validation Rules:**
1. `display_order` should be unique within category
2. Locked lines cannot have their weekly values modified

### 3.7 Entity: WeeklyValue

The atomic value unit - one value for one line for one week.

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `id` | UUID | Yes | Primary key, immutable | Unique identifier |
| `line_id` | UUID | Yes | Foreign key to CashflowLine | Parent line reference |
| `week_offset` | Integer | Yes | 0-12 (inclusive) | Week number (0 = Week 1, 12 = Week 13) |
| `value_type` | Enum | Yes | One of: IST, PLAN | Actual or planned value |
| `amount_cents` | BigInt | Yes | No sign constraint | Amount in euro cents (positive or negative) |
| `note` | String(500) | No | Max 500 chars | Optional note for this value |
| `created_at` | Timestamp | Yes | Auto-generated | Creation timestamp (UTC) |
| `created_by` | String(255) | Yes | Non-empty | User who created the record |
| `updated_at` | Timestamp | Yes | Auto-updated | Last modification timestamp (UTC) |
| `updated_by` | String(255) | Yes | Non-empty | User who last modified the record |

**Validation Rules:**
1. Combination of (`line_id`, `week_offset`, `value_type`) must be unique
2. `week_offset` must be in range [0, 12]
3. IST values should only exist for weeks that have passed (enforced at application level, not database)

### 3.8 Derived Type: WeekIdentifier

A value object for identifying a specific week.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `year` | Integer | Yes | ISO year (e.g., 2026) |
| `week` | Integer | Yes | ISO week number (1-53) |
| `offset` | Integer | Yes | Offset from plan start (0-12) |
| `start_date` | Date | Yes | Monday of this week |
| `end_date` | Date | Yes | Sunday of this week |
| `is_past` | Boolean | Yes | Whether this week has ended |
| `is_current` | Boolean | Yes | Whether this is the current week |

---

## 4. Calculation Specification

### 4.1 Monetary Value Representation

**CRITICAL: All monetary values are stored and calculated in euro cents (1/100 EUR) as integers.**

| Aspect | Specification |
|--------|---------------|
| Storage Type | 64-bit signed integer (BigInt) |
| Unit | Euro cents |
| Precision | Exact (no floating point) |
| Display Conversion | Divide by 100, format with 2 decimal places |
| Input Conversion | Multiply by 100, round half-up |

**Rounding Rule for Input:**
```
function euroToCents(euroAmount: number): bigint {
    return BigInt(Math.round(euroAmount * 100));
}
```

**Display Rule:**
```
function centsToEuro(cents: bigint): string {
    const euros = Number(cents) / 100;
    return euros.toLocaleString('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
```

### 4.2 Effective Value Calculation

For any given week and line, the **effective value** is determined by this rule:

```
EFFECTIVE_VALUE = IF IST_VALUE EXISTS THEN IST_VALUE ELSE PLAN_VALUE

Where:
- IST_VALUE: The actual confirmed value (may be null/undefined)
- PLAN_VALUE: The planned value (may be null/undefined, defaults to 0)
- EFFECTIVE_VALUE: The value used in calculations
```

**Implementation:**
```typescript
function getEffectiveValue(
    istValue: bigint | null,
    planValue: bigint | null
): bigint {
    if (istValue !== null) {
        return istValue;
    }
    if (planValue !== null) {
        return planValue;
    }
    return 0n;
}
```

### 4.3 Week-by-Week Calculation Logic

#### Step 1: Initialize Opening Balance

```
OPENING_BALANCE[Week 0] = LiquidityPlanVersion.opening_balance_cents

Where:
- Opening balance is the known cash position at the start of Week 1
- This value must be provided by the user (typically from bank statement)
```

#### Step 2: Calculate Weekly Totals

For each week W (0 to 12):

```
Step 2.1: Calculate Inflows by Estate Type

INFLOWS_ALTMASSE[W] = SUM(
    EFFECTIVE_VALUE(line)
    FOR ALL lines
    WHERE line.category.flow_type = INFLOW
    AND line.category.estate_type = ALTMASSE
)

INFLOWS_NEUMASSE[W] = SUM(
    EFFECTIVE_VALUE(line)
    FOR ALL lines
    WHERE line.category.flow_type = INFLOW
    AND line.category.estate_type = NEUMASSE
)

TOTAL_INFLOWS[W] = INFLOWS_ALTMASSE[W] + INFLOWS_NEUMASSE[W]
```

```
Step 2.2: Calculate Outflows by Estate Type

OUTFLOWS_ALTMASSE[W] = SUM(
    EFFECTIVE_VALUE(line)
    FOR ALL lines
    WHERE line.category.flow_type = OUTFLOW
    AND line.category.estate_type = ALTMASSE
)

OUTFLOWS_NEUMASSE[W] = SUM(
    EFFECTIVE_VALUE(line)
    FOR ALL lines
    WHERE line.category.flow_type = OUTFLOW
    AND line.category.estate_type = NEUMASSE
)

TOTAL_OUTFLOWS[W] = OUTFLOWS_ALTMASSE[W] + OUTFLOWS_NEUMASSE[W]
```

```
Step 2.3: Calculate Net Cashflow

NET_CASHFLOW[W] = TOTAL_INFLOWS[W] - TOTAL_OUTFLOWS[W]
```

```
Step 2.4: Calculate Closing Balance

CLOSING_BALANCE[W] = OPENING_BALANCE[W] + NET_CASHFLOW[W]
```

#### Step 3: Propagate to Next Week

```
OPENING_BALANCE[W+1] = CLOSING_BALANCE[W]
```

#### Step 4: Repeat

Repeat Steps 2-3 for weeks 0 through 12.

### 4.4 Complete Calculation Algorithm

```typescript
interface WeeklyCalculation {
    weekOffset: number;
    openingBalanceCents: bigint;
    inflowsAltmasseCents: bigint;
    inflowsNeumasseCents: bigint;
    totalInflowsCents: bigint;
    outflowsAltmasseCents: bigint;
    outflowsNeumasseCents: bigint;
    totalOutflowsCents: bigint;
    netCashflowCents: bigint;
    closingBalanceCents: bigint;
}

interface CalculationResult {
    weeks: WeeklyCalculation[];
    totalInflowsCents: bigint;
    totalOutflowsCents: bigint;
    totalNetCashflowCents: bigint;
    finalClosingBalanceCents: bigint;
}

function calculateLiquidityPlan(
    openingBalanceCents: bigint,
    categories: CashflowCategory[],
    lines: CashflowLine[],
    weeklyValues: WeeklyValue[]
): CalculationResult {

    const weeks: WeeklyCalculation[] = [];
    let currentOpeningBalance = openingBalanceCents;

    // Aggregate totals
    let totalInflows = 0n;
    let totalOutflows = 0n;

    // Process each week
    for (let weekOffset = 0; weekOffset <= 12; weekOffset++) {

        // Initialize week calculation
        let inflowsAltmasse = 0n;
        let inflowsNeumasse = 0n;
        let outflowsAltmasse = 0n;
        let outflowsNeumasse = 0n;

        // Process each line
        for (const line of lines) {
            const category = categories.find(c => c.id === line.categoryId);
            if (!category) continue;

            // Find IST and PLAN values for this line and week
            const istValue = weeklyValues.find(
                wv => wv.lineId === line.id
                    && wv.weekOffset === weekOffset
                    && wv.valueType === 'IST'
            )?.amountCents ?? null;

            const planValue = weeklyValues.find(
                wv => wv.lineId === line.id
                    && wv.weekOffset === weekOffset
                    && wv.valueType === 'PLAN'
            )?.amountCents ?? null;

            const effectiveValue = getEffectiveValue(istValue, planValue);

            // Accumulate by flow type and estate type
            if (category.flowType === 'INFLOW') {
                if (category.estateType === 'ALTMASSE') {
                    inflowsAltmasse += effectiveValue;
                } else {
                    inflowsNeumasse += effectiveValue;
                }
            } else {
                if (category.estateType === 'ALTMASSE') {
                    outflowsAltmasse += effectiveValue;
                } else {
                    outflowsNeumasse += effectiveValue;
                }
            }
        }

        // Calculate totals for this week
        const totalWeekInflows = inflowsAltmasse + inflowsNeumasse;
        const totalWeekOutflows = outflowsAltmasse + outflowsNeumasse;
        const netCashflow = totalWeekInflows - totalWeekOutflows;
        const closingBalance = currentOpeningBalance + netCashflow;

        // Store week calculation
        weeks.push({
            weekOffset,
            openingBalanceCents: currentOpeningBalance,
            inflowsAltmasseCents: inflowsAltmasse,
            inflowsNeumasseCents: inflowsNeumasse,
            totalInflowsCents: totalWeekInflows,
            outflowsAltmasseCents: outflowsAltmasse,
            outflowsNeumasseCents: outflowsNeumasse,
            totalOutflowsCents: totalWeekOutflows,
            netCashflowCents: netCashflow,
            closingBalanceCents: closingBalance
        });

        // Accumulate totals
        totalInflows += totalWeekInflows;
        totalOutflows += totalWeekOutflows;

        // Propagate to next week
        currentOpeningBalance = closingBalance;
    }

    return {
        weeks,
        totalInflowsCents: totalInflows,
        totalOutflowsCents: totalOutflows,
        totalNetCashflowCents: totalInflows - totalOutflows,
        finalClosingBalanceCents: weeks[12].closingBalanceCents
    };
}
```

### 4.5 IST vs PLAN Value Rules

| Rule | Description |
|------|-------------|
| IST Override | If an IST value exists for a line/week, it completely replaces the PLAN value |
| PLAN Default | If no IST value exists, the PLAN value is used |
| Zero Default | If neither IST nor PLAN exists, the effective value is 0 |
| No Partial Mix | You cannot have partial IST - it's all or nothing per line/week cell |
| Historical Lock | Recommended: Lock IST values for past weeks to prevent accidental changes |

### 4.6 Altmasse vs Neumasse Rules

| Rule | Description |
|------|-------------|
| Separate Tracking | Altmasse and Neumasse are tracked in separate categories |
| Combined Display | Totals can be shown combined or separated based on view preference |
| No Cross-Transfer | A line item cannot be both Altmasse and Neumasse |
| Category Assignment | Estate type is assigned at category level, not line level |

### 4.7 Aggregation Formulas

**Line Total (across all weeks):**
```
LINE_TOTAL = SUM(EFFECTIVE_VALUE[line, week] FOR week IN 0..12)
```

**Category Total (for one week):**
```
CATEGORY_TOTAL[week] = SUM(EFFECTIVE_VALUE[line, week] FOR line IN category.lines)
```

**Category Total (across all weeks):**
```
CATEGORY_TOTAL = SUM(LINE_TOTAL FOR line IN category.lines)
```

**Grand Total Inflows:**
```
GRAND_INFLOWS = SUM(CATEGORY_TOTAL FOR category WHERE flow_type = INFLOW)
```

**Grand Total Outflows:**
```
GRAND_OUTFLOWS = SUM(CATEGORY_TOTAL FOR category WHERE flow_type = OUTFLOW)
```

---

## 5. Edge Cases and Test Scenarios

### 5.1 Boundary Value Tests

| ID | Scenario | Input | Expected Output |
|----|----------|-------|-----------------|
| BV-01 | Zero opening balance | `opening_balance = 0` | Calculations proceed normally, closing balance equals net cashflow |
| BV-02 | Negative opening balance | `opening_balance = -100000` (-1000.00 EUR) | Valid, calculations proceed, negative balances displayed correctly |
| BV-03 | Maximum value | `amount = 9223372036854775807` (max BigInt) | Stored and displayed correctly, overflow prevented |
| BV-04 | Minimum value | `amount = -9223372036854775808` (min BigInt) | Stored and displayed correctly |
| BV-05 | Empty plan (no lines) | No cashflow lines defined | All totals = 0, closing balance = opening balance each week |
| BV-06 | Single line | One line with values | Correct calculation with single line |
| BV-07 | Week 0 only | Values only in week 0 | Other weeks have 0 cashflow, balance propagates |
| BV-08 | Week 12 only | Values only in week 12 | Weeks 0-11 have 0 cashflow |

### 5.2 IST vs PLAN Tests

| ID | Scenario | Input | Expected Output |
|----|----------|-------|-----------------|
| IP-01 | PLAN only | `IST = null, PLAN = 10000` | Effective = 10000 |
| IP-02 | IST only | `IST = 20000, PLAN = null` | Effective = 20000 |
| IP-03 | Both exist, IST wins | `IST = 15000, PLAN = 10000` | Effective = 15000 |
| IP-04 | IST is zero | `IST = 0, PLAN = 10000` | Effective = 0 (IST overrides) |
| IP-05 | Both null | `IST = null, PLAN = null` | Effective = 0 |
| IP-06 | IST negative | `IST = -5000, PLAN = 10000` | Effective = -5000 |
| IP-07 | Partial week IST | Some lines IST, some PLAN | Each line calculated independently |

### 5.3 Altmasse vs Neumasse Tests

| ID | Scenario | Expected Output |
|----|----------|-----------------|
| AN-01 | Only Altmasse inflows | Neumasse inflows = 0, total = Altmasse only |
| AN-02 | Only Neumasse outflows | Altmasse outflows = 0, total = Neumasse only |
| AN-03 | Mixed estate types | Correct separation in subtotals, correct combined total |
| AN-04 | Empty Altmasse | Valid plan, Altmasse totals = 0 |
| AN-05 | Empty Neumasse | Valid plan, Neumasse totals = 0 |

### 5.4 Calculation Integrity Tests

| ID | Scenario | Verification |
|----|----------|--------------|
| CI-01 | Balance propagation | `OPENING[W+1] = CLOSING[W]` for all weeks |
| CI-02 | Net cashflow | `NET = INFLOWS - OUTFLOWS` for each week |
| CI-03 | Closing balance | `CLOSING = OPENING + NET` for each week |
| CI-04 | Total consistency | Sum of weekly nets = Final closing - Initial opening |
| CI-05 | Aggregation consistency | Line totals sum to category totals |
| CI-06 | Flow type separation | Inflow totals independent of outflow totals |

### 5.5 Determinism Tests

| ID | Scenario | Verification |
|----|----------|--------------|
| DT-01 | Repeated calculation | Same inputs produce identical outputs on every run |
| DT-02 | Order independence | Changing line order doesn't affect totals |
| DT-03 | Category order independence | Changing category order doesn't affect totals |
| DT-04 | Time independence | Calculation at different times produces same results |

### 5.6 Validation Tests

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| VL-01 | Invalid week offset (13) | Reject with validation error |
| VL-02 | Invalid week offset (-1) | Reject with validation error |
| VL-03 | Duplicate line/week/type | Reject with uniqueness error |
| VL-04 | Non-Monday plan start | Reject with validation error |
| VL-05 | Empty category name | Reject with validation error |
| VL-06 | Null required field | Reject with validation error |

### 5.7 Precision Tests

| ID | Scenario | Input | Expected Output |
|----|----------|-------|-----------------|
| PR-01 | Cent precision | 1 cent values | Calculated exactly |
| PR-02 | Large sums | Many lines summing to large total | No precision loss |
| PR-03 | Display rounding | 123456789 cents | "1.234.567,89" (de-DE) |
| PR-04 | Input conversion | "1.234,56" EUR | 123456 cents |
| PR-05 | Negative display | -123456 cents | "-1.234,56" |

### 5.8 Comprehensive Test Scenario

**Test Case: TC-FULL-01 - Complete 13-Week Plan**

**Setup:**
```
Opening Balance: 50.000,00 EUR (5000000 cents)
Categories:
  - Umsatzerloese (INFLOW, NEUMASSE)
  - Loehne und Gehaelter (OUTFLOW, NEUMASSE)
  - Forderungseinzuege (INFLOW, ALTMASSE)
```

**Input Data:**

| Week | Umsatzerloese (PLAN) | Loehne (PLAN) | Forderungen (PLAN) |
|------|---------------------|---------------|-------------------|
| 0 | 100.000,00 | 80.000,00 | 20.000,00 |
| 1 | 100.000,00 | 80.000,00 | 15.000,00 |
| 2 | 100.000,00 | 80.000,00 | 10.000,00 |
| 3 | 100.000,00 | 80.000,00 | 5.000,00 |
| 4-12 | 100.000,00 | 80.000,00 | 0,00 |

**Week 0 IST Override:**
```
Umsatzerloese IST: 95.000,00 EUR (actual was less than planned)
```

**Expected Results:**

| Week | Opening | Inflows | Outflows | Net | Closing |
|------|---------|---------|----------|-----|---------|
| 0 | 50.000,00 | 115.000,00 | 80.000,00 | 35.000,00 | 85.000,00 |
| 1 | 85.000,00 | 115.000,00 | 80.000,00 | 35.000,00 | 120.000,00 |
| 2 | 120.000,00 | 110.000,00 | 80.000,00 | 30.000,00 | 150.000,00 |
| 3 | 150.000,00 | 105.000,00 | 80.000,00 | 25.000,00 | 175.000,00 |
| 4 | 175.000,00 | 100.000,00 | 80.000,00 | 20.000,00 | 195.000,00 |
| ... | ... | ... | ... | ... | ... |
| 12 | 335.000,00 | 100.000,00 | 80.000,00 | 20.000,00 | 355.000,00 |

**Note:** Week 0 uses IST value (95.000) instead of PLAN (100.000) for Umsatzerloese.

---

## Appendices

### Appendix A: TypeScript Type Definitions

```typescript
// Enums
type FlowType = 'INFLOW' | 'OUTFLOW';
type EstateType = 'ALTMASSE' | 'NEUMASSE';
type ValueType = 'IST' | 'PLAN';
type CaseStatus = 'PRELIMINARY' | 'OPENED' | 'CLOSED';

// Value Objects
interface MonetaryAmount {
    readonly cents: bigint;
    toEuro(): number;
    toDisplayString(locale?: string): string;
}

interface WeekIdentifier {
    readonly year: number;
    readonly week: number;
    readonly offset: number;
    readonly startDate: Date;
    readonly endDate: Date;
    readonly isPast: boolean;
    readonly isCurrent: boolean;
}

// Entities
interface InsolvencyCase {
    readonly id: string;
    caseNumber: string;
    debtorName: string;
    courtName: string;
    openingDate: Date | null;
    filingDate: Date;
    currency: 'EUR';
    status: CaseStatus;
    readonly createdAt: Date;
    readonly createdBy: string;
    updatedAt: Date;
    updatedBy: string;
}

interface LiquidityPlan {
    readonly id: string;
    readonly caseId: string;
    name: string;
    description: string | null;
    planStartDate: Date;
    isActive: boolean;
    readonly createdAt: Date;
    readonly createdBy: string;
    updatedAt: Date;
    updatedBy: string;
}

interface LiquidityPlanVersion {
    readonly id: string;
    readonly planId: string;
    readonly versionNumber: number;
    readonly snapshotDate: Date;
    readonly snapshotReason: string;
    readonly openingBalanceCents: bigint;
    readonly dataHash: string;
    readonly createdBy: string;
}

interface CashflowCategory {
    readonly id: string;
    readonly planId: string;
    name: string;
    flowType: FlowType;
    estateType: EstateType;
    displayOrder: number;
    readonly isSystem: boolean;
    readonly createdAt: Date;
    readonly createdBy: string;
}

interface CashflowLine {
    readonly id: string;
    readonly categoryId: string;
    name: string;
    description: string | null;
    displayOrder: number;
    isLocked: boolean;
    readonly createdAt: Date;
    readonly createdBy: string;
    updatedAt: Date;
    updatedBy: string;
}

interface WeeklyValue {
    readonly id: string;
    readonly lineId: string;
    readonly weekOffset: number;
    readonly valueType: ValueType;
    amountCents: bigint;
    note: string | null;
    readonly createdAt: Date;
    readonly createdBy: string;
    updatedAt: Date;
    updatedBy: string;
}
```

### Appendix B: SQL Schema (PostgreSQL)

```sql
-- Enums
CREATE TYPE flow_type AS ENUM ('INFLOW', 'OUTFLOW');
CREATE TYPE estate_type AS ENUM ('ALTMASSE', 'NEUMASSE');
CREATE TYPE value_type AS ENUM ('IST', 'PLAN');
CREATE TYPE case_status AS ENUM ('PRELIMINARY', 'OPENED', 'CLOSED');

-- Tables
CREATE TABLE insolvency_case (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number VARCHAR(50) NOT NULL UNIQUE,
    debtor_name VARCHAR(255) NOT NULL,
    court_name VARCHAR(255) NOT NULL,
    opening_date DATE,
    filing_date DATE NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
    status case_status NOT NULL DEFAULT 'PRELIMINARY',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255) NOT NULL,

    CONSTRAINT valid_dates CHECK (
        opening_date IS NULL OR filing_date <= opening_date
    ),
    CONSTRAINT opened_requires_date CHECK (
        status != 'OPENED' OR opening_date IS NOT NULL
    )
);

CREATE TABLE liquidity_plan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES insolvency_case(id),
    name VARCHAR(255) NOT NULL,
    description VARCHAR(2000),
    plan_start_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255) NOT NULL,

    CONSTRAINT start_date_is_monday CHECK (
        EXTRACT(ISODOW FROM plan_start_date) = 1
    )
);

-- Ensure only one active plan per case
CREATE UNIQUE INDEX idx_one_active_plan_per_case
ON liquidity_plan (case_id)
WHERE is_active = TRUE;

CREATE TABLE liquidity_plan_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES liquidity_plan(id),
    version_number INTEGER NOT NULL CHECK (version_number >= 1),
    snapshot_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    snapshot_reason VARCHAR(500) NOT NULL,
    opening_balance_cents BIGINT NOT NULL,
    data_hash CHAR(64) NOT NULL,
    created_by VARCHAR(255) NOT NULL,

    CONSTRAINT unique_version_per_plan UNIQUE (plan_id, version_number)
);

CREATE TABLE cashflow_category (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES liquidity_plan(id),
    name VARCHAR(255) NOT NULL,
    flow_type flow_type NOT NULL,
    estate_type estate_type NOT NULL,
    display_order INTEGER NOT NULL CHECK (display_order >= 0),
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL,

    CONSTRAINT unique_category_per_plan UNIQUE (plan_id, name, flow_type, estate_type)
);

CREATE TABLE cashflow_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES cashflow_category(id),
    name VARCHAR(255) NOT NULL,
    description VARCHAR(1000),
    display_order INTEGER NOT NULL CHECK (display_order >= 0),
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255) NOT NULL
);

CREATE TABLE weekly_value (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID NOT NULL REFERENCES cashflow_line(id),
    week_offset INTEGER NOT NULL CHECK (week_offset >= 0 AND week_offset <= 12),
    value_type value_type NOT NULL,
    amount_cents BIGINT NOT NULL,
    note VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255) NOT NULL,

    CONSTRAINT unique_value_per_line_week_type UNIQUE (line_id, week_offset, value_type)
);

-- Indexes for common queries
CREATE INDEX idx_plan_case ON liquidity_plan(case_id);
CREATE INDEX idx_version_plan ON liquidity_plan_version(plan_id);
CREATE INDEX idx_category_plan ON cashflow_category(plan_id);
CREATE INDEX idx_line_category ON cashflow_line(category_id);
CREATE INDEX idx_value_line ON weekly_value(line_id);
CREATE INDEX idx_value_week ON weekly_value(week_offset);
```

### Appendix C: JSON Schema for API

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/liquidity-plan.schema.json",
  "title": "LiquidityPlanData",
  "description": "Complete liquidity plan data for import/export",
  "type": "object",
  "required": ["version", "plan", "categories", "lines", "values"],
  "properties": {
    "version": {
      "type": "string",
      "const": "1.0.0"
    },
    "plan": {
      "type": "object",
      "required": ["name", "planStartDate", "openingBalanceCents"],
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 255
        },
        "description": {
          "type": ["string", "null"],
          "maxLength": 2000
        },
        "planStartDate": {
          "type": "string",
          "format": "date",
          "description": "Must be a Monday (ISO weekday 1)"
        },
        "openingBalanceCents": {
          "type": "integer",
          "description": "Opening balance in euro cents"
        }
      }
    },
    "categories": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "flowType", "estateType", "displayOrder"],
        "properties": {
          "id": {
            "type": "string",
            "description": "Temporary ID for reference within this document"
          },
          "name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 255
          },
          "flowType": {
            "type": "string",
            "enum": ["INFLOW", "OUTFLOW"]
          },
          "estateType": {
            "type": "string",
            "enum": ["ALTMASSE", "NEUMASSE"]
          },
          "displayOrder": {
            "type": "integer",
            "minimum": 0
          }
        }
      }
    },
    "lines": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "categoryId", "name", "displayOrder"],
        "properties": {
          "id": {
            "type": "string"
          },
          "categoryId": {
            "type": "string",
            "description": "Reference to category.id"
          },
          "name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 255
          },
          "description": {
            "type": ["string", "null"],
            "maxLength": 1000
          },
          "displayOrder": {
            "type": "integer",
            "minimum": 0
          }
        }
      }
    },
    "values": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["lineId", "weekOffset", "valueType", "amountCents"],
        "properties": {
          "lineId": {
            "type": "string",
            "description": "Reference to line.id"
          },
          "weekOffset": {
            "type": "integer",
            "minimum": 0,
            "maximum": 12
          },
          "valueType": {
            "type": "string",
            "enum": ["IST", "PLAN"]
          },
          "amountCents": {
            "type": "integer"
          },
          "note": {
            "type": ["string", "null"],
            "maxLength": 500
          }
        }
      }
    }
  }
}
```

### Appendix D: Checksum Calculation for Version Integrity

```typescript
import { createHash } from 'crypto';

interface HashableValue {
    lineId: string;
    weekOffset: number;
    valueType: 'IST' | 'PLAN';
    amountCents: bigint;
}

function calculateDataHash(
    openingBalanceCents: bigint,
    values: HashableValue[]
): string {
    // Sort values for deterministic ordering
    const sortedValues = [...values].sort((a, b) => {
        if (a.lineId !== b.lineId) return a.lineId.localeCompare(b.lineId);
        if (a.weekOffset !== b.weekOffset) return a.weekOffset - b.weekOffset;
        return a.valueType.localeCompare(b.valueType);
    });

    // Build canonical string representation
    const parts: string[] = [
        `opening:${openingBalanceCents.toString()}`
    ];

    for (const v of sortedValues) {
        parts.push(
            `${v.lineId}:${v.weekOffset}:${v.valueType}:${v.amountCents.toString()}`
        );
    }

    const canonical = parts.join('|');

    // Calculate SHA-256 hash
    return createHash('sha256')
        .update(canonical, 'utf8')
        .digest('hex');
}
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-15 | System | Initial specification |

---

**End of Specification**
