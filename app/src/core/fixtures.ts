/**
 * Core Liquidity Engine - Test Fixtures
 *
 * This module provides test data for the liquidity calculation engine.
 * All fixtures are based on the specification's test scenarios.
 *
 * @module core/fixtures
 * @version 1.0.0
 */

import type {
  CategoryInput,
  LineInput,
  WeeklyValueInput,
  LiquidityCalculationInput,
} from './types';

// ============================================================================
// STANDARD CATEGORIES
// ============================================================================

/**
 * Standard system-defined categories as per specification
 */
export const STANDARD_CATEGORIES: CategoryInput[] = [
  // Inflows - Altmasse
  {
    id: 'cat-inflow-altmasse-1',
    name: 'Forderungseinzuege',
    flowType: 'INFLOW',
    estateType: 'ALTMASSE',
    displayOrder: 0,
  },
  {
    id: 'cat-inflow-altmasse-2',
    name: 'Anlagenverkaeufe',
    flowType: 'INFLOW',
    estateType: 'ALTMASSE',
    displayOrder: 1,
  },
  {
    id: 'cat-inflow-altmasse-3',
    name: 'Sonstige Einzahlungen Alt',
    flowType: 'INFLOW',
    estateType: 'ALTMASSE',
    displayOrder: 2,
  },
  // Inflows - Neumasse
  {
    id: 'cat-inflow-neumasse-1',
    name: 'Umsatzerloese',
    flowType: 'INFLOW',
    estateType: 'NEUMASSE',
    displayOrder: 3,
  },
  {
    id: 'cat-inflow-neumasse-2',
    name: 'Sonstige Einzahlungen Neu',
    flowType: 'INFLOW',
    estateType: 'NEUMASSE',
    displayOrder: 4,
  },
  // Outflows - Neumasse
  {
    id: 'cat-outflow-neumasse-1',
    name: 'Loehne und Gehaelter',
    flowType: 'OUTFLOW',
    estateType: 'NEUMASSE',
    displayOrder: 0,
  },
  {
    id: 'cat-outflow-neumasse-2',
    name: 'Sozialversicherung',
    flowType: 'OUTFLOW',
    estateType: 'NEUMASSE',
    displayOrder: 1,
  },
  {
    id: 'cat-outflow-neumasse-3',
    name: 'Miete und Nebenkosten',
    flowType: 'OUTFLOW',
    estateType: 'NEUMASSE',
    displayOrder: 2,
  },
  {
    id: 'cat-outflow-neumasse-4',
    name: 'Material und Waren',
    flowType: 'OUTFLOW',
    estateType: 'NEUMASSE',
    displayOrder: 3,
  },
  {
    id: 'cat-outflow-neumasse-5',
    name: 'Sonstige Auszahlungen Neu',
    flowType: 'OUTFLOW',
    estateType: 'NEUMASSE',
    displayOrder: 4,
  },
  // Outflows - Altmasse
  {
    id: 'cat-outflow-altmasse-1',
    name: 'Altmasseverbindlichkeiten',
    flowType: 'OUTFLOW',
    estateType: 'ALTMASSE',
    displayOrder: 5,
  },
  {
    id: 'cat-outflow-altmasse-2',
    name: 'Sonstige Auszahlungen Alt',
    flowType: 'OUTFLOW',
    estateType: 'ALTMASSE',
    displayOrder: 6,
  },
];

// ============================================================================
// FIXTURE: EMPTY PLAN
// ============================================================================

/**
 * Empty plan with no lines or values.
 * Expected: All weeks should have zero cashflow, closing balance equals opening.
 */
export const EMPTY_PLAN_FIXTURE: LiquidityCalculationInput = {
  openingBalanceCents: 5000000n, // 50,000.00 EUR
  categories: [],
  lines: [],
  weeklyValues: [],
};

// ============================================================================
// FIXTURE: MINIMAL PLAN
// ============================================================================

/**
 * Minimal plan with single line and single value.
 */
