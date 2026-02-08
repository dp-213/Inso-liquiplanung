# ISK Uckerath Bereinigungsplan V2 (Überarbeitet)

**Datum:** 2026-02-08 13:12
**Status:** VORAB-DOKUMENTATION
**Backup:** `/tmp/isk-uckerath-backup-vor-cleanup-v2-2026-02-08.db`

---

## KRITISCHE ERKENNTNIS aus V1-Versuch

Der erste Bereinigungsversuch hat **zu viele legitime Transaktionen gelöscht**:
- Sollte sein: ~321 Entries
- War nach V1-Cleanup: 303 Entries
- **18 legitime Transaktionen verloren!**

**Root Cause:** "File-internal Duplicates" Schritt war zu aggressiv. Transaktionen mit gleichem Datum + Betrag sind NICHT zwingend Duplikate (z.B. zwei Patienten zahlen 50 EUR am selben Tag).

---

## NEUE PROBLEM-ERKENNTNIS: Import-Diskrepanz

Vergleich JSON-Metadaten vs. Datenbank zeigt **Import-Probleme**:

| Monat | Version | JSON sagt | DB hat | Diskrepanz |
|-------|---------|-----------|--------|------------|
| **November** | V1 | 95 Tx | 95 Entries | ✅ OK |
| **November** | V2 | 95 Tx | 95 Entries | ✅ OK |
| **Dezember** | V1 | 144 Tx | 140 Entries | ❌ -4 |
| **Dezember** | V2 | 144 Tx | 141 Entries | ❌ -3 |
| **Januar** | V1 | 98 Tx | 105 Entries | ⚠️ +7 (!) |
| **Januar** | V2 | 106 Tx | 82 Entries | ❌ -24 |

**Fazit:** Import-Script hat NICHT alle Transaktionen korrekt importiert!

---

## NEUE STRATEGIE: Clean Slate Re-Import

Statt komplexe Duplikat-Bereinigung: **Komplett neu importieren** aus VERIFIED JSONs.

### Phase 1: Komplette Bereinigung

```sql
-- Lösche ALLE ISK Uckerath Entries (IST + PLAN)
DELETE FROM ledger_entries
WHERE bankAccountId = 'ba-isk-uckerath';
```

**Erwartung:** 658 Entries gelöscht

### Phase 2: Re-Import aus besten Versionen

**Quellen:**
1. November: `ISK_Uckerath_2025-11_VERIFIED.json` (V1, Großschreibung)
   - 95 Transaktionen, 114.102,69 EUR
2. Dezember: `ISK_uckerath_2025_12_VERIFIED.json` (V2, Kleinschreibung)
   - 144 Transaktionen, 275.341,33 EUR Net
3. Januar: `ISK_uckerath_2026_01_VERIFIED.json` (V2, Kleinschreibung)
   - 106 Transaktionen, 30.092,86 EUR Net

**Import-Methode:** Verwende das bestehende Import-Script, aber mit strikter Duplikat-Prüfung über:
- `bankAccountId + transactionDate + amountCents` (Triple-Match)

**Erwartetes Ergebnis:**
- Total Entries: 345
- Opening Balance: 0 EUR
- Closing Balance Ende Januar: 419.536,88 EUR

### Phase 3: Verifikation

```sql
-- Prüfe Anzahl Entries pro Monat
SELECT
  CASE
    WHEN datetime(transactionDate / 1000, 'unixepoch') >= '2025-11-01'
     AND datetime(transactionDate / 1000, 'unixepoch') < '2025-12-01' THEN 'November'
    WHEN datetime(transactionDate / 1000, 'unixepoch') >= '2025-12-01'
     AND datetime(transactionDate / 1000, 'unixepoch') < '2026-01-01' THEN 'Dezember'
    WHEN datetime(transactionDate / 1000, 'unixepoch') >= '2026-01-01'
     AND datetime(transactionDate / 1000, 'unixepoch') < '2026-02-01' THEN 'Januar'
  END as monat,
  COUNT(*) as entries,
  ROUND(SUM(amountCents) / 100.0, 2) as summe_eur
FROM ledger_entries
WHERE bankAccountId = 'ba-isk-uckerath'
  AND valueType = 'IST'
GROUP BY monat;
```

