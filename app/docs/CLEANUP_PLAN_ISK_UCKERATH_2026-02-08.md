# Bereinigungsplan ISK Uckerath - Finale Analyse

**Datum:** 2026-02-08
**Status:** Zur Freigabe bereit
**Kritikalität:** HOCH - Komplexe Datenlage

---

## Executive Summary

**Problem:** 658 LedgerEntries in DB, nur 325 einzigartige Buchungen → **333 Duplikate**

**Komplexität:** Die Duplikate sind NICHT einfach zu entfernen:
- ✅ **November:** Beide Versionen identisch → einfache Lösung
- ⚠️ **Dezember:** 7 Buchungen unterschiedlich zwischen Versionen
- ⚠️ **Januar:** 24 Buchungen unterschiedlich zwischen Versionen (!)

**Empfehlung:** Stufenweises Vorgehen mit PDF-Verifikation

---

## Datenanalyse pro Monat

| Monat | Total Entries | Einzigartige Buchungen | Duplikate | Duplikat-Rate | Einzigartig nur in V1 | Einzigartig nur in V2 |
|-------|---------------|------------------------|-----------|---------------|----------------------|----------------------|
| **November 2025** | 190 | 88 | 102 | 53,7% | 0 | 0 |
| **Dezember 2025** | 281 | 139 | 142 | 50,5% | 3 (-10.088 EUR) | 4 (-14.650 EUR) |
| **Januar 2026** | 187 | 98 | 89 | 47,6% | 23 (-68.360 EUR) | 1 (-49 EUR) |
| **GESAMT** | **658** | **325** | **333** | **50,6%** | **26** | **5** |

**Legende:**
- V1 = Großschreibung (ISK_Uckerath)
- V2 = Kleinschreibung (ISK_uckerath)

---

## Strategie: 3-Stufen-Plan

### ✅ Stufe 1: November (SICHER)

**Situation:** Beide Versionen sind identisch
- ISK_Uckerath_2025-11_VERIFIED.json: 95 Entries, 114.102,69 EUR
- ISK_uckerath_2025_11_VERIFIED.json: 95 Entries, 114.102,69 EUR
- Keine einzigartigen Buchungen in einer Version

**Empfehlung:** Lösche Version 2 (Kleinschreibung) komplett

**SQL:**
```sql
-- 95 Entries löschen
DELETE FROM ledger_entries
WHERE bankAccountId = 'ba-isk-uckerath'
  AND valueType = 'IST'
  AND importSource = 'ISK_uckerath_2025_11_VERIFIED.json';
```

**Erwartetes Ergebnis:**
- Vorher: 190 Entries, 228.205,38 EUR
- Nachher: 95 Entries, 114.102,69 EUR
- **Differenz: -95 Entries, -114.102,69 EUR** ✅

---

### ⚠️ Stufe 2: Dezember (KOMPLEX - PDF-Verifikation nötig!)

**Situation:** 7 Buchungen unterschiedlich zwischen Versionen

**NUR in Version 1 (Großschreibung):**
1. 02.12.2025: -5.269,21 EUR (ECHTZEIT-SAMMELÜBERWEISUNG)
2. 02.12.2025: -316,18 EUR (SAMMELÜBERWEISUNG)
3. 03.12.2025: -4.502,96 EUR (SAMMELÜBERWEISUNG)
   **Summe: -10.088,35 EUR**

**NUR in Version 2 (Kleinschreibung):**
1. 02.12.2025: -4.993,48 EUR (SAMMELÜBERWEISUNG)
2. 10.12.2025: -2.290,27 EUR (SAMMELÜBERWEISUNG)
3. 10.12.2025: -1.935,86 EUR (SAMMELÜBERWEISUNG)
4. 21.12.2025: -5.430,53 EUR (SAMMELÜBERWEISUNG)
   **Summe: -14.650,14 EUR**

**Netto-Differenz:** -4.561,79 EUR

**⚠️ KRITISCHE FRAGE:** Welche dieser 7 Buchungen sind korrekt?

