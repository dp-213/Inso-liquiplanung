import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/cases/[id]/customers - List customers with access to this case
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const customerAccess = await prisma.customerCaseAccess.findMany({
      where: { caseId: id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
            isActive: true,
          },
        },
      },
      orderBy: { grantedAt: "desc" },
    });

    return NextResponse.json(customerAccess);
  } catch (error) {
    console.error("Error fetching customer access:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Kundenzugaenge" },
      { status: 500 }
    );
  }
}

// POST /api/cases/[id]/customers - Grant customer access to this case
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId } = await params;
    const body = await request.json();
    const { customerId, accessLevel, expiresAt } = body;

    if (!customerId) {
      return NextResponse.json(
        { error: "Kunde muss ausgewählt werden" },
        { status: 400 }
      );
    }

    // Validate access level
    const validAccessLevels = ["VIEW", "COMMENT", "DOWNLOAD"];
    if (accessLevel && !validAccessLevels.includes(accessLevel)) {
      return NextResponse.json(
        { error: "Ungueltiges Zugriffslevel" },
        { status: 400 }
      );
    }

    // Check if customer exists
    const customer = await prisma.customerUser.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Kunde nicht gefunden" },
        { status: 404 }
      );
    }

    // Check if case exists
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseRecord) {
      return NextResponse.json(
        { error: "Fall nicht gefunden" },
        { status: 404 }
      );
    }

    // Check if access already exists
    const existingAccess = await prisma.customerCaseAccess.findUnique({
      where: {
        customerId_caseId: {
          customerId,
          caseId,
        },
      },
    });

    if (existingAccess) {
      if (existingAccess.isActive) {
        return NextResponse.json(
          { error: "Dieser Kunde hat bereits Zugriff auf diesen Fall" },
          { status: 400 }
        );
      }

      // Reactivate existing access
      const reactivatedAccess = await prisma.customerCaseAccess.update({
        where: { id: existingAccess.id },
        data: {
          isActive: true,
          accessLevel: accessLevel || "VIEW",
          grantedBy: session.username,
          grantedAt: new Date(),
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          revokedAt: null,
          revokedBy: null,
          revokeReason: null,
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              company: true,
              isActive: true,
            },
          },
        },
      });

      return NextResponse.json(reactivatedAccess, { status: 201 });
    }

    // Create new access
    const access = await prisma.customerCaseAccess.create({
      data: {
        customerId,
        caseId,
        accessLevel: accessLevel || "VIEW",
        grantedBy: session.username,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
            isActive: true,
          },
        },
      },
    });

    return NextResponse.json(access, { status: 201 });
  } catch (error) {
    console.error("Error creating customer access:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Kundenzugangs" },
      { status: 500 }
    );
  }
}

// DELETE /api/cases/[id]/customers - Revoke customer access
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accessId = searchParams.get("accessId");

    if (!accessId) {
      return NextResponse.json(
        { error: "Zugangs-ID erforderlich" },
        { status: 400 }
      );
    }

    await prisma.customerCaseAccess.update({
      where: { id: accessId },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedBy: session.username,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking customer access:", error);
    return NextResponse.json(
      { error: "Fehler beim Widerrufen des Kundenzugangs" },
      { status: 500 }
    );
  }
}
