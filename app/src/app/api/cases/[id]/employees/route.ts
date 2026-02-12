import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/cases/[id]/employees - Alle Mitarbeiter eines Falls abrufen
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

    const employees = await prisma.employee.findMany({
      where: { caseId },
      include: {
        location: { select: { id: true, name: true, shortName: true } },
        salaryMonths: {
          orderBy: [{ year: "asc" }, { month: "asc" }],
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    // BigInt → string für JSON-Serialisierung
    const serialized = employees.map((emp) => ({
      ...emp,
      salaryMonths: emp.salaryMonths.map((sm) => ({
        ...sm,
        grossSalaryCents: sm.grossSalaryCents.toString(),
        netSalaryCents: sm.netSalaryCents?.toString() ?? null,
        employerCostsCents: sm.employerCostsCents?.toString() ?? null,
      })),
    }));

    return NextResponse.json({
      caseId,
      employees: serialized,
    });
  } catch (error) {
    console.error("Error fetching employees:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Mitarbeiter" },
      { status: 500 }
    );
  }
}

// POST /api/cases/[id]/employees - Neuen Mitarbeiter erstellen
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
      personnelNumber, lastName, firstName, role, lanr,
      locationId, svNumber, taxId, dateOfBirth, entryDate,
      street, houseNumber, postalCode, city, isActive, notes,
      salaryMonths,
    } = body;

    if (!lastName?.trim() || !firstName?.trim()) {
      return NextResponse.json(
        { error: "Vor- und Nachname sind erforderlich" },
        { status: 400 }
      );
    }

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseData) {
      return NextResponse.json(
        { error: "Fall nicht gefunden" },
        { status: 404 }
      );
    }

    const employee = await prisma.employee.create({
      data: {
        caseId,
        personnelNumber: personnelNumber?.trim() || null,
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        role: role?.trim() || null,
        lanr: lanr?.trim() || null,
        locationId: locationId || null,
        svNumber: svNumber?.trim() || null,
        taxId: taxId?.trim() || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        entryDate: entryDate ? new Date(entryDate) : null,
        street: street?.trim() || null,
        houseNumber: houseNumber?.trim() || null,
        postalCode: postalCode?.trim() || null,
        city: city?.trim() || null,
        isActive: isActive !== undefined ? isActive : true,
        notes: notes?.trim() || null,
        ...(salaryMonths && salaryMonths.length > 0
          ? {
              salaryMonths: {
                create: salaryMonths.map((sm: { year: number; month: number; grossSalaryCents: number; netSalaryCents?: number; employerCostsCents?: number; notes?: string }) => ({
                  year: sm.year,
                  month: sm.month,
                  grossSalaryCents: BigInt(sm.grossSalaryCents),
                  netSalaryCents: sm.netSalaryCents !== undefined ? BigInt(sm.netSalaryCents) : null,
                  employerCostsCents: sm.employerCostsCents !== undefined ? BigInt(sm.employerCostsCents) : null,
                  notes: sm.notes || null,
                })),
              },
            }
          : {}),
      },
      include: {
        location: { select: { id: true, name: true, shortName: true } },
        salaryMonths: true,
      },
    });

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

    return NextResponse.json(serialized, { status: 201 });
  } catch (error) {
    console.error("Error creating employee:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Mitarbeiters" },
      { status: 500 }
    );
  }
}
