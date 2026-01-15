-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
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
    CONSTRAINT "cases_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "liquidity_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "planStartDate" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT NOT NULL,
    CONSTRAINT "liquidity_plans_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "liquidity_plan_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshotDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotReason" TEXT NOT NULL,
    "openingBalanceCents" BIGINT NOT NULL,
    "dataHash" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "liquidity_plan_versions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "liquidity_plans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cashflow_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "flowType" TEXT NOT NULL,
    "estateType" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "cashflow_categories_planId_fkey" FOREIGN KEY ("planId") REFERENCES "liquidity_plans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cashflow_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT NOT NULL,
    CONSTRAINT "cashflow_lines_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "cashflow_categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "weekly_values" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lineId" TEXT NOT NULL,
    "weekOffset" INTEGER NOT NULL,
    "valueType" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT NOT NULL,
    CONSTRAINT "weekly_values_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "cashflow_lines" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ingestion_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "planId" TEXT,
    "sourceType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHashSha256" TEXT NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "rawFilePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "recordCountRaw" INTEGER,
    "recordCountNormalized" INTEGER,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "ingestion_jobs_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ingestion_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" TEXT NOT NULL,
    "mappedData" TEXT,
    "normalizedData" TEXT,
    "status" TEXT NOT NULL DEFAULT 'STAGING',
    "validationErrors" TEXT,
    "validationWarnings" TEXT,
    CONSTRAINT "ingestion_records_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ingestion_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "staged_cashflow_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "targetCategoryName" TEXT NOT NULL,
    "targetCategoryFlowType" TEXT NOT NULL,
    "targetCategoryEstateType" TEXT NOT NULL,
    "lineName" TEXT NOT NULL,
    "lineDescription" TEXT,
    "weekOffset" INTEGER NOT NULL,
    "valueType" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "note" TEXT,
    "confidenceScore" REAL,
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "reviewAction" TEXT,
    "status" TEXT NOT NULL DEFAULT 'STAGED',
    CONSTRAINT "staged_cashflow_entries_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "ingestion_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "field_transformations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "sourceField" TEXT NOT NULL,
    "sourceValue" TEXT NOT NULL,
    "targetField" TEXT NOT NULL,
    "targetValue" TEXT NOT NULL,
    "transformationType" TEXT NOT NULL,
    "transformationConfig" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "field_transformations_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ingestion_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mapping_configurations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "fieldMappings" TEXT NOT NULL,
    "valueMappings" TEXT NOT NULL,
    "categoryMappings" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "case_configurations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "configType" TEXT NOT NULL,
    "configData" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT NOT NULL,
    CONSTRAINT "case_configurations_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "share_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "share_links_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userIp" TEXT,
    "userAgent" TEXT,
    "action" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "metadata" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "cases_caseNumber_key" ON "cases"("caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "liquidity_plan_versions_planId_versionNumber_key" ON "liquidity_plan_versions"("planId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "cashflow_categories_planId_name_flowType_estateType_key" ON "cashflow_categories"("planId", "name", "flowType", "estateType");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_values_lineId_weekOffset_valueType_key" ON "weekly_values"("lineId", "weekOffset", "valueType");

-- CreateIndex
CREATE UNIQUE INDEX "ingestion_records_jobId_rowNumber_key" ON "ingestion_records"("jobId", "rowNumber");

-- CreateIndex
CREATE UNIQUE INDEX "case_configurations_caseId_configType_key" ON "case_configurations"("caseId", "configType");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_key" ON "share_links"("token");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_timestamp_idx" ON "audit_events"("timestamp");

-- CreateIndex
CREATE INDEX "audit_events_userId_idx" ON "audit_events"("userId");
