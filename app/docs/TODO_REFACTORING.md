# TODO: Refactoring-Plan

**Status:** 🔴 ZURÜCKGESTELLT
**Erstellt:** 09. Februar 2026
**Grund:** Erst inhaltliche Änderungen abschließen, dann Refactoring angehen

---

## 🎯 Ziel

Code-Struktur verbessern, um Dashboard-Änderungen und Debugging zu erleichtern.

**Hauptprobleme aktuell:**
1. ⚠️ API-Routen noch groß, aber Aggregationslogik bereits extrahiert nach `lib/liquidity-matrix/aggregate.ts` (v2.18.0)
2. ❌ Dashboard-Änderungen aufwendig (Logik verstreut)
3. ❌ Scope-Logik mehrfach implementiert (5 Stellen)
4. ✅ Dashboard-Komponenten konsolidiert (v2.29.0: Portal-Standalone-Seiten eliminiert, nur noch UnifiedCaseDashboard)

---

## 📊 Analyse: Das Liquidity-Matrix-Problem

### Aktueller Stand (803 Zeilen)

```
/app/api/cases/[id]/dashboard/liquidity-matrix/route.ts
└── GET() - EINE Funktion mit 650 Zeilen:
    ├── Zeile 157-175:  Auth-Check (Admin + Customer)
    ├── Zeile 177-186:  Query-Parameter parsen
    ├── Zeile 188-206:  Case + Plan laden
    ├── Zeile 212-234:  LedgerEntries laden
    ├── Zeile 236-243:  Scope-Filter anwenden
    ├── Zeile 245-255:  Bank-Mapping aufbauen
    ├── Zeile 257-268:  Perioden aufbauen
    ├── Zeile 270-281:  Row-Aggregations initialisieren
    ├── Zeile 283-299:  IST-Vorrang-Logik
    ├── Zeile 300-450:  Entry-Matching + Aggregation (150 Zeilen!)
    ├── Zeile 451-550:  Opening/Closing Balance berechnen
    ├── Zeile 551-650:  Response formatieren
    └── Zeile 651-803:  Metadaten + Return
```

**Problem:**
- Claude Code muss IMMER die ganze Datei lesen (2000+ Tokens)
- Änderungen fehleranfällig (z.B. "IST-Vorrang ändern" → muss Zeile 283-450 verstehen)
- Testing unmöglich (Funktion macht 15 verschiedene Dinge)
- Debugging Horror ("Wo schlägt Aggregation fehl?")

### Scope-Logik Duplikation (5 Stellen)

```typescript
// 1. In aggregation.ts (Zeile 30-36)
const SCOPE_LOCATION_IDS = { ... }

// 2. In matrix-config.ts (Zeile 34-43)
export const LIQUIDITY_SCOPE_LABELS = { ... }

// 3. In liquidity-matrix/route.ts (Zeile 181-183)
const scope: LiquidityScope = ['GLOBAL', ...].includes(...)

// 4. In matrix-config.ts (Zeile 237-256): filterEntriesByScope()

// 5. In aggregation.ts (Zeile 148-180): Scope-Filter-Logik
```

**Problem:** Neuer Standort → 5 Stellen ändern, fehleranfällig!

---

## 🚀 Refactoring-Plan: 3 Phasen

### Phase 1: Service Layer (keine Breaking Changes) ⭐ PRIORITÄT

**Ziel:** API-Routen dünn machen, Logik extrahieren

#### Neue Struktur

```
/lib/services/
  ├── dashboard/
  │   ├── liquidity-matrix.service.ts   (400 Zeilen, modular)
  │   ├── ist-plan-comparison.service.ts
  │   └── rolling-forecast.service.ts
  ├── ledger/
  │   ├── aggregation.service.ts
  │   └── classification.service.ts
  └── shared/
      ├── scope-resolver.ts              (Zentralisiert Scope-Logik)
      └── period-calculator.ts
```

#### Vorher vs. Nachher

