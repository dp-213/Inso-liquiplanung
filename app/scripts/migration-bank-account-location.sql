-- Migration: Füge locationId Spalte zu bank_accounts hinzu
-- Datum: 2026-02-08
-- Zweck: Standort-basierte Opening Balance für Scope-Filter

-- 1. Füge locationId Spalte hinzu (falls noch nicht existiert)
ALTER TABLE bank_accounts ADD COLUMN locationId TEXT;

-- 2. Setze locationId für HVPlus Case BankAccounts
--    Case ID: 2982ff26-081a-4811-8e1e-46b39e1ff757

-- Velbert Accounts
UPDATE bank_accounts
SET locationId = 'loc-haevg-velbert'
WHERE id IN ('ba-isk-velbert', 'ba-sparkasse-velbert')
  AND caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

-- Uckerath Accounts (inkl. Eitorf, da Eitorf über Uckerath läuft)
UPDATE bank_accounts
SET locationId = 'loc-haevg-uckerath'
WHERE id IN ('ba-isk-uckerath', 'ba-apobank-uckerath')
  AND caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

-- Zentrale Accounts bleiben NULL (ba-apobank-hvplus)
-- Keine Aktion nötig, ist bereits NULL

-- 3. Verifikation: Zeige alle BankAccounts mit locationId
SELECT
  id,
  accountName,
  CAST(openingBalanceCents AS REAL) / 100.0 as openingEUR,
  locationId,
  CASE
    WHEN locationId IS NULL THEN 'ZENTRAL'
    ELSE locationId
  END as location_display
FROM bank_accounts
WHERE caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757'
ORDER BY displayOrder;

-- 4. Verifikation: Opening Balances pro Scope
SELECT
  'GLOBAL' as scope,
  SUM(openingBalanceCents) as totalCents,
  CAST(SUM(openingBalanceCents) AS REAL) / 100.0 as totalEUR
FROM bank_accounts
WHERE caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757'

UNION ALL

SELECT
  'VELBERT' as scope,
  SUM(openingBalanceCents) as totalCents,
  CAST(SUM(openingBalanceCents) AS REAL) / 100.0 as totalEUR
FROM bank_accounts
WHERE caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757'
  AND locationId = 'loc-haevg-velbert'

UNION ALL

SELECT
  'UCKERATH_EITORF' as scope,
  SUM(openingBalanceCents) as totalCents,
  CAST(SUM(openingBalanceCents) AS REAL) / 100.0 as totalEUR
FROM bank_accounts
WHERE caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757'
  AND locationId IN ('loc-haevg-uckerath', 'loc-haevg-eitorf');

-- Erwartete Werte:
-- GLOBAL:          -238.887,22 EUR
-- VELBERT:         +24.970,61 EUR
-- UCKERATH_EITORF: +23.514,27 EUR
