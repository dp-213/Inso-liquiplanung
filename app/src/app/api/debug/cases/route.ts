import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// DEBUG Route - NO AUTH CHECK
export async function GET() {
  try {
    console.log("=== DEBUG: Fetching cases ===");

    const cases = await prisma.case.findMany({
      include: {
        owner: {
          select: { id: true, name: true, email: true, company: true },
        },
        plans: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            periodType: true,
            periodCount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`=== DEBUG: Found ${cases.length} cases ===`);
    console.log(JSON.stringify(cases, null, 2));

    return NextResponse.json({
      success: true,
      count: cases.length,
      cases,
    });
  } catch (error: any) {
    console.error("=== DEBUG ERROR ===", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
