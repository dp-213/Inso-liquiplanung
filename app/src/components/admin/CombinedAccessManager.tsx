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

// ─── Tab Selector ───────────────────────────────────────────────────────────

type Tab = "customers" | "links";

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CombinedAccessManager({
  caseId,
  caseNumber,
  debtorName,
  initialAccess,
  initialLinks,
}: CombinedAccessManagerProps) {
  const [tab, setTab] = useState<Tab>("customers");
  const [access, setAccess] = useState<CustomerAccess[]>(initialAccess);
  const [links, setLinks] = useState<ShareLink[]>(initialLinks);
  const [showGrantFlow, setShowGrantFlow] = useState(false);

  const activeAccessCount = access.filter((a) => a.isActive).length;
  const activeLinksCount = links.filter((l) => l.isActive).length;

  return (
    <div className="space-y-4">
      {/* Primary Action Button */}
      <div className="admin-card p-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Zugangsfreigaben
          </h2>
          <p className="text-sm text-[var(--secondary)]">
            {activeAccessCount} Kundenzugänge, {activeLinksCount} externe Links
          </p>
        </div>
        <button
          onClick={() => setShowGrantFlow(true)}
          className="btn-primary flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Fall freigeben
        </button>
      </div>

      {/* Grant Flow Modal */}
      {showGrantFlow && (
        <GrantFlowModal
          caseId={caseId}
          caseNumber={caseNumber}
          debtorName={debtorName}
          existingAccess={access}
          onClose={() => setShowGrantFlow(false)}
          onAccessCreated={(newAccess) => {
            setAccess([newAccess, ...access]);
            setTab("customers");
          }}
        />
      )}

      {/* Tabs */}
      <div className="admin-card">
        <div className="flex border-b border-[var(--border)]">
          <button
            onClick={() => setTab("customers")}
            className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === "customers"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--secondary)] hover:text-[var(--foreground)]"
            }`}
          >
            Kundenzugänge ({activeAccessCount})
          </button>
          <button
            onClick={() => setTab("links")}
            className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === "links"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--secondary)] hover:text-[var(--foreground)]"
            }`}
          >
            Externe Links ({activeLinksCount})
          </button>
        </div>

        {/* Tab Content */}
        {tab === "customers" && (
          <CustomerAccessTab
            caseId={caseId}
            access={access}
            setAccess={setAccess}
          />
        )}
        {tab === "links" && (
          <ShareLinksTab
            caseId={caseId}
            links={links}
            setLinks={setLinks}
          />
        )}
      </div>
    </div>
  );
}

// ─── Grant Flow Modal ───────────────────────────────────────────────────────

