"use client";

import { useState } from "react";
import { Loader2, Upload, CheckCircle, AlertCircle, FileText, Calendar, Euro, ShoppingCart, CreditCard, ArrowLeft } from "lucide-react";
import { StatusSteps } from "./StatusSteps";

type OrderType = "BESTELLUNG" | "ZAHLUNG";

interface CreditorOption {
    id: string;
    name: string;
    shortName: string | null;
    defaultCostCategoryId: string | null;
}

interface CostCategoryOption {
    id: string;
    name: string;
    shortName: string | null;
}

interface OrderSubmissionFormProps {
    token: string;
    creditors?: CreditorOption[];
    costCategories?: CostCategoryOption[];
}

export function OrderSubmissionForm({ token, creditors = [], costCategories = [] }: OrderSubmissionFormProps) {
    const [orderType, setOrderType] = useState<OrderType | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [selectedCreditorId, setSelectedCreditorId] = useState<string>("");
    const [selectedCostCategoryId, setSelectedCostCategoryId] = useState<string>("");
    const [creditorName, setCreditorName] = useState<string>("");

    const hasCreditors = creditors.length > 0;
    const hasCostCategories = costCategories.length > 0;
    const creditorLocked = hasCreditors && selectedCreditorId !== "" && selectedCreditorId !== "__other__";

    function handleCreditorSelect(value: string) {
        const wasLocked = creditorLocked;
        setSelectedCreditorId(value);
        if (value && value !== "__other__") {
            const cred = creditors.find((c) => c.id === value);
            setCreditorName(cred?.name || "");
            // Auto-Fill Kostenart NUR wenn noch keine manuell gewählt wurde
            if (cred?.defaultCostCategoryId && hasCostCategories && !selectedCostCategoryId) {
                setSelectedCostCategoryId(cred.defaultCostCategoryId);
            }
        } else if (wasLocked) {
            // Nur leeren wenn vorher ein Kreditor ausgewählt war (nicht User-Freitext überschreiben)
            setCreditorName("");
        }
    }

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!orderType) return;

        setIsLoading(true);
        setError(null);

        try {
            const formData = new FormData(event.currentTarget);
            const amountStr = (formData.get("amount") as string).replace(",", ".");
            const amountCents = Math.round(parseFloat(amountStr) * 100);

            if (isNaN(amountCents) || amountCents <= 0) {
                throw new Error("Bitte geben Sie einen gültigen Betrag ein");
            }

            formData.append("amountCents", amountCents.toString());
            formData.append("token", token);
            formData.append("type", orderType);

            // Kreditor-ID mitsenden wenn aus Dropdown gewählt
            if (selectedCreditorId && selectedCreditorId !== "__other__") {
                formData.append("creditorId", selectedCreditorId);
            }
            // Kostenart mitsenden wenn gewählt
            if (selectedCostCategoryId) {
                formData.append("costCategoryId", selectedCostCategoryId);
            }

            const response = await fetch("/api/company/orders", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Ein Fehler ist aufgetreten");
            }

            setIsSuccess(true);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
        } finally {
            setIsLoading(false);
        }
    }

    if (isSuccess) {
        const typeLabel = orderType === "BESTELLUNG" ? "Bestellanfrage" : "Zahlungsanfrage";
        return (
            <div className="text-center py-12 px-4 transition-all duration-500 ease-in-out animate-fadeIn">
                <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-green-100 mb-8 shadow-green-200 shadow-xl">
                    <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-4">
                    Vielen Dank!
                </h3>
                <p className="text-lg text-gray-500 max-w-md mx-auto mb-10">
                    Ihre {typeLabel} wurde sicher übertragen und wird umgehend vom Insolvenzverwalter geprüft.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-full text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform hover:scale-105"
                >
                    Weitere Anfrage einreichen
                </button>
            </div>
        );
    }

    // Typ-Auswahl (Schritt 0)
    if (!orderType) {
        return (
            <div className="space-y-6">
                <p className="text-sm text-gray-500 text-center">
                    Bitte wählen Sie die Art Ihrer Anfrage:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                        onClick={() => setOrderType("BESTELLUNG")}
                        className="group flex flex-col items-center p-6 rounded-2xl border-2 border-gray-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all duration-200 text-center"
                    >
                        <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                            <ShoppingCart className="h-7 w-7 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Bestellfreigabe</h3>
                        <p className="text-xs text-gray-500">
                            Wir möchten etwas bestellen und bitten um Freigabe des Budgets.
                        </p>
                    </button>
                    <button
                        onClick={() => setOrderType("ZAHLUNG")}
                        className="group flex flex-col items-center p-6 rounded-2xl border-2 border-gray-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all duration-200 text-center"
                    >
                        <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                            <CreditCard className="h-7 w-7 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Zahlungsfreigabe</h3>
                        <p className="text-xs text-gray-500">
                            Eine Rechnung liegt vor und soll zur Zahlung freigegeben werden.
                        </p>
                    </button>
                </div>
            </div>
        );
    }

    // Labels je nach Typ
    const isBestellung = orderType === "BESTELLUNG";
    const amountLabel = isBestellung ? "Geschätzter Betrag" : "Rechnungsbetrag";
    const dateLabel = isBestellung ? "Gewünschtes Lieferdatum" : "Rechnungsdatum";
    const submitLabel = isBestellung ? "Bestellanfrage einreichen" : "Zahlungsanfrage einreichen";
    const typeBadge = isBestellung
        ? { label: "Bestellfreigabe", bg: "bg-blue-100", text: "text-blue-800", icon: ShoppingCart }
        : { label: "Zahlungsfreigabe", bg: "bg-green-100", text: "text-green-800", icon: CreditCard };

    return (
        <div className="transition-all duration-500 ease-in-out">
            <div className="mb-6 flex items-center justify-between">
                <button
                    onClick={() => setOrderType(null)}
                    className="inline-flex items-center text-sm text-gray-500 hover:text-indigo-600 transition-colors"
                    aria-label="Zurück zur Typauswahl"
                >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Andere Art wählen
                </button>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${typeBadge.bg} ${typeBadge.text}`}>
                    <typeBadge.icon className="h-3 w-3 mr-1" />
                    {typeBadge.label}
                </span>
            </div>

            <div className="mb-8">
                <StatusSteps currentStep={1} />
            </div>

            <form className="space-y-8" onSubmit={onSubmit}>
                {error && (
                    <div className="rounded-xl bg-red-50 p-4 border border-red-100 shadow-sm">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <AlertCircle className="h-5 w-5 text-red-400" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">Übermittlungsfehler</h3>
                                <div className="mt-2 text-sm text-red-700">
                                    <p>{error}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
                    <div className="relative group">
                        <label htmlFor="creditor" className="block text-sm font-medium text-gray-700 mb-1">
                            Gläubiger / Lieferant
                        </label>
                        {hasCreditors && (
                            <select
                                value={selectedCreditorId}
                                onChange={(e) => handleCreditorSelect(e.target.value)}
                                className={`block w-full sm:text-sm border-gray-300 rounded-lg py-3 pl-3 pr-10 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow ${!creditorLocked ? "mb-2" : ""}`}
                            >
                                <option value="">— Gläubiger wählen —</option>
                                {creditors.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}{c.shortName ? ` (${c.shortName})` : ""}
                                    </option>
                                ))}
                                <option value="__other__">Anderer Gläubiger...</option>
                            </select>
                        )}
                        {/* Freitext-Feld nur wenn kein Kreditor aus Dropdown gewählt (oder kein Dropdown vorhanden) */}
                        {!creditorLocked && (
                            <div className="relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <FileText className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                </div>
                                <input
                                    id="creditor"
                                    name="creditor"
                                    type="text"
                                    required
                                    value={creditorName}
                                    onChange={(e) => setCreditorName(e.target.value)}
                                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-lg py-3 transition-shadow"
                                    placeholder="Firmenname"
                                />
                            </div>
                        )}
                        {/* Hidden input damit FormData den Kreditor-Namen auch bei Dropdown-Auswahl hat */}
                        {creditorLocked && (
                            <input type="hidden" name="creditor" value={creditorName} />
                        )}
                    </div>

                    <div className="relative group">
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                            Verwendungszweck
                        </label>
                        <textarea
                            id="description"
                            name="description"
                            required
                            rows={3}
                            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-lg p-3 transition-shadow"
                            placeholder={isBestellung ? "Was soll bestellt werden, für welchen Zweck..." : "Rechnungsnummer, Leistungszeitraum..."}
                        />
                    </div>

                    {hasCostCategories && (
                        <div className="relative group">
                            <label htmlFor="costCategory" className="block text-sm font-medium text-gray-700 mb-1">
                                Kostenart <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <select
                                id="costCategory"
                                value={selectedCostCategoryId}
                                onChange={(e) => setSelectedCostCategoryId(e.target.value)}
                                className="block w-full sm:text-sm border-gray-300 rounded-lg py-3 pl-3 pr-10 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                            >
                                <option value="">— Kostenart (optional) —</option>
                                {costCategories.map((cc) => (
                                    <option key={cc.id} value={cc.id}>
                                        {cc.name}{cc.shortName ? ` (${cc.shortName})` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                        <div className="relative group">
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                                {amountLabel}
                            </label>
                            <div className="relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Euro className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                </div>
                                <input
                                    type="number"
                                    name="amount"
                                    id="amount"
                                    required
                                    min="0.01"
                                    step="0.01"
                                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 pr-12 sm:text-sm border-gray-300 rounded-lg py-3"
                                    placeholder="0,00"
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 sm:text-sm">EUR</span>
                                </div>
                            </div>
                        </div>

                        <div className="relative group">
                            <label htmlFor="invoiceDate" className="block text-sm font-medium text-gray-700 mb-1">
                                {dateLabel}
                            </label>
                            <div className="relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Calendar className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                </div>
                                <input
                                    type="date"
                                    name="invoiceDate"
                                    id="invoiceDate"
                                    required
                                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-lg py-3"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="relative group">
                        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                            Ergänzende Informationen <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <textarea
                            id="notes"
                            name="notes"
                            rows={2}
                            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-lg p-3 transition-shadow"
                            placeholder="Zusätzlicher Kontext, Dringlichkeit, Ansprechpartner..."
                        />
                    </div>

                    <div>
                        <span className="block text-sm font-medium text-gray-700 mb-2">
                            Belegupload {isBestellung && <span className="text-gray-400 font-normal">(optional)</span>}
                        </span>
                        <label
                            htmlFor="file-upload"
                            className="mt-1 w-full flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-indigo-500 hover:bg-indigo-50/30 transition-all duration-300 cursor-pointer relative group bg-gray-50/50"
                        >
                            <div className="space-y-1 text-center pointer-events-none">
                                <div className="mx-auto h-12 w-12 text-gray-400 group-hover:text-indigo-500 transition-colors flex items-center justify-center bg-white rounded-full shadow-sm mb-3 group-hover:scale-110 transform duration-300">
                                    <Upload className="h-6 w-6" />
                                </div>
                                <div className="text-sm text-gray-600">
                                    <span className="font-medium text-indigo-600 group-hover:text-indigo-500">
                                        Datei auswählen
                                    </span>
                                    <span className="pl-1">oder hierher ziehen</span>
                                </div>
                                <p className="text-xs text-gray-500">
                                    PDF, PNG, JPG – max. 10 MB
                                </p>
                                {fileName && (
                                    <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 animate-fadeIn">
                                        <FileText className="h-3 w-3 mr-1" />
                                        {fileName}
                                    </div>
                                )}
                            </div>
                            <input
                                id="file-upload"
                                name="file"
                                type="file"
                                className="sr-only"
                                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                                onChange={(e) => setFileName(e.target.files?.[0]?.name || null)}
                            />
                        </label>
                    </div>
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-0.5 transition-all duration-200"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                                Wird sicher übertragen...
                            </>
                        ) : (
                            submitLabel
                        )}
                    </button>
                    <p className="mt-4 text-center text-xs text-gray-400">
                        Ihre Angaben werden verschlüsselt übertragen.
                    </p>
                </div>
            </form>
        </div>
    );
}
