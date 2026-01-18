/**
 * Ledger Governance Logic
 *
 * Review-Status und Audit-Trail für LedgerEntries.
 * Jede manuelle Änderung speichert wer/wann + Pflichtkommentar.
 */

import { PrismaClient, LedgerEntry, LedgerAuditLog } from '@prisma/client';
import {
  REVIEW_STATUS,
  ReviewStatus,
  AUDIT_ACTIONS,
  AuditAction,
  FieldChange,
  ConfirmReviewInput,
  AdjustReviewInput,
} from './types';

// =============================================================================
// AUDIT LOG FUNCTIONS
// =============================================================================

/**
 * Create an audit log entry for a LedgerEntry change
 */
export async function createAuditLog(
  prisma: PrismaClient,
  params: {
    ledgerEntryId: string;
    caseId: string;
    action: AuditAction;
    fieldChanges: Record<string, FieldChange>;
    reason?: string;
    userId: string;
  }
): Promise<LedgerAuditLog> {
  return prisma.ledgerAuditLog.create({
    data: {
      ledgerEntryId: params.ledgerEntryId,
      caseId: params.caseId,
      action: params.action,
      fieldChanges: JSON.stringify(params.fieldChanges),
      reason: params.reason || null,
      userId: params.userId,
    },
  });
}

/**
 * Get audit log for a specific LedgerEntry
 */
export async function getEntryAuditLog(
  prisma: PrismaClient,
  ledgerEntryId: string
): Promise<LedgerAuditLog[]> {
  return prisma.ledgerAuditLog.findMany({
    where: { ledgerEntryId },
    orderBy: { timestamp: 'desc' },
  });
}

/**
 * Get audit log for a case (paginated)
 */
export async function getCaseAuditLog(
  prisma: PrismaClient,
  caseId: string,
  options: {
    limit?: number;
    offset?: number;
    from?: Date;
    to?: Date;
    action?: AuditAction;
  } = {}
): Promise<{ logs: LedgerAuditLog[]; total: number }> {
  const { limit = 50, offset = 0, from, to, action } = options;

  const where: Record<string, unknown> = { caseId };

  if (from || to) {
    where.timestamp = {};
    if (from) (where.timestamp as Record<string, Date>).gte = from;
    if (to) (where.timestamp as Record<string, Date>).lte = to;
  }

  if (action) {
    where.action = action;
  }

  const [logs, total] = await Promise.all([
    prisma.ledgerAuditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.ledgerAuditLog.count({ where }),
  ]);

  return { logs, total };
}

// =============================================================================
// REVIEW FUNCTIONS
// =============================================================================

/**
 * Validate that a review action is allowed
 */
export function validateReviewTransition(
  currentStatus: ReviewStatus,
  targetAction: 'CONFIRM' | 'ADJUST'
): { valid: boolean; error?: string } {
  // UNREVIEWED kann zu CONFIRMED oder ADJUSTED wechseln
  if (currentStatus === REVIEW_STATUS.UNREVIEWED) {
    return { valid: true };
  }

  // CONFIRMED kann zu ADJUSTED wechseln (bei Korrektur)
  if (currentStatus === REVIEW_STATUS.CONFIRMED) {
    if (targetAction === 'ADJUST') {
      return { valid: true };
    }
    // Bereits bestätigt - erneutes Bestätigen ist überflüssig, aber erlaubt
    return { valid: true };
  }

  // ADJUSTED kann erneut korrigiert werden
  if (currentStatus === REVIEW_STATUS.ADJUSTED) {
    return { valid: true };
  }

  return { valid: false, error: 'Ungültiger Status-Übergang' };
}

/**
 * Confirm a LedgerEntry (mark as reviewed, no changes)
 */
export async function confirmEntry(
  prisma: PrismaClient,
  entryId: string,
  userId: string,
  note?: string
): Promise<LedgerEntry> {
  // Get current entry
  const entry = await prisma.ledgerEntry.findUnique({
    where: { id: entryId },
  });

  if (!entry) {
    throw new Error('LedgerEntry nicht gefunden');
  }

  // Validate transition
  const validation = validateReviewTransition(
    entry.reviewStatus as ReviewStatus,
    'CONFIRM'
  );
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Update entry
  const updatedEntry = await prisma.ledgerEntry.update({
    where: { id: entryId },
    data: {
      reviewStatus: REVIEW_STATUS.CONFIRMED,
      reviewedBy: userId,
      reviewedAt: new Date(),
      reviewNote: note || null,
      updatedAt: new Date(),
      updatedBy: userId,
    },
  });

  // Create audit log
  await createAuditLog(prisma, {
    ledgerEntryId: entryId,
    caseId: entry.caseId,
    action: AUDIT_ACTIONS.CONFIRMED,
    fieldChanges: {
      reviewStatus: {
        old: entry.reviewStatus,
        new: REVIEW_STATUS.CONFIRMED,
      },
    },
    reason: note,
    userId,
  });

  return updatedEntry;
}

