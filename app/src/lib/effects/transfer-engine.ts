/**
 * InsolvencyEffect → LedgerEntry Transfer Engine
 *
 * Überführt InsolvencyEffects idempotent in PLAN-LedgerEntries.
 * Jeder Effekt kann mehrfach überführt werden - bestehende Entries
 * werden dabei deterministisch ersetzt (DELETE + CREATE).
 *
 * Lineage: LedgerEntry.sourceEffectId verweist auf den Ursprungs-Effekt.
 */

import { PrismaClient } from '@prisma/client';
import { calculatePeriodStartDate } from '../ledger/aggregation';
import { markAggregationStale } from '../ledger/aggregation';

// =============================================================================
// TYPES
// =============================================================================

export interface TransferResult {
  success: boolean;
  created: number;
  deleted: number;
  skipped: number;
  errors: Array<{ effectId: string; error: string }>;
}

export interface TransferOptions {
  /** Ob die Aggregation nach Transfer als stale markiert werden soll (default: true) */
  markStale?: boolean;
}

// =============================================================================
// TRANSFER FUNCTIONS
// =============================================================================

/**
 * Überführt InsolvencyEffects in PLAN-LedgerEntries (idempotent)
 *
 * Bei erneuter Ausführung für denselben Effekt:
 * 1. Bestehende abgeleitete Entries werden gelöscht
 * 2. Neue Entries werden erstellt
 * → Kein Duplikat-Risiko
 *
 * @param prisma - Prisma Client
 * @param caseId - Fall-ID
 * @param planId - Plan-ID (für Startdatum)
 * @param effectIds - Welche Effekte überführen
 * @param userId - User für Audit-Trail
 * @param options - Transfer-Optionen
 */
