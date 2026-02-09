# Bekannte Einschränkungen

Dieses Dokument listet bekannte Einschränkungen und bewusste Nicht-Implementierungen.

---

## Architektur-Einschränkungen

### Keine Echtzeit-Synchronisation

**Beschreibung:** Änderungen werden nicht in Echtzeit zwischen Browsern synchronisiert.

**Begründung:** Komplexität vs. Nutzen. Insolvenzverwalter arbeiten typischerweise nicht gleichzeitig am selben Fall.

**Workaround:** Browser-Refresh lädt aktuelle Daten.

---

### Kein Offline-Modus

**Beschreibung:** Die Anwendung funktioniert nur mit Internetverbindung.

**Begründung:** Datenkonsistenz. Offline-Änderungen könnten zu Konflikten führen.

**Workaround:** PDF-Export für Offline-Ansicht.

---

### Keine Multi-Tenancy auf DB-Ebene

**Beschreibung:** Alle Kunden teilen eine Datenbank. Trennung erfolgt nur per `caseId`/`customerId`.

**Begründung:** Einfachheit in der aktuellen Phase. Für große Deployments könnte Schema-per-Tenant nötig werden.

**Workaround:** Row-Level-Security durch Anwendungslogik.

---

## Entwicklungs-Einschränkungen

### Localhost Dev-Server instabil bei parallelen Prozessen

**Beschreibung:** Wenn mehrere `npm run dev` Prozesse gleichzeitig laufen (z.B. nach mehrfachem Start ohne Stop), zeigt Localhost "Internal Server Error" und rendert nur 22 bytes HTML statt vollständige Seiten.

**Begründung:** Next.js Dev-Server verwaltet Ports und Build-Cache - mehrere Instanzen interferieren miteinander.

**Workaround:**
```bash
# Alle Next.js Prozesse killen
pkill -f "next dev"
# Dev-Server neu starten
cd app && npm run dev
```

**Monitoring:** `ps aux | grep "next dev"` zeigt alle laufenden Instanzen.

---

### Analyse-Scripts dürfen nicht in /app liegen

**Beschreibung:** TypeScript-Dateien im `/app`-Root-Verzeichnis werden bei `npm run build` mit-kompiliert und können Build-Fehler verursachen (z.B. fehlende Dependencies wie `better-sqlite3`).

**Begründung:** Next.js kompiliert ALLE `.ts/.tsx` Dateien im `/app`-Verzeichnis, auch wenn sie nicht Teil der Anwendung sind.

**Workaround:** Alle Utility-/Analyse-Scripts im **Repository-Root** (eine Ebene höher) ablegen:
- ✅ `/analyze-hzv-payment-logic.ts` (OK)
- ❌ `/app/analyze-hzv-payment-logic.ts` (FEHLER beim Build)

**Betroffene Scripts:** `analyze-*.ts`, `verify-*.ts`, `sync-to-turso.ts`, `cleanup-*.ts`, etc.

---

## Funktionale Einschränkungen

### Januar-HZV-Klassifikation basiert auf Annahme

**Beschreibung:** 58 HZV-Gutschriften im Januar 2026 ohne Quartalsangabe wurden als Q4/2025-Abschläge klassifiziert.

**Begründung:** Zahlungslogik-Analyse deutet auf Fortsetzung der November Q4/25-Abschläge hin (identisches Muster: 57 vs. 58 Entries, gleiche Krankenkassen, alle "HZV ABS").

**Einschränkung:** Diese Klassifikation ist **annahme-basiert** und erfordert Verifikation mit Insolvenzverwalter.

**Workaround:** Falls Annahme falsch, kann Service-Period korrigiert und Split-Engine neu ausgeführt werden.

**Status:** Verifikation mit Hannes Rieger ausstehend (09.02.2026)

**Betroffene Daten:** 58 von 292 HZV-Entries (19.7%), Summe 63.112,50 EUR

**Dokumentiert in:** ADR-027 (DECISIONS.md), IV-Notiz auf Admin-Seite

---

### Keine Währungsumrechnung

**Beschreibung:** Alle Beträge sind in EUR. Keine Unterstützung für andere Währungen.

