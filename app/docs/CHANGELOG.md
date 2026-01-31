# Änderungsprotokoll (Changelog)

Dieses Dokument protokolliert alle wesentlichen Änderungen an der Anwendung.

---

## Version 1.0.0 – Erstveröffentlichung

**Datum:** 15. Januar 2026

### Neue Funktionen

#### Admin-Bereich
- **Projektverwaltung:** Anlegen, Bearbeiten und Archivieren von Projekten (Mandanten)
- **Fallverwaltung:** Erstellen von Insolvenzfällen mit Aktenzeichen, Gericht und Schuldnerdaten
- **Datenimport:** Mehrstufiger Import-Workflow für CSV- und Excel-Dateien
  - Datei-Upload mit Formatvalidierung
  - Spalten-Zuordnung (Mapping)
  - Datenprüfung mit Fehler-, Warnungs- und Hinweisanzeige
  - Übernahme in den Liquiditätsplan
- **Freigabe-Links:** Erstellen und Widerrufen von externen Zugängen für Insolvenzverwalter
- **Versionshistorie:** Nachvollziehbarkeit aller Planversionen

#### Externe Ansicht (Insolvenzverwalter)
- **Professionelles Cockpit:** Übersichtliche Darstellung für Gerichte, Banken und Gläubiger
- **Kennzahlen-Karten:** Aktueller Bestand, Tiefster Stand, Reichweite, kritische Woche
- **13-Wochen-Tabelle:** Vollständige Liquiditätsübersicht mit Einnahmen und Ausgaben
- **Liquiditätsverlauf:** Grafische Darstellung des Kontostands über 13 Wochen
- **PDF-Export:** Professioneller Bericht mit Zeitstempel und Versionskennung

#### Technische Basis
- Next.js 15 mit App Router
- SQLite-Datenbank (Demo/Preview)
- Prisma ORM
- Recharts für Diagramme
- jsPDF für PDF-Export

### Sprachliche Anpassungen
- Vollständige deutsche Benutzeroberfläche
- Professionelle Formulierungen für Insolvenzbranche
- Korrekte Umlaute in allen Texten und PDFs

### Deployment
- **Vercel-Deployment:** App live unter https://app-beige-kappa-43.vercel.app
- **GitHub-Repository:** https://github.com/dp-213/Inso-liquiplanung
- **Authentifizierung:** JWT-basierte Session mit HttpOnly-Cookies

---

## Version 1.0.1 – Bugfixes

**Datum:** 15. Januar 2026

### Fehlerbehebungen
- **Login-Authentifizierung:** Umgebungsvariablen werden jetzt zur Laufzeit gelesen (nicht zur Build-Zeit)
- **Env-Var-Format:** Zeilenumbrüche in Vercel-Umgebungsvariablen entfernt
- **Datenbank-Resilienz:** Alle Admin-Seiten zeigen benutzerfreundliche Warnung bei fehlender Datenbank statt Server-Fehler

### Technische Änderungen
- Login-Route vereinfacht und robuster gemacht
- Session-Secret-Handling verbessert
- Try-Catch für alle Datenbank-Abfragen in Admin-Seiten
- Graceful Degradation bei fehlender SQLite-Datenbank

---

## Version 1.1.0 – Flexible Periodenplanung

**Datum:** 16. Januar 2026

### Neue Funktionen

#### Periodentyp-Unterstützung
- **Wöchentliche und monatliche Planung:** Liquiditätspläne können jetzt entweder als 13-Wochen-Plan (Standard) oder als Monatsplanung konfiguriert werden
- **Dynamische Periodenzahl:** Statt fester 13 Wochen können nun beliebig viele Perioden definiert werden (z.B. 10 Monate für Nov 2025 - Aug 2026)
- **Automatische Periodenbeschriftung:** "KW 03" für Wochen, "Nov 25" für Monate

#### HVPlus-Fall implementiert
- Erster echter Kundenfall mit 10-Monats-Planung (Nov 2025 - Aug 2026)
- 6 Kategorien: Umsatz, Altforderungen, Insolvenzspezifische Einzahlungen, Personalaufwand, Betriebliche Auszahlungen, Insolvenzspezifische Auszahlungen
- Vollständige Testdaten aus Excel übernommen

### Technische Änderungen

#### Schema-Änderungen
- `WeeklyValue` umbenannt zu `PeriodValue`
- `weekOffset` umbenannt zu `periodIndex`
- Neue Felder `periodType` (WEEKLY/MONTHLY) und `periodCount` in `LiquidityPlan`
- `StagedCashflowEntry.weekOffset` umbenannt zu `periodIndex`

#### Berechnungs-Engine
- `calculateLiquidityPlan()` akzeptiert jetzt `periodType` und `periodCount` Parameter
- Neue Funktion `generatePeriodLabel()` für dynamische Periodenbeschriftung
- Neue Funktion `getPeriodDates()` für Start-/Enddatum-Berechnung
- Legacy-Aliase (`weeks`, `weeklyValues`, `weeklyTotals`) für Abwärtskompatibilität

#### API-Änderungen
- Alle Endpunkte geben `periodType` und `periodCount` zurück
- Sowohl neue (`periods`, `periodValues`) als auch Legacy-Felder (`weeks`, `weeklyValues`) werden bereitgestellt
- Interne Queries verwenden jetzt `periodValues` statt `weeklyValues`

### Abwärtskompatibilität
- Bestehende Frontend-Komponenten funktionieren weiterhin mit Legacy-Aliase
- Standard-Werte: `periodType = "WEEKLY"`, `periodCount = 13`

---

## Version 1.2.0 – Admin Dashboard Umbau + Gradify Branding

**Datum:** 16. Januar 2026

### Neue Funktionen

#### Dashboard-Tabs (Externe Ansicht)
- **5 neue Ansichten:** Übersicht, Einnahmen, Sicherungsrechte, Masseübersicht, Vergleich
- **Tab-Navigation:** ExternalDashboardNav Komponente für /view/ Seite
- **Chart-Marker:** KV-Restzahlung und HZV-Schlusszahlung Ereignisse im Liquiditätschart
- **Phasen-Visualisierung:** Fortführung/Nachlauf Bereiche im Chart

#### Admin-Bereich Umbau
- **Neue Sidebar-Struktur:** Übersicht, VERWALTUNG (Kunden, Fälle)
- **Kundenverwaltung:** Komplette CRUD-Funktionalität unter /admin/customers
- **Passwort-Reset:** Admins können Kundenpasswörter zurücksetzen
- **Externe Ansicht Button:** Schnellzugriff auf Share-Link von Fall-Detail-Seite
- **Planungstyp-Anzeige:** Fallliste zeigt "10 Monate" oder "13 Wochen"

