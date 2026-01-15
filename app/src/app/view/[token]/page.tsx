"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import ExternalHeader from "@/components/external/ExternalHeader";
import KPICards from "@/components/external/KPICards";
import LiquidityTable from "@/components/external/LiquidityTable";
import BalanceChart from "@/components/external/BalanceChart";
import PDFExportButton from "@/components/external/PDFExportButton";

interface ShareData {
  case: {
    caseNumber: string;
    debtorName: string;
    courtName: string;
    status: string;
    filingDate: string;
    openingDate: string | null;
  };
  administrator: string;
  plan: {
    name: string;
    planStartDate: string;
    versionNumber: number;
    versionDate: string | null;
  };
  calculation: {
    openingBalanceCents: string;
    totalInflowsCents: string;
    totalOutflowsCents: string;
    totalNetCashflowCents: string;
    finalClosingBalanceCents: string;
    dataHash: string;
    calculatedAt: string;
    weeks: {
      weekOffset: number;
      weekLabel: string;
      openingBalanceCents: string;
      totalInflowsCents: string;
      totalOutflowsCents: string;
      netCashflowCents: string;
      closingBalanceCents: string;
    }[];
    categories: {
      categoryName: string;
      flowType: string;
      estateType: string;
      totalCents: string;
      weeklyTotals: string[];
      lines: {
        lineName: string;
        totalCents: string;
        weeklyValues: {
          weekOffset: number;
          effectiveCents: string;
        }[];
      }[];
    }[];
  };
}

export default function ExternalCaseView() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/share/${token}`);
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || "Fehler beim Laden der Daten");
          return;
        }
        const shareData = await response.json();
        setData(shareData);
      } catch {
        setError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchData();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-[var(--secondary)]">Liquiditätsplan wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="admin-card p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">Zugang nicht möglich</h1>
          <p className="text-[var(--secondary)]">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Calculate KPIs from data
  const weeks = data.calculation.weeks;
  const currentCash = BigInt(weeks[0]?.openingBalanceCents || "0");
  const minCash = weeks.reduce((min, week) => {
    const balance = BigInt(week.closingBalanceCents);
    return balance < min ? balance : min;
  }, currentCash);
  const runwayWeek = weeks.findIndex((week) => BigInt(week.closingBalanceCents) <= BigInt(0));
  const criticalWeek = weeks.findIndex((week) => BigInt(week.closingBalanceCents) < minCash + minCash / BigInt(10));

  const formatCurrency = (cents: bigint): string => {
    const euros = Number(cents) / 100;
    return euros.toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const getPeriodLabel = (): string => {
    if (weeks.length === 0) return "";
    return `${weeks[0].weekLabel} - ${weeks[weeks.length - 1].weekLabel}`;
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "PRELIMINARY":
        return "Vorläufiges Verfahren";
      case "OPENED":
        return "Eröffnetes Verfahren";
      case "CLOSED":
        return "Geschlossen";
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* External Layout - no sidebar, professional header */}
      <ExternalHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div ref={reportRef} className="space-y-6">
          {/* Case Header */}
          <div className="admin-card p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[var(--foreground)]">
                  {data.case.debtorName}
                </h1>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--secondary)]">
                  <span>Aktenzeichen: {data.case.caseNumber}</span>
                  <span>Gericht: {data.case.courtName}</span>
                </div>
              </div>
              <div className="mt-4 md:mt-0 flex flex-col items-start md:items-end gap-2">
                <span className={`badge ${
                  data.case.status === "OPENED" ? "badge-success" :
                  data.case.status === "PRELIMINARY" ? "badge-warning" :
                  "badge-neutral"
                }`}>
                  {getStatusLabel(data.case.status)}
                </span>
                <span className="text-sm text-[var(--muted)]">
                  Planungszeitraum: {getPeriodLabel()}
                </span>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <KPICards
            currentCash={currentCash}
            minCash={minCash}
            runwayWeek={runwayWeek >= 0 ? weeks[runwayWeek]?.weekLabel : null}
            criticalWeek={criticalWeek >= 0 && criticalWeek !== runwayWeek ? weeks[criticalWeek]?.weekLabel : null}
            formatCurrency={formatCurrency}
          />

          {/* Balance Chart */}
          <div className="admin-card p-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
              Liquiditätsverlauf
            </h2>
            <BalanceChart weeks={weeks} />
          </div>

          {/* 13-Week Table */}
          <div className="admin-card">
            <div className="px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                13-Wochen-Planung
              </h2>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <LiquidityTable
                weeks={weeks}
                categories={data.calculation.categories}
                openingBalance={BigInt(data.calculation.openingBalanceCents)}
              />
            </div>
          </div>

          {/* Footer Info */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-[var(--muted)] px-1">
            <div>
              Version {data.plan.versionNumber} | Stand: {new Date(data.calculation.calculatedAt).toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div className="mt-2 sm:mt-0">
              Datenintegrität: {data.calculation.dataHash.substring(0, 8)}...
            </div>
          </div>
        </div>

        {/* PDF Export Button - Fixed Position */}
        <div className="fixed bottom-6 right-6 no-print">
          <PDFExportButton
            data={data}
            formatCurrency={formatCurrency}
          />
        </div>
      </main>
    </div>
  );
}
