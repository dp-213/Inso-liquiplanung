# Feature-Abgleich: Lirex vs. Inso-Liquiplanung

**Stand:** 12. Februar 2026
**Zweck:** Systematischer Vergleich der beiden Tools, Identifikation von Best Practices und Handlungsempfehlungen

---

## 1. Positionierung

| Aspekt | Lirex | Unser Tool |
|--------|-------|------------|
| **Kernfokus** | Bestell-/Zahlprozess + Eigentumsvorbehalte | Liquiditätsplanung + Kassenbuch |
| **Zielgruppe** | IV-Kanzlei (Verfahrensleiter, Sachbearbeiter, GF, Sachwalter, Lieferanten) | IV + Berater (Admin, Kunden-Portal) |
| **Stärke** | Mehrstufige Freigabe-Workflows, Lieferantenverwaltung, SEPA | Berechnung, Alt/Neu-Zuordnung, Prognose, Datenanalyse |
| **Technologie** | Angular + proprietäres Backend | Next.js 15 + Prisma + Turso |
| **Preismodell** | Pro Verfahren (Lizenzmodell) | Eigenbetrieb |

**Fazit:** Die Tools ergänzen sich – Lirex ist stark im operativen Tagesgeschäft (Bestellungen, Zahlungen, Lieferanten), wir sind stark in der analytischen Planung (Liquidität, Alt/Neu, Forecast). Überschneidung gibt es beim Freigabe-Workflow und bei Bankumsätzen.

---

## 2. Feature-für-Feature-Vergleich

### Legende
- Haben wir = Feature vorhanden und funktional
- Teilweise = Feature existiert, aber weniger ausgereift als bei Lirex
- Fehlt = Feature nicht vorhanden
- Besser = Unser Feature ist weiter als bei Lirex

### 2.1 Verfahrensverwaltung (Stammdaten)

| Feature | Lirex | Wir | Bewertung |
|---------|-------|-----|-----------|
| Verfahren anlegen (Bezeichnung, Art) | Voll | Haben wir (`Case`) | Gleichwertig |
| Unternehmensdaten (Firma, Adresse, USt-IdNr.) | Umfangreich | Nur `debtorName` | **Lücke** |
| IV/Sachwalter-Kontaktdaten | Vollständig | Nicht im Schema | **Lücke** |
| Termine (Eröffnung, Berichtstermin, etc.) | 8 Terminfelder | Nur `openingDate` + `cutoffDate` | **Lücke** |
| Gericht + Aktenzeichen | Dropdown aller Gerichte | `courtName` + `caseNumber` (Freitext) | Ausreichend |
| Verfahrensart (Regelinsolvenz/EV) | Dropdown | Nicht explizit | **Lücke** |
| Archivierung (Abschluss) | Sperrt Bearbeitung | Nicht vorhanden | Nice-to-Have |
| Prüfer-Daten | Vollständig | Nicht vorhanden | Nice-to-Have |
| Branche | Vorhanden | Nicht vorhanden | Nice-to-Have |

### 2.2 Bestell- und Zahlprozess (Freigabe-Workflow)