**Begründung:** Deutsche Insolvenzverfahren sind EUR-basiert.

**Workaround:** Externe Umrechnung vor Import.

---

### Classification Engine filtert nach reviewStatus

**Beschreibung:** `matchCounterpartyPatterns()` matched standardmäßig nur Entries mit `reviewStatus = 'UNREVIEWED'`. Bereits bestätigte Entries (`CONFIRMED`) werden übersprungen.

**Begründung:** Verhindert ungewolltes Überschreiben manuell bestätigter Klassifikationen.

**Workaround:** Explizite Entry-IDs übergeben, um Filter zu umgehen:
```typescript
const entryIds = entries.map(e => e.id);
await matchCounterpartyPatterns(prisma, caseId, entryIds);
```

---

### Privatpatienten-Rechnungen ohne einheitliches Format

**Beschreibung:** ~60 Privatpatienten-Rechnungen haben sehr unterschiedliche Formate ("RE .70", "RN-NR 45", "Rechnung: 46349", "Todesbescheinigung 46333"). Ein einziges Pattern würde zu viele False Positives erzeugen.

**Begründung:** Medizinische Abrechnungen folgen keinem Standard-Format (jede Praxis/Arzt hat eigenes System).

**Workaround:**
- Sammel-Counterparty "Privatpatient*innen" für häufigste Formate
- Verbleibende Einträge manuell klassifizieren oder als "Sonstige Privateinnahmen" gruppieren

---

### Sammelüberweisungen ohne Einzelaufschlüsselung

**Beschreibung:** 29 Sammelüberweisungen (179K EUR) haben keine Details zu Empfängern/Zwecken im Verwendungszweck.

**Begründung:** Banken zeigen bei Sammelzahlungen nur Gesamtbetrag, keine Einzelpositionen.

**Workaround:**
- Counterparty "Sammelüberweisung (nicht zugeordnet)" erstellt
- Details müssen von IV/Buchhalterin nachgeliefert werden (siehe case-context.json offeneDatenanforderungen)

---

## Daten-Aggregation Einschränkungen

### Kein IST-Vorrang bei parallelen IST/PLAN-Daten (GELÖST)

**Beschreibung:** Wenn für dieselbe Periode sowohl IST- als auch PLAN-Buchungen existierten, wurden beide summiert. Dies führte zu Überdeckung/Doppelzählung.

**Status:** ✅ GELÖST am 08.02.2026

**Lösung:** IST-Vorrang in `aggregateLedgerEntries()` implementiert:
- Entries werden nach Periode gruppiert
- Für Perioden mit IST-Daten werden PLAN-Entries ignoriert
- Für Perioden ohne IST-Daten werden PLAN-Entries verwendet

---

## Frontend-Einschränkungen (Temporär)

### Planung-Seite noch nicht migriert

**Beschreibung:** `/admin/cases/[id]/planung` zeigt "Feature wird migriert" Placeholder

**Begründung:** Alte Seite erwartete komplexe JSON-Struktur aus lokalem File-System. API liefert bereits PLAN-Daten aus Datenbank (`LedgerEntry.valueType=PLAN`), aber Frontend-Darstellung muss noch angepasst werden.

**Workaround:** PLAN-Entries über `/admin/cases/[id]/ledger` einsehbar und editierbar

**Status:** ⏳ Geplant für v2.15.0

---

### Finanzierung-Seite nicht implementiert

**Beschreibung:** `/admin/cases/[id]/finanzierung` zeigt "Feature folgt" Placeholder

**Begründung:** Massekreditvertrag und Darlehens-Details noch nicht in Datenbank importiert. Feature wurde bisher über lokale JSON-Files realisiert.

**Workaround:** Manuelle Pflege in `case-context.json` und Massekredit-Seite

**Status:** ⏳ Geplant für v2.16.0

---

### Zahlungsverifikation-Seite nicht implementiert

**Beschreibung:** `/admin/cases/[id]/zahlungsverifikation` zeigt "Feature folgt" Placeholder

**Begründung:** SOLL vs. IST Vergleich (erwartete vs. tatsächliche Zahlungen) noch nicht implementiert. Feature wurde bisher über manuelle JSON-Analyse realisiert.

