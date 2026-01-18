-- Turso Schema Migration
-- Neue Tabellen und Felder für v2.0.0
-- Ausführen mit: turso db shell inso-liquiplanung < prisma/turso-migration.sql

-- ============================================
-- NEUE TABELLEN
-- ============================================

-- Counterparty (Gegenparteien)
CREATE TABLE IF NOT EXISTS counterparties (
  id TEXT PRIMARY KEY,
  caseId TEXT NOT NULL,
  name TEXT NOT NULL,
  shortName TEXT,
  type TEXT,
  matchPattern TEXT,
  isTopPayer INTEGER DEFAULT 0,
  notes TEXT,
  displayOrder INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  createdBy TEXT NOT NULL,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (caseId) REFERENCES cases(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_counterparties_caseId ON counterparties(caseId);

-- Location (Standorte)
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  caseId TEXT NOT NULL,
  name TEXT NOT NULL,
  shortName TEXT,
  address TEXT,
  costCenter TEXT,
  notes TEXT,
  displayOrder INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  createdBy TEXT NOT NULL,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (caseId) REFERENCES cases(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_locations_caseId ON locations(caseId);

-- ClassificationRule (Klassifikationsregeln)
CREATE TABLE IF NOT EXISTS classification_rules (
  id TEXT PRIMARY KEY,
  caseId TEXT NOT NULL,
  name TEXT NOT NULL,
  isActive INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 100,
  matchField TEXT NOT NULL,
  matchType TEXT NOT NULL,
  matchValue TEXT NOT NULL,
  suggestedCategory TEXT,
  suggestedFlowType TEXT,
  suggestedLegalBucket TEXT,
  confidenceBonus REAL DEFAULT 0.0,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  createdBy TEXT NOT NULL,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedBy TEXT NOT NULL,
  FOREIGN KEY (caseId) REFERENCES cases(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_classification_rules_caseId_isActive ON classification_rules(caseId, isActive);

-- ============================================
-- NEUE SPALTEN AUF LEDGER_ENTRIES
-- ============================================

-- Steuerungsdimensionen
ALTER TABLE ledger_entries ADD COLUMN bankAccountId TEXT REFERENCES bank_accounts(id);
ALTER TABLE ledger_entries ADD COLUMN counterpartyId TEXT REFERENCES counterparties(id);
ALTER TABLE ledger_entries ADD COLUMN locationId TEXT REFERENCES locations(id);
ALTER TABLE ledger_entries ADD COLUMN steeringTag TEXT;

-- Klassifikations-Vorschläge
ALTER TABLE ledger_entries ADD COLUMN suggestedLegalBucket TEXT;
ALTER TABLE ledger_entries ADD COLUMN suggestedCategory TEXT;
ALTER TABLE ledger_entries ADD COLUMN suggestedConfidence REAL;
ALTER TABLE ledger_entries ADD COLUMN suggestedRuleId TEXT;
ALTER TABLE ledger_entries ADD COLUMN suggestedReason TEXT;

-- Neue Indizes
CREATE INDEX IF NOT EXISTS idx_ledger_entries_caseId_bankAccountId ON ledger_entries(caseId, bankAccountId);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_caseId_counterpartyId ON ledger_entries(caseId, counterpartyId);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_caseId_locationId ON ledger_entries(caseId, locationId);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_caseId_reviewStatus_suggestedLegalBucket ON ledger_entries(caseId, reviewStatus, suggestedLegalBucket);

-- ============================================
-- CASE ERWEITERUNGEN
-- ============================================

-- Default Perioden-Konfiguration
ALTER TABLE cases ADD COLUMN defaultPeriodType TEXT;
ALTER TABLE cases ADD COLUMN defaultPeriodCount INTEGER;
