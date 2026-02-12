'use client';

/**
 * DataSourceLegend - Erklärt die Herkunft von Zahlen im Dashboard
 *
 * Jede Zahl im System muss beantworten können:
 * "Kommt das aus realen Zahlungen, aus Planung oder aus Annahmen?"
 */

interface LedgerStats {
  dataSource: "LEDGER" | "LEGACY";
  entryCount: number;
  istCount: number;
  planCount: number;
  confirmedCount: number;
  unreviewedCount: number;
  masseCount: number;
  absonderungCount: number;
}

interface DataSourceLegendProps {
  compact?: boolean;
  ledgerStats?: LedgerStats;
}

export default function DataSourceLegend({ compact = false, ledgerStats }: DataSourceLegendProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
        <div className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
          <span>IST = Reale Zahlung</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-purple-500"></span>
          <span>PLAN = Geplanter Wert</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
          <span>ANNAHME = Dokumentierte Prämisse</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-card p-4 bg-[var(--accent)] border-[var(--border)]">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3">
        <h4 className="text-sm font-semibold text-[var(--foreground)]">
          Datenherkunft verstehen
        </h4>
        {ledgerStats && (
          <div className="flex items-center gap-3 mt-2 md:mt-0 text-xs">
            {ledgerStats.dataSource === "LEDGER" ? (
              <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                ✓ Zahlungsregister ({ledgerStats.entryCount} Einträge)
              </span>
            ) : (
              <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                Legacy-Daten
              </span>
            )}
            {ledgerStats.unreviewedCount > 0 && (
              <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-medium">
                {ledgerStats.unreviewedCount} zu prüfen
              </span>
            )}
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <span className="text-green-700 font-bold text-xs">IST</span>
          </div>
          <div>
            <p className="font-medium text-green-800">Reale Zahlungen</p>
            <p className="text-xs text-green-700 mt-0.5">
              Aus dem Zahlungsregister (LedgerEntry). Tatsächlich erfolgte
              Transaktionen mit Buchungsbeleg.
            </p>
            {ledgerStats && ledgerStats.istCount > 0 && (
              <p className="text-xs font-semibold text-green-600 mt-1">
                {ledgerStats.istCount} Buchungen
              </p>
            )}
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
            <span className="text-purple-700 font-bold text-xs">PLAN</span>
          </div>
          <div>
            <p className="font-medium text-purple-800">Geplante Werte</p>
            <p className="text-xs text-purple-700 mt-0.5">
              Prognostizierte Zahlungen oder Insolvenzeffekte.
              Noch nicht eingetreten, aber eingeplant.
            </p>
            {ledgerStats && ledgerStats.planCount > 0 && (
              <p className="text-xs font-semibold text-purple-600 mt-1">
                {ledgerStats.planCount} Planwerte
              </p>
            )}
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <span className="text-amber-700 font-bold text-xs">DOK</span>
          </div>
          <div>
            <p className="font-medium text-amber-800">Dokumentierte Annahme</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Erklärt die Grundlage einer Position. Erzeugt selbst keine
              Zahlungen, nur Dokumentation.
            </p>
          </div>
        </div>
      </div>
      {ledgerStats && ledgerStats.dataSource === "LEDGER" && (ledgerStats.masseCount > 0 || ledgerStats.absonderungCount > 0) && (
        <div className="mt-4 pt-3 border-t border-[var(--border)] flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-[var(--secondary)]">Masse: {ledgerStats.masseCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span className="text-[var(--secondary)]">Absonderung: {ledgerStats.absonderungCount}</span>
          </div>
        </div>
      )}
    </div>
  );
}
