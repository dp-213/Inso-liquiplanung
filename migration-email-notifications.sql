-- Migration: Email-Benachrichtigungen für Freigabe-Modul
-- Datum: 2026-02-14

-- 1. CompanyToken: notifyEmail hinzufügen
ALTER TABLE company_tokens ADD COLUMN notifyEmail TEXT;

-- 2. Order: companyTokenId hinzufügen (FK auf CompanyToken)
ALTER TABLE orders ADD COLUMN companyTokenId TEXT REFERENCES company_tokens(id) ON DELETE SET NULL;

-- 3. Order: Email-Tracking-Felder
ALTER TABLE orders ADD COLUMN reminderSentAt TEXT;
ALTER TABLE orders ADD COLUMN approvalDigestSentAt TEXT;
