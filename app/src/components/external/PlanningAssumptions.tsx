"use client";

interface Assumption {
  id: string;
  categoryName: string;
  source: string;
  description: string;
  riskLevel: string;
  createdAt: string;
  updatedAt: string;
}

interface PlanningAssumptionsProps {
  assumptions: Assumption[];
}

// Risk level configuration
const RISK_CONFIG: Record<string, { label: string; symbol: string; color: string; bgColor: string }> = {
  conservative: {
    label: "Konservativ",
    symbol: "○",
    color: "text-green-700",
    bgColor: "bg-green-100",
  },
  low: {
    label: "Gering",
    symbol: "◐",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
  },
  medium: {
    label: "Mittel",
    symbol: "◑",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
  },
  high: {
    label: "Hoch",
    symbol: "●",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
  },
  aggressive: {
    label: "Aggressiv",
    symbol: "●●",
    color: "text-red-700",
    bgColor: "bg-red-100",
  },
};

export default function PlanningAssumptions({ assumptions }: PlanningAssumptionsProps) {
  if (assumptions.length === 0) {
    return (
      <div className="admin-card p-6 text-center">
        <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">Keine Planungsprämissen</h3>
        <p className="text-sm text-[var(--muted)]">
          Für diesen Plan wurden noch keine Planungsprämissen dokumentiert.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="admin-card p-4">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Risiko-Legende</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(RISK_CONFIG).map(([key, config]) => (
            <div key={key} className="flex items-center gap-2">
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${config.bgColor} ${config.color}`}>
                {config.symbol}
              </span>
              <span className="text-xs text-[var(--secondary)]">{config.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Assumptions Table */}
      <div className="admin-card overflow-hidden">
        <div className="table-scroll-container custom-scrollbar">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase tracking-wider min-w-[180px]">
                  Position
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase tracking-wider min-w-[200px]">
                  Informationsquelle
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--secondary)] uppercase tracking-wider min-w-[300px]">
                  Planungsprämisse
                </th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-[var(--secondary)] uppercase tracking-wider w-[80px]">
                  Risiko
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {assumptions.map((assumption, index) => {
                const riskConfig = RISK_CONFIG[assumption.riskLevel] || RISK_CONFIG.medium;
                return (
                  <tr key={assumption.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-4 py-4 text-sm font-medium text-[var(--foreground)]">
                      {assumption.categoryName}
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--secondary)]">
                      {assumption.source}
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--secondary)]">
                      {assumption.description}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${riskConfig.bgColor} ${riskConfig.color}`}
                        title={riskConfig.label}
                      >
                        {riskConfig.symbol}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="text-xs text-[var(--muted)] px-1">
        {assumptions.length} Planungsprämisse{assumptions.length !== 1 ? "n" : ""} dokumentiert
      </div>
    </div>
  );
}
