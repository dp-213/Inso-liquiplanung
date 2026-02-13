import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

interface RouteProps {
  params: Promise<{ id: string }>;
}

// GET – Alle ApprovalRules für einen Case
export async function GET(_req: NextRequest, { params }: RouteProps) {
  try {
    await requireAuth();
    const { id: caseId } = await params;

    const rules = await prisma.approvalRule.findMany({
      where: { caseId, isActive: true },
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { sequence: "asc" },
    });

    const serialized = JSON.parse(
      JSON.stringify(rules, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("[ApprovalRules GET]", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// POST – Neue ApprovalRule erstellen
export async function POST(req: NextRequest, { params }: RouteProps) {
  try {
    await requireAuth();
    const { id: caseId } = await params;

    const body = await req.json();
    const { roleName, customerId, thresholdCents, sequence, isRequired } = body;

    if (!roleName || !customerId || thresholdCents === undefined || sequence === undefined) {
      return NextResponse.json(
        { error: "Pflichtfelder: roleName, customerId, thresholdCents, sequence" },
        { status: 400 }
      );
    }

    // Prüfe: customerId hat Case-Zugang
    const { checkCaseAccess } = await import("@/lib/customer-auth");
    const access = await checkCaseAccess(customerId, caseId);
    if (!access.hasAccess) {
      return NextResponse.json(
        { error: "Der ausgewählte Kunde hat keinen Zugriff auf diesen Fall" },
        { status: 400 }
      );
    }

    // Lade bestehende aktive Rules
    const existingRules = await prisma.approvalRule.findMany({
      where: { caseId, isActive: true },
      orderBy: { sequence: "asc" },
    });

    // Prüfe: Sequence-Duplikat
    if (existingRules.some((r) => r.sequence === sequence)) {
      return NextResponse.json(
        { error: `Sequenz ${sequence} ist bereits vergeben` },
        { status: 400 }
      );
    }

    // Prüfe: Threshold muss aufsteigend mit Sequence sein
    const seqBigThreshold = BigInt(thresholdCents);
    for (const r of existingRules) {
      if (r.sequence < sequence && r.thresholdCents > seqBigThreshold) {
        return NextResponse.json(
          { error: `Schwellwert muss >= Stufe ${r.sequence} (${r.thresholdCents} Cent) sein` },
          { status: 400 }
        );
      }
      if (r.sequence > sequence && r.thresholdCents < seqBigThreshold) {
        return NextResponse.json(
          { error: `Schwellwert muss <= Stufe ${r.sequence} (${r.thresholdCents} Cent) sein` },
          { status: 400 }
        );
      }
    }

    // Warnung: Laufende PENDING Orders mit Steps
    const pendingWithSteps = await prisma.order.count({
      where: { caseId, status: "PENDING", approvalSteps: { some: {} } },
    });

    const rule = await prisma.approvalRule.create({
      data: {
        caseId,
        roleName,
        customerId,
        thresholdCents: seqBigThreshold,
        sequence,
        isRequired: isRequired !== false,
      },
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    const serialized = JSON.parse(
      JSON.stringify(rule, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return NextResponse.json({
      ...serialized,
      warning: pendingWithSteps > 0
        ? `${pendingWithSteps} laufende Anfragen sind von dieser Änderung nicht betroffen.`
        : undefined,
    });
  } catch (error) {
    console.error("[ApprovalRules POST]", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// PUT – ApprovalRule aktualisieren
export async function PUT(req: NextRequest, { params }: RouteProps) {
  try {
    await requireAuth();
    const { id: caseId } = await params;

    const body = await req.json();
    const { ruleId, roleName, customerId, thresholdCents, sequence, isRequired } = body;

    if (!ruleId) {
      return NextResponse.json({ error: "ruleId ist Pflicht" }, { status: 400 });
    }

    const existing = await prisma.approvalRule.findFirst({
      where: { id: ruleId, caseId, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Regel nicht gefunden" }, { status: 404 });
    }

    // Bei customerId-Änderung: Case-Zugang prüfen
    if (customerId && customerId !== existing.customerId) {
      const { checkCaseAccess } = await import("@/lib/customer-auth");
      const access = await checkCaseAccess(customerId, caseId);
      if (!access.hasAccess) {
        return NextResponse.json(
          { error: "Der ausgewählte Kunde hat keinen Zugriff auf diesen Fall" },
          { status: 400 }
        );
      }
    }

    // Validierung: Sequence und Threshold aufsteigend
    const newSequence = sequence !== undefined ? sequence : existing.sequence;
    const newThreshold = thresholdCents !== undefined ? BigInt(thresholdCents) : existing.thresholdCents;

    const otherRules = await prisma.approvalRule.findMany({
      where: { caseId, isActive: true, id: { not: ruleId } },
      orderBy: { sequence: "asc" },
    });

    if (otherRules.some((r) => r.sequence === newSequence)) {
      return NextResponse.json(
        { error: `Sequenz ${newSequence} ist bereits vergeben` },
        { status: 400 }
      );
    }

    for (const r of otherRules) {
      if (r.sequence < newSequence && r.thresholdCents > newThreshold) {
        return NextResponse.json(
          { error: `Schwellwert muss >= Stufe ${r.sequence} sein` },
          { status: 400 }
        );
      }
      if (r.sequence > newSequence && r.thresholdCents < newThreshold) {
        return NextResponse.json(
          { error: `Schwellwert muss <= Stufe ${r.sequence} sein` },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (roleName !== undefined) updateData.roleName = roleName;
    if (customerId !== undefined) updateData.customerId = customerId;
    if (thresholdCents !== undefined) updateData.thresholdCents = BigInt(thresholdCents);
    if (sequence !== undefined) updateData.sequence = sequence;
    if (isRequired !== undefined) updateData.isRequired = isRequired;

    const updated = await prisma.approvalRule.update({
      where: { id: ruleId },
      data: updateData,
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    const serialized = JSON.parse(
      JSON.stringify(updated, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("[ApprovalRules PUT]", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// DELETE – ApprovalRule deaktivieren (Soft-Delete)
export async function DELETE(req: NextRequest, { params }: RouteProps) {
  try {
    await requireAuth();
    const { id: caseId } = await params;

    const { searchParams } = new URL(req.url);
    const ruleId = searchParams.get("ruleId");

    if (!ruleId) {
      return NextResponse.json({ error: "ruleId ist Pflicht" }, { status: 400 });
    }

    const existing = await prisma.approvalRule.findFirst({
      where: { id: ruleId, caseId, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Regel nicht gefunden" }, { status: 404 });
    }

    await prisma.approvalRule.update({
      where: { id: ruleId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ApprovalRules DELETE]", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
