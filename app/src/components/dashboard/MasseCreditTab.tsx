"use client";

/**
 * MasseCreditTab - Dashboard-Tab für Banken und Massekredit
 *
 * Zeigt:
 * - KPI-Karten mit Massekredit-Übersicht
 * - Tabelle pro Bank mit Status und Beträgen
 * - Annahmen-Box für Transparenz
 * - Warnungen bei unsicheren/offenen Vereinbarungen
 */

import { useState, useEffect, useMemo } from "react";
import {
  type MassekreditStatus,
  type AssumptionDoc,
  BankAgreementStatus,
  BankAgreementStatusLabels,
  EstateAllocation,
} from "@/lib/types/allocation";

// =============================================================================
// TYPES
// =============================================================================

interface BankMassekreditData {
  bankAccountId: string;
  bankName: string;
  agreementStatus: string;
  hasGlobalAssignment: boolean;
  status: MassekreditStatus;
}

interface MasseCreditTabProps {
  caseId: string;
}

interface MassekreditApiResponse {
  perBank: Array<{
    bankAccountId: string;
    bankName: string;
    agreementStatus: string;
    hasGlobalAssignment: boolean;
    status: {
      altforderungenBruttoCents: string;
      fortfuehrungsbeitragCents: string | null;
      fortfuehrungsbeitragUstCents: string | null;
      ustAufAltforderungenCents: string | null;
      massekreditAltforderungenCents: string;
      headroomCents: string | null;
      isUncertain: boolean;
      uncertaintyNote: string | null;
      assumptions: AssumptionDoc[];
    };
  }>;
  total: {
    altforderungenBruttoCents: string;
    fortfuehrungsbeitragCents: string;
    fortfuehrungsbeitragUstCents: string;
    massekreditAltforderungenCents: string;
    hasUncertainBanks: boolean;
  };
  unklarCount: number;
  calculatedAt: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatCents(cents: bigint | string | null): string {
  if (cents === null) return "-";
  const value = typeof cents === "string" ? BigInt(cents) : cents;
  const euros = Number(value) / 100;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(euros);
}

function getStatusBadge(status: string) {
  switch (status) {
    case BankAgreementStatus.VEREINBART:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <svg
            className="w-3 h-3 mr-1"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          {BankAgreementStatusLabels[BankAgreementStatus.VEREINBART]}
        </span>
      );
    case BankAgreementStatus.VERHANDLUNG:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <svg
            className="w-3 h-3 mr-1 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          {BankAgreementStatusLabels[BankAgreementStatus.VERHANDLUNG]}
        </span>
      );
    case BankAgreementStatus.OFFEN:
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <svg
            className="w-3 h-3 mr-1"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {BankAgreementStatusLabels[BankAgreementStatus.OFFEN]}
        </span>
      );
  }
}

// =============================================================================
// KPI CARD COMPONENT
// =============================================================================

interface KPICardProps {
  label: string;
  value: string;
  subtext?: string;
  highlight?: boolean;
  warning?: boolean;
}

