
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { processApproval, getOrderSteps, getCurrentApprover, ApprovalAuthError, ApprovalRuleInactiveError } from "@/lib/approval-engine";
import { sendEmail } from "@/lib/email";
import { chainNextStepEmail } from "@/lib/email-templates";

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

        // Body lesen (optional, für approvedAmountCents und comment)
        let approvedAmountCents: bigint | null = null;
        let comment: string | undefined;
        try {
            const body = await req.json();
            if (body.approvedAmountCents !== undefined && body.approvedAmountCents !== null) {
                approvedAmountCents = BigInt(body.approvedAmountCents);
            }
            if (body.comment) {
                comment = body.comment;
            }
        } catch {
            // Kein Body oder ungültiges JSON
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

        // 2. Prüfe: Hat die Order ApprovalSteps? → Chain-Modus
        const hasChain = order.approvalSteps.length > 0;

        if (hasChain) {
            // Chain-Modus: processApproval aufrufen
            try {
                const result = await processApproval(orderId, userId!, isAdmin, comment);

                if (!result.complete) {
                    // Betrag ggf. speichern, aber Order bleibt PENDING
                    if (approvedAmountCents !== null) {
                        await prisma.order.update({
                            where: { id: orderId },
                            data: { approvedAmountCents },
                        });
                    }

                    // Email an nächsten Approver senden (nicht-blockierend)
                    if (result.nextStep) {
                        const nextApprover = await getCurrentApprover(orderId);
                        if (nextApprover?.email) {
                            const caseData = await prisma.case.findUnique({ where: { id: caseId }, select: { debtorName: true } });
                            const allSteps = await getOrderSteps(orderId);
                            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cases.gradify.de";
                            const portalUrl = `${appUrl}/portal/cases/${caseId}`;
                            const tpl = chainNextStepEmail(
                                caseData?.debtorName || caseId,
                                { creditor: order.creditor, amountCents: order.amountCents },
                                { roleName: result.nextStep.roleName, sequence: result.nextStep.sequence, totalSteps: allSteps.length },
                                portalUrl,
                            );
                            sendEmail({ to: nextApprover.email, ...tpl, context: { event: "CHAIN_NEXT_STEP", caseId, orderIds: [orderId] } });
                        }
                    }

                    // Steps neu laden für Response
                    const steps = await getOrderSteps(orderId);
                    const serializedSteps = JSON.parse(JSON.stringify(steps, (_key, value) =>
                        typeof value === 'bigint' ? value.toString() : value
                    ));

                    return NextResponse.json({
                        success: true,
                        status: "pending",
                        message: result.message,
                        nextStep: result.nextStep,
                        steps: serializedSteps,
                    });
                }

                // Letzte Stufe: Order = APPROVED + LedgerEntry erstellen
                // Weiter unten mit der gemeinsamen Logik
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

        // 3. Gemeinsame Logik: Order genehmigen + LedgerEntry erstellen
        const rawAmount = approvedAmountCents !== null ? approvedAmountCents : order.amountCents;
        const absAmount = rawAmount < 0n ? -rawAmount : rawAmount;

        const result = await prisma.$transaction(async (tx) => {
            const typeLabel = order.type === "BESTELLUNG" ? "Bestellfreigabe" : "Zahlungsfreigabe";

            // categoryTag aus CostCategory lesen
            let categoryTag: string | null = null;
            if (order.costCategoryId) {
                const costCat = await tx.costCategory.findUnique({
                    where: { id: order.costCategoryId },
                    select: { categoryTag: true },
                });
                categoryTag = costCat?.categoryTag || null;
            }

            const ledgerEntry = await tx.ledgerEntry.create({
                data: {
                    caseId,
                    transactionDate: order.invoiceDate,
                    amountCents: -absAmount, // Auszahlung ist immer negativ
                    description: `${order.creditor}: ${order.description}`,
                    valueType: "PLAN",
                    legalBucket: "MASSE",           // Masseverbindlichkeit
                    estateAllocation: "NEUMASSE",   // Bestellungen im laufenden Verfahren = Neumasse
                    allocationSource: "MANUELL",
                    allocationNote: `${typeLabel} via Freigabe-Modul`,
                    bookingSource: "MANUAL",
                    bookingReference: `ORDER-${order.id.slice(0, 8)}`,
                    note: `Freigegebene ${typeLabel}${approvedAmountCents !== null ? " (Betrag angepasst)" : ""}`,
                    createdBy: userId || "system",
                    ...(categoryTag && { categoryTag }),
                },
            });

            const updatedOrder = await tx.order.update({
                where: { id: orderId },
                data: {
                    status: "APPROVED",
                    approvedAt: new Date(),
                    approvedBy: userId,
                    approvedAmountCents,
                    ledgerEntryId: ledgerEntry.id,
                },
            });

            return { order: updatedOrder, ledgerEntry };
        });

        const serializedResult = JSON.parse(JSON.stringify(result, (_key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));

        return NextResponse.json({ success: true, status: "approved", ...serializedResult });

    } catch (error) {
        console.error("[Order Approval Error]", error);
        return NextResponse.json(
            { error: "Interner Serverfehler" },
            { status: 500 }
        );
    }
}
