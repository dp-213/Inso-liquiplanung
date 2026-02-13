# Hilfe & Anleitungen

> Zuletzt aktualisiert: 2026-02-13 | Version 2.46.0

Dieses Dokument ist die **Source-of-Truth** für die Hilfe-Seite im Admin-Dashboard.
Bei Änderungen am System wird diese Datei über `/doku` mit-aktualisiert.

---

## 1. Systemübersicht

### Was macht dieses System?

Die **Inso-Liquiplanung** unterstützt Insolvenzverwalter bei der Liquiditätsplanung laufender Insolvenzverfahren. Das System:

- Importiert **echte Bankbuchungen** (IST-Daten) aus Kontoauszügen
- Ermöglicht **Prognose-Annahmen** für zukünftige Ein- und Auszahlungen
- Berechnet automatisch einen **Rolling Forecast** (IST + Prognose)
- Trennt alle Buchungen in **Altmasse** und **Neumasse**
- Dokumentiert Planungsgrundlagen für Gericht und Gläubigerausschuss

### Wer nutzt das System?

| Rolle | Zugang | Kann |
|-------|--------|------|
| **Berater (Admin)** | Admin-Dashboard | Alles: Import, Klassifikation, Planung, Freigaben |
| **Insolvenzverwalter (Kunde)** | Kunden-Portal | Dashboard lesen, Berichte einsehen, Bestellungen freigeben |
| **Externe (Share-Link)** | Nur-Lese-Link | Dashboard ohne Rolling Forecast einsehen |

---

## 2. Kernkonzepte

### IST vs. PLAN vs. PROGNOSE

| Typ | Farbe | Bedeutung | Quelle |
|-----|-------|-----------|--------|
| **IST** | Grün | Echte Bankbuchungen | Kontoauszüge (importiert) |
| **PROGNOSE** | Blau | Berechnete Zukunftswerte | Aus Ihren Annahmen (Forecast-Engine) |
| **PLAN** | Lila | Statische Planwerte | Legacy-Daten (werden durch PROGNOSE ersetzt) |
| **Mix** | Gelb | IST und PLAN gemischt | Übergangsperioden |

**Prioritätsregel:** Sobald echte Bankdaten vorliegen, ersetzen sie automatisch Prognose- und Planwerte.

### Altmasse vs. Neumasse

- **Altmasse**: Forderungen und Verbindlichkeiten, die **vor** Insolvenzeröffnung entstanden sind
- **Neumasse**: Forderungen und Verbindlichkeiten, die **nach** Insolvenzeröffnung entstanden sind
- Der Stichtag ist das **Datum der Insolvenzeröffnung**
- Manche Zahlungen (z.B. KV-Abrechnungen) betreffen beide Massen anteilig

### Perioden

- **Monatlich**: Jede Periode = ein Kalendermonat (z.B. 11 Monate)
- **Wöchentlich**: Jede Periode = eine Kalenderwoche (z.B. 13 Wochen)
- Der Periodentyp und die Periodenzahl werden pro Fall konfiguriert

### Opening Balance (Eröffnungssaldo)

Das System arbeitet mit **zwei verschiedenen Perspektiven**:

| Ansicht | Startwert | Zweck |
|---------|-----------|-------|
| **Dashboard** | 0 EUR | Cashflow-Entwicklung: "Generieren wir positiven Cashflow?" |
| **Prognose-Seite** | Editierbar (echter Kontostand) | Absolute Liquidität + Headroom: "Reicht das Geld?" |

Das Dashboard zeigt die Cashflow-Entwicklung ab 0 EUR. Die Prognose-Seite zeigt die tatsächliche Liquidität mit echtem Kontostand und Kreditlinien-Headroom. Beide Perspektiven ergänzen sich und sind kein Widerspruch.

---

## 3. Workflow: Von Daten zum Dashboard

### Schritt 1: Daten importieren

**Wo:** DATEN → Import

