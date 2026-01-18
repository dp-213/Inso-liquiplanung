'use client';

/**
 * DataSourceLegend - Erklärt die Herkunft von Zahlen im Dashboard
 *
 * Jede Zahl im System muss beantworten können:
 * "Kommt das aus realen Zahlungen, aus Planung oder aus Annahmen?"
 */

interface DataSourceLegendProps {
  compact?: boolean;
}

export default function DataSourceLegend({ compact = false }: DataSourceLegendProps) {
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
    <div className="admin-card p-4 bg-gray-50 border-gray-200">
      <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">
        Datenherkunft verstehen
      </h4>
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
    </div>
  );
}