export const MINIMAL_PLAN_FIXTURE: LiquidityCalculationInput = {
  openingBalanceCents: 1000000n, // 10,000.00 EUR
  categories: [
    {
      id: 'cat-1',
      name: 'Umsatzerloese',
      flowType: 'INFLOW',
      estateType: 'NEUMASSE',
      displayOrder: 0,
    },
  ],
  lines: [
    {
      id: 'line-1',
      categoryId: 'cat-1',
      name: 'Verkauf Produkt A',
      displayOrder: 0,
    },
  ],
  weeklyValues: [
    {
      lineId: 'line-1',
      weekOffset: 0,
      valueType: 'PLAN',
      amountCents: 500000n, // 5,000.00 EUR
    },
  ],
};

// ============================================================================
// FIXTURE: IST OVERRIDE TEST
// ============================================================================

/**
 * Tests that IST values correctly override PLAN values.
 * Week 0: PLAN = 10,000, IST = 8,000 -> Effective should be 8,000
 * Week 1: PLAN = 10,000, IST = 0 -> Effective should be 0 (IST overrides even when 0)
 * Week 2: PLAN = 10,000, no IST -> Effective should be 10,000
 */
export const IST_OVERRIDE_FIXTURE: LiquidityCalculationInput = {
  openingBalanceCents: 5000000n, // 50,000.00 EUR
  categories: [
    {
      id: 'cat-revenue',
      name: 'Umsatzerloese',
      flowType: 'INFLOW',
      estateType: 'NEUMASSE',
      displayOrder: 0,
    },
  ],
  lines: [
    {
      id: 'line-revenue',
      categoryId: 'cat-revenue',
      name: 'Hauptumsatz',
      displayOrder: 0,
    },
  ],
  weeklyValues: [
    // Week 0: Both PLAN and IST
    { lineId: 'line-revenue', weekOffset: 0, valueType: 'PLAN', amountCents: 1000000n },
    { lineId: 'line-revenue', weekOffset: 0, valueType: 'IST', amountCents: 800000n },
    // Week 1: Both PLAN and IST (IST is zero)
    { lineId: 'line-revenue', weekOffset: 1, valueType: 'PLAN', amountCents: 1000000n },
    { lineId: 'line-revenue', weekOffset: 1, valueType: 'IST', amountCents: 0n },
    // Week 2: Only PLAN
    { lineId: 'line-revenue', weekOffset: 2, valueType: 'PLAN', amountCents: 1000000n },
    // Week 3: Only IST
    { lineId: 'line-revenue', weekOffset: 3, valueType: 'IST', amountCents: 1200000n },
    // Week 4-12: No values (should be 0)
  ],
};

// ============================================================================
// FIXTURE: NEGATIVE VALUES
// ============================================================================

/**
 * Tests handling of negative values (corrections, reversals).
 */
export const NEGATIVE_VALUES_FIXTURE: LiquidityCalculationInput = {
  openingBalanceCents: 10000000n, // 100,000.00 EUR
  categories: [
    {
      id: 'cat-revenue',
      name: 'Umsatzerloese',
      flowType: 'INFLOW',
      estateType: 'NEUMASSE',
      displayOrder: 0,
    },
    {
      id: 'cat-wages',
      name: 'Loehne',
      flowType: 'OUTFLOW',
      estateType: 'NEUMASSE',
      displayOrder: 0,
    },
  ],
  lines: [
    {
      id: 'line-revenue',
      categoryId: 'cat-revenue',
      name: 'Umsatz',
      displayOrder: 0,
    },
    {
      id: 'line-refund',
      categoryId: 'cat-revenue',
      name: 'Rueckerstattung',
      displayOrder: 1,
    },
    {
      id: 'line-wages',
      categoryId: 'cat-wages',
      name: 'Gehaelter',
      displayOrder: 0,
    },
  ],
  weeklyValues: [
    // Week 0: Normal revenue
    { lineId: 'line-revenue', weekOffset: 0, valueType: 'PLAN', amountCents: 5000000n },
    // Week 0: Negative refund (still counted as inflow, but negative)
    { lineId: 'line-refund', weekOffset: 0, valueType: 'PLAN', amountCents: -500000n },
    // Week 0: Normal wages
    { lineId: 'line-wages', weekOffset: 0, valueType: 'PLAN', amountCents: 3000000n },
    // Week 1: Same pattern
    { lineId: 'line-revenue', weekOffset: 1, valueType: 'PLAN', amountCents: 5000000n },
    { lineId: 'line-refund', weekOffset: 1, valueType: 'PLAN', amountCents: -200000n },
    { lineId: 'line-wages', weekOffset: 1, valueType: 'PLAN', amountCents: 3000000n },
  ],
};

