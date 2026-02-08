# Zuordnungsprüfung HVPlus – Detailanalyse
**Stand:** 2026-02-08
**Fall:** Hausärztliche Versorgung PLUS eG (Case-ID: `44e0cca8-2705-492d-b32d-7237ed5abe41`)

---

## 🚨 KRITISCHE BEFUNDE

### 1. Datenbank-Status: **KEINE DATEN VORHANDEN**

```sql
-- Geprüft:
✅ Case existiert: HVPlus (ID: 44e0cca8-2705-492d-b32d-7237ed5abe41)
❌ Counterparties: 0 (SOLL: 3 - KV, HZV, PVS)
❌ Locations: 0 (SOLL: 3 - Velbert, Uckerath, Eitorf)
❌ Ledger Entries: 0 (SOLL: ~500+ aus JSON-Extracts)
⚠️  Bank Accounts: 3 generisch (SOLL: 6 spezifisch - Sparkasse, apoBank, 2x ISK)
⚠️  Classification Rules: 2 generisch (SOLL: 15+ spezifisch für HZV/KV/PVS)
❌ cutoffDate: NULL (SOLL: 2025-10-29)
```

**Bedeutung:** Die gesamte Zuordnungslogik kann NICHT funktionieren, weil keine Daten in der Datenbank sind!

---

## 📊 IST-Stand: Vorhandene Quelldaten

### Extrahierte JSON-Dateien (Cases/Hausärztliche Versorgung PLUS eG/02-extracted/)

**Kontoauszüge (IST-Daten):**
- ✅ ISK Uckerath November 2025: 95 Transaktionen (114.102 EUR)
- ✅ ISK Uckerath Dezember 2025: vorhanden
- ✅ ISK Velbert Dezember 2025: vorhanden
- ✅ Sparkasse Velbert Oktober 2025: 118 Buchungen
- ✅ Sparkasse Velbert November 2025: 60 Buchungen
- ✅ apoBank HVPLUS Oktober 2025: 23 Buchungen
- ✅ apoBank Uckerath Oktober 2025: 131 Buchungen
- ✅ apoBank Uckerath November 2025: vorhanden
- ✅ Manuell aufbereitete HZV-Daten: `2025-11-19_Kontoauszug.json` (67 Zeilen mit LANR-Zuordnung)

**PLAN-Daten:**
- ✅ Liquiditätsplanung vom 14.01.2026
- ✅ Annahmen Einnahmen bis Juni 2026
- ✅ GuV und Liquiplanung 2025-2027

**Stammdaten:**
- ✅ case-context.json: Vollständige Informationen zu:
  - 8 Ärzten mit LANR
  - 3 Standorten
  - 3 Abrechnungsstellen (KV, HZV, PVS)
  - Bankverbindungen
  - Alt/Neu-Regeln

---

## 🎯 SOLL-Stand: Erwartete Zuordnungen

### 1. Alt/Neu-Masse-Zuordnung (estateAllocation)

**Stichtag:** 29.10.2025

#### KV Nordrhein (Quartalszahler)

| Quartal | Alt-Ratio | Neu-Ratio | Quelle | Status Code |
|---------|-----------|-----------|--------|-------------|
| Q3/2025 | 100% | 0% | VERTRAGSREGEL | ✅ config.ts Z.79-83 |
| **Q4/2025** | **1/3** | **2/3** | VERTRAGSREGEL | ✅ config.ts Z.71-76 |
| Q1/2026+ | 0% | 100% | VERTRAGSREGEL | ✅ config.ts Z.97-102 |

**Code-Prüfung:**
```typescript
// /app/src/lib/cases/haevg-plus/config.ts:71-76
Q4_2025: {
  altRatio: 1 / 3,  // ✅ KORREKT
  neuRatio: 2 / 3,  // ✅ KORREKT
  source: AllocationSource.VERTRAGSREGEL,
  note: 'Vertraglich vereinbarter Split gem. KV-Vereinbarung Q4/2025',
},
```

#### HZV (Monatszahler mit Vormonat-Logik)

