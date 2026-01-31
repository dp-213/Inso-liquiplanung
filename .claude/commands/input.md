---
description: Case-Daten verarbeiten und strukturieren
---

# /input – Case Intake starten

Startet den 3-Rollen-Workflow für Case-Daten.

## Cases-Verzeichnis

`/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases/`

## Workflow

```
/input [Case-Name]
    ↓
ROLLE 1: Intake-Analyst
    - Dateien lesen (Excel/PDF)
    - JSONs extrahieren
    - Klassifizieren
    - open-questions.md + consistency-report.md generieren
    ↓
ROLLE 2: Sparring-Partner
    - Einschätzung zu offenen Fragen
    - Diskussion im Chat
    ↓
User sagt "approved" / "sehe ich auch so"
    ↓
ROLLE 3: Staging-Builder
    - import-summary.md generieren
```

## Ablauf

### 1. Fall identifizieren

```bash
ls -la "/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases/"
```

- Ein Fall → Automatisch verwenden
- Mehrere Fälle → User fragen
- Kein Fall → Hinweis geben

### 2. Rolle 1 ausführen (Intake-Analyst)

1. Rohdaten finden (`/01-raw/` oder `/Input Daten/`)
2. Excel mit Python/openpyxl extrahieren
3. PDFs direkt lesen
4. JSONs in `/02-extracted/` speichern
5. In `/03-classified/` einsortieren
6. `case-context.json` erstellen/aktualisieren
7. Review-Dokumente generieren:
   - `/06-review/open-questions.md`
   - `/06-review/consistency-report.md`

### 3. Rolle 2 starten (Sparring-Partner)

Nach Intake automatisch in Diskussionsmodus wechseln:
- Offene Fragen präsentieren
- Einschätzung pro Frage geben
- Auf User-Input warten

### 4. Rolle 3 triggern (Staging-Builder)

Nur bei explizitem Signal:
- "approved"
- "sehe ich auch so"
- "passt so"
- "einverstanden"

Dann: `/06-review/import-summary.md` generieren

## Wichtig

- **Kein Subagent** – Claude führt alle Rollen selbst aus
- **Keine DB-Imports** – Nur Dokumentation
- **User entscheidet** – Claude empfiehlt nur

## Klassifikations-Regeln

### valueType (KRITISCH!)

Jede Buchung MUSS einen `valueType` haben:

| Datenquelle | valueType | Beispiele |
|-------------|-----------|-----------|
| **Kontoauszug** | `IST` | Bankbewegungen, reale Zahlungen |
| **Kassenexport** | `IST` | Tatsächliche Barein-/ausgaben |
| **Planung/Budget** | `PLAN` | Erwartete Zahlungen, Prognosen |
| **Hochrechnung** | `PLAN` | Geschätzte zukünftige Werte |

**WICHTIG: IST-Vorrang!**
- Wenn IST-Daten für eine Periode existieren, werden PLAN-Daten in der Liquiditätstabelle ignoriert
- PLAN-Daten bleiben für Vergleich erhalten (separater Tab)
- Kontoauszüge immer als IST importieren!

### Klassifikation in 03-classified/

```
/03-classified/
├── IST/           # Reale Bankbewegungen (Kontoauszüge)
├── PLAN/          # Geplante/erwartete Werte
├── ANNAHMEN/      # Planungsprämissen
├── STRUKTUR/      # Stammdaten (Standorte, Gegenparteien)
├── VERTRAEGE/     # Vertragsregelungen (Split-Regeln)
└── REFERENZ/      # Hintergrunddokumente
```

### Checkliste bei Klassifikation

1. [ ] **valueType korrekt?**
   - Kontoauszug → IST
   - Planung → PLAN

2. [ ] **Datum korrekt?**
   - IST: Buchungsdatum
   - PLAN: Erwartetes Zahlungsdatum

3. [ ] **Keine Doppelungen?**
   - IST für gleichen Vorgang wie PLAN? → Dokumentieren

4. [ ] **Split-Regeln erkannt?**
   - Alt/Neu-Masse bei Abrechnungsstellen?
   - Vertragliche Regelungen?

$ARGUMENTS
