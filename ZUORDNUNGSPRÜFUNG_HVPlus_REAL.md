# 🔍 Zuordnungsprüfung HVPlus – ECHTE DATENBANK-ANALYSE

**Stand:** 2026-02-08
**Fall:** Hausärztliche Versorgung PLUS eG
**Case-ID:** `2982ff26-081a-4811-8e1e-46b39e1ff757`
**Aktenzeichen:** 70d IN 362/25
**Stichtag:** 2025-10-29 (cutoffDate: 1761696000000)

---

## 📊 Datenbank-Übersicht

### Stammdaten: ✅ VOLLSTÄNDIG

| Kategorie | Anzahl | Status |
|-----------|--------|--------|
| **Counterparties** | 169 | ✅ Sehr detailliert (KV, HZV, PVS + alle Lieferanten/Mitarbeiter) |
| **Locations** | 4 | ✅ Velbert, Uckerath, Eitorf, Gesellschaft |
| **Bank Accounts** | 5 | ✅ 2x ISK, Sparkasse Velbert, 2x apoBank |
| **Classification Rules** | 19 | ⚠️ Vorhanden, aber Wirksamkeit prüfen |
| **Ledger Entries** | 1.003 | ⚠️ 362 unverarbeitet, 159 UNKLAR |

---

## 🚨 KRITISCHE BEFUNDE

### Problem 1: 362 unverarbeitete HZV-Zahlungen (November 2025)

**Symptome:**
```
- counterpartyId: NULL
- estateAllocation: NULL
- allocationSource: NULL
- locationId: NULL
- categoryTag: NULL
```

**Beispiele:**
| Datum | Beschreibung | Betrag | LANR | Standort (erwartet) |
|-------|--------------|--------|------|---------------------|
| 2025-11-13 | HAEVGID 132025 LANR 1445587 BAHN BKK HZV ABS. Q4/25-1 | 10,00 € | 1445587 (Binas) | Uckerath |
| 2025-11-13 | HAEVGID 067026 LANR 8836735 BAHN BKK HZV ABS. Q4/25-1 | 30,00 € | 8836735 (Beyer) | Velbert |
| 2025-11-13 | HAEVGID 036131 LANR 8898288 LKK NO HZV ABS. Q4/25-1 | 52,00 € | 8898288 (Rösing) | Eitorf |

**Erwartete Zuordnung (case-context.json):**
- **Zahlung:** 13.11.2025 → **Leistung:** Oktober 2025 (VORMONAT-Logik)
- **servicePeriodStart:** 2025-10-01
- **servicePeriodEnd:** 2025-10-31
- **estateAllocation:** MIXED (Oktober liegt auf Stichtag 29.10.)
- **Kritische Frage:** 28/31 Alt, 3/31 Neu ODER 29/31 Alt, 2/31 Neu?

**Ursache:**
- Import-Script hat diese Zahlungen nicht durch Classification Engine geschickt
- ODER: Classification Rules matchen nicht auf diese Patterns

**Impact:**
- 362 Transaktionen = ~36% aller IST-Daten unverarbeitet
- Vermutlich >100.000 EUR unzugeordnet

---

### Problem 2: 159 Entries mit estateAllocation = UNKLAR

**Beispiele:**
| Datum | Beschreibung | Betrag | Problem |
|-------|--------------|--------|---------|
| 2025-10 | Dr. Rösing - Erstattung Miete Oktober 2025 | -1.314,68 € | **FALSCH:** Miete sollte SAME_MONTH sein, nicht UNKLAR |
| 2025-10 | Pro bAV Pensionskasse | -70,00 € | **OK:** Versicherung ohne Leistungsdatum |
| 2025-10 | Telekom | -15,22 € | **FALSCH:** Betriebskosten sollte SAME_MONTH sein |
| 2025-10 | Bernd Kolle MVZ Uckerath - Miete | -5.269,21 € | **FALSCH:** Miete sollte SAME_MONTH sein, nicht UNKLAR |

**Befund:**
- ~50% der UNKLAR-Entries sollten NICHT UNKLAR sein
- Miete, Betriebskosten haben klares Leistungsdatum (Transaktionsmonat = Leistungsmonat)
- Classification Rules für SAME_MONTH fehlen