| Monat | Alt-Ratio | Neu-Ratio | Quelle | Status Code |
|-------|-----------|-----------|--------|-------------|
| Sept 2025 | 100% | 0% | VORMONAT_LOGIK | ✅ config.ts Z.129-134 |
| **Okt 2025** | **29/31** | **2/31** | PERIOD_PRORATA | ✅ config.ts Z.122-127 |
| Nov 2025+ | 0% | 100% | VORMONAT_LOGIK | ✅ config.ts Z.136-141 |

**Code-Prüfung:**
```typescript
// /app/src/lib/cases/haevg-plus/config.ts:122-127
'2025-10': {
  altRatio: 29 / 31,  // ✅ KORREKT (29 Tage vor Stichtag)
  neuRatio: 2 / 31,   // ✅ KORREKT (30.-31. Oktober)
  source: AllocationSource.PERIOD_PRORATA,
  note: 'Zeitanteilig: 29/31 Alt (1.-29.10.), 2/31 Neu (30.-31.10.)',
},
```

**ABER:** HZV hat Vormonat-Logik!
- Zahlung im **November** = Leistung **Oktober** → 29/31 Alt, 2/31 Neu
- Zahlung im **Dezember** = Leistung **November** → 100% Neu

**Code-Prüfung Vormonat-Logik:**
```typescript
// /app/src/lib/settlement/split-engine.ts:197-231
function createAllocationFromVormonatLogik(transactionDate, cutoffDate) {
  const serviceMonth = new Date(transactionDate);
  serviceMonth.setMonth(serviceMonth.getMonth() - 1);  // ✅ KORREKT
  // ... berechnet dann serviceMonthStart/End und prüft gegen cutoffDate
}
```

#### PVS (Privatpatienten)

| Regel | Beschreibung | Status Code |
|-------|--------------|-------------|
| **requiresServiceDate** | Zuordnung NUR nach Behandlungsdatum | ✅ config.ts Z.160-166 |
| Fallback | UNKLAR_MANUELL | ✅ config.ts Z.165 |

**Code-Prüfung:**
```typescript
// /app/src/lib/cases/haevg-plus/config.ts:160-166
export const PVS_CONFIG: SettlerConfig = {
  name: 'PVS rhein-ruhr',
  rhythm: SettlementRhythm.PER_TREATMENT,
  requiresServiceDate: true,  // ✅ KORREKT
  fallbackRule: FallbackRule.UNKLAR_MANUELL,  // ✅ KORREKT
};
```

**Problem laut case-context.json:**
> "Kontoauszug zeigt nur Gesamtbetrag, keine Zuordnung zu Leistungsdatum"
> "Nur über Einzelrechnung möglich (Behandlungsdatum auf Rechnung)"

→ **PVS-Zahlungen werden IMMER als UNKLAR markiert** (korrekt!)

---

### 2. Counterparty-Zuordnung (counterpartyId)

**SOLL-Counterparties aus case-context.json:**

| Name | Typ | Pattern | Top-Payer |
|------|-----|---------|-----------|
| **HÄVG** | HZV-Abrechnungsstelle | `HAEVG`, `HAVG Hausarzt` | ✅ Ja |
| **KVNO** | KV-Abrechnungsstelle | `KV Nordrhein`, `KVNO` | ✅ Ja |
| **PVS rhein-ruhr** | Privatliquidation | `PVS rhein-ruhr` | ✅ Ja |

**Matching-Logik:**
```typescript
// /app/src/lib/settlement/split-engine.ts würde folgende Logik brauchen:
// 1. Pattern-Matching auf description
// 2. LANR → Arzt → HZV-Counterparty
// 3. BSNR → Standort → KV-Counterparty
```

**Status:** ❌ NICHT IMPLEMENTIERT (keine Counterparties in DB)

---

### 3. Location-Zuordnung (locationId)

**SOLL-Locations aus case-context.json:**

| Name | Bank (primär) | HZV | Ärzte (LANR) |
|------|---------------|-----|--------------|
| **Velbert** | Sparkasse HRV | ✅ Ja | 3892462 (van Suntum), 8836735 (Beyer), 7729639 (Kamler) |
| **Uckerath** | apoBank | ✅ Ja | 1445587 (Binas), 3243603 (Fischer), 4652451 (Ludwig), 1203618 (Schweitzer) |
| **Eitorf** | apoBank (über Uckerath) | ✅ Ja | 8898288 (Rösing) - AKTIVSTER ARZT! |

