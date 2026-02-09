# Korrekturvorschlag: Ledger-Details & Fehlklassifikationen

**Datum:** 09. Februar 2026
**Version:** v2.18.1 (Bugfix-Release)

---

## Problem 1: LedgerDrillDownModal zeigt keine Audit-Trail-Felder

### Aktueller Stand
Die Modal-Komponente (`LedgerDrillDownModal.tsx`) zeigt nur:
- Beschreibung, Notiz, bookingSource
- Fehlt: categoryTag, allocationSource, estateAllocation, Audit-Trail-Informationen

### Lösung
**Datei:** `/app/src/components/admin/LedgerDrillDownModal.tsx`

**Änderung 1:** Tabellenspalten erweitern (Zeile 172-180):

```tsx
<thead>
  <tr>
    <th>Datum</th>
    <th>Beschreibung</th>
    <th className="text-right">Betrag</th>
    <th>Typ</th>
    <th>Status</th>
    <th>Category Tag</th>           {/* NEU */}
    <th>Alt/Neu</th>                {/* NEU */}
    <th>Quelle</th>
  </tr>
</thead>
```

**Änderung 2:** Tabellenzellen erweitern (nach Zeile 218):

```tsx
{/* NEU: Category Tag */}
<td>
  {entry.categoryTag ? (
    <span
      className="badge badge-info text-xs"
      title={`${entry.categoryTagSource || 'UNKNOWN'}: ${entry.categoryTagNote || '-'}`}
    >
      {entry.categoryTag}
    </span>
  ) : (
    <span className="text-[var(--muted)] text-xs">-</span>
  )}
</td>

{/* NEU: Alt/Neu-Masse */}
<td>
  {entry.estateAllocation ? (
    <span
      className={`badge text-xs ${
        entry.estateAllocation === 'ALTMASSE' ? 'badge-warning' :
        entry.estateAllocation === 'NEUMASSE' ? 'badge-success' :
        entry.estateAllocation === 'MIXED' ? 'badge-info' :
        'badge-neutral'
      }`}
      title={`${entry.allocationSource || 'UNKNOWN'}: ${entry.allocationNote || '-'}`}
    >
      {entry.estateAllocation}
      {entry.estateRatio && entry.estateAllocation === 'MIXED' && (
        <span className="ml-1 text-xs">({(parseFloat(entry.estateRatio) * 100).toFixed(1)}%)</span>
      )}
    </span>
  ) : (
    <span className="text-[var(--muted)] text-xs">-</span>
  )}
</td>

{/* Quelle (bestehendes bookingSource) */}
<td className="text-sm text-[var(--muted)]">
  {entry.bookingSource || "-"}
</td>
```

**Änderung 3:** Expandable Row für volle Audit-Trail-Informationen

Alternativ: Collapse-Icon pro Zeile, das eine Detailansicht öffnet mit:
- categoryTagSource, categoryTagNote
- allocationSource, allocationNote
- servicePeriodStart, servicePeriodEnd
- createdAt, updatedAt

---

## Problem 2: 28 HZV-Fehlklassifikationen

### Betroffene Entries

| Typ | Anzahl | Summe | Richtige Klassifikation |
|-----|--------|-------|-------------------------|
| Sozialabgaben-Beiträge | 22 | -4.605,74 EUR | `SOZIALABGABEN` |
| AAG-Erstattungen | 3 | -2.721,83 EUR | `EINNAHME_SONSTIGE` |
| Sonstige | 3 | 159,34 EUR | Manuell prüfen |

### SQL-Korrektur

```sql
-- 1. Sozialabgaben-Beiträge
UPDATE ledger_entries
SET
  categoryTag = 'SOZIALABGABEN',
  categoryTagSource = 'MANUAL',
  categoryTagNote = 'Korrigiert: Arbeitgeber-Beiträge an Krankenkassen (war fälschlich HZV)',
  updatedAt = CURRENT_TIMESTAMP
WHERE caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757'
  AND valueType = 'IST'
  AND categoryTag = 'HZV'
  AND allocationSource = 'AUTO_CALCULATED'
  AND (description LIKE '%BEITRAG%' OR description LIKE '%BEITRAEGE%');

-- 2. AAG-Erstattungen
UPDATE ledger_entries
SET
  categoryTag = 'EINNAHME_SONSTIGE',
  categoryTagSource = 'MANUAL',
  categoryTagNote = 'Korrigiert: AAG-Erstattungen (Arbeitgeberaufwendungsausgleich, war fälschlich HZV)',
  updatedAt = CURRENT_TIMESTAMP
WHERE caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757'
  AND valueType = 'IST'
  AND categoryTag = 'HZV'
  AND allocationSource = 'AUTO_CALCULATED'
  AND description LIKE '%ERSTATTUNG%AAG%';

-- 3. Sonstige 3 Entries manuell prüfen:
SELECT id, description, CAST(amountCents AS INTEGER) / 100.0 as amount_eur
FROM ledger_entries
WHERE caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757'
  AND valueType = 'IST'
  AND categoryTag = 'HZV'
  AND allocationSource = 'AUTO_CALCULATED'
  AND description NOT LIKE '%BEITRAG%'
  AND description NOT LIKE '%BEITRAEGE%'
  AND description NOT LIKE '%ERSTATTUNG%AAG%';
```