| Feature | Lirex | Wir | Bewertung |
|---------|-------|-----|-----------|
| Bestellungen erfassen | Produkt, Kreditor, Auftragsnr., Betrag | Typ, Betrag, Kreditor, Beschreibung | **Wir simpler** |
| Zahlungen erfassen | Separate Entität | Im selben Order-Modell (type=ZAHLUNG) | Gleichwertig |
| Dauerschuldverhältnisse | Eigene Kategorie | Nicht vorhanden | **Important** |
| Mietverhältnisse | Eigene Kategorie | Nicht vorhanden | **Important** |
| AO-Bestellungen | Eigene Kategorie | Nicht vorhanden | Nice-to-Have |
| Mehrstufige Freigabe | VL → GF → Sachwalter (3 Stufen) | Admin genehmigt (1 Stufe) | **Lücke** |
| Betrag-Schwellwerte | Pro Stufe + Typ konfigurierbar | Nicht vorhanden | **Important** |
| Automatische Freigaben | Zeitbasiert (Deadline + Folgetag) | Nicht vorhanden | Nice-to-Have |
| Datei-Upload bei Bestellung | Drag & Drop | Base64-Upload | Gleichwertig |
| Abweichender Betrag genehmigen | Nicht sichtbar | `approvedAmountCents` vorhanden | **Wir besser** |
| Freigabecenter (Übersicht) | Dedizierte Seite pro Verfahren | Inline in Admin-Orders | Gleichwertig |
| Chat bei Freigaben | Pro Bestellung/Zahlung | Nicht vorhanden | Nice-to-Have |
| Stornierung | Vorhanden | `REJECTED` Status | Gleichwertig |
| Kostenarten | Konfigurierbar pro Verfahren | Nicht vorhanden | **Important** |
| Kreditoren-Verwaltung | Eigene Entity mit Kreditornummer | Freitext `creditor` | **Lücke** |
| Kostenlimits (Budget) | Einzel- + Kostenlimit | Nicht vorhanden | **Important** |

### 2.3 Bankumsätze

| Feature | Lirex | Wir | Bewertung |
|---------|-------|-----|-----------|
| Bankumsätze anzeigen | Filterable Tabelle | Ledger (umfangreicher) | **Wir besser** |
| Bankkonto-Check (Vollständigkeit) | IBAN, Saldo, Kontoauszüge vollständig | Bankenspiegel + Saldo-Berechnung | Gleichwertig |
| Belegzuordnung | Beleg → Bankumsatz | Nicht explizit (Ledger-Entry hat kein "Beleg"-Feld) | **Lücke** |
| Massenzuordnung | Bulk-Zuordnung | Bulk-Review vorhanden | Gleichwertig |
| InsO-Buchhaltung | Gegenkonto, EA-Konto | Nicht vorhanden | **Important** |
| Kontoauszugs-Verwaltung | Import + Vollständigkeits-Check | Import vorhanden, kein Vollständigkeits-Check | Teilweise |

### 2.4 Eigentumsvorbehalte (EV)

| Feature | Lirex | Wir | Bewertung |
|---------|-------|-----|-----------|
| Lieferanten-Verwaltung | Eigenes Modul (EV-Prüfung, Forderung, Abrechnung) | Nicht vorhanden | **Anderer Scope** |
| Insolvenztabelle | Vorhanden | Nicht vorhanden | Anderer Scope |
| Forderungsprüfung | Workflow-Status | Nicht vorhanden | Anderer Scope |
| Vorräte-Zuordnung | EUR pro Lieferant | Nicht vorhanden | Anderer Scope |

> **Hinweis:** EV ist ein komplett eigenständiges Modul in Lirex, das für unseren Liquiditätsplanungs-Fokus nicht relevant ist. Nur die **Zahlungsdaten** aus EV-Abrechnungen fließen in die Liquidität ein.

### 2.5 ToDo-System / Aufgabenverwaltung

| Feature | Lirex | Wir | Bewertung |
|---------|-------|-----|-----------|
| ToDo-Verwaltung | Vollständig (Typen, Priorität, Zuweisung, Filter) | IV-Notizen (OFFEN/WARTET/ERLEDIGT) | **Lücke** |
| E-Mail-Benachrichtigung | Konfigurierbar (neue ToDos, Freigaben) | Nicht vorhanden | **Important** |
| ToDo-Typen | 8+ (Bankumsatz, E-Mail, Forderung, Freigabe, etc.) | Nur Freitext-Notizen | **Lücke** |
| Prioritäten | Hoch / Normal / Niedrig | Nicht vorhanden | Nice-to-Have |
| Zuweisung an Benutzer | Standard-Zuweisung konfigurierbar | Nicht vorhanden | Nice-to-Have |

### 2.6 Benutzerverwaltung & Rollen