**Workaround:** Manuelle Analyse über Ledger-Ansicht und Excel-Export

**Status:** ⏳ Geplant für v2.17.0
- Logging: `[IST-Vorrang] X PLAN-Einträge ignoriert`

**Ergebnis (HVPlus Case):**
- 21 PLAN-Einträge korrekt verdrängt (Dez 2025 + Jan 2026)
- Net Cashflow korrigiert: 502.742 EUR (vorher: 874.129 EUR)
- Differenz: -327K EUR Überdeckung eliminiert

---

## Dashboard-Einschränkungen

### Webpack Build-Cache-Korruption

**Beschreibung:** Nach npm/Prisma-Operationen kann der `.next` Build-Cache korrupt werden, was zu "Cannot find module './XXXX.js'" Fehlern führt.

**Begründung:** Webpack-Cache-Invalidierung funktioniert nicht immer zuverlässig bei Schema-Änderungen.

**Workaround:**
```bash
rm -rf .next node_modules/.cache
npm install
npm run dev
```

**Häufigkeit:** Selten, hauptsächlich nach `npx prisma generate` oder größeren Dependency-Updates.

---

### Eingeschränkte Standort-Ansicht

**Beschreibung:** Bei Scope ≠ GLOBAL (z.B. "Velbert") werden Revenue- und Banks-Tabs ausgeblendet.

**Begründung:** Diese Tabs unterstützen aktuell keinen Scope-Filter und würden inkonsistente (globale) Zahlen zeigen.

**Workaround:**
- Für Standort-Analyse: Liquiditätsmatrix + Rolling Forecast nutzen
- Für Revenue/Banks: Scope auf GLOBAL setzen

**Status:** Quick-Fix implementiert, proper Scope-Support geplant (siehe `/app/docs/TODO.md`)

---

### Keine Prognosen/Forecasts

**Beschreibung:** Keine automatische Extrapolation oder Trendberechnung.

**Begründung:** Determinismus-Prinzip. Prognosen wären spekulativ und nicht gerichtsfest.

**Workaround:** Manuelle PLAN-Werte für zukünftige Perioden.

---

### IST-Vorrang ist nicht umkehrbar

**Beschreibung:** Wenn IST-Daten für eine Periode existieren, werden PLAN-Daten in der Liquiditätstabelle automatisch ignoriert. Dies kann nicht deaktiviert werden.

**Begründung:** Bankbewegungen sind Realität. Planung ist nur noch historisch relevant, sobald echte Daten vorliegen.

**Workaround:**
- IST/PLAN-Vergleichs-Tab zeigt beide Werte nebeneinander
- PLAN-Daten werden NICHT gelöscht, nur nicht mehr in Hauptansicht angezeigt
- Bei Bedarf: PLAN-Entries filtern und einzeln prüfen

---

### Kein automatisches PLAN-Löschen bei IST-Import

**Beschreibung:** Beim Import von IST-Daten werden existierende PLAN-Einträge nicht automatisch entfernt oder archiviert.

**Begründung:** Bewusste Entscheidung. PLAN-Daten bleiben für Vergleich und Audit erhalten.

**Workaround:**
- IST-Vorrang-Logik ignoriert PLAN automatisch in Hauptansichten
- Bei Bedarf: Manuelle Bereinigung über Ledger-Filter

---

### Fester 13-Wochen-Horizont

**Beschreibung:** Standard-Liquiditätsplan hat 13 Wochen. Monatsplanung ist optional.

**Begründung:** Branchenstandard für Insolvenzverfahren.

**Workaround:** `periodType = MONTHLY` für längere Zeiträume.

---

### Keine Teilbeträge bei Dimensionen

**Beschreibung:** Ein LedgerEntry kann nur einer Gegenpartei/einem Bankkonto zugeordnet werden.

**Begründung:** Komplexität. Aufteilung würde Aggregation verkomplizieren.

**Workaround:** Separate Entries für verschiedene Dimensionen.

---

## Import-Einschränkungen

### Keine automatische Bankformat-Erkennung

