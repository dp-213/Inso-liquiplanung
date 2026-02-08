# Import-Pipeline Analyse - ISK Uckerath Duplikate

**Datum:** 2026-02-08  
**Analysiert:** Import-Mechanismus der VERIFIED.json Dateien

---

## Verwendetes Import-Script

**Datei:** `app/scripts/import-hvplus-kontoauszuege-verified.ts`

**Funktion:**
- Importiert alle `*_VERIFIED.json` Dateien aus `/Cases/Hausärztliche Versorgung PLUS eG/02-extracted/`
- Erstellt LedgerEntries direkt via Prisma (NICHT über Intake API oder Ingestion Pipeline)
- Hat rudimentären Duplikat-Schutz auf Transaktions-Ebene

**Ausführungsbefehl:**
```bash
cd app && npx tsx scripts/import-hvplus-kontoauszuege-verified.ts
```

---

## Duplikat-Schutz im Script (Zeilen 138-151)

```typescript
// Check for duplicates
const existing = await prisma.ledgerEntry.findFirst({
  where: {
    caseId,
    bankAccountId,
    transactionDate: txDate,
    amountCents,
    description: tx.description, // ← KRITISCH: Exakter String-Match
  },
});

if (existing) {
  skipped++;
  continue;
}
```

**Logik:**  
Prüft ob eine LedgerEntry mit **exakt identischen** Werten existiert:
- Gleiches Datum
- Gleicher Betrag
- Gleiche Beschreibung (Zeichen-genau!)

**Schwächen:**
1. ❌ Keine Prüfung ob die **Datei** schon importiert wurde
2. ❌ Keine `importJobId` oder `importFileHash` Tracking
3. ❌ Beschreibungs-Unterschiede führen zu False Negatives
4. ❌ Kein File-Level Duplikat-Schutz

---

## Root Cause: Warum der Duplikat-Check versagt hat

### 1. Zwei Versionen derselben Daten im Ordner

```
/02-extracted/
  ISK_Uckerath_2025-11_VERIFIED.json   ← Version 1 (Großschreibung, Bindestrich)
  ISK_uckerath_2025_11_VERIFIED.json   ← Version 2 (Kleinschreibung, Underscore)
  
  ISK_Uckerath_2025-12_VERIFIED.json   ← Version 1
  ISK_uckerath_2025_12_VERIFIED.json   ← Version 2
  
  ISK_Uckerath_2026-01_VERIFIED.json   ← Version 1
  ISK_uckerath_2026_01_VERIFIED.json   ← Version 2
```

### 2. Unterschiedliche Beschreibungen trotz gleicher Buchung

**Beispiel: Buchung vom 13.11.2025, 345,00 EUR**

**Version 1 (ISK_Uckerath_2025-11_VERIFIED.json):**
```json
{
  "date": "2025-11-13",
  "amount": 345.00,
  "description": "GUTSCHRIFT ÜBERWEISUNG HAEVGID 132064 LANR 4652451 SPECTRUMK HZV ABS. Q4/25-1 E2E:132064"
}
```

**Version 2 (ISK_uckerath_2025_11_VERIFIED.json):**
```json
{
  "date": "2025-11-13",
  "amount": 345.00,
  "description": "HAEVGID 132064 LANR 4652451 SPECTRUMK HZV ABS. Q4/25-1 E2E:132064 HAVG Hausarztliche Vertragsgemeinschaft Aktiengesellschaft"
}
```

**Unterschiede:**
- Version 1: Präfix "GUTSCHRIFT ÜBERWEISUNG"
- Version 2: Suffix mit vollem Namen der Gegenpartei

→ **String-Match schlägt fehl** → Duplikat wird nicht erkannt

### 3. Script wurde mit beiden Versionen im Ordner ausgeführt

**Was passierte:**
1. Script läuft: `fs.readdirSync(EXTRACTED_DIR).filter((f) => f.endsWith('_VERIFIED.json'))`
2. Findet **beide** Versionen (ISK_Uckerath UND ISK_uckerath)
3. Importiert Version 1: 340 Entries erstellt
4. Importiert Version 2: Duplikat-Check findet nichts (wegen unterschiedlicher Beschreibungen)
5. Weitere 318 Entries erstellt
6. **Ergebnis:** 658 Entries in DB, 329 sind Duplikate

---

## Warum nur ISK Uckerath betroffen?

**Analyse aller Konten im /02-extracted/ Ordner:**

| Konto | VERIFIED Dateien | Duplikate? |
|-------|------------------|------------|
| ISK Uckerath | 6 (3 Großschreibung + 3 Kleinschreibung) | ✅ JA |
| ISK Velbert | 3 (2 Großschreibung + 1 Kleinschreibung) | ❌ NEIN |
| Sparkasse Velbert | 3 (nur Großschreibung) | ❌ NEIN |
| apoBank Uckerath | 3 (nur Großschreibung) | ❌ NEIN |
| apoBank HV PLUS | 3 (nur Großschreibung) | ❌ NEIN |

**ISK Velbert:**
- Hat auch eine Kleinschreibungs-Datei: `ISK_velbert_2026_01_VERIFIED.json`
- ABER: Nur 1 Buchung in dieser Datei, die **nicht** in den anderen Dateien vorkommt
- Vermutlich: Nachträglicher Import einer fehlenden Buchung
- **Keine Duplikate** (bestätigt durch DB-Analyse)

**Andere Konten:**
- Hatten konsistente Dateinamen-Konvention
- Nur Großschreibung mit Bindestrichen
- Keine doppelten Versionen im Ordner

---

## Fehlende Sicherheitsmechanismen

### 1. Kein ingestion_jobs Tracking

**Problem:**  
Das Script erstellt KEINE `ingestion_jobs` Einträge.

