import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/customer-auth";
import crypto from "crypto";

function generateRandomPassword(): string {
  return crypto.randomBytes(12).toString("base64").slice(0, 12);
}

// GET /api/customers - List all customers
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const isActiveFilter = searchParams.get("isActive");

    const whereClause = isActiveFilter !== null
      ? { isActive: isActiveFilter === "true" }
      : {};

    const customers = await prisma.customerUser.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        company: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        loginCount: true,
        createdAt: true,
        _count: {
          select: {
            caseAccess: {
              where: { isActive: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(customers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Kunden" },
      { status: 500 }
    );
  }
}

// POST /api/customers - Create a new customer
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { email, name, company, phone } = body;

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: "E-Mail-Adresse erforderlich" },
        { status: 400 }
      );
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Name erforderlich" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingCustomer = await prisma.customerUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingCustomer) {
      return NextResponse.json(
        { error: "Ein Kunde mit dieser E-Mail-Adresse existiert bereits" },
        { status: 400 }
      );
    }

    // Generate random password
    const temporaryPassword = generateRandomPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const customer = await prisma.customerUser.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        company: company?.trim() || null,
        phone: phone?.trim() || null,
        passwordHash,
        isActive: true,
        emailVerified: false,
        createdBy: session.username,
        updatedBy: session.username,
      },
      select: {
        id: true,
        email: true,
        name: true,
        company: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { customer, temporaryPassword },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating customer:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Kunden" },
      { status: 500 }
    );
  }
}