**Beschreibung:** User muss Spalten-Mapping manuell konfigurieren.

**Begründung:** Bankformate sind zu heterogen für zuverlässige Auto-Detection.

**Workaround:** Mapping-Templates für häufige Formate.

---

### Gemischte Datenbank-Zeitstempel (dev.db) - GELÖST

**Beschreibung:** Die lokale SQLite-Datenbank `dev.db` enthielt Entries aus mehreren Import-Runden (verschiedene `createdAt` Zeitstempel).

**Status:** ✅ **GELÖST am 08.02.2026**

**Lösung:**
- Prisma-Daten (691 IST-Entries) als Single Source of Truth bestätigt
- 100% Verifikation gegen PDF-Kontoauszüge durchgeführt
- Turso-Sync-Strategie definiert (ADR-025): PLAN behalten, IST ersetzen

**Verifizierung:**
- Alle 691 Entries gegen 9 PDF-Kontoauszüge abgeglichen
- Alle Kontosalden Euro-genau korrekt
- Alle Entry-Counts stimmen überein

**Workflow für Zukunft:**
- Bei Re-Import: Alte IST-Daten vorher löschen (DELETE WHERE valueType='IST')
- PLAN-Daten immer behalten
- Ingestion-Pipeline mit Duplikat-Prävention (geplant)

---

### Schwache Duplikat-Erkennung im Import-Script

**Beschreibung:** Import-Script erkennt nur exakt identische Beschreibungen. Variationen führen zu Duplikaten.

**Root Cause:** Das Script `import-hvplus-kontoauszuege-verified.ts` prüft nur auf exakte String-Übereinstimmung bei `description`. Wenn zwei JSON-Dateien dieselbe Transaktion mit leicht unterschiedlichen Beschreibungen enthalten, werden beide importiert.

**Beispiel (ISK Uckerath 2026-02-08):**
- Version 1: "GUTSCHRIFT ÜBERWEISUNG HAEVGID 132064..."
- Version 2: "HAEVGID 132064... HAVG Hausarztliche Vertragsgemeinschaft..."
- String-Mismatch → beide importiert → 355 Duplikate

**Workaround:**
- Vor Import: Prüfe, ob JSON bereits importiert wurde (über `ingestion_jobs` Tracking)
- Nach Import: Manuelle Duplikat-Analyse über `GROUP BY transactionDate, amountCents`
- Bereinigung: SQL DELETE mit Backup

**Zukünftig:**
- Robuste Duplikat-Prüfung über `(bankAccountId + transactionDate + amountCents)` statt nur Description
- File-Hash-Tracking in `ingestion_jobs` Tabelle
- Offizielle Ingestion-Pipeline für alle Importe (statt Ad-hoc-Scripts)

---

### Maximale Dateigröße

**Beschreibung:** Import-Dateien sind auf ~10MB begrenzt (Vercel-Limit).

**Begründung:** Serverless-Timeout und Memory-Limits.

**Workaround:** Große Dateien aufteilen.

---

## UI-Einschränkungen

### Keine Drag-and-Drop Sortierung

**Beschreibung:** Kategorien und Zeilen können nicht per Drag-and-Drop sortiert werden.

**Begründung:** Nicht priorisiert.

**Workaround:** `displayOrder`-Feld manuell setzen.

---

### Keine Keyboard-Shortcuts

**Beschreibung:** Keine Tastaturkürzel für häufige Aktionen.

**Begründung:** Nicht priorisiert.

**Zukünftig:** Bei Bedarf implementieren.

---

### Kein Dark Mode

**Beschreibung:** Nur Light-Theme verfügbar.

**Begründung:** Nicht priorisiert für B2B-Anwendung.

---

## Sicherheits-Einschränkungen

### Keine 2FA

**Beschreibung:** Keine Zwei-Faktor-Authentifizierung.

**Begründung:** Nicht implementiert in aktueller Version.

**Zukünftig:** Bei erhöhten Sicherheitsanforderungen implementieren.

---

### Keine Passwort-Komplexitätsregeln

**Beschreibung:** Keine Mindestanforderungen an Passwort-Stärke.

**Begründung:** Admin generiert Passwörter, User können nicht ändern.