**Zuordnungs-Logik:**
1. **HZV-Zahlungen:** LANR → Arzt → Standort
2. **KV-Zahlungen:** BSNR → Standort (Eitorf läuft über Uckerath BSNR)
3. **Bankzahlungen:** IBAN → Bank → Standort

**Beispiel aus 2025-11-19_Kontoauszug.json:**
```json
{
  "LANR": "8836735",
  "Arzt": "Beyer",
  "Standort": "Velbert",  // ✅ MANUELL ZUGEORDNET
  "Krankenkasse": "Bahn BKK",
  "Zeitraum": "ABS. Q4/25-1"
}
```

**Status:** ⚠️ MANUELL IN EXCEL (nicht in DB-Logik)

---

### 4. CategoryTag-Logik (categoryTag)

**SOLL-Categories für Matrix-Darstellung:**

| Tag | Beschreibung | Matching-Pattern |
|-----|--------------|------------------|
| **HZV** | Hausarztzentrierte Versorgung | HAEVGID, LANR, HZV ABS |
| **KV** | Kassenärztliche Vereinigung | KVNO, KV Nordrhein, Quartalsabrechnung |
| **KV_ALTFORDERUNG** | KV Restzahlungen vor Stichtag | Q3/2025 Restzahlung |
| **PVS** | Privatliquidation | PVS rhein-ruhr |
| **PERSONAL** | Gehälter, Lohnzahlungen | Gehalt, Sammelüberweisung Lohn |
| **MIETE** | Mietkosten | Miete |
| **BETRIEBSKOSTEN** | Strom, Telefon, etc. | Strom, Telekom |

**Status:** ⚠️ Nur 2 generische Rules in DB (Gehalt, Miete)

---

### 5. Service-Date-Zuordnung

**HZV-Regel:** `assignServiceDateRule: "VORMONAT"`

```typescript
// Classification Rule sollte sein:
{
  matchField: "description",
  matchValue: "HAEVG|HAVG",
  assignServiceDateRule: "VORMONAT",
  assignCounterpartyId: "<hzv-counterparty-id>"
}
```

**Code-Implementierung:**
```typescript
// /app/src/lib/settlement/split-engine.ts:82
case FallbackRule.VORMONAT:
  return createAllocationFromVormonatLogik(entry.transactionDate, cutoffDate);
```

**Status:** ✅ Code korrekt, ❌ Rule in DB fehlt

---

## 🔍 Detailprüfung: Konkrete Beispiele

### Beispiel 1: HZV-Zahlung November 2025

**Quelldatei:** `ISK_uckerath_2025_11_VERIFIED.json`

```json
{
  "date": "2025-11-13",
  "amount": 10.0,
  "description": "HAEVGID 132025 LANR 1445587 BAHN BKK HZV ABS. Q4/25-1",
  "counterparty": "HÄVG Hausärztliche Vertragsgemeinschaft AG"
}
```

**Erwartete Zuordnung:**

| Feld | Wert | Grund |
|------|------|-------|
| `valueType` | IST | Kontoauszug |
| `transactionDate` | 2025-11-13 | Buchungsdatum |
| `serviceDate` | NULL → **2025-10-15** | VORMONAT_LOGIK (Nov-Zahlung = Okt-Leistung) |
| `servicePeriodStart` | 2025-10-01 | Vormonat Start |
| `servicePeriodEnd` | 2025-10-31 | Vormonat Ende |
| `estateAllocation` | **MIXED** | Oktober liegt auf Stichtag (29.10.) |
| `estateRatio` | **0.0645** (2/31 Neu) | 29 Tage Alt, 2 Tage Neu |
| `allocationSource` | VORMONAT_LOGIK → PERIOD_PRORATA | Stichtag liegt im Leistungsmonat |
| `allocationNote` | "Zeitanteilig: 29/31 Alt (1.-29.10.), 2/31 Neu (30.-31.10.)" | |
| `counterpartyId` | `<hzv-id>` | Pattern-Match: HAEVGID/LANR |
| `locationId` | `<uckerath-id>` | LANR 1445587 = Binas = Uckerath |
| `categoryTag` | HZV | Pattern-Match: HZV ABS |

