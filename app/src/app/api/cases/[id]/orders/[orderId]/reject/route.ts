
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

interface RouteProps {
    params: Promise<{
        id: string; // caseId
        orderId: string;
    }>;
}

export async function POST(req: NextRequest, { params }: RouteProps) {
    try {
        const session = await requireAuth().catch(() => null);
        const { id: caseId, orderId } = await params;

        let userId = session?.userId;

        if (!session?.isAdmin) {
            const { getCustomerSession, checkCaseAccess } = await import("@/lib/customer-auth");
            const customerSession = await getCustomerSession();
            if (!customerSession) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });

            const access = await checkCaseAccess(customerSession.customerId, caseId);
            if (!access.hasAccess) return NextResponse.json({ error: "Zugriff verweigert" }, { status: 403 });

            userId = customerSession.customerId;
        }

        let reason = "";
        try {
            const body = await req.json();
            reason = body.reason || "";
        } catch {
            // Kein Body → Ablehnung ohne Begründung
        }

        // 1. Order laden
        const order = await prisma.order.findUnique({
            where: { id: orderId, caseId },
        });

        if (!order) {
            return NextResponse.json({ error: "Anfrage nicht gefunden" }, { status: 404 });
        }

        if (order.status !== "PENDING") {
            return NextResponse.json(
                { error: "Anfrage wurde bereits bearbeitet" },
                { status: 400 }
            );
        }

        // 2. Order ablehnen
        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: {
                status: "REJECTED",
                rejectionReason: reason || "Ohne Angabe von Gründen abgelehnt",
                rejectedAt: new Date(),
                approvedBy: userId, // Wird als "bearbeitet von" genutzt (kein separates rejectedBy-Feld)
            },
        });

        const serializedOrder = JSON.parse(JSON.stringify(updatedOrder, (_key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));

        return NextResponse.json({ success: true, order: serializedOrder });

    } catch (error) {
        console.error("[Order Rejection Error]", error);
        return NextResponse.json(
            { error: "Interner Serverfehler" },
            { status: 500 }
        );
    }
}