1. CSV-Datei vom Bankkonto hochladen
2. Spalten zuordnen (Datum, Betrag, Beschreibung, ...)
3. Import starten → Buchungen landen als `UNREVIEWED` im Zahlungsregister

### Schritt 2: Buchungen klassifizieren

**Wo:** ANALYSE → Klassifikation

1. Automatische Vorschläge prüfen (Gegenpartei, Masse-Zuordnung)
2. **CategoryTag-Vorschläge generieren:** Button „Tags vorschlagen" im Zahlungsregister ordnet Buchungen automatisch Matrix-Kategorien zu (basierend auf Gegenpartei-ID, Namens-Muster oder Buchungstext)
3. Vorschläge akzeptieren oder manuell anpassen
4. Buchungen bestätigen (`CONFIRMED`)

### Schritt 3: Berechnungsannahmen dokumentieren

**Wo:** PLANUNG → Berechnungsannahmen

3 Blöcke auf einer Seite:
1. **Datenqualität (auto):** IST/PLAN-Counts, Confirmed%, Estate-Breakdown — wird automatisch berechnet
2. **Planungsannahmen:** Textuelle Beschreibung der Planungsgrundlagen mit Status (ANNAHME/VERIFIZIERT/WIDERLEGT) und Links zu Stammdaten-Modulen
3. **Prognose-Annahmen (read-only):** Zeigt die Forecast-Annahmen mit Methodik und Risiko-Bewertung

Dient als Audit-Trail für Gericht und Gläubigerausschuss.

### Schritt 4: Prognose-Annahmen pflegen

**Wo:** PLANUNG → Prognose

Die Prognose-Seite funktioniert wie eine Excel-Tabelle:

1. **Eröffnungssaldo setzen:** Klick auf den Saldo-Wert in der Szenario-Bar → Inline-Eingabe
2. **Neue Annahme hinzufügen:** „+ Neue Einzahlung/Auszahlung" → 4-Felder-Formular direkt in der Tabelle (Bezeichnung, Typ, Betrag, Quelle). Enter speichert und hält das Formular offen für den nächsten Eintrag.
3. **Betrag ändern:** Klick auf eine Prognose-Zelle → Eingabefeld mit gelbem Rahmen. Tab → nächste Zelle, Enter → speichern, Escape → abbrechen. Ctrl+Z → letzten Save rückgängig machen.
4. **Erweiterte Felder:** Klick auf den Zeilen-Namen → Drawer (SlideOver) mit allen Feldern: Wachstumsfaktor, Perioden-Range (mit Monatsnamen), Notiz, Aktiviert/Deaktiviert Toggle, Löschen.
5. **Live-Ergebnis:** IST-Perioden (grau, nicht editierbar) und PROGNOSE-Perioden (blau, editierbar) in einer Tabelle. Summen und Headroom aktualisieren sich automatisch nach jedem Save.
6. **Automatische Dashboard-Integration:** Aktive Annahmen fließen sofort ins Dashboard.

### Schritt 5: Dashboard ablesen

**Wo:** PLANUNG → Liquiditätsplan (oder Übersicht)

- Rolling Forecast Chart: IST (grün) + PROGNOSE (blau gestrichelt)
- Rolling Forecast Tabelle: Jede Periode mit Quelle-Badge
- HEUTE-Markierung zeigt aktuelle Periode
- Bei negativem Saldo: Rote Hervorhebung als Warnsignal

---

## 4. Bereiche im Detail

### DATEN

| Seite | Zweck |
|-------|-------|
| **Zahlungsregister** | Alle Buchungen (IST + PLAN) in einer Übersicht. Filtern, Suchen, Bearbeiten. Zahlbeleg-Upload für Sammelüberweisungen. |
| **Import** | Neue Kontoauszüge als CSV importieren. Spalten-Mapping, Duplikat-Erkennung. |

### STAMMDATEN

Alle Stammdaten-Seiten haben eine **Live-Suchleiste** und **sortierbare Spaltenheader** (Klick auf Spaltenname wechselt asc/desc).