export async function transferEffectsToLedger(
  prisma: PrismaClient,
  caseId: string,
  planId: string,
  effectIds: string[],
  userId: string,
  options: TransferOptions = {}
): Promise<TransferResult> {
  const { markStale = true } = options;

  // 1. Plan laden für Startdatum und Periodentyp
  const plan = await prisma.liquidityPlan.findUnique({
    where: { id: planId },
    select: { planStartDate: true, periodType: true, periodCount: true },
  });

  if (!plan) {
    return {
      success: false,
      created: 0,
      deleted: 0,
      skipped: 0,
      errors: [{ effectId: 'plan', error: `Plan ${planId} nicht gefunden` }],
    };
  }

  // 2. Effekte laden (nur aktive, nicht isAvailabilityOnly)
  const effects = await prisma.insolvencyEffect.findMany({
    where: {
      id: { in: effectIds },
      planId,
      isActive: true,
      isAvailabilityOnly: false, // Verfügbarkeits-Overlays nicht automatisch überführen
    },
  });

  let created = 0;
  let deleted = 0;
  let skipped = 0;
  const errors: Array<{ effectId: string; error: string }> = [];

  // 3. Effekte verarbeiten, die übersprungen wurden (availability only)
  const loadedIds = new Set(effects.map((e) => e.id));
  for (const effectId of effectIds) {
    if (!loadedIds.has(effectId)) {
      // Effekt wurde nicht geladen - entweder inaktiv oder isAvailabilityOnly
      const effect = await prisma.insolvencyEffect.findUnique({
        where: { id: effectId },
        select: { isAvailabilityOnly: true, isActive: true },
      });
      if (effect?.isAvailabilityOnly) {
        skipped++;
        errors.push({
          effectId,
          error: 'Verfügbarkeits-Effekt kann nicht automatisch überführt werden',
        });
      } else if (!effect?.isActive) {
        skipped++;
        errors.push({
          effectId,
          error: 'Effekt ist deaktiviert',
        });
      }
    }
  }

  // 4. Jeden Effekt verarbeiten
  for (const effect of effects) {
    try {
      // 4a. IDEMPOTENZ: Bestehende abgeleitete Entries löschen
      const deletedEntries = await prisma.ledgerEntry.deleteMany({
        where: { sourceEffectId: effect.id },
      });
      deleted += deletedEntries.count;

      // 4b. Transaktionsdatum berechnen (Anfang der Periode)
      const transactionDate = calculatePeriodStartDate(
        plan.planStartDate,
        effect.periodIndex,
        plan.periodType as 'WEEKLY' | 'MONTHLY'
      );

      // 4c. Neuen LedgerEntry erstellen
      const amountCents =
        effect.effectType === 'INFLOW'
          ? effect.amountCents
          : -BigInt(Math.abs(Number(effect.amountCents)));

      await prisma.ledgerEntry.create({
        data: {
          caseId,
          transactionDate,
          amountCents,
          description: effect.name,
          note: effect.description,
          valueType: 'PLAN',
          legalBucket:
            effect.effectGroup === 'PROCEDURE_COST' ? 'MASSE' : 'UNKNOWN',

          // LINEAGE
          sourceEffectId: effect.id,
          importSource: `Insolvenzeffekt: ${effect.effectGroup}`,
          bookingSource: 'MANUAL',

          // GOVERNANCE
          reviewStatus: 'UNREVIEWED',
          createdBy: userId,
        },
      });

      created++;
    } catch (error) {
      errors.push({
        effectId: effect.id,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    }
  }

  // 5. Aggregation als stale markieren (falls gewünscht)
  if (markStale && (created > 0 || deleted > 0)) {
    await markAggregationStale(prisma, caseId);
  }

  return {
    success: errors.filter((e) => !e.error.includes('Verfügbarkeits')).length === 0,
    created,
    deleted,
    skipped,
    errors,
  };
}

/**
 * Entfernt alle aus einem Effekt abgeleiteten LedgerEntries
 *
 * @param prisma - Prisma Client
 * @param effectId - ID des Effekts
 * @returns Anzahl der gelöschten Entries
 */
export async function removeEffectFromLedger(
  prisma: PrismaClient,
  effectId: string
): Promise<number> {
  const result = await prisma.ledgerEntry.deleteMany({
    where: { sourceEffectId: effectId },
  });
  return result.count;
}

/**
 * Prüft ob ein Effekt bereits ins Ledger überführt wurde
 *
 * @param prisma - Prisma Client
 * @param effectId - ID des Effekts
 * @returns true wenn mindestens ein abgeleiteter Entry existiert
 */
export async function isEffectTransferred(
  prisma: PrismaClient,
  effectId: string
): Promise<boolean> {
  const count = await prisma.ledgerEntry.count({
    where: { sourceEffectId: effectId },
  });
  return count > 0;
}

/**
 * Gibt alle Effect-IDs zurück, die bereits ins Ledger überführt wurden
 *
 * @param prisma - Prisma Client
 * @param effectIds - Liste der zu prüfenden Effect-IDs
 * @returns Set der bereits überführten Effect-IDs
 */
export async function getTransferredEffectIds(
  prisma: PrismaClient,
  effectIds: string[]
): Promise<Set<string>> {
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      sourceEffectId: { in: effectIds },
    },
    select: { sourceEffectId: true },
    distinct: ['sourceEffectId'],
  });

  return new Set(
    entries
      .map((e) => e.sourceEffectId)
      .filter((id): id is string => id !== null)
  );
}

/**
 * Synchronisiert alle aktiven Effekte eines Plans ins Ledger
 * Nützlich für Bulk-Operationen
 *
 * @param prisma - Prisma Client
 * @param caseId - Fall-ID
 * @param planId - Plan-ID
 * @param userId - User für Audit-Trail
 */
export async function syncAllEffectsToLedger(
  prisma: PrismaClient,
  caseId: string,
  planId: string,
  userId: string
): Promise<TransferResult> {
  // Alle aktiven, nicht-availability-only Effekte laden
  const effects = await prisma.insolvencyEffect.findMany({
    where: {
      planId,
      isActive: true,
      isAvailabilityOnly: false,
    },
    select: { id: true },
  });

  const effectIds = effects.map((e) => e.id);

  if (effectIds.length === 0) {
    return {
      success: true,
      created: 0,
      deleted: 0,
      skipped: 0,
      errors: [],
    };
  }

  return transferEffectsToLedger(prisma, caseId, planId, effectIds, userId);
}