/**
 * Adjust a LedgerEntry (mark as corrected, with changes)
 */
export async function adjustEntry(
  prisma: PrismaClient,
  entryId: string,
  userId: string,
  input: AdjustReviewInput
): Promise<LedgerEntry> {
  // Get current entry
  const entry = await prisma.ledgerEntry.findUnique({
    where: { id: entryId },
  });

  if (!entry) {
    throw new Error('LedgerEntry nicht gefunden');
  }

  // Validate transition
  const validation = validateReviewTransition(
    entry.reviewStatus as ReviewStatus,
    'ADJUST'
  );
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Reason is required for adjustments
  if (!input.reason || input.reason.trim() === '') {
    throw new Error('Begründung ist bei Korrekturen erforderlich');
  }

  // Build field changes for audit log
  const fieldChanges: Record<string, FieldChange> = {
    reviewStatus: {
      old: entry.reviewStatus,
      new: REVIEW_STATUS.ADJUSTED,
    },
  };

  // Build update data
  const updateData: Record<string, unknown> = {
    reviewStatus: REVIEW_STATUS.ADJUSTED,
    reviewedBy: userId,
    reviewedAt: new Date(),
    reviewNote: input.reason,
    changeReason: input.reason,
    updatedAt: new Date(),
    updatedBy: userId,
  };

  // Track amount change
  if (input.changes.amountCents !== undefined) {
    updateData.previousAmountCents = entry.amountCents;
    updateData.amountCents = input.changes.amountCents;
    fieldChanges.amountCents = {
      old: entry.amountCents.toString(),
      new: input.changes.amountCents.toString(),
    };
  }

  // Track description change
  if (input.changes.description !== undefined) {
    updateData.description = input.changes.description;
    fieldChanges.description = {
      old: entry.description,
      new: input.changes.description,
    };
  }

  // Track legalBucket change
  if (input.changes.legalBucket !== undefined) {
    updateData.legalBucket = input.changes.legalBucket;
    fieldChanges.legalBucket = {
      old: entry.legalBucket,
      new: input.changes.legalBucket,
    };
  }

  // Track transactionDate change
  if (input.changes.transactionDate !== undefined) {
    updateData.transactionDate = input.changes.transactionDate;
    fieldChanges.transactionDate = {
      old: entry.transactionDate.toISOString(),
      new: input.changes.transactionDate.toISOString(),
    };
  }

  // Update entry
  const updatedEntry = await prisma.ledgerEntry.update({
    where: { id: entryId },
    data: updateData,
  });

  // Create audit log
  await createAuditLog(prisma, {
    ledgerEntryId: entryId,
    caseId: entry.caseId,
    action: AUDIT_ACTIONS.ADJUSTED,
    fieldChanges,
    reason: input.reason,
    userId,
  });

  return updatedEntry;
}

/**
 * Process a review input (confirm or adjust)
 */
export async function processReview(
  prisma: PrismaClient,
  entryId: string,
  userId: string,
  input: ConfirmReviewInput | AdjustReviewInput
): Promise<LedgerEntry> {
  if (input.action === 'CONFIRM') {
    return confirmEntry(prisma, entryId, userId, input.note);
  } else {
    return adjustEntry(prisma, entryId, userId, input);
  }
}

// =============================================================================
// BULK REVIEW FUNCTIONS
// =============================================================================

/**
 * Bulk confirm multiple entries
 */
export async function bulkConfirmEntries(
  prisma: PrismaClient,
  entryIds: string[],
  userId: string,
  note?: string
): Promise<{ confirmed: number; errors: string[] }> {
  const errors: string[] = [];
  let confirmed = 0;

  for (const entryId of entryIds) {
    try {
      await confirmEntry(prisma, entryId, userId, note);
      confirmed++;
    } catch (error) {
      errors.push(
        `${entryId}: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      );
    }
  }

  return { confirmed, errors };
}

// =============================================================================
// REVIEW STATISTICS
// =============================================================================

/**
 * Get review statistics for a case
 */
export async function getReviewStatistics(
  prisma: PrismaClient,
  caseId: string
): Promise<{
  total: number;
  unreviewed: number;
  confirmed: number;
  adjusted: number;
}> {
  const [total, unreviewed, confirmed, adjusted] = await Promise.all([
    prisma.ledgerEntry.count({ where: { caseId } }),
    prisma.ledgerEntry.count({
      where: { caseId, reviewStatus: REVIEW_STATUS.UNREVIEWED },
    }),
    prisma.ledgerEntry.count({
      where: { caseId, reviewStatus: REVIEW_STATUS.CONFIRMED },
    }),
    prisma.ledgerEntry.count({
      where: { caseId, reviewStatus: REVIEW_STATUS.ADJUSTED },
    }),
  ]);

  return { total, unreviewed, confirmed, adjusted };
}