| Seite | Zweck |
|-------|-------|
| **Bankkonten** | Alle Bankkonten des Falls. Liquiditätsrelevanz markieren. |
| **Gegenparteien** | Einnahmen-Partner (KV, HZV, PVS). Für Klassifikation und Reporting. Typ-Filter. |
| **Kostenarten** | Kategorisierung von Ausgaben mit optionalem Budget. Mapping auf Liquiditätsmatrix-Tags. |
| **Standorte** | Betriebsstätten des Unternehmens. Für standortbezogene Auswertungen. |

### FALLDATEN

Auch FALLDATEN-Seiten haben Live-Suche und sortierbare Spalten.

| Seite | Zweck |
|-------|-------|
| **Personal** | Mitarbeiter mit Gehaltsdaten (Steuerbrutto pro Monat), Standort-Zuordnung, LANR. |
| **Kontakte** | Ansprechpartner (IV, Berater, Buchhaltung, RA) mit E-Mail, Telefon, Notizen. |
| **Banken & Sicherungsrechte** | Kreditlinien, Sicherungsvereinbarungen. Kreditlinie fließt in Headroom ein. |
| **Finanzierung** | Finanzierungsstruktur und Massekredite. |
| **Insolvenzeffekte** | Rückstellungen, Sondereffekte. Fließen in Headroom-Berechnung ein. |
| **Business-Logik** | Regelwerk für Klassifikation und Masse-Zuordnung. |
| **Freie Planung** | Manuelle Planwerte direkt eingeben (PLAN-LedgerEntries). Für Positionen, die nicht über die Forecast-Engine laufen. |

### PLANUNG

| Seite | Zweck |
|-------|-------|
| **Berechnungsannahmen** | 3-Block-Ansicht: Datenqualität (auto), Planungsannahmen (Dokumentation), Prognose-Annahmen (read-only). |
| **Prognose** | Annahmen-Editor für Zukunftswerte. Berechnet Cashflows + Headroom. |
| **Liquiditätsplan** | Dashboard mit Rolling Forecast (IST + PROGNOSE kombiniert). |

### ANALYSE

| Seite | Zweck |
|-------|-------|
| **IST-Daten** | Detailansicht aller importierten Kontobewegungen. |
| **Geschäftskonten** | Vorinsolvenz-Analyse: Kontobewegungen vor und nach Eröffnung nach Kategorie gruppiert, mit Standort-Aufschlüsselung, Trend-Pfeilen und CSV-Export. |
| **Klassifikation** | Automatische und manuelle Zuordnung von Buchungen. |
| **Verifikation** | SOLL/IST-Abgleich: Wurden geplante Zahlungen tatsächlich ausgeführt? |
| **IV-Kommunikation** | Kommunikationshistorie mit dem Insolvenzverwalter. |

### BESCHAFFUNG

| Seite | Zweck |
|-------|-------|
| **Bestellfreigaben** | Auszahlungsanweisungen zur Freigabe durch den IV. Auto-Freigabe bei Beträgen unter konfiguriertem Schwellwert. |
| **Kreditoren** | Ausgaben-Partner (Lieferanten, Dienstleister, Behörden). IBAN, USt-ID, Standard-Kostenart. Kategorie-Filter. |

### ZUGANG

| Seite | Zweck |
|-------|-------|
| **Freigaben** | Kundenzugänge + externe Share-Links verwalten. Neuen Kunden anlegen und Fall freigeben in einem Schritt. Externe Links für Nur-Lese-Zugriff (Gläubigerausschuss, Gericht). |

### VERWALTUNG

| Seite | Zweck |
|-------|-------|
| **System** | Zentrales Diagnose-Dashboard: Daten-Übersicht (IST-Buchungen, Review-Status, Gegenpartei-Zuordnung, Alt/Neu-Verteilung), alle 6 Konfigurationsprüfungen, Aggregations-Status mit Rebuild-Button, Import-Historie, Freigabe-Links. Auto-Refresh alle 30s. |
| **Fall bearbeiten** | Name, Aktenzeichen, Status und Datumsfelder des Falls anpassen. |

