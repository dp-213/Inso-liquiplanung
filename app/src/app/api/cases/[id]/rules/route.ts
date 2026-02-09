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
// GET /api/cases/[id]/rules - List all classification rules for a case
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
    const activeOnly = searchParams.get('activeOnly') === 'true';

    // Verify case exists
    const caseEntity = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseEntity) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    // Fetch rules
    const where: Record<string, unknown> = { caseId };
    if (activeOnly) {
      where.isActive = true;
    }

    const rules = await prisma.classificationRule.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({
      rules: rules.map(serializeRule),
      totalCount: rules.length,
    });
  } catch (error) {
    console.error('Error fetching classification rules:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Klassifikationsregeln' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/cases/[id]/rules - Create a new classification rule
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId } = await params;
    const body = await request.json();

    // Verify case exists
    const caseEntity = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseEntity) {
      return NextResponse.json({ error: 'Fall nicht gefunden' }, { status: 404 });
    }

    // Validate required fields
    const { name, matchField, matchType, matchValue } = body;

    if (!name || !matchField || !matchType || !matchValue) {
      return NextResponse.json(
        {
          error:
            'Pflichtfelder fehlen: name, matchField, matchType, matchValue',
        },
        { status: 400 }
      );
    }

    // Validate matchField
    if (!Object.values(MATCH_FIELDS).includes(matchField)) {
      return NextResponse.json(
        {
          error: `Ungültiges matchField. Erlaubt: ${Object.values(MATCH_FIELDS).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate matchType
    if (!Object.values(MATCH_TYPES).includes(matchType)) {
      return NextResponse.json(
        {
          error: `Ungültiger matchType. Erlaubt: ${Object.values(MATCH_TYPES).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate optional fields if provided
    if (
      body.suggestedFlowType &&
      !Object.values(FLOW_TYPES).includes(body.suggestedFlowType)
    ) {
      return NextResponse.json(
        { error: 'Ungültiger suggestedFlowType. Erlaubt: INFLOW, OUTFLOW' },
        { status: 400 }
      );
    }

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

    // Validate assignServiceDateRule if provided
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

    // At least one suggestion, dimension assignment, or service date rule should be provided
    const hasClassificationSuggestion =
      body.suggestedCategory ||
      body.suggestedFlowType ||
      body.suggestedLegalBucket;
    const hasDimensionAssignment =
      body.assignBankAccountId ||
      body.assignCounterpartyId ||
      body.assignLocationId;
    const hasServiceDateRule = body.assignServiceDateRule;

    if (!hasClassificationSuggestion && !hasDimensionAssignment && !hasServiceDateRule) {
      return NextResponse.json(
        {
          error:
            'Mindestens ein Zielfeld erforderlich: suggestedCategory, suggestedFlowType, suggestedLegalBucket, assignBankAccountId, assignCounterpartyId, assignLocationId oder assignServiceDateRule',
        },
        { status: 400 }
      );
    }

    // Create rule
    const rule = await prisma.classificationRule.create({
      data: {
        caseId,
        name: name.trim(),
        isActive: body.isActive !== false,
        priority: body.priority || 100,
        matchField,
        matchType,
        matchValue,
        suggestedCategory: body.suggestedCategory || null,
        suggestedFlowType: body.suggestedFlowType || null,
        suggestedLegalBucket: body.suggestedLegalBucket || null,
        confidenceBonus: body.confidenceBonus || 0,
        // Dimensions-Zuweisung
        assignBankAccountId: body.assignBankAccountId || null,
        assignCounterpartyId: body.assignCounterpartyId || null,
        assignLocationId: body.assignLocationId || null,
        // Service-Date-Regel (Phase C)
        assignServiceDateRule: body.assignServiceDateRule || null,
        createdBy: session.username,
        updatedBy: session.username,
      },
    });

    return NextResponse.json(serializeRule(rule), { status: 201 });
  } catch (error) {
    console.error('Error creating classification rule:', error);
    return NextResponse.json(
      { error: 'Fehler beim Erstellen der Klassifikationsregel' },
      { status: 500 }
    );
  }
}