function GrantFlowModal({
  caseId,
  caseNumber,
  debtorName,
  existingAccess,
  onClose,
  onAccessCreated,
}: {
  caseId: string;
  caseNumber: string;
  debtorName: string;
  existingAccess: CustomerAccess[];
  onClose: () => void;
  onAccessCreated: (access: CustomerAccess) => void;
}) {
  const [step, setStep] = useState<"select" | "invite">("select");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [error, setError] = useState<string | null>(null);

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

  // Common
  const [submitting, setSubmitting] = useState(false);

  // Result (for invite step)
  const [resultCustomer, setResultCustomer] = useState<Customer | null>(null);
  const [resultPassword, setResultPassword] = useState<string | null>(null);
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

  // Slug availability check (debounced)
  const checkSlug = useCallback(async (slug: string) => {
    if (!slug) {
      setSlugStatus({ available: null, checking: false, error: null });
      return;
    }
    if (slug.length < 3) {
      setSlugStatus({
        available: null,
        checking: false,
        error: "Mindestens 3 Zeichen",
      });
      return;
    }
    if (slug.length > 30) {
      setSlugStatus({
        available: null,
        checking: false,
        error: "Maximal 30 Zeichen",
      });
      return;
    }
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
      setSlugStatus({
        available: null,
        checking: false,
        error: "Nur Kleinbuchstaben, Ziffern und Bindestriche",
      });
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

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);

    try {
      let customerId: string;
      let customer: Customer;
      let password: string | null = null;

      if (mode === "new") {
        // Create new customer
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
        };
        password = result.temporaryPassword;
      } else {
        // Use existing customer
        customerId = selectedCustomerId;
        const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
        if (!selectedCustomer) throw new Error("Kunde nicht gefunden");
        customer = selectedCustomer;
      }

      // Grant access
      const accessResponse = await fetch(`/api/cases/${caseId}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customerId,
          accessLevel: "VIEW",
        }),
      });

      const accessData = await accessResponse.json();

      if (!accessResponse.ok) {
        throw new Error(accessData.error || "Fehler beim Erteilen des Zugangs");
      }

      onAccessCreated(accessData);

      // Show invite step
      setResultCustomer(customer);
      setResultPassword(password);
      setStep("invite");
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

  const copyInviteText = async () => {
    try {
      await navigator.clipboard.writeText(getInviteText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = getInviteText();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isSubmitDisabled =
    submitting ||
    (mode === "existing" && !selectedCustomerId) ||
    (mode === "new" && (!newName.trim() || !newEmail.trim())) ||
    (mode === "new" && newSlug.length > 0 && slugStatus.available === false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card)] rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            {step === "select" ? "Fall freigeben" : "Einladungstext"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Step 1: Select or Create Customer */}
        {step === "select" && (
          <div className="p-6 space-y-4">
            {/* Error Banner */}
            {error && (
              <InlineError message={error} onDismiss={() => setError(null)} />
            )}

            {/* Mode Switch */}
            <div className="flex gap-2">
              <button
                onClick={() => { setMode("existing"); setError(null); }}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  mode === "existing"
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--accent)] text-[var(--secondary)] hover:bg-[var(--border)]"
                }`}
              >
                Bestehender Kunde
              </button>
              <button
                onClick={() => { setMode("new"); setError(null); }}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  mode === "new"
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--accent)] text-[var(--secondary)] hover:bg-[var(--border)]"
                }`}
              >
                Neuer Kunde
              </button>
            </div>

            {mode === "existing" && (
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  Kunde auswählen
                </label>
                {loadingCustomers ? (
                  <div className="input-field bg-[var(--accent)] text-[var(--muted)]">
                    Wird geladen...
                  </div>
                ) : customers.length === 0 ? (
                  <div className="p-3 bg-[var(--accent)] rounded-md text-sm text-[var(--muted)]">
                    Keine verfügbaren Kunden. Alle haben bereits Zugriff oder es wurden
                    noch keine Kunden angelegt.
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
                  {/* Slug-Status-Feedback */}
                  {newSlug && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {slugStatus.checking ? (
                        <>
                          <span className="w-3 h-3 border-2 border-[var(--muted)] border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-[var(--muted)]">Wird geprüft...</span>
                        </>
                      ) : slugStatus.available === true ? (
                        <>
                          <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
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

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Wird erstellt...
                  </span>
                ) : (
                  "Zugang erteilen"
                )}
              </button>
              <button onClick={onClose} className="btn-secondary">
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Invitation Text */}
        {step === "invite" && (
          <div className="p-6 space-y-4">
            <InlineSuccess message="Zugang wurde erfolgreich erteilt" />

            <div className="bg-[var(--accent)] rounded-lg p-4">
              <pre className="text-sm text-[var(--foreground)] whitespace-pre-wrap font-mono leading-relaxed">
                {getInviteText()}
              </pre>
            </div>

            {resultPassword && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3">
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
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <span>
                  Das Passwort wird nur einmalig angezeigt. Bitte jetzt kopieren und sicher übermitteln.
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={copyInviteText}
                className={`flex-1 flex items-center justify-center gap-2 ${
                  copied ? "btn-secondary text-green-600" : "btn-primary"
                }`}
              >
                {copied ? (
                  <>
                    <svg
                      className="w-4 h-4"
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
                    Kopiert!
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Alles kopieren
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

// ─── Customer Access Tab ────────────────────────────────────────────────────

function CustomerAccessTab({
  caseId,
  access,
  setAccess,
}: {
  caseId: string;
  access: CustomerAccess[];
  setAccess: (access: CustomerAccess[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<CustomerAccess | null>(null);

  const revokeAccess = async (item: CustomerAccess) => {
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
      setAccess(access.map((a) => (a.id === item.id ? { ...a, isActive: false } : a)));
      setConfirmRevoke(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Widerrufen des Zugangs");
      setConfirmRevoke(null);
    } finally {
      setRevoking(null);
    }
  };

  const getAccessLevelLabel = (level: string): string => {
    switch (level) {
      case "VIEW": return "Ansicht";
      case "COMMENT": return "Kommentieren";
      case "DOWNLOAD": return "Herunterladen";
      default: return level;
    }
  };

  const activeAccess = access.filter((a) => a.isActive);
  const inactiveAccess = access.filter((a) => !a.isActive);

  return (
    <>
      {/* Confirm Dialog */}
      {confirmRevoke && (
        <ConfirmDialog
          title="Kundenzugang widerrufen"
          message={`Möchten Sie den Zugang von ${confirmRevoke.customer.name}${confirmRevoke.customer.company ? ` (${confirmRevoke.customer.company})` : ""} wirklich widerrufen? Der Kunde kann dann nicht mehr auf diesen Fall zugreifen.`}
          confirmLabel="Zugang widerrufen"
          confirmVariant="danger"
          onConfirm={() => revokeAccess(confirmRevoke)}
          onCancel={() => setConfirmRevoke(null)}
          loading={revoking === confirmRevoke.id}
        />
      )}

      {/* Error Banner */}
      {error && (
        <div className="px-4 pt-3">
          <InlineError message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <div className="divide-y divide-[var(--border)]">
        {activeAccess.length > 0 ? (
          activeAccess.map((item) => (
            <div key={item.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[var(--foreground)] truncate">
                    {item.customer.name}
                    {item.customer.company && (
                      <span className="text-[var(--secondary)] font-normal ml-1">
                        ({item.customer.company})
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-[var(--secondary)]">{item.customer.email}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-[var(--muted)]">
                    <span className="badge badge-info text-xs py-0">
                      {getAccessLevelLabel(item.accessLevel)}
                    </span>
                    {item.customer.slug && (
                      <span className="badge text-xs py-0 bg-purple-100 text-purple-700">
                        {item.customer.slug}.cases.gradify.de
                      </span>
                    )}
                    {item.accessCount > 0 && (
                      <span>{item.accessCount} Zugriffe</span>
                    )}
                    {item.lastAccessedAt && (
                      <>
                        <span className="text-[var(--border)]">|</span>
                        <span>
                          Zuletzt:{" "}
                          {new Date(item.lastAccessedAt).toLocaleDateString("de-DE")}
                        </span>
                      </>
                    )}
                  </div>
                  {item.expiresAt && (
                    <p className="text-xs text-amber-600 mt-1">
                      Gültig bis: {new Date(item.expiresAt).toLocaleDateString("de-DE")}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setConfirmRevoke(item)}
                  className="p-2 text-[var(--secondary)] hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Zugang widerrufen"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-[var(--muted)]">
            <svg
              className="w-10 h-10 mx-auto mb-2 text-[var(--border)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <p className="text-sm">Keine Kundenzugänge</p>
            <p className="text-xs mt-1">
              Klicken Sie &ldquo;Fall freigeben&rdquo; um einem Kunden Zugriff zu erteilen
            </p>
          </div>
        )}
      </div>

      {inactiveAccess.length > 0 && (
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
              {inactiveAccess.length} widerrufene Zugänge
            </summary>
            <div className="divide-y divide-[var(--border)]">
              {inactiveAccess.map((item) => (
                <div key={item.id} className="p-4 bg-[var(--accent)] opacity-60">
                  <p className="text-sm text-[var(--secondary)]">{item.customer.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    Erteilt: {new Date(item.grantedAt).toLocaleDateString("de-DE")} |{" "}
                    {item.accessCount} Zugriffe
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

// ─── Share Links Tab ────────────────────────────────────────────────────────

function ShareLinksTab({
  caseId,
  links,
  setLinks,
}: {
  caseId: string;
  links: ShareLink[];
  setLinks: (links: ShareLink[]) => void;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<number | "">("");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<ShareLink | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const createLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);

    try {
      const expiresAt = expiresInDays
        ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const response = await fetch(`/api/cases/${caseId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          label: newLabel || "Externer Zugang",
          expiresAt,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Link konnte nicht erstellt werden");
      }

      const newLink = await response.json();
      setLinks([newLink, ...links]);
      setShowCreateForm(false);
      setNewLabel("");
      setExpiresInDays("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Erstellen des Freigabelinks");
    } finally {
      setCreating(false);
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
      setLinks(links.map((l) => (l.id === link.id ? { ...l, isActive: false } : l)));
      setConfirmRevoke(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Deaktivieren des Freigabelinks");
      setConfirmRevoke(null);
    } finally {
      setRevoking(null);
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
    <>
      {/* Confirm Dialog */}
      {confirmRevoke && (
        <ConfirmDialog
          title="Freigabelink deaktivieren"
          message={`Möchten Sie den Link "${confirmRevoke.label}" wirklich deaktivieren? Personen mit diesem Link können dann nicht mehr auf den Fall zugreifen.`}
          confirmLabel="Link deaktivieren"
          confirmVariant="danger"
          onConfirm={() => revokeLink(confirmRevoke)}
          onCancel={() => setConfirmRevoke(null)}
          loading={revoking === confirmRevoke.id}
        />
      )}

      {/* Error Banner */}
      {error && (
        <div className="px-4 pt-3">
          <InlineError message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* Create Form Toggle */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <button
          onClick={() => { setShowCreateForm(!showCreateForm); setError(null); }}
          className="text-sm text-[var(--primary)] hover:underline flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer externer Link
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={createLink} className="p-4 bg-[var(--accent)] border-b border-[var(--border)]">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Bezeichnung
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
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
                onChange={(e) =>
                  setExpiresInDays(e.target.value ? parseInt(e.target.value) : "")
                }
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
                {creating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Wird erstellt...
                  </span>
                ) : (
                  "Link erstellen"
                )}
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
                  <p className="font-medium text-[var(--foreground)] truncate">{link.label}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[var(--muted)]">
                    <span>{link.accessCount} Aufrufe</span>
                    {link.lastAccessAt && (
                      <>
                        <span className="text-[var(--border)]">|</span>
                        <span>
                          Zuletzt: {new Date(link.lastAccessAt).toLocaleDateString("de-DE")}
                        </span>
                      </>
                    )}
                    <span className="text-[var(--border)]">|</span>
                    <span>
                      Erstellt: {new Date(link.createdAt).toLocaleDateString("de-DE")}
                    </span>
                  </div>
                  {link.expiresAt && (
                    <p className="text-xs text-amber-600 mt-1">
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
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                  <button
                    onClick={() => copyLink(link.token, link.id)}
                    className="p-2 text-[var(--secondary)] hover:text-[var(--primary)] hover:bg-[var(--accent)] rounded transition-colors"
                    title="Link kopieren"
                  >
                    {copiedId === link.id ? (
                      <svg
                        className="w-4 h-4 text-green-600"
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
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => setConfirmRevoke(link)}
                    className="p-2 text-[var(--secondary)] hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Zugang deaktivieren"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-[var(--muted)]">
            <svg
              className="w-10 h-10 mx-auto mb-2 text-[var(--border)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <p className="text-sm">Keine aktiven Freigabelinks</p>
            <p className="text-xs mt-1">Erstellen Sie einen Link für externen Zugriff</p>
          </div>
        )}
      </div>

      {inactiveLinks.length > 0 && (
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
              {inactiveLinks.length} deaktivierte Links
            </summary>
            <div className="divide-y divide-[var(--border)]">
              {inactiveLinks.map((link) => (
                <div key={link.id} className="p-4 bg-[var(--accent)] opacity-60">
                  <p className="text-sm text-[var(--secondary)]">{link.label}</p>
                  <p className="text-xs text-[var(--muted)]">
                    Erstellt: {new Date(link.createdAt).toLocaleDateString("de-DE")} |{" "}
                    {link.accessCount} Aufrufe
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