---

## 5. Häufig gestellte Fragen

### Daten & Import

**Welche Dateiformate werden unterstützt?**
CSV-Dateien von allen gängigen Banken. Das System erkennt Spaltenformate automatisch oder lässt sie manuell zuordnen.

**Was passiert bei doppelten Buchungen?**
Das System prüft auf Duplikate anhand von Bankkonto, Datum und Betrag. Erkannte Duplikate werden markiert und können übersprungen werden.

**Warum sehe ich "Ungeprüfte Buchungen"?**
Neu importierte Buchungen haben den Status `UNREVIEWED`. Sie müssen erst über die Klassifikation geprüft und bestätigt werden, bevor sie in die Planung einfließen.

**Wie funktioniert die Zahlbeleg-Aufschlüsselung?**
Sammelüberweisungen fassen mehrere Zahlungen zusammen. Um die Einzelposten (Empfänger, Betrag, IBAN) sichtbar zu machen, laden Sie die Zahlbelege als JSON im Zahlungsregister hoch. Das System matcht automatisch gegen bestehende Buchungen. Nach Prüfung des Matchings klicken Sie auf „Splits ausführen" – die Sammelüberweisung wird in aufklappbare Einzelposten aufgeteilt.

### Prognose & Dashboard

**Woher kommen die blauen PROGNOSE-Werte im Dashboard?**
Aus Ihren Annahmen auf der Prognose-Seite (PLANUNG → Prognose). Jede aktive Annahme erzeugt Cashflows für zukünftige Perioden.

**Warum startet das Dashboard bei 0 EUR?**
Das Dashboard zeigt die Cashflow-Entwicklung, nicht den absoluten Kontostand. So sehen Sie auf einen Blick, ob das Unternehmen positiven oder negativen Cashflow generiert. Den echten Kontostand mit Headroom finden Sie auf der Prognose-Seite.

**Was ist der Unterschied zwischen Planungsannahmen und Prognose-Annahmen?**
- **Planungsannahmen** (Block 2) sind textuelle Beschreibungen mit Status (ANNAHME/VERIFIZIERT/WIDERLEGT) für die Dokumentation gegenüber Gericht und Gläubigern. Keine Berechnung.
- **Prognose-Annahmen** (Block 3) sind Zahlenwerte (EUR pro Periode) mit Methodik und Risiko-Bewertung, die in die Berechnung einfließen.

**Was bedeutet "Headroom"?**
Headroom = Kontostand + verfügbare Kreditlinie - Rückstellungen. Es ist der finanzielle Spielraum. Wird der Headroom negativ, droht Zahlungsunfähigkeit.

**Was passiert, wenn ich eine Annahme deaktiviere?**
Die Annahme fließt nicht mehr in die Berechnung ein. Im Dashboard werden die entsprechenden PROGNOSE-Werte auf 0 gesetzt bzw. es wird auf PLAN-Fallback umgeschaltet, wenn keine aktiven Annahmen mehr vorhanden sind.

**Warum sehe ich "PLAN" statt "PROGNOSE" im Dashboard?**
PLAN ist der Legacy-Fallback. Er wird angezeigt, wenn:
- Kein Forecast-Szenario existiert (Prognose-Seite noch nie geöffnet)
- Keine aktiven Annahmen vorhanden sind
- Bei standortbezogenen Auswertungen (nur GLOBAL nutzt Forecast)

### Datenqualität & System-Diagnose

