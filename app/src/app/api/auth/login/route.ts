import { NextRequest, NextResponse } from "next/server";
import { createSession, validateCredentials } from "@/lib/auth";

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

    console.log("Login attempt for user:", username);

    const isValid = await validateCredentials(username, password);
    console.log("Credentials valid:", isValid);

    if (!isValid) {
      return NextResponse.json(
        { error: "Ungültige Anmeldedaten" },
        { status: 401 }
      );
    }

    console.log("Creating session...");
    await createSession(username);
    console.log("Session created successfully");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Login error:", error instanceof Error ? error.message : error);
    console.error("Login error stack:", error instanceof Error ? error.stack : "no stack");
    return NextResponse.json(
      { error: "Anmeldung fehlgeschlagen" },
      { status: 500 }
    );
  }
}