// ============================================================================
// FIXTURE: NEGATIVE OPENING BALANCE
// ============================================================================

/**
 * Tests handling of negative opening balance (overdraft situation).
 */
export const NEGATIVE_OPENING_FIXTURE: LiquidityCalculationInput = {
  openingBalanceCents: -2000000n, // -20,000.00 EUR (overdraft)
  categories: [
    {
      id: 'cat-revenue',
      name: 'Umsatzerloese',
      flowType: 'INFLOW',
      estateType: 'NEUMASSE',
      displayOrder: 0,
    },
  ],
  lines: [
    {
      id: 'line-revenue',
      categoryId: 'cat-revenue',
      name: 'Umsatz',
      displayOrder: 0,
    },
  ],
  weeklyValues: [
    { lineId: 'line-revenue', weekOffset: 0, valueType: 'PLAN', amountCents: 1000000n },
    { lineId: 'line-revenue', weekOffset: 1, valueType: 'PLAN', amountCents: 1000000n },
    { lineId: 'line-revenue', weekOffset: 2, valueType: 'PLAN', amountCents: 1000000n },
  ],
};

// ============================================================================
// FIXTURE: ESTATE SEPARATION
// ============================================================================

/**
 * Tests proper separation of Altmasse and Neumasse.
 */
export const ESTATE_SEPARATION_FIXTURE: LiquidityCalculationInput = {
  openingBalanceCents: 10000000n, // 100,000.00 EUR
  categories: [
    // Altmasse inflows
    {
      id: 'cat-forderungen',
      name: 'Forderungseinzuege',
      flowType: 'INFLOW',
      estateType: 'ALTMASSE',
      displayOrder: 0,
    },
    // Neumasse inflows
    {
      id: 'cat-umsatz',
      name: 'Umsatzerloese',
      flowType: 'INFLOW',
      estateType: 'NEUMASSE',
      displayOrder: 1,
    },
    // Altmasse outflows
    {
      id: 'cat-altverbind',
      name: 'Altmasseverbindlichkeiten',
      flowType: 'OUTFLOW',
      estateType: 'ALTMASSE',
      displayOrder: 0,
    },
    // Neumasse outflows
    {
      id: 'cat-loehne',
      name: 'Loehne und Gehaelter',
      flowType: 'OUTFLOW',
      estateType: 'NEUMASSE',
      displayOrder: 1,
    },
  ],
  lines: [
    { id: 'line-forderungen', categoryId: 'cat-forderungen', name: 'Altforderungen', displayOrder: 0 },
    { id: 'line-umsatz', categoryId: 'cat-umsatz', name: 'Laufender Umsatz', displayOrder: 0 },
    { id: 'line-altverbind', categoryId: 'cat-altverbind', name: 'Altschulden', displayOrder: 0 },
    { id: 'line-loehne', categoryId: 'cat-loehne', name: 'Mitarbeiter', displayOrder: 0 },
  ],
  weeklyValues: [
    // Week 0 - All estates have values
    { lineId: 'line-forderungen', weekOffset: 0, valueType: 'PLAN', amountCents: 2000000n }, // Altmasse in
    { lineId: 'line-umsatz', weekOffset: 0, valueType: 'PLAN', amountCents: 5000000n }, // Neumasse in
    { lineId: 'line-altverbind', weekOffset: 0, valueType: 'PLAN', amountCents: 1500000n }, // Altmasse out
    { lineId: 'line-loehne', weekOffset: 0, valueType: 'PLAN', amountCents: 4000000n }, // Neumasse out
    // Week 1 - Only Altmasse
    { lineId: 'line-forderungen', weekOffset: 1, valueType: 'PLAN', amountCents: 1500000n },
    { lineId: 'line-altverbind', weekOffset: 1, valueType: 'PLAN', amountCents: 1000000n },
    // Week 2 - Only Neumasse
    { lineId: 'line-umsatz', weekOffset: 2, valueType: 'PLAN', amountCents: 5000000n },
    { lineId: 'line-loehne', weekOffset: 2, valueType: 'PLAN', amountCents: 4000000n },
  ],
};

