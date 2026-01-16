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

**Wir sind Unternehmensberater** die Insolvenzverwalter bei der Liquiditaetsplanung unterstuetzen.

### Hauptakteure

| Begriff | Rolle | System-Entity |
|---------|-------|---------------|
| **Kunden** | Insolvenzverwalter (unsere Mandanten) | `CustomerUser` |
| **Faelle** | Einzelne Insolvenzverfahren | `Case` |
| **Wir** | Interne Berater (Admin-Zugang) | Admin-Session |

### Beziehungen

```
Kunde (Insolvenzverwalter)
    |
    +-- Fall 1 (Insolvenzverfahren)
    |       +-- Liquiditaetsplan
    |       +-- Daten-Importe
    |
    +-- Fall 2 (Insolvenzverfahren)
            +-- Liquiditaetsplan
            +-- Daten-Importe
```

### Hinweis: "Projekte" (Legacy)

Die Entitaet "Projekte" existiert noch im System, ist aber konzeptionell mit "Kunden" identisch. Langfristig sollte dies vereinfacht werden:
- Projekte = Kunden = Insolvenzverwalter
- Ein Kunde hat mehrere Faelle

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

- `/app` – Next.js application root
- `/app/src/app/admin/*` – Internal admin dashboard
- `/app/src/app/view/*` – External read-only view for insolvency administrators
- `/app/src/app/api/*` – API routes
- `/app/src/components/*` – React components
- `/app/src/lib/*` – Business logic, calculations, utilities
- `/app/docs/*` – Documentation (German)

## Key Patterns & Conventions

1. **All UI text must be in German** – professional, clear language for insolvency administrators
2. **Living Documentation** – automatically maintain:
   - `docs/CHANGELOG.md` – what changed
   - `docs/DECISIONS.md` – why decisions were made
   - `docs/LIMITATIONS.md` – known constraints
3. **Calculation engine is immutable** – presentation layer never modifies calculation logic
4. **13-week horizon** – fixed industry standard, not configurable

## Documentation Requirements

When making changes, always update the relevant documentation files:
- Functional changes → CHANGELOG.md
- Design decisions → DECISIONS.md
- New limitations → LIMITATIONS.md