**Vorher (803 Zeilen):**
```typescript
export async function GET(request, { params }) {
  // Auth (20 Zeilen)
  const adminSession = await getSession();
  const customerSession = await getCustomerSession();
  // ... 20 Zeilen Auth-Logic

  // Query Parsing (10 Zeilen)
  const estateFilter = searchParams.get('estateFilter') || 'GESAMT';
  // ... 10 Zeilen Parameter-Logic

  // DB Queries (50 Zeilen)
  const existingCase = await prisma.case.findUnique({ ... });
  // ... 50 Zeilen DB-Queries

  // Business Logic (500 Zeilen!)
  // Scope-Filter, Aggregation, IST-Vorrang, Balances, etc.
  // ... 500 Zeilen verschachtelte Logik

  // Response Formatting (50 Zeilen)
  return NextResponse.json({ ... });
}
```

**Nachher (100 Zeilen):**
```typescript
import { LiquidityMatrixService } from '@/lib/services/dashboard/liquidity-matrix.service';
import { validateAccess, parseLiquidityMatrixQuery } from './helpers';

export async function GET(request, { params }) {
  // 1. Auth (20 Zeilen) - bleibt in Route
  const session = await validateAccess(request, params);

  // 2. Parse Query (10 Zeilen)
  const options = parseLiquidityMatrixQuery(request.url);

  // 3. Load Data (10 Zeilen)
  const service = new LiquidityMatrixService(prisma);

  // 4. Build Matrix (5 Zeilen) ⭐ Die ganze Logik steckt hier
  const matrix = await service.build(caseId, options);

  // 5. Return (10 Zeilen)
  return NextResponse.json(matrix);
}
```

**Service (400 Zeilen, modular):**
```typescript
// /lib/services/dashboard/liquidity-matrix.service.ts
export class LiquidityMatrixService {
  constructor(private prisma: PrismaClient) {}

  async build(caseId: string, options: MatrixOptions) {
    // Orchestriert einzelne, testbare Funktionen:
    const data = await this.loadData(caseId, options);
    const periods = this.buildPeriods(data.plan);
    const entries = this.filterByScope(data.entries, options.scope);
    const aggregations = this.aggregateEntries(entries, periods);
    const balances = this.calculateBalances(aggregations);
    return this.formatResponse(balances, periods, options);
  }

  // Jede Funktion: 30-80 Zeilen, klar abgegrenzt, testbar
  private async loadData(caseId: string, options: MatrixOptions) {
    // DB-Queries isoliert
  }

  private buildPeriods(plan: LiquidityPlan): MatrixPeriod[] {
    // Period-Berechnung isoliert
  }

  private filterByScope(entries: LedgerEntry[], scope: LiquidityScope) {
    // Scope-Filter isoliert (nutzt scope-resolver)
  }

  private aggregateEntries(entries: LedgerEntry[], periods: MatrixPeriod[]) {
    // IST-Vorrang, Entry-Matching, Aggregation isoliert
  }

  private calculateBalances(aggregations: Map<...>) {
    // Opening/Closing Balance isoliert
  }

  private formatResponse(balances: any, periods: any, options: any) {
    // Response-Formatting isoliert
  }
}
```

#### Vorteil für Claude Code

- ✅ Liest nur relevante Service-Datei (z.B. "IST-Vorrang" → nur `aggregateEntries()` lesen)
- ✅ Änderungen isoliert (Bug in Aggregation? → Nur eine Methode anfassen)
- ✅ Testbar (jede Funktion einzeln testbar)
- ✅ Wiederverwendbar (andere APIs können denselben Service nutzen)

#### Zeitaufwand Phase 1

**Pro Route:**
```
1. Service-Klasse erstellen                    30 Min
2. Logik extrahieren + in Methoden aufteilen  2-3 Std
3. Route auf Service umstellen                 30 Min
4. Lokal testen (npm run dev + durchklicken)  1-2 Std
5. Build-Check + kleine Fixes                  1 Std
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL: ~5-7 Stunden für erste Route
```

**Für Top 3 Routen:**
```
Route 1 (liquidity-matrix):     7 Std   (Lernkurve, Pattern etablieren)
Route 2 (ist-plan-comparison):  4 Std   (Pattern ist klar)
Route 3 (rolling-forecast):     4 Std
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL: ~15 Stunden = 1,5 Tage
```

**Migration:** Risikofrei, da nur Umstrukturierung (kein Logik-Change)

---

### Phase 2: Scope-Zentralisierung

**Ziel:** Eine Quelle für Scope-Definitionen

#### Neue Struktur