// ============================================================================
// FIXTURE: FULL 13-WEEK SCENARIO (from specification TC-FULL-01)
// ============================================================================

/**
 * Complete 13-week plan based on specification test case TC-FULL-01.
 *
 * Setup:
 * - Opening Balance: 50,000.00 EUR
 * - Categories: Umsatzerloese, Loehne und Gehaelter, Forderungseinzuege
 *
 * Input Data:
 * | Week | Umsatzerloese (PLAN) | Loehne (PLAN) | Forderungen (PLAN) |
 * |------|---------------------|---------------|-------------------|
 * | 0    | 100,000.00          | 80,000.00     | 20,000.00         |
 * | 1    | 100,000.00          | 80,000.00     | 15,000.00         |
 * | 2    | 100,000.00          | 80,000.00     | 10,000.00         |
 * | 3    | 100,000.00          | 80,000.00     | 5,000.00          |
 * | 4-12 | 100,000.00          | 80,000.00     | 0.00              |
 *
 * Week 0 IST Override:
 * - Umsatzerloese IST: 95,000.00 EUR (actual was less than planned)
 */
export const FULL_13_WEEK_FIXTURE: LiquidityCalculationInput = {
  openingBalanceCents: 5000000n, // 50,000.00 EUR
  categories: [
    {
      id: 'cat-umsatz',
      name: 'Umsatzerloese',
      flowType: 'INFLOW',
      estateType: 'NEUMASSE',
      displayOrder: 0,
    },
    {
      id: 'cat-forderungen',
      name: 'Forderungseinzuege',
      flowType: 'INFLOW',
      estateType: 'ALTMASSE',
      displayOrder: 1,
    },
    {
      id: 'cat-loehne',
      name: 'Loehne und Gehaelter',
      flowType: 'OUTFLOW',
      estateType: 'NEUMASSE',
      displayOrder: 0,
    },
  ],
  lines: [
    { id: 'line-umsatz', categoryId: 'cat-umsatz', name: 'Hauptumsatz', displayOrder: 0 },
    { id: 'line-forderungen', categoryId: 'cat-forderungen', name: 'Debitoren', displayOrder: 0 },
    { id: 'line-loehne', categoryId: 'cat-loehne', name: 'Gehaelter', displayOrder: 0 },
  ],
  weeklyValues: [
    // Week 0 - with IST override for Umsatz
    { lineId: 'line-umsatz', weekOffset: 0, valueType: 'PLAN', amountCents: 10000000n }, // 100,000.00
    { lineId: 'line-umsatz', weekOffset: 0, valueType: 'IST', amountCents: 9500000n }, // 95,000.00 (IST override)
    { lineId: 'line-forderungen', weekOffset: 0, valueType: 'PLAN', amountCents: 2000000n }, // 20,000.00
    { lineId: 'line-loehne', weekOffset: 0, valueType: 'PLAN', amountCents: 8000000n }, // 80,000.00

    // Week 1
    { lineId: 'line-umsatz', weekOffset: 1, valueType: 'PLAN', amountCents: 10000000n },
    { lineId: 'line-forderungen', weekOffset: 1, valueType: 'PLAN', amountCents: 1500000n }, // 15,000.00
    { lineId: 'line-loehne', weekOffset: 1, valueType: 'PLAN', amountCents: 8000000n },

    // Week 2
    { lineId: 'line-umsatz', weekOffset: 2, valueType: 'PLAN', amountCents: 10000000n },
    { lineId: 'line-forderungen', weekOffset: 2, valueType: 'PLAN', amountCents: 1000000n }, // 10,000.00
    { lineId: 'line-loehne', weekOffset: 2, valueType: 'PLAN', amountCents: 8000000n },

    // Week 3
    { lineId: 'line-umsatz', weekOffset: 3, valueType: 'PLAN', amountCents: 10000000n },
    { lineId: 'line-forderungen', weekOffset: 3, valueType: 'PLAN', amountCents: 500000n }, // 5,000.00
    { lineId: 'line-loehne', weekOffset: 3, valueType: 'PLAN', amountCents: 8000000n },

    // Weeks 4-12: Umsatz and Loehne only (no Forderungen)
    ...Array.from({ length: 9 }, (_, i) => [
      { lineId: 'line-umsatz', weekOffset: i + 4, valueType: 'PLAN' as const, amountCents: 10000000n },
      { lineId: 'line-loehne', weekOffset: i + 4, valueType: 'PLAN' as const, amountCents: 8000000n },
    ]).flat(),
  ],
};

