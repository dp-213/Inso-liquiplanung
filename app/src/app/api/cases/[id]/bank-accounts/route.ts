import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/cases/[id]/bank-accounts - Get all bank accounts for a case
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId } = await params;

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        bankAccounts: {
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    if (!caseData) {
      return NextResponse.json(
        { error: "Fall nicht gefunden" },
        { status: 404 }
      );
    }

    // Calculate totals
    const totalBalance = caseData.bankAccounts.reduce(
      (sum, acc) => sum + acc.balanceCents,
      BigInt(0)
    );
    const totalAvailable = caseData.bankAccounts.reduce(
      (sum, acc) => sum + acc.availableCents,
      BigInt(0)
    );

    return NextResponse.json({
      caseId: caseData.id,
      accounts: caseData.bankAccounts.map((acc) => ({
        ...acc,
        balanceCents: acc.balanceCents.toString(),
        availableCents: acc.availableCents.toString(),
      })),
      summary: {
        totalBalanceCents: totalBalance.toString(),
        totalAvailableCents: totalAvailable.toString(),
        accountCount: caseData.bankAccounts.length,
      },
    });
  } catch (error) {
    console.error("Error fetching bank accounts:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Bankkonten" },
      { status: 500 }
    );
  }
}

// POST /api/cases/[id]/bank-accounts - Create a new bank account
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
    const {
      bankName,
      accountName,
      iban,
      balanceCents,
      availableCents,
      securityHolder,
      status,
      notes,
      displayOrder,
    } = body;

    // Validate required fields
    if (!bankName || !accountName || balanceCents === undefined) {
      return NextResponse.json(
        { error: "Erforderliche Felder: bankName, accountName, balanceCents" },
        { status: 400 }
      );
    }

    // Verify case exists
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseData) {
      return NextResponse.json(
        { error: "Fall nicht gefunden" },
        { status: 404 }
      );
    }

    // Validate status
    const validStatuses = ["available", "blocked", "restricted"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status muss einer der folgenden Werte sein: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Get max displayOrder for this case
    const maxOrder = await prisma.bankAccount.aggregate({
      where: { caseId },
      _max: { displayOrder: true },
    });

    const account = await prisma.bankAccount.create({
      data: {
        caseId,
        bankName: bankName.trim(),
        accountName: accountName.trim(),
        iban: iban?.trim() || null,
        balanceCents: BigInt(balanceCents),
        availableCents: BigInt(availableCents ?? balanceCents),
        securityHolder: securityHolder?.trim() || null,
        status: status || "available",
        notes: notes?.trim() || null,
        displayOrder: displayOrder ?? (maxOrder._max.displayOrder ?? 0) + 1,
        createdBy: session.username,
        updatedBy: session.username,
      },
    });

    return NextResponse.json({
      success: true,
      account: {
        ...account,
        balanceCents: account.balanceCents.toString(),
        availableCents: account.availableCents.toString(),
      },
    });
  } catch (error) {
    console.error("Error creating bank account:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Bankkontos" },
      { status: 500 }
    );
  }
}

// PUT /api/cases/[id]/bank-accounts - Update a bank account
export async function PUT(
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
    const {
      accountId,
      bankName,
      accountName,
      iban,
      balanceCents,
      availableCents,
      securityHolder,
      status,
      notes,
      displayOrder,
    } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId ist erforderlich" },
        { status: 400 }
      );
    }

    // Verify account exists and belongs to this case
    const existingAccount = await prisma.bankAccount.findUnique({
      where: { id: accountId },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: "Bankkonto nicht gefunden" },
        { status: 404 }
      );
    }

    if (existingAccount.caseId !== caseId) {
      return NextResponse.json(
        { error: "Bankkonto gehört nicht zu diesem Fall" },
        { status: 403 }
      );
    }

    // Validate status if provided
    const validStatuses = ["available", "blocked", "restricted"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status muss einer der folgenden Werte sein: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const account = await prisma.bankAccount.update({
      where: { id: accountId },
      data: {
        ...(bankName && { bankName: bankName.trim() }),
        ...(accountName && { accountName: accountName.trim() }),
        ...(iban !== undefined && { iban: iban?.trim() || null }),
        ...(balanceCents !== undefined && { balanceCents: BigInt(balanceCents) }),
        ...(availableCents !== undefined && { availableCents: BigInt(availableCents) }),
        ...(securityHolder !== undefined && { securityHolder: securityHolder?.trim() || null }),
        ...(status && { status }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(displayOrder !== undefined && { displayOrder }),
        updatedBy: session.username,
      },
    });

    return NextResponse.json({
      success: true,
      account: {
        ...account,
        balanceCents: account.balanceCents.toString(),
        availableCents: account.availableCents.toString(),
      },
    });
  } catch (error) {
    console.error("Error updating bank account:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Bankkontos" },
      { status: 500 }
    );
  }
}

// DELETE /api/cases/[id]/bank-accounts - Delete a bank account
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId } = await params;
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId ist erforderlich" },
        { status: 400 }
      );
    }

    // Verify account exists and belongs to this case
    const existingAccount = await prisma.bankAccount.findUnique({
      where: { id: accountId },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: "Bankkonto nicht gefunden" },
        { status: 404 }
      );
    }

    if (existingAccount.caseId !== caseId) {
      return NextResponse.json(
        { error: "Bankkonto gehört nicht zu diesem Fall" },
        { status: 403 }
      );
    }

    await prisma.bankAccount.delete({
      where: { id: accountId },
    });

    return NextResponse.json({
      success: true,
      message: "Bankkonto gelöscht",
    });
  } catch (error) {
    console.error("Error deleting bank account:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des Bankkontos" },
      { status: 500 }
    );
  }
}