```
/lib/domain/scopes/
  ├── index.ts               (Public API)
  ├── scope-definitions.ts   (CASE_SCOPES Objekt)
  └── scope-resolver.ts      (filterEntriesByScope etc.)
```

#### Vorher vs. Nachher

**Vorher (5 verschiedene Stellen):**
```typescript
// 1. aggregation.ts
const SCOPE_LOCATION_IDS = { ... }

// 2. matrix-config.ts
const LIQUIDITY_SCOPE_LABELS = { ... }

// 3. route.ts
const scope: LiquidityScope = ['GLOBAL', ...].includes(...)

// 4. matrix-config.ts: filterEntriesByScope()
// 5. aggregation.ts: Scope-Filter-Logik
```

**Nachher (1 zentrale Stelle):**
```typescript
// /lib/domain/scopes/scope-definitions.ts
export const CASE_SCOPES = {
  HVPLUS: {
    GLOBAL: {
      id: 'GLOBAL',
      label: 'Gesamt',
      locationIds: null
    },
    LOCATION_VELBERT: {
      id: 'LOCATION_VELBERT',
      label: 'Velbert',
      locationIds: ['loc-haevg-velbert']
    },
    LOCATION_UCKERATH_EITORF: {
      id: 'LOCATION_UCKERATH_EITORF',
      label: 'Uckerath/Eitorf',
      locationIds: ['loc-haevg-uckerath', 'loc-haevg-eitorf']
    },
  }
};

// /lib/domain/scopes/scope-resolver.ts
export function filterEntriesByScope(
  entries: LedgerEntry[],
  scope: ScopeDefinition
): LedgerEntry[] {
  if (!scope.locationIds) return entries; // GLOBAL
  return entries.filter(e =>
    e.locationId && scope.locationIds.includes(e.locationId)
  );
}

// Überall importieren:
import { CASE_SCOPES, filterEntriesByScope } from '@/lib/domain/scopes';
const scope = CASE_SCOPES.HVPLUS.LOCATION_VELBERT;
const filtered = filterEntriesByScope(entries, scope);
```

#### Zeitaufwand Phase 2

```
1. Scope-Definitions erstellen               1 Std
2. Alle 5 Stellen identifizieren            30 Min
3. Migrieren + Testen                        2 Std
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL: ~3-4 Stunden = 0,5 Tage
```

**Migration:** Risiko mittel (muss alle Stellen finden, Testing wichtig)

---

### Phase 3: Unified Dashboard Component

**Ziel:** Eine Komponente für alle 3 Ansichten (Admin/Portal/View)

#### Aktueller Stand (Duplikation)

```
/app/admin/cases/[id]/dashboard/page.tsx        (Dashboard-Logik)
/app/portal/cases/[id]/page.tsx                 (Dashboard-Logik - 95% identisch!)
/app/view/[token]/page.tsx                      (Dashboard-Logik - 90% identisch!)
```

**Problem:** Dashboard-Änderungen müssen 3x gemacht werden!

#### Neue Struktur

```
/components/dashboard/
  ├── UnifiedDashboard.tsx          (Container mit Mode-Logic)
  ├── LiquidityMatrix.tsx           (Reine Darstellung)
  ├── RollingForecast.tsx
  ├── IstPlanComparison.tsx
  └── types.ts
```

#### Implementierung

```typescript
// /components/dashboard/UnifiedDashboard.tsx
interface UnifiedDashboardProps {
  mode: 'admin' | 'portal' | 'view';
  caseId: string;
  token?: string;  // Nur für mode='view'
}

export function UnifiedDashboard({ mode, caseId, token }: UnifiedDashboardProps) {
  // Capabilities basierend auf Mode
  const capabilities = {
    canEdit: mode === 'admin',
    canToggleScope: mode !== 'view',
    showDebugInfo: mode === 'admin',
    showIVNotes: mode === 'admin',
    canExport: mode !== 'view',
  };

  // Shared Logic
  const { data, loading, error } = useDashboardData(caseId, token);

  return (
    <DashboardLayout mode={mode}>
      {capabilities.showIVNotes && <IVNotesPanel caseId={caseId} />}

      <Tabs>
        <LiquidityMatrix
          data={data}
          canEdit={capabilities.canEdit}
          canToggleScope={capabilities.canToggleScope}
        />
        <RollingForecast data={data} />
        <IstPlanComparison data={data} />

        {capabilities.showDebugInfo && <DebugPanel data={data} />}
      </Tabs>
    </DashboardLayout>
  );
}

// Integration in Admin
// /app/admin/cases/[id]/dashboard/page.tsx
export default function AdminDashboardPage({ params }) {
  return <UnifiedDashboard mode="admin" caseId={params.id} />;
}

// Integration in Portal
// /app/portal/cases/[id]/page.tsx
export default function PortalDashboardPage({ params }) {
  return <UnifiedDashboard mode="portal" caseId={params.id} />;
}

// Integration in View
// /app/view/[token]/page.tsx
export default function ViewDashboardPage({ params }) {
  return <UnifiedDashboard mode="view" caseId={caseId} token={params.token} />;
}
```

