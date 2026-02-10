# ⚠️ KRITISCHER FEHLER: Opening Balances in BankAccounts falsch

**Datum:** 2026-02-08
**Status:** KRITISCH - Doppelzählung von Oktober-Transaktionen
**Entdeckt bei:** Systematische Verifikation aller Zahlen nach Duplikate-Incident

---

## Executive Summary

**Die Opening Balances in der `bank_accounts` Tabelle sind FALSCH!**

Sie enthalten die **Closing Balances vom 31.10.2025** statt der **Opening Balances vom 01.10.2025**.

Das führt zu **Doppelzählung der Oktober-Transaktionen**:
1. Einmal im Übergang Opening → Closing (bereits in der falschen "Opening Balance" enthalten)
2. Nochmal in den LedgerEntries für Oktober

---

## Betroffene Konten

### 1. apoBank HV PLUS eG (Konto #28818923)

**Laut Oktober-PDF:**
- Opening Balance 01.10.2025: **+11.400,47 EUR** ✅ KORREKT
- Closing Balance 31.10.2025: **-287.372,10 EUR**
- Transaktionsdifferenz: **-298.772,57 EUR**

**In Datenbank:**
- `bank_accounts.openingBalanceCents`: **-28.737.210 Cent** ❌ FALSCH (ist Closing!)
- Sollte sein: **+1.140.047 Cent** (Opening vom 01.10.)

**Ledger Entries (Oktober):**
- Summe: **-299.794,50 EUR** (stimmt etwa mit PDF-Differenz überein)

**Aktuelle (falsche) Berechnung:**
```
Opening (-287K) + Okt (-300K) + Nov (-2K) + Dez (-3K) + Jan (+20K) = -573K EUR ❌
```

**Korrekte Berechnung (sollte sein):**
```
Opening (+11K) + Okt (-300K) + Nov (-2K) + Dez (-3K) + Jan (+20K) = -274K EUR ✅
```

**Fehler:** **-299K EUR zu niedrig** (Oktober-Transaktionen doppelt abgezogen!)

---

### 2. Sparkasse Velbert (Geschäftskonto MVZ)

**Laut Oktober-PDF:**
- Opening Balance 01.10.2025: **+37.065,85 EUR** ✅ KORREKT
- Closing Balance 31.10.2025: **+24.970,61 EUR**
- Transaktionsdifferenz: **-12.095,24 EUR**

**In Datenbank:**
- `bank_accounts.openingBalanceCents`: **+2.497.061 Cent** ❌ FALSCH (ist Closing!)
- Sollte sein: **+3.706.585 Cent** (Opening vom 01.10.)

**Ledger Entries (Oktober):**
- Summe: **-12.516,88 EUR** (stimmt etwa mit PDF-Differenz überein, 421 EUR Abweichung)

**Aktuelle (falsche) Berechnung:**
```
Opening (+25K) + Okt (-13K) + Nov (+9K) + Jan (+43K) = +64K EUR ❌
```

**Korrekte Berechnung (sollte sein):**
```
Opening (+37K) + Okt (-13K) + Nov (+9K) + Jan (+43K) = +76K EUR ✅
```

**Fehler:** **-12K EUR zu niedrig**

---

### 3. apoBank Uckerath (MVZ Uckerath Konto #78818923)

**Laut Oktober-PDF:**
- Opening Balance 01.10.2025: **-52.159,06 EUR** ✅ KORREKT
- Closing Balance 31.10.2025: **+23.514,27 EUR**
- Transaktionsdifferenz: **+75.673,33 EUR**

**In Datenbank:**
- `bank_accounts.openingBalanceCents`: **+2.351.427 Cent** ❌ FALSCH (ist Closing!)
- Sollte sein: **-5.215.906 Cent** (Opening vom 01.10.)

**Ledger Entries (Oktober):**
- Summe: **+67.733,88 EUR** (ca. 8K EUR Abweichung zur PDF-Differenz)

**Aktuelle (falsche) Berechnung:**
```
Opening (+24K) + Okt (+68K) + Nov (-23K) + Jan (+31K) = +100K EUR ❌
```

**Korrekte Berechnung (sollte sein):**
```
Opening (-52K) + Okt (+68K) + Nov (-23K) + Jan (+31K) = +24K EUR ✅
```

**Fehler:** **+76K EUR zu hoch**

---

## Nicht betroffene Konten

