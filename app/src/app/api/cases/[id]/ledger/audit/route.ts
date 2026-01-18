import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  getCaseAuditLog,
  LedgerAuditLogResponse,
  AuditAction,
  AUDIT_ACTIONS,
  FieldChange,
} from '@/lib/ledger';

// =============================================================================
// GET /api/cases/[id]/ledger/audit - Get audit log for a case
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId } = await params;
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : 50;
    const offset = searchParams.get('offset')
      ? parseInt(searchParams.get('offset')!)
      : 0;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const action = searchParams.get('action') as AuditAction | null;

    // Validate action if provided
    if (action && !Object.values(AUDIT_ACTIONS).includes(action)) {
      return NextResponse.json(
        {
          error: `Ungültige Aktion. Erlaubt: ${Object.values(AUDIT_ACTIONS).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Verify case exists
    const caseEntity = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseEntity) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    // Get audit log
    const { logs, total } = await getCaseAuditLog(prisma, caseId, {
      limit,
      offset,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      action: action || undefined,
    });

    // Transform to response format
    const response: LedgerAuditLogResponse[] = logs.map((log) => ({
      id: log.id,
      ledgerEntryId: log.ledgerEntryId,
      caseId: log.caseId,
      action: log.action as AuditAction,
      fieldChanges: JSON.parse(log.fieldChanges) as Record<string, FieldChange>,
      reason: log.reason,
      userId: log.userId,
      timestamp: log.timestamp.toISOString(),
    }));

    return NextResponse.json({
      logs: response,
      totalCount: total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden des Audit-Logs' },
      { status: 500 }
    );
  }
}
