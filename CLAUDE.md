# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Inso-Liquiplanung** – Insolvency Liquidity Planning application for German insolvency administrators.

- **Repository:** https://github.com/dp-213/Inso-liquiplanung.git
- **Language:** German (all UI, documentation, error messages)
- **Framework:** Next.js 15 with App Router
- **Database:** Turso (libSQL) via Prisma ORM
- **Deployment:** Vercel

## Domain Model (Business Context)

**Wir sind Unternehmensberater** die Insolvenzverwalter bei der Liquiditätsplanung unterstützen.

### Hauptakteure

| Begriff | Rolle | System-Entity |
|---------|-------|---------------|
| **Kunden** | Insolvenzverwalter (unsere Mandanten) | `CustomerUser` |
| **Fälle** | Einzelne Insolvenzverfahren | `Case` |
| **Wir** | Interne Berater (Admin-Zugang) | Admin-Session |

### Beziehungen

```
Kunde (Insolvenzverwalter)
    |
    +-- Fall 1 (Insolvenzverfahren)
    |       +-- Liquiditätsplan
    |       +-- Daten-Importe
    |
    +-- Fall 2 (Insolvenzverfahren)
            +-- Liquiditätsplan
            +-- Daten-Importe
```

### Hinweis: "Projekte" (Legacy)

Die Entität "Projekte" existiert noch im System, ist aber konzeptionell mit "Kunden" identisch. Langfristig sollte dies vereinfacht werden:
- Projekte = Kunden = Insolvenzverwalter
- Ein Kunde hat mehrere Fälle

## Git Repository

This project uses Git for version control.

- **Remote:** `origin` → https://github.com/dp-213/Inso-liquiplanung.git
- **Main branch:** `main`
- Always commit and push changes when requested.

## Build & Development Commands

```bash
cd app
npm install          # Install dependencies
npm run dev          # Start development server (localhost:3000)
npm run build        # Production build
npx prisma generate  # Generate Prisma client
npx prisma db push   # Sync database schema
```

## Architecture

### Verzeichnisstruktur

- `/app` – Next.js application root
- `/app/src/app/admin/*` – Internal admin dashboard
- `/app/src/app/portal/*` – Customer portal for insolvency administrators
- `/app/src/app/view/*` – External read-only view (share links)
- `/app/src/app/api/*` – API routes
- `/app/src/components/*` – React components
- `/app/src/lib/*` – Business logic, calculations, utilities
- `/app/docs/*` – Documentation (German)

### Kern-Architektur

**LedgerEntry ist Single Source of Truth** – Alle Buchungen sind LedgerEntries mit:
- Steuerungsdimensionen: `valueType` (IST/PLAN), `legalBucket` (MASSE/ABSONDERUNG/NEUTRAL)
- Dimensionen: `bankAccountId`, `counterpartyId`, `locationId`
- Estate Allocation: `estateAllocation` (ALTMASSE/NEUMASSE/MIXED/UNKLAR), `estateRatio`
- Revisionssprache: `allocationSource`, `allocationNote` (Audit-Trail)
- Klassifikations-Vorschläge: `suggestedLegalBucket`, `suggestedCounterpartyId`, etc.
- Governance: `reviewStatus` (UNREVIEWED/CONFIRMED/ADJUSTED)

**Classification Engine** – Rule-basierte Klassifikation:
- `ClassificationRule` matcht auf Beschreibung/Betrag
- Erstellt nur Vorschläge (`suggested*`), nie Auto-Commit
- `matchCounterpartyPatterns()` für automatische Gegenpartei-Erkennung
- `assignServiceDateRule`: SAME_MONTH, VORMONAT, PREVIOUS_QUARTER für Alt/Neu-Zuordnung
- Bulk-Accept mit Preview-Modal für effiziente Massenverarbeitung