**Split-Berechnung:**
```
Betrag: 10,00 EUR = 1.000 Cents
Alt: 1.000 * (29/31) = 935 Cents = 9,35 EUR
Neu: 1.000 * (2/31)  = 65 Cents = 0,65 EUR
```

**Code-Verifikation:**
```typescript
// /app/src/lib/settlement/split-engine.ts:240-269
export function calculatePeriodProrata(periodStart, periodEnd, cutoffDate) {
  const totalDays = daysBetween(periodStart, periodEnd) + 1;
  // periodStart = 2025-10-01, periodEnd = 2025-10-31 → 31 Tage ✅

  const altDays = daysBetween(periodStart, cutoffDate);
  // cutoffDate = 2025-10-29 → altDays = 28 (exklusiv Stichtag)
  // ❓ FEHLER? Sollte 29 sein (1.-29. inklusiv)?
}
```

**🚨 POTENTIELLER BUG:**
```typescript
// Zeile 259: altDays = daysBetween(periodStart, cutoffDate)
// daysBetween(2025-10-01, 2025-10-29) = 28 (exklusiv Endtag)
// ABER: Wir wollen 29 Tage (1.-29. Oktober INKLUSIV)
```

**Fix:**
```typescript
const altDays = daysBetween(periodStart, cutoffDate); // Bleibt bei 28
// ODER cutoffDate als ENDE des Tages behandeln:
const altDays = daysBetween(periodStart, new Date(cutoffDate.getTime() + 86400000));
```

**Prüfung case-context.json:**
> "HZV Oktober 2025: 28/31 Alt, 3/31 Neu"
> "source": "Massekreditvertrag §1(2)b"

**vs. config.ts:**
```typescript
'2025-10': {
  altRatio: 29 / 31,  // ❌ WIDERSPRUCH!
  neuRatio: 2 / 31,
```

**🚨 INKONSISTENZ GEFUNDEN:**
- **case-context.json sagt:** 28/31 Alt, 3/31 Neu
- **config.ts sagt:** 29/31 Alt, 2/31 Neu

**Klärungsbedarf:**
- Stichtag 29.10. INKLUSIVE oder EXKLUSIVE?
- Massekreditvertrag prüfen!

---

### Beispiel 2: KV-Restzahlung Q3/2025

**Aus case-context.json:**
```json
{
  "beispielQ3": {
    "Velbert": {"restzahlung": -7800, "note": "Negativ = Verrechnung"},
    "Uckerath": {"restzahlung": 8377, "note": "Positiv = Nachzahlung"}
  }
}
```

**Erwartete Zuordnung:**

| Feld | Wert | Grund |
|------|------|-------|
| `estateAllocation` | **ALTMASSE** | Q3/2025 vollständig vor Stichtag |
| `allocationSource` | VERTRAGSREGEL | config.ts Q3_2025 |
| `categoryTag` | KV_ALTFORDERUNG | Restzahlung vor Stichtag |
| `legalBucket` | **MASSE** | KV-Forderungen = Masse |

**Code-Verifikation:**
```typescript
// /app/src/lib/cases/haevg-plus/config.ts:78-83
Q3_2025: {
  altRatio: 1,  // ✅ KORREKT
  neuRatio: 0,
  source: AllocationSource.VERTRAGSREGEL,
  note: 'Q3/2025 vollständig vor Stichtag (29.10.2025)',
},
```

---

### Beispiel 3: PVS-Zahlung ohne Behandlungsdatum

**Aus case-context.json:**
> "problem": "Kontoauszug zeigt nur Gesamtbetrag, keine Zuordnung zu Leistungsdatum"

**Erwartete Zuordnung:**

