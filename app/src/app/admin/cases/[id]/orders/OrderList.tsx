"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Check, X, FileText, Loader2, AlertCircle, ShoppingCart, CreditCard, Download, Eye, ArrowUpDown } from "lucide-react";
import { RejectionModal } from "./RejectionModal";
import { ApprovalModal } from "./ApprovalModal";

interface ApprovalStepData {
    id: string;
    roleNameSnapshot: string;
    approverNameSnapshot: string;
    sequenceSnapshot: number;
    status: string;
    decidedAt: string | null;
    comment: string | null;
    approvalRule: {
        customerId: string;
        isRequired: boolean;
    };
}

interface SerializedOrder {
    id: string;
    type: string;
    creditor: string;
    creditorId?: string | null;
    costCategoryId?: string | null;
    description: string;
    notes?: string | null;
    amountCents: string | number;
    approvedAmountCents?: string | number | null;
    invoiceDate: string;
    documentName?: string | null;
    documentMimeType?: string | null;
    status: string;
    createdAt: string;
    rejectionReason?: string | null;
    approvalSteps?: ApprovalStepData[];
}

interface CreditorRef {
    id: string;
    name: string;
    shortName: string | null;
}

interface CostCategoryRef {
    id: string;
    name: string;
    shortName: string | null;
}

interface OrderListProps {
    orders: SerializedOrder[];
    caseId: string;
    isPending: boolean;
    creditors?: CreditorRef[];
    costCategories?: CostCategoryRef[];
    isAdmin?: boolean;
    currentUserId?: string;
}

type SortField = "date" | "amount" | "creditor";
type SortDir = "asc" | "desc";
type TypeFilter = "ALL" | "BESTELLUNG" | "ZAHLUNG";

