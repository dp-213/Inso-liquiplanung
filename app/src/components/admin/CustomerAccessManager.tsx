"use client";

import { useState, useEffect } from "react";

interface Customer {
  id: string;
  name: string;
  email: string;
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

interface CustomerAccessManagerProps {
  caseId: string;
  initialAccess: CustomerAccess[];
}

export default function CustomerAccessManager({
  caseId,
  initialAccess,
}: CustomerAccessManagerProps) {
  const [access, setAccess] = useState<CustomerAccess[]>(initialAccess);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [accessLevel, setAccessLevel] = useState("VIEW");
  const [expiresInDays, setExpiresInDays] = useState<number | "">("");
  const [creating, setCreating] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  useEffect(() => {
    if (showCreateForm && customers.length === 0) {
      loadCustomers();
    }
  }, [showCreateForm]);

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const response = await fetch("/api/customers?isActive=true");
      if (response.ok) {
        const data = await response.json();
        // Filter out customers who already have active access
        const activeCustomerIds = new Set(
          access.filter((a) => a.isActive).map((a) => a.customerId)
        );
        const availableCustomers = data.filter(
          (c: Customer) => !activeCustomerIds.has(c.id)
        );
        setCustomers(availableCustomers);
      }
    } catch (error) {
      console.error("Error loading customers:", error);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const createAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert("Bitte wählen Sie einen Kunden aus");
      return;
    }

    setCreating(true);

    try {
      const expiresAt = expiresInDays
        ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const response = await fetch(`/api/cases/${caseId}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          accessLevel,
          expiresAt,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create access");
      }

      const newAccess = await response.json();
      setAccess([newAccess, ...access]);
      setShowCreateForm(false);
      setSelectedCustomerId("");
      setAccessLevel("VIEW");
      setExpiresInDays("");
      // Remove the customer from available list
      setCustomers(customers.filter((c) => c.id !== selectedCustomerId));
    } catch (error) {
      console.error("Error creating customer access:", error);
      alert(error instanceof Error ? error.message : "Fehler beim Erstellen des Zugangs");
    } finally {
      setCreating(false);
    }
  };

  const revokeAccess = async (accessId: string) => {
    if (!confirm("Moechten Sie diesen Kundenzugang wirklich widerrufen?")) {
      return;
    }

    try {
      const response = await fetch(`/api/cases/${caseId}/customers?accessId=${accessId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to revoke access");
      }

      setAccess(
        access.map((a) => (a.id === accessId ? { ...a, isActive: false } : a))
      );
    } catch (error) {
      console.error("Error revoking access:", error);
      alert("Fehler beim Widerrufen des Zugangs");
    }
  };

  const getAccessLevelLabel = (level: string): string => {
    switch (level) {
      case "VIEW":
        return "Ansicht";
      case "COMMENT":
        return "Kommentieren";
      case "DOWNLOAD":
        return "Herunterladen";
      default:
        return level;
    }
  };

  const activeAccess = access.filter((a) => a.isActive);
  const inactiveAccess = access.filter((a) => !a.isActive);

  return (
    <div className="admin-card">
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Kundenzugaenge</h2>
        <button
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            if (!showCreateForm) loadCustomers();
          }}
          className="text-sm text-[var(--primary)] hover:underline flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Zugang hinzufuegen
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <form onSubmit={createAccess} className="p-4 bg-gray-50 border-b border-[var(--border)]">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Kunde
              </label>
              {loadingCustomers ? (
                <div className="input-field bg-gray-100 text-[var(--muted)]">Wird geladen...</div>
              ) : customers.length === 0 ? (
                <div className="input-field bg-gray-100 text-[var(--muted)]">
                  Keine verfügbaren Kunden. Alle aktiven Kunden haben bereits Zugriff.
                </div>
              ) : (
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="">Kunde auswählen...</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                      {customer.company && ` (${customer.company})`}
                      {" - "}
                      {customer.email}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Zugriffslevel
              </label>
              <select
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value)}
                className="input-field"
              >
                <option value="VIEW">Ansicht - Nur lesen</option>
                <option value="COMMENT">Kommentieren - Lesen und Notizen</option>
                <option value="DOWNLOAD">Herunterladen - Voller Zugriff</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                Gueltigkeitsdauer (Tage)
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
                disabled={creating || customers.length === 0}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {creating ? "Wird erstellt..." : "Zugang erteilen"}
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

      {/* Active Access */}
      <div className="divide-y divide-[var(--border)]">
        {activeAccess.length > 0 ? (
          activeAccess.map((accessItem) => (
            <div key={accessItem.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[var(--foreground)] truncate">
                    {accessItem.customer.name}
                    {!accessItem.customer.isActive && (
                      <span className="ml-2 text-xs text-[var(--muted)]">(Kunde inaktiv)</span>
                    )}
                  </p>
                  <p className="text-sm text-[var(--secondary)]">{accessItem.customer.email}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted)]">
                    <span className="badge badge-info text-xs py-0">
                      {getAccessLevelLabel(accessItem.accessLevel)}
                    </span>
                    {accessItem.accessCount > 0 && (
                      <span>{accessItem.accessCount} Zugriffe</span>
                    )}
                    {accessItem.lastAccessedAt && (
                      <>
                        <span>|</span>
                        <span>
                          Zuletzt: {new Date(accessItem.lastAccessedAt).toLocaleDateString("de-DE")}
                        </span>
                      </>
                    )}
                  </div>
                  {accessItem.expiresAt && (
                    <p className="text-xs text-[var(--warning)] mt-1">
                      Gueltig bis: {new Date(accessItem.expiresAt).toLocaleDateString("de-DE")}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => revokeAccess(accessItem.id)}
                  className="p-2 text-[var(--secondary)] hover:text-[var(--danger)] hover:bg-red-50 rounded transition-colors"
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
            <p className="text-sm">Keine Kundenzugaenge</p>
            <p className="text-xs mt-1">Fuegen Sie Kunden hinzu, um ihnen Zugriff zu gewaehren</p>
          </div>
        )}
      </div>

      {/* Inactive Access */}
      {inactiveAccess.length > 0 && (
        <div className="border-t border-[var(--border)]">
          <details className="group">
            <summary className="px-4 py-3 cursor-pointer text-sm text-[var(--muted)] hover:bg-gray-50 flex items-center">
              <svg
                className="w-4 h-4 mr-2 transition-transform group-open:rotate-90"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {inactiveAccess.length} widerrufene Zugaenge
            </summary>
            <div className="divide-y divide-[var(--border)]">
              {inactiveAccess.map((accessItem) => (
                <div key={accessItem.id} className="p-4 bg-gray-50 opacity-60">
                  <p className="text-sm text-[var(--secondary)]">{accessItem.customer.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    Erteilt: {new Date(accessItem.grantedAt).toLocaleDateString("de-DE")} |{" "}
                    {accessItem.accessCount} Zugriffe
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
