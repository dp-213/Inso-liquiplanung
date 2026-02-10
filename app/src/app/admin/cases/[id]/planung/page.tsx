"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface PlanungData {
  titel: string;
  version: string;
  datum: string;
  basis: string;
  methodik: string;
  annahmen: Array<{
    id: string;
    titel: string;
    beschreibung: string;
    quelle: string;
    abweichung_iv?: string;
    status: string;
  }>;
  offene_fragen: Array<{
    id: string;
    frage: string;
    dringlichkeit: string;
    zustaendig: string;
  }>;
  monate: Array<{
    monat: string;
    monat_name: string;
    einnahmen: {
      umsatz?: any;
      altforderungen?: any;
      insolvenzspezifisch?: any;
      gesamt: number;
    };
    ausgaben: {
      personal?: any;
      betrieblich?: any;
      insolvenzspezifisch?: any;
      gesamt: number;
    };
    saldo: number;
    anmerkungen?: string[];
  }>;
  zusammenfassung: {
    gesamteinnahmen: number;
    gesamtausgaben: number;
    nettosaldo: number;
    kritische_monate?: Array<{
      monat: string;
      saldo: number;
      grund: string;
    }>;
  };
  abweichungen_zur_iv_planung?: Array<{
    position: string;
    iv: number;
    korrigiert: number;
    differenz: number;
    prozent: number;
    begruendung: string;
  }>;
}