function KPICard({ label, value, subtext, highlight, warning }: KPICardProps) {
  return (
    <div
      className={`p-4 rounded-lg border ${
        highlight
          ? "bg-green-50 border-green-200"
          : warning
            ? "bg-yellow-50 border-yellow-200"
            : "bg-white border-gray-200"
      }`}
    >
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div
        className={`text-2xl font-bold mt-1 ${
          highlight
            ? "text-green-700"
            : warning
              ? "text-yellow-700"
              : "text-gray-900"
        }`}
      >
        {value}
      </div>
      {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
    </div>
  );
}

// =============================================================================
// ASSUMPTIONS BOX COMPONENT
// =============================================================================

interface AssumptionsBoxProps {
  assumptions: Array<{
    bankName: string;
    items: AssumptionDoc[];
  }>;
}

function AssumptionsBox({ assumptions }: AssumptionsBoxProps) {
  if (assumptions.length === 0) return null;

  return (
    <div className="bg-gray-50 rounded-lg p-4 mt-6">
      <h4 className="text-sm font-medium text-gray-700 mb-3">
        Berechnungsgrundlagen
      </h4>
      <div className="space-y-3">
        {assumptions.map((bank) => (
          <div key={bank.bankName}>
            <div className="text-xs font-medium text-gray-600 mb-1">
              {bank.bankName}:
            </div>
            <ul className="text-xs text-gray-500 space-y-0.5 pl-3">
              {bank.items
                .filter((a) => a.source === "VERTRAG")
                .map((a, idx) => (
                  <li key={idx}>
                    {a.field}: {a.assumption}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function MasseCreditTab({ caseId }: MasseCreditTabProps) {
  const [data, setData] = useState<MassekreditApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/cases/${caseId}/massekredit`
        );

        if (!response.ok) {
          if (response.status === 404) {
            // No bank agreements configured yet
            setData(null);
            setError(null);
            return;
          }
          throw new Error("Fehler beim Laden der Massekredit-Daten");
        }

        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [caseId]);

  // Memoized calculations
  const bankData = useMemo(() => {
    if (!data) return [];
    return data.perBank.map((bank) => ({
      ...bank,
      status: {
        ...bank.status,
        altforderungenBruttoCents: BigInt(bank.status.altforderungenBruttoCents),
        fortfuehrungsbeitragCents: bank.status.fortfuehrungsbeitragCents
          ? BigInt(bank.status.fortfuehrungsbeitragCents)
          : null,
        fortfuehrungsbeitragUstCents: bank.status.fortfuehrungsbeitragUstCents
          ? BigInt(bank.status.fortfuehrungsbeitragUstCents)
          : null,
        ustAufAltforderungenCents: bank.status.ustAufAltforderungenCents
          ? BigInt(bank.status.ustAufAltforderungenCents)
          : null,
        massekreditAltforderungenCents: BigInt(
          bank.status.massekreditAltforderungenCents
        ),
        headroomCents: bank.status.headroomCents
          ? BigInt(bank.status.headroomCents)
          : null,
      },
    }));
  }, [data]);

  const assumptions = useMemo(() => {
    if (!data) return [];
    return data.perBank.map((bank) => ({
      bankName: bank.bankName,
      items: bank.status.assumptions,
    }));
  }, [data]);

  // Loading state
  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-red-400 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!data || data.perBank.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <svg
            className="w-12 h-12 text-gray-400 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Keine Bankvereinbarungen konfiguriert
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Um den Massekredit berechnen zu können, müssen zunächst
            Bankvereinbarungen angelegt werden.
          </p>
          <span className="text-sm text-gray-500">
            Bitte konfigurieren Sie die Bankvereinbarungen in der Fallverwaltung.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Warning Banner for Uncertain Banks */}
      {data.total.hasUncertainBanks && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <svg
              className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-yellow-800">
                Offene Vereinbarungen
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                Eine oder mehrere Bankvereinbarungen sind noch nicht
                abgeschlossen. Die Massekredit-Berechnung kann sich nach
                Abschluss der Verhandlungen ändern.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Warning Banner for Unklar Entries */}
      {data.unklarCount > 0 && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <svg
              className="w-5 h-5 text-red-400 mr-2 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-red-800">
                Buchungen ohne Zuordnung
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {data.unklarCount} Buchung(en) erfordern manuelle Prüfung für
                die Alt/Neu-Zuordnung.
              </p>
              <span className="text-sm text-red-700 mt-2 inline-block">
                Bitte prüfen Sie die Buchungen im Zahlungsregister.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="admin-card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Massekredit-Übersicht
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Altforderungen brutto"
            value={formatCents(data.total.altforderungenBruttoCents)}
            subtext="Zuflüsse aus Altmasse"
          />
          <KPICard
            label="Fortführungsbeitrag"
            value={formatCents(data.total.fortfuehrungsbeitragCents)}
            subtext={
              data.total.fortfuehrungsbeitragCents !== "0"
                ? "gem. Vereinbarung"
                : "nicht vereinbart"
            }
            warning={data.total.fortfuehrungsbeitragCents === "0"}
          />
          <KPICard
            label="USt auf Beitrag"
            value={formatCents(data.total.fortfuehrungsbeitragUstCents)}
            subtext="19% USt"
          />
          <KPICard
            label="Massekredit Altforderungen"
            value={formatCents(data.total.massekreditAltforderungenCents)}
            subtext="= Brutto - Beitrag - USt"
            highlight
          />
        </div>
      </div>

      {/* Bank Table */}
      <div className="admin-card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Massekredit nach Bank
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Bank
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Altford. brutto
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Beitrag
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Beitrag USt
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Massekredit
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Cap
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Headroom
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bankData.map((bank) => (
                <tr
                  key={bank.bankAccountId}
                  className={bank.status.isUncertain ? "bg-yellow-50" : ""}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {bank.bankName}
                    </div>
                    {bank.hasGlobalAssignment && (
                      <div className="text-xs text-gray-500">Globalzession</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(bank.agreementStatus)}
                    {bank.status.uncertaintyNote && (
                      <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                        {bank.status.uncertaintyNote}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCents(bank.status.altforderungenBruttoCents)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCents(bank.status.fortfuehrungsbeitragCents)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCents(bank.status.fortfuehrungsbeitragUstCents)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-700 text-right">
                    {formatCents(bank.status.massekreditAltforderungenCents)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCents(bank.status.headroomCents)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {bank.status.headroomCents !== null
                      ? formatCents(bank.status.headroomCents)
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Assumptions */}
        <div className="px-6 pb-4">
          <AssumptionsBox assumptions={assumptions} />
        </div>
      </div>
    </div>
  );
}
