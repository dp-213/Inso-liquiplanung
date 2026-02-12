import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/cases/[id]/employees/[employeeId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; employeeId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId, employeeId } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        location: { select: { id: true, name: true, shortName: true } },
        salaryMonths: {
          orderBy: [{ year: "asc" }, { month: "asc" }],
        },
      },
    });

    if (!employee || employee.caseId !== caseId) {
      return NextResponse.json(
        { error: "Mitarbeiter nicht gefunden" },
        { status: 404 }
      );
    }

    // BigInt → string für JSON-Serialisierung
    const serialized = {
      ...employee,
      salaryMonths: employee.salaryMonths.map((sm) => ({
        ...sm,
        grossSalaryCents: sm.grossSalaryCents.toString(),
        netSalaryCents: sm.netSalaryCents?.toString() ?? null,
        employerCostsCents: sm.employerCostsCents?.toString() ?? null,
      })),
    };

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Error fetching employee:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Mitarbeiters" },
      { status: 500 }
    );
  }
}

// PUT /api/cases/[id]/employees/[employeeId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; employeeId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId, employeeId } = await params;
    const body = await request.json();

    const existing = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!existing || existing.caseId !== caseId) {
      return NextResponse.json(
        { error: "Mitarbeiter nicht gefunden" },
        { status: 404 }
      );
    }

    const {
      personnelNumber, lastName, firstName, role, lanr,
      locationId, svNumber, taxId, dateOfBirth, entryDate,
      street, houseNumber, postalCode, city, isActive, notes,
      salaryMonths,
    } = body;

    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        personnelNumber: personnelNumber !== undefined ? (personnelNumber?.trim() || null) : undefined,
        lastName: lastName?.trim() || existing.lastName,
        firstName: firstName?.trim() || existing.firstName,
        role: role !== undefined ? (role?.trim() || null) : undefined,
        lanr: lanr !== undefined ? (lanr?.trim() || null) : undefined,
        locationId: locationId !== undefined ? (locationId || null) : undefined,
        svNumber: svNumber !== undefined ? (svNumber?.trim() || null) : undefined,
        taxId: taxId !== undefined ? (taxId?.trim() || null) : undefined,
        dateOfBirth: dateOfBirth !== undefined ? (dateOfBirth ? new Date(dateOfBirth) : null) : undefined,
        entryDate: entryDate !== undefined ? (entryDate ? new Date(entryDate) : null) : undefined,
        street: street !== undefined ? (street?.trim() || null) : undefined,
        houseNumber: houseNumber !== undefined ? (houseNumber?.trim() || null) : undefined,
        postalCode: postalCode !== undefined ? (postalCode?.trim() || null) : undefined,
        city: city !== undefined ? (city?.trim() || null) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        notes: notes !== undefined ? (notes?.trim() || null) : undefined,
      },
      include: {
        location: { select: { id: true, name: true, shortName: true } },
        salaryMonths: {
          orderBy: [{ year: "asc" }, { month: "asc" }],
        },
      },
    });

    // Update salary months if provided
    if (salaryMonths && Array.isArray(salaryMonths)) {
      for (const sm of salaryMonths) {
        await prisma.employeeSalaryMonth.upsert({
          where: {
            employeeId_year_month: {
              employeeId,
              year: sm.year,
              month: sm.month,
            },
          },
          create: {
            employeeId,
            year: sm.year,
            month: sm.month,
            grossSalaryCents: BigInt(sm.grossSalaryCents),
            netSalaryCents: sm.netSalaryCents !== undefined ? BigInt(sm.netSalaryCents) : null,
            employerCostsCents: sm.employerCostsCents !== undefined ? BigInt(sm.employerCostsCents) : null,
            notes: sm.notes || null,
          },
          update: {
            grossSalaryCents: BigInt(sm.grossSalaryCents),
            netSalaryCents: sm.netSalaryCents !== undefined ? BigInt(sm.netSalaryCents) : null,
            employerCostsCents: sm.employerCostsCents !== undefined ? BigInt(sm.employerCostsCents) : null,
            notes: sm.notes || null,
          },
        });
      }
    }

    // Refetch with updated salary months
    const result = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        location: { select: { id: true, name: true, shortName: true } },
        salaryMonths: {
          orderBy: [{ year: "asc" }, { month: "asc" }],
        },
      },
    });

    // BigInt → string für JSON-Serialisierung
    const serialized = result ? {
      ...result,
      salaryMonths: result.salaryMonths.map((sm) => ({
        ...sm,
        grossSalaryCents: sm.grossSalaryCents.toString(),
        netSalaryCents: sm.netSalaryCents?.toString() ?? null,
        employerCostsCents: sm.employerCostsCents?.toString() ?? null,
      })),
    } : null;

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Error updating employee:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Mitarbeiters" },
      { status: 500 }
    );
  }
}

// DELETE /api/cases/[id]/employees/[employeeId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; employeeId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId, employeeId } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee || employee.caseId !== caseId) {
      return NextResponse.json(
        { error: "Mitarbeiter nicht gefunden" },
        { status: 404 }
      );
    }

    await prisma.employee.delete({
      where: { id: employeeId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting employee:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des Mitarbeiters" },
      { status: 500 }
    );
  }
}