**Split-Engine** – Alt/Neu-Masse-Zuordnung (`/lib/settlement/split-engine.ts`):
- Fallback-Kette: VERTRAGSREGEL → SERVICE_DATE_RULE → PERIOD_PRORATA → VORMONAT_LOGIK → UNKLAR
- Revisionssprache: Jede Zuordnung ist begründet und nachvollziehbar

**Case-spezifische Konfiguration** – Jeder Fall hat eigene Regeln (`/lib/cases/[case-name]/config.ts`):
- Abrechnungsstellen (KV, HZV, PVS) mit Split-Regeln
- Banken mit Vereinbarungsstatus
- Standorte mit Bank-Zuordnung

## Key Patterns & Conventions

1. **All UI text must be in German** – professional, clear language for insolvency administrators
2. **Living Documentation** – automatically maintain:
   - `docs/CHANGELOG.md` – what changed
   - `docs/DECISIONS.md` – why decisions were made
   - `docs/LIMITATIONS.md` – known constraints
3. **Calculation engine is immutable** – presentation layer never modifies calculation logic
4. **13-week horizon** – fixed industry standard, not configurable

## WICHTIG: Deutsche Umlaute

**IMMER echte Umlaute verwenden, NIEMALS Ersatzschreibweisen!**

| RICHTIG | FALSCH |
|---------|--------|
| ä | ae |
| ö | oe |
| ü | ue |
| Ä | Ae |
| Ö | Oe |
| Ü | Ue |
| ß | ss |

Beispiele:
- ✅ `Fälle`, `Löschen`, `Übersicht`, `für`, `zurück`, `Änderung`
- ❌ `Faelle`, `Loeschen`, `Uebersicht`, `fuer`, `zurueck`, `Aenderung`

Dies gilt für:
- Alle UI-Texte (Labels, Buttons, Überschriften)
- Fehlermeldungen und Bestätigungstexte
- Kommentare im Code (wenn auf Deutsch)
- Dokumentation
- API-Responses mit deutschen Texten

## Production Infrastructure

### Vercel Deployment
- **Project:** `davids-projects-86967062/app`
- **Live URL:** https://app-beige-kappa-43.vercel.app
- **Auto-Deploy:** Push to `main` triggers automatic deployment

### Turso Database (Production)
- **Database Name:** `inso-liquiplanung`
- **URL:** `libsql://inso-liquiplanung-dp-213.aws-eu-west-1.turso.io`
- **Region:** AWS EU West 1 (Frankfurt)
- **CLI:** `turso db list` zeigt alle Datenbanken

### Environment Variables (bereits in Vercel konfiguriert)
| Variable | Beschreibung |
|----------|--------------|
| `DATABASE_URL` | Turso libSQL Connection String |
| `TURSO_AUTH_TOKEN` | Turso Auth Token |
| `ADMIN_USERNAME` | Admin Login |
| `ADMIN_PASSWORD` | Admin Passwort |
| `SESSION_SECRET` | JWT Session Secret |
| `NEXT_PUBLIC_APP_URL` | Public App URL |
| `ANTHROPIC_API_KEY` | Für AI-Preprocessing |

### Lokale Entwicklung vs. Production
- **Lokal:** SQLite (`DATABASE_URL="file:./dev.db"`)
- **Production:** Turso (automatische Erkennung via `libsql://` Prefix)
- Code in `src/lib/db.ts` wechselt automatisch basierend auf URL-Format

### Für Custom Domain
In Vercel Dashboard: Settings → Domains → eigene Domain hinzufügen

## Dokumentation

Alle Dokumentation liegt in `/app/docs/`:

| Datei | Inhalt | Wann aktualisieren |
|-------|--------|-------------------|
| `CHANGELOG.md` | Versionshistorie | Bei jeder funktionalen Änderung |
| `ARCHITECTURE.md` | System-Architektur | Bei strukturellen Änderungen |
| `DECISIONS.md` | Architektur-Entscheidungen | Bei wichtigen Design-Entscheidungen |
| `LIMITATIONS.md` | Bekannte Einschränkungen | Bei neuen Einschränkungen |

### Claude-spezifische Dateien

