---
description: Dokumentation nach größeren Änderungen aktualisieren
---

# Dokumentations-Update

Du sollst die Projekt-Dokumentation nach größeren Änderungen aktualisieren.

## Deine Aufgaben

### 1. Konversation analysieren

Lies die bisherige Konversation und identifiziere:
- **Was wurde geändert?** (Features, Bugfixes, Refactoring)
- **Warum?** (Architektur-Entscheidungen, Begründungen)
- **Neue Einschränkungen?** (Bekannte Bugs, bewusste Nicht-Implementierungen)

### 2. Dokumentation aktualisieren

Prüfe und aktualisiere bei Bedarf:

| Datei | Wann aktualisieren |
|-------|-------------------|
| `/app/docs/CHANGELOG.md` | Bei jeder funktionalen Änderung |
| `/app/docs/ARCHITECTURE.md` | Bei strukturellen Änderungen (Datenmodell, APIs) |
| `/app/docs/DECISIONS.md` | Bei wichtigen Design-Entscheidungen |
| `/app/docs/LIMITATIONS.md` | Bei neuen Einschränkungen oder bekannten Bugs |
| `/CLAUDE.md` | Bei neuen Patterns oder Konventionen |

### 3. Format-Vorgaben

#### CHANGELOG.md
```markdown
## Version X.Y.Z – [Kurztitel]

**Datum:** [Datum]

### Neue Funktionen
- **Feature:** Beschreibung

### Änderungen
- **Komponente:** Was geändert wurde

### Bugfixes
- **Bug:** Was behoben wurde
```

#### DECISIONS.md
```markdown
## ADR-XXX: [Titel]

**Datum:** [Datum]
**Status:** Akzeptiert

### Kontext
[Warum?]

### Entscheidung
[Was?]

### Begründung
[Warum diese Option?]

### Konsequenzen
[Was folgt daraus?]
```

#### LIMITATIONS.md
```markdown
### [Kurztitel]

**Beschreibung:** Was ist eingeschränkt?
**Begründung:** Warum?
**Workaround:** Wie umgehen?
```

## Wichtige Regeln

1. **Deutsche Sprache** – Alle Dokumentation ist auf Deutsch
2. **Echte Umlaute** – ä, ö, ü statt ae, oe, ue
3. **Konkret** – Keine vagen Beschreibungen, sondern präzise
4. **Keine Duplikate** – Bestehende Einträge aktualisieren statt neue anlegen

## Ablauf

1. Lies die relevanten Dokumentationsdateien
2. Vergleiche mit den Änderungen aus der Konversation
3. Erstelle konkrete Updates für jede relevante Datei
4. Zeige dem User eine Zusammenfassung der Änderungen

$ARGUMENTS
