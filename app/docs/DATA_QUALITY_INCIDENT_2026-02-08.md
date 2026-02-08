# Datenqualitäts-Incident: Doppelte Buchungen ISK Uckerath

**Datum:** 2026-02-08
**Status:** KRITISCH - Daten in Datenbank inkorrekt
**Betroffenes Konto:** ISK Uckerath (ba-isk-uckerath)
**Impact:** Liquiditätstabelle zeigt 932K EUR statt korrekter 419K EUR (+122% Fehler)

---

## Executive Summary

Die Datenbank enthält **doppelte Buchungen** für alle IST-Entries des ISK Uckerath Kontos. Jeder Monat (November 2025, Dezember 2025, Januar 2026) wurde zweimal importiert aus leicht unterschiedlich benannten JSON-Dateien.

**Betroffene Daten:**
- **658 LedgerEntries** in Datenbank
- **329 Entries sind Duplikate** (zu löschen)
- **Fehlerhafte Summe:** 932.180 EUR
- **Korrekte Summe (nach Bereinigung):** ~391-419K EUR

---

## Root Cause Analysis

### Ursache: Doppelter Import aus unterschiedlich benannten Dateien

Jeder Monat wurde zweimal importiert:

| Monat | Import 1 | Import 2 | Summe DB | PDF Endsaldo |
|-------|----------|----------|----------|--------------|
| **Nov 2025** | ISK_Uckerath_2025-11_VERIFIED.json (95 Entries) | ISK_uckerath_2025_11_VERIFIED.json (95 Entries) | 228.205 EUR | 114.103 EUR |
| **Dez 2025** | ISK_Uckerath_2025-12_VERIFIED.json (140 Entries) | ISK_uckerath_2025_12_VERIFIED.json (141 Entries) | 575.421 EUR | TBD |
| **Jan 2026** | ISK_Uckerath_2026-01_VERIFIED.json (105 Entries) | ISK_uckerath_2026_01_VERIFIED.json (82 Entries) | 128.553 EUR | +33 EUR |

### Unterschiede zwischen Imports

**Dateinamen:**
- Version 1: `ISK_Uckerath` (Großschreibung, Bindestrich)
- Version 2: `ISK_uckerath` (Kleinschreibung, Underscore)

**Beschreibungen:**
- Version 1: Präfix "GUTSCHRIFT ÜBERWEISUNG" + kürzere Details
- Version 2: Kein Präfix, vollständigere Beschreibung mit Bankdetails

**Entry-Counts:**
- Version 1 Total: 340 Entries (95 + 140 + 105)
- Version 2 Total: 318 Entries (95 + 141 + 82)

### Warum kein Duplikat-Schutz?

**Fehlende Sicherheitsmechanismen:**
1. ❌ Keine `ingestion_jobs` Tabellen-Einträge → Kein Tracking welche Dateien bereits importiert
2. ❌ Kein File-Hash-Check vor Import
3. ❌ Keine Duplikat-Erkennung based on (date + amount + bankAccount)
4. ❌ Kein Audit-Trail für Imports

**Import-Methode unklar:**
- Keine Records in `ingestion_jobs` Tabelle
- Keine Records in `ai_preprocessing_files` Tabelle
- Vermutlich: Direktes INSERT via Script ohne Validierung

---

## Verifizierung gegen PDF-Kontoauszüge

### November 2025

**Auszug Nr. 1 (13.11.2025):**
- Anfangssaldo: 0,00 EUR (Konto-Neueröffnung)
- Endsaldo: 45.931,50 EUR
- Buchungen: 51

**Auszug Nr. 10 (28.11.2025):**
- Anfangssaldo: 100.633,45 EUR
- Endsaldo: 114.102,69 EUR
- Buchungen: 11

**Datenbank November:**
- Buchungen: 190 (statt ~106)
- Summe: 228.205 EUR (statt 114.103 EUR)
- **Fehler: 2× zu viel** ✅

### Januar 2026

