---
description: Inso-Liquiplanung Projektkontext laden
---

# Inso-Liquiplanung

Du arbeitest jetzt am **Inso-Liquiplanung** Projekt - Liquiditaetsplanung fuer Insolvenzverwalter.

## Projekt-Details

- **Pfad**: /Users/david/Projekte/AI Terminal/Inso-Liquiplanung
- **App-Verzeichnis**: /Users/david/Projekte/AI Terminal/Inso-Liquiplanung/app
- **Framework**: Next.js 15 mit App Router
- **Datenbank**: Turso (libSQL) via Prisma
- **Sprache**: Deutsch (alle UI-Texte)

## Struktur

- `/app/src/app/admin/*` - Admin-Dashboard (intern)
- `/app/src/app/portal/*` - Kundenportal (Insolvenzverwalter)
- `/app/src/app/api/*` - API-Routen
- `/app/src/lib/*` - Business-Logik, Berechnungen

## Befehle

```bash
cd app && npm run dev     # Dev-Server starten
cd app && npm run build   # Production Build
cd app && npx prisma db push  # DB-Schema synchronisieren
```

## Spezial-Agenten

- `insolvency-liquidity-engineer` - Kernberechnungslogik
- `insolvency-admin-architect` - Admin-Dashboard, Daten-Import

$ARGUMENTS