**Wo finde ich die Datenqualitäts-Checks?**
Unter VERWALTUNG → System. Das System Health Panel prüft automatisch 6 Konsistenzregeln (mit Auto-Refresh alle 30 Sekunden):
1. Gegenpartei ↔ Kategorie-Tag stimmen überein
2. Buchungen mit Kategorie-Tag haben passende Gegenpartei
3. Alt/Neu-Zuordnung passt zum Leistungszeitraum (nur KV)
4. Buchungstexte passen zum Pattern der zugewiesenen Gegenpartei
5. Alle referenzierten Stammdaten (Standort, Bankkonto, Gegenpartei) existieren
6. Gegenparteien mit 5+ IST-Buchungen haben ein Match-Pattern hinterlegt

Fehlgeschlagene Checks sind aufklappbar mit Detail-Items und Deep-Links zum Zahlungsregister.

**Warum sehe ich keine Datenqualitäts-Hinweise auf dem Dashboard?**
Seit v2.46.0 werden alle System-Diagnose-Informationen zentral im System Health Panel angezeigt (VERWALTUNG → System), nicht mehr auf dem Dashboard oder anderen Seiten.

### Masse-Zuordnung

**Wie wird entschieden, ob eine Zahlung Alt- oder Neumasse ist?**
Das System nutzt eine Fallback-Kette:
1. **Vertragsregel** (z.B. KV Q4/2025: 1/3 Alt, 2/3 Neu)
2. **Leistungsdatum-Regel** (Leistung vor/nach Eröffnung)
3. **Zeitanteilige Aufteilung** (pro rata)
4. **Vormonat-Logik** (bei monatlichen Abrechnungen)
5. **UNKLAR** (manuell zu klären)

Jede Zuordnung wird mit einer Begründung (Audit-Trail) versehen.

### Zugang & Freigaben

**Wie gebe ich einem Kunden Zugriff auf einen Fall?**
Über ZUGANG → Freigaben → „Fall freigeben":
1. Bestehenden Kunden aus der Liste wählen oder neuen Kunden anlegen (Name, E-Mail, optional Subdomain-Slug)
2. Zugriff bestätigen
3. Einladungstext mit Login-URL und Passwort kopieren und an den Kunden senden

Bei neuen Kunden wird automatisch ein sicheres Passwort generiert und im Einladungstext angezeigt.

**Was ist eine Subdomain / ein Slug?**
Ein Slug wie `anchor` erzeugt eine individuelle URL: `anchor.cases.gradify.de`. Der Kunde loggt sich dort direkt ein, statt über `cases.gradify.de/customer-login`. Regeln: lowercase, Buchstaben/Zahlen/Bindestriche, 3–30 Zeichen.

**Wie sieht der Insolvenzverwalter die Daten?**
Über das Kunden-Portal (direkt oder via Subdomain). Dort sieht er das Dashboard mit Rolling Forecast, kann aber keine Daten ändern. Admin-Links (wie "Annahmen bearbeiten") sind im Portal nicht sichtbar.

**Was ist der Unterschied zwischen Kundenzugängen und externen Links?**
- **Kundenzugänge:** Persönliches Login mit E-Mail/Passwort. Voller Portal-Zugriff inkl. Rolling Forecast. Zugriff widerrufbar.
- **Externe Links:** Token-basierte URL ohne Login. Nur-Lese-Dashboard ohne Rolling Forecast. Zeitlich begrenzbar.

**Was sehen externe Empfänger eines Share-Links?**
Eine Nur-Lese-Ansicht des Dashboards ohne Rolling Forecast (Chart und Tabelle). Nur die Grunddaten und Zusammenfassungen.

### Bestellfreigaben & Auto-Freigabe

**Was ist der Auto-Freigabe-Schwellwert?**
Unter Fall bearbeiten → „Freigabe-Einstellungen" kann ein EUR-Betrag definiert werden. Anfragen bis einschließlich diesem Betrag werden automatisch freigegeben (Status: AUTO_APPROVED) und sofort als PLAN-LedgerEntry verbucht. Anfragen über dem Schwellwert bleiben zur manuellen Prüfung.

