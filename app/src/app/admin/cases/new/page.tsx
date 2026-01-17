"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Customer {
  id: string;
  name: string;
  email: string;
  company: string | null;
}

function NewCaseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedOwnerId = searchParams.get("ownerId");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [additionalCustomerIds, setAdditionalCustomerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    ownerId: "",
    caseNumber: "",
    debtorName: "",
    courtName: "",
    filingDate: new Date().toISOString().split("T")[0],
    openingDate: "",
    status: "PRELIMINARY",
  });

  useEffect(() => {
    async function loadData() {
      try {
        const customersRes = await fetch("/api/customers?isActive=true");

        if (customersRes.ok) {
          const customersData = await customersRes.json();
          setCustomers(customersData);
          // Use preselected owner from URL or first customer
          if (preselectedOwnerId && customersData.find((c: Customer) => c.id === preselectedOwnerId)) {
            setFormData((prev) => ({ ...prev, ownerId: preselectedOwnerId }));
          } else if (customersData.length > 0) {
            setFormData((prev) => ({ ...prev, ownerId: customersData[0].id }));
          }
        }
      } catch (err) {
        console.error("Error loading data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [preselectedOwnerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          customerIds: additionalCustomerIds,
        }),
      });

      if (res.ok) {
        const newCase = await res.json();
        router.push(`/admin/cases/${newCase.id}`);
      } else {
        const data = await res.json();
        setError(data.error || "Fehler beim Erstellen des Falls");
      }
    } catch {
      setError("Netzwerkfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear additional customers if owner changes to prevent duplicates
    if (name === "ownerId") {
      setAdditionalCustomerIds((prev) => prev.filter((id) => id !== value));
    }
  };

  // Filter out the owner from additional customer options
  const availableAdditionalCustomers = customers.filter((c) => c.id !== formData.ownerId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Neuen Fall anlegen
          </h1>
          <p className="text-[var(--secondary)] mt-1">
            Erstellen Sie ein neues Insolvenzverfahren
          </p>
        </div>
        <Link href="/admin/cases" className="btn-secondary">
          Abbrechen
        </Link>
      </div>

      {customers.length === 0 ? (
        <div className="admin-card p-8 text-center">
          <p className="text-[var(--muted)] mb-4">
            Sie müssen zuerst einen Kunden erstellen, bevor Sie einen Fall
            anlegen können.
          </p>
          <Link href="/admin/customers" className="btn-primary">
            Kunde erstellen
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="admin-card p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="ownerId"
                className="block text-sm font-medium text-[var(--foreground)] mb-2"
              >
                Kunde (Besitzer) *
              </label>
              <select
                id="ownerId"
                name="ownerId"
                value={formData.ownerId}
                onChange={handleChange}
                required
                className="input-field"
              >
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.company && ` (${customer.company})`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--muted)] mt-1">
                Der Besitzer hat automatisch Zugriff auf diesen Fall.
              </p>
            </div>

            <div>
              <label
                htmlFor="caseNumber"
                className="block text-sm font-medium text-[var(--foreground)] mb-2"
              >
                Aktenzeichen *
              </label>
              <input
                type="text"
                id="caseNumber"
                name="caseNumber"
                value={formData.caseNumber}
                onChange={handleChange}
                required
                placeholder="z.B. 123 IN 456/24"
                className="input-field"
              />
            </div>

            <div>
              <label
                htmlFor="debtorName"
                className="block text-sm font-medium text-[var(--foreground)] mb-2"
              >
                Schuldner *
              </label>
              <input
                type="text"
                id="debtorName"
                name="debtorName"
                value={formData.debtorName}
                onChange={handleChange}
                required
                placeholder="Name des Schuldners"
                className="input-field"
              />
            </div>

            <div>
              <label
                htmlFor="courtName"
                className="block text-sm font-medium text-[var(--foreground)] mb-2"
              >
                Gericht *
              </label>
              <input
                type="text"
                id="courtName"
                name="courtName"
                value={formData.courtName}
                onChange={handleChange}
                required
                placeholder="z.B. AG Muenchen"
                className="input-field"
              />
            </div>

            <div>
              <label
                htmlFor="filingDate"
                className="block text-sm font-medium text-[var(--foreground)] mb-2"
              >
                Antragsdatum *
              </label>
              <input
                type="date"
                id="filingDate"
                name="filingDate"
                value={formData.filingDate}
                onChange={handleChange}
                required
                className="input-field"
              />
            </div>

            <div>
              <label
                htmlFor="openingDate"
                className="block text-sm font-medium text-[var(--foreground)] mb-2"
              >
                Eröffnungsdatum
              </label>
              <input
                type="date"
                id="openingDate"
                name="openingDate"
                value={formData.openingDate}
                onChange={handleChange}
                className="input-field"
              />
            </div>

            <div>
              <label
                htmlFor="status"
                className="block text-sm font-medium text-[var(--foreground)] mb-2"
              >
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="input-field"
              >
                <option value="PRELIMINARY">Vorläufig</option>
                <option value="OPENED">Eröffnet</option>
                <option value="CLOSED">Geschlossen</option>
              </select>
            </div>
          </div>

          {/* Optional Additional Customer Access */}
          {availableAdditionalCustomers.length > 0 && (
            <div className="pt-6 border-t border-[var(--border)]">
              <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">
                Weitere Kundenzugaenge (optional)
              </h3>
              <p className="text-xs text-[var(--muted)] mb-4">
                Diese Kunden erhalten zusaetzlich Lesezugriff auf den neuen Fall.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                {availableAdditionalCustomers.map((customer) => (
                  <label
                    key={customer.id}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      additionalCustomerIds.includes(customer.id)
                        ? "border-[var(--primary)] bg-blue-50"
                        : "border-[var(--border)] hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={additionalCustomerIds.includes(customer.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAdditionalCustomerIds([...additionalCustomerIds, customer.id]);
                        } else {
                          setAdditionalCustomerIds(
                            additionalCustomerIds.filter((id) => id !== customer.id)
                          );
                        }
                      }}
                      className="w-4 h-4 text-[var(--primary)] rounded border-gray-300 focus:ring-[var(--primary)]"
                    />
                    <div className="ml-3 flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">
                        {customer.name}
                      </p>
                      <p className="text-xs text-[var(--muted)] truncate">
                        {customer.email}
                        {customer.company && ` - ${customer.company}`}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              {additionalCustomerIds.length > 0 && (
                <p className="text-xs text-[var(--primary)] mt-2">
                  {additionalCustomerIds.length} zusaetzliche(r) Kunde(n) ausgewählt
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
            <Link href="/admin/cases" className="btn-secondary">
              Abbrechen
            </Link>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Erstelle..." : "Fall anlegen"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function NewCaseLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Neuen Fall anlegen</h1>
          <p className="text-[var(--secondary)] mt-1">Erstellen Sie ein neues Insolvenzverfahren</p>
        </div>
      </div>
      <div className="admin-card p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
          <span className="ml-3 text-[var(--muted)]">Wird geladen...</span>
        </div>
      </div>
    </div>
  );
}

export default function NewCasePage() {
  return (
    <Suspense fallback={<NewCaseLoading />}>
      <NewCaseContent />
    </Suspense>
  );
}
