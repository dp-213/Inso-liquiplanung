"use client";

interface BusinessLogicContentProps {
  insolvencyDate?: string;
}

export default function BusinessLogicContent({ insolvencyDate }: BusinessLogicContentProps) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("de-DE");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-card p-6 border-l-4 border-slate-600">
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
          Business-Logik Hausärztliche Versorgung PLUS eG
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Abrechnungslogik, Zahlungsströme und Vertragsregeln
        </p>
      </div>

      {/* Verfahrenseckdaten */}
      <div className="admin-card">
        <div className="px-6 py-4 bg-slate-50 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Verfahrenseckdaten</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-[var(--muted)] text-xs mb-1">Aktenzeichen</div>
              <div className="font-medium">70d IN 362/25, AG Köln</div>
            </div>
            <div>
              <div className="text-[var(--muted)] text-xs mb-1">Insolvenzeröffnung</div>
              <div className="font-medium">{insolvencyDate ? formatDate(insolvencyDate) : "—"}</div>
            </div>
            <div>
              <div className="text-[var(--muted)] text-xs mb-1">Stichtag Alt/Neu</div>
              <div className="font-medium">29.10.2025</div>
            </div>
            <div>
              <div className="text-[var(--muted)] text-xs mb-1">Massekredit</div>
              <div className="font-medium">137.000 EUR (Sparkasse HRV)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Patientenarten & Abrechnungswege */}
      <div className="admin-card">
        <div className="px-6 py-4 bg-slate-50 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Patientenarten & Abrechnungswege</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GKV */}
            <div className="border-2 border-slate-200 rounded-lg p-5">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-base">GKV-Patienten (gesetzlich)</h3>
                  <p className="text-xs text-[var(--muted)]">2 Abrechnungswege</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 rounded p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded text-xs font-bold flex items-center justify-center">1</div>
                    <div className="font-semibold text-sm">KV (Regelversorgung)</div>
                  </div>
                  <div className="text-xs text-[var(--muted)] space-y-1 ml-8">
                    <div>→ KVNO (Kassenärztliche Vereinigung)</div>
                    <div>→ Quartalsabrechnung nach BSNR</div>
                    <div>→ Velbert + Uckerath (Eitorf über Uckerath)</div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded text-xs font-bold flex items-center justify-center">2</div>
                    <div className="font-semibold text-sm">HZV (Hausarztvertrag)</div>
                  </div>
                  <div className="text-xs text-[var(--muted)] space-y-1 ml-8">
                    <div>→ HAVG (Hausarztzentrierte Versorgung)</div>
                    <div>→ Monatliche Pauschalen nach LANR</div>
                    <div>→ 8 Ärzte (arztgebunden, nicht standortgebunden)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* PKV */}
            <div className="border-2 border-slate-200 rounded-lg p-5">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                <div className="w-10 h-10 bg-purple-100 rounded flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-base">PKV-Patienten (privat)</h3>
                  <p className="text-xs text-[var(--muted)]">1 Abrechnungsweg</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 rounded p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-purple-600 text-white rounded text-xs font-bold flex items-center justify-center">1</div>
                    <div className="font-semibold text-sm">PVS (Privatliquidation)</div>
                  </div>
                  <div className="text-xs text-[var(--muted)] space-y-1 ml-8">
                    <div>→ PVS rhein-ruhr</div>
                    <div>→ Einzelrechnungen nach GOÄ</div>
                    <div>→ 2x monatlich nach Zahlungseingang</div>
                    <div className="text-amber-600">⚠ Verzug bis 6 Monate möglich</div>
                  </div>
                </div>

                <div className="bg-amber-50 rounded p-3 border border-amber-200">
                  <div className="text-xs">
                    <strong>Problem:</strong> Nur Gesamtbetrag auf Kontoauszug, keine Einzelzuordnung zu Behandlungsdatum.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KV-Abrechnungszyklus */}
      <div className="admin-card">
        <div className="px-6 py-4 bg-slate-50 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">KV-Abrechnungszyklus (Beispiel Q4/2025)</h2>
        </div>
        <div className="p-6">
          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-0 top-6 bottom-6 w-0.5 bg-slate-200"></div>

            <div className="space-y-6">
              {/* Oktober */}
              <div className="relative flex items-start gap-4 pl-6">
                <div className="absolute left-0 w-3 h-3 bg-slate-400 rounded-full -ml-1.5"></div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="font-semibold">Oktober 2025</div>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded">Leistungsmonat</span>
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    Patienten werden behandelt → Leistung erbracht
                  </div>
                </div>
              </div>

              {/* November */}
              <div className="relative flex items-start gap-4 pl-6">
                <div className="absolute left-0 w-3 h-3 bg-blue-500 rounded-full -ml-1.5"></div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="font-semibold">November 2025</div>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">Abschlagszahlung 80%</span>
                  </div>
                  <div className="text-sm text-[var(--muted)] mb-2">
                    KV zahlt Abschlag für Oktober-Leistung
                  </div>
                  <div className="bg-slate-50 rounded p-2 text-xs">
                    <div className="mb-1 font-medium">Alt/Neu-Aufteilung Q4/2025:</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-amber-500 rounded-l" style={{width: '33.33%'}}></div>
                      <div className="flex-1 h-2 bg-green-500 rounded-r" style={{width: '66.67%'}}></div>
                    </div>
                    <div className="flex justify-between mt-1 text-[var(--muted)]">
                      <span>1/3 Altmasse</span>
                      <span>2/3 Neumasse</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Januar */}
              <div className="relative flex items-start gap-4 pl-6">
                <div className="absolute left-0 w-3 h-3 bg-green-500 rounded-full -ml-1.5"></div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="font-semibold">Januar 2026</div>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">Restzahlung 20%</span>
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    KV zahlt finale Restzahlung für Q4/2025 (übernächstes Quartal)
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
            <strong>Rechtsgrundlage:</strong> Massekreditvertrag §1(2)a
          </div>
        </div>
      </div>

      {/* HZV-Zeitversatz */}
      <div className="admin-card">
        <div className="px-6 py-4 bg-slate-50 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">HZV-Zeitversatz & Alt/Neu-Regel</h2>
        </div>
        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-center gap-8 mb-4">
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium text-[var(--muted)]">Leistung:</div>
                <div className="px-3 py-2 bg-slate-100 rounded font-medium">Monat M-1</div>
              </div>
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium text-[var(--muted)]">Zahlung:</div>
                <div className="px-3 py-2 bg-blue-500 text-white rounded font-medium">Monat M</div>
              </div>
            </div>
            <div className="text-sm text-[var(--muted)]">
              Beispiel: Dezember-Zahlung = November-Leistung
            </div>
          </div>

          <div className="bg-slate-50 rounded p-4">
            <div className="font-semibold mb-3 text-sm">Q4/2025 (Oktober - Dezember):</div>
            <div className="mb-1 text-xs text-[var(--muted)]">Alt/Neu-Aufteilung:</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-8 rounded overflow-hidden border border-slate-300 flex">
                <div className="bg-amber-500 flex items-center justify-center text-white text-xs font-medium" style={{width: '33.33%'}}>
                  1/3 Altmasse
                </div>
                <div className="bg-green-500 flex items-center justify-center text-white text-xs font-medium" style={{width: '66.67%'}}>
                  2/3 Neumasse
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
            <strong>Rechtsgrundlage:</strong> Massekreditvertrag §1(2)b
          </div>
        </div>
      </div>

      {/* Zahlungsströme */}
      <div className="admin-card">
        <div className="px-6 py-4 bg-slate-50 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Zahlungsströme</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ISK Velbert */}
            <div className="border-2 border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold">ISK Velbert</div>
                  <div className="text-xs text-[var(--muted)] font-mono">400080228</div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div>KV Velbert</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <div>PVS Velbert</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                  <div>Sparkasse-Auskehrungen</div>
                </div>
              </div>
            </div>

            {/* ISK Uckerath */}
            <div className="border-2 border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold">ISK Uckerath</div>
                  <div className="text-xs text-[var(--muted)] font-mono">400080156</div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div>KV Uckerath + Eitorf</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <div>HZV ALLE Ärzte (inkl. Velbert!)</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <div>PVS Uckerath + Eitorf</div>
                </div>
              </div>
              <div className="mt-3 p-2 bg-blue-50 rounded text-xs">
                <strong>Wichtig:</strong> Alle HZV-Zahlungen (auch Velbert) laufen hier ein
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LANR-Zuordnung */}
      <div className="admin-card">
        <div className="px-6 py-4 bg-slate-50 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">HZV-Ärzte (LANR-gebunden)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Standort</th>
                <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">Arzt</th>
                <th className="text-left py-3 px-4 font-medium text-[var(--secondary)]">LANR</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--secondary)]">HZV monatlich (ca.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4">Velbert</td>
                <td className="py-3 px-4 font-medium">van Suntum</td>
                <td className="py-3 px-4 font-mono text-xs">3892462</td>
                <td className="py-3 px-4 text-right">5.000 - 8.000 EUR</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4">Velbert</td>
                <td className="py-3 px-4 font-medium">Beyer</td>
                <td className="py-3 px-4 font-mono text-xs">8836735</td>
                <td className="py-3 px-4 text-right">5.000 - 8.000 EUR</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4">Velbert</td>
                <td className="py-3 px-4 font-medium">Dr. Kamler</td>
                <td className="py-3 px-4 font-mono text-xs">7729639</td>
                <td className="py-3 px-4 text-right text-[var(--muted)]">—</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4">Uckerath</td>
                <td className="py-3 px-4 font-medium">Binas</td>
                <td className="py-3 px-4 font-mono text-xs">1445587</td>
                <td className="py-3 px-4 text-right">7.000 - 8.000 EUR</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4">Uckerath</td>
                <td className="py-3 px-4 font-medium">Fischer</td>
                <td className="py-3 px-4 font-mono text-xs">3243603</td>
                <td className="py-3 px-4 text-right">3.500 - 4.000 EUR</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4">Uckerath</td>
                <td className="py-3 px-4 font-medium">Ludwig</td>
                <td className="py-3 px-4 font-mono text-xs">4652451</td>
                <td className="py-3 px-4 text-right">1.700 - 2.000 EUR</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4">Uckerath</td>
                <td className="py-3 px-4 font-medium">Schweitzer</td>
                <td className="py-3 px-4 font-mono text-xs">1203618</td>
                <td className="py-3 px-4 text-right">2.000 - 3.000 EUR</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4">Eitorf</td>
                <td className="py-3 px-4 font-medium">Rösing</td>
                <td className="py-3 px-4 font-mono text-xs">8898288</td>
                <td className="py-3 px-4 text-right">5.000 - 10.000 EUR</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Bankverbindungen */}
      <div className="admin-card">
        <div className="px-6 py-4 bg-slate-50 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Bankverbindungen & Status</h2>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {/* Sparkasse */}
          <div className="p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-[var(--foreground)]">Sparkasse HRV</h3>
                <div className="text-xs text-[var(--muted)] font-mono">DE83 3345 0000 0034 3797 68</div>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">Massekreditvereinbarung</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-[var(--muted)] text-xs">Saldo 31.10.25</div>
                <div className="font-medium">24.970,61 EUR</div>
              </div>
              <div>
                <div className="text-[var(--muted)] text-xs">Darlehen</div>
                <div className="font-medium">230k + 300k EUR</div>
              </div>
              <div>
                <div className="text-[var(--muted)] text-xs">Sicherheit</div>
                <div className="font-medium">KV-Abtretung</div>
              </div>
            </div>
          </div>

          {/* apoBank */}
          <div className="p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-[var(--foreground)]">apoBank</h3>
                <div className="text-xs text-[var(--muted)]">2 Konten (Zentrale + Uckerath)</div>
              </div>
              <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">KEINE Vereinbarung</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div>
                <div className="text-[var(--muted)] text-xs">Zentrale (28818923)</div>
                <div className="font-medium text-red-600">-287.372,10 EUR</div>
              </div>
              <div>
                <div className="text-[var(--muted)] text-xs">Uckerath (78818923)</div>
                <div className="font-medium">23.514,27 EUR</div>
              </div>
            </div>
            <div className="p-3 bg-green-50 rounded text-xs border border-green-200">
              Massekreditvertrag vereinbart (Jan 2026). 10% Fortführungsbeitrag zzgl. USt.
            </div>
          </div>
        </div>
      </div>

      {/* Offene Punkte */}
      <div className="admin-card">
        <div className="px-6 py-4 bg-slate-50 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Offene Punkte</h2>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-green-50 rounded border border-green-200">
              <div className="w-6 h-6 rounded bg-green-600 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">&#10003;</div>
              <div className="text-sm">
                <strong>apoBank:</strong> Massekreditvertrag vereinbart (Jan 2026) - 10% Fortführungsbeitrag zzgl. USt, max. 100.000 EUR
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded border border-amber-200">
              <div className="w-6 h-6 rounded bg-amber-600 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">2</div>
              <div className="text-sm">
                <strong>PVS:</strong> Keine Einzelzuordnung zu Behandlungsdatum möglich
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded border border-amber-200">
              <div className="w-6 h-6 rounded bg-amber-600 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">3</div>
              <div className="text-sm">
                <strong>HZV-Versichertenzahlen:</strong> Nicht vollständig vorhanden
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
