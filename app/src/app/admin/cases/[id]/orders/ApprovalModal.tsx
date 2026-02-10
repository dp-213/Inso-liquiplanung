"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

interface ApprovalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (approvedAmountCents?: number) => Promise<void>;
    isProcessing: boolean;
    order: {
        creditor: string;
        description: string;
        amountCents: string | number;
        type: string;
    };
}

export function ApprovalModal({
    isOpen,
    onClose,
    onConfirm,
    isProcessing,
    order,
}: ApprovalModalProps) {
    const originalAmount = Number(order.amountCents) / 100;
    const [useCustomAmount, setUseCustomAmount] = useState(false);
    const [customAmount, setCustomAmount] = useState(originalAmount.toFixed(2));

    if (!isOpen) return null;

    const fmt = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
    const typeLabel = order.type === "BESTELLUNG" ? "Bestellanfrage" : "Zahlungsanfrage";

    function handleConfirm() {
        if (useCustomAmount) {
            const parsed = parseFloat(customAmount.replace(",", "."));
            if (isNaN(parsed) || parsed <= 0) return;
            onConfirm(Math.round(parsed * 100));
        } else {
            onConfirm();
        }
    }

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                    <div className="sm:flex sm:items-start">
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                            <Check className="h-6 w-6 text-green-600" aria-hidden="true" />
                        </div>
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                            <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                {typeLabel} freigeben
                            </h3>
                            <div className="mt-3 space-y-2">
                                <div className="text-sm text-gray-500">
                                    <span className="font-medium text-gray-700">{order.creditor}</span>: {order.description}
                                </div>
                                <div className="text-sm">
                                    Angefragter Betrag: <span className="font-bold text-gray-900">{fmt.format(originalAmount)}</span>
                                </div>
                            </div>

                            <div className="mt-4 border-t pt-4">
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={useCustomAmount}
                                        onChange={(e) => setUseCustomAmount(e.target.checked)}
                                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                    />
                                    <span className="text-gray-700">Anderen Betrag genehmigen</span>
                                </label>

                                {useCustomAmount && (
                                    <div className="mt-3">
                                        <label htmlFor="customAmount" className="block text-sm font-medium text-gray-700 mb-1">
                                            Genehmigter Betrag (EUR)
                                        </label>
                                        <input
                                            type="number"
                                            id="customAmount"
                                            value={customAmount}
                                            onChange={(e) => setCustomAmount(e.target.value)}
                                            min="0.01"
                                            step="0.01"
                                            className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                        <button
                            type="button"
                            disabled={isProcessing}
                            onClick={handleConfirm}
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                        >
                            {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : "Freigeben"}
                        </button>
                        <button
                            type="button"
                            disabled={isProcessing}
                            onClick={onClose}
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:mt-0 sm:w-auto sm:text-sm"
                        >
                            Abbrechen
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
