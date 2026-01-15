# Quick Reference Card
## 13-Week Liquidity Engine

---

## Core Formula

```
CLOSING_BALANCE[W] = OPENING_BALANCE[W] + INFLOWS[W] - OUTFLOWS[W]
OPENING_BALANCE[W+1] = CLOSING_BALANCE[W]
```

---

## Effective Value Rule

```
EFFECTIVE = IST ?? PLAN ?? 0
```

IST always overrides PLAN. If IST exists (even if 0), PLAN is ignored.

---

## Data Model Summary

```
InsolvencyCase
    └── LiquidityPlan
            ├── LiquidityPlanVersion (immutable snapshots)
            └── CashflowCategory
                    └── CashflowLine
                            └── WeeklyValue (IST or PLAN)
```

---

## Enums

| Enum | Values |
|------|--------|
| FlowType | `INFLOW`, `OUTFLOW` |
| EstateType | `ALTMASSE`, `NEUMASSE` |
| ValueType | `IST`, `PLAN` |
| CaseStatus | `PRELIMINARY`, `OPENED`, `CLOSED` |

---

## Monetary Values

| Aspect | Rule |
|--------|------|
| Storage | 64-bit integer (cents) |
| 1 EUR | 100 cents |
| Rounding | Round half-up on input |
| Display | German locale (1.234,56) |

```typescript
// Input
cents = BigInt(Math.round(euros * 100))

// Display
euros = Number(cents) / 100
display = euros.toLocaleString('de-DE', { minimumFractionDigits: 2 })
```

---

## Week Constraints

| Constraint | Value |
|------------|-------|
| Total weeks | 13 (0-12) |
| Week offset range | 0 to 12 inclusive |
| Plan start | Must be Monday |
| Week definition | ISO 8601 |

---

## Required Audit Fields

Every entity needs:
- `id` (UUID, immutable)
- `created_at` (timestamp, immutable)
- `created_by` (string)
- `updated_at` (timestamp)
- `updated_by` (string)

---

## Standard Categories

### Inflows

| Name | Estate |
|------|--------|
| Forderungseinzuege | ALTMASSE |
| Anlagenverkaeufe | ALTMASSE |
| Sonstige Einzahlungen Alt | ALTMASSE |
| Umsatzerloese | NEUMASSE |
| Sonstige Einzahlungen Neu | NEUMASSE |

### Outflows

| Name | Estate |
|------|--------|
| Altmasseverbindlichkeiten | ALTMASSE |
| Sonstige Auszahlungen Alt | ALTMASSE |
| Loehne und Gehaelter | NEUMASSE |
| Sozialversicherung | NEUMASSE |
| Miete und Nebenkosten | NEUMASSE |
| Material und Waren | NEUMASSE |
| Sonstige Auszahlungen Neu | NEUMASSE |

---

## Validation Checklist

- [ ] Week offset in [0, 12]
- [ ] Plan start date is Monday
- [ ] No duplicate (line, week, valueType)
- [ ] Required fields non-null
- [ ] Category name unique per (plan, flowType, estateType)
- [ ] Version numbers sequential

---

## Test Invariants

1. `SUM(weekly_net) == final_closing - initial_opening`
2. `opening[W+1] == closing[W]`
3. `net[W] == inflows[W] - outflows[W]`
4. Same inputs always produce same outputs