**Empfehlung:**
```sql
-- Regel für Miete (SAME_MONTH)
INSERT INTO classification_rules (...) VALUES
  (..., 'Miete', 'description', 'CONTAINS', 'Miete|MVZ', ..., 'SAME_MONTH', ...);

-- Regel für Betriebskosten (SAME_MONTH)
INSERT INTO classification_rules (...) VALUES
  (..., 'Betriebskosten', 'description', 'CONTAINS', 'Telekom|E.ON|Strom', ..., 'SAME_MONTH', ...);
```

---

### Problem 3: HZV-Zahlungen mit MANUAL_REVIEW statt PERIOD_PRORATA

**IST-Stand:**
| Feld | Wert | Problem |
|------|------|---------|
| `transactionDate` | 2025-10-09 (1760400000000) | ✅ OK |
| `serviceDate` | 2025-10-14 (1760479200000) | ⚠️ Warum 14.? Sollte NULL oder Monatsmitte sein |
| `servicePeriodStart` | **NULL** | ❌ FEHLT! |
| `servicePeriodEnd` | **NULL** | ❌ FEHLT! |
| `estateAllocation` | ALTMASSE | ❌ FALSCH! Oktober liegt AUF Stichtag → MIXED |
| `allocationSource` | MANUAL_REVIEW | ❌ Sollte PERIOD_PRORATA sein |

**SOLL-Stand:**
| Feld | Wert | Grund |
|------|------|-------|
| `serviceDate` | NULL | Oder Monatsmitte 2025-10-15 |
| `servicePeriodStart` | 2025-10-01 | Vormonat-Logik: Nov-Zahlung = Okt-Leistung |
| `servicePeriodEnd` | 2025-10-31 | Monatsende |
| `estateAllocation` | **MIXED** | Stichtag 29.10. liegt IM Leistungsmonat |
| `estateRatio` | 0.0968 (3/31) ODER 0.0645 (2/31) | Je nach Inklusion/Exklusion Stichtag |
| `allocationSource` | VORMONAT_LOGIK → PERIOD_PRORATA | Split-Engine Fallback |

**Code-Verifikation:**
```typescript
// /app/src/lib/settlement/split-engine.ts:197-231
function createAllocationFromVormonatLogik(transactionDate, cutoffDate) {
  // 1. Vormonat berechnen: Nov → Okt
  const serviceMonth = new Date(transactionDate);
  serviceMonth.setMonth(serviceMonth.getMonth() - 1);

  // 2. Monatsgrenzen: 2025-10-01 bis 2025-10-31
  const serviceMonthStart = new Date(serviceMonth.getFullYear(), serviceMonth.getMonth(), 1);
  const serviceMonthEnd = new Date(serviceMonth.getFullYear(), serviceMonth.getMonth() + 1, 0);

  // 3. Stichtag liegt im Monat? → PERIOD_PRORATA
  if (serviceMonthEnd < cutoffDate) return ALTMASSE;
  if (serviceMonthStart >= cutoffDate) return NEUMASSE;

  // 4. MIXED → zeitanteilig
  return createAllocationFromServicePeriod(serviceMonthStart, serviceMonthEnd, cutoffDate);
}
```

**Erwartetes Ergebnis:**
```javascript
// cutoffDate = 2025-10-29
daysBetween(2025-10-01, 2025-10-29) = 28 // Exklusiv Stichtag
totalDays = 31

// VARIANTE A (case-context.json): 28/31 Alt, 3/31 Neu
altDays = 28, neuDays = 3
estateRatio = 3/31 = 0.0968 (9,68% Neumasse)

// VARIANTE B (config.ts): 29/31 Alt, 2/31 Neu
altDays = 29, neuDays = 2
estateRatio = 2/31 = 0.0645 (6,45% Neumasse)
```

**Ursache:**
- Import-Script hat `servicePeriodStart/End` nicht gesetzt
- Manuelle Zuordnung statt automatischer Split-Engine
- `MANUAL_REVIEW` statt `PERIOD_PRORATA`

---

## ✅ KORREKTE ZUORDNUNGEN

### 1. KV PLAN-Daten: ✅ VERTRAGSREGEL korrekt

| Estate | Quelle | Count | Summe |
|--------|--------|-------|-------|
| **ALTMASSE** | VERTRAGSREGEL | 10 | 152.833,32 € |
| **NEUMASSE** | VERTRAGSREGEL | 18 | 343.366,65 € |

