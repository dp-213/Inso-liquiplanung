# Wettbewerber-Analyse: Lirex GmbH

**Stand:** 12. Februar 2026
**Quelle:** Automatisierte Analyse der Instanz `kebekuspartner.lirex.tech` (Kebekus & Partner)
**Analysemethode:** Puppeteer-basiertes Scraping aller Routen, API-Calls, Formulare, Tabellen

---

## 1. Was ist Lirex?

**Lirex** ist ein spezialisiertes **Bestell-, Zahlungs- und Freigabe-Tool für Insolvenzverfahren**. Hergestellt von der Lirex GmbH, eingesetzt von Insolvenzverwaltungskanzleien wie Kebekus & Partner.

| Eigenschaft | Detail |
|-------------|--------|
| **Hersteller** | Lirex GmbH |
| **Webseite** | lirex.de |
| **Technologie** | Angular (Frontend), REST-API (Backend), OAuth2 Auth |
| **Sprachen** | Deutsch + Englisch (i18n via `/framework/api/globalization/`) |
| **Version** | 20260211.164915.188 (tägliche Releases) |
| **Features** | Verfahrensverwaltung, Eigentumsvorbehalte, Bestell-/Zahlprozess, Freigaben, ToDos |

---

## 2. Architektur-Übersicht

### 2.1 Hauptnavigation (Top-Level)

