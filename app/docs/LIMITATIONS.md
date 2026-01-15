# Bekannte Einschränkungen (Limitations)

Dieses Dokument dokumentiert bekannte Einschränkungen, bewusste Vereinfachungen und Risiken der aktuellen Version.

---

## Version 1.0 – Einschränkungen

### Datenbank

| Einschränkung | Auswirkung | Geplante Lösung |
|---------------|------------|-----------------|
| SQLite statt PostgreSQL | Keine parallelen Schreibzugriffe, Datenverlust bei Redeployment | Migration auf externe Datenbank (Turso, Neon, PlanetScale) |
| Lokale Datei-Speicherung | Daten nur auf einer Instanz verfügbar | Cloud-Datenbank mit persistentem Speicher |
| Keine Backups | Datenverlust bei Systemausfall möglich | Automatische Backup-Strategie implementieren |

**Risiko:** Hoch für Produktionsbetrieb, akzeptabel für Demo/Preview.

---

### Benutzerverwaltung

| Einschränkung | Auswirkung | Geplante Lösung |
|---------------|------------|-----------------|
| Nur ein Admin-Konto | Keine Unterscheidung zwischen Mitarbeitern | Mehrbenutzersystem mit Rollen |
| Keine Passwort-Zurücksetzung | Manueller Eingriff bei vergessenem Passwort | Self-Service-Passwort-Reset |
| Keine Aktivitätsprotokollierung pro Benutzer | Nicht nachvollziehbar, wer was geändert hat | Audit-Log mit Benutzerzuordnung |

**Risiko:** Mittel – für kleine Teams akzeptabel.

---

### Datenimport

| Einschränkung | Auswirkung | Geplante Lösung |
|---------------|------------|-----------------|
| Manuelle Spalten-Zuordnung | Zeitaufwand bei jedem Import | Vorlagen speichern und wiederverwenden |
| Keine automatische Formaterkennung | Benutzer muss Format kennen | Intelligente Formaterkennung |
| Begrenzte Dateiformate (CSV, Excel) | Andere Formate nicht unterstützt | Bei Bedarf erweitern |
| Keine Fehlerkorrektur in der App | Fehlerhafte Daten müssen extern korrigiert werden | In-App-Bearbeitung einzelner Werte |

**Risiko:** Niedrig – manuelle Zuordnung ist präziser.

---

### Externe Ansicht

| Einschränkung | Auswirkung | Geplante Lösung |
|---------------|------------|-----------------|
| Keine E-Mail-Benachrichtigung | Empfänger muss manuell informiert werden | E-Mail-Versand bei Freigabe |
| Keine Kommentarfunktion | Rückfragen müssen außerhalb der App erfolgen | Kommentarsystem für Stakeholder |
| Kein Wasserzeichen im PDF | Kopien nicht als solche erkennbar | Optionales Wasserzeichen |

**Risiko:** Niedrig – manuelle Kommunikation ausreichend.

---

### Berechnungen

| Einschränkung | Auswirkung | Geplante Lösung |
|---------------|------------|-----------------|
| Keine Szenario-Vergleiche | Nur ein Plan pro Version | Mehrere Szenarien parallel |
| Keine automatischen Prognosen | Keine KI-gestützte Vorhersage | Bewusste Entscheidung – deterministische Berechnung bevorzugt |
| Kein Versionsvergleich | Unterschiede zwischen Versionen nicht visuell | Diff-Ansicht zwischen Versionen |

**Risiko:** Niedrig – Kernfunktion vollständig.

---

### Performance

| Einschränkung | Auswirkung | Geplante Lösung |
|---------------|------------|-----------------|
| Keine Caching-Strategie | Wiederholte Berechnungen bei jedem Aufruf | Redis-Cache für berechnete Werte |
| Keine Pagination bei großen Datensätzen | Langsame Ladezeiten bei vielen Fällen | Lazy Loading und Pagination |

**Risiko:** Niedrig bei aktuellem Datenvolumen.

---

### Sicherheit

| Einschränkung | Auswirkung | Geplante Lösung |
|---------------|------------|-----------------|
| Keine Zwei-Faktor-Authentifizierung | Geringerer Schutz bei Passwortverlust | 2FA implementieren |
| Token-Links ohne IP-Einschränkung | Links können weitergegeben werden | IP-Whitelist oder Einmalverwendung |
| Keine Verschlüsselung der Datenbank | Daten im Klartext gespeichert | Encryption at Rest |

**Risiko:** Mittel – für sensible Finanzdaten relevant.

---

## Bewusste Vereinfachungen

Diese Einschränkungen sind **bewusste Entscheidungen**, keine Fehler:

### Fester 13-Wochen-Horizont
- **Warum:** Branchenstandard, keine Konfiguration nötig
- **Alternative:** Variabler Zeitraum (nicht geplant)

### Keine benutzerdefinierten Berechnungen
- **Warum:** Auditierbarkeit und Nachvollziehbarkeit
- **Alternative:** Benutzerdefinierte Formeln (bewusst abgelehnt)

### Keine Mehrsprachigkeit
- **Warum:** Zielmarkt ist Deutschland
- **Alternative:** Englisch/weitere Sprachen (nicht geplant für v1)

### Kein Dark Mode
- **Warum:** Professionelle Dokumente werden gedruckt
- **Alternative:** Bei Nutzerwunsch nachrüsten

---

## Risikobewertung

| Bereich | Risiko | Begründung |
|---------|--------|------------|
| Datenbank | Hoch | SQLite nicht produktionsreif |
| Benutzerverwaltung | Mittel | Ein Account reicht für kleine Teams |
| Datenimport | Niedrig | Manuelle Kontrolle ist präziser |
| Externe Ansicht | Niedrig | Kernfunktion vollständig |
| Berechnungen | Niedrig | Kernfunktion vollständig |
| Performance | Niedrig | Aktuell ausreichend |
| Sicherheit | Mittel | Für Finanzdaten relevant |

---

## Dokumentationshistorie

| Datum | Änderung |
|-------|----------|
| 2026-01-15 | Erstversion mit allen bekannten Einschränkungen |
