/**
 * Core Liquidity Engine - Comprehensive Tests
 *
 * Tests cover:
 * - IST override rule
 * - Missing weeks handling
 * - Negative values
 * - Estate separation (Altmasse/Neumasse)
 * - Determinism
 * - Validation errors
 * - Balance propagation
 * - Full 13-week scenario
 *
 * Run with: npx tsx --test src/core/liquidity-engine.test.ts
 *
 * @module core/tests
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';

import {
  validateInput,
  calculateLiquidity,
  getEffectiveValue,
  verifyCalculationIntegrity,
  transformToUIPayload,
  calculateDataHash,
  verifyDataHash,
  getCanonicalString,
  formatEuro,
  centsToEuro,
  processLiquidityPlan,
  ErrorCodes,
  WEEK_COUNT,
} from './index';

import {
  EMPTY_PLAN_FIXTURE,
  MINIMAL_PLAN_FIXTURE,
  IST_OVERRIDE_FIXTURE,
  NEGATIVE_VALUES_FIXTURE,
  NEGATIVE_OPENING_FIXTURE,
  ESTATE_SEPARATION_FIXTURE,
  FULL_13_WEEK_FIXTURE,
  FULL_13_WEEK_EXPECTED,
  DETERMINISM_TEST_FIXTURE,
  INVALID_WEEK_OFFSET_FIXTURE,
  INVALID_DUPLICATE_VALUE_FIXTURE,
  INVALID_REFERENCE_FIXTURE,
} from './fixtures';

// ============================================================================
// TEST: EFFECTIVE VALUE CALCULATION (IST Override Rule)
// ============================================================================

describe('getEffectiveValue - IST Override Rule', () => {
  it('should return IST when both IST and PLAN exist', () => {
    const result = getEffectiveValue(800000n, 1000000n);
    assert.equal(result.value, 800000n);
    assert.equal(result.source, 'IST');
  });

  it('should return IST when IST is zero (IST overrides even when 0)', () => {
    const result = getEffectiveValue(0n, 1000000n);
    assert.equal(result.value, 0n);
    assert.equal(result.source, 'IST');
  });

  it('should return IST when IST is negative', () => {
    const result = getEffectiveValue(-500000n, 1000000n);
    assert.equal(result.value, -500000n);
    assert.equal(result.source, 'IST');
  });

  it('should return PLAN when only PLAN exists', () => {
    const result = getEffectiveValue(null, 1000000n);
    assert.equal(result.value, 1000000n);
    assert.equal(result.source, 'PLAN');
  });

  it('should return IST when only IST exists', () => {
    const result = getEffectiveValue(500000n, null);
    assert.equal(result.value, 500000n);
    assert.equal(result.source, 'IST');
  });

  it('should return 0 with DEFAULT source when neither exists', () => {
    const result = getEffectiveValue(null, null);
    assert.equal(result.value, 0n);
    assert.equal(result.source, 'DEFAULT');
  });
});

// ============================================================================
// TEST: INPUT VALIDATION
// ============================================================================

describe('validateInput', () => {
  it('should accept valid empty plan', () => {
    const result = validateInput(EMPTY_PLAN_FIXTURE);
    assert.equal(result.valid, true);
  });

  it('should accept valid minimal plan', () => {
    const result = validateInput(MINIMAL_PLAN_FIXTURE);
    assert.equal(result.valid, true);
  });

  it('should accept valid full 13-week plan', () => {
    const result = validateInput(FULL_13_WEEK_FIXTURE);
    assert.equal(result.valid, true);
  });

  it('should reject null input', () => {
    const result = validateInput(null);
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0].code, ErrorCodes.INPUT_NULL_OR_UNDEFINED);
    }
  });

  it('should reject undefined input', () => {
    const result = validateInput(undefined);
    assert.equal(result.valid, false);
  });

  it('should reject invalid week offset (13)', () => {
    const result = validateInput(INVALID_WEEK_OFFSET_FIXTURE);
    assert.equal(result.valid, false);
    if (!result.valid) {
      const weekOffsetError = result.errors.find(
        (e) => e.code === ErrorCodes.WEEKLY_VALUE_INVALID_WEEK_OFFSET
      );
      assert.ok(weekOffsetError, 'Should have week offset error');
    }
  });

  it('should reject duplicate weekly values', () => {
    const result = validateInput(INVALID_DUPLICATE_VALUE_FIXTURE);
    assert.equal(result.valid, false);
    if (!result.valid) {
      const duplicateError = result.errors.find(
        (e) => e.code === ErrorCodes.WEEKLY_VALUE_DUPLICATE
      );
      assert.ok(duplicateError, 'Should have duplicate error');
    }
  });

  it('should reject invalid category reference', () => {
    const result = validateInput(INVALID_REFERENCE_FIXTURE);
    assert.equal(result.valid, false);
    if (!result.valid) {
      const refError = result.errors.find(
        (e) => e.code === ErrorCodes.LINE_INVALID_CATEGORY_REFERENCE
      );
      assert.ok(refError, 'Should have reference error');
    }
  });

  it('should reject missing required fields', () => {
    const result = validateInput({
      categories: [],
      lines: [],
      weeklyValues: [],
      // Missing openingBalanceCents
    });
    assert.equal(result.valid, false);
    if (!result.valid) {
      const missingFieldError = result.errors.find(
        (e) => e.code === ErrorCodes.INPUT_OPENING_BALANCE_INVALID
      );
      assert.ok(missingFieldError, 'Should have missing field error');
    }
  });
});

// ============================================================================
// TEST: EMPTY PLAN CALCULATION
// ============================================================================

describe('calculateLiquidity - Empty Plan', () => {
  it('should handle empty plan with zero cashflows', () => {
    const result = calculateLiquidity(EMPTY_PLAN_FIXTURE);

    assert.equal(result.weeks.length, WEEK_COUNT);
    assert.equal(result.grandTotalInflowsCents, 0n);
    assert.equal(result.grandTotalOutflowsCents, 0n);
    assert.equal(result.grandTotalNetCashflowCents, 0n);

    // Closing balance should equal opening balance when no cashflows
    assert.equal(
      result.finalClosingBalanceCents,
      EMPTY_PLAN_FIXTURE.openingBalanceCents
    );

    // Each week should have zero cashflow
    for (const week of result.weeks) {
      assert.equal(week.totalInflowsCents, 0n);
      assert.equal(week.totalOutflowsCents, 0n);
      assert.equal(week.netCashflowCents, 0n);
    }
  });
});

// ============================================================================
// TEST: IST OVERRIDE IN CALCULATION
// ============================================================================

describe('calculateLiquidity - IST Override', () => {
  it('should use IST value when both IST and PLAN exist', () => {
    const result = calculateLiquidity(IST_OVERRIDE_FIXTURE);

    // Week 0: IST = 8,000, PLAN = 10,000 -> Effective = 8,000
    const week0 = result.weeks[0];
    assert.equal(week0.totalInflowsCents, 800000n);

    // Week 1: IST = 0, PLAN = 10,000 -> Effective = 0
    const week1 = result.weeks[1];
    assert.equal(week1.totalInflowsCents, 0n);

    // Week 2: Only PLAN = 10,000 -> Effective = 10,000
    const week2 = result.weeks[2];
    assert.equal(week2.totalInflowsCents, 1000000n);

    // Week 3: Only IST = 12,000 -> Effective = 12,000
    const week3 = result.weeks[3];
    assert.equal(week3.totalInflowsCents, 1200000n);

    // Weeks 4-12: No values -> Effective = 0
    for (let i = 4; i < WEEK_COUNT; i++) {
      assert.equal(result.weeks[i].totalInflowsCents, 0n);
    }
  });

  it('should track value source in line totals', () => {
    const result = calculateLiquidity(IST_OVERRIDE_FIXTURE);
    const lineTotals = result.lineTotals[0];

    // Week 0: IST source
    assert.equal(lineTotals.weeklyEffectiveValues[0].source, 'IST');
    assert.equal(lineTotals.weeklyEffectiveValues[0].istAmountCents, 800000n);
    assert.equal(lineTotals.weeklyEffectiveValues[0].planAmountCents, 1000000n);

    // Week 1: IST source (even though IST is 0)
    assert.equal(lineTotals.weeklyEffectiveValues[1].source, 'IST');
    assert.equal(lineTotals.weeklyEffectiveValues[1].istAmountCents, 0n);

    // Week 2: PLAN source
    assert.equal(lineTotals.weeklyEffectiveValues[2].source, 'PLAN');
    assert.equal(lineTotals.weeklyEffectiveValues[2].planAmountCents, 1000000n);
    assert.equal(lineTotals.weeklyEffectiveValues[2].istAmountCents, null);

    // Week 4: DEFAULT source (no values)
    assert.equal(lineTotals.weeklyEffectiveValues[4].source, 'DEFAULT');
  });
});

// ============================================================================
// TEST: NEGATIVE VALUES
// ============================================================================

describe('calculateLiquidity - Negative Values', () => {
  it('should handle negative values correctly', () => {
    const result = calculateLiquidity(NEGATIVE_VALUES_FIXTURE);

    // Week 0: Revenue 50,000 + Refund -5,000 = 45,000 inflows
    const week0 = result.weeks[0];
    assert.equal(week0.totalInflowsCents, 4500000n); // 50,000 - 5,000

    // Outflows should be positive
    assert.equal(week0.totalOutflowsCents, 3000000n);

    // Net should be correct
    assert.equal(week0.netCashflowCents, 1500000n); // 45,000 - 30,000
  });

  it('should correctly calculate closing balance with negative values', () => {
    const result = calculateLiquidity(NEGATIVE_VALUES_FIXTURE);

    // Opening: 100,000
    // Week 0 net: 15,000
    // Week 1 net: (50,000 - 2,000) - 30,000 = 18,000
    // Closing Week 1: 100,000 + 15,000 + 18,000 = 133,000
    assert.equal(result.weeks[1].closingBalanceCents, 13300000n);
  });
});

// ============================================================================
// TEST: NEGATIVE OPENING BALANCE
// ============================================================================

describe('calculateLiquidity - Negative Opening Balance', () => {
  it('should handle negative opening balance (overdraft)', () => {
    const result = calculateLiquidity(NEGATIVE_OPENING_FIXTURE);

    // Opening: -20,000
    assert.equal(result.weeks[0].openingBalanceCents, -2000000n);

    // Week 0: +10,000 inflow, -20,000 + 10,000 = -10,000
    assert.equal(result.weeks[0].closingBalanceCents, -1000000n);

    // Week 1: +10,000 inflow, -10,000 + 10,000 = 0
    assert.equal(result.weeks[1].closingBalanceCents, 0n);

    // Week 2: +10,000 inflow, 0 + 10,000 = 10,000
    assert.equal(result.weeks[2].closingBalanceCents, 1000000n);

    // Final closing balance
    assert.equal(result.finalClosingBalanceCents, 1000000n);
  });
});

// ============================================================================
// TEST: ESTATE SEPARATION (Altmasse vs Neumasse)
// ============================================================================

describe('calculateLiquidity - Estate Separation', () => {
  it('should correctly separate Altmasse and Neumasse inflows', () => {
    const result = calculateLiquidity(ESTATE_SEPARATION_FIXTURE);

    // Week 0: Altmasse inflow = 20,000, Neumasse inflow = 50,000
    const week0 = result.weeks[0];
    assert.equal(week0.inflowsAltmasseCents, 2000000n);
    assert.equal(week0.inflowsNeumasseCents, 5000000n);
    assert.equal(week0.totalInflowsCents, 7000000n);
  });

  it('should correctly separate Altmasse and Neumasse outflows', () => {
    const result = calculateLiquidity(ESTATE_SEPARATION_FIXTURE);

    // Week 0: Altmasse outflow = 15,000, Neumasse outflow = 40,000
    const week0 = result.weeks[0];
    assert.equal(week0.outflowsAltmasseCents, 1500000n);
    assert.equal(week0.outflowsNeumasseCents, 4000000n);
    assert.equal(week0.totalOutflowsCents, 5500000n);
  });

  it('should handle weeks with only Altmasse values', () => {
    const result = calculateLiquidity(ESTATE_SEPARATION_FIXTURE);

    // Week 1: Only Altmasse values
    const week1 = result.weeks[1];
    assert.equal(week1.inflowsAltmasseCents, 1500000n);
    assert.equal(week1.inflowsNeumasseCents, 0n);
    assert.equal(week1.outflowsAltmasseCents, 1000000n);
    assert.equal(week1.outflowsNeumasseCents, 0n);
  });

  it('should handle weeks with only Neumasse values', () => {
    const result = calculateLiquidity(ESTATE_SEPARATION_FIXTURE);

    // Week 2: Only Neumasse values
    const week2 = result.weeks[2];
    assert.equal(week2.inflowsAltmasseCents, 0n);
    assert.equal(week2.inflowsNeumasseCents, 5000000n);
    assert.equal(week2.outflowsAltmasseCents, 0n);
    assert.equal(week2.outflowsNeumasseCents, 4000000n);
  });

  it('should track estate types in category totals', () => {
    const result = calculateLiquidity(ESTATE_SEPARATION_FIXTURE);

    const altmasseInflowCat = result.categoryTotals.find(
      (c) => c.flowType === 'INFLOW' && c.estateType === 'ALTMASSE'
    );
    const neumasseInflowCat = result.categoryTotals.find(
      (c) => c.flowType === 'INFLOW' && c.estateType === 'NEUMASSE'
    );

    assert.ok(altmasseInflowCat);
    assert.ok(neumasseInflowCat);

    // Total Altmasse inflows: 20,000 + 15,000 = 35,000
    assert.equal(altmasseInflowCat.totalCents, 3500000n);

    // Total Neumasse inflows: 50,000 + 50,000 = 100,000
    assert.equal(neumasseInflowCat.totalCents, 10000000n);
  });
});

// ============================================================================
// TEST: BALANCE PROPAGATION
// ============================================================================

describe('calculateLiquidity - Balance Propagation', () => {
  it('should correctly propagate balances across all 13 weeks', () => {
    const result = calculateLiquidity(FULL_13_WEEK_FIXTURE);

    // Check that opening[W+1] = closing[W] for all weeks
    for (let i = 0; i < WEEK_COUNT - 1; i++) {
      assert.equal(
        result.weeks[i + 1].openingBalanceCents,
        result.weeks[i].closingBalanceCents,
        `Balance propagation failed at week ${i}`
      );
    }
  });

  it('should satisfy closing = opening + net for each week', () => {
    const result = calculateLiquidity(FULL_13_WEEK_FIXTURE);

    for (const week of result.weeks) {
      const expectedClosing = week.openingBalanceCents + week.netCashflowCents;
      assert.equal(
        week.closingBalanceCents,
        expectedClosing,
        `Closing calculation failed for week ${week.weekOffset}`
      );
    }
  });

  it('should satisfy net = inflows - outflows for each week', () => {
    const result = calculateLiquidity(FULL_13_WEEK_FIXTURE);

    for (const week of result.weeks) {
      const expectedNet = week.totalInflowsCents - week.totalOutflowsCents;
      assert.equal(
        week.netCashflowCents,
        expectedNet,
        `Net calculation failed for week ${week.weekOffset}`
      );
    }
  });

  it('should verify integrity with verifyCalculationIntegrity', () => {
    const result = calculateLiquidity(FULL_13_WEEK_FIXTURE);
    const integrity = verifyCalculationIntegrity(
      result,
      FULL_13_WEEK_FIXTURE.openingBalanceCents
    );

    assert.equal(integrity.valid, true);
    assert.equal(integrity.errors.length, 0);
  });
});

// ============================================================================
// TEST: FULL 13-WEEK SCENARIO (TC-FULL-01)
// ============================================================================

describe('calculateLiquidity - Full 13-Week Scenario', () => {
  it('should calculate Week 0 correctly with IST override', () => {
    const result = calculateLiquidity(FULL_13_WEEK_FIXTURE);
    const week0 = result.weeks[0];

    // IST override: Umsatz = 95,000 instead of 100,000
    assert.equal(week0.openingBalanceCents, FULL_13_WEEK_EXPECTED.week0.openingBalanceCents);
    assert.equal(week0.totalInflowsCents, FULL_13_WEEK_EXPECTED.week0.totalInflowsCents);
    assert.equal(week0.totalOutflowsCents, FULL_13_WEEK_EXPECTED.week0.totalOutflowsCents);
    assert.equal(week0.netCashflowCents, FULL_13_WEEK_EXPECTED.week0.netCashflowCents);
    assert.equal(week0.closingBalanceCents, FULL_13_WEEK_EXPECTED.week0.closingBalanceCents);
  });

  it('should calculate Week 1 correctly', () => {
    const result = calculateLiquidity(FULL_13_WEEK_FIXTURE);
    const week1 = result.weeks[1];

    assert.equal(week1.openingBalanceCents, FULL_13_WEEK_EXPECTED.week1.openingBalanceCents);
    assert.equal(week1.totalInflowsCents, FULL_13_WEEK_EXPECTED.week1.totalInflowsCents);
    assert.equal(week1.closingBalanceCents, FULL_13_WEEK_EXPECTED.week1.closingBalanceCents);
  });

  it('should calculate final closing balance correctly', () => {
    const result = calculateLiquidity(FULL_13_WEEK_FIXTURE);

    assert.equal(
      result.finalClosingBalanceCents,
      FULL_13_WEEK_EXPECTED.week12.closingBalanceCents
    );
  });

  it('should satisfy total consistency invariant', () => {
    const result = calculateLiquidity(FULL_13_WEEK_FIXTURE);

    // Sum of weekly nets should equal final closing - initial opening
    const sumOfNets = result.weeks.reduce((sum, week) => sum + week.netCashflowCents, 0n);
    const expectedDelta =
      result.finalClosingBalanceCents - FULL_13_WEEK_FIXTURE.openingBalanceCents;

    assert.equal(sumOfNets, expectedDelta);
    assert.equal(result.grandTotalNetCashflowCents, expectedDelta);
  });
});

// ============================================================================
// TEST: DETERMINISM
// ============================================================================

describe('calculateLiquidity - Determinism', () => {
  it('should produce identical results on repeated calculations', () => {
    const result1 = calculateLiquidity(DETERMINISM_TEST_FIXTURE);
    const result2 = calculateLiquidity(DETERMINISM_TEST_FIXTURE);
    const result3 = calculateLiquidity(DETERMINISM_TEST_FIXTURE);

    // All results should be identical
    assert.equal(result1.finalClosingBalanceCents, result2.finalClosingBalanceCents);
    assert.equal(result2.finalClosingBalanceCents, result3.finalClosingBalanceCents);

    assert.equal(result1.grandTotalInflowsCents, result2.grandTotalInflowsCents);
    assert.equal(result1.grandTotalOutflowsCents, result2.grandTotalOutflowsCents);

    // Hash should be identical
    assert.equal(result1.dataHash, result2.dataHash);
    assert.equal(result2.dataHash, result3.dataHash);
  });

  it('should produce identical results regardless of array order in memory', () => {
    // Create two inputs with same data but different insertion order
    const fixture1 = { ...DETERMINISM_TEST_FIXTURE };
    const fixture2 = {
      ...DETERMINISM_TEST_FIXTURE,
      weeklyValues: [...DETERMINISM_TEST_FIXTURE.weeklyValues].reverse(),
      categories: [...DETERMINISM_TEST_FIXTURE.categories].reverse(),
      lines: [...DETERMINISM_TEST_FIXTURE.lines].reverse(),
    };

    const result1 = calculateLiquidity(fixture1);
    const result2 = calculateLiquidity(fixture2);

    assert.equal(result1.finalClosingBalanceCents, result2.finalClosingBalanceCents);
    assert.equal(result1.grandTotalInflowsCents, result2.grandTotalInflowsCents);
    assert.equal(result1.grandTotalOutflowsCents, result2.grandTotalOutflowsCents);

    // Note: Hash may differ because it depends on value order
    // But calculation results should be identical
  });

  it('should produce deterministic hash', () => {
    const hash1 = calculateDataHash(
      DETERMINISM_TEST_FIXTURE.openingBalanceCents,
      DETERMINISM_TEST_FIXTURE.weeklyValues.map((v) => ({
        lineId: v.lineId,
        weekOffset: v.weekOffset,
        valueType: v.valueType,
        amountCents: v.amountCents,
      }))
    );

    const hash2 = calculateDataHash(
      DETERMINISM_TEST_FIXTURE.openingBalanceCents,
      DETERMINISM_TEST_FIXTURE.weeklyValues.map((v) => ({
        lineId: v.lineId,
        weekOffset: v.weekOffset,
        valueType: v.valueType,
        amountCents: v.amountCents,
      }))
    );

    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64); // SHA-256 is 64 hex characters
  });
});

// ============================================================================
// TEST: DATA HASH
// ============================================================================

describe('calculateDataHash', () => {
  it('should produce 64-character hex string', () => {
    const hash = calculateDataHash(1000000n, [
      { lineId: 'line-1', weekOffset: 0, valueType: 'PLAN', amountCents: 100000n },
    ]);

    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]+$/);
  });

  it('should produce different hashes for different data', () => {
    const hash1 = calculateDataHash(1000000n, [
      { lineId: 'line-1', weekOffset: 0, valueType: 'PLAN', amountCents: 100000n },
    ]);

    const hash2 = calculateDataHash(1000000n, [
      { lineId: 'line-1', weekOffset: 0, valueType: 'PLAN', amountCents: 100001n },
    ]);

    assert.notEqual(hash1, hash2);
  });

  it('should produce same hash regardless of input order', () => {
    const values = [
      { lineId: 'line-2', weekOffset: 1, valueType: 'PLAN' as const, amountCents: 200000n },
      { lineId: 'line-1', weekOffset: 0, valueType: 'PLAN' as const, amountCents: 100000n },
    ];

    const reversedValues = [...values].reverse();

    const hash1 = calculateDataHash(1000000n, values);
    const hash2 = calculateDataHash(1000000n, reversedValues);

    assert.equal(hash1, hash2);
  });

  it('should verify hash correctly', () => {
    const values = [
      { lineId: 'line-1', weekOffset: 0, valueType: 'PLAN' as const, amountCents: 100000n },
    ];

    const hash = calculateDataHash(1000000n, values);

    assert.equal(verifyDataHash(hash, 1000000n, values), true);
    assert.equal(verifyDataHash('wrong-hash', 1000000n, values), false);
  });

  it('should produce consistent canonical string', () => {
    const values = [
      { lineId: 'line-2', weekOffset: 1, valueType: 'PLAN' as const, amountCents: 200000n },
      { lineId: 'line-1', weekOffset: 0, valueType: 'IST' as const, amountCents: 100000n },
      { lineId: 'line-1', weekOffset: 0, valueType: 'PLAN' as const, amountCents: 150000n },
    ];

    const canonical = getCanonicalString(1000000n, values);

    // Should be sorted by lineId, weekOffset, valueType
    assert.ok(canonical.startsWith('opening:1000000|'));
    assert.ok(canonical.includes('line-1:0:IST:100000'));
    assert.ok(canonical.includes('line-1:0:PLAN:150000'));
    assert.ok(canonical.includes('line-2:1:PLAN:200000'));

    // line-1 should come before line-2
    const line1Pos = canonical.indexOf('line-1');
    const line2Pos = canonical.indexOf('line-2');
    assert.ok(line1Pos < line2Pos);
  });
});

// ============================================================================
// TEST: OUTPUT TRANSFORMATION
// ============================================================================

describe('transformToUIPayload', () => {
  it('should produce valid KPIs', () => {
    const result = calculateLiquidity(FULL_13_WEEK_FIXTURE);
    const payload = transformToUIPayload(
      result,
      FULL_13_WEEK_FIXTURE.categories,
      FULL_13_WEEK_FIXTURE.lines,
      FULL_13_WEEK_FIXTURE.openingBalanceCents
    );

    assert.ok(payload.kpis);
    assert.equal(payload.kpis.openingBalance.cents, FULL_13_WEEK_FIXTURE.openingBalanceCents);
    assert.equal(payload.kpis.closingBalance.cents, result.finalClosingBalanceCents);
    assert.equal(payload.kpis.totalInflows.cents, result.grandTotalInflowsCents);
    assert.equal(payload.kpis.totalOutflows.cents, result.grandTotalOutflowsCents);
    assert.equal(payload.kpis.netChange.cents, result.grandTotalNetCashflowCents);
  });

  it('should detect negative balances', () => {
    const result = calculateLiquidity(NEGATIVE_OPENING_FIXTURE);
    const payload = transformToUIPayload(
      result,
      NEGATIVE_OPENING_FIXTURE.categories,
      NEGATIVE_OPENING_FIXTURE.lines,
      NEGATIVE_OPENING_FIXTURE.openingBalanceCents
    );

    // Opening is -20,000 and some weeks have negative closing balances
    assert.equal(payload.kpis.hasNegativeBalance, true);
    assert.ok(payload.kpis.negativeBalanceWeeks >= 1);
    assert.equal(payload.kpis.minWeeklyBalance.isNegative, true);
  });

  it('should produce valid table series', () => {
    const result = calculateLiquidity(FULL_13_WEEK_FIXTURE);
    const payload = transformToUIPayload(
      result,
      FULL_13_WEEK_FIXTURE.categories,
      FULL_13_WEEK_FIXTURE.lines,
      FULL_13_WEEK_FIXTURE.openingBalanceCents
    );

    assert.ok(payload.tableSeries);
    assert.ok(payload.tableSeries.rows.length > 0);
    assert.ok(payload.tableSeries.balanceRow);
    assert.equal(payload.tableSeries.balanceRow.weeklyValues.length, WEEK_COUNT);
  });

  it('should produce valid chart series', () => {
    const result = calculateLiquidity(FULL_13_WEEK_FIXTURE);
    const payload = transformToUIPayload(
      result,
      FULL_13_WEEK_FIXTURE.categories,
      FULL_13_WEEK_FIXTURE.lines,
      FULL_13_WEEK_FIXTURE.openingBalanceCents
    );

    assert.ok(payload.chartSeries);
    assert.equal(payload.chartSeries.dataPoints.length, WEEK_COUNT);
    assert.ok(typeof payload.chartSeries.minValue === 'number');
    assert.ok(typeof payload.chartSeries.maxValue === 'number');

    // Check data points have correct structure
    for (const dp of payload.chartSeries.dataPoints) {
      assert.ok(typeof dp.weekOffset === 'number');
      assert.ok(typeof dp.weekLabel === 'string');
      assert.ok(typeof dp.openingBalance === 'number');
      assert.ok(typeof dp.closingBalance === 'number');
    }
  });
});

// ============================================================================
// TEST: FORMATTING UTILITIES
// ============================================================================

describe('Formatting Utilities', () => {
  it('should format euros correctly', () => {
    assert.equal(formatEuro(123456n), '1.234,56');
    assert.equal(formatEuro(100n), '1,00');
    assert.equal(formatEuro(0n), '0,00');
    assert.equal(formatEuro(-123456n), '-1.234,56');
  });

  it('should convert cents to euros correctly', () => {
    assert.equal(centsToEuro(100n), 1);
    assert.equal(centsToEuro(123456n), 1234.56);
    assert.equal(centsToEuro(0n), 0);
    assert.equal(centsToEuro(-100n), -1);
  });
});

// ============================================================================
// TEST: CONVENIENCE FUNCTION
// ============================================================================

describe('processLiquidityPlan', () => {
  it('should process valid input and return success', () => {
    const result = processLiquidityPlan(FULL_13_WEEK_FIXTURE);

    assert.equal(result.success, true);
    if (result.success) {
      assert.ok(result.payload);
      assert.ok(result.payload.kpis);
      assert.ok(result.payload.tableSeries);
      assert.ok(result.payload.chartSeries);
    }
  });

  it('should return errors for invalid input', () => {
    const result = processLiquidityPlan(INVALID_WEEK_OFFSET_FIXTURE);

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.errors.length > 0);
    }
  });

  it('should return errors for null input', () => {
    const result = processLiquidityPlan(null);

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.errors.length > 0);
    }
  });
});

// ============================================================================
// TEST: EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle maximum bigint values safely', () => {
    // This test ensures we don't overflow
    const maxValue = 9007199254740991n; // Max safe integer in cents (~90 trillion EUR)

    const fixture = {
      openingBalanceCents: maxValue,
      categories: [
        { id: 'cat-1', name: 'Test', flowType: 'INFLOW' as const, estateType: 'NEUMASSE' as const, displayOrder: 0 },
      ],
      lines: [
        { id: 'line-1', categoryId: 'cat-1', name: 'Test Line', displayOrder: 0 },
      ],
      weeklyValues: [] as any[],
    };

    const result = calculateLiquidity(fixture);

    // With no cashflows, closing should equal opening
    assert.equal(result.finalClosingBalanceCents, maxValue);
  });

  it('should handle very small values (1 cent)', () => {
    const fixture = {
      openingBalanceCents: 1n,
      categories: [
        { id: 'cat-1', name: 'Test', flowType: 'INFLOW' as const, estateType: 'NEUMASSE' as const, displayOrder: 0 },
      ],
      lines: [
        { id: 'line-1', categoryId: 'cat-1', name: 'Test Line', displayOrder: 0 },
      ],
      weeklyValues: [
        { lineId: 'line-1', weekOffset: 0, valueType: 'PLAN' as const, amountCents: 1n },
      ],
    };

    const result = calculateLiquidity(fixture);

    assert.equal(result.weeks[0].totalInflowsCents, 1n);
    assert.equal(result.weeks[0].closingBalanceCents, 2n);
  });

  it('should handle lines with no values in any week', () => {
    const fixture = {
      openingBalanceCents: 1000000n,
      categories: [
        { id: 'cat-1', name: 'Test', flowType: 'INFLOW' as const, estateType: 'NEUMASSE' as const, displayOrder: 0 },
      ],
      lines: [
        { id: 'line-empty', categoryId: 'cat-1', name: 'Empty Line', displayOrder: 0 },
      ],
      weeklyValues: [] as any[],
    };

    const result = calculateLiquidity(fixture);

    // Line totals should exist but be zero
    assert.equal(result.lineTotals.length, 1);
    assert.equal(result.lineTotals[0].totalCents, 0n);

    // All weekly effective values should be DEFAULT source with 0
    for (const wev of result.lineTotals[0].weeklyEffectiveValues) {
      assert.equal(wev.effectiveAmountCents, 0n);
      assert.equal(wev.source, 'DEFAULT');
    }
  });

  it('should handle values only in week 12', () => {
    const fixture = {
      openingBalanceCents: 5000000n,
      categories: [
        { id: 'cat-1', name: 'Test', flowType: 'INFLOW' as const, estateType: 'NEUMASSE' as const, displayOrder: 0 },
      ],
      lines: [
        { id: 'line-1', categoryId: 'cat-1', name: 'Test Line', displayOrder: 0 },
      ],
      weeklyValues: [
        { lineId: 'line-1', weekOffset: 12, valueType: 'PLAN' as const, amountCents: 1000000n },
      ],
    };

    const result = calculateLiquidity(fixture);

    // Weeks 0-11 should have zero inflows
    for (let i = 0; i < 12; i++) {
      assert.equal(result.weeks[i].totalInflowsCents, 0n);
    }

    // Week 12 should have the inflow
    assert.equal(result.weeks[12].totalInflowsCents, 1000000n);

    // Final balance should be opening + week 12 inflow
    assert.equal(result.finalClosingBalanceCents, 6000000n);
  });

  it('should handle values only in week 0', () => {
    const fixture = {
      openingBalanceCents: 5000000n,
      categories: [
        { id: 'cat-1', name: 'Test', flowType: 'OUTFLOW' as const, estateType: 'NEUMASSE' as const, displayOrder: 0 },
      ],
      lines: [
        { id: 'line-1', categoryId: 'cat-1', name: 'Test Line', displayOrder: 0 },
      ],
      weeklyValues: [
        { lineId: 'line-1', weekOffset: 0, valueType: 'PLAN' as const, amountCents: 2000000n },
      ],
    };

    const result = calculateLiquidity(fixture);

    // Week 0 should have the outflow
    assert.equal(result.weeks[0].totalOutflowsCents, 2000000n);
    assert.equal(result.weeks[0].closingBalanceCents, 3000000n);

    // Weeks 1-12 should have zero outflows and maintain balance
    for (let i = 1; i < 13; i++) {
      assert.equal(result.weeks[i].totalOutflowsCents, 0n);
      assert.equal(result.weeks[i].closingBalanceCents, 3000000n);
    }
  });
});

console.log('All tests defined. Run with: npx tsx --test src/core/liquidity-engine.test.ts');
