import { NextRequest, NextResponse } from "next/server";
import {
  validateCustomerCredentials,
  createCustomerSession,
} from "@/lib/customer-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-Mail und Passwort sind erforderlich" },
        { status: 400 }
      );
    }

    // Get client info for logging
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    const result = await validateCustomerCredentials(
      email,
      password,
      ipAddress,
      userAgent
    );

    if (!result.success || !result.customer) {
      return NextResponse.json(
        { error: result.error || "Anmeldung fehlgeschlagen" },
        { status: 401 }
      );
    }

    // Create session
    await createCustomerSession(result.customer, ipAddress, userAgent);

    return NextResponse.json({
      success: true,
      user: {
        name: result.customer.name,
        email: result.customer.email,
        company: result.customer.company,
      },
    });
  } catch (error) {
    console.error("Customer login error:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten" },
      { status: 500 }
    );
  }
}
