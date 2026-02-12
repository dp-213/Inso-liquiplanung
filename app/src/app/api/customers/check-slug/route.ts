import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { validateSlug } from "@/lib/slug-utils";

// GET /api/customers/check-slug?slug=anchor
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const slug = request.nextUrl.searchParams.get("slug");
    if (!slug) {
      return NextResponse.json(
        { error: "slug Parameter erforderlich" },
        { status: 400 }
      );
    }

    const validation = validateSlug(slug);
    if (!validation.valid) {
      return NextResponse.json({
        available: false,
        error: validation.error,
      });
    }

    const existing = await prisma.customerUser.findUnique({
      where: { slug },
      select: { id: true },
    });

    return NextResponse.json({
      available: !existing,
      error: existing ? "Dieser Slug ist bereits vergeben" : undefined,
    });
  } catch (error) {
    console.error("Error checking slug:", error);
    return NextResponse.json(
      { error: "Fehler bei Slug-Prüfung" },
      { status: 500 }
    );
  }
}
