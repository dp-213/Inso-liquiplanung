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
| `CLAUDE.md` (root) | Diese Datei – Projekt-Kontext für Claude |
| `.claude/agents/insolvency-liquidity-engineer.md` | Agent für Berechnungslogik |
| `.claude/agents/insolvency-admin-architect.md` | Agent für Admin/Ingestion |
| `.claude/commands/doku.md` | `/doku` Command für Doku-Updates |
| `.claude/commands/liqui.md` | `/liqui` Command für Projekt-Kontext |

### Dokumentation aktualisieren

Nach größeren Änderungen `/doku` ausführen, um alle relevanten Dokumentationsdateien zu aktualisieren.