**Option A: PDF-Verifikation (EMPFOHLEN)**
1. Dezember-PDF-Kontoauszüge öffnen
2. Prüfen welche der 7 Buchungen im PDF vorhanden sind
3. Nur die korrekten Buchungen behalten
4. Echte Duplikate löschen (139 gemeinsame Buchungen → 1 Version behalten)

**Option B: Konservativ (beide Versionen teilweise behalten)**
1. Behalte ALLE einzigartigen Buchungen aus beiden Versionen
2. Lösche nur die 139 Buchungen die in BEIDEN Versionen vorkommen
3. Ergebnis: 139 Entries + 7 einzigartige = 146 Entries
4. **Risiko:** Möglicherweise falsche Buchungen in DB

**Option C: Vertraue Version 1 (Großschreibung)**
Begründung: Hat in anderen Monaten mehr Entries, konsistenter
- Lösche alle V2-Entries außer den 4 einzigartigen
- Prüfe ob V2-Einzigartige wirklich fehlen in V1

**Ich empfehle: Option A (PDF-Verifikation)**

---

### ⚠️ Stufe 3: Januar (SEHR KOMPLEX)

**Situation:** 24 Buchungen unterschiedlich (!)

**NUR in Version 1 (Großschreibung):**
- 23 Buchungen
- Summe: **-68.359,57 EUR** (!)

**NUR in Version 2 (Kleinschreibung):**
- 1 Buchung
- Summe: -49,17 EUR

**Netto-Differenz:** -68.310,40 EUR

**⚠️ MASSIVES Problem:** Fast 70K EUR Unterschied!

**Das deutet auf:**
- Version 1 enthält deutlich mehr Buchungen
- Version 2 ist unvollständig ODER
- Version 1 enthält falsche/doppelte Buchungen ODER
- Unterschiedliche Zeiträume abgedeckt

**Empfehlung:**
1. **Zuerst:** Januar-PDF-Kontoauszüge prüfen
   - Welche Version ist vollständig?
   - Fehlen 23 Buchungen in V2 oder sind sie in V1 zu viel?
2. **Danach:** Entscheidung welche Version zu behalten ist
3. **Nur dann:** Duplikate löschen

---

## Rollback-Plan

**Vor JEDER Löschung:**

```sql
-- 1. Vollständiges Backup
.backup '/tmp/isk-uckerath-backup-vor-bereinigung-2026-02-08.db'

-- 2. Export zu löschender Entries als CSV
.mode csv
.output /tmp/isk-uckerath-zu-loeschen.csv
SELECT * FROM ledger_entries
WHERE bankAccountId = 'ba-isk-uckerath'
  AND valueType = 'IST'
  AND importSource IN (
    'ISK_uckerath_2025_11_VERIFIED.json',
    'ISK_uckerath_2025_12_VERIFIED.json',
    'ISK_uckerath_2026_01_VERIFIED.json'
  );
.output stdout
```

**Rollback:**
```bash
# Lokale DB wiederherstellen
cp /tmp/isk-uckerath-backup-vor-bereinigung-2026-02-08.db dev.db

# Turso: Re-Import aus Backup
turso db shell inso-liquiplanung-v2 < /tmp/isk-uckerath-restore.sql
```

---

## Empfohlene Ausführungsreihenfolge

### Phase 1: Sofort (November - sicher)
1. ✅ Backup erstellen
2. ✅ November-Duplikate löschen (95 Entries)
3. ✅ Verifikation: Summe sollte 114.102,69 EUR sein
4. ✅ Liquiditätstabelle neu laden

### Phase 2: Nach PDF-Verifikation (Dezember)
1. ⏳ Dezember-PDFs prüfen (welche der 7 Buchungen sind korrekt?)
2. ⏳ Entscheidung: Option A, B oder C
3. ⏳ Entsprechende SQL-Statements ausführen
4. ⏳ Verifikation gegen PDF

### Phase 3: Nach PDF-Verifikation (Januar)
1. ⏳ Januar-PDFs prüfen (Vollständigkeit V1 vs V2)
2. ⏳ Entscheidung welche Version korrekt
3. ⏳ Duplikate löschen
4. ⏳ Verifikation gegen PDF

