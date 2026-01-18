'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AGGREGATION_STATUS,
  AGGREGATION_STATUS_LABELS,
  AGGREGATION_STATUS_COLORS,
  AggregationStatus,
  AggregationStatusResponse,
} from '@/lib/ledger';

interface AggregationStatusBannerProps {
  caseId: string;
  onRebuildComplete?: () => void;
}

interface StatusWithStats extends AggregationStatusResponse {
  activePlanId: string | null;
  activePlanName: string | null;
  stats?: {
    ledgerEntriesTotal: number;
    ledgerEntriesIst: number;
    ledgerEntriesPlan: number;
    periodValuesTotal: number;
  } | null;
}

export function AggregationStatusBanner({
  caseId,
  onRebuildComplete,
}: AggregationStatusBannerProps) {
  const [status, setStatus] = useState<StatusWithStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/cases/${caseId}/aggregation?stats=true`
      );
      if (!response.ok) {
        throw new Error('Fehler beim Laden des Aggregations-Status');
      }
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchStatus();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleRebuild = async () => {
    setIsRebuilding(true);
    setError(null);

    try {
      const response = await fetch(`/api/cases/${caseId}/aggregation/rebuild`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler bei der Neuberechnung');
      }

      // Refresh status after rebuild
      await fetchStatus();
      onRebuildComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setIsRebuilding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 text-gray-500">
          <svg
            className="animate-spin h-4 w-4"
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
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Lade Aggregations-Status...</span>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const statusColor = AGGREGATION_STATUS_COLORS[status.status];
  const statusLabel = AGGREGATION_STATUS_LABELS[status.status];

  const bgColors: Record<string, string> = {
    green: 'bg-green-50 border-green-200',
    amber: 'bg-amber-50 border-amber-200',
    blue: 'bg-blue-50 border-blue-200',
  };

  const textColors: Record<string, string> = {
    green: 'text-green-700',
    amber: 'text-amber-700',
    blue: 'text-blue-700',
  };

  const iconColors: Record<string, string> = {
    green: 'text-green-500',
    amber: 'text-amber-500',
    blue: 'text-blue-500',
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nie';
    return new Date(dateStr).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={`border rounded-lg p-4 mb-4 ${bgColors[statusColor] || 'bg-gray-50 border-gray-200'}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Status Icon */}
          <div className={`mt-0.5 ${iconColors[statusColor] || 'text-gray-500'}`}>
            {status.status === AGGREGATION_STATUS.CURRENT && (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {status.status === AGGREGATION_STATUS.STALE && (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {status.status === AGGREGATION_STATUS.REBUILDING && (
              <svg
                className="h-5 w-5 animate-spin"
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
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
          </div>

          {/* Status Text */}
          <div>
            <div className={`font-medium ${textColors[statusColor] || 'text-gray-700'}`}>
              Aggregations-Status: {statusLabel}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {status.reason && <span>{status.reason} · </span>}
              {status.pendingChanges > 0 && (
                <span>{status.pendingChanges} ausstehende Änderungen · </span>
              )}
              <span>Letzte Aggregation: {formatDate(status.lastAggregatedAt)}</span>
            </div>

            {/* Stats */}
            {status.stats && (
              <div className="text-sm text-gray-500 mt-2 flex gap-4">
                <span>
                  {status.stats.ledgerEntriesTotal} Ledger-Einträge
                  <span className="text-gray-400">
                    {' '}
                    ({status.stats.ledgerEntriesIst} IST /{' '}
                    {status.stats.ledgerEntriesPlan} PLAN)
                  </span>
                </span>
                <span>{status.stats.periodValuesTotal} PeriodValues</span>
              </div>
            )}
          </div>
        </div>

        {/* Rebuild Button */}
        {status.status === AGGREGATION_STATUS.STALE && (
          <button
            onClick={handleRebuild}
            disabled={isRebuilding || !status.activePlanId}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${
                isRebuilding || !status.activePlanId
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }
            `}
          >
            {isRebuilding ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Wird berechnet...
              </span>
            ) : (
              'Jetzt aktualisieren'
            )}
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}

      {/* No Plan Warning */}
      {!status.activePlanId && status.status === AGGREGATION_STATUS.STALE && (
        <div className="mt-3 text-sm text-gray-600 bg-gray-100 rounded p-2">
          Kein aktiver Plan gefunden. Bitte erstellen Sie zuerst einen
          Liquiditätsplan.
        </div>
      )}
    </div>
  );
}

export default AggregationStatusBanner;