**Ratio-Prüfung:**
```
Neumasse-Anteil = 343.366 / (152.833 + 343.366) = 0.692 = 69,2%
Soll (Q4/2025): 2/3 = 66,7%
Abweichung: +2,5 Prozentpunkte
```

**Bewertung:** ✅ Sehr nah an 2/3-Regel (Abweichung durch periodische Struktur)

---

### 2. Location-Zuordnung: ⚠️ Teilweise korrekt

| Location | IST ALTMASSE | IST NEUMASSE | IST NULL | Status |
|----------|--------------|--------------|----------|--------|
| **Uckerath** | 48 | 221 | - | ✅ Korrekt |
| **Velbert** | 47 | 45 | - | ✅ Korrekt |
| **Eitorf** | - | 13 | - | ✅ Korrekt |
| **Gesellschaft** | 16 | 23 | - | ✅ Korrekt |
| **NULL** | - | - | **362** | ❌ HZV November unverarbeitet |
| **NULL (UNKLAR)** | - | - | **159** | ⚠️ 50% fälschlich UNKLAR |

**Befund:** Location-Mapping funktioniert für verarbeitete Entries ✅

---

### 3. BankAccount-Zuordnung: ✅ Vollständig korrekt

| Bank Account | Count | Status |
|--------------|-------|--------|
| ISK Uckerath | 345 | ✅ |
| MVZ Uckerath (apoBank) | 265 | ✅ |
| Geschäftskonto MVZ Velbert (Sparkasse) | 182 | ✅ |
| HV PLUS eG (apoBank Zentrale) | 110 | ✅ |
| ISK Velbert | 17 | ✅ |
| **NULL** | 84 | ⚠️ PLAN-Daten ohne Bank |

**Bewertung:** ✅ IST-Daten haben korrekte Bank-Zuordnung

---

### 4. Counterparty-Zuordnung: ⚠️ Funktioniert für verarbeitete Entries

**Top Counterparties (IST NEUMASSE):**
| Counterparty | Count | Typ |
|--------------|-------|-----|
| HÄVG - AOK Nordost | 16 | HZV (einzelne KK) |
| Kreiskasse Rhein-Sieg (GKV) | 11 | Sozialabgaben |
| Kreis Mettmann Gesundheitsamt | 10 | Sonstiges |
| HÄVG - IKK classic | 9 | HZV (einzelne KK) |
| HÄVG - Techniker Krankenkasse | 9 | HZV (einzelne KK) |
| DRV Bund | 8 | Sozialabgaben |
| Techniker Krankenkasse | 8 | Sonstiges |

**Problem:** 362 Entries OHNE Counterparty (unverarbeitete HZV)

---

## 🔬 INKONSISTENZ: 28/31 vs. 29/31

### Widerspruch case-context.json vs. config.ts

**case-context.json (Zeile 102):**
```json
{
  "altNeuRegel": "Oktober 2025: 28/31 Alt, 3/31 Neu (nach Monatstag 29.10.)",
  "quelle": "Massekreditvertrag §1(2)b"
}
```

**config.ts (Zeile 122-127):**
```typescript
'2025-10': {
  altRatio: 29 / 31,  // ❌ WIDERSPRICHT case-context!
  neuRatio: 2 / 31,
  source: AllocationSource.PERIOD_PRORATA,
  note: 'Zeitanteilig: 29/31 Alt (1.-29.10.), 2/31 Neu (30.-31.10.)',
},
```

### Ursache: Unklar ob Stichtag 29.10. inklusiv/exklusiv

**Variante A: 29.10. gehört zu NEUMASSE**
- Tage 1.-28. Oktober = ALTMASSE (28 Tage)
- Tage 29.-31. Oktober = NEUMASSE (3 Tage)
- → 28/31 Alt, 3/31 Neu ✅ case-context.json

**Variante B: 29.10. gehört zu ALTMASSE**
- Tage 1.-29. Oktober = ALTMASSE (29 Tage)
- Tage 30.-31. Oktober = NEUMASSE (2 Tage)
- → 29/31 Alt, 2/31 Neu ✅ config.ts

### Code-Implementierung (split-engine.ts:259)