**Zukünftig:** Bei Self-Service-Passwortänderung implementieren.

---

## Performance-Einschränkungen

### Große Ledger-Ansichten

**Beschreibung:** Bei >1000 Entries kann die Ledger-Ansicht langsam werden.

**Begründung:** Pagination mit 100er-Blöcken, aber UI-Rendering kann stocken.

**Workaround:** Filter verwenden, um Datenmenge zu reduzieren.

---

### Aggregations-Cache

**Beschreibung:** Aggregationen werden bei jeder Änderung als "stale" markiert und neu berechnet.

**Begründung:** Einfachheit. Inkrementelle Updates wären komplexer.

**Zukünftig:** Optimierung bei Performance-Problemen.

---

## Daten-Integrität

### Fehlende Dezember 2025 Kontoauszüge (HVPlus Fall)

**Beschreibung:** 3 von 5 Bankkonten haben KEINE Dezember-Kontoauszüge.

**Betroffene Konten:**
1. **apoBank HV PLUS eG:** Nov → (Lücke) → Jan (+299K EUR Diskrepanz)
2. **apoBank Uckerath:** Nov → (Lücke) → Jan (+33,7K EUR Diskrepanz)
3. **Sparkasse Velbert:** Nov → (Lücke) → Jan (-81,3K EUR Diskrepanz)

**Konsequenz:**
- **Closing Balances "Ende Januar" sind NICHT BELEGT** für diese 3 Konten
- Über 250K EUR Bewegungen im Dezember NICHT nachvollziehbar
- Liquiditätsplanung für Dez/Jan unvollständig

**Letzte belegte Stände:**
- apoBank HV PLUS eG: -289.603,72 EUR (30.11.2025)
- apoBank Uckerath: 742,15 EUR (30.11.2025)
- Sparkasse Velbert: 60.113,62 EUR (30.11.2025)

**Workaround:**
- IV muss Dezember-Kontoauszüge nachliefern
- Falls Konten geschlossen: Schließungsbestätigungen der Banken einholen

**Status:** ⏳ Offene Datenanforderung an IV (siehe `IV_FRAGELISTE_DEZEMBER_KONTOAUSZUEGE.md`)

---

## Bekannte Bugs

### LANR → Location Mapping fehlerhaft (HVPlus Fall)

**Beschreibung:** 4 von 8 Ärzten werden der falschen Location zugeordnet. Alle Velbert-Ärzte (van Suntum, Beyer, Kamler) und der Eitorf-Arzt (Rösing) werden fälschlicherweise zu "Praxis Uckerath" zugeordnet.

**Betroffene LANRs:**
- LANR 3892462 (van Suntum) → SOLL: Velbert, IST: Uckerath ❌
- LANR 8836735 (Beyer) → SOLL: Velbert, IST: Uckerath ❌
- LANR 7729639 (Kamler) → SOLL: Velbert, IST: Uckerath ❌
- LANR 8898288 (Rösing) → SOLL: Eitorf, IST: Uckerath ❌

**Impact:**
- ~50% der HZV-Einnahmen werden falschem Standort zugeordnet
- Standort-basierte Liquiditätsplanung zeigt falsche Zahlen
- Velbert erscheint zu niedrig, Uckerath zu hoch, Eitorf fehlt komplett

**Root Cause:** Classification Rules oder LANR-Mapping-Logik hat vermutlich Fallback zu "Praxis Uckerath" für nicht-gematchte LANRs.

**Workaround:**
- Manuelle Korrektur via SQL UPDATE (nach Freigabe)
- Classification Rules für diese 4 LANRs explizit anlegen

**Status:** ⚠️ **KRITISCH** – Muss VOR Turso-Sync korrigiert werden!

**Gefunden:** 08.02.2026 bei Zuordnungsprüfung
**Verifiziert:** 08.02.2026 bei PDF-Abgleich (691 Entries betroffen)

---

### Prisma Client gibt locationId nicht zurück (GELÖST)

**Beschreibung:** Trotz korrektem Schema und Datenmigration lieferte Prisma Client `locationId: null` für BankAccounts, obwohl die Datenbank korrekte Werte enthielt.

