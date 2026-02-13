"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

interface ApprovalStepData {
    id: string;
    roleNameSnapshot: string;
    approverNameSnapshot: string;
    sequenceSnapshot: number;
    status: string;
    approvalRule: {
        customerId: string;
        isRequired: boolean;
    };
}

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
    approvalSteps?: ApprovalStepData[];
}

export function ApprovalModal({
    isOpen,
    onClose,
    onConfirm,
    isProcessing,
    order,
    approvalSteps,
}: ApprovalModalProps) {
    const originalAmount = Number(order.amountCents) / 100;
    const [useCustomAmount, setUseCustomAmount] = useState(false);
    const [customAmount, setCustomAmount] = useState(originalAmount.toFixed(2));

    if (!isOpen) return null;

    const fmt = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
    const typeLabel = order.type === "BESTELLUNG" ? "Bestellanfrage" : "Zahlungsanfrage";

    // Chain-Info
    const steps = approvalSteps ?? [];
    const hasChain = steps.length > 0;
    const currentStep = hasChain ? steps.find(s => s.status === "PENDING") : null;
    const totalSteps = steps.length;
    const currentStepIndex = currentStep
        ? steps.findIndex(s => s.id === currentStep.id) + 1
        : 0;
    const remainingPending = hasChain
        ? steps.filter(s => s.status === "PENDING" && s.approvalRule.isRequired).length
        : 0;
    const isLastStep = remainingPending <= 1;
    const nextStep = hasChain && !isLastStep
        ? steps.find(s => s.status === "PENDING" && s.id !== currentStep?.id && s.approvalRule.isRequired)
        : null;

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

                            {/* Chain-Info */}
                            {hasChain && currentStep && (
                                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <div className="text-sm font-medium text-blue-800">
                                        Stufe {currentStepIndex} von {totalSteps}: {currentStep.roleNameSnapshot}
                                    </div>
                                    <div className="text-xs text-blue-600 mt-1">
                                        {isLastStep ? (
                                            "Nach Ihrer Freigabe wird die Zahlung ausgeführt."
                                        ) : nextStep ? (
                                            `Nach Ihrer Freigabe geht die Anfrage weiter an ${nextStep.roleNameSnapshot} (${nextStep.approverNameSnapshot}).`
                                        ) : (
                                            "Nach Ihrer Freigabe wird die Zahlung ausgeführt."
                                        )}
                                    </div>
                                    {/* Step-Leiste */}
                                    <div className="flex items-center gap-1 mt-2">
                                        {steps.map((step, idx) => (
                                            <span key={step.id} className="inline-flex items-center">
                                                {idx > 0 && <span className="text-blue-300 mx-0.5">&rarr;</span>}
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                    step.status === "APPROVED" ? "bg-green-100 text-green-700" :
                                                    step.status === "PENDING" && step.id === currentStep.id ? "bg-amber-200 text-amber-800 ring-1 ring-amber-400" :
                                                    "bg-gray-100 text-gray-400"
                                                }`}>
                                                    {step.status === "APPROVED" && <Check className="inline h-2.5 w-2.5 mr-0.5" />}
                                                    {step.roleNameSnapshot}
                                                </span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

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
