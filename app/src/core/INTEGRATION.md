# Core Liquidity Engine - Integration Guide

## Overview

The Core Liquidity Engine is a deterministic calculation module for 13-week insolvency liquidity planning. This guide explains how to integrate the engine into the admin dashboard application.

## Quick Start

```typescript
import {
  validateInput,
  calculateLiquidity,
  transformToUIPayload,
  processLiquidityPlan,  // Convenience function
} from '@/core';

// Option 1: Use convenience function (recommended for simple cases)
const result = processLiquidityPlan(rawInput);
if (result.success) {
  renderDashboard(result.payload);
} else {
  showErrors(result.errors);
}

// Option 2: Step-by-step (recommended for more control)
const validation = validateInput(rawInput);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
  return;
}

const calculation = calculateLiquidity(validation.data);
const uiPayload = transformToUIPayload(
  calculation,
  validation.data.categories,
  validation.data.lines,
  validation.data.openingBalanceCents
);
```

## Input Format

The engine expects input in the following structure:

```typescript
interface LiquidityCalculationInput {
  // Opening balance at start of Week 0 in euro CENTS
  openingBalanceCents: bigint;

  // Category definitions
  categories: CategoryInput[];

  // Line item definitions
  lines: LineInput[];

  // Weekly values (IST and PLAN)
  weeklyValues: WeeklyValueInput[];
}
```

### Important: Monetary Values

**All monetary values must be in euro CENTS as `bigint`.**

| Euro Amount | Cents (bigint) |
|-------------|----------------|
| 1,234.56 EUR | `123456n` |
| -500.00 EUR | `-50000n` |
| 0.01 EUR | `1n` |

Conversion helpers:
```typescript
// Euro to cents
const cents = BigInt(Math.round(euros * 100));

// Cents to euro (for display)
const euros = Number(cents) / 100;
```

### Category Input

```typescript
interface CategoryInput {
  id: string;           // Unique identifier
  name: string;         // Display name
  flowType: 'INFLOW' | 'OUTFLOW';
  estateType: 'ALTMASSE' | 'NEUMASSE';
  displayOrder: number; // Sort order (>= 0)
}
```

### Line Input

```typescript
interface LineInput {
  id: string;           // Unique identifier
  categoryId: string;   // Must reference existing category
  name: string;         // Display name
  displayOrder: number; // Sort order within category (>= 0)
}
```

### Weekly Value Input

```typescript
interface WeeklyValueInput {
  lineId: string;       // Must reference existing line
  weekOffset: number;   // 0-12 (13 weeks)
  valueType: 'IST' | 'PLAN';
  amountCents: bigint;  // Value in cents
}
```

## Output Format

### UIPayload Structure

```typescript
interface UIPayload {
  kpis: KPIs;                      // Key performance indicators
  tableSeries: TableSeries;        // Table data for grid display
  chartSeries: ChartSeries;        // Chart data for visualization
  calculationResult: CalculationResult;  // Raw calculation result
}
```

### KPIs

```typescript
interface KPIs {
  openingBalance: FormattedAmount;   // Start of Week 0
  closingBalance: FormattedAmount;   // End of Week 12
  totalInflows: FormattedAmount;     // Sum of all inflows
  totalOutflows: FormattedAmount;    // Sum of all outflows
  netChange: FormattedAmount;        // Inflows - Outflows
  minWeeklyBalance: FormattedAmount; // Lowest closing balance
  minWeeklyBalanceWeek: number;      // Week with lowest balance
  hasNegativeBalance: boolean;       // Any week negative?
  negativeBalanceWeeks: number;      // Count of negative weeks
}
```

### FormattedAmount

```typescript
interface FormattedAmount {
  cents: bigint;          // Raw value in cents
  formatted: string;      // German locale format ("1.234,56")
  euroValue: number;      // Numeric euro value
  isNegative: boolean;    // Sign indicator
}
```

### Table Series

```typescript
interface TableSeries {
  rows: TableRow[];       // All table rows in display order
  balanceRow: {           // Closing balance row
    label: string;
    weeklyValues: FormattedAmount[];
  };
}

interface TableRow {
  rowType: 'CATEGORY_HEADER' | 'LINE' | 'CATEGORY_TOTAL' | 'SUBTOTAL' | 'GRAND_TOTAL';
  label: string;
  indent: number;         // 0=root, 1=category, 2=line
  id: string | null;
  flowType: FlowType | null;
  estateType: EstateType | null;
  weeklyValues: FormattedAmount[];  // 13 values
  rowTotal: FormattedAmount;
}
```

### Chart Series

```typescript
interface ChartSeries {
  dataPoints: ChartDataPoint[];  // 13 data points
  minValue: number;              // For Y-axis scaling
  maxValue: number;              // For Y-axis scaling
}

interface ChartDataPoint {
  weekOffset: number;
  weekLabel: string;          // "KW 1", "KW 2", etc.
  openingBalance: number;     // In euros
  closingBalance: number;     // In euros
  inflows: number;
  outflows: number;
  netCashflow: number;
  inflowsAltmasse: number;
  inflowsNeumasse: number;
  outflowsAltmasse: number;
  outflowsNeumasse: number;
}
```

## Core Calculation Rules

### 1. IST Override Rule

**IST always overrides PLAN. If IST exists (even if 0), PLAN is ignored.**

