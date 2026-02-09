import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  ClassificationRuleResponse,
  MATCH_TYPES,
  MATCH_FIELDS,
  MatchType,
  MatchField,
  SERVICE_DATE_RULES,
  ServiceDateRule,
} from '@/lib/classification';
import { LEGAL_BUCKETS, FLOW_TYPES } from '@/lib/ledger';
import { ClassificationRule } from '@prisma/client';

/**
 * Serialize a ClassificationRule to ClassificationRuleResponse
 */
function serializeRule(rule: ClassificationRule): ClassificationRuleResponse {
  return {
    id: rule.id,
    caseId: rule.caseId,
    name: rule.name,
    isActive: rule.isActive,
    priority: rule.priority,
    matchField: rule.matchField as MatchField,
    matchType: rule.matchType as MatchType,
    matchValue: rule.matchValue,
    suggestedCategory: rule.suggestedCategory,
    suggestedFlowType: rule.suggestedFlowType as 'INFLOW' | 'OUTFLOW' | null,
    suggestedLegalBucket: rule.suggestedLegalBucket as 'MASSE' | 'ABSONDERUNG' | 'NEUTRAL' | 'UNKNOWN' | null,
    confidenceBonus: rule.confidenceBonus,
    // Dimensions-Zuweisung
    assignBankAccountId: rule.assignBankAccountId,
    assignCounterpartyId: rule.assignCounterpartyId,
    assignLocationId: rule.assignLocationId,
    // Service-Date-Regel (Phase C)
    assignServiceDateRule: rule.assignServiceDateRule as ServiceDateRule | null,
    createdAt: rule.createdAt.toISOString(),
    createdBy: rule.createdBy,
    updatedAt: rule.updatedAt.toISOString(),
    updatedBy: rule.updatedBy || rule.createdBy,
  };
}

// =============================================================================
// GET /api/cases/[id]/rules/[ruleId] - Get a single classification rule
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId, ruleId } = await params;

    const rule = await prisma.classificationRule.findFirst({
      where: { id: ruleId, caseId },
    });

    if (!rule) {
      return NextResponse.json(
        { error: 'Regel nicht gefunden' },
        { status: 404 }
      );
    }

    return NextResponse.json(serializeRule(rule));
  } catch (error) {
    console.error('Error fetching classification rule:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Klassifikationsregel' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT /api/cases/[id]/rules/[ruleId] - Update a classification rule
// =============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId, ruleId } = await params;
    const body = await request.json();

    // Verify rule exists
    const existing = await prisma.classificationRule.findFirst({
      where: { id: ruleId, caseId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Regel nicht gefunden' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedBy: session.username,
    };

    if (body.name !== undefined) {
      updateData.name = body.name.trim();
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    if (body.priority !== undefined) {
      updateData.priority = body.priority;
    }

    if (body.matchField !== undefined) {
      if (!Object.values(MATCH_FIELDS).includes(body.matchField)) {
        return NextResponse.json(
          {
            error: `Ungültiges matchField. Erlaubt: ${Object.values(MATCH_FIELDS).join(', ')}`,
          },
          { status: 400 }
        );
      }
      updateData.matchField = body.matchField;
    }

    if (body.matchType !== undefined) {
      if (!Object.values(MATCH_TYPES).includes(body.matchType)) {
        return NextResponse.json(
          {
            error: `Ungültiger matchType. Erlaubt: ${Object.values(MATCH_TYPES).join(', ')}`,
          },
          { status: 400 }
        );
      }
      updateData.matchType = body.matchType;
    }

    if (body.matchValue !== undefined) {
      updateData.matchValue = body.matchValue;
    }

    if (body.suggestedCategory !== undefined) {
      updateData.suggestedCategory = body.suggestedCategory || null;
    }

    if (body.suggestedFlowType !== undefined) {
      if (
        body.suggestedFlowType &&
        !Object.values(FLOW_TYPES).includes(body.suggestedFlowType)
      ) {
        return NextResponse.json(
          { error: 'Ungültiger suggestedFlowType. Erlaubt: INFLOW, OUTFLOW' },
          { status: 400 }
        );
      }
      updateData.suggestedFlowType = body.suggestedFlowType || null;
    }

    if (body.suggestedLegalBucket !== undefined) {
      if (
        body.suggestedLegalBucket &&
        !Object.values(LEGAL_BUCKETS).includes(body.suggestedLegalBucket)
      ) {
        return NextResponse.json(
          {
            error:
              'Ungültiger suggestedLegalBucket. Erlaubt: MASSE, ABSONDERUNG, NEUTRAL, UNKNOWN',
          },
          { status: 400 }
        );
      }
      updateData.suggestedLegalBucket = body.suggestedLegalBucket || null;
    }

    if (body.confidenceBonus !== undefined) {
      updateData.confidenceBonus = body.confidenceBonus;
    }

    // Dimensions-Zuweisung
    if (body.assignBankAccountId !== undefined) {
      updateData.assignBankAccountId = body.assignBankAccountId || null;
    }

    if (body.assignCounterpartyId !== undefined) {
      updateData.assignCounterpartyId = body.assignCounterpartyId || null;
    }

    if (body.assignLocationId !== undefined) {
      updateData.assignLocationId = body.assignLocationId || null;
    }

    // Service-Date-Regel (Phase C)
    if (body.assignServiceDateRule !== undefined) {
      if (
        body.assignServiceDateRule &&
        !Object.values(SERVICE_DATE_RULES).includes(body.assignServiceDateRule)
      ) {
        return NextResponse.json(
          {
            error: `Ungültige Service-Date-Regel. Erlaubt: ${Object.values(SERVICE_DATE_RULES).join(', ')}`,
          },
          { status: 400 }
        );
      }
      updateData.assignServiceDateRule = body.assignServiceDateRule || null;
    }

    // Update rule
    const rule = await prisma.classificationRule.update({
      where: { id: ruleId },
      data: updateData,
    });

    return NextResponse.json(serializeRule(rule));
  } catch (error) {
    console.error('Error updating classification rule:', error);
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren der Klassifikationsregel' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/cases/[id]/rules/[ruleId] - Delete a classification rule
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId, ruleId } = await params;

    // Verify rule exists
    const existing = await prisma.classificationRule.findFirst({
      where: { id: ruleId, caseId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Regel nicht gefunden' },
        { status: 404 }
      );
    }

    // Delete rule
    await prisma.classificationRule.delete({
      where: { id: ruleId },
    });

    return NextResponse.json({ success: true, message: 'Regel gelöscht' });
  } catch (error) {
    console.error('Error deleting classification rule:', error);
    return NextResponse.json(
      { error: 'Fehler beim Löschen der Klassifikationsregel' },
      { status: 500 }
    );
  }
}
