"use client";

import { useState, useEffect } from "react";
import { Plus, Copy, Link as LinkIcon, Loader2, Check, Mail } from "lucide-react";

interface Token {
    id: string;
    token: string;
    label: string;
    notifyEmail: string | null;
    isActive: boolean;
    createdAt: string;
}

interface CompanyTokenManagerProps {
    caseId: string;
}

export function CompanyTokenManager({ caseId }: CompanyTokenManagerProps) {
    const [tokens, setTokens] = useState<Token[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newLabel, setNewLabel] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [createError, setCreateError] = useState<string | null>(null);
    const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
    const [editEmailValue, setEditEmailValue] = useState("");
    const [savingEmailId, setSavingEmailId] = useState<string | null>(null);

    useEffect(() => {
        loadTokens();
    }, [caseId]);

    async function loadTokens() {
        try {
            const res = await fetch(`/api/cases/${caseId}/tokens`, {
                credentials: "include",
            });
            const data = await res.json();
            if (data.success) {
                setTokens(data.tokens);
            }
        } finally {
            setIsLoading(false);
        }
    }

    async function createToken() {
        if (!newLabel.trim()) return;
        setIsCreating(true);
        setCreateError(null);
        try {
            const res = await fetch(`/api/cases/${caseId}/tokens`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    label: newLabel,
                    notifyEmail: newEmail.trim() || null,
                }),
            });
            if (res.ok) {
                setNewLabel("");
                setNewEmail("");
                loadTokens();
            } else {
                const data = await res.json().catch(() => null);
                setCreateError(data?.error || "Link konnte nicht erstellt werden.");
            }
        } catch {
            setCreateError("Netzwerkfehler – bitte erneut versuchen.");
        } finally {
            setIsCreating(false);
        }
    }

    function copyLink(id: string, token: string) {
        const url = `${window.location.origin}/submit/${token}`;
        navigator.clipboard.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    }

    async function saveEmail(tokenId: string) {
        setSavingEmailId(tokenId);
        try {
            const res = await fetch(`/api/cases/${caseId}/tokens`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tokenId,
                    notifyEmail: editEmailValue.trim() || null,
                }),
            });
            if (res.ok) {
                setEditingEmailId(null);
                loadTokens();
            }
        } finally {
            setSavingEmailId(null);
        }
    }

    return (
        <div className="bg-white shadow-sm rounded-xl p-6 mb-8 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center">
                        <LinkIcon className="h-5 w-5 mr-2 text-indigo-500" />
                        Zugangs-Links verwalten
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Erstellen Sie sichere Links für Firmen zum Einreichen von Bestell- und Zahlungsanfragen.
                    </p>
                </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-100">
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="Bezeichnung (z.B. Steuerbüro, Lieferanten-Portal)"
                        className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3"
                        onKeyDown={(e) => e.key === "Enter" && createToken()}
                    />
                    <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Email für Benachrichtigungen (optional)"
                        className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3"
                        onKeyDown={(e) => e.key === "Enter" && createToken()}
                    />
                    <button
                        onClick={createToken}
                        disabled={isCreating || !newLabel.trim()}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all active:scale-95"
                    >
                        {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                        Neuer Link
                    </button>
                </div>
                {createError && (
                    <p className="mt-2 text-sm text-red-600">{createError}</p>
                )}
            </div>

            <div className="space-y-3">
                {isLoading ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
                    </div>
                ) : tokens.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                        <p className="text-sm text-gray-500">Noch keine Links erstellt.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {tokens.map((token) => (
                            <div key={token.id} className="relative group bg-white p-4 rounded-xl border border-gray-200 hover:border-indigo-200 hover:shadow-md transition-all duration-200">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-semibold text-gray-900 truncate pr-2" title={token.label}>
                                        {token.label}
                                    </h4>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${token.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {token.isActive ? 'Aktiv' : 'Inaktiv'}
                                    </span>
                                </div>

                                {/* Email-Anzeige / Bearbeitung */}
                                <div className="mb-3">
                                    {editingEmailId === token.id ? (
                                        <div className="flex gap-2 items-center">
                                            <input
                                                type="email"
                                                value={editEmailValue}
                                                onChange={(e) => setEditEmailValue(e.target.value)}
                                                placeholder="Email-Adresse"
                                                className="flex-1 rounded border-gray-300 text-xs py-1 px-2 focus:border-indigo-500 focus:ring-indigo-500"
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") saveEmail(token.id);
                                                    if (e.key === "Escape") setEditingEmailId(null);
                                                }}
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => saveEmail(token.id)}
                                                disabled={savingEmailId === token.id}
                                                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                            >
                                                {savingEmailId === token.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
                                            </button>
                                            <button
                                                onClick={() => setEditingEmailId(null)}
                                                className="text-xs text-gray-400 hover:text-gray-600"
                                            >
                                                Abb.
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setEditingEmailId(token.id);
                                                setEditEmailValue(token.notifyEmail || "");
                                            }}
                                            className="flex items-center text-xs text-gray-500 hover:text-indigo-600 transition-colors"
                                        >
                                            <Mail className="h-3 w-3 mr-1" />
                                            {token.notifyEmail || "Keine Email hinterlegt"}
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center justify-between">
                                    <code className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded">
                                        ...{token.token.slice(-8)}
                                    </code>
                                    <button
                                        onClick={() => copyLink(token.id, token.token)}
                                        className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${copiedId === token.id
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                            }`}
                                    >
                                        {copiedId === token.id ? (
                                            <>
                                                <Check className="h-3.5 w-3.5 mr-1" />
                                                Kopiert
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="h-3.5 w-3.5 mr-1" />
                                                Kopieren
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