| Datei | Zweck |
|-------|-------|
| `CLAUDE.md` (root) | Diese Datei – Projekt-Kontext + Case-Übersicht (auto-geladen) |
| `.claude/agents/insolvency-liquidity-engineer.md` | Agent für Berechnungslogik |
| `.claude/agents/insolvency-admin-architect.md` | Agent für Admin/Ingestion |
| `.claude/agents/case-intake-analyst.md` | Agent für Case-Daten-Intake |
| `.claude/commands/doku.md` | `/doku` Command für Doku-Updates |
| `.claude/commands/liqui.md` | `/liqui` Command – Lädt vollständigen Case-Kontext |
| `.claude/commands/input.md` | `/input` Command – Case-Intake-Workflow |
| `Cases/*/case-context.json` | Akkumuliertes Case-Wissen (von `/liqui` gelesen) |

### Dokumentation aktualisieren

Nach größeren Änderungen `/doku` ausführen, um alle relevanten Dokumentationsdateien zu aktualisieren.

---

## PFLICHT: Selbst-Review vor jedem "Fertig"

**BEVOR du sagst, dass etwas fertig ist, MUSST du diese Checkliste durchgehen:**

### 1. Build & TypeScript
```bash
cd app && npm run build
```
- [ ] Build muss FEHLERFREI durchlaufen
- [ ] Keine TypeScript-Fehler
- [ ] Keine unbenutzten Imports (werden zu Fehlern)

### 2. Konsistenz prüfen
- [ ] **Alle ähnlichen Stellen angepasst?** (z.B. wenn Dashboard-Link geändert wird, ALLE Dashboard-Links finden und prüfen)
- [ ] **Routen konsistent?** Keine verwaisten Links zu alten Routen
- [ ] **Imports korrekt?** Neue Dateien korrekt importiert, keine zirkulären Imports

### 3. Datenbank-Änderungen
- [ ] Schema-Änderungen → `npx prisma db push` lokal UND SQL für Turso vorbereiten
- [ ] **Turso-Datetime-Format:** IMMER ISO-Format `2025-10-29T00:00:00.000Z`, NIE `2025-10-29` oder `2025-10-29 12:00:00`
- [ ] Neue Felder haben sinnvolle Defaults oder sind nullable

### 4. API-Änderungen
- [ ] Response-Format dokumentiert/konsistent
- [ ] Error-Handling vorhanden
- [ ] Auth-Check (`getSession()`) vorhanden

### 5. UI-Änderungen
- [ ] Deutsche Texte mit echten Umlauten (ä, ö, ü, ß)
- [ ] Loading-States vorhanden
- [ ] Error-States vorhanden
- [ ] Responsive/mobile-tauglich (zumindest nicht kaputt)

### 6. Vor Deployment
- [ ] `npm run build` erfolgreich
- [ ] Manuelle Smoke-Tests der geänderten Features überlegt
- [ ] Bei DB-Schema-Änderungen: Turso-Migration VOR Deployment

### 7. Nach größeren Änderungen
- [ ] `/doku` ausführen für Dokumentations-Update
- [ ] CHANGELOG.md aktualisiert

---

## Häufige Fehler (NICHT wiederholen!)

| Fehler | Lösung |
|--------|--------|
| Dashboard-Link geht zu falscher Route | ALLE Links zur Route suchen und prüfen (`grep -r "dashboard"`) |
| Turso datetime Fehler | ISO-Format: `2025-10-29T00:00:00.000Z` |
| Import nicht gefunden | Datei existiert? Pfad korrekt? Export vorhanden? |
| Unbenutzte Variable/Import | Entfernen oder verwenden |
| Route 404 | API-Route existiert? Datei am richtigen Ort? |
| "Fälle konnten nicht geladen werden" | `credentials: 'include'` in ALLEN fetch-Aufrufen! |
| 401 Unauthorized im Frontend | `credentials: 'include'` fehlt bei fetch() |

---

## Standard-Entwicklungs-Workflow

