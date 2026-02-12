import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  LedgerEntryResponse,
  deriveFlowType,
  VALUE_TYPES,
  LEGAL_BUCKETS,
  CATEGORY_TAG_LABELS,
  LegalBucket,
  ValueType,
  ReviewStatus,
  markAggregationStale,
  createAuditLog,
  AUDIT_ACTIONS,
} from '@/lib/ledger';
import { LedgerEntry } from '@prisma/client';
import { determineEstateAllocation } from '@/lib/settlement/split-engine';
import { AllocationSource } from '@/lib/types/allocation';

/**
 * Serialize a LedgerEntry to LedgerEntryResponse (including governance fields)
 */
function serializeLedgerEntry(entry: LedgerEntry): LedgerEntryResponse {
  return {
    id: entry.id,
    caseId: entry.caseId,
    transactionDate: entry.transactionDate.toISOString(),
    amountCents: entry.amountCents.toString(),
    description: entry.description,
    note: entry.note,
    valueType: entry.valueType as ValueType,
    legalBucket: entry.legalBucket as LegalBucket,
    importSource: entry.importSource,
    importJobId: entry.importJobId,
    importFileHash: entry.importFileHash,
    importRowNumber: entry.importRowNumber,
    bookingSource: entry.bookingSource,
    bookingSourceId: entry.bookingSourceId,
    bookingReference: entry.bookingReference,
    // Steuerungsdimensionen
    bankAccountId: entry.bankAccountId,
    counterpartyId: entry.counterpartyId,
    locationId: entry.locationId,
    steeringTag: entry.steeringTag,
    // Governance fields
    reviewStatus: entry.reviewStatus as ReviewStatus,
    reviewedBy: entry.reviewedBy,
    reviewedAt: entry.reviewedAt?.toISOString() || null,
    reviewNote: entry.reviewNote,
    changeReason: entry.changeReason,
    previousAmountCents: entry.previousAmountCents?.toString() || null,
    // Estate Allocation
    estateAllocation: entry.estateAllocation,
    estateRatio: entry.estateRatio?.toString() || null,
    allocationSource: entry.allocationSource,
    allocationNote: entry.allocationNote,
    // Service Date / Period (für Alt/Neu-Zuordnung)
    serviceDate: entry.serviceDate?.toISOString() || null,
    servicePeriodStart: entry.servicePeriodStart?.toISOString() || null,
    servicePeriodEnd: entry.servicePeriodEnd?.toISOString() || null,
    // Service Date Vorschläge (Phase C)
    suggestedServiceDate: entry.suggestedServiceDate?.toISOString() || null,
    suggestedServicePeriodStart: entry.suggestedServicePeriodStart?.toISOString() || null,
    suggestedServicePeriodEnd: entry.suggestedServicePeriodEnd?.toISOString() || null,
    suggestedServiceDateRule: entry.suggestedServiceDateRule,
    // Category Tag (Matrix-Zuordnung)
    categoryTag: entry.categoryTag,
    categoryTagSource: entry.categoryTagSource,
    categoryTagNote: entry.categoryTagNote,
    suggestedCategoryTag: entry.suggestedCategoryTag,
    suggestedCategoryTagReason: entry.suggestedCategoryTagReason,
    // Transfer Pairing (Umbuchungen)
    transferPartnerEntryId: entry.transferPartnerEntryId,
    // Audit
    createdAt: entry.createdAt.toISOString(),
    createdBy: entry.createdBy,
    updatedAt: entry.updatedAt.toISOString(),
    // Derived
    flowType: deriveFlowType(BigInt(entry.amountCents)),
  };
}