export default function PlanungPage() {
  const params = useParams();
  const rawId = params.id;
  const caseId = Array.isArray(rawId) ? rawId[0] : rawId;
  const [data, setData] = useState<PlanungData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/cases/${caseId}/planung`, {
          credentials: 'include',
        });
        if (!response.ok) {
          setError("Planung konnte nicht geladen werden");
          return;
        }
        const result = await response.json();
        setData(result.data);
      } catch {
        setError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
      } finally {
        setLoading(false);
      }
    }
    if (caseId) fetchData();
  }, [caseId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-[var(--secondary)]">Planung wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">Fehler beim Laden</h1>
          <p className="text-[var(--secondary)] mb-4">{error}</p>
        </div>
      </div>
    );
  }

  const formatEUR = (value: number) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      KORREKTUR: "bg-orange-100 text-orange-800 border-orange-300",
      ÜBERNOMMEN: "bg-blue-100 text-blue-800 border-blue-300",
      VERIFIZIERT: "bg-green-100 text-green-800 border-green-300",
      OFFEN: "bg-yellow-100 text-yellow-800 border-yellow-300",
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${styles[status] || "bg-gray-100 text-gray-800"}`}>
        {status}
      </span>
    );
  };

  const getDringlichkeitBadge = (dringlichkeit: string) => {
    const styles: Record<string, string> = {
      HOCH: "bg-red-100 text-red-800 border-red-300",
      MITTEL: "bg-yellow-100 text-yellow-800 border-yellow-300",
      NIEDRIG: "bg-gray-100 text-gray-800 border-gray-300",
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${styles[dringlichkeit] || "bg-gray-100 text-gray-800"}`}>
        {dringlichkeit}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header mit Tab-Switcher */}
      <div className="flex items-center justify-end">
        {/* Tab Switcher: Dashboard / Planung */}
        <div className="flex items-center bg-blue-50 rounded-lg p-1 border-2 border-blue-300">
          <Link
            href={`/admin/cases/${caseId}/results`}
            className="px-4 py-2 text-sm font-semibold rounded-md transition-colors text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/50"
          >
            📊 Dashboard
          </Link>
          <Link
            href={`/admin/cases/${caseId}/planung`}
            className="px-4 py-2 text-sm font-semibold rounded-md transition-colors bg-white text-[var(--foreground)] shadow-sm"
          >
            📋 Planung
          </Link>
        </div>
      </div>

      {/* Info-Banner */}
      <div className="admin-card bg-blue-50 border-2 border-blue-200 p-4">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <h3 className="font-semibold text-[var(--foreground)] mb-1">{data.titel} - Version {data.version}</h3>
            <p className="text-sm text-[var(--secondary)] mb-2">{data.basis}</p>
            <p className="text-sm text-[var(--secondary)]"><strong>Methodik:</strong> {data.methodik}</p>
            <p className="text-xs text-[var(--muted)] mt-2">Erstellt: {data.datum}</p>
          </div>
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="btn-secondary text-sm py-1.5 px-3"
          >
            {showSidebar ? "Seitenleiste ausblenden" : "Annahmen anzeigen"}
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Hauptbereich: Planungstabelle */}
        <div className={`flex-1 ${showSidebar ? "lg:w-2/3" : "w-full"}`}>
          <div className="admin-card overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-[var(--border)]">
                  <th className="text-left p-3 font-semibold sticky left-0 bg-white z-10">Position</th>
                  {data.monate.map((m) => (
                    <th key={m.monat} className="text-right p-3 font-semibold min-w-[120px]">
                      {m.monat_name.split(" ")[0]}<br/>
                      <span className="text-xs text-[var(--muted)] font-normal">{m.monat_name.split(" ")[1]}</span>
                    </th>
                  ))}
                  <th className="text-right p-3 font-semibold bg-gray-50">SUMME</th>
                </tr>
              </thead>
              <tbody>
                {/* EINNAHMEN HEADER */}
                <tr className="bg-green-50">
                  <td colSpan={data.monate.length + 2} className="p-3 font-bold text-base">EINZAHLUNGEN</td>
                </tr>

                {/* Umsatz Summe */}
                <tr className="border-b border-[var(--border)]">
                  <td className="p-2 pl-4 font-medium sticky left-0 bg-white z-10">Umsatz</td>
                  {data.monate.map((m) => {
                    const umsatz = m.einnahmen.umsatz?.gesamt || 0;
                    return <td key={m.monat} className="text-right p-2">{formatEUR(umsatz)}</td>;
                  })}
                  <td className="text-right p-2 bg-gray-50 font-medium">
                    {formatEUR(data.monate.reduce((sum, m) => sum + (m.einnahmen.umsatz?.gesamt || 0), 0))}
                  </td>
                </tr>

                {/* KV Velbert */}
                <tr className="text-[var(--muted)]">
                  <td className="p-1 pl-8 text-sm sticky left-0 bg-white z-10">davon KV Velbert</td>
                  {data.monate.map((m) => (
                    <td key={m.monat} className="text-right p-1 text-sm">{formatEUR(m.einnahmen.umsatz?.kv_velbert || 0)}</td>
                  ))}
                  <td className="text-right p-1 text-sm bg-gray-50">
                    {formatEUR(data.monate.reduce((sum, m) => sum + (m.einnahmen.umsatz?.kv_velbert || 0), 0))}
                  </td>
                </tr>

                {/* HZV Velbert */}
                <tr className="text-[var(--muted)]">
                  <td className="p-1 pl-8 text-sm sticky left-0 bg-white z-10">davon HZV Velbert</td>
                  {data.monate.map((m) => (
                    <td key={m.monat} className="text-right p-1 text-sm">{formatEUR(m.einnahmen.umsatz?.hzv_velbert || 0)}</td>
                  ))}
                  <td className="text-right p-1 text-sm bg-gray-50">
                    {formatEUR(data.monate.reduce((sum, m) => sum + (m.einnahmen.umsatz?.hzv_velbert || 0), 0))}
                  </td>
                </tr>

                {/* PVS Velbert */}
                <tr className="text-[var(--muted)]">
                  <td className="p-1 pl-8 text-sm sticky left-0 bg-white z-10">davon PVS Velbert</td>
                  {data.monate.map((m) => (
                    <td key={m.monat} className="text-right p-1 text-sm">{formatEUR(m.einnahmen.umsatz?.pvs_velbert || 0)}</td>
                  ))}
                  <td className="text-right p-1 text-sm bg-gray-50">
                    {formatEUR(data.monate.reduce((sum, m) => sum + (m.einnahmen.umsatz?.pvs_velbert || 0), 0))}
                  </td>
                </tr>

                {/* KV Uckerath */}
                <tr className="text-[var(--muted)]">
                  <td className="p-1 pl-8 text-sm sticky left-0 bg-white z-10">davon KV Uckerath</td>
                  {data.monate.map((m) => (
                    <td key={m.monat} className="text-right p-1 text-sm">{formatEUR(m.einnahmen.umsatz?.kv_uckerath || 0)}</td>
                  ))}
                  <td className="text-right p-1 text-sm bg-gray-50">
                    {formatEUR(data.monate.reduce((sum, m) => sum + (m.einnahmen.umsatz?.kv_uckerath || 0), 0))}
                  </td>
                </tr>

                {/* HZV Uckerath */}
                <tr className="text-[var(--muted)]">
                  <td className="p-1 pl-8 text-sm sticky left-0 bg-white z-10">davon HZV Uckerath</td>
                  {data.monate.map((m) => (
                    <td key={m.monat} className="text-right p-1 text-sm">{formatEUR(m.einnahmen.umsatz?.hzv_uckerath || 0)}</td>
                  ))}
                  <td className="text-right p-1 text-sm bg-gray-50">
                    {formatEUR(data.monate.reduce((sum, m) => sum + (m.einnahmen.umsatz?.hzv_uckerath || 0), 0))}
                  </td>
                </tr>

                {/* PVS Uckerath */}
                <tr className="text-[var(--muted)]">
                  <td className="p-1 pl-8 text-sm sticky left-0 bg-white z-10">davon PVS Uckerath</td>
                  {data.monate.map((m) => (
                    <td key={m.monat} className="text-right p-1 text-sm">{formatEUR(m.einnahmen.umsatz?.pvs_uckerath || 0)}</td>
                  ))}
                  <td className="text-right p-1 text-sm bg-gray-50">
                    {formatEUR(data.monate.reduce((sum, m) => sum + (m.einnahmen.umsatz?.pvs_uckerath || 0), 0))}
                  </td>
                </tr>

                {/* Altforderungen */}
                <tr className="border-b border-[var(--border)]">
                  <td className="p-2 pl-4 sticky left-0 bg-white z-10">Altforderungen</td>
                  {data.monate.map((m) => {
                    const alt = typeof m.einnahmen.altforderungen === 'object' ? m.einnahmen.altforderungen.gesamt : (m.einnahmen.altforderungen || 0);
                    return <td key={m.monat} className="text-right p-2">{formatEUR(alt)}</td>;
                  })}
                  <td className="text-right p-2 bg-gray-50">
                    {formatEUR(data.monate.reduce((sum, m) => {
                      const alt = typeof m.einnahmen.altforderungen === 'object' ? m.einnahmen.altforderungen.gesamt : (m.einnahmen.altforderungen || 0);
                      return sum + alt;
                    }, 0))}
                  </td>
                </tr>

                {/* Insolvenzspezifische Einzahlungen */}
                <tr className="border-b border-[var(--border)]">
                  <td className="p-2 pl-4 sticky left-0 bg-white z-10">Insolvenzspezifische Einzahlungen</td>
                  {data.monate.map((m) => {
                    const inso = typeof m.einnahmen.insolvenzspezifisch === 'object' ? m.einnahmen.insolvenzspezifisch.gesamt : (m.einnahmen.insolvenzspezifisch || 0);
                    return <td key={m.monat} className="text-right p-2">{formatEUR(inso)}</td>;
                  })}
                  <td className="text-right p-2 bg-gray-50">
                    {formatEUR(data.monate.reduce((sum, m) => {
                      const inso = typeof m.einnahmen.insolvenzspezifisch === 'object' ? m.einnahmen.insolvenzspezifisch.gesamt : (m.einnahmen.insolvenzspezifisch || 0);
                      return sum + inso;
                    }, 0))}
                  </td>
                </tr>

                {/* SUMME EINZAHLUNGEN */}
                <tr className="bg-green-100 font-bold border-t-2 border-[var(--border)]">
                  <td className="p-3 sticky left-0 bg-green-100 z-10">Summe Einzahlungen</td>
                  {data.monate.map((m) => (
                    <td key={m.monat} className="text-right p-3">{formatEUR(m.einnahmen.gesamt)}</td>
                  ))}
                  <td className="text-right p-3 bg-gray-50 font-bold">{formatEUR(data.zusammenfassung.gesamteinnahmen)}</td>
                </tr>

                {/* LEERZEILE */}
                <tr><td colSpan={data.monate.length + 2} className="py-2"></td></tr>

                {/* AUSGABEN HEADER */}
                <tr className="bg-red-50">
                  <td colSpan={data.monate.length + 2} className="p-3 font-bold text-base">AUSZAHLUNGEN</td>
                </tr>

                {/* Personalaufwand */}
                <tr className="border-b border-[var(--border)]">
                  <td className="p-2 pl-4 font-medium sticky left-0 bg-white z-10">Personalaufwand</td>
                  {data.monate.map((m) => {
                    const personal = typeof m.ausgaben.personal === 'object' ? m.ausgaben.personal.gesamt : (m.ausgaben.personal?.betrag || 0);
                    return <td key={m.monat} className="text-right p-2 text-red-700">{formatEUR(personal)}</td>;
                  })}
                  <td className="text-right p-2 bg-gray-50 font-medium text-red-700">
                    {formatEUR(data.monate.reduce((sum, m) => {
                      const personal = typeof m.ausgaben.personal === 'object' ? m.ausgaben.personal.gesamt : (m.ausgaben.personal?.betrag || 0);
                      return sum + personal;
                    }, 0))}
                  </td>
                </tr>

                {/* Betriebliche Auszahlungen */}
                <tr className="border-b border-[var(--border)]">
                  <td className="p-2 pl-4 font-medium sticky left-0 bg-white z-10">Betriebliche Auszahlungen</td>
                  {data.monate.map((m) => {
                    const betrieb = typeof m.ausgaben.betrieblich === 'object' ? m.ausgaben.betrieblich.gesamt : (m.ausgaben.betrieblich || 0);
                    return <td key={m.monat} className="text-right p-2 text-red-700">{formatEUR(betrieb)}</td>;
                  })}
                  <td className="text-right p-2 bg-gray-50 font-medium text-red-700">
                    {formatEUR(data.monate.reduce((sum, m) => {
                      const betrieb = typeof m.ausgaben.betrieblich === 'object' ? m.ausgaben.betrieblich.gesamt : (m.ausgaben.betrieblich || 0);
                      return sum + betrieb;
                    }, 0))}
                  </td>
                </tr>

                {/* Insolvenzspezifische Auszahlungen */}
                <tr className="border-b border-[var(--border)]">
                  <td className="p-2 pl-4 font-medium sticky left-0 bg-white z-10">Insolvenzspezifische Auszahlungen</td>
                  {data.monate.map((m) => {
                    const inso = typeof m.ausgaben.insolvenzspezifisch === 'object' ? m.ausgaben.insolvenzspezifisch.gesamt : (m.ausgaben.insolvenzspezifisch || 0);
                    return <td key={m.monat} className="text-right p-2 text-red-700">{formatEUR(inso)}</td>;
                  })}
                  <td className="text-right p-2 bg-gray-50 font-medium text-red-700">
                    {formatEUR(data.monate.reduce((sum, m) => {
                      const inso = typeof m.ausgaben.insolvenzspezifisch === 'object' ? m.ausgaben.insolvenzspezifisch.gesamt : (m.ausgaben.insolvenzspezifisch || 0);
                      return sum + inso;
                    }, 0))}
                  </td>
                </tr>

                {/* SUMME AUSZAHLUNGEN */}
                <tr className="bg-red-100 font-bold border-t-2 border-[var(--border)]">
                  <td className="p-3 sticky left-0 bg-red-100 z-10">Summe Auszahlungen</td>
                  {data.monate.map((m) => (
                    <td key={m.monat} className="text-right p-3 text-red-700">{formatEUR(m.ausgaben.gesamt)}</td>
                  ))}
                  <td className="text-right p-3 bg-gray-50 font-bold text-red-700">{formatEUR(data.zusammenfassung.gesamtausgaben)}</td>
                </tr>

                {/* LEERZEILE */}
                <tr><td colSpan={data.monate.length + 2} className="py-2"></td></tr>

                {/* SALDO */}
                <tr className="bg-blue-100 font-bold border-t-2 border-[var(--border)]">
                  <td className="p-3 sticky left-0 bg-blue-100 z-10">SALDO</td>
                  {data.monate.map((m) => (
                    <td key={m.monat} className={`text-right p-3 ${m.saldo < 0 ? "text-red-600" : "text-green-600"}`}>
                      {formatEUR(m.saldo)}
                    </td>
                  ))}
                  <td className={`text-right p-3 bg-gray-50 font-bold ${data.zusammenfassung.nettosaldo < 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatEUR(data.zusammenfassung.nettosaldo)}
                  </td>
                </tr>

              </tbody>
            </table>
          </div>

          {/* Monatliche Anmerkungen */}
          {data.monate.some(m => m.anmerkungen && m.anmerkungen.length > 0) && (
            <div className="admin-card mt-6">
              <h3 className="font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Monatliche Anmerkungen
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {data.monate.map((m) => m.anmerkungen && m.anmerkungen.length > 0 && (
                  <div key={m.monat} className="border-l-4 border-blue-400 pl-3 py-2">
                    <div className="font-semibold text-sm mb-2">{m.monat_name}</div>
                    <ul className="space-y-1">
                      {m.anmerkungen.map((note, idx) => (
                        <li key={idx} className="text-xs text-[var(--secondary)]">• {note}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Kritische Monate */}
          {data.zusammenfassung.kritische_monate && data.zusammenfassung.kritische_monate.length > 0 && (
            <div className="admin-card mt-6 bg-yellow-50 border-2 border-yellow-300 p-4">
              <h3 className="font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Kritische Monate
              </h3>
              <div className="space-y-2">
                {data.zusammenfassung.kritische_monate.map((km) => (
                  <div key={km.monat} className="text-sm">
                    <span className="font-semibold">{km.monat}:</span> {formatEUR(km.saldo)} - {km.grund}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Abweichungen zur IV-Planung */}
          {data.abweichungen_zur_iv_planung && data.abweichungen_zur_iv_planung.length > 0 && (
            <div className="admin-card mt-6">
              <h3 className="font-semibold text-[var(--foreground)] mb-4">Abweichungen zur IV-Planung (14.01.2026)</h3>
              <div className="space-y-3">
                {data.abweichungen_zur_iv_planung.map((abw, idx) => (
                  <div key={idx} className="border-l-4 border-orange-400 pl-4 py-2">
                    <div className="font-semibold text-sm">{abw.position}</div>
                    <div className="text-xs text-[var(--muted)] mt-1">
                      <span>IV: {formatEUR(abw.iv)}</span>
                      <span className="mx-2">→</span>
                      <span>Korrigiert: {formatEUR(abw.korrigiert)}</span>
                      <span className="ml-2 font-semibold text-orange-600">
                        ({abw.differenz > 0 ? "+" : ""}{formatEUR(abw.differenz)}, {abw.prozent > 0 ? "+" : ""}{abw.prozent.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="text-xs text-[var(--secondary)] mt-1">{abw.begruendung}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Seitenleiste: Annahmen & Offene Fragen */}
        {showSidebar && (
          <div className="lg:w-1/3 space-y-6">
            {/* Annahmen */}
            <div className="admin-card">
              <h3 className="font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Annahmen
              </h3>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {data.annahmen.map((a) => (
                  <div key={a.id} className="border-l-4 border-blue-400 pl-3 py-2 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-xs text-[var(--muted)]">{a.id}</span>
                      {getStatusBadge(a.status)}
                    </div>
                    <div className="font-semibold text-[var(--foreground)] mb-1">{a.titel}</div>
                    <div className="text-xs text-[var(--secondary)] mb-1">{a.beschreibung}</div>
                    {a.abweichung_iv && (
                      <div className="text-xs text-orange-600 font-semibold mt-1">Abweichung: {a.abweichung_iv}</div>
                    )}
                    <div className="text-[10px] text-[var(--muted)] mt-1">Quelle: {a.quelle}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Offene Fragen */}
            <div className="admin-card bg-yellow-50 border-2 border-yellow-300">
              <h3 className="font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Offene Fragen
              </h3>
              <div className="space-y-3">
                {data.offene_fragen.map((f) => (
                  <div key={f.id} className="bg-white rounded p-3 border border-yellow-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-xs text-[var(--muted)]">{f.id}</span>
                      {getDringlichkeitBadge(f.dringlichkeit)}
                    </div>
                    <div className="text-sm text-[var(--foreground)] mb-2">{f.frage}</div>
                    <div className="text-xs text-[var(--muted)]">
                      Zuständig: <span className="font-semibold">{f.zustaendig}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
