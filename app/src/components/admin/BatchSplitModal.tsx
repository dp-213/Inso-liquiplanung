"use client";

import { useState, useMemo } from "react";

interface SplitChildInput {
  description: string;
  amountCents: number;
  counterpartyId: string;
  locationId: string;
  categoryTag: string;
  note: string;
}

interface DryRunResult {
  dryRun: boolean;
  valid: boolean;
  parentId: string;
  parentAmountCents: string;
  parentDescription: string;
  childrenCount: number;
  childrenSumCents: string;
  summenCheck: string;
}

interface BatchSplitModalProps {
  caseId: string;
  parentEntry: {
    id: string;
    description: string;
    amountCents: string;
    transactionDate: string;
    bankAccountId: string | null;
  };
  onClose: () => void;
  onSuccess: () => void;
}

function formatCurrency(cents: string | number): string {
  const val = typeof cents === "string" ? parseInt(cents) : cents;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(val / 100);
}

export default function BatchSplitModal({
  caseId,
  parentEntry,
  onClose,
  onSuccess,
}: BatchSplitModalProps) {
  const [children, setChildren] = useState<SplitChildInput[]>([
    { description: "", amountCents: 0, counterpartyId: "", locationId: "", categoryTag: "", note: "" },
  ]);
  const [splitReason, setSplitReason] = useState("");
  const [dataSource, setDataSource] = useState("");
  const [jsonImport, setJsonImport] = useState("");
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"edit" | "preview" | "done">("edit");

  const parentAmountCents = parseInt(parentEntry.amountCents);

  const childrenSum = useMemo(
    () => children.reduce((sum, c) => sum + (c.amountCents || 0), 0),
    [children]
  );

  const diff = childrenSum - parentAmountCents;
  const sumValid = diff === 0;

  const addChild = () => {
    setChildren((prev) => [
      ...prev,
      { description: "", amountCents: 0, counterpartyId: "", locationId: "", categoryTag: "", note: "" },
    ]);
  };

  const removeChild = (index: number) => {
    setChildren((prev) => prev.filter((_, i) => i !== index));
  };

  const updateChild = (index: number, field: keyof SplitChildInput, value: string | number) => {
    setChildren((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleJsonImport = () => {
    try {
      const parsed = JSON.parse(jsonImport);
      const items = Array.isArray(parsed) ? parsed : parsed.children || parsed.items || [parsed];

      const imported: SplitChildInput[] = items.map((item: Record<string, unknown>) => ({
        description: String(item.description || item.name || item.text || ""),
        amountCents: typeof item.amountCents === "number"
          ? item.amountCents
          : typeof item.amount === "number"
          ? Math.round(item.amount * 100)
          : 0,
        counterpartyId: String(item.counterpartyId || item.counterparty || ""),
        locationId: String(item.locationId || item.location || ""),
        categoryTag: String(item.categoryTag || item.category || ""),
        note: String(item.note || item.iban || ""),
      }));

      setChildren(imported);
      setJsonImport("");
      setError(null);
    } catch {
      setError("JSON konnte nicht gelesen werden. Bitte Format prüfen.");
    }
  };

  const handleDryRun = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/cases/${caseId}/ledger/${parentEntry.id}/split?dryRun=true`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            children: children.map((c) => ({
              description: c.description,
              amountCents: c.amountCents,
              counterpartyId: c.counterpartyId || null,
              locationId: c.locationId || null,
              categoryTag: c.categoryTag || null,
              note: c.note || null,
            })),
            splitReason,
            dataSource: dataSource || undefined,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.details?.message || "Dry-Run fehlgeschlagen");
        return;
      }

      setDryRunResult(data);
      setStep("preview");
    } catch (err) {
      setError("Netzwerkfehler beim Dry-Run");
    } finally {
      setLoading(false);
    }
  };

  const handleSplit = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/cases/${caseId}/ledger/${parentEntry.id}/split`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            children: children.map((c) => ({
              description: c.description,
              amountCents: c.amountCents,
              counterpartyId: c.counterpartyId || null,
              locationId: c.locationId || null,
              categoryTag: c.categoryTag || null,
              note: c.note || null,
            })),
            splitReason,
            dataSource: dataSource || undefined,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Split fehlgeschlagen");
        return;
      }

      setStep("done");
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch {
      setError("Netzwerkfehler beim Split");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-lg font-semibold">Sammelüberweisung aufsplitten</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {parentEntry.description} &middot; {formatCurrency(parentEntry.amountCents)} &middot;{" "}
              {new Date(parentEntry.transactionDate).toLocaleDateString("de-DE")}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4">
          {/* Step: Done */}
          {step === "done" && (
            <div className="text-center py-12">
              <div className="text-green-500 text-5xl mb-4">&#10003;</div>
              <h4 className="text-lg font-semibold text-green-700">Erfolgreich aufgespalten</h4>
              <p className="text-sm text-gray-500 mt-1">{children.length} Einzelposten erstellt</p>
            </div>
          )}

          {/* Step: Preview */}
          {step === "preview" && dryRunResult && (
            <div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-green-800">Dry-Run erfolgreich</h4>
                <div className="mt-2 text-sm text-green-700 space-y-1">
                  <p>Gesamtbetrag: {formatCurrency(dryRunResult.parentAmountCents)}</p>
                  <p>Einzelposten: {dryRunResult.childrenCount}</p>
                  <p>Summenprüfung: {dryRunResult.summenCheck}</p>
                </div>
              </div>

              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Beschreibung</th>
                      <th className="px-3 py-2 text-right">Betrag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {children.map((child, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                        <td className="px-3 py-2">{child.description}</td>
                        <td className={`px-3 py-2 text-right font-mono ${child.amountCents >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(child.amountCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setStep("edit")}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Zurück
                </button>
                <button
                  onClick={handleSplit}
                  disabled={loading}
                  className="px-4 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                >
                  {loading ? "Wird gespeichert..." : "Aufspaltung durchführen"}
                </button>
              </div>
            </div>
          )}

          {/* Step: Edit */}
          {step === "edit" && (
            <div>
              {/* JSON Import */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  JSON-Import (optional)
                </label>
                <div className="flex gap-2">
                  <textarea
                    value={jsonImport}
                    onChange={(e) => setJsonImport(e.target.value)}
                    placeholder='[{"description": "...", "amountCents": -12345, "counterpartyId": "..."}]'
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm font-mono h-20 resize-none"
                  />
                  <button
                    onClick={handleJsonImport}
                    disabled={!jsonImport.trim()}
                    className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50 self-end"
                  >
                    Importieren
                  </button>
                </div>
              </div>

              {/* Grund */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Aufspaltungsgrund *
                  </label>
                  <input
                    type="text"
                    value={splitReason}
                    onChange={(e) => setSplitReason(e.target.value)}
                    placeholder="z.B. Zahlbeleg PRM2VN vom 02.12.2025"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Datenquelle
                  </label>
                  <input
                    type="text"
                    value={dataSource}
                    onChange={(e) => setDataSource(e.target.value)}
                    placeholder="z.B. Zahlbelege_Vollstaendig.json"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Children-Tabelle */}
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-left w-8">#</th>
                      <th className="px-2 py-2 text-left">Beschreibung *</th>
                      <th className="px-2 py-2 text-right w-32">Betrag (Cents) *</th>
                      <th className="px-2 py-2 text-left w-36">Gegenpartei-ID</th>
                      <th className="px-2 py-2 text-left w-32">Standort-ID</th>
                      <th className="px-2 py-2 text-left w-28">Notiz</th>
                      <th className="px-2 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {children.map((child, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1 text-gray-500">{i + 1}</td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={child.description}
                            onChange={(e) => updateChild(i, "description", e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                            placeholder="Beschreibung"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            value={child.amountCents || ""}
                            onChange={(e) => updateChild(i, "amountCents", parseInt(e.target.value) || 0)}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right font-mono"
                            placeholder="-12345"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={child.counterpartyId}
                            onChange={(e) => updateChild(i, "counterpartyId", e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                            placeholder="cp-..."
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={child.locationId}
                            onChange={(e) => updateChild(i, "locationId", e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                            placeholder="loc-..."
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={child.note}
                            onChange={(e) => updateChild(i, "note", e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                            placeholder="IBAN etc."
                          />
                        </td>
                        <td className="px-2 py-1">
                          {children.length > 1 && (
                            <button
                              onClick={() => removeChild(i)}
                              className="text-red-400 hover:text-red-600"
                              title="Entfernen"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={addChild}
                className="mb-4 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded border border-blue-200"
              >
                + Einzelposten hinzufügen
              </button>

              {/* Summen-Anzeige */}
              <div
                className={`p-3 rounded-lg mb-4 text-sm font-mono ${
                  sumValid
                    ? "bg-green-50 border border-green-200 text-green-800"
                    : "bg-red-50 border border-red-200 text-red-800"
                }`}
              >
                <div className="flex justify-between">
                  <span>Gesamtbetrag (Parent):</span>
                  <span>{formatCurrency(parentEntry.amountCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Summe Einzelposten:</span>
                  <span>{formatCurrency(childrenSum)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-current/20 mt-1 pt-1">
                  <span>Differenz:</span>
                  <span>{sumValid ? "0,00 EUR ✓" : formatCurrency(diff)}</span>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleDryRun}
                  disabled={loading || !sumValid || !splitReason.trim() || children.some((c) => !c.description.trim())}
                  className="px-4 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                >
                  {loading ? "Wird geprüft..." : "Vorschau (Dry-Run)"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
