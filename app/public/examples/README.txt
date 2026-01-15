BEISPIELDATEIEN FUER DEN DATENIMPORT
=====================================

Diese Dateien demonstrieren das kanonische Import-Schema der Inso-Liquiplanung.

PFLICHTFELDER (mindestens erforderlich):
- Datum: Datum der Zahlungswirksamkeit
- Betrag ODER (Einzahlung + Auszahlung): Geldbetrag
- Bezeichnung: Beschreibung der Position

OPTIONALE STANDARDFELDER (werden erkannt und verarbeitet):
- Kategorie: Liquiditaetskategorie
- Konto: Kontobezeichnung oder IBAN
- Gegenpartei: Geschaeftspartner
- Referenz: Rechnungs- oder Belegnummer
- Kommentar/Notiz: Freitext-Anmerkung
- Alt_Neu/Massetyp: Altmasse oder Neumasse
- Quelle: Datenherkunft (GuV, Kontoauszug, etc.)
- Zahlungsart: Ueberweisung, Lastschrift, Bar, etc.
- Unsicherheit: Kennzeichen fuer geschaetzte Werte
- Werttyp: IST oder PLAN

ZUSAETZLICHE SPALTEN:
Beliebige weitere Spalten werden akzeptiert und als Metadaten gespeichert.
Diese koennen spaeter fuer erweiterte Funktionen genutzt werden.


BEISPIELDATEIEN:
----------------

1. minimal-import.csv
   - Nur Pflichtfelder: Datum, Betrag, Bezeichnung
   - Einfachste moegliche Datei

2. standard-import.csv
   - Pflichtfelder plus haeufig genutzte optionale Felder
   - Empfohlen fuer normale Anwendungsfaelle

3. extended-import.csv
   - Alle Standardfelder plus zusaetzliche Spalten
   - Demonstriert die Erweiterbarkeit des Schemas
   - Zusaetzliche Spalten: Kostenstelle, Projekt, Buchungskreis, Sachbearbeiter

4. split-amount-import.csv
   - Verwendet Einzahlung/Auszahlung statt einzelnem Betrag
   - Alternative Betragsdarstellung

5. bank-statement-format.csv
   - Typisches Kontoauszugs-Format
   - Verwendet abweichende Spaltennamen (Buchungsdatum, Verwendungszweck, etc.)
   - Demonstriert die flexible Spaltenerkennung


WICHTIGE REGELN:
----------------

1. Die Reihenfolge der Spalten ist NICHT wichtig
2. Spaltennamen werden NICHT case-sensitiv erkannt
3. Zusaetzliche Spalten fuehren NIEMALS zu Fehlern
4. Fehlermeldungen beziehen sich NUR auf Pflichtfelder
5. Alle importierten Daten bleiben vollstaendig erhalten


Fuer technische Details siehe:
/src/lib/ingestion/canonical-schema.ts