| Feature | Lirex | Wir | Bewertung |
|---------|-------|-----|-----------|
| Rollen-System | 11 Rollen (VL, Sachbearbeiter, GF, Sachwalter, FiBu, etc.) | 2 Rollen (Admin, CustomerUser) | **Lücke** |
| Feld-Level-Rechte | Jedes Feld hat `right: 1-3` | Nicht vorhanden | Nice-to-Have |
| 2FA | Vorhanden | Nicht vorhanden | Nice-to-Have |
| Stempel (PDF-Signatur) | Benutzer- + Verfahrensebene | Nicht vorhanden | Nice-to-Have |
| E-Mail-Signatur | Pro Benutzer | Nicht vorhanden | Nice-to-Have |
| Login-Fehlversuche | Tracking + Sperrung | Nicht vorhanden | Nice-to-Have |

### 2.7 Beleg-Management

| Feature | Lirex | Wir | Bewertung |
|---------|-------|-----|-----------|
| Beleg-Import per E-Mail | Dedizierte Adresse + OCR (100/Monat) | Nicht vorhanden | **Important** |
| OCR-Erkennung | Automatisch | AI-Preprocessing (manuell getriggert) | Teilweise |
| Erlaubte E-Mail-Absender | Konfigurierbar | Nicht relevant | — |
| SEPA-Dateien | Generierung + Import | Nicht vorhanden | Nice-to-Have |

### 2.8 Features, die NUR WIR haben

| Feature | Beschreibung | Wert |
|---------|-------------|------|
| **Liquiditätsplanung** | 13 Wochen / 11 Monate, IST/PLAN, Kategorien | KERN |
| **Alt/Neu-Masse-Zuordnung** | Split-Engine mit 5-stufiger Fallback-Kette | KERN |
| **Klassifikation Engine** | Rule-basiert, Vorschläge, Bulk-Accept | KERN |
| **Prognose (Forecast)** | 3 Szenarien, Wachstumsfaktoren, Saisonalität | KERN |
| **IST/PLAN-Vergleich** | Vollständige Gegenüberstellung | KERN |
| **Liquidity Matrix** | Drilldown bis auf Entry-Level | KERN |
| **Massekredit-Berechnung** | Automatisch mit Fortführungsbeitrag | KERN |
| **Standort-Analyse** | Location-P&L, Vergleich, Revenue-Trend | KERN |
| **Estate Summary** | Alt/Neu-Zusammenfassung | KERN |
| **Share-Links** | Tokenisierte externe Zugriffe (Read-Only) | VORTEIL |
| **Data Lineage** | Vollständiger Import-Trail | VORTEIL |
| **Audit Trail (Ledger)** | Jede Änderung protokolliert | VORTEIL |
| **AI PDF-Extraktion** | Strukturierte Daten aus PDFs | VORTEIL |
| **Rolling Forecast** | Automatische Fortschreibung | VORTEIL |
| **Payment Breakdown** | Sammelüberweisungs-Splitting (PDF-verifiziert) | VORTEIL |

---

## 3. Handlungsempfehlungen

### 3.1 MUST-HAVE (Hoher Mehrwert, geringer Aufwand)

#### A. Mehrstufige Freigabe-Schwellwerte
**Was:** Konfigurierbare Betrags-Schwellwerte, ab denen eine Freigabe erforderlich ist.
**Warum:** Reduziert Micro-Management. Kleine Beträge (< X EUR) werden auto-freigegeben.
**Aufwand:** Gering (Case-Config erweitern, Order-Logic anpassen)
**Lirex-Vorbild:** Betrag-Schwellwert pro Stufe, separate Checkboxen für Bestellungstypen

#### B. Kostenarten pro Verfahren
**Was:** Konfigurierbare Kostenarten (z.B. "Fremdleistungen", "InsO-Kosten", "Personal") pro Case.
**Warum:** Strukturiert die Ausgaben, ermöglicht Budget-Tracking und bessere Kategorisierung.
**Aufwand:** Mittel (neue Entity `CostCategory`, Zuordnung bei Orders und LedgerEntries)
**Lirex-Vorbild:** `BuZLKostenarten` mit freier Konfiguration pro Verfahren

