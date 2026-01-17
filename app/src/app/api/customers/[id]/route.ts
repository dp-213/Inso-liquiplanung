import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/customer-auth";
import crypto from "crypto";

function generateRandomPassword(): string {
  return crypto.randomBytes(12).toString("base64").slice(0, 12);
}

// GET /api/customers/[id] - Get customer details
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

    const customer = await prisma.customerUser.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        company: true,
        phone: true,
        logoUrl: true,
        isActive: true,
        emailVerified: true,
        lastLoginAt: true,
        loginCount: true,
        failedLoginCount: true,
        lockedUntil: true,
        createdAt: true,
        createdBy: true,
        updatedAt: true,
        updatedBy: true,
        ownedCases: {
          select: {
            id: true,
            caseNumber: true,
            debtorName: true,
            status: true,
            courtName: true,
            createdAt: true,
            plans: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                periodType: true,
                periodCount: true,
                planStartDate: true,
              },
              take: 1,
            },
          },
          orderBy: { createdAt: "desc" },
        },
        caseAccess: {
          include: {
            case: {
              select: {
                id: true,
                caseNumber: true,
                debtorName: true,
                status: true,
                owner: {
                  select: { id: true, name: true, company: true },
                },
              },
            },
          },
          orderBy: { grantedAt: "desc" },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Kunde nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Error fetching customer:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Kunden" },
      { status: 500 }
    );
  }
}

// PUT /api/customers/[id] - Update customer
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, company, phone, logoUrl, isActive, resetPassword } = body;

    // Check if customer exists
    const existingCustomer = await prisma.customerUser.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: "Kunde nicht gefunden" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: {
      name?: string;
      company?: string | null;
      phone?: string | null;
      logoUrl?: string | null;
      isActive?: boolean;
      passwordHash?: string;
      lockedUntil?: null;
      failedLoginCount?: number;
      updatedBy: string;
    } = {
      updatedBy: session.username,
    };

    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json(
          { error: "Name erforderlich" },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    if (company !== undefined) {
      updateData.company = company?.trim() || null;
    }

    if (phone !== undefined) {
      updateData.phone = phone?.trim() || null;
    }

    if (logoUrl !== undefined) {
      updateData.logoUrl = logoUrl?.trim() || null;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
      // If activating, also unlock the account
      if (isActive) {
        updateData.lockedUntil = null;
        updateData.failedLoginCount = 0;
      }
    }

    let temporaryPassword: string | undefined;

    if (resetPassword) {
      temporaryPassword = generateRandomPassword();
      updateData.passwordHash = await hashPassword(temporaryPassword);
      updateData.lockedUntil = null;
      updateData.failedLoginCount = 0;
    }

    const customer = await prisma.customerUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        company: true,
        phone: true,
        isActive: true,
        updatedAt: true,
      },
    });

    const response: { customer: typeof customer; temporaryPassword?: string } = { customer };
    if (temporaryPassword) {
      response.temporaryPassword = temporaryPassword;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error updating customer:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Kunden" },
      { status: 500 }
    );
  }
}

// DELETE /api/customers/[id] - Soft delete by default, hard delete with ?hardDelete=true
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get("hardDelete") === "true";
    const confirmDelete = searchParams.get("confirm");

    // Check if customer exists
    const existingCustomer = await prisma.customerUser.findUnique({
      where: { id },
      include: {
        ownedCases: { select: { id: true, debtorName: true } },
      },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: "Kunde nicht gefunden" },
        { status: 404 }
      );
    }

    if (hardDelete) {
      // Require confirmation for hard delete
      if (confirmDelete !== "PERMANENTLY_DELETE") {
        return NextResponse.json(
          { error: "Bestätigung erforderlich: confirm=PERMANENTLY_DELETE" },
          { status: 400 }
        );
      }

      // Check if customer has owned cases
      if (existingCustomer.ownedCases.length > 0) {
        return NextResponse.json(
          {
            error: `Kunde kann nicht gelöscht werden - besitzt noch ${existingCustomer.ownedCases.length} Fall/Fälle. Löschen Sie zuerst die Fälle oder weisen Sie sie einem anderen Kunden zu.`,
            ownedCases: existingCustomer.ownedCases,
          },
          { status: 400 }
        );
      }

      // Hard delete
      await prisma.$transaction(async (tx) => {
        // Delete all related data
        await tx.customerCaseAccess.deleteMany({
          where: { customerId: id },
        });
        await tx.customerSession.deleteMany({
          where: { customerId: id },
        });
        await tx.customerAuditLog.deleteMany({
          where: { customerId: id },
        });
        // Delete customer
        await tx.customerUser.delete({
          where: { id },
        });
      });

      return NextResponse.json({ success: true, deleted: true });
    }

    // Soft delete: deactivate customer and revoke all access
    await prisma.$transaction(async (tx) => {
      // Deactivate customer
      await tx.customerUser.update({
        where: { id },
        data: {
          isActive: false,
          updatedBy: session.username,
        },
      });

      // Revoke all active case access
      await tx.customerCaseAccess.updateMany({
        where: {
          customerId: id,
          isActive: true,
        },
        data: {
          isActive: false,
          revokedAt: new Date(),
          revokedBy: session.username,
          revokeReason: "Kunde deaktiviert",
        },
      });

      // Delete active sessions
      await tx.customerSession.deleteMany({
        where: { customerId: id },
      });
    });

    return NextResponse.json({ success: true, deactivated: true });
  } catch (error) {
    console.error("Error deleting customer:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des Kunden" },
      { status: 500 }
    );
  }
}
