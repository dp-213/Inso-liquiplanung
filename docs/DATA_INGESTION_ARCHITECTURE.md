# Data Ingestion and Normalization Architecture

## Insolvency Liquidity Planning Platform

**Version:** 1.0.0
**Status:** Architecture Specification
**Last Updated:** 2026-01-15
**Depends On:** SPECIFICATION.md v1.0.0

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Core Principles](#2-core-principles)
3. [Ingestion Pipeline Architecture](#3-ingestion-pipeline-architecture)
4. [Source-Specific Pipelines](#4-source-specific-pipelines)
5. [Canonical Intermediate Schema](#5-canonical-intermediate-schema)
6. [Mapping Strategy](#6-mapping-strategy)
7. [Validation Framework](#7-validation-framework)
8. [Error Handling](#8-error-handling)
9. [Traceability and Lineage](#9-traceability-and-lineage)
10. [Versioning and Auditability](#10-versioning-and-auditability)
11. [Admin Dashboard Structure](#11-admin-dashboard-structure)
12. [Appendices](#appendices)

---

## 1. Architecture Overview

### 1.1 System Context

```
+------------------+     +-------------------------+     +------------------+
|                  |     |                         |     |                  |
|  External Data   | --> |   Ingestion Layer       | --> |  Core Engine     |
|  Sources         |     |   (This Document)       |     |  (Black Box)     |
|                  |     |                         |     |                  |
+------------------+     +-------------------------+     +------------------+
                                    |
                                    v
                         +-------------------------+
                         |                         |
                         |   Admin Dashboard       |
                         |   (Visibility Layer)    |
                         |                         |
                         +-------------------------+
```

### 1.2 Architectural Boundaries

| Layer | Responsibility | This Document |
|-------|----------------|---------------|
| **Data Sources** | External systems providing raw data | OUT OF SCOPE |
| **Ingestion Layer** | Upload, parse, validate, map, normalize | IN SCOPE |
| **Core Engine** | Deterministic liquidity calculation | OUT OF SCOPE (Black Box) |
| **Presentation Layer** | Dashboard, reports, visibility | IN SCOPE (Conceptual) |

### 1.3 Data Flow Overview

```
Raw Input --> Upload --> Validate Structure --> Parse --> Stage Raw
                                                            |
                                                            v
                                                       Map to Canonical
                                                            |
                                                            v
                                                       Validate Business
                                                            |
                                                            v
                                                       Normalize
                                                            |
                                                            v
                                                       Stage Normalized
                                                            |
                                                            v
                                                       Manual Review (if needed)
                                                            |
                                                            v
                                                       Commit to Core Schema
                                                            |
                                                            v
                                                       Core Engine Input
```

---

## 2. Core Principles

### 2.1 Non-Negotiable Constraints

| Principle | Description | Enforcement |
|-----------|-------------|-------------|
| **No Calculation** | Ingestion layer NEVER performs liquidity calculations | Code review, architecture tests |
| **No Interpretation** | Data is mapped, not inferred or guessed | Explicit mapping tables only |
| **No Silent Changes** | Every transformation is logged and traceable | Immutable audit trail |
| **No Auto-Correction** | Invalid data is flagged, not fixed | Quarantine + manual review |
| **Explicit Mapping** | Every source field must map to a defined target | Mapping configuration required |

### 2.2 Mapping Philosophy

```
ALLOWED:
- Field renaming (source_col -> target_col)
- Type conversion with explicit rules (string "1.234,56" -> cents 123456)
- Unit conversion with explicit rules (EUR -> cents * 100)
- Date format conversion (DD.MM.YYYY -> ISO 8601)
- Static value assignment (missing currency -> "EUR")
- Lookup table mapping (account code -> category)

FORBIDDEN:
- Value inference ("probably means X")
- Missing value imputation (guess missing values)
- Formula application (compute derived values)
- Semantic interpretation (decide what data means)
- Automatic categorization without explicit rules
```

### 2.3 Quality Tiers

| Tier | Description | Action |
|------|-------------|--------|
| **Tier 1: Valid** | All validations pass, mapping complete | Auto-commit to staging |
| **Tier 2: Reviewable** | Minor issues, can be resolved with user input | Queue for manual review |
| **Tier 3: Quarantined** | Structural issues, cannot be processed | Quarantine + notify user |
| **Tier 4: Rejected** | Fails integrity checks, likely corrupt | Reject + log reason |

---

## 3. Ingestion Pipeline Architecture

### 3.1 Pipeline Stages

```
Stage 1: UPLOAD
    |-- Receive file/data
    |-- Assign ingestion_id (UUID)
    |-- Record metadata (filename, size, hash, timestamp, user)
    |-- Store raw file in immutable storage
    |
Stage 2: STRUCTURAL_VALIDATION
    |-- Verify file format (extension, MIME type)
    |-- Check encoding (UTF-8 required)
    |-- Validate structure (CSV headers, XML schema, etc.)
    |-- Detect delimiter and formatting
    |
Stage 3: PARSE
    |-- Extract records from raw format
    |-- Apply source-specific parser
    |-- Generate parsed_record entries
    |-- Link to ingestion_id
    |
Stage 4: STAGE_RAW
    |-- Store parsed records in raw staging table
    |-- Preserve original values as strings
    |-- No transformations applied yet
    |
Stage 5: MAP
    |-- Apply mapping configuration
    |-- Transform values per mapping rules
    |-- Generate mapped_record entries
    |-- Record all transformations
    |
Stage 6: BUSINESS_VALIDATION
    |-- Validate against business rules
    |-- Check referential integrity
    |-- Verify value constraints
    |-- Flag issues by severity
    |
Stage 7: NORMALIZE
    |-- Convert to canonical schema format
    |-- Apply final transformations
    |-- Generate normalized_record entries
    |
Stage 8: REVIEW (conditional)
    |-- Present issues to user
    |-- Collect resolutions
    |-- Re-validate after resolution
    |
Stage 9: COMMIT
    |-- Move normalized data to core schema
    |-- Create version snapshot
    |-- Update lineage records
```

### 3.2 Pipeline State Machine

```
                    +-------------+
                    |   PENDING   |
                    +------+------+
                           |
                           v
                    +-------------+
                    | VALIDATING  |
                    +------+------+
                           |
              +------------+------------+
              |                         |
              v                         v
       +-------------+           +-------------+
       |   PARSING   |           |  REJECTED   |
       +------+------+           +-------------+
              |
              v
       +-------------+
       |   STAGING   |
       +------+------+
              |
              v
       +-------------+
       |   MAPPING   |
       +------+------+
              |
              v
       +-------------+
       | VALIDATING  |
       |  BUSINESS   |
       +------+------+
              |
     +--------+--------+
     |        |        |
     v        v        v
+--------+ +--------+ +--------+
|  READY | | REVIEW | |QUARANT.|
+---+----+ +---+----+ +--------+
    |          |
    |          v
    |     +--------+
    |     |RESOLVED|
    |     +---+----+
    |         |
    +----+----+
         |
         v
    +--------+
    |COMMITTED|
    +--------+
```

### 3.3 Core Pipeline Entities

#### IngestionJob

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `case_id` | UUID | Yes | Target insolvency case |
| `plan_id` | UUID | No | Target liquidity plan (null if new plan) |
| `source_type` | Enum | Yes | Type of data source |
| `file_name` | String(255) | Yes | Original filename |
| `file_hash_sha256` | String(64) | Yes | SHA-256 of uploaded file |
| `file_size_bytes` | BigInt | Yes | File size in bytes |
| `status` | Enum | Yes | Current pipeline status |
| `error_count` | Integer | Yes | Number of errors |
| `warning_count` | Integer | Yes | Number of warnings |
| `record_count_raw` | Integer | No | Records parsed |
| `record_count_normalized` | Integer | No | Records normalized |
| `started_at` | Timestamp | Yes | Pipeline start time |
| `completed_at` | Timestamp | No | Pipeline completion time |
| `created_by` | String(255) | Yes | User who initiated |

**Source Types:**

```
CSV_GENERIC         - Generic CSV file
CSV_BANK_STATEMENT  - Bank statement CSV
CSV_SUSA            - Trial balance (SuSa) CSV
CSV_PNL             - P&L extract CSV
CSV_BALANCE_SHEET   - Balance sheet CSV
EXCEL_LIQUIDITY     - Pre-existing Excel liquidity plan
JSON_IMPORT         - JSON import format
XML_DATEV           - DATEV XML export
MT940               - SWIFT MT940 bank statement
CAMT053             - ISO 20022 camt.053 bank statement
```

#### IngestionRecord

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `job_id` | UUID | Yes | Parent ingestion job |
| `row_number` | Integer | Yes | Original row/record number |
| `raw_data` | JSONB | Yes | Original values (string) |
| `mapped_data` | JSONB | No | After mapping (typed) |
| `normalized_data` | JSONB | No | Canonical form |
| `status` | Enum | Yes | Record status |
| `validation_errors` | JSONB | No | List of errors |
| `validation_warnings` | JSONB | No | List of warnings |

#### MappingConfiguration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `name` | String(255) | Yes | Configuration name |
| `source_type` | Enum | Yes | Source type this applies to |
| `version` | Integer | Yes | Configuration version |
| `is_active` | Boolean | Yes | Currently active version |
| `field_mappings` | JSONB | Yes | Field mapping rules |
| `value_mappings` | JSONB | Yes | Value transformation rules |
| `category_mappings` | JSONB | Yes | Category assignment rules |
| `created_at` | Timestamp | Yes | Creation time |
| `created_by` | String(255) | Yes | Creator |

---

## 4. Source-Specific Pipelines

### 4.1 CSV Generic Upload

**Use Case:** User uploads arbitrary CSV with cashflow data.

#### Expected Input Format

```csv
date,description,amount,type,category
2026-01-06,Customer Payment ABC,15000.00,inflow,revenue
2026-01-07,Salary Payment,8500.00,outflow,wages
```

#### Parser Configuration

| Parameter | Value | Notes |
|-----------|-------|-------|
| Encoding | UTF-8 | Required, reject otherwise |
| Delimiter | Auto-detect | Comma, semicolon, tab |
| Quote Character | Auto-detect | Double quote, single quote |
| Header Row | Required | First row must be headers |
| Decimal Separator | Configurable | "." or "," |
| Thousands Separator | Configurable | "," or "." or space |

#### Field Mapping Requirements

| Source Field | Target Field | Required | Transformation |
|--------------|--------------|----------|----------------|
| date | `week_offset` | Yes | Convert to ISO week, calculate offset |
| description | `line_name` | Yes | Direct copy |
| amount | `amount_cents` | Yes | Parse decimal, convert to cents |
| type | `flow_type` | Yes | Map to INFLOW/OUTFLOW |
| category | `category_id` | No | Lookup in category mapping table |

#### Validation Rules

| Rule | Severity | Description |
|------|----------|-------------|
| CSV-001 | ERROR | Date must be parseable |
| CSV-002 | ERROR | Amount must be numeric |
| CSV-003 | ERROR | Type must map to INFLOW or OUTFLOW |
| CSV-004 | WARNING | Date outside 13-week window |
| CSV-005 | WARNING | Category not found in mapping |
| CSV-006 | ERROR | Duplicate date+description combination |

---

### 4.2 Bank Statement Import

**Use Case:** Import bank transactions to populate IST values.

#### Supported Formats

| Format | Description | Parser |
|--------|-------------|--------|
| MT940 | SWIFT standard | Specialized MT940 parser |
| CAMT.053 | ISO 20022 XML | XML parser with schema validation |
| CSV (Bank) | Bank-specific CSV | Configurable CSV parser |

#### MT940 Field Mapping

| MT940 Field | Tag | Target Field | Transformation |
|-------------|-----|--------------|----------------|
| Statement Date | :60F/:60M | `reference_date` | Parse YYMMDD |
| Opening Balance | :60F/:60M | `opening_balance` | Parse amount + sign |
| Transaction Date | :61 | `transaction_date` | Parse YYMMDD |
| Amount | :61 | `amount_cents` | Parse, convert to cents |
| Credit/Debit | :61 | `flow_type` | C->INFLOW, D->OUTFLOW |
| Reference | :61 | `reference` | Extract reference |
| Description | :86 | `description` | Concatenate lines |
| Closing Balance | :62F/:62M | `closing_balance` | Parse amount + sign |

#### CAMT.053 Field Mapping

| XPath | Target Field | Transformation |
|-------|--------------|----------------|
| `/BkToCstmrStmt/Stmt/Bal[Tp/CdOrPrtry/Cd='OPBD']/Amt` | `opening_balance` | Parse amount |
| `/BkToCstmrStmt/Stmt/Ntry/BookgDt/Dt` | `transaction_date` | Parse ISO date |
| `/BkToCstmrStmt/Stmt/Ntry/Amt` | `amount_cents` | Parse, convert to cents |
| `/BkToCstmrStmt/Stmt/Ntry/CdtDbtInd` | `flow_type` | CRDT->INFLOW, DBIT->OUTFLOW |
| `/BkToCstmrStmt/Stmt/Ntry/NtryDtls/TxDtls/RmtInf/Ustrd` | `description` | Concatenate |

#### Bank Statement Validation

| Rule | Severity | Description |
|------|----------|-------------|
| BANK-001 | ERROR | Opening balance must match previous closing |
| BANK-002 | ERROR | Transaction date required |
| BANK-003 | ERROR | Amount must be non-zero |
| BANK-004 | WARNING | Transaction date outside statement period |
| BANK-005 | INFO | Duplicate transaction reference detected |

#### Bank Statement Special Handling

```
IMPORTANT: Bank statements are IST (actual) values ONLY.

Flow:
1. Parse bank statement
2. Map transactions to week offsets
3. Attempt to match to existing PLAN lines (by description similarity)
4. If match found: Populate IST value for that line/week
5. If no match: Create new line in appropriate category + populate IST
6. User must review and confirm all mappings
```

---

### 4.3 Trial Balance (SuSa) Import

**Use Case:** Extract opening balances and receivables from accounting system.

#### Expected SuSa Structure

| Column | German | Description | Required |
|--------|--------|-------------|----------|
| Account Number | Kontonummer | Account code | Yes |
| Account Name | Kontobezeichnung | Account description | Yes |
| Opening Debit | Anfangsbestand Soll | Opening debit balance | No |
| Opening Credit | Anfangsbestand Haben | Opening credit balance | No |
| Period Debit | Umsatz Soll | Period debit movements | No |
| Period Credit | Umsatz Haben | Period credit movements | No |
| Closing Debit | Schlussbestand Soll | Closing debit balance | Yes |
| Closing Credit | Schlussbestand Haben | Closing credit balance | Yes |

#### Account Code Mapping Strategy

```
Account ranges must be explicitly configured per client:

1000-1999: Assets (Vermoegenswerte)
    1200-1299: Receivables -> INFLOW/ALTMASSE (Forderungen)
    1400-1499: Bank accounts -> Opening balance reference
    1500-1599: Cash -> Opening balance reference

2000-2999: Liabilities (Verbindlichkeiten)
    2000-2099: Trade payables -> OUTFLOW/ALTMASSE
    2100-2199: Loans payable -> OUTFLOW/ALTMASSE

4000-4999: Revenue (Erloese)
    4000-4099: Sales revenue -> INFLOW/NEUMASSE

5000-5999: Cost of goods (Wareneinsatz)
    5000-5099: Materials -> OUTFLOW/NEUMASSE

6000-6999: Operating expenses (Betriebsausgaben)
    6000-6099: Wages -> OUTFLOW/NEUMASSE
    6200-6299: Rent -> OUTFLOW/NEUMASSE
```

#### SuSa Field Mapping

| Source | Target | Transformation |
|--------|--------|----------------|
| Account Number | `category_id` | Lookup in account mapping table |
| Account Name | `line_name` | Direct copy (may be overridden) |
| Closing Balance | `amount_cents` | Debit - Credit, convert to cents |
| Statement Date | `effective_date` | Reference date for balance |

#### SuSa Validation Rules

| Rule | Severity | Description |
|------|----------|-------------|
| SUSA-001 | ERROR | Account number required |
| SUSA-002 | ERROR | Closing balance must be calculable |
| SUSA-003 | WARNING | Account number not in mapping table |
| SUSA-004 | WARNING | Balance sign unexpected for account type |
| SUSA-005 | INFO | Zero balance account skipped |

#### SuSa Special Handling

```
CRITICAL: SuSa provides point-in-time balances, not weekly cashflows.

For liquidity planning:
1. Receivables (Forderungen) balance represents expected future INFLOWS
   - Must be distributed across weeks based on collection assumptions
   - User MUST provide distribution profile (explicit configuration)

2. Payables (Verbindlichkeiten) balance represents expected future OUTFLOWS
   - Must be distributed across weeks based on payment terms
   - User MUST provide distribution profile (explicit configuration)

3. Bank/Cash balance may be used as opening balance reference
   - Requires explicit user confirmation
```

---

### 4.4 P&L / Balance Sheet Extract Import

**Use Case:** Import financial statement data for planning basis.

#### P&L Extract Structure

| Column | Description | Target |
|--------|-------------|--------|
| Period | Accounting period | Week mapping reference |
| Account | Account code | Category lookup |
| Description | Line description | Line name |
| Budget | Budget/Plan amount | PLAN value basis |
| Actual | Actual amount | IST value (if period complete) |

#### P&L Mapping Strategy

```
P&L items are ACCRUAL-based, not CASH-based.

Transformation required:
1. Revenue -> Expected cash collection (with timing assumption)
2. Cost of Sales -> Expected cash payment (with timing assumption)
3. Operating Expenses -> Expected cash payment (by expense type)

Each transformation requires EXPLICIT timing rules:
- Revenue: Collection days assumption (e.g., 30 days)
- Expenses: Payment terms assumption (e.g., immediate, 30 days)

NO IMPLICIT ASSUMPTIONS. User must configure timing profiles.
```

#### Balance Sheet Extract Structure

| Column | Description | Target |
|--------|-------------|--------|
| Account | Account code | Category lookup |
| Description | Line description | Line name |
| Current Balance | As-of balance | Position reference |
| Prior Balance | Previous period | Comparison |

#### Balance Sheet Validation

| Rule | Severity | Description |
|------|----------|-------------|
| BS-001 | ERROR | Account code required |
| BS-002 | ERROR | Balance must be numeric |
| BS-003 | WARNING | Significant balance change without explanation |
| BS-004 | INFO | Account type indicates non-cash item |

---

### 4.5 Pre-Existing Liquidity Plan Import

**Use Case:** Import existing Excel-based liquidity plans to bootstrap the system.

#### Supported Formats

| Format | Description | Confidence |
|--------|-------------|------------|
| Standard 13-Week | Standard insolvency format | High |
| Custom Excel | Client-specific format | Requires mapping |
| JSON Export | System JSON format | Direct import |

#### Excel Structure Detection

```
Step 1: Identify Structure
    - Locate header row (week identifiers)
    - Identify week columns (W1-W13 or dates)
    - Locate category headers
    - Identify line items
    - Find opening balance

Step 2: Validate Structure
    - Must have 13 weeks
    - Must have recognizable categories
    - Must have numeric values

Step 3: Map Structure
    - Map detected categories to canonical categories
    - Map week columns to week offsets
    - Identify IST vs PLAN separation (if present)
```

#### Excel Mapping Configuration

| Detected Element | Configuration Required |
|------------------|----------------------|
| Week Headers | Column positions for W0-W12 |
| Category Names | Mapping to canonical categories |
| Line Items | Category assignment rules |
| Value Type | IST/PLAN column identification |
| Opening Balance | Cell reference |
| Estate Type | Altmasse/Neumasse section markers |

#### Excel Import Validation

| Rule | Severity | Description |
|------|----------|-------------|
| XLS-001 | ERROR | Cannot detect week structure |
| XLS-002 | ERROR | Less than 13 weeks found |
| XLS-003 | ERROR | Opening balance not found |
| XLS-004 | WARNING | Category not mappable |
| XLS-005 | WARNING | Value not numeric |
| XLS-006 | INFO | Empty row skipped |

---

## 5. Canonical Intermediate Schema

### 5.1 Purpose

The Canonical Intermediate Schema (CIS) is the normalized form all ingested data must pass through before reaching the core engine. It provides:

1. **Uniform structure** regardless of source format
2. **Validation checkpoint** before core engine input
3. **Lineage anchor** for traceability
4. **Review stage** for manual intervention

### 5.2 CIS Entity: StagedCashflowEntry

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `job_id` | UUID | Yes | Parent ingestion job |
| `source_record_id` | UUID | Yes | Link to IngestionRecord |
| `target_category_name` | String(255) | Yes | Resolved category name |
| `target_category_flow_type` | Enum | Yes | INFLOW or OUTFLOW |
| `target_category_estate_type` | Enum | Yes | ALTMASSE or NEUMASSE |
| `line_name` | String(255) | Yes | Line item name |
| `line_description` | String(1000) | No | Optional description |
| `week_offset` | Integer | Yes | Target week (0-12) |
| `value_type` | Enum | Yes | IST or PLAN |
| `amount_cents` | BigInt | Yes | Amount in euro cents |
| `note` | String(500) | No | Optional note |
| `confidence_score` | Decimal(3,2) | No | Mapping confidence (0-1) |
| `requires_review` | Boolean | Yes | Flag for manual review |
| `review_reason` | String(500) | No | Why review needed |
| `reviewed_by` | String(255) | No | Reviewer user |
| `reviewed_at` | Timestamp | No | Review timestamp |
| `review_action` | Enum | No | APPROVE, MODIFY, REJECT |
| `status` | Enum | Yes | STAGED, REVIEWED, COMMITTED, REJECTED |

### 5.3 CIS Validation Rules

| Rule | Field | Constraint |
|------|-------|------------|
| CIS-001 | `week_offset` | Must be 0-12 |
| CIS-002 | `value_type` | Must be IST or PLAN |
| CIS-003 | `target_category_flow_type` | Must be INFLOW or OUTFLOW |
| CIS-004 | `target_category_estate_type` | Must be ALTMASSE or NEUMASSE |
| CIS-005 | `line_name` | Non-empty, max 255 chars |
| CIS-006 | `amount_cents` | Valid BigInt |
| CIS-007 | `confidence_score` | If present, must be 0.00-1.00 |

### 5.4 CIS to Core Schema Transformation

```
StagedCashflowEntry --> Core Schema Entities

1. Group staged entries by (category_name, flow_type, estate_type)
2. For each group:
   a. Find or create CashflowCategory
   b. For each unique line_name in group:
      i.  Find or create CashflowLine under category
      ii. For each (week_offset, value_type) combination:
          - Create or update WeeklyValue

No calculations performed. Pure structural transformation.
```

---

## 6. Mapping Strategy

### 6.1 Mapping Configuration Schema

```json
{
  "mappingConfigurationSchema": {
    "version": "1.0.0",
    "sourceType": "CSV_GENERIC",
    "fieldMappings": [
      {
        "sourceField": "date",
        "targetField": "week_offset",
        "transformationType": "DATE_TO_WEEK_OFFSET",
        "transformationParams": {
          "dateFormat": "DD.MM.YYYY",
          "planStartDate": "${plan_start_date}"
        },
        "required": true,
        "defaultValue": null
      },
      {
        "sourceField": "amount",
        "targetField": "amount_cents",
        "transformationType": "DECIMAL_TO_CENTS",
        "transformationParams": {
          "decimalSeparator": ",",
          "thousandsSeparator": "."
        },
        "required": true,
        "defaultValue": null
      }
    ],
    "valueMappings": [
      {
        "sourceField": "type",
        "targetField": "flow_type",
        "mappingType": "LOOKUP",
        "lookupTable": {
          "einzahlung": "INFLOW",
          "einnahme": "INFLOW",
          "inflow": "INFLOW",
          "auszahlung": "OUTFLOW",
          "ausgabe": "OUTFLOW",
          "outflow": "OUTFLOW"
        },
        "caseSensitive": false,
        "unmappedAction": "ERROR"
      }
    ],
    "categoryMappings": [
      {
        "matchField": "category",
        "matchType": "CONTAINS",
        "matchValue": "umsatz",
        "targetCategory": "Umsatzerloese",
        "targetFlowType": "INFLOW",
        "targetEstateType": "NEUMASSE",
        "priority": 1
      },
      {
        "matchField": "category",
        "matchType": "CONTAINS",
        "matchValue": "lohn",
        "targetCategory": "Loehne und Gehaelter",
        "targetFlowType": "OUTFLOW",
        "targetEstateType": "NEUMASSE",
        "priority": 1
      }
    ]
  }
}
```

### 6.2 Transformation Types

| Type | Description | Parameters |
|------|-------------|------------|
| `DIRECT` | Copy value as-is | None |
| `RENAME` | Copy with field rename | None |
| `DATE_TO_WEEK_OFFSET` | Convert date to week offset | `dateFormat`, `planStartDate` |
| `DECIMAL_TO_CENTS` | Convert decimal EUR to cents | `decimalSeparator`, `thousandsSeparator` |
| `LOOKUP` | Map via lookup table | `lookupTable`, `caseSensitive`, `unmappedAction` |
| `REGEX_EXTRACT` | Extract via regex | `pattern`, `group` |
| `CONCATENATE` | Join multiple fields | `fields`, `separator` |
| `SPLIT` | Split field into parts | `separator`, `index` |
| `STATIC` | Assign static value | `value` |
| `CONDITIONAL` | Value based on condition | `conditions`, `default` |

### 6.3 Transformation Rules

```typescript
interface TransformationRule {
    sourceField: string;
    targetField: string;
    transformationType: TransformationType;
    transformationParams: Record<string, any>;
    required: boolean;
    defaultValue: any | null;
    validationRules: ValidationRule[];
}

// Example: Date to Week Offset
function dateToWeekOffset(
    dateString: string,
    dateFormat: string,
    planStartDate: Date
): number | null {
    const date = parseDate(dateString, dateFormat);
    if (!date) return null;

    const diffMs = date.getTime() - planStartDate.getTime();
    const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));

    if (diffWeeks < 0 || diffWeeks > 12) {
        return null; // Out of range
    }

    return diffWeeks;
}

// Example: Decimal to Cents
function decimalToCents(
    valueString: string,
    decimalSeparator: string,
    thousandsSeparator: string
): bigint | null {
    // Remove thousands separators
    let cleaned = valueString.replace(
        new RegExp('\\' + thousandsSeparator, 'g'),
        ''
    );

    // Normalize decimal separator
    cleaned = cleaned.replace(decimalSeparator, '.');

    // Parse and convert
    const value = parseFloat(cleaned);
    if (isNaN(value)) return null;

    // Round half-up and convert to cents
    return BigInt(Math.round(value * 100));
}
```

### 6.4 Category Assignment Strategy

```
Priority Order (highest first):
1. Explicit field mapping (source has category field)
2. Account code mapping (for SuSa imports)
3. Description keyword matching (configurable rules)
4. Default category assignment (user-configured fallback)
5. Quarantine (no mapping found)

CRITICAL: No automatic categorization without explicit rules.
Every category assignment must trace to a configured rule.
```

---

## 7. Validation Framework

### 7.1 Validation Levels

| Level | Stage | Description |
|-------|-------|-------------|
| **L1: Structural** | Parse | File format, encoding, schema |
| **L2: Syntactic** | Map | Field types, formats, ranges |
| **L3: Semantic** | Normalize | Business rules, referential integrity |
| **L4: Consistency** | Pre-Commit | Cross-record consistency |

### 7.2 Validation Rule Schema

```json
{
  "validationRule": {
    "id": "VAL-001",
    "name": "Week Offset Range",
    "level": "L2",
    "severity": "ERROR",
    "field": "week_offset",
    "ruleType": "RANGE",
    "parameters": {
      "min": 0,
      "max": 12
    },
    "message": "Week offset must be between 0 and 12",
    "messageParams": ["${value}", "${min}", "${max}"]
  }
}
```

### 7.3 Standard Validation Rules

#### L1: Structural Validation

| ID | Rule | Severity |
|----|------|----------|
| L1-001 | File must be readable | ERROR |
| L1-002 | File encoding must be UTF-8 | ERROR |
| L1-003 | File must match expected format | ERROR |
| L1-004 | Required columns must exist | ERROR |
| L1-005 | File size within limits | ERROR |

#### L2: Syntactic Validation

| ID | Rule | Severity |
|----|------|----------|
| L2-001 | Date fields must be parseable | ERROR |
| L2-002 | Numeric fields must be parseable | ERROR |
| L2-003 | Enum fields must have valid values | ERROR |
| L2-004 | String fields within length limits | WARNING |
| L2-005 | Required fields must be non-empty | ERROR |

#### L3: Semantic Validation

| ID | Rule | Severity |
|----|------|----------|
| L3-001 | Week offset must be 0-12 | ERROR |
| L3-002 | Flow type must be INFLOW or OUTFLOW | ERROR |
| L3-003 | Estate type must be ALTMASSE or NEUMASSE | ERROR |
| L3-004 | Value type must be IST or PLAN | ERROR |
| L3-005 | Category must exist or be creatable | WARNING |
| L3-006 | Amount should be non-zero | INFO |
| L3-007 | IST values should be for past/current weeks | WARNING |

#### L4: Consistency Validation

| ID | Rule | Severity |
|----|------|----------|
| L4-001 | No duplicate (line, week, value_type) | ERROR |
| L4-002 | Opening balance must be consistent | ERROR |
| L4-003 | Total inflows should approximate total outflows | INFO |
| L4-004 | Week continuity (no gaps in IST weeks) | WARNING |

### 7.4 Validation Result Structure

```typescript
interface ValidationResult {
    isValid: boolean;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    issues: ValidationIssue[];
}

interface ValidationIssue {
    id: string;
    ruleId: string;
    severity: 'ERROR' | 'WARNING' | 'INFO';
    level: 'L1' | 'L2' | 'L3' | 'L4';
    recordId: string | null;
    field: string | null;
    value: any;
    message: string;
    suggestedAction: string | null;
}
```

---

## 8. Error Handling

### 8.1 Error Classification

| Category | Description | Action |
|----------|-------------|--------|
| **Fatal** | Cannot proceed at all | Abort job, notify user |
| **Blocking** | Cannot process record | Quarantine record |
| **Recoverable** | Issue with clear resolution | Flag for review |
| **Informational** | Notice, no action needed | Log only |

### 8.2 Error Response Matrix

| Error Type | Auto-Retry | User Notification | Data Action |
|------------|------------|-------------------|-------------|
| Network timeout | Yes (3x) | After retries fail | Hold |
| Parse failure | No | Immediate | Quarantine |
| Validation error | No | Batch summary | Flag |
| Mapping failure | No | Immediate | Quarantine |
| Duplicate data | No | In summary | Skip or merge (user choice) |
| Out of range | No | In summary | Quarantine |

### 8.3 Quarantine Handling

```
Quarantine Queue:
1. Records that cannot be processed are moved to quarantine
2. Each quarantined record includes:
   - Original raw data
   - Reason for quarantine
   - Attempted transformations
   - Suggested resolutions
3. User must explicitly resolve each quarantined item:
   - MODIFY: Change value and re-validate
   - SKIP: Exclude from import
   - FORCE: Override validation (audit logged)

No automatic resolution of quarantined data.
```

### 8.4 Error Logging Schema

```typescript
interface ErrorLog {
    id: string;
    timestamp: Date;
    jobId: string;
    recordId: string | null;
    errorCode: string;
    errorCategory: 'FATAL' | 'BLOCKING' | 'RECOVERABLE' | 'INFO';
    errorMessage: string;
    errorDetails: Record<string, any>;
    stackTrace: string | null;
    resolution: string | null;
    resolvedBy: string | null;
    resolvedAt: Date | null;
}
```

---

## 9. Traceability and Lineage

### 9.1 Lineage Model

```
RawFile (immutable)
    |
    +-- IngestionJob
            |
            +-- IngestionRecord (raw)
                    |
                    +-- FieldTransformation[]
                            |
                            +-- StagedCashflowEntry
                                    |
                                    +-- ReviewAction (if any)
                                            |
                                            +-- CommitAction
                                                    |
                                                    +-- WeeklyValue (in core schema)
```

### 9.2 Lineage Tracking Tables

#### FieldTransformation

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `record_id` | UUID | Yes | Parent IngestionRecord |
| `source_field` | String(255) | Yes | Original field name |
| `source_value` | Text | Yes | Original value |
| `target_field` | String(255) | Yes | Target field name |
| `target_value` | Text | Yes | Transformed value |
| `transformation_type` | String(50) | Yes | Type of transformation |
| `transformation_config` | JSONB | No | Config used |
| `timestamp` | Timestamp | Yes | When transformation occurred |

#### CommitAction

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `staged_entry_id` | UUID | Yes | Source staged entry |
| `target_entity_type` | String(50) | Yes | Core entity type |
| `target_entity_id` | UUID | Yes | Core entity ID |
| `action_type` | Enum | Yes | CREATE, UPDATE |
| `previous_value` | JSONB | No | Previous state (for updates) |
| `new_value` | JSONB | Yes | New state |
| `committed_by` | String(255) | Yes | User who committed |
| `committed_at` | Timestamp | Yes | Commit timestamp |

### 9.3 Lineage Query Examples

```sql
-- Trace a WeeklyValue back to its source
SELECT
    wv.id AS weekly_value_id,
    wv.amount_cents,
    ca.action_type,
    ca.committed_by,
    ca.committed_at,
    sce.line_name AS staged_line_name,
    sce.amount_cents AS staged_amount,
    ft.source_field,
    ft.source_value,
    ft.transformation_type,
    ir.raw_data,
    ir.row_number,
    ij.file_name,
    ij.file_hash_sha256
FROM weekly_value wv
JOIN commit_action ca ON ca.target_entity_id = wv.id
JOIN staged_cashflow_entry sce ON ca.staged_entry_id = sce.id
JOIN field_transformation ft ON ft.record_id = sce.source_record_id
JOIN ingestion_record ir ON ir.id = sce.source_record_id
JOIN ingestion_job ij ON ij.id = ir.job_id
WHERE wv.id = :weekly_value_id;
```

### 9.4 Lineage Visualization

```
User View: "Where did this value come from?"

+-----------------------+
| Weekly Value          |
| Amount: 12.345,67 EUR |
| Week: 3, IST          |
+-----------------------+
         |
         v
+-----------------------+
| Commit Action         |
| By: consultant@firm   |
| At: 2026-01-15 10:30  |
| Action: CREATE        |
+-----------------------+
         |
         v
+-----------------------+
| Staged Entry          |
| Line: Customer ABC    |
| Category: Revenue     |
| Review: APPROVED      |
+-----------------------+
         |
         v
+-----------------------+
| Transformation        |
| "12345,67" -> 1234567 |
| Type: DECIMAL_TO_CENTS|
+-----------------------+
         |
         v
+-----------------------+
| Raw Record (Row 47)   |
| date: 20.01.2026      |
| desc: Customer ABC    |
| amount: 12345,67      |
+-----------------------+
         |
         v
+-----------------------+
| Source File           |
| bank_statement.csv    |
| SHA256: a1b2c3...     |
| Uploaded: 2026-01-15  |
+-----------------------+
```

---

## 10. Versioning and Auditability

### 10.1 Version Model

```
Every committed dataset creates a version snapshot:

LiquidityPlanVersion
    |-- version_number (sequential)
    |-- snapshot_date (timestamp)
    |-- snapshot_reason (required text)
    |-- opening_balance_cents
    |-- data_hash (SHA-256)
    |-- created_by
    |
    +-- Associated Data (immutable snapshot):
        |-- Categories state
        |-- Lines state
        |-- WeeklyValues state
```

### 10.2 Version Creation Rules

| Trigger | Version Created | Reason Template |
|---------|-----------------|-----------------|
| Initial import | Yes | "Initial data import from {source}" |
| Data modification | Yes | "Manual edit by {user}: {description}" |
| IST value update | Yes | "IST values updated for week {n}" |
| Bulk import | Yes | "Bulk import from {source}: {count} records" |
| Configuration change | No | Config is separate from data |

### 10.3 Audit Trail Schema

#### AuditEvent

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `timestamp` | Timestamp | Yes | Event time (UTC) |
| `event_type` | Enum | Yes | Type of event |
| `entity_type` | String(50) | Yes | Affected entity type |
| `entity_id` | UUID | Yes | Affected entity ID |
| `user_id` | String(255) | Yes | User who performed action |
| `user_ip` | String(45) | Yes | User IP address |
| `user_agent` | String(500) | No | Browser/client info |
| `action` | String(50) | Yes | CREATE, READ, UPDATE, DELETE |
| `old_value` | JSONB | No | Previous state |
| `new_value` | JSONB | No | New state |
| `metadata` | JSONB | No | Additional context |

#### Event Types

```
INGESTION_STARTED
INGESTION_COMPLETED
INGESTION_FAILED
RECORD_CREATED
RECORD_UPDATED
RECORD_DELETED
VERSION_CREATED
MAPPING_CHANGED
REVIEW_COMPLETED
EXPORT_PERFORMED
ACCESS_GRANTED
ACCESS_REVOKED
LOGIN
LOGOUT
```

### 10.4 Reproducibility Guarantee

```
Given:
- Raw file (identified by SHA-256 hash)
- Mapping configuration (versioned)
- Core engine version (semantic version)

The system MUST produce identical output.

Verification:
1. Store data_hash with each version
2. On demand, re-run calculation
3. Compare output hash
4. If mismatch: Flag as integrity issue

This ensures court/auditor can verify calculations
are reproducible and have not been tampered with.
```

### 10.5 Retention Policy

| Data Type | Retention Period | After Expiry |
|-----------|-----------------|--------------|
| Raw files | 10 years | Archive to cold storage |
| Ingestion records | 10 years | Archive to cold storage |
| Audit events | 10 years | Archive to cold storage |
| Plan versions | 10 years | Archive to cold storage |
| Error logs | 2 years | Delete |
| Session logs | 90 days | Delete |

---

## 11. Admin Dashboard Structure

### 11.1 Dashboard Hierarchy

```
ADMIN DASHBOARD (Internal Users Only)
    |
    +-- Project Overview
    |       |-- Insolvency Administrators list
    |       |-- Mandates per administrator
    |       |-- Cases per mandate
    |       |-- Status summary (active, draft, archived)
    |
    +-- Case Management
    |       |-- Case details view
    |       |-- Plans list per case
    |       |-- Version history
    |       |-- Data status indicators
    |
    +-- Ingestion Center
    |       |-- Upload interface
    |       |-- Job queue monitor
    |       |-- Mapping configuration
    |       |-- Quarantine queue
    |       |-- Error log viewer
    |
    +-- Review Queue
    |       |-- Items requiring review
    |       |-- Review workflow
    |       |-- Approval/rejection interface
    |
    +-- Configuration
    |       |-- Mapping templates
    |       |-- Category management
    |       |-- Account code mappings
    |       |-- User management
    |
    +-- Audit & Compliance
            |-- Audit log viewer
            |-- Version comparison
            |-- Data lineage explorer
            |-- Export for auditors
```

### 11.2 View Specifications

#### 11.2.1 Project Overview

| Component | Description | Data |
|-----------|-------------|------|
| Administrator Cards | One card per administrator | Name, mandate count, case count |
| Status Summary | Aggregate status counts | By status: draft, active, archived |
| Recent Activity | Latest changes | Last 10 actions across all cases |
| Alerts | Issues requiring attention | Overdue reviews, failed imports |

**Filters:**
- Administrator name
- Mandate name
- Case status
- Date range

#### 11.2.2 Case Management View

| Component | Description | Data |
|-----------|-------------|------|
| Case Header | Case identification | Case number, debtor, court, status |
| Plan Tabs | One tab per plan | Plan name, version count, active flag |
| Version Timeline | Chronological versions | Version number, date, reason, author |
| Data Status | Import status indicators | Last import date, record counts, errors |
| Quick Actions | Common operations | New import, new version, export |

**Per-Plan Display:**
- Current version summary
- Week-by-week status (IST coverage)
- Validation status (errors, warnings)

#### 11.2.3 Ingestion Center

```
+------------------------------------------+
|  INGESTION CENTER                        |
+------------------------------------------+
|                                          |
|  [Upload Area - Drag & Drop]             |
|                                          |
|  Source Type: [Dropdown]                 |
|  Target Case: [Dropdown]                 |
|  Target Plan: [Dropdown / New]           |
|  Mapping Config: [Dropdown]              |
|                                          |
|  [Start Import]                          |
|                                          |
+------------------------------------------+
|  ACTIVE JOBS                             |
+------------------------------------------+
| Job ID    | File        | Status  | Prog |
|-----------|-------------|---------|------|
| abc-123   | bank.csv    | MAPPING | 45%  |
| def-456   | susa.xlsx   | REVIEW  | 80%  |
+------------------------------------------+
|  QUARANTINE QUEUE (3 items)              |
+------------------------------------------+
| Record    | Issue           | Action     |
|-----------|-----------------|------------|
| Row 47    | Invalid date    | [Review]   |
| Row 103   | Amount parse    | [Review]   |
| Row 156   | No category     | [Review]   |
+------------------------------------------+
```

#### 11.2.4 Review Queue

```
+------------------------------------------+
|  REVIEW QUEUE                            |
+------------------------------------------+
|  Filter: [All] [Pending] [Resolved]      |
|  Sort:   [Oldest First] [Severity]       |
+------------------------------------------+
|                                          |
|  ITEM: Row 47 from bank_statement.csv    |
|  Issue: Date outside 13-week window      |
|  Severity: WARNING                       |
|                                          |
|  Raw Value: 15.03.2026                   |
|  Calculated Week: 10 (outside range)     |
|                                          |
|  Resolution Options:                     |
|  ( ) Assign to week 12 (last week)       |
|  ( ) Exclude from import                 |
|  ( ) Force include with note             |
|                                          |
|  [Apply] [Skip] [Reject All Similar]     |
|                                          |
+------------------------------------------+
```

#### 11.2.5 Configuration Management

```
+------------------------------------------+
|  MAPPING CONFIGURATION                   |
+------------------------------------------+
|  Templates: [Bank CSV] [SuSa] [Custom]   |
+------------------------------------------+
|                                          |
|  Field Mappings:                         |
|  +------+------------+----------------+  |
|  |Source|Target      |Transformation  |  |
|  +------+------------+----------------+  |
|  |date  |week_offset |DATE_TO_WEEK    |  |
|  |betrag|amount_cents|DECIMAL_TO_CENTS|  |
|  |art   |flow_type   |LOOKUP          |  |
|  +------+------------+----------------+  |
|  [Add Field Mapping]                     |
|                                          |
|  Category Mappings:                      |
|  +----------+---------+--------+------+  |
|  |Match     |Category |Flow    |Estate|  |
|  +----------+---------+--------+------+  |
|  |*umsatz*  |Revenue  |INFLOW  |NEU   |  |
|  |*lohn*    |Wages    |OUTFLOW |NEU   |  |
|  +----------+---------+--------+------+  |
|  [Add Category Rule]                     |
|                                          |
|  [Save as Template] [Test with Sample]   |
+------------------------------------------+
```

#### 11.2.6 Audit & Compliance View

```
+------------------------------------------+
|  AUDIT LOG                               |
+------------------------------------------+
|  Case: [Dropdown]  Plan: [Dropdown]      |
|  Date Range: [____] to [____]            |
|  Event Type: [All]  User: [All]          |
+------------------------------------------+
|  Timestamp       | User    | Event       |
|------------------|---------|-------------|
|  2026-01-15 10:30| admin@  | VERSION_NEW |
|  2026-01-15 10:25| admin@  | IMPORT_DONE |
|  2026-01-15 10:20| admin@  | IMPORT_START|
+------------------------------------------+
|                                          |
|  VERSION COMPARISON                      |
|  Compare: [v3] vs [v4]                   |
|                                          |
|  Changes:                                |
|  - Line "Customer A" Week 2: 1000 -> 1500|
|  - Line "Wages" Week 3: 5000 -> 4800     |
|  - New line: "Supplier B" added          |
|                                          |
|  [Export Comparison Report]              |
+------------------------------------------+
```

### 11.3 External User View (Administrators)

**Constraint:** External users (insolvency administrators) see ONLY their assigned cases with a simplified, read-focused interface.

```
ADMINISTRATOR PORTAL (External Users)
    |
    +-- My Cases
    |       |-- List of assigned cases
    |       |-- Case status summary
    |
    +-- Case View
    |       |-- Current liquidity plan display
    |       |-- Week-by-week breakdown
    |       |-- Charts (configurable visibility)
    |       |-- Version selector (read-only)
    |
    +-- Exports
            |-- PDF report generation
            |-- Excel export

NOT VISIBLE TO EXTERNAL USERS:
- Admin tooling
- Ingestion details
- Raw data
- Mapping configurations
- Other cases
- Audit logs
- Error logs
```

### 11.4 Access Control Matrix

| Feature | Internal (Consultant) | External (Administrator) |
|---------|----------------------|-------------------------|
| View all cases | Yes | No (own cases only) |
| Create case | Yes | No |
| Edit case | Yes | No |
| Upload data | Yes | No |
| Configure mappings | Yes | No |
| Review queue | Yes | No |
| View raw data | Yes | No |
| View lineage | Yes | No |
| View audit log | Yes | No |
| View plan output | Yes | Yes (own cases) |
| Export reports | Yes | Yes (own cases) |
| Compare versions | Yes | Yes (own cases, limited) |

---

## Appendices

### Appendix A: Ingestion Job State Transitions

```
                          +--------+
                          | CREATED|
                          +---+----+
                              |
                              v
         +--------+      +----+-----+
         |REJECTED|<-----+ UPLOADING|
         +--------+      +----+-----+
                              |
                              v
         +--------+      +----+-----+
         |REJECTED|<-----+ VALIDATING|
         +--------+      +----+-----+
              |               |
              |               v
              |          +----+-----+
              +<---------+  PARSING |
                         +----+-----+
                              |
                              v
                         +----+-----+
                         |  STAGING |
                         +----+-----+
                              |
                              v
                         +----+-----+
                         |  MAPPING |
                         +----+-----+
                              |
                              v
                         +----+------+
                         | VALIDATING|
                         |  BUSINESS |
                         +----+------+
                              |
              +---------------+---------------+
              |               |               |
              v               v               v
         +--------+      +--------+      +--------+
         |  READY |      | REVIEW |      |QUARANT.|
         +---+----+      +---+----+      +--------+
             |               |
             |               v
             |          +--------+
             |          |RESOLVED|
             |          +---+----+
             |               |
             +-------+-------+
                     |
                     v
                +--------+
                |COMMITTED|
                +--------+
```

### Appendix B: SQL Schema for Ingestion Layer

```sql
-- Enums
CREATE TYPE ingestion_status AS ENUM (
    'CREATED', 'UPLOADING', 'VALIDATING', 'PARSING',
    'STAGING', 'MAPPING', 'VALIDATING_BUSINESS',
    'READY', 'REVIEW', 'QUARANTINED', 'RESOLVED',
    'COMMITTED', 'REJECTED'
);

CREATE TYPE source_type AS ENUM (
    'CSV_GENERIC', 'CSV_BANK_STATEMENT', 'CSV_SUSA',
    'CSV_PNL', 'CSV_BALANCE_SHEET', 'EXCEL_LIQUIDITY',
    'JSON_IMPORT', 'XML_DATEV', 'MT940', 'CAMT053'
);

CREATE TYPE validation_severity AS ENUM ('ERROR', 'WARNING', 'INFO');

CREATE TYPE review_action AS ENUM ('APPROVE', 'MODIFY', 'REJECT');

CREATE TYPE staged_status AS ENUM ('STAGED', 'REVIEWED', 'COMMITTED', 'REJECTED');

-- Tables
CREATE TABLE ingestion_job (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES insolvency_case(id),
    plan_id UUID REFERENCES liquidity_plan(id),
    source_type source_type NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_hash_sha256 CHAR(64) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    raw_file_path VARCHAR(1000) NOT NULL,
    status ingestion_status NOT NULL DEFAULT 'CREATED',
    error_count INTEGER NOT NULL DEFAULT 0,
    warning_count INTEGER NOT NULL DEFAULT 0,
    record_count_raw INTEGER,
    record_count_normalized INTEGER,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_by VARCHAR(255) NOT NULL,

    CONSTRAINT positive_counts CHECK (
        error_count >= 0 AND warning_count >= 0
    )
);

CREATE TABLE ingestion_record (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES ingestion_job(id),
    row_number INTEGER NOT NULL,
    raw_data JSONB NOT NULL,
    mapped_data JSONB,
    normalized_data JSONB,
    status ingestion_status NOT NULL DEFAULT 'STAGING',
    validation_errors JSONB,
    validation_warnings JSONB,

    CONSTRAINT unique_row_per_job UNIQUE (job_id, row_number)
);

CREATE TABLE mapping_configuration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    source_type source_type NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    field_mappings JSONB NOT NULL,
    value_mappings JSONB NOT NULL,
    category_mappings JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL,

    CONSTRAINT unique_active_per_source UNIQUE (source_type, version),
    CONSTRAINT valid_version CHECK (version >= 1)
);

-- Ensure only one active config per source type
CREATE UNIQUE INDEX idx_one_active_mapping_per_source
ON mapping_configuration (source_type)
WHERE is_active = TRUE;

CREATE TABLE staged_cashflow_entry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES ingestion_job(id),
    source_record_id UUID NOT NULL REFERENCES ingestion_record(id),
    target_category_name VARCHAR(255) NOT NULL,
    target_category_flow_type flow_type NOT NULL,
    target_category_estate_type estate_type NOT NULL,
    line_name VARCHAR(255) NOT NULL,
    line_description VARCHAR(1000),
    week_offset INTEGER NOT NULL CHECK (week_offset >= 0 AND week_offset <= 12),
    value_type value_type NOT NULL,
    amount_cents BIGINT NOT NULL,
    note VARCHAR(500),
    confidence_score DECIMAL(3,2) CHECK (
        confidence_score IS NULL OR
        (confidence_score >= 0 AND confidence_score <= 1)
    ),
    requires_review BOOLEAN NOT NULL DEFAULT FALSE,
    review_reason VARCHAR(500),
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMPTZ,
    review_action review_action,
    status staged_status NOT NULL DEFAULT 'STAGED'
);

CREATE TABLE field_transformation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES ingestion_record(id),
    source_field VARCHAR(255) NOT NULL,
    source_value TEXT NOT NULL,
    target_field VARCHAR(255) NOT NULL,
    target_value TEXT NOT NULL,
    transformation_type VARCHAR(50) NOT NULL,
    transformation_config JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE commit_action (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staged_entry_id UUID NOT NULL REFERENCES staged_cashflow_entry(id),
    target_entity_type VARCHAR(50) NOT NULL,
    target_entity_id UUID NOT NULL,
    action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('CREATE', 'UPDATE')),
    previous_value JSONB,
    new_value JSONB NOT NULL,
    committed_by VARCHAR(255) NOT NULL,
    committed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    user_ip VARCHAR(45) NOT NULL,
    user_agent VARCHAR(500),
    action VARCHAR(50) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    metadata JSONB
);

-- Indexes
CREATE INDEX idx_job_case ON ingestion_job(case_id);
CREATE INDEX idx_job_status ON ingestion_job(status);
CREATE INDEX idx_record_job ON ingestion_record(job_id);
CREATE INDEX idx_staged_job ON staged_cashflow_entry(job_id);
CREATE INDEX idx_staged_status ON staged_cashflow_entry(status);
CREATE INDEX idx_staged_review ON staged_cashflow_entry(requires_review)
    WHERE requires_review = TRUE;
CREATE INDEX idx_transformation_record ON field_transformation(record_id);
CREATE INDEX idx_commit_staged ON commit_action(staged_entry_id);
CREATE INDEX idx_audit_entity ON audit_event(entity_type, entity_id);
CREATE INDEX idx_audit_timestamp ON audit_event(timestamp);
CREATE INDEX idx_audit_user ON audit_event(user_id);
```

### Appendix C: Mapping Configuration Examples

#### Example: German Bank CSV

```json
{
  "name": "German Bank CSV Standard",
  "sourceType": "CSV_BANK_STATEMENT",
  "version": 1,
  "fieldMappings": [
    {
      "sourceField": "buchungstag",
      "targetField": "week_offset",
      "transformationType": "DATE_TO_WEEK_OFFSET",
      "transformationParams": {
        "dateFormat": "DD.MM.YYYY"
      },
      "required": true
    },
    {
      "sourceField": "betrag",
      "targetField": "amount_cents",
      "transformationType": "DECIMAL_TO_CENTS",
      "transformationParams": {
        "decimalSeparator": ",",
        "thousandsSeparator": "."
      },
      "required": true
    },
    {
      "sourceField": "verwendungszweck",
      "targetField": "line_name",
      "transformationType": "DIRECT",
      "required": true
    },
    {
      "sourceField": "verwendungszweck",
      "targetField": "note",
      "transformationType": "DIRECT",
      "required": false
    }
  ],
  "valueMappings": [
    {
      "sourceField": "betrag",
      "targetField": "flow_type",
      "mappingType": "CONDITIONAL",
      "conditions": [
        {
          "condition": "value > 0",
          "result": "INFLOW"
        },
        {
          "condition": "value < 0",
          "result": "OUTFLOW"
        }
      ],
      "unmappedAction": "ERROR"
    },
    {
      "targetField": "value_type",
      "mappingType": "STATIC",
      "staticValue": "IST"
    },
    {
      "targetField": "estate_type",
      "mappingType": "STATIC",
      "staticValue": "NEUMASSE"
    }
  ],
  "categoryMappings": [
    {
      "matchField": "verwendungszweck",
      "matchType": "CONTAINS_ANY",
      "matchValues": ["LOHN", "GEHALT", "SALARY"],
      "targetCategory": "Loehne und Gehaelter",
      "targetFlowType": "OUTFLOW",
      "targetEstateType": "NEUMASSE",
      "priority": 10
    },
    {
      "matchField": "verwendungszweck",
      "matchType": "CONTAINS_ANY",
      "matchValues": ["MIETE", "RENT", "NEBENKOSTEN"],
      "targetCategory": "Miete und Nebenkosten",
      "targetFlowType": "OUTFLOW",
      "targetEstateType": "NEUMASSE",
      "priority": 10
    },
    {
      "matchField": "flow_type",
      "matchType": "EQUALS",
      "matchValue": "INFLOW",
      "targetCategory": "Umsatzerloese",
      "targetFlowType": "INFLOW",
      "targetEstateType": "NEUMASSE",
      "priority": 1
    },
    {
      "matchField": "flow_type",
      "matchType": "EQUALS",
      "matchValue": "OUTFLOW",
      "targetCategory": "Sonstige Auszahlungen Neu",
      "targetFlowType": "OUTFLOW",
      "targetEstateType": "NEUMASSE",
      "priority": 1
    }
  ]
}
```

#### Example: SuSa Account Mapping

```json
{
  "name": "DATEV SKR03 Account Mapping",
  "sourceType": "CSV_SUSA",
  "version": 1,
  "accountRangeMappings": [
    {
      "accountRange": {"from": "1200", "to": "1299"},
      "targetCategory": "Forderungseinzuege",
      "targetFlowType": "INFLOW",
      "targetEstateType": "ALTMASSE",
      "valueField": "closing_balance",
      "distributionProfile": "RECEIVABLES_30_60_90"
    },
    {
      "accountRange": {"from": "1400", "to": "1499"},
      "targetCategory": null,
      "useAsOpeningBalance": true,
      "valueField": "closing_balance"
    },
    {
      "accountRange": {"from": "1600", "to": "1699"},
      "targetCategory": "Altmasseverbindlichkeiten",
      "targetFlowType": "OUTFLOW",
      "targetEstateType": "ALTMASSE",
      "valueField": "closing_balance",
      "distributionProfile": "PAYABLES_IMMEDIATE"
    },
    {
      "accountRange": {"from": "4000", "to": "4999"},
      "targetCategory": "Umsatzerloese",
      "targetFlowType": "INFLOW",
      "targetEstateType": "NEUMASSE",
      "valueField": "period_movement",
      "distributionProfile": "WEEKLY_AVERAGE"
    },
    {
      "accountRange": {"from": "6000", "to": "6099"},
      "targetCategory": "Loehne und Gehaelter",
      "targetFlowType": "OUTFLOW",
      "targetEstateType": "NEUMASSE",
      "valueField": "period_movement",
      "distributionProfile": "WEEKLY_AVERAGE"
    }
  ],
  "distributionProfiles": {
    "RECEIVABLES_30_60_90": {
      "type": "PERCENTAGE_SPLIT",
      "weeks": [4, 8, 12],
      "percentages": [50, 30, 20]
    },
    "PAYABLES_IMMEDIATE": {
      "type": "SINGLE_WEEK",
      "week": 0
    },
    "WEEKLY_AVERAGE": {
      "type": "EQUAL_SPLIT",
      "weeks": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    }
  }
}
```

### Appendix D: API Endpoints (Conceptual)

```
INGESTION API
-------------

POST   /api/v1/ingestion/jobs
       Create new ingestion job (upload file)
       Body: multipart/form-data with file and metadata

GET    /api/v1/ingestion/jobs
       List ingestion jobs
       Query: case_id, status, date_range

GET    /api/v1/ingestion/jobs/{id}
       Get job details and status

GET    /api/v1/ingestion/jobs/{id}/records
       Get parsed records for job
       Query: status, page, limit

GET    /api/v1/ingestion/jobs/{id}/staged
       Get staged entries for job
       Query: status, requires_review, page, limit

POST   /api/v1/ingestion/jobs/{id}/commit
       Commit staged data to core schema

DELETE /api/v1/ingestion/jobs/{id}
       Cancel/delete job (only if not committed)


REVIEW API
----------

GET    /api/v1/review/queue
       Get items requiring review
       Query: case_id, severity, page, limit

POST   /api/v1/review/{staged_entry_id}/resolve
       Resolve a review item
       Body: { action: "APPROVE|MODIFY|REJECT", modified_value?: {...}, note?: "..." }

POST   /api/v1/review/bulk-resolve
       Bulk resolve similar items
       Body: { staged_entry_ids: [...], action: "...", note?: "..." }


MAPPING CONFIGURATION API
-------------------------

GET    /api/v1/mappings
       List mapping configurations
       Query: source_type, is_active

GET    /api/v1/mappings/{id}
       Get mapping configuration details

POST   /api/v1/mappings
       Create new mapping configuration

PUT    /api/v1/mappings/{id}
       Update mapping configuration (creates new version)

POST   /api/v1/mappings/{id}/activate
       Activate a mapping configuration version

POST   /api/v1/mappings/test
       Test mapping against sample data
       Body: { mapping_config: {...}, sample_data: [...] }


LINEAGE API
-----------

GET    /api/v1/lineage/weekly-value/{id}
       Get full lineage for a weekly value

GET    /api/v1/lineage/version/{id}
       Get all source files for a version

GET    /api/v1/lineage/file/{hash}
       Get all records derived from a source file


AUDIT API
---------

GET    /api/v1/audit/events
       Query audit events
       Query: entity_type, entity_id, user_id, event_type, date_range

GET    /api/v1/audit/events/{id}
       Get audit event details

GET    /api/v1/audit/versions/{plan_id}
       Get version history for a plan

GET    /api/v1/audit/versions/compare
       Compare two versions
       Query: version_id_a, version_id_b

POST   /api/v1/audit/export
       Export audit data for external review
       Body: { case_id, date_range, format: "PDF|XLSX|JSON" }
```

### Appendix E: Error Code Reference

| Code | Category | Description |
|------|----------|-------------|
| ING-001 | Upload | File too large |
| ING-002 | Upload | Unsupported file type |
| ING-003 | Upload | File corrupted |
| ING-004 | Parse | Invalid encoding |
| ING-005 | Parse | Missing required columns |
| ING-006 | Parse | Invalid delimiter |
| ING-007 | Map | No mapping configuration |
| ING-008 | Map | Field mapping failed |
| ING-009 | Map | Category not resolved |
| ING-010 | Map | Value transformation failed |
| VAL-001 | Validate | Required field missing |
| VAL-002 | Validate | Value out of range |
| VAL-003 | Validate | Invalid enum value |
| VAL-004 | Validate | Duplicate entry |
| VAL-005 | Validate | Referential integrity |
| VAL-006 | Validate | Date parse failed |
| VAL-007 | Validate | Number parse failed |
| VAL-008 | Validate | Week offset invalid |
| CMT-001 | Commit | Version conflict |
| CMT-002 | Commit | Data hash mismatch |
| CMT-003 | Commit | Unresolved reviews |
| CMT-004 | Commit | Plan locked |
| AUD-001 | Audit | Integrity check failed |
| AUD-002 | Audit | Hash verification failed |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-15 | System | Initial architecture specification |

---

**End of Specification**
