"use client";

import { useState, useEffect, useCallback } from "react";
import { suggestSlug } from "@/lib/slug-utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Customer {
  id: string;
  name: string;
  email: string;
  slug: string | null;
  company: string | null;
  isActive: boolean;
  lastLoginAt: string | Date | null;
  loginCount: number;
  phone: string | null;
}

interface CustomerAccess {
  id: string;
  customerId: string;
  accessLevel: string;
  grantedAt: string | Date;
  grantedBy: string;
  expiresAt: string | Date | null;
  isActive: boolean;
  lastAccessedAt: string | Date | null;
  accessCount: number;
  customer: Customer;
}

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

interface CombinedAccessManagerProps {
  caseId: string;
  caseNumber: string;
  debtorName: string;
  initialAccess: CustomerAccess[];
  initialLinks: ShareLink[];
}

// ─── Reusable Components ─────────────────────────────────────────────────────

function InlineError({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
      <svg
        className="w-4 h-4 mt-0.5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-600 flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

function InlineSuccess({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
      <svg
        className="w-4 h-4 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
      <span>{message}</span>
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmVariant = "danger",
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-[var(--card)] rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                confirmVariant === "danger"
                  ? "bg-red-100"
                  : "bg-blue-100"
              }`}
            >
              <svg
                className={`w-5 h-5 ${
                  confirmVariant === "danger" ? "text-red-600" : "text-blue-600"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {confirmVariant === "danger" ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                )}
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--foreground)]">
                {title}
              </h3>
              <p className="text-sm text-[var(--secondary)] mt-1">{message}</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--border)]">
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn-secondary disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-50 transition-colors ${
              confirmVariant === "danger"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
            }`}
          >
            {loading ? "Wird ausgeführt..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SVG Icons ──────────────────────────────────────────────────────────────

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function RevokeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
    </svg>
  );
}

// ─── Clipboard Helper ────────────────────────────────────────────────────────

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    return true;
  }
}

function formatDate(date: string | Date | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("de-DE");
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CombinedAccessManager({
  caseId,
  caseNumber,
  debtorName,
  initialAccess,
  initialLinks,
}: CombinedAccessManagerProps) {
  const [access, setAccess] = useState<CustomerAccess[]>(initialAccess);
  const [links, setLinks] = useState<ShareLink[]>(initialLinks);
  const [showGrantFlow, setShowGrantFlow] = useState(false);
  const [slideOverCustomer, setSlideOverCustomer] = useState<CustomerAccess | null>(null);

  const activeAccess = access.filter((a) => a.isActive);
  const activeLinks = links.filter((l) => l.isActive);
  const inactiveAccess = access.filter((a) => !a.isActive);
  const inactiveLinks = links.filter((l) => !l.isActive);
  const totalInactive = inactiveAccess.length + inactiveLinks.length;

  return (
    <div className="space-y-4">
      {/* Header with Action Button */}
      <div className="admin-card p-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Zugangsfreigaben
          </h2>
          <p className="text-sm text-[var(--secondary)]">
            {activeAccess.length} Kundenzugänge, {activeLinks.length} externe Links
          </p>
        </div>
        <button
          onClick={() => setShowGrantFlow(true)}
          className="btn-primary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Zugang einrichten
        </button>
      </div>

      {/* Grant Flow Wizard */}
      {showGrantFlow && (
        <GrantFlowWizard
          caseId={caseId}
          caseNumber={caseNumber}
          debtorName={debtorName}
          existingAccess={access}
          onClose={() => setShowGrantFlow(false)}
          onAccessCreated={(newAccess) => {
            setAccess([newAccess, ...access]);
          }}
          onLinkCreated={(newLink) => {
            setLinks([newLink, ...links]);
          }}
        />
      )}

      {/* Customer SlideOver */}
      {slideOverCustomer && (
        <CustomerSlideOver
          caseId={caseId}
          caseNumber={caseNumber}
          debtorName={debtorName}
          accessItem={slideOverCustomer}
          onClose={() => setSlideOverCustomer(null)}
          onCustomerUpdated={(updated) => {
            setAccess(access.map((a) =>
              a.customerId === updated.id
                ? { ...a, customer: { ...a.customer, ...updated } }
                : a
            ));
          }}
          onAccessRevoked={(accessId) => {
            setAccess(access.map((a) => (a.id === accessId ? { ...a, isActive: false } : a)));
            setSlideOverCustomer(null);
          }}
        />
      )}

      {/* Unified Access List */}
      <div className="admin-card">
        <UnifiedAccessList
          caseId={caseId}
          caseNumber={caseNumber}
          debtorName={debtorName}
          activeAccess={activeAccess}
          activeLinks={activeLinks}
          inactiveAccess={inactiveAccess}
          inactiveLinks={inactiveLinks}
          totalInactive={totalInactive}
          onCustomerClick={(item) => setSlideOverCustomer(item)}
          onAccessRevoked={(accessId) => {
            setAccess(access.map((a) => (a.id === accessId ? { ...a, isActive: false } : a)));
          }}
          onLinkRevoked={(linkId) => {
            setLinks(links.map((l) => (l.id === linkId ? { ...l, isActive: false } : l)));
          }}
        />
      </div>
    </div>
  );
}

// ─── Unified Access List ─────────────────────────────────────────────────────

function UnifiedAccessList({
  caseId,
  caseNumber,
  debtorName,
  activeAccess,
  activeLinks,
  inactiveAccess,
  inactiveLinks,
  totalInactive,
  onCustomerClick,
  onAccessRevoked,
  onLinkRevoked,
}: {
  caseId: string;
  caseNumber: string;
  debtorName: string;
  activeAccess: CustomerAccess[];
  activeLinks: ShareLink[];
  inactiveAccess: CustomerAccess[];
  inactiveLinks: ShareLink[];
  totalInactive: number;
  onCustomerClick: (item: CustomerAccess) => void;
  onAccessRevoked: (accessId: string) => void;
  onLinkRevoked: (linkId: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<{ type: "customer"; item: CustomerAccess } | { type: "link"; item: ShareLink } | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const revokeCustomerAccess = async (item: CustomerAccess) => {
    setError(null);
    setRevoking(item.id);
    try {
      const response = await fetch(
        `/api/cases/${caseId}/customers?accessId=${item.id}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Zugang konnte nicht widerrufen werden");
      }
      onAccessRevoked(item.id);
      setConfirmRevoke(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Widerrufen");
      setConfirmRevoke(null);
    } finally {
      setRevoking(null);
    }
  };

  const revokeLink = async (link: ShareLink) => {
    setError(null);
    setRevoking(link.id);
    try {
      const response = await fetch(`/api/cases/${caseId}/share?linkId=${link.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Link konnte nicht deaktiviert werden");
      }
      onLinkRevoked(link.id);
      setConfirmRevoke(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Deaktivieren");
      setConfirmRevoke(null);
    } finally {
      setRevoking(null);
    }
  };

  const copyCredentials = async (item: CustomerAccess) => {
    const loginUrl = item.customer.slug
      ? `https://${item.customer.slug}.cases.gradify.de`
      : "https://cases.gradify.de/customer-login";
    const text = `Zugangsdaten für ${debtorName} (${caseNumber}):\n\nURL: ${loginUrl}\nE-Mail: ${item.customer.email}`;
    await copyToClipboard(text);
    setCopiedId(`cred-${item.id}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyShareLink = async (link: ShareLink) => {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/view/${link.token}`;
    await copyToClipboard(shareUrl);
    setCopiedId(`link-${link.id}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const hasActiveItems = activeAccess.length > 0 || activeLinks.length > 0;

  return (
    <>
      {/* Confirm Dialog */}
      {confirmRevoke && confirmRevoke.type === "customer" && (
        <ConfirmDialog
          title="Kundenzugang widerrufen"
          message={`Möchten Sie den Zugang von ${confirmRevoke.item.customer.name}${confirmRevoke.item.customer.company ? ` (${confirmRevoke.item.customer.company})` : ""} wirklich widerrufen?`}
          confirmLabel="Zugang widerrufen"
          confirmVariant="danger"
          onConfirm={() => revokeCustomerAccess(confirmRevoke.item)}
          onCancel={() => setConfirmRevoke(null)}
          loading={revoking === confirmRevoke.item.id}
        />
      )}
      {confirmRevoke && confirmRevoke.type === "link" && (
        <ConfirmDialog
          title="Freigabelink deaktivieren"
          message={`Möchten Sie den Link "${confirmRevoke.item.label}" wirklich deaktivieren?`}
          confirmLabel="Link deaktivieren"
          confirmVariant="danger"
          onConfirm={() => revokeLink(confirmRevoke.item)}
          onCancel={() => setConfirmRevoke(null)}
          loading={revoking === confirmRevoke.item.id}
        />
      )}

      {/* Error Banner */}
      {error && (
        <div className="px-4 pt-3">
          <InlineError message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* Active Items */}
      {hasActiveItems ? (
        <div className="divide-y divide-[var(--border)]">
          {/* Customers */}
          {activeAccess.map((item) => (
            <div key={`access-${item.id}`} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <PersonIcon className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => onCustomerClick(item)}
                      className="font-medium text-[var(--foreground)] hover:text-[var(--primary)] transition-colors text-left truncate block"
                    >
                      {item.customer.name}
                      {item.customer.company && (
                        <span className="text-[var(--secondary)] font-normal ml-1">
                          ({item.customer.company})
                        </span>
                      )}
                    </button>
                    <p className="text-sm text-[var(--secondary)] truncate">{item.customer.email}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                      {item.customer.slug && (
                        <span className="badge text-xs py-0 bg-purple-100 text-purple-700">
                          {item.customer.slug}.cases.gradify.de
                        </span>
                      )}
                      {item.customer.lastLoginAt ? (
                        <span className="badge text-xs py-0 bg-green-100 text-green-700">
                          Letzter Login: {formatDate(item.customer.lastLoginAt)}
                        </span>
                      ) : (
                        <span className="badge text-xs py-0 bg-amber-100 text-amber-700">
                          Noch nie eingeloggt
                        </span>
                      )}
                      {item.expiresAt && (
                        <span className="text-xs text-amber-600">
                          Gültig bis: {formatDate(item.expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => copyCredentials(item)}
                    className="p-2 text-[var(--secondary)] hover:text-[var(--primary)] hover:bg-[var(--accent)] rounded transition-colors"
                    title="Zugangsdaten kopieren"
                  >
                    {copiedId === `cred-${item.id}` ? (
                      <CheckIcon className="w-4 h-4 text-green-600" />
                    ) : (
                      <CopyIcon className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => setConfirmRevoke({ type: "customer", item })}
                    className="p-2 text-[var(--secondary)] hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Zugang widerrufen"
                  >
                    <RevokeIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Links */}
          {activeLinks.map((link) => (
            <div key={`link-${link.id}`} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <LinkIcon className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--foreground)] truncate">{link.label}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[var(--muted)]">
                      <span>{link.accessCount} Aufrufe</span>
                      {link.lastAccessAt && (
                        <>
                          <span className="text-[var(--border)]">|</span>
                          <span>Zuletzt: {formatDate(link.lastAccessAt)}</span>
                        </>
                      )}
                      <span className="text-[var(--border)]">|</span>
                      <span>Erstellt: {formatDate(link.createdAt)}</span>
                    </div>
                    {link.expiresAt && (
                      <p className="text-xs text-amber-600 mt-1">
                        Gültig bis: {formatDate(link.expiresAt)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <a
                    href={`/view/${link.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-[var(--secondary)] hover:text-[var(--primary)] hover:bg-blue-50 rounded transition-colors"
                    title="Ansicht öffnen"
                  >
                    <ExternalLinkIcon className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => copyShareLink(link)}
                    className="p-2 text-[var(--secondary)] hover:text-[var(--primary)] hover:bg-[var(--accent)] rounded transition-colors"
                    title="Link kopieren"
                  >
                    {copiedId === `link-${link.id}` ? (
                      <CheckIcon className="w-4 h-4 text-green-600" />
                    ) : (
                      <CopyIcon className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => setConfirmRevoke({ type: "link", item: link })}
                    className="p-2 text-[var(--secondary)] hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Link deaktivieren"
                  >
                    <RevokeIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center text-[var(--muted)]">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-[var(--border)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <p className="text-sm font-medium">Keine aktiven Freigaben</p>
          <p className="text-xs mt-1">Klicken Sie &ldquo;Zugang einrichten&rdquo; um Zugriff zu erteilen</p>
        </div>
      )}

      {/* Inactive Items */}
      {totalInactive > 0 && (
        <div className="border-t border-[var(--border)]">
          <details className="group">
            <summary className="px-4 py-3 cursor-pointer text-sm text-[var(--muted)] hover:bg-[var(--accent)] flex items-center">
              <svg
                className="w-4 h-4 mr-2 transition-transform group-open:rotate-90"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {totalInactive} widerrufene Einträge
            </summary>
            <div className="divide-y divide-[var(--border)]">
              {inactiveAccess.map((item) => (
                <div key={`inactive-access-${item.id}`} className="p-4 bg-[var(--accent)] opacity-60">
                  <div className="flex items-center gap-2">
                    <PersonIcon className="w-4 h-4 text-[var(--muted)]" />
                    <span className="text-sm text-[var(--secondary)]">{item.customer.name}</span>
                  </div>
                  <p className="text-xs text-[var(--muted)] ml-6">
                    Erteilt: {formatDate(item.grantedAt)} | {item.accessCount} Zugriffe
                  </p>
                </div>
              ))}
              {inactiveLinks.map((link) => (
                <div key={`inactive-link-${link.id}`} className="p-4 bg-[var(--accent)] opacity-60">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-[var(--muted)]" />
                    <span className="text-sm text-[var(--secondary)]">{link.label}</span>
                  </div>
                  <p className="text-xs text-[var(--muted)] ml-6">
                    Erstellt: {formatDate(link.createdAt)} | {link.accessCount} Aufrufe
                  </p>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </>
  );
}

// ─── Grant Flow Wizard ──────────────────────────────────────────────────────

type GrantMode = "existing" | "new" | "link";
type WizardStep = "mode" | "form" | "summary" | "result";

function GrantFlowWizard({
  caseId,
  caseNumber,
  debtorName,
  existingAccess,
  onClose,
  onAccessCreated,
  onLinkCreated,
}: {
  caseId: string;
  caseNumber: string;
  debtorName: string;
  existingAccess: CustomerAccess[];
  onClose: () => void;
  onAccessCreated: (access: CustomerAccess) => void;
  onLinkCreated: (link: ShareLink) => void;
}) {
  const [step, setStep] = useState<WizardStep>("mode");
  const [mode, setMode] = useState<GrantMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Existing customer selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  // New customer form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<{
    available: boolean | null;
    checking: boolean;
    error: string | null;
  }>({ available: null, checking: false, error: null });

  // Link form
  const [linkLabel, setLinkLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<number | "">("");

  // Result
  const [resultCustomer, setResultCustomer] = useState<Customer | null>(null);
  const [resultPassword, setResultPassword] = useState<string | null>(null);
  const [resultLink, setResultLink] = useState<ShareLink | null>(null);
  const [copied, setCopied] = useState(false);

  // Load available customers
  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const response = await fetch("/api/customers?isActive=true", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        const activeCustomerIds = new Set(
          existingAccess.filter((a) => a.isActive).map((a) => a.customerId)
        );
        setCustomers(data.filter((c: Customer) => !activeCustomerIds.has(c.id)));
      }
    } catch {
      setError("Kundenliste konnte nicht geladen werden");
    } finally {
      setLoadingCustomers(false);
    }
  };

  // Slug availability check
  const checkSlug = useCallback(async (slug: string) => {
    if (!slug) {
      setSlugStatus({ available: null, checking: false, error: null });
      return;
    }
    if (slug.length < 3) {
      setSlugStatus({ available: null, checking: false, error: "Mindestens 3 Zeichen" });
      return;
    }
    if (slug.length > 30) {
      setSlugStatus({ available: null, checking: false, error: "Maximal 30 Zeichen" });
      return;
    }
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
      setSlugStatus({ available: null, checking: false, error: "Nur Kleinbuchstaben, Ziffern und Bindestriche" });
      return;
    }

    setSlugStatus({ available: null, checking: true, error: null });
    try {
      const response = await fetch(
        `/api/customers/check-slug?slug=${encodeURIComponent(slug)}`,
        { credentials: "include" }
      );
      if (response.ok) {
        const data = await response.json();
        setSlugStatus({
          available: data.available,
          checking: false,
          error: data.available ? null : (data.error || "Bereits vergeben"),
        });
      }
    } catch {
      setSlugStatus({ available: null, checking: false, error: null });
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => checkSlug(newSlug), 400);
    return () => clearTimeout(timer);
  }, [newSlug, checkSlug]);

  // Auto-suggest slug from company name
  useEffect(() => {
    if (newCompany && !newSlug) {
      setNewSlug(suggestSlug(newCompany));
    }
  }, [newCompany]);

  const selectMode = (m: GrantMode) => {
    setMode(m);
    setError(null);
    setStep("form");
  };

  const getSelectedCustomer = () => customers.find((c) => c.id === selectedCustomerId);

  const canProceedToSummary = (): boolean => {
    if (mode === "existing") return !!selectedCustomerId;
    if (mode === "new") return !!(newName.trim() && newEmail.trim()) && !(newSlug.length > 0 && slugStatus.available === false);
    if (mode === "link") return true;
    return false;
  };

  const getSummaryItems = (): { label: string; value: string }[] => {
    if (mode === "existing") {
      const c = getSelectedCustomer();
      return [
        { label: "Typ", value: "Bestehender Kunde" },
        { label: "Name", value: c?.name || "" },
        { label: "E-Mail", value: c?.email || "" },
        ...(c?.company ? [{ label: "Unternehmen", value: c.company }] : []),
        ...(c?.slug ? [{ label: "Subdomain", value: `${c.slug}.cases.gradify.de` }] : []),
      ];
    }
    if (mode === "new") {
      return [
        { label: "Typ", value: "Neuer Kunde" },
        { label: "Name", value: newName.trim() },
        { label: "E-Mail", value: newEmail.trim() },
        ...(newCompany.trim() ? [{ label: "Unternehmen", value: newCompany.trim() }] : []),
        ...(newSlug.trim() ? [{ label: "Subdomain", value: `${newSlug.trim()}.cases.gradify.de` }] : []),
      ];
    }
    if (mode === "link") {
      return [
        { label: "Typ", value: "Externer Link" },
        { label: "Bezeichnung", value: linkLabel.trim() || "Externer Zugang" },
        { label: "Gültigkeit", value: expiresInDays ? `${expiresInDays} Tage` : "Unbegrenzt" },
      ];
    }
    return [];
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);

    try {
      if (mode === "link") {
        // Create share link
        const expiresAt = expiresInDays
          ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000).toISOString()
          : null;

        const response = await fetch(`/api/cases/${caseId}/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            label: linkLabel.trim() || "Externer Zugang",
            expiresAt,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Link konnte nicht erstellt werden");
        }

        const newLink = await response.json();
        onLinkCreated(newLink);
        setResultLink(newLink);
        setStep("result");
        return;
      }

      // Customer flow (existing or new)
      let customerId: string;
      let customer: Customer;
      let password: string | null = null;

      if (mode === "new") {
        const createResponse = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: newName.trim(),
            email: newEmail.trim(),
            company: newCompany.trim() || null,
            slug: newSlug.trim() || null,
          }),
        });

        const result = await createResponse.json();
        if (!createResponse.ok) {
          throw new Error(result.error || "Fehler beim Erstellen des Kunden");
        }

        customerId = result.customer.id;
        customer = {
          ...result.customer,
          slug: result.customer.slug || null,
          isActive: true,
          lastLoginAt: null,
          loginCount: 0,
          phone: null,
        };
        password = result.temporaryPassword;
      } else {
        customerId = selectedCustomerId;
        const selectedCustomer = getSelectedCustomer();
        if (!selectedCustomer) throw new Error("Kunde nicht gefunden");
        customer = selectedCustomer;
      }

      // Grant access
      const accessResponse = await fetch(`/api/cases/${caseId}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ customerId, accessLevel: "VIEW" }),
      });

      const accessData = await accessResponse.json();
      if (!accessResponse.ok) {
        throw new Error(accessData.error || "Fehler beim Erteilen des Zugangs");
      }

      onAccessCreated(accessData);
      setResultCustomer(customer);
      setResultPassword(password);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler bei der Freigabe");
    } finally {
      setSubmitting(false);
    }
  };

  const getInviteText = () => {
    const loginUrl = resultCustomer?.slug
      ? `https://${resultCustomer.slug}.cases.gradify.de`
      : "https://cases.gradify.de/customer-login";

    let text = `Ihre Zugangsdaten für die Liquiditätsplanung:\n\n`;
    text += `URL: ${loginUrl}\n`;
    text += `E-Mail: ${resultCustomer?.email}\n`;
    if (resultPassword) {
      text += `Passwort: ${resultPassword}\n`;
    }
    text += `\nFall: ${debtorName} (${caseNumber})\n`;
    text += `\nBei Fragen wenden Sie sich an unser Team.`;
    return text;
  };

  const copyResult = async () => {
    let text: string;
    if (resultLink) {
      const baseUrl = window.location.origin;
      text = `${baseUrl}/view/${resultLink.token}`;
    } else {
      text = getInviteText();
    }
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stepTitle = (): string => {
    switch (step) {
      case "mode": return "Zugang einrichten";
      case "form": return mode === "existing" ? "Bestehenden Kunden wählen" : mode === "new" ? "Neuen Kunden anlegen" : "Externen Link erstellen";
      case "summary": return "Zusammenfassung";
      case "result": return resultLink ? "Link erstellt" : "Einladungstext";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card)] rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{stepTitle()}</h3>
          <button
            onClick={onClose}
            className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step 1: Mode Selection */}
        {step === "mode" && (
          <div className="p-6 space-y-3">
            <button
              onClick={() => selectMode("existing")}
              className="w-full p-4 rounded-lg border border-[var(--border)] hover:border-[var(--primary)] hover:bg-blue-50/50 transition-colors text-left flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <PersonIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Bestehender Kunde</p>
                <p className="text-sm text-[var(--secondary)] mt-0.5">Einem bereits angelegten Kunden Zugriff erteilen</p>
              </div>
            </button>
            <button
              onClick={() => selectMode("new")}
              className="w-full p-4 rounded-lg border border-[var(--border)] hover:border-[var(--primary)] hover:bg-blue-50/50 transition-colors text-left flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Neuer Kunde</p>
                <p className="text-sm text-[var(--secondary)] mt-0.5">Neuen Kunden anlegen und Zugriff erteilen</p>
              </div>
            </button>
            <button
              onClick={() => selectMode("link")}
              className="w-full p-4 rounded-lg border border-[var(--border)] hover:border-[var(--primary)] hover:bg-blue-50/50 transition-colors text-left flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <LinkIcon className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">Externer Link</p>
                <p className="text-sm text-[var(--secondary)] mt-0.5">Anonymen Ansichtslink ohne Login erstellen</p>
              </div>
            </button>
          </div>
        )}

        {/* Step 2: Form */}
        {step === "form" && (
          <div className="p-6 space-y-4">
            {error && <InlineError message={error} onDismiss={() => setError(null)} />}

            {mode === "existing" && (
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  Kunde auswählen
                </label>
                {loadingCustomers ? (
                  <div className="input-field bg-[var(--accent)] text-[var(--muted)]">Wird geladen...</div>
                ) : customers.length === 0 ? (
                  <div className="p-3 bg-[var(--accent)] rounded-md text-sm text-[var(--muted)]">
                    Keine verfügbaren Kunden. Alle haben bereits Zugriff oder es wurden noch keine Kunden angelegt.
                  </div>
                ) : (
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Kunde auswählen...</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                        {customer.company && ` (${customer.company})`}
                        {" – "}
                        {customer.email}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {mode === "new" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="z.B. Hannes Rieger"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                    E-Mail <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="z.B. rieger@anchor-rechtsanwaelte.de"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                    Unternehmen
                  </label>
                  <input
                    type="text"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    placeholder="z.B. Anchor Rechtsanwälte"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                    Subdomain
                    <span className="text-[var(--muted)] font-normal ml-1">(optional)</span>
                  </label>
                  <div className="flex items-center gap-0">
                    <input
                      type="text"
                      value={newSlug}
                      onChange={(e) =>
                        setNewSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, "")
                            .replace(/--+/g, "-")
                        )
                      }
                      placeholder="z.B. anchor"
                      className="input-field rounded-r-none flex-1"
                    />
                    <span className="inline-flex items-center px-3 h-[38px] border border-l-0 border-[var(--border)] bg-[var(--accent)] text-sm text-[var(--muted)] rounded-r-md whitespace-nowrap">
                      .cases.gradify.de
                    </span>
                  </div>
                  {newSlug && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {slugStatus.checking ? (
                        <>
                          <span className="w-3 h-3 border-2 border-[var(--muted)] border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-[var(--muted)]">Wird geprüft...</span>
                        </>
                      ) : slugStatus.available === true ? (
                        <>
                          <CheckIcon className="w-3.5 h-3.5 text-green-600" />
                          <span className="text-xs text-green-600">
                            {newSlug}.cases.gradify.de ist verfügbar
                          </span>
                        </>
                      ) : slugStatus.error ? (
                        <>
                          <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span className="text-xs text-red-500">{slugStatus.error}</span>
                        </>
                      ) : null}
                    </div>
                  )}
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Eigene URL für den Kunden. Kann später eingerichtet werden.
                  </p>
                </div>
              </div>
            )}

            {mode === "link" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                    Bezeichnung
                  </label>
                  <input
                    type="text"
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    placeholder="z.B. Dr. Müller – Insolvenzverwalter"
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
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setStep("mode"); setMode(null); setError(null); }}
                className="btn-secondary"
              >
                Zurück
              </button>
              <button
                onClick={() => setStep("summary")}
                disabled={!canProceedToSummary()}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Weiter
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Summary */}
        {step === "summary" && (
          <div className="p-6 space-y-4">
            {error && <InlineError message={error} onDismiss={() => setError(null)} />}

            <div className="bg-[var(--accent)] rounded-lg p-4 space-y-2">
              {getSummaryItems().map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-[var(--secondary)]">{item.label}</span>
                  <span className="text-[var(--foreground)] font-medium">{item.value}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-2 border-t border-[var(--border)]">
                <span className="text-[var(--secondary)]">Fall</span>
                <span className="text-[var(--foreground)] font-medium">{debtorName}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setStep("form"); setError(null); }}
                className="btn-secondary"
              >
                Zurück
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Wird erstellt...
                  </span>
                ) : (
                  "Bestätigen"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Result */}
        {step === "result" && (
          <div className="p-6 space-y-4">
            <InlineSuccess message={resultLink ? "Link wurde erstellt" : "Zugang wurde erfolgreich erteilt"} />

            {resultLink ? (
              <div className="bg-[var(--accent)] rounded-lg p-4">
                <p className="text-xs text-[var(--secondary)] mb-1">Freigabelink</p>
                <p className="text-sm text-[var(--foreground)] font-mono break-all">
                  {typeof window !== "undefined" ? window.location.origin : ""}/view/{resultLink.token}
                </p>
              </div>
            ) : (
              <>
                <div className="bg-[var(--accent)] rounded-lg p-4">
                  <pre className="text-sm text-[var(--foreground)] whitespace-pre-wrap font-mono leading-relaxed">
                    {getInviteText()}
                  </pre>
                </div>
                {resultPassword && (
                  <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span>
                      Das Passwort wird nur einmalig angezeigt. Bitte jetzt kopieren und sicher übermitteln.
                    </span>
                  </div>
                )}
              </>
            )}

            <div className="flex gap-2">
              <button
                onClick={copyResult}
                className={`flex-1 flex items-center justify-center gap-2 ${
                  copied ? "btn-secondary text-green-600" : "btn-primary"
                }`}
              >
                {copied ? (
                  <>
                    <CheckIcon className="w-4 h-4" />
                    Kopiert!
                  </>
                ) : (
                  <>
                    <CopyIcon className="w-4 h-4" />
                    {resultLink ? "Link kopieren" : "Alles kopieren"}
                  </>
                )}
              </button>
              <button onClick={onClose} className="btn-secondary">
                Schließen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Customer SlideOver ─────────────────────────────────────────────────────

function CustomerSlideOver({
  caseId,
  caseNumber,
  debtorName,
  accessItem,
  onClose,
  onCustomerUpdated,
  onAccessRevoked,
}: {
  caseId: string;
  caseNumber: string;
  debtorName: string;
  accessItem: CustomerAccess;
  onClose: () => void;
  onCustomerUpdated: (updated: Partial<Customer> & { id: string }) => void;
  onAccessRevoked: (accessId: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [customerData, setCustomerData] = useState<{
    id: string;
    name: string;
    email: string;
    company: string | null;
    phone: string | null;
    slug?: string | null;
    lastLoginAt: string | null;
    loginCount: number;
    isActive: boolean;
    createdAt: string;
    createdBy: string;
  } | null>(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [confirmResetPw, setConfirmResetPw] = useState(false);
  const [resettingPw, setResettingPw] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copiedPw, setCopiedPw] = useState(false);

  useEffect(() => {
    loadCustomerDetails();
  }, [accessItem.customerId]);

  // Close on Escape (but not if a confirm dialog is open)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmRevoke || confirmResetPw) {
          setConfirmRevoke(false);
          setConfirmResetPw(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, confirmRevoke, confirmResetPw]);

  const loadCustomerDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/customers/${accessItem.customerId}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setCustomerData(data);
        setEditName(data.name);
        setEditCompany(data.company || "");
        setEditPhone(data.phone || "");
      } else {
        setError("Kundendaten konnten nicht geladen werden");
      }
    } catch {
      setError("Kundendaten konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  const saveChanges = async () => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const response = await fetch(`/api/customers/${accessItem.customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editName.trim(),
          company: editCompany.trim() || null,
          phone: editPhone.trim() || null,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Fehler beim Speichern");
      }
      const result = await response.json();
      setCustomerData((prev) => prev ? { ...prev, ...result.customer } : prev);
      onCustomerUpdated({ id: accessItem.customerId, ...result.customer });
      setEditing(false);
      setSuccess("Änderungen gespeichert");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    setError(null);
    setResettingPw(true);
    try {
      const response = await fetch(`/api/customers/${accessItem.customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ resetPassword: true }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Fehler beim Zurücksetzen des Passworts");
      }
      const result = await response.json();
      setTempPassword(result.temporaryPassword);
      setConfirmResetPw(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Zurücksetzen");
      setConfirmResetPw(false);
    } finally {
      setResettingPw(false);
    }
  };

  const revokeAccess = async () => {
    setError(null);
    setRevoking(true);
    try {
      const response = await fetch(
        `/api/cases/${caseId}/customers?accessId=${accessItem.id}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Zugang konnte nicht widerrufen werden");
      }
      onAccessRevoked(accessItem.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Widerrufen");
      setConfirmRevoke(false);
    } finally {
      setRevoking(false);
    }
  };

  const copyPassword = async () => {
    if (!tempPassword) return;
    const loginUrl = accessItem.customer.slug
      ? `https://${accessItem.customer.slug}.cases.gradify.de`
      : "https://cases.gradify.de/customer-login";
    const text = `Neues Passwort für ${debtorName} (${caseNumber}):\n\nURL: ${loginUrl}\nE-Mail: ${customerData?.email || accessItem.customer.email}\nPasswort: ${tempPassword}`;
    await copyToClipboard(text);
    setCopiedPw(true);
    setTimeout(() => setCopiedPw(false), 2000);
  };

  return (
    <>
      {/* Confirm Dialogs */}
      {confirmRevoke && (
        <ConfirmDialog
          title="Kundenzugang widerrufen"
          message={`Möchten Sie den Zugang von ${accessItem.customer.name} zu diesem Fall wirklich widerrufen?`}
          confirmLabel="Zugang widerrufen"
          confirmVariant="danger"
          onConfirm={revokeAccess}
          onCancel={() => setConfirmRevoke(false)}
          loading={revoking}
        />
      )}
      {confirmResetPw && (
        <ConfirmDialog
          title="Passwort zurücksetzen"
          message={`Das aktuelle Passwort von ${accessItem.customer.name} wird ungültig und durch ein neues temporäres Passwort ersetzt.`}
          confirmLabel="Passwort zurücksetzen"
          confirmVariant="primary"
          onConfirm={resetPassword}
          onCancel={() => setConfirmResetPw(false)}
          loading={resettingPw}
        />
      )}

      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-50 animate-[fadeIn_150ms_ease-out]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-[400px] bg-[var(--card)] shadow-xl z-50 flex flex-col overflow-hidden animate-[slideInRight_200ms_ease-out]">
        <style>{`
          @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
        {/* Panel Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-base font-semibold text-[var(--foreground)] truncate">
            {accessItem.customer.name}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && <InlineError message={error} onDismiss={() => setError(null)} />}
          {success && <InlineSuccess message={success} />}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : customerData ? (
            <>
              {/* Customer Info / Edit Form */}
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--secondary)] mb-1">Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--secondary)] mb-1">Unternehmen</label>
                    <input
                      type="text"
                      value={editCompany}
                      onChange={(e) => setEditCompany(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--secondary)] mb-1">Telefon</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={saveChanges}
                      disabled={saving || !editName.trim()}
                      className="btn-primary flex-1 text-sm disabled:opacity-50"
                    >
                      {saving ? "Wird gespeichert..." : "Speichern"}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setEditName(customerData.name);
                        setEditCompany(customerData.company || "");
                        setEditPhone(customerData.phone || "");
                      }}
                      className="btn-secondary text-sm"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2.5 flex-1">
                      <InfoRow label="E-Mail" value={customerData.email} />
                      {customerData.company && <InfoRow label="Unternehmen" value={customerData.company} />}
                      {customerData.phone && <InfoRow label="Telefon" value={customerData.phone} />}
                      {accessItem.customer.slug && (
                        <InfoRow label="Subdomain" value={`${accessItem.customer.slug}.cases.gradify.de`} />
                      )}
                    </div>
                    <button
                      onClick={() => setEditing(true)}
                      className="p-1.5 text-[var(--secondary)] hover:text-[var(--primary)] hover:bg-[var(--accent)] rounded transition-colors flex-shrink-0"
                      title="Bearbeiten"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                  </div>

                  {/* Login Status */}
                  <div className="bg-[var(--accent)] rounded-lg p-3 mt-3">
                    <p className="text-xs font-medium text-[var(--secondary)] mb-1.5">Login-Status</p>
                    {customerData.lastLoginAt ? (
                      <div className="space-y-1">
                        <p className="text-sm text-[var(--foreground)]">
                          Letzter Login: {formatDate(customerData.lastLoginAt)}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          {customerData.loginCount} Anmeldungen insgesamt
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-amber-600">Noch nie eingeloggt</p>
                    )}
                  </div>

                  {/* Zugang-Info */}
                  <div className="bg-[var(--accent)] rounded-lg p-3">
                    <p className="text-xs font-medium text-[var(--secondary)] mb-1.5">Zugang zu diesem Fall</p>
                    <div className="space-y-1 text-xs text-[var(--muted)]">
                      <p>Erteilt am {formatDate(accessItem.grantedAt)} von {accessItem.grantedBy}</p>
                      {accessItem.accessCount > 0 && <p>{accessItem.accessCount} Zugriffe auf diesen Fall</p>}
                      {accessItem.lastAccessedAt && <p>Letzter Zugriff: {formatDate(accessItem.lastAccessedAt)}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Temporary Password Display */}
              {tempPassword && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-amber-700">Neues temporäres Passwort</p>
                  <p className="text-sm font-mono text-amber-900 bg-amber-100 rounded px-2 py-1">{tempPassword}</p>
                  <button
                    onClick={copyPassword}
                    className={`text-xs flex items-center gap-1 ${copiedPw ? "text-green-600" : "text-amber-700 hover:text-amber-900"}`}
                  >
                    {copiedPw ? (
                      <>
                        <CheckIcon className="w-3.5 h-3.5" />
                        Zugangsdaten kopiert
                      </>
                    ) : (
                      <>
                        <CopyIcon className="w-3.5 h-3.5" />
                        Zugangsdaten kopieren
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Actions */}
              {!editing && (
                <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                  <button
                    onClick={() => setConfirmResetPw(true)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] rounded-md transition-colors"
                  >
                    <KeyIcon className="w-4 h-4 text-[var(--secondary)]" />
                    Passwort zurücksetzen
                  </button>
                  <button
                    onClick={() => setConfirmRevoke(true)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <RevokeIcon className="w-4 h-4" />
                    Zugang widerrufen
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

// ─── Info Row Helper ────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--secondary)]">{label}</p>
      <p className="text-sm text-[var(--foreground)]">{value}</p>
    </div>
  );
}
