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

## Funktionale Einschränkungen

### Keine Währungsumrechnung

**Beschreibung:** Alle Beträge sind in EUR. Keine Unterstützung für andere Währungen.

**Begründung:** Deutsche Insolvenzverfahren sind EUR-basiert.

**Workaround:** Externe Umrechnung vor Import.

---

## Daten-Aggregation Einschränkungen

### Kein IST-Vorrang bei parallelen IST/PLAN-Daten

**Beschreibung:** Wenn für dieselbe Periode sowohl IST- als auch PLAN-Buchungen existieren, werden beide summiert. Dies führt zu Überdeckung/Doppelzählung.

**Begründung:** IST-Vorrang-Logik erfordert komplexe Gruppierung und Architektur-Entscheidungen:
- Was definiert "dieselbe Buchung"? (periodIndex + categoryKey + bankAccountId?)
- Wie wird IST-Vorrang transparent dokumentiert?
- Performance-Impact bei großen Datenmengen?

Aktuell zu komplex für Schnellfix → als Feature-Ticket dokumentiert (siehe TODO.md).

**Workaround:** Workflow soll sicherstellen, dass PLAN-Daten gelöscht/deaktiviert werden, wenn IST-Daten importiert werden.

**Status:** TODO für v2.11.0 (siehe `/app/docs/TODO.md`)

---

## Dashboard-Einschränkungen

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

### Prisma Client gibt locationId nicht zurück

**Beschreibung:** Trotz korrektem Schema und Datenmigration liefert Prisma Client `locationId: null` für BankAccounts, obwohl die Datenbank korrekte Werte enthält.

**Symptome:**
```typescript
const accounts = await prisma.bankAccount.findMany({
  include: { location: true }
});
// accounts[0].locationId === null (aber DB zeigt loc-haevg-velbert)
```

**Begründung:** Wahrscheinlich Prisma Client Module-Caching-Problem. Mehrfache `prisma generate` und Cache-Clears hatten keine Wirkung.

**Workaround:**
```typescript
// In /api/cases/[id]/bank-accounts/route.ts
const getLocationByAccountName = (accountName: string) => {
  if (accountName.toLowerCase().includes("velbert")) {
    return { id: "loc-haevg-velbert", name: "Praxis Velbert" };
  }
  if (accountName.toLowerCase().includes("uckerath")) {
    return { id: "loc-haevg-uckerath", name: "Praxis Uckerath" };
  }
  return null;
};
```

**Zukünftig:** Bei nächstem Prisma-Major-Update erneut testen. Issue bei Prisma melden.

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

## Template für neue Einschränkungen

```markdown
### [Kurztitel]

**Beschreibung:** [Was ist eingeschränkt?]

**Begründung:** [Warum ist das so?]

**Workaround:** [Wie kann man damit umgehen?]

**Zukünftig:** [Geplante Änderungen?]
```