```typescript
// ❌ FEHLT im Script:
const job = await prisma.ingestionJob.create({
  data: {
    caseId,
    fileName: fileName,
    fileHashSha256: calculateHash(filePath),
    status: 'PROCESSING',
  },
});
```

**Konsequenz:**
- Keine Übersicht welche Dateien bereits importiert wurden
- Kein File-Hash-Check vor Import
- Kein Rollback-Mechanismus

### 2. Kein File-Hash in LedgerEntries

```typescript
// Aktuell (Zeile 182):
importSource: fileName,  // Nur Dateiname

// ❌ FEHLT:
importJobId: job.id,
importFileHash: job.fileHashSha256,
```

**Konsequenz:**
- Kann nicht identifizieren, aus welchem konkreten Import eine Entry stammt
- Kann nicht alle Entries eines fehlerhaften Imports löschen

### 3. Keine Pre-Import-Validierung

**Was fehlt:**
```typescript
// FEHLT: Prüfung ob Datei bereits importiert
const alreadyImported = await prisma.ledgerEntry.findFirst({
  where: {
    caseId,
    importSource: fileName,
  },
});

if (alreadyImported) {
  console.log(`⚠️ File ${fileName} already imported, skipping`);
  return { imported: 0, skipped: 0 };
}
```

---

## Vergleich: Offizielle Ingestion Pipeline vs. Import-Script

| Feature | Ingestion Pipeline (`/api/ingestion/[jobId]/commit`) | Import-Script | Intake API (`/api/cases/[id]/intake`) |
|---------|------------------------------------------------------|---------------|---------------------------------------|
| **ingestion_jobs Tracking** | ✅ Ja | ❌ Nein | ❌ Nein |
| **importJobId in LedgerEntry** | ✅ Ja | ❌ Nein | ❌ Nein |
| **importFileHash in LedgerEntry** | ✅ Ja | ❌ Nein | ❌ Nein |
| **Duplikat-Schutz** | ✅ File-Level + Transaction-Level | ⚠️ Nur Transaction-Level (fehlerhaft) | ❌ Keiner |
| **Status-Management** | ✅ Ja (READY → COMMITTED) | ❌ Nein | ❌ Nein |
| **Rollback möglich** | ✅ Ja (über jobId) | ❌ Nein | ❌ Nein |
| **Classification Engine** | ⚠️ Manuell danach | ⚠️ Manuell danach | ✅ Automatisch |
| **Audit Trail** | ✅ Partial | ❌ Minimal | ✅ Ja |

---

## Empfehlungen

### Sofort (für HVPlus Case)

1. **Bereinigung durchführen** (nach User-Freigabe)
   - Lösche 318 Entries aus Kleinschreibungs-Versionen
   - SQL-Statement in `DATA_QUALITY_INCIDENT_2026-02-08.md`

2. **Dateien im /02-extracted/ aufräumen**
   - Lösche Kleinschreibungs-Versionen (oder verschiebe in /archive/)
   - Verhindert erneuten Import bei Script-Ausführung

### Kurzfristig (diese Woche)

3. **Import-Script verbessern:**
   ```typescript
   // File-Level Duplikat-Check hinzufügen
   const alreadyImported = await checkIfFileAlreadyImported(fileName, caseId);
   
   // Fuzzy-Match für Beschreibungen
   const similarExists = await findSimilarTransaction(date, amount, description);
   
   // ingestion_jobs Tracking hinzufügen
   const job = await createIngestionJob(fileName, fileHash);
   ```

4. **Documentation aktualisieren:**
   - `LIMITATIONS.md`: Warnung vor doppelten Importen
   - `DECISIONS.md`: ADR für Import-Pipeline-Verbesserungen

### Mittelfristig (nächste 2 Wochen)

5. **Unified Import Pipeline aufbauen:**
   - Alle Imports laufen über `/api/ingestion/` Route
   - Mandatory `ingestion_jobs` Tracking
   - File-Hash-Check VOR Import
   - Transaction-Level Fuzzy-Matching

6. **Migration bestehender Scripts:**
   - `import-hvplus-kontoauszuege-verified.ts` → nutzt Ingestion API
   - Alle anderen Import-Scripts migrieren

7. **Monitoring & Alerts:**
   - Dashboard für Import-Jobs
   - Alert bei Duplikat-Verdacht
   - Automatische PDF-Verifikation nach Import

---

## Timeline: Wie die Duplikate entstanden

```
Zeitpunkt unbekannt (vermutlich Januar 2026):
  │
  ├─ User extrahiert ISK Uckerath PDFs → JSON
  │  Ergebnis: ISK_Uckerath_2025-11_VERIFIED.json (Version 1)
  │
  ├─ User führt import-Script aus
  │  → 340 Entries importiert
  │
  ├─ User extrahiert ISK Uckerath PDFs ERNEUT (andere Extraktion?)
  │  Ergebnis: ISK_uckerath_2025_11_VERIFIED.json (Version 2, andere Formatierung)
  │
  ├─ Beide Dateien liegen jetzt im /02-extracted/ Ordner
  │
  ├─ User führt import-Script ERNEUT aus (oder zum ersten Mal mit beiden Versionen?)
  │  → Script findet beide Dateien
  │  → Importiert Version 1: Duplikat-Check greift (schon drin)
  │  → Importiert Version 2: Duplikat-Check schlägt fehl (andere Beschreibung)
  │  → 318 weitere Entries erstellt
  │
  └─ Ergebnis: 658 Entries in DB, davon 329 Duplikate
```

---

**Erstellt:** 2026-02-08  
**Autor:** Claude (Import-Pipeline-Analyse)  
**Status:** Komplett - Bereit für /doku Integration