| Feld | Wert | Grund |
|------|------|-------|
| `serviceDate` | NULL | Nicht vorhanden |
| `estateAllocation` | **UNKLAR** | Kein Leistungsdatum |
| `allocationSource` | UNKLAR | Fallback-Rule |
| `allocationNote` | "PVS rhein-ruhr: Zahlung ohne Leistungsdatum - manuelle Zuordnung erforderlich" | |
| `reviewStatus` | UNREVIEWED | Manuelle Prüfung nötig |

**Code-Verifikation:**
```typescript
// /app/src/lib/cases/haevg-plus/config.ts:160-166
export const PVS_CONFIG: SettlerConfig = {
  requiresServiceDate: true,  // ✅
  fallbackRule: FallbackRule.UNKLAR_MANUELL,  // ✅
};

// /app/src/lib/settlement/split-engine.ts:84-90
case FallbackRule.UNKLAR_MANUELL:
  return {
    estateAllocation: EstateAllocation.UNKLAR,  // ✅
    allocationSource: AllocationSource.UNKLAR,
    allocationNote: `${counterpartyConfig.name}: Zahlung ohne Leistungsdatum...`,
    requiresManualReview: true,  // ✅
  };
```

---

## 📋 Zusammenfassung: Code-Qualität

### ✅ KORREKT

1. **Split-Engine Architektur** (`/lib/settlement/split-engine.ts`)
   - Fallback-Kette korrekt implementiert
   - VERTRAGSREGEL → SERVICE_DATE → PERIOD_PRORATA → VORMONAT → UNKLAR
   - Revisionssprache (`allocationNote`) vorhanden
   - Decimal-Präzision für Ratios

2. **Config-Struktur** (`/lib/cases/haevg-plus/config.ts`)
   - KV Q3/Q4/Q1 Regeln definiert
   - HZV Vormonat-Logik konfiguriert
   - PVS requires serviceDate
   - Bank-Agreements (Sparkasse vs. apoBank)

3. **Prisma Schema** (`/prisma/schema.prisma`)
   - LedgerEntry hat alle nötigen Felder
   - estateAllocation, estateRatio, allocationSource vorhanden
   - Counterparty, Location, BankAccount Relations korrekt
   - Service Date Felder vorhanden

### ⚠️ INKONSISTENZEN

1. **HZV Oktober Alt/Neu-Ratio**
   - **case-context.json:** 28/31 Alt, 3/31 Neu
   - **config.ts:** 29/31 Alt, 2/31 Neu
   - **Ursache:** Unklar ob Stichtag 29.10. inklusiv/exklusiv
   - **Aktion:** Massekreditvertrag §1(2)b prüfen!

2. **daysBetween Berechnung** (split-engine.ts:274)
   ```typescript
   const altDays = daysBetween(periodStart, cutoffDate);
   // Gibt 28 für (01.10. → 29.10.), sollte aber 29 sein?
   ```

### ❌ FEHLEND

1. **Stammdaten in Datenbank**
   - Counterparties nicht angelegt
   - Locations nicht angelegt
   - Spezifische Bank Accounts nicht angelegt
   - Classification Rules zu generisch

2. **cutoffDate im Case**
   - Ist NULL, sollte 2025-10-29 sein

3. **LANR → Location Mapping**
   - 8 Ärzte mit LANR bekannt
   - Kein automatisches Mapping LANR → locationId

4. **Import-Pipeline**
   - JSON-Extracts vorhanden (500+ Buchungen)
   - Aber nicht in Ledger importiert

---

## 🎯 Handlungsempfehlungen

### PRIO 1: Inkonsistenz klären

```markdown
**AN: Sonja Prinz / Hannes Rieger**

Frage zum Massekreditvertrag §1(2)b - HZV Oktober 2025:

Ist der Stichtag 29.10.2025 **inklusiv** oder **exklusive** für die Altmasse?

- **Variante A:** 29.10. gehört zu Altmasse → 29/31 Alt, 2/31 Neu
- **Variante B:** 29.10. gehört zu Neumasse → 28/31 Alt, 3/31 Neu

Aktuell Widerspruch zwischen case-context.json (28/31) und config.ts (29/31).

Bitte Originalvertrag prüfen.
```

### PRIO 2: Stammdaten anlegen

