
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { OrderList } from "./OrderList";
import { CompanyTokenManager } from "./CompanyTokenManager";

interface PageProps {
    params: Promise<{
        id: string; // caseId
    }>;
}

export default async function AdminOrdersPage({ params }: PageProps) {
    const { id: caseId } = await params;

    const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        select: { debtorName: true },
    });

    if (!caseData) notFound();

    // Orders, Creditors und CostCategories parallel laden
    const [orders, creditors, costCategories] = await Promise.all([
        prisma.order.findMany({
            where: { caseId },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                type: true,
                caseId: true,
                requestDate: true,
                invoiceDate: true,
                amountCents: true,
                approvedAmountCents: true,
                creditor: true,
                creditorId: true,
                costCategoryId: true,
                description: true,
                notes: true,
                documentName: true,
                documentMimeType: true,
                documentSizeBytes: true,
                // documentContent: BEWUSST AUSGELASSEN (bis 10MB pro Beleg!)
                status: true,
                approvedAt: true,
                approvedBy: true,
                rejectedAt: true,
                rejectionReason: true,
                ledgerEntryId: true,
                createdAt: true,
            },
        }),
        prisma.creditor.findMany({
            where: { caseId },
            select: { id: true, name: true, shortName: true },
            orderBy: { name: "asc" },
        }),
        prisma.costCategory.findMany({
            where: { caseId, isActive: true },
            select: { id: true, name: true, shortName: true },
            orderBy: { name: "asc" },
        }),
    ]);

    // BigInt-Serialisierung für Client Components
    const serializedOrders = JSON.parse(JSON.stringify(orders, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    ));

    const pendingOrders = serializedOrders.filter((o: { status: string }) => o.status === "PENDING");
    const historyOrders = serializedOrders.filter((o: { status: string }) => o.status !== "PENDING");

    const serializedCreditors = creditors.map(c => ({ id: c.id, name: c.name, shortName: c.shortName }));
    const serializedCostCategories = costCategories.map(c => ({ id: c.id, name: c.name, shortName: c.shortName }));

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Bestell- & Zahlfreigaben</h1>
            </div>

            <CompanyTokenManager caseId={caseId} />

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                        <span className="bg-amber-100 text-amber-800 py-0.5 px-2.5 rounded-full text-xs font-medium mr-2">{pendingOrders.length}</span>
                        Offene Anfragen
                    </h3>
                </div>
                <div className="p-0">
                    <OrderList orders={pendingOrders} caseId={caseId} isPending={true} creditors={serializedCreditors} costCategories={serializedCostCategories} />
                </div>
            </div>

            {historyOrders.length > 0 && (
                <div className="bg-white shadow rounded-lg overflow-hidden opacity-80">
                    <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                            Historie ({historyOrders.length})
                        </h3>
                    </div>
                    <div className="p-0">
                        <OrderList orders={historyOrders} caseId={caseId} isPending={false} creditors={serializedCreditors} costCategories={serializedCostCategories} />
                    </div>
                </div>
            )}
        </div>
    );
}
