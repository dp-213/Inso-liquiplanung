"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";

interface SalaryMonth {
  id: string;
  year: number;
  month: number;
  grossSalaryCents: string; // BigInt serialized as string
  netSalaryCents: string | null;
  employerCostsCents: string | null;
}

interface LocationRef {
  id: string;
  name: string;
  shortName: string | null;
}

interface Employee {
  id: string;
  personnelNumber: string | null;
  lastName: string;
  firstName: string;
  role: string | null;
  lanr: string | null;
  locationId: string | null;
  location: LocationRef | null;
  svNumber: string | null;
  taxId: string | null;
  dateOfBirth: string | null;
  entryDate: string | null;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  isActive: boolean;
  notes: string | null;
  salaryMonths: SalaryMonth[];
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

const ROLE_OPTIONS = [
  "Arzt",
  "Arzt in WB",
  "VW",
  "MFA",
  "Sonstige",
];

function formatCents(cents: string | number | null | undefined): string {
  if (cents === null || cents === undefined) return "-";
  const val = typeof cents === "string" ? Number(cents) : cents;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(val / 100);
}

function parseCents(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^\d,.-]/g, "").replace(",", ".");
  return Math.round(parseFloat(cleaned) * 100) || 0;
}

export default function PersonalPage() {
  const params = useParams();
  const caseId = params.id as string;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<LocationRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filterLocation, setFilterLocation] = useState<string>("ALL");
  const [filterActive, setFilterActive] = useState<string>("ACTIVE");

  const [formData, setFormData] = useState({
    employeeId: null as string | null,
    personnelNumber: "",
    lastName: "",
    firstName: "",
    role: "",
    lanr: "",
    locationId: "",
    svNumber: "",
    taxId: "",
    isActive: true,
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, [caseId]);

  async function fetchData() {
    try {
      const [empRes, locRes] = await Promise.all([
        fetch(`/api/cases/${caseId}/employees`, { credentials: "include" }),
        fetch(`/api/cases/${caseId}/locations`, { credentials: "include" }),
      ]);

      if (empRes.ok) {
        const data = await empRes.json();
        setEmployees(data.employees || []);
      }
      if (locRes.ok) {
        const data = await locRes.json();
        setLocations(data.locations || []);
      }
    } catch {
      setError("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  }

  // Determine available salary months across all employees
  const salaryColumns = useMemo(() => {
    const monthSet = new Set<string>();
    for (const emp of employees) {
      for (const sm of emp.salaryMonths) {
        monthSet.add(`${sm.year}-${String(sm.month).padStart(2, "0")}`);
      }
    }
    return Array.from(monthSet).sort().map((key) => {
      const [year, month] = key.split("-").map(Number);
      return { year, month, key, label: `${MONTH_NAMES[month - 1]} ${year % 100}` };
    });
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (filterLocation !== "ALL" && e.locationId !== filterLocation) return false;
      if (filterActive === "ACTIVE" && !e.isActive) return false;
      if (filterActive === "INACTIVE" && e.isActive) return false;
      return true;
    });
  }, [employees, filterLocation, filterActive]);

  // Totals per month
  const monthlyTotals = useMemo(() => {
    const totals: Record<string, { gross: number; count: number }> = {};
    for (const col of salaryColumns) {
      totals[col.key] = { gross: 0, count: 0 };
    }
    for (const emp of filteredEmployees) {
      for (const sm of emp.salaryMonths) {
        const key = `${sm.year}-${String(sm.month).padStart(2, "0")}`;
        if (totals[key]) {
          totals[key].gross += Number(sm.grossSalaryCents);
          totals[key].count += 1;
        }
      }
    }
    return totals;
  }, [filteredEmployees, salaryColumns]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const method = formData.employeeId ? "PUT" : "POST";
      const url = formData.employeeId
        ? `/api/cases/${caseId}/employees/${formData.employeeId}`
        : `/api/cases/${caseId}/employees`;

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personnelNumber: formData.personnelNumber || null,
          lastName: formData.lastName,
          firstName: formData.firstName,
          role: formData.role || null,
          lanr: formData.lanr || null,
          locationId: formData.locationId || null,
          svNumber: formData.svNumber || null,
          taxId: formData.taxId || null,
          isActive: formData.isActive,
          notes: formData.notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Speichern");
      }

      setSuccess(formData.employeeId ? "Mitarbeiter aktualisiert" : "Mitarbeiter angelegt");
      resetForm();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(employeeId: string, name: string) {
    if (!confirm(`Mitarbeiter "${name}" wirklich löschen? Alle Gehaltsdaten gehen verloren.`)) return;

    try {
      const res = await fetch(`/api/cases/${caseId}/employees/${employeeId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Löschen");
      }

      setSuccess("Mitarbeiter gelöscht");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  }

  function startEdit(employee: Employee) {
    setFormData({
      employeeId: employee.id,
      personnelNumber: employee.personnelNumber || "",
      lastName: employee.lastName,
      firstName: employee.firstName,
      role: employee.role || "",
      lanr: employee.lanr || "",
      locationId: employee.locationId || "",
      svNumber: employee.svNumber || "",
      taxId: employee.taxId || "",
      isActive: employee.isActive,
      notes: employee.notes || "",
    });
    setShowForm(true);
  }

  function resetForm() {
    setFormData({
      employeeId: null,
      personnelNumber: "",
      lastName: "",
      firstName: "",
      role: "",
      lanr: "",
      locationId: "",
      svNumber: "",
      taxId: "",
      isActive: true,
      notes: "",
    });
    setShowForm(false);
  }

  function getSalary(emp: Employee, year: number, month: number): SalaryMonth | undefined {
    return emp.salaryMonths.find((sm) => sm.year === year && sm.month === month);
  }

  // Active employees, doctors without LANR
  const activeCount = employees.filter((e) => e.isActive).length;
  const doctorsWithoutLanr = employees.filter(
    (e) => e.isActive && e.role && (e.role.toLowerCase().includes("arzt") || e.role === "Arzt in WB") && !e.lanr
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Personal</h1>
            <p className="mt-1 text-sm text-[var(--secondary)]">
              Mitarbeiter und monatliche Gehaltsdaten
            </p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}
            className="btn-primary"
          >
            {showForm ? "Schließen" : "+ Mitarbeiter"}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="float-right font-bold">&times;</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg">
          {success}
          <button onClick={() => setSuccess(null)} className="float-right font-bold">&times;</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Gesamt</p>
          <p className="text-2xl font-bold text-[var(--foreground)]">{employees.length}</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Aktiv</p>
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Gehaltsmonate</p>
          <p className="text-2xl font-bold text-blue-600">{salaryColumns.length}</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-[var(--muted)]">Standorte</p>
          <p className="text-2xl font-bold text-purple-600">
            {new Set(employees.filter((e) => e.locationId).map((e) => e.locationId)).size}
          </p>
        </div>
      </div>

      {/* LANR Warning */}
      {doctorsWithoutLanr.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 px-4 py-3 rounded-lg">
          <span className="font-medium">{doctorsWithoutLanr.length} Arzt/Ärzte ohne LANR:</span>{" "}
          {doctorsWithoutLanr.map((d) => `${d.firstName} ${d.lastName}`).join(", ")}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="admin-card p-6">
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
            {formData.employeeId ? "Mitarbeiter bearbeiten" : "Neuer Mitarbeiter"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Personalnr.</label>
                <input
                  type="text"
                  value={formData.personnelNumber}
                  onChange={(e) => setFormData({ ...formData, personnelNumber: e.target.value })}
                  className="input w-full"
                  placeholder="z.B. 101"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Nachname *</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Vorname *</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Funktion</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="input w-full"
                >
                  <option value="">-- Auswählen --</option>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">LANR</label>
                <input
                  type="text"
                  value={formData.lanr}
                  onChange={(e) => setFormData({ ...formData, lanr: e.target.value })}
                  className="input w-full"
                  placeholder="Lebenslange Arztnummer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Standort</label>
                <select
                  value={formData.locationId}
                  onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                  className="input w-full"
                >
                  <option value="">-- Kein Standort --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">SV-Nummer</label>
                <input
                  type="text"
                  value={formData.svNumber}
                  onChange={(e) => setFormData({ ...formData, svNumber: e.target.value })}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Steuer-ID</label>
                <input
                  type="text"
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  className="input w-full"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Notizen</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input w-full"
                  rows={2}
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-5 h-5 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                  <span className="text-sm text-[var(--foreground)]">Aktiv</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Speichern..." : formData.employeeId ? "Aktualisieren" : "Anlegen"}
              </button>
              <button type="button" onClick={resetForm} className="btn-secondary">
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Bar */}
      <div className="admin-card p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="text-xs font-medium text-[var(--muted)] uppercase mr-2">Standort</label>
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="input text-sm"
            >
              <option value="ALL">Alle Standorte</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--muted)] uppercase mr-2">Status</label>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="input text-sm"
            >
              <option value="ACTIVE">Nur aktive</option>
              <option value="ALL">Alle</option>
              <option value="INACTIVE">Nur inaktive</option>
            </select>
          </div>
          <span className="text-sm text-[var(--muted)]">
            {filteredEmployees.length} von {employees.length} Mitarbeitern
          </span>
        </div>
      </div>

      {/* Employee Table with Salary Columns */}
      <div className="admin-card">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Mitarbeiter ({filteredEmployees.length})
          </h2>
        </div>
        {filteredEmployees.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            {employees.length === 0 ? "Noch keine Mitarbeiter erfasst" : "Keine Mitarbeiter für diesen Filter"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border)]">
              <thead>
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase sticky left-0 bg-[var(--card)] z-10">Nr.</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase sticky left-10 bg-[var(--card)] z-10">Name</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Funktion</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">Standort</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase">LANR</th>
                  {salaryColumns.map((col) => (
                    <th key={col.key} className="px-3 py-3 text-right text-xs font-semibold text-[var(--secondary)] uppercase whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center text-xs font-semibold text-[var(--secondary)] uppercase">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className={`hover:bg-[var(--accent)] ${!emp.isActive ? "opacity-50" : ""}`}>
                    <td className="px-3 py-2 text-sm text-[var(--muted)] font-mono sticky left-0 bg-[var(--card)]">
                      {emp.personnelNumber || "-"}
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-[var(--foreground)] sticky left-10 bg-[var(--card)] whitespace-nowrap">
                      {emp.lastName}, {emp.firstName}
                      {!emp.isActive && (
                        <span className="ml-1 text-xs text-red-500">(inaktiv)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-[var(--secondary)]">
                      {emp.role || "-"}
                    </td>
                    <td className="px-3 py-2 text-sm text-[var(--secondary)]">
                      {emp.location?.shortName || emp.location?.name || "-"}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {emp.lanr ? (
                        <span className="font-mono text-[var(--secondary)]">{emp.lanr}</span>
                      ) : emp.role && (emp.role.toLowerCase().includes("arzt") || emp.role === "Arzt in WB") ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          fehlt
                        </span>
                      ) : (
                        <span className="text-[var(--muted)]">-</span>
                      )}
                    </td>
                    {salaryColumns.map((col) => {
                      const sm = getSalary(emp, col.year, col.month);
                      return (
                        <td key={col.key} className="px-3 py-2 text-sm text-right font-mono text-[var(--secondary)] whitespace-nowrap">
                          {sm ? formatCents(sm.grossSalaryCents) : "-"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => startEdit(emp)}
                          className="p-1.5 text-[var(--secondary)] hover:text-[var(--primary)] hover:bg-[var(--accent)] rounded"
                          title="Bearbeiten"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(emp.id, `${emp.firstName} ${emp.lastName}`)}
                          className="p-1.5 text-[var(--secondary)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Löschen"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {/* Totals Row */}
                {salaryColumns.length > 0 && (
                  <tr className="bg-[var(--accent)] font-semibold">
                    <td className="px-3 py-2 text-sm text-[var(--foreground)] sticky left-0 bg-[var(--accent)]" colSpan={2}>
                      Summe Steuerbrutto
                    </td>
                    <td className="px-3 py-2" colSpan={3}></td>
                    {salaryColumns.map((col) => (
                      <td key={col.key} className="px-3 py-2 text-sm text-right font-mono text-[var(--foreground)] whitespace-nowrap">
                        {monthlyTotals[col.key]?.gross ? formatCents(monthlyTotals[col.key].gross) : "-"}
                      </td>
                    ))}
                    <td></td>
                  </tr>
                )}
                {/* AG-Kosten estimate */}
                {salaryColumns.length > 0 && (
                  <tr className="bg-[var(--accent)]/50">
                    <td className="px-3 py-2 text-sm text-[var(--muted)] sticky left-0 bg-[var(--accent)]/50" colSpan={2}>
                      AG-Kosten (ca. 23%)
                    </td>
                    <td className="px-3 py-2" colSpan={3}></td>
                    {salaryColumns.map((col) => (
                      <td key={col.key} className="px-3 py-2 text-sm text-right font-mono text-[var(--muted)] whitespace-nowrap">
                        {monthlyTotals[col.key]?.gross
                          ? formatCents(Math.round(monthlyTotals[col.key].gross * 0.23))
                          : "-"}
                      </td>
                    ))}
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