### Matrix-Konfiguration anpassen

**Datei:** `/app/src/lib/cases/haevg-plus/matrix-config.ts`

**PERSONAL-Block erweitern** (Zeile ~420):

```typescript
{
  id: 'cash_out_personal_sozialabgaben',
  label: 'Sozialabgaben (Arbeitgeber-Anteil)',
  labelShort: 'Sozialabg.',
  block: 'CASH_OUT_PERSONNEL',
  order: 2,
  isSubRow: true,
  isSummary: false,
  flowType: 'OUTFLOW',
  matches: [
    { type: 'CATEGORY_TAG', value: 'SOZIALABGABEN' },
  ],
},
```

### Classification Rules verschärfen

**WICHTIG:** Für zukünftige Imports Pattern-Matching präzisieren:

```typescript
// HZV-Pattern (NUR Leistungsabrechnungen)
const HZV_PATTERNS = [
  'HZV ABS',           // HZV-Abschlag
  'HZV ABSCHL',        // HZV-Schlussabrechnung
  'HAEVG',             // Hausärztliche Vertragsgemeinschaft
  'Q\\d/\\d{2}',       // Quartalsangaben (Q3/25, Q4/25)
];

// AUSSCHLUSS-Pattern (NICHT HZV, auch wenn Krankenkasse genannt)
const HZV_EXCLUSIONS = [
  'BEITRAG',           // Sozialabgaben
  'BEITRAEGE',
  'ERSTATTUNG.*AAG',   // AAG-Erstattungen
  'ERSTATTUNG NACH AAG',
];

// Matching-Logik:
if (description.matches(HZV_PATTERNS) && !description.matches(HZV_EXCLUSIONS)) {
  return 'HZV';
}
```

---

## Problem 3: AUTO_CALCULATED ist OK für Non-HZV

### Ergebnis
- 336 Non-HZV Entries mit AUTO_CALCULATED → **KORREKT** (keine spezifischere Regel)
- 28 HZV-Entries mit AUTO_CALCULATED → **FALSCH** (aber sind keine echten HZV, siehe Problem 2)

### Keine Aktion nötig
Nach Korrektur von Problem 2 sind alle verbliebenen AUTO_CALCULATED korrekt.

---

## Deployment-Plan

### Phase 1: Lokale Änderungen
1. ✅ LedgerDrillDownModal.tsx erweitern (Frontend)
2. ✅ matrix-config.ts erweitern (SOZIALABGABEN-Zeile)
3. ✅ SQL-Korrekturen lokal ausführen
4. ✅ Build-Test: `npm run build`
5. ✅ Manuelle Tests: Ledger-Modal öffnen, Audit-Trail-Felder prüfen

### Phase 2: Datenbank-Migration (Turso)
1. ✅ SQL-Korrekturen auf Turso ausführen (25 Entries)
2. ✅ Verifikation: HZV-Summen neu berechnen
3. ✅ Checksummen vergleichen (lokal vs. Turso)

### Phase 3: Production Deployment
1. ✅ Git commit + push
2. ✅ Vercel Deploy (automatisch)
3. ✅ Production-Test: Ledger-Modal öffnen, neue Spalten prüfen
4. ✅ CHANGELOG.md updaten (v2.18.1)

---

## Verifikation

### Erwartete Ergebnisse nach Korrektur

**HZV-Statistik (nach Korrektur):**
- HZV-Entries gesamt: 292 (statt 320)
- HZV mit SERVICE_PERIOD_BEFORE_CUTOFF: 119
- HZV mit Q4_2025_RULE: 173
- HZV mit AUTO_CALCULATED: 0

**Neue SOZIALABGABEN-Statistik:**
- 22 Entries, -4.605,74 EUR
- Sichtbar in Matrix unter "Personalkosten → Sozialabgaben"

**LedgerDrillDownModal:**
- Spalte "Category Tag" zeigt categoryTag mit Tooltip (Source + Note)
- Spalte "Alt/Neu" zeigt estateAllocation mit Tooltip (Source + Note)
- Bei MIXED: estateRatio in Prozent angezeigt

---

## Risiken

- **Low:** Frontend-Änderungen (nur UI, keine Business-Logic)
- **Low:** SQL-Updates (25 Entries, klar definiert)
- **Medium:** Matrix-Summen ändern sich (HZV -28 Entries, PERSONAL +22 Entries)
  → **Erfordert IV-Kommunikation** (Hannes Rieger informieren)

---

## Nächste Schritte

1. **User-Freigabe:** Diesen Korrekturvorschlag reviewen
2. **Implementierung:** LedgerDrillDownModal erweitern
3. **Daten-Korrektur:** SQL-Scripts ausführen (lokal + Turso)
4. **Testing:** Manuelle Tests + Production-Verifikation
5. **Deployment:** Git commit + Vercel Deploy
6. **Dokumentation:** CHANGELOG.md v2.18.1