#### C. Kreditoren-Stammdaten
**Was:** Kreditoren als eigene Entity statt Freitext in Orders.
**Warum:** Vermeidet Tippfehler, ermöglicht Auswertungen pro Kreditor, Wiederverwendung.
**Aufwand:** Mittel (neue Entity, Dropdown in Order-Formular, Migration bestehender Freitext-Daten)
**Lirex-Vorbild:** `BuZLKreditor` mit Kreditornummer, Kostenart-Zuordnung, Kostenlimit

### 3.2 IMPORTANT (Hoher Mehrwert, mittlerer Aufwand)

#### D. Dauerschuldverhältnisse / Mietverhältnisse
**Was:** Wiederkehrende Zahlungsverpflichtungen als eigene Kategorie (nicht als einzelne Bestellungen).
**Warum:** In der Insolvenz ist die Unterscheidung zwischen einmaligen und laufenden Kosten kritisch (§ 55 InsO). DSV müssen separat genehmigt und getrackt werden.
**Aufwand:** Mittel (Order-Typ erweitern: BESTELLUNG | ZAHLUNG | DAUERSCHULD | MIETE, Wiederholungslogik)
**Lirex-Vorbild:** Separate Unterseiten für Dauerschuld und Mietverhältnisse

#### E. E-Mail-Benachrichtigungen
**Was:** Automatische E-Mails bei neuen Freigabeanfragen, Genehmigungen, Ablehnungen.
**Warum:** IV muss zeitnah reagieren können. Aktuell muss man aktiv ins Portal schauen.
**Aufwand:** Mittel (Resend-Integration haben wir schon vom Budget-Dashboard, Template-Mails)
**Lirex-Vorbild:** "Info-Mail bei neuen ToDos", "Info-Mail bei neuen Freigabeanfragen"

#### F. Kostenlimits / Budget-Tracking
**Was:** Pro Kreditor oder Kostenart ein Budget-Limit setzen, bei Überschreitung warnen.
**Warum:** Verhindert versehentliche Budget-Überschreitungen, gibt IV Überblick.
**Aufwand:** Mittel (Limit-Felder + Aggregation + Warnung in UI)
**Lirex-Vorbild:** Einzellimit + Kostenlimit pro Kreditor/Bestellung

#### G. Verfahrens-Stammdaten erweitern
**Was:** Case-Entity um Unternehmensdaten, IV-Kontakt, Termine erweitern.
**Warum:** Zentraler Ort für alle Verfahrensinformationen, statt im case-context.json.
**Aufwand:** Gering-Mittel (Schema erweitern, Stammdaten-Formular bauen)
**Lirex-Vorbild:** Umfangreiches Stammdaten-Formular mit 8+ Sektionen

### 3.3 NICE-TO-HAVE (Mehrwert vorhanden, aber nicht dringend)

#### H. Automatische Freigaben (Zeitbasiert)
**Was:** "Wenn bis 14:00 keine Ablehnung, automatisch freigeben am nächsten Tag um 08:00"
**Warum:** Reduziert Overhead bei Routinebestellungen
**Aufwand:** Hoch (Cron-Job, Deadline-Logic, Rollback bei Fehler)

#### I. Chat-Funktion bei Freigaben
**Was:** Kommentar-Thread direkt an einer Bestellung/Zahlung
**Warum:** Vermeidet E-Mail-Ping-Pong bei Rückfragen
**Aufwand:** Mittel (Kommentar-Entity, UI-Widget)

#### J. 2-Faktor-Authentifizierung
**Was:** TOTP-basierte 2FA für Admin und Customer
**Warum:** Sicherheit bei sensiblen Finanzdaten
**Aufwand:** Mittel (TOTP-Library, Setup-Flow, Verification)