**Erwartete Ausgabe:**
```
November  | 95  | 114102.69
Dezember  | 144 | 275341.33
Januar    | 106 | 30092.86
```

**Closing Balance Berechnung:**
```sql
SELECT
  ROUND(
    (SELECT openingBalanceCents FROM bank_accounts WHERE id = 'ba-isk-uckerath') / 100.0
    + SUM(amountCents) / 100.0
  , 2) as closing_balance_eur
FROM ledger_entries
WHERE bankAccountId = 'ba-isk-uckerath'
  AND valueType = 'IST';
```

**Erwartung:** 419.536,88 EUR (muss mit PDF-Endsaldo übereinstimmen!)

---

## FALLBACK: Bei Fehlschlag

**Falls Re-Import nicht die erwarteten 419.536,88 EUR ergibt:**

→ **Jedes PDF einzeln manuell durchgehen** und Transaktionen einzeln erfassen.

**Aber:** VERIFIED JSONs wurden bereits gegen PDFs geprüft (differenceCents: 0). Problem liegt wahrscheinlich im Import-Script, nicht in den JSONs.

---

## WICHTIGE ÄNDERUNG AM IMPORT-SCRIPT

**Datei:** `scripts/import-hvplus-kontoauszuege-verified.ts`

**Aktuelle Duplikat-Prüfung (Zeilen 138-151):**
```typescript
const existing = await prisma.ledgerEntry.findFirst({
  where: {
    caseId,
    bankAccountId,
    transactionDate: txDate,
    amountCents,
    description: tx.description, // ❌ ZU STRENG: Exakter String-Match
  },
});
```

**Neue Duplikat-Prüfung (Triple-Match):**
```typescript
const existing = await prisma.ledgerEntry.findFirst({
  where: {
    bankAccountId,
    transactionDate: txDate,
    amountCents,
    // ✅ Entferne description-Match, nutze nur Triple
  },
});
```

**Begründung:**
- Datum + Betrag + Konto ist eindeutig genug
- Description-Variationen verursachen Duplikate
- Falls echte Duplikate (zwei 50 EUR am selben Tag): User entscheidet manuell

---

## AUSFÜHRUNGS-SCHRITTE

### 1. Backup (bereits erledigt ✅)
```bash
/tmp/isk-uckerath-backup-vor-cleanup-v2-2026-02-08.db
```

### 2. Import-Script anpassen
- Duplikat-Prüfung auf Triple-Match umstellen
- Description-Match entfernen

### 3. DELETE + RE-IMPORT
```bash
# Lösche alle ISK Uckerath Entries
sqlite3 dev.db "DELETE FROM ledger_entries WHERE bankAccountId = 'ba-isk-uckerath';"

# Re-Import (mit angepasstem Script)
npx tsx scripts/import-hvplus-kontoauszuege-verified.ts \
  --file "ISK_Uckerath_2025-11_VERIFIED.json" \
  --bank-account "ba-isk-uckerath"

npx tsx scripts/import-hvplus-kontoauszuege-verified.ts \
  --file "ISK_uckerath_2025_12_VERIFIED.json" \
  --bank-account "ba-isk-uckerath"

npx tsx scripts/import-hvplus-kontoauszuege-verified.ts \
  --file "ISK_uckerath_2026_01_VERIFIED.json" \
  --bank-account "ba-isk-uckerath"
```

### 4. Verifikation
- Prüfe Anzahl Entries (sollte 345 sein)
- Prüfe Closing Balance (sollte 419.536,88 EUR sein)
- Prüfe auf verbleibende Duplikate (sollte 0 sein)

### 5. Rollback-Plan
```bash
# Falls etwas schief geht:
cp /tmp/isk-uckerath-backup-vor-cleanup-v2-2026-02-08.db \
   /Users/david/Projekte/AI\ Terminal/Inso-Liquiplanung/app/dev.db
```

---

**Erstellt:** 2026-02-08 13:12
**Status:** ⏳ BEREIT ZUR AUSFÜHRUNG
**Risiko:** MITTEL (Vollständige Löschung, aber Backup vorhanden)
**Erwartete Dauer:** 5-10 Minuten