export function OrderList({ orders, caseId, isPending, creditors = [], costCategories = [], isAdmin = false, currentUserId }: OrderListProps) {
    const router = useRouter();
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectingOrder, setRejectingOrder] = useState<SerializedOrder | null>(null);
    const [approvingOrder, setApprovingOrder] = useState<SerializedOrder | null>(null);

    // Modal states
    const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

    // Filter & Sort
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
    const [sortField, setSortField] = useState<SortField>("date");
    const [sortDir, setSortDir] = useState<SortDir>("desc");

    const hasMultipleTypes = useMemo(() => {
        const types = new Set(orders.map(o => o.type));
        return types.size > 1;
    }, [orders]);

    const filteredAndSorted = useMemo(() => {
        let result = orders;

        if (typeFilter !== "ALL") {
            result = result.filter(o => o.type === typeFilter);
        }

        result = [...result].sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case "date":
                    cmp = new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime();
                    break;
                case "amount":
                    cmp = Number(a.amountCents) - Number(b.amountCents);
                    break;
                case "creditor":
                    cmp = a.creditor.localeCompare(b.creditor, "de");
                    break;
            }
            return sortDir === "asc" ? cmp : -cmp;
        });

        return result;
    }, [orders, typeFilter, sortField, sortDir]);

    if (orders.length === 0) {
        return (
            <div className="p-12 text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
                    <FileText className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Keine {isPending ? "offenen Anfragen" : "Historie"}</h3>
                <p className="mt-1 text-sm text-gray-500">
                    {isPending ? "Es liegen aktuell keine Anfragen zur Prüfung vor." : "Keine verarbeiteten Anfragen gefunden."}
                </p>
            </div>
        );
    }

    function toggleSort(field: SortField) {
        if (sortField === field) {
            setSortDir(d => d === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDir(field === "creditor" ? "asc" : "desc");
        }
    }

    function SortIcon({ field }: { field: SortField }) {
        if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
        return (
            <svg className="h-3 w-3 ml-1" viewBox="0 0 12 12" fill="currentColor">
                {sortDir === "asc"
                    ? <path d="M6 2l4 5H2z" />
                    : <path d="M6 10l4-5H2z" />
                }
            </svg>
        );
    }

    function canApproveOrder(order: SerializedOrder): boolean {
        const steps = order.approvalSteps;
        if (!steps || steps.length === 0) return true; // Legacy-Modus: jeder kann
        if (isAdmin) return true; // Admin kann immer
        if (!currentUserId) return false;

        // Finde den aktuellen PENDING Step
        const currentStep = steps.find(s => s.status === "PENDING");
        if (!currentStep) return false;
        return currentStep.approvalRule.customerId === currentUserId;
    }

    function getChainStatusLabel(order: SerializedOrder): string | null {
        const steps = order.approvalSteps;
        if (!steps || steps.length === 0) return null;

        const currentStep = steps.find(s => s.status === "PENDING");
        if (!currentStep) return null;

        return `Warte auf ${currentStep.roleNameSnapshot} (${currentStep.approverNameSnapshot})`;
    }

    function openApproveModal(order: SerializedOrder) {
        setApprovingOrder(order);
        setIsApprovalModalOpen(true);
    }

    async function handleApprove(approvedAmountCents?: number) {
        if (!approvingOrder) return;
        setProcessingId(approvingOrder.id);
        try {
            const body: Record<string, unknown> = {};
            if (approvedAmountCents !== undefined) {
                body.approvedAmountCents = approvedAmountCents;
            }

            const res = await fetch(`/api/cases/${caseId}/orders/${approvingOrder.id}/approve`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Fehler beim Freigeben");
            }
            setIsApprovalModalOpen(false);
            setApprovingOrder(null);
            router.refresh();
        } catch (err) {
            alert("Fehler: " + (err instanceof Error ? err.message : err));
        } finally {
            setProcessingId(null);
        }
    }

    function openRejectModal(order: SerializedOrder) {
        setRejectingOrder(order);
        setIsRejectionModalOpen(true);
    }

    async function handleConfirmReject(reason: string) {
        if (!rejectingOrder) return;

        setProcessingId(rejectingOrder.id);
        try {
            const res = await fetch(`/api/cases/${caseId}/orders/${rejectingOrder.id}/reject`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Fehler beim Ablehnen");
            }

            setIsRejectionModalOpen(false);
            setRejectingOrder(null);
            router.refresh();
        } catch (err) {
            alert("Fehler: " + (err instanceof Error ? err.message : err));
        } finally {
            setProcessingId(null);
        }
    }

    function getTypeBadge(type: string) {
        if (type === "BESTELLUNG") {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    <ShoppingCart className="h-3 w-3 mr-1" />
                    Bestellung
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                <CreditCard className="h-3 w-3 mr-1" />
                Zahlung
            </span>
        );
    }

    return (
        <div>
            <RejectionModal
                isOpen={isRejectionModalOpen}
                onClose={() => { setIsRejectionModalOpen(false); setRejectingOrder(null); }}
                onConfirm={handleConfirmReject}
                isProcessing={!!rejectingOrder && processingId === rejectingOrder.id}
                orderType={rejectingOrder?.type}
            />

            {approvingOrder && (
                <ApprovalModal
                    isOpen={isApprovalModalOpen}
                    onClose={() => { setIsApprovalModalOpen(false); setApprovingOrder(null); }}
                    onConfirm={handleApprove}
                    isProcessing={processingId === approvingOrder.id}
                    order={approvingOrder}
                    approvalSteps={approvingOrder.approvalSteps}
                />
            )}

            {/* Filter-Leiste (nur wenn sinnvoll) */}
            {(hasMultipleTypes || orders.length > 3) && (
                <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3 text-xs">
                    {hasMultipleTypes && (
                        <div className="flex items-center gap-1">
                            <span className="text-gray-500 mr-1">Typ:</span>
                            {(["ALL", "BESTELLUNG", "ZAHLUNG"] as TypeFilter[]).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setTypeFilter(f)}
                                    className={`px-2 py-1 rounded-md transition-colors ${typeFilter === f
                                        ? "bg-white shadow-sm font-medium text-gray-900 border border-gray-200"
                                        : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                                    }`}
                                >
                                    {f === "ALL" ? "Alle" : f === "BESTELLUNG" ? "Bestellungen" : "Zahlungen"}
                                </button>
                            ))}
                        </div>
                    )}
                    {typeFilter !== "ALL" && (
                        <span className="text-gray-400">
                            {filteredAndSorted.length} von {orders.length}
                        </span>
                    )}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Typ
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                                onClick={() => toggleSort("date")}
                            >
                                <span className="inline-flex items-center">
                                    Datum
                                    <SortIcon field="date" />
                                </span>
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                                onClick={() => toggleSort("creditor")}
                            >
                                <span className="inline-flex items-center">
                                    Gläubiger
                                    <SortIcon field="creditor" />
                                </span>
                            </th>
                            <th scope="col" className="hidden sm:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Beschreibung
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                                onClick={() => toggleSort("amount")}
                            >
                                <span className="inline-flex items-center justify-end">
                                    Betrag
                                    <SortIcon field="amount" />
                                </span>
                            </th>
                            <th scope="col" className="hidden sm:table-cell px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Beleg
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Aktion
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAndSorted.map((order) => {
                            const amount = Number(order.amountCents) / 100;
                            const approvedAmount = order.approvedAmountCents ? Number(order.approvedAmountCents) / 100 : null;
                            const isProcessing = processingId === order.id;
                            const fmt = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
                            const steps = order.approvalSteps;
                            const hasChain = steps && steps.length > 0;
                            const chainLabel = getChainStatusLabel(order);
                            const userCanApprove = canApproveOrder(order);

                            return (
                                <tr key={order.id} className={`transition-colors duration-150 ${isPending ? "hover:bg-amber-50/30" : "bg-gray-50/50"}`}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getTypeBadge(order.type)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="font-medium text-gray-900">
                                            {new Date(order.invoiceDate).toLocaleDateString("de-DE")}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-0.5">
                                            Eing.: {new Date(order.createdAt).toLocaleDateString("de-DE")}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                        <div className="whitespace-nowrap">{order.creditor}</div>
                                        {order.costCategoryId && (() => {
                                            const cat = costCategories.find(c => c.id === order.costCategoryId);
                                            return cat ? (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-100 text-violet-700 mt-0.5">
                                                    {cat.shortName || cat.name}
                                                </span>
                                            ) : null;
                                        })()}
                                        <div className="sm:hidden text-xs text-gray-500 font-normal mt-0.5 truncate max-w-[200px]" title={order.description}>
                                            {order.description}
                                        </div>
                                    </td>
                                    <td className="hidden sm:table-cell px-6 py-4 text-sm text-gray-500 max-w-xs">
                                        <div className="truncate" title={order.description}>
                                            {order.description}
                                        </div>
                                        {order.notes && (
                                            <div className="mt-1 text-xs text-gray-400 italic truncate" title={order.notes}>
                                                {order.notes}
                                            </div>
                                        )}
                                        {order.rejectionReason && (
                                            <div className="flex items-start mt-1 text-xs text-red-600 bg-red-50 p-1.5 rounded-md">
                                                <AlertCircle className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                                                <span>{order.rejectionReason}</span>
                                            </div>
                                        )}
                                        {/* Approval-Chain Fortschritt */}
                                        {hasChain && (
                                            <div className="mt-2 flex flex-wrap items-center gap-1">
                                                {steps.map((step, idx) => (
                                                    <span key={step.id} className="inline-flex items-center">
                                                        {idx > 0 && <span className="text-gray-300 mx-0.5">&rarr;</span>}
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                            step.status === "APPROVED" ? "bg-green-100 text-green-700" :
                                                            step.status === "REJECTED" ? "bg-red-100 text-red-700" :
                                                            step.status === "SKIPPED" ? "bg-gray-100 text-gray-400 line-through" :
                                                            "bg-amber-100 text-amber-700"
                                                        }`}>
                                                            {step.status === "APPROVED" && <Check className="h-2.5 w-2.5 mr-0.5" />}
                                                            {step.status === "REJECTED" && <X className="h-2.5 w-2.5 mr-0.5" />}
                                                            {step.roleNameSnapshot}
                                                        </span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                        <div className="font-bold text-gray-900">
                                            {fmt.format(amount)}
                                        </div>
                                        {approvedAmount !== null && approvedAmount !== amount && (
                                            <div className="text-xs text-green-700 mt-0.5">
                                                Genehmigt: {fmt.format(approvedAmount)}
                                            </div>
                                        )}
                                    </td>
                                    <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-center">
                                        {order.documentName ? (
                                            <div className="flex justify-center gap-1">
                                                <a
                                                    href={`/api/cases/${caseId}/orders/${order.id}/document`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="group flex items-center justify-center h-8 w-8 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors"
                                                    title={`${order.documentName} ansehen`}
                                                >
                                                    {order.documentMimeType === "application/pdf" ? (
                                                        <Eye className="h-4 w-4" />
                                                    ) : (
                                                        <Download className="h-4 w-4" />
                                                    )}
                                                </a>
                                            </div>
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {isPending ? (
                                            userCanApprove ? (
                                                <div className="flex justify-end space-x-2">
                                                    <button
                                                        onClick={() => openApproveModal(order)}
                                                        disabled={isProcessing}
                                                        className="group flex items-center justify-center p-2 rounded-full text-green-600 bg-green-50 hover:bg-green-100 hover:text-green-700 transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:shadow-none"
                                                        title="Freigeben"
                                                    >
                                                        {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                                                        <span className="sr-only">Freigeben</span>
                                                    </button>
                                                    <button
                                                        onClick={() => openRejectModal(order)}
                                                        disabled={isProcessing}
                                                        className="group flex items-center justify-center p-2 rounded-full text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:shadow-none"
                                                        title="Ablehnen"
                                                    >
                                                        <X className="h-5 w-5" />
                                                        <span className="sr-only">Ablehnen</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                                    {chainLabel || "Ausstehend"}
                                                </span>
                                            )
                                        ) : (
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                                order.status === "APPROVED"
                                                    ? "bg-green-100 text-green-800"
                                                    : order.status === "AUTO_APPROVED"
                                                    ? "bg-blue-100 text-blue-800"
                                                    : "bg-red-100 text-red-800"
                                                }`}>
                                                {order.status === "APPROVED" ? (
                                                    <>
                                                        <Check className="h-3 w-3 mr-1" />
                                                        Freigegeben
                                                    </>
                                                ) : order.status === "AUTO_APPROVED" ? (
                                                    <>
                                                        <Check className="h-3 w-3 mr-1" />
                                                        Auto-Freigabe
                                                    </>
                                                ) : (
                                                    <>
                                                        <X className="h-3 w-3 mr-1" />
                                                        Abgelehnt
                                                    </>
                                                )}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
