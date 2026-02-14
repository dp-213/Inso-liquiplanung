
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { processRejection, ApprovalAuthError, ApprovalRuleInactiveError } from "@/lib/approval-engine";
import { sendEmail } from "@/lib/email";
import { orderRejectedEmail } from "@/lib/email-templates";

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
        let isAdmin = session?.isAdmin ?? false;

        if (!session?.isAdmin) {
            const { getCustomerSession, checkCaseAccess } = await import("@/lib/customer-auth");
            const customerSession = await getCustomerSession();
            if (!customerSession) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });

            const access = await checkCaseAccess(customerSession.customerId, caseId);
            if (!access.hasAccess) return NextResponse.json({ error: "Zugriff verweigert" }, { status: 403 });

            userId = customerSession.customerId;
            isAdmin = false;
        }

        let reason = "";
        try {
            const body = await req.json();
            reason = body.reason || "";
        } catch {
            // Kein Body → Ablehnung ohne Begründung
        }

        // 1. Order laden mit Steps
        const order = await prisma.order.findUnique({
            where: { id: orderId, caseId },
            include: { approvalSteps: true },
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

        // 2. Chain-Modus: processRejection aufrufen
        const hasChain = order.approvalSteps.length > 0;
        if (hasChain) {
            try {
                await processRejection(orderId, userId!, isAdmin, reason);
            } catch (error) {
                if (error instanceof ApprovalAuthError) {
                    return NextResponse.json({ error: error.message }, { status: 403 });
                }
                if (error instanceof ApprovalRuleInactiveError) {
                    return NextResponse.json({ error: error.message }, { status: 409 });
                }
                throw error;
            }
        }

        // 3. Order ablehnen
        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: {
                status: "REJECTED",
                rejectionReason: reason || "Ohne Angabe von Gründen abgelehnt",
                rejectedAt: new Date(),
                approvedBy: userId, // Wird als "bearbeitet von" genutzt
            },
        });

        // Email an Einreicher (Buchhaltung) senden (nicht-blockierend)
        if (order.companyTokenId) {
            const token = await prisma.companyToken.findUnique({
                where: { id: order.companyTokenId },
                select: { notifyEmail: true },
            });
            if (token?.notifyEmail) {
                const caseData = await prisma.case.findUnique({ where: { id: caseId }, select: { debtorName: true } });
                const tpl = orderRejectedEmail(
                    caseData?.debtorName || caseId,
                    { creditor: order.creditor, amountCents: order.amountCents, description: order.description },
                    reason || "Ohne Angabe von Gründen abgelehnt",
                );
                sendEmail({ to: token.notifyEmail, ...tpl, context: { event: "ORDER_REJECTED", caseId, orderIds: [orderId] } });
            }
        }

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