#### K. Beleg-Import per E-Mail
**Was:** Dedizierte E-Mail-Adresse pro Case, eingehende PDFs automatisch verarbeiten
**Warum:** Buchhalterin kann einfach E-Mail senden statt in App einzuloggen
**Aufwand:** Hoch (E-Mail-Empfang-Service, Parsing, OCR-Pipeline)

#### L. SEPA-Dateien generieren
**Was:** SEPA XML (pain.001) aus genehmigten Zahlungen generieren
**Warum:** Direkter Bank-Import statt manueller Überweisungen
**Aufwand:** Hoch (SEPA-Format komplex, Bank-spezifische Anforderungen)

#### M. Rollen-System erweitern
**Was:** Mehr Rollen als nur Admin/Customer (z.B. Sachbearbeiter, Sachwalter, GF)
**Warum:** Granularere Zugriffssteuerung
**Aufwand:** Hoch (Auth-System umbauen, Permissions pro Route)

#### N. ToDo-System ausbauen
**Was:** IV-Notizen zu einem vollwertigen Todo-System mit Typen, Prioritäten, Zuweisung
**Warum:** Besseres Aufgaben-Tracking
**Aufwand:** Mittel (Entity erweitern, UI bauen)

### 3.4 NICHT ÜBERNEHMEN

| Feature | Warum nicht |
|---------|-------------|
| **Eigentumsvorbehalte (EV)** | Anderer Scope – wir sind Liquiditätsplanung, nicht EV-Management |
| **Insolvenztabelle** | Nicht unser Fokus |
| **Lieferantenpool** | Nicht relevant für Liquiditätsplanung |
| **Feld-Level-Rechte** | Over-Engineering für unsere Größe |
| **Nutzungstracking (Pagetrack)** | Datenschutz-Bedenken, wenig Mehrwert |
| **Internationalisierung** | Alle unsere Nutzer sind deutsch |
| **Prüfer-Verwaltung** | Nicht unser Scope |

---

## 4. Priorisierte Roadmap

### Phase 1: Quick Wins (1-2 Wochen)

1. **Freigabe-Schwellwerte** – Case-Config um `approvalThresholdCents` erweitern
2. **Kreditoren-Entity** – Wiederverwendbare Kreditoren statt Freitext
3. **Verfahrens-Stammdaten** – Case um IV-Kontakt, Termine, Verfahrensart erweitern

### Phase 2: Workflow-Verbesserungen (2-4 Wochen)

4. **Kostenarten** – Konfigurierbare Kategorien pro Case
5. **E-Mail-Benachrichtigungen** – Bei Freigabeanfragen und Genehmigungen
6. **Dauerschuldverhältnisse** – Als Order-Typ mit Wiederholungslogik
7. **Kostenlimits** – Budget-Tracking pro Kreditor/Kostenart

### Phase 3: Professionalisierung (4-8 Wochen)

8. **Mehrstufige Freigabe** – VL → Sachwalter → GF Workflow
9. **ToDo-System** – IV-Notizen zu vollwertigem Task-Management ausbauen
10. **Automatische Freigaben** – Zeitbasierte Auto-Genehmigung

---

## 5. Zusammenfassung

**Unser Tool ist in der Analyse und Planung Lirex weit überlegen** – Liquiditätsplanung, Alt/Neu-Masse, Forecast, Klassifikation – das hat Lirex alles nicht.

**Lirex ist im operativen Tagesgeschäft ausgereifter** – mehrstufige Freigaben, Kostenkontrolle, Lieferantenverwaltung, E-Mail-Benachrichtigungen.

**Die wichtigsten Übernahmen** sind die, die unseren Freigabe-Workflow professionalisieren:
1. Konfigurierbare Schwellwerte (statt "alles muss genehmigt werden")
2. Kostenarten + Kreditoren (statt Freitext)
3. E-Mail-Benachrichtigungen (statt "bitte regelmäßig reinschauen")
4. Dauerschuldverhältnisse (InsO-relevante Unterscheidung)

Diese Verbesserungen machen unser Tool **für den IV deutlich praxistauglicher** im Tagesgeschäft, ohne unsere analytische Stärke zu verwässern.
