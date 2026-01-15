import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

// GET /api/cases/[id]/share - List share links for a case
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

    const shareLinks = await prisma.shareLink.findMany({
      where: { caseId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(shareLinks);
  } catch (error) {
    console.error("Error fetching share links:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Freigabelinks" },
      { status: 500 }
    );
  }
}

// POST /api/cases/[id]/share - Create a new share link
export async function POST(
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
    const { label, expiresAt } = body;

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString("hex");

    const shareLink = await prisma.shareLink.create({
      data: {
        caseId: id,
        token,
        label: label || "Externer Zugang",
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: session.username,
      },
    });

    // Generate the full URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const shareUrl = `${baseUrl}/view/${token}`;

    return NextResponse.json({
      ...shareLink,
      shareUrl,
    });
  } catch (error) {
    console.error("Error creating share link:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Freigabelinks" },
      { status: 500 }
    );
  }
}

// DELETE /api/cases/[id]/share - Deactivate a share link
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
    const linkId = searchParams.get("linkId");

    if (!linkId) {
      return NextResponse.json(
        { error: "Link-ID erforderlich" },
        { status: 400 }
      );
    }

    await prisma.shareLink.update({
      where: { id: linkId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deactivating share link:", error);
    return NextResponse.json(
      { error: "Fehler beim Deaktivieren des Freigabelinks" },
      { status: 500 }
    );
  }
}