**IMMER diesem Workflow folgen, um lokale und Production-Versionen synchron zu halten:**

### Phase 1: Lokale Entwicklung

```bash
cd app
npm run dev  # Start Dev-Server auf localhost:3000
```

- **Datenbank:** SQLite (`dev.db` in `/app`)
- **Änderungen machen** und im Browser testen
- **Sicherstellen, dass alles funktioniert** bevor du weitergehst

### Phase 2: Build-Verifikation

```bash
npm run build
```

**Checkliste vor Commit:**
- ✅ Build läuft FEHLERFREI durch
- ✅ Keine TypeScript-Fehler
- ✅ Keine unbenutzten Imports
- ✅ Alle geänderten Features lokal getestet

### Phase 3: Datenbank-Synchronisation (bei Schema-Änderungen)

**Falls Prisma Schema geändert wurde:**

1. **Lokal synchronisieren:**
   ```bash
   npx prisma db push
   ```

2. **Turso-Migration vorbereiten:**
   ```bash
   # Schema exportieren
   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > migration.sql

   # Oder: Aus lokalem Schema extrahieren
   sqlite3 dev.db .schema > schema.sql
   ```

3. **Turso-Migration VOR Deployment ausführen:**
   ```bash
   # Authentifizierung
   turso auth login

   # Datenbank auswählen (aktuell: inso-liquiplanung-v2)
   turso db shell inso-liquiplanung-v2 < migration.sql

   # Verifizieren
   turso db shell inso-liquiplanung-v2 ".schema tablename"
   ```

**WICHTIG:** Turso-Migration MUSS VOR Code-Deployment erfolgen, sonst crasht Production!

### Phase 4: Commit & Push

```bash
git add .
git commit -m "feat: Beschreibung der Änderung

- Detail 1
- Detail 2

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

git push origin main
```

**Vercel deployt automatisch** nach Push zu `main`

### Phase 5: Deployment-Verifikation

1. **Deployment-Status überwachen:**
   - Vercel Dashboard: https://vercel.com/davids-projects-86967062/app/deployments
   - Oder: `vercel logs --follow`

2. **Live-App testen:**
   - URL: https://app-beige-kappa-43.vercel.app
   - Admin Login testen
   - Geänderte Features kurz durchklicken
   - Browser DevTools Console auf Fehler prüfen

3. **Bei Fehlern: Sofortiger Rollback**
   ```bash
   # Option 1: Vercel Dashboard → Previous Deployment → "Promote to Production"
   # Option 2: Git Revert
   git revert HEAD --no-edit
   git push origin main
   ```

### Datenbank-Strategie

| Umgebung | Datenbank | Connection | Zweck |
|----------|-----------|------------|-------|
| **Lokal** | SQLite | `file:./dev.db` | Entwicklung & Testing |
| **Production** | Turso (libSQL) | `libsql://inso-liquiplanung-v2-...` | Live-Daten |

**Code in `src/lib/db.ts` erkennt automatisch** anhand der `DATABASE_URL`, welche Datenbank verwendet wird.

### Turso-Migration Checkliste

**Bei jeder Schema-Änderung:**

1. ✅ Lokal mit SQLite testen (`npx prisma db push`)
2. ✅ Migration-SQL erstellen
3. ✅ Turso-DB sichern (optional): `turso db shell inso-liquiplanung-v2 ".backup /tmp/backup-$(date +%Y%m%d).sql"`
4. ✅ Migration auf Turso ausführen
5. ✅ Schema verifizieren
6. ✅ Erst dann Code deployen (git push)

### Häufige Deployment-Fehler

| Fehler | Ursache | Lösung |
|--------|---------|--------|
| "no such column: xyz" | Schema nicht synchronisiert | Turso-Migration vergessen, nachträglich ausführen + Rollback erwägen |
| "Invalid URL" | Environment Variable mit `\n` | Ohne Newline setzen: `printf "value" \| vercel env add` |
| Build fehlschlägt | TypeScript-Fehler | Lokal `npm run build` VOR push ausführen |
| 500 Errors in Production | Daten fehlen in Turso | Daten von SQLite nach Turso migrieren |

