/**
 * Approval Engine – Mehrstufige Freigabekette für Orders
 *
 * Design-Prinzipien:
 * 1. Revisionssicherheit: ApprovalSteps speichern Snapshots der Rule zum Zeitpunkt der Erstellung.
 * 2. Chain wird beim Einreichen fixiert: Betrag zum Einreichungszeitpunkt bestimmt die Stufen.
 * 3. Order.status bleibt simpel: PENDING / APPROVED / REJECTED / AUTO_APPROVED.
 * 4. Backward Compatibility: Cases ohne ApprovalRules → Legacy-Modus (jeder kann freigeben).
 */

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// ─── Errors ──────────────────────────────────────────────────────────────────

export class ApprovalAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalAuthError";
  }
}

export class ApprovalRuleInactiveError extends Error {
  constructor(ruleName: string) {
    super(`Freigabestufe "${ruleName}" wurde deaktiviert`);
    this.name = "ApprovalRuleInactiveError";
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApprovalResult {
  complete: boolean;
  orderStatus: string;
  message: string;
  nextStep?: {
    id: string;
    roleName: string;
    approverName: string;
    sequence: number;
  } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Prüft ob ein Case aktive ApprovalRules hat → Chain-Modus
 */
export async function hasApprovalChain(caseId: string): Promise<boolean> {
  const count = await prisma.approvalRule.count({
    where: { caseId, isActive: true },
  });
  return count > 0;
}

/**
 * Lädt alle ApprovalSteps einer Order, sortiert nach sequenceSnapshot
 */
export async function getOrderSteps(orderId: string) {
  return prisma.approvalStep.findMany({
    where: { orderId },
    include: {
      approvalRule: {
        include: { customer: { select: { id: true, name: true, email: true } } },
      },
    },
    orderBy: { sequenceSnapshot: "asc" },
  });
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Erzeugt ApprovalSteps für eine Order basierend auf den aktiven Rules des Cases.
 * Wird beim Einreichen einer Order aufgerufen (NICHT bei Auto-Approve).
 *
 * Die Chain ist ab diesem Zeitpunkt fixiert.
 */
export async function createApprovalSteps(
  orderId: string,
  caseId: string,
  amountCents: bigint,
  tx?: Prisma.TransactionClient
): Promise<number> {
  const db = tx || prisma;

  // Lade aktive Rules, sortiert nach sequence
  const rules = await db.approvalRule.findMany({
    where: { caseId, isActive: true },
    include: { customer: { select: { name: true } } },
    orderBy: { sequence: "asc" },
  });

  // Filtere: Nur Rules wo Order-Betrag >= Schwellwert
  const absAmount = amountCents < 0n ? -amountCents : amountCents;
  const applicableRules = rules.filter((r) => absAmount >= r.thresholdCents);

  if (applicableRules.length === 0) return 0;

  // Erstelle Steps mit Snapshots
  for (const rule of applicableRules) {
    await db.approvalStep.create({
      data: {
        orderId,
        approvalRuleId: rule.id,
        roleNameSnapshot: rule.roleName,
        thresholdSnapshot: rule.thresholdCents,
        sequenceSnapshot: rule.sequence,
        approverNameSnapshot: rule.customer.name,
        status: "PENDING",
      },
    });
  }

  return applicableRules.length;
}

/**
 * Verarbeitet eine Freigabe-Entscheidung innerhalb der Chain.
 *
 * Prüft:
 * - Ist der User der zugewiesene Approver (oder Admin)?
 * - Ist der Step der nächste in der Kette?
 * - Ist die Rule noch aktiv?
 *
 * Bei letztem Step → Order = APPROVED
 */
export async function processApproval(
  orderId: string,
  userId: string,
  isAdmin: boolean,
  comment?: string
): Promise<ApprovalResult> {
  const steps = await prisma.approvalStep.findMany({
    where: { orderId },
    include: {
      approvalRule: {
        select: { customerId: true, isActive: true, isRequired: true, customer: { select: { id: true, name: true } } },
      },
    },
    orderBy: { sequenceSnapshot: "asc" },
  });

  if (steps.length === 0) {
    return { complete: false, orderStatus: "PENDING", message: "Keine Freigabe-Schritte vorhanden" };
  }

  // Finde aktuellen (niedrigste Sequence mit PENDING)
  const currentStep = steps.find((s) => s.status === "PENDING");
  if (!currentStep) {
    return { complete: true, orderStatus: "APPROVED", message: "Alle Stufen bereits abgeschlossen" };
  }

  // Sicherheitsprüfung: Ist die Rule noch aktiv?
  if (!currentStep.approvalRule.isActive) {
    throw new ApprovalRuleInactiveError(currentStep.roleNameSnapshot);
  }

  // Sicherheitsprüfung: Ist der User der zugewiesene Approver oder Admin?
  const isAssignedApprover = currentStep.approvalRule.customerId === userId;
  if (!isAssignedApprover && !isAdmin) {
    throw new ApprovalAuthError(
      `Nicht autorisiert: Stufe "${currentStep.roleNameSnapshot}" ist ${currentStep.approverNameSnapshot} zugewiesen`
    );
  }

  // Step auf APPROVED setzen
  await prisma.approvalStep.update({
    where: { id: currentStep.id },
    data: {
      status: "APPROVED",
      decidedAt: new Date(),
      decidedBy: userId,
      comment: comment || null,
    },
  });

  // Prüfe ob weitere PENDING Steps existieren (required)
  const remainingRequired = steps.filter(
    (s) => s.id !== currentStep.id && s.status === "PENDING" && s.approvalRule.isRequired
  );

  if (remainingRequired.length > 0) {
    const nextStep = remainingRequired[0];
    return {
      complete: false,
      orderStatus: "PENDING",
      message: `Freigegeben durch ${currentStep.roleNameSnapshot}. Weiter an ${nextStep.roleNameSnapshot}.`,
      nextStep: {
        id: nextStep.id,
        roleName: nextStep.roleNameSnapshot,
        approverName: nextStep.approverNameSnapshot,
        sequence: nextStep.sequenceSnapshot,
      },
    };
  }

  // Alle optionalen PENDING Steps auf SKIPPED setzen
  const optionalPending = steps.filter(
    (s) => s.id !== currentStep.id && s.status === "PENDING" && !s.approvalRule.isRequired
  );
  if (optionalPending.length > 0) {
    await prisma.approvalStep.updateMany({
      where: { id: { in: optionalPending.map((s) => s.id) } },
      data: { status: "SKIPPED", decidedAt: new Date() },
    });
  }

  return {
    complete: true,
    orderStatus: "APPROVED",
    message: "Alle erforderlichen Stufen freigegeben",
    nextStep: null,
  };
}

/**
 * Verarbeitet eine Ablehnung innerhalb der Chain.
 *
 * - Aktueller Step → REJECTED
 * - Alle weiteren PENDING Steps → SKIPPED
 * - Order → REJECTED
 */
export async function processRejection(
  orderId: string,
  userId: string,
  isAdmin: boolean,
  reason: string
): Promise<void> {
  const steps = await prisma.approvalStep.findMany({
    where: { orderId },
    include: {
      approvalRule: {
        select: { customerId: true, isActive: true, isRequired: true, customer: { select: { id: true, name: true } } },
      },
    },
    orderBy: { sequenceSnapshot: "asc" },
  });

  if (steps.length === 0) return;

  const currentStep = steps.find((s) => s.status === "PENDING");
  if (!currentStep) {
    throw new Error("Keine offenen Freigabe-Schritte vorhanden");
  }

  // Sicherheitsprüfung: Rule noch aktiv?
  if (!currentStep.approvalRule.isActive) {
    throw new ApprovalRuleInactiveError(currentStep.roleNameSnapshot);
  }

  // Sicherheitsprüfung: Ist der User zugewiesen?
  const isAssignedApprover = currentStep.approvalRule.customerId === userId;
  if (!isAssignedApprover && !isAdmin) {
    throw new ApprovalAuthError(
      `Nicht autorisiert: Stufe "${currentStep.roleNameSnapshot}" ist ${currentStep.approverNameSnapshot} zugewiesen`
    );
  }

  // Aktuellen Step auf REJECTED
  await prisma.approvalStep.update({
    where: { id: currentStep.id },
    data: {
      status: "REJECTED",
      decidedAt: new Date(),
      decidedBy: userId,
      comment: reason,
    },
  });

  // Verbleibende PENDING Steps auf SKIPPED
  const remainingPending = steps.filter(
    (s) => s.id !== currentStep.id && s.status === "PENDING"
  );
  if (remainingPending.length > 0) {
    await prisma.approvalStep.updateMany({
      where: { id: { in: remainingPending.map((s) => s.id) } },
      data: { status: "SKIPPED", decidedAt: new Date() },
    });
  }
}

/**
 * Ermittelt den aktuellen Approver für eine PENDING Order mit Chain.
 * Gibt null zurück wenn kein Chain-Modus aktiv oder kein PENDING Step.
 */
export async function getCurrentApprover(orderId: string) {
  const step = await prisma.approvalStep.findFirst({
    where: { orderId, status: "PENDING" },
    include: {
      approvalRule: {
        include: { customer: { select: { id: true, name: true, email: true } } },
      },
    },
    orderBy: { sequenceSnapshot: "asc" },
  });
  return step ? step.approvalRule.customer : null;
}