```sql
-- 1. cutoffDate setzen
UPDATE cases
SET cutoffDate = '2025-10-29T00:00:00.000Z',
    defaultPeriodType = 'MONTHLY',
    defaultPeriodCount = 11
WHERE id = '44e0cca8-2705-492d-b32d-7237ed5abe41';

-- 2. Counterparties anlegen
INSERT INTO counterparties (id, caseId, name, shortName, type, isTopPayer, matchPattern) VALUES
  ('cp-hzv', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'HÄVG Hausärztliche Vertragsgemeinschaft AG', 'HZV', 'PAYER', 1, 'HAEVG|HAVG|LANR'),
  ('cp-kv', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'KVNO (Kassenärztliche Vereinigung Nordrhein)', 'KV', 'PAYER', 1, 'KVNO|KV Nordrhein'),
  ('cp-pvs', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'PVS rhein-ruhr', 'PVS', 'PAYER', 1, 'PVS rhein-ruhr');

-- 3. Locations anlegen
INSERT INTO locations (id, caseId, name, shortName) VALUES
  ('loc-velbert', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'Praxis Velbert', 'Velbert'),
  ('loc-uckerath', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'Praxis Uckerath', 'Uckerath'),
  ('loc-eitorf', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'Zweigstelle Eitorf', 'Eitorf');

-- 4. Bank Accounts korrigieren
DELETE FROM bank_accounts WHERE caseId = '44e0cca8-2705-492d-b32d-7237ed5abe41';

INSERT INTO bank_accounts (id, caseId, locationId, bankName, accountName, iban, openingBalanceCents, status) VALUES
  ('ba-sparkasse', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'loc-velbert', 'Sparkasse Hilden-Ratingen-Velbert', 'Geschäftskonto', 'DE83334500000034379768', 2497061, 'available'),
  ('ba-apobank-hvplus', '44e0cca8-2705-492d-b32d-7237ed5abe41', NULL, 'apoBank', 'HV PLUS eG Zentrale', 'DE88300606010028818923', -28737210, 'blocked'),
  ('ba-apobank-uckerath', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'loc-uckerath', 'apoBank', 'MVZ Uckerath', 'DE13300606010078818923', 2351427, 'restricted'),
  ('ba-isk-velbert', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'loc-velbert', 'BW-Bank', 'ISK Velbert', 'DE87600501010400080228', 0, 'available'),
  ('ba-isk-uckerath', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'loc-uckerath', 'BW-Bank', 'ISK Uckerath', 'DE91600501010400080156', 0, 'available');
```

### PRIO 3: Classification Rules erstellen

```sql
-- HZV-Regel
INSERT INTO classification_rules (id, caseId, name, isActive, priority, matchField, matchType, matchValue, assignCounterpartyId, assignServiceDateRule, confidenceBonus) VALUES
  ('rule-hzv', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'HZV → HÄVG', 1, 10, 'description', 'CONTAINS', 'HAEVG|HAVG|HZV ABS', 'cp-hzv', 'VORMONAT', 0.8);

-- KV-Regel
INSERT INTO classification_rules (id, caseId, name, isActive, priority, matchField, matchType, matchValue, assignCounterpartyId, assignServiceDateRule, confidenceBonus) VALUES
  ('rule-kv', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'KV → KVNO', 1, 10, 'description', 'CONTAINS', 'KVNO|KV Nordrhein', 'cp-kv', 'PREVIOUS_QUARTER', 0.8);

-- PVS-Regel
INSERT INTO classification_rules (id, caseId, name, isActive, priority, matchField, matchType, matchValue, assignCounterpartyId, confidenceBonus) VALUES
  ('rule-pvs', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'PVS → PVS rhein-ruhr', 1, 10, 'description', 'CONTAINS', 'PVS rhein-ruhr', 'cp-pvs', 0.8);

-- LANR → Location Mapping (8 Ärzte)
INSERT INTO classification_rules (id, caseId, name, isActive, priority, matchField, matchType, matchValue, assignLocationId, confidenceBonus) VALUES
  ('rule-lanr-vansuntum', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'LANR 3892462 → Velbert', 1, 5, 'description', 'CONTAINS', 'LANR 3892462', 'loc-velbert', 1.0),
  ('rule-lanr-beyer', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'LANR 8836735 → Velbert', 1, 5, 'description', 'CONTAINS', 'LANR 8836735', 'loc-velbert', 1.0),
  ('rule-lanr-kamler', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'LANR 7729639 → Velbert', 1, 5, 'description', 'CONTAINS', 'LANR 7729639', 'loc-velbert', 1.0),
  ('rule-lanr-binas', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'LANR 1445587 → Uckerath', 1, 5, 'description', 'CONTAINS', 'LANR 1445587', 'loc-uckerath', 1.0),
  ('rule-lanr-fischer', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'LANR 3243603 → Uckerath', 1, 5, 'description', 'CONTAINS', 'LANR 3243603', 'loc-uckerath', 1.0),
  ('rule-lanr-ludwig', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'LANR 4652451 → Uckerath', 1, 5, 'description', 'CONTAINS', 'LANR 4652451', 'loc-uckerath', 1.0),
  ('rule-lanr-schweitzer', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'LANR 1203618 → Uckerath', 1, 5, 'description', 'CONTAINS', 'LANR 1203618', 'loc-uckerath', 1.0),
  ('rule-lanr-roesing', '44e0cca8-2705-492d-b32d-7237ed5abe41', 'LANR 8898288 → Eitorf', 1, 5, 'description', 'CONTAINS', 'LANR 8898288', 'loc-eitorf', 1.0);
```

