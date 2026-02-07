/*
  Warnings:

  - You are about to drop the `audit_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `projects` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `weekly_values` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `projectId` on the `cases` table. All the data in the column will be lost.
  - You are about to drop the column `weekOffset` on the `staged_cashflow_entries` table. All the data in the column will be lost.
  - Added the required column `ownerId` to the `cases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `mapping_configurations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedBy` to the `mapping_configurations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `periodIndex` to the `staged_cashflow_entries` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "audit_events_userId_idx";

-- DropIndex
DROP INDEX "audit_events_timestamp_idx";

-- DropIndex
DROP INDEX "audit_events_entityType_entityId_idx";

-- DropIndex
DROP INDEX "weekly_values_lineId_weekOffset_valueType_key";

-- AlterTable
ALTER TABLE "ingestion_records" ADD COLUMN "qualityTier" TEXT;
ALTER TABLE "ingestion_records" ADD COLUMN "sheetName" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "audit_events";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "projects";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "weekly_values";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "period_values" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lineId" TEXT NOT NULL,
    "periodIndex" INTEGER NOT NULL,
    "valueType" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT NOT NULL,
    CONSTRAINT "period_values_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "cashflow_lines" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mapping_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceType" TEXT NOT NULL,
    "projectId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "fieldMappings" TEXT NOT NULL,
    "valueMappings" TEXT NOT NULL,
    "categoryMappings" TEXT NOT NULL,
    "dateFormat" TEXT NOT NULL DEFAULT 'DD.MM.YYYY',
    "decimalSeparator" TEXT NOT NULL DEFAULT ',',
    "thousandsSeparator" TEXT NOT NULL DEFAULT '.',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "customer_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" DATETIME,
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "customer_case_access" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "accessLevel" TEXT NOT NULL DEFAULT 'VIEW',
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" DATETIME,
    "revokedBy" TEXT,
    "revokeReason" TEXT,
    "lastAccessedAt" DATETIME,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "customer_case_access_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "customer_case_access_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "customer_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_sessions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "customer_audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "caseId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_audit_logs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_preprocessing_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "processedFiles" INTEGER NOT NULL DEFAULT 0,
    "iterationCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "approvedAt" DATETIME,
    "approvedBy" TEXT,
    CONSTRAINT "ai_preprocessing_jobs_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_preprocessing_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "rawContent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "documentType" TEXT,
    "documentTypeExplanation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_preprocessing_files_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ai_preprocessing_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_preprocessing_rows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "sourceLocation" TEXT NOT NULL,
    "rawData" TEXT NOT NULL,
    "aiSuggestion" TEXT NOT NULL,
    "aiExplanation" TEXT,
    "confidenceScore" REAL NOT NULL,
    "confidenceDetails" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "humanEdits" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ai_preprocessing_rows_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ai_preprocessing_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ai_preprocessing_rows_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "ai_preprocessing_files" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_preprocessing_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_preprocessing_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ai_preprocessing_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "planning_assumptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT NOT NULL,
    CONSTRAINT "planning_assumptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "liquidity_plans" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "insolvency_effects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "effectType" TEXT NOT NULL,
    "effectGroup" TEXT NOT NULL DEFAULT 'GENERAL',
    "periodIndex" INTEGER NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAvailabilityOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT NOT NULL,
    CONSTRAINT "insolvency_effects_planId_fkey" FOREIGN KEY ("planId") REFERENCES "liquidity_plans" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "iban" TEXT,
    "openingBalanceCents" BIGINT NOT NULL DEFAULT 0,
    "securityHolder" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT NOT NULL,
    CONSTRAINT "bank_accounts_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bank_agreements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "agreementStatus" TEXT NOT NULL DEFAULT 'OFFEN',
    "agreementDate" DATETIME,
    "agreementNote" TEXT,
    "hasGlobalAssignment" BOOLEAN NOT NULL DEFAULT false,
    "contributionRate" DECIMAL,
    "contributionVatRate" DECIMAL,
    "creditCapCents" BIGINT,
    "isUncertain" BOOLEAN NOT NULL DEFAULT true,
    "uncertaintyNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "bank_agreements_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bank_agreements_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "counterparties" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "type" TEXT,
    "matchPattern" TEXT,
    "isTopPayer" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "counterparties_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "address" TEXT,
    "costCenter" TEXT,
    "notes" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "locations_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "transactionDate" DATETIME NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "note" TEXT,
    "valueType" TEXT NOT NULL,
    "legalBucket" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "serviceDate" DATETIME,
    "servicePeriodStart" DATETIME,
    "servicePeriodEnd" DATETIME,
    "estateAllocation" TEXT,
    "estateRatio" DECIMAL,
    "allocationSource" TEXT,
    "allocationNote" TEXT,
    "parentEntryId" TEXT,
    "splitReason" TEXT,
    "importSource" TEXT,
    "importJobId" TEXT,
    "importFileHash" TEXT,
    "importRowNumber" INTEGER,
    "bookingSource" TEXT,
    "bookingSourceId" TEXT,
    "bookingReference" TEXT,
    "bankAccountId" TEXT,
    "counterpartyId" TEXT,
    "locationId" TEXT,
    "steeringTag" TEXT,
    "categoryTag" TEXT,
    "categoryTagSource" TEXT,
    "categoryTagNote" TEXT,
    "suggestedCategoryTag" TEXT,
    "suggestedCategoryTagReason" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'UNREVIEWED',
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT,
    "changeReason" TEXT,
    "previousAmountCents" BIGINT,
    "suggestedLegalBucket" TEXT,
    "suggestedCategory" TEXT,
    "suggestedConfidence" REAL,
    "suggestedRuleId" TEXT,
    "suggestedReason" TEXT,
    "suggestedBankAccountId" TEXT,
    "suggestedCounterpartyId" TEXT,
    "suggestedLocationId" TEXT,
    "suggestedServiceDate" DATETIME,
    "suggestedServicePeriodStart" DATETIME,
    "suggestedServicePeriodEnd" DATETIME,
    "suggestedServiceDateRule" TEXT,
    "sourceEffectId" TEXT,
    "transferPartnerEntryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ledger_entries_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ledger_entries_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ledger_entries_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "counterparties" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ledger_entries_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ledger_entries_sourceEffectId_fkey" FOREIGN KEY ("sourceEffectId") REFERENCES "insolvency_effects" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ledger_entries_parentEntryId_fkey" FOREIGN KEY ("parentEntryId") REFERENCES "ledger_entries" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ledger_audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ledgerEntryId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fieldChanges" TEXT NOT NULL,
    "reason" TEXT,
    "userId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ledger_audit_logs_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "ledger_entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "aggregation_cache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CURRENT',
    "lastAggregatedAt" DATETIME NOT NULL,
    "dataHashAtAggregation" TEXT NOT NULL,
    "pendingChanges" INTEGER NOT NULL DEFAULT 0,
    "lastChangeAt" DATETIME
);

-- CreateTable
CREATE TABLE "classification_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "matchField" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "matchValue" TEXT NOT NULL,
    "suggestedCategory" TEXT,
    "suggestedFlowType" TEXT,
    "suggestedLegalBucket" TEXT,
    "confidenceBonus" REAL NOT NULL DEFAULT 0.0,
    "assignBankAccountId" TEXT,
    "assignCounterpartyId" TEXT,
    "assignLocationId" TEXT,
    "assignServiceDateRule" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT NOT NULL,
    CONSTRAINT "classification_rules_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_cases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "debtorName" TEXT NOT NULL,
    "courtName" TEXT NOT NULL,
    "openingDate" DATETIME,
    "filingDate" DATETIME NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" TEXT NOT NULL DEFAULT 'PRELIMINARY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "cutoffDate" DATETIME,
    "defaultPeriodType" TEXT,
    "defaultPeriodCount" INTEGER,
    CONSTRAINT "cases_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "customer_users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_cases" ("caseNumber", "courtName", "createdAt", "createdBy", "currency", "debtorName", "filingDate", "id", "openingDate", "status", "updatedAt", "updatedBy") SELECT "caseNumber", "courtName", "createdAt", "createdBy", "currency", "debtorName", "filingDate", "id", "openingDate", "status", "updatedAt", "updatedBy" FROM "cases";
DROP TABLE "cases";
ALTER TABLE "new_cases" RENAME TO "cases";
CREATE UNIQUE INDEX "cases_caseNumber_key" ON "cases"("caseNumber");
CREATE INDEX "cases_ownerId_idx" ON "cases"("ownerId");
CREATE TABLE "new_ingestion_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "planId" TEXT,
    "mappingConfigId" TEXT,
    "sourceType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHashSha256" TEXT NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "rawFilePath" TEXT,
    "rawFileContent" TEXT,
    "mimeType" TEXT,
    "encoding" TEXT NOT NULL DEFAULT 'UTF-8',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "quarantinedCount" INTEGER NOT NULL DEFAULT 0,
    "recordCountRaw" INTEGER,
    "recordCountValid" INTEGER,
    "recordCountNormalized" INTEGER,
    "qualityScore" REAL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "ingestion_jobs_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ingestion_jobs" ("caseId", "completedAt", "createdBy", "errorCount", "fileHashSha256", "fileName", "fileSizeBytes", "id", "planId", "rawFilePath", "recordCountNormalized", "recordCountRaw", "sourceType", "startedAt", "status", "warningCount") SELECT "caseId", "completedAt", "createdBy", "errorCount", "fileHashSha256", "fileName", "fileSizeBytes", "id", "planId", "rawFilePath", "recordCountNormalized", "recordCountRaw", "sourceType", "startedAt", "status", "warningCount" FROM "ingestion_jobs";
DROP TABLE "ingestion_jobs";
ALTER TABLE "new_ingestion_jobs" RENAME TO "ingestion_jobs";
CREATE INDEX "ingestion_jobs_caseId_idx" ON "ingestion_jobs"("caseId");
CREATE INDEX "ingestion_jobs_status_idx" ON "ingestion_jobs"("status");
CREATE INDEX "ingestion_jobs_startedAt_idx" ON "ingestion_jobs"("startedAt");
CREATE TABLE "new_liquidity_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "planStartDate" DATETIME NOT NULL,
    "periodType" TEXT NOT NULL DEFAULT 'WEEKLY',
    "periodCount" INTEGER NOT NULL DEFAULT 13,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT NOT NULL,
    CONSTRAINT "liquidity_plans_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_liquidity_plans" ("caseId", "createdAt", "createdBy", "description", "id", "isActive", "name", "planStartDate", "updatedAt", "updatedBy") SELECT "caseId", "createdAt", "createdBy", "description", "id", "isActive", "name", "planStartDate", "updatedAt", "updatedBy" FROM "liquidity_plans";
DROP TABLE "liquidity_plans";
ALTER TABLE "new_liquidity_plans" RENAME TO "liquidity_plans";
CREATE TABLE "new_mapping_configurations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceType" TEXT NOT NULL,
    "projectId" TEXT,
    "caseId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "fieldMappings" TEXT NOT NULL,
    "valueMappings" TEXT NOT NULL,
    "categoryMappings" TEXT NOT NULL,
    "dateFormat" TEXT NOT NULL DEFAULT 'DD.MM.YYYY',
    "decimalSeparator" TEXT NOT NULL DEFAULT ',',
    "thousandsSeparator" TEXT NOT NULL DEFAULT '.',
    "sheetName" TEXT,
    "headerRow" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT NOT NULL
);
INSERT INTO "new_mapping_configurations" ("categoryMappings", "createdAt", "createdBy", "fieldMappings", "id", "isActive", "name", "sourceType", "valueMappings", "version") SELECT "categoryMappings", "createdAt", "createdBy", "fieldMappings", "id", "isActive", "name", "sourceType", "valueMappings", "version" FROM "mapping_configurations";
DROP TABLE "mapping_configurations";
ALTER TABLE "new_mapping_configurations" RENAME TO "mapping_configurations";
CREATE INDEX "mapping_configurations_projectId_idx" ON "mapping_configurations"("projectId");
CREATE INDEX "mapping_configurations_caseId_idx" ON "mapping_configurations"("caseId");
CREATE INDEX "mapping_configurations_sourceType_idx" ON "mapping_configurations"("sourceType");
CREATE TABLE "new_staged_cashflow_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "targetCategoryName" TEXT NOT NULL,
    "targetCategoryFlowType" TEXT NOT NULL,
    "targetCategoryEstateType" TEXT NOT NULL,
    "lineName" TEXT NOT NULL,
    "lineDescription" TEXT,
    "periodIndex" INTEGER NOT NULL,
    "valueType" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "originalAmountRaw" TEXT,
    "originalDate" DATETIME,
    "note" TEXT,
    "confidenceScore" REAL,
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewReason" TEXT,
    "reviewReasonCode" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "reviewAction" TEXT,
    "reviewNote" TEXT,
    "modifiedFields" TEXT,
    "status" TEXT NOT NULL DEFAULT 'STAGED',
    CONSTRAINT "staged_cashflow_entries_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "ingestion_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_staged_cashflow_entries" ("amountCents", "confidenceScore", "id", "jobId", "lineDescription", "lineName", "note", "requiresReview", "reviewAction", "reviewReason", "reviewedAt", "reviewedBy", "sourceRecordId", "status", "targetCategoryEstateType", "targetCategoryFlowType", "targetCategoryName", "valueType") SELECT "amountCents", "confidenceScore", "id", "jobId", "lineDescription", "lineName", "note", "requiresReview", "reviewAction", "reviewReason", "reviewedAt", "reviewedBy", "sourceRecordId", "status", "targetCategoryEstateType", "targetCategoryFlowType", "targetCategoryName", "valueType" FROM "staged_cashflow_entries";
DROP TABLE "staged_cashflow_entries";
ALTER TABLE "new_staged_cashflow_entries" RENAME TO "staged_cashflow_entries";
CREATE INDEX "staged_cashflow_entries_jobId_status_idx" ON "staged_cashflow_entries"("jobId", "status");
CREATE INDEX "staged_cashflow_entries_requiresReview_status_idx" ON "staged_cashflow_entries"("requiresReview", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "period_values_lineId_periodIndex_valueType_key" ON "period_values"("lineId", "periodIndex", "valueType");

-- CreateIndex
CREATE INDEX "mapping_templates_projectId_idx" ON "mapping_templates"("projectId");

-- CreateIndex
CREATE INDEX "mapping_templates_sourceType_idx" ON "mapping_templates"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "customer_users_email_key" ON "customer_users"("email");

-- CreateIndex
CREATE INDEX "customer_users_email_idx" ON "customer_users"("email");

-- CreateIndex
CREATE INDEX "customer_users_isActive_idx" ON "customer_users"("isActive");

-- CreateIndex
CREATE INDEX "customer_case_access_customerId_idx" ON "customer_case_access"("customerId");

-- CreateIndex
CREATE INDEX "customer_case_access_caseId_idx" ON "customer_case_access"("caseId");

-- CreateIndex
CREATE INDEX "customer_case_access_isActive_idx" ON "customer_case_access"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "customer_case_access_customerId_caseId_key" ON "customer_case_access"("customerId", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_sessions_token_key" ON "customer_sessions"("token");

-- CreateIndex
CREATE INDEX "customer_sessions_customerId_idx" ON "customer_sessions"("customerId");

-- CreateIndex
CREATE INDEX "customer_sessions_token_idx" ON "customer_sessions"("token");

-- CreateIndex
CREATE INDEX "customer_sessions_expiresAt_idx" ON "customer_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "customer_audit_logs_customerId_idx" ON "customer_audit_logs"("customerId");

-- CreateIndex
CREATE INDEX "customer_audit_logs_caseId_idx" ON "customer_audit_logs"("caseId");

-- CreateIndex
CREATE INDEX "customer_audit_logs_timestamp_idx" ON "customer_audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "ai_preprocessing_jobs_caseId_idx" ON "ai_preprocessing_jobs"("caseId");

-- CreateIndex
CREATE INDEX "ai_preprocessing_jobs_status_idx" ON "ai_preprocessing_jobs"("status");

-- CreateIndex
CREATE INDEX "ai_preprocessing_jobs_createdAt_idx" ON "ai_preprocessing_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "ai_preprocessing_files_jobId_idx" ON "ai_preprocessing_files"("jobId");

-- CreateIndex
CREATE INDEX "ai_preprocessing_rows_jobId_idx" ON "ai_preprocessing_rows"("jobId");

-- CreateIndex
CREATE INDEX "ai_preprocessing_rows_fileId_idx" ON "ai_preprocessing_rows"("fileId");

-- CreateIndex
CREATE INDEX "ai_preprocessing_rows_status_idx" ON "ai_preprocessing_rows"("status");

-- CreateIndex
CREATE INDEX "ai_preprocessing_logs_jobId_idx" ON "ai_preprocessing_logs"("jobId");

-- CreateIndex
CREATE INDEX "ai_preprocessing_logs_timestamp_idx" ON "ai_preprocessing_logs"("timestamp");

-- CreateIndex
CREATE INDEX "planning_assumptions_planId_idx" ON "planning_assumptions"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "planning_assumptions_planId_categoryName_key" ON "planning_assumptions"("planId", "categoryName");

-- CreateIndex
CREATE INDEX "insolvency_effects_planId_idx" ON "insolvency_effects"("planId");

-- CreateIndex
CREATE INDEX "insolvency_effects_planId_periodIndex_idx" ON "insolvency_effects"("planId", "periodIndex");

-- CreateIndex
CREATE INDEX "bank_accounts_caseId_idx" ON "bank_accounts"("caseId");

-- CreateIndex
CREATE INDEX "bank_agreements_caseId_idx" ON "bank_agreements"("caseId");

-- CreateIndex
CREATE INDEX "bank_agreements_bankAccountId_idx" ON "bank_agreements"("bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_agreements_caseId_bankAccountId_key" ON "bank_agreements"("caseId", "bankAccountId");

-- CreateIndex
CREATE INDEX "counterparties_caseId_idx" ON "counterparties"("caseId");

-- CreateIndex
CREATE INDEX "locations_caseId_idx" ON "locations"("caseId");

-- CreateIndex
CREATE INDEX "ledger_entries_caseId_idx" ON "ledger_entries"("caseId");

-- CreateIndex
CREATE INDEX "ledger_entries_caseId_transactionDate_idx" ON "ledger_entries"("caseId", "transactionDate");

-- CreateIndex
CREATE INDEX "ledger_entries_caseId_valueType_idx" ON "ledger_entries"("caseId", "valueType");

-- CreateIndex
CREATE INDEX "ledger_entries_caseId_reviewStatus_idx" ON "ledger_entries"("caseId", "reviewStatus");

-- CreateIndex
CREATE INDEX "ledger_entries_caseId_reviewStatus_suggestedLegalBucket_idx" ON "ledger_entries"("caseId", "reviewStatus", "suggestedLegalBucket");

-- CreateIndex
CREATE INDEX "ledger_entries_caseId_bankAccountId_idx" ON "ledger_entries"("caseId", "bankAccountId");

-- CreateIndex
CREATE INDEX "ledger_entries_caseId_counterpartyId_idx" ON "ledger_entries"("caseId", "counterpartyId");

-- CreateIndex
CREATE INDEX "ledger_entries_caseId_locationId_idx" ON "ledger_entries"("caseId", "locationId");

-- CreateIndex
CREATE INDEX "ledger_entries_importJobId_idx" ON "ledger_entries"("importJobId");

-- CreateIndex
CREATE INDEX "ledger_entries_sourceEffectId_idx" ON "ledger_entries"("sourceEffectId");

-- CreateIndex
CREATE INDEX "ledger_entries_parentEntryId_idx" ON "ledger_entries"("parentEntryId");

-- CreateIndex
CREATE INDEX "ledger_entries_estateAllocation_idx" ON "ledger_entries"("estateAllocation");

-- CreateIndex
CREATE INDEX "ledger_entries_transferPartnerEntryId_idx" ON "ledger_entries"("transferPartnerEntryId");

-- CreateIndex
CREATE INDEX "ledger_audit_logs_ledgerEntryId_idx" ON "ledger_audit_logs"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "ledger_audit_logs_caseId_timestamp_idx" ON "ledger_audit_logs"("caseId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "aggregation_cache_caseId_key" ON "aggregation_cache"("caseId");

-- CreateIndex
CREATE INDEX "aggregation_cache_caseId_idx" ON "aggregation_cache"("caseId");

-- CreateIndex
CREATE INDEX "classification_rules_caseId_isActive_idx" ON "classification_rules"("caseId", "isActive");

-- CreateIndex
CREATE INDEX "ingestion_records_jobId_status_idx" ON "ingestion_records"("jobId", "status");