// =============================================================================
// GET /api/cases/[id]/ledger/[entryId] - Get a single LedgerEntry
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId, entryId } = await params;

    const entry = await prisma.ledgerEntry.findFirst({
      where: { id: entryId, caseId },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Eintrag nicht gefunden' }, { status: 404 });
    }

    // Try to fetch original import data if available
    let importData: {
      rawData: Record<string, unknown> | null;
      mappedData: Record<string, unknown> | null;
      sheetName: string | null;
    } | null = null;

    if (entry.importJobId && entry.importRowNumber !== null) {
      const ingestionRecord = await prisma.ingestionRecord.findUnique({
        where: {
          jobId_rowNumber: {
            jobId: entry.importJobId,
            rowNumber: entry.importRowNumber,
          },
        },
        select: {
          rawData: true,
          mappedData: true,
          sheetName: true,
        },
      });

      if (ingestionRecord) {
        importData = {
          rawData: ingestionRecord.rawData ? JSON.parse(ingestionRecord.rawData) : null,
          mappedData: ingestionRecord.mappedData ? JSON.parse(ingestionRecord.mappedData) : null,
          sheetName: ingestionRecord.sheetName,
        };
      }
    }

    // === Split-Kontext laden ===
    const isChild = !!entry.parentEntryId;
    let splitChildren: Array<{
      id: string;
      description: string;
      amountCents: string;
      counterpartyId: string | null;
      locationId: string | null;
      categoryTag: string | null;
      reviewStatus: string;
      note: string | null;
      bookingReference: string | null;
    }> = [];
    let parentEntry: {
      id: string;
      description: string;
      amountCents: string;
      transactionDate: string;
      splitReason: string | null;
    } | null = null;
    let siblings: Array<{
      id: string;
      description: string;
      amountCents: string;
      counterpartyId: string | null;
      locationId: string | null;
    }> = [];
    let breakdownInfo: {
      recipientName: string;
      recipientIban: string;
      purpose: string | null;
      itemIndex: number;
      sourceReference: string;
      sourceDate: string;
      sourceFile: string | null;
    } | null = null;

    // Split-Queries parallel ausführen
    const [children, parentResult, siblingsResult, breakdownItem] = await Promise.all([
      // Children laden (prüft ob Entry ein Parent ist)
      prisma.ledgerEntry.findMany({
        where: { parentEntryId: entry.id },
        select: {
          id: true,
          description: true,
          amountCents: true,
          counterpartyId: true,
          locationId: true,
          categoryTag: true,
          reviewStatus: true,
          note: true,
          bookingReference: true,
        },
      }),
      // Parent laden (nur wenn Child)
      isChild && entry.parentEntryId
        ? prisma.ledgerEntry.findFirst({
            where: { id: entry.parentEntryId },
            select: { id: true, description: true, amountCents: true, transactionDate: true, splitReason: true },
          })
        : Promise.resolve(null),
      // Geschwister laden (nur wenn Child)
      isChild && entry.parentEntryId
        ? prisma.ledgerEntry.findMany({
            where: { parentEntryId: entry.parentEntryId, id: { not: entry.id } },
            select: { id: true, description: true, amountCents: true, counterpartyId: true, locationId: true },
          })
        : Promise.resolve([]),
      // Zahlbeleg-Herkunft laden (nur wenn Child)
      isChild
        ? prisma.paymentBreakdownItem.findFirst({
            where: { createdLedgerEntryId: entry.id },
            include: { source: true },
          })
        : Promise.resolve(null),
    ]);

    const isParent = children.length > 0;

    if (isParent) {
      splitChildren = children.map(c => ({
        id: c.id,
        description: c.description,
        amountCents: c.amountCents.toString(),
        counterpartyId: c.counterpartyId,
        locationId: c.locationId,
        categoryTag: c.categoryTag,
        reviewStatus: c.reviewStatus,
        note: c.note,
        bookingReference: c.bookingReference,
      }));
    }

    if (parentResult) {
      parentEntry = {
        id: parentResult.id,
        description: parentResult.description,
        amountCents: parentResult.amountCents.toString(),
        transactionDate: parentResult.transactionDate.toISOString(),
        splitReason: parentResult.splitReason,
      };
    }

    if (siblingsResult.length > 0) {
      siblings = siblingsResult.map(s => ({
        id: s.id,
        description: s.description,
        amountCents: s.amountCents.toString(),
        counterpartyId: s.counterpartyId,
        locationId: s.locationId,
      }));
    }

    if (breakdownItem) {
      breakdownInfo = {
        recipientName: breakdownItem.recipientName,
        recipientIban: breakdownItem.recipientIban,
        purpose: breakdownItem.purpose,
        itemIndex: breakdownItem.itemIndex,
        sourceReference: breakdownItem.source.referenceNumber,
        sourceDate: breakdownItem.source.executionDate.toISOString(),
        sourceFile: breakdownItem.source.sourceFileName,
      };
    }

    const splitContext = (isParent || isChild) ? {
      isParent,
      isChild,
      splitChildren,
      parentEntry,
      siblings,
      breakdownInfo,
    } : null;

    return NextResponse.json({
      ...serializeLedgerEntry(entry),
      importData,
      splitContext,
    });
  } catch (error) {
    console.error('Error fetching ledger entry:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden des Ledger-Eintrags' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT /api/cases/[id]/ledger/[entryId] - Update a LedgerEntry
// =============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId, entryId } = await params;
    const body = await request.json();

    // Verify entry exists and belongs to case
    const existing = await prisma.ledgerEntry.findFirst({
      where: { id: entryId, caseId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Eintrag nicht gefunden' }, { status: 404 });
    }

    // Guard: Split-Parents dürfen bestimmte Felder nicht ändern
    const childCount = await prisma.ledgerEntry.count({
      where: { parentEntryId: entryId },
    });

    if (childCount > 0) {
      const protectedFields = ['amountCents', 'transactionDate', 'bankAccountId'];
      const attemptedChanges = protectedFields.filter(f => body[f] !== undefined);

      if (attemptedChanges.length > 0) {
        return NextResponse.json({
          error: `Felder ${attemptedChanges.join(', ')} können nicht geändert werden – Entry hat ${childCount} Einzelposten. Erst Aufspaltung rückgängig machen.`,
        }, { status: 400 });
      }
    }

    // Validierung: serviceDate und servicePeriod dürfen NICHT gleichzeitig gesetzt sein
    if (body.serviceDate && (body.servicePeriodStart || body.servicePeriodEnd)) {
      return NextResponse.json(
        { error: 'Entweder Leistungsdatum ODER Leistungszeitraum, nicht beides' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.transactionDate !== undefined) {
      updateData.transactionDate = new Date(body.transactionDate);
    }

    if (body.amountCents !== undefined) {
      updateData.amountCents = BigInt(body.amountCents);
    }

    if (body.description !== undefined) {
      updateData.description = body.description;
    }

    if (body.note !== undefined) {
      updateData.note = body.note;
    }

    if (body.valueType !== undefined) {
      if (!Object.values(VALUE_TYPES).includes(body.valueType)) {
        return NextResponse.json(
          { error: 'Ungültiger valueType. Erlaubt: IST, PLAN' },
          { status: 400 }
        );
      }
      updateData.valueType = body.valueType;
    }

    if (body.legalBucket !== undefined) {
      if (!Object.values(LEGAL_BUCKETS).includes(body.legalBucket)) {
        return NextResponse.json(
          { error: 'Ungültiger legalBucket. Erlaubt: MASSE, ABSONDERUNG, NEUTRAL, UNKNOWN' },
          { status: 400 }
        );
      }
      updateData.legalBucket = body.legalBucket;
    }

    if (body.bookingSource !== undefined) {
      updateData.bookingSource = body.bookingSource;
    }

    if (body.bookingSourceId !== undefined) {
      updateData.bookingSourceId = body.bookingSourceId;
    }

    if (body.bookingReference !== undefined) {
      updateData.bookingReference = body.bookingReference;
    }

    // Steuerungsdimensionen
    if (body.bankAccountId !== undefined) {
      updateData.bankAccountId = body.bankAccountId || null;
    }

    if (body.counterpartyId !== undefined) {
      updateData.counterpartyId = body.counterpartyId || null;
    }

    if (body.locationId !== undefined) {
      updateData.locationId = body.locationId || null;
    }

    if (body.steeringTag !== undefined) {
      updateData.steeringTag = body.steeringTag || null;
    }

    // Category Tag (Matrix-Zuordnung)
    if (body.categoryTag !== undefined) {
      const newTag = body.categoryTag || null;
      // Validierung
      if (newTag && !Object.keys(CATEGORY_TAG_LABELS).includes(newTag)) {
        return NextResponse.json(
          { error: `Ungültiger categoryTag: ${newTag}` },
          { status: 400 }
        );
      }
      updateData.categoryTag = newTag;
      updateData.categoryTagSource = 'MANUELL';
      const oldLabel = existing.categoryTag || '–';
      const newLabel = newTag || '–';
      updateData.categoryTagNote = `Manuell geändert von ${oldLabel} nach ${newLabel}`;
    }

    // Estate Allocation (Alt-/Neumasse)
    if (body.estateAllocation !== undefined) {
      updateData.estateAllocation = body.estateAllocation || null;
    }
    if (body.allocationSource !== undefined) {
      updateData.allocationSource = body.allocationSource || null;
    }
    if (body.allocationNote !== undefined) {
      updateData.allocationNote = body.allocationNote || null;
    }

    // Service Date / Period (für Alt/Neu-Zuordnung)
    // Beim Setzen von serviceDate: servicePeriod auf null setzen (und umgekehrt)
    if (body.serviceDate !== undefined) {
      updateData.serviceDate = body.serviceDate ? new Date(body.serviceDate) : null;
      // Exklusivität: Period löschen wenn serviceDate gesetzt wird
      if (body.serviceDate) {
        updateData.servicePeriodStart = null;
        updateData.servicePeriodEnd = null;
      }
    }
    if (body.servicePeriodStart !== undefined) {
      updateData.servicePeriodStart = body.servicePeriodStart ? new Date(body.servicePeriodStart) : null;
    }
    if (body.servicePeriodEnd !== undefined) {
      updateData.servicePeriodEnd = body.servicePeriodEnd ? new Date(body.servicePeriodEnd) : null;
      // Exklusivität: serviceDate löschen wenn Period vollständig gesetzt
      if (body.servicePeriodStart && body.servicePeriodEnd) {
        updateData.serviceDate = null;
      }
    }

    // Build field changes for audit log
    const fieldChanges: Record<string, { old: string | number | null; new: string | number | null }> = {};

    if (body.amountCents !== undefined && existing.amountCents.toString() !== body.amountCents.toString()) {
      fieldChanges.amountCents = { old: existing.amountCents.toString(), new: body.amountCents.toString() };
    }
    if (body.description !== undefined && existing.description !== body.description) {
      fieldChanges.description = { old: existing.description, new: body.description };
    }
    if (body.legalBucket !== undefined && existing.legalBucket !== body.legalBucket) {
      fieldChanges.legalBucket = { old: existing.legalBucket, new: body.legalBucket };
    }
    if (body.transactionDate !== undefined) {
      const newDate = new Date(body.transactionDate).toISOString();
      if (existing.transactionDate.toISOString() !== newDate) {
        fieldChanges.transactionDate = { old: existing.transactionDate.toISOString(), new: newDate };
      }
    }
    if (body.categoryTag !== undefined && existing.categoryTag !== (body.categoryTag || null)) {
      fieldChanges.categoryTag = { old: existing.categoryTag, new: body.categoryTag || null };
    }

    // Update entry
    let entry = await prisma.ledgerEntry.update({
      where: { id: entryId },
      data: updateData,
    });

    // Prüfen ob Leistungsdatum geändert wurde → Split-Engine triggern
    const serviceDateChanged =
      body.serviceDate !== undefined ||
      body.servicePeriodStart !== undefined ||
      body.servicePeriodEnd !== undefined;

    if (serviceDateChanged) {
      // Case mit cutoffDate laden
      const caseEntity = await prisma.case.findUnique({
        where: { id: caseId },
        select: { cutoffDate: true },
      });

      if (caseEntity?.cutoffDate) {
        // Aktuellen Entry neu laden (stale data vermeiden)
        const updatedEntry = await prisma.ledgerEntry.findUnique({
          where: { id: entryId },
        });

        if (updatedEntry) {
          // Split-Engine für Berechnung nutzen
          // HINWEIS: Ohne CounterpartyConfig nur SERVICE_DATE_RULE / PERIOD_PRORATA / UNKLAR möglich
          const allocationResult = determineEstateAllocation(
            {
              transactionDate: updatedEntry.transactionDate,
              serviceDate: updatedEntry.serviceDate,
              servicePeriodStart: updatedEntry.servicePeriodStart,
              servicePeriodEnd: updatedEntry.servicePeriodEnd,
            },
            null, // CounterpartyConfig - Phase B
            caseEntity.cutoffDate
          );

          // Estate Allocation aktualisieren
          // WICHTIG: allocationSource = MANUELL, weil User das Datum manuell gesetzt hat!
          entry = await prisma.ledgerEntry.update({
            where: { id: entryId },
            data: {
              estateAllocation: allocationResult.estateAllocation,
              estateRatio: allocationResult.estateRatio?.toNumber() || null,
              allocationSource: AllocationSource.MANUELL,
              allocationNote: `Manuell zugeordnet. ${allocationResult.allocationNote}`,
            },
          });
        }
      }
    }

    // Create audit log if there were changes
    if (Object.keys(fieldChanges).length > 0) {
      await createAuditLog(prisma, {
        ledgerEntryId: entryId,
        caseId,
        action: AUDIT_ACTIONS.UPDATED,
        fieldChanges,
        userId: session.username,
      });

      // Mark aggregation as stale
      await markAggregationStale(prisma, caseId);
    }

    return NextResponse.json(serializeLedgerEntry(entry));
  } catch (error) {
    console.error('Error updating ledger entry:', error);
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren des Ledger-Eintrags' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/cases/[id]/ledger/[entryId] - Delete a LedgerEntry
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId, entryId } = await params;

    // Verify entry exists and belongs to case
    const existing = await prisma.ledgerEntry.findFirst({
      where: { id: entryId, caseId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Eintrag nicht gefunden' }, { status: 404 });
    }

    // Falls gepairt: Partner-Referenz aufräumen
    if (existing.transferPartnerEntryId) {
      await prisma.ledgerEntry.update({
        where: { id: existing.transferPartnerEntryId },
        data: { transferPartnerEntryId: null },
      }).catch(() => {
        // Partner könnte bereits gelöscht sein — ignorieren
      });
    }

    // Delete entry
    await prisma.ledgerEntry.delete({
      where: { id: entryId },
    });

    return NextResponse.json({ success: true, message: 'Eintrag gelöscht' });
  } catch (error) {
    console.error('Error deleting ledger entry:', error);
    return NextResponse.json(
      { error: 'Fehler beim Löschen des Ledger-Eintrags' },
      { status: 500 }
    );
  }
}
