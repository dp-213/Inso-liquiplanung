-- =====================================================
-- Migration: Berechnungsannahmen-Tab Redesign
-- Datum: 2026-02-13
-- Backup: turso-backup_2026-02-13_09-29_pre-deploy.db
-- =====================================================

-- =====================================================
-- 1. PLANNING_ASSUMPTIONS: Neue Spalten hinzufügen
-- =====================================================

-- caseId: Case-Level statt nur Plan-Level
ALTER TABLE planning_assumptions ADD COLUMN "caseId" TEXT;

-- title: Ersetzt categoryName (freier Titel)
ALTER TABLE planning_assumptions ADD COLUMN "title" TEXT;

-- status: Ersetzt riskLevel (ANNAHME/VERIFIZIERT/WIDERLEGT)
ALTER TABLE planning_assumptions ADD COLUMN "status" TEXT DEFAULT 'ANNAHME';

-- linkedModule: Verlinkung zu Stammdaten-Modul
ALTER TABLE planning_assumptions ADD COLUMN "linkedModule" TEXT;

-- linkedEntityId: Optional FK zum verlinkten Datensatz
ALTER TABLE planning_assumptions ADD COLUMN "linkedEntityId" TEXT;

-- lastReviewedAt: Wann zuletzt geprüft
ALTER TABLE planning_assumptions ADD COLUMN "lastReviewedAt" DATETIME;

-- =====================================================
-- 2. PLANNING_ASSUMPTIONS: Daten migrieren
-- =====================================================

-- caseId aus dem verlinkten Plan ableiten
UPDATE planning_assumptions
SET caseId = (
  SELECT lp."caseId" FROM liquidity_plans lp WHERE lp.id = planning_assumptions.planId
);

-- title aus categoryName übernehmen
UPDATE planning_assumptions SET title = categoryName;

-- status aus riskLevel mappen
UPDATE planning_assumptions SET status = CASE
  WHEN UPPER(riskLevel) = 'LOW' THEN 'VERIFIZIERT'
  WHEN UPPER(riskLevel) = 'CONFIRMED' THEN 'VERIFIZIERT'
  WHEN UPPER(riskLevel) = 'CONSERVATIVE' THEN 'VERIFIZIERT'
  WHEN UPPER(riskLevel) = 'HIGH' THEN 'ANNAHME'
  WHEN UPPER(riskLevel) = 'MEDIUM' THEN 'ANNAHME'
  ELSE 'ANNAHME'
END;

-- =====================================================
-- 3. PLANNING_ASSUMPTIONS: Index auf caseId
-- =====================================================
CREATE INDEX IF NOT EXISTS "planning_assumptions_caseId_idx" ON "planning_assumptions"("caseId");

-- =====================================================
-- 4. FORECAST_ASSUMPTIONS: Neue Spalten hinzufügen
-- =====================================================

-- Methodik
ALTER TABLE forecast_assumptions ADD COLUMN "method" TEXT;
ALTER TABLE forecast_assumptions ADD COLUMN "baseReferencePeriod" TEXT;
ALTER TABLE forecast_assumptions ADD COLUMN "scenarioSensitivity" TEXT;

-- Quantitatives Risiko
ALTER TABLE forecast_assumptions ADD COLUMN "riskProbability" REAL;
ALTER TABLE forecast_assumptions ADD COLUMN "riskImpactCents" BIGINT;
ALTER TABLE forecast_assumptions ADD COLUMN "riskComment" TEXT;

-- Review
ALTER TABLE forecast_assumptions ADD COLUMN "lastReviewedAt" DATETIME;
ALTER TABLE forecast_assumptions ADD COLUMN "visibilityScope" TEXT;

-- =====================================================
-- 5. FORECAST_ASSUMPTIONS: Index auf caseId + categoryKey
-- =====================================================
CREATE INDEX IF NOT EXISTS "forecast_assumptions_caseId_categoryKey_idx" ON "forecast_assumptions"("caseId", "categoryKey");

-- =====================================================
-- VERIFIZIERUNG
-- =====================================================
-- SELECT id, caseId, title, status, categoryName, riskLevel FROM planning_assumptions;
-- SELECT count(*) FROM forecast_assumptions WHERE method IS NOT NULL;
