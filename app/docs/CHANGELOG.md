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

## Geplante Änderungen

Keine ausstehenden Änderungen

---

## Hinweise zur Dokumentation

Dieses Protokoll wird automatisch bei jeder wesentlichen Änderung aktualisiert. Jeder Eintrag enthält:
- **Was** geändert wurde
- **Warum** die Änderung erfolgte
- **Auswirkungen** für Benutzer