/**
 * Expected results for FULL_13_WEEK_FIXTURE (from specification).
 *
 * Week 0: IST override applies, so Umsatz = 95,000 instead of 100,000
 * - Opening: 50,000.00
 * - Inflows: 95,000 + 20,000 = 115,000.00
 * - Outflows: 80,000.00
 * - Net: 35,000.00
 * - Closing: 85,000.00
 *
 * Note: Specification shows 115,000 inflows but that includes 100k Umsatz.
 * With IST override of 95k, inflows = 95k + 20k = 115k (matches spec since
 * spec uses IST value).
 */
export const FULL_13_WEEK_EXPECTED = {
  week0: {
    openingBalanceCents: 5000000n,
    totalInflowsCents: 11500000n, // 95,000 (IST) + 20,000 = 115,000.00
    totalOutflowsCents: 8000000n,
    netCashflowCents: 3500000n,
    closingBalanceCents: 8500000n,
  },
  week1: {
    openingBalanceCents: 8500000n,
    totalInflowsCents: 11500000n, // 100,000 + 15,000 = 115,000.00
    totalOutflowsCents: 8000000n,
    netCashflowCents: 3500000n,
    closingBalanceCents: 12000000n,
  },
  week2: {
    openingBalanceCents: 12000000n,
    totalInflowsCents: 11000000n, // 100,000 + 10,000 = 110,000.00
    totalOutflowsCents: 8000000n,
    netCashflowCents: 3000000n,
    closingBalanceCents: 15000000n,
  },
  week3: {
    openingBalanceCents: 15000000n,
    totalInflowsCents: 10500000n, // 100,000 + 5,000 = 105,000.00
    totalOutflowsCents: 8000000n,
    netCashflowCents: 2500000n,
    closingBalanceCents: 17500000n,
  },
  // Weeks 4-12: 100,000 inflows, 80,000 outflows, 20,000 net each
  week12: {
    closingBalanceCents: 35500000n, // Final: 355,000.00 EUR
  },
};

// ============================================================================
// FIXTURE: DETERMINISM TEST
// ============================================================================

/**
 * Fixture specifically for determinism testing.
 * Should produce identical results regardless of calculation order.
 */
