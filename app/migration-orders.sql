-- Migration: Orders & CompanyTokens Modul
-- Datum: 2026-02-10
-- Zweck: Bestell- & Zahlfreigabe-Modul hinzufügen

-- 1. Orders-Tabelle
CREATE TABLE IF NOT EXISTS "orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ZAHLUNG',
    "requestDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceDate" DATETIME NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "creditor" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "documentName" TEXT,
    "documentMimeType" TEXT,
    "documentSizeBytes" BIGINT,
    "documentContent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAmountCents" BIGINT,
    "approvedAt" DATETIME,
    "approvedBy" TEXT,
    "rejectedAt" DATETIME,
    "rejectionReason" TEXT,
    "ledgerEntryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orders_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "ledger_entries" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 2. Company-Tokens-Tabelle
CREATE TABLE IF NOT EXISTS "company_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_tokens_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3. Indizes
CREATE INDEX IF NOT EXISTS "orders_caseId_idx" ON "orders"("caseId");
CREATE INDEX IF NOT EXISTS "orders_caseId_status_idx" ON "orders"("caseId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "orders_ledgerEntryId_key" ON "orders"("ledgerEntryId");
CREATE INDEX IF NOT EXISTS "company_tokens_caseId_idx" ON "company_tokens"("caseId");
CREATE UNIQUE INDEX IF NOT EXISTS "company_tokens_token_key" ON "company_tokens"("token");
