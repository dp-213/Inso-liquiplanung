---
description: Dokumentation nach größeren Änderungen aktualisieren
---

# Dokumentations-Update

Aktualisiere die Projekt-Dokumentation basierend auf den Änderungen in dieser Konversation.

## Phase 1: Analyse

Lies die bisherige Konversation und identifiziere:
- **Was wurde geändert?** (Features, Bugfixes, Refactoring, Schema-Änderungen)
- **Warum?** (Architektur-Entscheidungen, Begründungen)
- **Neue Einschränkungen?** (Bekannte Bugs, bewusste Nicht-Implementierungen)
- **Gelöste Einschränkungen?** (Items die jetzt erledigt sind)

## Phase 2: Living Docs aktualisieren

Prüfe und aktualisiere JEDE dieser Dateien:

### `/app/docs/CHANGELOG.md`
**Wann:** Bei jeder funktionalen Änderung.
- Neue Version oben einfügen (Version hochzählen, Format: `## Version X.Y.Z – [Kurztitel]`)
- Abschnitte: Neue Funktionen, Änderungen, Bugfixes, Entfernte Features
- Nur funktionale Änderungen, keine reinen Doku-Updates

### `/app/docs/ARCHITECTURE.md`
**Wann:** Bei strukturellen Änderungen (Datenmodell, APIs, neue Module).
- Versionsnummer aktualisieren
- Neue Dateien/Module in Verzeichnisstruktur aufnehmen
- Datenfluss-Diagramme bei Bedarf anpassen

### `/app/docs/DECISIONS.md`
**Wann:** Bei wichtigen Design-Entscheidungen.
- Format: `## ADR-XXX: [Titel]` mit Kontext, Entscheidung, Begründung, Konsequenzen
- ADR-Nummer: Nächste freie Nummer nehmen (letzte prüfen!)
- Bestehende ADRs NIE ändern (historisches Protokoll)

### `/app/docs/LIMITATIONS.md`
**Wann:** Bei neuen Einschränkungen ODER wenn Einschränkungen gelöst wurden.
- Neue Einschränkungen in passende Sektion einfügen
- Gelöste Items in "Gelöste Einschränkungen (Archiv)" Sektion verschieben

### `/app/docs/TODO.md`
**Wann:** Wenn sich der Status offener Tasks ändert.
- Erledigte Items entfernen oder als gelöst markieren
- Neue bekannte Bugs/TODOs eintragen

### `/app/docs/TODO_REFACTORING.md`
**Wann:** Bei Refactoring-Arbeiten oder wenn technische Schulden entstehen/abgebaut werden.
- Status ZURÜCKGESTELLT nur ändern wenn aktiv dran gearbeitet wird

### `/app/docs/ADMIN_SYSTEM.md`
**Wann:** Bei Änderungen am Admin-Dashboard, Daten-Import-Pipeline oder Kunden-Portal.
- Neue API-Routen, Komponenten, Datenflüsse dokumentieren

### `/app/docs/DASHBOARD_BEST_PRACTICES.md`
**Wann:** Selten. Nur bei grundlegenden Änderungen am Dashboard-Reporting-Konzept.

### `/app/docs/HELP.md`
**Wann:** Bei Änderungen an Features, Workflow oder UI, die für End-User relevant sind.
- Source-of-Truth für die Hilfe-Seite im Admin-Dashboard (`/admin/cases/[id]/hilfe`)
- Abschnitte: Systemübersicht, Kernkonzepte, Workflow, Bereiche, FAQ, Glossar
- Wenn neue Konzepte oder Bereiche hinzukommen: FAQ und Glossar ergänzen
- Bei Workflow-Änderungen: Schritt-für-Schritt-Anleitung aktualisieren
- **WICHTIG:** Nach Änderungen an HELP.md auch die React-Seite `app/src/app/admin/cases/[id]/hilfe/page.tsx` konsistent halten (Inhalte spiegeln die .md Datei wider)

## Phase 3: Cleanup

**Verwaiste Dateien finden:**
- Prüfe ob .md-Dateien im **Projekt-Root** entstanden sind (dort gehört nur `CLAUDE.md`)
- Prüfe ob .md-Dateien im **Case-Root** entstanden sind (dort gehört nur `case-context.json`)
- System-Docs → `docs/archiv/` verschieben + `archiv/INDEX.md` aktualisieren
- Case-Docs → `Cases/.../06-review/` verschieben

**One-Off-Dokumente archivieren:**
- Incident-Berichte, Analysedokumente, Deployment-Checklisten → `docs/archiv/`
- Living Docs bleiben in `docs/` (CHANGELOG, ARCHITECTURE, DECISIONS, LIMITATIONS, TODO, TODO_REFACTORING, ADMIN_SYSTEM, DASHBOARD_BEST_PRACTICES, HELP)

## Phase 4: Zusammenfassung

Zeige dem User:
1. Welche Dateien wurden aktualisiert
2. Was wurde hinzugefügt/geändert (Kurzfassung)
3. Ob CLAUDE.md angepasst werden sollte (neue Patterns, Konventionen, Häufige Fehler)

## Regeln

- **Deutsche Sprache** mit echten Umlauten (ä, ö, ü, ß)
- **Konkret** – Keine vagen Beschreibungen
- **Keine Duplikate** – Bestehende Einträge aktualisieren statt neue anlegen
- **Nichts löschen** – Veraltetes in Archiv verschieben, nicht löschen

$ARGUMENTS