### 4. ISK Velbert

- Opening Balance: **0,00 EUR** ✅ KORREKT
- Konto eröffnet: 05.12.2025
- Keine Oktober/November-Entries

### 5. ISK Uckerath

- Opening Balance: **0,00 EUR** ✅ KORREKT
- Konto eröffnet: 13.11.2025
- Erste Entries ab November

---

## Gesamtauswirkung

| Konto | Fehler | Richtung |
|-------|--------|----------|
| apoBank HV PLUS eG | **-299K EUR** | Zu niedrig (doppelt abgezogen) |
| Sparkasse Velbert | **-12K EUR** | Zu niedrig |
| apoBank Uckerath | **+76K EUR** | Zu hoch |
| **NETTO-FEHLER** | **-235K EUR** | **Gesamtliquidität zu niedrig!** |

---

## Root Cause

**Vermutung:** Bei der Initialisierung der `bank_accounts` Tabelle wurden die **Closing Balances der Oktober-PDFs** als Opening Balances eingetragen, statt der **Opening Balances vom 01.10.**.

**Prüfen:**
- Wann wurden die Opening Balances gesetzt? (`createdAt: 1770313846635` = 2026-02-06)
- Durch welches Script/Migration?

---

## Auswirkung auf Dashboard

**Dashboard zeigt aktuell (FALSCH):**

| Scope | Opening Balance (angezeigt) | Opening Balance (korrekt) | Fehler |
|-------|----------------------------|---------------------------|--------|
| **GLOBAL** | -239K EUR | +4K EUR | **-243K EUR zu niedrig** |
| **VELBERT** | +25K EUR | +37K EUR | **-12K EUR zu niedrig** |
| **UCKERATH** | +24K EUR | -52K EUR | **+76K EUR zu hoch** |

**Hinweis:** Der GLOBAL-Fehler ist größer (-243K statt -235K), weil:
- ISK Velbert + ISK Uckerath haben 0 Opening, aber positive Ledger-Summen
- Diese werden zur falschen globalen Opening Balance addiert

---

## Nächste Schritte

### 1. Verifizierung

- [ ] Prüfe alle VERIFIED Oktober-JSONs für exakte Opening Balances
- [ ] Dokumentiere, wann und wie die falschen Opening Balances gesetzt wurden

### 2. Korrektur

**SQL-Update für lokale DB:**
```sql
-- WICHTIG: VOR Ausführung Backup machen!

UPDATE bank_accounts
SET openingBalanceCents = 1140047 -- +11.400,47 EUR
WHERE id = 'ba-apobank-hvplus';

UPDATE bank_accounts
SET openingBalanceCents = 3706585 -- +37.065,85 EUR
WHERE id = 'ba-sparkasse-velbert';

UPDATE bank_accounts
SET openingBalanceCents = -5215906 -- -52.159,06 EUR
WHERE id = 'ba-apobank-uckerath';
```

**Turso DB (Production):**
```bash
turso db shell inso-liquiplanung-v2 < fix-opening-balances.sql
```

### 3. Verifikation nach Korrektur

- [ ] Dashboard Opening Balance GLOBAL sollte ~+4K EUR sein
- [ ] Dashboard Opening Balance VELBERT sollte ~+37K EUR sein
- [ ] Dashboard Opening Balance UCKERATH sollte ~-52K EUR sein
- [ ] Current Balances sollten mit letzten IST-PDF-Saldi übereinstimmen

---

## Lessons Learned

1. **Opening Balance ≠ erster verfügbarer PDF-Saldo**
   - Opening Balance muss VOR allen importierten Transaktionen liegen
   - Wenn Oktober-Transaktionen importiert werden, muss Opening vom 01.10. sein, nicht vom 31.10.

2. **Automatisierte Verifikation nötig**
   - Beim Import: Prüfe ob Opening Balance + Ledger Sum = PDF Closing
   - Bei Abweichung: Warning/Error

3. **Dokumentation der Basisdaten**
   - JEDE Opening Balance muss auf ein spezifisches PDF-Datum zurückführbar sein
   - In `bank_accounts` Tabelle Feld `openingBalanceDate` hinzufügen?

---

**Erstellt:** 2026-02-08
**Priorität:** KRITISCH
**Verantwortlich:** Entwicklung (Claude)
**Status:** ⚠️ FEHLER IDENTIFIZIERT - KORREKTUR AUSSTEHEND

