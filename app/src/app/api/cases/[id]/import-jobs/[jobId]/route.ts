/**
 * Import Job Detail API
 *
 * DELETE /api/cases/[id]/import-jobs/[jobId] - Löscht alle Entries eines Imports
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { markAggregationStale } from '@/lib/ledger';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { id: caseId, jobId: importJobId } = await params;

    // Verify case exists
    const caseEntity = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseEntity) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    // Count entries to be deleted
    const entryCount = await prisma.ledgerEntry.count({
      where: {
        caseId,
        importJobId,
      },
    });

    if (entryCount === 0) {
      return NextResponse.json(
        { error: 'Keine Einträge für diesen Import gefunden' },
        { status: 404 }
      );
    }

    // Get import source for response message
    const sampleEntry = await prisma.ledgerEntry.findFirst({
      where: { caseId, importJobId },
      select: { importSource: true },
    });

    // Delete all entries from this import
    const result = await prisma.ledgerEntry.deleteMany({
      where: {
        caseId,
        importJobId,
      },
    });

    // Mark aggregation as stale
    await markAggregationStale(prisma, caseId);

    console.log(
      `[Import Delete] User ${session.username} deleted ${result.count} entries from import ${importJobId} (${sampleEntry?.importSource})`
    );

    return NextResponse.json({
      success: true,
      message: `${result.count} Einträge aus Import "${sampleEntry?.importSource || importJobId}" gelöscht`,
      deletedCount: result.count,
      importJobId,
      importSource: sampleEntry?.importSource,
    });
  } catch (error) {
    console.error('Fehler beim Löschen des Imports:', error);
    return NextResponse.json(
      { error: 'Fehler beim Löschen des Imports' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { id: caseId, jobId: importJobId } = await params;

    // Get all entries from this import
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        caseId,
        importJobId,
      },
      orderBy: { transactionDate: 'asc' },
    });

    if (entries.length === 0) {
      return NextResponse.json(
        { error: 'Keine Einträge für diesen Import gefunden' },
        { status: 404 }
      );
    }

    // Calculate stats
    const totalInflows = entries
      .filter((e) => e.amountCents >= 0)
      .reduce((sum, e) => sum + e.amountCents, BigInt(0));
    const totalOutflows = entries
      .filter((e) => e.amountCents < 0)
      .reduce((sum, e) => sum + e.amountCents, BigInt(0));

    return NextResponse.json({
      importJobId,
      importSource: entries[0].importSource,
      entryCount: entries.length,
      totalInflows: totalInflows.toString(),
      totalOutflows: totalOutflows.toString(),
      netAmount: (totalInflows + totalOutflows).toString(),
      firstEntryDate: entries[0].transactionDate.toISOString(),
      lastEntryDate: entries[entries.length - 1].transactionDate.toISOString(),
      createdAt: entries[0].createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Fehler beim Laden des Import-Jobs:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden des Import-Jobs' },
      { status: 500 }
    );
  }
}
