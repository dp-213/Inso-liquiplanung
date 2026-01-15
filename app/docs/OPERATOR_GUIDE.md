# Bedienerhandbuch

## Inso-Liquiplanung - Anleitung fuer Gradify-Mitarbeiter

Dieses Handbuch erklaert alle Funktionen der Anwendung Schritt fuer Schritt. Es richtet sich an Mitarbeiter ohne technischen Hintergrund.

---

## Inhaltsverzeichnis

1. [Anmeldung und Navigation](#1-anmeldung-und-navigation)
2. [Projekte verwalten](#2-projekte-verwalten)
3. [Faelle anlegen und bearbeiten](#3-faelle-anlegen-und-bearbeiten)
4. [Dateien hochladen](#4-dateien-hochladen)
5. [Import-Fehler beheben](#5-import-fehler-beheben)
6. [Darstellung anpassen](#6-darstellung-anpassen)
7. [Externe Zugaenge erstellen](#7-externe-zugaenge-erstellen)
8. [Haeufige Fragen](#8-haeufige-fragen)

---

## 1. Anmeldung und Navigation

### Anmelden

1. Oeffnen Sie Ihren Browser (Chrome, Firefox, Safari oder Edge empfohlen)
2. Geben Sie die Anwendungs-URL ein
3. Sie sehen die Anmeldeseite
4. Tragen Sie Ihren Benutzernamen ein
5. Tragen Sie Ihr Passwort ein
6. Klicken Sie auf "Anmelden"

**Hinweis**: Ihr Passwort erhalten Sie von der IT-Abteilung. Bewahren Sie es sicher auf.

### Das Dashboard verstehen

Nach der Anmeldung sehen Sie das Dashboard mit folgenden Bereichen:

| Bereich | Was Sie dort finden |
|---------|---------------------|
| Projekte | Anzahl aller aktiven Mandanten |
| Aktive Faelle | Anzahl eroeffneter Insolvenzverfahren |
| Gesamt Faelle | Gesamtzahl aller Verfahren |
| Offene Imports | Dateien, die noch geprueft werden muessen |

**Schnellaktionen**: Unten finden Sie Knoepfe fuer haeufige Aufgaben.

### Seitenmenue verwenden

Links sehen Sie das Hauptmenue:

- **Uebersicht**: Zurueck zum Dashboard
- **Projekte**: Mandantenverwaltung
- **Faelle**: Alle Insolvenzverfahren
- **Daten-Import**: Dateien hochladen
- **Pruefung**: Import-Probleme beheben

---

## 2. Projekte verwalten

Ein Projekt entspricht einem Insolvenzverwalter oder Mandanten. Unter einem Projekt koennen mehrere Insolvenzfaelle angelegt werden.

### Neues Projekt erstellen

1. Klicken Sie im Seitenmenue auf "Projekte"
2. Klicken Sie oben rechts auf "Neues Projekt"
3. Fuellen Sie das Formular aus:
   - **Name**: Name des Insolvenzverwalters (z.B. "RA Dr. Mueller")
   - **Beschreibung**: Optionale Notizen
4. Klicken Sie auf "Speichern"

### Projekt bearbeiten

1. Gehen Sie zu "Projekte"
2. Klicken Sie auf das gewuenschte Projekt
3. Klicken Sie auf "Bearbeiten"
4. Nehmen Sie Ihre Aenderungen vor
5. Klicken Sie auf "Speichern"

### Projekt archivieren

Abgeschlossene Mandanten koennen archiviert werden:

1. Oeffnen Sie das Projekt
2. Klicken Sie auf "Archivieren"
3. Bestaetigen Sie die Aktion

**Wichtig**: Archivierte Projekte bleiben erhalten und koennen wiederhergestellt werden.

---

## 3. Faelle anlegen und bearbeiten

Ein Fall entspricht einem einzelnen Insolvenzverfahren.

### Neuen Fall anlegen

1. Klicken Sie im Seitenmenue auf "Faelle"
2. Klicken Sie auf "Neuen Fall anlegen"
3. Fuellen Sie alle Pflichtfelder aus:

| Feld | Erklaerung | Beispiel |
|------|------------|----------|
| Projekt | Zu welchem Mandanten gehoert der Fall? | "RA Dr. Mueller" |
| Aktenzeichen | Gerichtliches Aktenzeichen | "123 IN 456/26" |
| Schuldnername | Name des insolventen Unternehmens | "Muster GmbH" |
| Gericht | Zustaendiges Amtsgericht | "AG Muenchen" |
| Antragsdatum | Wann wurde Insolvenz beantragt? | 15.01.2026 |
| Eroeffnungsdatum | Wann wurde Verfahren eroeffnet? | Optional |

4. Klicken Sie auf "Speichern"

### Fall-Status verstehen

| Status | Bedeutung | Farbe |
|--------|-----------|-------|
| Vorlaeufig | Antrag gestellt, noch nicht eroeffnet | Gelb |
| Eroeffnet | Verfahren ist eroeffnet | Gruen |
| Geschlossen | Verfahren ist beendet | Grau |

### Fall-Detailseite

Die Detailseite eines Falls zeigt:

- **Kopfbereich**: Alle Stammdaten des Falls
- **Liquiditaetsplan**: Aktueller Planungsstand und Version
- **Import-Historie**: Letzte hochgeladene Dateien
- **Externe Freigaben**: Links fuer Insolvenzverwalter

---

## 4. Dateien hochladen

### Unterstuetzte Dateiformate

| Format | Verwendung |
|--------|------------|
| CSV | Universelles Tabellenformat |
| Excel (XLSX) | Microsoft Excel |
| Excel (XLS) | Aelteres Excel-Format |

### Datei hochladen - Schritt fuer Schritt

1. Oeffnen Sie den Fall, fuer den Sie Daten importieren moechten
2. Klicken Sie auf "Daten importieren"

**Oder:**

1. Gehen Sie zu "Daten-Import" im Seitenmenue
2. Waehlen Sie den Fall aus dem Dropdown-Menue

**Dann:**

3. Waehlen Sie den Dateityp:
   - "CSV Allgemein" fuer Standard-CSV-Dateien
   - "Excel Allgemein" fuer Excel-Dateien
   - "Kontoauszug CSV" fuer Bankauszuege
   - Weitere spezielle Formate verfuegbar

4. Ziehen Sie die Datei in den markierten Bereich
   - Oder klicken Sie auf "Datei auswaehlen"

5. Klicken Sie auf "Datei hochladen"

6. Warten Sie auf die Verarbeitung (Fortschrittsanzeige beachten)

### Was passiert nach dem Upload?

Das System durchlaeuft mehrere Schritte:

1. **Hochladen**: Datei wird uebertragen
2. **Validieren**: Dateiformat wird geprueft
3. **Parsen**: Zeilen werden eingelesen
4. **Staging**: Daten werden zwischengespeichert
5. **Mapping**: Felder werden zugeordnet
6. **Validierung**: Geschaeftsregeln werden geprueft

### Status der Importvorgaenge

| Status | Bedeutung | Ihre Aktion |
|--------|-----------|-------------|
| Bereit | Alles korrekt, kann uebernommen werden | Auf "Uebernehmen" klicken |
| Zur Pruefung | Einige Zeilen haben Warnungen | Pruefung durchfuehren |
| Problem | Kritische Fehler gefunden | Fehler analysieren |
| Uebernommen | Daten sind im Plan | Keine Aktion noetig |

---

## 5. Import-Fehler beheben

### Pruefungsbereich oeffnen

1. Klicken Sie auf "Pruefung" im Seitenmenue
   - Oder auf "Pruefen" beim jeweiligen Importvorgang

2. Sie sehen eine Liste aller Datensaetze mit Problemen

### Arten von Problemen

**Fehler (Rot)** - Muessen behoben werden:
- Datum nicht erkannt
- Betrag nicht lesbar
- Pflichtfeld fehlt

**Warnungen (Gelb)** - Sollten geprueft werden:
- Datum ausserhalb des 13-Wochen-Fensters
- Kategorie nicht zugeordnet
- Ungewoehnlich hoher Betrag

**Hinweise (Blau)** - Zur Information:
- Zeile mit Betrag 0
- Doppelter Verwendungszweck

### Probleme loesen

Fuer jede problematische Zeile haben Sie drei Optionen:

1. **Korrigieren**:
   - Klicken Sie auf die Zeile
   - Aendern Sie den fehlerhaften Wert
   - Klicken Sie auf "Speichern"

2. **Ueberspringen**:
   - Klicken Sie auf "Zeile ausschliessen"
   - Die Zeile wird nicht importiert

3. **Erzwingen**:
   - Klicken Sie auf "Trotzdem uebernehmen"
   - Nur bei begruendeten Ausnahmen nutzen
   - Wird im Audit-Log protokolliert

### Nach der Pruefung

Wenn alle Probleme behoben sind:

1. Der Status wechselt zu "Bereit"
2. Klicken Sie auf "Uebernehmen"
3. Die Daten werden in den Liquiditaetsplan uebertragen
4. Eine neue Version wird erstellt

---

## 6. Darstellung anpassen

Die Darstellung des Liquiditaetsplans kann pro Fall angepasst werden, ohne die zugrundeliegenden Daten zu veraendern.

### Zeilen ein-/ausblenden

Einzelne Positionen koennen fuer die externe Ansicht ausgeblendet werden:

1. Oeffnen Sie den Fall
2. Gehen Sie zu "Darstellung anpassen"
3. Unter "Sichtbare Zeilen" koennen Sie einzelne Positionen deaktivieren
4. Klicken Sie auf "Speichern"

**Wichtig**: Die Daten bleiben erhalten, werden nur nicht angezeigt.

### Zeilen gruppieren

Positionen koennen unter eigenen Ueberschriften zusammengefasst werden:

1. Gehen Sie zu "Darstellung anpassen"
2. Waehlen Sie "Gruppierungen"
3. Erstellen Sie eine neue Gruppe mit Namen
4. Ziehen Sie Positionen in die Gruppe
5. Speichern

### Reihenfolge aendern

Die Anzeigereihenfolge der Kategorien und Zeilen:

1. Gehen Sie zu "Darstellung anpassen"
2. Waehlen Sie "Reihenfolge"
3. Ziehen Sie Eintraege per Drag-and-Drop
4. Speichern

### Diagramm-Einstellungen

Fuer die externe Ansicht koennen Sie festlegen:

- Welche Diagramme angezeigt werden
- Farben der Balken und Linien
- Beschriftungen

---

## 7. Externe Zugaenge erstellen

Insolvenzverwalter erhalten ueber spezielle Links schreibgeschuetzten Zugang zu "ihrem" Liquiditaetsplan.

### Neuen Link erstellen

1. Oeffnen Sie den gewuenschten Fall
2. Scrollen Sie zum Bereich "Externe Freigaben"
3. Klicken Sie auf "Neuen Link erstellen"
4. Geben Sie eine Bezeichnung ein (z.B. "RA Dr. Mueller - Zugang")
5. Optional: Setzen Sie ein Ablaufdatum
6. Klicken Sie auf "Erstellen"

### Link teilen

Nach dem Erstellen:

1. Klicken Sie auf "Link kopieren"
2. Fuegen Sie den Link in eine E-Mail ein
3. Senden Sie ihn an den Insolvenzverwalter

**Sicherheitshinweis**: Senden Sie Links nur an verifizierte E-Mail-Adressen.

### Link deaktivieren

Falls ein Link nicht mehr gueltig sein soll:

1. Oeffnen Sie den Fall
2. Finden Sie den Link in der Liste
3. Klicken Sie auf "Deaktivieren"

Der Link funktioniert danach nicht mehr.

### Was sieht der Insolvenzverwalter?

- Schreibgeschuetzte Ansicht des Liquiditaetsplans
- Kennzahlen-Karten
- 13-Wochen-Tabelle
- Diagramm
- PDF-Export-Moeglichkeit

**Der Insolvenzverwalter sieht NICHT:**
- Andere Faelle
- Rohdaten des Imports
- Mapping-Konfigurationen
- Interne Notizen
- Admin-Funktionen

---

## 8. Haeufige Fragen

### Die Datei wird nicht akzeptiert

**Moegliche Ursachen:**
- Falsches Format (nur CSV, XLSX, XLS)
- Datei zu gross (max. 10 MB)
- Datei ist beschaedigt

**Loesung:**
- Datei in Excel oeffnen und neu speichern
- Als CSV speichern und erneut versuchen
- Grosse Dateien in kleinere Teile aufteilen

### Das Datum wird nicht erkannt

**Moegliche Ursachen:**
- Unbekanntes Datumsformat
- Falscher Dateityp gewaehlt

**Loesung:**
- Datumsformat pruefen (DD.MM.YYYY erwartet)
- Im Mapping-Template das richtige Format waehlen
- Datum in Excel als Text formatieren

### Der Betrag ist falsch

**Moegliche Ursachen:**
- Falsches Dezimaltrennzeichen (Punkt statt Komma)
- Waehrungssymbol im Feld

**Loesung:**
- In der Quelldatei korrigieren
- Dezimaltrennzeichen im Mapping anpassen

### Die Kategorie wird nicht erkannt

**Moegliche Ursachen:**
- Neuer Kontenname
- Schreibweise weicht ab

**Loesung:**
1. Gehen Sie zur Pruefung
2. Waehlen Sie manuell die richtige Kategorie
3. Optional: Mapping-Template erweitern lassen

### Die Version wurde nicht erstellt

**Moegliche Ursachen:**
- Daten wurden nicht uebernommen
- Es gab noch offene Pruefungspunkte

**Loesung:**
1. Pruefen Sie den Status des Imports
2. Beheben Sie alle offenen Punkte
3. Klicken Sie explizit auf "Uebernehmen"

### Der externe Link funktioniert nicht

**Moegliche Ursachen:**
- Link ist abgelaufen
- Link wurde deaktiviert
- URL wurde falsch kopiert

**Loesung:**
1. Pruefen Sie den Link-Status im Fall
2. Erstellen Sie ggf. einen neuen Link
3. Stellen Sie sicher, dass die vollstaendige URL kopiert wurde

---

## Kontakt bei Problemen

Bei Fragen oder Problemen, die Sie nicht loesen koennen:

1. Notieren Sie die Fehlermeldung (Screenshot)
2. Notieren Sie, welche Aktion Sie durchfuehren wollten
3. Kontaktieren Sie den IT-Support

---

*Bedienerhandbuch Version 1.0 | Stand: Januar 2026*
