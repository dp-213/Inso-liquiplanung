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

### Keine Duplikat-Erkennung

**Beschreibung:** Wiederholter Import derselben Datei erstellt Duplikate.

**Begründung:** Nicht implementiert in aktueller Version.

**Zukünftig:** Hash-basierte Duplikat-Prüfung geplant.

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

## Bekannte Bugs

*Derzeit keine bekannten Bugs.*

---

## Template für neue Einschränkungen

```markdown
### [Kurztitel]

**Beschreibung:** [Was ist eingeschränkt?]

**Begründung:** [Warum ist das so?]

**Workaround:** [Wie kann man damit umgehen?]

**Zukünftig:** [Geplante Änderungen?]
```
