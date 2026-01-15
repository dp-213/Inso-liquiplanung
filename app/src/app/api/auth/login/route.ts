import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SignJWT } from "jose";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "InsolvencyAdmin2026!";
const SESSION_SECRET = process.env.SESSION_SECRET || "insolvency-liquidity-secret-key-32chars!";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Benutzername und Passwort erforderlich" },
        { status: 400 }
      );
    }

    // Validate credentials
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Ungültige Anmeldedaten" },
        { status: 401 }
      );
    }

    // Create JWT token
    const secretKey = new TextEncoder().encode(SESSION_SECRET);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const token = await new SignJWT({
      userId: "admin",
      username,
      isAdmin: true,
      expiresAt: expiresAt.toISOString(),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(secretKey);

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set("session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Anmeldung fehlgeschlagen: " + (error instanceof Error ? error.message : "Unbekannt") },
      { status: 500 }
    );
  }
}
