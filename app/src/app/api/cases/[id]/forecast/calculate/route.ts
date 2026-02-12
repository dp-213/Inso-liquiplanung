/**
 * API: Forecast-Berechnung
 *
 * GET /api/cases/[id]/forecast/calculate
 *
 * Nutzt den Shared Helper loadAndCalculateForecast() für die Berechnung.
 * Diese Route wird von der Forecast-Seite aufgerufen.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { loadAndCalculateForecast } from '@/lib/forecast/load-and-calculate';
import { serializeForecastResult } from '@/lib/forecast/engine';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { id: caseId } = await params;

    // Forecast-Seite: Auch ohne aktive Annahmen berechnen (zeigt 0-Werte + Warnung)
    const forecast = await loadAndCalculateForecast(caseId, { requireActiveAssumptions: false });

    if (!forecast) {
      return NextResponse.json(
        { error: 'Kein Base-Szenario vorhanden. Bitte zuerst die Prognose-Seite öffnen.' },
        { status: 404 }
      );
    }

    const serialized = serializeForecastResult(forecast.result);

    return NextResponse.json({
      ...serialized,
      meta: forecast.meta,
    });
  } catch (error) {
    console.error('Forecast Calculate API Error:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