**Auszug Nr. 15 (29.01.2026):**
- Anfangssaldo: 419.503,97 EUR
- Endsaldo: 419.536,88 EUR
- Buchungen: 3

**Datenbank Januar:**
- Buchungen: 187 (plausibel für ganzen Monat)
- Summe: 128.553 EUR
- **Problem:** Januar-Summe passt nicht zu Differenz (419.537 - 419.504 = +33 EUR)

→ **Zusätzliches Problem:** Dezember-Endsaldo fehlt, Opening Balance unklar

---

## Impact Assessment

### Direkte Auswirkungen

**Liquiditätstabelle:**
- ✅ Technisch korrekt berechnet (Code funktioniert)
- ❌ Falsche Eingangsdaten (GIGO - Garbage In, Garbage Out)
- ❌ Opening Balance ISK Uckerath: 932K EUR statt ~419K EUR
- ❌ Alle Perioden-Balances falsch
- ❌ Rolling Forecast Chart zeigt falsche Entwicklung

**Betroffene Views:**
- Admin Dashboard → Liquiditätsmatrix
- Rolling Forecast Chart
- Bankkonten-Übersicht
- Alle Reports basierend auf LedgerEntries

### Indirekte Auswirkungen

**Vertrauensverlust:**
- User sieht 802K EUR im Januar, PDF zeigt 419K EUR
- Keine Konfidenz in IRGENDETWAS was das System berechnet
- Muss alle anderen Konten prüfen (wahrscheinlich gleiches Problem)

**Daten-Governance:**
- Kein Audit-Trail welche Dateien importiert wurden
- Kein Rollback-Mechanismus
- Keine Import-Validierung

---

## Betroffene Systeme/Komponenten

| Komponente | Status | Notizen |
|------------|--------|---------|
| `ledger_entries` Tabelle | ❌ CORRUPT | 329 doppelte Entries |
| `bank_accounts.openingBalanceCents` | ⚠️ UNKLAR | Möglicherweise falsch gesetzt |
| Liquidity Matrix API | ✅ OK | Code korrekt, aber falsche Daten |
| Rolling Forecast API | ✅ OK | Code korrekt, aber falsche Daten |
| Import Pipeline | ❌ FEHLEND | Keine Duplikat-Prävention |
| Audit Trail | ❌ FEHLEND | Kein Tracking |

---

## Bereinigungsplan (zur Freigabe)

### Option A: Lösche Version mit WENIGER Entries (EMPFOHLEN)

**Zu löschen:**
- `ISK_uckerath_2025_11_VERIFIED.json` (95 Entries)
- `ISK_uckerath_2025_12_VERIFIED.json` (141 Entries)
- `ISK_uckerath_2026_01_VERIFIED.json` (82 Entries)

**Begründung:**
- Version 1 hat mehr Entries in Nov und Jan (gleichwertig in Dez)
- Version 1 Beschreibungen sind konsistenter

**SQL (DRAFT - nicht ausführen ohne Freigabe!):**
```sql
-- ACHTUNG: NUR NACH USER-FREIGABE AUSFÜHREN!
DELETE FROM ledger_entries
WHERE bankAccountId = 'ba-isk-uckerath'
  AND valueType = 'IST'
  AND importSource IN (
    'ISK_uckerath_2025_11_VERIFIED.json',
    'ISK_uckerath_2025_12_VERIFIED.json',
    'ISK_uckerath_2026_01_VERIFIED.json'
  );
```

**Erwartetes Ergebnis:**
- 318 Entries gelöscht
- Verbleibende Summe: ~414K EUR (näher an PDF-Werten)

### Option B: Lösche Version mit MEHR Entries

**Zu löschen:**
- `ISK_Uckerath_2025-11_VERIFIED.json` (95 Entries)
- `ISK_Uckerath_2025-12_VERIFIED.json` (140 Entries)
- `ISK_Uckerath_2026-01_VERIFIED.json` (105 Entries)