---

## Aktive Fälle (Case Knowledge)

### Case-Ordner-Struktur

Alle Falldaten liegen unter `/Cases/<Case-Name>/`:

```
/Cases/<Case-Name>/
    case-context.json           # Akkumuliertes Wissen (IMMER zuerst lesen!)
    /01-raw/                    # Original-Dateien
    /02-extracted/              # Strukturierte JSONs
    /03-classified/             # IST/PLAN/ANNAHMEN/STRUKTUR/VERTRAEGE/REFERENZ
    /06-review/                 # Analysen, Traceability, offene Fragen
```

**Wichtig:** Bei Arbeit an einem Fall IMMER zuerst `case-context.json` lesen. Dort stehen alle Kontakte, Bankverbindungen, Standorte, LANR-Zuordnungen, Abrechnungsregeln und offene Datenanforderungen.

---

### Fall: Hausärztliche Versorgung PLUS eG (HVPlus)

**Pfad:** `/Cases/Hausärztliche Versorgung PLUS eG/`
**Vollständiger Kontext:** `case-context.json` (555 Zeilen, alle Details)

#### Eckdaten

| Feld | Wert |
|------|------|
| **Aktenzeichen** | 70d IN 362/25, AG Köln |
| **Insolvenz-Eröffnung** | 29.10.2025 |
| **IV** | Sarah Wolf (Anchor Rechtsanwälte, Hannes Rieger operativ) |
| **Beraterin** | Sonja Prinz (unser Team) |
| **Buchhalterin** | Frau Dupke |
| **Rechtsform** | eG (eingetragene Genossenschaft) |
| **Massekredit** | Sparkasse HRV, max. 137.000 EUR |

#### 3 Standorte

| Standort | Bank | HZV | KV (BSNR) |
|----------|------|-----|-----------|
| **Velbert** | Sparkasse HRV + ISK BW-Bank | Beyer, van Suntum, Kamler | Eigene BSNR |
| **Uckerath** | apoBank + ISK BW-Bank | Binas, Fischer, Ludwig, Schweitzer | BSNR 273203300 |
| **Eitorf** | Läuft über Uckerath | Rösing (aktivster Arzt!) | Über Uckerath |

#### Einnahmeströme & Alt/Neu-Regeln

| Quelle | Alt/Neu-Regel | Quelle der Regel |
|--------|---------------|------------------|
| **KV (KVNO)** | Q4/2025: 1/3 Alt, 2/3 Neu | Massekreditvertrag §1(2)a |
| **HZV (HAVG)** | Oktober: 28/31 Alt, 3/31 Neu; Zahlung M = Leistung M-1 | Massekreditvertrag §1(2)b |
| **PVS** | Nach Behandlungsdatum | Massekreditvertrag §1(2)c |

#### Wichtige Dokumente im Case-Ordner

| Datei | Inhalt |
|-------|--------|
| `case-context.json` | Vollständiger Kontext (Kontakte, Banken, LANR, Regeln) |
| `06-review/plan-traceability-matrix.md` | Herleitung jeder Zahl der IV-Liquiditätsplanung |
| `03-classified/PLAN/Liquiditätsplanung_HVPlus_20260114_versendet.json` | Die aktuelle Planung als JSON |
| `02-extracted/Annahme_Einnahmen_bis_Juni26.json` | Einnahmen-Prognosen je Standort |

#### Arbeitsstand

- IST-Daten: Oktober + November importiert, Dezember teilweise, Januar fehlt
- PLAN-Daten: Liquiditätsplanung vom 14.01.2026 analysiert und nachvollzogen
- Traceability-Matrix: Jede Zahl der Planung zu Quelldatei zurückverfolgt
- Offene Punkte: ISK-PDF-Extraktion Dez/Jan, apoBank-Vereinbarung klären
