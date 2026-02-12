import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCustomerSession, checkCaseAccess } from "@/lib/customer-auth";
import { OrderList } from "@/app/admin/cases/[id]/orders/OrderList";
import { CompanyTokenManager } from "@/app/admin/cases/[id]/orders/CompanyTokenManager";
import Link from "next/link";

interface PageProps {
    params: Promise<{
        id: string; // caseId
    }>;
}

export default async function PortalOrdersPage({ params }: PageProps) {
    const session = await getCustomerSession();
    if (!session) {
        redirect("/portal/login");
    }

    const { id: caseId } = await params;

    const access = await checkCaseAccess(session.customerId, caseId);
    if (!access.hasAccess) {
        redirect("/portal");
    }

    // Load Case Data for Header
    const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        select: { debtorName: true }
    });

    if (!caseData) return <div>Fall nicht gefunden</div>;

    // Orders laden (OHNE documentContent – wird nur via Download-API geladen)
    const orders = await prisma.order.findMany({
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
            description: true,
            notes: true,
            documentName: true,
            documentMimeType: true,
            documentSizeBytes: true,
            status: true,
            approvedAt: true,
            approvedBy: true,
            rejectedAt: true,
            rejectionReason: true,
            ledgerEntryId: true,
            createdAt: true,
        },
    });

    // BigInt-Serialisierung für Client Components
    const serializedOrders = JSON.parse(JSON.stringify(orders, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    ));

    const pendingOrders = serializedOrders.filter((o: { status: string }) => o.status === "PENDING");
    const historyOrders = serializedOrders.filter((o: { status: string }) => o.status !== "PENDING");

    return (
        <div className="space-y-6">
            <div className="flex items-center text-sm text-[var(--muted)] mb-4">
                <Link href="/portal" className="hover:text-[var(--primary)]">Meine Fälle</Link>
                <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                <Link href={`/portal/cases/${caseId}`} className="hover:text-[var(--primary)]">{caseData.debtorName}</Link>
                <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                <span className="text-[var(--foreground)]">Freigaben</span>
            </div>

            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-[var(--foreground)]">Bestell- & Zahlfreigaben</h1>
            </div>

            <CompanyTokenManager caseId={caseId} />

            <div className="admin-card overflow-hidden">
                <div className="px-4 py-5 sm:px-6 border-b border-[var(--border)]">
                    <h3 className="text-lg leading-6 font-medium text-[var(--foreground)] flex items-center">
                        <span className="bg-amber-100 text-amber-800 py-0.5 px-2.5 rounded-full text-xs font-medium mr-2">{pendingOrders.length}</span>
                        Offene Anfragen
                    </h3>
                </div>
                <div className="p-0">
                    <OrderList orders={pendingOrders} caseId={caseId} isPending={true} />
                </div>
            </div>

            {historyOrders.length > 0 && (
                <div className="admin-card overflow-hidden opacity-90">
                    <div className="px-4 py-5 sm:px-6 border-b border-[var(--border)] bg-[var(--accent)]">
                        <h3 className="text-lg leading-6 font-medium text-[var(--foreground)]">
                            Historie ({historyOrders.length})
                        </h3>
                    </div>
                    <div className="p-0">
                        <OrderList orders={historyOrders} caseId={caseId} isPending={false} />
                    </div>
                </div>
            )}
        </div>
    );
}
