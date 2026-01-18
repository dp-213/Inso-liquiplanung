# Inso-Liquiplanung

## Insolvenz-Liquiditaetsplanungssystem

Ein professionelles Werkzeug fuer die 13-Wochen-Liquiditaetsplanung in Insolvenzverfahren. Entwickelt fuer Unternehmensberater, die Insolvenzverwalter bei der finanziellen Steuerung unterstuetzen.

---

## Was macht diese Anwendung?

Inso-Liquiplanung ist ein spezialisiertes System zur Erstellung und Verwaltung von Liquiditaetsplaenen in deutschen Insolvenzverfahren. Die Anwendung unterstuetzt:

- **13-Wochen-Planung**: Rollierender Liquiditaetsforecast mit Wochengranularitaet
- **IST/PLAN-Trennung**: Klare Unterscheidung zwischen realisierten und geplanten Werten
- **Altmasse/Neumasse**: Separate Verfolgung von Vermoegenswerten vor und nach Eroeffnung
- **Versionierung**: Vollstaendige Versionshistorie aller Planstaende fuer Revisionen und Gerichtsberichte
- **Externe Freigabe**: Sichere, tokenbasierte Links fuer Insolvenzverwalter

---

## Fuer interne Mitarbeiter (Berater)

### Anmeldung

1. Navigieren Sie zur Anwendung unter der bereitgestellten URL
2. Melden Sie sich mit Ihren Admin-Zugangsdaten an
3. Nach erfolgreicher Anmeldung sehen Sie das Admin-Dashboard

### Täglich Arbeiten

**Neues Projekt anlegen:**
1. Klicken Sie auf "Neues Projekt erstellen" auf der Übersichtsseite
2. Geben Sie den Namen des Insolvenzverwalters/Mandanten ein
3. Optional: Beschreibung hinzufügen
4. Speichern

**Neuen Fall anlegen:**
1. Gehen Sie zu "Fälle" im Seitenmenü
2. Klicken Sie auf "Neuen Fall anlegen"
3. Wählen Sie das zugehörige Projekt aus
4. Tragen Sie ein:
   - Aktenzeichen (z.B. "123 IN 456/26")
   - Schuldnername
   - Amtsgericht
   - Antragsdatum
   - Optional: Eröffnungsdatum
5. Speichern

**Daten importieren:**
1. Öffnen Sie die Fall-Detailseite
2. Klicken Sie auf "Daten importieren"
3. Wählen Sie den Fall und den Dateityp aus
4. Ziehen Sie die Datei in den Upload-Bereich oder wählen Sie sie aus
5. Die Datei wird automatisch geprüft und normalisiert
6. Bei Warnungen: Prüfen Sie die markierten Zeilen im Review-Bereich
7. Nach erfolgreicher Prüfung: Klicken Sie auf "Übernehmen"

**Liquiditätsplan einsehen:**
1. Öffnen Sie den gewünschten Fall
2. Klicken Sie auf "Liquiditätsplan anzeigen"
3. Die 13-Wochen-Tabelle zeigt alle Ein- und Auszahlungen
4. Der Saldo wird automatisch wöchentlich berechnet

**Externen Zugang erstellen:**
1. Auf der Fall-Detailseite: Bereich "Externe Freigaben"
2. Klicken Sie auf "Neuen Link erstellen"
3. Vergeben Sie eine Bezeichnung (z.B. "RA Dr. Müller")
4. Optional: Ablaufdatum setzen
5. Kopieren Sie den generierten Link und senden Sie ihn dem Insolvenzverwalter

### Navigation im Admin-Bereich

| Bereich | Beschreibung |
|---------|--------------|
| Übersicht | Dashboard mit Schnellzugriff auf Projekte, Fälle, offene Imports |
| Projekte | Verwaltung von Mandanten/Insolvenzverwaltern |
| Fälle | Alle Insolvenzverfahren mit Status und Aktionen |
| Daten-Import | Zentraler Upload- und Mapping-Bereich |
| Prüfung | Review-Warteschlange für Datensätze mit Warnungen |

---

## Fuer Insolvenzverwalter (Externe Ansicht)

### Zugang

Sie erhalten einen persoenlichen Zugangslink von Ihrem Berater. Dieser Link fuehrt direkt zu Ihrem Liquiditaetsplan.

### Was Sie sehen

- **Kopfbereich**: Schuldnername, Aktenzeichen, Gericht, Verfahrensstatus
- **Kennzahlen**: Aktueller Kassenbestand, Minimum im Planungszeitraum, kritische Wochen
- **Diagramm**: Visueller Verlauf des Kontostands ueber 13 Wochen
- **13-Wochen-Tabelle**: Detaillierte Aufstellung aller Ein- und Auszahlungen

### PDF-Export

Klicken Sie auf die Schaltflaeche "PDF exportieren" (unten rechts), um einen druckfaehigen Bericht zu erstellen.

### Hinweise

- Die Ansicht ist schreibgeschuetzt - Aenderungen sind nicht moeglich
- Der Link kann zeitlich befristet sein
- Bei Fragen wenden Sie sich an Ihren Berater

---

## Bekannte Einschraenkungen (Version 1.0)

### Funktionale Einschraenkungen

1. **Nur EUR**: Ausschliesslich Euro als Waehrung unterstuetzt
2. **Wochengranularitaet**: Keine taegliche Planung moeglich
3. **Keine Prognosen**: System berechnet, empfiehlt aber nicht
4. **Einzelnutzer**: Keine gleichzeitige Bearbeitung durch mehrere Nutzer

### Technische Einschraenkungen

1. **Dateigroesse**: Maximal 10 MB pro Upload
2. **Dateiformate**: CSV und Excel (XLSX/XLS) unterstuetzt
3. **Browser**: Moderne Browser erforderlich (Chrome, Firefox, Safari, Edge)
4. **Offline**: Keine Offline-Funktionalitaet

### Geplante Erweiterungen

- Erweiterte Mapping-Templates fuer verschiedene Buchhaltungssysteme
- Mehrbenutzerfaehigkeit mit Rollen
- API-Integration fuer automatische Datenuebernahme

---

## Support und Eskalation

### Bei technischen Problemen

1. **Erste Schritte**:
   - Browser-Cache leeren
   - Seite neu laden
   - Anderen Browser testen

2. **Fehlermeldungen dokumentieren**:
   - Screenshot der Fehlermeldung
   - Zeitpunkt des Fehlers
   - Durchgefuehrte Aktion vor dem Fehler

3. **Support kontaktieren**:
   - E-Mail an: [support@gradify.de]
   - Telefon: [Supportnummer einfuegen]
   - Reaktionszeit: Innerhalb von 4 Stunden (Werktags 9-17 Uhr)

### Eskalationsstufen

| Stufe | Situation | Kontakt |
|-------|-----------|---------|
| 1 | Allgemeine Fragen, Bedienung | Support-Team |
| 2 | Technische Fehler, Datenverlust | Technische Leitung |
| 3 | Kritische Systemausfaelle | Geschaeftsfuehrung |

### Notfall

Bei komplettem Systemausfall waehrend dringender Gerichtstermine:
- Notfall-Hotline: [Nummer einfuegen]
- Eskalation an technische Leitung mit Kennwort "KRITISCH"

---

## Rechtliche Hinweise

- Alle Berechnungen sind deterministisch und nachvollziehbar
- Das System speichert keine rechtlichen Einschaetzungen
- Jede Version wird mit Pruefsumme gesichert
- Vollstaendiges Audit-Log aller Aenderungen

---

*Version 1.0.0 | Stand: Januar 2026*
