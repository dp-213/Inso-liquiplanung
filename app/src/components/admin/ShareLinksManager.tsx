"use client";

import { useState } from "react";

interface ShareLink {
  id: string;
  token: string;
  label: string;
  expiresAt: Date | string | null;
  isActive: boolean;
  accessCount: number;
  lastAccessAt: Date | string | null;
  createdAt: Date | string;
  createdBy: string;
}

interface ShareLinksManagerProps {
  caseId: string;
  initialLinks: ShareLink[];
}

export default function ShareLinksManager({ caseId, initialLinks }: ShareLinksManagerProps) {
  const [links, setLinks] = useState<ShareLink[]>(initialLinks);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<number | "">("");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const createLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const expiresAt = expiresInDays
        ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const response = await fetch(`/api/cases/${caseId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newLabel || "Externer Zugang",
          expiresAt,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create share link");
      }

      const newLink = await response.json();
      setLinks([newLink, ...links]);
      setShowCreateForm(false);
      setNewLabel("");
      setExpiresInDays("");
    } catch (error) {
      console.error("Error creating share link:", error);
      alert("Fehler beim Erstellen des Freigabelinks");
    } finally {
      setCreating(false);
    }
  };

  const revokeLink = async (linkId: string) => {
    if (!confirm("Möchten Sie diesen Zugang wirklich deaktivieren?")) {
      return;
    }

    try {
      const response = await fetch(`/api/cases/${caseId}/share?linkId=${linkId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to revoke share link");
      }

      setLinks(links.map((link) =>
        link.id === linkId ? { ...link, isActive: false } : link
      ));
    } catch (error) {
      console.error("Error revoking share link:", error);
      alert("Fehler beim Deaktivieren des Freigabelinks");
    }
  };

  const copyLink = async (token: string, linkId: string) => {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/view/${token}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedId(linkId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedId(linkId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const activeLinks = links.filter((l) => l.isActive);
  const inactiveLinks = links.filter((l) => !l.isActive);

  return (
    <div className="admin-card">
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Externe Freigaben</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="text-sm text-[var(--primary)] hover:underline flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Link
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <form onSubmit={createLink} className="p-4 bg-gray-50 border-b border-[var(--border)]">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Bezeichnung
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="z.B. Dr. Müller - Insolvenzverwalter"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Gültigkeitsdauer (Tage)
              </label>
              <input
                type="number"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : "")}
                placeholder="Unbegrenzt"
                min="1"
                max="365"
                className="input-field"
              />
              <p className="text-xs text-[var(--muted)] mt-1">
                Leer lassen für unbegrenzten Zugang
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {creating ? "Wird erstellt..." : "Link erstellen"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn-secondary"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Active Links */}
      <div className="divide-y divide-[var(--border)]">
        {activeLinks.length > 0 ? (
          activeLinks.map((link) => (
            <div key={link.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[var(--foreground)] truncate">
                    {link.label}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted)]">
                    <span>{link.accessCount} Aufrufe</span>
                    {link.lastAccessAt && (
                      <>
                        <span>|</span>
                        <span>Zuletzt: {new Date(link.lastAccessAt).toLocaleDateString("de-DE")}</span>
                      </>
                    )}
                  </div>
                  {link.expiresAt && (
                    <p className="text-xs text-[var(--warning)] mt-1">
                      Gültig bis: {new Date(link.expiresAt).toLocaleDateString("de-DE")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <a
                    href={`/view/${link.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-[var(--secondary)] hover:text-[var(--primary)] hover:bg-blue-50 rounded transition-colors"
                    title="Ansicht öffnen"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  <button
                    onClick={() => copyLink(link.token, link.id)}
                    className="p-2 text-[var(--secondary)] hover:text-[var(--primary)] hover:bg-gray-100 rounded transition-colors"
                    title="Link kopieren"
                  >
                    {copiedId === link.id ? (
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => revokeLink(link.id)}
                    className="p-2 text-[var(--secondary)] hover:text-[var(--danger)] hover:bg-red-50 rounded transition-colors"
                    title="Zugang deaktivieren"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-[var(--muted)]">
            <svg className="w-10 h-10 mx-auto mb-2 text-[var(--border)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <p className="text-sm">Keine aktiven Freigabelinks</p>
            <p className="text-xs mt-1">Erstellen Sie einen Link für externen Zugriff</p>
          </div>
        )}
      </div>

      {/* Inactive Links */}
      {inactiveLinks.length > 0 && (
        <div className="border-t border-[var(--border)]">
          <details className="group">
            <summary className="px-4 py-3 cursor-pointer text-sm text-[var(--muted)] hover:bg-gray-50 flex items-center">
              <svg className="w-4 h-4 mr-2 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {inactiveLinks.length} deaktivierte Links
            </summary>
            <div className="divide-y divide-[var(--border)]">
              {inactiveLinks.map((link) => (
                <div key={link.id} className="p-4 bg-gray-50 opacity-60">
                  <p className="text-sm text-[var(--secondary)]">{link.label}</p>
                  <p className="text-xs text-[var(--muted)]">
                    Erstellt: {new Date(link.createdAt).toLocaleDateString("de-DE")} |
                    {link.accessCount} Aufrufe
                  </p>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
