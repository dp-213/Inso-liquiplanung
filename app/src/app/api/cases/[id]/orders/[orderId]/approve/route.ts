
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

        // Body lesen (optional, für approvedAmountCents)
        let approvedAmountCents: bigint | null = null;
        try {
            const body = await req.json();
            if (body.approvedAmountCents !== undefined && body.approvedAmountCents !== null) {
                approvedAmountCents = BigInt(body.approvedAmountCents);
            }
        } catch {
            // Kein Body oder ungültiges JSON → kein abweichender Betrag
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

        // Betrag für LedgerEntry: Genehmigter Betrag oder angefragter Betrag
        // Sicherstellen, dass der Betrag positiv ist (wird dann negiert für Auszahlung)
        const rawAmount = approvedAmountCents !== null ? approvedAmountCents : order.amountCents;
        const absAmount = rawAmount < 0n ? -rawAmount : rawAmount;

        // 2. Transaktion: Order updaten + LedgerEntry erstellen
        const result = await prisma.$transaction(async (tx) => {
            const typeLabel = order.type === "BESTELLUNG" ? "Bestellfreigabe" : "Zahlungsfreigabe";
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

        return NextResponse.json({ success: true, ...serializedResult });

    } catch (error) {
        console.error("[Order Approval Error]", error);
        return NextResponse.json(
            { error: "Interner Serverfehler" },
            { status: 500 }
        );
    }
}
