import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    env: {
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
      DATABASE_URL_PREFIX: process.env.DATABASE_URL?.substring(0, 20) + "...",
      TURSO_AUTH_TOKEN_SET: !!process.env.TURSO_AUTH_TOKEN,
      NODE_ENV: process.env.NODE_ENV,
    },
  };

  try {
    diagnostics.step = "importing_prisma";
    const { default: prisma } = await import("@/lib/db");
    diagnostics.prismaImported = true;

    diagnostics.step = "testing_count";
    const count = await prisma.case.count();
    diagnostics.caseCount = count;

    diagnostics.step = "testing_findMany";
    const cases = await prisma.case.findMany({
      include: {
        owner: { select: { id: true, name: true, company: true } },
        plans: {
          where: { isActive: true },
          include: {
            versions: {
              orderBy: { versionNumber: "desc" },
              take: 1,
            },
          },
        },
        shareLinks: {
          where: { isActive: true },
          select: { id: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 1,
    });

    diagnostics.firstCase = cases[0] ? {
      id: cases[0].id,
      debtorName: cases[0].debtorName,
      updatedAt: cases[0].updatedAt,
      updatedAtType: typeof cases[0].updatedAt,
      updatedAtIsDate: cases[0].updatedAt instanceof Date,
      owner: cases[0].owner,
      ownerType: typeof cases[0].owner,
    } : null;

    // Test date rendering
    if (cases[0]?.updatedAt) {
      try {
        const dateStr = new Date(cases[0].updatedAt).toLocaleDateString("de-DE");
        diagnostics.dateRendering = { success: true, result: dateStr };
      } catch (e) {
        diagnostics.dateRendering = { success: false, error: String(e) };
      }
    }

    diagnostics.success = true;
    return NextResponse.json(diagnostics);
  } catch (error) {
    diagnostics.error = {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "Unknown",
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 5) : undefined,
    };
    diagnostics.success = false;

    return NextResponse.json(diagnostics, { status: 500 });
  }
}