```
┌─────────────────────────────────────────────────────────────────┐
│  TO DOS │ VERFAHREN │ EIGENTUMSVORBEHALTE │ BESTELL-/ZAHLPROZESS │
│         │           │                     │ FREIGABECENTER        │
│         │           │                     │ BENUTZERVERWALTUNG    │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Module & Routen

| Modul | Route | Zweck |
|-------|-------|-------|
| **ToDos** | `/todos` | Aufgabenverwaltung (Dashboard-Startseite) |
| **Verfahren** | `/verfahren/verfahrensleiter/verfahren` | Verfahrensliste + Stammdaten |
| **Eigentumsvorbehalte (EV)** | `/ev/verfahrensleiter/verfahren` | Lieferanten-Management |
| **Bestell-/Zahlprozess (BuZL)** | `/buzl/verfahrensleiter/verfahren` | Bestellungen, Zahlungen, Bankumsätze |
| **Freigabecenter** | `/ev/verfahrensleiter/freigabecenter` | Zentrale Freigabe-Ansicht |
| **Benutzerverwaltung** | `/benutzerverwaltung/verfahrensleiter/benutzerverwaltung` | User-Management |
| **Benutzerdaten** | `/benutzerverwaltung/verfahrensleiter/benutzerdaten` | Eigenes Profil |

### 2.3 URL-Schema

Alle Routen folgen dem Pattern: `/{modul}/{benutzergruppe}/{seite}/{verfahrenId?}/{unterseite?}`

Beispiel: `/buzl/verfahrensleiter/verfahren/1/bestellungen`
- `buzl` = Modul (Bestell-/Zahlprozess)
- `verfahrensleiter` = Rolle
- `verfahren/1` = Verfahren mit ID 1
- `bestellungen` = Unterseite

---

## 3. Modul-Details

### 3.1 Verfahren (Stammdaten)

Sehr umfangreiches Stammdaten-Formular mit folgenden Sektionen:

| Sektion | Felder |
|---------|--------|
| **Verfahren** | Bezeichnung, Verfahrensart (Regelinsolvenz / Eigenverwaltung) |
| **Unternehmen** | Firma/Name, Straße, PLZ, Ort, Land, USt-IdNr., Unternehmensgruppe |
| **IV / Sachwalter** | Name, Kanzlei, Adresse, Telefon, Fax, E-Mail, Sachwaltergruppe |
| **Termine** | Anordnung vorl. Verfahren, Eröffnung, Berichtstermin, Prüfungstermin, Abstimmung IV-Plan, Rechtskraftbestätigung, Masseunzulänglichkeit, Aufhebung |
| **Sonstiges** | Branche, Gericht (aus Dropdown), Aktenzeichen |
| **Besonderheiten** | Abwehrklausel Einkaufsbedingungen, EV-Vereinbarung Kreditversicherer |
| **Prüfer** | Name, Kanzlei, Adresse, Telefon, Fax, E-Mail, Prüfergruppe |
| **Lizenz** | Standard vs. Einzellizenz, E-Mail-Verteiler für Rechnungsversand |
| **Archivierung** | Abgeschlossen-Flag (sperrt Bearbeitung, blendet für Beteiligte aus) |

**Unterseiten:** Stammdaten, Unterlagen

### 3.2 Eigentumsvorbehalte (EV)

Verwaltung von Lieferanten und deren Forderungen im Insolvenzverfahren.

**Unterseiten:** Lieferanten, Insolvenztabelle, Forderungen, E-Mails, Importe, Exporte, Einstellungen

#### Lieferanten-Tabelle (Hauptansicht)

| Spalte | Beschreibung |
|--------|-------------|
| Lieferant | Name des Lieferanten |
| EV-Prüfung | Status der Eigentumsvorbehaltsprüfung |
| Forderungsprüfung | Status |
| Abrechnung | Status |
| Lieferantenpool | Zugehörigkeit |
| Zugeordnete Vorräte | EUR-Betrag |
| Forderung | EUR (bis Freigabe: importierter OPOS-Wert) |
| Erlös / Abrechnung | EUR (bis Abrechnungsvariante: rechnerischer Verwertungserlös) |
| Geleistete Zahlungen | EUR |

**Filter:** Lieferant (Text), EV-Prüfung, Forderungsprüfung, Abrechnung, Lieferantenpool, Forderung, Erlös, Zahlungen, WebLogin (jeweils alle/mit/ohne)

**Aktionen:** Neuer Lieferant, Export Datenblätter, Erweiterter Filter

#### EV-Einstellungen

- Standard-Zuweisung neue ToDos (Dropdown)
- E-Mail-Verteiler für Freigabebestätigungen Sachwalter
- Vorräte-Datenquelle: "Aus Vorräten (Summen je Lieferant)" vs. "Aus Artikellisten"
- Aktueller Sachstand freischalten (für Lieferant/Unternehmen)

### 3.3 Bestell- und Zahlprozess (BuZL) – KERNMODUL

Das umfangreichste Modul mit 13 Unterseiten:

**Unterseiten:** Bestellungen, Dauerschuldverhältnisse, Mietverhältnisse, AO-Bestellungen, Belege, Zahlungen, SEPA-Zahlungen, Bankumsätze, Kostenarten, Kreditoren, Debitoren, Importe, Exporte, Einstellungen

#### 3.3.1 Bestellungen

| Spalte | Beschreibung |
|--------|-------------|
| Produkt / Leistung | Beschreibung der Bestellung |
| Kreditor | Zugeordneter Kreditor |
| Auftragsnummer | Optional |
| Betrag | EUR |
| Status Unternehmen | Freigabe-Status |
| Status Sachwalter | Freigabe-Status |

**Filter:** Bestellung, Projekt, Auftragsnummer, Kreditor, Kostenart, Ersteller, Datum, nur ohne Zahlung, stornierte, nur eigene

**Bestelltypen:** Bestellung, Dauerschuldverhältnis, Mietverhältnis, AO-Bestellung

**Datei-Upload:** Drag & Drop direkt an Bestellung

#### 3.3.2 Bankumsätze

| Feature | Detail |
|---------|--------|
| **Bankkonto-Check** | IBAN, letzte Buchung, Saldo, Kontoauszüge vollständig |
| **Filter** | Bankkonto, Kontoauszug, Transaktionspartner, Verwendungszweck, Buchungsdatum, Betrag, Kostenart, Soll/Haben |
| **InsO-Buchhaltung** | Gegenkonto, EA-Konto, Buchungen ohne Gegenkonto, Mehrfachzuordnung |
| **Belegzuordnung** | Einzeln: Beleg zu Bankumsatz zuordnen |
| **Massenzuordnung** | Bulk: Mehrere Bankumsätze auf einmal zuordnen |

**Tabelle:**

| Spalte | Beschreibung |
|--------|-------------|
| Buchungsdatum | Datum |
| Transaktionspartner / Verwendungszweck / IBAN | Dreizeilig |
| Kreditor / Debitor / Kostenart / Zahlung | Zuordnung |
| Betrag | EUR |

#### 3.3.3 BuZL-Einstellungen (pro Verfahren)

**Freigabe-Schwellwerte (mehrstufig!):**

| Freigabe-Typ | Konfiguration |
|--------------|---------------|
| **Freigabe Bestellungen** | Betrag-Schwellwert (EUR), Checkbox: keine Freigabe für Fracht-Bestellungen |
| **Zustimmung Sachwalter Bestellungen** | Separater Betrag-Schwellwert |
| **Freigabe Zahlungen** | Betrag-Schwellwert (EUR) |
| **Zustimmung Sachwalter Zahlungen** | Separater Betrag-Schwellwert |
| **Gilt jeweils für:** | Bestellung, Dauerschuldverhältnis/Mietverhältnis, AO-Bestellung (separate Checkboxen) |

**Automatische Freigaben:**
- "Anfrage vor [Uhrzeit], Freigabe am Folgetag um [Uhrzeit]"
- Gilt nur für normale Bestellungen (nicht Dauerschuld, nicht AO)
- Bestellungen UND Zahlungen auf Bestellungen

**Weitere Einstellungen:**
- Stempel für PDF-Signatur (PNG, mind. 800px Breite)
- Beleg-Import: E-Mail-Adresse (z.B. `test.kebekuspartner@lirex.tech`), OCR-Scans/Monat (Kontingent: 100)
- Erlaubte E-Mail-Absender (Semikolon-getrennt)
- SEPA: Konto hinzufügen, FiBu-Berechtigung für SEPA-Dateien, E-Mail-Verteiler
- Standard-Zuweisung neue ToDos
- E-Mail-Verteiler für Bestätigungen

### 3.4 Freigabecenter

Zentrale Übersicht aller ausstehenden Freigaben pro Verfahren.

**Bestellungen-Tabelle:**

| Spalte | Beschreibung |
|--------|-------------|
| Bestellung | Bezeichnung |
| Kreditor | Name |
| Typ | Bestellung / Dauerschuld / AO |
| Betrag | EUR |
| Kostenart | Zugeordnet |
| Einzellimit | EUR (Schwellwert) |
| Kostenlimit | EUR (Budget) |
| Chat | Kommunikation |
| Freigabe Geschäftsführer | Status |
| Freigabe Sachwalter | Status |
| Freigabe | Aktion |

**Zahlungen-Tabelle:** Ähnlich, zusätzlich mit "nur fällige Zahlungen bis zum [Datum]"

### 3.5 ToDo-System

| Feature | Detail |
|---------|--------|
| **Arten** | Bankumsatz, E-Mail, Forderung prüfen, Freigabe Sachwalter, Lieferantenaktivität, Manuell erfasst, Rückfrage Sachwalter, Rückfrage Verfahrensleiter |
| **Filter** | Volltext, Zuordnung, Verfahren, Art, Priorität (Hoch/Normal/Niedrig), Ersteller, Datum |
| **Aktionen** | Neues ToDo, "auch erledigte ToDos anzeigen" |
| **Benachrichtigung** | Info-Mail bei neuen ToDos (konfigurierbar) |
| **Zuweisung** | Standard-Zuweisung pro Verfahren konfigurierbar |

### 3.6 Benutzerverwaltung

**Benutzer-Tabelle:**

| Spalte | Beschreibung |
|--------|-------------|
| Name | Anzeigename |
| Web-Login | Status |
| Login | Username |
| E-Mail | Kontakt |
| Benutzergruppe | Rolle |
| Freigeschaltet | Aktiv-Status |

**Benutzerdaten (Profil):**
- Stammdaten: Anrede, Vorname, Nachname, E-Mail, Kreditornummer
- E-Mail-Signatur (Textarea)
- Stempel für PDF-Signatur (PNG-Upload)
- Zuordnung: Benutzergruppe
- Einstellungen: Info-Mail bei ToDos, Info-Mail bei Freigabeanfragen
- Login: Username, Passwort ändern, Freigeschaltet, Login-Fehlversuche
- 2-Faktor-Authentifizierung

---

## 4. Rollen-System

| Gruppe | ID | Typischer Nutzer |
|--------|-----|-----------------|
| **Verwaltung** | 1 | Kanzlei-Administration |
| **Verfahrensleiter** | 2 | Insolvenzverwalter (IV) |
| **Sachbearbeiter** | 3 | Mitarbeiter der Kanzlei |
| **Lieferant** | 4 | Externer Lieferant (Portal-Zugang) |
| **Sachwalter** | 5 | Sachwalter (Eigenverwaltung) |
| **Unternehmen** | 6 | Schuldner-Unternehmen |
| **Lieferantenpool** | 7 | Pool-Verwaltung |
| **Einkauf** | 8 | Einkaufsabteilung |
| **Finanzbuchhaltung** | 9 | FiBu-Abteilung |
| **Geschäftsführer** | 10 | GF des Schuldner-Unternehmens |
| **Prüfer** | 12 | Externer Prüfer |

**Rechte-Granularität:** Feld-Level! Jedes API-Feld hat `{value: ..., right: 3}` wobei `right` das Berechtigungslevel angibt (1=Lesen, 3=Bearbeiten).

---

## 5. API-Architektur

### 5.1 Authentifizierung
- **OAuth2 Token-basiert:** `POST /framework/oauth/token` → `access_token`
- **Passwort-Verschlüsselung:** Public-Key-Austausch via `/framework/api/encryption`
- **2FA:** Konfigurierbar pro Benutzer

### 5.2 API-Namespaces

| Namespace | Modul |
|-----------|-------|
| `/api/` | Core (Verfahren, Benutzer, ToDos, Gerichte, etc.) |
| `/BuZL/api/` | Bestell- und Zahlprozess |
| `/framework/api/` | Framework (i18n, Auth, Encryption) |

### 5.3 Wichtige API-Endpunkte

| Endpunkt | Methode | Zweck |
|----------|---------|-------|
| `/api/Verfahren/List` | POST | Verfahren auflisten (paginiert) |
| `/api/Verfahren/Get?verfahrenId=X` | GET | Verfahren-Detail |
| `/api/Lieferant/List` | POST | Lieferanten auflisten |
| `/api/ToDo/List` | POST | ToDos auflisten |
| `/api/ToDoArt/ListForSelect` | POST | ToDo-Arten Dropdown |
| `/api/Benutzer/List` | POST | Benutzer auflisten |
| `/api/Gericht/ListForSelect` | POST | Gerichte Dropdown (alle deutschen Gerichte!) |
| `/api/PersonalizationSettings/Get` | GET | Aktiver Benutzer |
| `/api/FreigabeCenter/GetVerfahrenListForFreigabe` | GET | Freigabe-Übersicht |
| `/BuZL/api/BuZLBestellung/ListBestellungen` | POST | Bestellungen auflisten |
| `/BuZL/api/BuZLBankumsatz/List` | POST | Bankumsätze auflisten |
| `/BuZL/api/BuZLBankkonto/KontoCheck` | POST | Bankkonto-Vollständigkeit |
| `/BuZL/api/BuZLFreigabeCenter/Get` | GET | Freigabecenter-Daten |
| `/BuZL/api/BuZLKreditor/ListForSelect` | POST | Kreditoren Dropdown |
| `/BuZL/api/BuZLKostenarten/ListForSelect` | POST | Kostenarten Dropdown |
| `/BuZL/api/BuZLSEPA/GetSEPASettings` | GET | SEPA-Konfiguration |
| `/api/Pagetrack/Track` | POST | Nutzungstracking |

### 5.4 Datenformat-Patterns

**Paginierung:**
```json
{
  "page": 1,
  "pageSize": 50,
  "totalCount": 1,
  "items": [...]
}
```

**Feld-Level-Rechte:**
```json
{
  "bezeichnung": {
    "value": "test gmbh",
    "right": 3
  }
}
```

**Verfahrensarten:**
```json
[
  {"value": 1, "label": "Regelinsolvenz"},
  {"value": 2, "label": "Eigenverwaltung"}
]
```

---

## 6. Besondere Features

### 6.1 Beleg-Import per E-Mail + OCR
- Dedizierte E-Mail-Adresse pro Verfahren (z.B. `test.kebekuspartner@lirex.tech`)
- Automatische OCR-Erkennung (100 Scans/Monat Kontingent)
- Erlaubte Absender konfigurierbar (Spam-Schutz)

### 6.2 Automatische Freigaben (Zeitbasiert)
- Konfigurierbar: "Anfrage vor X Uhr → Freigabe am Folgetag um Y Uhr"
- Reduziert manuelle Arbeit bei Routinebestellungen
- Nur für normale Bestellungen, nicht für Dauerschuld/AO

### 6.3 SEPA-Dateien
- Konten direkt in Lirex verwalten
- SEPA-Dateien (XML) generieren für Bankimport
- FiBu kann SEPA-Dateien erstellen (konfigurierbar)

### 6.4 Stempel für PDF-Signatur
- Auf Benutzer- ODER Verfahrensebene
- PNG-Upload (mind. 800px Breite)
- Verfahrensstempel hat Vorrang vor Benutzerstempel

### 6.5 Feld-Level-Berechtigungen
- Jedes einzelne Datenfeld hat ein `right`-Attribut (1-3)
- Erlaubt extrem granulare Sichtbarkeit und Bearbeitungsrechte
- Unterschiedliche Rollen sehen unterschiedliche Felder

### 6.6 Chat-Funktion bei Freigaben
- Direkt in der Freigabecenter-Tabelle
- Kommunikation zu einzelnen Bestellungen/Zahlungen

### 6.7 Internationalisierung (i18n)
- Vollständiges Globalization-API
- Deutsch als Standard, Englisch verfügbar
- Alle Labels dynamisch geladen

### 6.8 Nutzungstracking
- `POST /api/Pagetrack/Track` bei jeder Seitennavigation
- Ermöglicht Audit-Trail und Nutzungsanalyse

---

## 7. Was Lirex NICHT hat (vs. unser Tool)

| Feature | Lirex | Unser Tool |
|---------|-------|------------|
| **Liquiditätsplanung** | Nicht vorhanden | Kernfeature (13 Wochen / 11 Monate) |
| **IST/PLAN-Vergleich** | Nicht vorhanden | Vollständig |
| **Alt/Neu-Masse-Zuordnung** | Nicht vorhanden | Split-Engine mit Fallback-Kette |
| **Kassenbuch (Ledger)** | Rudimentär (Bankumsätze) | Single Source of Truth |
| **Klassifikation Engine** | Nicht vorhanden | Rule-basiert mit Vorschlägen |
| **AI-Preprocessing** | OCR nur für Belege | PDF → strukturierte Daten |
| **Prognose (Forecast)** | Nicht vorhanden | 3 Szenarien mit Wachstumsfaktoren |
| **Estate Allocation** | Nicht vorhanden | Fallback-Kette (5 Stufen) |
| **Audit Trail (Ledger)** | Nicht sichtbar | Vollständiges AuditLog |
| **Share Links** | Nicht vorhanden | Tokenisierte externe Zugriffe |
| **Standort-Analyse** | Nicht vorhanden | Location-P&L, Standort-Vergleich |
| **Massekredit-Berechnung** | Nicht vorhanden | Automatisch mit Fortführungsbeitrag |

---

## 8. Rohdaten

Die vollständigen Scrape-Ergebnisse liegen in `/tmp/`:
- `lirex-analyse.md` + `.json` – Top-Level-Seiten (7 Routen)
- `lirex-deep-analyse.md` + `.json` – Detail-Seiten (20 Routen, 64 API-Calls)