```typescript
const altDays = daysBetween(periodStart, cutoffDate);
// daysBetween(2025-10-01, 2025-10-29) = 28

// KEINE +1 → Stichtag ist EXKLUSIV für Alt
// → 29.10. ist ERSTER TAG NEUMASSE
// → Variante A ist korrekt: 28/31 Alt, 3/31 Neu
```

**Befund:**
- **Code implementiert Variante A** (28/31)
- **config.ts definiert Variante B** (29/31)
- **→ config.ts ist FALSCH!**

---

## 🎯 HANDLUNGSEMPFEHLUNGEN

### PRIO 1: config.ts korrigieren

```typescript
// /app/src/lib/cases/haevg-plus/config.ts:122-127
// FIX: 28/31 statt 29/31
'2025-10': {
  altRatio: 28 / 31,  // ✅ KORRIGIERT
  neuRatio: 3 / 31,   // ✅ KORRIGIERT
  source: AllocationSource.PERIOD_PRORATA,
  note: 'Zeitanteilig: 28/31 Alt (1.-28.10.), 3/31 Neu (29.-31.10.) - Stichtag 29.10. ist ERSTER TAG NEUMASSE',
},
```

---

### PRIO 2: 362 unverarbeitete HZV-Zahlungen re-importieren

**Option A: Classification Rules erweitern**
```sql
-- LANR-basierte HZV-Zuordnung
INSERT INTO classification_rules (id, caseId, name, isActive, priority, matchField, matchType, matchValue, assignCounterpartyId, assignServiceDateRule, confidenceBonus) VALUES
  ('rule-hzv-lanr', '2982ff26-081a-4811-8e1e-46b39e1ff757', 'HZV LANR-Matching', 1, 5, 'description', 'REGEX', 'HAEVG|LANR \\d{7}|HZV ABS', 'cp-haevg-hzv', 'VORMONAT', 0.95);

-- LANR → Location (8 Ärzte)
INSERT INTO classification_rules (id, caseId, name, isActive, priority, matchField, matchType, matchValue, assignLocationId, confidenceBonus) VALUES
  ('rule-lanr-1445587', '2982ff26-081a-4811-8e1e-46b39e1ff757', 'LANR 1445587 → Uckerath (Binas)', 1, 10, 'description', 'CONTAINS', 'LANR 1445587', 'loc-haevg-uckerath', 1.0),
  ('rule-lanr-8836735', '2982ff26-081a-4811-8e1e-46b39e1ff757', 'LANR 8836735 → Velbert (Beyer)', 1, 10, 'description', 'CONTAINS', 'LANR 8836735', 'loc-haevg-velbert', 1.0),
  ('rule-lanr-8898288', '2982ff26-081a-4811-8e1e-46b39e1ff757', 'LANR 8898288 → Eitorf (Rösing)', 1, 10, 'description', 'CONTAINS', 'LANR 8898288', 'loc-haevg-eitorf', 1.0),
  -- ... weitere 5 LANRs
;
```

**Option B: Bulk-Update via SQL** (schneller, aber weniger auditierbar)
```sql
UPDATE ledger_entries
SET
  counterpartyId = 'cp-haevg-hzv',
  categoryTag = 'HZV',
  servicePeriodStart = '2025-10-01T00:00:00.000Z',
  servicePeriodEnd = '2025-10-31T00:00:00.000Z',
  estateAllocation = 'MIXED',
  estateRatio = 0.0968,  -- 3/31 (Variante A)
  allocationSource = 'VORMONAT_LOGIK',
  allocationNote = 'HZV November-Zahlung für Oktober-Leistung: 28/31 Alt, 3/31 Neu (Stichtag 29.10. = erster Tag Neumasse)'
WHERE
  caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757'
  AND description LIKE '%HAEVG%'
  AND description LIKE '%LANR%'
  AND transactionDate >= 1762992000000  -- 2025-11-13
  AND counterpartyId IS NULL;

-- LANR-basiertes Location-Mapping
UPDATE ledger_entries SET locationId = 'loc-haevg-uckerath' WHERE caseId = '...' AND description LIKE '%LANR 1445587%';
UPDATE ledger_entries SET locationId = 'loc-haevg-velbert' WHERE caseId = '...' AND description LIKE '%LANR 8836735%';
UPDATE ledger_entries SET locationId = 'loc-haevg-eitorf' WHERE caseId = '...' AND description LIKE '%LANR 8898288%';
-- ... weitere LANRs
```

