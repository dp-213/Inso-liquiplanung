/**
 * Import Jobs API
 *
 * GET /api/cases/[id]/import-jobs - Liste aller Import-Jobs für einen Fall
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export interface ImportJob {
  importJobId: string;
  importSource: string | null;
  entryCount: number;
  totalAmountCents: string;
  firstEntryDate: string;
  lastEntryDate: string;
  createdAt: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { id: caseId } = await params;

    // Verify case exists
    const caseEntity = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseEntity) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    // Get all unique import jobs with aggregated data
    const importJobsRaw = await prisma.ledgerEntry.groupBy({
      by: ['importJobId', 'importSource'],
      where: {
        caseId,
        importJobId: { not: null },
      },
      _count: { id: true },
      _sum: { amountCents: true },
      _min: { transactionDate: true, createdAt: true },
      _max: { transactionDate: true },
    });

    // Transform to response format
    const importJobs: ImportJob[] = importJobsRaw
      .filter((job) => job.importJobId !== null)
      .map((job) => ({
        importJobId: job.importJobId!,
        importSource: job.importSource,
        entryCount: job._count.id,
        totalAmountCents: (job._sum.amountCents || BigInt(0)).toString(),
        firstEntryDate: job._min.transactionDate?.toISOString() || '',
        lastEntryDate: job._max.transactionDate?.toISOString() || '',
        createdAt: job._min.createdAt?.toISOString() || '',
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      importJobs,
      totalCount: importJobs.length,
    });
  } catch (error) {
    console.error('Fehler beim Laden der Import-Jobs:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Import-Jobs' },
      { status: 500 }
    );
  }
}