#### Vorteil

- ✅ Eine Komponente, eine Datenquelle
- ✅ Unterschiede durch Props gesteuert (nicht Duplikation)
- ✅ Dashboard-Änderungen nur 1x machen
- ✅ Konsistente UX über alle Ansichten

#### Zeitaufwand Phase 3

```
1. UnifiedDashboard erstellen                2 Std
2. Mode-Logic implementieren                 1 Std
3. Admin/Portal/View migrieren               3 Std
4. Testing (alle 3 Ansichten)                2 Std
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL: ~8 Stunden = 1 Tag
```

**Migration:** Risiko niedrig (Frontend-only, leicht revertierbar)

---

## 📋 Zusammenfassung: Zeitaufwand & Prioritäten

### Optionen

**Option A: "Quick Win" (Nur liquidity-matrix)**
- Nur die größte API-Route refactoren
- Rest bleibt wie er ist
- **Zeit: 6-7 Stunden (1 Tag)**
- **Vorteil:** Sofortiger Effekt für größten Schmerzpunkt

**Option B: "Top 3 Routes"**
- liquidity-matrix + ist-plan-comparison + rolling-forecast
- **Zeit: 15 Stunden (1,5 Tage)**
- **Vorteil:** Die 3 größten Schmerzpunkte gelöst

**Option C: "Komplett Phase 1"**
- Alle großen Routen + Service Layer etabliert
- **Zeit: 21 Stunden (2-3 Tage)**
- **Vorteil:** Solide Basis für weitere Entwicklung

**Option D: "Phase 1 + 2"**
- Service Layer + Scope-Zentralisierung
- **Zeit: 24 Stunden (3 Tage)**
- **Vorteil:** Strukturelle Probleme gelöst

**Option E: "Alle 3 Phasen"**
- Service Layer + Scope + Unified Dashboard
- **Zeit: 32 Stunden (4 Tage)**
- **Vorteil:** Code-Struktur komplett aufgeräumt

### Empfehlung

**Start mit Option B (Top 3 Routes):**
- ✅ Größter Schmerz (riesige API-Routen) wird sofort gelöst
- ✅ Keine Breaking Changes
- ✅ Claude Code kann sofort besser navigieren
- ✅ Legt Basis für Phase 2+3
- ✅ Überschaubarer Aufwand (1,5 Tage)

**Danach entscheiden:** Wenn Option B gut funktioniert, Phase 2+3 angehen.

---

## ✅ Nächste Schritte (NACH inhaltlichen Änderungen)

1. **Entscheidung:** Welche Option? (A/B/C/D/E)
2. **Start mit Phase 1:** Service Layer für Top-Routen
3. **Testing:** Sicherstellen, dass alles funktioniert
4. **Optional:** Phase 2+3 wenn Phase 1 erfolgreich

---

## 📝 Notizen

**Erstellt:** 09. Februar 2026
**Diskussion mit:** Claude Code (Sonnet 4.5)
**Context:** Nach Analyse der aktuellen Code-Struktur (45K LOC, 82 API-Routen, 34 Models)
**Auslöser:** Dashboard-Änderungen + Debugging schwierig wegen großer API-Routen

**Zurückgestellt weil:** Erst inhaltliche Änderungen machen, dann refactoren macht mehr Sinn.

**Wie wiederfinden:**
- `/app/docs/TODO_REFACTORING.md` (diese Datei)
- "refactoring" oder "service layer" suchen
- `/liqui` Command lädt Projekt-Kontext inkl. dieser Datei