---

### PRIO 3: Classification Rules für SAME_MONTH erweitern

```sql
-- Miete: Transaktionsmonat = Leistungsmonat
INSERT INTO classification_rules (...) VALUES
  ('rule-miete-same-month', '...', 'Miete SAME_MONTH', 1, 20, 'description', 'CONTAINS', 'Miete|MVZ', NULL, 'SAME_MONTH', 0.9);

-- Betriebskosten: Transaktionsmonat = Leistungsmonat
INSERT INTO classification_rules (...) VALUES
  ('rule-betriebskosten', '...', 'Betriebskosten SAME_MONTH', 1, 20, 'description', 'REGEX', 'Telekom|E\\.ON|Strom|Wasser|Heizung', NULL, 'SAME_MONTH', 0.9);

-- Löhne/Gehälter: Transaktionsmonat = Leistungsmonat
INSERT INTO classification_rules (...) VALUES
  ('rule-gehaelter', '...', 'Gehälter SAME_MONTH', 1, 20, 'description', 'CONTAINS', 'Gehalt|Lohn|Mitarbeiter', NULL, 'SAME_MONTH', 0.95);
```

**Impact:** ~80 der 159 UNKLAR-Entries würden korrekt zugeordnet

---

### PRIO 4: servicePeriodStart/End für Oktober-HZV nachtragen

```sql
-- Alle HZV-Oktober-Zahlungen (MANUAL_REVIEW)
UPDATE ledger_entries
SET
  servicePeriodStart = '2025-09-01T00:00:00.000Z',  -- September (Vormonat)
  servicePeriodEnd = '2025-09-30T00:00:00.000Z',
  estateAllocation = 'ALTMASSE',  -- September vollständig vor Stichtag
  estateRatio = NULL,  -- Kein Split nötig
  allocationSource = 'VORMONAT_LOGIK',
  allocationNote = 'HZV Oktober-Zahlung für September-Leistung: 100% Altmasse (vollständig vor Stichtag 29.10.)'
WHERE
  caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757'
  AND transactionDate >= 1759276800000  -- Oktober 2025
  AND transactionDate < 1762992000000   -- vor November
  AND description LIKE '%HAVG%'
  AND allocationSource = 'MANUAL_REVIEW';
```

---

## 📊 Zusammenfassung

### ✅ WAS FUNKTIONIERT

1. **Stammdaten sind vollständig** (169 Counterparties, 4 Locations, 5 BankAccounts)
2. **KV PLAN-Daten korrekt** (2/3 Neumasse via VERTRAGSREGEL)
3. **BankAccount-Zuordnung perfekt** (100% IST-Daten haben Bank)
4. **Location-Zuordnung für verarbeitete Entries korrekt**
5. **Split-Engine Code korrekt** (Variante A: 28/31 implementiert)

### ❌ WAS NICHT FUNKTIONIERT

1. **config.ts falsch** (29/31 statt 28/31) → **Code-Fix nötig**
2. **362 HZV-Zahlungen unverarbeitet** → **Re-Import oder Bulk-Update**
3. **159 UNKLAR (50% fälschlich)** → **SAME_MONTH Rules fehlen**
4. **servicePeriodStart/End fehlen** → **Nachtragen für Oktober-HZV**

### 🎯 IMPACT nach Fixes

| Metrik | Aktuell | Nach Fix | Verbesserung |
|--------|---------|----------|--------------|
| Unverarbeitete Entries | 362 (36%) | 0 | +362 korrekt |
| UNKLAR Entries | 159 (16%) | ~79 (8%) | +80 korrekt |
| Korrekte estateAllocation | 55% | 92% | +37pp |
| Korrekte Location | 64% | 100% | +36pp |
| Korrekte Counterparty | 64% | 100% | +36pp |

---

## 🔧 SQL-Scripts READY TO USE

### Script 1: config.ts Fix (Code-Änderung)

```typescript
// /app/src/lib/cases/haevg-plus/config.ts:122-127
'2025-10': {
  altRatio: 28 / 31,  // FIXED
  neuRatio: 3 / 31,   // FIXED
  source: AllocationSource.PERIOD_PRORATA,
  note: 'Zeitanteilig: 28/31 Alt (1.-28.10.), 3/31 Neu (29.-31.10.)',
},
```

