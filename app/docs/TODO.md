# TODO: Offene Features & Verbesserungen

## 🔴 P0 - Kritisch

### Scope-Support für RevenueTable + BankAccountsTab

**Status:** Quick-Fix implementiert (Tabs werden ausgeblendet bei Scope ≠ GLOBAL)
**Nächster Schritt:** Proper Scope-Support implementieren

**Problem:**
- RevenueTable und BankAccountsTab respektieren aktuell den Scope-Toggle nicht
- Quick-Fix: Tabs werden ausgeblendet wenn Scope ≠ GLOBAL → verhindert Verwirrung
- Langfristig: Tabs sollen Scope-Support bekommen

**Betroffene Komponenten:**

1. **RevenueTable** (`/components/dashboard/RevenueTable.tsx`)
   - Aktuell: `/api/cases/${caseId}/ledger/revenue` (global)
   - Benötigt: `?scope=${scope}` Parameter
   - Props erweitern: `scope: LiquidityScope`

2. **BankAccountsTab** (`/components/dashboard/BankAccountsTab.tsx`)
   - Aktuell: `/api/cases/${caseId}/bank-accounts` (alle Konten)
   - Benötigt: Filterung nach locationId basierend auf scope
   - Props erweitern: `scope: LiquidityScope`

**Betroffene API-Routes:**

1. **`/api/cases/[id]/ledger/revenue/route.ts`**
   - Erweitern: `searchParams.get("scope")` lesen
   - Filtern: LedgerEntries nach locationId
   - Scope-Mapping:
     - `GLOBAL` → keine Filterung
     - `LOCATION_VELBERT` → locationId = "loc-velbert"
     - `LOCATION_UCKERATH_EITORF` → locationId IN ("loc-uckerath", "loc-eitorf")

2. **`/api/cases/[id]/bank-accounts/route.ts`**
   - Erweitern: `searchParams.get("scope")` lesen
   - Filtern: BankAccounts nach locationId
   - Zusätzlich: Nur Transaktionen des jeweiligen Standorts berücksichtigen

**Implementierungsschritte:**

1. API-Routes erweitern:
   ```typescript
   const scope = searchParams.get("scope") || "GLOBAL";
   let locationFilter = {};
   if (scope === "LOCATION_VELBERT") {
     locationFilter = { locationId: "loc-velbert" };
   } else if (scope === "LOCATION_UCKERATH_EITORF") {
     locationFilter = { locationId: { in: ["loc-uckerath", "loc-eitorf"] } };
   }
   ```

2. Komponenten erweitern:
   ```typescript
   interface RevenueTableProps {
     caseId: string;
     months?: number;
     showSummary?: boolean;
     scope?: LiquidityScope;  // ← NEU
   }
   ```

3. UnifiedCaseDashboard: scope an Komponenten übergeben:
   ```typescript
   <RevenueTable caseId={caseId} months={6} showSummary={true} scope={scope} />
   <BankAccountsTab caseId={caseId} scope={scope} />
   ```

4. Quick-Fix entfernen:
   - `tabsWithoutScopeSupport` Set löschen
   - Filter-Logik entfernen

**Testing:**
- Toggle zwischen GLOBAL/VELBERT/UCKERATH
- Prüfen: Revenue-Zahlen ändern sich konsistent
- Prüfen: Nur relevante Bankkonten sichtbar
- Prüfen: Summen stimmen überein mit Matrix/Forecast

**Zeitaufwand:** ~30-45 Min
**Kritikalität:** Mittel (UX-Problem, aktuell mit Quick-Fix abgesichert)

---

## 🟡 P1 - Wichtig

### IST-Vorrang Feature implementieren

**Status:** Dokumentiert, Workaround via Workflow
**Nächster Schritt:** Architektur-Design + Implementierung

**Problem:**
- Aggregation in `ledger-aggregation.ts` summiert IST und PLAN parallel
- Führt zu Überdeckung/Doppelzählung wenn für dieselbe Periode beide vorhanden sind
- Aktueller Workaround: Workflow soll sicherstellen, dass PLAN gelöscht wird bei IST-Import

**IST-Vorrang bedeutet:**
- Für jede Kombination aus (periodIndex, categoryKey, bankAccount, counterparty)
- WENN IST-Eintrag existiert: Nur IST summieren, PLAN ignorieren
- WENN kein IST-Eintrag: PLAN verwenden

**Betroffene Dateien:**
- `/app/src/lib/ledger-aggregation.ts` (Zeile 374-487)
- `/app/src/lib/ledger/aggregation.ts` (falls verwendet)

**Architektur-Entscheidungen nötig:**

1. **Gruppierungs-Schlüssel:** Was definiert "dieselbe Buchung"?
   - Option A: `(periodIndex, categoryKey, bankAccountId)`
   - Option B: `(periodIndex, categoryKey, bankAccountId, counterpartyId)`
   - Option C: `(periodIndex, description, bankAccountId)` (zu granular?)
   - **Empfehlung:** Option A (einfach, robust)

2. **Transparenz:** Wie wird IST-Vorrang dokumentiert?
   - Warning-System: "X PLAN-Einträge übersprungen (IST vorhanden)"
   - Audit-Trail: Welche PLAN-Einträge wurden ignoriert?
   - UI-Indikator: Badge "IST überschreibt PLAN"

3. **Performance:**
   - Bei großen Datenmengen: Pre-Pass Gruppierung erforderlich
   - Hash-Map für schnelle IST-Lookup: `Map<groupKey, boolean>`

4. **Migration/Backward-Compatibility:**
   - Feature-Flag: `enableIstVorrang: boolean`
   - Schrittweise Einführung möglich
   - A/B-Testing mit/ohne IST-Vorrang

**Implementierungsschritte:**

1. **Pre-Pass: Gruppiere IST-Einträge**
   ```typescript
   const istKeys = new Set<string>();
   for (const entry of entries.filter(e => e.valueType === "IST")) {
     const key = `${periodIndex}-${categoryKey}-${bankAccountId}`;
     istKeys.add(key);
   }
   ```

2. **Main-Pass: Conditional Addition**
   ```typescript
   for (const entry of entries) {
     const key = `${periodIndex}-${categoryKey}-${bankAccountId}`;

     if (entry.valueType === "PLAN" && istKeys.has(key)) {
       // SKIP: IST vorhanden für diese Gruppe
       skippedPlanCount++;
       continue;
     }

     // Normale Aggregation...
   }
   ```

3. **Statistik & Warnings**
   ```typescript
   if (skippedPlanCount > 0) {
     warnings.push({
       type: "IST_OVERRIDES_PLAN",
       severity: "info",
       message: `${skippedPlanCount} PLAN-Einträge übersprungen (IST-Vorrang)`,
       count: skippedPlanCount,
     });
   }
   ```

4. **Testing:**
   - Unit-Tests: Verschiedene IST/PLAN-Kombinationen
   - Integration-Test: HVPlus Fall mit gemischten Daten
   - Vergleich: Zahlen mit/ohne IST-Vorrang

**Zeitaufwand:** ~2-3 Stunden
**Kritikalität:** Mittel-Hoch (führt zu falschen Zahlen bei Überlappung)

---

## 🟢 P2 - Nice-to-have

### Weitere Verbesserungen

(Hier können später weitere TODOs ergänzt werden)

---

**Letzte Aktualisierung:** 2026-02-08
