# Entscheidungsprotokoll (Decisions)

Dieses Dokument dokumentiert wichtige Produkt-, UX- und technische Entscheidungen sowie deren Begründungen.

---

## Produktentscheidungen

### E001: Trennung Admin-Bereich und externe Ansicht

**Entscheidung:** Die Anwendung hat zwei vollständig getrennte Bereiche – einen internen Admin-Bereich und eine externe, schreibgeschützte Ansicht für Insolvenzverwalter.

**Begründung:**
- Insolvenzverwalter sollen keine Bearbeitungsfunktionen sehen
- Die externe Ansicht muss vertrauenswürdig für Gerichte und Banken wirken
- Klare Rollentrennung verhindert versehentliche Änderungen

**Auswirkungen:**
- Zwei separate URL-Strukturen (`/admin/*` und `/view/*`)
- Externe Ansicht nur über Freigabe-Token erreichbar
- Keine Navigation zwischen den Bereichen

---

### E002: 13-Wochen-Horizont als Standard

**Entscheidung:** Der Liquiditätsplan zeigt immer exakt 13 Wochen.

**Begründung:**
- Branchenstandard in der deutschen Insolvenzverwaltung
- Entspricht einem Quartal (3 Monate)
- Ausreichend für kurzfristige Zahlungsfähigkeitsbeurteilung
- Gesetzliche Grundlage (§ 18 InsO: drohende Zahlungsunfähigkeit)

**Auswirkungen:**
- Feste Spaltenanzahl in allen Tabellen
- Keine Konfiguration des Zeitraums notwendig
- Einfachere Berechnungslogik

---

### E003: Freigabe über Token statt Benutzerkonten

**Entscheidung:** Externe Benutzer erhalten Zugang über einmalige Token-Links, nicht über eigene Benutzerkonten.

**Begründung:**
- Einfachste Lösung für externe Weitergabe
- Kein Registrierungsprozess für Insolvenzverwalter erforderlich
- Links können jederzeit widerrufen werden
- Kein Passwortverwaltungsaufwand

**Auswirkungen:**
- Token werden bei Erstellung generiert
- Ablaufdatum optional konfigurierbar
- Zugriffszählung möglich

---

## UX-Entscheidungen

### U001: Vollständig deutsche Benutzeroberfläche

**Entscheidung:** Die gesamte Anwendung ist ausschließlich auf Deutsch verfügbar.

**Begründung:**
- Zielgruppe sind deutsche Insolvenzverwalter und Gerichte
- Fachbegriffe müssen korrekt und verständlich sein
- Keine Verwirrung durch gemischte Sprachen
- Professioneller Eindruck bei Stakeholdern

**Auswirkungen:**
- Keine Sprachumschaltung
- Alle Fehlermeldungen auf Deutsch
- PDF-Export vollständig deutsch

---

### U002: Keine technische Sprache in externer Ansicht

**Entscheidung:** Die externe Ansicht verwendet ausschließlich geschäftliche Begriffe, keine technischen.

**Begründung:**
- Insolvenzverwalter sind keine IT-Fachleute
- Gerichte und Banken erwarten professionelle Dokumente
- Technische Begriffe schaffen Misstrauen

**Beispiele:**
- „Tiefster Stand" statt „Minimum Balance"
- „Reichweite" statt „Runway"
- „Kritische Woche" statt „Critical Week"

---

### U003: Kennzahlen mit Farbcodierung

**Entscheidung:** KPI-Karten zeigen Ampelfarben (Grün/Gelb/Rot) basierend auf der finanziellen Situation.

**Begründung:**
- Sofortige visuelle Einschätzung der Lage
- Etabliertes Muster aus Finanzberichterstattung
- Unterstützt schnelle Entscheidungsfindung

**Logik:**
- Grün: Liquidität ausreichend
- Gelb: Aufmerksamkeit erforderlich
- Rot: Kritische Situation / Handlungsbedarf

---

## Technische Entscheidungen

### T001: SQLite für Version 1.0

**Entscheidung:** Die erste Version verwendet SQLite als Datenbank.

**Begründung:**
- Schnellste Entwicklung ohne Datenbankinfrastruktur
- Ausreichend für Demo- und Preview-Betrieb
- Einfache lokale Entwicklung
- Keine externen Abhängigkeiten

**Einschränkungen:**
- Nicht für Produktionslast geeignet
- Keine parallelen Schreibzugriffe
- Daten bei Vercel-Redeployment verloren

**Geplante Migration:**
- Bei Produktionsstart auf PostgreSQL oder Turso umstellen

---

### T002: Berechnungslogik als unveränderlicher Kern

**Entscheidung:** Die Liquiditätsberechnung ist ein unveränderlicher Kern, der nicht durch Präsentationsschicht oder Konfiguration beeinflusst wird.

**Begründung:**
- Auditierbarkeit: Gleiche Eingaben = Gleiche Ausgaben
- Rechtssicherheit: Berechnungen sind nachvollziehbar
- Trennung von Darstellung und Logik

**Auswirkungen:**
- Keine benutzerdefinierten Formeln
- Keine Anpassung der Berechnungslogik über UI
- Präsentation zeigt nur, was berechnet wurde

---

### T003: Mehrstufiger Import-Workflow

**Entscheidung:** Der Datenimport erfolgt in vier getrennten Schritten (Upload → Mapping → Prüfung → Übernahme).

**Begründung:**
- Fehler werden vor der Übernahme erkannt
- Benutzer behält Kontrolle über jeden Schritt
- Abbruch jederzeit ohne Datenverlust möglich
- Audit-Trail für jeden Import

**Schritte:**
1. Datei hochladen und Format erkennen
2. Spalten den Zielfeldern zuordnen
3. Daten prüfen und Fehler beheben
4. Geprüfte Daten in den Plan übernehmen

---

## Entscheidungshistorie

| ID | Datum | Bereich | Kurzbeschreibung |
|----|-------|---------|------------------|
| E001 | 2026-01-15 | Produkt | Trennung Admin/Extern |
| E002 | 2026-01-15 | Produkt | 13-Wochen-Horizont |
| E003 | 2026-01-15 | Produkt | Token-basierte Freigabe |
| U001 | 2026-01-15 | UX | Deutsche UI |
| U002 | 2026-01-15 | UX | Keine technische Sprache |
| U003 | 2026-01-15 | UX | Farbcodierte Kennzahlen |
| T001 | 2026-01-15 | Technik | SQLite für v1 |
| T002 | 2026-01-15 | Technik | Unveränderlicher Rechenkern |
| T003 | 2026-01-15 | Technik | Mehrstufiger Import |