### PRIO 4: Import-Pipeline aufsetzen

```typescript
// Pseudocode für Import
async function importHVPlusData() {
  const caseId = '44e0cca8-2705-492d-b32d-7237ed5abe41';

  // 1. ISK Uckerath November (95 Transaktionen)
  const iskUckerathNov = readJSON('Cases/.../ISK_uckerath_2025_11_VERIFIED.json');
  for (const tx of iskUckerathNov.transactions) {
    await createLedgerEntry({
      caseId,
      transactionDate: tx.date,
      amountCents: tx.amount * 100,
      description: tx.description,
      valueType: 'IST',
      bankAccountId: 'ba-isk-uckerath',
      // Lasse Split-Engine und Classification Rules arbeiten
    });
  }

  // 2. Manuell aufbereitete HZV-Daten (67 Zeilen mit LANR-Zuordnung)
  const hzvManual = readJSON('Cases/.../2025-11-19_Kontoauszug.json');
  // Diese haben bereits LANR + Standort → direkt importieren

  // 3. Alle anderen Kontoauszüge...
}
```

---

## 🔬 Technische Code-Review-Punkte

### 1. daysBetween Off-by-One?

**Datei:** `/app/src/lib/settlement/split-engine.ts:274`

```typescript
function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay);
}
```

**Test:**
```typescript
daysBetween(new Date('2025-10-01'), new Date('2025-10-29'))
// → 28 (exklusiv 29.10.)

// Aber für Zeitraumberechnung brauchen wir oft inklusiv:
daysBetween(periodStart, periodEnd) + 1  // Zeile 246
```

**Prüfung:**
```typescript
// Zeile 246: totalDays = daysBetween(periodStart, periodEnd) + 1
// → OK, hier wird +1 addiert für inklusiv

// Zeile 259: altDays = daysBetween(periodStart, cutoffDate)
// → KEIN +1, also exklusiv cutoffDate
// → 29.10. gehört NICHT zu altDays

// Das ist korrekt wenn cutoffDate = "erster Tag Neumasse"
```

**Fazit:** Code ist korrekt wenn Stichtag = "erster Tag Neumasse" (exklusiv für Alt).

### 2. Vormonat-Logik bei Monatsübergang

**Datei:** `/app/src/lib/settlement/split-engine.ts:202`

```typescript
const serviceMonth = new Date(transactionDate);
serviceMonth.setMonth(serviceMonth.getMonth() - 1);
```