#### Gradify Branding
- **Favicon:** Gradify Logo als Browser-Tab-Icon
- **Farbschema getrennt:**
  - Admin: Gradify Rot (#CE353A) fuer Buttons, Navigation
  - Kunden: Konservatives Blau (#1e40af) fuer Tabellen, Charts
- **Logo:** Gradify Logo in Admin-Sidebar

#### Portal-Aenderungen
- **Login verschoben:** /portal/login → /customer-login (vermeidet Redirect-Loop)
- **Kundenheader:** Logout leitet zu /customer-login

### Neue Komponenten
- `ExternalDashboardNav.tsx` - Tab-Navigation fuer externe Ansicht
- `RevenueChart.tsx` - Stacked Bar Chart fuer Einnahmen nach Quelle
- `EstateComparisonChart.tsx` - Vergleichschart Altmasse/Neumasse
- `DashboardNav.tsx` - Route-basierte Navigation fuer Portal
- `CustomerAccessManager.tsx` - Kundenzugriff verwalten

### Technische Aenderungen
- Share-Link API gibt periodType und periodCount zurueck
- BalanceChart unterstuetzt Marker und Phasen-Visualisierung
- PDFExportButton dynamisch fuer Wochen/Monate

### Work in Progress
- Admin Dashboard (/admin/cases/[id]/dashboard) zeigt WIP-Banner
- Datenmodell fuer PaymentSource, SecurityRight noch nicht implementiert

---

## Version 1.3.0 – Mobile Responsiveness

**Datum:** 16. Januar 2026

### Neue Funktionen

#### Kunden-Ansichten (Prioritaet)
- **Responsive Tabellen:** Liquidity-Tabellen haben jetzt horizontalen Scroll mit smooth scrolling auf Touch-Geraeten
- **KPI-Cards optimiert:** Bessere Lesbarkeit auf kleinen Bildschirmen mit angepassten Schriftgroessen und Abstaenden
- **Dashboard-Navigation:** Touch-freundliche Buttons mit 44px Mindesthoehe fuer Mobile
- **ExternalDashboardNav:** Icons bleiben sichtbar, Labels werden auf kleinen Bildschirmen ausgeblendet

#### Admin Dashboard
- **Hamburger-Menue:** Sidebar ist auf Mobile versteckt und kann ueber Hamburger-Icon geoeffnet werden
- **AdminShell-Komponente:** Neue kombinierte Komponente fuer responsive Layout-Verwaltung
- **Overlay:** Halbtransparenter Hintergrund beim geoeffneten Mobile-Menue
- **Escape-Taste:** Schliesst Mobile-Menue

#### Globale Styles
- **Touch-freundliche Buttons:** Mindesthoehe 44px fuer alle Buttons auf Mobile
- **Form-Inputs:** Groessere Touch-Targets, font-size 16px verhindert Zoom auf iOS
- **Scrollbar-Styling:** Konsistentes Aussehen auf Desktop und Mobile
- **Transitions:** Smooth Animationen fuer Mobile-Navigation

### Technische Aenderungen
- Neue `AdminShell.tsx` Komponente ersetzt separate Sidebar und Header
- `globals.css` um mobile-spezifische Media Queries erweitert
- `LiquidityTable.tsx` mit `table-scroll-container` Wrapper
- Admin Layout verwendet jetzt `AdminShell` statt `AdminSidebar` + `AdminHeader`

### Breakpoints
- **sm (640px):** Hauptumschaltpunkt fuer Mobile/Desktop
- **lg (1024px):** Admin-Sidebar wird permanent sichtbar

---

## Version 1.4.0 – Löschfunktionen & Kundenlogo

**Datum:** 17. Januar 2026

### Neue Funktionen

#### Permanente Löschfunktion
- **Kunden löschen:** Auf der Kundenliste (/admin/customers) können Kunden jetzt permanent gelöscht werden
- **Fälle löschen:** Auf der Fallliste (/admin/cases) können Fälle mit allen zugehörigen Daten gelöscht werden
- **Sichere Bestätigung:** Löschen erfordert Eingabe von "LÖSCHEN" zur Bestätigung
- **Kaskaden-Löschung für Fälle:** Löscht automatisch alle zugehörigen Daten:
  - Liquiditätspläne und Versionen
  - Kategorien, Zeilen und Periodenwerte
  - Konfigurationen und Share-Links
  - Kundenzugriffe (CustomerCaseAccess)

#### Kundenlogo im Portal
- **Logo-URL Feld:** Kunden können jetzt eine Logo-URL im Profil hinterlegen
- **Portal-Header:** Logo wird anstelle des Standard-Icons im Kundenportal-Header angezeigt
- **Session-Integration:** Logo-URL wird in der Kundensession gespeichert

#### Admin-Verbesserungen
- **Kundendetailseite:** Zeigt jetzt zugehörige Fälle (ownedCases) mit Plantyp-Info
- **Planeinstellungen API:** Neuer Endpunkt /api/cases/[id]/plan/settings für Periodentyp-Konfiguration
- **Fall-Bearbeitungsseite:** Planeinstellungen (Periodentyp, Periodenzahl, Startdatum) direkt editierbar

### UI-Verbesserungen
- **Konsistentes Button-Styling:** Alle Aktions-Buttons in Tabellen haben einheitliches Design
- **Umlaute korrigiert:** Alle deutschen Umlaute (ä, ö, ü) im gesamten Codebase korrekt dargestellt
  - Admin Dashboard, Kundenlisten, Fälle-Listen
  - Kundenportal und alle Unterseiten
  - API-Fehlermeldungen und Bestätigungstexte
  - Alle Formulare, Modals und Statusmeldungen

### API-Änderungen
- **GET /api/customers/[id]:** Gibt jetzt `ownedCases` zurück
- **PUT /api/customers/[id]:** Unterstützt `logoUrl` und `resetPassword`
- **DELETE /api/customers/[id]:** Mit `?hardDelete=true&confirm=PERMANENTLY_DELETE` für permanentes Löschen
- **DELETE /api/cases/[id]:** Mit `?hardDelete=true&confirm=PERMANENTLY_DELETE` für permanentes Löschen
- **GET/PUT /api/cases/[id]/plan/settings:** Neuer Endpunkt für Planeinstellungen

### Schema-Änderungen
- `CustomerUser.logoUrl` – Neues Feld für Kundenlogo-URL
- `CustomerSessionData.logoUrl` – Logo-URL in JWT-Session integriert

---

## Version 1.5.0 – W&P Best Practices Integration

**Datum:** 17. Januar 2026

### Neue Funktionen

#### Dashboard-Erweiterungen (nach W&P-Industriestandard)
- **Wasserfall-Tab:** Neue Visualisierung der Cashflow-Zusammensetzung pro Periode
  - Einzahlungen (grün), Auszahlungen (rot), Insolvenzeffekte (lila)
  - Endbestand als Linie überlagert
  - Summen-Karten für Gesamtübersicht

- **Insolvenzeffekte-Tab:** Separate Darstellung insolvenzspezifischer Zahlungsströme
  - Trennung von operativem Geschäft
  - Gliederung nach Effektgruppen (Allgemein, Verfahrenskosten)
  - Kumulierte Effektberechnung
  - Vergleich "vor/nach Insolvenzeffekten"

- **Prämissen-Tab:** Dokumentation der Planungsannahmen
  - W&P-konformes Risiko-Ampelsystem (○ ◐ ◑ ● ●●)
  - Informationsquelle pro Position
  - Detaillierte Prämissenbeschreibung

- **Erweiterte Navigation:** 8 Tabs (Übersicht, Einnahmen, Wasserfall, Insolvenzeffekte, Prämissen, Sicherungsrechte, Masseübersicht, Vergleich)

#### Neue Komponenten
- `WaterfallChart.tsx` – Recharts-basiertes Wasserfall-Diagramm
- `InsolvencyEffectsTable.tsx` – Tabelle für Insolvenzeffekte mit Periodenspalten
- `PlanningAssumptions.tsx` – Prämissen-Tabelle mit Risiko-Legende

### Datenmodell-Erweiterungen

#### Neue Prisma-Modelle
- **PlanningAssumption:** Dokumentation der Planungsprämissen
  - `categoryName`, `source`, `description`, `riskLevel`
  - Risiko-Level: conservative, low, medium, high, aggressive

- **InsolvencyEffect:** Insolvenzspezifische Zahlungseffekte
  - `name`, `effectType` (INFLOW/OUTFLOW), `effectGroup`
  - `periodIndex`, `amountCents`
  - Gruppierung: GENERAL, PROCEDURE_COST

- **BankAccount:** Bankenspiegel nach W&P-Standard
  - `bankName`, `accountName`, `iban`
  - `balanceCents`, `availableCents`
  - `securityHolder`, `status`, `notes`

### API-Erweiterungen
- **GET/POST/DELETE /api/cases/[id]/plan/assumptions** – Planungsprämissen verwalten
- **GET/POST/DELETE /api/cases/[id]/plan/insolvency-effects** – Insolvenzeffekte verwalten
- **GET/POST/PUT/DELETE /api/cases/[id]/bank-accounts** – Bankkonten verwalten

### Dokumentation
- **DASHBOARD_BEST_PRACTICES.md:** Umfassende Analyse des W&P-Reports
  - 9 Kapitel mit Best Practices
  - Priorisierte Feature-Liste (P1/P2/P3)
  - Gap-Analyse: W&P vs. Gradify
  - Standard-Katalog für Insolvenzeffekte

### Technische Verbesserungen
- Erweiterte ExternalDashboardNav mit 3 neuen Icons
- Responsive Tab-Layout für Mobile
- BigInt-Handling in allen neuen Komponenten

---

## Version 2.0.0 – LedgerEntry als Single Source of Truth

**Datum:** 18. Januar 2026

### Grundlegende Architekturänderung

#### LedgerEntry-basiertes Datenmodell
Die Anwendung wurde grundlegend umgestellt: **LedgerEntry** ist jetzt die einzige Quelle der Wahrheit für alle Buchungen.

- **Keine Kategorien/Zeilen mehr für Datenerfassung** – nur noch für Präsentation
- **Steuerungsdimensionen** direkt am LedgerEntry:
  - `valueType` (IST/PLAN)
  - `legalBucket` (MASSE, ABSONDERUNG, NEUTRAL)
  - `counterpartyId` (Gegenpartei)
  - `locationId` (Standort)
  - `bankAccountId` (Bankkonto)
- **Governance-Status** (reviewStatus): UNREVIEWED → CONFIRMED/ADJUSTED

#### Classification Engine
Neue Rule-basierte Klassifikationsvorschläge:
- `ClassificationRule` Modell für Musterabgleich
- Automatische Vorschläge beim Import (niemals Auto-Commit für IST)
- Bulk-Review für effiziente Massenbearbeitung
- Regel-Erstellung direkt aus LedgerEntry-Details

### Neue Funktionen

#### Zahlungsregister (Ledger)
- **Sortierbare Tabellen** – Alle Spalten klickbar zum Sortieren
- **Filterung** nach reviewStatus, legalBucket, valueType
- **Regel erstellen Button** – Direkt aus Einzeleintrag eine Klassifikationsregel erstellen
- **Detail-Ansicht** mit vollständiger Bearbeitungsmöglichkeit

#### Stammdaten-Verwaltung
- **Gegenparteien (Counterparties)** – CRUD für Geschäftspartner, Gläubiger, Debitoren
- **Standorte (Locations)** – Verwaltung von Betriebsstätten, Filialen
- **Bankkonten** – Zuordnung von Ein-/Auszahlungen zu Konten

#### Regelverwaltung
- **Neue Rules-Seite** unter /admin/cases/[id]/rules
- **Match-Typen:** CONTAINS, STARTS_WITH, ENDS_WITH, EQUALS, REGEX, AMOUNT_RANGE
- **Match-Felder:** description, bookingReference
- **Vorschläge:** suggestedLegalBucket, suggestedCategory, confidence

#### Navigation Umbau
- **Neue Struktur:** Ledger | Stammdaten | Recht
- **Ledger:** Zahlungsregister, Datenimport
- **Stammdaten:** Bankkonten, Gegenparteien, Standorte
- **Recht:** Regeln
- **Dashboard-Button** verlinkt jetzt direkt zur externen Ansicht (wenn Share-Link existiert)

### Schema-Änderungen

#### Neue Modelle
```prisma
model ClassificationRule {
  id, caseId, name, matchField, matchType, matchValue,
  suggestedLegalBucket, suggestedCategory, isActive, priority
}

model Counterparty {
  id, caseId, name, type (CREDITOR/DEBITOR/OTHER), taxId, notes
}

model Location {
  id, caseId, name, address, type, notes
}
```

#### LedgerEntry Erweiterungen
```prisma
model LedgerEntry {
  // Neu:
  counterpartyId, locationId, bankAccountId
  suggestedLegalBucket, suggestedCategory, suggestedConfidence
  suggestedRuleId, suggestedReason
}
```

### API-Erweiterungen
- **GET/POST /api/cases/[id]/counterparties** – Gegenparteien verwalten
- **GET/POST /api/cases/[id]/locations** – Standorte verwalten
- **GET/POST /api/cases/[id]/rules** – Klassifikationsregeln verwalten
- **POST /api/cases/[id]/intake** – Vereinfachter Import-Endpunkt
- **POST /api/cases/[id]/ledger/bulk-review** – Massen-Review mit Filtern

### Bugfixes
- **React Hooks Fehler** in externer Ansicht behoben (Hooks vor conditional returns)
- **Datums-Parsing** für verschiedene Formate verbessert
- **Betrags-Parsing** für negative Werte und Komma-Notation korrigiert

### Dokumentation
- **Veraltete Dateien gelöscht:** `app/CLAUDE_CONTEXT.md`
- **Plan-Dokumentation:** Detaillierter Implementierungsplan erstellt

---

## Version 2.1.0 – Dimensions & Counterparty Auto-Detection

**Datum:** 19. Januar 2026

### Neue Funktionen

#### Steuerungsdimensionen im Ledger
- **Dimensionen an LedgerEntry:** Jeder Eintrag kann jetzt mit Bankkonto, Gegenpartei und Standort verknüpft werden
- **Finale vs. Vorgeschlagene Werte:** Klare Trennung zwischen bestätigten Werten (`bankAccountId`, `counterpartyId`, `locationId`) und Vorschlägen (`suggestedBankAccountId`, etc.)
- **Bulk-Übernahme:** Button "Dimensionen übernehmen" übernimmt alle Vorschläge in finale Werte

#### Regelbasierte Dimensions-Zuweisung
- **Rules-Seite erweitert:** Dimensionen können direkt pro Klassifikationsregel zugewiesen werden
- **Dropdown-Felder:** Bankkonto, Gegenpartei, Standort auswählbar bei Regel-Erstellung
- **Automatische Vorschläge:** Beim Import werden Dimensions-Vorschläge basierend auf Regeln erstellt

#### Counterparty Auto-Detection
- **Pattern-Matching:** `matchPattern` (Regex) aus Counterparty wird auf Beschreibungen angewendet
- **Automatische Erkennung:** Nach jedem Import werden Counterparty-Patterns gematcht
- **Nur Vorschläge:** Ergebnisse werden als `suggestedCounterpartyId` gespeichert – User muss bestätigen!

#### Ledger-UI Erweiterungen
- **Dim.-Vorschlag Spalte:** Zeigt Badges (🏦 👤 📍) für vorgeschlagene Dimensionen
- **Dimensions-Filter:** Dropdown-Filter für Bankkonto, Gegenpartei, Standort
- **Hover-Details:** Tooltip zeigt Dimensions-Vorschläge im Detail

### Schema-Änderungen

#### LedgerEntry Erweiterungen
```prisma
model LedgerEntry {
  // Finale Dimensionen (nach User-Bestätigung)
  bankAccountId      String?
  counterpartyId     String?
  locationId         String?

  // Vorgeschlagene Dimensionen (von Rule Engine)
  suggestedBankAccountId    String?
  suggestedCounterpartyId   String?
  suggestedLocationId       String?
}
```

#### ClassificationRule Erweiterungen
```prisma
model ClassificationRule {
  // Dimensions-Zuweisung bei Match
  assignBankAccountId    String?
  assignCounterpartyId   String?
  assignLocationId       String?
}
```

### API-Erweiterungen
- **GET /api/cases/[id]/ledger:** Neue Filter `bankAccountId`, `counterpartyId`, `locationId`, `hasDimensionSuggestions`
- **POST /api/cases/[id]/ledger/bulk-review:** Option `applyDimensionSuggestions` übernimmt Vorschläge
- **matchCounterpartyPatterns():** Neue Funktion in Classification Engine

### Technische Änderungen
- `classifyBatch()` setzt jetzt auch Dimensions-Vorschläge
- `matchCounterpartyPatterns()` läuft nach jedem Import
- Turso-Schema manuell erweitert (ALTER TABLE)

---

## Version 2.2.0 – Alt/Neu-Splitting & Massekredit

**Datum:** 20. Januar 2026

### Neue Funktionen

#### Alt/Neu-Masse-Zuordnung
- **Estate Allocation:** Jeder LedgerEntry kann als ALTMASSE, NEUMASSE, MIXED oder UNKLAR klassifiziert werden
- **Allocation Source (Revisionssprache):** Nachvollziehbare Herkunft der Zuordnung:
  - `VERTRAGSREGEL`: Explizite Vertragsregel (z.B. KV Q4: 1/3-2/3)
  - `SERVICE_DATE_RULE`: Binär vor/nach Stichtag
  - `PERIOD_PRORATA`: Zeitanteilige Aufteilung
  - `VORMONAT_LOGIK`: HZV-spezifisch (Zahlung bezieht sich auf Vormonat)
  - `MANUELL`: Manuelle Zuordnung durch Benutzer
  - `UNKLAR`: Keine Regel anwendbar - Review erforderlich
- **Split-Engine:** Automatische Fallback-Kette für Zuordnung

#### Case-spezifische Konfiguration (HAEVG PLUS eG)
- **Neues Muster:** `/lib/cases/[case-name]/config.ts` für case-spezifische Regeln
- **HAEVG PLUS:** Erste Implementierung mit:
  - Stichtag: 29.10.2025
  - Abrechnungsstellen: KV Nordrhein, HZV-Vertrag, PVS rhein-ruhr
  - Banken: Sparkasse Velbert, apobank
  - Standorte: Velbert, Uckerath, Eitorf

#### Massekredit-Dashboard
- **Neuer Tab:** "Banken/Massekredit" im Dashboard (nach Übersicht)
- **KPI-Karten:** Altforderungen brutto, Fortführungsbeitrag, USt, Massekredit Altforderungen
- **Bank-Tabelle:** Status, Beträge, Cap, Headroom pro Bank
- **Annahmen-Box:** Transparente Darstellung aller Berechnungsgrundlagen
- **Warnungen:** Gelb für offene Vereinbarungen, Rot für UNKLAR-Buchungen

#### BankAgreement-Modell
- **Vereinbarungsstatus:** OFFEN, VERHANDLUNG, VEREINBART
- **Globalzession:** Flag für Sicherungsrecht
- **Fortführungsbeitrag:** Rate + USt (nur wenn vereinbart)
- **Massekredit-Cap:** Optional, nur wenn vertraglich festgelegt
- **Unsicherheit explizit:** `isUncertain` Flag + Erklärung

### Datenmodell-Erweiterungen

#### LedgerEntry
```prisma
// Service Date / Period (für Alt/Neu-Splitting)
serviceDate         DateTime?
servicePeriodStart  DateTime?
servicePeriodEnd    DateTime?

// Estate Allocation
estateAllocation    String?    // ALTMASSE, NEUMASSE, MIXED, UNKLAR
estateRatio         Decimal?   // Bei MIXED: Anteil Neumasse (0.0-1.0)

// Allocation Source (Revisionssprache)
allocationSource    String?    // VERTRAGSREGEL, SERVICE_DATE_RULE, etc.
allocationNote      String?    // Audit-Trail

// Split Reference
parentEntryId       String?    // Bei Split: Referenz auf Original
splitReason         String?
```

#### Case
```prisma
cutoffDate  DateTime?  // Stichtag Insolvenzantrag
```

#### BankAgreement (NEU)
```prisma
model BankAgreement {
  agreementStatus     String    // OFFEN, VERHANDLUNG, VEREINBART
  hasGlobalAssignment Boolean
  contributionRate    Decimal?  // z.B. 0.10 für 10%
  contributionVatRate Decimal?  // z.B. 0.19
  creditCapCents      BigInt?
  isUncertain         Boolean
  uncertaintyNote     String?
}
```

### Neue Module

| Pfad | Beschreibung |
|------|--------------|
| `/lib/types/allocation.ts` | Type-Definitionen für Estate Allocation |
| `/lib/cases/haevg-plus/config.ts` | HAEVG PLUS Konfiguration |
| `/lib/settlement/split-engine.ts` | Alt/Neu-Split-Engine |
| `/lib/credit/calculate-massekredit.ts` | Massekredit-Berechnung |
| `/components/dashboard/MasseCreditTab.tsx` | Dashboard-Komponente |
| `/api/cases/[id]/massekredit/route.ts` | API-Endpunkt |

### API-Erweiterungen
- **GET /api/cases/[id]/massekredit** – Berechnet Massekredit-Status für alle Banken

### Technische Entscheidungen
- **Decimal statt Float** für `estateRatio` – keine Rundungsartefakte
- **Keine createdBy/updatedBy** auf BankAgreement – wird nur von Gradify gepflegt
- **Revisionssprache** – alle Zuordnungen sind audit-sicher begründet

---

## Version 2.3.0 – 3-Ebenen-Import-Architektur

**Datum:** 20. Januar 2026

### Grundlegende Architekturänderung

#### Strikte Trennung: Excel → Import Context → LedgerEntry

Die Import-Architektur wurde grundlegend überarbeitet für bessere Wartbarkeit und Regeltrennung:

1. **Excel/CSV (variabel):** Original-Spalten mit unterschiedlichen Namen je nach Quelle
2. **Import Context (stabil):** Normalisierte fachliche Keys für Regeln
3. **LedgerEntry (final):** Nur IDs und fachliche Ergebnisse

#### NormalizedImportContext

Neue stabile Struktur für Import-Daten:

| Normalized Key | Excel-Varianten |
|----------------|-----------------|
| `standort` | "Standort", "Praxis", "Filiale", "Niederlassung" |
| `counterpartyHint` | "Debitor", "Kreditor", "Auftraggeber", "Empfänger" |
| `arzt` | "Arzt", "Behandler", "Leistungserbringer" |
| `zeitraum` | "Zeitraum", "Abrechnungszeitraum", "Periode" |
| `kategorie` | "Kategorie", "Buchungsart", "Cashflow Kategorie" |
| `kontoname` | "Kontoname", "Konto", "Bankverbindung" |
| `krankenkasse` | "Krankenkasse", "Kostenträger", "KV" |

#### Rule Engine auf Normalized

- **STRIKT:** Regeln arbeiten NUR auf `normalized`, NIE auf LedgerEntry
- **ClassificationRule.matchField** referenziert normalized Keys
- **Ergebnis:** Nur IDs werden ins LedgerEntry übertragen

### Neue Module

| Pfad | Beschreibung |
|------|--------------|
| `/lib/import/normalized-schema.ts` | NormalizedImportContext + COLUMN_MAPPINGS |
| `/lib/import/rule-engine.ts` | applyRules() auf normalized |
| `/lib/import/index.ts` | Export-Modul |

### Technische Änderungen

#### to-ledger API aktualisiert
- Normalisierung vor Regelanwendung
- Lädt ClassificationRules und wendet sie auf normalized an
- Nur Ergebnis-IDs werden ins LedgerEntry übertragen
- `allocationNote` enthält angewandte Regel-Information

#### Schema-Kommentare
- `ClassificationRule.matchField` dokumentiert: "NORMALIZED Keys only"
- Architektur-Hinweise im Schema für zukünftige Entwickler

### Architektur-Regeln (dokumentiert)

1. **KEINE** Original-Excel-Spalten im LedgerEntry speichern
2. **Regeln arbeiten NUR auf normalized**, NIE auf LedgerEntry
3. **Normalisierung vor Regelanwendung** – verschiedene Spaltennamen → stabile Keys
4. **LedgerEntry erhält nur Ergebnisse** – `locationId`, nicht "Standort"

### Dokumentation
- ARCHITECTURE.md mit detailliertem 3-Ebenen-Diagramm
- Normalized Import Schema dokumentiert
- Import-Flow mit allen 7 Schritten beschrieben

### UI-Änderungen
- **Rules-Seite:** Match-Felder aktualisiert auf normalized Fields
  - Neue Felder: standort, counterpartyHint, arzt, zeitraum, kategorie, kontoname, krankenkasse, lanr, referenz
  - Entfernt: description, bookingReference, bookingSourceId (Legacy)
- **Quick-Start Examples:** Aktualisiert für typische Insolvenzfall-Szenarien
- **Info-Box:** Erklärt jetzt normalized Fields

---

## Version 2.4.0 – Alt/Neu-Massezuordnung Integration

**Datum:** 20. Januar 2026

### Neue Funktionen

#### Case-Konfiguration: Stichtag editierbar
- **Stichtag-Feld:** Im Case-Bearbeitungsformular kann der Stichtag (cutoffDate) gesetzt werden
- **Info-Box:** Erklärt die Bedeutung des Stichtags für Alt/Neu-Zuordnung
- **Validierung:** Datumsfeld mit Standard-HTML5-Datepicker

#### Import-Pipeline: Split-Engine Integration
- **Automatische Zuordnung:** Beim Import (to-ledger API) wird die Split-Engine automatisch aufgerufen
- **Estate Allocation:** Setzt `estateAllocation`, `estateRatio`, `allocationSource` auf LedgerEntry
- **Response-Info:** `estateAllocated` Counter zeigt Anzahl zugeordneter Einträge
- **Fallback:** `TRANSACTION_DATE_RULE` wenn kein cutoffDate oder keine Counterparty-Config

#### Ledger-Liste: Alt/Neu-Spalte & Filter
- **Neue Spalte:** "Alt/Neu" zeigt Massezuordnung mit farbigen Badges
- **Badge-Farben:**
  - Grün: Altmasse
  - Blau: Neumasse
  - Lila: Gemischt (mit Verhältnis)
  - Gelb: Unklar (erfordert manuelle Prüfung)
- **Filter-Dropdown:** Filtern nach Massezuordnung

#### Ledger-Detail: Manuelle Zuordnung
- **Anzeige:** Aktuelle Zuordnung mit Quelle und Begründung
- **Override:** Manuelle Überschreibung setzt automatisch `MANUELL` als Quelle
- **Transparenz:** Zeigt warum Zuordnung erfolgte (Regel, Datum, etc.)

### API-Änderungen

#### PUT /api/cases/[id]
- Neues Feld: `cutoffDate` akzeptiert

#### GET/PUT /api/cases/[id]/ledger/[entryId]
- Gibt `estateAllocation`, `estateRatio`, `allocationSource`, `allocationNote` zurück
- PUT akzeptiert manuelle Änderungen dieser Felder

#### GET /api/cases/[id]/ledger
- Neuer Filter: `estateAllocation` (ALTMASSE, NEUMASSE, MIXED, UNKLAR)
- Gibt Estate Allocation Felder für alle Einträge zurück

### Type-System
- **LedgerEntryResponse:** Erweitert um Estate Allocation Felder
- Alle `serializeLedgerEntry` Funktionen konsistent aktualisiert

### Technische Details
- Split-Engine aus `/lib/settlement/split-engine.ts` integriert
- Types aus `/lib/types/allocation.ts` importiert
- Keine neuen Schema-Änderungen (nutzt bestehende Felder aus 2.2.0)

### Fachliche Korrektur: Keine TRANSACTION_DATE_RULE
**WICHTIG:** Das Buchungsdatum (transactionDate) ist KEINE gültige Entscheidungsgrundlage für die Alt/Neu-Zuordnung!

Maßgeblich für die Zuordnung ist ausschließlich die **Forderungsentstehung**:
- `serviceDate` – Wann wurde die Leistung erbracht?
- `servicePeriod` – Welcher Zeitraum wird abgerechnet?
- Vertragslogik – Explizite Split-Regeln (z.B. KV Q4: 1/3-2/3)

Wenn keine Leistungsinformation vorhanden ist:
- `estateAllocation = UNKLAR`
- `allocationSource = UNKLAR`
- Manuelle Zuordnung durch Benutzer erforderlich

Das Buchungsdatum darf höchstens als technischer Hinweis dienen, niemals als automatischer Fallback.

---

## Version 2.5.0 – ServiceDate-Vorschläge & Bulk-Accept

**Datum:** 24. Januar 2026

### Neue Funktionen

#### ServiceDate-Regeln für Alt/Neu-Zuordnung
- **Regel-basierte Leistungsdatum-Zuweisung:** ClassificationRules können jetzt `assignServiceDateRule` setzen
- **Drei Regel-Typen:**
  - `SAME_MONTH`: Leistungsdatum = Zahlungsmonat (Miete, Software, laufende Kosten)
  - `VORMONAT`: HZV-Logik, Zahlung bezieht sich auf Vormonat
  - `PREVIOUS_QUARTER`: Quartals-Schlusszahlungen (KV/HZV)
- **Automatische Berechnung:** Bei Übernahme wird `estateAllocation` via Split-Engine berechnet

#### Bulk-Accept für ServiceDate-Vorschläge
- **Neuer Button:** "ServiceDate-Vorschläge" (lila) im Ledger-Review-Tab
- **Preview-Modal:** Zeigt alle Einträge mit Vorschlägen in Tabellenansicht
  - Buchungsdatum, Beschreibung, Betrag
  - Angewandte Regel (SAME_MONTH, VORMONAT, PREVIOUS_QUARTER)
  - Vorgeschlagenes Leistungsdatum/-zeitraum
- **"Alle übernehmen"-Button:** Bulk-Accept mit automatischer Alt/Neu-Berechnung

#### Regel-Anzeige in Ledger-Details
- **Regel-Name:** Zeigt `suggestedReason` mit erklärenden Texten
- **Link zur Regel:** "Regel anzeigen →" verlinkt zur Rules-Übersicht

### API-Erweiterungen

#### POST /api/cases/[id]/ledger/bulk-review
- **Neuer Parameter:** `applyServiceDateSuggestions: true`
- **Funktionalität:**
  - Übernimmt `suggestedServiceDate` oder `suggestedServicePeriodStart/End`
  - Ruft Split-Engine auf mit `cutoffDate` des Falls
  - Setzt `estateAllocation`, `estateRatio`, `allocationSource`, `allocationNote`

#### GET /api/cases/[id]/ledger
- **Neuer Filter:** `hasServiceDateSuggestion=true` für Preview-Modal

### Neue Scripts

| Script | Beschreibung |
|--------|--------------|
| `scripts/create-hvplus-service-date-rules.ts` | Erstellt 19 ServiceDate-Regeln für HVPlus |
| `scripts/run-classification.ts` | Wendet Regeln auf bestehende UNREVIEWED-Einträge an |

### Schema-Dokumentation

LedgerEntry ServiceDate-Vorschläge (aus Phase C):
```prisma
// Vorgeschlagene ServiceDate-Werte (von Classification Engine)
suggestedServiceDate          DateTime?
suggestedServicePeriodStart   DateTime?
suggestedServicePeriodEnd     DateTime?
suggestedServiceDateRule      String?   // VORMONAT | SAME_MONTH | PREVIOUS_QUARTER
```

### HVPlus-spezifische Regeln

19 Regeln für automatische ServiceDate-Zuweisung:

| Kategorie | Anzahl | Regel |
|-----------|--------|-------|
| HZV-Monatsabschläge | 4 | SAME_MONTH |
| KV/HZV Quartals-Schluss | 2 | PREVIOUS_QUARTER |
| HAVG/HAEVG allgemein | 1 | VORMONAT |
| Patientenzahlungen | 2 | SAME_MONTH |
| Laufende Kosten | 10 | SAME_MONTH |

---

## Version 2.6.0 – Liquiditätsmatrix & Standort-Sichten

**Datum:** 24. Januar 2026

### Neue Funktionen

#### IV-konforme Liquiditätstabelle
- **Neuer Dashboard-Tab:** "Liquiditätstabelle" zwischen "Übersicht" und "Einnahmen"
- **Block-Struktur nach IV-Standard:**
  - Zahlungsmittelbestand am Anfang (mit Bank-Split: Sparkasse/apoBank)
  - Operativer Cash-In (KV, HZV, PVS, Patientenzahlungen)
  - Operativer Cash-Out (Personal je Standort, Miete, Betrieblich)
  - Steuerlicher Cash-Out (USt, Sonstige Steuern)
  - Insolvenzspezifischer Cash-Out (Verfahren, Beratung, Fortführung)
  - Zahlungsmittelbestand am Ende (mit Bank-Split)
- **IST/PLAN-Badge:** Pro Periode farbige Kennzeichnung (Grün/Lila/Grau)
- **Validierungswarnungen:** Rechendifferenz, Negativsaldo, UNKLAR-Anteil

#### Row-Mapping-Konfiguration
- **Keine hardcodierten Text-Matches im View:** Alle Zuordnungen via `matrix-config.ts`
- **Match-Kriterien:**
  - `COUNTERPARTY_PATTERN`: Regex auf Gegenpartei-Name
  - `LOCATION_ID`: Exakte Standort-ID
  - `DESCRIPTION_PATTERN`: Regex auf Buchungsbeschreibung
  - `LEGAL_BUCKET`: Rechtlicher Bucket (MASSE, ABSONDERUNG)
  - `BANK_ACCOUNT_ID`: Für Bank-Splits
  - `FALLBACK`: Catch-All für nicht zugeordnete Einträge

#### Standortspezifische Liquiditätssicht (Scope)
- **Scope-Toggle:** Gesamt / Velbert (Standalone) / Uckerath/Eitorf
- **WICHTIG:** Filter erfolgt VOR der Aggregation (echte Standort-Sicht)
- **Zentrale Verfahrenskosten:** In Standort-Scopes automatisch ausgeschlossen
- **Hinweis-Banner:** Bei Standort-Sicht wird Einschränkung angezeigt

#### Velbert-spezifische Personalzeilen
- **Nur in Velbert-Scope sichtbar:**
  - Personal – Vertretungsarzt
  - – Wegfall Gehalt Arzt A
  - – Wegfall Gehalt Arzt B
- **In GLOBAL aggregiert:** Unter "Personal – Velbert"

### API-Erweiterungen

#### GET /api/cases/[id]/dashboard/liquidity-matrix
- **Query-Parameter:**
  - `estateFilter`: GESAMT | ALTMASSE | NEUMASSE | UNKLAR
  - `showDetails`: true | false
  - `scope`: GLOBAL | LOCATION_VELBERT | LOCATION_UCKERATH_EITORF
- **Response enthält:**
  - `scope`, `scopeLabel`, `scopeHint` für UI-Anzeige
  - `blocks` mit aggregierten Zeilen und Werten
  - `validation` mit Prüfergebnissen
  - `meta` mit Statistiken (IST/PLAN-Counts)

### Neue Dateien

| Datei | Beschreibung |
|-------|--------------|
| `src/lib/cases/haevg-plus/matrix-config.ts` | Row-Mapping-Konfiguration mit ~25 Zeilen |
| `src/app/api/cases/[id]/dashboard/liquidity-matrix/route.ts` | API-Endpoint |
| `src/components/dashboard/LiquidityMatrixTable.tsx` | UI-Komponente |

### Architektur-Entscheidungen

#### Scope-Filter vor Aggregation
Der Scope-Filter (`filterEntriesByScope()`) wird VOR der Perioden-Aggregation angewandt:
```typescript
// 3b. Apply Scope Filter - WICHTIG: VOR der Aggregation!
const entries = filterEntriesByScope(allEntries, scope);
```

Dies stellt sicher, dass:
- Öffnungs- und Endbestände nur für den Scope gelten
- Summen nur Entries des Scopes enthalten
- Keine doppelte Filterung (einmal für Anzeige, einmal für Berechnung)

#### Zentrale Verfahrenskosten
Erkennung via `isCentralProcedureCost()`:
- Entries ohne `locationId`
- Entries mit `legalBucket = ABSONDERUNG`
- Pattern-Match auf insolvenzspezifische Beschreibungen

---

## Version 2.7.0 – Dashboard-Konsistenz & Globaler Scope

**Datum:** 24. Januar 2026

### Neue Funktionen

#### reviewStatus-Toggle in Liquiditätsmatrix
- **Admin-Toggle:** "inkl. ungeprüfte Buchungen" checkbox in der Liquiditätstabelle
- **Query-Parameter:** `includeUnreviewed=true|false` (Default: false)
- **Verhalten:**
  - Default: Nur CONFIRMED + ADJUSTED Buchungen
  - Mit Toggle: Alles außer REJECTED (inkl. UNREVIEWED)
- **Warnung-Banner:** Wenn ungeprüfte Buchungen enthalten sind:
  - Gelbes Banner mit Anzahl ungeprüfter Buchungen
  - "Diese Zahlen sind vorläufig"
- **Meta-Daten:** `unreviewedCount` in API-Response für Statistiken

#### Estate-Trennung in Locations
- **API-Parameter:** `estateFilter=GESAMT|ALTMASSE|NEUMASSE|UNKLAR`
- **estateBreakdown pro Standort:** Jeder Standort enthält jetzt:
  - `ALTMASSE`: inflowsCents, outflowsCents, netCents, count, isViable
  - `NEUMASSE`: inflowsCents, outflowsCents, netCents, count, isViable
  - `UNKLAR`: inflowsCents, outflowsCents, netCents, count, isViable
- **Viability-Check:** `isViable: true` wenn Einnahmen > Ausgaben
- **UI-Toggle:** Estate-Filter in LocationView (Gesamt/Altmasse/Neumasse/Unklar)
- **Info-Banner:** Erklärt aktiven Filter mit Kontext zur Alt/Neu-Trennung

#### Globaler Scope-State im Dashboard
- **Neuer UI-Toggle:** "Standort-Sicht" im Dashboard-Header (über den Tabs)
- **Drei Scopes:** Gesamt / Velbert (Standalone) / Uckerath/Eitorf
- **Konsistente Anwendung:** Scope gilt für alle Tabs (aktuell: Liquiditätstabelle)
- **Hinweis-Banner:** "Zentrale Verfahrenskosten sind in dieser Sicht nicht enthalten"
- **Controlled Component:** LiquidityMatrixTable akzeptiert scope als Prop

#### Scope in Dashboard-API (Übersicht)
- **Query-Parameter:** `scope=GLOBAL|LOCATION_VELBERT|LOCATION_UCKERATH_EITORF`
- **KPIs scope-aware:** Aggregation erfolgt nur für gewählten Scope
- **Response enthält:** `scope`, `scopeLabel`, `scopeHint`
- **Zentrale Verfahrenskosten:** Automatisch ausgeschlossen bei Standort-Scopes

### API-Erweiterungen

#### GET /api/cases/[id]/dashboard/liquidity-matrix
- Neuer Parameter: `includeUnreviewed` (boolean)
- Response erweitert um `unreviewedCount` in meta

#### GET /api/cases/[id]/dashboard/locations
- Neuer Parameter: `estateFilter` (GESAMT|ALTMASSE|NEUMASSE|UNKLAR)
- Response erweitert um `estateBreakdown` pro Location

#### GET /api/cases/[id]/dashboard
- Neuer Parameter: `scope` (GLOBAL|LOCATION_VELBERT|LOCATION_UCKERATH_EITORF)
- Response erweitert um `scope`, `scopeLabel`, `scopeHint`

### Komponenten-Änderungen

#### LiquidityMatrixTable.tsx
- Neue Props: `scope?`, `onScopeChange?`, `hideScopeToggle?`
- Controlled/Uncontrolled Mode für Scope
- Exportiert: `LiquidityScope`, `SCOPE_LABELS`

#### UnifiedCaseDashboard.tsx
- Neuer State: `scope` (LiquidityScope)
- Globaler Scope-Toggle im Header
- Übergibt scope an LiquidityMatrixTable

#### LocationView.tsx
- Neuer State: `estateFilter` (EstateFilter)
- Estate-Toggle (Gesamt/Altmasse/Neumasse/Unklar)
- Info-Banner bei aktivem Filter

### Architektur-Analyse

#### Zwei Aggregationsfunktionen – bewusste Trennung
Nach Analyse der bestehenden Aggregationsfunktionen:

| Datei | Verwendung | Zweck |
|-------|------------|-------|
| `/lib/ledger-aggregation.ts` | Dashboard, Share, Customer | Einfache Dashboard-Aggregation mit Scope |
| `/lib/ledger/aggregation.ts` | 8 API-Routen | Rolling Forecast, Availability, Counterparty-Aggregation, Cache |

**Entscheidung:** Keine Konsolidierung – beide erfüllen unterschiedliche Anforderungen.

### Technische Details

#### Scope-Filterung
- Filter erfolgt VOR Aggregation (nicht nachträglich)
- Zentrale Verfahrenskosten erkannt via Pattern + legalBucket
- Location-IDs case-insensitive gematcht

---

## Version 2.8.0 – IST-Vorrang & Scope-spezifische Zeilen

**Datum:** 25. Januar 2026

### Neue Funktionen

#### IST-Vorrang-Logik
- **Grundprinzip:** Wenn IST-Daten für eine Periode existieren, werden PLAN-Daten ignoriert
- **Begründung:** Bankbewegungen sind Realität – Planung ist nur noch historisch relevant
- **Implementierung:**
  - Voranalyse: Welche Perioden haben IST-Daten?
  - Aggregation: PLAN-Entries für diese Perioden werden übersprungen
  - `planIgnoredCount` in Meta-Daten zeigt ignorierte PLAN-Buchungen
- **UI-Banner:** Grünes Info-Banner "IST-Daten verwendet - X PLAN-Buchungen wurden durch IST-Daten ersetzt"
- **Badge-Auswirkung:** Perioden zeigen jetzt "IST" statt "MIXED" wenn IST-Daten vorhanden

#### Scope-spezifische Zeilen
- **Personal-Zeilen nur im passenden Scope:**
  - "Personal – Velbert" nur in GLOBAL + LOCATION_VELBERT
  - "Personal – Uckerath/Eitorf" nur in GLOBAL + LOCATION_UCKERATH_EITORF
- **Insolvenzspezifische Zeilen nur in GLOBAL:**
  - "Insolvenzspezifischer Cash-Out" Block
  - Alle IV-Vergütungs- und Verfahrenskosten-Zeilen
- **Dynamische Filterung:** `visibleInScopes` in MatrixRowConfig
- **Leere Blöcke ausgeblendet:** UI filtert Blöcke ohne sichtbare Zeilen

#### Scope-Label-Verbesserung
- **Vorher:** "Velbert (Standalone)"
- **Nachher:** "Velbert"
- **Konsistenz:** Label in matrix-config.ts und dashboard/route.ts vereinheitlicht

### API-Erweiterungen

#### GET /api/cases/[id]/dashboard/liquidity-matrix
- Response erweitert um `planIgnoredCount` in meta
- Zeilen-Filterung berücksichtigt `visibleInScopes`
- IST-Vorrang-Logik in Aggregation integriert

### Komponenten-Änderungen

#### LiquidityMatrixTable.tsx
- IST-Vorrang Info-Banner (grün) bei `planIgnoredCount > 0`
- Filter für leere Blöcke (`.filter((block) => block.rows.length > 0)`)
- Meta-Interface erweitert um `planIgnoredCount`

#### matrix-config.ts
- Neue Property: `visibleInScopes?: LiquidityScope[]`
- Personal-Zeilen mit Scope-Einschränkung
- Insolvenz-Zeilen nur in GLOBAL sichtbar

#### Echter IST/PLAN-Vergleich Tab
- **Neuer API-Endpoint:** `/api/cases/[id]/dashboard/ist-plan-comparison`
- **WICHTIG:** Hier wird KEIN IST-Vorrang angewandt – beide Werte werden angezeigt
- **Neue Komponente:** `IstPlanComparisonTable.tsx`
- **Features:**
  - Summary-Cards: IST-Summen, PLAN-Summen, Abweichung
  - Zwei Ansichtsmodi: Netto-Ansicht und Detailansicht (Einnahmen/Ausgaben)
  - Abweichungsspalten mit farblicher Kennzeichnung (grün = positiv, rot = negativ)
  - Prozentuale Abweichung pro Periode
  - Status-Badges pro Periode (IST, PLAN, IST+PLAN)
- **Interpretation:** Positive Abweichung bei Einnahmen = gut, positive bei Ausgaben = schlecht

### Architektur-Entscheidung

#### IST vor PLAN (ADR)
- **Problem:** Perioden mit IST+PLAN zeigten "MIXED" und summierten beide
- **Entscheidung:** IST hat Vorrang – PLAN wird ignoriert wenn IST existiert
- **Auswirkung:** Saubere Trennung zwischen Realität und Planung
- **Vergleichs-View:** Separater Tab zeigt beide Werte für Vergleich

---

## Geplante Änderungen

Keine ausstehenden Änderungen

---

## Hinweise zur Dokumentation

Dieses Protokoll wird automatisch bei jeder wesentlichen Änderung aktualisiert. Jeder Eintrag enthält:
- **Was** geändert wurde
- **Warum** die Änderung erfolgte
- **Auswirkungen** für Benutzer