**Status:** ✅ GELÖST am 08.02.2026

**Lösung:** Workaround entfernt, API nutzt jetzt echte DB-Relation `acc.location` aus Prisma-Include.
```typescript
// Vorher: Workaround mit Name-Matching
const getLocationByAccountName = (accountName: string) => { ... }

// Nachher: Echte DB-Relation
const accounts = await prisma.bankAccount.findMany({
  include: { location: { select: { id: true, name: true } } }
});
// accounts[0].location funktioniert korrekt
```

**Root Cause:** Unbekannt. Vermutlich Prisma Client Cache-Problem, das sich nach mehreren `prisma generate` + Rebuilds von selbst behoben hat.

---

### Bank-spezifische Zeilen in Liquiditätsmatrix zeigen 0 €

**Beschreibung:** Die Zeilen "Sparkasse Velbert" und "apoBank" in der Liquiditätstabelle (Block: Opening/Closing Balance) zeigen 0 € statt der tatsächlichen Kontostände.

**Root Cause:** `calculateBankAccountBalances()` wird aufgerufen und liefert korrekte Werte, aber die Ergebnisse werden nicht in die individuellen Bank-Zeilen von `rowAggregations` verteilt.

**Location:** `/api/cases/[id]/dashboard/liquidity-matrix/route.ts:424-445`

**Betroffene Zeilen:**
- `opening_balance_sparkasse` (ID: sparkasse)
- `opening_balance_apobank` (ID: apobank)
- `closing_balance_sparkasse`
- `closing_balance_apobank`

**Begründung:** `rowAggregations` wird nur mit LedgerEntries befüllt. Bank-Balances aus `calculateBankAccountBalances()` werden nie in die Bank-spezifischen Zeilen kopiert.

**Workaround:** Nutze den neuen "Bankkonten"-Tab im Dashboard für detaillierte Kontostände.

**Zukünftig:** Verteile `bankBalances.balances` Map auf die entsprechenden `rowAggregations[bankRowId]`-Zeilen.

**TODO-Kommentar im Code:**
```typescript
// TODO: KRITISCH - Populate Bank-spezifische Opening/Closing Balance Zeilen
// Die Zeilen "Sparkasse Velbert" und "apoBank" müssen mit den echten Kontoständen befüllt werden
```

**Priorität:** KRITISCH – IV benötigt diese Information für Massekredit-Tracking

---

### categoryTags fehlen nach manuellem Import

**Beschreibung:** Nach Import von 691 IST-Entries (HVPlus, Feb 2026) haben ALLE Entries `categoryTag = NULL`. Liqui-Matrix zeigt deshalb 0 für Altforderungen, obwohl 184.963,96 EUR ALTMASSE-Daten vorhanden sind.

**Begründung:** Classification Engine wurde nie ausgeführt. Beim "manuellen" Import (Code im Sparring) wurde nur Import durchgeführt, aber Classification vergessen.

**Das System:** Classification Engine + Bulk-Review API sind vorhanden und funktionieren. Sie wurden nur nicht getriggert.

**Workaround:** Nachträgliche Klassifikation über:
1. Classification Engine auf alle Entries anwenden
2. Bulk-Review mit Preview
3. Accept → categoryTags übernehmen
4. Audit-Trail vollständig dokumentieren

**Zukünftig:** **PFLICHT-REGEL eingeführt (ADR-028):**
- Import OHNE Classification ist unvollständig
- Classification MUSS bei jedem Import erfolgen (egal wie: Engine, Code, Excel)
- Alle Klassifikationen MÜSSEN nachvollziehbar sein (Audit-Trail)

**Status:** ⚠️ Wird aktuell für HVPlus nachgeholt (Interactive Review)

**Priorität:** KRITISCH – Ohne categoryTags ist Liqui-Matrix nicht nutzbar

---

## Template für neue Einschränkungen

```markdown
### [Kurztitel]

**Beschreibung:** [Was ist eingeschränkt?]

**Begründung:** [Warum ist das so?]

**Workaround:** [Wie kann man damit umgehen?]

**Zukünftig:** [Geplante Änderungen?]
```