```
EFFECTIVE_VALUE = IST ?? PLAN ?? 0
```

| IST | PLAN | Effective | Source |
|-----|------|-----------|--------|
| 800 | 1000 | 800 | IST |
| 0 | 1000 | 0 | IST |
| null | 1000 | 1000 | PLAN |
| 500 | null | 500 | IST |
| null | null | 0 | DEFAULT |

### 2. Balance Propagation

```
CLOSING_BALANCE[W] = OPENING_BALANCE[W] + NET_CASHFLOW[W]
OPENING_BALANCE[W+1] = CLOSING_BALANCE[W]
```

### 3. Net Cashflow Calculation

```
NET_CASHFLOW[W] = TOTAL_INFLOWS[W] - TOTAL_OUTFLOWS[W]
```

### 4. Estate Separation

Inflows and outflows are tracked separately by estate type:
- `ALTMASSE`: Old estate (pre-insolvency)
- `NEUMASSE`: New estate (post-insolvency)

## Validation

The engine validates all input before calculation:

```typescript
const result = validateInput(data);

if (!result.valid) {
  // result.errors contains detailed error information
  for (const error of result.errors) {
    console.error(`[${error.code}] ${error.path}: ${error.message}`);
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `WEEKLY_VALUE_INVALID_WEEK_OFFSET` | Week offset not in range 0-12 |
| `WEEKLY_VALUE_DUPLICATE` | Duplicate (lineId, weekOffset, valueType) |
| `LINE_INVALID_CATEGORY_REFERENCE` | Line references non-existent category |
| `WEEKLY_VALUE_INVALID_LINE_REFERENCE` | Value references non-existent line |
| `INPUT_OPENING_BALANCE_INVALID` | Opening balance is not a bigint |

## Integrity Hash

Each calculation produces a SHA-256 hash for version verification:

```typescript
const result = calculateLiquidity(input);

// Store hash with LiquidityPlanVersion
const versionData = {
  dataHash: result.dataHash,
  // ... other version fields
};

// Later, verify integrity
import { verifyDataHash } from '@/core';

const isValid = verifyDataHash(
  storedHash,
  openingBalanceCents,
  weeklyValues
);
```

## Example: Loading from Database

```typescript
import { processLiquidityPlan } from '@/core';

// Fetch from database (Prisma example)
const plan = await prisma.liquidityPlan.findUnique({
  where: { id: planId },
  include: {
    categories: true,
    lines: true,
    weeklyValues: true,
  },
});

// Transform to engine input format
const input = {
  openingBalanceCents: BigInt(plan.openingBalanceCents),
  categories: plan.categories.map(c => ({
    id: c.id,
    name: c.name,
    flowType: c.flowType,
    estateType: c.estateType,
    displayOrder: c.displayOrder,
  })),
  lines: plan.lines.map(l => ({
    id: l.id,
    categoryId: l.categoryId,
    name: l.name,
    displayOrder: l.displayOrder,
  })),
  weeklyValues: plan.weeklyValues.map(v => ({
    lineId: v.lineId,
    weekOffset: v.weekOffset,
    valueType: v.valueType,
    amountCents: BigInt(v.amountCents),
  })),
};

// Calculate and render
const result = processLiquidityPlan(input);
if (result.success) {
  return result.payload;
}
```

## Testing

Run the test suite:

```bash
npm run test:core
```

Tests cover:
- IST override rule
- Missing weeks handling
- Negative values
- Estate separation (Altmasse/Neumasse)
- Determinism (same inputs always produce same outputs)
- Validation errors
- Balance propagation
- Full 13-week scenario

## API Reference

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `processLiquidityPlan` | Function | Convenience: validate + calculate + transform |
| `validateInput` | Function | Validate raw input |
| `calculateLiquidity` | Function | Core calculation |
| `transformToUIPayload` | Function | Transform to UI format |
| `calculateDataHash` | Function | Generate integrity hash |
| `verifyDataHash` | Function | Verify integrity hash |
| `formatEuro` | Function | Format cents as German locale string |
| `centsToEuro` | Function | Convert cents to euro number |
| `verifyCalculationIntegrity` | Function | Verify calculation invariants |

### Types

All types are exported from `@/core`:

```typescript
import type {
  FlowType,
  EstateType,
  ValueType,
  CategoryInput,
  LineInput,
  WeeklyValueInput,
  LiquidityCalculationInput,
  CalculationResult,
  UIPayload,
  KPIs,
  FormattedAmount,
  TableSeries,
  ChartSeries,
  ValidationError,
  ValidationResult,
} from '@/core';
```

### Constants

```typescript
import { WEEK_COUNT, MIN_WEEK_OFFSET, MAX_WEEK_OFFSET } from '@/core';

WEEK_COUNT       // 13
MIN_WEEK_OFFSET  // 0
MAX_WEEK_OFFSET  // 12
```

## Performance

The engine is designed for small to medium datasets typical in insolvency proceedings:
- Handles up to ~1000 lines efficiently
- All calculations are O(weeks * lines)
- Hash calculation is O(values * log(values)) due to sorting

For large datasets, consider pagination or lazy loading of historical data.

## Determinism Guarantee

**The engine is 100% deterministic.** Given identical inputs:
- Calculation results are always identical
- Data hash is always identical
- No randomness, no external dependencies, no time-based behavior

This is critical for:
- Audit compliance
- Version comparison
- Test reproducibility