**Begründung:**
- Version 2 hat vollständigere Beschreibungen (mit Bankdetails)

**SQL (DRAFT):**
```sql
DELETE FROM ledger_entries
WHERE bankAccountId = 'ba-isk-uckerath'
  AND valueType = 'IST'
  AND importSource IN (
    'ISK_Uckerath_2025-11_VERIFIED.json',
    'ISK_Uckerath_2025-12_VERIFIED.json',
    'ISK_Uckerath_2026-01_VERIFIED.json'
  );
```

---

## Rollback-Plan

**Vor Bereinigung:**

```sql
-- Backup erstellen
.backup /tmp/isk-uckerath-backup-2026-02-08.db

-- Oder: Export als SQL
.output /tmp/isk-uckerath-entries-backup.sql
SELECT * FROM ledger_entries
WHERE bankAccountId = 'ba-isk-uckerath' AND valueType = 'IST';
.output stdout
```

**Rollback:**

```bash
# Lokal
sqlite3 dev.db < /tmp/isk-uckerath-entries-backup.sql

# Turso
turso db shell inso-liquiplanung-v2 < /tmp/isk-uckerath-entries-backup.sql
```

---

## Nächste Schritte

### Sofort (heute)

1. ✅ Problem dokumentiert (diese Datei)
2. ⏳ Alle anderen Bankkonten prüfen (Task #2)
3. ⏳ Import-Pipeline analysieren (Task #3)
4. ⏳ User-Freigabe für Bereinigung einholen

### Kurzfristig (diese Woche)

5. Bereinigung durchführen (nach Freigabe)
6. Opening Balances aller Konten verifizieren gegen PDFs
7. Liquiditätstabelle neu berechnen und verifizieren

### Mittelfristig (nächste 2 Wochen)

8. Duplikat-Schutz implementieren:
   - File-Hash-Check vor Import
   - Deduplizierung based on (date + amount + bankAccount)
   - `ingestion_jobs` Tracking mandatory
9. Audit-Trail für alle Datenänderungen
10. Import-Validierung gegen PDF-Kontoauszüge

---

## Lessons Learned

### Was lief schief?

1. **Fehlende Validierung:** Keine Checks ob Daten bereits importiert
2. **Kein Audit Trail:** Keine Nachverfolgbarkeit
3. **Manuelle Prozesse:** Import wahrscheinlich via Ad-hoc-Script
4. **Keine Tests:** Opening Balance wurde nie gegen PDF verifiziert

### Was machen wir anders?

1. **Mandatory Ingestion Pipeline** mit Duplikat-Schutz
2. **Automated PDF-Verifikation** nach jedem Import
3. **Audit Trail** für ALLE Datenänderungen
4. **Integration Tests** die PDFs gegen DB vergleichen

---

## Anhang

### Beispiel-Duplikat

**Version 1 (ISK_Uckerath_2025-11_VERIFIED.json):**
```
ID: 23cbcfeb-3a49-407d-906f-ecc55509b069
Datum: 2025-11-13
Betrag: 345,00 EUR
Beschreibung: GUTSCHRIFT ÜBERWEISUNG HAEVGID 132064 LANR 4652451 SPECTRUMK HZV ABS. Q4/25-1 E2E:132064
```

**Version 2 (ISK_uckerath_2025_11_VERIFIED.json):**
```
ID: 3c38b226-8e73-4f4f-895d-e5b91bc29cef
Datum: 2025-11-13
Betrag: 345,00 EUR
Beschreibung: HAEVGID 132064 LANR 4652451 SPECTRUMK HZV ABS. Q4/25-1 E2E:132064 HAVG Hausarztliche Vertragsgemeinschaft Aktiengesellschaft
```

→ Gleiche Buchung, leicht unterschiedliche Formatierung

---

**Erstellt:** 2026-02-08
**Autor:** Claude (mit User David)
**Status:** Draft - Wartet auf User-Freigabe für Bereinigung