---

## SQL-Statements (zur Review)

### Stufe 1: November (zur sofortigen Ausführung freigegeben nach Backup)

```sql
-- ACHTUNG: NUR NACH BACKUP AUSFÜHREN!
-- Löscht 95 Entries der Kleinschreibungs-Version November

DELETE FROM ledger_entries
WHERE bankAccountId = 'ba-isk-uckerath'
  AND valueType = 'IST'
  AND importSource = 'ISK_uckerath_2025_11_VERIFIED.json';

-- Erwartetes Ergebnis: 95 rows deleted

-- Verifikation:
SELECT
  importSource,
  COUNT(*) as anzahl,
  SUM(amountCents) / 100.0 as summe
FROM ledger_entries
WHERE bankAccountId = 'ba-isk-uckerath'
  AND valueType = 'IST'
  AND (importSource LIKE '%2025-11%' OR importSource LIKE '%2025_11%')
GROUP BY importSource;

-- Erwartete Ausgabe:
-- ISK_Uckerath_2025-11_VERIFIED.json | 95 | 114102.69
```

### Stufe 2 & 3: Dezember + Januar (NICHT ausführen ohne PDF-Verifikation!)

```sql
-- PLACEHOLDER - Wird nach PDF-Verifikation erstellt
-- Mögliche Statements je nach User-Entscheidung:

-- Option: Lösche nur echte Duplikate (komplexe Query nötig)
-- Option: Lösche gesamte V2 außer einzigartigen Buchungen
-- Option: Behalte nur V1 komplett
```

---

## Verifikations-Checkliste

Nach JEDER Löschung:

- [ ] Anzahl gelöschter Rows stimmt mit Erwartung überein
- [ ] Summe der verbleibenden Entries gegen PDF geprüft
- [ ] Liquidity Matrix neu geladen
- [ ] Bank-View zeigt korrekten Saldo
- [ ] Keine Duplikate mehr vorhanden (Query `GROUP BY date, amount HAVING COUNT(*) > 1`)

---

## Erwartete End-Ergebnisse (nach vollständiger Bereinigung)

**Falls Version 1 (Großschreibung) korrekt:**
- November: 95 Entries, 114.102,69 EUR
- Dezember: 140 Entries, 289.991,47 EUR
- Januar: 105 Entries, 30.142,03 EUR
- **Gesamt: 340 Entries, 434.236,19 EUR**

**Falls kombiniert (alle einzigartigen Buchungen):**
- Gesamt: 325 Entries (alle einzigartigen)
- Summe: TBD (nach PDF-Verifikation)

**PDF-Verifizierung kritisch:**
- Januar-Endsaldo laut PDF (29.01.2026): 419.536,88 EUR
- Dieser muss am Ende stimmen!

---

## Nächste Schritte - USER-ENTSCHEIDUNG ERFORDERLICH

**Frage 1: November sofort bereinigen?**
- ✅ Sicher, keine Risiken
- Würde sofort 95 Duplikate entfernen
- **Deine Freigabe erforderlich**

**Frage 2: Dezember-PDFs prüfen?**
- 📄 Welche Kontoauszüge sind verfügbar?
- Pfad: `/Cases/Hausärztliche Versorgung PLUS eG/01-raw/` ?
- Oder: Andere Quelle?

**Frage 3: Januar-PDFs prüfen?**
- 📄 Besonders wichtig wegen 70K EUR Unterschied!
- Welche Version ist vollständig?

**Frage 4: Generelle Strategie?**
- Konservativ (Option B): Alle einzigartigen behalten, nur echte Duplikate löschen
- Vertrauensvoll (Option C): Traue Großschreibungs-Version
- Gründlich (Option A - EMPFOHLEN): PDF-Verifikation für jede kritische Entscheidung

---

**Erstellt:** 2026-02-08
**Autor:** Claude (Datenqualitäts-Analyst)
**Status:** ⏳ Wartet auf User-Freigabe