**Was sind Kreditoren und Kostenarten?**
- **Kreditoren:** Ausgaben-Partner (Lieferanten, Dienstleister, Behörden) unter BESCHAFFUNG. Mit IBAN, USt-ID, Kategorie und Standard-Kostenart.
- **Kostenarten:** Kategorisierung von Ausgaben (z.B. Personal, Miete, Material) mit optionalem Budget und Mapping auf die Liquiditätsmatrix-Tags.
- Beide sind optional: Orders können auch ohne Kreditor/Kostenart-Zuordnung eingereicht werden.

---

## 6. Glossar

| Begriff | Erklärung |
|---------|-----------|
| **Altmasse** | Vermögenswerte und Verbindlichkeiten vor Insolvenzeröffnung |
| **Closing Balance** | Endbestand einer Periode (Opening + Einzahlungen + Auszahlungen) |
| **Datenqualitäts-Check** | Automatische Konsistenzprüfung im System Health Panel (6 Regeln, aufklappbar mit Deep-Links) |
| **Employee** | Mitarbeiter eines Falls mit Gehaltsdaten, Standort-Zuordnung und LANR |
| **Eröffnungssaldo** | Kontostand zu Beginn des Planungszeitraums |
| **BESCHAFFUNG** | Sidebar-Sektion für Einkauf und Lieferanten (Bestellfreigaben, Kreditoren) |
| **FALLDATEN** | Sidebar-Sektion für fallspezifische Informationen (Personal, Kontakte, Banken, Finanzierung, Insolvenzeffekte, Business-Logik, Freie Planung) |
| **Freie Planung** | Manuelle PLAN-LedgerEntries für Positionen außerhalb der Forecast-Engine |
| **Forecast Engine** | Berechnungsmodul, das aus Annahmen Cashflow-Prognosen erzeugt |
| **Geschäftskonten** | Vorinsolvenz-Analyse: Kontobewegungen nach Kategorie gruppiert mit Standort-Aufschlüsselung |
| **Headroom** | Finanzieller Spielraum = Kontostand + Kreditlinie - Rückstellungen |
| **IST-Daten** | Echte Bankbuchungen aus importierten Kontoauszügen |
| **IV** | Insolvenzverwalter |
| **LANR** | Lebenslange Arztnummer – Pflichtangabe für Ärzte in der Personalverwaltung |
| **Kostenart** | Kategorisierung von Ausgaben (z.B. Personal, Miete) mit optionalem Budget |
| **Kreditor** | Ausgaben-Partner (Lieferant, Dienstleister, Behörde) – getrennt von Gegenpartei |
| **Kreditlinie** | Vereinbarter Massekredit mit der Bank |
| **LedgerEntry** | Einzelne Buchung im Zahlungsregister (zentrale Dateneinheit) |
| **Neumasse** | Vermögenswerte und Verbindlichkeiten nach Insolvenzeröffnung |
| **Opening Balance** | Anfangsbestand einer Periode |
| **Periode** | Zeitabschnitt (Woche oder Monat) in der Liquiditätsplanung |
| **PaymentBreakdown** | Zahlbeleg-Aufschlüsselung – splittet Sammelüberweisungen in Einzelposten |
| **PLAN** | Statische Planwerte (Legacy, wird durch PROGNOSE ersetzt) |
| **Prämisse** | Textuelle Planungsannahme für Dokumentation |
| **PROGNOSE/FORECAST** | Berechnete Zukunftswerte aus aktiven Annahmen |
| **Rolling Forecast** | Kombination aus IST (Vergangenheit) und PROGNOSE (Zukunft) |
| **Rückstellung** | Reservierte Mittel für erwartete Verbindlichkeiten |
| **Slug** | Subdomain-Kennung eines Kunden (z.B. `anchor` → `anchor.cases.gradify.de`) |
| **System** | Zentrales Diagnose-Dashboard pro Fall: Daten-Übersicht, Konfigurationsprüfungen, Import-Historie |
| **Subdomain** | Individuelle URL für einen Kunden mit eigenem Login |
| **Szenario** | Planungskonfiguration (Periodentyp, Zeitraum, Eröffnungssaldo) |