export const DETERMINISM_TEST_FIXTURE: LiquidityCalculationInput = {
  openingBalanceCents: 7500000n, // 75,000.00 EUR
  categories: [
    { id: 'cat-a', name: 'Category A', flowType: 'INFLOW', estateType: 'NEUMASSE', displayOrder: 0 },
    { id: 'cat-b', name: 'Category B', flowType: 'INFLOW', estateType: 'ALTMASSE', displayOrder: 1 },
    { id: 'cat-c', name: 'Category C', flowType: 'OUTFLOW', estateType: 'NEUMASSE', displayOrder: 0 },
    { id: 'cat-d', name: 'Category D', flowType: 'OUTFLOW', estateType: 'ALTMASSE', displayOrder: 1 },
  ],
  lines: [
    { id: 'line-a1', categoryId: 'cat-a', name: 'Line A1', displayOrder: 0 },
    { id: 'line-a2', categoryId: 'cat-a', name: 'Line A2', displayOrder: 1 },
    { id: 'line-b1', categoryId: 'cat-b', name: 'Line B1', displayOrder: 0 },
    { id: 'line-c1', categoryId: 'cat-c', name: 'Line C1', displayOrder: 0 },
    { id: 'line-c2', categoryId: 'cat-c', name: 'Line C2', displayOrder: 1 },
    { id: 'line-d1', categoryId: 'cat-d', name: 'Line D1', displayOrder: 0 },
  ],
  weeklyValues: [
    // Create a pattern across multiple weeks
    { lineId: 'line-a1', weekOffset: 0, valueType: 'PLAN', amountCents: 1000000n },
    { lineId: 'line-a2', weekOffset: 0, valueType: 'PLAN', amountCents: 500000n },
    { lineId: 'line-b1', weekOffset: 0, valueType: 'PLAN', amountCents: 750000n },
    { lineId: 'line-c1', weekOffset: 0, valueType: 'PLAN', amountCents: 800000n },
    { lineId: 'line-c2', weekOffset: 0, valueType: 'PLAN', amountCents: 200000n },
    { lineId: 'line-d1', weekOffset: 0, valueType: 'PLAN', amountCents: 300000n },

    { lineId: 'line-a1', weekOffset: 5, valueType: 'PLAN', amountCents: 1100000n },
    { lineId: 'line-a2', weekOffset: 5, valueType: 'PLAN', amountCents: 550000n },
    { lineId: 'line-b1', weekOffset: 5, valueType: 'PLAN', amountCents: 800000n },
    { lineId: 'line-c1', weekOffset: 5, valueType: 'PLAN', amountCents: 900000n },
    { lineId: 'line-c2', weekOffset: 5, valueType: 'PLAN', amountCents: 250000n },
    { lineId: 'line-d1', weekOffset: 5, valueType: 'PLAN', amountCents: 350000n },

    { lineId: 'line-a1', weekOffset: 12, valueType: 'PLAN', amountCents: 1200000n },
    { lineId: 'line-a2', weekOffset: 12, valueType: 'PLAN', amountCents: 600000n },
    { lineId: 'line-b1', weekOffset: 12, valueType: 'IST', amountCents: 850000n },
    { lineId: 'line-c1', weekOffset: 12, valueType: 'IST', amountCents: 950000n },
    { lineId: 'line-c2', weekOffset: 12, valueType: 'PLAN', amountCents: 300000n },
    { lineId: 'line-d1', weekOffset: 12, valueType: 'PLAN', amountCents: 400000n },
  ],
};

// ============================================================================
// INVALID FIXTURES (for validation testing)
// ============================================================================

/**
 * Invalid fixture with week offset out of range
 */
export const INVALID_WEEK_OFFSET_FIXTURE = {
  openingBalanceCents: 1000000n,
  categories: [
    { id: 'cat-1', name: 'Test', flowType: 'INFLOW', estateType: 'NEUMASSE', displayOrder: 0 },
  ],
  lines: [
    { id: 'line-1', categoryId: 'cat-1', name: 'Test Line', displayOrder: 0 },
  ],
  weeklyValues: [
    { lineId: 'line-1', weekOffset: 13, valueType: 'PLAN', amountCents: 100000n }, // Invalid: 13 > 12
  ],
};

/**
 * Invalid fixture with duplicate value
 */
export const INVALID_DUPLICATE_VALUE_FIXTURE = {
  openingBalanceCents: 1000000n,
  categories: [
    { id: 'cat-1', name: 'Test', flowType: 'INFLOW', estateType: 'NEUMASSE', displayOrder: 0 },
  ],
  lines: [
    { id: 'line-1', categoryId: 'cat-1', name: 'Test Line', displayOrder: 0 },
  ],
  weeklyValues: [
    { lineId: 'line-1', weekOffset: 0, valueType: 'PLAN', amountCents: 100000n },
    { lineId: 'line-1', weekOffset: 0, valueType: 'PLAN', amountCents: 200000n }, // Duplicate
  ],
};

/**
 * Invalid fixture with broken reference
 */
export const INVALID_REFERENCE_FIXTURE = {
  openingBalanceCents: 1000000n,
  categories: [
    { id: 'cat-1', name: 'Test', flowType: 'INFLOW', estateType: 'NEUMASSE', displayOrder: 0 },
  ],
  lines: [
    { id: 'line-1', categoryId: 'cat-nonexistent', name: 'Test Line', displayOrder: 0 }, // Invalid reference
  ],
  weeklyValues: [],
};
