import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

interface RouteProps {
  params: Promise<{
    id: string;
    orderId: string;
  }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  try {
    const session = await requireAuth().catch(() => null);
    const { id: caseId, orderId } = await params;

    if (!session?.isAdmin) {
      const { getCustomerSession, checkCaseAccess } = await import("@/lib/customer-auth");
      const customerSession = await getCustomerSession();
      if (!customerSession) {
        return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
      }
      const access = await checkCaseAccess(customerSession.customerId, caseId);
      if (!access.hasAccess) {
        return NextResponse.json({ error: "Zugriff verweigert" }, { status: 403 });
      }
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId, caseId },
      select: {
        documentContent: true,
        documentName: true,
        documentMimeType: true,
      },
    });

    if (!order || !order.documentContent || !order.documentName) {
      return NextResponse.json(
        { error: "Kein Dokument vorhanden" },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(order.documentContent, "base64");

    // Dateiname bereinigen (RFC 5987 / Header-Injection verhindern)
    const safeName = order.documentName.replace(/["\\\n\r]/g, "_");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": order.documentMimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("[Document Download Error]", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