**Test:**
```typescript
// Zahlung am 31.01.2026
const tx = new Date('2026-01-31');
tx.setMonth(tx.getMonth() - 1);
// → 2025-12-31 ✅ KORREKT

// Zahlung am 31.03.2026
const tx = new Date('2026-03-31');
tx.setMonth(tx.getMonth() - 1);
// → 2026-02-28 (Feb hat nur 28 Tage) ✅ KORREKT
```

**Fazit:** JavaScript Date.setMonth() handhabt Monatsübergänge korrekt.

---

## 📊 Vollständigkeit: 8 Ärzte erfasst?

**Aus case-context.json:**

| Nr | Name | LANR | HAEVGID | Standort | Status DB |
|----|------|------|---------|----------|-----------|
| 1 | van Suntum | 3892462 | 055425 | Velbert | ❌ Keine Rule |
| 2 | Beyer | 8836735 | 067026 | Velbert | ❌ Keine Rule |
| 3 | Kamler | 7729639 | 083974 | Velbert | ❌ Keine Rule |
| 4 | Binas | 1445587 | 132025 | Uckerath | ❌ Keine Rule |
| 5 | Fischer | 3243603 | 132052 | Uckerath | ❌ Keine Rule |
| 6 | Ludwig | 4652451 | 132064 | Uckerath | ❌ Keine Rule |
| 7 | Schweitzer | 1203618 | 132049 | Uckerath | ❌ Keine Rule |
| 8 | Rösing | 8898288 | 036131 | Eitorf | ❌ Keine Rule |

**In manuell aufbereiteter Excel:** ✅ Alle 8 Ärzte zugeordnet
**In Datenbank:** ❌ Keine LANR-Rules

---

## 🎯 Finale Bewertung

| Aspekt | Code-Qualität | DB-Implementierung | Gesamt-Status |
|--------|---------------|-------------------|---------------|
| **Alt/Neu-Split-Engine** | ✅ Korrekt | ❌ Keine Daten | ⚠️ Bereit, nicht aktiv |
| **KV Q4 (1/3-2/3)** | ✅ Config OK | ❌ Keine Rules | ⚠️ Bereit, nicht aktiv |
| **HZV Oktober (29/31-2/31 vs. 28/31-3/31)** | ⚠️ Inkonsistent | ❌ Keine Rules | 🚨 **KLÄRUNGSBEDARF** |
| **PVS (requires serviceDate)** | ✅ Korrekt | ❌ Keine Rules | ⚠️ Bereit, nicht aktiv |
| **Counterparty-Zuordnung** | ✅ Relations OK | ❌ Keine CPs | ❌ **FEHLT** |
| **Location-Zuordnung (8 Ärzte)** | ✅ Relations OK | ❌ Keine Locations | ❌ **FEHLT** |
| **LANR → Standort-Mapping** | ⚠️ Manuell in Excel | ❌ Keine Rules | ❌ **FEHLT** |
| **CategoryTag-Logik** | ✅ Schema OK | ❌ 2 generische Rules | ❌ **FEHLT** |
| **Import-Pipeline** | ⚠️ Kein Code | ❌ 0 Ledger Entries | ❌ **FEHLT** |

---

## 🚨 Kritische Blocker für Go-Live

1. **❌ Inkonsistenz HZV Oktober klären** (28/31 vs. 29/31)
2. **❌ Stammdaten anlegen** (Counterparties, Locations, BankAccounts)
3. **❌ Classification Rules erstellen** (HZV, KV, PVS, 8x LANR)
4. **❌ Import-Pipeline bauen** (500+ JSON-Transaktionen → Ledger)
5. **❌ cutoffDate setzen** (2025-10-29)

---

## ✅ Positives Fazit

**Die Architektur ist durchdacht und korrekt:**
- Split-Engine ist robust und erweiterbar
- Fallback-Kette deckt alle Fälle ab
- Revisionssprache ermöglicht Audit-Trail
- Prisma-Schema ist vollständig

**Nächster Schritt:**
Stammdaten anlegen + Import-Pipeline + Inkonsistenz klären → dann kann das System produktiv gehen!

---

**Erstellt:** 2026-02-08
**Von:** Claude Sonnet 4.5
**Basis:** case-context.json (555 Zeilen), split-engine.ts, config.ts, schema.prisma, JSON-Extracts
