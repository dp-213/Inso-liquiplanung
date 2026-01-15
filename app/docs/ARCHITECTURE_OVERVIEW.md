# Architektur-Uebersicht

## Inso-Liquiplanung - Technische Dokumentation

Diese Dokumentation beschreibt die Architektur des Systems fuer Entwickler, Auditoren und technische Entscheidungstraeger.

---

## Inhaltsverzeichnis

1. [Systemuebersicht](#1-systemuebersicht)
2. [Kernberechnungsmodul](#2-kernberechnungsmodul)
3. [Datenmodell](#3-datenmodell)
4. [Datenimport-Pipeline](#4-datenimport-pipeline)
5. [Versionierung und Audit](#5-versionierung-und-audit)
6. [Sicherheit und Zugriffskontrolle](#6-sicherheit-und-zugriffskontrolle)
7. [Glossar](#7-glossar)

---

## 1. Systemuebersicht

### Zweck des Systems

Das Inso-Liquiplanung-System ist ein spezialisiertes Werkzeug fuer die Erstellung von 13-Wochen-Liquiditaetsplaenen in deutschen Insolvenzverfahren. Es unterstuetzt Unternehmensberater bei der Betreuung von Insolvenzverwaltern.

### Architekturprinzipien

Das System folgt klaren Gestaltungsprinzipien:

| Prinzip | Beschreibung |
|---------|--------------|
| **Determinismus** | Gleiche Eingaben fuehren immer zu gleichen Ergebnissen |
| **Nachvollziehbarkeit** | Jede Berechnung ist fuer Gerichte und Pruefer erklaerbar |
| **Trennung der Belange** | Klare Grenzen zwischen Berechnung, Datenhaltung und Darstellung |
| **Keine Interpretation** | Das System berechnet, empfiehlt aber nicht |

### Systemkomponenten

```
+-------------------+     +-------------------+     +-------------------+
|                   |     |                   |     |                   |
|  Datenquellen     | --> |  Import-Schicht   | --> |  Kern-Berechnung  |
|  (CSV, Excel)     |     |  (Validierung,    |     |  (Unveraenderlich)|
|                   |     |   Normalisierung) |     |                   |
+-------------------+     +-------------------+     +-------------------+
                                   |                         |
                                   v                         v
                          +-------------------+     +-------------------+
                          |                   |     |                   |
                          |  Admin-Dashboard  |     |  Externe Ansicht  |
                          |  (Intern)         |     |  (Insolvenzverw.) |
                          |                   |     |                   |
                          +-------------------+     +-------------------+
```

### Nutzergruppen

| Gruppe | Zugang | Rechte |
|--------|--------|--------|
| Interne Berater | Admin-Dashboard | Voller Zugriff auf alle Funktionen |
| Insolvenzverwalter | Externe Ansicht | Nur Lesezugriff auf eigene Faelle |

---

## 2. Kernberechnungsmodul

### Konzept

Das Kernberechnungsmodul ist der mathematische Kern des Systems. Es ist als geschlossene, unveraenderliche Einheit konzipiert:

- **Eingabe**: Strukturierte Cashflow-Daten und Eroeffnungssaldo
- **Verarbeitung**: Deterministische Berechnung nach festen Regeln
- **Ausgabe**: Woechentliche Salden und Gesamtergebnisse

### Berechnungslogik

Die zentrale Formel fuer jede Woche:

```
Schlusssaldo[W] = Anfangssaldo[W] + Einzahlungen[W] - Auszahlungen[W]
Anfangssaldo[W+1] = Schlusssaldo[W]
```

### IST-PLAN-Regel

Fuer jede Position und Woche gilt:

```
Effektiver Wert = IST-Wert falls vorhanden, sonst PLAN-Wert, sonst 0
```

Der IST-Wert (realisierte Zahlung) hat immer Vorrang vor dem PLAN-Wert (geplante Zahlung).

### Altmasse und Neumasse

Das System unterscheidet zwischen:

| Typ | Beschreibung |
|-----|--------------|
| Altmasse | Vermoegenswerte und Verbindlichkeiten, die vor Eroeffnung des Insolvenzverfahrens entstanden sind |
| Neumasse | Vermoegenswerte und Verbindlichkeiten, die nach Eroeffnung entstehen |

Diese Trennung ist gesetzlich vorgeschrieben und wird durchgaengig beibehalten.

### Kategorien (Standard)

**Einzahlungen (Altmasse):**
- Forderungseinzuege
- Anlagenverkaeufe
- Sonstige Einzahlungen Alt

**Einzahlungen (Neumasse):**
- Umsatzerloese
- Sonstige Einzahlungen Neu

**Auszahlungen (Altmasse):**
- Altmasseverbindlichkeiten
- Sonstige Auszahlungen Alt

**Auszahlungen (Neumasse):**
- Loehne und Gehaelter
- Sozialversicherung
- Miete und Nebenkosten
- Material und Waren
- Sonstige Auszahlungen Neu

### Waehrung und Genauigkeit

- Alle Betraege werden intern in Euro-Cent gespeichert (Ganzzahl)
- Keine Rundungsfehler durch Dezimalzahlen
- Anzeige erfolgt in Euro mit zwei Nachkommastellen

---

## 3. Datenmodell

### Hierarchie der Entitaeten

```
Projekt (Insolvenzverwalter)
    |
    +-- Fall (Insolvenzverfahren)
            |
            +-- Liquiditaetsplan
            |       |
            |       +-- Version (Snapshot)
            |       |
            |       +-- Kategorie
            |               |
            |               +-- Position (Zeile)
            |                       |
            |                       +-- Wochenwert (IST oder PLAN)
            |
            +-- Import-Vorgang
            |
            +-- Externer Freigabelink
```

### Entitaeten im Detail

**Projekt**
- Repraesentiert einen Mandanten/Insolvenzverwalter
- Kann mehrere Faelle enthalten
- Status: Aktiv oder Archiviert

**Fall (Insolvenzverfahren)**
- Zentrale Entitaet fuer ein Insolvenzverfahren
- Enthaelt Stammdaten: Aktenzeichen, Schuldner, Gericht
- Status: Vorlaeufig, Eroeffnet, Geschlossen
- Gehoert zu genau einem Projekt

**Liquiditaetsplan**
- Container fuer alle Cashflow-Daten eines Falls
- Hat einen Startzeitpunkt (muss ein Montag sein)
- Kann mehrere Versionen haben
- Nur ein Plan pro Fall ist "aktiv"

**Version**
- Unveraenderlicher Snapshot eines Planstands
- Enthaelt Eroeffnungssaldo und Pruefsumme
- Wird bei jeder Aenderung automatisch erstellt
- Ermoeglicht Rueckverfolgung und Vergleich

**Kategorie**
- Gruppiert Positionen nach Typ
- Hat Fliessrichtung (Einzahlung/Auszahlung)
- Hat Massetyp (Altmasse/Neumasse)
- Systemkategorien koennen nicht geloescht werden

**Position (Zeile)**
- Einzelne Zahlungsposition (z.B. "Miete Hauptgebaeude")
- Gehoert zu einer Kategorie
- Kann gesperrt werden (keine Aenderung moeglich)

**Wochenwert**
- Atomarer Datenpunkt: Ein Wert fuer eine Position in einer Woche
- Typ: IST (realisiert) oder PLAN (geplant)
- Wochenoffset: 0 bis 12 (13 Wochen)
- Betrag in Cent als Ganzzahl

### Beziehungen und Integritaet

- Jede Entitaet hat eine eindeutige ID (UUID)
- Referenzielle Integritaet wird durch die Datenbank sichergestellt
- Loeschungen sind kaskadierend wo sinnvoll
- Versionen sind vollstaendig unveraenderlich

---

## 4. Datenimport-Pipeline

### Ueberblick

Die Import-Pipeline verarbeitet externe Daten (CSV, Excel) und fuehrt sie dem Kernberechnungsmodul zu. Dabei werden keine Daten "geraten" oder automatisch korrigiert.

### Pipeline-Stufen

```
Datei-Upload
     |
     v
Struktur-Validierung (Format, Encoding)
     |
     v
Parsen (Zeilen extrahieren)
     |
     v
Rohdaten-Staging (Originaldaten speichern)
     |
     v
Mapping (Felder zuordnen)
     |
     v
Geschaeftsvalidierung (Regeln pruefen)
     |
     v
Normalisierung (Kanonische Form)
     |
     v
[Falls Warnungen: Manuelle Pruefung]
     |
     v
Uebernahme (in Kernschema schreiben)
```

### Status eines Imports

| Status | Bedeutung |
|--------|-----------|
| Erstellt | Datei wurde empfangen |
| Validierung | Dateiformat wird geprueft |
| Parsen | Zeilen werden eingelesen |
| Staging | Rohdaten werden gespeichert |
| Mapping | Felder werden zugeordnet |
| Pruefung | Warnungen erfordern Entscheidung |
| Bereit | Alle Validierungen bestanden |
| Uebernommen | Daten sind im Liquiditaetsplan |
| Abgelehnt | Kritische Fehler, nicht verwendbar |

### Qualitaetsstufen

| Stufe | Beschreibung | Aktion |
|-------|--------------|--------|
| Tier 1 | Alle Validierungen bestanden | Automatisch bereit |
| Tier 2 | Kleinere Warnungen | Manuelle Pruefung noetig |
| Tier 3 | Strukturelle Probleme | Quarantaene, Ueberarbeitung |
| Tier 4 | Schwere Fehler | Ablehnung |

### Transformationsregeln

Das System fuehrt nur explizit konfigurierte Transformationen durch:

- **Datumskonvertierung**: DD.MM.YYYY zu Wochenoffset
- **Betragskonvertierung**: Euro mit Komma zu Cent (Ganzzahl)
- **Feldumbenennung**: Quellspalte zu Zielspalte
- **Kategoriezuordnung**: Nach Mapping-Tabelle

**Niemals durchgefuehrt:**
- Automatische Korrektur von Fehlern
- Erraten fehlender Werte
- Interpretation von Freitext
- Intelligente Kategorisierung

### Herkunftsnachverfolgung

Jeder Datenpunkt kann bis zur Quelldatei zurueckverfolgt werden:

```
Wochenwert im Plan
     |
     +-- Uebernahme-Aktion (Wer? Wann?)
             |
             +-- Normalisierter Datensatz
                     |
                     +-- Transformationen (Welche Regeln?)
                             |
                             +-- Rohdatensatz (Zeilennummer)
                                     |
                                     +-- Quelldatei (Name, Pruefsumme)
```

---

## 5. Versionierung und Audit

### Versionsprinzip

Jede Aenderung an Plandaten erzeugt eine neue Version. Versionen sind unveraenderlich (immutable).

**Version enthaelt:**
- Versionsnummer (fortlaufend)
- Zeitstempel der Erstellung
- Begruendung der Aenderung
- Eroeffnungssaldo
- Daten-Pruefsumme (SHA-256)
- Ersteller

### Datenintegritaet

Die Pruefsumme (Hash) ermoeglicht die Verifikation:

1. Alle Wochenwerte werden sortiert
2. Ein kanonisches Format wird erstellt
3. SHA-256 wird berechnet
4. Hash wird mit Version gespeichert

Bei Bedarf kann geprueft werden, ob Daten veraendert wurden.

### Audit-Protokoll

Das System protokolliert alle relevanten Ereignisse:

| Ereignistyp | Was wird erfasst |
|-------------|------------------|
| IMPORT_GESTARTET | Datei, Benutzer, Zeitpunkt |
| IMPORT_ABGESCHLOSSEN | Anzahl Datensaetze, Status |
| VERSION_ERSTELLT | Versionsnummer, Begruendung |
| DATEN_GEAENDERT | Alte und neue Werte |
| ZUGANG_ERSTELLT | Freigabelink, Bezeichnung |
| ANMELDUNG | Benutzer, IP-Adresse |

### Aufbewahrung

| Datentyp | Aufbewahrungsdauer |
|----------|-------------------|
| Quelldateien | 10 Jahre |
| Import-Protokolle | 10 Jahre |
| Versionen | 10 Jahre |
| Audit-Ereignisse | 10 Jahre |
| Session-Logs | 90 Tage |

### Reproduzierbarkeit

Gegeben:
- Quelldatei (identifiziert durch Pruefsumme)
- Mapping-Konfiguration (versioniert)
- Berechnungsmodul (Softwareversion)

Muss das System identische Ergebnisse liefern. Dies ist fuer gerichtliche Nachweise erforderlich.

---

## 6. Sicherheit und Zugriffskontrolle

### Authentifizierung

**Interne Benutzer (Admin):**
- Benutzername und Passwort
- Session-basierte Anmeldung
- Session-Timeout nach Inaktivitaet
- Verschluesselte Session-Cookies

**Externe Benutzer (Insolvenzverwalter):**
- Tokenbasierte Links (keine Anmeldung)
- Eindeutige, zufaellige Token
- Optional zeitlich begrenzt
- Keine Session-Verwaltung

### Zugriffsmatrix

| Funktion | Admin | Externer Benutzer |
|----------|-------|-------------------|
| Alle Faelle sehen | Ja | Nein |
| Eigenen Fall sehen | - | Ja |
| Daten importieren | Ja | Nein |
| Daten aendern | Ja | Nein |
| Versionen vergleichen | Ja | Eingeschraenkt |
| PDF exportieren | Ja | Ja |
| Freigabelinks erstellen | Ja | Nein |
| Audit-Log einsehen | Ja | Nein |

### Datentrennung

- Externe Benutzer sehen nur den freigegebenen Fall
- Kein Zugriff auf andere Faelle moeglich
- Keine Sichtbarkeit von Rohdaten oder Import-Details
- Keine Admin-Funktionen verfuegbar

### Sicherheitsmassnahmen

- HTTPS fuer alle Verbindungen
- Passwoerter werden gehasht gespeichert (bcrypt)
- Keine sensiblen Daten in URLs
- Tokens sind nicht vorhersagbar (kryptografisch sicher)
- Rate-Limiting gegen Brute-Force

---

## 7. Glossar

| Begriff | Erklaerung |
|---------|------------|
| **13-Wochen-Plan** | Standardformat fuer Liquiditaetsplanung in Insolvenzverfahren |
| **Altmasse** | Vermoegenswerte aus der Zeit vor Insolvenzeröffnung |
| **Audit-Log** | Chronologisches Protokoll aller Systemaktionen |
| **Determinismus** | Eigenschaft, dass gleiche Eingaben immer gleiche Ausgaben erzeugen |
| **Effektiver Wert** | Der tatsaechlich verwendete Wert (IST vor PLAN) |
| **Eroeffnungssaldo** | Kassenbestand zu Beginn der Planung |
| **IST-Wert** | Tatsaechlich realisierter Betrag |
| **Neumasse** | Vermoegenswerte aus der Zeit nach Insolvenzeröffnung |
| **PLAN-Wert** | Geplanter oder erwarteter Betrag |
| **Pruefsumme** | Mathematische Signatur zur Integritaetspruefung (SHA-256) |
| **Quarantaene** | Bereich fuer Datensaetze mit Problemen |
| **Staging** | Zwischenspeicherung vor endgueltiger Uebernahme |
| **Token** | Zufaellige Zeichenkette fuer Zugriffsberechtigung |
| **Version** | Unveraenderlicher Snapshot eines Datenstands |
| **Wochenoffset** | Position einer Woche im 13-Wochen-Fenster (0-12) |

---

## Dokumentenhistorie

| Version | Datum | Aenderung |
|---------|-------|-----------|
| 1.0 | Januar 2026 | Erstfassung |

---

*Architektur-Dokumentation Version 1.0 | Stand: Januar 2026*