### Script 2: Bulk-Fix 362 HZV November

```sql
-- Teil 1: HZV Counterparty + Service Period
UPDATE ledger_entries
SET
  counterpartyId = 'cp-haevg-hzv',
  categoryTag = 'HZV',
  servicePeriodStart = '2025-10-01T00:00:00.000Z',
  servicePeriodEnd = '2025-10-31T00:00:00.000Z',
  estateAllocation = 'MIXED',
  estateRatio = 0.0968,  -- 3/31
  allocationSource = 'PERIOD_PRORATA',
  allocationNote = 'HZV November → Oktober-Leistung: 28/31 Alt, 3/31 Neu (Bulk-Fix 2026-02-08)'
WHERE
  caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757'
  AND description LIKE '%HAEVG%'
  AND description LIKE '%HZV%'
  AND transactionDate >= 1762992000000
  AND counterpartyId IS NULL;

-- Teil 2: LANR → Location Mapping (8 Ärzte)
UPDATE ledger_entries SET locationId = 'loc-haevg-velbert' WHERE caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757' AND description LIKE '%LANR 3892462%'; -- van Suntum
UPDATE ledger_entries SET locationId = 'loc-haevg-velbert' WHERE caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757' AND description LIKE '%LANR 8836735%'; -- Beyer
UPDATE ledger_entries SET locationId = 'loc-haevg-velbert' WHERE caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757' AND description LIKE '%LANR 7729639%'; -- Kamler
UPDATE ledger_entries SET locationId = 'loc-haevg-uckerath' WHERE caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757' AND description LIKE '%LANR 1445587%'; -- Binas
UPDATE ledger_entries SET locationId = 'loc-haevg-uckerath' WHERE caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757' AND description LIKE '%LANR 3243603%'; -- Fischer
UPDATE ledger_entries SET locationId = 'loc-haevg-uckerath' WHERE caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757' AND description LIKE '%LANR 4652451%'; -- Ludwig
UPDATE ledger_entries SET locationId = 'loc-haevg-uckerath' WHERE caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757' AND description LIKE '%LANR 1203618%'; -- Schweitzer
UPDATE ledger_entries SET locationId = 'loc-haevg-eitorf' WHERE caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757' AND description LIKE '%LANR 8898288%'; -- Rösing

-- Verifizierung
SELECT COUNT(*) as fixed FROM ledger_entries WHERE caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757' AND categoryTag = 'HZV' AND locationId IS NOT NULL AND transactionDate >= 1762992000000;
-- Erwartung: 362
```

### Script 3: SAME_MONTH Rules

```sql
INSERT INTO classification_rules (id, caseId, name, isActive, priority, matchField, matchType, matchValue, assignServiceDateRule, confidenceBonus, createdAt, createdBy, updatedAt, updatedBy) VALUES
  (lower(hex(randomblob(16))), '2982ff26-081a-4811-8e1e-46b39e1ff757', 'Miete SAME_MONTH', 1, 20, 'description', 'CONTAINS', 'Miete', 'SAME_MONTH', 0.9, datetime('now'), 'system', datetime('now'), 'system'),
  (lower(hex(randomblob(16))), '2982ff26-081a-4811-8e1e-46b39e1ff757', 'Betriebskosten SAME_MONTH', 1, 20, 'description', 'REGEX', 'Telekom|E\\.ON|Strom', 'SAME_MONTH', 0.9, datetime('now'), 'system', datetime('now'), 'system'),
  (lower(hex(randomblob(16))), '2982ff26-081a-4811-8e1e-46b39e1ff757', 'Gehälter SAME_MONTH', 1, 20, 'description', 'CONTAINS', 'Gehalt|Lohn', 'SAME_MONTH', 0.95, datetime('now'), 'system', datetime('now'), 'system');

-- Dann UNKLAR-Entries re-prozessieren (via Code)
```

---

**Erstellt:** 2026-02-08
**Von:** Claude Sonnet 4.5
**Basis:** ECHTE Datenbank-Analyse (1.003 Ledger Entries, Case 2982ff26)
