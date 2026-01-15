/**
 * Custom Dashboard Component Template
 *
 * Copy this file to /src/cases/[your-case-id]/dashboard.view.tsx
 * if you need a completely custom dashboard layout.
 *
 * NOTE: Most customization needs can be met through configuration alone.
 * Only create a custom component if you need:
 * - Custom layout structure
 * - Additional UI sections
 * - Case-specific widgets
 * - Complex conditional rendering
 */

"use client";

import { DashboardProps } from '@/lib/case-dashboard/types';
import {
  ConfigurableDashboard,
  DashboardCard,
  KPIDisplay,
  CategoryTable,
  ChartDisplay,
} from '@/components/dashboard';

/**
 * Custom dashboard component for case [CASE-ID]
 *
 * This component receives all the same props as ConfigurableDashboard:
 * - caseId: The case identifier
 * - config: Resolved dashboard configuration
 * - calculationData: Data from the calculation engine
 * - viewMode: 'internal' or 'external'
 * - isPreview: Whether in preview mode
 */
export default function CustomDashboard(props: DashboardProps) {
  const { caseId, config, calculationData, viewMode, isPreview } = props;

  // Option 1: Use the standard dashboard with minor modifications
  // Simply render ConfigurableDashboard and add extra sections:
  return (
    <div className="space-y-6">
      {/* Standard configurable dashboard */}
      <ConfigurableDashboard {...props} />

      {/* Add custom sections below the standard dashboard */}
      <DashboardCard title="Zusaetzliche Informationen">
        <div className="text-[var(--secondary)]">
          <p>
            Hier koennen fall-spezifische zusaetzliche Informationen angezeigt werden.
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Case ID: {caseId}
          </p>
        </div>
      </DashboardCard>
    </div>
  );

  // Option 2: Build a completely custom layout
  // Comment out Option 1 and uncomment this:
  /*
  return (
    <div className="space-y-6">
      {/ * Custom header * /}
      <div className="admin-card p-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {config.viewVariants[viewMode].config.titleOverride ||
            `Liquiditaetsplan - ${calculationData.caseInfo.debtorName}`}
        </h1>
        <p className="text-[var(--secondary)] mt-1">
          {calculationData.caseInfo.caseNumber} | {calculationData.caseInfo.courtName}
        </p>
      </div>

      {/ * KPIs in custom layout * /}
      <KPIDisplay config={config} data={calculationData} />

      {/ * Side-by-side layout for charts and summary * /}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardCard title="Liquiditaetsentwicklung">
          <ChartDisplay config={config} data={calculationData} />
        </DashboardCard>

        <DashboardCard title="Zusammenfassung">
          <div className="space-y-4">
            <SummaryItem
              label="Planungszeitraum"
              value={`${formatDate(calculationData.caseInfo.planStartDate)} - 13 Wochen`}
            />
            <SummaryItem
              label="Anfangssaldo"
              value={formatCurrency(calculationData.kpis.openingBalanceCents)}
            />
            <SummaryItem
              label="Endsaldo"
              value={formatCurrency(calculationData.kpis.closingBalanceCents)}
              isNegative={calculationData.kpis.closingBalanceCents < BigInt(0)}
            />
          </div>
        </DashboardCard>
      </div>

      {/ * Full-width table * /}
      <DashboardCard title="Detailansicht" noPadding>
        <CategoryTable config={config} data={calculationData} viewMode={viewMode} />
      </DashboardCard>
    </div>
  );
  */
}

// Helper components for custom layout
function SummaryItem({
  label,
  value,
  isNegative = false,
}: {
  label: string;
  value: string;
  isNegative?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[var(--secondary)]">{label}</span>
      <span className={`font-medium ${isNegative ? 'text-red-600' : 'text-[var(--foreground)]'}`}>
        {value}
      </span>
    </div>
  );
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-DE');
}

function formatCurrency(cents: bigint): string {
  const euros = Number(cents) / 100;
  return euros.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });
}
